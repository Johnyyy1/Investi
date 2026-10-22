import { BRAND_NAME, SITE_HOST, SITE_URL } from "@/lib/site";
import type { EmailMessage } from "./transport";

/** Reset links are single-use and short-lived; the copy and the Better Auth option read the same value. */
export const PASSWORD_RESET_TOKEN_SECONDS = 30 * 60;
/** Verification proves the address only; a day leaves time to open the mailbox without weakening it. */
export const EMAIL_VERIFICATION_TOKEN_SECONDS = 24 * 60 * 60;

// E-mail clients ignore CSS variables, so the brand anchors from src/styles/tokens.css are inlined here.
const palette = { paper: "#F7F2E8", surface: "#FFFCF7", ink: "#171717", secondary: "#41443E", action: "#236F66", onAction: "#FFFFFF" } as const;

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function layout({ heading, intro, action, url, note }: { heading: string; intro: string; action: string; url: string; note: string }) {
  const href = escapeHtml(url);
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:24px 16px;background:${palette.paper};color:${palette.ink};font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.5">
<div style="max-width:520px;margin:0 auto;background:${palette.surface};border-radius:16px;padding:32px 24px">
<p style="margin:0 0 24px;font-family:Manrope,Arial,sans-serif;font-size:22px;font-weight:800;letter-spacing:-0.02em">${BRAND_NAME}</p>
<h1 style="margin:0 0 12px;font-family:Manrope,Arial,sans-serif;font-size:24px;line-height:1.25">${escapeHtml(heading)}</h1>
<p style="margin:0 0 24px">${escapeHtml(intro)}</p>
<p style="margin:0 0 24px"><a href="${href}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:${palette.action};color:${palette.onAction};font-weight:700;text-decoration:none">${escapeHtml(action)}</a></p>
<p style="margin:0 0 8px;color:${palette.secondary};font-size:14px">Pokud tlačítko nefunguje, zkopíruj tento odkaz do prohlížeče:</p>
<p style="margin:0 0 24px;font-size:14px;word-break:break-all"><a href="${href}" style="color:${palette.action}">${href}</a></p>
<p style="margin:0;color:${palette.secondary};font-size:14px">${escapeHtml(note)}</p>
</div>
<p style="max-width:520px;margin:16px auto 0;color:${palette.secondary};font-size:12px;text-align:center">${BRAND_NAME} · <a href="${SITE_URL}" style="color:${palette.secondary}">${SITE_HOST}</a> · Vzdělávání, ne investiční doporučení.</p>
</body></html>`;
}

function text({ heading, intro, url, note }: { heading: string; intro: string; url: string; note: string }) {
  return `${heading}\n\n${intro}\n\n${url}\n\n${note}\n\n— ${BRAND_NAME}\n${SITE_URL}`;
}

export function passwordResetEmail({ to, url }: { to: string; url: string }): EmailMessage {
  const minutes = PASSWORD_RESET_TOKEN_SECONDS / 60;
  const content = {
    heading: "Nastav si nové heslo",
    intro: `Přišla nám žádost o obnovení hesla k účtu v Investníku pro tuto adresu. Odkaz platí ${minutes} minut a dá se použít jen jednou.`,
    action: "Nastavit nové heslo",
    url,
    note: "Pokud žádost nepochází od tebe, e-mail ignoruj. Heslo zůstane beze změny.",
  };
  return { kind: "password-reset", to, subject: "Obnovení hesla k účtu investi", text: text(content), html: layout(content) };
}

export function verificationEmail({ to, url }: { to: string; url: string }): EmailMessage {
  const hours = EMAIL_VERIFICATION_TOKEN_SECONDS / 3600;
  const content = {
    heading: "Ověř svůj e-mail",
    intro: `Potvrď, že adresa patří tobě. Pomůže to, až si budeš potřebovat obnovit heslo. Odkaz platí ${hours} hodin.`,
    action: "Ověřit e-mail",
    url,
    note: "Pokud sis účet v Investníku nezakládáš, e-mail ignoruj. Bez ověření se nic nezmění.",
  };
  return { kind: "email-verification", to, subject: "Ověř svůj e-mail pro Investník", text: text(content), html: layout(content) };
}

export function passwordChangedEmail({ to, origin, at = new Date() }: { to: string; origin: string; at?: Date }): EmailMessage {
  const time = new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", dateStyle: "long", timeStyle: "short" }).format(at);
  const content = {
    heading: "Heslo k účtu investi bylo změněno",
    intro: `Ke změně hesla došlo ${time} (Europe/Prague).`,
    action: "Nepoznáváš tuto změnu? Obnov si heslo",
    url: new URL("/forgot-password", origin).href,
    note: "Pokud změna pochází od tebe, není potřeba nic dělat.",
  };
  return { kind: "password-changed", to, subject: content.heading, text: text(content), html: layout(content) };
}
