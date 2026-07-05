# V3.5 Journal Workflow Refinement

V3.5 makes the journal useful when the market has not produced a valid trade setup. It never invents prices, signals, or levels.

## Entry types

- `setup`: a real BUY/SELL setup. Requires strategy name, direction, entry, stop loss, and at least TP1 or TP2.
- `watch`: a WAIT/WATCH state worth monitoring. Trade levels remain empty.
- `observation`: a manual market-context record with a stage or note, but no claim that a setup exists.
- `provider_limited`: records that the configured provider cannot currently analyze the direct symbol. It requires an explanatory note and source attribution.

The current setup panel shows **Add Setup to Journal** only for valid levels. Other states use **Track Watch Setup**, **Track Observation**, or **Track Provider Limitation**. A deterministic daily state key returns the existing entry instead of duplicating the same selected-market state.

## Outcomes and reviews

Setup entries support TP1, TP2, stopped out, invalidated, and manually closed outcomes. Non-setup entries support converted-to-setup, invalidated, expired, reviewed, and ignored outcomes. Conversion is a recorded outcome only; creating and linking a replacement setup is deferred.

All entries support reviewer notes. Observation notes and source context appear in the detail view.

## Statistics

Statistics separate total, setup, watch, observation, and provider-limited entries. Completed setups, TP counts, stopped-out count, average final R, and approximate win rate use setup entries only. Win rate and average R remain empty until completed setup evidence exists.

## Database migration

Apply `server/migrations/007_refine_setup_journal_entry_types.sql` after migration 006. It adds entry type, notes, and deduplication fields; makes trade-only fields nullable; and adds database constraints that preserve strict setup shape.

## Known limitations

- Converted-to-setup does not yet create or link a new setup automatically.
- Outcome updates remain manual.
- Provider-limited classification in the setup panel depends on direct SPX/NDX attribution plus insufficient analysis data.
- Screenshots and file uploads remain deferred.
