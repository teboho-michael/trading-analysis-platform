"""
Read-only MT5 candle bridge template for V5.0.

Copy this file to the Windows VPS that has MetaTrader 5, Python, pandas, and
the MetaTrader5 package installed. Configure the values below, then run it from
that machine so broker candles are posted into the Linux platform API.
"""

from datetime import datetime, timezone
import json
import sys
from urllib import request, error

import MetaTrader5 as mt5


PLATFORM_API_BASE_URL = "http://YOUR_LINUX_HOST:5000"
MT5_BRIDGE_SECRET = "replace-with-MT5_BRIDGE_SECRET"

SYMBOL_MAP = {
    "BTCUSD": ["BTCUSD", "BTCUSD.", "BTCUSDm"],
    "XAUUSD": ["XAUUSD", "GOLD", "XAUUSD.", "XAUUSDm"],
    "USDJPY": ["USDJPY", "USDJPYm", "USDJPY."],
    "US500": ["US500Cash", "US500", "SP500", "US500m"],
    "US100": ["US100Cash", "US100", "NAS100", "USTEC", "US100m"],
}

TIMEFRAMES = {
    "D1": mt5.TIMEFRAME_D1,
    "H4": mt5.TIMEFRAME_H4,
    "H1": mt5.TIMEFRAME_H1,
}

CANDLE_LIMIT = 500


def iso_time(timestamp):
    return datetime.fromtimestamp(int(timestamp), timezone.utc).isoformat()


def select_broker_symbol(candidates):
    for broker_symbol in candidates:
        info = mt5.symbol_info(broker_symbol)
        if info is None:
            continue

        if not info.visible and not mt5.symbol_select(broker_symbol, True):
            continue

        return broker_symbol

    return None


def collect_candles(broker_symbol, timeframe_value):
    rates = mt5.copy_rates_from_pos(
        broker_symbol,
        timeframe_value,
        0,
        CANDLE_LIMIT,
    )

    if rates is None:
        raise RuntimeError(f"MT5 returned no rates: {mt5.last_error()}")

    candles = []
    for rate in rates:
        candles.append(
            {
                "time": iso_time(rate["time"]),
                "date_time": iso_time(rate["time"]),
                "open": float(rate["open"]),
                "high": float(rate["high"]),
                "low": float(rate["low"]),
                "close": float(rate["close"]),
                "tick_volume": int(rate["tick_volume"]),
                "spread": int(rate["spread"]),
                "real_volume": int(rate["real_volume"]),
            }
        )

    return candles


def post_import(payload):
    url = f"{PLATFORM_API_BASE_URL.rstrip('/')}/api/broker/mt5/candles/import"
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url,
        data=body,
        headers={
            "content-type": "application/json",
            "x-mt5-bridge-secret": MT5_BRIDGE_SECRET,
        },
        method="POST",
    )

    with request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def run():
    if not MT5_BRIDGE_SECRET or MT5_BRIDGE_SECRET.startswith("replace-with"):
        raise RuntimeError("Set MT5_BRIDGE_SECRET before running the bridge")

    if not mt5.initialize():
        raise RuntimeError(f"MT5 initialize failed: {mt5.last_error()}")

    try:
        for platform_symbol, candidates in SYMBOL_MAP.items():
            broker_symbol = select_broker_symbol(candidates)
            if not broker_symbol:
                print(f"{platform_symbol}: no candidate broker symbol found")
                continue

            for timeframe_name, timeframe_value in TIMEFRAMES.items():
                try:
                    candles = collect_candles(broker_symbol, timeframe_value)
                    result = post_import(
                        {
                            "symbol": platform_symbol,
                            "broker_symbol": broker_symbol,
                            "timeframe": timeframe_name,
                            "candles": candles,
                        }
                    )
                    summary = result.get("import", result)
                    print(
                        f"{platform_symbol}/{broker_symbol} {timeframe_name}: "
                        f"received={summary.get('received_count')} "
                        f"inserted={summary.get('inserted_count')} "
                        f"updated={summary.get('updated_count')} "
                        f"rejected={summary.get('rejected_count')}"
                    )
                except error.HTTPError as exc:
                    detail = exc.read().decode("utf-8")
                    print(
                        f"{platform_symbol}/{broker_symbol} {timeframe_name}: "
                        f"HTTP {exc.code} {detail}"
                    )
                except Exception as exc:
                    print(
                        f"{platform_symbol}/{broker_symbol} {timeframe_name}: "
                        f"{exc}"
                    )
    finally:
        mt5.shutdown()


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:
        print(exc)
        sys.exit(1)
