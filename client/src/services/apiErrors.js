const looksLikeHtml = (value) =>
  typeof value === "string" && /<\s*(!doctype|html|body)\b/i.test(value);

export const apiErrorMessage = (error, fallback = "Request failed.") => {
  const responseData = error?.response?.data;

  if (looksLikeHtml(responseData)) {
    return "Backend API returned the frontend page instead of JSON. Check the /api proxy routing.";
  }

  if (typeof responseData === "string" && responseData.trim()) {
    return responseData.length > 160
      ? `${responseData.slice(0, 157)}...`
      : responseData;
  }

  return (
    responseData?.error ||
    responseData?.message ||
    error?.message ||
    fallback
  );
};
