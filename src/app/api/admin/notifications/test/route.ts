import { NextResponse } from "next/server";
import { z } from "zod";
import { sendTelegramMessage } from "@/services/notify/telegram";
import { getNotificationSettings } from "@/services/notify/settings";
import { siteConfig } from "@/config/site";

const testSchema = z.object({
  target: z.enum(["admin", "public_channel"]),
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json();
    const parsed = testSchema.parse(body);
    const settings = await getNotificationSettings();

    if (parsed.target === "public_channel") {
      const channelId = settings.publicChannelId?.trim() || process.env.TELEGRAM_PUBLIC_CHANNEL_ID;
      if (!channelId) {
        return NextResponse.json(
          { error: "No public channel ID or username configured. Please enter @channel or chat ID first." },
          { status: 400 },
        );
      }

      const isSilent = settings.publicChannelSound === "silent";
      const testText =
        `[${siteConfig.name}] 🔔 <b>Telegram Sound & Alert Test</b>\n\n` +
        `This is a test notification to verify delivery and sound alert in this channel/group.\n\n` +
        `📢 <b>Sound Mode:</b> ${isSilent ? "Silent (No Ring)" : "Loud (With Sound)"}\n` +
        `⏱️ <b>Time:</b> ${new Date().toLocaleTimeString()} IST`;

      const success = await sendTelegramMessage(testText, {
        chatId: channelId,
        disableNotification: isSilent,
      });

      if (!success) {
        return NextResponse.json(
          { error: `Failed to deliver test message to ${channelId}. Check bot admin permissions.` },
          { status: 502 },
        );
      }

      return NextResponse.json({
        success: true,
        message: `Test alert sent successfully to ${channelId} (${isSilent ? "Silent" : "Loud / Sound"}).`,
      });
    }

    // Admin direct test
    const success = await sendTelegramMessage(
      `[${siteConfig.name}] 🔔 <b>Admin Alert Test</b>\n\n` +
      `Delivery verified to admin channel.\n` +
      `⏱️ <b>Time:</b> ${new Date().toLocaleTimeString()} IST`,
      { disableNotification: false },
    );

    if (!success) {
      return NextResponse.json(
        { error: "Failed to send test message to admin TELEGRAM_CHAT_ID." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Test alert delivered to admin chat successfully.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 },
    );
  }
}
