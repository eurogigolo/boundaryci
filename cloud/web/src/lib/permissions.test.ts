import { describe, expect, it } from "vitest";
import { canManageOrganization } from "./permissions";

describe("organization permissions", () => {
  it("allows owners and administrators to manage repositories", () => {
    expect(canManageOrganization("owner")).toBe(true);
    expect(canManageOrganization("admin")).toBe(true);
  });

  it("keeps repository management hidden from read-only roles", () => {
    expect(canManageOrganization("member")).toBe(false);
    expect(canManageOrganization("viewer")).toBe(false);
    expect(canManageOrganization(null)).toBe(false);
  });
});
