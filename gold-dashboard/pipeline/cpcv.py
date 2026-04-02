"""
Step 0: Combinatorial Purged Cross-Validation (CPCV)
Based on Marcos López de Prado's methodology from
"Advances in Financial Machine Learning" Chapter 12.

Generates C(N,k) backtest paths from N time blocks,
with purge gap to prevent look-ahead bias.
"""
import json
import itertools
import numpy as np
import pandas as pd
import xgboost as xgb
from scipy.stats import spearmanr, ttest_1samp
from config import (
    XGB_PARAMS, TRAIN_END, FORWARD_DAYS, OUTPUT_DIR, FACTOR_NAMES,
)
from features import get_factor_columns


class CombinatorialPurgedCV:
    """
    CPCV: Split data into N blocks, test all C(N, k) combinations
    where k blocks are held out for testing.
    Each block boundary has a purge_gap to prevent label leakage.
    """

    def __init__(self, n_blocks: int = 6, n_test_blocks: int = 2, purge_gap: int = 20):
        self.n_blocks = n_blocks
        self.n_test_blocks = n_test_blocks
        self.purge_gap = purge_gap

    def split(self, X):
        """
        Yields (train_indices, test_indices) for each combination.
        """
        n = len(X)
        block_size = n // self.n_blocks
        blocks = []

        for i in range(self.n_blocks):
            start = i * block_size
            end = start + block_size if i < self.n_blocks - 1 else n
            blocks.append(np.arange(start, end))

        # Generate all C(N, k) combinations of test blocks
        for test_block_ids in itertools.combinations(range(self.n_blocks), self.n_test_blocks):
            train_block_ids = [i for i in range(self.n_blocks) if i not in test_block_ids]

            # Build test indices
            test_idx = np.concatenate([blocks[i] for i in test_block_ids])

            # Build train indices with purge gap at block boundaries
            train_idx_list = []
            for bid in train_block_ids:
                block_indices = blocks[bid]

                # Check if this block is adjacent to any test block
                purged = block_indices.copy()

                for tid in test_block_ids:
                    # If train block is immediately before test block → purge tail
                    if bid == tid - 1:
                        purge_end = min(len(purged), len(purged))
                        purged = purged[:max(0, len(purged) - self.purge_gap)]
                    # If train block is immediately after test block → purge head
                    if bid == tid + 1:
                        purged = purged[min(self.purge_gap, len(purged)):]

                if len(purged) > 0:
                    train_idx_list.append(purged)

            if train_idx_list:
                train_idx = np.concatenate(train_idx_list)
                if len(train_idx) > 0 and len(test_idx) > 0:
                    yield train_idx, test_idx

    def get_n_splits(self):
        """Number of combinations."""
        from math import comb
        return comb(self.n_blocks, self.n_test_blocks)


