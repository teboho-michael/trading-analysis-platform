import { useCallback, useEffect, useRef, useState } from "react";
import { getCandles } from "../services/candleService";

export const useCandles = (symbol, timeframe) => {
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const fetchCandles = useCallback(async ({ showLoading = true } = {}) => {
    const requestId = ++requestIdRef.current;

    try {
      if (showLoading) setLoading(true);
      setError("");

      const data = await getCandles(symbol, timeframe);

      if (requestId !== requestIdRef.current) return;
      setCandles(data);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;

      setCandles([]);
      setError(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Unable to load candles.",
      );
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    setCandles([]);
    fetchCandles({ showLoading: true });

    const interval = setInterval(
      () => fetchCandles({ showLoading: false }),
      120000,
    );

    return () => {
      clearInterval(interval);
      requestIdRef.current += 1;
    };
  }, [fetchCandles]);

  return {
    candles,
    loading,
    error,
    refreshCandles: fetchCandles,
  };
};
