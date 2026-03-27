"""
Three-Layer Regime Detection System v2.

Layer 1 (Macro — low frequency):
    Bridgewater growth×inflation quadrant + Fed cycle overlay.
    Growth proxy: yield curve slope (10Y nominal - 2Y).
    Inflation proxy: BEI 20-day momentum.
    Fed cycle: DGS2 (2Y yield) 20-day rate of change.

Layer 2 (Market — medium frequency):
    Hidden Markov Model (3-state) on 7 base factors → Bull / Neutral / Bear.
    States labeled post-hoc by mean 20D gold forward return per state.
    Liquidity-Volatility matrix (GVZ level × ETF flow) → 4 microstructure states.

Layer 3 (Event — high frequency):
    2Y Treasury shock: detect abnormal move, attribute to
        fragility (MOVE proxy high + DXY sideways),
        expectation (yield curve flattening + MOVE normal), or
        inflation (BEI moving same direction).
    Change-point detection on gold log-returns via PELT algorithm.
    Dollar smile: distinguish risk-off vs growth-driven USD strength.

Composite multiplier = clip(L1_mult × L2_factor + L3_delta, 0.1, 1.5)
"""

import warnings
import numpy as np
import pandas as pd

from config import (
    ZSCORE_WINDOW,
    HMM_N_STATES, HMM_LOOKBACK, HMM_BASE_FACTORS,
    RATE_SHOCK_THRESHOLD, CHANGEPOINT_PENALTY, CHANGEPOINT_LOOKBACK,
    QUADRANT_MULTIPLIERS, FED_CYCLE_ADJ,
    LAYER2_HMM_ADJ, LAYER2_LIQVOL_ADJ,
)

# ── Optional dependencies with graceful fallback ───────────────────────────────
try:
    from hmmlearn.hmm import GaussianHMM
    _HMM_OK = True
except ImportError:
    _HMM_OK = False
    warnings.warn("hmmlearn not installed — Layer 2 HMM disabled, using rule fallback")

try:
    import ruptures as rpt
    _RUPTURES_OK = True
except ImportError:
    _RUPTURES_OK = False
    warnings.warn("ruptures not installed — Layer 3 change-point detection disabled")


# ── Display labels ─────────────────────────────────────────────────────────────
_QUADRANT_ZH = {
    "Stagflation": "滞胀",
    "Overheating": "过热",
    "Deflation":   "通缩",
    "Reflation":   "复苏",
    "Neutral":     "中性",
}
_FED_ZH = {"Tightening": "紧缩", "Easing": "宽松", "Neutral": "中性"}
_HMM_ZH = {"Bull": "牛市", "Neutral": "震荡", "Bear": "熊市"}


# ══════════════════════════════════════════════════════════════════════════════
# Internal helpers
# ══════════════════════════════════════════════════════════════════════════════

def _rolling_zscore(series: pd.Series, window: int = ZSCORE_WINDOW) -> pd.Series:
    mean = series.rolling(window, min_periods=20).mean()
    std = series.rolling(window, min_periods=20).std()
    z = (series - mean) / std.replace(0, np.nan)
    return z.replace([np.inf, -np.inf], np.nan).clip(-5, 5)


def _safe_float(row, key: str, default: float = 0.0) -> float:
    v = row.get(key, default)
    if v is None:
        return default
    f = float(v)
    return default if (np.isnan(f) or np.isinf(f)) else f


# ══════════════════════════════════════════════════════════════════════════════
# Layer 1: Macro Regime — Bridgewater Quadrant × Fed Cycle
# ══════════════════════════════════════════════════════════════════════════════

