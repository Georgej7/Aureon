import { describe, expect, it } from "vitest";
import { sanitizePath, sanitizeUrl } from "@/lib/analytics";

describe("sanitizePath: only sanitized paths ever reach GA4", () => {
  it("keeps ordinary paths", () => {
    expect(sanitizePath("/")).toBe("/");
    expect(sanitizePath("/pricing")).toBe("/pricing");
    expect(sanitizePath("/natal-report")).toBe("/natal-report");
  });

  it("drops query strings and fragments entirely", () => {
    expect(sanitizePath("/dashboard?upgraded=1")).toBe("/dashboard");
    expect(sanitizePath("/pricing?email=a@b.com&name=Anna#top")).toBe("/pricing");
    expect(sanitizePath("/login#access_token=secret")).toBe("/login");
  });

  it("collapses client record ids and any bare uuid", () => {
    expect(sanitizePath("/clients")).toBe("/clients");
    expect(sanitizePath("/clients/123e4567-e89b-12d3-a456-426614174000")).toBe("/clients/:id");
    expect(sanitizePath("/clients/anything-at-all")).toBe("/clients/:id");
    expect(sanitizePath("/x/123e4567-e89b-12d3-a456-426614174000/y")).toBe("/x/:id/y");
  });
});

describe("sanitizeUrl", () => {
  it("returns origin + sanitized path", () => {
    expect(sanitizeUrl("https://askaureon.com/clients/abc?x=1#y")).toBe("https://askaureon.com/clients/:id");
    expect(sanitizeUrl("https://www.google.com/search?q=my+birth+date")).toBe("https://www.google.com/search");
  });

  it("returns empty string for empty or invalid input (e.g. no referrer)", () => {
    expect(sanitizeUrl("")).toBe("");
    expect(sanitizeUrl("not a url")).toBe("");
  });
});
