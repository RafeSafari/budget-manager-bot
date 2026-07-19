import { Bot, Context, InlineKeyboard } from 'grammy';
import { categorizeMessage } from './categorizer';
import { insertTransaction, deleteTransaction, getLastTransaction, debugAllTransactions, getLanguage, setLanguage } from './database';
import { generateWeeklyReport, generateMonthlyReport, generateCustomReport, generateTransactionList } from './reports';
import { msg } from './messages';

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

  if (arg === 'last' || arg === 'latest') {
    const last = getLastTransaction(chatId);
    if (!last) return ctx.reply(msg('no_tx_to_delete', lang));
    const success = deleteTransaction(last.id, chatId);
    if (success) {
      const emoji = last.type === 'expense' ? '💸' : '💰';
      ctx.reply(`${emoji} ${msg('last_tx_deleted', lang)}\n#${last.id} | ${last.username} | ${last.amount} ${last.currency} | ${last.category}`);
    }
    return;
  }

  const id = parseInt(arg);
  if (isNaN(id)) return ctx.reply(msg('delete_usage', lang));

  const success = deleteTransaction(id, chatId);
  if (success) {
    ctx.reply(`✅ #${id} ${msg('tx_deleted', lang)}`);
  } else {
    ctx.reply(`❌ #${id} ${msg('tx_not_found', lang)}`);
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

      const keyboard = new InlineKeyboard().text(msg('delete_button', lang), `del:${txId}`);

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
  const success = deleteTransaction(txId, chatId);
  if (success) {
    await ctx.answerCallbackQuery({ text: `✅ #${txId} ${msg('tx_deleted', lang)}` });
    await ctx.editMessageText(`❌ #${txId} ${msg('tx_deleted', lang)}`);
  } else {
    await ctx.answerCallbackQuery({ text: `❌ #${txId} ${msg('tx_not_found', lang)}`, show_alert: true });
  }
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