def _detect_layer1(df: pd.DataFrame, latest) -> dict:
    """
    Classify macro regime using growth and inflation directions.

    Growth proxy:
        Yield curve (10Y nominal - 2Y) Z-score + 20D momentum Z-score.
        Steepening = growth expectations improving.
        Fallback: inverse GPR Z-score.

    Inflation proxy:
        BEI Z-score level + raw 20D change (percentage points).
        Fallback: BEI Z-score alone.

    Fed cycle:
        DGS2 (2Y yield) 20-day absolute change.
        +0.15pp → Tightening, −0.15pp → Easing.
        Fallback: TIPS Z-score direction.
    """
    # ── Growth direction ──────────────────────────────────────────────────────
    if "yield_curve_z" in df.columns:
        yc_z = _safe_float(latest, "yield_curve_z")
        yc_mom_z = _safe_float(latest, "yield_curve_mom_z")

        score = 0
        if yc_z > 0.3:     score += 1
        if yc_mom_z > 0.3: score += 1
        if yc_z < -0.3:    score -= 1
        if yc_mom_z < -0.3: score -= 1
        growth_direction = "up" if score > 0 else ("down" if score < 0 else "neutral")
    else:
        gpr_z = _safe_float(latest, "F5_GPR")
        growth_direction = "down" if gpr_z > 0.5 else ("up" if gpr_z < -0.3 else "neutral")

    # ── Inflation direction ───────────────────────────────────────────────────
    bei_z = _safe_float(latest, "F4_BEI")
    if "bei_momentum_20d" in df.columns:
        bei_mom = _safe_float(latest, "bei_momentum_20d")
        score = 0
        if bei_z > 0.3:     score += 1
        if bei_mom > 0.02:  score += 1   # BEI rising in absolute pp terms
        if bei_z < -0.3:    score -= 1
        if bei_mom < -0.02: score -= 1
        inflation_direction = "up" if score > 0 else ("down" if score < 0 else "neutral")
    else:
        inflation_direction = "up" if bei_z > 0.3 else ("down" if bei_z < -0.3 else "neutral")

    # ── Fed cycle ─────────────────────────────────────────────────────────────
    if "raw_DGS2" in df.columns:
        dgs2 = df["raw_DGS2"].dropna()
        if len(dgs2) >= 20:
            chg_20d = float(dgs2.iloc[-1] - dgs2.iloc[-20])
            level = float(dgs2.iloc[-1])
            if chg_20d > 0.15 and level > 2.0:
                fed_cycle = "Tightening"
            elif chg_20d < -0.15:
                fed_cycle = "Easing"
            else:
                fed_cycle = "Neutral"
        else:
            fed_cycle = "Neutral"
    else:
        tips_z = _safe_float(latest, "F3_TIPS10Y")
        fed_cycle = "Tightening" if tips_z > 0.8 else ("Easing" if tips_z < -0.8 else "Neutral")

    # ── Quadrant ──────────────────────────────────────────────────────────────
    if growth_direction == "down" and inflation_direction == "up":
        quadrant = "Stagflation"
    elif growth_direction == "up" and inflation_direction == "up":
        quadrant = "Overheating"
    elif growth_direction == "down" and inflation_direction == "down":
        quadrant = "Deflation"
    elif growth_direction == "up" and inflation_direction == "down":
        quadrant = "Reflation"
    else:
        quadrant = "Neutral"

    base_mult = QUADRANT_MULTIPLIERS.get(quadrant, 0.85)
    fed_adj = FED_CYCLE_ADJ.get(fed_cycle, 0.0)
    layer1_mult = float(np.clip(base_mult + fed_adj, 0.3, 1.4))

    return {
        "quadrant": quadrant,
        "quadrant_zh": _QUADRANT_ZH.get(quadrant, quadrant),
        "growth_direction": growth_direction,
        "inflation_direction": inflation_direction,
        "fed_cycle": fed_cycle,
        "fed_cycle_zh": _FED_ZH.get(fed_cycle, fed_cycle),
        "multiplier": round(layer1_mult, 3),
    }


# ══════════════════════════════════════════════════════════════════════════════
# Layer 2: Market Regime — HMM + Liquidity-Volatility Matrix
# ══════════════════════════════════════════════════════════════════════════════

def _detect_layer2(df: pd.DataFrame, latest) -> dict:
    hmm_result = _fit_hmm(df) if _HMM_OK else _hmm_rule_fallback(latest)
    liqvol_result = _liqvol_matrix(latest)

    hmm_adj = LAYER2_HMM_ADJ.get(hmm_result["hmm_label"], 1.0)
    liqvol_adj = LAYER2_LIQVOL_ADJ.get(liqvol_result["market_regime"], 1.0)
    adj_factor = float(np.clip(hmm_adj * liqvol_adj, 0.5, 1.15))

    return {**hmm_result, **liqvol_result, "adj_factor": round(adj_factor, 3)}


