const crypto = require("crypto");

// Reversible (not hashed) storage for temporary passwords, so an admin/manager
// can look one up if a new teacher/manager forgets it before their first login.
// This is intentionally separate from passwordHash (bcrypt, one-way), which is
// what's actually checked at login. AES-256-GCM with a key derived from
// JWT_SECRET keeps it out of plaintext at rest without needing a new env var.
const ALGO = "aes-256-gcm";

function getKey() {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptTempPassword(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Store iv + authTag + ciphertext together, base64-encoded, in one column.
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

function decryptTempPassword(stored) {
  if (!stored) return null;
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

module.exports = { encryptTempPassword, decryptTempPassword };
