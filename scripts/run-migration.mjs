import { readFileSync } from "fs";
import { Client } from "pg";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/run-migration.mjs <path-to-sql-file>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query(sql);
  console.log(`Migration applied successfully: ${file}`);
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
