"""
IC Diagnostic Experiments — Phase 1
Three experiments to diagnose factor IC problems and guide repair:

  Experiment A: Multi-target IC matrix (5 targets × 9 factors, Bootstrap CI)
  Experiment B: Multi-window IC matrix (4 windows × 2 targets × 9 factors)
  Experiment C: Ablation test (leave-one-out, retrain XGBoost, compare model OOS IC)

Pre-registered hypotheses:
  H1: F4_BEI flips positive on 5d direction target
  H2: F6_GVZ stays negative everywhere → confirm noise
  H3: Window=126 flips ≥3 factors positive
  H4: Removing F4 decreases model OOS IC (non-linear interaction value)
"""
import json
import numpy as np
import pandas as pd
import xgboost as xgb
from scipy.stats import spearmanr
from config import (
    FACTOR_NAMES, TRAIN_END, FORWARD_DAYS, ZSCORE_WINDOW,
    XGB_PARAMS, MODEL_PATH, OUTPUT_DIR,
)
from features import get_factor_columns, rolling_zscore, build_features


# ── Experiment A: Multi-Target IC Matrix ─────────────────────────────────────

def compute_targets(features_df: pd.DataFrame, gold_col: str = "gold_price") -> pd.DataFrame:
    """
    Compute 5 target variables for IC diagnosis:
      1. ret_20d   — current 20-day forward % return (baseline)
      2. ret_5d    — 5-day forward % return (short-term signal)
      3. ret_10d   — 10-day forward % return (medium-term)
      4. dir_5d    — 5-day forward direction (sign of return: +1/0/-1)
      5. vol_20d   — 20-day forward realized volatility (absolute returns proxy)
    """
    targets = pd.DataFrame(index=features_df.index)
    price = features_df[gold_col]

    for days in [5, 10, 20]:
        targets[f"ret_{days}d"] = (price.shift(-days) / price - 1) * 100

    # Direction: sign of 5-day return
    targets["dir_5d"] = np.sign(targets["ret_5d"])

    # Realized volatility: std of daily returns over next 20 days
    daily_ret = price.pct_change()
    targets["vol_20d"] = daily_ret.shift(-1).rolling(20).std().shift(-19) * np.sqrt(252) * 100

    return targets


def bootstrap_ic(factor_vals: np.ndarray, target_vals: np.ndarray,
                 n_boot: int = 1000, ci: float = 0.90) -> dict:
    """Compute Spearman IC with bootstrap confidence interval."""
    n = len(factor_vals)
    if n < 20:
        return {"ic": 0.0, "ci_lo": 0.0, "ci_hi": 0.0, "n": n, "significant": False}

    ic, _ = spearmanr(factor_vals, target_vals)
    ic = float(ic) if not np.isnan(ic) else 0.0

    # Bootstrap
    rng = np.random.RandomState(42)
    boot_ics = []
    for _ in range(n_boot):
        idx = rng.choice(n, size=n, replace=True)
        b_ic, _ = spearmanr(factor_vals[idx], target_vals[idx])
        if not np.isnan(b_ic):
            boot_ics.append(float(b_ic))

    if len(boot_ics) < 100:
        return {"ic": ic, "ci_lo": ic, "ci_hi": ic, "n": n, "significant": False}

    alpha = (1 - ci) / 2
    ci_lo = float(np.percentile(boot_ics, alpha * 100))
    ci_hi = float(np.percentile(boot_ics, (1 - alpha) * 100))

    # Significant if CI doesn't cross zero
    significant = (ci_lo > 0) or (ci_hi < 0)

    return {
        "ic": round(ic, 4),
        "ci_lo": round(ci_lo, 4),
        "ci_hi": round(ci_hi, 4),
        "n": n,
        "significant": significant,
    }


