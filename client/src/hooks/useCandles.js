import { useEffect, useState } from "react";
import { getCandles } from "../services/candleService";

export const useCandles = (symbol, timeframe) => {
  const [candles, setCandles] = useState([]);

  const fetchCandles = async () => {
    try {
      const data = await getCandles(symbol, timeframe);
      setCandles(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchCandles();

    const interval = setInterval(fetchCandles, 10000);

    return () => clearInterval(interval);
  }, [symbol, timeframe]);

  return {
    candles,
    refreshCandles: fetchCandles,
  };
};
