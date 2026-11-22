import assert from "node:assert/strict";
import { test } from "node:test";

process.env.JWT_SECRET = "test-jwt-secret-with-enough-length-1234567890";
process.env.SITE_URL = "http://localhost:3000"; process.env.DATABASE_URL ??= "postgres://x@localhost/x_test";
Object.assign(process.env, { STRIPE_SECRET_KEY: "x", STRIPE_WEBHOOK_SECRET: "x", VIPPS_BASE_URL: "x", VIPPS_CLIENT_ID: "x", VIPPS_CLIENT_SECRET: "x", VIPPS_SUBSCRIPTION_KEY: "x", VIPPS_MSN: "x" });

// RFC 6238 appendix B test vectors (SHA-1, secret "12345678901234567890"); the RFC lists 8-digit codes, ours are the last 6 digits.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("matches the RFC 6238 test vectors", async () => {
  const { codeFor, stepAt } = await import("../src/totp.js");
  for (const [t, eight] of [[59, "94287082"], [1111111109, "07081804"], [1111111111, "14050471"], [1234567890, "89005924"], [2000000000, "69279037"]] as const)
    assert.equal(codeFor(RFC_SECRET, stepAt(t * 1000)), eight.slice(2), `t=${t}`);
});

test("accepts the neighbouring steps (clock drift) but not older ones, and only 6 digits", async () => {
  const { codeFor, stepAt, verifyCode } = await import("../src/totp.js");
  const now = 1_700_000_000_000, step = stepAt(now);
  assert.equal(verifyCode(RFC_SECRET, codeFor(RFC_SECRET, step), now), step);
  assert.equal(verifyCode(RFC_SECRET, codeFor(RFC_SECRET, step - 1), now), step - 1);
  assert.equal(verifyCode(RFC_SECRET, codeFor(RFC_SECRET, step + 1), now), step + 1);
  assert.equal(verifyCode(RFC_SECRET, codeFor(RFC_SECRET, step - 2), now), null);
  assert.equal(verifyCode(RFC_SECRET, "12345", now), null);
  assert.equal(verifyCode(RFC_SECRET, "abcdef", now), null);
  assert.equal(verifyCode(RFC_SECRET, codeFor(RFC_SECRET, step).replace(/(\d{3})(\d{3})/, "$1 $2"), now), step, "spaces are fine");
});

test("base32 round trip, encrypted secrets, recovery codes", async () => {
  const { base32Encode, base32Decode, newSecret, encryptSecret, decryptSecret, newRecoveryCodes, hashRecovery, otpauthUri } = await import("../src/totp.js");
  assert.equal(base32Decode(base32Encode(Buffer.from("hello world"))).toString(), "hello world");
  const s = newSecret();
  assert.match(s, /^[A-Z2-7]{32}$/);
  const enc = encryptSecret(s);
  assert.ok(!enc.includes(s), "stored form does not contain the secret");
  assert.equal(decryptSecret(enc), s);
  assert.notEqual(encryptSecret(s), enc, "fresh IV every time");
  assert.throws(() => decryptSecret(enc.replace(/.$/, (c) => (c === "A" ? "B" : "A"))), "tampering is detected");
  const rc = newRecoveryCodes();
  assert.equal(new Set(rc.plain).size, 8); assert.match(rc.plain[0], /^[0-9a-f]{4}-[0-9a-f]{4}$/);
  assert.equal(rc.hashes[0], hashRecovery(` ${rc.plain[0].toUpperCase()} `), "case and spaces do not matter");
  assert.match(otpauthUri("a@b.no", s), /^otpauth:\/\/totp\/BikeLink%20Admin:a%40b\.no\?secret=[A-Z2-7]{32}&issuer=/);
});
