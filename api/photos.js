const crypto = require("crypto");
const store = require("../lib/store");
const blob = require("../lib/blob");
const auth = require("../lib/auth");
const { withHandler } = require("../lib/handler");

const MAX_CAPTION_LEN = 200;
const MAX_CATEGORY_LEN = 60;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const UNCATEGORIZED = "Uncategorized";
const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/;

function sanitizeText(s, max, fallback) {
  if (typeof s !== "string") return fallback;
  const cleaned = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim().slice(0, max);
  return cleaned || fallback;
}

function getQueryId(req) {
  if (req.query && typeof req.query.id === "string") return req.query.id;
  try {
    return new URL(req.url, "http://localhost").searchParams.get("id");
  } catch (e) {
    return null;
  }
}

module.exports = withHandler(async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "GET") {
    const photos = await store.get("photos", []);
    return res.end(JSON.stringify(photos));
  }

  if (req.method === "POST") {
    if (!auth.requireAdmin(req, res)) return;
    const body = req.body || {};
    const dataUrl = body.dataUrl;

    if (typeof dataUrl !== "string") {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Missing image data." }));
    }
    const match = DATA_URL_RE.exec(dataUrl);
    if (!match) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Unsupported image type." }));
    }
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > MAX_IMAGE_BYTES) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Image too large." }));
    }

    const saved = await blob.putImage(buffer, match[1]);
    const photo = {
      id: crypto.randomBytes(6).toString("hex"),
      url: saved.url,
      pathname: saved.pathname,
      caption: sanitizeText(body.caption, MAX_CAPTION_LEN, "Untitled"),
      category: sanitizeText(body.category, MAX_CATEGORY_LEN, UNCATEGORIZED),
    };

    const photos = await store.get("photos", []);
    photos.push(photo);
    await store.set("photos", photos);
    return res.end(JSON.stringify(photo));
  }

  if (req.method === "DELETE") {
    if (!auth.requireAdmin(req, res)) return;
    const id = getQueryId(req);
    const photos = await store.get("photos", []);
    const target = photos.find((p) => p.id === id);
    if (!target) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Not found." }));
    }
    const remaining = photos.filter((p) => p.id !== id);
    await store.set("photos", remaining);
    blob.deleteImage(target.pathname).catch(() => {});
    return res.end(JSON.stringify({ ok: true }));
  }

  res.statusCode = 405;
  res.end(JSON.stringify({ error: "Method not allowed" }));
});
