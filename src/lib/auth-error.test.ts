import { describe, expect, it } from "vitest";
import { getAuthErrorMessage } from "./auth-error";
import { getSocialAuthErrorMessage } from "./social-auth-error";

describe("getAuthErrorMessage", () => {
  it("explains duplicate email registration", () => {
    expect(getAuthErrorMessage({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" }, "Fallback")).toBe(
      "Pro tento e-mail už účet existuje. Přihlas se.",
    );
  });

  it("does not reveal whether an invalid sign-in email exists", () => {
    expect(getAuthErrorMessage({ code: "USER_NOT_FOUND" }, "Fallback")).toBe("E-mail nebo heslo není správně.");
    expect(getAuthErrorMessage({ code: "INVALID_PASSWORD" }, "Fallback")).toBe("E-mail nebo heslo není správně.");
  });

  it("explains a rate-limited attempt in Czech instead of Better Auth's English message", () => {
    expect(getAuthErrorMessage({ status: 429, message: "Too many requests. Please try again later." }, "Fallback")).toBe(
      "Příliš mnoho pokusů za krátkou dobu. Počkej chvíli a zkus to znovu.",
    );
  });

  it("explains an expired or used reset link and an over-long password", () => {
    expect(getAuthErrorMessage({ code: "INVALID_TOKEN" }, "Fallback")).toBe("Odkaz už neplatí. Požádej o nový.");
    expect(getAuthErrorMessage({ code: "TOKEN_EXPIRED" }, "Fallback")).toBe("Odkaz už neplatí. Požádej o nový.");
    expect(getAuthErrorMessage({ code: "PASSWORD_TOO_LONG" }, "Fallback")).toBe("Heslo může mít nejvýše 128 znaků.");
  });

  it("uses the service message for unexpected errors", () => {
    expect(getAuthErrorMessage({ message: "Service unavailable" }, "Fallback")).toBe("Service unavailable");
  });

  it("makes an existing account actionable after an unlinked social sign-in", () => {
    expect(getSocialAuthErrorMessage("account_not_linked")).toBe(
      "Účet s tímto e-mailem už existuje. Přihlas se původním způsobem a v Nastavení si Google nebo Facebook připoj.",
    );
  });
});
