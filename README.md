# Budget Manager Bot

Telegram bot that tracks expenses and earnings in group chats using AI categorization. Deployed on **Cloudflare Workers** with **D1** database.

## Features

- **Auto-categorize**: AI detects spending/earning from natural messages
- **Group tracking**: Monitors all messages in a group chat
- **Reports**: Weekly and monthly reports with category/user breakdowns
- **D1 database**: Persistent, replicated SQLite storage
- **Free forever**: No credit card, no trial limits

## Quick Start

**One command to deploy:**

```bash
git clone https://github.com/you/budget-manager-bot.git
cd budget-manager-bot
npm install
npm run setup
```

The interactive wizard will ask for:
1. **Telegram bot token** — get from @BotFather on Telegram
2. **OpenCode API key** — get from [opencode.ai/auth](https://opencode.ai/auth) (free)
3. **Cloudflare login** — opens browser (free account)

Everything else is handled automatically.

## After Setup

1. Add your bot to a Telegram group
2. Make it an **admin**
3. Send `/start` in the group
4. Type naturally: `50 lunch`, `۵۰ هزار ناهار`, `paid 30 for taxi`

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/help` | Help with examples |
| `/weekly` | Weekly report |
| `/monthly` | Monthly report |
| `/list` | List transactions |
| `/delete last` | Delete last transaction |
| `/budget Food 5000000` | Set monthly budget |
| `/export` | Export as CSV |
| `/autosummary daily 09:00` | Auto-send reports |
| `/lang fa` | Switch to Persian |

## Examples

| You type | Bot records |
|----------|-------------|
| `Spent 50 on groceries` | Expense — Food — $50 |
| `Paid 30 for taxi` | Expense — Transport — $30 |
| `Earned 500 from freelance` | Income — Freelance — $500 |
| `۵۰ هزار خرج غذا` | Expense — Food — 50,000 IRT |

## Cost

**$0 forever** on the free tier:
- 100K requests/day
- D1: 5GB storage, 5M reads/day
- No credit card required

## License

MIT
