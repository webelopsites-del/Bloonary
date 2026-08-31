// Generates a random secret for JWT_SECRET.
// Run with: npm run gen-secret
const crypto = require("crypto");
console.log(crypto.randomBytes(32).toString("hex"));
