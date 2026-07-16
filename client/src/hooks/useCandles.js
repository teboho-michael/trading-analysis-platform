import { useCallback, useEffect, useRef, useState } from "react";
import { getCandles } from "../services/candleService";

export const useCandles = (symbol, timeframe) => {
  const [candles, setCandles] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);

  const fetchCandles = useCallback(async ({ showLoading = true } = {}) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const requestId = ++requestIdRef.current;

    try {
      if (showLoading) setLoading(true);
      setError("");

      const data = await getCandles(symbol, timeframe);

      if (requestId !== requestIdRef.current) return;
      setCandles(data.candles);
      setMetadata(data.metadata);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;

      setCandles([]);
      setMetadata(null);
      setError(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Unable to load candles.",
      );
    } finally {
      inFlightRef.current = false;
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    setCandles([]);
    setMetadata(null);
    fetchCandles({ showLoading: true });

    const interval = setInterval(
      () => fetchCandles({ showLoading: false }),
      30000,
    );

    return () => {
      clearInterval(interval);
      requestIdRef.current += 1;
    };
  }, [fetchCandles]);

  return {
    candles,
    metadata,
    loading,
    error,
    refreshCandles: fetchCandles,
  };
};
