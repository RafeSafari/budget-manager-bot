# Budget Manager Bot

Telegram bot that tracks expenses and earnings in group chats using AI categorization. Runs on **Telegram Serverless** — no servers, no hosting.

## Features

- **Auto-categorize**: AI detects spending/earning from natural messages
- **Group tracking**: Monitors all messages in a group chat
- **Reports**: Weekly and monthly reports with category/user breakdowns
- **Persistent storage**: SQLite database built into Telegram Serverless

## Quick Start

### 1. Enable Serverless

In [@BotFather](https://t.me/BotFather), open your bot → **Serverless** → turn it on.

### 2. Create project & login

```bash
npm install
npx tgcloud login
```

Paste the CLI access token from @BotFather → your bot → Serverless → CLI Access.

### 3. Set your API key (for AI categorization)

The bot uses OpenCode Zen for AI categorization. Get a key at [opencode.ai/auth](https://opencode.ai/auth).

Open the bot in Telegram and send:

```
/setkey OPENCODE_API_KEY sk-your_key_here
```

Or set it directly via the SDK — edit `lib/config.js` and hardcode it as a fallback.

### 4. Deploy

```bash
npx tgcloud push        # deploy code
npx tgcloud migrate     # create database tables
```

### 5. Add to Telegram Group

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
| `/budget Food 5000000` | Set budget |
| `/export 2026-07` | Export CSV |
| `/lang fa` | Switch to Persian |
| `/lang en` | Switch to English |

## Examples

- "50 هزار خرج غذا" → Expense, Food, 50000 IRT
- "200 تومان تاکسی" → Expense, Transport, 200 IRT
- "Spent 50 on food" → Expense, Food, $50
- "Earned 500 freelance" → Income, Freelance, $500

## Local Development

Test a handler without deploying:

```bash
npx tgcloud run handlers/message '{ chat: { id: 1 }, text: "50 هزار خرج غذا" }'
```

Check what changed:

```bash
npx tgcloud status
npx tgcloud diff
```

## Project Structure

```
schema.js              # Database tables
handlers/
  message.js           # Message + command handler
  callback_query.js    # Inline keyboard handler
lib/
  config.js            # API key management
  messages.js          # i18n (Persian/English)
  database.js          # All database queries
  categorizer.js       # AI transaction detection
  reports.js           # Report generation
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Bot not replying | Make it admin + disable group privacy in @BotFather |
| AI categorization not working | Set your API key: `/setkey OPENCODE_API_KEY sk-...` |
| "Not found" on deploy | Run `npx tgcloud login` first |
