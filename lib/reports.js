import { getCategorySummary, getUserSummary, getTransactions, getLanguage } from 'lib/database';
import { msg } from 'lib/messages';

const CATEGORY_LABELS = {
  Food:          { fa: 'غذا', en: 'Food' },
  Transport:     { fa: 'حمل‌ونقل', en: 'Transport' },
  Shopping:      { fa: 'خرید', en: 'Shopping' },
  Bills:         { fa: 'قبض', en: 'Bills' },
  Entertainment: { fa: 'سرگرمی', en: 'Entertainment' },
  Health:        { fa: 'سلامت', en: 'Health' },
  Education:     { fa: 'آموزش', en: 'Education' },
  Salary:        { fa: 'حقوق', en: 'Salary' },
  Freelance:     { fa: 'فریلنسری', en: 'Freelance' },
  Gift:          { fa: 'هدیه', en: 'Gift' },
  Refund:        { fa: 'بازپرداخت', en: 'Refund' },
  Other:         { fa: 'سایر', en: 'Other' },
};

const CATEGORY_EMOJIS = {
  Food: '🍔', Transport: '🚗', Shopping: '🛒', Bills: '📄',
  Entertainment: '🎮', Health: '💊', Education: '📚',
  Salary: '💰', Freelance: '💻', Gift: '🎁', Refund: '💸', Other: '📌',
};

function formatCurrency(amount, currency = 'IRT') {
  switch (currency) {
    case 'IRT': return `${amount.toLocaleString('fa-IR')} تومان`;
    case 'IRR': return `${amount.toLocaleString('fa-IR')} ریال`;
    case 'USD': return `$${amount.toLocaleString('en-US')}`;
    case 'EUR': return `€${amount.toLocaleString('en-US')}`;
    default:    return `${amount.toLocaleString()} ${currency}`;
  }
}

function getCategoryLabel(category, lang) {
  return CATEGORY_LABELS[category]?.[lang] || category;
}

function getCategoryEmoji(category) {
  return CATEGORY_EMOJIS[category] || '📌';
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

function getMonthRange() {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const endObj = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const end = endObj.toISOString().split('T')[0];
  return { start, end };
}

async function generateReport(chatId, startDate, endDate, periodKey) {
  const lang = await getLanguage(chatId);
  const expenses = await getCategorySummary(chatId, startDate, endDate, 'expense');
  const income = await getCategorySummary(chatId, startDate, endDate, 'income');
  const userExpenses = await getUserSummary(chatId, startDate, endDate, 'expense');
  const userIncome = await getUserSummary(chatId, startDate, endDate, 'income');

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

export async function generateWeeklyReport(chatId) {
  const { start, end } = getWeekRange();
  return generateReport(chatId, start, end, 'weekly_report');
}

export async function generateMonthlyReport(chatId) {
  const { start, end } = getMonthRange();
  return generateReport(chatId, start, end, 'monthly_report');
}

export async function generateTransactionList(chatId, startDate, endDate, type) {
  const lang = await getLanguage(chatId);
  const transactions = await getTransactions(chatId, startDate, endDate, type);

  if (transactions.length === 0) {
    return msg('no_transactions', lang);
  }

  const period = endDate ? `${startDate} — ${endDate}` : `${msg('from_label', lang)} ${startDate}`;
  let list = `📋 ${msg('transactions_list', lang)} (${period}):\n\n`;
  for (const t of transactions) {
    const emoji = t.type === 'expense' ? '💸' : '💰';
    const catEmoji = getCategoryEmoji(t.category);
    list += `${emoji} #${t.id} | ${t.username} | ${formatCurrency(t.amount, t.currency)} | ${catEmoji} ${getCategoryLabel(t.category, lang)} | ${t.description || t.originalMessage}\n`;
  }

  return list.trim();
}
