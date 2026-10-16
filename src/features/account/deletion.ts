/**
 * Who may delete their account, and what they must prove first. Pure, so the Better Auth hook and the
 * Settings screen share one rule.
 *
 * - Only saved accounts. Guest and demo identities have no login to protect and are removed by the
 *   daily anonymous cleanup once their sessions end.
 * - An account with a password confirms with it; Better Auth then verifies the hash.
 * - An account that signs in only through Google or Facebook has no password, so it must have signed in
 *   within the last few minutes. Better Auth's own fallback accepts a session up to a day old, which is
 *   far too long for an irreversible deletion on a shared or unlocked device.
 * - E-mailed deletion links are not configured, so a token is refused rather than looked up.
 */
export const ACCOUNT_DELETION_FRESH_SESSION_MS = 10 * 60 * 1000;

export type AccountDeletionRefusal = "ANONYMOUS_IDENTITY" | "DELETION_TOKEN_UNSUPPORTED" | "PASSWORD_REQUIRED" | "SESSION_NOT_FRESH";

export function accountDeletionRefusal({ isAnonymous, hasPassword, passwordProvided, tokenProvided, sessionCreatedAt, now = new Date() }: {
  isAnonymous: boolean; hasPassword: boolean; passwordProvided: boolean; tokenProvided: boolean; sessionCreatedAt: Date; now?: Date;
}): AccountDeletionRefusal | null {
  if (isAnonymous) return "ANONYMOUS_IDENTITY";
  if (tokenProvided) return "DELETION_TOKEN_UNSUPPORTED";
  if (hasPassword) return passwordProvided ? null : "PASSWORD_REQUIRED";
  return isFreshForAccountDeletion(sessionCreatedAt, now) ? null : "SESSION_NOT_FRESH";
}

export function isFreshForAccountDeletion(sessionCreatedAt: Date, now = new Date()) {
  const age = now.getTime() - sessionCreatedAt.getTime();
  return age >= 0 && age < ACCOUNT_DELETION_FRESH_SESSION_MS;
}

/** Learner-facing copy for every way a deletion can be refused or fail. */
export function accountDeletionErrorMessage(code?: string, status?: number) {
  switch (code?.toUpperCase()) {
    case "INVALID_PASSWORD": return "Heslo nesouhlasí. Zkus to znovu.";
    case "PASSWORD_REQUIRED": return "Pro smazání účtu zadej své heslo.";
    case "SESSION_NOT_FRESH":
    case "SESSION_EXPIRED": return "Z bezpečnostních důvodů se nejdřív znovu přihlas a pak účet smaž.";
    case "ANONYMOUS_IDENTITY": return "Tento profil nemá uložený účet. Smaže se automaticky po skončení relace.";
    default: break;
  }
  if (status === 401) return "Relace skončila. Přihlas se znovu.";
  if (status === 429) return "Příliš mnoho pokusů. Počkej chvíli a zkus to znovu.";
  return "Účet se nepodařilo smazat. Nic se nezměnilo, zkus to znovu.";
}
