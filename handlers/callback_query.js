import { api } from 'sdk';
import { learnFromCorrection } from 'lib/categorizer';
import {
  getTransaction, deleteTransaction, insertTransaction,
  getLanguage, updateTransactionCategory, getCategories,
} from 'lib/database';
import { msg, catName } from 'lib/messages';

export default async function (callbackQuery) {
  const chatId = callbackQuery.message?.chat?.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  const delMatch = data.match(/^del:(\d+)$/);
  const catMatch = data.match(/^cat:(\d+)$/);
  const setcatMatch = data.match(/^setcat:(\d+):(.+)$/);

  if (delMatch) {
    const txId = parseInt(delMatch[1]);
    const lang = await getLanguage(chatId);
    const tx = await getTransaction(txId, chatId);

    if (!tx) {
      await api.answerCallbackQuery({ callback_query_id: callbackQuery.id, text: `❌ #${txId} ${msg('tx_not_found', lang)}`, show_alert: true });
      return;
    }

    const success = await deleteTransaction(txId, chatId);
    if (success) {
      const emoji = tx.type === 'expense' ? '💸' : '💰';
      const typeLabel = tx.type === 'expense' ? msg('type_expense', lang) : msg('type_income', lang);
      await api.answerCallbackQuery({ callback_query_id: callbackQuery.id, text: `✅ #${txId} ${msg('tx_deleted', lang)}` });
      await api.editMessageText({
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        text:
          `${emoji} ❌ #${tx.id} ${msg('deleted_label', lang)}\n\n` +
          `${typeLabel} | ${tx.amount} ${tx.currency}\n` +
          `${msg('category_label', lang)}: ${catName(tx.category, lang)}\n` +
          `${msg('description_label', lang)}: ${tx.description || '—'}\n` +
          `${msg('user_label', lang)}: ${tx.username}`,
      });
    } else {
      await api.answerCallbackQuery({ callback_query_id: callbackQuery.id, text: `❌ #${txId} ${msg('tx_not_found', lang)}`, show_alert: true });
    }
    return;
  }

  if (catMatch) {
    const txId = parseInt(catMatch[1]);
    const lang = await getLanguage(chatId);

    try {
      const tx = await getTransaction(txId, chatId);
      if (!tx) {
        await api.answerCallbackQuery({ callback_query_id: callbackQuery.id, text: 'Transaction not found', show_alert: true });
        return;
      }

      const cats = await getCategories(tx.type);
      const keyboard = {
        inline_keyboard: cats.map(cat => ([
          { text: catName(cat.name, lang), callback_data: `setcat:${txId}:${cat.name}` },
        ])),
      };

      await api.answerCallbackQuery({ callback_query_id: callbackQuery.id });
      await api.editMessageText({
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        text: msg('select_category', lang),
        reply_markup: keyboard,
      });
    } catch (error) {
      console.error('[CAT] Error:', error);
      try { await api.answerCallbackQuery({ callback_query_id: callbackQuery.id, text: 'Error', show_alert: true }); } catch {}
    }
    return;
  }

  if (setcatMatch) {
    const txId = parseInt(setcatMatch[1]);
    const category = setcatMatch[2];

    try {
      const lang = await getLanguage(chatId);
      const tx = await getTransaction(txId, chatId);

      const success = await updateTransactionCategory(txId, chatId, category);
      if (success) {
        if (tx) {
          await learnFromCorrection(tx.originalMessage, category, tx.type);
        }
        await api.answerCallbackQuery({ callback_query_id: callbackQuery.id, text: `✅ ${catName(category, lang)}` });
        await api.editMessageText({
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          text: `✅ #${txId} → ${catName(category, lang)}\n${msg('category_changed', lang)}`,
        });
      } else {
        await api.answerCallbackQuery({ callback_query_id: callbackQuery.id, text: `❌ ${msg('tx_not_found', lang)}`, show_alert: true });
      }
    } catch (error) {
      console.error('[SETCAT] Error:', error);
      try { await api.answerCallbackQuery({ callback_query_id: callbackQuery.id, text: 'Error', show_alert: true }); } catch {}
    }
  }
}
