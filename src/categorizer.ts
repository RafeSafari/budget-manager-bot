import OpenAI from 'openai';
import { getAllCategoryKeywords, getCategories, incrementCategoryUsage, addCategoryKeyword, createCategory } from './database';

export interface CategorizationResult {
  isTransaction: boolean;
  type: 'expense' | 'income';
  amount: number;
  currency: string;
  category: string;
  description: string;
}

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
  const cleaned = persianToEnglishDigits(text.replace(/[,\s]/g, ''));
  const numMatch = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) return parseFloat(numMatch[1]);

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

const EXPENSE_PATTERNS = [
  /(\d+[۰-۹]*\s*(?:هزار|میلیون)?\s*(?:تومان|تومن|ت\b))/i,
  /(خرج|خرید|خریدم|پرداخت|پرداخت کردم|花费|دادم|داده|داد|هزینه)/,
  /(\d+[۰-۹]*\s*(?:هزار|میلیون)?)/,
];

const INCOME_PATTERNS = [
  /(حقوق|دستمزد|دریافت|گرفتم|گرفته|واریز|واریز شد|اضافه شد)/,
];

async function guessCategory(DB: D1Database, text: string, type: 'expense' | 'income'): Promise<string> {
  const lower = text.toLowerCase();
  const categoryKeywords = await getAllCategoryKeywords(DB, type);

  let bestCategory = 'Other';
  let bestScore = 0;

  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    if (cat === 'Other') continue;
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        score += kw.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat;
    }
  }

  return bestCategory;
}

function regexParse(message: string): CategorizationResult | null {
  const text = persianToEnglishDigits(message);

  const hasExpenseKeyword = EXPENSE_PATTERNS.some(p => p.test(message));
  const hasIncomeKeyword = INCOME_PATTERNS.some(p => p.test(message));

  if (!hasExpenseKeyword && !hasIncomeKeyword) return null;

  const isIncome = hasIncomeKeyword && !hasExpenseKeyword;
  const type = isIncome ? 'income' : 'expense';

  let currency = 'IRT';
  if (/ریال|rial|irr/i.test(message)) currency = 'IRR';
  else if (/\$/i.test(message)) currency = 'USD';
  else if (/€/i.test(message)) currency = 'EUR';

  let amount = 0;

  const millionMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:m\b|million|میلیون)/i);
  if (millionMatch) {
    amount = parseFloat(millionMatch[1]) * 1000000;
  }

  if (amount === 0) {
    const hazarMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:k\b|thousand|هزار)/i);
    if (hazarMatch) {
      amount = parseFloat(hazarMatch[1]) * 1000;
    }
  }

  if (amount === 0) {
    const numMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:تومان|تومن|ت\b|ریال)/i);
    if (numMatch) {
      amount = parseFloat(numMatch[1]);
    }
  }

  if (amount === 0) {
    const numMatch = text.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      amount = parseFloat(numMatch[1]);
    }
  }

  if (amount === 0) {
    const parsed = parsePersianNumber(message);
    if (parsed) amount = parsed;
  }

  if (amount <= 0) return null;

  return { isTransaction: true, type, amount, currency, category: 'Other', description: message };
}

async function getAIPrompt(DB: D1Database): Promise<string> {
  const expenseCats = (await getCategories(DB, 'expense')).map(c => c.name).join(',');
  const incomeCats = (await getCategories(DB, 'income')).map(c => c.name).join(',');

  return `Detect financial transactions in messages. Reply ONLY with JSON.

{"isTransaction":true,"type":"expense","amount":50000,"currency":"IRT","category":"Food","description":"original message"}

Fields:
- isTransaction: true if spending/earning money
- type: "expense" or "income"
- amount: positive number
- currency: "IRT" (تومان), "IRR" (ریال), "USD" ($)
- category: ${expenseCats},${incomeCats}

If the message doesn't fit any category, use "Other".
Persian: ۵۰۰۰۰=50000, هزار=1000, میلیون=1000000
حقوق=income. خرج/خرید=expense.`;
}

async function aiParse(DB: D1Database, message: string, openai: OpenAI, model: string): Promise<CategorizationResult> {
  const fallback: CategorizationResult = { isTransaction: false, type: 'expense', amount: 0, currency: 'USD', category: 'Other', description: '' };

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: await getAIPrompt(DB) },
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

async function getRecategorizePrompt(DB: D1Database, type: 'expense' | 'income'): Promise<string> {
  const cats = await getCategories(DB, type);
  const catList = cats.map(c => `- ${c.name} (${c.keywords.slice(0, 5).join(', ')})`).join('\n');

  return `This message contains a financial transaction but the category is unclear.

Pick the best category from this list:
${catList}

Reply ONLY with the category name, nothing else.
If it truly doesn't fit any category, reply: Other`;
}

async function aiReCategorize(DB: D1Database, message: string, original: CategorizationResult, openai: OpenAI, model: string): Promise<CategorizationResult> {
  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: await getRecategorizePrompt(DB, original.type) },
        { role: 'user', content: message }
      ],
      temperature: 0,
      max_tokens: 20,
    });

    const category = completion.choices[0]?.message?.content?.trim() || 'Other';
    console.log(`[AI-RECAT] "${message}" → "${category}"`);

    if (category && category !== 'Other') {
      return { ...original, category };
    }
    return original;
  } catch (error) {
    console.error('[AI-RECAT] Error:', error);
    return original;
  }
}

export async function categorizeMessage(DB: D1Database, message: string, openai: OpenAI, model: string): Promise<CategorizationResult> {
  const regexResult = regexParse(message);
  if (regexResult) {
    console.log(`[REGEX] Matched: type=${regexResult.type} amount=${regexResult.amount} currency=${regexResult.currency} category=${regexResult.category}`);

    if (regexResult.category === 'Other') {
      console.log(`[REGEX] Category is Other, asking AI for better category`);
      const aiResult = await aiReCategorize(DB, message, regexResult, openai, model);
      await incrementCategoryUsage(DB, aiResult.category, aiResult.type);
      return aiResult;
    }

    await incrementCategoryUsage(DB, regexResult.category, regexResult.type);
    return regexResult;
  }

  console.log(`[REGEX] No match, falling back to AI`);
  const aiResult = await aiParse(DB, message, openai, model);
  if (aiResult.isTransaction) {
    await incrementCategoryUsage(DB, aiResult.category, aiResult.type);
  }
  return aiResult;
}

export async function learnFromCorrection(
  DB: D1Database,
  originalMessage: string,
  correctCategory: string,
  type: 'expense' | 'income'
): Promise<void> {
  const words = originalMessage
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);

  const cats = await getCategories(DB, type);
  const existing = cats.find(c => c.name === correctCategory);

  if (existing) {
    let added = 0;
    for (const word of words) {
      if (!existing.keywords.includes(word) && added < 3) {
        await addCategoryKeyword(DB, correctCategory, type, word);
        added++;
      }
    }
    await incrementCategoryUsage(DB, correctCategory, type);
  } else {
    await createCategory(DB, correctCategory, type, words.slice(0, 5));
  }
}

export async function learnFromAI(
  DB: D1Database,
  message: string,
  aiCategory: string,
  type: 'expense' | 'income'
): Promise<void> {
  const cats = await getCategories(DB, type);
  const existing = cats.find(c => c.name === aiCategory);

  if (!existing && aiCategory !== 'Other') {
    const words = message
      .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1);
    await createCategory(DB, aiCategory, type, words.slice(0, 5));
  }
}
