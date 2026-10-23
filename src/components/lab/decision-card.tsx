"use client";

import { AppLink as Link } from "@/components/shell/app-link";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { lessonLink } from "@/features/learning/catalog";
import { DECISION_CARD_PREFERENCES_KEY, DECISION_CARDS, readDecisionCardPreferences, type DecisionCardKind, type DecisionCardPreferences, type Safeguard } from "@/features/portfolio/decision-cards";

// shortcut: preferences live in this browser only; move them to the account once #130 measures card exposure.
export function loadDecisionCardPreferences(): DecisionCardPreferences {
  try { return readDecisionCardPreferences(localStorage.getItem(DECISION_CARD_PREFERENCES_KEY)); } catch { return readDecisionCardPreferences(null); }
}
export function saveDecisionCardPreferences(preferences: DecisionCardPreferences) {
  try { localStorage.setItem(DECISION_CARD_PREFERENCES_KEY, JSON.stringify(preferences)); } catch { /* The card still works for this action. */ }
}

/** Information at the moment of decision. It never disables or replaces the action itself. */
export function DecisionCard({ kind, safeguards = [], onDisable, className }: { kind: DecisionCardKind; safeguards?: readonly Safeguard[]; onDisable: () => void; className?: string }) {
  const card = DECISION_CARDS[kind];
  const lesson = lessonLink(card.lessonId);
  return <Feedback role="note" aria-labelledby={`decision-card-${kind}`} data-testid={`decision-card-${kind}`} className={className}>
    <p id={`decision-card-${kind}`} className="break-words font-bold">{card.title}</p>
    <p className="mt-2 break-words text-small">{card.body}</p>
    {safeguards.length ? <><p className="mt-3 text-small font-bold">Tvoje pojistky</p><ul className="mt-1 list-disc space-y-1 pl-5 text-small">{safeguards.map((rule, index) => <li key={index} className="break-words">{rule.trigger}: {rule.action}</li>)}</ul></> : null}
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      {lesson ? <Link href={lesson.href} className="break-words text-small font-bold text-primary underline underline-offset-4">{lesson.label}</Link> : null}
      <Button variant="ghost" size="compact" onClick={onDisable}>Tento typ karty už nezobrazovat</Button>
    </div>
  </Feedback>;
}
