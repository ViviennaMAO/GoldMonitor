"""
P0: Stress Testing Module — tests model behavior during historical crisis periods
where macro-gold logic may break down.

Crisis periods tested:
1. COVID Crash (2020.02-2020.04): Liquidity crisis, gold sold off with everything
2. Fed Hiking Cycle (2022.03-2023.07): Aggressive rate hikes, gold resilient despite real rates
3. Russia-Ukraine (2022.02-2022.06): Geopolitical shock, gold spiked then reversed
4. SVB Crisis (2023.03-2023.05): Banking stress, flight to safety
5. Gold Breakout (2024.03-2024.06): Gold surged despite strong USD + high real rates
"""
import json
import numpy as np
import pandas as pd
import xgboost as xgb
from scipy.stats import spearmanr
from config import (
    MODEL_PATH, OUTPUT_DIR, FACTOR_NAMES, TRAIN_END,
)
from features import get_factor_columns

# ── Crisis Period Definitions ────────────────────────────────────────────────
CRISIS_PERIODS = {
    "covid_crash": {
        "name": "COVID流动性危机",
        "name_en": "COVID Liquidity Crisis",
        "start": "2020-02-20",
        "end": "2020-04-15",
        "description": "流动性恐慌导致黄金与风险资产同跌，传统避险逻辑失效",
        "expected_logic_break": "DXY↑ + Gold↓ (normally inverse), all-asset liquidation",
    },
    "fed_hiking": {
        "name": "美联储加息周期",
        "name_en": "Fed Hiking Cycle",
        "start": "2022-03-16",
        "end": "2023-07-26",
        "description": "525bp加息但黄金仅小幅回调，实际利率-黄金负相关断裂",
        "expected_logic_break": "TIPS↑↑ but Gold sideways (rate-gold link broken)",
    },
    "russia_ukraine": {
        "name": "俄乌冲突",
        "name_en": "Russia-Ukraine War",
        "start": "2022-02-24",
        "end": "2022-06-30",
        "description": "地缘冲击推高金价后快速回落，GPR因子过拟合风险",
        "expected_logic_break": "GPR spike → Gold spike → rapid mean reversion",
    },
    "svb_crisis": {
        "name": "硅谷银行危机",
        "name_en": "SVB Banking Crisis",
        "start": "2023-03-08",
        "end": "2023-05-15",
        "description": "银行业恐慌，避险资金流入黄金，但模型可能未覆盖银行风险因子",
        "expected_logic_break": "GVZ↑ + Gold↑ but ETF flows lagged",
    },
    "gold_breakout_2024": {
        "name": "2024黄金突破",
        "name_en": "Gold Breakout 2024",
        "start": "2024-03-01",
        "end": "2024-06-30",
        "description": "央行购金+地缘推动金价创历史新高，DXY强势但黄金无视美元",
        "expected_logic_break": "DXY↑ + TIPS↑ + Gold↑↑ (breaks both DXY and rate logic)",
    },
}


