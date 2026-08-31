const store = require("../lib/store");
const blob = require("../lib/blob");
const auth = require("../lib/auth");
const { withHandler } = require("../lib/handler");

const DEFAULT_ABOUT =
  "At Bloonery, we believe every celebration deserves that extra touch. From elegant balloon arrangements to fun and creative setups, we design décor that brings your moments to life.\n\nWhether it's a birthday, baby shower, wedding or any special occasion, we're here to make it pop!";
const DEFAULT_CONTACT = { phone: "07956 123456", whatsapp: "07956 123456", email: "hello@bloonery.com", location: "Stamford Hill, London", instagram: "@bloonery.events" };
const DEFAULT_BRAND = { name: "Bloonery", sub: "Making every moment pop" };

const MAX_ABOUT_LEN = 4000;
const MAX_FIELD_LEN = 200;
const MAX_BRAND_LEN = 60;
const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/;

function sanitizeText(s, max) {
  if (typeof s !== "string") return "";
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").slice(0, max);
}

async function saveImageField(key, dataUrl) {
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) return false;
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 8 * 1024 * 1024) return false;

  const oldPathname = await store.get(key + "Pathname", null);
  const saved = await blob.putImage(buffer, match[1]);
  await store.set(key, saved.url);
  await store.set(key + "Pathname", saved.pathname);
  if (oldPathname) blob.deleteImage(oldPathname).catch(() => {});
  return true;
}

async function clearImageField(key) {
  const oldPathname = await store.get(key + "Pathname", null);
  if (oldPathname) blob.deleteImage(oldPathname).catch(() => {});
  await store.set(key, null);
  await store.set(key + "Pathname", null);
}

module.exports = withHandler(async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "GET") {
    const [about, contact, hero, portrait, brand] = await Promise.all([
      store.get("about", DEFAULT_ABOUT),
      store.get("contact", DEFAULT_CONTACT),
      store.get("hero", null),
      store.get("portrait", null),
      store.get("brand", DEFAULT_BRAND),
    ]);
    return res.end(JSON.stringify({ about, contact, hero, portrait, brand }));
  }

  if (req.method === "PUT") {
    if (!auth.requireAdmin(req, res)) return;
    const body = req.body || {};

    if (typeof body.about === "string") {
      await store.set("about", sanitizeText(body.about, MAX_ABOUT_LEN));
    }

    if (body.contact && typeof body.contact === "object") {
      await store.set("contact", {
        instagram: sanitizeText(body.contact.instagram, MAX_FIELD_LEN),
        phone: sanitizeText(body.contact.phone, MAX_FIELD_LEN),
        whatsapp: sanitizeText(body.contact.whatsapp, MAX_FIELD_LEN),
        email: sanitizeText(body.contact.email, MAX_FIELD_LEN),
        location: sanitizeText(body.contact.location, MAX_FIELD_LEN),
      });
    }

    if (body.brand && typeof body.brand === "object") {
      const name = sanitizeText(body.brand.name, MAX_BRAND_LEN).trim();
      if (!name) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Site name can't be empty." }));
      }
      await store.set("brand", {
        name: name,
        sub: sanitizeText(body.brand.sub, MAX_BRAND_LEN).trim(),
      });
    }

    if (typeof body.hero === "string" && body.hero) {
      const saved = await saveImageField("hero", body.hero);
      if (!saved) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Invalid or oversized cover photo." }));
      }
    } else if (body.hero === null) {
      await clearImageField("hero");
    }

    if (typeof body.portrait === "string" && body.portrait) {
      const saved = await saveImageField("portrait", body.portrait);
      if (!saved) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Invalid or oversized portrait photo." }));
      }
    } else if (body.portrait === null) {
      await clearImageField("portrait");
    }

    const [hero, portrait, brand] = await Promise.all([
      store.get("hero", null),
      store.get("portrait", null),
      store.get("brand", DEFAULT_BRAND),
    ]);
    return res.end(JSON.stringify({ ok: true, hero, portrait, brand }));
  }

  res.statusCode = 405;
  res.end(JSON.stringify({ error: "Method not allowed" }));
});
