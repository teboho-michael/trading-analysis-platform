const aligned = (trend, zoneType) => (zoneType === "demand" ? trend === "Bullish" : zoneType === "supply" ? trend === "Bearish" : false);

const evaluateSetupQuality = ({ daily, h4, h1, activeZone, zoneProximity, risk, duplicateSignal = false }) => {
  const checklist = [
    { key: "d1Bias", label: "D1 bias aligns with zone", passed: aligned(daily?.trend, activeZone?.zone_type), weight: 15 },
    { key: "h4Bias", label: "H4 bias aligns with zone", passed: aligned(h4?.trend, activeZone?.zone_type), weight: 15 },
    { key: "h1Ema", label: "Two H1 closes confirm EMA 200", passed: aligned(h1?.trend, activeZone?.zone_type), weight: 15 },
    { key: "activeZone", label: "Active valid H4 zone", passed: Boolean(activeZone && activeZone.status === "active" && !activeZone.broken_at), weight: 15 },
    { key: "proximity", label: "Price is near the active zone", passed: Boolean(zoneProximity?.isNearZone), weight: 10 },
    { key: "freshness", label: "Zone is fresh", passed: Boolean(activeZone && !activeZone.touched_at && !activeZone.mitigated_at), weight: 10 },
    { key: "strength", label: "Zone strength is at least 3/5", passed: Number(activeZone?.strength || 0) >= 3, weight: 5 },
    { key: "riskReward", label: "Risk/reward levels are available", passed: Boolean(risk), weight: 10 },
    { key: "unique", label: "No duplicate signal for this zone", passed: !duplicateSignal, weight: 5 },
  ];
  const qualityScore = checklist.reduce((score, item) => score + (item.passed ? item.weight : 0), 0);
  const missingConditions = checklist.filter((item) => !item.passed).map((item) => item.label);
  let setupStage = "WAIT", invalidationReason = null, nextAction = "Wait for an active H4 zone.";
  if (activeZone?.broken_at || activeZone?.status === "broken") { setupStage = "INVALIDATED"; invalidationReason = "The active zone has been broken."; nextAction = "Wait for a new valid H4 zone."; }
  else if (activeZone) { setupStage = "WATCH"; nextAction = missingConditions[0] ? `Wait: ${missingConditions[0]}.` : "Continue monitoring confirmation."; }
  if (activeZone && checklist.slice(0, 5).every((item) => item.passed) && risk && !duplicateSignal) { setupStage = "READY"; nextAction = "Setup ready. Review risk levels."; }
  return { setupStage, qualityScore, missingConditions, confirmationChecklist: checklist.map(({ key, label, passed }) => ({ key, label, passed })), invalidationReason, nextAction };
};

module.exports = { evaluateSetupQuality };
