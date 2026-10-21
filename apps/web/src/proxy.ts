import { type NextRequest, NextResponse } from 'next/server';

// UX only: the real protection is the API. `logged_in` is a non-secret marker set next to the
// httpOnly tokens (docs/spec/auth.md), needed because refresh_token never reaches page URLs.
const PUBLIC_PAGES = ['/accounts/login', '/accounts/emailsignup'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const loggedIn = request.cookies.has('logged_in');
  const isPublic = PUBLIC_PAGES.includes(pathname);

  if (!loggedIn && !isPublic) {
    return NextResponse.redirect(new URL('/accounts/login', request.url));
  }
  if (loggedIn && isPublic) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip the API proxy, Next internals and files with an extension (icons, sw.js, images)
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
