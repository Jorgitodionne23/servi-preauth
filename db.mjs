// db.mjs
import Database from 'better-sqlite3';

// Use a file in the project directory (works on Render too)
const db = new Database('orders.db');

// Optional but recommended
db.pragma('journal_mode = WAL');

// 1) Ensure the table exists with the full schema
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    payment_intent_id TEXT,
    amount INTEGER,
    client_name TEXT,
    service_description TEXT,
    service_date TEXT,
    status TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

// 2) Safe migrations for older DBs (add columns if they don't exist)
const cols = db.prepare(`PRAGMA table_info(orders)`).all().map(c => c.name);

if (!cols.includes('client_name')) {
  db.exec(`ALTER TABLE orders ADD COLUMN client_name TEXT;`);
}
if (!cols.includes('service_description')) {
  db.exec(`ALTER TABLE orders ADD COLUMN service_description TEXT;`);
}
if (!cols.includes('service_date')) {
  db.exec(`ALTER TABLE orders ADD COLUMN service_date TEXT;`);
}
if (!cols.includes('status')) {
  db.exec(`ALTER TABLE orders ADD COLUMN status TEXT;`);
}
if (!cols.includes('created_at')) {
  db.exec(`ALTER TABLE orders ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);
}

export default db;
