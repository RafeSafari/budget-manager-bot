import { Bot, Context, InlineKeyboard } from 'grammy';
import { categorizeMessage } from './categorizer';
import { insertTransaction, deleteTransaction, getLastTransaction, getTransaction, debugAllTransactions, getLanguage, setLanguage, updateTransactionCategory, queryAll, getCategories } from './database';
import { generateWeeklyReport, generateMonthlyReport, generateCustomReport, generateTransactionList } from './reports';
import { msg } from './messages';
import { learnFromCorrection } from './categorizer';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);
const monitoredChats = new Set<number>();

bot.command('start', (ctx) => {
  const lang = getLanguage(ctx.chat?.id || 0);
  ctx.reply(msg('welcome', lang));
});

bot.command('help', (ctx) => {
  const lang = getLanguage(ctx.chat?.id || 0);
  ctx.reply(msg('help', lang));
});

bot.command('lang', (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const args = ctx.message?.text?.split(' ');
  const langArg = args?.[1]?.toLowerCase();
  if (langArg === 'fa' || langArg === 'en') {
    setLanguage(chatId, langArg);
    ctx.reply(msg('lang_switched', langArg));
  } else {
    const currentLang = getLanguage(chatId);
    ctx.reply(msg('lang_current', currentLang));
  }
});

bot.command('weekly', (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return ctx.reply(msg('group_only', getLanguage(0)));
  const report = generateWeeklyReport(chatId);
  ctx.reply(report);
});

bot.command('monthly', (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return ctx.reply(msg('group_only', getLanguage(0)));
  const report = generateMonthlyReport(chatId);
  ctx.reply(report);
});

bot.command('list', (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return ctx.reply(msg('group_only', getLanguage(0)));
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const startDate = `${y}-${m}-01`;
  const list = generateTransactionList(chatId, startDate);
  ctx.reply(list);
});

bot.command('delete', async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return ctx.reply(msg('group_only', getLanguage(0)));
  const lang = getLanguage(chatId);
  const args = ctx.message?.text?.split(' ');
  const arg = args && args.length > 1 ? args[1].toLowerCase() : '';

  let txToDelete: any = null;

  if (arg === 'last' || arg === 'latest') {
    txToDelete = getLastTransaction(chatId);
    if (!txToDelete) return ctx.reply(msg('no_tx_to_delete', lang));
  } else {
    const id = parseInt(arg);
    if (isNaN(id)) return ctx.reply(msg('delete_usage', lang));
    txToDelete = getTransaction(id, chatId);
    if (!txToDelete) return ctx.reply(`❌ #${id} ${msg('tx_not_found', lang)}`);
  }

  const success = deleteTransaction(txToDelete.id, chatId);
  if (success) {
    const emoji = txToDelete.type === 'expense' ? '💸' : '💰';
    const typeLabel = txToDelete.type === 'expense' ? msg('type_expense', lang) : msg('type_income', lang);
    const keyboard = new InlineKeyboard().text(msg('undo_button', lang), `undo:${txToDelete.id}:${txToDelete.chat_id}:${txToDelete.user_id}:${encodeURIComponent(txToDelete.username)}:${txToDelete.amount}:${txToDelete.currency}:${encodeURIComponent(txToDelete.category)}:${txToDelete.type}:${encodeURIComponent(txToDelete.description || '')}:${encodeURIComponent(txToDelete.original_message)}:${encodeURIComponent(txToDelete.created_at)}`);
    ctx.reply(
      `${emoji} ❌ #${txToDelete.id} ${msg('deleted_label', lang)}\n\n` +
      `${typeLabel} | ${txToDelete.amount} ${txToDelete.currency}\n` +
      `Category: ${txToDelete.category}\n` +
      `Description: ${txToDelete.description || '—'}\n` +
      `User: ${txToDelete.username}`,
      { reply_markup: keyboard }
    );
  }
});

bot.command('debug', async (ctx) => {
  const rows = debugAllTransactions();
  if (rows.length === 0) return ctx.reply('DB is empty.');
  let out = `DB has ${rows.length} transactions:\n\n`;
  for (const r of rows) {
    out += `#${r.id} | chat=${r.chat_id} | ${r.username} | ${r.amount} ${r.currency} | ${r.category} | ${r.type} | ${r.created_at}\n`;
  }
  ctx.reply(out);
});

