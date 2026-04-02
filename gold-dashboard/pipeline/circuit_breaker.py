"""
Step 3: Circuit Breaker — Drawdown-based risk controls

Two-layer defense:
  Layer A (Slow Fading): Drawdown-triggered position reduction
  Layer B (IC Monitor): Rolling IC signal disappearance detection

Based on Thorp's "pause the table" methodology + Shannon's
adaptive rate control for slow-fading channels.
"""
import json
import numpy as np
import pandas as pd
from config import OUTPUT_DIR


# ── Drawdown thresholds (Thorp) ─────────────────────────────────────────────
DRAWDOWN_REDUCE_HALF = 0.05    # Monthly DD > 5% → halve position
DRAWDOWN_PAUSE = 0.08          # Monthly DD > 8% → pause 20 days
DRAWDOWN_LIQUIDATE = 0.15      # Cumulative DD > 15% → liquidate, manual review

# ── IC Monitor thresholds (Shannon) ─────────────────────────────────────────
IC_HIBERNATE = 0.05            # Rolling IC < 0.05 → hibernate (no trading)
IC_FULL_SIGNAL = 0.15          # Rolling IC > 0.15 → full signal trading
IC_WINDOW = 60                 # Rolling window for IC estimation

# ── Pause duration ──────────────────────────────────────────────────────────
PAUSE_DAYS = 20                # Trading days to pause after DD breach


class CircuitBreaker:
    """
    Monitors equity curve and IC to provide real-time risk controls.
    """

    def __init__(self, initial_equity: float = 100000.0):
        self.initial_equity = initial_equity
        self.peak_equity = initial_equity
        self.monthly_peak = initial_equity
        self.month_start_equity = initial_equity
        self.current_month = None
        self.pause_until = None
        self.status = "active"
        self.history = []

    def update(self, date: pd.Timestamp, equity: float, rolling_ic: float = None) -> dict:
        """
        Check circuit breaker conditions. Called daily.

        Returns:
            multiplier: 0.0 to 1.0 — multiply position size by this
            status: "active", "reduced", "paused", "liquidated", "hibernating"
            reason: Description of any triggered condition
        """
        # Track monthly resets
        current_month = date.strftime("%Y-%m")
        if current_month != self.current_month:
            self.current_month = current_month
            self.month_start_equity = equity
            self.monthly_peak = equity

        # Update peaks
        self.peak_equity = max(self.peak_equity, equity)
        self.monthly_peak = max(self.monthly_peak, equity)

        # ── Check pause timer ────────────────────────────────────────────────
        if self.pause_until and date < self.pause_until:
            remaining = (self.pause_until - date).days
            return {
                "multiplier": 0.0,
                "status": "paused",
                "reason": f"Trading paused ({remaining}d remaining after DD > {DRAWDOWN_PAUSE*100:.0f}%)",
                "cumulative_dd": self._cumulative_dd(equity),
                "monthly_dd": self._monthly_dd(equity),
            }
        elif self.pause_until and date >= self.pause_until:
            self.pause_until = None  # Resume trading

        # ── Layer A: Drawdown checks ─────────────────────────────────────────
        cum_dd = self._cumulative_dd(equity)
        monthly_dd = self._monthly_dd(equity)

        # Level 3: Cumulative DD > 15% → Liquidate
        if cum_dd > DRAWDOWN_LIQUIDATE:
            self.status = "liquidated"
            return {
                "multiplier": 0.0,
                "status": "liquidated",
                "reason": f"CIRCUIT BREAK: cumulative DD = {cum_dd*100:.1f}% > {DRAWDOWN_LIQUIDATE*100:.0f}%",
                "cumulative_dd": cum_dd,
                "monthly_dd": monthly_dd,
            }

        # Level 2: Monthly DD > 8% → Pause 20 days
        if monthly_dd > DRAWDOWN_PAUSE:
            self.pause_until = date + pd.Timedelta(days=PAUSE_DAYS)
            self.status = "paused"
            return {
                "multiplier": 0.0,
                "status": "paused",
                "reason": f"Paused {PAUSE_DAYS}d: monthly DD = {monthly_dd*100:.1f}% > {DRAWDOWN_PAUSE*100:.0f}%",
                "cumulative_dd": cum_dd,
                "monthly_dd": monthly_dd,
            }

        # Level 1: Monthly DD > 5% → Halve position
        if monthly_dd > DRAWDOWN_REDUCE_HALF:
            self.status = "reduced"
            multiplier = 0.5
            reason = f"Position halved: monthly DD = {monthly_dd*100:.1f}% > {DRAWDOWN_REDUCE_HALF*100:.0f}%"
        else:
            multiplier = 1.0
            reason = None
            self.status = "active"

        # ── Layer B: IC Monitor ──────────────────────────────────────────────
        if rolling_ic is not None:
            if rolling_ic < IC_HIBERNATE:
                self.status = "hibernating"
                return {
                    "multiplier": 0.0,
                    "status": "hibernating",
                    "reason": f"Signal disappeared: rolling IC = {rolling_ic:.4f} < {IC_HIBERNATE}",
                    "cumulative_dd": cum_dd,
                    "monthly_dd": monthly_dd,
                    "rolling_ic": rolling_ic,
                }
            elif rolling_ic < IC_FULL_SIGNAL:
                # Scale linearly between IC_HIBERNATE and IC_FULL_SIGNAL
                ic_scale = (rolling_ic - IC_HIBERNATE) / (IC_FULL_SIGNAL - IC_HIBERNATE)
                multiplier = min(multiplier, ic_scale)
                if reason:
                    reason += f" + IC scaling ({rolling_ic:.3f})"
                else:
                    reason = f"IC scaling: {rolling_ic:.3f} → mult={ic_scale:.2f}"
                    self.status = "reduced"

        result = {
            "multiplier": round(float(multiplier), 4),
            "status": self.status,
            "reason": reason or "Normal operation",
            "cumulative_dd": round(float(cum_dd), 4),
            "monthly_dd": round(float(monthly_dd), 4),
        }
        if rolling_ic is not None:
            result["rolling_ic"] = round(float(rolling_ic), 4)

        self.history.append({
            "date": date.strftime("%Y-%m-%d"),
            **result,
        })

        return result

    def _cumulative_dd(self, equity: float) -> float:
        """Cumulative drawdown from all-time peak."""
        if self.peak_equity <= 0:
            return 0.0
        return max(0, (self.peak_equity - equity) / self.peak_equity)

    def _monthly_dd(self, equity: float) -> float:
        """Monthly drawdown from month's peak."""
        if self.monthly_peak <= 0:
            return 0.0
        return max(0, (self.monthly_peak - equity) / self.monthly_peak)

    def save_report(self) -> dict:
        """Save circuit breaker history and current status."""
        report = {
            "current_status": self.status,
            "peak_equity": round(self.peak_equity, 2),
            "config": {
                "drawdown_reduce_half": DRAWDOWN_REDUCE_HALF,
                "drawdown_pause": DRAWDOWN_PAUSE,
                "drawdown_liquidate": DRAWDOWN_LIQUIDATE,
                "ic_hibernate": IC_HIBERNATE,
                "ic_full_signal": IC_FULL_SIGNAL,
                "pause_days": PAUSE_DAYS,
            },
            "recent_events": [
                h for h in self.history[-50:]
                if h.get("status") != "active"
            ],
        }

        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        out_path = OUTPUT_DIR / "circuit_breaker.json"
        with open(out_path, "w") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        return report
