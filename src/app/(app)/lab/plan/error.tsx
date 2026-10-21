"use client";
import { Button } from "@/components/ui/button";
export default function PlanError({ retry }: { retry: () => void }) {
  return <main className="mx-auto max-w-2xl space-y-5 p-5"><h1 className="font-display text-title">Plán se teď nenačetl.</h1><p>Uložené verze zůstávají zachované. Zkus načtení znovu.</p><Button onClick={retry}>Zkusit znovu</Button></main>;
}
