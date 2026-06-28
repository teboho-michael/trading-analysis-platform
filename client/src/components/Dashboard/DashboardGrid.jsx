import AssetCard from "./AssetCard";

export default function DashboardGrid({
  dashboard,
  selectedAsset,
  onAssetSelect,
}) {
  return (
    <div className="cards">
      {dashboard.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          selected={asset.symbol === selectedAsset}
          onSelect={onAssetSelect}
        />
      ))}
    </div>
  );
}
