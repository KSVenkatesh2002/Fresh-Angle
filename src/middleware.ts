import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'freshangle_session';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Only handle /admin paths
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  // Ensure search engines never index admin pages
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');

  // Allow unauthenticated access to /admin/login
  if (pathname === '/admin/login') {
    return response;
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!token || !sessionSecret) {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const secretKey = new TextEncoder().encode(sessionSecret);
    const { payload } = await jwtVerify(token, secretKey);

    if (payload.role !== 'admin') {
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  } catch {
    const loginUrl = new URL('/admin/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/admin/:path*'],
};
