-- Budget Manager Bot - D1 Schema

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  category TEXT NOT NULL,
  type TEXT CHECK(type IN ('expense', 'income')) NOT NULL,
  description TEXT DEFAULT '',
  original_message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_id ON transactions(chat_id);
CREATE INDEX IF NOT EXISTS idx_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_type ON transactions(type);

CREATE TABLE IF NOT EXISTS settings (
  chat_id INTEGER PRIMARY KEY,
  language TEXT DEFAULT 'fa'
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('expense', 'income')) NOT NULL,
  keywords TEXT DEFAULT '[]',
  usage_count INTEGER DEFAULT 0,
  UNIQUE(name, type)
);

CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'IRT',
  period TEXT DEFAULT 'monthly',
  UNIQUE(chat_id, category, period)
);

CREATE TABLE IF NOT EXISTS auto_summary (
  chat_id INTEGER PRIMARY KEY,
  enabled INTEGER DEFAULT 0,
  schedule_type TEXT DEFAULT 'daily',
  time TEXT DEFAULT '09:00',
  day TEXT DEFAULT NULL
);

-- Default categories (expense)
INSERT OR IGNORE INTO categories (name, type, keywords, usage_count) VALUES
('Food', 'expense', '["غذا","خوراک","خوراکی","ناهار","شام","صبحانه","میان وعده","رستوران","کافه","کافی شاپ","فست فود","پیتزا","برگر","ساندویچ","کباب","جوجه","چلو","چلوکباب","خورشت","قورمه","قیمه","آبگوشت","پاستا","ماکارونی","سوپ","سالاد","قهوه","نسکافه","لاته","کاپوچینو","اسپرسو","چای","دمنوش","بستنی","آبمیوه","اسموتی","نوشابه","دوغ","دلستر","شیرینی","کیک","شکلات","بیسکویت","آجیل","نان","برنج","مرغ","گوشت","ماهی","سالمون","تن ماهی","میوه","سبزی","لبنیات","شیر","ماست","پنیر","تخم مرغ","سوسیس","کالباس","سوپرمارکت","سوپری","بقالی","هایپر","هایپرمارکت","قصابی","نانوایی","میوه فروشی","تره بار","بازار میوه"]', 0),
('Transport', 'expense', '["تاکسی","اسنپ","تپسی","ماکسیم","آژانس","مترو","اتوبوس","بی آر تی","ون","قطار","راه آهن","هواپیما","پرواز","فرودگاه","بنزین","گازوئیل","سی ان جی","سوخت","ماشین","خودرو","موتور","دوچرخه","پیک","الوپیک","تیپاکس","عوارض","عوارضی","طرح ترافیک","پارکینگ","لاستیک","روغن موتور","تعویض روغن","باطری","باتری","کارواش","مکانیک","تعمیرگاه","سرویس خودرو","معاینه فنی"]', 0),
('Shopping', 'expense', '["خرید","فروشگاه","مغازه","بازار","مال","دیجی کالا","دیجی‌کالا","ترب","باسلام","لباس","پوشاک","تی شرت","تیشرت","شلوار","کت","کفش","صندل","بوت","کیف","کوله","چمدان","ساعت","عینک","زیورآلات","انگشتر","گردنبند","دستبند","آرایشی","بهداشتی","لوازم آرایش","عطر","ادکلن","موبایل","گوشی","تبلت","لپ تاپ","لپ‌تاپ","کامپیوتر","کیبورد","ماوس","هدفون","هارد","فلش","لوازم خانه","ظروف","مبلمان","دکور","فرش","پرده"]', 0),
('Bills', 'expense', '["قبض","قبض برق","قبض آب","قبض گاز","قبض تلفن","برق","گاز","تلفن","اینترنت","همراه اول","ایرانسل","رایتل","شارژ","بسته اینترنت","اجاره","رهن","ودیعه","شارژ ساختمان","شارژ مجتمع","مالیات","عوارض","جریمه","جریمه رانندگی","بیمه","بیمه خودرو","بیمه شخص ثالث","بیمه درمان","اشتراک","عضویت","نتفلیکس","اسپاتیفای","فیلیمو","نماوا","یوتیوب پریمیوم","هاست","دامنه","سرور","کلاد","Cloudflare","VPS"]', 0),
('Entertainment', 'expense', '["تفریح","سرگرمی","سینما","فیلم","تئاتر","کنسرت","بازی","گیم","استیم","Steam","پلی استیشن","ایکس باکس","نینتندو","بردگیم","بوردگیم","موسیقی","باشگاه","ورزش","استخر","فوتبال","والیبال","بدنسازی","کتاب","رمان","کمیک","سفر","مسافرت","هتل","اقامت","ویلا","بلیط","تور","شهربازی","بولینگ","بیلیارد","اتاق فرار","کارتینگ","کافه بازی"]', 0),
('Health', 'expense', '["دارو","داروخانه","قرص","شربت","ویتامین","مکمل","دکتر","پزشک","ویزیت","درمان","کلینیک","بیمارستان","آزمایش","آزمایشگاه","رادیولوژی","ام آر آی","MRI","سی تی اسکن","واکسن","دندانپزشک","دندان","ارتودنسی","جراحی","فیزیوتراپی","روانشناس","روانپزشک","عینک طبی","لنز"]', 0),
('Education', 'expense', '["آموزش","کلاس","دوره","کارگاه","مدرسه","دانشگاه","شهریه","کتاب","جزوه","تدریس","معلم","استاد","کنکور","زبان","آیلتس","تافل","برنامه نویسی","برنامه‌نویسی","کدنویسی","گواهینامه","آموزشگاه رانندگی","یودمی","Udemy","Coursera"]', 0),
('Other', 'expense', '[]', 0);

-- Default categories (income)
INSERT OR IGNORE INTO categories (name, type, keywords, usage_count) VALUES
('Salary', 'income', '["حقوق","حقوق ماهانه","حقوقم","دستمزد","حقوق کارمندی","کارانه","اضافه کار","اضافه‌کار","پاداش","عیدی","پورسانت","کمیسیون","بازنشستگی","مستمری"]', 0),
('Freelance', 'income', '["فریلنسر","پروژه","قرارداد","مشاوره","طراحی","برنامه نویسی","برنامه‌نویسی","توسعه","برنامه نویس","وبسایت","اپلیکیشن","درآمد پروژه","حق الزحمه","حق‌الزحمه","کارفرما","تسویه پروژه"]', 0),
('Gift', 'income', '["هدیه","کادو","عیدی","جایزه","کمک","حمایت","پول توجیبی","پول جیبی","بلاعوض","خیرات","صدقه","نذری"]', 0),
('Refund', 'income', '["بازپرداخت","برگشت پول","استرداد","مرجوع","مرجوعی","کنسلی","لغو سفارش","برگشت وجه","عودت وجه"]', 0),
('Other', 'income', '[]', 0);

-- Undo cache for deleted transactions
CREATE TABLE IF NOT EXISTS undo_cache (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
