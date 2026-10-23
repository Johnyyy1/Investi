"use client";
import { Button } from "@/components/ui/button";
export default function TrainingError({ retry }: { retry: () => void }) {
  return <main className="mx-auto max-w-2xl space-y-5 p-5"><h1 className="font-display text-title">Nácvik se teď nenačetl.</h1><p>Uložené kroky zůstávají zachované. Zkus načtení znovu.</p><Button onClick={retry}>Zkusit znovu</Button></main>;
}
