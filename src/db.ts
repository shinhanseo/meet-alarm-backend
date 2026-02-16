import { Pool } from "pg";
import "dotenv/config";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}

const u = new URL(process.env.DATABASE_URL);


export const pool = new Pool({
  host: u.hostname,
  port: Number(u.port || 5432),
  database: u.pathname.replace("/", ""),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  ssl: { rejectUnauthorized: false },
});

console.log("[db] host=", u.hostname, "port=", u.port, "user=", u.username, "db=", u.pathname);