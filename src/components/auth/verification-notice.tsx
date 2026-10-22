"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Notice = { email: string; path: string };
const EVENT = "investi:verification-notice";
export function rememberVerificationNotice(email: string, path: string) {
  window.dispatchEvent(new CustomEvent<Notice>(EVENT, { detail: { email, path } }));
}
/** One quiet acknowledgment after account creation, cleared by the next navigation or reload. */
export function VerificationNotice() {
  const pathname = usePathname();
  const [notice, setNotice] = useState<Notice>();
  useEffect(() => {
    const receive = (event: Event) => setNotice((event as CustomEvent<Notice>).detail);
    window.addEventListener(EVENT, receive);
    return () => window.removeEventListener(EVENT, receive);
  }, []);
  return notice?.path === pathname ? <p role="status" className="mx-auto max-w-6xl px-5 py-3 text-small text-secondary [overflow-wrap:anywhere]">Na {notice.email} jsme poslali ověřovací odkaz.</p> : null;
}
