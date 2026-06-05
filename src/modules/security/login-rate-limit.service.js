// /**
//  * IP/source-based login rate limiting.
//  * Blocks further login attempts for 15 minutes after 3 failures from the same source.
//  */
// const MAX_ATTEMPTS = 3;
// const LOCKOUT_MS = 15 * 60 * 1000;

// /** @type {Map<string, { attempts: number; lockedUntil: number | null }>} */
// const attemptsBySource = new Map();

// function getSourceKey(ip, identifier = "") {
//   const normalizedIp = ip || "unknown";
//   const normalizedId = String(identifier || "")
//     .trim()
//     .toLowerCase();
//   return `${normalizedIp}|${normalizedId}`;
// }

// exports.checkSourceLockout = (ip, identifier = "") => {
//   const key = getSourceKey(ip, identifier);
//   const entry = attemptsBySource.get(key);

//   console.log("RATE LIMIT CHECK");
//   console.log("KEY =", key);
//   console.log("ENTRY =", entry);

//   if (!entry?.lockedUntil) return;

//   if (Date.now() < entry.lockedUntil) {
//     console.log("LOCKED!");
//     throw {
//       status: 429,
//       message: "Too many login attempts. Please try again later.",
//     };
//   }

//   attemptsBySource.delete(key);
// };

// exports.recordFailedAttempt = (ip, identifier = "") => {
//   const key = getSourceKey(ip, identifier);
//   const entry = attemptsBySource.get(key) ?? { attempts: 0, lockedUntil: null };
//   const attempts = entry.attempts + 1;
//   const lockedUntil = attempts >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : null;

//   attemptsBySource.set(key, { attempts, lockedUntil });
//   return { attempts, locked: attempts >= MAX_ATTEMPTS };
// };

// exports.clearSourceAttempts = (ip, identifier = "") => {
//   attemptsBySource.delete(getSourceKey(ip, identifier));
// };

/**
 * IP/source-based login rate limiting.
 * ⚠️ تم دمج هذا النظام مع securityService (DB-based) لتجنب فقدان البيانات عند restart.
 * الملف ده بقى stub فاضي عشان منكسرش أي imports موجودة.
 * كل العمليات دلوقتي بتتعمل في security.service.js عن طريق الـ database.
 */

// ==========================================
// CHECK SOURCE LOCKOUT
// ==========================================
exports.checkSourceLockout = () => {
  // handled by securityService (DB-based)
};

// ==========================================
// RECORD FAILED ATTEMPT
// ==========================================
exports.recordFailedAttempt = () => {
  // handled by securityService (DB-based)
};

// ==========================================
// CLEAR SOURCE ATTEMPTS
// ==========================================
exports.clearSourceAttempts = () => {
  // handled by securityService (DB-based)
};
