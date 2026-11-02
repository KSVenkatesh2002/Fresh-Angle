import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "freshangle_session";

export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);

  return NextResponse.redirect(
    new URL("/admin/login", process.env.SITE_URL || "http://localhost:3000"),
    {
      status: 303,
    },
  );
}
