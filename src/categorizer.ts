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

// Category keyword mapping (Persian + English)
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Food: [
    'غذا', 'ناهار', 'شام', 'صبحانه', 'میان‌وعده', 'عصرانه',
    'رستوران', 'کافه', 'کافی‌شاپ', 'فست فود', 'پیتزا', 'برگر', 'ساندویچ',
    'آبمیوه', 'چای', 'قهوه', 'نسکافه', 'هات‌چاکلت', 'اسموتی',
    'اسنک', 'آدامس', 'شکلات', 'شیرینی', 'کیک', 'بیسکویت', 'آجیل',
    'خوراکی', 'خوردن', 'خوراک', 'خورید', 'خورده',
    'برنج', 'ماکارونی', 'سالاد', 'سوپ', 'آش', 'حلیم',
    'مرغ', 'گوشت', 'ماهی', 'تخم‌مرغ', 'پنیر', 'ماست', 'شیر',
    'میوه', 'سیب', 'موز', 'پرتقال', 'انگور', 'هلو', 'هندوانه', 'طالبی', 'گوجه', 'خیار', 'کاهو', 'سبزی',
    'نان', 'رب', 'روغن', 'نمک', 'فلفل', 'ادویه',
    'نوشابه', 'آب', 'دلستر', 'ماءالشعیر',
    'سوپرمارکت', 'هایپرمارکت', 'بقالی', 'سبزی‌فروشی', 'میوه‌فروشی', 'قصابی', 'نانوایی',
    'رستوران', 'چلوکبابی', 'جگرکی', 'آش‌فروشی',
    'فودکورت', 'بوفه', 'سلف',
    'سوسیس', 'کالباس', 'همبرگر', 'کباب', 'زردن', 'جوجه', 'کوفته', 'آبگوشت',
    'دمنوش', 'اسپرسو', 'لاتte', 'کاپوچینو', 'موکا',
    'سلمنی', 'سالمون', 'ماهی سالمون',
  ],
  Transport: [
    'تاکسی', 'مترو', 'اتوبوس', 'ون', 'سرویس',
    'بنزین', 'گاز', 'نفت', 'سوخت',
    'ماشین', 'خودرو', 'وسیله‌نقلیه',
    'اسنپ', 'تپسی', 'پیک موتور',
    'مسافربر', 'آژانس',
    'گاراژ',
    'عوارضی', 'بیمه ماشین', 'بیمه خودرو',
    'لاستیک', 'روغن‌ماشین', 'فیلتر', 'لنت', 'تعمیرگاه', 'مکانیک',
    'قطار', 'هواپیما', 'فرودگاه',
  ],
  Shopping: [
    'خرید', 'خریدم', 'خریده', 'خریداری',
    'فروشگاه', 'مغازه', 'بازار', 'بازارچه',
    'لباس', 'پیراهن', 'شلوار', 'کاپشن', 'کت', 'دامن',
    'کفش', 'دمپایی', 'صندل', 'بوت', 'کتونی',
    'کیف', 'کوله', 'کیف پول',
    'عینک', 'ساعت', 'انگشتر', 'گردنبند', 'دستبند',
    'آرایشی', 'لوازم‌آرایش', 'عطر', 'ادکلن', 'لوسیون',
    'آنلاین', 'اینترنتی', 'فروشگاه آنلاین',
    'دیجی‌کالا', 'ترب', 'بامیلو',
    'الکترونیک', 'لپ‌تاپ', 'موبایل', 'تبلت',
  ],
  Bills: [
    'قبض', 'صورتحساب', 'bill',
    'آب', 'آب‌ بها', 'فاضلاب',
    'برق', 'برق‌ بها',
    'گاز', 'گاز‌ بها',
    'تلفن', 'تلفن ثابت', 'همراه',
    'اینترنت', 'پهن باند', 'ADSL',
    'شارژ', 'شارژ موبایل', 'شارژ تلفن',
    'rent', 'اجاره', 'اجاره خونه', 'اجاره مسکن',
    'شارژ همراه', 'شارژ ایرانسل', 'شارژ همراه اول',
    'جریمه',
    'مالیات', 'مالیات بر ارزش افزوده',
    'حق عضویت', 'عضویت', 'اشتراک',
    'پارکینگ',
  ],
  Entertainment: [
    'سینما', 'فیلم', 'سریال', 'series',
    'بازی', 'گیم', 'ps5', 'ps4', 'ایکس‌باکس', 'کنسول', 'gaming',
    'تفریح', 'سرگرمی', 'هیجان',
    'کنسرت', 'موسیقی', 'آهنگ', 'کلیپ',
    'مسابقه', 'فوتبال', 'والیبال', 'بسکتبال',
    'ورزش', 'باشگاه', 'بدنسازی', 'یوگا', 'استخر',
    'کتاب', 'کتابخانه',
    'هتل', 'اقامت', 'مسافرت', 'سفر', 'گردشگری',
    'تور', 'راهنما',
    'بیلیارد', 'بولینگ', 'تیراندازی', 'کارتینگ',
    'بلیط', 'ورزشگاه',
    'پارک تفریحی', 'شهربازی', 'باغ وحش',
  ],
  Health: [
    'دارو', 'داروخانه', 'قرص', 'محلول', 'قطره', 'آمپول',
    'درمان', 'درمانگاه', 'کلینیک',
    'پزشک', 'دکتر', 'متخصص', 'جراح',
    'بیمارستان', 'بیمار', 'بستری',
    'آزمایش', 'آزمایشگاه',
    'رادیولوژی', 'سونوگرافی', 'ام‌آر‌آی', 'سی‌تی‌اسکن',
    'فیزیوتراپی', 'کاردرمانی',
    'دندانپزشک', 'دندان', 'لمینت', 'کامپوزیت', 'ارتودنسی',
    'بینایی‌سنجی', 'عینک طبی',
    'واکسن', 'واکسیناسیون',
    'ویتامین', 'مکمل',
    'جراحی', 'عمل', 'بیهوشی',
    'اورژانس', 'امداد',
  ],
  Education: [
    'آموزش', 'آموزشگاه',
    'کلاس', 'کلاس آموزشی',
    'دوره', 'دوره آموزشی', 'کارگاه',
    'کتاب', 'کتاب درسی', 'کتاب کمک‌ آموزشی',
    'مدرسه', 'دبستان', 'دبیرستان', 'هنرستان',
    'دانشگاه', 'دانشکده', 'مقاطع',
    'شهریه', 'شهریه مدرسه', 'شهریه دانشگاه',
    'تدریس', 'معلم', 'استاد', 'استاد دانشگاه',
    'آزمون', 'کنکور', 'امتحان',
    'گواهینامه', 'مدرک', 'sertificat',
    'زبان', 'آموزش زبان', 'انگلیسی', 'آلمانی', 'فرانسوی',
    'کامپیوتر', 'برنامه‌نویسی', 'programming', 'coding',
    'نقاشی', 'موسیقی', 'گیتار', 'پیانو', 'ویولن',
  ],
  Salary: [
    'حقوق', 'حقوق ماه', 'حقوق ماهانه', 'حقوق عقب‌ افتاده',
    'دستمزد', 'پرداخت دستمزد',
    'حقوق ویژه', 'حقوق اضافه', 'اضافه‌ کار',
    'پاداش', ' bonus',
    'کارانه',
    'حقوق بازنشستگی', 'مستمری',
  ],
  Freelance: [
    'فریلنسر', 'فریلنسری', 'freelance',
    'پروژه', 'پروژه آزاد', 'پروژه‌ای',
    'قرارداد', 'قرارداد کاری', 'قرارداد پیمانکاری',
    'کار آزاد',
    'مشاوره', 'مشاور',
    'طراحی', 'برنامه‌نویسی',
  ],
  Gift: [
    'هدیه', 'gift',
    'عیدی', 'عید',
    'جایزه', ' prize',
    'سورپرایز', 'surprise',
    'کادو', 'کارت هدیه',
    'خیرات', 'صدقه',
  ],
  Refund: [
    'بازپرداخت', 'بازگشت پول', 'refunded',
    'برگشت', 'برگشت پول', 'برگشت وجه',
    'مرجوع', 'مرجوعی',
    'استرداد', 'استرداد وجه',
  ],
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

  // Try "X m/million/میلیون" pattern
  const millionMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:m\b|million|میلیون)/i);
  if (millionMatch) {
    amount = parseFloat(millionMatch[1]) * 1000000;
  }

  // Try "X k/thousand/هزار" pattern
  if (amount === 0) {
    const hazarMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:k\b|thousand|هزار)/i);
    if (hazarMatch) {
      amount = parseFloat(hazarMatch[1]) * 1000;
    }
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

