const toNumber = (value) => Number(value);

const candleTouchesZone = (candle, zone) => {
  const candleHigh = toNumber(candle.high);
  const candleLow = toNumber(candle.low);

  const zoneHigh = toNumber(zone.zone_high);
  const zoneLow = toNumber(zone.zone_low);

  return candleHigh >= zoneLow && candleLow <= zoneHigh;
};

const candleBreaksZone = (candle, zone) => {
  const close = toNumber(candle.close);

  const zoneHigh = toNumber(zone.zone_high);
  const zoneLow = toNumber(zone.zone_low);

  if (zone.zone_type === "demand") {
    return close < zoneLow;
  }

  if (zone.zone_type === "supply") {
    return close > zoneHigh;
  }

  return false;
};

const evaluateZoneLifecycle = (zone, latestCandle) => {
  if (!zone || !latestCandle) {
    return {
      touched: false,
      mitigated: false,
      broken: false,
    };
  }

  const broken = candleBreaksZone(latestCandle, zone);
  const touched = candleTouchesZone(latestCandle, zone);

  return {
    touched,
    mitigated: touched && !broken,
    broken,
  };
};

module.exports = {
  evaluateZoneLifecycle,
};
