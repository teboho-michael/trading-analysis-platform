"""
Read-only MT5 candle sync bridge for the permanent Windows VPS runtime.

Configuration comes from environment variables or an optional local JSON file
named mt5_bridge.local.json beside this script. The local file is ignored by Git.
No order-management APIs are used here.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
from statistics import median
import sys
import time
from urllib import error, request

import MetaTrader5 as mt5


BASE_DIR = Path(__file__).resolve().parent
LOCAL_CONFIG_FILE = BASE_DIR / "mt5_bridge.local.json"
STATE_FILE = Path(os.getenv("MT5_BRIDGE_STATE_FILE", BASE_DIR / "mt5_bridge_state.json"))
DEFAULT_SYMBOLS = ["BTCUSD", "XAUUSD", "USDJPY", "US500", "US100"]
DEFAULT_TIMEFRAMES = ["D1", "H4", "H1"]
DEFAULT_CANDLE_LIMIT = 500

SYMBOL_MAP = {
    "BTCUSD": ["BTCUSD"],
    "XAUUSD": ["GOLDmicro"],
    "USDJPY": ["USDJPY"],
    "US500": ["US500Cash"],
    "US100": ["US100Cash"],
}

TIMEFRAMES = {
    "D1": mt5.TIMEFRAME_D1,
    "H4": mt5.TIMEFRAME_H4,
    "H1": mt5.TIMEFRAME_H1,
}


def load_local_config() -> dict:
    if not LOCAL_CONFIG_FILE.exists():
        return {}
    with LOCAL_CONFIG_FILE.open("r", encoding="utf-8") as handle:
        return json.load(handle)


CONFIG = load_local_config()


def config_value(name: str, default=None):
    return os.getenv(name) or CONFIG.get(name) or default


PLATFORM_API_BASE_URL = config_value("PLATFORM_API_BASE_URL", "http://127.0.0.1:5000")
MT5_BRIDGE_SECRET = config_value("MT5_BRIDGE_SECRET")
MAX_RETRIES = int(config_value("MT5_BRIDGE_RETRIES", 3))
RETRY_BASE_SECONDS = float(config_value("MT5_BRIDGE_RETRY_BASE_SECONDS", 2))
CANDLE_LIMIT = int(config_value("MT5_BRIDGE_CANDLE_LIMIT", DEFAULT_CANDLE_LIMIT))
MAX_TICK_FUTURE_SKEW_SECONDS = float(config_value("MT5_TICK_FUTURE_TOLERANCE_SECONDS", 60))
BROKER_OFFSET_MIN_SYMBOLS = 3
BROKER_OFFSET_AGREEMENT_SECONDS = 120
BROKER_OFFSET_WHOLE_HOUR_TOLERANCE_SECONDS = 120
BROKER_OFFSET_MAX_SECONDS = 14 * 60 * 60


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def iso_time(timestamp) -> str:
    return datetime.fromtimestamp(float(timestamp), timezone.utc).isoformat().replace("+00:00", "Z")


def normalize_tick_timestamp(raw_time, raw_time_msc) -> tuple[datetime, float]:
    epoch_seconds = None
    try:
        numeric_time_msc = int(raw_time_msc)
        if numeric_time_msc > 0:
            epoch_seconds = numeric_time_msc / 1000.0
    except (TypeError, ValueError, OverflowError):
        epoch_seconds = None

    if epoch_seconds is None:
        try:
            numeric_time = float(raw_time)
            if numeric_time > 0:
                epoch_seconds = numeric_time
        except (TypeError, ValueError, OverflowError):
            epoch_seconds = None

    if epoch_seconds is None:
        raise RuntimeError("MT5 tick has no valid Unix epoch timestamp")

    tick_time = datetime.fromtimestamp(epoch_seconds, tz=timezone.utc)
    round_trip_seconds = tick_time.timestamp()
    if abs(round_trip_seconds - epoch_seconds) > 0.001:
        raise RuntimeError("MT5 tick timestamp normalization changed the source epoch instant")
    return tick_time, epoch_seconds


def detect_broker_clock_offset(raw_ticks: list[dict], current_utc: datetime) -> int:
    """Detect one safe, whole-hour broker clock offset for a tick batch."""
    skews = [tick["raw_epoch_seconds"] - current_utc.timestamp() for tick in raw_ticks]
    future_skews = [skew for skew in skews if skew > MAX_TICK_FUTURE_SKEW_SECONDS]
    if not future_skews:
        return 0

    median_skew = median(future_skews)
    whole_hour_offset = round(median_skew / 3600) * 3600
    if abs(whole_hour_offset) > BROKER_OFFSET_MAX_SECONDS:
        raise RuntimeError(f"broker clock offset {whole_hour_offset}s lies outside the safe +/-14 hour range")
    if whole_hour_offset == 0 or abs(median_skew - whole_hour_offset) > BROKER_OFFSET_WHOLE_HOUR_TOLERANCE_SECONDS:
        raise RuntimeError(f"broker clock skew median {median_skew:.1f}s is not close to a non-zero whole-hour offset")

    agreeing = [skew for skew in future_skews if abs(skew - whole_hour_offset) <= BROKER_OFFSET_AGREEMENT_SECONDS]
    if len(agreeing) < BROKER_OFFSET_MIN_SYMBOLS:
        raise RuntimeError(
            f"broker clock offset consensus requires {BROKER_OFFSET_MIN_SYMBOLS} symbols; found {len(agreeing)}"
        )
    inconsistent = [skew for skew in future_skews if abs(skew - whole_hour_offset) > BROKER_OFFSET_AGREEMENT_SECONDS]
    if inconsistent:
        raise RuntimeError(f"future tick skews disagree with detected broker clock offset {whole_hour_offset}s")
    return int(whole_hour_offset)


def normalize_collected_ticks(raw_ticks: list[dict], current_utc: datetime) -> list[dict]:
    broker_offset_seconds = detect_broker_clock_offset(raw_ticks, current_utc)
    normalized_ticks = []
    for raw_tick in raw_ticks:
        normalized_epoch = raw_tick["raw_epoch_seconds"] - broker_offset_seconds
        normalized_time = datetime.fromtimestamp(normalized_epoch, tz=timezone.utc)
        normalized_skew = (normalized_time - current_utc).total_seconds()
        raw_time_iso = datetime.fromtimestamp(raw_tick["raw_epoch_seconds"], tz=timezone.utc).isoformat().replace("+00:00", "Z")
        normalized_time_iso = normalized_time.isoformat().replace("+00:00", "Z")
        print(
            f"{raw_tick['platform_symbol']}/{raw_tick['broker_symbol']} tick diagnostic: "
            f"raw_time={raw_tick['raw_time']} raw_time_msc={raw_tick['raw_time_msc']} "
            f"raw_emitted_timestamp={raw_time_iso} detected_broker_offset_seconds={broker_offset_seconds} "
            f"normalized_utc_timestamp={normalized_time_iso} normalized_skew_seconds={normalized_skew:.3f}",
            flush=True,
        )
        if normalized_skew > MAX_TICK_FUTURE_SKEW_SECONDS:
            raise RuntimeError(
                f"{raw_tick['platform_symbol']} timestamp-normalization error: normalized tick timestamp "
                f"is {normalized_skew:.1f}s ahead of current UTC"
            )
        normalized_ticks.append({
            "platform_symbol": raw_tick["platform_symbol"],
            "broker_symbol": raw_tick["broker_symbol"],
            "bid": raw_tick["bid"],
            "ask": raw_tick["ask"],
            "last": raw_tick["last"],
            "tick_time": normalized_time_iso,
            "raw_tick_time": raw_time_iso,
            "clock_offset_seconds": broker_offset_seconds,
            "source": "mt5_broker",
        })
    return normalized_ticks


def load_state() -> dict:
    if not STATE_FILE.exists():
        return {}
    try:
        with STATE_FILE.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError):
        return {}


def save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with STATE_FILE.open("w", encoding="utf-8") as handle:
        json.dump(state, handle, indent=2, sort_keys=True)


def select_broker_symbol(platform_symbol: str) -> str | None:
    for broker_symbol in SYMBOL_MAP[platform_symbol]:
        info = mt5.symbol_info(broker_symbol)
        if info is None:
            continue
        if not info.visible and not mt5.symbol_select(broker_symbol, True):
            continue
        return broker_symbol
    return None


def collect_closed_candles(broker_symbol: str, timeframe: str, limit: int) -> list[dict]:
    rates = mt5.copy_rates_from_pos(broker_symbol, TIMEFRAMES[timeframe], 1, limit)
    if rates is None:
        raise RuntimeError(f"MT5 returned no rates: {mt5.last_error()}")
    candles = []
    for rate in rates:
        candles.append({
            "time": iso_time(rate["time"]),
            "date_time": iso_time(rate["time"]),
            "open": float(rate["open"]),
            "high": float(rate["high"]),
            "low": float(rate["low"]),
            "close": float(rate["close"]),
            "tick_volume": int(rate["tick_volume"]),
            "spread": int(rate["spread"]),
            "real_volume": int(rate["real_volume"]),
        })
    return candles


def collect_tick(platform_symbol: str, broker_symbol: str) -> dict:
    tick = mt5.symbol_info_tick(broker_symbol)
    if tick is None:
        raise RuntimeError(f"MT5 returned no tick for {broker_symbol}: {mt5.last_error()}")
    bid = float(tick.bid) if tick.bid else None
    ask = float(tick.ask) if tick.ask else None
    last = float(tick.last) if tick.last else None
    raw_time = int(tick.time)
    raw_time_msc = int(tick.time_msc) if getattr(tick, "time_msc", None) else raw_time * 1000
    _tick_time, epoch_seconds = normalize_tick_timestamp(raw_time, raw_time_msc)
    return {
        "platform_symbol": platform_symbol,
        "broker_symbol": broker_symbol,
        "bid": bid,
        "ask": ask,
        "last": last,
        "raw_time": raw_time,
        "raw_time_msc": raw_time_msc,
        "raw_epoch_seconds": epoch_seconds,
    }


def post_import(payload: dict) -> dict:
    if not MT5_BRIDGE_SECRET:
        raise RuntimeError("Set MT5_BRIDGE_SECRET in the environment or mt5_bridge.local.json")
    url = f"{PLATFORM_API_BASE_URL.rstrip('/')}/api/broker/mt5/candles/import"
    req = request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"content-type": "application/json", "x-mt5-bridge-secret": MT5_BRIDGE_SECRET},
        method="POST",
    )
    with request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def post_ticks(payload: dict) -> dict:
    if not MT5_BRIDGE_SECRET:
        raise RuntimeError("Set MT5_BRIDGE_SECRET in the environment or mt5_bridge.local.json")
    url = f"{PLATFORM_API_BASE_URL.rstrip('/')}/api/broker/mt5/ticks/import"
    req = request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"content-type": "application/json", "x-mt5-bridge-secret": MT5_BRIDGE_SECRET},
        method="POST",
    )
    with request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def with_retries(label: str, action):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return action()
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8")
            if attempt >= MAX_RETRIES:
                raise RuntimeError(f"{label}: HTTP {exc.code} {detail}") from exc
        except Exception:
            if attempt >= MAX_RETRIES:
                raise
        delay = min(60, RETRY_BASE_SECONDS * (2 ** (attempt - 1)))
        print(f"{label}: retry {attempt}/{MAX_RETRIES} in {delay:.1f}s", flush=True)
        time.sleep(delay)


def sync_symbol_timeframe(platform_symbol: str, timeframe: str, state: dict) -> bool:
    started_at = utc_now()
    broker_symbol = select_broker_symbol(platform_symbol)
    if not broker_symbol:
        print(f"{platform_symbol}: no visible broker symbol candidate found", flush=True)
        return False

    label = f"{platform_symbol}/{broker_symbol} {timeframe}"
    candles = with_retries(label, lambda: collect_closed_candles(broker_symbol, timeframe, CANDLE_LIMIT))
    result = with_retries(label, lambda: post_import({
        "symbol": platform_symbol,
        "broker_symbol": broker_symbol,
        "timeframe": timeframe,
        "started_at": started_at,
        "candles": candles,
    }))
    summary = result.get("import", result)
    key = f"{platform_symbol}:{timeframe}"
    state[key] = {
        "platform_symbol": platform_symbol,
        "broker_symbol": broker_symbol,
        "timeframe": timeframe,
        "last_success": utc_now(),
        "latest_candle_time": candles[-1]["time"] if candles else None,
        "received_count": summary.get("received_count"),
        "inserted_count": summary.get("inserted_count"),
        "updated_count": summary.get("updated_count"),
        "rejected_count": summary.get("rejected_count"),
    }
    print(
        f"{label}: received={summary.get('received_count')} inserted={summary.get('inserted_count')} "
        f"updated={summary.get('updated_count')} rejected={summary.get('rejected_count')}",
        flush=True,
    )
    return True


def sync_ticks(symbols: list[str], state: dict) -> bool:
    raw_ticks = []
    failed = []
    for platform_symbol in symbols:
        broker_symbol = select_broker_symbol(platform_symbol)
        if not broker_symbol:
            failed.append(platform_symbol)
            continue
        try:
            raw_ticks.append(with_retries(f"{platform_symbol}/{broker_symbol} tick", lambda: collect_tick(platform_symbol, broker_symbol)))
        except Exception as exc:
            print(f"{platform_symbol} tick: {exc}", flush=True)
            failed.append(platform_symbol)
    ticks = normalize_collected_ticks(raw_ticks, datetime.now(timezone.utc)) if raw_ticks else []
    if ticks:
        result = with_retries("live ticks import", lambda: post_ticks({"ticks": ticks, "started_at": utc_now()}))
        summary = result.get("import", result)
        state["latest_ticks"] = {
            "last_success": utc_now(),
            "received_count": summary.get("received_count"),
            "inserted_count": summary.get("inserted_count"),
            "rejected_count": summary.get("rejected_count"),
            "symbols": [tick["platform_symbol"] for tick in ticks],
        }
        print(
            f"ticks: received={summary.get('received_count')} inserted={summary.get('inserted_count')} rejected={summary.get('rejected_count')}",
            flush=True,
        )
    return not failed


def parse_args():
    parser = argparse.ArgumentParser(description="Sync closed MT5 candles into Trading Analysis Platform")
    parser.add_argument("--sync-all", action="store_true", help="Sync all configured symbols and D1/H4/H1 timeframes")
    parser.add_argument("--ticks", action="store_true", help="Sync latest live ticks for selected symbols")
    parser.add_argument("--symbol", choices=DEFAULT_SYMBOLS, help="Sync one platform symbol")
    parser.add_argument("--timeframe", choices=DEFAULT_TIMEFRAMES, help="Sync one timeframe")
    parser.add_argument("--limit", type=int, default=CANDLE_LIMIT, help="Closed candles to request per symbol/timeframe")
    return parser.parse_args()


def run() -> int:
    args = parse_args()
    global CANDLE_LIMIT
    CANDLE_LIMIT = args.limit

    if not args.sync_all and not args.ticks and not (args.symbol and args.timeframe):
        raise RuntimeError("Use --sync-all, --ticks, or provide both --symbol and --timeframe")

    if not mt5.initialize():
        raise RuntimeError(f"MT5 initialize failed: {mt5.last_error()}")

    state = load_state()
    failed = []
    try:
        symbols = DEFAULT_SYMBOLS if args.sync_all else [args.symbol]
        timeframes = DEFAULT_TIMEFRAMES if args.sync_all else [args.timeframe]
        if args.sync_all or args.ticks:
            tick_symbols = symbols if args.ticks and args.symbol else DEFAULT_SYMBOLS if args.sync_all or args.ticks else symbols
            if not sync_ticks(tick_symbols, state):
                failed.append("ticks")
            if args.ticks and not args.sync_all:
                return 2 if failed else 0
        for symbol in symbols:
            for timeframe in timeframes:
                try:
                    if not sync_symbol_timeframe(symbol, timeframe, state):
                        failed.append(f"{symbol}:{timeframe}")
                except Exception as exc:
                    print(f"{symbol} {timeframe}: {exc}", flush=True)
                    failed.append(f"{symbol}:{timeframe}")
                finally:
                    save_state(state)
    finally:
        mt5.shutdown()

    if failed:
        print(f"Failed syncs: {', '.join(failed)}", flush=True)
        return 2
    return 0


if __name__ == "__main__":
    try:
        sys.exit(run())
    except Exception as exc:
        print(exc, flush=True)
        sys.exit(1)
