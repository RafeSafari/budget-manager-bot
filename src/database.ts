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

export interface Category {
  id: number;
  name: string;
  type: 'expense' | 'income';
  keywords: string[];
  usage_count: number;
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

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      chat_id INTEGER PRIMARY KEY,
      language TEXT DEFAULT 'fa'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('expense', 'income')) NOT NULL,
      keywords TEXT DEFAULT '[]',
      usage_count INTEGER DEFAULT 0,
      UNIQUE(name, type)
    )
  `);

  seedDefaultCategories();
  saveDatabase();
}

function seedDefaultCategories(): void {
  const existing = queryAll('SELECT COUNT(*) as cnt FROM categories');
  if (existing[0]?.cnt > 0) return;

  const defaults: { name: string; type: 'expense' | 'income'; keywords: string[] }[] = [
    { name: 'Food', type: 'expense', keywords: ['غذا', 'ناهار', 'شام', 'صبحانه', 'رستوران', 'کافه', 'فست فود', 'پیتزا', 'برگر', 'ساندویچ', 'قهوه', 'چای', 'شکلات', 'شیرینی', 'کیک', 'خوراکی', 'خوردن', 'برنج', 'مرغ', 'گوشت', 'ماهی', 'میوه', 'نان', 'نوشابه', 'سوپرمارکت', 'بقالی', 'سلمنی', 'سالمون', 'سوسیس', 'کالباس', 'کباب', 'جوجه', 'دمنوش'] },
    { name: 'Transport', type: 'expense', keywords: ['تاکسی', 'مترو', 'اتوبوس', 'ون', 'بنزین', 'گاز', 'ماشین', 'خودرو', 'اسنپ', 'تپسی', 'پیک', 'مسافربر', 'آژانس', 'گاراژ', 'عوارضی', 'لاستیک', 'مکانیک', 'قطار', 'هواپیما'] },
    { name: 'Shopping', type: 'expense', keywords: ['خرید', 'فروشگاه', 'مغازه', 'بازار', 'لباس', 'کفش', 'کیف', 'عینک', 'ساعت', 'انگشتر', 'آرایشی', 'عطر', 'دیجی‌کالا', 'لپ‌تاپ', 'موبایل'] },
    { name: 'Bills', type: 'expense', keywords: ['قبض', 'آب', 'برق', 'گاز', 'تلفن', 'اینترنت', 'شارژ', 'اجاره', 'جریمه', 'مالیات', 'عضویت', 'اشتراک', 'پارکینگ'] },
    { name: 'Entertainment', type: 'expense', keywords: ['سینما', 'فیلم', 'بازی', 'گیم', 'تفریح', 'کنسرت', 'موسیقی', 'ورزش', 'باشگاه', 'کتاب', 'مسافرت', 'سفر', 'هتل', 'بلیط', 'شهربازی'] },
    { name: 'Health', type: 'expense', keywords: ['دارو', 'داروخانه', 'قرص', 'درمان', 'دکتر', 'بیمارستان', 'آزمایش', 'دندانپزشک', 'واکسن', 'ویتامین', 'جراحی'] },
    { name: 'Education', type: 'expense', keywords: ['آموزش', 'کلاس', 'دوره', 'کتاب', 'مدرسه', 'دانشگاه', 'شهریه', 'تدریس', 'معلم', 'کنکور', 'گواهینامه', 'زبان', 'برنامه‌نویسی'] },
    { name: 'Salary', type: 'income', keywords: ['حقوق', 'دستمزد', 'پاداش', 'کارانه', 'اضافه‌کار', 'بازنشستگی'] },
    { name: 'Freelance', type: 'income', keywords: ['فریلنسر', 'پروژه', 'قرارداد', 'مشاوره', 'طراحی', 'برنامه‌نویسی'] },
    { name: 'Gift', type: 'income', keywords: ['هدیه', 'عیدی', 'جایزه', 'کادو', 'خیرات', 'صدقه'] },
    { name: 'Refund', type: 'income', keywords: ['بازپرداخت', 'برگشت پول', 'مرجوع', 'استرداد'] },
    { name: 'Other', type: 'expense', keywords: [] },
    { name: 'Other', type: 'income', keywords: [] },
  ];

  for (const cat of defaults) {
    db.run(
      'INSERT OR IGNORE INTO categories (name, type, keywords, usage_count) VALUES (?, ?, ?, 0)',
      [cat.name, cat.type, JSON.stringify(cat.keywords)]
    );
  }
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

export function queryAll(sql: string, params: any[] = []): any[] {
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

export function getLastTransaction(chatId: number): Transaction | null {
  const rows = queryAll('SELECT * FROM transactions WHERE chat_id = ? ORDER BY id DESC LIMIT 1', [chatId]);
  return rows.length > 0 ? rows[0] as Transaction : null;
}

export function getTransaction(id: number, chatId: number): Transaction | null {
  const rows = queryAll('SELECT * FROM transactions WHERE id = ? AND chat_id = ?', [id, chatId]);
  return rows.length > 0 ? rows[0] as Transaction : null;
}

export function debugAllTransactions(): any[] {
  return queryAll('SELECT id, chat_id, user_id, username, amount, currency, category, type, created_at FROM transactions ORDER BY id DESC');
}

export function getLanguage(chatId: number): 'fa' | 'en' {
  const rows = queryAll('SELECT language FROM settings WHERE chat_id = ?', [chatId]);
  if (rows.length > 0 && rows[0].language === 'en') return 'en';
  return 'fa';
}

export function setLanguage(chatId: number, lang: string): void {
  db.run('INSERT OR REPLACE INTO settings (chat_id, language) VALUES (?, ?)', [chatId, lang]);
  saveDatabase();
}

export function updateTransactionCategory(id: number, chatId: number, category: string): boolean {
  db.run('UPDATE transactions SET category = ? WHERE id = ? AND chat_id = ?', [category, id, chatId]);
  const changes = db.getRowsModified();
  saveDatabase();
  return changes > 0;
}

export function getCategories(type: 'expense' | 'income'): Category[] {
  const rows = queryAll('SELECT * FROM categories WHERE type = ? ORDER BY usage_count DESC, name', [type]);
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    type: r.type,
    keywords: JSON.parse(r.keywords || '[]'),
    usage_count: r.usage_count,
  }));
}

export function getAllCategoryKeywords(type: 'expense' | 'income'): Record<string, string[]> {
  const cats = getCategories(type);
  const result: Record<string, string[]> = {};
  for (const cat of cats) {
    result[cat.name] = cat.keywords;
  }
  return result;
}

export function incrementCategoryUsage(categoryName: string, type: 'expense' | 'income'): void {
  db.run('UPDATE categories SET usage_count = usage_count + 1 WHERE name = ? AND type = ?', [categoryName, type]);
  saveDatabase();
}

export function addCategoryKeyword(categoryName: string, type: 'expense' | 'income', keyword: string): void {
  const rows = queryAll('SELECT keywords FROM categories WHERE name = ? AND type = ?', [categoryName, type]);
  if (rows.length === 0) return;

  const keywords: string[] = JSON.parse(rows[0].keywords || '[]');
  if (!keywords.includes(keyword)) {
    keywords.push(keyword);
    db.run('UPDATE categories SET keywords = ? WHERE name = ? AND type = ?', [JSON.stringify(keywords), categoryName, type]);
    saveDatabase();
  }
}

export function createCategory(name: string, type: 'expense' | 'income', keywords: string[] = []): number {
  try {
    db.run(
      'INSERT INTO categories (name, type, keywords, usage_count) VALUES (?, ?, ?, 1)',
      [name, type, JSON.stringify(keywords)]
    );
    const result = db.exec('SELECT last_insert_rowid() as id');
    const id = result[0]?.values[0]?.[0] as number;
    saveDatabase();
    console.log(`[DB] Created category "${name}" (${type})`);
    return id;
  } catch (error) {
    console.error('[DB] CREATE CATEGORY FAILED:', error);
    return -1;
  }
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
  }
}
