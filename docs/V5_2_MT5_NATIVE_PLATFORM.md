# V5.2 MT5 Native Platform

V5.2 removes the active external chart surface and makes the visible platform use the same stored XM MT5 candle records as dashboard, analysis, research, readiness, and backtesting.

## Active Architecture

The production data flow is:

XM Broker -> MetaTrader 5 -> Python MT5 candle bridge -> Node import API -> PostgreSQL -> React native chart

The React app uses relative `/api` paths and is still built into `client/dist` for Express static serving. Production users do not need to run Vite.

## Symbol Mapping

The backend registry is the active source of truth:

| Platform symbol | XM MT5 broker symbol |
| --- | --- |
| BTCUSD | BTCUSD |
| XAUUSD | GOLDmicro |
| USDJPY | USDJPY |
| US500 | US500Cash |
| US100 | US100Cash |

The frontend displays broker symbols received from backend metadata. It must not invent chart symbols or substitute another asset.

## Native Chart

The chart is rendered with `lightweight-charts` from `/api/candles/:symbol/:timeframe`. It supports `D1`, `H4`, and `H1` for all five platform assets.

The chart request returns only PostgreSQL candles with:

- `source = mt5_broker`
- the expected XM broker symbol for the requested platform symbol
- chronological candle order
- numeric OHLC and volume fields
- source-purity metadata

Empty datasets are truthful and show that no MT5 candle data is available for the selected asset and timeframe.

## Candle API

`GET /api/candles/:symbol/:timeframe` accepts optional `limit`, `start`, and `end` query parameters. The safe maximum limit is 2000.

The response includes:

- `platform_symbol`
- `broker_symbol`
- `timeframe`
- `data_source`
- `source_purity`
- `candle_count`
- `earliest_candle_time`
- `latest_stored_candle_time`
- `latest_closed_candle_time`
- `forming_candle_present`
- `forming_candle_time`
- `next_expected_close_time`
- `freshness`
- `candles`

No missing candles are generated and no non-MT5 candles are returned.

## Closed, Forming, Tick, And Sync

Stored candle timestamps are treated as UTC candle-open times from the MT5 bridge.

Closed-candle rules:

- `H1`: latest candle at least one hour behind server time
- `H4`: latest candle at least four hours behind server time
- `D1`: latest candle at least one day behind server time

The native chart may show a current forming candle from a live MT5 tick, but EMA, trend, zones, signals, research evidence, readiness, and backtesting use stored closed-candle evidence.

Live tick data is separate from candle close data. A live response may return `available`, `awaiting_mt5_tick`, `stale_mt5_tick`, `bridge_offline`, or `market_closed` style status metadata. The platform does not label the latest candle close as a live bid or ask.

Bridge synchronization status is persisted in `mt5_bridge_runs` during successful candle imports. The table stores run timing and row counts only; it does not store credentials, account numbers, secrets, or local filesystem values.

## Freshness Rules

Candle freshness is timeframe-aware:

- `H1`: one hour plus bridge delay
- `H4`: four hours plus bridge delay
- `D1`: one day plus broker-session tolerance

Freshness values include `current`, `delayed`, `stale`, `missing`, `market_closed`, and `awaiting_first_sync`. Live tick freshness uses the tick time, not candle time. Bridge freshness uses the latest successful bridge import completion time.

## Data Alignment Panel

The right-side Data / Source Alignment panel shows:

- platform symbol
- XM broker symbol
- provider: XM MT5
- active source: `mt5_broker`
- selected timeframe
- total MT5 candle count
- latest stored candle
- latest closed candle
- latest successful bridge sync
- candle freshness
- live tick status
- source purity
- available timeframes

## Local Verification

Recommended checks:

```bash
npm run verify:candles
npm run audit:candle-sources
cd client && npm run lint && npm run build
```

Use `/api/system/health`, `/api/system/data-sources`, `/api/assets`, `/api/live/prices`, and `/api/candles/:symbol/:timeframe` to verify backend status.

## VPS Update Checklist

1. Pull the V5.2 code onto the VPS.
2. Run migrations through the normal project migration flow.
3. Confirm `MT5_BRIDGE_SECRET`, PostgreSQL configuration, and scheduled task paths are unchanged.
4. Build the frontend with `cd client && npm run build`.
5. Restart the existing Node scheduled task or service.
6. Run the Python MT5 candle bridge with `--sync-all`.
7. Confirm `/api/system/health` shows `bridge_last_success` and MT5 candle metadata.

## Troubleshooting

- `awaiting_first_sync`: no MT5 candles exist for that symbol/timeframe.
- `stale` or `delayed`: the latest closed candle is outside the timeframe-aware freshness window.
- `awaiting_mt5_tick`: candle data may exist, but the read-only HTTP bridge did not return a current tick.
- Empty chart: the candle API returned a structured empty MT5 dataset.
- Mixed-source data in the database: report it and keep active chart responses filtered to `mt5_broker`; do not purge automatically.

## Safety Boundary

V5.2 does not add trade execution. The bridge may use read-only MT5 functions for candles, symbols, and ticks. It must not call order placement, position management, account modification, or close-position functions.
