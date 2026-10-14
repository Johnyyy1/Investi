"use client";

import { useRef, useState } from "react";
import { AppLink as Link } from "@/components/shell/app-link";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleCheck, CircleX, MousePointerClick } from "lucide-react";
import type { LessonBlock } from "@/features/lessons/types";
import { saveLessonPositionAction } from "@/features/progress/actions";
import styles from "./studovna-page.module.css";

type Choice = Extract<LessonBlock, { type: "multipleChoiceQuestion" }>;

export function StudovnaQuestion({ question, lessonId, position, href, actionLabel }: {
  question?: Choice; lessonId: string; position: number; href: string; actionLabel: string;
}) {
  const [answer, setAnswer] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const busy = useRef(false);
  const router = useRouter();
  const correct = question && answer === question.correctOptionId;

  async function continueLesson() {
    if (busy.current || !correct || !answer) return;
    busy.current = true; setPending(true); setError(undefined);
    try {
      const result = await saveLessonPositionAction(lessonId, position + 1, { answer });
      if (!result.ok) { setError(result.message); return; }
      router.push(href); router.refresh();
    } catch { setError("Tvé místo se nepodařilo uložit. Zkus to znovu."); }
    finally { busy.current = false; setPending(false); }
  }

  return <>
    {question && <section className={styles.question} aria-labelledby="continue-question">
      <p className={styles.questionLabel}>Otázka z kroku {position + 1}</p>
      <h3 id="continue-question">{question.prompt}</h3>
      <fieldset className={styles.answers} disabled={pending}>
        <legend className="sr-only">Vyber odpověď a uvidíš vysvětlení</legend>
        {question.options.map((option, index) => {
          const selected = answer === option.id;
          return <label key={option.id} className={`${styles.answer} ${selected ? correct ? styles.answerCorrect : styles.answerIncorrect : ""}`}>
            <span className={styles.answerKey} aria-hidden="true">{String.fromCharCode(65 + index)}</span>
            <span>{option.label}</span>
            <input type="radio" name={`preview-${question.id}`} value={option.id} checked={selected} onChange={() => { setAnswer(option.id); setError(undefined); }} />
            {selected ? correct ? <CircleCheck size={20} aria-hidden="true" /> : <CircleX size={20} aria-hidden="true" /> : null}
          </label>;
        })}
      </fieldset>
      {answer !== undefined && <div role="status" className={`${styles.answerFeedback} ${correct ? "" : styles.answerFeedbackWrong}`}>
        <strong>{correct ? "Správně." : "Zkus to ještě jednou."}</strong> {correct ? question.correctExplanation : question.incorrectExplanation}
      </div>}
    </section>}
    <div className={styles.continueControls}>
      <p className={styles.quietNote}><MousePointerClick size={16} aria-hidden="true" />{question ? "Klikni na odpověď a hned uvidíš proč." : "Tvoje místo v lekci zůstává uložené."}</p>
      {correct ? <button className={styles.primaryAction} aria-busy={pending} disabled={pending} onClick={() => void continueLesson()}>{pending ? "Ukládám…" : "Pokračovat v lekci"}<ArrowRight size={18} aria-hidden="true" /></button>
        : <Link href={href} className={styles.primaryAction} aria-label="Pokračovat">{actionLabel}<ArrowRight size={18} aria-hidden="true" /></Link>}
    </div>
    {error && <p role="alert" className={styles.saveError}>{error}</p>}
  </>;
}
