import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

// ⛳ Required for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Use sqlite3 in verbose mode
const db = new sqlite3.Database(path.join(__dirname, "orders.db"));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      payment_intent_id TEXT,
      amount INTEGER,
      status TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// ✅ Export the database instance
export default db;
