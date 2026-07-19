type Lang = 'fa' | 'en';

const MESSAGES: Record<string, Record<Lang, string>> = {
  welcome: {
    fa: '🤖 ربات مدیریت بودجه\n\nاین ربات هزینه‌ها و درآمدهای گروه را ردیابی می‌کند.\n\nدستورات:\n/weekly - گزارش هفتگی\n/monthly - گزارش ماهانه\n/list - لیست تراکنش‌ها\n/delete last - حذف آخرین تراکنش\n/delete <id> - حذف تراکنش\n/lang - تغییر زبان\n/help - راهنما',
    en: '🤖 Budget Manager Bot\n\nThis bot tracks expenses and earnings in this group.\n\nCommands:\n/weekly - Weekly report\n/monthly - Monthly report\n/list - List transactions\n/delete last - Delete latest transaction\n/delete <id> - Delete transaction\n/lang - Switch language\n/help - Help',
  },
  help: {
    fa: '📋 راهنمای دستورات:\n\n/weekly - گزارش هفتگی\n/monthly - گزارش ماهانه\n/list - لیست تراکنش‌ها\n/delete last - حذف آخرین تراکنش\n/delete <id> - حذف تراکنش\n/lang fa - فارسی\n/lang en - English\n\n💡 مثال:\n• "50 هزار خرج غذا"\n• "200 تومان تاکسی"\n• "حقوق 5 میلیون تومان"\n• "Spent 50 on food"',
    en: '📋 Commands:\n\n/weekly - Weekly report\n/monthly - Monthly report\n/list - List transactions\n/delete last - Delete latest\n/delete <id> - Delete transaction\n/lang fa - فارسی\n/lang en - English\n\n💡 Examples:\n• "50 هزار خرج غذا"\n• "200 تومان تاکسی"\n• "Spent 50 on food"\n• "Earned 500 freelance"',
  },
  group_only: {
    fa: 'این دستور فقط در گروه کار می‌کند.',
    en: 'This command can only be used in a group.',
  },
  no_transactions: {
    fa: 'تراکنشی یافت نشد.',
    en: 'No transactions found.',
  },
  tx_recorded: {
    fa: 'ثبت شد!',
    en: 'Recorded!',
  },
  type_expense: {
    fa: 'هزینه',
    en: 'Expense',
  },
  type_income: {
    fa: 'درآمد',
    en: 'Income',
  },
  delete_usage: {
    fa: 'نحوه استفاده:\n/delete last - حذف آخرین تراکنش\n/delete <شماره> - حذف تراکنش خاص',
    en: 'Usage:\n/delete last - delete latest\n/delete <id> - delete by ID',
  },
  tx_deleted: {
    fa: 'حذف شد.',
    en: 'deleted.',
  },
  tx_not_found: {
    fa: 'یافت نشد.',
    en: 'not found.',
  },
  last_tx_deleted: {
    fa: 'آخرین تراکنش حذف شد:',
    en: 'Last transaction deleted:',
  },
  no_tx_to_delete: {
    fa: 'تراکنشی وجود ندارد.',
    en: 'No transactions to delete.',
  },
  lang_switched: {
    fa: 'زبان به فارسی تغییر کرد.',
    en: 'Language switched to English.',
  },
  lang_current: {
    fa: 'زبان فعلی: فارسی\n\nبرای تغییر:\n/lang en - English',
    en: 'Current language: English\n\nTo switch:\n/lang fa - فارسی',
  },
  weekly_report: {
    fa: 'گزارش هفتگی',
    en: 'Weekly Report',
  },
  monthly_report: {
    fa: 'گزارش ماهانه',
    en: 'Monthly Report',
  },
  income_label: {
    fa: 'درآمد',
    en: 'INCOME',
  },
  expenses_label: {
    fa: 'هزینه‌ها',
    en: 'EXPENSES',
  },
  balance_label: {
    fa: 'موجودی',
    en: 'BALANCE',
  },
  expenses_by_user: {
    fa: 'هزینه‌ها به تفکیک کاربر:',
    en: 'Expenses by User:',
  },
  income_by_user: {
    fa: 'درآمد به تفکیک کاربر:',
    en: 'Income by User:',
  },
  transactions_list: {
    fa: 'تراکنش‌ها',
    en: 'Transactions',
  },
  from_label: {
    fa: 'از',
    en: 'from',
  },
  delete_button: {
    fa: '❌ حذف',
    en: '❌ Delete',
  },
  tx_deleted_btn: {
    fa: 'تراکنش حذف شد.',
    en: 'Transaction deleted.',
  },
  change_category_button: {
    fa: '📂 تغییر دسته',
    en: '📂 Change Category',
  },
  select_category: {
    fa: 'دسته جدید را انتخاب کنید:',
    en: 'Select new category:',
  },
  category_changed: {
    fa: 'دسته تغییر کرد.',
    en: 'Category changed.',
  },
};

export function msg(key: string, lang: Lang = 'fa'): string {
  return MESSAGES[key]?.[lang] || MESSAGES[key]?.['fa'] || key;
}
