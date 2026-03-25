"""
XGBoost training module with Purged Cross-Validation.
"""
import json
import numpy as np
import pandas as pd
import xgboost as xgb
from scipy.stats import spearmanr
from sklearn.model_selection import TimeSeriesSplit
from config import (
    XGB_PARAMS, TRAIN_END, FORWARD_DAYS, MODEL_PATH, OUTPUT_DIR, FACTOR_NAMES,
)
from features import get_factor_columns


class PurgedTimeSeriesSplit:
    """Time series split with purge gap to prevent look-ahead bias."""

    def __init__(self, n_splits: int = 5, purge_gap: int = 20):
        self.n_splits = n_splits
        self.purge_gap = purge_gap

    def split(self, X):
        n = len(X)
        fold_size = n // (self.n_splits + 1)

        for i in range(self.n_splits):
            train_end = fold_size * (i + 1)
            val_start = train_end + self.purge_gap
            val_end = min(val_start + fold_size, n)

            if val_start >= n or val_end <= val_start:
                continue

            train_idx = np.arange(0, train_end)
            val_idx = np.arange(val_start, val_end)
            yield train_idx, val_idx


def train_model(features_df: pd.DataFrame) -> xgb.XGBRegressor:
    """
    Train XGBoost model on features DataFrame.
    Returns trained model.
    """
    factor_cols = get_factor_columns()

    # Split train/test by date
    train_mask = features_df.index <= pd.Timestamp(TRAIN_END)
    train_df = features_df[train_mask].dropna(subset=["target"])
    test_df = features_df[~train_mask].dropna(subset=["target"])

    # Fill remaining NaN in features with 0 (factors without data)
    train_df = train_df.copy()
    test_df = test_df.copy()
    train_df[factor_cols] = train_df[factor_cols].fillna(0)
    test_df[factor_cols] = test_df[factor_cols].fillna(0)

    X_train = train_df[factor_cols].values.astype(np.float64)
    y_train = train_df["target"].values.astype(np.float64)
    X_test = test_df[factor_cols].values.astype(np.float64)
    y_test = test_df["target"].values.astype(np.float64)

    # Safety: replace any remaining inf
    X_train = np.nan_to_num(X_train, nan=0.0, posinf=5.0, neginf=-5.0)
    X_test = np.nan_to_num(X_test, nan=0.0, posinf=5.0, neginf=-5.0)

    print(f"Training set: {len(X_train)} samples ({train_df.index.min()} → {train_df.index.max()})")
    print(f"Test set:     {len(X_test)} samples ({test_df.index.min()} → {test_df.index.max()})")

    # ── Purged CV for hyperparameter validation ──────────────────────────────
    cv = PurgedTimeSeriesSplit(n_splits=5, purge_gap=FORWARD_DAYS)
    cv_scores = []

    for fold, (tr_idx, val_idx) in enumerate(cv.split(X_train)):
        model_cv = xgb.XGBRegressor(**XGB_PARAMS)
        model_cv.fit(
            X_train[tr_idx], y_train[tr_idx],
            eval_set=[(X_train[val_idx], y_train[val_idx])],
            verbose=False,
        )
        pred = model_cv.predict(X_train[val_idx])
        ic, _ = spearmanr(pred, y_train[val_idx])
        cv_scores.append(ic)
        print(f"  Fold {fold+1}: IC = {ic:.4f}")

    print(f"  CV Mean IC: {np.mean(cv_scores):.4f} ± {np.std(cv_scores):.4f}")

    # ── Train final model on full training set ────────────────────────────────
    model = xgb.XGBRegressor(**XGB_PARAMS)
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    # Test set IC
    test_pred = model.predict(X_test)
    test_ic, _ = spearmanr(test_pred, y_test)
    print(f"\nTest IC (Spearman): {test_ic:.4f}")

    # ── Save model ────────────────────────────────────────────────────────────
    model.save_model(str(MODEL_PATH))
    print(f"Model saved to {MODEL_PATH}")

    # ── Compute rolling IC history ────────────────────────────────────────────
    compute_ic_history(features_df, model)

    # ── Model health check (P1) ───────────────────────────────────────────────
    compute_model_health(features_df, model)

    # ── Run backtest on OOS data ──────────────────────────────────────────────
    from backtest import run_backtest as _run_backtest
    _run_backtest(features_df)

    return model


