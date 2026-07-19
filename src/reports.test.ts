import { initDatabase, insertTransaction, closeDatabase } from './database';
import { generateWeeklyReport, generateMonthlyReport, generateCustomReport, generateTransactionList } from './reports';

beforeAll(async () => {
  process.env.DB_PATH = './data/test-reports.db';
  await initDatabase();

  const today = new Date().toISOString();
  insertTransaction({
    chat_id: 333333,
    user_id: 333,
    username: 'alice',
    amount: 100000,
    currency: 'IRT',
    category: 'Food',
    type: 'expense',
    description: 'Restaurant',
    original_message: 'رستوران ۱۰۰ هزار',
    created_at: today,
  });
  insertTransaction({
    chat_id: 333333,
    user_id: 333,
    username: 'alice',
    amount: 50000,
    currency: 'IRT',
    category: 'Transport',
    type: 'expense',
    description: 'Taxi',
    original_message: 'تاکسی ۵۰ هزار',
    created_at: today,
  });
  insertTransaction({
    chat_id: 333333,
    user_id: 444,
    username: 'bob',
    amount: 200000,
    currency: 'IRT',
    category: 'Salary',
    type: 'income',
    description: 'Monthly salary',
    original_message: 'حقوق ۲۰۰ هزار',
    created_at: today,
  });
});

afterAll(() => {
  closeDatabase();
});

describe('Reports', () => {
  describe('generateWeeklyReport', () => {
    it('should return a report string', () => {
      const report = generateWeeklyReport(333333);
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
    });

    it('should include income and expense sections', () => {
      const report = generateWeeklyReport(333333);
      expect(report).toContain('هزینه');
      expect(report).toContain('درآمد');
    });

    it('should include user breakdown', () => {
      const report = generateWeeklyReport(333333);
      expect(report).toContain('alice');
      expect(report).toContain('bob');
    });
  });

  describe('generateMonthlyReport', () => {
    it('should return a report string', () => {
      const report = generateMonthlyReport(333333);
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
    });

    it('should include balance section', () => {
      const report = generateMonthlyReport(333333);
      expect(report).toContain('موجودی');
    });
  });

  describe('generateCustomReport', () => {
    it('should return a report for custom date range', () => {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const report = generateCustomReport(333333, today, tomorrow);
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
    });

    it('should return empty message for no transactions', () => {
      const report = generateCustomReport(999999, '2020-01-01', '2020-01-02');
      expect(report).toContain('تراکنشی یافت نشد');
    });
  });

  describe('generateTransactionList', () => {
    it('should list transactions', () => {
      const today = new Date().toISOString().split('T')[0];
      const list = generateTransactionList(333333, today);
      expect(list).toContain('alice');
      expect(list).toContain('bob');
    });

    it('should return empty message for no transactions', () => {
      const list = generateTransactionList(999999, '2020-01-01');
      expect(list).toContain('تراکنشی یافت نشد');
    });

    it('should filter by type', () => {
      const today = new Date().toISOString().split('T')[0];
      const expenses = generateTransactionList(333333, today, undefined, 'expense');
      expect(expenses).toContain('alice');
      expect(expenses).not.toContain('bob');

      const income = generateTransactionList(333333, today, undefined, 'income');
      expect(income).toContain('bob');
      expect(income).not.toContain('alice');
    });
  });
});
