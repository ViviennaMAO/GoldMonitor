"""
Backtesting module — simulates trading from 2023+ with ATR-based position sizing
and three-tier risk management.
"""
import json
import numpy as np
import pandas as pd
import xgboost as xgb
from config import (
    MODEL_PATH, OUTPUT_DIR, TRAIN_END, SIGNAL_THRESHOLDS,
    ATR_STOP_MULT, RISK_BUDGET, FACTOR_NAMES,
    REGIME_HEALTHY, REGIME_CAUTION, REGIME_CIRCUIT_BREAK,
)
from features import get_factor_columns
from inference import classify_signal, detect_regime


def run_backtest(features_df: pd.DataFrame, initial_equity: float = 100000.0):
    """
    Run day-by-day backtest from 2023+ with ATR stops and regime-based sizing.
    """
    factor_cols = get_factor_columns()

    # Load model
    model = xgb.XGBRegressor()
    model.load_model(str(MODEL_PATH))

    # Test period
    test_df = features_df[features_df.index > pd.Timestamp(TRAIN_END)].copy()
    test_df = test_df.dropna(subset=["gold_price"])
    test_df[factor_cols] = test_df[factor_cols].fillna(0)

    if test_df.empty:
        print("No test data available!")
        return

    print(f"Backtesting: {test_df.index.min()} → {test_df.index.max()} ({len(test_df)} days)")

    # ── State ─────────────────────────────────────────────────────────────────
    equity = initial_equity
    peak_equity = initial_equity
    position = 0.0          # in oz
    entry_price = 0.0
    stop_price = 0.0
    position_dir = 0        # 1 = long, -1 = short, 0 = flat

    equity_curve = []
    trades = []
    positions_log = []

    for i in range(len(test_df)):
        row = test_df.iloc[i]
        date = test_df.index[i]
        price = float(row.get("gold_price", 0))
        atr = float(row.get("ATR", 50))

        if price <= 0 or np.isnan(price):
            continue

        # ── Check stop-loss ───────────────────────────────────────────────────
        if position_dir != 0:
            stopped = False
            if position_dir == 1 and price <= stop_price:
                stopped = True
            elif position_dir == -1 and price >= stop_price:
                stopped = True

            if stopped:
                pnl = position * (price - entry_price) * position_dir
                equity += pnl
                trades.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "type": "stop_loss",
                    "direction": "Long" if position_dir == 1 else "Short",
                    "entry": round(entry_price, 2),
                    "exit": round(price, 2),
                    "pnl": round(pnl, 2),
                    "return_pct": round(pnl / initial_equity * 100, 4),
                })
                position = 0
                position_dir = 0
                entry_price = 0
                stop_price = 0

        # ── Generate signal ───────────────────────────────────────────────────
        X = np.nan_to_num(
            row[factor_cols].values.reshape(1, -1).astype(np.float64),
            nan=0.0, posinf=5.0, neginf=-5.0
        )
        pred_return = float(model.predict(X)[0])
        signal = classify_signal(pred_return)

        # ── Regime detection ──────────────────────────────────────────────────
        regime_info = detect_regime(dict(row[factor_cols]))
        regime_mult = regime_info["multiplier"]

        # ── Three-tier risk check ─────────────────────────────────────────────
        drawdown = (peak_equity - equity) / peak_equity if peak_equity > 0 else 0
        if drawdown > 0.15:
            regime_mult = REGIME_CIRCUIT_BREAK  # Circuit break: no trading
        elif drawdown > 0.08:
            regime_mult = min(regime_mult, REGIME_CAUTION)  # Reduce size

        # ── Position sizing ───────────────────────────────────────────────────
        stop_distance = atr * ATR_STOP_MULT
        risk_amount = equity * RISK_BUDGET
        target_size = (risk_amount / stop_distance) * regime_mult if stop_distance > 0 else 0

        # ── Execute trades ────────────────────────────────────────────────────
        if signal in ("Strong Buy", "Buy") and position_dir <= 0:
            # Close short if any
            if position_dir == -1:
                pnl = position * (entry_price - price)
                equity += pnl
                trades.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "type": "close_short",
                    "direction": "Short",
                    "entry": round(entry_price, 2),
                    "exit": round(price, 2),
                    "pnl": round(pnl, 2),
                    "return_pct": round(pnl / initial_equity * 100, 4),
                })

            # Open long
            if regime_mult > 0:
                position = target_size
                entry_price = price
                stop_price = price - stop_distance
                position_dir = 1

        elif signal in ("Strong Sell", "Sell") and position_dir >= 0:
            # Close long if any
            if position_dir == 1:
                pnl = position * (price - entry_price)
                equity += pnl
                trades.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "type": "close_long",
                    "direction": "Long",
                    "entry": round(entry_price, 2),
                    "exit": round(price, 2),
                    "pnl": round(pnl, 2),
                    "return_pct": round(pnl / initial_equity * 100, 4),
                })

            # Open short
            if regime_mult > 0:
                position = target_size
                entry_price = price
                stop_price = price + stop_distance
                position_dir = -1

        elif signal == "Neutral" and position_dir != 0:
            # Close position on neutral signal
            pnl = position * (price - entry_price) * position_dir
            equity += pnl
            trades.append({
                "date": date.strftime("%Y-%m-%d"),
                "type": "close_neutral",
                "direction": "Long" if position_dir == 1 else "Short",
                "entry": round(entry_price, 2),
                "exit": round(price, 2),
                "pnl": round(pnl, 2),
                "return_pct": round(pnl / initial_equity * 100, 4),
            })
            position = 0
            position_dir = 0
            entry_price = 0
            stop_price = 0

        # Update peak
        peak_equity = max(peak_equity, equity)

        # ── Log equity curve ──────────────────────────────────────────────────
        unrealized = 0
        if position_dir != 0:
            unrealized = position * (price - entry_price) * position_dir

        # GLD benchmark: buy-and-hold from start
        first_price = float(test_df.iloc[0].get("gold_price", price))
        gld_equity = round(initial_equity * (price / first_price), 2) if first_price > 0 else initial_equity

        equity_curve.append({
            "date": date.strftime("%Y-%m-%d"),
            "equity": round(equity + unrealized, 2),
            "gld": gld_equity,
            "drawdown": round((peak_equity - equity) / peak_equity * 100, 2),
            "gold_price": round(price, 2),
        })

    # ── Compute statistics ────────────────────────────────────────────────────
    total_return = (equity - initial_equity) / initial_equity * 100
    n_trades = len(trades)
    winners = [t for t in trades if t["pnl"] > 0]
    losers = [t for t in trades if t["pnl"] < 0]
    win_rate = len(winners) / n_trades * 100 if n_trades > 0 else 0

    max_dd = max((e["drawdown"] for e in equity_curve), default=0)

    # Sharpe ratio (annualized)
    daily_returns = []
    for i in range(1, len(equity_curve)):
        prev = equity_curve[i-1]["equity"]
        curr = equity_curve[i]["equity"]
        if prev > 0:
            daily_returns.append((curr - prev) / prev)

    sharpe = 0
    if daily_returns:
        mean_r = np.mean(daily_returns)
        std_r = np.std(daily_returns)
        sharpe = (mean_r / std_r) * np.sqrt(252) if std_r > 0 else 0

    account = {
        "initial_equity": initial_equity,
        "final_equity": round(equity, 2),
        "total_return": round(total_return, 2),
        "total_trades": n_trades,
        "win_rate": round(win_rate, 1),
        "winners": len(winners),
        "losers": len(losers),
        "max_drawdown": round(max_dd, 2),
        "sharpe_ratio": round(sharpe, 4),
        "avg_win": round(np.mean([t["pnl"] for t in winners]), 2) if winners else 0,
        "avg_loss": round(np.mean([t["pnl"] for t in losers]), 2) if losers else 0,
    }

    # Current position info
    positions_data = []
    if position_dir != 0:
        current_price = float(test_df.iloc[-1].get("gold_price", 0))
        unrealized_pnl = position * (current_price - entry_price) * position_dir
        positions_data.append({
            "symbol": "XAUUSD",
            "direction": "Long" if position_dir == 1 else "Short",
            "size": round(position, 4),
            "entry_price": round(entry_price, 2),
            "current_price": round(current_price, 2),
            "stop_loss": round(stop_price, 2),
            "unrealized_pnl": round(unrealized_pnl, 2),
            "return_pct": round(unrealized_pnl / equity * 100, 2),
        })

    # ── Save outputs ──────────────────────────────────────────────────────────
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    outputs = {
        "equity_curve.json": equity_curve,
        "positions.json": {"active": positions_data, "recent_trades": trades[-20:]},
        "account.json": account,
    }

    for filename, data in outputs.items():
        path = OUTPUT_DIR / filename
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
        print(f"Saved {path}")

    print(f"\n── Backtest Results ──")
    print(f"Total Return: {total_return:.2f}%")
    print(f"Trades: {n_trades} (Win Rate: {win_rate:.1f}%)")
    print(f"Max Drawdown: {max_dd:.2f}%")
    print(f"Sharpe Ratio: {sharpe:.4f}")
    print(f"Final Equity: ${equity:,.2f}")

    return account


if __name__ == "__main__":
    from fetch_data import fetch_all_data
    from features import build_features

    raw = fetch_all_data()
    feat = build_features(raw)
    run_backtest(feat)