def compute_model_health(features_df: pd.DataFrame, model: xgb.XGBRegressor) -> dict:
    """
    P1: Compute model health metrics for monitoring dashboard.
    Returns a health report dict saved as model_health.json.
    """
    factor_cols = get_factor_columns()
    oos_mask = features_df.index > pd.Timestamp(TRAIN_END)
    oos_df = features_df[oos_mask].dropna(subset=factor_cols + ["target"])

    health = {
        "timestamp": pd.Timestamp.now().isoformat(),
        "n_factors": len(factor_cols),
        "factors": factor_cols,
        "train_end": TRAIN_END,
        "oos_samples": len(oos_df),
        "status": "healthy",
        "warnings": [],
    }

    if len(oos_df) < 20:
        health["status"] = "insufficient_data"
        health["warnings"].append(f"Only {len(oos_df)} OOS samples (need 20+)")
        return health

    X_oos = np.nan_to_num(oos_df[factor_cols].fillna(0).values.astype(np.float64),
                          nan=0.0, posinf=5.0, neginf=-5.0)
    y_oos = oos_df["target"].values
    pred_oos = model.predict(X_oos)

    # Overall OOS IC
    ic_overall, _ = spearmanr(pred_oos, y_oos)
    health["oos_ic"] = round(float(ic_overall), 4) if not np.isnan(ic_overall) else 0.0

    # Recent 60-day IC
    if len(oos_df) >= 60:
        ic_recent, _ = spearmanr(pred_oos[-60:], y_oos[-60:])
        health["recent_60d_ic"] = round(float(ic_recent), 4) if not np.isnan(ic_recent) else 0.0
    else:
        health["recent_60d_ic"] = health["oos_ic"]

    # IC trend: compare first half vs second half
    mid = len(pred_oos) // 2
    if mid >= 20:
        ic_first, _ = spearmanr(pred_oos[:mid], y_oos[:mid])
        ic_second, _ = spearmanr(pred_oos[mid:], y_oos[mid:])
        health["ic_first_half"] = round(float(ic_first), 4) if not np.isnan(ic_first) else 0.0
        health["ic_second_half"] = round(float(ic_second), 4) if not np.isnan(ic_second) else 0.0
        if ic_second < 0:
            health["warnings"].append(f"IC turned negative in recent period: {ic_second:.4f}")
            health["status"] = "degraded"
        elif ic_second < ic_first * 0.5:
            health["warnings"].append(f"IC declining: {ic_first:.4f} → {ic_second:.4f}")
            health["status"] = "warning"

    # Per-factor IC
    factor_ics = {}
    for j, fname in enumerate(factor_cols):
        ic, _ = spearmanr(X_oos[:, j], y_oos)
        factor_ics[fname] = round(float(ic), 4) if not np.isnan(ic) else 0.0
    health["factor_ics"] = factor_ics

    # Check for multicollinearity
    corr = pd.DataFrame(X_oos, columns=factor_cols).corr(method="spearman")
    high_corr_pairs = []
    for i_idx, fi in enumerate(factor_cols):
        for j_idx, fj in enumerate(factor_cols):
            if i_idx < j_idx and abs(corr.loc[fi, fj]) > 0.7:
                high_corr_pairs.append(f"{fi}×{fj}: {corr.loc[fi, fj]:.3f}")
    if high_corr_pairs:
        health["warnings"].append(f"High correlation pairs: {', '.join(high_corr_pairs)}")
    health["high_corr_pairs"] = len(high_corr_pairs)

    # Save health report
    out_path = OUTPUT_DIR / "model_health.json"
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(health, f, indent=2, ensure_ascii=False)
    print(f"Model health saved to {out_path} (status: {health['status']})")
    if health["warnings"]:
        for w in health["warnings"]:
            print(f"  ⚠ {w}")

    return health


def compute_ic_history(features_df: pd.DataFrame, model: xgb.XGBRegressor):
    """Compute rolling 60-day Spearman IC on pure OOS data only (after TRAIN_END)."""
    factor_cols = get_factor_columns()

    # Only use out-of-sample data for IC calculation to avoid inflated metrics
    oos_mask = features_df.index > pd.Timestamp(TRAIN_END)
    oos_df = features_df[oos_mask].dropna(subset=factor_cols + ["target"])

    if oos_df.empty or len(oos_df) < 20:
        print("WARNING: Not enough OOS data for IC calculation")
        output = {"rolling_ic": [], "factor_ic": [], "cv_mean_ic": 0.0}
        out_path = OUTPUT_DIR / "ic_history.json"
        with open(out_path, "w") as f:
            json.dump(output, f, indent=2)
        print(f"IC history saved to {out_path} (empty — insufficient OOS data)")
        return

    X_oos = np.nan_to_num(oos_df[factor_cols].fillna(0).values.astype(np.float64),
                          nan=0.0, posinf=5.0, neginf=-5.0)
    y_oos = oos_df["target"].values
    pred_oos = model.predict(X_oos)

    # Rolling 60-day IC (OOS only)
    window = min(60, len(oos_df) // 2)  # adapt window to available data
    window = max(window, 10)  # minimum 10 days
    ic_records = []
    dates = oos_df.index

    for i in range(window, len(dates)):
        start = i - window
        pred_win = pred_oos[start:i]
        actual_win = y_oos[start:i]
        ic, _ = spearmanr(pred_win, actual_win)
        ic_records.append({
            "date": dates[i].strftime("%Y-%m-%d"),
            "ic": round(float(ic), 4) if not np.isnan(ic) else 0.0,
        })

    # Per-factor IC on OOS data
    factor_ic = []
    for j, fname in enumerate(factor_cols):
        factor_vals = X_oos[:, j]
        target_vals = y_oos
        if len(factor_vals) > 20:
            ic, _ = spearmanr(factor_vals, target_vals)
            factor_ic.append({
                "factor": fname,
                "ic": round(float(ic), 4) if not np.isnan(ic) else 0.0,
            })

    ic_values = [r["ic"] for r in ic_records]
    output = {
        "rolling_ic": ic_records,
        "factor_ic": factor_ic,
        "cv_mean_ic": round(float(np.mean(ic_values)), 4) if ic_values else 0.0,
        "oos_start": TRAIN_END,
        "oos_samples": len(oos_df),
    }

    out_path = OUTPUT_DIR / "ic_history.json"
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"IC history saved to {out_path}")


if __name__ == "__main__":
    from fetch_data import fetch_all_data
    from features import build_features

    raw = fetch_all_data()
    feat = build_features(raw)
    model = train_model(feat)
