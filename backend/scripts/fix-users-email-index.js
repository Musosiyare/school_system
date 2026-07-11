// One-time cleanup for the "Too many keys specified; max 64 keys allowed"
// crash on the `users` table.
//
// Cause: sequelize.sync({ alter: true }) ran on every nodemon restart, and
// each run issued `ALTER TABLE users CHANGE email email ... UNIQUE`. MySQL
// doesn't replace an existing unique key when you do this — it just adds
// another one — so the table quietly accumulated dozens of duplicate unique
// keys on `email` until it hit MySQL's 64-key-per-table limit and the app
// stopped starting.
//
// This script drops every extra unique key on `email` (keeping none), then
// adds back exactly one, cleanly named `users_email_unique`. Run it once:
//
//   node scripts/fix-users-email-index.js
//
// Then start the server as usual.
require("dotenv").config();
const sequelize = require("../src/config/database");

async function main() {
  await sequelize.authenticate();

  const [indexes] = await sequelize.query("SHOW INDEX FROM `users` WHERE Column_name = 'email'");

  const nonPrimary = indexes.filter((i) => i.Key_name !== "PRIMARY");
  const uniqueKeyNames = [...new Set(nonPrimary.map((i) => i.Key_name))];

  console.log(`Found ${uniqueKeyNames.length} unique key(s) on users.email:`, uniqueKeyNames);

  for (const keyName of uniqueKeyNames) {
    console.log(`Dropping index ${keyName}...`);
    await sequelize.query(`ALTER TABLE \`users\` DROP INDEX \`${keyName}\``);
  }

  console.log("Adding back a single clean unique index (users_email_unique)...");
  await sequelize.query(
    "ALTER TABLE `users` ADD UNIQUE INDEX `users_email_unique` (`email`)"
  );

  console.log("Done. users.email now has exactly one unique key.");
  await sequelize.close();
}

main().catch((err) => {
  console.error("Cleanup failed:", err.message);
  process.exit(1);
});
