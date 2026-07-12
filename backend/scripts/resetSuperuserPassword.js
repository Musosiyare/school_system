// One-off recovery tool for a superuser who forgot their password.
//
// There's no role above superuser in this system, so nobody can reset a
// superuser's password from inside the app the way a super resets a manager
// or a manager resets a teacher. This script is the deliberate escape hatch:
// it only works for someone who already has direct access to the server/
// database (e.g. via SSH), which is the appropriate bar for recovering the
// platform's top-level account. It must NOT be exposed as an API endpoint —
// that would let anyone who compromised that route take over every school.
//
// Usage (run from backend/):
//   node scripts/resetSuperuserPassword.js <email> [newPassword]
//
// If newPassword is omitted, a random temporary password is generated and
// printed once. The account is flagged mustChangePassword so whoever logs in
// with it is forced to set their own password immediately, and any existing
// session for that account is invalidated (tokenVersion bump) the same way
// an admin-triggered reset works elsewhere in this system.

require("dotenv").config({ quiet: true });
const bcrypt = require("bcryptjs");
const sequelize = require("../src/config/database");
const { User } = require("../src/models");
const generateTempPassword = require("../src/utils/generatePassword");
const { encryptTempPassword } = require("../src/utils/tempCredentials");

async function main() {
  const email = process.argv[2];
  const suppliedPassword = process.argv[3];

  if (!email) {
    console.error("Usage: node scripts/resetSuperuserPassword.js <email> [newPassword]");
    process.exit(1);
  }

  await sequelize.authenticate();

  const user = await User.findOne({ where: { email, role: "superuser" } });
  if (!user) {
    console.error(`No superuser found with email: ${email}`);
    process.exit(1);
  }

  const tempPassword = suppliedPassword || generateTempPassword();

  user.passwordHash = await bcrypt.hash(tempPassword, 10);
  user.mustChangePassword = true;
  user.tempPasswordEncrypted = encryptTempPassword(tempPassword);
  user.tempPasswordSetAt = new Date();
  user.tempPasswordSetBy = user.id; // self-recovery; no other admin involved
  user.tokenVersion += 1; // kill any existing session immediately
  await user.save();

  console.log(`Password reset for superuser: ${email}`);
  console.log(`Temporary password: ${tempPassword}`);
  console.log("They will be required to set a new password on next login.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to reset superuser password:", err.message);
  process.exit(1);
});
