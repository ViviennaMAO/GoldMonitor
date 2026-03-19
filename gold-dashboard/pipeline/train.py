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

    return model


def compute_ic_history(features_df: pd.DataFrame, model: xgb.XGBRegressor):
    """Compute rolling 60-day Spearman IC and save to JSON."""
    factor_cols = get_factor_columns()
    valid = features_df.dropna(subset=factor_cols + ["target"])

    X_all = valid[factor_cols].values
    y_all = valid["target"].values
    pred_all = model.predict(X_all)

    # Rolling 60-day IC
    window = 60
    ic_records = []
    dates = valid.index

    for i in range(window, len(dates)):
        start = i - window
        pred_win = pred_all[start:i]
        actual_win = y_all[start:i]
        ic, _ = spearmanr(pred_win, actual_win)
        ic_records.append({
            "date": dates[i].strftime("%Y-%m-%d"),
            "ic": round(float(ic), 4) if not np.isnan(ic) else 0.0,
        })

    # Also compute per-factor IC
    factor_ic = []
    for j, fname in enumerate(factor_cols):
        factor_vals = X_all[-252:, j]  # last year
        target_vals = y_all[-252:]
        if len(factor_vals) > 20:
            ic, _ = spearmanr(factor_vals, target_vals)
            factor_ic.append({
                "factor": fname,
                "ic": round(float(ic), 4) if not np.isnan(ic) else 0.0,
            })

    output = {
        "rolling_ic": ic_records[-252:],  # last year
        "factor_ic": factor_ic,
        "cv_mean_ic": round(float(np.mean([r["ic"] for r in ic_records[-60:]])), 4),
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
