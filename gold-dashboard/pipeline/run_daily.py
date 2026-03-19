#!/usr/bin/env python3
"""
One-click daily pipeline runner.
1. Fetch data from FRED + Stooq + Yahoo
2. Build features (9 factors, Z-Score)
3. Train model (if no model exists)
4. Run inference → signal, SHAP, regime, correlation
5. Run backtest → equity curve, positions, account
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


def main():
    start = time.time()
    print("=" * 60)
    print("  Gold Factor Trading Pipeline — Daily Run")
    print("=" * 60)

    # ── Step 1: Fetch data ────────────────────────────────────────────────────
    print("\n[1/5] Fetching data...")
    raw_data = fetch_all_data()

    # ── Step 2: Build features ────────────────────────────────────────────────
    print("\n[2/5] Building features...")
    features = build_features(raw_data)
    print(f"Features shape: {features.shape}")

    # ── Step 3: Train model (if needed) ───────────────────────────────────────
    if not MODEL_PATH.exists():
        print("\n[3/5] Training model (first run)...")
        train_model(features)
    else:
        print(f"\n[3/5] Model exists at {MODEL_PATH}, skipping training.")
        print("  (Delete model.json to force retrain)")

    # ── Step 4: Run inference ─────────────────────────────────────────────────
    print("\n[4/5] Running inference...")
    signal = run_inference(features)

    # ── Step 5: Run backtest ──────────────────────────────────────────────────
    print("\n[5/5] Running backtest...")
    run_backtest(features)

    elapsed = time.time() - start
    print(f"\n{'=' * 60}")
    print(f"  Pipeline complete in {elapsed:.1f}s")
    print(f"  Signal: {signal['signal']} ({signal['confidence']:.0f}% confidence)")
    print(f"  Output: {OUTPUT_DIR}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
