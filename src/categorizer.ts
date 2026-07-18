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

const SYSTEM_PROMPT = `Analyze messages and detect financial transactions.

Reply ONLY with a JSON object, nothing else:
{"isTransaction":true,"type":"expense","amount":50000,"currency":"IRT","category":"Food","description":"message text"}

Rules:
- isTransaction: true if spending or earning money, false otherwise
- type: "expense" or "income"
- amount: positive number in original currency
- currency: "IRT" for تومان, "IRR" for ریال, "USD" for $
- category: one of ${EXPENSE_CATEGORIES} or ${INCOME_CATEGORIES}
- Persian digits like ۵۰۰۰۰ = 50000
- "هزار" = 1000, "میلیون" = 1000000
- "حقوق" = income, "خرج" or "خرید" = expense`;

const MODEL = process.env.OPENCODE_MODEL || 'deepseek-v4-flash-free';

export async function categorizeMessage(message: string): Promise<CategorizationResult> {
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
    console.log(`[AI] Raw response: "${content}"`);

    if (!content) {
      console.log('[AI] Empty response');
      return fallback;
    }

    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('[AI] No JSON found in response');
      return fallback;
    }

    console.log(`[AI] Parsed JSON: ${jsonMatch[0]}`);
    const result = JSON.parse(jsonMatch[0]) as CategorizationResult;
    console.log(`[AI] isTransaction=${result.isTransaction} amount=${result.amount} currency=${result.currency} category=${result.category}`);
    return result;
  } catch (error) {
    console.error('[AI] Error:', error);
    return fallback;
  }
}
