import { BookOpen, ChartPie, FileDown, Globe, ShieldCheck, Target, UserRound } from "lucide-react";
import { z } from "zod";

export const settingsSections = [
  { id: "account", label: "Účet", icon: UserRound, group: "PROFIL" },
  { id: "goal", label: "Můj cíl a tempo", icon: Target, group: "PROFIL" },
  { id: "format", label: "Jazyk a formát", icon: Globe, group: "NASTAVENÍ" },
  { id: "portfolio", label: "Portfolio Lab", icon: ChartPie, group: "NASTAVENÍ" },
  { id: "learning", label: "Učení", icon: BookOpen, group: "NASTAVENÍ" },
  { id: "security", label: "Přihlášení a zabezpečení", icon: ShieldCheck, group: "ÚČET" },
  { id: "data", label: "Moje data", icon: FileDown, group: "ÚČET" },
] as const;
export type SettingsSection = typeof settingsSections[number]["id"];
export type SettingsIdentity = { name: string; email: string; emailVerified: boolean; emailSuppressed?: boolean; demo: boolean; guest?: boolean; since: string; completed: number; total: number };
export const displayNameSchema = z.string().trim().min(1, "Zadej své jméno.").max(80, "Jméno může mít nejvýše 80 znaků.").refine((name) => !/[\u0000-\u001f\u007f]/u.test(name), "Jméno nesmí obsahovat řídicí znaky.");
