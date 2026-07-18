# Budget Manager Bot

Telegram bot that tracks expenses and earnings in group chats using AI categorization.

## Features

- **Auto-categorize**: AI analyzes messages and extracts spending/earning info
- **Group tracking**: Monitors all messages in a group chat
- **Reports**: Weekly and monthly reports with category/user breakdowns
- **SQLite storage**: Persistent data storage

## Setup

### 1. Create a Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts
3. Copy the bot token

### 2. Get OpenCode Zen API Key

1. Go to [opencode.ai/auth](https://opencode.ai/auth)
2. Sign up / log in
3. Click **"Create API Key"**
4. Copy the key (starts with `sk-...`)

### 3. Configure Environment

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
OPENCODE_API_KEY=your_opencode_key_here
OPENCODE_MODEL=deepseek-v4-flash-free
```

### 4. Add Bot to Group

1. Add the bot to your Telegram group
2. Make it an admin (so it can read all messages)
3. Send `/start` to initialize

### 5. Deploy to Railway

```bash
# Install Railway CLI
pnpm install -g @railway/cli

# Login
railway login

# Initialize project (name: Budget Analyzer Telegram AI Bot)
railway init

# Add environment variables
railway variables set TELEGRAM_BOT_TOKEN=your_token
railway variables set OPENCODE_API_KEY=your_key
railway variables set OPENCODE_MODEL=deepseek-v4-flash-free

# Deploy
railway up
```

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Show welcome message |
| `/help` | Show available commands |
| `/weekly` | Generate weekly report |
| `/monthly` | Generate monthly report |
| `/list` | List recent transactions |
| `/delete <id>` | Delete a transaction |

## Message Examples

The bot tracks messages like:

- "Spent 50 on groceries" → Expense, Food, $50
- "Paid 30 for taxi" → Expense, Transport, $30
- "Earned 500 from freelance" → Income, Freelance, $500
- "Got 100 as gift" → Income, Gift, $100

## Custom Categories

Edit `.env` to customize categories:

```env
EXPENSE_CATEGORIES=Food,Transport,Shopping,Bills,Entertainment,Health,Education,Other
INCOME_CATEGORIES=Salary,Freelance,Gift,Refund,Other
```

## Available Models

Free models on OpenCode Zen:

| Model | Cost |
|-------|------|
| `deepseek-v4-flash-free` | Free |
| `mimo-v2.5-free` | Free |
| `nemotron-3-ultra-free` | Free |
| `big-pickle` | Free |

Paid models (pay per token):

| Model | Input | Output |
|-------|-------|--------|
| `deepseek-v4-flash` | $0.14/M | $0.28/M |
| `minimax-m3` | $0.30/M | $1.20/M |
| `glm-5.2` | $1.40/M | $4.40/M |
| `kimi-k2.5` | $0.60/M | $3.00/M |

## Local Development

```bash
pnpm install
pnpm run dev
```

**Note**: On Windows, `better-sqlite3` requires Visual Studio Build Tools. On Linux/macOS it compiles automatically.