def experiment_a(features_df: pd.DataFrame) -> dict:
    """
    Experiment A: Multi-target IC matrix.
    5 targets × 9 factors with Bootstrap 90% CI.
    """
    print("\n" + "=" * 70)
    print("EXPERIMENT A: Multi-Target IC Matrix (Bootstrap 90% CI)")
    print("=" * 70)

    factor_cols = get_factor_columns()
    oos_mask = features_df.index > pd.Timestamp(TRAIN_END)
    oos_df = features_df[oos_mask].copy()

    # Compute targets
    targets = compute_targets(oos_df)
    target_names = ["ret_5d", "ret_10d", "ret_20d", "dir_5d", "vol_20d"]

    results = {}
    for target_name in target_names:
        target_col = targets[target_name].dropna()
        results[target_name] = {}

        for factor in factor_cols:
            # Align factor and target
            common_idx = oos_df[factor].dropna().index.intersection(target_col.index)
            if len(common_idx) < 20:
                results[target_name][factor] = {
                    "ic": 0.0, "ci_lo": 0.0, "ci_hi": 0.0,
                    "n": len(common_idx), "significant": False,
                }
                continue

            f_vals = oos_df.loc[common_idx, factor].values.astype(np.float64)
            t_vals = target_col.loc[common_idx].values.astype(np.float64)

            # Clean
            mask = np.isfinite(f_vals) & np.isfinite(t_vals)
            results[target_name][factor] = bootstrap_ic(f_vals[mask], t_vals[mask])

    # Print matrix
    print(f"\n{'Factor':<25}", end="")
    for t in target_names:
        print(f"  {t:>12}", end="")
    print()
    print("-" * (25 + 14 * len(target_names)))

    for factor in factor_cols:
        print(f"{factor:<25}", end="")
        for t in target_names:
            r = results[t][factor]
            sig = "*" if r["significant"] else " "
            print(f"  {r['ic']:>+6.3f}{sig}     ", end="")
        print()

    print(f"\n* = 90% CI excludes zero (significant)")
    print(f"  N(OOS) ≈ {len(oos_df)} days")

    # Check pre-registered hypotheses
    print("\n── Pre-Registered Hypothesis Checks ──")
    h1_result = results.get("dir_5d", {}).get("F4_BEI", {})
    h1_pass = h1_result.get("ic", 0) > 0
    print(f"  H1 (F4_BEI positive on dir_5d): IC={h1_result.get('ic', 'N/A')}"
          f" → {'CONFIRMED ✓' if h1_pass else 'REJECTED ✗'}")

    h2_all_neg = all(
        results.get(t, {}).get("F6_GVZ", {}).get("ic", 1) <= 0
        for t in target_names
    )
    print(f"  H2 (F6_GVZ negative everywhere): → {'CONFIRMED ✓' if h2_all_neg else 'REJECTED ✗'}")

    return results


# ── Experiment B: Multi-Window IC Matrix ─────────────────────────────────────

def experiment_b(raw_df: pd.DataFrame, features_df: pd.DataFrame) -> dict:
    """
    Experiment B: Multi-window IC matrix.
    Recompute Z-scores with different windows and measure IC on ret_20d and ret_5d.
    Windows: 63 (quarter), 126 (half-year), 252 (current), 504 (2-year).
    """
    print("\n" + "=" * 70)
    print("EXPERIMENT B: Multi-Window IC Matrix")
    print("=" * 70)

    windows = [63, 126, 252, 504]
    target_horizons = ["ret_5d", "ret_20d"]
    factor_cols = get_factor_columns()

    # We need the raw data to recompute Z-scores with different windows
    oos_mask = features_df.index > pd.Timestamp(TRAIN_END)

    results = {}
    for window in windows:
        # Rebuild features with this window
        feat_w = _rebuild_features_with_window(raw_df, window)
        oos_w = feat_w[feat_w.index > pd.Timestamp(TRAIN_END)].copy()
        targets_w = compute_targets(oos_w)

        results[window] = {}
        for target_name in target_horizons:
            target_col = targets_w[target_name].dropna()
            results[window][target_name] = {}

            for factor in factor_cols:
                if factor not in oos_w.columns:
                    results[window][target_name][factor] = {"ic": 0.0, "n": 0}
                    continue

                common_idx = oos_w[factor].dropna().index.intersection(target_col.index)
                if len(common_idx) < 20:
                    results[window][target_name][factor] = {"ic": 0.0, "n": len(common_idx)}
                    continue

                f_vals = oos_w.loc[common_idx, factor].values.astype(np.float64)
                t_vals = target_col.loc[common_idx].values.astype(np.float64)
                mask = np.isfinite(f_vals) & np.isfinite(t_vals)

                if mask.sum() < 20:
                    results[window][target_name][factor] = {"ic": 0.0, "n": int(mask.sum())}
                    continue

                ic, _ = spearmanr(f_vals[mask], t_vals[mask])
                ic = float(ic) if not np.isnan(ic) else 0.0
                results[window][target_name][factor] = {"ic": round(ic, 4), "n": int(mask.sum())}

    # Print matrices
    for target_name in target_horizons:
        print(f"\n── Target: {target_name} ──")
        print(f"{'Factor':<25}", end="")
        for w in windows:
            print(f"  w={w:>3}", end="")
        print()
        print("-" * (25 + 8 * len(windows)))

        for factor in factor_cols:
            print(f"{factor:<25}", end="")
            for w in windows:
                ic = results[w][target_name].get(factor, {}).get("ic", 0)
                print(f"  {ic:>+.3f}", end="")
            print()

    # Check H3: window=126 flips ≥3 factors positive (compared to 252)
    flipped = 0
    for factor in factor_cols:
        ic_252 = results[252]["ret_20d"].get(factor, {}).get("ic", 0)
        ic_126 = results[126]["ret_20d"].get(factor, {}).get("ic", 0)
        if ic_252 <= 0 and ic_126 > 0:
            flipped += 1
    print(f"\n  H3 (window=126 flips ≥3 factors positive on ret_20d): "
          f"flipped={flipped} → {'CONFIRMED ✓' if flipped >= 3 else 'REJECTED ✗'}")

    return results


