/**
 * IP/source-based login rate limiting.
 * Blocks further login attempts for 15 minutes after 3 failures from the same source.
 */
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 15 * 60 * 1000;

/** @type {Map<string, { attempts: number; lockedUntil: number | null }>} */
const attemptsBySource = new Map();

function getSourceKey(ip, identifier = "") {
  const normalizedIp = ip || "unknown";
  const normalizedId = String(identifier || "")
    .trim()
    .toLowerCase();
  return `${normalizedIp}|${normalizedId}`;
}

exports.checkSourceLockout = (ip, identifier = "") => {
  const key = getSourceKey(ip, identifier);
  const entry = attemptsBySource.get(key);
  if (!entry?.lockedUntil) return;

  if (Date.now() < entry.lockedUntil) {
    throw {
      status: 429,
      message: "Too many login attempts. Please try again later.",
    };
  }

  attemptsBySource.delete(key);
};

exports.recordFailedAttempt = (ip, identifier = "") => {
  const key = getSourceKey(ip, identifier);
  const entry = attemptsBySource.get(key) ?? { attempts: 0, lockedUntil: null };
  const attempts = entry.attempts + 1;
  const lockedUntil =
    attempts >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : null;

  attemptsBySource.set(key, { attempts, lockedUntil });
  return { attempts, locked: attempts >= MAX_ATTEMPTS };
};

exports.clearSourceAttempts = (ip, identifier = "") => {
  attemptsBySource.delete(getSourceKey(ip, identifier));
};
