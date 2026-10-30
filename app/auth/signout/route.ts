import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";

/**
 * Signing out.
 *
 * A route handler rather than a click handler that calls signOut() in the
 * browser, because the session lives in cookies that the server writes. Ending
 * it on the server means the Set-Cookie that clears them rides back on this
 * very response, and the next request — already in flight to /login — is
 * unauthenticated for certain. Doing it client-side leaves a window where the
 * browser has dropped its copy but the server has not, and a refresh in that
 * window signs you back in.
 *
 * POST only. A GET would let any <img src="/auth/signout"> on any page in any
 * tab sign the person out, and browsers prefetch links.
 */
export async function POST(request: NextRequest) {
  // Ends this browser's session only and leaves the person's phone signed in.
  // Signing every device out belongs behind a deliberate "sign out
  // everywhere", not behind the button in the account menu.
  //
  // Idempotent: signing out when already signed out is a no-op that still ends
  // at /login, which is where someone pressing the button wants to be.
  const result = await auth.api
    .signOut({ headers: request.headers, asResponse: true })
    .catch(() => null);

  // Built from the request origin, not the configured site URL: the cookies
  // being cleared belong to the host the person is actually on.
  const response = NextResponse.redirect(new URL("/login", request.nextUrl.origin), {
    // 303, so the browser follows with GET instead of re-POSTing to /login.
    status: 303,
  });

  // Carry Better Auth's cookie-clearing headers onto the redirect.
  for (const cookie of result?.headers.getSetCookie() ?? []) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}
