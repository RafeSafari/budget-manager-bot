import dotenv from 'dotenv';
dotenv.config();

import { initDatabase, closeDatabase } from './database';
import { startBot, stopBot } from './bot';

// Validate environment variables
const required = ['TELEGRAM_BOT_TOKEN', 'OPENCODE_API_KEY'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

async function main() {
  // Initialize database
  await initDatabase();
  console.log('Database initialized.');

  // Start bot
  startBot();
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  stopBot();
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  stopBot();
  closeDatabase();
  process.exit(0);
});
