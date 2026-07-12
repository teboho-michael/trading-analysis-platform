# V5.0 MT5 Broker Data Bridge

V5.0 adds a safe MetaTrader 5 broker candle import bridge to the Trading Analysis Platform. This is broker data only. It does not add account actions, position management, automated entries, automated exits, or any broker-side execution workflow.

## Architecture

```text
Windows VPS
  XM MT5 desktop terminal
  Python + MetaTrader5 package
  tools/mt5_bridge/mt5_candle_bridge.py
        |
        | HTTPS/HTTP POST with x-mt5-bridge-secret
        v
Linux platform API
  POST /api/broker/mt5/candles/import
        |
        v
PostgreSQL candles table
  source = mt5_broker
        |
        v
Existing readiness, backtest, research, and intelligence layers
```

The Linux platform remains the main application. The Windows VPS is only a read-only broker candle source.

## Data Sources

Historical V5.0 note: the platform introduced source-attributed candle storage:

- `mt5_broker`
- legacy non-MT5 rows from earlier versions

V5.1 supersedes V5.0 by making `mt5_broker` the only active market-data source. Legacy non-MT5 rows may remain in the database for audit or explicit purge workflows, but they do not qualify as research-ready evidence.

## Required Environment

Set this on the Linux API host:

```bash
MT5_BRIDGE_SECRET=use-a-long-random-secret
```

Do not put the secret in source control. The API rejects imports with HTTP 401 when the `x-mt5-bridge-secret` header is missing or invalid.

## Linux Setup

1. Deploy the V5.0 code.
2. Apply the new migration:

```text
server/migrations/012_add_candle_source_metadata.sql
```

3. Restart the API with `MT5_BRIDGE_SECRET` set.
4. Confirm the symbol mapping foundation:

```bash
curl http://localhost:5000/api/broker/mt5/symbol-map
```

## Windows VPS Setup

1. Copy `tools/mt5_bridge/mt5_candle_bridge.py` to the Windows VPS.
2. Confirm MT5 desktop is installed, open, and logged into XM.
3. Confirm Python packages are installed:

```powershell
python -m pip install MetaTrader5 pandas
```

4. Edit the config values near the top of the script:

```python
PLATFORM_API_BASE_URL = "http://YOUR_LINUX_HOST:5000"
MT5_BRIDGE_SECRET = "same-secret-as-linux"
SYMBOL_MAP = {...}
TIMEFRAMES = {...}
CANDLE_LIMIT = 500
```

5. Run the bridge:

```powershell
python mt5_candle_bridge.py
```

The script prints a summary for each platform symbol and timeframe.

## Symbol Map

The initial server-side mapping is foundation only and configurable:

```text
BTCUSD -> BTCUSD, BTCUSD., BTCUSDm
XAUUSD -> XAUUSD, GOLD, XAUUSD., XAUUSDm
USDJPY -> USDJPY, USDJPYm, USDJPY.
US500  -> US500Cash, US500, SP500, US500m
US100  -> US100Cash, US100, NAS100, USTEC, US100m
```

Endpoint:

```bash
curl http://localhost:5000/api/broker/mt5/symbol-map
```

## Example Import

```bash
curl -X POST http://localhost:5000/api/broker/mt5/candles/import \
  -H "content-type: application/json" \
  -H "x-mt5-bridge-secret: use-a-long-random-secret" \
  -d '{
    "symbol": "US500",
    "broker_symbol": "US500Cash",
    "timeframe": "H1",
    "candles": [
      {
        "date_time": "2026-07-10T10:00:00Z",
        "open": 6300.1,
        "high": 6310.4,
        "low": 6298.2,
        "close": 6305.6,
        "tick_volume": 1200,
        "spread": 20,
        "real_volume": 0
      }
    ]
  }'
```

Expected response shape:

```json
{
  "success": true,
  "import": {
    "symbol": "US500",
    "broker_symbol": "US500Cash",
    "timeframe": "H1",
    "received_count": 1,
    "inserted_count": 1,
    "updated_count": 0,
    "rejected_count": 0,
    "earliest": "2026-07-10T10:00:00.000Z",
    "latest": "2026-07-10T10:00:00.000Z",
    "source": "mt5_broker"
  }
}
```

## Verification

Use these checks after applying the migration and starting the API:

```bash
curl -i -X POST http://localhost:5000/api/broker/mt5/candles/import \
  -H "content-type: application/json" \
  -d '{}'

curl -i -X POST http://localhost:5000/api/broker/mt5/candles/import \
  -H "content-type: application/json" \
  -H "x-mt5-bridge-secret: use-a-long-random-secret" \
  -d '{"symbol":"US500"}'

curl http://localhost:5000/api/backtests/readiness
curl http://localhost:5000/api/research/intelligence?strategy_version_id=1
curl http://localhost:5000/api/research/conditions?symbol=US500&timeframe=H1
```

## Safety Rules

- The bridge is read-only.
- The bridge imports candles only.
- The platform API accepts candle payloads only.
- No broker account actions are supported.
- No sample payload is used by production code.

## V4 Impact

Existing V4 readiness, backtests, research lab, pattern discovery, and research intelligence continue to read stored candles. After MT5 broker imports populate enough D1/H4/H1 candles, those layers can operate on the stored broker-attributed data without a separate workflow.
