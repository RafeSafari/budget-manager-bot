#!/usr/bin/env node

const { createInterface } = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
const https = require('node:https');
const http = require('node:http');
const { execSync } = require('node:child_process');
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const rl = createInterface({ input, output });
const ask = (q) => rl.question(q);
const log = (msg) => console.log(`\x1b[36m${msg}\x1b[0m`);
const ok = (msg) => console.log(`\x1b[32m  ✓ ${msg}\x1b[0m`);
const fail = (msg) => console.log(`\x1b[31m  ✗ ${msg}\x1b[0m`);
const warn = (msg) => console.log(`\x1b[33m  ! ${msg}\x1b[0m`);

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    }).on('error', reject);
  });
}

function run(cmd, opts) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], shell: true, ...(opts || {}) });
  } catch (e) {
    return e.stdout || e.stderr || e.message;
  }
}

function runInteractive(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit', shell: true });
    return true;
  } catch {
    return false;
  }
}

const BANNER = `
\x1b[1m\x1b[36m╔══════════════════════════════════════════╗
║     Budget Manager Bot — Setup Wizard     ║
╚══════════════════════════════════════════╝\x1b[0m
`;

async function step1_botToken() {
  log('Step 1: Telegram Bot Token');
  console.log('  Get one from @BotFather on Telegram (/newbot)\n');

  while (true) {
    const token = (await ask('  Bot token: ')).trim();
    if (!token) continue;
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
      fail('Invalid format. Expected: 123456789:ABCdefGHI...');
      continue;
    }

    process.stdout.write('  Checking token... ');
    const res = await httpsGet('https://api.telegram.org/bot' + token + '/getMe');
    if (res.ok) {
      console.log('\x1b[32m✓\x1b[0m');
      ok('Bot: @' + res.result.username + ' (' + res.result.first_name + ')');
      return { token, botInfo: res.result };
    } else {
      console.log('\x1b[31m✗\x1b[0m');
      fail('API error: ' + (res.description || 'unknown'));
    }
  }
}

async function step2_apiKey() {
  log('\nStep 2: OpenCode Zen API Key');
  console.log('  Get one from https://opencode.ai/auth\n');

  while (true) {
    const key = (await ask('  API key: ')).trim();
    if (!key) continue;
    if (!key.startsWith('sk-')) {
      fail('API key should start with sk-');
      continue;
    }
    if (key.length < 20) {
      fail('API key looks too short');
      continue;
    }
    ok('Format looks valid');
    return key;
  }
}

async function step3_cloudflare() {
  log('\nStep 3: Cloudflare Account');

  const whoami = run('npx wrangler whoami 2>&1');
  if (whoami.includes('not logged in') || whoami.includes('Error')) {
    warn('Not logged in to Cloudflare. Opening browser...');
    console.log('  (Log in or sign up for free in the browser)\n');
    const success = runInteractive('npx wrangler login');
    if (!success) {
      fail('Login failed. Please run "npx wrangler login" manually and try again.');
      process.exit(1);
    }
    ok('Logged in to Cloudflare');
  } else {
    const emailMatch = whoami.match(/(\S+@\S+)/);
    ok('Logged in as ' + (emailMatch ? emailMatch[1] : 'Cloudflare user'));
  }
}

async function step4_createDB() {
  log('\nStep 4: Creating D1 Database');

  const output = run('npx wrangler d1 create budget-bot-db 2>&1');

  const idMatch = output.match(/database_id[:\s]+([0-9a-f-]+)/i);
  if (!idMatch) {
    if (output.includes('already exists') || output.includes('uniqueness')) {
      warn('Database "budget-bot-db" already exists.');
      const existingId = run('npx wrangler d1 list 2>&1');
      const existMatch = existingId.match(/budget-bot-db\s+([0-9a-f-]+)/i);
      if (existMatch) {
        ok('Using existing database: ' + existMatch[1]);
        return existMatch[1];
      }
      const manualId = (await ask('  Enter existing database ID: ')).trim();
      return manualId;
    }
    fail('Could not parse database ID from wrangler output.');
    console.log('  Raw output:', output.substring(0, 200));
    const manualId = (await ask('  Enter database ID manually: ')).trim();
    return manualId;
  }

  ok('Database created: ' + idMatch[1]);
  return idMatch[1];
}

function step5_updateWranglerTOML(dbId, botInfo) {
  log('\nStep 5: Updating wrangler.toml');

  const tomlPath = resolve('wrangler.toml');
  let toml = readFileSync(tomlPath, 'utf-8');

  toml = toml.replace(
    /database_id\s*=\s*"[^"]*"/,
    'database_id = "' + dbId + '"'
  );

  const botInfoJson = JSON.stringify(botInfo).replace(/"/g, '\\"');
  toml = toml.replace(
    /BOT_INFO\s*=\s*"[^"]*"/,
    'BOT_INFO = "' + botInfoJson + '"'
  );

  writeFileSync(tomlPath, toml);
  ok('wrangler.toml updated');
}

