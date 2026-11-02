import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { setSessionCookie } from "@/lib/auth/session";

// In-memory rate limiting store (IP -> { count, resetTime })
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 }); // 15 mins window
    return true;
  }

  if (entry.count >= 5) {
    return false; // Rate limit exceeded (5 attempts)
  }

  entry.count++;
  return true;
}

function secureCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown-ip";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      {
        error:
          "Too many login attempts. Please wait 15 minutes before trying again.",
      },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const password = body.password as string | undefined;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return NextResponse.json(
        { error: "Server misconfiguration: ADMIN_PASSWORD is not set" },
        { status: 500 },
      );
    }

    if (!password || !secureCompare(password, adminPassword)) {
      return NextResponse.json(
        { error: "Invalid administrator credentials" },
        { status: 401 },
      );
    }

    // Set signed httpOnly session cookie
    await setSessionCookie();

    return NextResponse.json({ success: true, redirectUrl: "/admin" });
  } catch (error) {
    return NextResponse.json(
      { error: `Login error: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}
