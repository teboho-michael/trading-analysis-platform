UPDATE strategy_versions
SET rules_json = rules_json || '{"required_timeframes":[{"timeframe":"D1","role":"bias_context","minimumCandles":201},{"timeframe":"H4","role":"zone_context","minimumCandles":201},{"timeframe":"H1","role":"execution_confirmation","minimumCandles":201}]}'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE strategy_key = 'supply_demand_ema_200' AND version = 'v1';
