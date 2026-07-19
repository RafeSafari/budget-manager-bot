import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { getCategorySummary, getUserSummary, getTransactions, Transaction } from './database';

const CATEGORY_LABELS: Record<string, string> = {
  Food: 'غذا / Food',
  Transport: 'حمل‌ونقل / Transport',
  Shopping: 'خرید / Shopping',
  Bills: ' قبض / Bills',
  Entertainment: 'سرگرمی / Entertainment',
  Health: 'سلامت / Health',
  Education: 'آموزش / Education',
  Salary: 'حقوق / Salary',
  Freelance: 'فریلنسری / Freelance',
  Gift: 'هدیه / Gift',
  Refund: 'بازپرداخت / Refund',
  Other: 'سایر / Other',
};

function formatCurrency(amount: number, currency: string = 'USD'): string {
  switch (currency) {
    case 'IRT':
      return `${amount.toLocaleString('fa-IR')} تومان`;
    case 'IRR':
      return `${amount.toLocaleString('fa-IR')} ریال`;
    default:
      try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
      } catch {
        return `${amount.toLocaleString()} ${currency}`;
      }
  }
}

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || `${category} / ${category}`;
}

function getCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    Food: '🍔',
    Transport: '🚗',
    Shopping: '🛒',
    Bills: '📄',
    Entertainment: '🎮',
    Health: '💊',
    Education: '📚',
    Salary: '💰',
    Freelance: '💻',
    Gift: '🎁',
    Refund: '💸',
    Other: '📌',
  };
  return emojis[category] || '📌';
}

export function generateWeeklyReport(chatId: number): string {
  const now = new Date();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEndObj = endOfWeek(now, { weekStartsOn: 1 });
  weekEndObj.setDate(weekEndObj.getDate() + 1);
  const weekEnd = format(weekEndObj, 'yyyy-MM-dd');

  return generateReport(chatId, weekStart, weekEnd, 'هفتگی / Weekly');
}

export function generateMonthlyReport(chatId: number): string {
  const now = new Date();
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEndObj = endOfMonth(now);
  monthEndObj.setDate(monthEndObj.getDate() + 1);
  const monthEnd = format(monthEndObj, 'yyyy-MM-dd');

  return generateReport(chatId, monthStart, monthEnd, 'ماهانه / Monthly');
}

export function generateCustomReport(chatId: number, startDate: string, endDate: string): string {
  return generateReport(chatId, startDate, endDate, 'سفارشی / Custom');
}

function generateReport(chatId: number, startDate: string, endDate: string, period: string): string {
  const expenses = getCategorySummary(chatId, startDate, endDate, 'expense');
  const income = getCategorySummary(chatId, startDate, endDate, 'income');
  const userExpenses = getUserSummary(chatId, startDate, endDate, 'expense');
  const userIncome = getUserSummary(chatId, startDate, endDate, 'income');

  const totalExpenses = expenses.reduce((sum, e) => sum + e.total, 0);
  const totalIncome = income.reduce((sum, i) => sum + i.total, 0);
  const balance = totalIncome - totalExpenses;

  if (expenses.length === 0 && income.length === 0) {
    return `📊 گزارش ${period} (${startDate} تا ${endDate})\n\nتراکنشی ثبت نشده.\nNo transactions recorded.`;
  }

  let report = `📊 گزارش ${period} (${startDate} تا ${endDate})\n\n`;

  // Income section
  if (income.length > 0) {
    report += `💰 درآمد / INCOME: ${formatCurrency(totalIncome, income[0]?.currency || 'USD')}\n`;
    for (const inc of income) {
      report += `  ${getCategoryEmoji(inc.category)} ${getCategoryLabel(inc.category)}: ${formatCurrency(inc.total, inc.currency || 'USD')} (${inc.count})\n`;
    }
    report += '\n';
  }

  // Expense section
  if (expenses.length > 0) {
    report += `💸 هزینه‌ها / EXPENSES: ${formatCurrency(totalExpenses, expenses[0]?.currency || 'USD')}\n`;
    for (const exp of expenses) {
      report += `  ${getCategoryEmoji(exp.category)} ${getCategoryLabel(exp.category)}: ${formatCurrency(exp.total, exp.currency || 'USD')} (${exp.count})\n`;
    }
    report += '\n';
  }

  // Balance
  const balanceEmoji = balance >= 0 ? '✅' : '⚠️';
  report += `${balanceEmoji} موجودی / BALANCE: ${formatCurrency(balance, expenses[0]?.currency || income[0]?.currency || 'USD')}\n\n`;

  // User breakdown
  if (userExpenses.length > 0) {
    report += `👥 هزینه‌ها به تفکیک کاربر:\n`;
    for (const user of userExpenses) {
      report += `  • ${user.username}: ${formatCurrency(user.total)}\n`;
    }
    report += '\n';
  }

  if (userIncome.length > 0) {
    report += `👥 درآمد به تفکیک کاربر:\n`;
    for (const user of userIncome) {
      report += `  • ${user.username}: ${formatCurrency(user.total)}\n`;
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
  const transactions = getTransactions(chatId, startDate, endDate, type);

  if (transactions.length === 0) {
    return 'تراکنشی یافت نشد.\nNo transactions found.';
  }

  const period = endDate ? `${startDate} تا ${endDate}` : `از ${startDate}`;
  let list = `📋 تراکنش‌ها (${period}):\n\n`;
  for (const t of transactions) {
    const emoji = t.type === 'expense' ? '💸' : '💰';
    const catEmoji = getCategoryEmoji(t.category);
    list += `${emoji} #${t.id} | ${t.username} | ${formatCurrency(t.amount, t.currency)} | ${catEmoji} ${getCategoryLabel(t.category)} | ${t.description || t.original_message}\n`;
  }

  return list.trim();
}
