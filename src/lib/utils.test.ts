import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges classnames", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("dedupes tailwind utilities", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});

