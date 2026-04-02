"""
Step 1 — Route B: Multi-Scale Target Ensemble (Dalio approach)
Train 3 models on 10d/20d/40d forward returns, then IC-weighted ensemble.
Preserves trend-following paradigm while reducing label overlap.

Route B chosen over Route A (fractional differentiation) because:
- Preserves existing factor architecture (no paradigm shift)
- Lower implementation risk (no trend→mean-reversion conversion)
- Partially alleviates label overlap (10d model: N*≈10 vs N*≈5)
"""
import json
import numpy as np
import pandas as pd
import xgboost as xgb
from scipy.stats import spearmanr
from pathlib import Path
from config import (
    XGB_PARAMS, TRAIN_END, FORWARD_DAYS, OUTPUT_DIR, MODEL_PATH,
)
from features import get_factor_columns

# Multi-scale horizons
HORIZONS = [10, 20, 40]
HORIZON_NAMES = {10: "short", 20: "medium", 40: "long"}


def build_multiscale_targets(features_df: pd.DataFrame) -> pd.DataFrame:
    """Add multi-scale target columns to features DataFrame."""
    df = features_df.copy()
    if "gold_price" in df.columns:
        for h in HORIZONS:
            df[f"target_{h}d"] = (
                df["gold_price"].shift(-h) / df["gold_price"] - 1
            ) * 100
    return df