const RECATEGORIZE_PROMPT = `This message contains a financial transaction but the category is unclear.

Pick the best category from this list:
- Food (غذا, خوراکی, رستوران, نوشیدنی, میوه, سبزی, گوشت, نان)
- Transport (حمل‌ونقل, تاکسی, بنزین, ماشین, مترو, اتوبوس)
- Shopping (خرید, لباس, کفش, کیف, آرایشی, الکترونیک)
- Bills (قبض, آب, برق, گاز, تلفن, اینترنت, اجاره, شارژ)
- Entertainment (سرگرمی, ورزش, بازی, سینما, مسافرت, هتل)
- Health (سلامت, دارو, دکتر, بیمارستان, دندانپزشک)
- Education (آموزش, کلاس, کتاب, مدرسه, دانشگاه)
- Salary (حقوق, دستمزد, پاداش)
- Freelance (فریلنسر, پروژه, قرارداد)
- Gift (هدیه, عیدی, جایزه, کادو)
- Refund (بازپرداخت, برگشت پول, مرجوع)

Reply ONLY with the category name, nothing else.
If it truly doesn't fit any category, reply: Other`;

async function aiReCategorize(message: string, original: CategorizationResult): Promise<CategorizationResult> {
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: RECATEGORIZE_PROMPT },
        { role: 'user', content: message }
      ],
      temperature: 0,
      max_tokens: 20,
    });

    const category = completion.choices[0]?.message?.content?.trim() || 'Other';
    console.log(`[AI-RECAT] "${message}" → "${category}"`);

    // If AI says Other, keep original. Otherwise use AI's category.
    if (category && category !== 'Other') {
      return { ...original, category };
    }
    return original;
  } catch (error) {
    console.error('[AI-RECAT] Error:', error);
    return original;
  }
}

export async function categorizeMessage(message: string): Promise<CategorizationResult> {
  // Step 1: Try regex first (fast, no API call)
  const regexResult = regexParse(message);
  if (regexResult) {
    console.log(`[REGEX] Matched: type=${regexResult.type} amount=${regexResult.amount} currency=${regexResult.currency} category=${regexResult.category}`);

    // Step 2: If category is Other, ask AI for better categorization
    if (regexResult.category === 'Other') {
      console.log(`[REGEX] Category is Other, asking AI for better category`);
      const aiResult = await aiReCategorize(message, regexResult);
      return aiResult;
    }

    return regexResult;
  }

  // Step 3: Fallback to AI for ambiguous messages
  console.log(`[REGEX] No match, falling back to AI`);
  return aiParse(message);
}
