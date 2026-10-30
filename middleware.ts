import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Routes reachable without a session.
 *
 * "/" is matched exactly, never as a prefix — the check below is `=== p` or
 * `startsWith(p + "/")`, and for "/" the second test is `startsWith("//")`,
 * which no real path satisfies. So the landing page is public and nothing
 * beneath it leaks. /api/auth is Better Auth's own endpoints.
 */
const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth", "/api/auth"];

/**
 * Sends signed-out visitors to /login.
 *
 * This only checks that a session cookie is present — it does not ask the
 * database, so it stays fast and never wakes Neon for a static redirect. The
 * real check is getViewer() in the (app) layout, which validates the session
 * and reads the profile under RLS. A forged or expired cookie gets past here
 * and is sent back to /login from there.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!hasSession && !isPublic) return redirectTo("/login", request);

  // Signed-in visitors are sent from /login and /signup to /board by those
  // pages, not here: only they validate the session. Redirecting on the
  // cookie alone would trap someone holding an expired one in a loop between
  // /login and /board.
  return NextResponse.next();
}

function redirectTo(pathname: string, request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files. Redirects only matter
     * on real navigations, not on every .svg.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
