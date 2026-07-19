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

export interface Budget {
  id: number;
  chat_id: number;
  category: string;
  amount: number;
  currency: string;
  period: 'monthly' | 'weekly';
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

  db.run(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'IRT',
      period TEXT DEFAULT 'monthly',
      UNIQUE(chat_id, category, period)
    )
  `);

  seedDefaultCategories();
  saveDatabase();
}

function seedDefaultCategories(): void {
  const existing = queryAll('SELECT COUNT(*) as cnt FROM categories');
  if (existing[0]?.cnt > 0) return;

const defaults: { name: string; type: 'expense' | 'income'; keywords: string[] }[] = [
  {
    name: 'Food',
    type: 'expense',
    keywords: [
      'غذا','خوراک','خوراکی','ناهار','شام','صبحانه','میان وعده',
      'رستوران','کافه','کافی شاپ','فست فود','پیتزا','برگر','ساندویچ',
      'کباب','جوجه','چلو','چلوکباب','خورشت','قورمه','قیمه','آبگوشت',
      'پاستا','ماکارونی','سوپ','سالاد',
      'قهوه','نسکافه','لاته','کاپوچینو','اسپرسو','چای','دمنوش',
      'بستنی','آبمیوه','اسموتی','نوشابه','دوغ','دلستر',
      'شیرینی','کیک','شکلات','بیسکویت','آجیل',
      'نان','برنج','مرغ','گوشت','ماهی','سالمون','تن ماهی',
      'میوه','سبزی','لبنیات','شیر','ماست','پنیر','تخم مرغ',
      'سوسیس','کالباس',
      'سوپرمارکت','سوپری','بقالی','هایپر','هایپرمارکت',
      'قصابی','نانوایی','میوه فروشی','تره بار','بازار میوه'
    ]
  },

  {
    name: 'Transport',
    type: 'expense',
    keywords: [
      'تاکسی','اسنپ','تپسی','ماکسیم','آژانس',
      'مترو','اتوبوس','بی آر تی','ون',
      'قطار','راه آهن','هواپیما','پرواز','فرودگاه',
      'بنزین','گازوئیل','سی ان جی','سوخت',
      'ماشین','خودرو','موتور','دوچرخه',
      'پیک','الوپیک','تیپاکس',
      'عوارض','عوارضی','طرح ترافیک',
      'پارکینگ',
      'لاستیک','روغن موتور','تعویض روغن','باطری','باتری',
      'کارواش','مکانیک','تعمیرگاه','سرویس خودرو','معاینه فنی'
    ]
  },

  {
    name: 'Shopping',
    type: 'expense',
    keywords: [
      'خرید','فروشگاه','مغازه','بازار','مال',
      'دیجی کالا','دیجی‌کالا','ترب','باسلام',
      'لباس','پوشاک','تی شرت','تیشرت','شلوار','کت',
      'کفش','صندل','بوت',
      'کیف','کوله','چمدان',
      'ساعت','عینک','زیورآلات','انگشتر','گردنبند','دستبند',
      'آرایشی','بهداشتی','لوازم آرایش','عطر','ادکلن',
      'موبایل','گوشی','تبلت','لپ تاپ','لپ‌تاپ',
      'کامپیوتر','کیبورد','ماوس','هدفون','هارد','فلش',
      'لوازم خانه','ظروف','مبلمان','دکور','فرش','پرده'
    ]
  },

  {
    name: 'Bills',
    type: 'expense',
    keywords: [
      'قبض',
      'قبض برق','قبض آب','قبض گاز','قبض تلفن',
      'برق','گاز','تلفن','اینترنت',
      'همراه اول','ایرانسل','رایتل',
      'شارژ','بسته اینترنت',
      'اجاره','رهن','ودیعه',
      'شارژ ساختمان','شارژ مجتمع',
      'مالیات','عوارض',
      'جریمه','جریمه رانندگی',
      'بیمه','بیمه خودرو','بیمه شخص ثالث','بیمه درمان',
      'اشتراک','عضویت',
      'نتفلیکس','اسپاتیفای','فیلیمو','نماوا','یوتیوب پریمیوم',
      'هاست','دامنه','سرور','کلاد','Cloudflare','VPS'
    ]
  },

  {
    name: 'Entertainment',
    type: 'expense',
    keywords: [
      'تفریح','سرگرمی',
      'سینما','فیلم','تئاتر','کنسرت',
      'بازی','گیم','استیم','Steam','پلی استیشن','ایکس باکس','نینتندو',
      'بردگیم','بوردگیم',
      'موسیقی',
      'باشگاه','ورزش','استخر','فوتبال','والیبال','بدنسازی',
      'کتاب','رمان','کمیک',
      'سفر','مسافرت','هتل','اقامت','ویلا',
      'بلیط','تور',
      'شهربازی','بولینگ','بیلیارد','اتاق فرار','کارتینگ','کافه بازی'
    ]
  },

  {
    name: 'Health',
    type: 'expense',
    keywords: [
      'دارو','داروخانه','قرص','شربت',
      'ویتامین','مکمل',
      'دکتر','پزشک','ویزیت',
      'درمان','کلینیک','بیمارستان',
      'آزمایش','آزمایشگاه','رادیولوژی','ام آر آی','MRI','سی تی اسکن',
      'واکسن',
      'دندانپزشک','دندان','ارتودنسی',
      'جراحی',
      'فیزیوتراپی','روانشناس','روانپزشک',
      'عینک طبی','لنز'
    ]
  },

  {
    name: 'Education',
    type: 'expense',
    keywords: [
      'آموزش','کلاس','دوره','کارگاه',
      'مدرسه','دانشگاه','شهریه',
      'کتاب','جزوه',
      'تدریس','معلم','استاد',
      'کنکور',
      'زبان','آیلتس','تافل',
      'برنامه نویسی','برنامه‌نویسی','کدنویسی',
      'گواهینامه','آموزشگاه رانندگی',
      'یودمی','Udemy','Coursera'
    ]
  },

  {
    name: 'Salary',
    type: 'income',
    keywords: [
      'حقوق','حقوق ماهانه','حقوقم',
      'دستمزد','حقوق کارمندی',
      'کارانه','اضافه کار','اضافه‌کار',
      'پاداش','عیدی',
      'پورسانت','کمیسیون',
      'بازنشستگی','مستمری'
    ]
  },

  {
    name: 'Freelance',
    type: 'income',
    keywords: [
      'فریلنسر','پروژه','قرارداد',
      'مشاوره','طراحی','برنامه نویسی','برنامه‌نویسی',
      'توسعه','برنامه نویس',
      'وبسایت','اپلیکیشن',
      'درآمد پروژه','حق الزحمه','حق‌الزحمه',
      'کارفرما','تسویه پروژه'
    ]
  },

  {
    name: 'Gift',
    type: 'income',
    keywords: [
      'هدیه','کادو','عیدی','جایزه',
      'کمک','حمایت',
      'پول توجیبی','پول جیبی',
      'بلاعوض',
      'خیرات','صدقه','نذری'
    ]
  },

  {
    name: 'Refund',
    type: 'income',
    keywords: [
      'بازپرداخت',
      'برگشت پول',
      'استرداد',
      'مرجوع',
      'مرجوعی',
      'کنسلی',
      'لغو سفارش',
      'برگشت وجه',
      'عودت وجه'
    ]
  },

  {
    name: 'Other',
    type: 'expense',
    keywords: []
  },

  {
    name: 'Other',
    type: 'income',
    keywords: []
  }
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
    console.log(`[DB] Inserting transaction: chat_id=${t.chat_id} user=${t.username} amount=${t.amount} ${t.currency} cat=${t.category}`);
    db.run(
      `INSERT INTO transactions (chat_id, user_id, username, amount, currency, category, type, description, original_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.chat_id, t.user_id, t.username, t.amount, t.currency, t.category, t.type, t.description, t.original_message, t.created_at]
    );

    const result = db.exec('SELECT last_insert_rowid() as id');
    const id = result[0]?.values[0]?.[0] as number;
    console.log(`[DB] Inserted transaction #${id}, chat_id=${t.chat_id}`);
    saveDatabase();
    console.log(`[DB] Inserted transaction #${id}`);
    return id;
  } catch (error) {
    console.error('[DB] INSERT FAILED:', error);
    return -1;
  }
}

