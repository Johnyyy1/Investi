import { describe, expect, it, vi } from "vitest";
import { checkEmailDomain } from "./check";

const config = { apiKey: "secret", from: "investi <ucet@mail.investnik.cz>" };
const verified = { id: "d1", name: "mail.investnik.cz", status: "verified" };

describe("email:check", () => {
  it("requires an exact verified sender domain, making only a read request", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ data: [verified] }));
    await checkEmailDomain({ ...config, fetch });
    expect(fetch.mock.calls[0][0].toString()).toBe("https://api.resend.com/domains");
    expect(fetch.mock.calls[0][1]?.method).toBeUndefined();
  });
  it.each([{ data: [{ ...verified, status: "pending" }] }, { data: [{ ...verified, name: "investnik.cz" }] }, { data: [] }])("fails for unverified, absent or parent-only domains", async ({ data }) => {
    await expect(checkEmailDomain({ ...config, fetch: async () => Response.json({ data }) })).rejects.toThrow(/not verified|not found/);
  });
  it("follows pagination", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ data: [{ ...verified, id: "first", name: "other.cz" }], has_more: true }))
      .mockResolvedValueOnce(Response.json({ data: [verified], has_more: false }));
    await checkEmailDomain({ ...config, fetch });
    expect(fetch.mock.calls[1][0].toString()).toContain("after=first");
  });
  it("sanitizes upstream, network and malformed response failures", async () => {
    for (const fetch of [async () => new Response("secret ucet@mail.investnik.cz", { status: 403 }), async () => { throw new Error("secret"); }, async () => Response.json({ secret: "private" })]) {
      await expect(checkEmailDomain({ ...config, fetch })).rejects.not.toThrow(/secret|ucet@|private/);
    }
  });
});
