import AssetCard from "./AssetCard";

export default function DashboardGrid({ dashboard }) {
  return (
    <div className="cards">
      {dashboard.map((asset) => (
        <AssetCard key={asset.id} asset={asset} />
      ))}
    </div>
  );
}