def _fit_hmm(df: pd.DataFrame) -> dict:
    """
    Fit GaussianHMM on 7 base factors over HMM_LOOKBACK days.
    Label states by mean 20D gold forward return (highest = Bull, lowest = Bear).
    """
    try:
        available = [f for f in HMM_BASE_FACTORS if f in df.columns]
        if len(available) < 3:
            return _hmm_unavailable("insufficient factor columns")

        lookback = min(HMM_LOOKBACK, len(df))
        data = df[available].tail(lookback).copy().fillna(0)

        if len(data) < 60:
            return _hmm_unavailable("insufficient history")

        X = data.values.astype(np.float64)

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model = GaussianHMM(
                n_components=HMM_N_STATES,
                covariance_type="diag",
                n_iter=150,
                tol=0.005,
                random_state=42,
            )
            model.fit(X)

        state_seq = model.predict(X)
        posteriors = model.predict_proba(X)
        current_state = int(state_seq[-1])
        current_conf = float(posteriors[-1, current_state])

        # Label states by correlation with gold 20D forward return
        if "target" in df.columns:
            targets = df["target"].tail(lookback).fillna(0).values
            state_mean = {
                s: float(np.nanmean(targets[state_seq == s])) if (state_seq == s).sum() >= 5 else 0.0
                for s in range(HMM_N_STATES)
            }
        else:
            # Fallback: high GVZ mean → bear state
            gvz_idx = available.index("F6_GVZ") if "F6_GVZ" in available else 0
            state_mean = {
                s: -float(np.nanmean(X[state_seq == s, gvz_idx])) if (state_seq == s).sum() >= 5 else 0.0
                for s in range(HMM_N_STATES)
            }

        sorted_states = sorted(state_mean.items(), key=lambda x: x[1])
        state_labels = {
            sorted_states[0][0]: "Bear",
            sorted_states[1][0]: "Neutral",
            sorted_states[2][0]: "Bull",
        }
        hmm_label = state_labels[current_state]

        return {
            "hmm_state": current_state,
            "hmm_label": hmm_label,
            "hmm_label_zh": _HMM_ZH.get(hmm_label, hmm_label),
            "hmm_confidence": round(current_conf, 3),
            "hmm_available": True,
        }
    except Exception as e:
        return _hmm_unavailable(str(e)[:100])


def _hmm_rule_fallback(latest) -> dict:
    """Rule-based fallback when hmmlearn is unavailable."""
    gvz_z = _safe_float(latest, "F6_GVZ")
    etf_z = _safe_float(latest, "F8_ETFFlow")

    if gvz_z > 1.0 and etf_z < 0:
        label = "Bear"
    elif gvz_z < -0.3 and etf_z > 0:
        label = "Bull"
    else:
        label = "Neutral"

    return {
        "hmm_state": -1,
        "hmm_label": label,
        "hmm_label_zh": _HMM_ZH.get(label, label),
        "hmm_confidence": 0.6,
        "hmm_available": False,
    }


def _hmm_unavailable(msg: str = "") -> dict:
    return {
        "hmm_state": -1,
        "hmm_label": "Neutral",
        "hmm_label_zh": "震荡",
        "hmm_confidence": 0.5,
        "hmm_available": False,
        "hmm_error": msg,
    }


def _liqvol_matrix(latest) -> dict:
    """
    Classify market microstructure using GVZ (volatility) and ETF flow (liquidity).

    Volatility high: GVZ Z > 1.0, or GVZ Z > 0.5 AND GVZ momentum Z > 0.5 (rising vol)
    Liquidity good:  ETF flow Z > 0, or ETF flow acceleration Z > 0.5

    Matrix:
        vol_high + liq_poor → Systemic Risk   (0.65×)
        vol_high + liq_good → Crisis Spike    (0.80×)
        vol_low  + liq_good → Trending        (1.05×)
        vol_low  + liq_poor → Grinding        (0.92×)
    """
    gvz_z = _safe_float(latest, "F6_GVZ")
    gvz_mom_z = _safe_float(latest, "F14_GVZMomentum")
    etf_z = _safe_float(latest, "F8_ETFFlow")
    etf_accel = _safe_float(latest, "F15_ETFFlowAccel")

    vol_high = gvz_z > 1.0 or (gvz_z > 0.5 and gvz_mom_z > 0.5)
    liq_good = etf_z > 0 or etf_accel > 0.5

    if vol_high and not liq_good:
        regime, regime_zh = "Systemic Risk", "系统性危机"
    elif vol_high and liq_good:
        regime, regime_zh = "Crisis Spike", "危机冲击"
    elif not vol_high and liq_good:
        regime, regime_zh = "Trending", "趋势行情"
    else:
        regime, regime_zh = "Grinding", "震荡磨损"

    return {
        "vol_level": "high" if vol_high else "low",
        "liq_level": "good" if liq_good else "poor",
        "market_regime": regime,
        "market_regime_zh": regime_zh,
    }


