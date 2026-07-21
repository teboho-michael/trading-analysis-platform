import { useCallback, useEffect, useRef, useState } from "react";
import { asArray } from "../services/arrays";
import { getLivePrices } from "../services/liveMarketService";

const POLL_INTERVAL_MS = 5000;

export const useLivePrices = (enabled) => {
  const [prices, setPrices] = useState({});
  const [movements, setMovements] = useState({});
  const [status, setStatus] = useState(enabled ? "connecting" : "off");
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const pricesRef = useRef({});
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const result = await getLivePrices();
      const livePrices = asArray(result?.prices);
      const liveErrors = asArray(result?.errors);
      const next = Object.fromEntries(livePrices.map((quote) => [quote.symbol, quote]));
      const nextMovement = {};
      for (const [symbol, quote] of Object.entries(next)) {
        const previous = pricesRef.current[symbol]?.price;
        nextMovement[symbol] = previous == null || quote.price == null || quote.price === previous ? "flat" : quote.price > previous ? "up" : "down";
      }
      const quoteTimes = livePrices.map((quote) => new Date(quote.timestamp).getTime()).filter(Number.isFinite);
      pricesRef.current = next;
      const unavailable = livePrices.some((quote) => ["delayed", "stale", "unavailable"].includes(quote.status));
      setPrices(next); setMovements(nextMovement); setLastUpdated(quoteTimes.length ? new Date(Math.max(...quoteTimes)).toISOString() : null); setLastScan(result?.lastScan); setStatus(unavailable ? "degraded" : "live"); setError(unavailable ? "MT5 live tick unavailable or stale. Candle close remains separate." : liveErrors.length ? liveErrors.map((item) => `${item.symbol}: ${item.error || item.message}`).join("; ") : "");
    } catch (requestError) {
      setStatus("error");
      setError(requestError.response?.data?.error || requestError.message || "Live prices unavailable");
    } finally { inFlightRef.current = false; }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) { setStatus("off"); return undefined; }
    setStatus("connecting"); refresh();
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, refresh]);

  return { prices, movements, status, error, lastUpdated, lastScan, refreshIntervalMs: POLL_INTERVAL_MS, refresh };
};
