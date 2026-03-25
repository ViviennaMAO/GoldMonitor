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
    "FED_FUNDS": "FEDFUNDS",
    "TIPS_10Y": "DFII10",
    "BEI": "T10YIE",
    "GPR": "GEPUCURRENT",       # Global Economic Policy Uncertainty (geopolitical risk proxy)
    "DGS2": "DGS2",             # 2-Year Treasury Yield (rate expectation proxy)
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
FACTOR_NAMES = [
    "F1_DXY",
    "F2_FedFunds",
    "F2b_RateMomentum",
    "F2c_RateExpect",
    "F3_TIPS10Y",
    "F4_BEI",
    "F5_GPR",
    "F6_GVZ",
    "F7_WGC",
    "F8_ETFFlow",
    "F9_GDXRatio",
]

FACTOR_DISPLAY = {
    "F1_DXY": "美元指数 DXY",
    "F2_FedFunds": "联邦基金利率",
    "F2b_RateMomentum": "利率动量 60d",
    "F2c_RateExpect": "利率预期 DGS2",
    "F3_TIPS10Y": "TIPS 10Y 实际利率",
    "F4_BEI": "通胀预期 BEI",
    "F5_GPR": "地缘政治风险 GPR",
    "F6_GVZ": "黄金波动率 GVZ",
    "F7_WGC": "央行购金需求",
    "F8_ETFFlow": "ETF 资金流",
    "F9_GDXRatio": "矿业股/金价比",
}

# ── Risk Regime Thresholds ────────────────────────────────────────────────────
REGIME_HEALTHY = 1.0
REGIME_CAUTION = 0.5
REGIME_CIRCUIT_BREAK = 0.0
