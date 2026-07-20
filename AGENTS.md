# AGENTS.md — Budget Manager Bot (Telegram Serverless)

This bot runs on **Telegram Serverless** — no servers, no hosting, no infrastructure.

## Project structure

```
schema.js              # database tables (Drizzle-like DSL via sdk/db)
handlers/              # update handlers — one file per update type
  message.js           # handles incoming messages + commands
  callback_query.js    # handles inline keyboard button presses
lib/                   # shared modules
  config.js            # secrets (API keys) stored in database
  messages.js          # i18n strings (fa/en)
  database.js          # all database queries
  categorizer.js       # AI-powered expense/income categorization
  reports.js           # weekly/monthly report generation
```

## Key conventions

- **Imports**: always bare names — `from 'sdk'`, `from 'schema'`, `from 'lib/config'`. No relative paths, no `.js` extensions.
- **No npm packages**: only `sdk` (db, api, fetch) and your own modules.
- **No foreign keys**: relationships enforced in application code.
- **No `process.env`**: secrets stored in `secrets` table via `lib/config.js`.
- **No `fs`, `path`, `Buffer`**: use `fetch` from sdk, `TextEncoder` for buffers.
- **Async everywhere**: every db call returns a Promise — always `await`.

## SDK surface

| Import | Purpose |
|--------|---------|
| `db` from `sdk` | Query builder (select, insert, update, delete) |
| `api` from `sdk` | Telegram Bot API (unwrapped — returns `result` directly) |
| `fetch` from `sdk` | Outbound HTTP (for OpenAI API calls) |
| `sql` from `sdk/db` | Raw SQL fragments |
| `eq, and, or, desc, asc, count` from `sdk/db` | Operators |

## Deploy

```bash
npx tgcloud push        # deploy code
npx tgcloud migrate     # apply schema changes
```

## Test without deploying

```bash
npx tgcloud run handlers/message '{ chat: { id: 1 }, text: "50 هزار خرج غذا" }'
```
