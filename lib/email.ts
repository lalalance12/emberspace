import "server-only";

/**
 * The one email Emberspace sends: a password reset link, through Resend.
 *
 * Email is for getting back into your account and nothing else. Notifications
 * stay in-app (non-negotiable #9) — the bell is the delivery mechanism, and a
 * nudge that also arrived by email would be the inbox this product refuses to
 * become.
 *
 * RESEND_API_KEY and EMAIL_FROM are server-only. Without a key, development
 * prints the link to the server console so the flow can still be walked
 * through; production refuses, because a reset link in a log is a way into
 * somebody's account.
 */
interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail({ to, subject, text, html }: Email) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Emberspace <onboarding@resend.dev>";

  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not set, so the password reset email could not be sent.");
    }
    console.warn(`[email] RESEND_API_KEY is not set. Would have sent "${subject}" to ${to}:\n${text}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text, html }),
  });

  if (!response.ok) {
    // Resend's body names the problem (unverified domain, bad key) without
    // echoing the key, so it is safe to surface in the server log.
    throw new Error(`Resend refused the email (${response.status}): ${await response.text()}`);
  }
}

/** The reset email. Plain words, one link, says what happens if you ignore it. */
export function passwordResetEmail(name: string, url: string): Omit<Email, "to"> {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const text = [
    greeting,
    "",
    "Someone asked to reset the password on your Emberspace account. Choose a new one here:",
    url,
    "",
    "The link works once, for the next hour. If you didn't ask for this, ignore this email and your password stays as it is.",
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;background:#f7f5fb;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#231c3a">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px">
    <p style="font-size:20px;font-weight:700;margin:0 0 24px"><span style="color:#7351d7">ember</span><span style="color:#a996d6">space</span></p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px">${escapeHtml(greeting)}</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 24px">Someone asked to reset the password on your Emberspace account. Choose a new one here:</p>
    <p style="margin:0 0 24px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#7351d7;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">Choose a new password</a></p>
    <p style="font-size:13px;line-height:1.6;color:#6b6385;margin:0">The link works once, for the next hour. If you didn&rsquo;t ask for this, ignore this email and your password stays as it is.</p>
  </div>
</body></html>`;

  return { subject: "Reset your Emberspace password", text, html };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
