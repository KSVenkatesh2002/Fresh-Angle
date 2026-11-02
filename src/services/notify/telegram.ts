import { fetchWithRetry } from '@/lib/utils/http';

export interface TelegramPostNotification {
  title: string;
  url: string;
  category: string;
  provider: string;
  model: string;
  readingTimeMin: number;
  warnings?: string[];
}

export async function sendTelegramMessage(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('⚠️ [Telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured. Skipping alert.');
    return false;
  }

  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetchWithRetry(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        }),
        timeoutMs: 10000,
      },
      { retries: 2, backoffMs: 1000 }
    );

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.warn(`⚠️ [Telegram] Failed to send notification (${res.status}): ${err}`);
      return false;
    }

    console.log('✓ [Telegram] Notification sent successfully');
    return true;
  } catch (err: unknown) {
    console.warn(`⚠️ [Telegram] Exception while sending notification: ${(err as Error).message}`);
    return false;
  }
}

export async function sendPostPublishedNotification(
  notif: TelegramPostNotification
): Promise<boolean> {
  let message = `🚀 <b>New Post Published on Fresh Angle!</b>\n\n`;
  message += `📰 <b>Title:</b> <a href="${notif.url}">${notif.title}</a>\n`;
  message += `📁 <b>Category:</b> ${notif.category}\n`;
  message += `⏱️ <b>Reading Time:</b> ${notif.readingTimeMin} min\n`;
  message += `🤖 <b>AI Engine:</b> ${notif.provider} (${notif.model})\n\n`;
  message += `🔗 <b>Read here:</b> ${notif.url}`;

  if (notif.warnings && notif.warnings.length > 0) {
    message += `\n\n⚠️ <b>Pipeline Warnings:</b>\n`;
    notif.warnings.forEach((w) => {
      message += `• ${w}\n`;
    });
  }

  return sendTelegramMessage(message);
}

export async function sendPipelineFailureNotification(
  error: Error | string,
  step?: string
): Promise<boolean> {
  const errorMsg = typeof error === 'string' ? error : error.message;
  let message = `❌ <b>Fresh Angle Pipeline Failure!</b>\n\n`;
  if (step) {
    message += `📍 <b>Failed Step:</b> ${step}\n`;
  }
  message += `⚠️ <b>Error Details:</b>\n<code>${errorMsg.slice(0, 1000)}</code>\n\n`;
  message += `⏰ Time: ${new Date().toISOString()}`;

  return sendTelegramMessage(message);
}