# ══════════════════════════════════════════════════════════════════════════════
# Layer 3: Event Overlay — 2Y Shock + Change-Point + Dollar Smile
# ══════════════════════════════════════════════════════════════════════════════

def _detect_layer3(df: pd.DataFrame, latest) -> dict:
    shock = _detect_rate_shock(df, latest)
    cp = _detect_changepoint(df) if _RUPTURES_OK else _cp_unavailable()
    smile = _detect_dollar_smile(latest)

    # Additive delta on final multiplier
    delta = 0.0
    if shock["rate_shock_detected"]:
        src = shock["shock_source"]
        if src == "fragility":
            delta += 0.10    # Bond fragility → gold safe-haven demand
        elif src == "expectation":
            delta -= 0.20    # Fed tightening repricing → real yield headwind
        elif src == "inflation":
            delta += 0.05    # Inflation repricing → mild gold tailwind

    if cp["changepoint_detected"]:
        delta -= 0.10        # Structural break → reduce under uncertainty

    if smile["dollar_type"] == "risk_off":
        delta += 0.10        # Risk-off USD → gold also benefits
    elif smile["dollar_type"] == "growth":
        delta -= 0.05        # Growth USD → gold less attractive

    return {
        **shock,
        **cp,
        **smile,
        "overlay_delta": round(float(np.clip(delta, -0.35, 0.25)), 3),
    }


def _detect_rate_shock(df: pd.DataFrame, latest) -> dict:
    """
    Detect abnormal 2Y yield move and attribute to one of three sources.

    Fragility:   MOVE proxy (GVZ momentum) high + DXY efficiency low (sideways)
    Expectation: Yield curve flattening + MOVE proxy moderate
    Inflation:   BEI moving same direction as 2Y + MOVE proxy moderate
    """
    base = {
        "rate_shock_detected": False,
        "shock_source": None,
        "shock_source_zh": None,
        "dgs2_zscore": None,
        "shock_direction": None,
    }

    if "raw_DGS2" not in df.columns:
        return base

    dgs2 = df["raw_DGS2"].dropna()
    if len(dgs2) < 40:
        return base

    dgs2_z_series = _rolling_zscore(dgs2)
    dgs2_z = float(dgs2_z_series.iloc[-1]) if not pd.isna(dgs2_z_series.iloc[-1]) else 0.0
    base["dgs2_zscore"] = round(dgs2_z, 3)

    if abs(dgs2_z) < RATE_SHOCK_THRESHOLD:
        return base

    # Shock detected — attribute to fragility / expectation / inflation
    shock_up = dgs2_z > 0

    # P2: dedicated MOVE proxy (GVZ-based synthetic)
    move_proxy_z = _safe_float(latest, "move_proxy_z")          # P2 feature
    if move_proxy_z == 0.0:                                      # fallback if not computed
        move_proxy_z = _safe_float(latest, "F14_GVZMomentum")
    gvz_z = _safe_float(latest, "F6_GVZ")

    # P1: DXY sideways = no directional trend OR consolidating (smaller-than-usual moves)
    # Two complementary metrics capture different aspects of "横盘":
    #   efficiency < 0.35 → no net direction (whipsaw or range-bound)
    #   atr_ratio  < 0.75 → recent moves smaller than 20-day norm (consolidating)
    # OR logic: either signal is sufficient — USD is not making a clean directional move
    dxy_eff   = _safe_float(latest, "dxy_efficiency", 0.5)
    dxy_atr_r = _safe_float(latest, "dxy_atr_ratio",  1.0)
    dxy_sideways = dxy_eff < 0.35 or dxy_atr_r < 0.75

    bei_z = _safe_float(latest, "F4_BEI")

    # P0: 2Y-TIPS spread momentum — widening = inflation/Fed repricing, not fragility
    spread_mom = _safe_float(latest, "spread_2y_tips_mom")
    spread_z   = _safe_float(latest, "spread_2y_tips_z")

    # Yield curve direction (last 20 days): negative = flattening = Fed tightening
    if "yield_curve" in df.columns:
        yc = df["yield_curve"].dropna()
        yc_20d_chg = float(yc.iloc[-1] - yc.iloc[-20]) if len(yc) >= 20 else 0.0
    else:
        yc_20d_chg = 0.0

    bei_same_dir = (shock_up and bei_z > 0.3) or (not shock_up and bei_z < -0.3)

    # Attribution rules (priority order):
    # Fragility:   MOVE proxy elevated + DXY sideways (no safe-haven flow direction)
    # Inflation:   BEI moving same way + 2Y-TIPS spread widening + MOVE moderate
    # Expectation: yield curve flattening (2Y up, 10Y-2Y compressing) = Fed pricing
    if (move_proxy_z > 0.8 or gvz_z > 1.0) and dxy_sideways:
        source, source_zh = "fragility", "债市脆弱"
    elif bei_same_dir and spread_mom > 0.05 and move_proxy_z < 0.5:
        source, source_zh = "inflation", "通胀重定价"
    elif shock_up and yc_20d_chg < 0:
        source, source_zh = "expectation", "利率预期重定价"
    else:
        source, source_zh = "expectation", "利率预期重定价"

    return {
        "rate_shock_detected": True,
        "shock_source": source,
        "shock_source_zh": source_zh,
        "dgs2_zscore": round(dgs2_z, 3),
        "shock_direction": "up" if shock_up else "down",
    }


