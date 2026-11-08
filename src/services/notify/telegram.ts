import { fetchWithRetry } from "@/lib/utils/http";
import { siteConfig } from "@/config/site";
import { getNotificationSettings } from "@/services/notify/settings";

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
  triggerSource?: string;
  slotTime?: string;
  readingTimeMin?: number;
  warnings?: string[];
}): Promise<boolean> {
  const settings = await getNotificationSettings();
  if (settings.postPublished === "disabled") {
    return true;
  }

  const triggerLabel = notif.triggerSource === "scheduled"
    ? `⏰ Scheduled Slot${notif.slotTime ? ` (${notif.slotTime})` : ""}`
    : notif.triggerSource === "manual"
      ? `⚡ Manual Admin Trigger (Generate Now)`
      : notif.triggerSource || "Autonomous Automation";

  let text =
    `[${siteConfig.name}] ✅ <b>Post Published</b>\n\n` +
    `📰 <a href="${notif.url}">${notif.title}</a>\n` +
    `🎯 <b>Trigger:</b> ${triggerLabel}\n` +
    `📁 <b>Track:</b> ${notif.category}\n` +
    `🤖 <b>Model:</b> ${notif.provider} (${notif.model})\n` +
    (notif.readingTimeMin
      ? `⏱️ <b>Reading Time:</b> ${notif.readingTimeMin} min\n`
      : "") +
    `🔗 ${notif.url}`;

  if (notif.warnings && notif.warnings.length > 0) {
    text +=
      `\n\n⚠️ <b>Warnings:</b>\n` +
      notif.warnings.map((w) => `• ${w}`).join("\n");
  }

  const isSilent = settings.postPublished === "silent";
  return sendTelegramMessage(text, { disableNotification: isSilent });
}

export async function sendPipelineFailureNotification(
  error: Error | string,
  step?: string,
  triggerSource?: string,
): Promise<boolean> {
  const settings = await getNotificationSettings();
  if (settings.pipelineFailure === "disabled") {
    return true;
  }

  const errorMsg = typeof error === "string" ? error : error.message;
  const triggerLabel = triggerSource === "scheduled"
    ? "⏰ Scheduled Slot"
    : triggerSource === "manual"
      ? "⚡ Manual Trigger (Generate Now)"
      : triggerSource || "Autonomous Pipeline";

  const text =
    `[${siteConfig.name}] ❌ <b>Pipeline Failure</b>\n\n` +
    `🎯 <b>Trigger:</b> ${triggerLabel}\n` +
    (step ? `📍 <b>Failed Step:</b> ${step}\n\n` : "\n") +
    `<b>Error Details:</b>\n<pre>${errorMsg.slice(0, 3000)}</pre>`;

  const isSilent = settings.pipelineFailure === "silent";
  return sendTelegramMessage(text, { disableNotification: isSilent });
}

export async function sendContactNotification(contact: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<boolean> {
  const settings = await getNotificationSettings();
  if (settings.contactFormAlerts === "disabled") {
    return true;
  }

  const text =
    `[${siteConfig.name}] 📨 <b>New Contact Transmission</b>\n\n` +
    `👤 <b>From:</b> ${contact.name} (${contact.email})\n` +
    `📌 <b>Subject:</b> ${contact.subject}\n\n` +
    `💬 ${contact.message.slice(0, 500)}`;

  const isSilent = settings.contactFormAlerts === "silent";
  return sendTelegramMessage(text, { disableNotification: isSilent });
}

export async function sendDatabaseStorageAlert(params: {
  usedBytes: number;
  limitBytes: number;
  percent: number;
  threshold: 70 | 90;
  topTables: Array<{ tableName: string; totalSize: string }>;
}): Promise<boolean> {
  const settings = await getNotificationSettings();
  if (settings.dbStorageAlerts === "disabled") {
    return true;
  }

  const usedMb = (params.usedBytes / (1024 * 1024)).toFixed(1);
  const limitMb = (params.limitBytes / (1024 * 1024)).toFixed(0);
  const levelEmoji = params.threshold >= 90 ? "🚨" : "⚠️";

  let text =
    `[${siteConfig.name}] ${levelEmoji} <b>Neon Database Storage Alert: ${params.percent}% Used</b>\n\n` +
    `💾 <b>Disk Utilization:</b> ${usedMb} MB / ${limitMb} MB (${params.percent}% of 0.5 GB free tier)\n` +
    `⚠️ <b>Threshold Triggered:</b> ${params.threshold}%\n\n` +
    `<b>Top Tables by Footprint:</b>\n`;

  params.topTables.slice(0, 5).forEach((t) => {
    text += `• <code>${t.tableName}</code>: ${t.totalSize}\n`;
  });

  const isSilent = settings.dbStorageAlerts === "silent";
  return sendTelegramMessage(text, { disableNotification: isSilent });
}
