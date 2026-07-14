import { useCallback, useEffect, useRef, useState } from "react";
import { getLivePrices } from "../services/liveMarketService";

const POLL_INTERVAL_MS = 15000;

export const useLivePrices = (enabled) => {
  const [prices, setPrices] = useState({});
  const [movements, setMovements] = useState({});
  const [status, setStatus] = useState(enabled ? "connecting" : "off");
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const pricesRef = useRef({});

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const result = await getLivePrices();
      const next = Object.fromEntries(result.prices.map((quote) => [quote.symbol, quote]));
      const nextMovement = {};
      for (const [symbol, quote] of Object.entries(next)) {
        const previous = pricesRef.current[symbol]?.price;
        nextMovement[symbol] = previous == null || quote.price == null || quote.price === previous ? "flat" : quote.price > previous ? "up" : "down";
      }
      const quoteTimes = result.prices.map((quote) => new Date(quote.timestamp).getTime()).filter(Number.isFinite);
      pricesRef.current = next;
      const unavailable = result.prices.some((quote) => ["awaiting_mt5_tick", "stale_mt5_tick", "unavailable"].includes(quote.status));
      setPrices(next); setMovements(nextMovement); setLastUpdated(quoteTimes.length ? new Date(Math.max(...quoteTimes)).toISOString() : null); setLastScan(result.lastScan); setStatus(unavailable ? "awaiting_mt5_tick" : result.cacheStatus === "stale_during_scan" ? "cached" : "connected"); setError(unavailable ? "MT5 live tick unavailable or stale. Candle close remains separate." : result.errors?.length ? result.errors.map((item) => `${item.symbol}: ${item.error || item.message}`).join("; ") : "");
    } catch (requestError) {
      setStatus("error");
      setError(requestError.response?.data?.error || requestError.message || "Live prices unavailable");
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) { setStatus("off"); return undefined; }
    setStatus("connecting"); refresh();
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, refresh]);

  return { prices, movements, status, error, lastUpdated, lastScan, refreshIntervalMs: POLL_INTERVAL_MS, refresh };
};
