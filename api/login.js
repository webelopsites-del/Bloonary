const bcrypt = require("bcryptjs");
const auth = require("../lib/auth");
const rateLimit = require("../lib/rateLimit");
const { withHandler } = require("../lib/handler");

module.exports = withHandler(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  if (await rateLimit.isBlocked(req)) {
    res.statusCode = 429;
    return res.end(JSON.stringify({ error: "Too many attempts. Try again in a few minutes." }));
  }

  const body = req.body || {};
  const password = typeof body.password === "string" ? body.password : "";
  const hash = process.env.ADMIN_PASSWORD_HASH;

  if (!hash) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: "Server is not configured (ADMIN_PASSWORD_HASH missing)." }));
  }

  const ok = password.length > 0 && (await bcrypt.compare(password, hash));
  await rateLimit.recordAttempt(req, ok);

  if (!ok) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: "Incorrect password." }));
  }

  auth.setSessionCookie(res);
  res.end(JSON.stringify({ ok: true }));
});
