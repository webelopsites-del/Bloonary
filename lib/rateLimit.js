// Brute-force protection for the login endpoint. Tracks failed attempts per IP
// in the same store used for content, with a sliding window.
const store = require("./store");

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function getIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return fwd.split(",")[0].trim();
  return (req.socket && req.socket.remoteAddress) || "unknown";
}

async function isBlocked(req) {
  const record = await store.get(`loginattempts:${getIp(req)}`, null);
  if (!record) return false;
  if (Date.now() - record.windowStart > WINDOW_MS) return false;
  return record.count >= MAX_ATTEMPTS;
}

async function recordAttempt(req, success) {
  const key = `loginattempts:${getIp(req)}`;
  const now = Date.now();
  if (success) {
    await store.set(key, { count: 0, windowStart: now });
    return;
  }
  const record = (await store.get(key, null)) || { count: 0, windowStart: now };
  if (now - record.windowStart > WINDOW_MS) {
    record.count = 0;
    record.windowStart = now;
  }
  record.count += 1;
  await store.set(key, record);
}

module.exports = { isBlocked, recordAttempt };
