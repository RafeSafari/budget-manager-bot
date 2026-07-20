import { db } from 'sdk';
import { eq, and, desc, asc, sql } from 'sdk/db';
import { transactions, settings, categories, budgets } from 'schema';

export async function getLanguage(chatId) {
  const row = await db.select().from(settings).where(eq(settings.chatId, chatId)).get();
  return row?.language || 'fa';
}

export async function setLanguage(chatId, lang) {
  await db.insert(settings)
    .values({ chatId, language: lang })
    .onConflictDoUpdate({ target: settings.chatId, set: { language: lang } })
    .run();
}

export async function insertTransaction(t) {
  const [row] = await db.insert(transactions)
    .values({
      chatId: t.chat_id,
      userId: t.user_id,
      username: t.username,
      amount: t.amount,
      currency: t.currency,
      category: t.category,
      type: t.type,
      description: t.description,
      originalMessage: t.original_message,
    })
    .returning()
    .run();
  return row.id;
}

export async function deleteTransaction(id, chatId) {
  const result = await db.delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.chatId, chatId)))
    .run();
  return result.changes > 0;
}

export async function getLastTransaction(chatId) {
  return await db.select().from(transactions)
    .where(eq(transactions.chatId, chatId))
    .orderBy(desc(transactions.id))
    .limit(1)
    .get();
}

export async function getTransaction(id, chatId) {
  return await db.select().from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.chatId, chatId)))
    .get();
}

export async function debugAllTransactions() {
  return await db.select().from(transactions)
    .orderBy(desc(transactions.id))
    .all();
}

export async function updateTransactionCategory(id, chatId, category) {
  const result = await db.update(transactions)
    .set({ category })
    .where(and(eq(transactions.id, id), eq(transactions.chatId, chatId)))
    .run();
  return result.changes > 0;
}

export async function getCategories(type) {
  return await db.select().from(categories)
    .where(eq(categories.type, type))
    .orderBy(desc(categories.usageCount), asc(categories.name))
    .all();
}

export async function getAllCategoryKeywords(type) {
  const cats = await getCategories(type);
  const result = {};
  for (const cat of cats) {
    result[cat.name] = JSON.parse(cat.keywords || '[]');
  }
  return result;
}

export async function incrementCategoryUsage(categoryName, type) {
  await db.update(categories)
    .set({ usageCount: sql`${categories.usageCount} + 1` })
    .where(and(eq(categories.name, categoryName), eq(categories.type, type)))
    .run();
}

export async function addCategoryKeyword(categoryName, type, keyword) {
  const row = await db.select().from(categories)
    .where(and(eq(categories.name, categoryName), eq(categories.type, type)))
    .get();
  if (!row) return;

  const keywords = JSON.parse(row.keywords || '[]');
  if (!keywords.includes(keyword)) {
    keywords.push(keyword);
    await db.update(categories)
      .set({ keywords: JSON.stringify(keywords) })
      .where(and(eq(categories.name, categoryName), eq(categories.type, type)))
      .run();
  }
}

export async function createCategory(name, type, keywords = []) {
  try {
    const [row] = await db.insert(categories)
      .values({ name, type, keywords: JSON.stringify(keywords), usageCount: 1 })
      .returning()
      .run();
    return row.id;
  } catch {
    return -1;
  }
}

export async function getTransactions(chatId, startDate, endDate, type) {
  const conditions = [eq(transactions.chatId, chatId)];

  if (startDate) {
    conditions.push(sql`${transactions.createdAt} >= ${startDate}`);
  }
  if (endDate) {
    conditions.push(sql`${transactions.createdAt} <= ${endDate}`);
  }
  if (type) {
    conditions.push(eq(transactions.type, type));
  }

  return await db.select().from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.createdAt))
    .all();
}

export async function getCategorySummary(chatId, startDate, endDate, type) {
  return await db.select({
    category: transactions.category,
    currency: transactions.currency,
    total: sql`sum(${transactions.amount})`,
    count: sql`count(*)`,
  })
    .from(transactions)
    .where(and(
      eq(transactions.chatId, chatId),
      sql`${transactions.createdAt} >= ${startDate}`,
      sql`${transactions.createdAt} <= ${endDate}`,
      eq(transactions.type, type),
    ))
    .groupBy(transactions.category, transactions.currency)
    .orderBy(desc(sql`sum(${transactions.amount})`))
    .all();
}

export async function getUserSummary(chatId, startDate, endDate, type) {
  return await db.select({
    username: transactions.username,
    total: sql`sum(${transactions.amount})`,
    count: sql`count(*)`,
  })
    .from(transactions)
    .where(and(
      eq(transactions.chatId, chatId),
      sql`${transactions.createdAt} >= ${startDate}`,
      sql`${transactions.createdAt} <= ${endDate}`,
      eq(transactions.type, type),
    ))
    .groupBy(transactions.userId)
    .orderBy(desc(sql`sum(${transactions.amount})`))
    .all();
}

export async function setBudget(chatId, category, amount, currency = 'IRT', period = 'monthly') {
  await db.insert(budgets)
    .values({ chatId, category, amount, currency, period })
    .onConflictDoUpdate({
      target: [budgets.chatId, budgets.category],
      set: { amount, currency, period },
    })
    .run();
}

export async function getBudgets(chatId) {
  return await db.select().from(budgets)
    .where(eq(budgets.chatId, chatId))
    .all();
}

export async function getBudget(chatId, category) {
  return await db.select().from(budgets)
    .where(and(eq(budgets.chatId, chatId), eq(budgets.category, category)))
    .get();
}

export async function deleteBudget(chatId, category) {
  const result = await db.delete(budgets)
    .where(and(eq(budgets.chatId, chatId), eq(budgets.category, category)))
    .run();
  return result.changes > 0;
}

export async function getSpentThisMonth(chatId, category) {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const rows = await db.select({
    total: sql`sum(${transactions.amount})`,
    currency: transactions.currency,
  })
    .from(transactions)
    .where(and(
      eq(transactions.chatId, chatId),
      eq(transactions.category, category),
      eq(transactions.type, 'expense'),
      sql`${transactions.createdAt} >= ${monthStart}`,
    ))
    .groupBy(transactions.currency)
    .all();
  return rows.length > 0 ? { total: rows[0].total || 0, currency: rows[0].currency || 'IRT' } : { total: 0, currency: 'IRT' };
}

export async function getTransactionsForExport(chatId, startDate, endDate) {
  return await db.select().from(transactions)
    .where(and(
      eq(transactions.chatId, chatId),
      sql`${transactions.createdAt} >= ${startDate}`,
      sql`${transactions.createdAt} < ${endDate}`,
    ))
    .orderBy(asc(transactions.createdAt))
    .all();
}
