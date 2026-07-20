import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceLoadError } from "./Dashboard";

describe("dashboard workspace loading", () => {
  it("does not show organization creation when the workspace query fails", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceLoadError
        email="owner@example.com"
        error="permission denied for table organizations"
        onRetry={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    expect(markup).toContain("We couldn&#x27;t load your organization");
    expect(markup).toContain("owner@example.com");
    expect(markup).toContain("Retry workspace loading");
    expect(markup).toContain("permission denied for table organizations");
    expect(markup).not.toContain("Create your organization");
  });
});