def _detect_changepoint(df: pd.DataFrame) -> dict:
    """
    Detect structural breaks in gold log-returns using PELT.
    Flags if the most recent breakpoint was within the last 5 trading days.
    """
    try:
        if "gold_price" not in df.columns:
            return _cp_unavailable()

        prices = df["gold_price"].dropna()
        if len(prices) < 30:
            return _cp_unavailable()

        rets = np.log(prices / prices.shift(1)).dropna()
        lookback = min(CHANGEPOINT_LOOKBACK, len(rets))
        signal = rets.tail(lookback).values.reshape(-1, 1)

        algo = rpt.Pelt(model="rbf", min_size=5, jump=1)
        algo.fit(signal)
        bkps = algo.predict(pen=CHANGEPOINT_PENALTY)

        real_bkps = [b for b in bkps if b < len(signal)]
        if real_bkps:
            days_ago = int(lookback - real_bkps[-1])
            detected = days_ago <= 5
        else:
            days_ago = None
            detected = False

        return {
            "changepoint_detected": detected,
            "days_since_changepoint": days_ago,
            "n_breakpoints": len(real_bkps),
            "cp_available": True,
        }
    except Exception as e:
        return _cp_unavailable(str(e)[:100])


def _cp_unavailable(msg: str = "") -> dict:
    return {
        "changepoint_detected": False,
        "days_since_changepoint": None,
        "n_breakpoints": 0,
        "cp_available": False,
        "cp_error": msg,
    }


def _detect_dollar_smile(latest) -> dict:
    """
    Dollar smile theory: USD can strengthen for risk-off OR growth reasons.

    Risk-Off USD: DXY strong + GVZ high → gold also benefits (both safe havens)
    Growth USD:   DXY strong + GVZ low  → risk-on, gold less attractive
    Weak USD:     DXY falling            → gold tailwind regardless
    Neutral:      No directional DXY signal
    """
    dxy_z = _safe_float(latest, "F1_DXY")
    dxy_mom = _safe_float(latest, "F11_DXYMomentum")
    gvz_z = _safe_float(latest, "F6_GVZ")

    dxy_strong = dxy_z > 0.5 or dxy_mom > 0.5
    dxy_weak = dxy_z < -0.3 or dxy_mom < -0.3

    if dxy_strong:
        if gvz_z > 0.5:
            dollar_type, dollar_zh = "risk_off", "避险美元"
        else:
            dollar_type, dollar_zh = "growth", "增长美元"
    elif dxy_weak:
        dollar_type, dollar_zh = "weak", "弱势美元"
    else:
        dollar_type, dollar_zh = "neutral", "中性美元"

    return {"dollar_type": dollar_type, "dollar_type_zh": dollar_zh}


# ══════════════════════════════════════════════════════════════════════════════
# Composite: Assemble Final Regime
# ══════════════════════════════════════════════════════════════════════════════

