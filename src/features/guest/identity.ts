/** Anonymous identities come in two kinds. A demo gets seeded sample progress and open Lab access;
 * a guest is a real learner who has not saved an account yet and starts empty. */
export const GUEST_KIND_HEADER = "x-investi-anonymous-kind";
export type AnonymousKind = "demo" | "guest";
type Identity = { isAnonymous?: boolean | null; anonymousKind?: string | null };

export const isGuestIdentity = (identity: Identity) => identity.isAnonymous === true && identity.anonymousKind === "guest";
/** Anonymous rows created before guests existed have no kind and remain demos. */
export const isDemoIdentity = (identity: Identity) => identity.isAnonymous === true && identity.anonymousKind !== "guest";

export const GUEST_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
export const DEMO_SESSION_MS = 24 * 60 * 60 * 1000;
