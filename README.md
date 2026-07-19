# Budget Manager Bot

Telegram bot that tracks expenses and earnings in group chats using AI categorization.

## Features

- **Auto-categorize**: AI detects spending/earning from natural messages
- **Group tracking**: Monitors all messages in a group chat
- **Reports**: Weekly and monthly reports with category/user breakdowns
- **SQLite storage**: Persistent data (resets on Railway redeploy)

## Quick Start

### 1. Get Keys

- **Telegram Bot**: @BotFather → `/newbot` → copy token
- **OpenCode Zen**: [opencode.ai/auth](https://opencode.ai/auth) → Create API Key → copy key

### 2. Configure

```bash
cp .env.example .env
```

Fill in `.env`:

```env
TELEGRAM_BOT_TOKEN=your_token
OPENCODE_API_KEY=sk-your_key
OPENCODE_MODEL=deepseek-v4-flash-free
```

### 3. Deploy to Railway

```bash
npm install -g @railway/cli
railway login
railway init          # or: railway link (if hitting free plan limit)
railway up            # must run BEFORE setting variables
railway variables set TELEGRAM_BOT_TOKEN=your_token
railway variables set OPENCODE_API_KEY=your_key
railway variables set OPENCODE_MODEL=deepseek-v4-flash-free
```

### 4. Add to Telegram Group

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

## Examples

- "Spent 50 on groceries" → Expense, Food, $50
- "Paid 30 for taxi" → Expense, Transport, $30
- "Earned 500 from freelance" → Income, Freelance, $500

## Custom Categories

Edit `.env`:

```env
EXPENSE_CATEGORIES=Food,Transport,Shopping,Bills,Entertainment,Health,Education,Other
INCOME_CATEGORIES=Salary,Freelance,Gift,Refund,Other
```

## Local Dev

```bash
npm install
npm run dev
```

## Troubleshooting

| Error | Fix |
|-------|-----|
| "Free plan resource provision limit exceeded" | `railway link` — reuse an existing project |
| "Project has no services" | Run `railway up` before setting variables |
| `OPENAI_API_KEY` missing | `railway variables set OPENCODE_API_KEY=sk-...` |
| Bot not replying | Make it admin + disable group privacy in @BotFather |
