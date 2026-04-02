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
ATR_STOP_MULT = 3.5        # ATR stop-loss multiplier (widened from 2.5 to reduce noise stops)
RISK_BUDGET = 0.015        # 1.5% risk per trade (reduced to compensate wider stops)

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
    "max_depth": 4,
    "min_child_weight": 15,
    "learning_rate": 0.03,
    "n_estimators": 500,
    "subsample": 0.7,
    "colsample_bytree": 0.7,
    "reg_alpha": 0.3,           # L1 regularization (relaxed from 1.0 to release signal)
    "reg_lambda": 2.0,          # L2 regularization (relaxed from 5.0 to release signal)
    "objective": "reg:squarederror",
    "random_state": 42,
}

# ── Signal Thresholds (predicted 20d return %) ────────────────────────────────
SIGNAL_THRESHOLDS = {
    "strong_buy": 1.2,
    "buy": 0.5,
    "sell": -0.5,
    "strong_sell": -1.2,
}

# ── Factor Names (display order) ─────────────────────────────────────────────
# P1: Consolidated from 10 → 7 base factors. Removed F2/F2b/F2c (rate cluster)
# P1b: Added logical factors (spreads, momentum, cross, divergence)
# P2: Pruned 13 → 10 factors based on IC/Granger/correlation analysis:
#   Removed F3 (redundant with F10, r=0.84), F8 (IC≈0, Granger fail),
#   F15 (IC≈0). Replaced F9 ratio → momentum.
# P3: Removed F12 (IC=0.00, dead factor), F9 (ablation: model IC -0.21→+0.04
#     without it; r=-0.79 collinearity with F13 caused XGBoost overfitting).
# Total: 8 factors = 4 base + 4 logical
FACTOR_NAMES = [
    # Base factors (4)
    "F1_DXY",
    "F4_BEI",
    "F5_GPR",
    "F6_GVZ",              # All-target IC negative, but XGBoost handles reversal
    # Logical factors (4)
    "F10_TIPSBEISpread",   # Real yield - inflation spread (IC +0.73, top factor)
    "F11_DXYMomentum",     # USD trend acceleration
    "F13_GoldGDXDivergence", # Gold vs miners divergence (ablation: most valuable factor)
    "F14_GVZMomentum",     # Volatility regime change
]

FACTOR_DISPLAY = {
    "F1_DXY": "美元指数 DXY",
    "F4_BEI": "通胀预期 BEI",
    "F5_GPR": "地缘政治风险 GPR",
    "F6_GVZ": "黄金波动率 GVZ",
    "F10_TIPSBEISpread": "实际利率-通胀利差",
    "F11_DXYMomentum": "美元动量 20D",
    "F13_GoldGDXDivergence": "金价-矿业股背离",
    "F14_GVZMomentum": "波动率动量",
}

# ── Removed factors (kept in features.py for display/regime, not in model) ──
# F3_TIPS10Y: redundant with F10 (r=0.84), F10 has higher OOS IC (0.73 vs 0.58)
# F8_ETFFlow: OOS IC=-0.026, Granger fail — noise factor
# F9_GDXRatio: replaced by F9_GDXMomentum (momentum > level)
# F9_GDXMomentum: ablation showed removing it flips model IC from -0.21→+0.04;
#   r=-0.79 collinearity with F13 caused XGBoost overfitting despite solo IC=+0.285
# F12_DXYDownGPRUp: IC=0.00, dead factor — P3 roundtable consensus removal
# F15_ETFFlowAccel: OOS IC=0.046, near zero — removed with F8

# ── Trade Execution ─────────────────────────────────────────────────────────
MIN_HOLD_DAYS = 3              # Minimum days before Neutral can close position
TRAILING_ACTIVATE = 1.0        # Activate trailing stop after 1× ATR profit
TRAILING_DISTANCE = 2.0        # Trailing stop distance in ATR multiples
TRADE_COST_BPS = 3             # Single-leg cost in bps (slippage + commission)

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
HMM_BASE_FACTORS = [                 # Features used for HMM (4 base factors)
    "F1_DXY", "F4_BEI", "F5_GPR",
    "F6_GVZ",
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
