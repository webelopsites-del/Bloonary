// Generates a bcrypt hash of an owner password for ADMIN_PASSWORD_HASH.
// Run with: npm run hash-password
const bcrypt = require("bcryptjs");
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question("Enter the owner password to hash: ", (password) => {
  if (!password) {
    console.error("Password cannot be empty.");
    rl.close();
    process.exit(1);
  }
  const hash = bcrypt.hashSync(password, 12);
  console.log("\nAdd this to your environment variables as ADMIN_PASSWORD_HASH:\n");
  console.log(hash);
  console.log("\nLocally: put it in .env");
  console.log("On Vercel: Project Settings -> Environment Variables\n");
  rl.close();
});
