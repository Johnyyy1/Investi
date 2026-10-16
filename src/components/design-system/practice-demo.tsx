"use client";
import { useRef, useState } from "react";
import { AnswerOption } from "@/components/learning/answer-option";
import { LessonFeedback } from "@/components/learning/lesson-feedback";
import { LessonProgress } from "@/components/learning/lesson-progress";
import { Button } from "@/components/ui/button";
import { CompletionScreen } from "@/components/learning/completion-screen";

export function PracticeDemo() {
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [finished, setFinished] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  function reset() {
    setAnswer(""); setSubmitted(false); setFinished(false);
    progressRef.current?.querySelector("button")?.focus();
  }
  const correct = answer === "9600";
  return <div className="overflow-hidden rounded-panel border border-border bg-surface shadow-elevation-1">
    <div ref={progressRef} className="px-4 pt-4 sm:px-8"><LessonProgress step={finished ? 9 : submitted ? 7 : 6} total={9} onBack={reset} /></div>
    {finished ? <CompletionScreen autoFocusAction title="A little progress, every day." description="You’ve explored how the learning components fit together." practiceCapitalAwardedMinor="200000" onContinue={reset} /> : <>
      <div className="px-6 py-8 sm:px-10"><p className="text-microcopy font-semibold text-primary">RETURNS · PRACTICE PREVIEW</p><h3 className="mt-3 text-section-title font-semibold">Do equal gains and losses cancel out?</h3><p className="mt-3 text-body text-secondary">An investment starts at 10,000. It gains 20%, then loses 20%. Choose its ending value.</p>
        <fieldset className="mt-6 space-y-3"><legend className="sr-only">Choose an ending value</legend>{["10000", "9600", "8000"].map((value, index) => <AnswerOption key={value} name="practice-value" value={value} shortcut={String(index + 1)} checked={answer === value} disabled={submitted} state={submitted && answer === value ? correct ? "correct" : "incorrect" : answer === value ? "selected" : "idle"} onChange={setAnswer}>{Number(value).toLocaleString("en-US")}</AnswerOption>)}</fieldset>
        {!submitted ? <Button className="mt-6 w-full sm:w-auto" disabled={!answer} onClick={() => setSubmitted(true)}>Check answer</Button> : null}
      </div>
      {submitted ? <LessonFeedback autoFocusAction state={correct ? "correct" : "incorrect"} title={correct ? "You’ve got it" : "Notice the new starting value"} onContinue={() => setFinished(true)}>The 20% loss applies to 12,000. That leaves 9,600, a cumulative return of −4%.</LessonFeedback> : null}
    </>}
  </div>;
}
