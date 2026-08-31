// Owner session handling: a signed, httpOnly JWT cookie. The password itself
// is never stored or shipped to the browser — only a bcrypt hash lives server-side.
const jwt = require("jsonwebtoken");
const cookie = require("cookie");

const COOKIE_NAME = "session";
const isProd = process.env.NODE_ENV === "production";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}

function verifyRequest(req) {
  const cookies = cookie.parse(req.headers.cookie || "");
  const token = cookies[COOKIE_NAME];
  if (!token) return false;
  try {
    const payload = jwt.verify(token, getSecret());
    return !!payload.admin;
  } catch (e) {
    return false;
  }
}

function setSessionCookie(res) {
  const token = jwt.sign({ admin: true }, getSecret(), { expiresIn: "7d" });
  res.setHeader(
    "Set-Cookie",
    cookie.serialize(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    })
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    cookie.serialize(COOKIE_NAME, "", {
      httpOnly: true,
      secure: isProd,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    })
  );
}

// Call at the top of any mutating handler. Writes the 401 response and
// returns false if the caller should stop; returns true if the request may proceed.
function requireAdmin(req, res) {
  if (!verifyRequest(req)) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Not authenticated" }));
    return false;
  }
  return true;
}

module.exports = { verifyRequest, setSessionCookie, clearSessionCookie, requireAdmin };
