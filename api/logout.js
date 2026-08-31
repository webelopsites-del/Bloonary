const auth = require("../lib/auth");
const { withHandler } = require("../lib/handler");

module.exports = withHandler((req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }
  auth.clearSessionCookie(res);
  res.end(JSON.stringify({ ok: true }));
});