def run_cpcv_validation(features_df: pd.DataFrame) -> dict:
    """
    Run CPCV validation on training data to verify alpha existence.

    Returns a report with:
    - path_sharpes: Sharpe ratio for each of the C(N,k) paths
    - path_ics: Spearman IC for each path
    - median_sharpe: Median Sharpe across all paths
    - p_value: t-test p-value for H0: median Sharpe = 0
    - alpha_confirmed: True if median Sharpe > 0 and p < 0.05
    - worst_path_sharpe: Conservative baseline for future optimization
    """
    factor_cols = get_factor_columns()

    # Use training data only
    train_mask = features_df.index <= pd.Timestamp(TRAIN_END)
    train_df = features_df[train_mask].dropna(subset=["target"]).copy()
    train_df[factor_cols] = train_df[factor_cols].fillna(0)

    X_all = np.nan_to_num(
        train_df[factor_cols].values.astype(np.float64),
        nan=0.0, posinf=5.0, neginf=-5.0
    )
    y_all = train_df["target"].values.astype(np.float64)
    prices = train_df["gold_price"].values if "gold_price" in train_df.columns else None

    # CPCV: N=6 blocks, k=2 test blocks → C(6,2) = 15 paths
    cpcv = CombinatorialPurgedCV(n_blocks=6, n_test_blocks=2, purge_gap=FORWARD_DAYS)
    n_paths = cpcv.get_n_splits()

    print(f"\n{'='*60}")
    print(f"CPCV Validation: {n_paths} paths (N=6, k=2, purge={FORWARD_DAYS}d)")
    print(f"Training data: {len(X_all)} samples")
    print(f"{'='*60}")

    path_sharpes = []
    path_ics = []
    path_details = []

    for path_id, (tr_idx, te_idx) in enumerate(cpcv.split(X_all)):
        # Train model on this path's training set
        model = xgb.XGBRegressor(**XGB_PARAMS)
        model.fit(X_all[tr_idx], y_all[tr_idx], verbose=False)

        # Predict on test set
        pred = model.predict(X_all[te_idx])
        actual = y_all[te_idx]

        # Spearman IC
        ic, ic_pval = spearmanr(pred, actual)
        if np.isnan(ic):
            ic = 0.0

        # Simulated Sharpe on this path
        # Use predicted returns as signal → simple long/short strategy
        daily_returns = []
        for j in range(len(pred)):
            # Long if pred > 0, short if pred < 0, scaled by prediction magnitude
            signal_dir = np.sign(pred[j])
            # Actual daily return proxy: target / FORWARD_DAYS (rough annualization)
            daily_r = signal_dir * actual[j] / FORWARD_DAYS
            daily_returns.append(daily_r)

        daily_returns = np.array(daily_returns)
        mean_r = np.mean(daily_returns)
        std_r = np.std(daily_returns)
        sharpe = (mean_r / std_r) * np.sqrt(252) if std_r > 0 else 0.0

        path_sharpes.append(sharpe)
        path_ics.append(ic)
        path_details.append({
            "path_id": path_id + 1,
            "train_samples": len(tr_idx),
            "test_samples": len(te_idx),
            "ic": round(float(ic), 4),
            "ic_pval": round(float(ic_pval), 4) if not np.isnan(ic_pval) else 1.0,
            "sharpe": round(float(sharpe), 4),
        })

        status = "✓" if sharpe > 0 else "✗"
        print(f"  Path {path_id+1:2d}/{n_paths}: "
              f"IC={ic:+.4f} Sharpe={sharpe:+.4f} "
              f"[train={len(tr_idx)}, test={len(te_idx)}] {status}")

    # ── Aggregate results ────────────────────────────────────────────────────
    path_sharpes = np.array(path_sharpes)
    path_ics = np.array(path_ics)

    median_sharpe = float(np.median(path_sharpes))
    mean_sharpe = float(np.mean(path_sharpes))
    worst_sharpe = float(np.min(path_sharpes))
    best_sharpe = float(np.max(path_sharpes))
    positive_pct = float(np.mean(path_sharpes > 0) * 100)

    median_ic = float(np.median(path_ics))
    mean_ic = float(np.mean(path_ics))

    # t-test: H0: mean Sharpe = 0
    if len(path_sharpes) > 1 and np.std(path_sharpes) > 0:
        t_stat, p_value = ttest_1samp(path_sharpes, 0)
        p_value = float(p_value)
        t_stat = float(t_stat)
    else:
        t_stat, p_value = 0.0, 1.0

    # Alpha confirmation criteria
    alpha_confirmed = median_sharpe > 0 and p_value < 0.05

    print(f"\n{'─'*60}")
    print(f"CPCV Results Summary:")
    print(f"  Median Sharpe: {median_sharpe:+.4f}")
    print(f"  Mean Sharpe:   {mean_sharpe:+.4f}")
    print(f"  Worst Path:    {worst_sharpe:+.4f}")
    print(f"  Best Path:     {best_sharpe:+.4f}")
    print(f"  Positive Rate: {positive_pct:.1f}%")
    print(f"  t-stat:        {t_stat:.4f}")
    print(f"  p-value:       {p_value:.4f}")
    print(f"  Median IC:     {median_ic:+.4f}")
    print(f"  Mean IC:       {mean_ic:+.4f}")
    print(f"{'─'*60}")

    if alpha_confirmed:
        print(f"  ✅ ALPHA CONFIRMED: median Sharpe > 0, p = {p_value:.4f} < 0.05")
        print(f"     Baseline for optimization: worst path Sharpe = {worst_sharpe:+.4f}")
    elif median_sharpe > 0:
        print(f"  ⚠️  ALPHA POSSIBLE BUT NOT SIGNIFICANT: p = {p_value:.4f} > 0.05")
        print(f"     Proceed with caution. Consider more data or factor research.")
    else:
        print(f"  ❌ ALPHA NOT CONFIRMED: median Sharpe ≤ 0")
        print(f"     STOP all optimization. Return to factor research.")

    # ── Build report ─────────────────────────────────────────────────────────
    report = {
        "timestamp": pd.Timestamp.now().isoformat(),
        "method": "Combinatorial Purged Cross-Validation",
        "parameters": {
            "n_blocks": 6,
            "n_test_blocks": 2,
            "n_paths": n_paths,
            "purge_gap": FORWARD_DAYS,
            "total_train_samples": len(X_all),
        },
        "results": {
            "median_sharpe": round(median_sharpe, 4),
            "mean_sharpe": round(mean_sharpe, 4),
            "worst_path_sharpe": round(worst_sharpe, 4),
            "best_path_sharpe": round(best_sharpe, 4),
            "positive_rate_pct": round(positive_pct, 1),
            "t_statistic": round(t_stat, 4),
            "p_value": round(p_value, 4),
            "median_ic": round(median_ic, 4),
            "mean_ic": round(mean_ic, 4),
        },
        "conclusion": {
            "alpha_confirmed": alpha_confirmed,
            "confidence_level": "high" if p_value < 0.01 else "moderate" if p_value < 0.05 else "low",
            "recommendation": (
                "PROCEED with optimization" if alpha_confirmed
                else "PROCEED WITH CAUTION" if median_sharpe > 0
                else "STOP — return to factor research"
            ),
            "baseline_sharpe": round(worst_sharpe, 4),
        },
        "paths": path_details,
    }

    # Save report
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / "cpcv_validation.json"
    with open(out_path, "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nCPCV report saved to {out_path}")

    return report


if __name__ == "__main__":
    from fetch_data import fetch_all_data
    from features import build_features

    raw = fetch_all_data()
    feat = build_features(raw)
    report = run_cpcv_validation(feat)
