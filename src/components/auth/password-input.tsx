"use client";

import { useState, type ComponentProps } from "react";
import { TextInput } from "@/components/learning/text-input";
import { Button } from "@/components/ui/button";

export function PasswordInput(props: ComponentProps<typeof TextInput>) {
  const [visible, setVisible] = useState(false);
  return <div>
    <TextInput {...props} type={visible ? "text" : "password"} />
    <Button type="button" variant="ghost" size="compact" className="mt-1 min-h-11" aria-pressed={visible} disabled={props.disabled} onClick={() => setVisible((value) => !value)}>{visible ? "Skrýt heslo" : "Zobrazit heslo"}</Button>
  </div>;
}
