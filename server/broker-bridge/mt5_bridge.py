"""Read-only HTTP bridge for a Windows desktop MetaTrader 5 terminal."""
import json, os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

try:
    import MetaTrader5 as mt5
    IMPORT_ERROR = None
except ImportError as exc:
    mt5, IMPORT_ERROR = None, str(exc)

TIMEFRAMES = {"H1": mt5.TIMEFRAME_H1, "H4": mt5.TIMEFRAME_H4, "D1": mt5.TIMEFRAME_D1} if mt5 else {}

def connect():
    if IMPORT_ERROR: raise RuntimeError("MetaTrader5 Python package is not installed")
    missing = [key for key in ("MT5_LOGIN", "MT5_PASSWORD", "MT5_SERVER") if not os.getenv(key)]
    if missing: raise RuntimeError("Missing required environment variables: " + ", ".join(missing))
    args = {"login": int(os.environ["MT5_LOGIN"]), "password": os.environ["MT5_PASSWORD"], "server": os.environ["MT5_SERVER"]}
    path = os.getenv("MT5_TERMINAL_PATH")
    initialized = mt5.initialize(path, **args) if path else mt5.initialize(**args)
    if not initialized: raise RuntimeError(f"MT5 terminal initialization failed: {mt5.last_error()}")

def get_symbol(symbol):
    info = mt5.symbol_info(symbol)
    if info is None: raise RuntimeError(f"Broker symbol is unavailable: {symbol}")
    if not info.visible and not mt5.symbol_select(symbol, True): raise RuntimeError(f"Could not select broker symbol: {symbol}")
    return info

class Handler(BaseHTTPRequestHandler):
    def reply(self, status, payload):
        body = json.dumps(payload).encode(); self.send_response(status); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        parsed = urlparse(self.path); query = {k: v[0] for k, v in parse_qs(parsed.query).items()}
        try:
            connect()
            if parsed.path == "/health":
                account = mt5.account_info()
                if account is None: raise RuntimeError(f"MT5 account is unavailable: {mt5.last_error()}")
                return self.reply(200, {"success": True, "terminalConnected": True, "server": account.server})
            if parsed.path == "/symbols":
                infos = [get_symbol(query["symbol"])] if query.get("symbol") else (mt5.symbols_get() or [])
                return self.reply(200, {"success": True, "symbols": [{"symbol": i.name, "digits": i.digits, "point": i.point, "tradeContractSize": i.trade_contract_size, "volumeMin": i.volume_min, "volumeStep": i.volume_step} for i in infos]})
            if parsed.path == "/candles":
                symbol, timeframe = query.get("symbol"), query.get("timeframe"); limit = min(max(int(query.get("limit", 300)), 1), 2000)
                if not symbol or timeframe not in TIMEFRAMES: return self.reply(400, {"success": False, "error": "symbol and supported timeframe (H1, H4, D1) are required"})
                get_symbol(symbol); rates = mt5.copy_rates_from_pos(symbol, TIMEFRAMES[timeframe], 0, limit)
                if rates is None: raise RuntimeError(f"MT5 returned no candles: {mt5.last_error()}")
                candles = [{"candle_time": datetime.fromtimestamp(int(r["time"]), timezone.utc).isoformat(), "open": float(r["open"]), "high": float(r["high"]), "low": float(r["low"]), "close": float(r["close"]), "volume": int(r["tick_volume"])} for r in rates]
                return self.reply(200, {"success": True, "symbol": symbol, "timeframe": timeframe, "candles": candles})
            if parsed.path == "/latest-price":
                symbol = query.get("symbol")
                if not symbol: return self.reply(400, {"success": False, "error": "symbol is required"})
                get_symbol(symbol); tick = mt5.symbol_info_tick(symbol)
                if tick is None: raise RuntimeError(f"MT5 returned no latest price: {mt5.last_error()}")
                return self.reply(200, {"success": True, "symbol": symbol, "bid": tick.bid, "ask": tick.ask, "timestamp": datetime.fromtimestamp(tick.time, timezone.utc).isoformat()})
            return self.reply(404, {"success": False, "error": "Endpoint not found"})
        except (RuntimeError, ValueError) as exc: return self.reply(503, {"success": False, "error": str(exc)})
        finally:
            if mt5: mt5.shutdown()
    def log_message(self, fmt, *args): print(f"MT5 bridge: {fmt % args}")

if __name__ == "__main__":
    host, port = os.getenv("MT5_BRIDGE_HOST", "127.0.0.1"), int(os.getenv("MT5_BRIDGE_PORT", "7001"))
    print(f"Read-only MT5 bridge listening on http://{host}:{port}"); ThreadingHTTPServer((host, port), Handler).serve_forever()
