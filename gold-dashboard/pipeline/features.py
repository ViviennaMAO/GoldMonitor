"""
Feature engineering module — computes 9 gold factors with Z-Score normalization.
"""
import pandas as pd
import numpy as np
from config import ZSCORE_WINDOW, FORWARD_DAYS, FACTOR_NAMES


def rolling_zscore(series: pd.Series, window: int = ZSCORE_WINDOW) -> pd.Series:
    """Compute rolling Z-Score normalization. Handles inf/nan."""
    mean = series.rolling(window, min_periods=20).mean()
    std = series.rolling(window, min_periods=20).std()
    z = (series - mean) / std.replace(0, np.nan)
    z = z.replace([np.inf, -np.inf], np.nan).clip(-5, 5)
    return z


def compute_atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    """Compute Average True Range."""
    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low - prev_close).abs(),
    ], axis=1).max(axis=1)
    return tr.rolling(period).mean()


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build 9 factor features from raw data DataFrame.
    Returns DataFrame with factor columns + target variable.
    """
    features = pd.DataFrame(index=df.index)

    # F1: DXY — US Dollar Index (inverse relationship with gold)
    if "DXY" in df.columns:
        features["F1_DXY"] = rolling_zscore(df["DXY"])
    else:
        features["F1_DXY"] = 0.0

    # F2: Federal Funds Rate
    if "FED_FUNDS" in df.columns:
        features["F2_FedFunds"] = rolling_zscore(df["FED_FUNDS"])
    else:
        features["F2_FedFunds"] = 0.0

    # F3: TIPS 10Y Real Yield
    if "TIPS_10Y" in df.columns:
        features["F3_TIPS10Y"] = rolling_zscore(df["TIPS_10Y"])
    else:
        features["F3_TIPS10Y"] = 0.0

    # F4: Breakeven Inflation Expectations
    if "BEI" in df.columns:
        features["F4_BEI"] = rolling_zscore(df["BEI"])
    else:
        features["F4_BEI"] = 0.0

    # F5: OVX — Oil Volatility (proxy for geopolitical risk)
    if "OVX_close" in df.columns:
        features["F5_OVX"] = rolling_zscore(df["OVX_close"])
    else:
        features["F5_OVX"] = 0.0

    # F6: GVZ — Gold Volatility Index
    if "GVZ_close" in df.columns:
        features["F6_GVZ"] = rolling_zscore(df["GVZ_close"])
    else:
        features["F6_GVZ"] = 0.0

    # F7: WGC Central Bank Demand (no public API — use constant placeholder)
    features["F7_WGC"] = 0.0

    # F8: ETF Flow — GLD+IAU volume change rate
    if "GLD_volume" in df.columns and "IAU_volume" in df.columns:
        etf_vol = df["GLD_volume"].fillna(0) + df["IAU_volume"].fillna(0)
        etf_flow = etf_vol.pct_change(5)  # 5-day volume change rate
        features["F8_ETFFlow"] = rolling_zscore(etf_flow)
    elif "GLD_volume" in df.columns:
        etf_flow = df["GLD_volume"].pct_change(5)
        features["F8_ETFFlow"] = rolling_zscore(etf_flow)
    else:
        features["F8_ETFFlow"] = 0.0

    # F9: GDX/Gold Ratio — Miners vs Gold
    if "GDX_close" in df.columns and "XAUUSD_close" in df.columns:
        ratio = df["GDX_close"] / df["XAUUSD_close"]
        features["F9_GDXRatio"] = rolling_zscore(ratio)
    else:
        features["F9_GDXRatio"] = 0.0

    # ── Target Variable: 20-day forward return ────────────────────────────────
    if "XAUUSD_close" in df.columns:
        features["target"] = (
            df["XAUUSD_close"].shift(-FORWARD_DAYS) / df["XAUUSD_close"] - 1
        ) * 100  # percentage return

    # ── ATR for position sizing ───────────────────────────────────────────────
    if all(c in df.columns for c in ["XAUUSD_high", "XAUUSD_low", "XAUUSD_close"]):
        features["ATR"] = compute_atr(
            df["XAUUSD_high"], df["XAUUSD_low"], df["XAUUSD_close"]
        )

    # ── Keep gold price for reference ─────────────────────────────────────────
    if "XAUUSD_close" in df.columns:
        features["gold_price"] = df["XAUUSD_close"]
    if "XAUUSD_open" in df.columns:
        features["gold_open"] = df["XAUUSD_open"]
    if "XAUUSD_high" in df.columns:
        features["gold_high"] = df["XAUUSD_high"]
    if "XAUUSD_low" in df.columns:
        features["gold_low"] = df["XAUUSD_low"]

    # ── Keep raw factor values for display ────────────────────────────────────
    raw_cols = {
        "DXY": "raw_DXY",
        "FED_FUNDS": "raw_FedFunds",
        "TIPS_10Y": "raw_TIPS10Y",
        "BEI": "raw_BEI",
        "OVX_close": "raw_OVX",
        "GVZ_close": "raw_GVZ",
    }
    for src, dst in raw_cols.items():
        if src in df.columns:
            features[dst] = df[src]

    return features


def get_factor_columns() -> list[str]:
    """Return the list of factor column names used for model training."""
    return FACTOR_NAMES


if __name__ == "__main__":
    from fetch_data import fetch_all_data

    raw = fetch_all_data()
    feat = build_features(raw)
    print(f"\nFeatures shape: {feat.shape}")
    print("\nSample (last 3 rows):")
    print(feat[FACTOR_NAMES + ["target"]].tail(3))
    print("\nNull counts:")
    print(feat[FACTOR_NAMES].isnull().sum())
