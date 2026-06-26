import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight gate: bounce unauthenticated users to /login before they reach
 * protected pages. We only check for the presence of the session cookie here
 * (Edge runtime); full verification happens in server components via requireUser.
 */
const PUBLIC_PATHS = ["/login", "/register"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has("arabic_session");

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!hasSession && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (hasSession && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except API routes, static files, and Next internals.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
