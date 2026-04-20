"""
Data fetching module — pulls factor data from FRED, Stooq, and Yahoo Finance.
Outputs a merged DataFrame with daily OHLCV + macro data, date-aligned.
"""
import io
import pandas as pd
import numpy as np
import requests
from datetime import datetime, timedelta
from pathlib import Path
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


def _fetch_xauusd_akshare() -> pd.DataFrame:
    """
    Fallback: fetch XAUUSD by converting Shanghai gold futures (AU0, RMB/gram)
    to USD/oz using FRED USDCNY exchange rate. Requires akshare.
    """
    try:
        import akshare as ak
    except ImportError:
        return pd.DataFrame()

    # Shanghai gold futures (continuous contract)
    au = ak.futures_zh_daily_sina(symbol="AU0")
    au["date"] = pd.to_datetime(au["date"])
    au = au.set_index("date").sort_index()
    au = au[au.index >= pd.Timestamp(DATA_START)]

    # USDCNY exchange rate from FRED
    usdcny = fetch_fred_series("DEXCHUS")

    merged = pd.DataFrame({"au_close": au["close"].astype(float),
                            "au_open": au["open"].astype(float),
                            "au_high": au["high"].astype(float),
                            "au_low": au["low"].astype(float),
                            "usdcny": usdcny})
    merged = merged.ffill().dropna()

    # Convert: RMB/gram → USD/troy oz (1 oz = 31.1035 g)
    oz = 31.1035
    result = pd.DataFrame({
        "XAUUSD_close": merged["au_close"] * oz / merged["usdcny"],
        "XAUUSD_open":  merged["au_open"]  * oz / merged["usdcny"],
        "XAUUSD_high":  merged["au_high"]  * oz / merged["usdcny"],
        "XAUUSD_low":   merged["au_low"]   * oz / merged["usdcny"],
    })
    result.index.name = "date"
    return result


def _fetch_us_etf_akshare(symbol: str) -> pd.DataFrame:
    """
    Fallback: fetch US ETF daily OHLCV (GDX/GLD/IAU/GDXJ) via AKShare.
    Used when Stooq and Yahoo are both unavailable.
    """
    try:
        import akshare as ak
    except ImportError:
        return pd.DataFrame()

    df = ak.stock_us_daily(symbol=symbol, adjust="")
    if df.empty or "date" not in df.columns:
        return pd.DataFrame()

    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()
    df = df[df.index >= pd.Timestamp(DATA_START)]

    # Rename to match expected format: {symbol}_{col}
    rename = {}
    for col in ["open", "high", "low", "close", "volume"]:
        if col in df.columns:
            rename[col] = f"{symbol}_{col}"
    df = df.rename(columns=rename)

    # Keep only the standardized columns
    keep_cols = [c for c in df.columns if c.startswith(f"{symbol}_")]
    df = df[keep_cols].copy()
    df.index.name = "date"
    return df


def fetch_all_stooq() -> pd.DataFrame:
    """Fetch all Stooq series and merge. Falls back to Yahoo Finance if Stooq is rate-limited."""
    # Yahoo Finance symbol mapping for fallback
    YAHOO_FALLBACK = {
        "XAUUSD": "GC=F",
        "GLD": "GLD",
        "IAU": "IAU",
        "GDX": "GDX",
        "GDXJ": "GDXJ",
    }

    frames = []
    for symbol, stooq_sym in STOOQ_SYMBOLS.items():
        df = pd.DataFrame()
        try:
            df = fetch_stooq(symbol, stooq_sym)
            if not df.empty:
                frames.append(df)
                print(f"  Stooq {symbol}: {len(df)} bars")
                continue
        except Exception as e:
            print(f"  Stooq {symbol}: FAILED — {e}")

        # Fallback to Yahoo Finance
        yahoo_sym = YAHOO_FALLBACK.get(symbol)
        if yahoo_sym and df.empty:
            try:
                yf_df = fetch_yahoo_history(yahoo_sym, days=4000, ohlcv=True)
                if not yf_df.empty:
                    # Rename columns to match expected format
                    rename = {}
                    clean = yahoo_sym.replace("^", "").replace("=", "")
                    for col_type in ["open", "high", "low", "close", "volume"]:
                        src = f"{clean}_{col_type}"
                        dst = f"{symbol}_{col_type}"
                        if src in yf_df.columns:
                            rename[src] = dst
                    yf_df = yf_df.rename(columns=rename)
                    frames.append(yf_df)
                    print(f"  Yahoo {symbol} (fallback): {len(yf_df)} bars")
                    continue
            except Exception as e2:
                print(f"  Yahoo {symbol} fallback: FAILED — {e2}")

        # Fallback to AKShare — XAUUSD (via AU0 conversion) or US ETFs
        if df.empty:
            try:
                if symbol == "XAUUSD":
                    ak_df = _fetch_xauusd_akshare()
                else:
                    # GLD, IAU, GDX, GDXJ are all available on AKShare
                    ak_df = _fetch_us_etf_akshare(symbol)
                if not ak_df.empty:
                    frames.append(ak_df)
                    print(f"  AKShare {symbol} (fallback): {len(ak_df)} bars")
                    continue
            except Exception as e3:
                print(f"  AKShare {symbol} fallback: FAILED — {e3}")

        if df.empty:
            print(f"  {symbol}: no data from any source")

    if not frames:
        return pd.DataFrame()

    merged = frames[0]
    for f in frames[1:]:
        merged = merged.join(f, how="outer")

    merged.index.name = "date"
    return merged


# ── Yahoo Finance (GVZ, OVX) ──────────────────────────────────────────────────

