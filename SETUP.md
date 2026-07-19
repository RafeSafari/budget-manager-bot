# Budget Manager Bot — Setup Guide

## Overview

Telegram bot that reads group messages, uses AI to detect spending/earning transactions, categorizes them, and stores them in D1. Generates weekly and monthly reports.

---

## Prerequisites

- Node.js 18+ installed
- A Telegram account
- An OpenCode Zen account ([free models available](https://opencode.ai/auth))
- A GitHub account

---

## Step 1: Create a Telegram Bot

1. Open Telegram, search for **@BotFather**
2. Send `/newbot`
3. Pick a display name (e.g., `Budget Tracker`)
4. Pick a username ending in `bot` (e.g., `my_budget_tracker_bot`)
5. Copy the token BotFather sends you
6. Get bot info: visit `https://api.telegram.org/bot<TOKEN>/getMe` and copy the JSON response

---

## Step 2: Get OpenCode Zen API Key

1. Go to [opencode.ai/auth](https://opencode.ai/auth)
2. Sign up / log in
3. Click **"Create API Key"**
4. Copy the key (starts with `sk-...`)

---

## Step 3: Install & Configure

```bash
git clone https://github.com/you/budget-manager-bot.git
cd budget-manager-bot
npm install
```

Create `.dev.vars` (already exists as template):

```bash
BOT_TOKEN=your_bot_token_here
OPENCODE_API_KEY=sk-your_key_here
BOT_INFO={"id":123456789,"is_bot":true,"first_name":"YourBot","username":"YourBot","can_join_groups":true,"can_read_all_group_messages":false,"supports_inline_queries":false,"can_connect_to_business":false}
```

---

## Step 4: Create D1 Database

```bash
npx wrangler d1 create budget-bot-db
```

Copy the `database_id` from the output and paste it into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "budget-bot-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Run migrations:

```bash
npx wrangler d1 migrations apply budget-bot-db
```

---

## Step 5: Test Locally

```bash
npm run dev
```

Your bot is now running locally via Cloudflare's dev runtime.

---

## Step 6: Deploy to Cloudflare

### 6a. Set Secrets

```bash
npx wrangler secret put BOT_TOKEN
# Paste your bot token when prompted

npx wrangler secret put OPENCODE_API_KEY
# Paste your API key when prompted
```

### 6b. Deploy

```bash
npm run deploy
```

Note the Worker URL from the output (e.g., `budget-manager-bot.your-subdomain.workers.dev`).

### 6c. Set Telegram Webhook

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://budget-manager-bot.<YOUR_SUBDOMAIN>.workers.dev/webhook"
```

You should see: `{"ok":true,"result":true,"description":"Webhook was set"}`

---

## Step 7: Add Bot to Telegram Group

1. Open your group → **Add Members** → search for your bot
2. Add it, then go to **Administrators** → make it an admin
3. Send `/start` in the group

---

## Step 8: Usage

Type naturally in the group:

| You type | Bot records |
|---|---|
| `Spent 50 on groceries` | Expense — Food — $50 |
| `Paid 30 for taxi` | Expense — Transport — $30 |
| `Earned 500 from freelance` | Income — Freelance — $500 |
| `50 هزار خرج غذا` | Expense — Food — 50,000 IRT |

### Commands

| Command | Description |
|---|---|
| `/start` | Welcome message |
| `/help` | Help with examples |
| `/weekly` | Weekly report |
| `/monthly` | Monthly report |
| `/list` | List current month's transactions |
| `/delete <id>` | Delete a transaction |
| `/budget` | Set budget limits |
| `/export` | Export CSV |
| `/autosummary` | Auto-scheduled reports |
| `/lang` | Switch language (fa/en) |

---

## Updating

```bash
npm run deploy
```

---

## Troubleshooting

### Webhook not receiving updates

Verify webhook is set:

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

If not set, re-run the `setWebhook` curl command.

### Bot not replying

- Make sure the bot is an **admin** in the group
- Disable group privacy: @BotFather → `/mybots` → your bot → **Bot Settings** → **Group Privacy** → **Turn off**

### D1 errors

Check migrations are applied:

```bash
npx wrangler d1 migrations apply budget-bot-db
```

### Cron not firing

Cloudflare Cron Triggers have a minimum interval of 1 minute. Check `wrangler.toml` for the cron schedule.

---

## Models

**Free:** `deepseek-v4-flash-free`, `mimo-v2.5-free`, `nemotron-3-ultra-free`, `big-pickle`

**Paid (cheap):** `deepseek-v4-flash` ($0.14/$0.28 per M tokens)
