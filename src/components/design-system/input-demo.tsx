"use client";
import { useState } from "react";
import { FinanceInput } from "@/components/learning/finance-input";
import { MetricResult } from "@/components/learning/metric-result";
import { Select, Slider, Textarea } from "@/components/ui/form-controls";
export function InputDemo() {
  const [value, setValue] = useState("10000");
  const [returnValue, setReturn] = useState("20");
  const [invalid, setInvalid] = useState("");
  const [confidence, setConfidence] = useState("50");
  return <div className="space-y-8">
    <div className="grid gap-6 md:grid-cols-3">
      <FinanceInput mode="currency" label="Starting value" value={value} onValueChange={setValue} suffix="Kč" hint="Currency unit supplied by the lesson." />
      <FinanceInput mode="percentage" label="Period return" value={returnValue} onValueChange={setReturn} hint="Enter a percentage, such as 20." />
      <FinanceInput label="Number of periods" value={invalid} onValueChange={setInvalid} error={invalid.trim() === "" ? "Enter a value to continue." : undefined} hint="Demo input; calculations are unchanged." />
    </div>
    <div className="grid gap-6 md:grid-cols-3">
      <div><label htmlFor="demo-select" className="mb-2 block text-small font-bold">Learning pace</label><Select id="demo-select" defaultValue="steady"><option value="steady">Steady</option><option value="focused">Focused</option></Select></div>
      <div><label htmlFor="demo-slider" className="flex justify-between text-small font-bold"><span>Confidence</span><span>{confidence}%</span></label><Slider id="demo-slider" min="0" max="100" value={confidence} onChange={(event) => setConfidence(event.target.value)} /></div>
      <div><label htmlFor="demo-textarea" className="mb-2 block text-small font-bold">Reflection</label><Textarea id="demo-textarea" placeholder="What changed in your thinking?" /></div>
    </div>
    <div className="flex flex-wrap gap-x-12 gap-y-6 border-t border-border pt-6">
      <MetricResult label="Period return" value="+20.0%" sentiment="positive" />
      <MetricResult label="Ending value" value="9,600 Kč" />
      <MetricResult label="Cumulative return" value="−4.0%" sentiment="negative" note="Illustrative results, not linked to these inputs." />
    </div>
  </div>;
}
