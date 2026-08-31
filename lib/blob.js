// Image storage. Uses a Supabase Storage bucket when configured (production);
// falls back to writing files under data/uploads for local development.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const BUCKET = "photos";
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const { createClient } = require("@supabase/supabase-js");
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function extFromMime(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function assertUsable() {
  if (!supabase && process.env.VERCEL) {
    throw new Error(
      "No storage configured. Create a Supabase project, set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then redeploy."
    );
  }
}

async function putImage(buffer, mime) {
  assertUsable();
  const ext = extFromMime(mime);
  const filename = `${crypto.randomBytes(9).toString("hex")}.${ext}`;

  if (supabase) {
    const { error } = await supabase.storage.from(BUCKET).upload(filename, buffer, {
      contentType: mime,
      upsert: false,
    });
    if (error) throw new Error("Supabase upload failed: " + error.message);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    return { url: data.publicUrl, pathname: filename };
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return { url: `/uploads/${filename}`, pathname: filename };
}

async function deleteImage(pathname) {
  if (!pathname) return;
  if (supabase) {
    await supabase.storage.from(BUCKET).remove([pathname]).catch(() => {});
    return;
  }
  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(pathname)));
  } catch (e) {
    // already gone — fine
  }
}

module.exports = { putImage, deleteImage };
