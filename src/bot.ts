import { Bot, Context, InlineKeyboard, InputFile } from 'grammy';
import OpenAI from 'openai';
import { categorizeMessage, learnFromCorrection } from './categorizer';
import {
  insertTransaction, deleteTransaction, getLastTransaction, getTransaction,
  debugAllTransactions, getLanguage, setLanguage, updateTransactionCategory,
  queryAll, getCategories, setBudget, getBudgets, getBudget, deleteBudget,
  getSpentThisMonth, setAutoSummary, getAutoSummary, getAllEnabledAutoSummaries,
  storeUndoCache, getUndoCache, deleteUndoCache
} from './database';
import { generateWeeklyReport, generateMonthlyReport, generateCustomReport, generateTransactionList } from './reports';
import { msg, catName } from './messages';

export interface Env {
  BOT_TOKEN: string;
  BOT_INFO: string;
  OPENCODE_API_KEY: string;
  OPENCODE_MODEL: string;
  DB: D1Database;
}

export function createBot(env: Env): Bot {
  const bot = new Bot(env.BOT_TOKEN, { botInfo: JSON.parse(env.BOT_INFO) });
  const DB = env.DB;

  const openai = new OpenAI({
    apiKey: env.OPENCODE_API_KEY,
    baseURL: 'https://opencode.ai/zen/v1',
  });
  const model = env.OPENCODE_MODEL || 'deepseek-v4-flash-free';

  bot.command('start', async (ctx) => {
    const lang = await getLanguage(DB, ctx.chat?.id || 0);
    ctx.reply(msg('welcome', lang));
  });

  bot.command('help', async (ctx) => {
    const lang = await getLanguage(DB, ctx.chat?.id || 0);
    ctx.reply(msg('help', lang));
  });

  bot.command('lang', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    const args = ctx.message?.text?.split(' ');
    const langArg = args?.[1]?.toLowerCase();
    if (langArg === 'fa' || langArg === 'en') {
      await setLanguage(DB, chatId, langArg);
      ctx.reply(msg('lang_switched', langArg));
    } else {
      const currentLang = await getLanguage(DB, chatId);
      ctx.reply(msg('lang_current', currentLang));
    }
  });

  bot.command('weekly', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return ctx.reply(msg('group_only', await getLanguage(DB, 0)));
    const report = await generateWeeklyReport(DB, chatId);
    ctx.reply(report);
  });

  bot.command('monthly', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return ctx.reply(msg('group_only', await getLanguage(DB, 0)));
    const report = await generateMonthlyReport(DB, chatId);
    ctx.reply(report);
  });

  bot.command('list', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return ctx.reply(msg('group_only', await getLanguage(DB, 0)));
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const startDate = `${y}-${m}-01`;
    const list = await generateTransactionList(DB, chatId, startDate);
    ctx.reply(list);
  });

  bot.command('delete', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return ctx.reply(msg('group_only', await getLanguage(DB, 0)));
    const lang = await getLanguage(DB, chatId);
    const args = ctx.message?.text?.split(' ');
    const arg = args && args.length > 1 ? args[1].toLowerCase() : '';

    let txToDelete: any = null;

    if (arg === 'last' || arg === 'latest') {
      txToDelete = await getLastTransaction(DB, chatId);
      if (!txToDelete) return ctx.reply(msg('no_tx_to_delete', lang));
    } else {
      const id = parseInt(arg);
      if (isNaN(id)) return ctx.reply(msg('delete_usage', lang));
      txToDelete = await getTransaction(DB, id, chatId);
      if (!txToDelete) return ctx.reply(`❌ #${id} ${msg('tx_not_found', lang)}`);
    }

    const success = await deleteTransaction(DB, txToDelete.id, chatId);
    if (success) {
      const undoKey = `undo_${txToDelete.id}_${Date.now()}`;
      await storeUndoCache(DB, undoKey, txToDelete, 300);

      const emoji = txToDelete.type === 'expense' ? '💸' : '💰';
      const typeLabel = txToDelete.type === 'expense' ? msg('type_expense', lang) : msg('type_income', lang);
      const keyboard = new InlineKeyboard().text(msg('undo_button', lang), `undo:${undoKey}`);
      ctx.reply(
        `${emoji} ❌ #${txToDelete.id} ${msg('deleted_label', lang)}\n\n` +
        `${typeLabel} | ${txToDelete.amount} ${txToDelete.currency}\n` +
        `${msg('category_label', lang)}: ${catName(txToDelete.category, lang)}\n` +
        `${msg('description_label', lang)}: ${txToDelete.description || '—'}\n` +
        `${msg('user_label', lang)}: ${txToDelete.username}`,
        { reply_markup: keyboard }
      );
    }
  });

  bot.command('debug', async (ctx) => {
    const rows = await debugAllTransactions(DB);
    if (rows.length === 0) return ctx.reply('DB is empty.');
    let out = `DB has ${rows.length} transactions:\n\n`;
    for (const r of rows) {
      out += `#${r.id} | chat=${r.chat_id} | ${r.username} | ${r.amount} ${r.currency} | ${r.category} | ${r.type} | ${r.created_at}\n`;
    }
    ctx.reply(out);
  });

  bot.command('budget', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    const lang = await getLanguage(DB, chatId);
    const args = ctx.message?.text?.split(' ');

    if (!args || args.length < 2) {
      const budgets = await getBudgets(DB, chatId);
      if (budgets.length === 0) {
        return ctx.reply(lang === 'fa'
          ? 'بودجه‌ای تنظیم نشده.\n\nنحوه استفاده:\n/budget Food 5000000\n/budget off Food'
          : 'No budgets set.\n\nUsage:\n/budget Food 5000000\n/budget off Food');
      }
      let out = lang === 'fa' ? '📊 بودجه‌های ماهانه:\n\n' : '📊 Monthly Budgets:\n\n';
      for (const b of budgets) {
        const spent = await getSpentThisMonth(DB, chatId, b.category);
        const pct = b.amount > 0 ? Math.round((spent.total / b.amount) * 100) : 0;
        const bar = pct >= 100 ? '🔴' : pct >= 80 ? '🟡' : '🟢';
        out += `${bar} ${b.category}: ${spent.total.toLocaleString('fa-IR')} / ${b.amount.toLocaleString('fa-IR')} (${pct}%)\n`;
      }
      return ctx.reply(out);
    }

    const sub = args[1].toLowerCase();
    if (sub === 'off' && args[2]) {
      const category = args[2];
      const success = await deleteBudget(DB, chatId, category);
      return ctx.reply(success
        ? (lang === 'fa' ? `✅ بودجه ${category} حذف شد.` : `✅ Budget for ${category} removed.`)
        : (lang === 'fa' ? `❌ بودجه‌ای برای ${category} یافت نشد.` : `❌ No budget found for ${category}.`));
    }

    if (args.length < 3) {
      return ctx.reply(lang === 'fa'
        ? 'نحوه استفاده:\n/budget Food 5000000'
        : 'Usage:\n/budget Food 5000000');
    }

    const category = args[1];
    const amount = parseInt(args[2].replace(/[,\s]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply(lang === 'fa' ? 'مبلغ نامعتبر است.' : 'Invalid amount.');
    }

    await setBudget(DB, chatId, category, amount);
    ctx.reply(lang === 'fa'
      ? `✅ بودجه ${category}: ${amount.toLocaleString('fa-IR')} تومان (ماهانه)`
      : `✅ Budget set: ${category}: ${amount.toLocaleString('fa-IR')} IRT (monthly)`);
  });

  bot.command('export', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    const lang = await getLanguage(DB, chatId);
    const args = ctx.message?.text?.split(' ');
    const month = args?.[1] || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const [year, mon] = month.split('-').map(Number);
    const startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
    const endDate = new Date(year, mon, 1).toISOString().split('T')[0];

    const transactions = await queryAll(
      DB,
      'SELECT * FROM transactions WHERE chat_id = ? AND created_at >= ? AND created_at < ? ORDER BY created_at',
      [chatId, startDate, endDate]
    ) as any[];

    if (transactions.length === 0) {
      return ctx.reply(lang === 'fa' ? 'تراکنشی یافت نشد.' : 'No transactions found.');
    }

    let csv = 'ID,Date,User,Type,Category,Amount,Currency,Description\n';
    for (const t of transactions) {
      csv += `${t.id},${t.created_at},${t.username},${t.type},${t.category},${t.amount},${t.currency},"${(t.description || t.original_message || '').replace(/"/g, '""')}"\n`;
    }

    const buffer = Buffer.from(csv, 'utf-8');
    await ctx.replyWithDocument(
      new InputFile(buffer, `budget-${month}.csv`),
      { caption: lang === 'fa' ? `تراکنش‌های ${month}` : `Transactions for ${month}` }
    );
  });

  bot.command('autosummary', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    const lang = await getLanguage(DB, chatId);
    const args = ctx.message?.text?.split(' ');
    const sub = args?.[1]?.toLowerCase();

    if (!sub || sub === 'status') {
      const settings = await getAutoSummary(DB, chatId);
      if (!settings || !settings.enabled) {
        return ctx.reply(lang === 'fa'
          ? '📭 خودکار خاموش است.\n\nنحوه استفاده:\n/autosummary daily 09:00 - هر روز ساعت ۹\n/autosummary weekly Sunday 10:00 - هر یکشنبه ساعت ۱۰\n/autosummary off - خاموش'
          : '📭 Auto-summary is off.\n\nUsage:\n/autosummary daily 09:00 - Daily at 9am\n/autosummary weekly Sunday 10:00 - Weekly on Sunday at 10am\n/autosummary off - Turn off');
      }
      const schedule = settings.day
        ? `${settings.schedule_type} ${settings.day} ${settings.time}`
        : `${settings.schedule_type} ${settings.time}`;
      return ctx.reply(lang === 'fa'
        ? `📬 خودکار فعال است: ${schedule}\n\n/autosummary off - خاموش`
        : `📬 Auto-summary active: ${schedule}\n\n/autosummary off - Turn off`);
    }

    if (sub === 'off') {
      await setAutoSummary(DB, chatId, false, 'daily', '09:00');
      return ctx.reply(lang === 'fa' ? '📭 خودکار خاموش شد.' : '📭 Auto-summary turned off.');
    }

    if (sub === 'daily') {
      const time = args?.[2] || '09:00';
      if (!/^\d{2}:\d{2}$/.test(time)) {
        return ctx.reply(lang === 'fa' ? 'فرمت زمان نامعتبر است. مثال: 09:00' : 'Invalid time format. Example: 09:00');
      }
      await setAutoSummary(DB, chatId, true, 'daily', time);
      return ctx.reply(lang === 'fa'
        ? `✅ هر روز ساعت ${time} گزارش ارسال می‌شود.`
        : `✅ Daily summary at ${time}.`);
    }

    if (sub === 'weekly') {
      const day = args?.[2]?.toLowerCase();
      const time = args?.[3] || '09:00';
      const validDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      if (!day || !validDays.includes(day)) {
        return ctx.reply(lang === 'fa'
          ? 'روز نامعتبر است. مثال: /autosummary weekly sunday 09:00\nروزها: sunday, monday, tuesday, ...'
          : 'Invalid day. Example: /autosummary weekly sunday 09:00\nDays: sunday, monday, tuesday, ...');
      }
      if (!/^\d{2}:\d{2}$/.test(time)) {
        return ctx.reply(lang === 'fa' ? 'فرمت زمان نامعتبر است. مثال: 09:00' : 'Invalid time format. Example: 09:00');
      }
      await setAutoSummary(DB, chatId, true, 'weekly', time, day);
      return ctx.reply(lang === 'fa'
        ? `✅ هر ${day} ساعت ${time} گزارش ارسال می‌شود.`
        : `✅ Weekly summary on ${day} at ${time}.`);
    }

    return ctx.reply(lang === 'fa'
      ? 'نحوه استفاده:\n/autosummary daily 09:00\n/autosummary weekly sunday 09:00\n/autosummary off'
      : 'Usage:\n/autosummary daily 09:00\n/autosummary weekly sunday 09:00\n/autosummary off');
  });

  bot.on('message:text', async (ctx) => {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    const username = ctx.from?.username || ctx.from?.first_name || 'Unknown';

    console.log(`[MSG] chat=${chatId} user=${username} text="${ctx.message.text}"`);

    if (!chatId || !userId) return;
    if (ctx.chat?.type !== 'group' && ctx.chat?.type !== 'supergroup') return;
    if (ctx.message.text.startsWith('/')) return;

    try {
      console.log(`[MSG] Processing: "${ctx.message.text}"`);
      const result = await categorizeMessage(DB, ctx.message.text, openai, model);
      console.log(`[MSG] Result:`, JSON.stringify(result));

      if (result.isTransaction && result.amount > 0) {
        const now = new Date().toISOString();
        const lang = await getLanguage(DB, chatId);

        const txId = await insertTransaction(DB, {
          chat_id: chatId,
          user_id: userId,
          username,
          amount: result.amount,
          currency: result.currency || 'USD',
          category: result.category,
          type: result.type,
          description: result.description,
          original_message: ctx.message.text,
          created_at: now,
        });

        const emoji = result.type === 'expense' ? '💸' : '💰';
        const typeLabel = result.type === 'expense' ? msg('type_expense', lang) : msg('type_income', lang);

        let amountStr: string;
        switch (result.currency) {
          case 'IRT':
            amountStr = `${result.amount.toLocaleString('fa-IR')} تومان`;
            break;
          case 'IRR':
            amountStr = `${result.amount.toLocaleString('fa-IR')} ریال`;
            break;
          default:
            amountStr = `${result.amount} ${result.currency}`;
        }

        const keyboard = new InlineKeyboard()
          .text(msg('change_category_button', lang), `cat:${txId}`)
          .text(msg('delete_button', lang), `del:${txId}`);

        await ctx.reply(
          `${emoji} ${msg('tx_recorded', lang)} (#${txId})\n\n` +
          `${msg('type_expense', lang)}/${msg('type_income', lang)}: ${typeLabel}\n` +
          `${msg('amount_label', lang)}: ${amountStr}\n` +
          `${msg('category_label', lang)}: ${catName(result.category, lang)}\n` +
          `${msg('description_label', lang)}: ${result.description || '—'}`,
          { reply_markup: keyboard }
        );

        if (result.type === 'expense') {
          const budget = await getBudget(DB, chatId, result.category);
          if (budget) {
            const spent = await getSpentThisMonth(DB, chatId, result.category);
            const pct = budget.amount > 0 ? Math.round((spent.total / budget.amount) * 100) : 0;
            if (pct >= 100) {
              ctx.reply(lang === 'fa'
                ? `⚠️ بودجه ${catName(result.category, lang)} تمام شد!\n${spent.total.toLocaleString('fa-IR')} از ${budget.amount.toLocaleString('fa-IR')} تومان (${pct}%)`
                : `⚠️ Budget for ${result.category} exceeded!\n${spent.total.toLocaleString('fa-IR')} / ${budget.amount.toLocaleString('fa-IR')} IRT (${pct}%)`);
            } else if (pct >= 80) {
              ctx.reply(lang === 'fa'
                ? `🟡 بودجه ${catName(result.category, lang)} رو به اتمام است.\n${spent.total.toLocaleString('fa-IR')} از ${budget.amount.toLocaleString('fa-IR')} تومان (${pct}%)`
                : `🟡 Budget for ${result.category} running low.\n${spent.total.toLocaleString('fa-IR')} / ${budget.amount.toLocaleString('fa-IR')} IRT (${pct}%)`);
            }
          }
        }
      } else {
        console.log(`[MSG] Not a transaction, skipping.`);
      }
    } catch (error) {
      console.error('[MSG] Error:', error);
    }
  });

  bot.callbackQuery(/^del:(\d+)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    const txId = parseInt(ctx.match[1]);
    if (!chatId) return;

    const lang = await getLanguage(DB, chatId);
    const tx = await getTransaction(DB, txId, chatId);
    if (!tx) {
      await ctx.answerCallbackQuery({ text: `❌ #${txId} ${msg('tx_not_found', lang)}`, show_alert: true });
      return;
    }

    const success = await deleteTransaction(DB, txId, chatId);
    if (success) {
      const undoKey = `undo_${tx.id}_${Date.now()}`;
      await storeUndoCache(DB, undoKey, tx, 300);

      const emoji = tx.type === 'expense' ? '💸' : '💰';
      const typeLabel = tx.type === 'expense' ? msg('type_expense', lang) : msg('type_income', lang);
      const keyboard = new InlineKeyboard().text(msg('undo_button', lang), `undo:${undoKey}`);
      await ctx.answerCallbackQuery({ text: `✅ #${txId} ${msg('tx_deleted', lang)}` });
      await ctx.editMessageText(
        `${emoji} ❌ #${tx.id} ${msg('deleted_label', lang)}\n\n` +
        `${typeLabel} | ${tx.amount} ${tx.currency}\n` +
        `${msg('category_label', lang)}: ${catName(tx.category, lang)}\n` +
        `${msg('description_label', lang)}: ${tx.description || '—'}\n` +
        `${msg('user_label', lang)}: ${tx.username}`,
        { reply_markup: keyboard }
      );
    } else {
      await ctx.answerCallbackQuery({ text: `❌ #${txId} ${msg('tx_not_found', lang)}`, show_alert: true });
    }
  });

  bot.callbackQuery(/^cat:(\d+)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    const txId = parseInt(ctx.match[1]);
    if (!chatId) return;

    const lang = await getLanguage(DB, chatId);

    try {
      const rows = await queryAll(DB, 'SELECT type FROM transactions WHERE id = ? AND chat_id = ?', [txId, chatId]) as any[];
      if (rows.length === 0) {
        await ctx.answerCallbackQuery({ text: 'Transaction not found', show_alert: true });
        return;
      }

      const txType = rows[0].type;
      const cats = await getCategories(DB, txType);

      const keyboard = new InlineKeyboard();
      for (const cat of cats) {
        keyboard.text(catName(cat.name, lang), `setcat:${txId}:${cat.name}`).row();
      }

      await ctx.answerCallbackQuery();
      await ctx.editMessageText(msg('select_category', lang), { reply_markup: keyboard });
    } catch (error) {
      console.error('[CAT] Error:', error);
      try { await ctx.answerCallbackQuery({ text: 'Error', show_alert: true }); } catch {}
    }
  });

  bot.callbackQuery(/^setcat:(\d+):(.+)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    const txId = parseInt(ctx.match[1]);
    const category = ctx.match[2];
    if (!chatId) return;

    try {
      const lang = await getLanguage(DB, chatId);
      const tx = await getTransaction(DB, txId, chatId);

      const success = await updateTransactionCategory(DB, txId, chatId, category);
      if (success) {
        if (tx) {
          await learnFromCorrection(DB, tx.original_message, category, tx.type);
        }
        await ctx.answerCallbackQuery({ text: `✅ ${catName(category, lang)}` });
        await ctx.editMessageText(`✅ #${txId} → ${catName(category, lang)}\n${msg('category_changed', lang)}`);
      } else {
        await ctx.answerCallbackQuery({ text: `❌ ${msg('tx_not_found', lang)}`, show_alert: true });
      }
    } catch (error) {
      console.error('[SETCAT] Error:', error);
      try { await ctx.answerCallbackQuery({ text: 'Error', show_alert: true }); } catch {}
    }
  });

  bot.callbackQuery(/^undo:(.+)$/, async (ctx) => {
    const undoKey = ctx.match[1];
    const tx = await getUndoCache(DB, undoKey);

    if (!tx) {
      await ctx.answerCallbackQuery({ text: '❌ Undo expired or not found', show_alert: true });
      return;
    }

    await deleteUndoCache(DB, undoKey);
    const lang = await getLanguage(DB, tx.chat_id);

    const txId = await insertTransaction(DB, {
      chat_id: tx.chat_id,
      user_id: tx.user_id,
      username: tx.username,
      amount: tx.amount,
      currency: tx.currency,
      category: tx.category,
      type: tx.type,
      description: tx.description,
      original_message: tx.original_message,
      created_at: tx.created_at,
    });

    const emoji = tx.type === 'expense' ? '💸' : '💰';
    const typeLabel = tx.type === 'expense' ? msg('type_expense', lang) : msg('type_income', lang);
    const keyboard = new InlineKeyboard()
      .text(msg('change_category_button', lang), `cat:${txId}`)
      .text(msg('delete_button', lang), `del:${txId}`);

    await ctx.answerCallbackQuery({ text: `✅ ${msg('tx_undone', lang)}` });
    await ctx.editMessageText(
      `${emoji} ${msg('tx_recorded', lang)} (#${txId})\n\n` +
      `${typeLabel} | ${tx.amount} ${tx.currency}\n` +
      `${msg('category_label', lang)}: ${catName(tx.category, lang)}\n` +
      `${msg('description_label', lang)}: ${tx.description || '—'}\n` +
      `${msg('user_label', lang)}: ${tx.username}`,
      { reply_markup: keyboard }
    );
  });

  bot.catch((err) => {
    console.error('Bot error:', err);
  });

  return bot;
}
