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

export interface Budget {
  id: number;
  chat_id: number;
  category: string;
  amount: number;
  currency: string;
  period: 'monthly' | 'weekly';
}

export interface AutoSummary {
  chat_id: number;
  enabled: number;
  schedule_type: string;
  time: string;
  day: string | null;
}

export async function insertTransaction(DB: D1Database, t: Omit<Transaction, 'id'>): Promise<number> {
  const result = await DB.prepare(
    `INSERT INTO transactions (chat_id, user_id, username, amount, currency, category, type, description, original_message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(t.chat_id, t.user_id, t.username, t.amount, t.currency, t.category, t.type, t.description, t.original_message, t.created_at)
    .run();

  const id = result.meta.last_row_id as number;
  console.log(`[DB] Inserted transaction #${id}`);
  return id;
}

export async function queryAll(DB: D1Database, sql: string, params: any[] = []): Promise<any[]> {
  const stmt = DB.prepare(sql);
  if (params.length > 0) {
    stmt.bind(...params);
  }
  const { results } = await stmt.all();
  return results;
}

export async function getTransactions(
  DB: D1Database,
  chatId: number,
  startDate: string,
  endDate?: string,
  type?: 'expense' | 'income'
): Promise<Transaction[]> {
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
  return queryAll(DB, query, params) as Promise<Transaction[]>;
}

export async function getCategorySummary(
  DB: D1Database,
  chatId: number,
  startDate: string,
  endDate: string,
  type: 'expense' | 'income'
): Promise<{ category: string; currency: string; total: number; count: number }[]> {
  const query = `
    SELECT category, currency, SUM(amount) as total, COUNT(*) as count
    FROM transactions
    WHERE chat_id = ? AND created_at >= ? AND created_at <= ? AND type = ?
    GROUP BY category, currency
    ORDER BY total DESC
  `;
  return queryAll(DB, query, [chatId, startDate, endDate, type]);
}

export async function getUserSummary(
  DB: D1Database,
  chatId: number,
  startDate: string,
  endDate: string,
  type: 'expense' | 'income'
): Promise<{ username: string; total: number; count: number }[]> {
  const query = `
    SELECT username, SUM(amount) as total, COUNT(*) as count
    FROM transactions
    WHERE chat_id = ? AND created_at >= ? AND created_at <= ? AND type = ?
    GROUP BY user_id
    ORDER BY total DESC
  `;
  return queryAll(DB, query, [chatId, startDate, endDate, type]);
}

export async function deleteTransaction(DB: D1Database, id: number, chatId: number): Promise<boolean> {
  const result = await DB.prepare('DELETE FROM transactions WHERE id = ? AND chat_id = ?')
    .bind(id, chatId)
    .run();
  return result.meta.changes > 0;
}

export async function getLastTransaction(DB: D1Database, chatId: number): Promise<Transaction | null> {
  const rows = await queryAll(DB, 'SELECT * FROM transactions WHERE chat_id = ? ORDER BY id DESC LIMIT 1', [chatId]);
  return rows.length > 0 ? rows[0] as Transaction : null;
}

export async function getTransaction(DB: D1Database, id: number, chatId: number): Promise<Transaction | null> {
  const rows = await queryAll(DB, 'SELECT * FROM transactions WHERE id = ? AND chat_id = ?', [id, chatId]);
  return rows.length > 0 ? rows[0] as Transaction : null;
}

export async function debugAllTransactions(DB: D1Database): Promise<any[]> {
  return queryAll(DB, 'SELECT id, chat_id, user_id, username, amount, currency, category, type, created_at FROM transactions ORDER BY id DESC');
}

export async function getLanguage(DB: D1Database, chatId: number): Promise<'fa' | 'en'> {
  const rows = await queryAll(DB, 'SELECT language FROM settings WHERE chat_id = ?', [chatId]);
  if (rows.length > 0 && rows[0].language === 'en') return 'en';
  return 'fa';
}

export async function setLanguage(DB: D1Database, chatId: number, lang: string): Promise<void> {
  await DB.prepare('INSERT OR REPLACE INTO settings (chat_id, language) VALUES (?, ?)')
    .bind(chatId, lang)
    .run();
}

export async function updateTransactionCategory(DB: D1Database, id: number, chatId: number, category: string): Promise<boolean> {
  const result = await DB.prepare('UPDATE transactions SET category = ? WHERE id = ? AND chat_id = ?')
    .bind(category, id, chatId)
    .run();
  return result.meta.changes > 0;
}

export async function getCategories(DB: D1Database, type: 'expense' | 'income'): Promise<Category[]> {
  const rows = await queryAll(DB, 'SELECT * FROM categories WHERE type = ? ORDER BY usage_count DESC, name', [type]);
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    type: r.type,
    keywords: JSON.parse(r.keywords || '[]'),
    usage_count: r.usage_count,
  }));
}

export async function getAllCategoryKeywords(DB: D1Database, type: 'expense' | 'income'): Promise<Record<string, string[]>> {
  const cats = await getCategories(DB, type);
  const result: Record<string, string[]> = {};
  for (const cat of cats) {
    result[cat.name] = cat.keywords;
  }
  return result;
}

