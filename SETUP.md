# Budget Manager Bot — Setup Guide

## Quick Start (Recommended)

One command does everything:

```bash
git clone https://github.com/you/budget-manager-bot.git
cd budget-manager-bot
npm install
npm run setup
```

The wizard will:
1. Ask for your Telegram bot token (from @BotFather)
2. Ask for your OpenCode Zen API key (from opencode.ai/auth)
3. Log you into Cloudflare (opens browser — free account)
4. Create a D1 database, deploy the bot, and set the webhook

That's it. The bot will be live at `https://budget-manager-bot.<your-subdomain>.workers.dev`

---

## After Setup

1. Add your bot to a Telegram group
2. Make it an **admin** (required to read messages)
3. Send `/start` in the group
4. Type a message like `50 lunch` or `۵۰ هزار ناهار` — the bot will record it

---

## Commands

| Command | Description |
|---|---|
| `/start` | Welcome message |
| `/help` | Help with examples |
| `/weekly` | Weekly report |
| `/monthly` | Monthly report |
| `/list` | List current month's transactions |
| `/delete last` | Delete last transaction |
| `/budget Food 5000000` | Set monthly budget for a category |
| `/export` | Export as CSV |
| `/autosummary daily 09:00` | Auto-send daily reports |
| `/lang fa` or `/lang en` | Switch language |

---

## Local Development

```bash
npm run dev
```

The bot runs at `http://localhost:8787`. To receive Telegram updates locally, you need a public URL:

```bash
npx cloudflared tunnel --url http://localhost:8787
```

Then set the webhook to the tunnel URL.

---

## Updating

```bash
npm run deploy
```

---

## Manual Setup (Advanced)

If the wizard doesn't work, you can set up manually — see the steps below.

<details>
<summary>Click to expand manual setup</summary>

### 1. Create Telegram Bot

- Open Telegram, search for **@BotFather**
- Send `/newbot`, pick a name and username
- Copy the token

### 2. Get OpenCode API Key

- Go to [opencode.ai/auth](https://opencode.ai/auth)
- Sign up / log in, create an API key

### 3. Create D1 Database

```bash
npx wrangler d1 create budget-bot-db
```

Copy the `database_id` into `wrangler.toml`.

### 4. Set Secrets

```bash
echo "YOUR_BOT_TOKEN" | npx wrangler secret put BOT_TOKEN
echo "YOUR_API_KEY" | npx wrangler secret put OPENCODE_API_KEY
```

### 5. Apply Migrations

```bash
npx wrangler d1 migrations apply budget-bot-db --remote
```

### 6. Deploy

```bash
npx wrangler deploy
```

### 7. Set Webhook

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR-URL.workers.dev/webhook"
```

</details>

---

## Troubleshooting

**Bot not replying in group?**
- Make sure it's an **admin** in the group
- Disable privacy mode: @BotFather → `/mybots` → your bot → **Bot Settings** → **Group Privacy** → **Turn off**

**Webhook not working?**
```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

**D1 errors?**
```bash
npx wrangler d1 migrations apply budget-bot-db --remote
```

---

## Models

**Free:** `deepseek-v4-flash-free`, `mimo-v2.5-free`, `nemotron-3-ultra-free`

**Paid:** `deepseek-v4-flash` ($0.14/$0.28 per M tokens)

Change model: `npx wrangler var put OPENCODE_MODEL --value "model-name"`
