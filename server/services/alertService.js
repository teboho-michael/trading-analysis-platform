const pool = require("../db/connection");

const createAlertEvent = async ({ assetId, symbol, alertType, severity = "info", message, relatedSignalId = null, relatedZoneId = null, metadata = {} }) => {
  const result = await pool.query(`INSERT INTO alert_events (asset_id, symbol, alert_type, severity, message, related_signal_id, related_zone_id, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [assetId, symbol, alertType, severity, message, relatedSignalId, relatedZoneId, JSON.stringify(metadata)]);
  return result.rows[0];
};

const recordSetupStage = async ({ assetId, symbol, stage, score, zoneId }) => {
  const previous = await pool.query(`SELECT metadata->>'stage' AS stage FROM alert_events WHERE asset_id=$1 AND alert_type='setup_stage_changed' ORDER BY created_at DESC LIMIT 1`, [assetId]);
  const oldStage = previous.rows[0]?.stage || "WAIT";
  if (oldStage === stage) return null;
  const transitions = oldStage === "WAIT" && stage === "READY" ? [["WAIT", "WATCH"], ["WATCH", "READY"]] : [[oldStage, stage]];
  let event = null;
  for (const [previousStage, nextStage] of transitions) {
    if (!((previousStage === "WAIT" && nextStage === "WATCH") || (previousStage === "WATCH" && nextStage === "READY"))) continue;
    event = await createAlertEvent({ assetId, symbol, alertType: "setup_stage_changed", severity: nextStage === "READY" ? "important" : "info", message: `${symbol} setup changed from ${previousStage} to ${nextStage}`, relatedZoneId: zoneId, metadata: { previousStage, stage: nextStage, score } });
  }
  return event;
};

const recordMarketState = async ({ assetId, symbol, h1Trend, isNearZone, zoneId }) => {
  const stateResult = await pool.query(`SELECT metadata FROM alert_events WHERE asset_id=$1 AND alert_type='market_state_snapshot' ORDER BY created_at DESC LIMIT 1`, [assetId]);
  const previous = stateResult.rows[0]?.metadata;
  if (previous) {
    if (previous.isNearZone !== isNearZone) await createAlertEvent({ assetId, symbol, alertType: isNearZone ? "price_entered_zone" : "price_left_zone", message: `${symbol} price ${isNearZone ? "entered" : "left"} the active zone`, relatedZoneId: zoneId });
    if (previous.h1Trend !== h1Trend && ["Bullish", "Bearish"].includes(h1Trend)) await createAlertEvent({ assetId, symbol, alertType: `h1_ema_confirmation_flipped_${h1Trend.toLowerCase()}`, severity: "important", message: `${symbol} H1 EMA confirmation flipped ${h1Trend.toLowerCase()}`, relatedZoneId: zoneId });
  }
  return createAlertEvent({ assetId, symbol, alertType: "market_state_snapshot", severity: "state", message: `${symbol} analysis state recorded`, relatedZoneId: zoneId, metadata: { h1Trend, isNearZone } });
};

module.exports = { createAlertEvent, recordSetupStage, recordMarketState };
