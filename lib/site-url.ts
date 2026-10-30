/**
 * The canonical origin: where Better Auth falls back to when a request's own
 * host is not one it trusts, and the production domain everything else is
 * measured against. An explicitly configured origin wins and the browser is
 * only the last resort.
 *
 * Set NEXT_PUBLIC_SITE_URL to the canonical production domain. The two Vercel
 * system variables are the fallback, in that order on purpose:
 * NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL is the stable domain, while
 * NEXT_PUBLIC_VERCEL_URL changes with every deployment — fine for a preview,
 * useless in an email.
 */
export function siteURL(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL;

  if (configured) return normalize(configured);
  if (typeof window !== "undefined") return normalize(window.location.origin);

  return "http://localhost:3000";
}

/** Vercel supplies bare hostnames; a trailing slash breaks the allowlist match. */
function normalize(value: string): string {
  const withProtocol = /^https?:\/\//.test(value) ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, "");
}
