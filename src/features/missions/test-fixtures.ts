/** Temporary engine fixtures only; never inserted into a published lesson by the app. */
import type { LessonBlock } from "@/features/lessons/types";
export const missionPreviewBlock: Extract<LessonBlock, { type: "labMission" }> = {
  id: "verified-mission", type: "labMission", missionId: "allocation-training-v1",
  mission: { title: "Procvič rozložení", goal: "Rozlož oddělené portfolio podle čtyř pravidel.", minutes: 3, target: "/lab/portfolio", steps: ["Otevři oddělené cvičení.", "Rozděl kapitál a zamkni předpověď.", "Vrať se sem a ověř výsledek."], afterReturn: "Server ověří výsledek z uloženého rozhodnutí. Osobní portfolio se nemění." },
  analysis: { title: "modelový investor", summary: "Modelové portfolio drží široký fond a hotovost.", rows: [{ label: "Pravidla rozložení", status: "modelový příklad" }], generalRule: "Ověř koncentraci předem, bez ohledu na výnos.", selfExplanationPrompt: "Co chrání pravidlo o největší firmě?" },
};
export const missionPreviewBlocks: LessonBlock[] = [missionPreviewBlock, { id: "mission-summary", type: "lessonSummary", title: "Mise dokončena", content: "Server ověřil výstup odděleného cvičení." }];
export const missionPreviewSteps = missionPreviewBlocks.map((block) => ({ title: block.type === "labMission" ? block.mission.title : "Shrnutí", blocks: [block.id] }));