def _rebuild_features_with_window(raw_df: pd.DataFrame, window: int) -> pd.DataFrame:
    """Rebuild factor features using a custom Z-Score window."""
    # Temporarily override window in rolling_zscore by calling it directly
    features = pd.DataFrame(index=raw_df.index)

    def _zs(series):
        return rolling_zscore(series, window=window)

    if "DXY" in raw_df.columns:
        features["F1_DXY"] = _zs(raw_df["DXY"])
    else:
        features["F1_DXY"] = 0.0

    if "BEI" in raw_df.columns:
        features["F4_BEI"] = _zs(raw_df["BEI"])
    else:
        features["F4_BEI"] = 0.0

    if "GPR" in raw_df.columns:
        features["F5_GPR"] = _zs(raw_df["GPR"])
    elif "OVX_close" in raw_df.columns:
        features["F5_GPR"] = _zs(raw_df["OVX_close"])
    else:
        features["F5_GPR"] = 0.0

    if "GVZ_close" in raw_df.columns:
        features["F6_GVZ"] = _zs(raw_df["GVZ_close"])
    else:
        features["F6_GVZ"] = 0.0

    if "GDX_close" in raw_df.columns and "XAUUSD_close" in raw_df.columns:
        ratio = raw_df["GDX_close"] / raw_df["XAUUSD_close"]
        ratio_mom = ratio.pct_change(20) * 100
        features["F9_GDXMomentum"] = _zs(ratio_mom)
    else:
        features["F9_GDXMomentum"] = 0.0

    if "TIPS_10Y" in raw_df.columns and "BEI" in raw_df.columns:
        features["F10_TIPSBEISpread"] = _zs(raw_df["TIPS_10Y"] - raw_df["BEI"])
    else:
        features["F10_TIPSBEISpread"] = 0.0

    if "DXY" in raw_df.columns:
        dxy_mom = raw_df["DXY"].pct_change(20) * 100
        features["F11_DXYMomentum"] = _zs(dxy_mom)
    else:
        features["F11_DXYMomentum"] = 0.0

    if "GDX_close" in raw_df.columns and "XAUUSD_close" in raw_df.columns:
        gold_z = _zs(raw_df["XAUUSD_close"])
        gdx_z = _zs(raw_df["GDX_close"])
        features["F13_GoldGDXDivergence"] = (gold_z - gdx_z).clip(-5, 5)
    else:
        features["F13_GoldGDXDivergence"] = 0.0

    if "GVZ_close" in raw_df.columns:
        gvz_mom = raw_df["GVZ_close"].pct_change(10) * 100
        features["F14_GVZMomentum"] = _zs(gvz_mom)
    else:
        features["F14_GVZMomentum"] = 0.0

    if "XAUUSD_close" in raw_df.columns:
        features["gold_price"] = raw_df["XAUUSD_close"]
        features["target"] = (
            raw_df["XAUUSD_close"].shift(-FORWARD_DAYS) / raw_df["XAUUSD_close"] - 1
        ) * 100

    return features


# ── Experiment C: Ablation Test ──────────────────────────────────────────────

