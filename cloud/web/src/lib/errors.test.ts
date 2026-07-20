import { describe, expect, it } from "vitest";
import { errorMessage } from "./errors";

describe("error presentation", () => {
  it("reads messages from Error and Supabase-style error objects", () => {
    expect(errorMessage(new Error("ordinary failure"))).toBe("ordinary failure");
    expect(errorMessage({ code: "23505", message: "duplicate repository" })).toBe("duplicate repository");
  });

  it("falls back safely for unknown thrown values", () => {
    expect(errorMessage("plain failure")).toBe("plain failure");
    expect(errorMessage(null)).toBe("null");
  });
});
