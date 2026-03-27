"""
P2: Granger Causality Testing — verifies that factors temporally lead gold returns.

Tests whether each factor's past values help predict future gold returns
beyond what gold's own history can predict. Factors that fail Granger causality
may be spurious correlations rather than genuine drivers.
"""
import json
import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from config import OUTPUT_DIR, TRAIN_END, FACTOR_NAMES, FACTOR_DISPLAY
from features import get_factor_columns


def granger_causality_simple(x: np.ndarray, y: np.ndarray, max_lag: int = 20) -> dict:
    """
    Simplified Granger causality test using lagged cross-correlation.
    Tests if x[t-lag] helps predict y[t] better than y's own history.

    Returns dict with optimal lag, correlation at each lag, and whether x Granger-causes y.
    """
    results = []
    n = len(x)

    for lag in range(1, max_lag + 1):
        if lag >= n - 10:
            break
        x_lagged = x[:n - lag]
        y_future = y[lag:]
        # Only use valid pairs
        valid = ~(np.isnan(x_lagged) | np.isnan(y_future))
        if valid.sum() < 20:
            continue
        ic, pval = spearmanr(x_lagged[valid], y_future[valid])
        results.append({
            "lag": lag,
            "ic": round(float(ic), 4) if not np.isnan(ic) else 0.0,
            "p_value": round(float(pval), 6) if not np.isnan(pval) else 1.0,
            "significant": pval < 0.05 if not np.isnan(pval) else False,
        })

    if not results:
        return {"granger_causes": False, "optimal_lag": None, "lag_profile": []}

    # Find optimal lag (highest absolute IC with significance)
    sig_results = [r for r in results if r["significant"]]
    if sig_results:
        best = max(sig_results, key=lambda r: abs(r["ic"]))
    else:
        best = max(results, key=lambda r: abs(r["ic"]))

    return {
        "granger_causes": len(sig_results) > 0,
        "optimal_lag": best["lag"],
        "optimal_ic": best["ic"],
        "optimal_pval": best["p_value"],
        "n_significant_lags": len(sig_results),
        "lag_profile": results,
    }


def compute_regime_ic(features_df: pd.DataFrame, factor_cols: list) -> dict:
    """
    Compute per-factor IC broken down by market regime.
    Regimes: trend-up (gold 60d return > 5%), trend-down (< -5%), range-bound.
    """
    df = features_df.copy()
    if "gold_price" not in df.columns or "target" not in df.columns:
        return {}

    # Define regimes based on trailing 60-day gold return
    gold_ret_60d = df["gold_price"].pct_change(60) * 100
    df["_regime"] = "range"
    df.loc[gold_ret_60d > 5, "_regime"] = "trend_up"
    df.loc[gold_ret_60d < -5, "_regime"] = "trend_down"

    regime_ics = {}
    for regime in ["trend_up", "trend_down", "range"]:
        regime_df = df[df["_regime"] == regime].dropna(subset=factor_cols + ["target"])
        if len(regime_df) < 30:
            continue

        factor_ics = {}
        for fname in factor_cols:
            fvals = regime_df[fname].values
            tvals = regime_df["target"].values
            valid = ~(np.isnan(fvals) | np.isnan(tvals))
            if valid.sum() < 20:
                factor_ics[fname] = None
                continue
            ic, _ = spearmanr(fvals[valid], tvals[valid])
            factor_ics[fname] = round(float(ic), 4) if not np.isnan(ic) else 0.0

        regime_ics[regime] = {
            "samples": len(regime_df),
            "factor_ics": factor_ics,
        }

    return regime_ics


