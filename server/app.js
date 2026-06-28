const express = require("express");
const cors = require("cors");
require("dotenv").config();

const assetRoutes = require("./routes/assetRoutes");
const candleRoutes = require("./routes/candleRoutes");
const analysisRoutes = require("./routes/analysisRoutes");
const signalRoutes = require("./routes/signalRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const zoneRoutes = require("./routes/zoneRoutes");
const marketRoutes = require("./routes/marketRoutes");
const { startMarketScanner } = require("./scheduler/scanScheduler");
const scanRunRoutes = require("./routes/scanRunRoutes");
const signalMonitorRoutes = require("./routes/signalMonitorRoutes");

const app = express();

//startMarketScanner();

app.use(cors());
app.use(express.json());

app.use("/api/assets", assetRoutes);
app.use("/api/candles", candleRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/signals", signalRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/zones", zoneRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/scan-runs", scanRunRoutes);
app.use("/api/signal-monitor", signalMonitorRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
