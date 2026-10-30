import { readFileSync } from "node:fs";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";

/**
 * Load db/seed.sql: five teammates on one team at every rung of the decay
 * ladder plus a fresh test account, all with the password "password123".
 *
 * The password is hashed here with Better Auth's own hasher and handed to the
 * SQL as a setting, so the seeded accounts sign in through the real form —
 * the e2e test depends on it.
 */
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("begin");
  await client.query("select set_config('workspace.seed_password_hash', $1, true)", [await hashPassword("password123")]);
  await client.query(readFileSync("db/seed.sql", "utf8"));
  await client.query("commit");
  console.log("Seeded. Sign in as test@example.com / password123.");
} catch (error) {
  await client.query("rollback");
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
