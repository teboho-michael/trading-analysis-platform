# V3.4 Forward-Test Journal

V3.4 adds a PostgreSQL-backed research journal for real persisted signals and validated manual setup payloads. It includes idempotent signal import, outcome/review updates, compact journal UI, and basic statistics derived only from journal records.

## Database

Apply `server/migrations/006_add_setup_journal.sql` with the existing PostgreSQL migration workflow. It creates `setup_journal` and indexes without deleting or resetting data. Table and index creation are repeat-safe.

## API

- `GET /api/journal` supports `symbol`, `strategy_name`, `status`, `outcome`, `from`, `to`, and `limit`.
- `GET /api/journal/stats` returns actual-data counts, approximate win rate, and average final R.
- `GET /api/journal/:id` returns one entry.
- `POST /api/journal/from-signal/:signalId` imports a persisted signal once and returns the existing row on duplicate requests.
- `POST /api/journal` creates from a validated setup payload.
- `PATCH /api/journal/:id/outcome` updates supported outcome, movement, R-result, tags, and review fields.

Use **Add to Journal** when a current BUY/SELL setup has valid entry, stop, and TP1 levels. Persisted signals are imported by ID; otherwise the current calculated setup and source attribution are submitted. WAIT setups without valid levels are disabled. Outcomes and notes can be updated in the **Forward Test Journal** lower tab.

## Known limitations

- Outcomes are manually recorded; automatic candle-by-candle journal tracking is deferred.
- Existing signals lack historical quality/bias snapshots, so imported context may be empty.
- Win rate is empty until completed entries exist.
- Screenshot storage/upload is not implemented.
- Migration 006 must be applied before the API is used.