export async function incrementCategoryUsage(DB: D1Database, categoryName: string, type: 'expense' | 'income'): Promise<void> {
  await DB.prepare('UPDATE categories SET usage_count = usage_count + 1 WHERE name = ? AND type = ?')
    .bind(categoryName, type)
    .run();
}

export async function addCategoryKeyword(DB: D1Database, categoryName: string, type: 'expense' | 'income', keyword: string): Promise<void> {
  const rows = await queryAll(DB, 'SELECT keywords FROM categories WHERE name = ? AND type = ?', [categoryName, type]);
  if (rows.length === 0) return;

  const keywords: string[] = JSON.parse(rows[0].keywords || '[]');
  if (!keywords.includes(keyword)) {
    keywords.push(keyword);
    await DB.prepare('UPDATE categories SET keywords = ? WHERE name = ? AND type = ?')
      .bind(JSON.stringify(keywords), categoryName, type)
      .run();
  }
}

export async function createCategory(DB: D1Database, name: string, type: 'expense' | 'income', keywords: string[] = []): Promise<number> {
  const result = await DB.prepare(
    'INSERT INTO categories (name, type, keywords, usage_count) VALUES (?, ?, ?, 1)'
  ).bind(name, type, JSON.stringify(keywords))
    .run();

  const id = result.meta.last_row_id as number;
  console.log(`[DB] Created category "${name}" (${type})`);
  return id;
}

export async function setBudget(DB: D1Database, chatId: number, category: string, amount: number, currency: string = 'IRT', period: string = 'monthly'): Promise<void> {
  await DB.prepare(
    'INSERT OR REPLACE INTO budgets (chat_id, category, amount, currency, period) VALUES (?, ?, ?, ?, ?)'
  ).bind(chatId, category, amount, currency, period)
    .run();
}

export async function getBudgets(DB: D1Database, chatId: number): Promise<Budget[]> {
  return queryAll(DB, 'SELECT * FROM budgets WHERE chat_id = ?', [chatId]) as Promise<Budget[]>;
}

export async function getBudget(DB: D1Database, chatId: number, category: string): Promise<Budget | null> {
  const rows = await queryAll(DB, 'SELECT * FROM budgets WHERE chat_id = ? AND category = ?', [chatId, category]);
  return rows.length > 0 ? rows[0] as Budget : null;
}

export async function deleteBudget(DB: D1Database, chatId: number, category: string): Promise<boolean> {
  const result = await DB.prepare('DELETE FROM budgets WHERE chat_id = ? AND category = ?')
    .bind(chatId, category)
    .run();
  return result.meta.changes > 0;
}

export async function getSpentThisMonth(DB: D1Database, chatId: number, category: string): Promise<{ total: number; currency: string }> {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const rows = await queryAll(
    DB,
    'SELECT SUM(amount) as total, currency FROM transactions WHERE chat_id = ? AND category = ? AND type = ? AND created_at >= ? GROUP BY currency',
    [chatId, category, 'expense', monthStart]
  );
  return rows.length > 0 ? { total: rows[0].total || 0, currency: rows[0].currency || 'IRT' } : { total: 0, currency: 'IRT' };
}

export async function setAutoSummary(DB: D1Database, chatId: number, enabled: boolean, scheduleType: string, time: string, day: string | null = null): Promise<void> {
  await DB.prepare(
    'INSERT OR REPLACE INTO auto_summary (chat_id, enabled, schedule_type, time, day) VALUES (?, ?, ?, ?, ?)'
  ).bind(chatId, enabled ? 1 : 0, scheduleType, time, day)
    .run();
}

export async function getAutoSummary(DB: D1Database, chatId: number): Promise<AutoSummary | null> {
  const rows = await queryAll(DB, 'SELECT * FROM auto_summary WHERE chat_id = ?', [chatId]);
  return rows.length > 0 ? rows[0] as AutoSummary : null;
}

export async function getAllEnabledAutoSummaries(DB: D1Database): Promise<AutoSummary[]> {
  return queryAll(DB, 'SELECT * FROM auto_summary WHERE enabled = 1') as Promise<AutoSummary[]>;
}

export async function storeUndoCache(DB: D1Database, key: string, data: any, ttlSeconds: number = 300): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  await DB.prepare('INSERT OR REPLACE INTO undo_cache (key, data, expires_at) VALUES (?, ?, ?)')
    .bind(key, JSON.stringify(data), expiresAt)
    .run();
}

export async function getUndoCache(DB: D1Database, key: string): Promise<any | null> {
  const now = Math.floor(Date.now() / 1000);
  const rows = await queryAll(DB, 'SELECT data FROM undo_cache WHERE key = ? AND expires_at > ?', [key, now]);
  if (rows.length === 0) return null;
  return JSON.parse(rows[0].data);
}

export async function deleteUndoCache(DB: D1Database, key: string): Promise<void> {
  await DB.prepare('DELETE FROM undo_cache WHERE key = ?').bind(key).run();
}
