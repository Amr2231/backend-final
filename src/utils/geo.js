const { normalizeIp } = require("./ip");

let geoip;
try {
  geoip = require("geoip-lite");
} catch {
  geoip = null;
}

function lookupGeo(ip) {
  const normalized = normalizeIp(ip);
  if (!normalized) {
    return {
      country: "Unknown",
      region: null,
      city: "Unknown",
      timezone: null,
      ll: null,
    };
  }

  if (
    normalized === "127.0.0.1" ||
    normalized.startsWith("192.168.") ||
    normalized.startsWith("10.") ||
    normalized.startsWith("172.16.") ||
    normalized.startsWith("172.17.") ||
    normalized.startsWith("172.18.") ||
    normalized.startsWith("172.19.") ||
    normalized.startsWith("172.2") ||
    normalized.startsWith("172.30.") ||
    normalized.startsWith("172.31.")
  ) {
    return {
      country: "Local",
      region: "Local",
      city: "Local Network",
      timezone: null,
      ll: null,
    };
  }

  if (!geoip) {
    return {
      country: "Unknown",
      region: null,
      city: "Unknown",
      timezone: null,
      ll: null,
    };
  }

  const geo = geoip.lookup(normalized);
  if (!geo) {
    return {
      country: "Unknown",
      region: null,
      city: "Unknown",
      timezone: null,
      ll: null,
    };
  }

  return {
    country: geo.country || "Unknown",
    region: geo.region || null,
    city: geo.city || "Unknown",
    timezone: geo.timezone || null,
    ll: geo.ll || null,
  };
}

module.exports = { lookupGeo };
