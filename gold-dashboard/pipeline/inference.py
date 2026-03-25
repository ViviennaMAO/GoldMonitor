"""
Daily inference module — loads trained model, predicts signal, computes SHAP values,
detects regime, and outputs all JSON files for the dashboard.
"""
import json
import numpy as np
import pandas as pd
import xgboost as xgb
import shap
from datetime import datetime
from config import (
    MODEL_PATH, OUTPUT_DIR, SIGNAL_THRESHOLDS, FACTOR_NAMES,
    FACTOR_DISPLAY, ATR_PERIOD, ATR_STOP_MULT, RISK_BUDGET,
    REGIME_HEALTHY, REGIME_CAUTION, REGIME_CIRCUIT_BREAK,
)
from features import get_factor_columns


class NaNSafeEncoder(json.JSONEncoder):
    """JSON encoder that converts NaN/Inf to null."""
    def default(self, obj):
        return super().default(obj)

    def encode(self, o):
        return super().encode(self._clean(o))

    def _clean(self, obj):
        if isinstance(obj, float):
            if np.isnan(obj) or np.isinf(obj):
                return None
            return obj
        if isinstance(obj, dict):
            return {k: self._clean(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [self._clean(v) for v in obj]
        return obj


def classify_signal(pred_return: float) -> str:
    """Classify predicted return into signal category."""
    if pred_return > SIGNAL_THRESHOLDS["strong_buy"]:
        return "Strong Buy"
    elif pred_return > SIGNAL_THRESHOLDS["buy"]:
        return "Buy"
    elif pred_return > SIGNAL_THRESHOLDS["sell"]:
        return "Neutral"
    elif pred_return > SIGNAL_THRESHOLDS["strong_sell"]:
        return "Sell"
    else:
        return "Strong Sell"


def signal_to_confidence(pred_return: float) -> float:
    """Convert predicted return to confidence percentage (0-100)."""
    return min(abs(pred_return) / 1.5 * 100, 100)


def detect_regime(features_row: dict) -> dict:
    """
    Detect market regime based on factor combination.
    Returns regime info with factor-level heatmap data.
    """
    # Risk-Off indicators: high GVZ, high GPR, rising real rates
    risk_off_score = 0
    risk_on_score = 0

    gvz_z = features_row.get("F6_GVZ", 0)
    ovx_z = features_row.get("F5_GPR", 0)
    tips_z = features_row.get("F3_TIPS10Y", 0)
    dxy_z = features_row.get("F1_DXY", 0)
    bei_z = features_row.get("F4_BEI", 0)

    if gvz_z > 1.0:
        risk_off_score += 1
    elif gvz_z < -0.5:
        risk_on_score += 1

    if ovx_z > 1.0:
        risk_off_score += 1
    elif ovx_z < -0.5:
        risk_on_score += 1

    if tips_z > 1.0:
        risk_off_score += 1  # Rising real rates hurt gold
    elif tips_z < -0.5:
        risk_on_score += 1

    if dxy_z > 1.0:
        risk_off_score += 1  # Strong dollar bad for gold
    elif dxy_z < -0.5:
        risk_on_score += 1

    if bei_z > 0.5:
        risk_on_score += 1  # Rising inflation good for gold

    if risk_off_score >= 3:
        regime = "Risk-Off"
        regime_mult = REGIME_CAUTION
    elif risk_on_score >= 3:
        regime = "Risk-On"
        regime_mult = REGIME_HEALTHY
    else:
        regime = "Transition"
        regime_mult = REGIME_CAUTION

    return {
        "regime": regime,
        "multiplier": regime_mult,
        "risk_off_score": risk_off_score,
        "risk_on_score": risk_on_score,
    }


def build_regime_heatmap(features_df: pd.DataFrame, months: int = 6) -> list:
    """Build regime heatmap data for the last N months."""
    factor_cols = get_factor_columns()
    recent = features_df.dropna(subset=factor_cols).tail(months * 22)  # ~22 trading days/month

    # Group by month
    monthly = recent.resample("ME").last()
    heatmap = []

    for date, row in monthly.iterrows():
        month_data = {
            "month": date.strftime("%Y-%m"),
            "factors": {},
        }
        for col in factor_cols:
            val = float(row[col]) if not pd.isna(row[col]) else 0.0
            month_data["factors"][col] = round(val, 2)
        heatmap.append(month_data)

    return heatmap


def compute_correlation_matrix(features_df: pd.DataFrame) -> dict:
    """Compute correlation matrix between factors. Handles constant/NaN columns."""
    factor_cols = get_factor_columns()
    valid = features_df[factor_cols].dropna().tail(252)

    if valid.empty:
        return {"factors": factor_cols, "matrix": []}

    # Drop constant columns (zero variance → NaN correlations)
    non_constant = [c for c in factor_cols if valid[c].std() > 1e-10]
    dropped = [c for c in factor_cols if c not in non_constant]
    if dropped:
        print(f"  Correlation: dropped constant factors: {dropped}")

    corr = valid[non_constant].corr(method="spearman")

    matrix = []
    for fi in factor_cols:
        for fj in factor_cols:
            if fi in non_constant and fj in non_constant:
                val = float(corr.loc[fi, fj])
                val = 0.0 if np.isnan(val) else round(val, 3)
            elif fi == fj:
                val = 1.0  # self-correlation
            else:
                val = 0.0  # constant factor has no correlation
            matrix.append({"x": fi, "y": fj, "value": val})

    return {
        "factors": factor_cols,
        "matrix": matrix,
        "dropped_constant": dropped,
    }


def run_inference(features_df: pd.DataFrame) -> dict:
    """
    Run daily inference: load model, predict, compute SHAP, detect regime.
    Returns all output data and saves to JSON files.
    """
    factor_cols = get_factor_columns()

    # Load model
    model = xgb.XGBRegressor()
    model.load_model(str(MODEL_PATH))
    print(f"Model loaded from {MODEL_PATH}")

    # Get latest row with gold price
    valid = features_df.dropna(subset=["gold_price"]).copy()
    if valid.empty:
        raise RuntimeError("No valid data for inference")

    # Fill NaN factors with 0
    valid[factor_cols] = valid[factor_cols].fillna(0)

    latest = valid.iloc[-1]
    latest_date = valid.index[-1].strftime("%Y-%m-%d")
    X_latest = np.nan_to_num(
        latest[factor_cols].values.reshape(1, -1).astype(np.float64),
        nan=0.0, posinf=5.0, neginf=-5.0
    )

    # ── Predict ───────────────────────────────────────────────────────────────
    pred_return = float(model.predict(X_latest)[0])
    signal = classify_signal(pred_return)
    confidence = signal_to_confidence(pred_return)

    print(f"\nDate: {latest_date}")
    print(f"Predicted 20d Return: {pred_return:.4f}%")
    print(f"Signal: {signal} (confidence: {confidence:.1f}%)")

    # ── SHAP Values ───────────────────────────────────────────────────────────
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_latest)
    base_value = float(explainer.expected_value)

    shap_output = {
        "base_value": round(base_value, 4),
        "prediction": round(pred_return, 4),
        "bars": [],
    }
    for i, fname in enumerate(factor_cols):
        shap_output["bars"].append({
            "factor": fname,
            "label": FACTOR_DISPLAY.get(fname, fname),
            "value": round(float(shap_values[0][i]), 4),
            "raw_feature": round(float(latest[fname]), 4),
        })

    # Sort by absolute SHAP value
    shap_output["bars"].sort(key=lambda x: abs(x["value"]), reverse=True)

    # ── ATR Position Sizing ───────────────────────────────────────────────────
    atr = float(latest.get("ATR", 50.0))
    gold_price = float(latest.get("gold_price", 3000.0))
    stop_distance = atr * ATR_STOP_MULT
    account_equity = 100000.0  # Default account size
    risk_amount = account_equity * RISK_BUDGET
    position_size = risk_amount / stop_distance if stop_distance > 0 else 0

    # Apply regime multiplier
    regime_info = detect_regime(dict(latest[factor_cols]))
    position_size *= regime_info["multiplier"]

    # ── Signal Output ─────────────────────────────────────────────────────────
    signal_data = {
        "date": latest_date,
        "timestamp": datetime.now().isoformat(),
        "signal": signal,
        "predicted_return": round(pred_return, 4),
        "confidence": round(confidence, 1),
        "gold_price": round(gold_price, 2),
        "gold_open": round(float(latest.get("gold_open", gold_price)), 2),
        "gold_high": round(float(latest.get("gold_high", gold_price)), 2),
        "gold_low": round(float(latest.get("gold_low", gold_price)), 2),
        "atr": round(atr, 2),
        "stop_loss": round(gold_price - stop_distance, 2),
        "take_profit": round(gold_price + stop_distance * 1.5, 2),
        "position_size": round(position_size, 4),
        "regime": regime_info["regime"],
        "regime_multiplier": regime_info["multiplier"],
        "factors": [],
    }

    # Add factor details
    for fname in factor_cols:
        raw_map = {
            "F1_DXY": "raw_DXY",
            "F2_FedFunds": "raw_FedFunds",
            "F2c_RateExpect": "raw_DGS2",
            "F3_TIPS10Y": "raw_TIPS10Y",
            "F4_BEI": "raw_BEI",
            "F5_GPR": "raw_GPR",
            "F6_GVZ": "raw_GVZ",
        }
        raw_col = raw_map.get(fname)
        raw_val = None
        if raw_col and raw_col in latest.index:
            v = float(latest[raw_col])
            if not np.isnan(v) and not np.isinf(v):
                raw_val = round(v, 4)

        zscore_val = float(latest[fname])
        if np.isnan(zscore_val) or np.isinf(zscore_val):
            zscore_val = 0.0

        signal_data["factors"].append({
            "name": fname,
            "label": FACTOR_DISPLAY.get(fname, fname),
            "zscore": round(zscore_val, 4),
            "raw_value": raw_val,
        })

    # ── Regime Heatmap ────────────────────────────────────────────────────────
    regime_heatmap = build_regime_heatmap(features_df)

    # ── Correlation Matrix ────────────────────────────────────────────────────
    correlation = compute_correlation_matrix(features_df)

    # ── Save all JSON outputs ─────────────────────────────────────────────────
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    outputs = {
        "signal.json": signal_data,
        "shap_values.json": shap_output,
        "regime.json": {
            "current": regime_info,
            "heatmap": regime_heatmap,
        },
        "correlation.json": correlation,
    }

    for filename, data in outputs.items():
        path = OUTPUT_DIR / filename
        with open(path, "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, cls=NaNSafeEncoder)
        print(f"Saved {path}")

    return signal_data


if __name__ == "__main__":
    from fetch_data import fetch_all_data
    from features import build_features

    raw = fetch_all_data()
    feat = build_features(raw)
    run_inference(feat)
