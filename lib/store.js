// Key/value storage for site content (about text, contact info, hero URL, photo list).
// Uses a Supabase Postgres table when configured (production); falls back to
// a local JSON file for local development so the app is fully runnable
// without any cloud account.
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "db.json");
const TABLE = "kv_store";

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const { createClient } = require("@supabase/supabase-js");
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// On Vercel, the filesystem is read-only outside /tmp, and /tmp doesn't
// persist across invocations — so the local-file fallback only makes sense
// off Vercel. This check runs lazily (inside get/set, not at module load)
// so a missing configuration surfaces as a clean caught error, not a crash.
function assertUsable() {
  if (!supabase && process.env.VERCEL) {
    throw new Error(
      "No database configured. Create a Supabase project, set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then redeploy."
    );
  }
}

function readLocal() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (e) {
    return {};
  }
}

function writeLocal(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

async function get(key, fallback) {
  assertUsable();
  if (supabase) {
    const { data, error } = await supabase.from(TABLE).select("value").eq("key", key).maybeSingle();
    if (error) throw new Error("Supabase read failed: " + error.message);
    return data ? data.value : fallback;
  }
  const db = readLocal();
  return key in db ? db[key] : fallback;
}

async function set(key, value) {
  assertUsable();
  if (supabase) {
    const { error } = await supabase.from(TABLE).upsert({ key: key, value: value });
    if (error) throw new Error("Supabase write failed: " + error.message);
    return;
  }
  const db = readLocal();
  db[key] = value;
  writeLocal(db);
}

module.exports = { get, set };