def _compose_name(layer1: dict, layer2: dict, layer3: dict):
    """Derive composite regime label. Layer 3 events take priority if severe."""
    if layer3.get("rate_shock_detected"):
        zh = layer3.get("shock_source_zh", "利率冲击")
        en = layer3.get("shock_source", "rate_shock").replace("_", " ").title()
        return zh, en

    if layer3.get("changepoint_detected"):
        return "趋势切换", "Regime Transition"

    # Primary: Layer 1 quadrant
    zh = layer1.get("quadrant_zh", "中性")
    en = layer1.get("quadrant", "Neutral")

    # HMM modifier if confident and extreme
    if layer2.get("hmm_confidence", 0) > 0.7:
        if layer2.get("hmm_label") == "Bear":
            zh += "·防御"
            en += " Defensive"
        elif layer2.get("hmm_label") == "Bull":
            zh += "·顺势"
            en += " Trending"

    # Dollar smile modifier
    if layer3.get("dollar_type") == "risk_off":
        zh += "·避险"
        en += " SafeHaven"

    return zh, en


def _compute_confidence(layer1: dict, layer2: dict, layer3: dict) -> float:
    scores = []

    # Layer 1: non-neutral quadrant = higher confidence
    scores.append(0.7 if layer1.get("quadrant") != "Neutral" else 0.4)

    # Layer 2: HMM posterior (or 0.5 if unavailable)
    scores.append(layer2.get("hmm_confidence", 0.5) if layer2.get("hmm_available") else 0.5)

    # Layer 3: definitive when event detected
    scores.append(0.8 if (layer3.get("rate_shock_detected") or layer3.get("changepoint_detected")) else 0.6)

    return float(np.mean(scores))


def detect_regime_v2(features_df: pd.DataFrame) -> dict:
    """
    Main entry point. Runs three-layer regime detection and returns composite output.

    Args:
        features_df: Full historical features DataFrame from build_features().

    Returns:
        dict — backward-compatible with v1 keys (regime, multiplier,
        risk_off_score, risk_on_score) plus new layer1/layer2/layer3 detail.
    """
    valid = features_df.dropna(subset=["gold_price"])
    if valid.empty:
        return _fallback_regime()

    latest = valid.iloc[-1]

    layer1 = _detect_layer1(valid, latest)
    layer2 = _detect_layer2(valid, latest)
    layer3 = _detect_layer3(valid, latest)

    # Composite multiplier: L1 × L2 (multiplicative) + L3 (additive event delta)
    mult_12 = layer1["multiplier"] * layer2["adj_factor"]
    final_mult = float(np.clip(mult_12 + layer3["overlay_delta"], 0.1, 1.5))

    regime_zh, regime_en = _compose_name(layer1, layer2, layer3)
    confidence = _compute_confidence(layer1, layer2, layer3)

    return {
        # Backward-compatible v1 keys
        "regime": regime_zh,
        "regime_en": regime_en,
        "multiplier": round(final_mult, 3),
        "risk_off_score": 0,   # legacy field — kept for frontend compat
        "risk_on_score":  0,   # legacy field — kept for frontend compat
        # v2 fields
        "confidence": round(confidence, 2),
        "layer1": layer1,
        "layer2": layer2,
        "layer3": layer3,
        "version": "v2",
    }


def _fallback_regime() -> dict:
    return {
        "regime": "中性",
        "regime_en": "Neutral",
        "multiplier": 0.8,
        "risk_off_score": 0,
        "risk_on_score":  0,
        "confidence": 0.4,
        "layer1": {"quadrant": "Neutral", "quadrant_zh": "中性", "multiplier": 0.85,
                   "growth_direction": "neutral", "inflation_direction": "neutral",
                   "fed_cycle": "Neutral", "fed_cycle_zh": "中性"},
        "layer2": {"hmm_label": "Neutral", "hmm_label_zh": "震荡",
                   "hmm_confidence": 0.5, "hmm_available": False,
                   "market_regime": "Grinding", "market_regime_zh": "震荡磨损",
                   "vol_level": "low", "liq_level": "poor", "adj_factor": 0.92},
        "layer3": {"rate_shock_detected": False, "shock_source": None,
                   "shock_source_zh": None, "dgs2_zscore": None,
                   "changepoint_detected": False, "days_since_changepoint": None,
                   "dollar_type": "neutral", "dollar_type_zh": "中性美元",
                   "overlay_delta": 0.0, "cp_available": False},
        "version": "v2",
    }
