import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

// ⛳ Required for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Open the SQLite database
const db = new Database(path.join(__dirname, "orders.db"));

const cols = db.prepare(`PRAGMA table_info(orders)`).all().map(c => c.name);
if (!cols.includes('service_date')) {
  db.prepare(`ALTER TABLE orders ADD COLUMN service_date TEXT`).run();
}


// ✅ Create the table if it doesn't exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    payment_intent_id TEXT,
    amount INTEGER,
    client_name TEXT,
    service_description TEXT,
    service_date TEXT,
    status TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// ✅ Export the database instance
export default db;
