import { initDatabase, insertTransaction, deleteTransaction, getTransaction, getLastTransaction, getTransactions, getCategorySummary, getUserSummary, getLanguage, setLanguage, getCategories, incrementCategoryUsage, addCategoryKeyword, createCategory, closeDatabase } from './database';

beforeAll(async () => {
  process.env.DB_PATH = './data/test-budget.db';
  await initDatabase();
});

afterAll(() => {
  closeDatabase();
});

describe('Transactions', () => {
  const testTx = {
    chat_id: 123456,
    user_id: 111,
    username: 'testuser',
    amount: 50000,
    currency: 'IRT',
    category: 'Food',
    type: 'expense' as const,
    description: 'Test expense',
    original_message: '50 هزار خرج غذا',
    created_at: new Date().toISOString(),
  };

  let insertedId: number;

  it('should insert a transaction', () => {
    insertedId = insertTransaction(testTx);
    expect(insertedId).toBeGreaterThan(0);
  });

  it('should get transaction by id', () => {
    const tx = getTransaction(insertedId, 123456);
    expect(tx).not.toBeNull();
    expect(tx!.amount).toBe(50000);
    expect(tx!.category).toBe('Food');
  });

  it('should return null for non-existent transaction', () => {
    const tx = getTransaction(999999, 123456);
    expect(tx).toBeNull();
  });

  it('should get last transaction', () => {
    const last = getLastTransaction(123456);
    expect(last).not.toBeNull();
    expect(last!.id).toBe(insertedId);
  });

  it('should get transactions by date range', () => {
    const today = new Date().toISOString().split('T')[0];
    const txs = getTransactions(123456, today);
    expect(txs.length).toBeGreaterThan(0);
  });

  it('should delete transaction', () => {
    const success = deleteTransaction(insertedId, 123456);
    expect(success).toBe(true);
    const tx = getTransaction(insertedId, 123456);
    expect(tx).toBeNull();
  });

  it('should return false when deleting non-existent transaction', () => {
    const success = deleteTransaction(999999, 123456);
    expect(success).toBe(false);
  });
});

describe('Category Summary', () => {
  beforeAll(() => {
    const today = new Date().toISOString().split('T')[0];
    insertTransaction({
      chat_id: 222222,
      user_id: 222,
      username: 'user1',
      amount: 10000,
      currency: 'IRT',
      category: 'Food',
      type: 'expense',
      description: 'Lunch',
      original_message: 'ناهار ۱۰ هزار',
      created_at: new Date().toISOString(),
    });
    insertTransaction({
      chat_id: 222222,
      user_id: 222,
      username: 'user1',
      amount: 5000,
      currency: 'IRT',
      category: 'Transport',
      type: 'expense',
      description: 'Taxi',
      original_message: 'تاکسی ۵ هزار',
      created_at: new Date().toISOString(),
    });
  });

  it('should return category summary', () => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const summary = getCategorySummary(222222, today, tomorrow, 'expense');
    expect(summary.length).toBeGreaterThan(0);
  });
});

describe('User Summary', () => {
  it('should return user summary', () => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const summary = getUserSummary(222222, today, tomorrow, 'expense');
    expect(summary.length).toBeGreaterThan(0);
    expect(summary[0].username).toBe('user1');
  });
});

describe('Language Settings', () => {
  it('should return default language (fa)', () => {
    const lang = getLanguage(999999);
    expect(lang).toBe('fa');
  });

  it('should set and get language', () => {
    setLanguage(123456, 'en');
    expect(getLanguage(123456)).toBe('en');
    setLanguage(123456, 'fa');
    expect(getLanguage(123456)).toBe('fa');
  });
});

describe('Categories', () => {
  it('should get expense categories', () => {
    const cats = getCategories('expense');
    expect(cats.length).toBeGreaterThan(0);
    expect(cats.some(c => c.name === 'Food')).toBe(true);
  });

  it('should get income categories', () => {
    const cats = getCategories('income');
    expect(cats.length).toBeGreaterThan(0);
    expect(cats.some(c => c.name === 'Salary')).toBe(true);
  });

  it('should create new category', () => {
    const id = createCategory('TestCatUnique_' + Date.now(), 'expense', ['test', 'keyword']);
    expect(id).toBeGreaterThan(0);
    const cats = getCategories('expense');
    expect(cats.some(c => c.name === 'TestCatUnique_' + Date.now() || c.name.startsWith('TestCatUnique_'))).toBe(true);
  });

  it('should increment category usage', () => {
    incrementCategoryUsage('Food', 'expense');
    const cats = getCategories('expense');
    const food = cats.find(c => c.name === 'Food');
    expect(food!.usage_count).toBeGreaterThan(0);
  });

  it('should add keyword to category', () => {
    addCategoryKeyword('Food', 'expense', 'newtestword');
    const cats = getCategories('expense');
    const food = cats.find(c => c.name === 'Food');
    expect(food!.keywords).toContain('newtestword');
  });
});
