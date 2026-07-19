import { initDatabase, closeDatabase, incrementCategoryUsage } from './database';

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockImplementation((params: any) => {
            const msg = params.messages?.[1]?.content || '';
            if (/حقوق|دستمزد|دریافت|گرفتم|واریز|received|earned|freelance/i.test(msg)) {
              return Promise.resolve({
                choices: [{ message: { content: '{"isTransaction":true,"type":"income","amount":50000,"currency":"IRT","category":"Salary","description":"test"}' } }],
              });
            }
            if (/سلام|حالت|متن|فقط/i.test(msg)) {
              return Promise.resolve({
                choices: [{ message: { content: '{"isTransaction":false,"type":"expense","amount":0,"currency":"USD","category":"Other","description":""}' } }],
              });
            }
            return Promise.resolve({
              choices: [{ message: { content: '{"isTransaction":true,"type":"expense","amount":50000,"currency":"IRT","category":"Food","description":"test"}' } }],
            });
          }),
        },
      },
    })),
  };
});

beforeAll(async () => {
  process.env.DB_PATH = './data/test-categorizer.db';
  await initDatabase();
});

afterAll(() => {
  closeDatabase();
});

describe('Categorizer', () => {
  let categorizeMessage: any;
  let learnFromCorrection: any;

  beforeAll(async () => {
    const mod = await import('./categorizer');
    categorizeMessage = mod.categorizeMessage;
    learnFromCorrection = mod.learnFromCorrection;
  });

  describe('Persian expense messages', () => {
    it('should detect "50 هزار خرج غذا"', async () => {
      const result = await categorizeMessage('50 هزار خرج غذا');
      expect(result.isTransaction).toBe(true);
      expect(result.type).toBe('expense');
      expect(result.amount).toBe(50000);
      expect(result.currency).toBe('IRT');
    });

    it('should detect "200 تومان تاکسی"', async () => {
      const result = await categorizeMessage('200 تومان تاکسی');
      expect(result.isTransaction).toBe(true);
      expect(result.type).toBe('expense');
      expect(result.amount).toBe(200);
    });

    it('should detect "۵۰۰۰۰ خرج شد"', async () => {
      const result = await categorizeMessage('۵۰۰۰۰ خرج شد');
      expect(result.isTransaction).toBe(true);
      expect(result.type).toBe('expense');
      expect(result.amount).toBe(50000);
    });

    it('should detect "خرید لباس ۲۰۰ هزار"', async () => {
      const result = await categorizeMessage('خرید لباس ۲۰۰ هزار');
      expect(result.isTransaction).toBe(true);
      expect(result.type).toBe('expense');
      expect(result.amount).toBe(200000);
    });

    it('should detect "پرداخت قبض برق"', async () => {
      const result = await categorizeMessage('پرداخت قبض برق');
      expect(result.isTransaction).toBe(true);
      expect(result.type).toBe('expense');
    });

    it('should detect "1 میلیون ریال شارژ"', async () => {
      const result = await categorizeMessage('1 میلیون ریال شارژ');
      expect(result.isTransaction).toBe(true);
      expect(result.type).toBe('expense');
      expect(result.amount).toBe(1000000);
      expect(result.currency).toBe('IRR');
    });
  });

  describe('Persian income messages', () => {
    it('should detect "دستمزد ۳۰۰ هزار"', async () => {
      const result = await categorizeMessage('دستمزد ۳۰۰ هزار');
      expect(result.isTransaction).toBe(true);
      expect(result.type).toBe('income');
      expect(result.amount).toBe(300000);
    });

    it('should detect "گرفتم ۵۰۰ هزار"', async () => {
      const result = await categorizeMessage('گرفتم ۵۰۰ هزار');
      expect(result.isTransaction).toBe(true);
      expect(result.type).toBe('income');
    });

    it('should detect "دریافت ۱ میلیون"', async () => {
      const result = await categorizeMessage('دریافت ۱ میلیون');
      expect(result.isTransaction).toBe(true);
      expect(result.type).toBe('income');
    });
  });

  describe('English messages', () => {
    it('should detect "Spent 50 on food"', async () => {
      const result = await categorizeMessage('Spent 50 on food');
      expect(result.isTransaction).toBe(true);
      expect(result.type).toBe('expense');
      expect(result.amount).toBe(50);
    });

    it('should detect "Paid 30 for taxi"', async () => {
      const result = await categorizeMessage('Paid 30 for taxi');
      expect(result.isTransaction).toBe(true);
      expect(result.type).toBe('expense');
      expect(result.amount).toBe(30);
    });

    it('should detect "$50 food"', async () => {
      const result = await categorizeMessage('$50 food');
      expect(result.isTransaction).toBe(true);
      expect(result.type).toBe('expense');
    });
  });

  describe('Currency detection', () => {
    it('should default to IRT (تومان)', async () => {
      const result = await categorizeMessage('100 تومان غذا');
      expect(result.currency).toBe('IRT');
    });

    it('should detect IRR (ریال)', async () => {
      const result = await categorizeMessage('1000 ریال');
      expect(result.currency).toBe('IRR');
    });

    it('should detect USD ($)', async () => {
      const result = await categorizeMessage('$50 food');
      expect(result.currency).toBe('USD');
    });
  });

  describe('Non-transaction messages', () => {
    it('should return isTransaction: false for random text (when no expense/income keywords)', async () => {
      const result = await categorizeMessage('سلام حالت چطوره');
      expect(result.isTransaction).toBe(false);
    });

    it('should return isTransaction: false for empty amounts', async () => {
      const result = await categorizeMessage('فقط یک متن');
      expect(result.isTransaction).toBe(false);
    });
  });

  describe('Category matching', () => {
    it('should categorize "غذا" as Food', async () => {
      const result = await categorizeMessage('100 تومان غذا');
      expect(result.category).toBe('Food');
    });

    it('should categorize "تاکسی" as Transport', async () => {
      const result = await categorizeMessage('100 تومان تاکسی');
      expect(result.category).toBe('Transport');
    });

    it('should categorize "خرید لباس" as Shopping', async () => {
      const result = await categorizeMessage('خرید لباس ۱۰۰ هزار');
      expect(result.category).toBe('Shopping');
    });

    it('should categorize "حقوق" as Salary', async () => {
      const result = await categorizeMessage('حقوق ۵ میلیون');
      expect(result.category).toBe('Salary');
    });
  });

  describe('Learning from corrections', () => {
    it('should add keywords to existing category', () => {
      const originalKeywords = ['testword123'];
      learnFromCorrection('testword123 ۱۰۰ هزار', 'Food', 'expense');
      const { getCategories } = require('./database');
      const cats = getCategories('expense');
      const food = cats.find((c: any) => c.name === 'Food');
      expect(food.keywords).toContain('testword123');
    });

    it('should create new category if not exists', () => {
      learnFromCorrection('NewCatWord ۱۰۰ هزار', 'NewTestCat', 'expense');
      const { getCategories } = require('./database');
      const cats = getCategories('expense');
      expect(cats.some((c: any) => c.name === 'NewTestCat')).toBe(true);
    });
  });

  describe('Amount parsing edge cases', () => {
    it('should parse "۵۰۰۰۰" with Persian digits', async () => {
      const result = await categorizeMessage('۵۰۰۰۰ خرج');
      expect(result.amount).toBe(50000);
    });

    it('should parse "1.5 میلیون"', async () => {
      const result = await categorizeMessage('1.5 میلیون غذا');
      expect(result.amount).toBe(1500000);
    });

    it('should parse "2k food"', async () => {
      const result = await categorizeMessage('2k food');
      expect(result.amount).toBe(2000);
    });

    it('should parse "5m income"', async () => {
      const result = await categorizeMessage('5m income');
      expect(result.amount).toBe(5000000);
    });
  });
});