def run_stress_tests(features_df: pd.DataFrame) -> dict:
    """
    Run stress tests across all crisis periods.
    Returns comprehensive stress test report.
    """
    factor_cols = get_factor_columns()

    # Load model
    model = xgb.XGBRegressor()
    model.load_model(str(MODEL_PATH))

    report = {
        "generated_at": pd.Timestamp.now().isoformat(),
        "model_path": str(MODEL_PATH),
        "train_end": TRAIN_END,
        "periods": {},
        "summary": {},
    }

    all_ics = []
    all_hit_rates = []

    for period_id, period_info in CRISIS_PERIODS.items():
        start = pd.Timestamp(period_info["start"])
        end = pd.Timestamp(period_info["end"])

        # Filter data for this period
        mask = (features_df.index >= start) & (features_df.index <= end)
        period_df = features_df[mask].copy()

        if period_df.empty or len(period_df) < 5:
            report["periods"][period_id] = {
                "name": period_info["name"],
                "status": "insufficient_data",
                "samples": len(period_df),
            }
            continue

        # Prepare features
        period_df[factor_cols] = period_df[factor_cols].fillna(0)
        X = np.nan_to_num(
            period_df[factor_cols].values.astype(np.float64),
            nan=0.0, posinf=5.0, neginf=-5.0
        )

        # Model predictions
        predictions = model.predict(X)

        # Actual returns (if available)
        has_target = "target" in period_df.columns and period_df["target"].notna().sum() > 5
        actual = period_df["target"].values if has_target else None

        # ── Metrics ──────────────────────────────────────────────────────────
        result = {
            "name": period_info["name"],
            "name_en": period_info["name_en"],
            "start": period_info["start"],
            "end": period_info["end"],
            "description": period_info["description"],
            "expected_logic_break": period_info["expected_logic_break"],
            "samples": len(period_df),
            "is_oos": start > pd.Timestamp(TRAIN_END),
        }

        # Prediction statistics
        result["pred_mean"] = round(float(np.mean(predictions)), 4)
        result["pred_std"] = round(float(np.std(predictions)), 4)
        result["pred_min"] = round(float(np.min(predictions)), 4)
        result["pred_max"] = round(float(np.max(predictions)), 4)

        # Gold price movement
        if "gold_price" in period_df.columns:
            gp = period_df["gold_price"].dropna()
            if len(gp) >= 2:
                result["gold_return"] = round(float((gp.iloc[-1] / gp.iloc[0] - 1) * 100), 2)
                result["gold_start"] = round(float(gp.iloc[0]), 2)
                result["gold_end"] = round(float(gp.iloc[-1]), 2)
                result["gold_max_drawdown"] = round(float(
                    (gp / gp.cummax() - 1).min() * 100
                ), 2)

        # IC and directional accuracy (only if actual returns available)
        if has_target:
            valid = ~np.isnan(actual) & ~np.isnan(predictions)
            if valid.sum() > 5:
                ic, _ = spearmanr(predictions[valid], actual[valid])
                result["ic"] = round(float(ic), 4) if not np.isnan(ic) else 0.0
                all_ics.append(result["ic"])

                # Direction hit rate
                pred_dir = np.sign(predictions[valid])
                actual_dir = np.sign(actual[valid])
                hit_rate = float(np.mean(pred_dir == actual_dir)) * 100
                result["direction_hit_rate"] = round(hit_rate, 1)
                all_hit_rates.append(hit_rate)
            else:
                result["ic"] = None
                result["direction_hit_rate"] = None
        else:
            result["ic"] = None
            result["direction_hit_rate"] = None

        # ── Factor Z-Score analysis during crisis ────────────────────────────
        factor_analysis = []
        for fname in factor_cols:
            fvals = period_df[fname].dropna()
            if len(fvals) > 0:
                factor_analysis.append({
                    "factor": fname,
                    "mean_zscore": round(float(fvals.mean()), 3),
                    "max_abs_zscore": round(float(fvals.abs().max()), 3),
                    "pct_extreme": round(float((fvals.abs() > 2).mean() * 100), 1),
                })
        result["factor_analysis"] = factor_analysis

        # ── Logic break detection ────────────────────────────────────────────
        logic_breaks = []

        # Check 1: Prediction vs actual direction mismatch
        if result.get("ic") is not None and result["ic"] < 0:
            logic_breaks.append({
                "type": "negative_ic",
                "severity": "high" if result["ic"] < -0.2 else "medium",
                "detail": f"IC={result['ic']:.4f}, model predictions inversely correlated with reality",
            })

        # Check 2: Extreme factor values (>3 sigma)
        for fa in factor_analysis:
            if fa["max_abs_zscore"] > 3.0:
                logic_breaks.append({
                    "type": "extreme_factor",
                    "severity": "high",
                    "detail": f"{fa['factor']} reached {fa['max_abs_zscore']:.1f}σ — outside training distribution",
                })

        # Check 3: Prediction contradicts gold movement
        if "gold_return" in result and result["pred_mean"] != 0:
            gold_dir = np.sign(result["gold_return"])
            pred_dir = np.sign(result["pred_mean"])
            if gold_dir != pred_dir and abs(result["gold_return"]) > 3:
                logic_breaks.append({
                    "type": "direction_mismatch",
                    "severity": "high",
                    "detail": f"Model predicted {'↑' if pred_dir > 0 else '↓'} but gold moved {result['gold_return']:+.1f}%",
                })

        # Check 4: Low prediction variance (model uncertain / flat)
        if result["pred_std"] < 0.1:
            logic_breaks.append({
                "type": "flat_predictions",
                "severity": "low",
                "detail": f"Prediction std={result['pred_std']:.4f}, model may be overly conservative",
            })

        result["logic_breaks"] = logic_breaks
        result["logic_break_count"] = len(logic_breaks)
        result["max_severity"] = (
            "high" if any(lb["severity"] == "high" for lb in logic_breaks)
            else "medium" if any(lb["severity"] == "medium" for lb in logic_breaks)
            else "low" if logic_breaks
            else "none"
        )

        report["periods"][period_id] = result

    # ── Summary ──────────────────────────────────────────────────────────────
    total_breaks = sum(p.get("logic_break_count", 0) for p in report["periods"].values())
    high_severity = sum(
        1 for p in report["periods"].values()
        if p.get("max_severity") == "high"
    )

    report["summary"] = {
        "total_periods_tested": len(CRISIS_PERIODS),
        "periods_with_data": sum(1 for p in report["periods"].values() if p.get("samples", 0) >= 5),
        "total_logic_breaks": total_breaks,
        "high_severity_periods": high_severity,
        "avg_crisis_ic": round(float(np.mean(all_ics)), 4) if all_ics else None,
        "avg_direction_hit_rate": round(float(np.mean(all_hit_rates)), 1) if all_hit_rates else None,
        "overall_assessment": _assess_overall(total_breaks, high_severity, all_ics),
    }

    # ── Save output ──────────────────────────────────────────────────────────
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / "stress_test.json"
    with open(out_path, "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nStress test report saved to {out_path}")

    # Print summary
    print(f"\n{'='*60}")
    print("STRESS TEST SUMMARY")
    print(f"{'='*60}")
    for pid, p in report["periods"].items():
        if p.get("status") == "insufficient_data":
            print(f"  {p['name']}: ⚠ insufficient data")
            continue
        ic_str = f"IC={p['ic']:.4f}" if p.get('ic') is not None else "IC=N/A"
        breaks = p.get('logic_break_count', 0)
        severity = p.get('max_severity', 'none')
        gold_ret = f"Gold={p.get('gold_return', 'N/A'):+.1f}%" if isinstance(p.get('gold_return'), (int, float)) else ""
        print(f"  {p['name']}: {ic_str} | {breaks} breaks ({severity}) | {gold_ret}")

    print(f"\nOverall: {report['summary']['overall_assessment']}")

    return report


def _assess_overall(total_breaks: int, high_severity: int, ics: list) -> str:
    """Generate overall assessment string."""
    if high_severity >= 3:
        return "CRITICAL — Model has significant logic breaks across multiple crisis types. Consider adding regime-aware features."
    elif high_severity >= 1:
        return "WARNING — Some crisis periods expose logic breaks. Recommend stress-aware position sizing and factor monitoring."
    elif total_breaks > 3:
        return "MODERATE — Minor logic breaks detected. Model is generally robust but watch for extreme factor conditions."
    else:
        return "HEALTHY — Model handles crisis periods reasonably well. Continue monitoring."


if __name__ == "__main__":
    from fetch_data import fetch_all_data
    from features import build_features

    raw = fetch_all_data()
    feat = build_features(raw)
    run_stress_tests(feat)
