import { table, integer, text, real, index, sql } from 'sdk/db';

export const transactions = table('transactions', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  chatId:         integer('chat_id').notNull(),
  userId:         integer('user_id').notNull(),
  username:       text('username').notNull(),
  amount:         real('amount').notNull(),
  currency:       text('currency').default('IRT'),
  category:       text('category').notNull(),
  type:           text('type').notNull(),
  description:    text('description').default(''),
  originalMessage:text('original_message').notNull(),
  createdAt:      integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  chatIdx:    index('idx_tx_chat').on(t.chatId),
  createdIdx: index('idx_tx_created').on(t.createdAt),
  catIdx:     index('idx_tx_cat').on(t.category),
  typeIdx:    index('idx_tx_type').on(t.type),
}));

export const settings = table('settings', {
  chatId:   integer('chat_id').primaryKey(),
  language: text('language').default('fa'),
});

export const categories = table('categories', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  name:       text('name').notNull(),
  type:       text('type').notNull(),
  keywords:   text('keywords').default('[]'),
  usageCount: integer('usage_count').default(0),
});

export const budgets = table('budgets', {
  id:       integer('id').primaryKey({ autoIncrement: true }),
  chatId:   integer('chat_id').notNull(),
  category: text('category').notNull(),
  amount:   real('amount').notNull(),
  currency: text('currency').default('IRT'),
  period:   text('period').default('monthly'),
});

export const secrets = table('secrets', {
  key:   text('key').primaryKey(),
  value: text('value').notNull(),
});
