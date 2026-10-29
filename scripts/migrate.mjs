import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

/**
 * Apply db/migrations to DATABASE_URL, in filename order, once each.
 *
 *   pnpm db:migrate              apply anything not yet applied
 *   pnpm db:reset --yes          drop the app's schemas and apply from scratch
 *
 * Each file runs in its own transaction and is recorded in
 * public.schema_migrations, so a failure stops at that file and leaves the ones
 * before it applied. Re-running picks up where it stopped.
 *
 * Reset drops public, auth and extensions — every table, every row. It exists
 * because this project's data is disposable test data; it refuses to run
 * without --yes so nobody does it by accident.
 */
const DIR = "db/migrations";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Pull it with `vercel env pull .env.local`, then run with --env-file=.env.local.");
  process.exit(1);
}

const reset = process.argv.includes("--reset");
if (reset && !process.argv.includes("--yes")) {
  console.error("Reset drops every table in public, auth and extensions. Re-run with --yes if that is what you want.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  if (reset) {
    await client.query(`
      drop schema if exists public cascade;
      drop schema if exists auth cascade;
      drop schema if exists extensions cascade;
      create schema public;
      grant usage, create on schema public to current_user;
    `);
    console.log("Dropped public, auth and extensions.");
  }

  await client.query(`
    create table if not exists public.schema_migrations (
      version    text        primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const applied = new Set(
    (await client.query("select version from public.schema_migrations")).rows.map((r) => r.version),
  );

  const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
  let count = 0;

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = readFileSync(join(DIR, file), "utf8");
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into public.schema_migrations (version) values ($1)", [file]);
      await client.query("commit");
      console.log(`applied  ${file}`);
      count += 1;
    } catch (error) {
      await client.query("rollback");
      console.error(`failed   ${file}\n${error.message}`);
      process.exitCode = 1;
      break;
    }
  }

  if (process.exitCode !== 1) console.log(count ? `Done: ${count} applied.` : "Up to date.");
} finally {
  await client.end();
}
