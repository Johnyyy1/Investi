import type { ArtifactKind } from "./schemas";

export const artifactLabels: Record<ArtifactKind, string> = {
  goal_map: "Mapa cílů",
  financial_checkup: "Finanční check-up",
  fee_profile: "Profil poplatků",
  etf_checklist: "Checklist ETF",
  safeguards: "Osobní pojistky",
  investment_plan: "Investiční plán (IPS)",
  trade_checklist: "Checklist před obchodem",
  business_map: "Mapa byznysu",
  investment_thesis: "Investiční teze",
  journal: "Investiční deník",
};

export const artifactConsentText = "Souhlasím s uložením tohoto výstupu do svého profilu pro navazující lekce a plán. Ukládají se i předchozí verze. V Nastavení → Moje data můžu všechny verze výstupu smazat. Nezadávám čísla účtů ani jiné identifikační údaje.";
