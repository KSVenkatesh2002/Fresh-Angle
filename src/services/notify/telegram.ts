import { fetchWithRetry } from "@/lib/utils/http";
import { siteConfig } from "@/config/site";

export interface TelegramOptions {
  disableNotification?: boolean;
}

export async function sendTelegramMessage(
  text: string,
  options: TelegramOptions = {},
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const threadId = process.env.TELEGRAM_THREAD_ID;

  if (!token || !chatId) {
    return false;
  }

  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: false,
      disable_notification: options.disableNotification ?? false,
    };

    if (threadId) {
      body.message_thread_id = parseInt(threadId, 10);
    }

    const res = await fetchWithRetry(
      endpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        timeoutMs: 10000,
      },
      { retries: 2, backoffMs: 1000 },
    );

    return res.ok;
  } catch (err: unknown) {
    console.warn(`⚠️ [Telegram] Exception: ${(err as Error).message}`);
    return false;
  }
}

export async function sendPostPublishedNotification(notif: {
  title: string;
  url: string;
  category: string;
  provider: string;
  model: string;
  readingTimeMin?: number;
  warnings?: string[];
}): Promise<boolean> {
  let text =
    `[${siteConfig.name}] ✅ <b>Post Published</b>\n\n` +
    `📰 <a href="${notif.url}">${notif.title}</a>\n` +
    `📁 Track: ${notif.category}\n` +
    `🤖 Model: ${notif.provider} (${notif.model})\n` +
    (notif.readingTimeMin
      ? `⏱️ Reading Time: ${notif.readingTimeMin} min\n`
      : "") +
    `🔗 ${notif.url}`;

  if (notif.warnings && notif.warnings.length > 0) {
    text +=
      `\n\n⚠️ <b>Warnings:</b>\n` +
      notif.warnings.map((w) => `• ${w}`).join("\n");
  }

  return sendTelegramMessage(text, { disableNotification: true });
}

export async function sendPipelineFailureNotification(
  error: Error | string,
  step?: string,
): Promise<boolean> {
  const errorMsg = typeof error === "string" ? error : error.message;
  const text =
    `[${siteConfig.name}] ❌ <b>Pipeline Failure</b>\n\n` +
    (step ? `📍 Step: ${step}\n` : "") +
    `<code>${errorMsg.slice(0, 1000)}</code>`;

  return sendTelegramMessage(text, { disableNotification: false });
}

export async function sendContactNotification(contact: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<boolean> {
  const text =
    `[${siteConfig.name}] 📨 <b>New Contact Transmission</b>\n\n` +
    `👤 <b>From:</b> ${contact.name} (${contact.email})\n` +
    `📌 <b>Subject:</b> ${contact.subject}\n\n` +
    `💬 ${contact.message.slice(0, 500)}`;

  return sendTelegramMessage(text);
}
