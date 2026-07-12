# MT5 broker bridge

This read-only Python service requires desktop MetaTrader 5; MT5 mobile cannot host the Python integration. The intended setup is a Windows VPS running XM MT5 desktop and this bridge. V5.1 uses MT5 broker data as the only active market-data source.

Broker mode works only after the VPS, terminal, account, and bridge are configured. Errors are explicit and no candles are fabricated. The bridge contains no order-management functions.

Environment variables (documentation only):

```dotenv
MT5_LOGIN=
MT5_PASSWORD=
MT5_SERVER=XMGLOBAL-MT5 4
MT5_TERMINAL_PATH=
MT5_BRIDGE_HOST=127.0.0.1
MT5_BRIDGE_PORT=7001
```

Install Python and `MetaTrader5` on Windows, start and log into XM MT5 desktop, then run `python mt5_bridge.py`. Set Node to `MARKET_PROVIDER=broker_mt5` and `MT5_BRIDGE_URL=http://127.0.0.1:7001`. Keep the bridge private.

Read-only endpoints: `GET /health`, `GET /symbols`, `GET /candles?symbol=US500&timeframe=H1&limit=300`, and `GET /latest-price?symbol=USDJPY`.
