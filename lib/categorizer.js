import { fetch } from 'sdk';
import { getSecret } from 'lib/config';
import {
  getAllCategoryKeywords,
  getCategories,
  incrementCategoryUsage,
  addCategoryKeyword,
  createCategory,
} from 'lib/database';

const PERSIAN_NUMS = {
  'صفر': 0, 'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5,
  'شش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10,
  'بیست': 20, 'سی': 30, 'چهل': 40, 'پنجاه': 50,
  'شصت': 60, 'هفتاد': 70, 'هشتاد': 80, 'نود': 90,
  'صد': 100, 'هزار': 1000, 'میلیون': 1000000, 'میلیارد': 1000000000,
};

function persianToEnglishDigits(str) {
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  return str.split('').map(c => {
    const idx = persianDigits.indexOf(c);
    return idx >= 0 ? idx.toString() : c;
  }).join('');
}

function parsePersianNumber(text) {
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

async function guessCategory(text, type) {
  const lower = text.toLowerCase();
  const categoryKeywords = await getAllCategoryKeywords(type);

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

function regexParse(message) {
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
  if (millionMatch) amount = parseFloat(millionMatch[1]) * 1000000;

  if (amount === 0) {
    const hazarMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:k\b|thousand|هزار)/i);
    if (hazarMatch) amount = parseFloat(hazarMatch[1]) * 1000;
  }

  if (amount === 0) {
    const numMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:تومان|تومن|ت\b|ریال)/i);
    if (numMatch) amount = parseFloat(numMatch[1]);
  }

  if (amount === 0) {
    const numMatch = text.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) amount = parseFloat(numMatch[1]);
  }

  if (amount === 0) {
    const parsed = parsePersianNumber(message);
    if (parsed) amount = parsed;
  }

  if (amount <= 0) return null;

  return { isTransaction: true, type, amount, currency, category: 'Other', description: message };
}

function getAIPrompt(expenseCats, incomeCats) {
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

async function aiParse(message) {
  const fallback = { isTransaction: false, type: 'expense', amount: 0, currency: 'USD', category: 'Other', description: '' };

  const apiKey = await getSecret('OPENCODE_API_KEY');
  if (!apiKey) return fallback;

  const model = await getSecret('OPENCODE_MODEL') || 'deepseek-v4-flash-free';
  const expenseCats = (await getCategories('expense')).map(c => c.name).join(',');
  const incomeCats = (await getCategories('income')).map(c => c.name).join(',');

  try {
    const res = await fetch('https://opencode.ai/zen/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: getAIPrompt(expenseCats, incomeCats) },
          { role: 'user', content: message },
        ],
        temperature: 0,
        max_tokens: 150,
      }),
    });

    if (!res.ok) return fallback;

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return fallback;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    return JSON.parse(jsonMatch[0]);
  } catch {
    return fallback;
  }
}

function getRecategorizePrompt(type) {
  return async () => {
    const cats = await getCategories(type);
    const catList = cats.map(c => `- ${c.name} (${c.keywords.slice(0, 5).join(', ')})`).join('\n');
    return `This message contains a financial transaction but the category is unclear.

Pick the best category from this list:
${catList}

Reply ONLY with the category name, nothing else.
If it truly doesn't fit any category, reply: Other`;
  };
}

async function aiReCategorize(message, original) {
  const apiKey = await getSecret('OPENCODE_API_KEY');
  if (!apiKey) return original;

  const model = await getSecret('OPENCODE_MODEL') || 'deepseek-v4-flash-free';
  const promptFn = getRecategorizePrompt(original.type);
  const prompt = await promptFn();

  try {
    const res = await fetch('https://opencode.ai/zen/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: message },
        ],
        temperature: 0,
        max_tokens: 20,
      }),
    });

    if (!res.ok) return original;

    const data = await res.json();
    const category = data.choices?.[0]?.message?.content?.trim() || 'Other';

    if (category && category !== 'Other') {
      return { ...original, category };
    }
    return original;
  } catch {
    return original;
  }
}

export async function categorizeMessage(message) {
  const regexResult = regexParse(message);
  if (regexResult) {
    if (regexResult.category === 'Other') {
      const aiResult = await aiReCategorize(message, regexResult);
      await incrementCategoryUsage(aiResult.category, aiResult.type);
      return aiResult;
    }

    await incrementCategoryUsage(regexResult.category, regexResult.type);
    return regexResult;
  }

  const aiResult = await aiParse(message);
  if (aiResult.isTransaction) {
    await incrementCategoryUsage(aiResult.category, aiResult.type);
  }
  return aiResult;
}

export async function learnFromCorrection(originalMessage, correctCategory, type) {
  const words = originalMessage
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);

  const cats = await getCategories(type);
  const existing = cats.find(c => c.name === correctCategory);

  if (existing) {
    let added = 0;
    for (const word of words) {
      if (!existing.keywords.includes(word) && added < 3) {
        await addCategoryKeyword(correctCategory, type, word);
        added++;
      }
    }
    await incrementCategoryUsage(correctCategory, type);
  } else {
    await createCategory(correctCategory, type, words.slice(0, 5));
  }
}
