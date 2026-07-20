import { db } from 'sdk';
import { secrets } from 'schema';
import { eq } from 'sdk/db';

const DEFAULTS = {
  OPENCODE_API_KEY: '',
  OPENCODE_MODEL: 'deepseek-v4-flash-free',
};

export async function getSecret(key) {
  const row = await db.select().from(secrets).where(eq(secrets.key, key)).get();
  return row ? row.value : DEFAULTS[key] || '';
}

export async function setSecret(key, value) {
  await db.insert(secrets)
    .values({ key, value })
    .onConflictDoUpdate({ target: secrets.key, set: { value } })
    .run();
}
