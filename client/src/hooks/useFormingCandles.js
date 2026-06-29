import { useEffect, useMemo, useRef, useState } from "react";

const DURATION_SECONDS = { H1: 3600, H4: 14400, D1: 86400 };

export const useFormingCandles = (candles, quote, symbol, timeframe, enabled) => {
  const [forming, setForming] = useState(null);
  const identityRef = useRef("");

  useEffect(() => {
    const identity = `${symbol}:${timeframe}`;
    if (identityRef.current !== identity) { identityRef.current = identity; setForming(null); }
  }, [symbol, timeframe]);

  useEffect(() => {
    if (!enabled || !quote || quote.marketStatus === "closed" || !candles.length) return;
    const price = Number(quote.price);
    const quoteTime = Math.floor(new Date(quote.timestamp).getTime() / 1000);
    const duration = DURATION_SECONDS[timeframe];
    const latest = candles.at(-1);
    if (!Number.isFinite(price) || !Number.isFinite(quoteTime) || !duration || !latest) return;
    const elapsed = Math.max(0, quoteTime - latest.chart_time);
    const targetTime = latest.chart_time + Math.floor(elapsed / duration) * duration;
    setForming((previous) => {
      const base = previous?.chart_time === targetTime ? previous : targetTime === latest.chart_time ? latest : { ...latest, id: undefined, chart_time: targetTime, candle_time: new Date(targetTime * 1000).toISOString(), open: latest.close, high: latest.close, low: latest.close, close: latest.close };
      return { ...base, symbol, timeframe, chart_time: targetTime, high: Math.max(Number(base.high), price), low: Math.min(Number(base.low), price), close: price, isForming: true };
    });
  }, [candles, enabled, quote, symbol, timeframe]);

  return useMemo(() => {
    if (!forming || !enabled) return candles;
    const withoutTarget = candles.filter((candle) => candle.chart_time !== forming.chart_time);
    return [...withoutTarget, forming].sort((a, b) => a.chart_time - b.chart_time);
  }, [candles, enabled, forming]);
};