def experiment_c(features_df: pd.DataFrame) -> dict:
    """
    Experiment C: Leave-one-out ablation.
    For each factor, retrain XGBoost without it and compare model OOS Spearman IC.
    """
    print("\n" + "=" * 70)
    print("EXPERIMENT C: Ablation Test (Leave-One-Out)")
    print("=" * 70)

    factor_cols = get_factor_columns()
    train_mask = features_df.index <= pd.Timestamp(TRAIN_END)
    test_mask = features_df.index > pd.Timestamp(TRAIN_END)

    train_df = features_df[train_mask].dropna(subset=["target"]).copy()
    test_df = features_df[test_mask].dropna(subset=["target"]).copy()

    train_df[factor_cols] = train_df[factor_cols].fillna(0)
    test_df[factor_cols] = test_df[factor_cols].fillna(0)

    y_train = train_df["target"].values.astype(np.float64)
    y_test = test_df["target"].values.astype(np.float64)

    # Baseline: all factors
    X_train_all = np.nan_to_num(train_df[factor_cols].values.astype(np.float64),
                                nan=0.0, posinf=5.0, neginf=-5.0)
    X_test_all = np.nan_to_num(test_df[factor_cols].values.astype(np.float64),
                               nan=0.0, posinf=5.0, neginf=-5.0)

    model_base = xgb.XGBRegressor(**XGB_PARAMS)
    model_base.fit(X_train_all, y_train, eval_set=[(X_test_all, y_test)], verbose=False)
    pred_base = model_base.predict(X_test_all)
    ic_base, _ = spearmanr(pred_base, y_test)
    ic_base = float(ic_base) if not np.isnan(ic_base) else 0.0

    print(f"\nBaseline ({len(factor_cols)} factors): OOS IC = {ic_base:.4f}")
    print(f"\n{'Removed Factor':<25} {'OOS IC':>8} {'Delta IC':>10} {'Impact':>8}")
    print("-" * 55)

    results = {"baseline_ic": round(ic_base, 4), "ablations": {}}

    for factor in factor_cols:
        remaining = [f for f in factor_cols if f != factor]

        X_train_abl = np.nan_to_num(
            train_df[remaining].values.astype(np.float64),
            nan=0.0, posinf=5.0, neginf=-5.0)
        X_test_abl = np.nan_to_num(
            test_df[remaining].values.astype(np.float64),
            nan=0.0, posinf=5.0, neginf=-5.0)

        model_abl = xgb.XGBRegressor(**XGB_PARAMS)
        model_abl.fit(X_train_abl, y_train,
                      eval_set=[(X_test_abl, y_test[: len(X_test_abl)])],
                      verbose=False)
        pred_abl = model_abl.predict(X_test_abl)
        ic_abl, _ = spearmanr(pred_abl, y_test[:len(pred_abl)])
        ic_abl = float(ic_abl) if not np.isnan(ic_abl) else 0.0

        delta = ic_abl - ic_base
        impact = "HELPS" if delta < -0.01 else ("HURTS" if delta > 0.01 else "neutral")

        results["ablations"][factor] = {
            "ic_without": round(ic_abl, 4),
            "delta_ic": round(delta, 4),
            "impact": impact,
        }

        print(f"{factor:<25} {ic_abl:>+8.4f} {delta:>+10.4f} {impact:>8}")

    # Check H4: removing F4_BEI decreases model OOS IC
    h4_result = results["ablations"].get("F4_BEI", {})
    h4_pass = h4_result.get("delta_ic", 0) < 0
    print(f"\n  H4 (removing F4_BEI decreases IC): "
          f"delta={h4_result.get('delta_ic', 'N/A')}"
          f" → {'CONFIRMED ✓' if h4_pass else 'REJECTED ✗'}")

    return results


# ── Main: Run All Experiments ────────────────────────────────────────────────

def run_all_diagnostics():
    """Run all three diagnostic experiments and save results."""
    from fetch_data import fetch_all_data

    print("Fetching data...")
    raw = fetch_all_data()

    print("Building features...")
    features = build_features(raw)

    print(f"OOS period: {TRAIN_END} → {features.index.max()}")
    oos_count = (features.index > pd.Timestamp(TRAIN_END)).sum()
    print(f"OOS samples: {oos_count}")

    # Run experiments
    results_a = experiment_a(features)
    results_b = experiment_b(raw, features)
    results_c = experiment_c(features)

    # Save combined report
    report = {
        "timestamp": pd.Timestamp.now().isoformat(),
        "oos_start": TRAIN_END,
        "oos_samples": oos_count,
        "factors": get_factor_columns(),
        "experiment_a_multi_target": results_a,
        "experiment_b_multi_window": {
            str(k): v for k, v in results_b.items()
        },
        "experiment_c_ablation": results_c,
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / "ic_diagnostic.json"

    # Custom encoder to handle numpy types
    class NumpyEncoder(json.JSONEncoder):
        def default(self, obj):
            if isinstance(obj, (np.integer,)):
                return int(obj)
            if isinstance(obj, (np.floating,)):
                return float(obj)
            if isinstance(obj, np.ndarray):
                return obj.tolist()
            return super().default(obj)

    with open(out_path, "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False, cls=NumpyEncoder)

    print(f"\n{'=' * 70}")
    print(f"Diagnostic report saved to {out_path}")
    print(f"{'=' * 70}")

    return report


if __name__ == "__main__":
    run_all_diagnostics()
