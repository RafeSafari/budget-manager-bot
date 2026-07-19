# Budget Manager Bot — Setup Guide

## Overview

This bot joins a Telegram group, reads all messages, uses AI to detect spending/earning transactions, categorizes them, and stores them in SQLite. It generates weekly and monthly reports.

---

## Prerequisites

- Node.js 22+ installed
- npm installed (comes with Node.js)
- A Telegram account
- An OpenCode Zen account (free models available)
- A GitHub account (for Railway deployment)

---

## Step 1: Create a Telegram Bot

1. Open Telegram (app or web)
2. Search for **@BotFather**
3. Send the command `/newbot`
4. When asked for a name, type a display name (e.g., `Budget Tracker`)
5. When asked for a username, type one ending in `bot` (e.g., `my_budget_tracker_bot`)
6. BotFather replies with a **token** — a long string like:
   ```
   7123456789:AAHn3-wkjfasf98234lkjsd9f
   ```
7. Copy and save this token. You will need it in Step 3.

---

## Step 2: Get OpenCode Zen API Key

1. Go to [https://opencode.ai/auth](https://opencode.ai/auth)
2. Sign up or log in
3. Click **"Create API Key"**
4. Copy the key — it starts with `sk-...`
5. (Optional) Add billing details if you want to use paid models

> Free models available: `deepseek-v4-flash-free`, `mimo-v2.5-free`, `nemotron-3-ultra-free`, `big-pickle`

---

## Step 3: Configure Environment Variables

In the project directory, copy the example env file and edit it:

```bash
cd H:\non-benefits\budget-manager-bot
copy .env.example .env
```

Open `.env` in any text editor and fill in:

```env
TELEGRAM_BOT_TOKEN=7123456789:AAHn3-wkjfasf98234lkjsd9f
OPENCODE_API_KEY=sk-crZRuOzKfQWANENHhm2lnLTQXHBucCFQ3JcSGn1OGCNjka4Ry4QGCAlTgKpEhi1y
OPENCODE_MODEL=deepseek-v4-flash-free

# Optional: customize categories (defaults shown)
EXPENSE_CATEGORIES=Food,Transport,Shopping,Bills,Entertainment,Health,Education,Other
INCOME_CATEGORIES=Salary,Freelance,Gift,Refund,Other
```

---

## Step 4: Test Locally (Optional)

Build and run the bot on your machine:

```bash
npm install
npm run build
npm start
```

If successful, you will see:

```
Database initialized.
Starting Budget Manager Bot...
Bot is running!
```

### Local Testing Checklist

1. Open Telegram and find your bot by its username
2. Send `/start` — the bot should reply with a welcome message
3. Add the bot to a test group
4. Go to group settings → **Administrators** → **Add Administrator** → select your bot
5. In the group, type: `Spent 50 on food`
6. The bot should reply with a confirmation like:

   ```
   Transaction recorded!

   Type: Expense
   Amount: 50 USD
   Category: Food
   Description: N/A
   ```

Press `Ctrl+C` to stop the bot.

---

## Step 5: Deploy to Railway

### 5a. Install Railway CLI

```bash
npm install -g @railway/cli
```

### 5b. Login to Railway

```bash
railway login
```

This opens a browser window. Log in with your GitHub account.

### 5c. Initialize the Project

```bash
cd H:\non-benefits\budget-manager-bot
railway init
```

- Select **"Empty Project"**
- Enter a project name (e.g., `budget-bot`)

> **Hit "Free plan resource provision limit exceeded"?**
> If `railway init` fails with this error, you've hit Railway's free plan limit. Instead, reuse an existing empty project:
>
> ```bash
> railway link
> ```
>
> Select an existing project from the list (e.g., one you created before but no longer use). This skips the limit entirely.

### 5d. Deploy

```bash
railway up
```

Railway will:
1. Detect the `Dockerfile`
2. Build a Linux container with Node.js 22
3. Install all dependencies (including `better-sqlite3` which compiles on Linux)
4. Start the bot

### 5e. Set Environment Variables

```bash
railway variables set TELEGRAM_BOT_TOKEN="7123456789:AAHn3-wkjfasf98234lkjsd9f"
railway variables set OPENCODE_API_KEY="sk-crZRuOzKfQWANENHhm2lnLTQXHBucCFQ3JcSGn1OGCNjka4Ry4QGCAlTgKpEhi1y"
railway variables set OPENCODE_MODEL="deepseek-v4-flash-free"
```

> **Why deploy first?** Railway needs a service to exist before you can set variables on it. If you set variables before deploying, you'll get "Project has no services."

### 5f. Verify Deployment

Check the logs:

```bash
railway logs
```

You should see:

```
Database initialized.
Starting Budget Manager Bot...
Bot is running!
```

If you see errors, check that your environment variables are set correctly:

```bash
railway variables
```

---

## Step 6: Add Bot to Your Telegram Group

1. Open your Telegram group
2. Tap the group name at the top → **Add Members**
3. Search for your bot by its username
4. Add it to the group
5. Go to group settings → **Administrators** → **Add Administrator** → select your bot
6. Send `/start` in the group
7. The bot replies with available commands

---

## Step 7: Daily Usage

### Recording Transactions

Just type naturally in the group. The AI understands many formats:

| You type | Bot records |
|---|---|
| `Spent 50 on groceries` | Expense — Food — $50 |
| `Paid 30 for taxi` | Expense — Transport — $30 |
| `Bought coffee for 5` | Expense — Food — $5 |
| `Electric bill 120` | Expense — Bills — $120 |
| `Earned 500 from freelance` | Income — Freelance — $500 |
| `Got 100 as gift` | Income — Gift — $100 |
| `Salary came in 3000` | Income — Salary — $3000 |
| `Refund 25 from store` | Income — Refund — $25 |

Messages that are not transactions (e.g., "Hello everyone", "What's for lunch?") are ignored.

### Bot Commands

| Command | Description |
|---|---|
| `/start` | Show welcome message and available commands |
| `/help` | Show help with examples |
| `/weekly` | Generate weekly expense/income report |
| `/monthly` | Generate monthly report |
| `/list` | List all transactions for current month |
| `/delete <id>` | Delete a transaction by its ID |

### Sample Report Output

```
📊 Weekly Report (2026-07-14 to 2026-07-20)

💰 INCOME: $3,500.00
  💰 Salary: $3,000.00 (1 transactions)
  💻 Freelance: $500.00 (1 transactions)

💸 EXPENSES: $420.50
  🍔 Food: $180.00 (5 transactions)
  🚗 Transport: $95.50 (3 transactions)
  🛒 Shopping: $145.00 (2 transactions)

✅ BALANCE: $3,079.50

👥 Expenses by User:
  • john_doe: $250.00
  • jane_smith: $170.50
```

---

## Updating the Bot

After making code changes:

```bash
railway up
```

Railway rebuilds and redeploys automatically.

---

## Viewing Logs

```bash
railway logs
```

Or view live logs:

```bash
railway logs --follow
```

---

## Deleting the Deployment

```bash
railway service delete
```

---

## Troubleshooting

### Railway: "Free plan resource provision limit exceeded"

Railway's free plan limits the number of active projects. If `railway init` throws this error, reuse an existing empty project:

```bash
railway link
```

Select the project you want to reuse from the list.

### Bot does not reply in group

- Make sure the bot is an **admin** in the group
- Group privacy mode may block messages. Disable it:
  1. Talk to @BotFather
  2. Send `/mybots`
  3. Select your bot → **Bot Settings** → **Group Privacy** → **Turn off**

### Bot crashes on startup

- Check environment variables are set: `railway variables`
- Check logs for the specific error: `railway logs`

### Transactions not saving

- Verify the database is created (check logs for "Database initialized")
- Railway uses ephemeral storage — data resets on redeploy. For persistent data, add a Railway volume or use a cloud database.

### OpenCode Zen errors

- Verify your API key is valid at [opencode.ai/auth](https://opencode.ai/auth)
- Check available models with: `curl https://opencode.ai/zen/v1/models -H "Authorization: Bearer YOUR_API_KEY"`
- Try a free model like `deepseek-v4-flash-free` if you have no credits

---

## Cost Estimate

| Service | Cost |
|---|---|
| Railway (hobby plan) | Free (500 hours/month) |
| OpenCode Zen (free model) | $0 |
| OpenCode Zen (deepseek-v4-flash) | ~$0.0000004 per message |
| 100 transactions/day | ~$0.00004/day (~$0.001/month) |

---

## Available Models

### Free Models (Recommended for testing)

| Model ID | Provider |
|---|---|
| `deepseek-v4-flash-free` | DeepSeek |
| `mimo-v2.5-free` | OpenCode |
| `nemotron-3-ultra-free` | NVIDIA |
| `big-pickle` | Unknown |

### Paid Models (Cheap options)

| Model ID | Input | Output |
|---|---|---|
| `deepseek-v4-flash` | $0.14/M | $0.28/M |
| `minimax-m3` | $0.30/M | $1.20/M |
| `glm-5.2` | $1.40/M | $4.40/M |
| `kimi-k2.5` | $0.60/M | $3.00/M |

---

## Project Structure

```
budget-manager-bot/
├── src/
│   ├── index.ts          # Entry point, env validation
│   ├── bot.ts            # Telegram bot handlers
│   ├── database.ts       # SQLite operations
│   ├── categorizer.ts    # AI message parsing (OpenCode Zen)
│   └── reports.ts        # Report generation
├── Dockerfile            # Docker build for Railway
├── railway.json          # Railway deployment config
├── package.json
├── tsconfig.json
├── .env.example
├── .env                  # Your secrets (not committed)
├── .gitignore
├── .dockerignore
├── README.md
└── SETUP.md              # This file
```
