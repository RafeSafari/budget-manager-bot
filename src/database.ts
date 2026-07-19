import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || './data/budget.db';

export interface Transaction {
  id: number;
  chat_id: number;
  user_id: number;
  username: string;
  amount: number;
  currency: string;
  category: string;
  type: 'expense' | 'income';
  description: string;
  original_message: string;
  created_at: string;
}

let db: SqlJsDatabase;

export async function initDatabase(): Promise<void> {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      category TEXT NOT NULL,
      type TEXT CHECK(type IN ('expense', 'income')) NOT NULL,
      description TEXT DEFAULT '',
      original_message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_chat_id ON transactions(chat_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_created_at ON transactions(created_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_category ON transactions(category)');
  db.run('CREATE INDEX IF NOT EXISTS idx_type ON transactions(type)');

  saveDatabase();
}

function saveDatabase(): void {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    console.log(`[DB] Saved to ${DB_PATH} (${buffer.length} bytes)`);
  } catch (error) {
    console.error('[DB] SAVE FAILED:', error);
  }
}

export function insertTransaction(t: Omit<Transaction, 'id'>): number {
  try {
    db.run(
      `INSERT INTO transactions (chat_id, user_id, username, amount, currency, category, type, description, original_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.chat_id, t.user_id, t.username, t.amount, t.currency, t.category, t.type, t.description, t.original_message, t.created_at]
    );

    const result = db.exec('SELECT last_insert_rowid() as id');
    const id = result[0]?.values[0]?.[0] as number;
    saveDatabase();
    console.log(`[DB] Inserted transaction #${id}`);
    return id;
  } catch (error) {
    console.error('[DB] INSERT FAILED:', error);
    return -1;
  }
}

function queryAll(sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);

  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export function getTransactions(
  chatId: number,
  startDate: string,
  endDate?: string,
  type?: 'expense' | 'income'
): Transaction[] {
  let query = 'SELECT * FROM transactions WHERE chat_id = ? AND created_at >= ?';
  const params: any[] = [chatId, startDate];

  if (endDate) {
    query += ' AND created_at <= ?';
    params.push(endDate);
  }

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  query += ' ORDER BY created_at DESC';
  return queryAll(query, params) as Transaction[];
}

export function getCategorySummary(
  chatId: number,
  startDate: string,
  endDate: string,
  type: 'expense' | 'income'
): { category: string; currency: string; total: number; count: number }[] {
  const query = `
    SELECT category, currency, SUM(amount) as total, COUNT(*) as count
    FROM transactions
    WHERE chat_id = ? AND created_at >= ? AND created_at <= ? AND type = ?
    GROUP BY category, currency
    ORDER BY total DESC
  `;
  return queryAll(query, [chatId, startDate, endDate, type]);
}

export function getUserSummary(
  chatId: number,
  startDate: string,
  endDate: string,
  type: 'expense' | 'income'
): { username: string; total: number; count: number }[] {
  const query = `
    SELECT username, SUM(amount) as total, COUNT(*) as count
    FROM transactions
    WHERE chat_id = ? AND created_at >= ? AND created_at <= ? AND type = ?
    GROUP BY user_id
    ORDER BY total DESC
  `;
  return queryAll(query, [chatId, startDate, endDate, type]);
}

export function deleteTransaction(id: number, chatId: number): boolean {
  db.run('DELETE FROM transactions WHERE id = ? AND chat_id = ?', [id, chatId]);
  const changes = db.getRowsModified();
  saveDatabase();
  return changes > 0;
}

export function debugAllTransactions(): any[] {
  return queryAll('SELECT id, chat_id, user_id, username, amount, currency, category, type, created_at FROM transactions ORDER BY id DESC');
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
  }
}