def fetch_yahoo_history(symbol: str, days: int = 2800, ohlcv: bool = False) -> pd.DataFrame:
    """Fetch daily history from Yahoo Finance v8 chart API."""
    period2 = int(datetime.now().timestamp())
    period1 = int((datetime.now() - timedelta(days=days)).timestamp())

    params = {
        "interval": "1d",
        "period1": period1,
        "period2": period2,
    }
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
    }

    # Try query2 first (more reliable), then query1
    resp = None
    for host in ["query2", "query1"]:
        url = f"https://{host}.finance.yahoo.com/v8/finance/chart/{symbol}"
        try:
            resp = requests.get(url, params=params, headers=headers, timeout=15)
            if resp.status_code == 200:
                break
        except Exception:
            continue

    if resp is None or resp.status_code != 200:
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
    clean_sym = symbol.replace("^", "").replace("=", "")

    if ohlcv:
        df = pd.DataFrame({
            f"{clean_sym}_open": quote.get("open", [None] * len(closes)),
            f"{clean_sym}_high": quote.get("high", [None] * len(closes)),
            f"{clean_sym}_low": quote.get("low", [None] * len(closes)),
            f"{clean_sym}_close": closes,
            f"{clean_sym}_volume": quote.get("volume", [None] * len(closes)),
        }, index=pd.DatetimeIndex(pd.to_datetime(dates)))
    else:
        df = pd.DataFrame({
            f"{clean_sym}_close": closes,
        }, index=pd.DatetimeIndex(pd.to_datetime(dates)))

    df = df.dropna(subset=[f"{clean_sym}_close"])
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


def compute_gvz_proxy(gold_close: pd.Series) -> pd.Series:
    """
    Construct a GVZ proxy from gold realized volatility when CBOE GVZ is unavailable.

    GVZ = CBOE Gold Volatility Index = 30-day implied vol of GLD options.
    Proxy = 22-day annualized realized volatility of gold returns, scaled by
    the historical IV/RV ratio (~1.15) to approximate implied-vol levels.

    This is standard practice: IV and RV are highly correlated (ρ ≈ 0.85 on GVZ)
    so the proxy preserves the factor's time-series information content.
    """
    import numpy as np
    log_ret = np.log(gold_close / gold_close.shift(1))
    # 22-day rolling std, annualized (√252)
    rv_22d = log_ret.rolling(22, min_periods=10).std() * np.sqrt(252) * 100
    # Scale by typical IV/RV ratio (~1.15) so levels match real GVZ (~15-30)
    gvz_proxy = rv_22d * 1.15
    return gvz_proxy


# ── Master Data Assembly ──────────────────────────────────────────────────────

CACHE_PATH = Path(__file__).parent / "data_cache.pkl"


def fetch_all_data(use_cache: bool = True) -> pd.DataFrame:
    """
    Fetch all data sources and merge into a single DataFrame.
    With data caching: saves to .pkl on success, loads from cache on failure.
    """
    # Try fetching fresh data
    try:
        merged = _fetch_all_data_impl()
        # Cache on success
        merged.to_pickle(str(CACHE_PATH))
        print(f"  Data cached to {CACHE_PATH}")
        return merged
    except Exception as e:
        if use_cache and CACHE_PATH.exists():
            print(f"\n⚠️  Live fetch failed ({e}), loading cached data...")
            merged = pd.read_pickle(str(CACHE_PATH))
            print(f"  Loaded cache: {len(merged)} rows, {merged.index.min()} → {merged.index.max()}")
            return merged
        raise


def _fetch_all_data_impl() -> pd.DataFrame:
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
    if "TIPS_10Y" in merged.columns:
        merged["TIPS_10Y"] = merged["TIPS_10Y"].ffill()
    if "BEI" in merged.columns:
        merged["BEI"] = merged["BEI"].ffill()
    if "GPR" in merged.columns:
        merged["GPR"] = merged["GPR"].ffill()
    if "DGS2" in merged.columns:
        merged["DGS2"] = merged["DGS2"].ffill()
    if "T5YIFR" in merged.columns:
        merged["T5YIFR"] = merged["T5YIFR"].ffill()
    if "CPIAUCSL" in merged.columns:
        merged["CPIAUCSL"] = merged["CPIAUCSL"].ffill()  # monthly → daily ffill
    # Drop rows where gold price is missing
    if "XAUUSD_close" in merged.columns:
        merged = merged.dropna(subset=["XAUUSD_close"])

    # Require gold price data — if missing, data is incomplete
    if "XAUUSD_close" not in merged.columns or merged.empty:
        raise RuntimeError("No gold price data — cannot proceed without XAUUSD")

    # Fill missing GVZ values with realized-volatility proxy.
    # CBOE GVZ starts ~2018 on Yahoo; for pre-2018 history we use the proxy
    # to avoid 30% NaN rate that kills rolling z-score and factor IC.
    gvz_proxy = compute_gvz_proxy(merged["XAUUSD_close"])
    if "GVZ_close" not in merged.columns or merged["GVZ_close"].isna().all():
        merged["GVZ_close"] = gvz_proxy
        print(f"  GVZ fully synthesized from realized vol "
              f"(last={merged['GVZ_close'].dropna().iloc[-1]:.2f})")
    else:
        n_missing = int(merged["GVZ_close"].isna().sum())
        if n_missing > 0:
            merged["GVZ_close"] = merged["GVZ_close"].fillna(gvz_proxy)
            print(f"  GVZ proxy filled {n_missing} missing rows "
                  f"(last={merged['GVZ_close'].dropna().iloc[-1]:.2f})")

    print(f"\nMerged dataset: {len(merged)} rows, {len(merged.columns)} columns")
    print(f"Date range: {merged.index.min()} → {merged.index.max()}")

    return merged


if __name__ == "__main__":
    df = fetch_all_data()
    print("\nColumns:", list(df.columns))
    print("\nLatest row:")
    print(df.tail(1).T)
