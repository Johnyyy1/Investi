/** Tab-scoped hints only; neither addresses nor tokens belong in navigation URLs. Storage may be disabled. */
const EMAIL_KEY = "investi:recovery-email:v1";
export function rememberRecoveryEmail(email: string) { try { sessionStorage.setItem(EMAIL_KEY, email); } catch {} }
export function readRecoveryEmail() { try { return sessionStorage.getItem(EMAIL_KEY) ?? ""; } catch { return ""; } }
