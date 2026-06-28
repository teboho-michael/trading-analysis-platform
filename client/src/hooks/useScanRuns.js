import { useEffect, useState } from "react";
import { getLatestScanRun, getScanRuns } from "../services/scanRunService";

export const useScanRuns = () => {
  const [latestScanRun, setLatestScanRun] = useState(null);
  const [scanRuns, setScanRuns] = useState([]);
  const [loadingScanRuns, setLoadingScanRuns] = useState(true);

  const fetchScanRuns = async () => {
    try {
      const latest = await getLatestScanRun();
      const recent = await getScanRuns();

      setLatestScanRun(latest);
      setScanRuns(recent);
      setLoadingScanRuns(false);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchScanRuns();

    const interval = setInterval(fetchScanRuns, 10000);

    return () => clearInterval(interval);
  }, []);

  return {
    latestScanRun,
    scanRuns,
    loadingScanRuns,
    refreshScanRuns: fetchScanRuns,
  };
};
