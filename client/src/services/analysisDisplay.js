export const confirmationChecklistFor = (asset) =>
  Array.isArray(asset?.confirmationChecklist) ? asset.confirmationChecklist : [];

export const signalLabelFor = (asset) =>
  asset?.latestSignal?.signal_type || asset?.signal || "None";

export const hasRiskObject = (asset) =>
  Boolean(asset?.risk && typeof asset.risk === "object");
