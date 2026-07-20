import { api } from 'sdk';
import { setSecret } from 'lib/config';
import { categorizeMessage, learnFromCorrection } from 'lib/categorizer';
import {
  insertTransaction, deleteTransaction, getLastTransaction,
  getTransaction, getLanguage, setLanguage, updateTransactionCategory,
  getCategories, setBudget, getBudgets, getBudget, deleteBudget,
  getSpentThisMonth, getTransactionsForExport,
} from 'lib/database';
import { generateWeeklyReport, generateMonthlyReport, generateTransactionList } from 'lib/reports';
import { msg, catName } from 'lib/messages';

export default async function (message, ctx) {
  const chatId = message.chat?.id;
  const text = message.text;

  if (!chatId || !text) return;
  if (message.chat?.type !== 'group' && message.chat?.type !== 'supergroup') return;

  const command = text.split(' ')[0]?.toLowerCase();

  if (command === '/start') {
    const lang = await getLanguage(chatId);
    await api.sendMessage({ chat_id: chatId, text: msg('welcome', lang) });
    return;
  }

  if (command === '/help') {
    const lang = await getLanguage(chatId);
    await api.sendMessage({ chat_id: chatId, text: msg('help', lang) });
    return;
  }

  if (command === '/lang') {
    const args = text.split(' ');
    const langArg = args[1]?.toLowerCase();
    if (langArg === 'fa' || langArg === 'en') {
      await setLanguage(chatId, langArg);
      await api.sendMessage({ chat_id: chatId, text: msg('lang_switched', langArg) });
    } else {
      const currentLang = await getLanguage(chatId);
      await api.sendMessage({ chat_id: chatId, text: msg('lang_current', currentLang) });
    }
    return;
  }

  if (command === '/weekly') {
    const report = await generateWeeklyReport(chatId);
    await api.sendMessage({ chat_id: chatId, text: report });
    return;
  }

  if (command === '/monthly') {
    const report = await generateMonthlyReport(chatId);
    await api.sendMessage({ chat_id: chatId, text: report });
    return;
  }

  if (command === '/list') {
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const list = await generateTransactionList(chatId, startDate);
    await api.sendMessage({ chat_id: chatId, text: list });
    return;
  }

  if (command === '/delete') {
    const lang = await getLanguage(chatId);
    const args = text.split(' ');
    const arg = args[1]?.toLowerCase() || '';

    let txToDelete = null;

    if (arg === 'last' || arg === 'latest') {
      txToDelete = await getLastTransaction(chatId);
      if (!txToDelete) {
        await api.sendMessage({ chat_id: chatId, text: msg('no_tx_to_delete', lang) });
        return;
      }
    } else {
      const id = parseInt(arg);
      if (isNaN(id)) {
        await api.sendMessage({ chat_id: chatId, text: msg('delete_usage', lang) });
        return;
      }
      txToDelete = await getTransaction(id, chatId);
      if (!txToDelete) {
        await api.sendMessage({ chat_id: chatId, text: `❌ #${id} ${msg('tx_not_found', lang)}` });
        return;
      }
    }

    const success = await deleteTransaction(txToDelete.id, chatId);
    if (success) {
      const emoji = txToDelete.type === 'expense' ? '💸' : '💰';
      const typeLabel = txToDelete.type === 'expense' ? msg('type_expense', lang) : msg('type_income', lang);
      await api.sendMessage({
        chat_id: chatId,
        text:
          `${emoji} ❌ #${txToDelete.id} ${msg('deleted_label', lang)}\n\n` +
          `${typeLabel} | ${txToDelete.amount} ${txToDelete.currency}\n` +
          `${msg('category_label', lang)}: ${catName(txToDelete.category, lang)}\n` +
          `${msg('description_label', lang)}: ${txToDelete.description || '—'}\n` +
          `${msg('user_label', lang)}: ${txToDelete.username}`,
      });
    }
    return;
  }

  if (command === '/budget') {
    const lang = await getLanguage(chatId);
    const args = text.split(' ');

    if (args.length < 2) {
      const budgetList = await getBudgets(chatId);
      if (budgetList.length === 0) {
        await api.sendMessage({
          chat_id: chatId,
          text: lang === 'fa'
            ? 'بودجه‌ای تنظیم نشده.\n\nنحوه استفاده:\n/budget Food 5000000\n/budget off Food'
            : 'No budgets set.\n\nUsage:\n/budget Food 5000000\n/budget off Food',
        });
        return;
      }
      let out = lang === 'fa' ? '📊 بودجه‌های ماهانه:\n\n' : '📊 Monthly Budgets:\n\n';
      for (const b of budgetList) {
        const spent = await getSpentThisMonth(chatId, b.category);
        const pct = b.amount > 0 ? Math.round((spent.total / b.amount) * 100) : 0;
        const bar = pct >= 100 ? '🔴' : pct >= 80 ? '🟡' : '🟢';
        out += `${bar} ${b.category}: ${spent.total.toLocaleString('fa-IR')} / ${b.amount.toLocaleString('fa-IR')} (${pct}%)\n`;
      }
      await api.sendMessage({ chat_id: chatId, text: out });
      return;
    }

    const sub = args[1].toLowerCase();
    if (sub === 'off' && args[2]) {
      const category = args[2];
      const success = await deleteBudget(chatId, category);
      await api.sendMessage({
        chat_id: chatId,
        text: success
          ? (lang === 'fa' ? `✅ بودجه ${category} حذف شد.` : `✅ Budget for ${category} removed.`)
          : (lang === 'fa' ? `❌ بودجه‌ای برای ${category} یافت نشد.` : `❌ No budget found for ${category}.`),
      });
      return;
    }

    if (args.length < 3) {
      await api.sendMessage({
        chat_id: chatId,
        text: lang === 'fa' ? 'نحوه استفاده:\n/budget Food 5000000' : 'Usage:\n/budget Food 5000000',
      });
      return;
    }

    const category = args[1];
    const amount = parseInt(args[2].replace(/[,\s]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      await api.sendMessage({ chat_id: chatId, text: lang === 'fa' ? 'مبلغ نامعتبر است.' : 'Invalid amount.' });
      return;
    }

    await setBudget(chatId, category, amount);
    await api.sendMessage({
      chat_id: chatId,
      text: lang === 'fa'
        ? `✅ بودجه ${category}: ${amount.toLocaleString('fa-IR')} تومان (ماهانه)`
        : `✅ Budget set: ${category}: ${amount.toLocaleString('fa-IR')} IRT (monthly)`,
    });
    return;
  }

  if (command === '/setkey') {
    const args = text.split(' ');
    if (args.length < 3) {
      await api.sendMessage({ chat_id: chatId, text: 'Usage: /setkey <KEY_NAME> <value>\nAvailable: OPENCODE_API_KEY, OPENCODE_MODEL' });
      return;
    }
    const key = args[1];
    const value = args.slice(2).join(' ');
    if (key !== 'OPENCODE_API_KEY' && key !== 'OPENCODE_MODEL') {
      await api.sendMessage({ chat_id: chatId, text: 'Unknown key. Available: OPENCODE_API_KEY, OPENCODE_MODEL' });
      return;
    }
    await setSecret(key, value);
    await api.sendMessage({ chat_id: chatId, text: `✅ ${key} saved.` });
    return;
  }

  if (command === '/export') {
    const lang = await getLanguage(chatId);
    const args = text.split(' ');
    const month = args[1] || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const [year, mon] = month.split('-').map(Number);
    const startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
    const endDate = new Date(year, mon, 1).toISOString().split('T')[0];

    const txs = await getTransactionsForExport(chatId, startDate, endDate);

    if (txs.length === 0) {
      await api.sendMessage({ chat_id: chatId, text: lang === 'fa' ? 'تراکنشی یافت نشد.' : 'No transactions found.' });
      return;
    }

    let csv = 'ID,Date,User,Type,Category,Amount,Currency,Description\n';
    for (const t of txs) {
      csv += `${t.id},${t.createdAt?.toISOString?.() || t.createdAt},${t.username},${t.type},${t.category},${t.amount},${t.currency},"${(t.description || t.originalMessage || '').replace(/"/g, '""')}"\n`;
    }

    await api.sendMessage({ chat_id: chatId, text: csv });
    return;
  }

  if (text.startsWith('/')) return;

  const userId = message.from?.id;
  const username = message.from?.username || message.from?.first_name || 'Unknown';

  if (!userId) return;

  try {
    const result = await categorizeMessage(text);

    if (result.isTransaction && result.amount > 0) {
      const lang = await getLanguage(chatId);

      const txId = await insertTransaction({
        chat_id: chatId,
        user_id: userId,
        username,
        amount: result.amount,
        currency: result.currency || 'USD',
        category: result.category,
        type: result.type,
        description: result.description,
        original_message: text,
      });

      const emoji = result.type === 'expense' ? '💸' : '💰';
      const typeLabel = result.type === 'expense' ? msg('type_expense', lang) : msg('type_income', lang);

      let amountStr;
      switch (result.currency) {
        case 'IRT': amountStr = `${result.amount.toLocaleString('fa-IR')} تومان`; break;
        case 'IRR': amountStr = `${result.amount.toLocaleString('fa-IR')} ریال`; break;
        default:    amountStr = `${result.amount} ${result.currency}`;
      }

      const keyboard = {
        inline_keyboard: [
          [
            { text: msg('change_category_button', lang), callback_data: `cat:${txId}` },
            { text: msg('delete_button', lang), callback_data: `del:${txId}` },
          ],
        ],
      };

      await api.sendMessage({
        chat_id: chatId,
        text:
          `${emoji} ${msg('tx_recorded', lang)} (#${txId})\n\n` +
          `${msg('type_expense', lang)}/${msg('type_income', lang)}: ${typeLabel}\n` +
          `${msg('amount_label', lang)}: ${amountStr}\n` +
          `${msg('category_label', lang)}: ${catName(result.category, lang)}\n` +
          `${msg('description_label', lang)}: ${result.description || '—'}`,
        reply_markup: keyboard,
      });

      if (result.type === 'expense') {
        const budget = await getBudget(chatId, result.category);
        if (budget) {
          const spent = await getSpentThisMonth(chatId, result.category);
          const pct = budget.amount > 0 ? Math.round((spent.total / budget.amount) * 100) : 0;
          if (pct >= 100) {
            await api.sendMessage({
              chat_id: chatId,
              text: lang === 'fa'
                ? `⚠️ بودجه ${catName(result.category, lang)} تمام شد!\n${spent.total.toLocaleString('fa-IR')} از ${budget.amount.toLocaleString('fa-IR')} تومان (${pct}%)`
                : `⚠️ Budget for ${result.category} exceeded!\n${spent.total.toLocaleString('fa-IR')} / ${budget.amount.toLocaleString('fa-IR')} IRT (${pct}%)`,
            });
          } else if (pct >= 80) {
            await api.sendMessage({
              chat_id: chatId,
              text: lang === 'fa'
                ? `🟡 بودجه ${catName(result.category, lang)} رو به اتمام است.\n${spent.total.toLocaleString('fa-IR')} از ${budget.amount.toLocaleString('fa-IR')} تومان (${pct}%)`
                : `🟡 Budget for ${result.category} running low.\n${spent.total.toLocaleString('fa-IR')} / ${budget.amount.toLocaleString('fa-IR')} IRT (${pct}%)`,
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('[MSG] Error:', error);
  }
}
