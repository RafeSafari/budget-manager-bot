# Budget Manager Bot — Setup Guide

## Overview

Telegram bot that reads group messages, uses AI to detect spending/earning transactions, categorizes them, and stores them in SQLite. Generates weekly and monthly reports.

---

## Prerequisites

- Node.js 22+ installed
- A Telegram account
- An OpenCode Zen account ([free models available](https://opencode.ai/auth))
- A GitHub account (for Railway deployment)

---

## Step 1: Create a Telegram Bot

1. Open Telegram, search for **@BotFather**
2. Send `/newbot`
3. Pick a display name (e.g., `Budget Tracker`)
4. Pick a username ending in `bot` (e.g., `my_budget_tracker_bot`)
5. Copy the token BotFather sends you

---

## Step 2: Get OpenCode Zen API Key

1. Go to [opencode.ai/auth](https://opencode.ai/auth)
2. Sign up / log in
3. Click **"Create API Key"**
4. Copy the key (starts with `sk-...`)

---

## Step 3: Configure Environment

```bash
cd H:\non-benefits\budget-manager-bot
copy .env.example .env
```

Edit `.env` and fill in:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
OPENCODE_API_KEY=sk-your_key_here
OPENCODE_MODEL=deepseek-v4-flash-free
```

---

## Step 4: Test Locally (Optional)

```bash
npm install
npm run build
npm start
```

You should see `Bot is running!`. Send `/start` to your bot on Telegram to verify.

---

## Step 5: Deploy to Railway

### 5a. Install & Login

```bash
npm install -g @railway/cli
railway login
```

### 5b. Link or Init

```bash
# Try creating a new project
railway init
```

Select **"Empty Project"** and enter a name.

> **"Free plan resource provision limit exceeded"?** You've hit the free plan project limit. Reuse an existing empty project instead:
> ```bash
> railway link
> ```
> Select a project from the list.

### 5c. Deploy (must be first)

```bash
railway up
```

> **Why deploy before setting variables?** Railway needs a service to exist before variables can be set. If you set variables first, you'll get "Project has no services."

### 5d. Set Environment Variables

```bash
railway variables set TELEGRAM_BOT_TOKEN="your_token"
railway variables set OPENCODE_API_KEY="sk-your_key"
railway variables set OPENCODE_MODEL="deepseek-v4-flash-free"
```

### 5e. Verify

```bash
railway logs
```

You should see `Bot is running!`. If not, check variables: `railway variables`

---

## Step 6: Add Bot to Telegram Group

1. Open your group → **Add Members** → search for your bot
2. Add it, then go to **Administrators** → make it an admin
3. Send `/start` in the group

---

## Step 7: Usage

Type naturally in the group:

| You type | Bot records |
|---|---|
| `Spent 50 on groceries` | Expense — Food — $50 |
| `Paid 30 for taxi` | Expense — Transport — $30 |
| `Earned 500 from freelance` | Income — Freelance — $500 |
| `Got 100 as gift` | Income — Gift — $100 |

### Commands

| Command | Description |
|---|---|
| `/start` | Welcome message |
| `/help` | Help with examples |
| `/weekly` | Weekly report |
| `/monthly` | Monthly report |
| `/list` | List current month's transactions |
| `/delete <id>` | Delete a transaction |

---

## Updating

```bash
railway up
```

---

## Troubleshooting

### "Free plan resource provision limit exceeded"

Railway limits free plan projects. Reuse an existing one:

```bash
railway link
```

### "Project has no services"

You tried to set variables before deploying. Deploy first:

```bash
railway up
```

Then set variables.

### Bot crashes with `OPENAI_API_KEY` missing

The env var isn't set on Railway. Check and set:

```bash
railway variables
railway variables set OPENCODE_API_KEY="sk-your_key"
```

### Bot does not reply in group

- Make sure the bot is an **admin** in the group
- Disable group privacy: @BotFather → `/mybots` → your bot → **Bot Settings** → **Group Privacy** → **Turn off**

### Transactions not saving / data lost on redeploy

Railway uses ephemeral storage — data resets on each deploy. For persistence, add a Railway volume or use a cloud database.

---

## Cost

| Service | Cost |
|---|---|
| Railway (hobby plan) | Free (500 hrs/month) |
| OpenCode Zen (free model) | $0 |
| OpenCode Zen (deepseek-v4-flash) | ~$0.0000004/message |

---

## Models

**Free:** `deepseek-v4-flash-free`, `mimo-v2.5-free`, `nemotron-3-ultra-free`, `big-pickle`

**Paid (cheap):** `deepseek-v4-flash` ($0.14/$0.28 per M tokens), `minimax-m3` ($0.30/$1.20)
