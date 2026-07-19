import { msg } from './messages';

describe('Messages', () => {
  describe('msg() function', () => {
    it('should return Persian message by default', () => {
      const result = msg('welcome');
      expect(result).toContain('ربات مدیریت بودجه');
    });

    it('should return Persian message when lang=fa', () => {
      const result = msg('welcome', 'fa');
      expect(result).toContain('ربات مدیریت بودجه');
    });

    it('should return English message when lang=en', () => {
      const result = msg('welcome', 'en');
      expect(result).toContain('Budget Manager Bot');
    });

    it('should return key if message not found', () => {
      const result = msg('nonexistent_key');
      expect(result).toBe('nonexistent_key');
    });

    it('should have all required message keys', () => {
      const requiredKeys = [
        'welcome', 'help', 'group_only', 'no_transactions',
        'tx_recorded', 'type_expense', 'type_income',
        'delete_usage', 'tx_deleted', 'tx_not_found',
        'last_tx_deleted', 'no_tx_to_delete',
        'lang_switched', 'lang_current',
        'weekly_report', 'monthly_report',
        'income_label', 'expenses_label', 'balance_label',
        'expenses_by_user', 'income_by_user',
        'transactions_list', 'from_label',
        'delete_button', 'tx_deleted_btn',
        'change_category_button', 'select_category',
        'category_changed', 'undo_button', 'tx_undone', 'deleted_label',
      ];

      for (const key of requiredKeys) {
        expect(msg(key, 'fa')).toBeDefined();
        expect(msg(key, 'en')).toBeDefined();
        expect(msg(key, 'fa')).not.toBe(key);
        expect(msg(key, 'en')).not.toBe(key);
      }
    });
  });

  describe('Persian messages', () => {
    it('should have correct help text', () => {
      const result = msg('help', 'fa');
      expect(result).toContain('راهنمای دستورات');
      expect(result).toContain('/weekly');
      expect(result).toContain('/monthly');
      expect(result).toContain('/list');
      expect(result).toContain('/delete');
      expect(result).toContain('/lang');
    });

    it('should have correct delete button text', () => {
      const result = msg('delete_button', 'fa');
      expect(result).toContain('حذف');
    });

    it('should have correct undo button text', () => {
      const result = msg('undo_button', 'fa');
      expect(result).toContain('بازگردانی');
    });
  });

  describe('English messages', () => {
    it('should have correct help text', () => {
      const result = msg('help', 'en');
      expect(result).toContain('Commands');
      expect(result).toContain('/weekly');
      expect(result).toContain('/monthly');
      expect(result).toContain('/list');
      expect(result).toContain('/delete');
      expect(result).toContain('/lang');
    });

    it('should have correct delete button text', () => {
      const result = msg('delete_button', 'en');
      expect(result).toContain('Delete');
    });

    it('should have correct undo button text', () => {
      const result = msg('undo_button', 'en');
      expect(result).toContain('Undo');
    });
  });
});
