import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENCODE_API_KEY,
  baseURL: 'https://opencode.ai/zen/v1',
});

export interface CategorizationResult {
  isTransaction: boolean;
  type: 'expense' | 'income';
  amount: number;
  currency: string;
  category: string;
  description: string;
}

const EXPENSE_CATEGORIES = process.env.EXPENSE_CATEGORIES || 'Food,Transport,Shopping,Bills,Entertainment,Health,Education,Other';
const INCOME_CATEGORIES = process.env.INCOME_CATEGORIES || 'Salary,Freelance,Gift,Refund,Other';

// Persian number words
const PERSIAN_NUMS: Record<string, number> = {
  'صفر': 0, 'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5,
  'شش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10,
  'بیست': 20, 'سی': 30, 'چهل': 40, 'پنجاه': 50,
  'شصت': 60, 'هفتاد': 70, 'هشتاد': 80, 'نود': 90,
  'صد': 100, 'هزار': 1000, 'میلیون': 1000000, 'میلیارد': 1000000000,
};

function persianToEnglishDigits(str: string): string {
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  return str.split('').map(c => {
    const idx = persianDigits.indexOf(c);
    return idx >= 0 ? idx.toString() : c;
  }).join('');
}

function parsePersianNumber(text: string): number | null {
  // Try direct number first
  const cleaned = persianToEnglishDigits(text.replace(/[,\s]/g, ''));
  const numMatch = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) return parseFloat(numMatch[1]);

  // Try Persian words
  let total = 0;
  let current = 0;
  const words = text.split(/\s+/);

  for (const word of words) {
    if (word in PERSIAN_NUMS) {
      const val = PERSIAN_NUMS[word];
      if (val >= 1000) {
        current = current === 0 ? val : current * val;
      } else {
        current += val;
      }
    }
  }
  total += current;

  return total > 0 ? total : null;
}

// Regex patterns for Persian financial messages
const EXPENSE_PATTERNS = [
  // "X تومان/تومن" with expense context
  /(\d+[۰-۹]*\s*(?:هزار|میلیون)?\s*(?:تومان|تومن|ت\b))/i,
  // "خرج/خرید/پرداخت/花费"
  /(خرج|خرید|خریدم|پرداخت|پرداخت کردم|花费|دادم|داده|داد|هزینه)/,
  // "X هزار خرج"
  /(\d+[۰-۹]*\s*(?:هزار|میلیون)?)/,
];

const INCOME_PATTERNS = [
  // "حقوق/دستمزد/دریافت"
  /(حقوق|دستمزد|دریافت|گرفتم|گرفته|واریز|واریز شد|اضافه شد)/,
];

// Category keyword mapping
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Food: ['غذا', 'ناهار', 'شام', 'صبحانه', 'رستوران', 'فست فود', 'آبمیوه', 'چای', 'قهوه', 'اسنک', 'آدامس', 'خوراکی', 'سوپرمارکت'],
  Transport: ['تاکسی', 'مترو', 'اتوبوس', 'بنزین', 'بنزین', 'ماشین', 'ọبر', 'مسافربر', 'پارکینگ'],
  Shopping: ['خرید', 'فروشگاه', 'لباس', 'کفش', 'بازار', 'سوپرمارکت', 'هایپر'],
  Bills: ['قبض', 'آب', 'برق', 'گاز', 'تلفن', 'اینترنت', 'شارژ', 'orent'],
  Entertainment: ['سینما', 'بازی', 'تفریح', 'کنسرت', 'مسابقه'],
  Health: ['دارو', 'درمان', 'پزشک', 'بیمارستان', 'داروخانه', 'دکتر'],
  Education: ['آموزش', 'کلاس', 'دوره', 'کتاب', 'مدرسه', 'دانشگاه'],
  Salary: ['حقوق', 'دستمزد', 'حقوق ماه'],
  Freelance: ['فریلنسر', 'پروژه', 'قرارداد'],
  Gift: ['هدیه', 'عیدی', 'جایزه'],
  Refund: ['بازپرداخت', 'برگشت', 'مرجوع'],
};

function guessCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return 'Other';
}

function regexParse(message: string): CategorizationResult | null {
  const fallback: CategorizationResult = { isTransaction: false, type: 'expense', amount: 0, currency: 'USD', category: 'Other', description: '' };

  const text = persianToEnglishDigits(message);

  // Check if it's a transaction at all
  const hasExpenseKeyword = EXPENSE_PATTERNS.some(p => p.test(message));
  const hasIncomeKeyword = INCOME_PATTERNS.some(p => p.test(message));

  if (!hasExpenseKeyword && !hasIncomeKeyword) return null;

  // Determine type
  const isIncome = hasIncomeKeyword && !hasExpenseKeyword;
  const type = isIncome ? 'income' : 'expense';

  // Determine currency
  let currency = 'IRT';
  if (/ریال|rial|irr/i.test(message)) currency = 'IRR';
  else if (/\$/i.test(message)) currency = 'USD';
  else if (/€/i.test(message)) currency = 'EUR';

  // Parse amount
  let amount = 0;

  // Try to find "X هزار" pattern
  const hazarMatch = text.match(/(\d+)\s*(?:هزار)/);
  if (hazarMatch) {
    amount = parseInt(hazarMatch[1]) * 1000;
  }

  // Try "X میلیون" pattern
  const millionMatch = text.match(/(\d+)\s*(?:میلیون)/);
  if (millionMatch) {
    amount = parseInt(millionMatch[1]) * 1000000;
  }

  // Try plain number with currency word
  if (amount === 0) {
    const numMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:تومان|تومن|ت\b|ریال)/i);
    if (numMatch) {
      amount = parseFloat(numMatch[1]);
    }
  }

  // Try just a number
  if (amount === 0) {
    const numMatch = text.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      amount = parseFloat(numMatch[1]);
    }
  }

  // Try Persian word numbers
  if (amount === 0) {
    const parsed = parsePersianNumber(message);
    if (parsed) amount = parsed;
  }

  if (amount <= 0) return null;

  const category = guessCategory(message);

  return {
    isTransaction: true,
    type,
    amount,
    currency,
    category,
    description: message,
  };
}

const SYSTEM_PROMPT = `Detect financial transactions in messages. Reply ONLY with JSON.

{"isTransaction":true,"type":"expense","amount":50000,"currency":"IRT","category":"Food","description":"original message"}

Fields:
- isTransaction: true if spending/earning money
- type: "expense" or "income"
- amount: positive number
- currency: "IRT" (تومان), "IRR" (ریال), "USD" ($)
- category: ${EXPENSE_CATEGORIES},${INCOME_CATEGORIES}

Persian: ۵۰۰۰۰=50000, هزار=1000, میلیون=1000000
حقوق=income. خرج/خرید=expense.`;

const MODEL = process.env.OPENCODE_MODEL || 'deepseek-v4-flash-free';

async function aiParse(message: string): Promise<CategorizationResult> {
  const fallback: CategorizationResult = { isTransaction: false, type: 'expense', amount: 0, currency: 'USD', category: 'Other', description: '' };

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message }
      ],
      temperature: 0,
      max_tokens: 150,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    console.log(`[AI] Raw: "${content}"`);

    if (!content) return fallback;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const result = JSON.parse(jsonMatch[0]) as CategorizationResult;
    console.log(`[AI] Parsed: isTx=${result.isTransaction} amt=${result.amount} cur=${result.currency} cat=${result.category}`);
    return result;
  } catch (error) {
    console.error('[AI] Error:', error);
    return fallback;
  }
}

export async function categorizeMessage(message: string): Promise<CategorizationResult> {
  // Step 1: Try regex first (fast, no API call)
  const regexResult = regexParse(message);
  if (regexResult) {
    console.log(`[REGEX] Matched: type=${regexResult.type} amount=${regexResult.amount} currency=${regexResult.currency} category=${regexResult.category}`);
    return regexResult;
  }

  // Step 2: Fallback to AI for ambiguous messages
  console.log(`[REGEX] No match, falling back to AI`);
  return aiParse(message);
}
