import { Bot, Context } from 'grammy';
import { categorizeMessage } from './categorizer';
import { insertTransaction, deleteTransaction, debugAllTransactions } from './database';
import { generateWeeklyReport, generateMonthlyReport, generateCustomReport, generateTransactionList } from './reports';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

const monitoredChats = new Set<number>();

// Handle /start command
bot.command('start', (ctx) => {
  ctx.reply(
    '🤖 ربات مدیریت بودجه / Budget Manager Bot\n\n' +
    'این ربات هزینه‌ها و درآمدهای گروه را ردیابی می‌کند.\n' +
    'This bot tracks expenses and earnings in this group.\n\n' +
    'دستورات / Commands:\n' +
    '/weekly - گزارش هفتگی / Weekly report\n' +
    '/monthly - گزارش ماهانه / Monthly report\n' +
    '/list - لیست تراکنش‌ها / List transactions\n' +
    '/delete <id> - حذف تراکنش / Delete a transaction\n' +
    '/help - راهنما / Help\n\n' +
    'مثال / Examples:\n' +
    '• "50 هزار خرج غذا" 💸\n' +
    '• "200 تومان تاکسی" 💸\n' +
    '• "Spent 50 on food" 💸\n' +
    '• "حقوق 5 میلیون تومان" 💰'
  );
});

// Handle /help command
bot.command('help', (ctx) => {
  ctx.reply(
    '📋 راهنمای دستورات / Commands:\n\n' +
    '/weekly - گزارش هفتگی / Weekly expense report\n' +
    '/monthly - گزارش ماهانه / Monthly expense report\n' +
    '/list - لیست تراکنش‌ها / List transactions\n' +
    '/delete <id> - حذف تراکنش / Delete transaction\n\n' +
    '💡 پیام‌های ردیابی شده / Tracked messages:\n\n' +
    'فارسی:\n' +
    '• "50 هزار خرج غذا" (هزینه)\n' +
    '• "200 تومان تاکسی" (هزینه)\n' +
    '• "حقوق 5 میلیون تومان" (درآمد)\n' +
    '• "1 میلیون ریال شارژ" (هزینه)\n\n' +
    'English:\n' +
    '• "Spent 50 on groceries" (expense)\n' +
    '• "Paid 30 for taxi" (expense)\n' +
    '• "Earned 500 freelance" (income)\n' +
    '• "Got 100 as gift" (income)'
  );
});

// Handle /weekly command
bot.command('weekly', (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return ctx.reply('این دستور فقط در گروه کار می‌کند.\nThis command can only be used in a group.');

  const report = generateWeeklyReport(chatId);
  ctx.reply(report);
});

// Handle /monthly command
bot.command('monthly', (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return ctx.reply('این دستور فقط در گروه کار می‌کند.\nThis command can only be used in a group.');

  const report = generateMonthlyReport(chatId);
  ctx.reply(report);
});

// Handle /list command
bot.command('list', (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return ctx.reply('این دستور فقط در گروه کار می‌کند.\nThis command can only be used in a group.');

  const now = new Date();
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const list = generateTransactionList(chatId, startDate, endDate);
  ctx.reply(list);
});

// Handle /delete command
bot.command('delete', async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return ctx.reply('این دستور فقط در گروه کار می‌کند.\nThis command can only be used in a group.');

  const args = ctx.message?.text?.split(' ');
  const id = args && args.length > 1 ? parseInt(args[1]) : NaN;

  if (isNaN(id)) {
    return ctx.reply('نحوه استفاده: /delete <شماره تراکنش>\nUsage: /delete <transaction_id>');
  }

  const success = deleteTransaction(id, chatId);
  if (success) {
    ctx.reply(`✅ تراکنش #${id} حذف شد.\nTransaction #${id} deleted.`);
  } else {
    ctx.reply(`❌ تراکنش #${id} یافت نشد.\nTransaction #${id} not found.`);
  }
});

// Handle /debug command
bot.command('debug', async (ctx) => {
  const rows = debugAllTransactions();
  if (rows.length === 0) {
    return ctx.reply('DB is empty.');
  }
  let msg = `DB has ${rows.length} transactions:\n\n`;
  for (const r of rows) {
    msg += `#${r.id} | chat=${r.chat_id} | ${r.username} | ${r.amount} ${r.currency} | ${r.category} | ${r.type} | ${r.created_at}\n`;
  }
  ctx.reply(msg);
});

// Handle group messages
bot.on('message:text', async (ctx) => {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  const username = ctx.from?.username || ctx.from?.first_name || 'Unknown';

  console.log(`[MSG] chat=${chatId} user=${username} text="${ctx.message.text}"`);

  if (!chatId || !userId) return;

  // Only process messages in groups
  if (ctx.chat?.type !== 'group' && ctx.chat?.type !== 'supergroup') {
    return;
  }

  // Skip bot commands
  if (ctx.message.text.startsWith('/')) return;

  // Add chat to monitored list
  monitoredChats.add(chatId);

  try {
    console.log(`[MSG] Processing: "${ctx.message.text}"`);
    const result = await categorizeMessage(ctx.message.text);
    console.log(`[MSG] Result:`, JSON.stringify(result));

    if (result.isTransaction && result.amount > 0) {
      const now = new Date().toISOString();

      insertTransaction({
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
      const typeLabel = result.type === 'expense' ? 'هزینه / Expense' : 'درآمد / Income';

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

      await ctx.reply(
        `${emoji} ثبت شد! / Recorded!\n\n` +
        `نوع / Type: ${typeLabel}\n` +
        `مبلغ / Amount: ${amountStr}\n` +
        `دسته / Category: ${result.category}\n` +
        `توضیحات / Description: ${result.description || '—'}`
      );
    } else {
      console.log(`[MSG] Not a transaction, skipping.`);
    }
  } catch (error) {
    console.error('[MSG] Error:', error);
  }
});

// Handle errors
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