def train_multiscale_models(features_df: pd.DataFrame) -> dict:
    """
    Train 3 XGBoost models (10d, 20d, 40d) and compute IC-weighted ensemble.
    Returns dict with models, ICs, and weights.
    """
    factor_cols = get_factor_columns()
    df = build_multiscale_targets(features_df)

    train_mask = df.index <= pd.Timestamp(TRAIN_END)
    models = {}
    rolling_ics = {}
    oos_ics = {}

    print(f"\n{'='*60}")
    print(f"Multi-Scale Ensemble Training: {HORIZONS}")
    print(f"{'='*60}")

    for horizon in HORIZONS:
        target_col = f"target_{horizon}d"
        train_df = df[train_mask].dropna(subset=[target_col]).copy()
        test_df = df[~train_mask].dropna(subset=[target_col]).copy()

        train_df[factor_cols] = train_df[factor_cols].fillna(0)
        test_df[factor_cols] = test_df[factor_cols].fillna(0)

        X_train = np.nan_to_num(train_df[factor_cols].values.astype(np.float64),
                                nan=0.0, posinf=5.0, neginf=-5.0)
        y_train = train_df[target_col].values.astype(np.float64)

        X_test = np.nan_to_num(test_df[factor_cols].values.astype(np.float64),
                               nan=0.0, posinf=5.0, neginf=-5.0)
        y_test = test_df[target_col].values.astype(np.float64)

        # Adjust XGB params for different horizons
        params = XGB_PARAMS.copy()
        if horizon == 10:
            params["max_depth"] = 3  # Shorter horizon → simpler model
            params["n_estimators"] = 400
        elif horizon == 40:
            params["max_depth"] = 4
            params["n_estimators"] = 600
            params["learning_rate"] = 0.02  # Slower learning for longer horizon

        model = xgb.XGBRegressor(**params)
        model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

        # OOS IC
        if len(X_test) > 0:
            pred_test = model.predict(X_test)
            ic, _ = spearmanr(pred_test, y_test)
            ic = float(ic) if not np.isnan(ic) else 0.0
        else:
            ic = 0.0

        # Rolling 60d IC for adaptive weighting
        if len(X_test) >= 60:
            pred_all = model.predict(X_test)
            recent_ic, _ = spearmanr(pred_all[-60:], y_test[-60:])
            recent_ic = float(recent_ic) if not np.isnan(recent_ic) else 0.0
        else:
            recent_ic = ic

        oos_ics[horizon] = ic
        rolling_ics[horizon] = recent_ic

        # Save model
        model_path = MODEL_PATH.parent / f"model_{horizon}d.json"
        model.save_model(str(model_path))
        models[horizon] = model

        n_eff = len(test_df) / horizon
        print(f"  {horizon}d model: OOS IC={ic:+.4f}, "
              f"60d IC={recent_ic:+.4f}, "
              f"N*≈{n_eff:.0f}, "
              f"train={len(X_train)}, test={len(X_test)}")

    # ── Compute IC-weighted ensemble weights ─────────────────────────────────
    # Use rolling IC (recent performance) for adaptive weighting
    # Only use positive ICs; negative IC models get weight 0
    raw_weights = {}
    for h in HORIZONS:
        w = max(0, rolling_ics[h])  # Floor at 0
        raw_weights[h] = w

    total = sum(raw_weights.values())
    if total > 0:
        weights = {h: w / total for h, w in raw_weights.items()}
    else:
        # Fallback: equal weights if all ICs ≤ 0
        weights = {h: 1.0 / len(HORIZONS) for h in HORIZONS}

    print(f"\n  Ensemble weights (IC-adaptive):")
    for h in HORIZONS:
        print(f"    {h}d: {weights[h]:.3f} (IC={rolling_ics[h]:+.4f})")

    # ── Save ensemble config ─────────────────────────────────────────────────
    ensemble_config = {
        "timestamp": pd.Timestamp.now().isoformat(),
        "horizons": HORIZONS,
        "oos_ics": {str(h): round(v, 4) for h, v in oos_ics.items()},
        "rolling_ics": {str(h): round(v, 4) for h, v in rolling_ics.items()},
        "weights": {str(h): round(v, 4) for h, v in weights.items()},
        "model_paths": {str(h): str(MODEL_PATH.parent / f"model_{h}d.json") for h in HORIZONS},
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / "multiscale_ensemble.json"
    with open(out_path, "w") as f:
        json.dump(ensemble_config, f, indent=2)
    print(f"\n  Ensemble config saved to {out_path}")

    return {
        "models": models,
        "weights": weights,
        "oos_ics": oos_ics,
        "rolling_ics": rolling_ics,
        "config": ensemble_config,
    }


def predict_ensemble(features_row: pd.Series, models: dict = None, weights: dict = None) -> float:
    """
    Generate ensemble prediction for a single row.
    If models/weights not provided, loads from disk.
    """
    factor_cols = get_factor_columns()
    X = np.nan_to_num(
        features_row[factor_cols].values.reshape(1, -1).astype(np.float64),
        nan=0.0, posinf=5.0, neginf=-5.0
    )

    if models is None or weights is None:
        # Load from disk
        config_path = OUTPUT_DIR / "multiscale_ensemble.json"
        if not config_path.exists():
            # Fallback: use single 20d model
            model = xgb.XGBRegressor()
            model.load_model(str(MODEL_PATH))
            return float(model.predict(X)[0])

        with open(config_path) as f:
            config = json.load(f)

        models = {}
        weights = {}
        for h_str, path in config["model_paths"].items():
            h = int(h_str)
            m = xgb.XGBRegressor()
            m.load_model(path)
            models[h] = m
            weights[h] = config["weights"][h_str]

    # Weighted ensemble prediction
    ensemble_pred = 0.0
    for h, model in models.items():
        pred = float(model.predict(X)[0])
        # Normalize to 20d equivalent for consistent signal thresholds
        normalized = pred * (20.0 / h)
        ensemble_pred += normalized * weights[h]

    return ensemble_pred


if __name__ == "__main__":
    from fetch_data import fetch_all_data
    from features import build_features

    raw = fetch_all_data()
    feat = build_features(raw)
    result = train_multiscale_models(feat)

    # Test ensemble prediction on latest data
    latest = feat.dropna(subset=["gold_price"]).iloc[-1]
    pred = predict_ensemble(latest, result["models"], result["weights"])
    print(f"\nEnsemble prediction (latest): {pred:+.4f}%")
