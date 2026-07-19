# Budget Manager Bot

Telegram bot that tracks expenses and earnings in group chats using AI categorization. Deployed on **Cloudflare Workers** with **D1** database.

## Features

- **Auto-categorize**: AI detects spending/earning from natural messages
- **Group tracking**: Monitors all messages in a group chat
- **Reports**: Weekly and monthly reports with category/user breakdowns
- **D1 database**: Persistent, replicated SQLite storage
- **Free forever**: No credit card, no trial limits

## Quick Start

### 1. Get Keys

- **Telegram Bot**: @BotFather → `/newbot` → copy token
- **OpenCode Zen**: [opencode.ai/auth](https://opencode.ai/auth) → Create API Key → copy key

### 2. Install & Configure

```bash
git clone https://github.com/you/budget-manager-bot.git
cd budget-manager-bot
npm install
```

Copy `.dev.vars` and fill in your values:

```bash
BOT_TOKEN=your_token
OPENCODE_API_KEY=sk-your_key
BOT_INFO={"id":123456789,"is_bot":true,"first_name":"YourBot","username":"YourBot","can_join_groups":true,"can_read_all_group_messages":false,"supports_inline_queries":false,"can_connect_to_business":false}
```

> Get `BOT_INFO` by calling: `curl https://api.telegram.org/bot<TOKEN>/getMe`

### 3. Create D1 Database

```bash
npx wrangler d1 create budget-bot-db
```

Copy the `database_id` into `wrangler.toml`.

### 4. Run Migrations

```bash
npx wrangler d1 migrations apply budget-bot-db
```

### 5. Test Locally

```bash
npm run dev
```

### 6. Deploy

```bash
# Set secrets
npx wrangler secret put BOT_TOKEN
npx wrangler secret put OPENCODE_API_KEY

# Deploy
npm run deploy
```

### 7. Set Telegram Webhook

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://budget-manager-bot.<YOUR_SUBDOMAIN>.workers.dev/webhook"
```

### 8. Add to Telegram Group

Add bot as admin → send `/start`

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/help` | Help with examples |
| `/weekly` | Weekly report |
| `/monthly` | Monthly report |
| `/list` | List transactions |
| `/delete <id>` | Delete a transaction |
| `/budget` | Set budget limits |
| `/export` | Export CSV |
| `/autosummary` | Auto-scheduled reports |
| `/lang` | Switch language (fa/en) |

## Examples

- "Spent 50 on groceries" → Expense, Food, $50
- "Paid 30 for taxi" → Expense, Transport, $30
- "Earned 500 from freelance" → Income, Freelance, $500
- "50 هزار خرج غذا" → Expense, Food, 50,000 IRT

## Custom Categories

Edit `wrangler.toml` or use the bot's learning system — correct a category and the bot remembers.

## Architecture

| Component | Technology |
|-----------|-----------|
| Runtime | Cloudflare Workers (V8 isolates) |
| Database | Cloudflare D1 (serverless SQLite) |
| Bot Framework | grammY (webhook mode) |
| AI | OpenCode Zen API |
| Cron | Cloudflare Cron Triggers |

## Cost

**$0 forever** on the free tier:
- 100K requests/day
- D1: 5GB storage, 5M reads/day
- No credit card required

## License

MIT
