// Wraps an API handler so an unexpected exception becomes a logged, JSON 500
// response instead of Vercel's raw FUNCTION_INVOCATION_FAILED crash page.
function withHandler(fn) {
  return async function (req, res) {
    try {
      await fn(req, res);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Internal server error: " + (err && err.message ? err.message : "unknown") }));
      }
    }
  };
}

module.exports = { withHandler };
