// Direct Postgres access to Neon via `pg`. Only ever imported from server-side
// code (API routes) — DATABASE_URL is a secret, never sent to the browser.
import { Pool, types } from "pg";

// `pg` returns NUMERIC columns as strings by default (to avoid float precision
// loss on huge values), but every numeric column in this schema is a small
// score/weight/total that's safe as a JS number — parse it as one everywhere,
// once, instead of remembering to coerce it at each call site.
types.setTypeParser(1700 /* numeric */, (value: string) => parseFloat(value));

const globalForPg = globalThis as unknown as { pgPool?: Pool };

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!globalForPg.pgPool) {
    globalForPg.pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return globalForPg.pgPool;
}

type Json = Record<string, unknown>;

// A tiny "eq" filter marker, kept for call-site compatibility with the
// db.select/update helpers below: eq("some-id") just means "= 'some-id'".
export function eq(value: string) {
  return { __eq: value };
}
type Filter = { __eq: string };
function isFilter(v: unknown): v is Filter {
  return typeof v === "object" && v !== null && "__eq" in v;
}

function toColumn(key: string) {
  // simple allowlist-style escaping: identifiers here are always our own column names
  return `"${key.replace(/"/g, "")}"`;
}

export const db = {
  async select<T = any>(
    table: string,
    params: Record<string, string | Filter | undefined> = {}
  ): Promise<T[]> {
    const pool = getPool();
    const where: string[] = [];
    const values: unknown[] = [];
    let orderClause = "";

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      if (key === "order") {
        // "column.asc" | "column.desc" | "column.desc.nullslast"
        const parts = String(value).split(".");
        const column = parts[0];
        const dir = parts[1]?.toUpperCase() === "DESC" ? "DESC" : "ASC";
        const nulls = parts[2] === "nullslast" ? "NULLS LAST" : parts[2] === "nullsfirst" ? "NULLS FIRST" : "";
        orderClause = ` ORDER BY ${toColumn(column)} ${dir} ${nulls}`.trim();
        continue;
      }
      if (isFilter(value)) {
        values.push(value.__eq);
        where.push(`${toColumn(key)} = $${values.length}`);
      } else {
        values.push(value);
        where.push(`${toColumn(key)} = $${values.length}`);
      }
    }

    const whereClause = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    const sql = `SELECT * FROM ${toColumn(table)}${whereClause}${orderClause ? " " + orderClause : ""}`;
    const result = await pool.query(sql, values);
    return result.rows as T[];
  },

  async insert<T = any>(table: string, row: Json): Promise<T> {
    const pool = getPool();
    const keys = Object.keys(row);
    const columns = keys.map(toColumn).join(", ");
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const values = keys.map((k) => normalizeValue(row[k]));
    const sql = `INSERT INTO ${toColumn(table)} (${columns}) VALUES (${placeholders}) RETURNING *`;
    const result = await pool.query(sql, values);
    return result.rows[0] as T;
  },

  async insertMany<T = any>(table: string, rows: Json[]): Promise<T[]> {
    if (rows.length === 0) return [];
    const pool = getPool();
    const keys = Object.keys(rows[0]);
    const columns = keys.map(toColumn).join(", ");
    const values: unknown[] = [];
    const tuples = rows.map((row) => {
      const placeholders = keys.map((k) => {
        values.push(normalizeValue(row[k]));
        return `$${values.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    const sql = `INSERT INTO ${toColumn(table)} (${columns}) VALUES ${tuples.join(", ")} RETURNING *`;
    const result = await pool.query(sql, values);
    return result.rows as T[];
  },

  async update<T = any>(table: string, filter: Record<string, Filter | string>, patch: Json): Promise<T> {
    const pool = getPool();
    const setKeys = Object.keys(patch);
    const values: unknown[] = setKeys.map((k) => normalizeValue(patch[k]));
    const setClause = setKeys.map((k, i) => `${toColumn(k)} = $${i + 1}`).join(", ");

    const where: string[] = [];
    for (const [key, value] of Object.entries(filter)) {
      const v = isFilter(value) ? value.__eq : value;
      values.push(v);
      where.push(`${toColumn(key)} = $${values.length}`);
    }
    const whereClause = where.length ? ` WHERE ${where.join(" AND ")}` : "";

    const sql = `UPDATE ${toColumn(table)} SET ${setClause}${whereClause} RETURNING *`;
    const result = await pool.query(sql, values);
    return result.rows[0] as T;
  },

  // Escape hatch for operations the helpers above don't cover (e.g. delete).
  // Callers are trusted, internal call sites only — never pass user input as `sql`.
  async raw<T = any>(sql: string, values: unknown[] = []): Promise<T[]> {
    const pool = getPool();
    const result = await pool.query(sql, values);
    return result.rows as T[];
  },
};

function normalizeValue(value: unknown) {
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  return value;
}
