import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PasswordRecovery } from "./PasswordRecovery";

describe("password recovery", () => {
  it("renders a complete new-password form", () => {
    const markup = renderToStaticMarkup(<PasswordRecovery onComplete={() => undefined} />);
    expect(markup).toContain("Set a new password");
    expect(markup).toContain("Confirm new password");
    expect(markup).toContain('autoComplete="new-password"');
    expect(markup).toContain('minLength="8"');
  });
});
