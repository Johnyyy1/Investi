import { describe, expect, it } from "vitest";
import { EMAIL_VERIFICATION_TOKEN_SECONDS, passwordResetEmail, PASSWORD_RESET_TOKEN_SECONDS, verificationEmail } from "./templates";

const url = "https://investi.test/api/auth/reset-password/abc?callbackURL=%2Freset-password&x=<b>\"";

describe("transactional e-mail templates", () => {
  it("keeps reset links short-lived and verification links within a day", () => {
    expect(PASSWORD_RESET_TOKEN_SECONDS).toBe(30 * 60);
    expect(EMAIL_VERIFICATION_TOKEN_SECONDS).toBe(24 * 60 * 60);
  });

  it("renders the reset e-mail in Czech with the link, its lifetime and a safe way to ignore it", () => {
    const email = passwordResetEmail({ to: "learner@example.com", url });
    expect(email).toMatchObject({ kind: "password-reset", to: "learner@example.com", subject: "Obnovení hesla k účtu investi" });
    expect(email.text).toContain(url);
    expect(email.text).toContain("30 minut");
    expect(email.text).toContain("jen jednou");
    expect(email.text).toContain("e-mail ignoruj");
  });

  it("renders the verification e-mail with its lifetime", () => {
    const email = verificationEmail({ to: "learner@example.com", url: "https://investi.test/api/auth/verify-email?token=t" });
    expect(email).toMatchObject({ kind: "email-verification", subject: "Ověř svůj e-mail pro investi" });
    expect(email.text).toContain("https://investi.test/api/auth/verify-email?token=t");
    expect(email.text).toContain("24 hodin");
  });

  it("escapes the link inside the HTML body", () => {
    const { html } = passwordResetEmail({ to: "learner@example.com", url });
    expect(html).not.toContain("<b>");
    expect(html).toContain('href="https://investi.test/api/auth/reset-password/abc?callbackURL=%2Freset-password&amp;x=&lt;b&gt;&quot;"');
    expect(html).toContain('<html lang="cs">');
  });
});