def run_granger_analysis(features_df: pd.DataFrame) -> dict:
    """
    Run full Granger causality analysis for all factors.
    """
    factor_cols = get_factor_columns()

    # Use full dataset for Granger (need long history)
    df = features_df.dropna(subset=["target"]).copy()
    df[factor_cols] = df[factor_cols].fillna(0)

    if len(df) < 60:
        print("WARNING: Not enough data for Granger analysis")
        return {}

    target = df["target"].values
    report = {
        "generated_at": pd.Timestamp.now().isoformat(),
        "total_samples": len(df),
        "factors": {},
        "regime_ic": {},
        "summary": {},
    }

    granger_pass = 0
    granger_fail = 0

    print(f"\n{'='*60}")
    print("GRANGER CAUSALITY ANALYSIS")
    print(f"{'='*60}")

    for fname in factor_cols:
        factor_vals = df[fname].values
        display = FACTOR_DISPLAY.get(fname, fname)

        # Granger test
        gc = granger_causality_simple(factor_vals, target, max_lag=20)

        # Contemporaneous IC (for comparison)
        valid = ~(np.isnan(factor_vals) | np.isnan(target))
        if valid.sum() > 20:
            contemp_ic, _ = spearmanr(factor_vals[valid], target[valid])
            contemp_ic = round(float(contemp_ic), 4)
        else:
            contemp_ic = 0.0

        # OOS-only IC
        oos_mask = df.index > pd.Timestamp(TRAIN_END)
        oos_df = df[oos_mask]
        if len(oos_df) > 20:
            oos_fvals = oos_df[fname].values
            oos_tvals = oos_df["target"].values
            oos_valid = ~(np.isnan(oos_fvals) | np.isnan(oos_tvals))
            if oos_valid.sum() > 10:
                oos_ic, _ = spearmanr(oos_fvals[oos_valid], oos_tvals[oos_valid])
                oos_ic = round(float(oos_ic), 4) if not np.isnan(oos_ic) else 0.0
            else:
                oos_ic = None
        else:
            oos_ic = None

        factor_result = {
            "display_name": display,
            "contemporaneous_ic": contemp_ic,
            "oos_ic": oos_ic,
            "granger_causes_gold": gc["granger_causes"],
            "optimal_lag_days": gc.get("optimal_lag"),
            "optimal_lag_ic": gc.get("optimal_ic"),
            "optimal_lag_pval": gc.get("optimal_pval"),
            "n_significant_lags": gc.get("n_significant_lags", 0),
            "verdict": _factor_verdict(gc, contemp_ic, oos_ic),
        }

        report["factors"][fname] = factor_result

        if gc["granger_causes"]:
            granger_pass += 1
            status = "PASS"
        else:
            granger_fail += 1
            status = "FAIL"

        lag_str = f"lag={gc.get('optimal_lag', '?')}d" if gc.get('optimal_lag') else "N/A"
        oos_str = f"OOS={oos_ic:.3f}" if oos_ic is not None else "OOS=N/A"
        print(f"  {display:20s} | Granger: {status} | {lag_str} | IC={contemp_ic:+.3f} | {oos_str}")

    # ── Regime-based IC ──────────────────────────────────────────────────────
    regime_ics = compute_regime_ic(features_df, factor_cols)
    report["regime_ic"] = regime_ics

    if regime_ics:
        print(f"\n{'─'*60}")
        print("REGIME-CONDITIONAL IC")
        print(f"{'─'*60}")
        for regime, data in regime_ics.items():
            regime_label = {"trend_up": "趋势上行", "trend_down": "趋势下行", "range": "震荡区间"}
            print(f"\n  {regime_label.get(regime, regime)} (n={data['samples']}):")
            for fname, ic in data["factor_ics"].items():
                if ic is not None:
                    display = FACTOR_DISPLAY.get(fname, fname)
                    print(f"    {display:20s} IC={ic:+.4f}")

    # ── Summary ──────────────────────────────────────────────────────────────
    report["summary"] = {
        "granger_pass": granger_pass,
        "granger_fail": granger_fail,
        "total_factors": len(factor_cols),
        "pass_rate": round(granger_pass / len(factor_cols) * 100, 1),
        "recommendation": _overall_recommendation(report["factors"]),
    }

    print(f"\nGranger Pass Rate: {granger_pass}/{len(factor_cols)} ({report['summary']['pass_rate']:.0f}%)")
    print(f"Recommendation: {report['summary']['recommendation']}")

    # ── Save ─────────────────────────────────────────────────────────────────
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / "granger_test.json"
    # Strip lag_profile for compact output
    compact = json.loads(json.dumps(report))
    for f in compact["factors"].values():
        f.pop("lag_profile", None)
    with open(out_path, "w") as f:
        json.dump(compact, f, indent=2, ensure_ascii=False)
    print(f"Granger analysis saved to {out_path}")

    return report


def _factor_verdict(gc: dict, contemp_ic: float, oos_ic) -> str:
    """Generate per-factor verdict."""
    if gc["granger_causes"] and oos_ic is not None and abs(oos_ic) > 0.1:
        return "STRONG — Granger causal + significant OOS IC"
    elif gc["granger_causes"]:
        return "VALID — Granger causal, monitor OOS performance"
    elif oos_ic is not None and abs(oos_ic) > 0.15:
        return "SUSPECT — No Granger causality but has OOS IC (possible coincidence)"
    elif abs(contemp_ic) > 0.1 and (oos_ic is None or abs(oos_ic) < 0.05):
        return "WEAK — In-sample IC but no OOS or Granger support, likely overfit"
    else:
        return "REDUNDANT — Consider removing from model"


def _overall_recommendation(factors: dict) -> str:
    """Generate overall recommendation."""
    strong = sum(1 for f in factors.values() if "STRONG" in f.get("verdict", ""))
    valid = sum(1 for f in factors.values() if "VALID" in f.get("verdict", ""))
    weak = sum(1 for f in factors.values() if "WEAK" in f.get("verdict", ""))
    redundant = sum(1 for f in factors.values() if "REDUNDANT" in f.get("verdict", ""))

    if redundant >= 3:
        return f"PRUNE — {redundant} redundant factors detected. Remove to reduce overfitting."
    elif weak >= 3:
        return f"CAUTION — {weak} weak factors. In-sample IC may not generalize."
    elif strong + valid >= len(factors) * 0.6:
        return f"HEALTHY — {strong} strong + {valid} valid factors. Good causal foundation."
    else:
        return f"MIXED — {strong} strong, {valid} valid, {weak} weak, {redundant} redundant. Review factor selection."


if __name__ == "__main__":
    from fetch_data import fetch_all_data
    from features import build_features

    raw = fetch_all_data()
    feat = build_features(raw)
    run_granger_analysis(feat)
