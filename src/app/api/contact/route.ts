import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { contactMessages } from '@/db/schema';
import { sendContactNotification } from '@/services/notify/telegram';

const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(5000),
  website: z.string().max(100).optional(), // Honeypot
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const json = await req.json();
    const parsed = contactSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid submission fields' }, { status: 400 });
    }

    // Honeypot check: bot filled out the hidden field
    if (parsed.data.website && parsed.data.website.length > 0) {
      return NextResponse.json({ success: true });
    }

    const db = getDb();
    await db.insert(contactMessages).values({
      name: parsed.data.name,
      email: parsed.data.email,
      subject: parsed.data.subject,
      message: parsed.data.message,
      status: 'new',
    });

    // Send Telegram alert in background (silent error handling)
    sendContactNotification({
      name: parsed.data.name,
      email: parsed.data.email,
      subject: parsed.data.subject,
      message: parsed.data.message,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to save contact message:', err);
    return NextResponse.json({ error: 'Failed to submit transmission' }, { status: 500 });
  }
}
