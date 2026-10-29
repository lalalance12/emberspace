/**
 * Better Auth's errors carry a code and a terse message, and one of them blames
 * the wrong thing on purpose — INVALID_EMAIL_OR_PASSWORD is what you get for a
 * wrong password AND for an address with no account, so nobody can probe which
 * emails are registered.
 *
 * Same rule as lib/rpc.ts: say what happened and what to do about it. Never a
 * bare apology, and never the raw string when a better one exists.
 */
export type AuthContext = "signin" | "signup" | "password";

interface AuthErrorLike {
  code?: string;
  message?: string;
  status?: number;
}

export function readableAuthError(
  error: AuthErrorLike | string,
  context: AuthContext = "signin",
): string {
  const { code = "", message = "", status } =
    typeof error === "string" ? { message: error } : error;

  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password don't match an account. Check both, or create an account if you don't have one yet.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "That address already has an account. Sign in instead.";
    case "PASSWORD_TOO_SHORT":
      return "That password is too short. Use at least 8 characters.";
    case "PASSWORD_TOO_LONG":
      return "That password is too long. Use 128 characters or fewer.";
    case "INVALID_PASSWORD":
      return context === "password"
        ? "Your current password isn't right. Check it and try again."
        : "That password isn't right. Check it and try again.";
    case "INVALID_EMAIL":
      return "That doesn't look like an email address. Check it and try again.";
    case "CREDENTIAL_ACCOUNT_NOT_FOUND":
      return "This account has no password set. Ask whoever runs the workspace to set one.";
  }

  if (status === 429 || /too many requests|rate limit/i.test(message)) {
    return "Too many attempts in a short time. Wait a minute, then try again.";
  }

  if (/relation .* does not exist/i.test(message)) {
    return "This database has no schema yet. Run pnpm db:migrate against it.";
  }

  return message || "That didn't go through. Try again.";
}
