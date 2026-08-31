const auth = require("../lib/auth");
const { withHandler } = require("../lib/handler");

module.exports = withHandler((req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ isAdmin: auth.verifyRequest(req) }));
});
