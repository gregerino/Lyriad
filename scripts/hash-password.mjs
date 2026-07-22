#!/usr/bin/env node
// Generates the env values needed for auth:
//   node scripts/hash-password.mjs <password>
//
// Prints AUTH_PASSWORD_HASH (scrypt hash of the given password) and a
// freshly generated SESSION_SECRET. Paste both into your env (`vercel env
// add` or `.env.local`).

import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.mjs <password>");
  process.exit(1);
}

const salt = randomBytes(16);
const derivedKey = scryptSync(password, salt, 64);
const hash = `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
const sessionSecret = randomBytes(32).toString("hex");

console.log(`AUTH_PASSWORD_HASH=${hash}`);
console.log(`SESSION_SECRET=${sessionSecret}`);
