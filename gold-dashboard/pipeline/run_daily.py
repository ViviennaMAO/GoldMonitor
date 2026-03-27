#!/usr/bin/env python3
"""
One-click daily pipeline runner.
1. Fetch data from FRED + Stooq + Yahoo
2. Build features (13 factors: 7 base + 6 logical, Z-Score)
3. Train model (if no model exists)
4. Run inference → signal, SHAP, regime, correlation
5. Run backtest → equity curve, positions, account
6. Run stress tests → crisis period analysis
7. Run Granger causality → factor causal validation
"""
import sys
import time
from pathlib import Path

# Ensure pipeline directory is in path
sys.path.insert(0, str(Path(__file__).parent))

from config import MODEL_PATH, OUTPUT_DIR
from fetch_data import fetch_all_data
from features import build_features
from train import train_model
from inference import run_inference
from backtest import run_backtest
from stress_test import run_stress_tests
from granger_test import run_granger_analysis


def main():
    start = time.time()
    print("=" * 60)
    print("  Gold Factor Trading Pipeline — Daily Run")
    print("=" * 60)

    # ── Step 1: Fetch data ────────────────────────────────────────────────────
    print("\n[1/7] Fetching data...")
    raw_data = fetch_all_data()

    # ── Step 2: Build features ────────────────────────────────────────────────
    print("\n[2/7] Building features (13 factors: 7 base + 6 logical)...")
    features = build_features(raw_data)
    print(f"Features shape: {features.shape}")

    # ── Step 3: Train model (if needed) ───────────────────────────────────────
    if not MODEL_PATH.exists():
        print("\n[3/7] Training model (first run)...")
        train_model(features)
    else:
        print(f"\n[3/7] Model exists at {MODEL_PATH}, skipping training.")
        print("  (Delete model.json to force retrain)")

    # ── Step 4: Run inference ─────────────────────────────────────────────────
    print("\n[4/7] Running inference...")
    signal = run_inference(features)

    # ── Step 5: Run backtest ──────────────────────────────────────────────────
    print("\n[5/7] Running backtest...")
    run_backtest(features)

    # ── Step 6: Stress tests (P0) ────────────────────────────────────────────
    print("\n[6/7] Running stress tests on crisis periods...")
    try:
        stress = run_stress_tests(features)
        stress_summary = stress.get("summary", {}).get("overall_assessment", "N/A")
    except Exception as e:
        print(f"  Stress test error: {e}")
        stress_summary = "ERROR"

    # ── Step 7: Granger causality (P2) ───────────────────────────────────────
    print("\n[7/7] Running Granger causality analysis...")
    try:
        granger = run_granger_analysis(features)
        granger_pass = granger.get("summary", {}).get("pass_rate", 0)
    except Exception as e:
        print(f"  Granger analysis error: {e}")
        granger_pass = 0

    elapsed = time.time() - start
    print(f"\n{'=' * 60}")
    print(f"  Pipeline complete in {elapsed:.1f}s")
    print(f"  Signal: {signal['signal']} ({signal['confidence']:.0f}% confidence)")
    print(f"  Stress: {stress_summary}")
    print(f"  Granger Pass Rate: {granger_pass:.0f}%")
    print(f"  Output: {OUTPUT_DIR}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
