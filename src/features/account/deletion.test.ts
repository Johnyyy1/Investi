import { describe, expect, it } from "vitest";
import { ACCOUNT_DELETION_FRESH_SESSION_MS, accountDeletionErrorMessage, accountDeletionRefusal, isFreshForAccountDeletion } from "./deletion";

const now = new Date("2026-10-16T12:00:00.000Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const base = { isAnonymous: false, hasPassword: false, passwordProvided: false, tokenProvided: false, sessionCreatedAt: ago(60_000), now };

describe("accountDeletionRefusal", () => {
  it("refuses guest and demo identities whatever they send", () => {
    expect(accountDeletionRefusal({ ...base, isAnonymous: true })).toBe("ANONYMOUS_IDENTITY");
    expect(accountDeletionRefusal({ ...base, isAnonymous: true, hasPassword: true, passwordProvided: true })).toBe("ANONYMOUS_IDENTITY");
  });

  it("refuses e-mailed deletion tokens, which are not configured", () => {
    expect(accountDeletionRefusal({ ...base, tokenProvided: true })).toBe("DELETION_TOKEN_UNSUPPORTED");
    expect(accountDeletionRefusal({ ...base, hasPassword: true, passwordProvided: true, tokenProvided: true })).toBe("DELETION_TOKEN_UNSUPPORTED");
  });

  it("requires the password of an account that has one, even on a brand-new session", () => {
    expect(accountDeletionRefusal({ ...base, hasPassword: true, sessionCreatedAt: now })).toBe("PASSWORD_REQUIRED");
    // Better Auth verifies the password itself; an old session does not matter once it is given.
    expect(accountDeletionRefusal({ ...base, hasPassword: true, passwordProvided: true, sessionCreatedAt: ago(30 * 24 * 3600_000) })).toBeNull();
  });

  it("lets a social-only account delete only right after signing in", () => {
    expect(accountDeletionRefusal({ ...base, sessionCreatedAt: ago(ACCOUNT_DELETION_FRESH_SESSION_MS - 1) })).toBeNull();
    expect(accountDeletionRefusal({ ...base, sessionCreatedAt: ago(ACCOUNT_DELETION_FRESH_SESSION_MS) })).toBe("SESSION_NOT_FRESH");
    expect(accountDeletionRefusal({ ...base, sessionCreatedAt: ago(23 * 3600_000) })).toBe("SESSION_NOT_FRESH");
  });
});

describe("isFreshForAccountDeletion", () => {
  it("treats a session from the future as not fresh rather than trusting the clock skew", () => {
    expect(isFreshForAccountDeletion(new Date(now.getTime() + 1000), now)).toBe(false);
    expect(isFreshForAccountDeletion(now, now)).toBe(true);
  });
});

describe("accountDeletionErrorMessage", () => {
  it("maps Better Auth and guard codes to recoverable copy", () => {
    expect(accountDeletionErrorMessage("INVALID_PASSWORD")).toMatch(/Heslo nesouhlasí/);
    expect(accountDeletionErrorMessage("SESSION_EXPIRED")).toMatch(/znovu přihlas/);
    expect(accountDeletionErrorMessage("SESSION_NOT_FRESH")).toMatch(/znovu přihlas/);
    expect(accountDeletionErrorMessage(undefined, 429)).toMatch(/Příliš mnoho/);
    expect(accountDeletionErrorMessage("SOMETHING_ELSE", 500)).toMatch(/Nic se nezměnilo/);
  });
});
