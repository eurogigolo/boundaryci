import { describe, expect, it } from "vitest";
import { captchaTokenOptions } from "./captcha";

describe("CAPTCHA token options", () => {
  it("keeps authentication unchanged until a Turnstile site key is configured", () => {
    expect(captchaTokenOptions("", null)).toEqual({});
  });

  it("passes a completed challenge to Supabase Auth", () => {
    expect(captchaTokenOptions("site-key", "challenge-token")).toEqual({
      captchaToken: "challenge-token",
    });
  });

  it("blocks protected authentication requests without a completed challenge", () => {
    expect(() => captchaTokenOptions("site-key", null)).toThrow(
      "Complete the security check before continuing.",
    );
  });
});
