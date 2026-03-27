"""
Feature engineering module — computes gold factors with Z-Score normalization.
P1: Consolidated rate cluster (F2/F2b/F2c) → F3_TIPS10Y only.
P1b: Added logical factors — spreads, momentum, cross-factors, divergence.
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
    Build 7 factor features from raw data DataFrame.
    P1: Removed F2_FedFunds, F2b_RateMomentum, F2c_RateExpect (rate cluster).
    F3_TIPS10Y kept as sole rate representative (best OOS IC=+0.32).
    Returns DataFrame with factor columns + target variable.
    """
    features = pd.DataFrame(index=df.index)

    # F1: DXY — US Dollar Index (inverse relationship with gold)
    if "DXY" in df.columns:
        features["F1_DXY"] = rolling_zscore(df["DXY"])
    else:
        features["F1_DXY"] = 0.0

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

    # F5: GPR — Geopolitical Risk (Economic Policy Uncertainty Index)
    if "GPR" in df.columns:
        features["F5_GPR"] = rolling_zscore(df["GPR"])
    elif "OVX_close" in df.columns:
        # Fallback: use OVX as proxy if GPR unavailable
        features["F5_GPR"] = rolling_zscore(df["OVX_close"])
    else:
        features["F5_GPR"] = 0.0

    # F6: GVZ — Gold Volatility Index
    if "GVZ_close" in df.columns:
        features["F6_GVZ"] = rolling_zscore(df["GVZ_close"])
    else:
        features["F6_GVZ"] = 0.0

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

    # ══════════════════════════════════════════════════════════════════════════
    # P1b: Logical Factors — spread, momentum, cross, divergence
    # ══════════════════════════════════════════════════════════════════════════

    # F10: TIPS-BEI Spread — real yield minus inflation expectations
    # When spread widens (real rates rise faster than inflation), bearish for gold
    if "TIPS_10Y" in df.columns and "BEI" in df.columns:
        tips_bei_spread = df["TIPS_10Y"] - df["BEI"]
        features["F10_TIPSBEISpread"] = rolling_zscore(tips_bei_spread)
    else:
        features["F10_TIPSBEISpread"] = 0.0

    # F11: DXY 20-day Momentum — rate of change, not just level
    # Captures USD trend acceleration which leads gold moves
    if "DXY" in df.columns:
        dxy_mom = df["DXY"].pct_change(20) * 100  # 20-day % change
        features["F11_DXYMomentum"] = rolling_zscore(dxy_mom)
    else:
        features["F11_DXYMomentum"] = 0.0

    # F12: DXY-Down × GPR-Up Cross Factor
    # When USD weakens AND geopolitical risk rises → strongest gold tailwind
    if "DXY" in df.columns and ("GPR" in df.columns or "OVX_close" in df.columns):
        dxy_z = features["F1_DXY"]
        gpr_z = features["F5_GPR"]
        # Interaction: negative DXY (weak USD) × positive GPR (high risk)
        features["F12_DXYDownGPRUp"] = rolling_zscore((-dxy_z) * gpr_z.clip(lower=0))
    else:
        features["F12_DXYDownGPRUp"] = 0.0

    # F13: Gold-GDX Divergence — Z-score gap between gold and miners
    # When gold leads miners, often signals unsustainable move (mean reversion)
    if "GDX_close" in df.columns and "XAUUSD_close" in df.columns:
        gold_z = rolling_zscore(df["XAUUSD_close"])
        gdx_z = rolling_zscore(df["GDX_close"])
        features["F13_GoldGDXDivergence"] = (gold_z - gdx_z).clip(-5, 5)
    else:
        features["F13_GoldGDXDivergence"] = 0.0

    # F14: Volatility Regime — GVZ momentum (rising vol = uncertainty)
    if "GVZ_close" in df.columns:
        gvz_mom = df["GVZ_close"].pct_change(10) * 100  # 10-day GVZ change
        features["F14_GVZMomentum"] = rolling_zscore(gvz_mom)
    else:
        features["F14_GVZMomentum"] = 0.0

    # F15: ETF Flow Momentum — acceleration of ETF flows, not just level
    if "GLD_volume" in df.columns:
        etf_vol = df["GLD_volume"].fillna(0)
        if "IAU_volume" in df.columns:
            etf_vol = etf_vol + df["IAU_volume"].fillna(0)
        flow_5d = etf_vol.pct_change(5)
        flow_20d = etf_vol.pct_change(20)
        # Acceleration: short-term flow exceeding long-term trend
        flow_accel = flow_5d - flow_20d
        features["F15_ETFFlowAccel"] = rolling_zscore(flow_accel)
    else:
        features["F15_ETFFlowAccel"] = 0.0

    # ══════════════════════════════════════════════════════════════════════════
    # Regime v2 Auxiliary Features (not in FACTOR_NAMES, not used in model)
    # Used exclusively by regime_v2.py for three-layer regime detection.
    # ══════════════════════════════════════════════════════════════════════════

    # Yield Curve: 10Y nominal (TIPS + BEI) minus 2Y Treasury
    # Positive / steepening → growth expectations up
    # Negative / inverted → recession risk
    if "TIPS_10Y" in df.columns and "BEI" in df.columns and "DGS2" in df.columns:
        nom_10y = df["TIPS_10Y"] + df["BEI"]
        features["yield_curve"] = nom_10y - df["DGS2"]
        features["yield_curve_z"] = rolling_zscore(features["yield_curve"])
        features["yield_curve_mom_z"] = rolling_zscore(features["yield_curve"].diff(20))
    elif "TIPS_10Y" in df.columns and "BEI" in df.columns:
        # No DGS2 — use 10Y nominal level as proxy
        features["yield_curve"] = df["TIPS_10Y"] + df["BEI"]
        features["yield_curve_z"] = rolling_zscore(features["yield_curve"])
        features["yield_curve_mom_z"] = rolling_zscore(features["yield_curve"].diff(20))

    # BEI momentum: raw 20-day change in breakeven inflation (percentage points)
    # Used by Layer 1 (inflation direction) and Layer 3 (shock attribution)
    if "BEI" in df.columns:
        features["bei_momentum_20d"] = df["BEI"].diff(20)

    # P0: 2Y-TIPS spread = DGS2 (2Y nominal) - TIPS_10Y (10Y real)
    # Measures market-implied short-term inflation expectations vs long-term real rates.
    # Widening (2Y up faster than TIPS) → Fed tightening cycle or inflation scare.
    # Used by Layer 3 for rate shock attribution (expectation vs inflation source).
    if "DGS2" in df.columns and "TIPS_10Y" in df.columns:
        features["spread_2y_tips"] = df["DGS2"] - df["TIPS_10Y"]
        features["spread_2y_tips_z"] = rolling_zscore(features["spread_2y_tips"])
        features["spread_2y_tips_mom"] = features["spread_2y_tips"].diff(20)  # 20D change

    # P1: DXY ATR ratio: 5-day ATR / 20-day ATR
    # DXY has no OHLC so ATR ≈ rolling average of |daily change|.
    # Ratio < 0.7 → recent moves smaller than historical norm = sideways / consolidating.
    # Ratio > 1.3 → recent moves bigger than norm = breakout / trending.
    # Complements dxy_efficiency (direction) with dxy_atr_ratio (magnitude).
    if "DXY" in df.columns:
        dxy_daily_move = df["DXY"].diff().abs()
        dxy_atr_5  = dxy_daily_move.rolling(5,  min_periods=3).mean()
        dxy_atr_20 = dxy_daily_move.rolling(20, min_periods=10).mean()
        features["dxy_atr_ratio"] = (dxy_atr_5 / dxy_atr_20.replace(0, np.nan)).clip(0, 5)

        # DXY Efficiency Ratio: Kaufman efficiency ratio (directionality)
        # 1.0 = perfect directional trend, 0.0 = random walk / sideways
        er_period = 14
        net = df["DXY"].diff(er_period).abs()
        path = dxy_daily_move.rolling(er_period).sum()
        features["dxy_efficiency"] = (net / path.replace(0, np.nan)).clip(0, 1)

    # P2: MOVE proxy (synthetic, no paid data required)
    # ICE BofA MOVE index is not freely available. Proxy = weighted combo of:
    #   - GVZ level Z-score (gold vol ↔ rate vol via flight-to-safety correlation)
    #   - GVZ 10-day momentum Z-score (rising vol signal)
    # Calibrated so move_proxy_z ≈ standardized bond market stress level.
    # When move_proxy_z > 1.0 → bond market stress elevated (MOVE historically > 130).
    if "GVZ_close" in df.columns:
        gvz_level_z  = rolling_zscore(df["GVZ_close"])
        gvz_mom      = df["GVZ_close"].pct_change(10) * 100
        gvz_mom_z    = rolling_zscore(gvz_mom)
        features["move_proxy_z"] = (0.6 * gvz_level_z + 0.4 * gvz_mom_z).clip(-5, 5)

    # Raw 2Y Treasury yield (forward-filled from FRED DGS2)
    if "DGS2" in df.columns:
        features["raw_DGS2"] = df["DGS2"]

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
        "TIPS_10Y": "raw_TIPS10Y",
        "BEI": "raw_BEI",
        "GPR": "raw_GPR",
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
