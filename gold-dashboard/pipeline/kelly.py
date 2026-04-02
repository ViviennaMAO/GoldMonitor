"""
Step 2: Signal-Graded Kelly Position Sizing
Replaces fixed 1.5% risk budget with adaptive fractional Kelly.

Phase 1 (n < 50 trades): Fixed 1.0% risk — accumulate sample
Phase 2 (n >= 50 trades): 1/4 Kelly with signal grading

Based on Edward Thorp's fractional Kelly methodology,
with Taleb's conservative lower-bound correction.
"""
import json
import numpy as np
from pathlib import Path
from scipy.stats import binom
from config import OUTPUT_DIR


# ── Phase transition threshold ──────────────────────────────────────────────
KELLY_MIN_TRADES = 50          # Minimum trades before switching to Kelly
KELLY_FRACTION = 0.25          # Use 1/4 Kelly (conservative)
FIXED_RISK_BUDGET = 0.010      # Phase 1: fixed 1.0% risk per trade
MAX_RISK_BUDGET = 0.05         # Hard cap: never exceed 5% risk per trade
MIN_RISK_BUDGET = 0.003        # Floor: never go below 0.3%

# ── Signal grade multipliers ────────────────────────────────────────────────
SIGNAL_GRADES = {
    "Strong Buy":  1.00,
    "Buy":         0.60,
    "Sell":        0.60,
    "Strong Sell": 1.00,
    "Neutral":     0.00,       # No position
}


def wilson_lower_bound(n_wins: int, n_total: int, confidence: float = 0.90) -> float:
    """
    Wilson score interval lower bound for win rate.
    More robust than normal approximation for small samples.
    """
    from scipy.stats import norm
    if n_total == 0:
        return 0.0

    p_hat = n_wins / n_total
    z = norm.ppf((1 + confidence) / 2)
    denominator = 1 + z**2 / n_total
    centre = p_hat + z**2 / (2 * n_total)
    margin = z * np.sqrt(p_hat * (1 - p_hat) / n_total + z**2 / (4 * n_total**2))

    lower = (centre - margin) / denominator
    return max(0.0, lower)


def compute_kelly_fraction(trades: list, confidence: float = 0.90) -> dict:
    """
    Compute Kelly optimal fraction from trade history.

    Uses Wilson lower bound for win rate (Taleb correction)
    to avoid over-betting on insufficient evidence.

    Returns:
        kelly_full: Full Kelly fraction (theoretical max)
        kelly_lower: Kelly from lower-bound win rate
        kelly_safe: KELLY_FRACTION × kelly_lower (actual fraction to use)
        phase: "accumulate" or "kelly"
    """
    n_total = len(trades)

    if n_total < KELLY_MIN_TRADES:
        return {
            "phase": "accumulate",
            "n_trades": n_total,
            "remaining": KELLY_MIN_TRADES - n_total,
            "risk_budget": FIXED_RISK_BUDGET,
            "kelly_full": None,
            "kelly_lower": None,
            "kelly_safe": None,
            "win_rate": None,
            "win_rate_lower": None,
            "payoff_ratio": None,
        }

    # Compute statistics
    winners = [t for t in trades if t.get("pnl", 0) > 0]
    losers = [t for t in trades if t.get("pnl", 0) < 0]
    n_wins = len(winners)
    n_losses = len(losers)

    p_hat = n_wins / n_total if n_total > 0 else 0.5
    p_lower = wilson_lower_bound(n_wins, n_total, confidence)

    avg_win = np.mean([t["pnl"] for t in winners]) if winners else 0
    avg_loss = abs(np.mean([t["pnl"] for t in losers])) if losers else 1

    # Payoff ratio (b = avg_win / avg_loss)
    b = avg_win / avg_loss if avg_loss > 0 else 1.0

    # Kelly: f* = (bp - q) / b
    q_hat = 1 - p_hat
    q_lower = 1 - p_lower

    kelly_full = max(0, (b * p_hat - q_hat) / b)
    kelly_lower = max(0, (b * p_lower - q_lower) / b)
    kelly_safe = kelly_lower * KELLY_FRACTION

    # Compute risk budget from Kelly
    risk_budget = np.clip(kelly_safe, MIN_RISK_BUDGET, MAX_RISK_BUDGET)

    return {
        "phase": "kelly",
        "n_trades": n_total,
        "risk_budget": round(float(risk_budget), 4),
        "kelly_full": round(float(kelly_full), 4),
        "kelly_lower": round(float(kelly_lower), 4),
        "kelly_safe": round(float(kelly_safe), 4),
        "win_rate": round(float(p_hat), 4),
        "win_rate_lower": round(float(p_lower), 4),
        "payoff_ratio": round(float(b), 4),
        "avg_win": round(float(avg_win), 2),
        "avg_loss": round(float(avg_loss), 2),
        "confidence": confidence,
    }


def get_position_risk_budget(signal: str, trades: list) -> float:
    """
    Get risk budget for a specific signal, applying signal grading.

    Phase 1 (n < 50): Fixed 1.0% for all signals
    Phase 2 (n >= 50): Kelly-derived budget × signal grade
    """
    kelly_info = compute_kelly_fraction(trades)
    base_budget = kelly_info["risk_budget"]

    grade = SIGNAL_GRADES.get(signal, 0.0)
    if grade == 0:
        return 0.0

    return base_budget * grade


def compute_rolling_kelly(trades: list, window: int = 30) -> dict:
    """
    Compute Kelly parameters on a rolling window of recent trades.
    Used for adaptive position sizing that responds to changing market conditions.
    """
    if len(trades) < KELLY_MIN_TRADES:
        return compute_kelly_fraction(trades)

    # Use most recent `window` trades for rolling estimation
    recent = trades[-window:] if len(trades) > window else trades
    return compute_kelly_fraction(recent)


def save_kelly_report(trades: list) -> dict:
    """Compute and save Kelly report to output directory."""
    report = compute_kelly_fraction(trades)
    rolling = compute_rolling_kelly(trades)

    full_report = {
        "lifetime": report,
        "rolling_30": rolling,
        "signal_grades": SIGNAL_GRADES,
        "config": {
            "kelly_fraction": KELLY_FRACTION,
            "min_trades_for_kelly": KELLY_MIN_TRADES,
            "fixed_phase1_budget": FIXED_RISK_BUDGET,
            "max_risk_budget": MAX_RISK_BUDGET,
            "min_risk_budget": MIN_RISK_BUDGET,
        },
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / "kelly_sizing.json"
    with open(out_path, "w") as f:
        json.dump(full_report, f, indent=2, ensure_ascii=False)

    return full_report
