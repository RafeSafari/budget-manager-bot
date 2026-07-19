import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { getCategorySummary, getUserSummary, getTransactions, Transaction, getLanguage } from './database';
import { msg } from './messages';

type Lang = 'fa' | 'en';

const CATEGORY_LABELS: Record<string, Record<Lang, string>> = {
  Food: { fa: 'غذا', en: 'Food' },
  Transport: { fa: 'حمل‌ونقل', en: 'Transport' },
  Shopping: { fa: 'خرید', en: 'Shopping' },
  Bills: { fa: 'قبض', en: 'Bills' },
  Entertainment: { fa: 'سرگرمی', en: 'Entertainment' },
  Health: { fa: 'سلامت', en: 'Health' },
  Education: { fa: 'آموزش', en: 'Education' },
  Salary: { fa: 'حقوق', en: 'Salary' },
  Freelance: { fa: 'فریلنسری', en: 'Freelance' },
  Gift: { fa: 'هدیه', en: 'Gift' },
  Refund: { fa: 'بازپرداخت', en: 'Refund' },
  Other: { fa: 'سایر', en: 'Other' },
};

const CATEGORY_EMOJIS: Record<string, string> = {
  Food: '🍔', Transport: '🚗', Shopping: '🛒', Bills: '📄',
  Entertainment: '🎮', Health: '💊', Education: '📚',
  Salary: '💰', Freelance: '💻', Gift: '🎁', Refund: '💸', Other: '📌',
};

function formatCurrency(amount: number, currency: string = 'IRT'): string {
  switch (currency) {
    case 'IRT':
      return `${amount.toLocaleString('fa-IR')} تومان`;
    case 'IRR':
      return `${amount.toLocaleString('fa-IR')} ریال`;
    case 'USD':
      return `$${amount.toLocaleString('en-US')}`;
    case 'EUR':
      return `€${amount.toLocaleString('en-US')}`;
    default:
      return `${amount.toLocaleString()} ${currency}`;
  }
}

function getCategoryLabel(category: string, lang: Lang): string {
  return CATEGORY_LABELS[category]?.[lang] || category;
}

function getCategoryEmoji(category: string): string {
  return CATEGORY_EMOJIS[category] || '📌';
}

export function generateWeeklyReport(chatId: number): string {
  const now = new Date();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEndObj = endOfWeek(now, { weekStartsOn: 1 });
  weekEndObj.setDate(weekEndObj.getDate() + 1);
  const weekEnd = format(weekEndObj, 'yyyy-MM-dd');

  return generateReport(chatId, weekStart, weekEnd, 'weekly_report');
}

export function generateMonthlyReport(chatId: number): string {
  const now = new Date();
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEndObj = endOfMonth(now);
  monthEndObj.setDate(monthEndObj.getDate() + 1);
  const monthEnd = format(monthEndObj, 'yyyy-MM-dd');

  return generateReport(chatId, monthStart, monthEnd, 'monthly_report');
}

export function generateCustomReport(chatId: number, startDate: string, endDate: string): string {
  return generateReport(chatId, startDate, endDate, 'weekly_report');
}

function generateReport(chatId: number, startDate: string, endDate: string, periodKey: string): string {
  const lang = getLanguage(chatId);
  const expenses = getCategorySummary(chatId, startDate, endDate, 'expense');
  const income = getCategorySummary(chatId, startDate, endDate, 'income');
  const userExpenses = getUserSummary(chatId, startDate, endDate, 'expense');
  const userIncome = getUserSummary(chatId, startDate, endDate, 'income');

  const totalExpenses = expenses.reduce((sum, e) => sum + e.total, 0);
  const totalIncome = income.reduce((sum, i) => sum + i.total, 0);
  const balance = totalIncome - totalExpenses;

  if (expenses.length === 0 && income.length === 0) {
    return `📊 ${msg(periodKey, lang)} (${startDate} — ${endDate})\n\n${msg('no_transactions', lang)}`;
  }

  let report = `📊 ${msg(periodKey, lang)} (${startDate} — ${endDate})\n\n`;

  if (income.length > 0) {
    report += `💰 ${msg('income_label', lang)}: ${formatCurrency(totalIncome, income[0]?.currency || 'IRT')}\n`;
    for (const inc of income) {
      report += `  ${getCategoryEmoji(inc.category)} ${getCategoryLabel(inc.category, lang)}: ${formatCurrency(inc.total, inc.currency || 'IRT')} (${inc.count})\n`;
    }
    report += '\n';
  }

  if (expenses.length > 0) {
    report += `💸 ${msg('expenses_label', lang)}: ${formatCurrency(totalExpenses, expenses[0]?.currency || 'IRT')}\n`;
    for (const exp of expenses) {
      report += `  ${getCategoryEmoji(exp.category)} ${getCategoryLabel(exp.category, lang)}: ${formatCurrency(exp.total, exp.currency || 'IRT')} (${exp.count})\n`;
    }
    report += '\n';
  }

  const balanceEmoji = balance >= 0 ? '✅' : '⚠️';
  report += `${balanceEmoji} ${msg('balance_label', lang)}: ${formatCurrency(balance, expenses[0]?.currency || income[0]?.currency || 'IRT')}\n\n`;

  if (userExpenses.length > 0) {
    report += `👥 ${msg('expenses_by_user', lang)}\n`;
    for (const user of userExpenses) {
      report += `  • ${user.username}: ${formatCurrency(user.total, expenses[0]?.currency || 'IRT')}\n`;
    }
    report += '\n';
  }

  if (userIncome.length > 0) {
    report += `👥 ${msg('income_by_user', lang)}\n`;
    for (const user of userIncome) {
      report += `  • ${user.username}: ${formatCurrency(user.total, income[0]?.currency || 'IRT')}\n`;
    }
  }

  return report.trim();
}

export function generateTransactionList(
  chatId: number,
  startDate: string,
  endDate?: string,
  type?: 'expense' | 'income'
): string {
  const lang = getLanguage(chatId);
  const transactions = getTransactions(chatId, startDate, endDate, type);

  if (transactions.length === 0) {
    return msg('no_transactions', lang);
  }

  const period = endDate ? `${startDate} — ${endDate}` : `${msg('from_label', lang)} ${startDate}`;
  let list = `📋 ${msg('transactions_list', lang)} (${period}):\n\n`;
  for (const t of transactions) {
    const emoji = t.type === 'expense' ? '💸' : '💰';
    const catEmoji = getCategoryEmoji(t.category);
    list += `${emoji} #${t.id} | ${t.username} | ${formatCurrency(t.amount, t.currency)} | ${catEmoji} ${getCategoryLabel(t.category, lang)} | ${t.description || t.original_message}\n`;
  }

  return list.trim();
}
