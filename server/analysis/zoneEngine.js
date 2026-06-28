const MIN_CANDLES_REQUIRED = 20;

const IMPULSE_MULTIPLIER = 1.5;
const MAX_BASE_BODY_PERCENT = 0.45;
const MAX_ZONE_SIZE_PERCENT = 0.015; // 1.5%

const toNumber = (value) => Number(value);

const getCandleBody = (candle) => {
  return Math.abs(toNumber(candle.close) - toNumber(candle.open));
};

const getCandleRange = (candle) => {
  return toNumber(candle.high) - toNumber(candle.low);
};

const getAverageRange = (candles) => {
  if (!candles || candles.length === 0) return 0;

  const totalRange = candles.reduce((sum, candle) => {
    return sum + getCandleRange(candle);
  }, 0);

  return totalRange / candles.length;
};

const isBaseCandle = (candle) => {
  const body = getCandleBody(candle);
  const range = getCandleRange(candle);

  if (range <= 0) return false;

  const bodyPercent = body / range;

  return bodyPercent <= MAX_BASE_BODY_PERCENT;
};

const isBullishImpulse = (candle, averageRange) => {
  const open = toNumber(candle.open);
  const close = toNumber(candle.close);
  const range = getCandleRange(candle);

  return close > open && range >= averageRange * IMPULSE_MULTIPLIER;
};

const isBearishImpulse = (candle, averageRange) => {
  const open = toNumber(candle.open);
  const close = toNumber(candle.close);
  const range = getCandleRange(candle);

  return close < open && range >= averageRange * IMPULSE_MULTIPLIER;
};

const calculateZoneStrength = ({ baseCandle, impulseCandle, averageRange }) => {
  const baseRange = getCandleRange(baseCandle);
  const impulseRange = getCandleRange(impulseCandle);

  if (baseRange <= 0 || averageRange <= 0) return 1;

  const impulseStrength = impulseRange / averageRange;
  const baseQuality = averageRange / baseRange;

  const rawScore = impulseStrength + baseQuality;

  if (rawScore >= 5) return 5;
  if (rawScore >= 4) return 4;
  if (rawScore >= 3) return 3;
  if (rawScore >= 2) return 2;

  return 1;
};

const buildDemandZone = (baseCandle, impulseCandle, averageRange) => {
  const zoneHigh = Math.max(
    toNumber(baseCandle.open),
    toNumber(baseCandle.close),
  );
  const zoneLow = toNumber(baseCandle.low);

  const zoneSize = zoneHigh - zoneLow;
  const zoneSizePercent = zoneSize / zoneHigh;

  if (zoneSize <= 0 || zoneSizePercent > MAX_ZONE_SIZE_PERCENT) {
    return null;
  }

  return {
    zone_type: "demand",
    zone_high: zoneHigh,
    zone_low: zoneLow,
    strength: calculateZoneStrength({
      baseCandle,
      impulseCandle,
      averageRange,
    }),
    source_time: baseCandle.candle_time,
  };
};

const buildSupplyZone = (baseCandle, impulseCandle, averageRange) => {
  const zoneHigh = toNumber(baseCandle.high);
  const zoneLow = Math.min(
    toNumber(baseCandle.open),
    toNumber(baseCandle.close),
  );

  const zoneSize = zoneHigh - zoneLow;
  const zoneSizePercent = zoneSize / zoneLow;

  if (zoneSize <= 0 || zoneSizePercent > MAX_ZONE_SIZE_PERCENT) {
    return null;
  }

  return {
    zone_type: "supply",
    zone_high: zoneHigh,
    zone_low: zoneLow,
    strength: calculateZoneStrength({
      baseCandle,
      impulseCandle,
      averageRange,
    }),
    source_time: baseCandle.candle_time,
  };
};

const removeDuplicateZones = (zones) => {
  const zoneMap = new Map();

  zones.forEach((zone) => {
    const key = [
      zone.zone_type,
      Number(zone.zone_high).toFixed(5),
      Number(zone.zone_low).toFixed(5),
    ].join("_");

    if (!zoneMap.has(key)) {
      zoneMap.set(key, zone);
      return;
    }

    const existingZone = zoneMap.get(key);

    if ((zone.strength || 1) > (existingZone.strength || 1)) {
      zoneMap.set(key, zone);
    }
  });

  return Array.from(zoneMap.values());
};

const sortZonesByStrength = (zones) => {
  return zones.sort((a, b) => {
    const strengthDiff = (b.strength || 1) - (a.strength || 1);

    if (strengthDiff !== 0) return strengthDiff;

    return new Date(b.source_time || 0) - new Date(a.source_time || 0);
  });
};

const detectZones = (candles) => {
  if (!candles || candles.length < MIN_CANDLES_REQUIRED) {
    return [];
  }

  const orderedCandles = [...candles].sort(
    (a, b) => new Date(a.candle_time) - new Date(b.candle_time),
  );

  const averageRange = getAverageRange(orderedCandles);
  const detectedZones = [];

  for (let i = 1; i < orderedCandles.length - 1; i++) {
    const baseCandle = orderedCandles[i];
    const impulseCandle = orderedCandles[i + 1];

    if (!isBaseCandle(baseCandle)) continue;

    if (isBullishImpulse(impulseCandle, averageRange)) {
      const demandZone = buildDemandZone(
        baseCandle,
        impulseCandle,
        averageRange,
      );

      if (demandZone) {
        detectedZones.push(demandZone);
      }
    }

    if (isBearishImpulse(impulseCandle, averageRange)) {
      const supplyZone = buildSupplyZone(
        baseCandle,
        impulseCandle,
        averageRange,
      );

      if (supplyZone) {
        detectedZones.push(supplyZone);
      }
    }
  }

  return sortZonesByStrength(removeDuplicateZones(detectedZones)).slice(0, 5);
};

module.exports = {
  detectZones,
};
