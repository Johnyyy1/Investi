type AuthError = {
  code?: string;
  message?: string;
  status?: number;
} | null | undefined;

export const TOO_MANY_ATTEMPTS_MESSAGE = "Příliš mnoho pokusů za krátkou dobu. Počkej chvíli a zkus to znovu.";

export function getAuthErrorMessage(error: AuthError, fallback: string) {
  if (error?.status === 429) return TOO_MANY_ATTEMPTS_MESSAGE;
  switch (error?.code) {
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Pro tento e-mail už účet existuje. Přihlas se.";
    case "USER_NOT_FOUND":
    case "INVALID_PASSWORD":
    case "INVALID_EMAIL_OR_PASSWORD":
      return "E-mail nebo heslo není správně.";
    case "INVALID_EMAIL":
      return "Zadej platný e-mail.";
    case "PASSWORD_TOO_SHORT":
      return "Použij heslo dlouhé alespoň 8 znaků.";
    case "PASSWORD_TOO_LONG":
      return "Heslo může mít nejvýše 128 znaků.";
    case "INVALID_TOKEN":
    case "TOKEN_EXPIRED":
      return "Odkaz už neplatí. Požádej o nový.";
    default:
      return error?.message ?? fallback;
  }
}
