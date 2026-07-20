import { createBot, Env } from './bot';
import { getAllEnabledAutoSummaries } from './database';
import { generateWeeklyReport } from './reports';

async function handleScheduled(env: Env, scheduledTime: Date): Promise<void> {
  const DB = env.DB;
  const bot = createBot(env);

  const summaries = await getAllEnabledAutoSummaries(DB);
  console.log(`[CRON] Checking ${summaries.length} auto-summaries at ${scheduledTime.toISOString()}`);

  for (const settings of summaries) {
    const now = scheduledTime;
    const [hour, minute] = settings.time.split(':').map(Number);
    const settingsHour = hour;
    const settingsMinute = minute;

    let shouldSend = false;

    if (settings.schedule_type === 'daily') {
      shouldSend = now.getHours() === settingsHour && now.getMinutes() === settingsMinute;
    } else if (settings.schedule_type === 'weekly') {
      const dayMap: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6,
      };
      const targetDay = dayMap[settings.day?.toLowerCase() || 'sunday'] ?? 0;
      shouldSend = now.getDay() === targetDay && now.getHours() === settingsHour && now.getMinutes() === settingsMinute;
    }

    if (shouldSend) {
      try {
        const report = await generateWeeklyReport(DB, settings.chat_id);
        await bot.api.sendMessage(settings.chat_id, report);
        console.log(`[CRON] Sent summary to chat=${settings.chat_id}`);
      } catch (error) {
        console.error(`[CRON] Failed to send summary to chat=${settings.chat_id}:`, error);
      }
    }
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/') {
      return new Response('Budget Manager Bot is running!', { status: 200 });
    }

    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const bot = createBot(env);
        const update = await request.json() as any;
        await bot.handleUpdate(update);
        return new Response('OK', { status: 200 });
      } catch (error) {
        console.error('[WEBHOOK] Error:', error);
        return new Response('Error', { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const scheduledTime = new Date(controller.scheduledTime);
    await handleScheduled(env, scheduledTime);
  },
};
