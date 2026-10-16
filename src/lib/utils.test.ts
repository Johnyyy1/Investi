import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("keeps a token text size next to a token text colour", () => {
    expect(cn("text-body text-primary-foreground")).toBe("text-body text-primary-foreground");
    expect(cn("text-small text-secondary", "text-body")).toBe("text-secondary text-body");
  });

  it("lets later token radius and elevation classes win", () => {
    expect(cn("rounded-button", "rounded-control")).toBe("rounded-control");
    expect(cn("shadow-elevation-1", "shadow-none")).toBe("shadow-none");
    expect(cn("text-secondary", "text-danger-ink")).toBe("text-danger-ink");
  });
});