export function queryAll(sql: string, params: any[] = []): any[] {
  console.log(`[DB] queryAll: ${sql} params=${JSON.stringify(params)}`);
  const stmt = db.prepare(sql);
  stmt.bind(params);

  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  console.log(`[DB] queryAll result: ${rows.length} rows`);
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
  console.log(`[DB] getTransaction(id=${id}, chatId=${chatId}) → ${rows.length} rows`);
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

export function setBudget(chatId: number, category: string, amount: number, currency: string = 'IRT', period: string = 'monthly'): void {
  db.run(
    'INSERT OR REPLACE INTO budgets (chat_id, category, amount, currency, period) VALUES (?, ?, ?, ?, ?)',
    [chatId, category, amount, currency, period]
  );
  saveDatabase();
}

export function getBudgets(chatId: number): Budget[] {
  return queryAll('SELECT * FROM budgets WHERE chat_id = ?', [chatId]) as Budget[];
}

export function getBudget(chatId: number, category: string): Budget | null {
  const rows = queryAll('SELECT * FROM budgets WHERE chat_id = ? AND category = ?', [chatId, category]);
  return rows.length > 0 ? rows[0] as Budget : null;
}

export function deleteBudget(chatId: number, category: string): boolean {
  db.run('DELETE FROM budgets WHERE chat_id = ? AND category = ?', [chatId, category]);
  const changes = db.getRowsModified();
  saveDatabase();
  return changes > 0;
}

export function getSpentThisMonth(chatId: number, category: string): { total: number; currency: string } {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const rows = queryAll(
    'SELECT SUM(amount) as total, currency FROM transactions WHERE chat_id = ? AND category = ? AND type = ? AND created_at >= ? GROUP BY currency',
    [chatId, category, 'expense', monthStart]
  );
  return rows.length > 0 ? { total: rows[0].total || 0, currency: rows[0].currency || 'IRT' } : { total: 0, currency: 'IRT' };
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
  }
}
