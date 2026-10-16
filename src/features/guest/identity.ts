/** Anonymous identities come in two kinds. A demo gets seeded sample progress and open Lab access;
 * a guest is a real learner who has not saved an account yet and starts empty. */
export const GUEST_KIND_HEADER = "x-investi-anonymous-kind";
type Identity = { isAnonymous?: boolean | null; anonymousKind?: string | null };

export const isGuestIdentity = (identity: Identity) => identity.isAnonymous === true && identity.anonymousKind === "guest";
/** Anonymous rows created before guests existed have no kind and remain demos. */
export const isDemoIdentity = (identity: Identity) => identity.isAnonymous === true && identity.anonymousKind !== "guest";

/** A guest session extends while it is used, like any account's. */
export const GUEST_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
/** A demo is one-time: its session ends this long after it started, however often it is used. */
export const DEMO_SESSION_MS = 24 * 60 * 60 * 1000;

/** Better Auth extends a session while it is used; for a demo the extension never passes the demo's end. */
export function demoSessionExpiry(sessionCreatedAt: Date, requestedExpiresAt: Date) {
  const end = new Date(sessionCreatedAt.getTime() + DEMO_SESSION_MS);
  return requestedExpiresAt < end ? requestedExpiresAt : end;
}
