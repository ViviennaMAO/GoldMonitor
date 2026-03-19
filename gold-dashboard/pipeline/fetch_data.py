"""
Data fetching module — pulls factor data from FRED, Stooq, and Yahoo Finance.
Outputs a merged DataFrame with daily OHLCV + macro data, date-aligned.
"""
import io
import pandas as pd
import numpy as np
import requests
from datetime import datetime, timedelta
from config import FRED_API_KEY, FRED_SERIES, STOOQ_SYMBOLS, DATA_START

# ── FRED API ──────────────────────────────────────────────────────────────────

def fetch_fred_series(series_id: str, start: str = DATA_START) -> pd.Series:
    """Fetch a single FRED series as a pandas Series indexed by date."""
    url = "https://api.stlouisfed.org/fred/series/observations"
    params = {
        "series_id": series_id,
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "observation_start": start,
        "sort_order": "asc",
    }
    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()["observations"]

    dates, values = [], []
    for obs in data:
        if obs["value"] == ".":
            continue
        dates.append(pd.Timestamp(obs["date"]))
        values.append(float(obs["value"]))

    return pd.Series(values, index=pd.DatetimeIndex(dates), name=series_id)


def fetch_all_fred() -> pd.DataFrame:
    """Fetch all FRED macro series and merge into a DataFrame."""
    frames = {}
    for name, series_id in FRED_SERIES.items():
        try:
            s = fetch_fred_series(series_id)
            frames[name] = s
            print(f"  FRED {name} ({series_id}): {len(s)} obs")
        except Exception as e:
            print(f"  FRED {name} ({series_id}): FAILED — {e}")

    if not frames:
        return pd.DataFrame()

    df = pd.DataFrame(frames)
    df.index.name = "date"
    return df


# ── Stooq CSV API ─────────────────────────────────────────────────────────────

def fetch_stooq(symbol: str, stooq_symbol: str) -> pd.DataFrame:
    """Fetch historical OHLCV from Stooq CSV endpoint."""
    url = f"https://stooq.com/q/d/l/?s={stooq_symbol}&i=d"
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible)",
        "Accept": "text/csv",
    }
    resp = requests.get(url, headers=headers, timeout=15)
    if resp.status_code != 200 or "No data" in resp.text:
        return pd.DataFrame()

    df = pd.read_csv(io.StringIO(resp.text))
    if df.empty or "Date" not in df.columns:
        return pd.DataFrame()

    df["Date"] = pd.to_datetime(df["Date"])
    df = df.set_index("Date").sort_index()

    # Rename columns with symbol prefix
    rename = {}
    for col in ["Open", "High", "Low", "Close", "Volume"]:
        if col in df.columns:
            rename[col] = f"{symbol}_{col.lower()}"
    df = df.rename(columns=rename)

    return df


def fetch_all_stooq() -> pd.DataFrame:
    """Fetch all Stooq series and merge."""
    frames = []
    for symbol, stooq_sym in STOOQ_SYMBOLS.items():
        try:
            df = fetch_stooq(symbol, stooq_sym)
            if not df.empty:
                frames.append(df)
                print(f"  Stooq {symbol}: {len(df)} bars")
            else:
                print(f"  Stooq {symbol}: no data")
        except Exception as e:
            print(f"  Stooq {symbol}: FAILED — {e}")

    if not frames:
        return pd.DataFrame()

    merged = frames[0]
    for f in frames[1:]:
        merged = merged.join(f, how="outer")

    merged.index.name = "date"
    return merged


# ── Yahoo Finance (GVZ, OVX) ──────────────────────────────────────────────────

def fetch_yahoo_history(symbol: str, days: int = 2800) -> pd.DataFrame:
    """Fetch daily history from Yahoo Finance v8 chart API."""
    period2 = int(datetime.now().timestamp())
    period1 = int((datetime.now() - timedelta(days=days)).timestamp())

    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
    params = {
        "interval": "1d",
        "period1": period1,
        "period2": period2,
    }
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/120.0.0.0 Safari/537.36",
    }

    resp = requests.get(url, params=params, headers=headers, timeout=10)
    if resp.status_code != 200:
        return pd.DataFrame()

    data = resp.json()
    result = data.get("chart", {}).get("result", [])
    if not result:
        return pd.DataFrame()

    r = result[0]
    timestamps = r.get("timestamp", [])
    quote = r.get("indicators", {}).get("quote", [{}])[0]
    closes = quote.get("close", [])

    if not timestamps or not closes:
        return pd.DataFrame()

    dates = [datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d") for ts in timestamps]
    df = pd.DataFrame({
        f"{symbol}_close": closes,
    }, index=pd.DatetimeIndex(pd.to_datetime(dates)))

    df = df.dropna()
    df.index.name = "date"
    return df


def fetch_yahoo_volatility() -> pd.DataFrame:
    """Fetch GVZ and OVX from Yahoo Finance."""
    frames = []
    for symbol in ["^GVZ", "^OVX"]:
        try:
            df = fetch_yahoo_history(symbol)
            if not df.empty:
                # Clean column name
                clean_name = symbol.replace("^", "") + "_close"
                df.columns = [clean_name]
                frames.append(df)
                print(f"  Yahoo {symbol}: {len(df)} bars")
            else:
                print(f"  Yahoo {symbol}: no data")
        except Exception as e:
            print(f"  Yahoo {symbol}: FAILED — {e}")

    if not frames:
        return pd.DataFrame()

    merged = frames[0]
    for f in frames[1:]:
        merged = merged.join(f, how="outer")
    return merged


# ── Master Data Assembly ──────────────────────────────────────────────────────

def fetch_all_data() -> pd.DataFrame:
    """
    Fetch all data sources and merge into a single DataFrame.
    Columns: DXY, FED_FUNDS, TIPS_10Y, BEI, GVZ_close, OVX_close,
             XAUUSD_close/open/high/low/volume, GLD_close/volume,
             IAU_close/volume, GDX_close/volume, GDXJ_close/volume
    """
    print("Fetching FRED macro data...")
    fred_df = fetch_all_fred()

    print("Fetching Stooq price data...")
    stooq_df = fetch_all_stooq()

    print("Fetching Yahoo volatility indices...")
    yahoo_df = fetch_yahoo_volatility()

    # Merge all sources on date
    frames = [f for f in [fred_df, stooq_df, yahoo_df] if not f.empty]
    if not frames:
        raise RuntimeError("No data fetched from any source!")

    merged = frames[0]
    for f in frames[1:]:
        merged = merged.join(f, how="outer")

    # Filter from DATA_START
    merged = merged[merged.index >= pd.Timestamp(DATA_START)]

    # Forward-fill macro data (FRED publishes weekly/monthly)
    if "DXY" in merged.columns:
        merged["DXY"] = merged["DXY"].ffill()
    if "FED_FUNDS" in merged.columns:
        merged["FED_FUNDS"] = merged["FED_FUNDS"].ffill()
    if "TIPS_10Y" in merged.columns:
        merged["TIPS_10Y"] = merged["TIPS_10Y"].ffill()
    if "BEI" in merged.columns:
        merged["BEI"] = merged["BEI"].ffill()

    # Drop rows where gold price is missing
    if "XAUUSD_close" in merged.columns:
        merged = merged.dropna(subset=["XAUUSD_close"])

    print(f"\nMerged dataset: {len(merged)} rows, {len(merged.columns)} columns")
    print(f"Date range: {merged.index.min()} → {merged.index.max()}")

    return merged


if __name__ == "__main__":
    df = fetch_all_data()
    print("\nColumns:", list(df.columns))
    print("\nLatest row:")
    print(df.tail(1).T)
