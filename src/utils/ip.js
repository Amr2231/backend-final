/**
 * Normalize client IP for rate limiting and geo lookup.
 */
function normalizeIp(ip) {
  if (!ip || typeof ip !== "string") return null;
  let value = ip.trim();
  if (value.startsWith("::ffff:")) value = value.slice(7);
  if (value === "::1") return "127.0.0.1";
  return value;
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  console.log(req.method, req.originalUrl, req.headers["x-forwarded-for"]);
  console.log("client ip =", getClientIp(req));
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return normalizeIp(forwarded.split(",")[0].trim());
  }
  return normalizeIp(req.socket?.remoteAddress ?? null);
}

module.exports = { normalizeIp, getClientIp };
