# V3.6 Live Setup Lifecycle and Performance

## What V3.6 adds

V3.6 turns `setup_journal` into the live operating record between setup detection and review. It adds evidence-only lifecycle updates from backend candles/prices, journal-derived performance, broker-ready reconciliation fields, structured APIs, and compact lifecycle views in the existing lower workspace. It does not execute trades.

## Lifecycle and outcomes

Lifecycle states are `watching`, `ready`, `triggered`, `active`, `completed`, `invalidated`, `expired`, `manually_closed`, and `requires_review`.

Outcomes are `pending`, `watching`, `triggered`, `tp1_hit`, `tp2_hit`, `stopped_out`, `invalidated`, `expired`, `manually_closed`, `requires_review`, and `ambiguous`. V3.5 observation outcomes remain supported.

Only `setup` entries with valid direction and levels are automatically evaluated. Watch and observation entries remain informational. Provider-limited entries are skipped with an explicit reason.

## Evidence and outcome rules

Stored candles for the journal symbol/timeframe are read from entry creation onward. A pending setup must first have its entry touched. BUY targets use highs and BUY stops use lows; SELL targets use lows and SELL stops use highs. TP2 has priority over TP1, then SL, after entry evidence exists. A backend live price can establish an entry crossing only when a previous lifecycle price exists; one isolated quote is not proof of crossing.

If target and stop are touched in one candle, intrabar order is unknowable. The entry becomes `requires_review` with outcome `ambiguous` and an explanatory `review_reason`. Missing market data leaves the outcome unchanged and records an insufficient-data reason.

## Performance metrics

`GET /api/journal/performance` returns `overall`, `bySymbol`, `byDirection`, `byQualityRange`, `byEntryType`, and `generatedAt`. Win rate uses completed setup entries only. Watch, observation, and provider-limited entries never enter its denominator. Without completed setups, win rate and average R are `null`; no placeholder results are generated.

## Broker-ready fields

Migration `008_add_lifecycle_performance_fields.sql` adds nullable broker symbol/server, account currency, ticket, actual entry/SL/TP/close, and actual P/L fields. `execution_mode` defaults to `analysis_only`; `manual_reconciliation` is the only other mode. No broker ticket or execution data is synthesized.

Lifecycle audit fields store last check time, last real price/candle time, reason, update count, and review requirement. The migration is additive and does not delete journal data.

## API endpoints

- `GET /api/journal/open`
- `POST /api/journal/lifecycle/update`
- `POST /api/journal/:id/lifecycle/update`
- `GET /api/journal/:id/lifecycle`
- `GET /api/journal/performance`
- Existing journal list/create/import/outcome endpoints remain available.

Validation failures use 400 and unknown IDs use 404. Batch responses report updated, skipped, and review-required counts with per-entry reasons.

## UI

Forward Test Journal contains a real performance summary, open lifecycle table, completed setup table, entry-type filters, lifecycle actions, review state, invalidation/manual-close actions, and notes. The separate Performance tab reads journal performance instead of estimating from signals. The right panel detects already-journaled entries, displays lifecycle/outcome, and can request an update. M1/M5/M15 remain visual-only; entries created from those views retain H1 analysis context.

## Scheduling decision

V3.6 exposes a batch endpoint and scan-ready service boundary but adds no background job. A later scheduler can invoke it after successful candle collection with symbol/timeframe scoping and provider throttling.

## Known limitations and later work

- Evaluation starts with stored data after journal creation; unavailable history cannot be reconstructed.
- Quote crossing needs a previous lifecycle quote unless candle evidence exists.
- Same-candle target/stop order requires review.
- US500/US100 remain provider-limited when direct SPX/NDX access is unavailable; no SPY/QQQ fallback exists.
- XM/MT5 data and manual reconciliation may populate broker-ready fields later. V4/V5 can add controlled scheduling, richer review, currency conversion, and broker adapters. Trade execution remains out of scope.
