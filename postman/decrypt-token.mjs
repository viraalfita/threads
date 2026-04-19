// Decrypt access_token_encrypted dari DB ke plaintext untuk dipakai di Postman.
// Usage:
//   node postman/decrypt-token.mjs "<access_token_encrypted from DB>"
// TOKEN_ENCRYPTION_KEY diambil dari .env.local (pastikan file ada).

import { readFileSync } from "node:fs";
import crypto from "node:crypto";

function loadEnvLocal() {
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnvLocal();

const encrypted = process.argv[2];
if (!encrypted) {
  console.error("Usage: node postman/decrypt-token.mjs \"<iv:tag:ciphertext>\"");
  process.exit(1);
}

const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
if (!keyHex || keyHex.length !== 64) {
  console.error("TOKEN_ENCRYPTION_KEY missing or not 64 hex chars");
  process.exit(1);
}

const [ivHex, tagHex, ctHex] = encrypted.split(":");
const decipher = crypto.createDecipheriv(
  "aes-256-gcm",
  Buffer.from(keyHex, "hex"),
  Buffer.from(ivHex, "hex"),
);
decipher.setAuthTag(Buffer.from(tagHex, "hex"));
const plaintext = Buffer.concat([
  decipher.update(Buffer.from(ctHex, "hex")),
  decipher.final(),
]).toString("utf8");

console.log(plaintext);