function step6_createDevVars(token, apiKey, botInfo) {
  log('\nStep 6: Creating .dev.vars for local development');

  const botInfoJson = JSON.stringify(botInfo);
  const content = [
    '# Local development secrets',
    'BOT_TOKEN=' + token,
    'OPENCODE_API_KEY=' + apiKey,
    '',
    '# Bot info (auto-populated from BotFather)',
    'BOT_INFO=' + botInfoJson,
    '',
  ].join('\n');

  writeFileSync(resolve('.dev.vars'), content);
  ok('.dev.vars created');
}

function step7_setSecrets(token, apiKey) {
  log('\nStep 7: Setting Cloudflare Secrets');

  process.stdout.write('  Setting BOT_TOKEN... ');
  const t1 = run('echo "' + token + '" | npx wrangler secret put BOT_TOKEN 2>&1');
  if (t1.includes('Success')) {
    console.log('\x1b[32m✓\x1b[0m');
  } else {
    console.log('\x1b[31m✗\x1b[0m');
    fail(t1.trim().split('\n').pop());
  }

  process.stdout.write('  Setting OPENCODE_API_KEY... ');
  const t2 = run('echo "' + apiKey + '" | npx wrangler secret put OPENCODE_API_KEY 2>&1');
  if (t2.includes('Success')) {
    console.log('\x1b[32m✓\x1b[0m');
  } else {
    console.log('\x1b[31m✗\x1b[0m');
    fail(t2.trim().split('\n').pop());
  }
}

function step8_migrations() {
  log('\nStep 8: Applying Database Migrations');

  process.stdout.write('  Running migrations... ');
  const output = run('npx wrangler d1 migrations apply budget-bot-db --remote 2>&1');
  if (output.includes('Applied') || output.includes('No migrations') || output.includes('Success')) {
    console.log('\x1b[32m✓\x1b[0m');
    ok('Migrations applied');
  } else {
    console.log('\x1b[33m!\x1b[0m');
    warn(output.trim().split('\n').slice(0, 3).join('\n  '));
  }
}

async function step9_deploy() {
  log('\nStep 9: Deploying to Cloudflare Workers');

  process.stdout.write('  Deploying... ');
  const output = run('npx wrangler deploy 2>&1');

  const urlMatch = output.match(/https:\/\/[^\s]+\.workers\.dev/);
  if (urlMatch) {
    console.log('\x1b[32m✓\x1b[0m');
    ok('Deployed to: ' + urlMatch[0]);
    return urlMatch[0];
  }

  if (output.includes('Uploaded') || output.includes('Deployed')) {
    console.log('\x1b[32m✓\x1b[0m');
    const url = (await ask('  Could not parse Worker URL. Paste it from wrangler output: ')).trim();
    return url;
  }

  console.log('\x1b[31m✗\x1b[0m');
  fail('Deploy may have failed:');
  console.log('  ' + output.split('\n').slice(0, 5).join('\n  '));
  const url = (await ask('  Paste Worker URL manually (or press Enter to skip): ')).trim();
  return url || null;
}

async function step10_setWebhook(token, workerUrl) {
  log('\nStep 10: Setting Telegram Webhook');

  if (!workerUrl) {
    warn('No Worker URL — skipping webhook setup.');
    console.log('  Run this manually later:');
    console.log('  curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR-URL.workers.dev/webhook"');
    return;
  }

  const webhookUrl = workerUrl + '/webhook';
  process.stdout.write('  Setting webhook to ' + webhookUrl + '... ');

  const res = await httpsGet('https://api.telegram.org/bot' + token + '/setWebhook?url=' + encodeURIComponent(webhookUrl));
  if (res.ok) {
    console.log('\x1b[32m✓\x1b[0m');
    ok('Webhook set successfully');
  } else {
    console.log('\x1b[31m✗\x1b[0m');
    fail('Error: ' + (res.description || 'unknown'));
  }
}

async function main() {
  console.log(BANNER);

  if (!existsSync('wrangler.toml')) {
    fail('Run this from the project root (where wrangler.toml is).');
    process.exit(1);
  }

  const { token, botInfo } = await step1_botToken();
  const apiKey = await step2_apiKey();
  await step3_cloudflare();
  const dbId = await step4_createDB();
  step5_updateWranglerTOML(dbId, botInfo);
  step6_createDevVars(token, apiKey, botInfo);
  step7_setSecrets(token, apiKey);
  step8_migrations();
  const workerUrl = await step9_deploy();
  await step10_setWebhook(token, workerUrl);

  console.log('');
  console.log('\x1b[1m\x1b[32m╔══════════════════════════════════════════╗');
  console.log('║           Setup Complete!                ║');
  console.log('╚══════════════════════════════════════════╝\x1b[0m');
  console.log('');

  if (workerUrl) {
    console.log('  Worker URL:  ' + workerUrl);
  }
  console.log('  Webhook:     ' + (workerUrl ? workerUrl + '/webhook' : '(not set)'));
  console.log('  Bot:         @' + botInfo.username);
  console.log('');
  console.log('  Next steps:');
  console.log('  1. Add @' + botInfo.username + ' to your Telegram group');
  console.log('  2. Make it an admin');
  console.log('  3. Send /start in the group');
  console.log('  4. Type a message like "50 lunch" to test');
  console.log('');
  console.log('  Local development:');
  console.log('    npm run dev');
  console.log('');

  rl.close();
}

main().catch(function (e) {
  console.error('\nSetup failed:', e.message);
  rl.close();
  process.exit(1);
});
