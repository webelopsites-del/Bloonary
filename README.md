# Bloonery — Balloon Decor Site

A single-page site (Home / About Us / Gallery / Contact Us) for a balloon
decor business, with a full-bleed looped video hero, an owner-only sign-in
for managing content, and a real serverless API backend. This started as a
fork of a photography gallery site template, restyled for a different
brand — the auth/storage architecture is unchanged; only the design and a
couple of content fields (Instagram, WhatsApp) differ.

## Architecture

- `index.html` — the whole front end (HTML, CSS, JS), talks to the API below via `fetch`
- `api/` — Vercel serverless functions (Node.js)
  - `login.js` / `logout.js` / `session.js` — owner authentication
  - `content.js` — about text, contact info, cover photo
  - `photos.js` — gallery photo list, upload, delete
- `lib/` — shared server code (auth/session, storage, image storage, rate limiting)
- `server/dev-server.js` — a small Express server that mounts the same `api/` handlers, so `npm run dev` runs the whole thing locally with no cloud account needed
- `assets/hero-video.mp4` — the looped, muted background video behind the hero heading (static site asset, not admin-uploadable — swap the file directly if you need a different clip)

### Storage

- **Local development**: content is stored in `data/db.json`, images in `data/uploads/` (both git-ignored, created automatically).
- **Production (Vercel)**: content is stored in a Postgres table and images in a Storage bucket, both on [Supabase](https://supabase.com) (free tier: 500MB database + 1GB file storage). Vercel's filesystem is not persistent, so real deployments need this — see setup below. If it's not connected, the API returns a clear error telling you so instead of crashing.

The same code runs in both places; it just checks which environment variables are set.

## Security model

- The owner password is never stored or sent in plaintext to the browser. You generate a **bcrypt hash** of it once and set that as an environment variable; the server compares hashes.
- Sign-in issues a signed **JWT in an httpOnly, `Secure`, `SameSite=Strict` cookie** — JavaScript can't read it, and it isn't sent cross-site. There is no client-side password check to bypass.
- Every write endpoint (`PUT /api/content`, `POST`/`DELETE /api/photos`) independently verifies that cookie server-side, regardless of what the page's UI shows.
- Login attempts are rate-limited per IP (8 attempts / 15 minutes) to slow down brute-forcing.
- Uploaded images are validated by decoded content type and size (max 8MB) before being stored.
- User-supplied text (captions, categories, about text, contact fields) is sanitized and length-capped server-side, and escaped on render to prevent stored XSS.

## Running locally

Requires [Node.js](https://nodejs.org) (LTS).

```bash
npm install
npm run gen-secret        # copy the output
npm run hash-password     # type a password, copy the resulting hash
```

Create a `.env` file (copy `.env.example`) and fill in:

```
ADMIN_PASSWORD_HASH=<hash from npm run hash-password>
JWT_SECRET=<value from npm run gen-secret>
```

Leave `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` blank — locally the app falls back to files under `data/`.

```bash
npm run dev
```

Open http://localhost:3000. Sign in with the password you hashed above.

## Setting up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and run:
   ```sql
   create table if not exists kv_store (
     key text primary key,
     value jsonb not null,
     updated_at timestamptz not null default now()
   );
   ```
3. Go to **Storage** → **New bucket** → name it `photos` → toggle **Public bucket** on → create.
4. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** secret key (not the `anon` key) → `SUPABASE_SERVICE_ROLE_KEY`

The service role key bypasses row-level security, which is fine here since it's only ever used server-side (in the `api/` functions) and every write is already gated by the app's own owner-login check — never expose it to the browser.

## Deploying to Vercel

1. Push this repo to GitHub (see below) and [import it into Vercel](https://vercel.com/new).
2. In Project Settings → Environment Variables, add:
   - `ADMIN_PASSWORD_HASH` — from `npm run hash-password`
   - `JWT_SECRET` — from `npm run gen-secret`
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — from the Supabase setup above
3. Deploy (or redeploy after adding the env vars so the functions pick them up).

Your local `data/` folder is dev-only and is never deployed (it's git-ignored) — production data lives entirely in Supabase.

## Pushing to GitHub

```bash
git init
git add .
git commit -m "Initial commit: gallery site with secure backend"
git remote add origin <your-repo-url>
git branch -M main
git push -u origin main
```

## What the owner can do once signed in

- Upload photos to the gallery, sorted into categories (existing or new)
- Delete photos
- Edit the About section text
- Edit the contact info (Instagram, phone, WhatsApp, email, location)
- Upload a hero/cover photo

## Known limitations

- Single owner account (one shared password), no multi-user roles
- No image cropping/editing — photos are resized on upload (client-side canvas) but not otherwise adjustable
- No pagination on the stored photo list — fine for a personal gallery of up to a few hundred photos, not designed for large-scale media libraries
