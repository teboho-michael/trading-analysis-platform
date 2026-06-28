SELECT
  a.id,
  a.symbol,
  c.timeframe,
  MIN(c.low) AS min_low,
  MAX(c.high) AS max_high,
  COUNT(*) AS candles
FROM candles c
JOIN assets a ON a.id = c.asset_id
GROUP BY a.id, a.symbol, c.timeframe
ORDER BY a.id, c.timeframe;
