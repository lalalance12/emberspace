import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

/**
 * Run the pgTAP files in db/tests against DATABASE_URL and fail on any
 * "not ok". Each file wraps itself in begin/rollback, so nothing it seeds
 * survives the run.
 */
const DIR = "db/tests";
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

let failed = 0;
try {
  for (const file of readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()) {
    console.log(`# ${file}`);
    const results = await client.query(readFileSync(join(DIR, file), "utf8"));
    for (const result of [results].flat()) {
      for (const row of result.rows ?? []) {
        for (const value of Object.values(row)) {
          if (typeof value !== "string") continue;
          for (const line of value.split("\n")) {
            if (!/^(ok|not ok|#|\d+\.\.\d+)/.test(line)) continue;
            console.log(line);
            if (line.startsWith("not ok")) failed += 1;
          }
        }
      }
    }
  }
} finally {
  await client.end();
}

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
