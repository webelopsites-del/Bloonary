// Local development server. Mounts the same handler modules used on Vercel so
// behavior matches production; only the transport (Express vs. Vercel's
// runtime) differs. Run with: npm run dev
require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "10mb" }));

function mount(modPath) {
  const handler = require(modPath);
  return (req, res) => handler(req, res);
}

app.get("/api/session", mount("../api/session"));
app.post("/api/login", mount("../api/login"));
app.post("/api/logout", mount("../api/logout"));
app.get("/api/content", mount("../api/content"));
app.put("/api/content", mount("../api/content"));
app.get("/api/photos", mount("../api/photos"));
app.post("/api/photos", mount("../api/photos"));
app.delete("/api/photos", mount("../api/photos"));

app.use("/uploads", express.static(path.join(process.cwd(), "data", "uploads")));
app.get("/", (req, res) => res.sendFile(path.join(process.cwd(), "index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Gallery site running at http://localhost:${PORT}`);
  if (!process.env.ADMIN_PASSWORD_HASH || !process.env.JWT_SECRET) {
    console.log("Note: ADMIN_PASSWORD_HASH and/or JWT_SECRET are not set in .env — sign-in will fail until they are.");
  }
});
