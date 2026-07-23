import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthScreen } from "./AuthScreen";

function renderAuth(captchaSiteKey: string): string {
  vi.stubGlobal("window", { location: { origin: "https://boundaryci.com" } });
  return renderToStaticMarkup(
    <AuthScreen initialMode="signup" publicUrl="/" captchaSiteKey={captchaSiteKey} />,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("BoundaryCI Cloud authentication", () => {
  it("keeps the existing form available before CAPTCHA activation", () => {
    const markup = renderAuth("");
    expect(markup).not.toContain('aria-label="Security check"');
    expect(markup).toContain('type="submit"');
    expect(markup).not.toContain('type="submit" disabled=""');
  });

  it("requires a Turnstile token when a site key is configured", () => {
    const markup = renderAuth("public-test-site-key");
    expect(markup).toContain('aria-label="Security check"');
    expect(markup).toContain('type="submit" disabled=""');
  });

  it("preserves a selected paid plan in the confirmation redirect", () => {
    vi.stubGlobal("window", { location: { origin: "https://boundaryci.com" } });
    const markup = renderToStaticMarkup(
      <AuthScreen
        initialMode="signup"
        publicUrl="/"
        captchaSiteKey=""
        checkoutIntent={{ plan: "team", interval: "annual" }}
      />,
    );
    expect(markup).toContain("review the Team plan before checkout");
  });
});
