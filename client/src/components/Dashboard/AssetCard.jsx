export default function AssetCard({ asset }) {
  const zoneType = asset.activeZone ? asset.activeZone.zone_type : "None";

  const distancePercent =
    asset.zoneProximity?.distancePercent !== undefined &&
    asset.zoneProximity?.distancePercent !== null
      ? `${asset.zoneProximity.distancePercent}%`
      : "N/A";

  const isNearZone =
    asset.zoneProximity?.isNearZone === true ? "Yes" : "No";

  return (
    <div className="card">
      <div className="card-header">
        <h2>{asset.symbol}</h2>

        <span className={asset.status === "Active" ? "active" : "monitoring"}>
          {asset.status}
        </span>
      </div>

      <p>
        <strong>D1:</strong> {asset.dailyBias}
      </p>

      <p>
        <strong>H4:</strong> {asset.h4Bias}
      </p>

      <p>
        <strong>H1:</strong> {asset.h1Trend}
      </p>

      <p>
        <strong>Latest Price:</strong> {asset.latestPrice || "N/A"}
      </p>

      <p>
        <strong>Zone:</strong> {zoneType}
      </p>

      <p>
        <strong>Near Zone:</strong> {isNearZone}
      </p>

      <p>
        <strong>Distance:</strong> {distancePercent}
      </p>

      <div
        className={
          asset.signal === "BUY SETUP" || asset.signal === "SELL SETUP"
            ? "signal valid-signal"
            : "signal wait-signal"
        }
      >
        {asset.signal}
      </div>

      {asset.signalReason && (
        <p className="signal-reason">
          <strong>Reason:</strong> {asset.signalReason}
        </p>
      )}

      {asset.risk && (
        <div className="risk">
          <p>
            <strong>Entry:</strong> {asset.risk.entryPrice}
          </p>
          <p>
            <strong>SL:</strong> {asset.risk.stopLoss}
          </p>
          <p>
            <strong>TP1:</strong> {asset.risk.takeProfit1}
          </p>
          <p>
            <strong>TP2:</strong> {asset.risk.takeProfit2}
          </p>
        </div>
      )}
    </div>
  );
}