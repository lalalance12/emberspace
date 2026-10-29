import { createAuthClient } from "better-auth/react";

/**
 * The browser half of lib/auth.ts. Talks to /api/auth on whatever origin the
 * page is on, so previews and localhost work without configuration.
 */
export const authClient = createAuthClient();
