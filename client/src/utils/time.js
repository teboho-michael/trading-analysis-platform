const SAST_ZONE = "Africa/Johannesburg";

export const formatSastTime = (value, options = {}) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${new Intl.DateTimeFormat("en-ZA", {
    timeZone: SAST_ZONE,
    hour: "2-digit", minute: "2-digit", second: options.seconds === false ? undefined : "2-digit",
    hour12: false,
  }).format(date)} SAST`;
};

export { SAST_ZONE };
