"""
Configuration constants for the Gold Factor Trading Pipeline.
"""
import os
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "output"
MODEL_PATH = BASE_DIR / "model.json"

# ── API Keys ─────────────────────────────────────────────────────────────────
FRED_API_KEY = os.environ.get("FRED_API_KEY", "6060765156e13c928200d3eeab885e01")

# ── Data Parameters ──────────────────────────────────────────────────────────
DATA_START = "2015-01-01"
TRAIN_END = "2025-09-30"
FORWARD_DAYS = 20          # 20-day forward return target
ZSCORE_WINDOW = 252        # Rolling Z-Score window
ATR_PERIOD = 14            # ATR calculation period
ATR_STOP_MULT = 2.5        # ATR stop-loss multiplier
RISK_BUDGET = 0.02         # 2% risk per trade

# ── FRED Series IDs ──────────────────────────────────────────────────────────
FRED_SERIES = {
    "DXY": "DTWEXBGS",
    "TIPS_10Y": "DFII10",
    "BEI": "T10YIE",
    "GPR": "GEPUCURRENT",       # Global Economic Policy Uncertainty (geopolitical risk proxy)
    "DGS2": "DGS2",             # 2-Year Treasury yield (regime v2: rate shock detection)
}

# ── Stooq Symbols ────────────────────────────────────────────────────────────
STOOQ_SYMBOLS = {
    "XAUUSD": "xauusd",
    "GLD": "gld.us",
    "IAU": "iau.us",
    "GDX": "gdx.us",
    "GDXJ": "gdxj.us",
}

# ── XGBoost Parameters ───────────────────────────────────────────────────────
XGB_PARAMS = {
    "max_depth": 3,
    "min_child_weight": 30,
    "learning_rate": 0.03,
    "n_estimators": 300,
    "subsample": 0.7,
    "colsample_bytree": 0.7,
    "reg_alpha": 1.0,           # L1 regularization to suppress single-factor dominance
    "reg_lambda": 5.0,          # L2 regularization for smoother predictions
    "objective": "reg:squarederror",
    "random_state": 42,
}

# ── Signal Thresholds (predicted 20d return %) ────────────────────────────────
SIGNAL_THRESHOLDS = {
    "strong_buy": 0.8,
    "buy": 0.3,
    "sell": -0.3,
    "strong_sell": -0.8,
}

# ── Factor Names (display order) ─────────────────────────────────────────────
# P1: Consolidated from 10 → 7 base factors. Removed F2/F2b/F2c (rate cluster)
# P1b: Added 6 logical factors (spreads, momentum, cross, divergence)
# Total: 13 factors = 7 base + 6 logical
FACTOR_NAMES = [
    # Base factors (7)
    "F1_DXY",
    "F3_TIPS10Y",
    "F4_BEI",
    "F5_GPR",
    "F6_GVZ",
    "F8_ETFFlow",
    "F9_GDXRatio",
    # Logical factors (6) — P1b
    "F10_TIPSBEISpread",   # Real yield - inflation spread
    "F11_DXYMomentum",     # USD trend acceleration
    "F12_DXYDownGPRUp",    # Weak USD × high risk cross-factor
    "F13_GoldGDXDivergence", # Gold vs miners divergence
    "F14_GVZMomentum",     # Volatility regime change
    "F15_ETFFlowAccel",    # ETF flow acceleration
]

FACTOR_DISPLAY = {
    "F1_DXY": "美元指数 DXY",
    "F3_TIPS10Y": "TIPS 10Y 实际利率",
    "F4_BEI": "通胀预期 BEI",
    "F5_GPR": "地缘政治风险 GPR",
    "F6_GVZ": "黄金波动率 GVZ",
    "F8_ETFFlow": "ETF 资金流",
    "F9_GDXRatio": "矿业股/金价比",
    "F10_TIPSBEISpread": "实际利率-通胀利差",
    "F11_DXYMomentum": "美元动量 20D",
    "F12_DXYDownGPRUp": "弱美元×高风险",
    "F13_GoldGDXDivergence": "金价-矿业股背离",
    "F14_GVZMomentum": "波动率动量",
    "F15_ETFFlowAccel": "ETF资金加速度",
}

# ── Risk Regime Thresholds (v1 — kept for backward compat) ───────────────────
REGIME_HEALTHY = 1.0
REGIME_CAUTION = 0.6
REGIME_CIRCUIT_BREAK = 0.0

# ── Regime Detection Thresholds (Z-Score) ────────────────────────────────────
# P1: Lowered from ±1.0/±0.5 → ±0.5/±0.3 to reduce "Transition" over-triggering
REGIME_Z_HIGH = 0.5       # Factor Z > this → risk-off signal
REGIME_Z_LOW = -0.3       # Factor Z < this → risk-on signal

# ══════════════════════════════════════════════════════════════════════════════
# Regime v2 — Three-Layer Architecture
# ══════════════════════════════════════════════════════════════════════════════

# ── Layer 2: HMM parameters ───────────────────────────────────────────────────
HMM_N_STATES = 3                     # Bull / Neutral / Bear
HMM_LOOKBACK = 504                   # ~2 trading years for fitting window
HMM_BASE_FACTORS = [                 # Features used for HMM (7 base factors only)
    "F1_DXY", "F3_TIPS10Y", "F4_BEI", "F5_GPR",
    "F6_GVZ", "F8_ETFFlow", "F9_GDXRatio",
]

# ── Layer 3: Event detection parameters ──────────────────────────────────────
RATE_SHOCK_THRESHOLD = 1.0           # |2Y Z-score| threshold for shock detection
CHANGEPOINT_PENALTY = 3.0            # PELT penalty (lower = more sensitive)
CHANGEPOINT_LOOKBACK = 60            # Days to scan for structural breaks

# ── Layer 1: Quadrant → base multiplier ──────────────────────────────────────
QUADRANT_MULTIPLIERS = {
    "Stagflation": 1.10,   # Growth↓ × Inflation↑ → strongest gold bull
    "Overheating": 1.00,   # Growth↑ × Inflation↑ → inflation helps gold
    "Deflation":   0.75,   # Growth↓ × Inflation↓ → safe haven offset by real yield risk
    "Reflation":   0.65,   # Growth↑ × Inflation↓ → risk-on, gold less attractive
    "Neutral":     0.85,
}

# ── Layer 1: Fed cycle adjustment (added to quadrant multiplier) ──────────────
FED_CYCLE_ADJ = {
    "Easing":     +0.15,
    "Tightening": -0.15,
    "Neutral":    0.0,
}

# ── Layer 2: HMM state adjustment factors ─────────────────────────────────────
LAYER2_HMM_ADJ = {
    "Bull":    1.05,
    "Neutral": 1.00,
    "Bear":    0.88,
}

# ── Layer 2: Liquidity-Volatility matrix adjustment ───────────────────────────
LAYER2_LIQVOL_ADJ = {
    "Trending":      1.05,  # Low vol + good liq → follow signal
    "Crisis Spike":  0.80,  # High vol + good liq → reduce size
    "Grinding":      0.92,  # Low vol + poor liq → choppy, cautious
    "Systemic Risk": 0.65,  # High vol + poor liq → defensive
}