bot.on('message:text', async (ctx) => {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  const username = ctx.from?.username || ctx.from?.first_name || 'Unknown';

  console.log(`[MSG] chat=${chatId} user=${username} text="${ctx.message.text}"`);

  if (!chatId || !userId) return;
  if (ctx.chat?.type !== 'group' && ctx.chat?.type !== 'supergroup') return;
  if (ctx.message.text.startsWith('/')) return;

  monitoredChats.add(chatId);

  try {
    console.log(`[MSG] Processing: "${ctx.message.text}"`);
    const result = await categorizeMessage(ctx.message.text);
    console.log(`[MSG] Result:`, JSON.stringify(result));

    if (result.isTransaction && result.amount > 0) {
      const now = new Date().toISOString();
      const lang = getLanguage(chatId);

      const txId = insertTransaction({
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
        `Amount: ${amountStr}\n` +
        `Category: ${result.category}\n` +
        `Description: ${result.description || '—'}`,
        { reply_markup: keyboard }
      );
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

  const lang = getLanguage(chatId);
  const tx = getTransaction(txId, chatId);
  if (!tx) {
    await ctx.answerCallbackQuery({ text: `❌ #${txId} ${msg('tx_not_found', lang)}`, show_alert: true });
    return;
  }

  const success = deleteTransaction(txId, chatId);
  if (success) {
    const emoji = tx.type === 'expense' ? '💸' : '💰';
    const typeLabel = tx.type === 'expense' ? msg('type_expense', lang) : msg('type_income', lang);
    const keyboard = new InlineKeyboard().text(msg('undo_button', lang), `undo:${tx.id}:${tx.chat_id}:${tx.user_id}:${encodeURIComponent(tx.username)}:${tx.amount}:${tx.currency}:${encodeURIComponent(tx.category)}:${tx.type}:${encodeURIComponent(tx.description || '')}:${encodeURIComponent(tx.original_message)}:${encodeURIComponent(tx.created_at)}`);
    await ctx.answerCallbackQuery({ text: `✅ #${txId} ${msg('tx_deleted', lang)}` });
    await ctx.editMessageText(
      `${emoji} ❌ #${tx.id} ${msg('deleted_label', lang)}\n\n` +
      `${typeLabel} | ${tx.amount} ${tx.currency}\n` +
      `Category: ${tx.category}\n` +
      `Description: ${tx.description || '—'}\n` +
      `User: ${tx.username}`,
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

  const lang = getLanguage(chatId);
  await ctx.answerCallbackQuery();

  const rows = queryAll('SELECT type FROM transactions WHERE id = ? AND chat_id = ?', [txId]) as any[];
  if (rows.length === 0) return;

  const txType = rows[0].type;
  const cats = getCategories(txType);

  const keyboard = new InlineKeyboard();
  for (const cat of cats) {
    keyboard.text(cat.name, `setcat:${txId}:${cat.name}`).row();
  }

  await ctx.editMessageText(msg('select_category', lang), { reply_markup: keyboard });
});

bot.callbackQuery(/^setcat:(\d+):(.+)$/, async (ctx) => {
  const chatId = ctx.chat?.id;
  const txId = parseInt(ctx.match[1]);
  const category = ctx.match[2];
  if (!chatId) return;

  const lang = getLanguage(chatId);
  const tx = getTransaction(txId, chatId);

  const success = updateTransactionCategory(txId, chatId, category);
  if (success) {
    if (tx) {
      learnFromCorrection(tx.original_message, category, tx.type);
    }
    await ctx.answerCallbackQuery({ text: `✅ ${category}` });
    await ctx.editMessageText(`✅ #${txId} → ${category}\n${msg('category_changed', lang)}`);
  } else {
    await ctx.answerCallbackQuery({ text: `❌ ${msg('tx_not_found', lang)}`, show_alert: true });
  }
});

bot.callbackQuery(/^undo:(\d+):(-?\d+):(\d+):(.+):(\d+):([A-Z]+):(.+):(\w+):(.+):(.+):(.+)$/, async (ctx) => {
  const [, id, chat_id, user_id, username, amount, currency, category, type, description, original_message, created_at] = ctx.match;
  const lang = getLanguage(parseInt(chat_id));

  const txId = insertTransaction({
    chat_id: parseInt(chat_id),
    user_id: parseInt(user_id),
    username: decodeURIComponent(username),
    amount: parseFloat(amount),
    currency,
    category: decodeURIComponent(category),
    type: type as 'expense' | 'income',
    description: decodeURIComponent(description),
    original_message: decodeURIComponent(original_message),
    created_at: decodeURIComponent(created_at),
  });

  const emoji = type === 'expense' ? '💸' : '💰';
  const typeLabel = type === 'expense' ? msg('type_expense', lang) : msg('type_income', lang);
  const keyboard = new InlineKeyboard()
    .text(msg('change_category_button', lang), `cat:${txId}`)
    .text(msg('delete_button', lang), `del:${txId}`);

  await ctx.answerCallbackQuery({ text: `✅ ${msg('tx_undone', lang)}` });
  await ctx.editMessageText(
    `${emoji} ${msg('tx_recorded', lang)} (#${txId})\n\n` +
    `${typeLabel} | ${amount} ${currency}\n` +
    `Category: ${decodeURIComponent(category)}\n` +
    `Description: ${decodeURIComponent(description) || '—'}\n` +
    `User: ${decodeURIComponent(username)}`,
    { reply_markup: keyboard }
  );
});

bot.catch((err) => {
  console.error('Bot error:', err);
});

export function startBot(): void {
  console.log('Starting Budget Manager Bot...');
  bot.start({
    onStart: () => console.log('Bot is running!'),
  });
}

export function stopBot(): void {
  bot.stop();
}
