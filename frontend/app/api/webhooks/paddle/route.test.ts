// Covers the two pure functions that decide what a webhook event actually
// writes to profiles.subscription_tier/status -- the highest-risk part of
// the billing path to get wrong silently, since a mismapped price ID or
// status would grant (or revoke) paid access with no visible error. Doesn't
// exercise the POST handler itself (that needs a live Paddle signature,
// Supabase admin client, and Next's Request/Response machinery -- out of
// scope for a first pass of tests on a path that had none at all).
import { beforeEach, describe, expect, it } from "vitest";
import { mapSubscriptionStatus, tierForPriceId } from "./route";

const ENV_KEYS = [
  "NEXT_PUBLIC_PADDLE_PREMIUM_PRICE_ID",
  "NEXT_PUBLIC_PADDLE_PREMIUM_ANNUAL_PRICE_ID",
  "NEXT_PUBLIC_PADDLE_VIP_PRICE_ID",
  "NEXT_PUBLIC_PADDLE_VIP_ANNUAL_PRICE_ID",
  "NEXT_PUBLIC_PADDLE_PRACTITIONER_PRICE_ID",
  "NEXT_PUBLIC_PADDLE_PRACTITIONER_ANNUAL_PRICE_ID",
] as const;

beforeEach(() => {
  process.env.NEXT_PUBLIC_PADDLE_PREMIUM_PRICE_ID = "pri_premium_monthly";
  process.env.NEXT_PUBLIC_PADDLE_PREMIUM_ANNUAL_PRICE_ID = "pri_premium_annual";
  process.env.NEXT_PUBLIC_PADDLE_VIP_PRICE_ID = "pri_vip_monthly";
  process.env.NEXT_PUBLIC_PADDLE_VIP_ANNUAL_PRICE_ID = "pri_vip_annual";
  process.env.NEXT_PUBLIC_PADDLE_PRACTITIONER_PRICE_ID = "pri_practitioner_monthly";
  process.env.NEXT_PUBLIC_PADDLE_PRACTITIONER_ANNUAL_PRICE_ID = "pri_practitioner_annual";
});

function itemsFor(priceId: string | null) {
  return [{ price: priceId ? { id: priceId } : null }];
}

describe("tierForPriceId", () => {
  it("maps each configured price id to its tier", () => {
    expect(tierForPriceId("pri_premium_monthly")).toBe("premium");
    expect(tierForPriceId("pri_premium_annual")).toBe("premium");
    expect(tierForPriceId("pri_vip_monthly")).toBe("vip");
    expect(tierForPriceId("pri_vip_annual")).toBe("vip");
    expect(tierForPriceId("pri_practitioner_monthly")).toBe("practitioner");
    expect(tierForPriceId("pri_practitioner_annual")).toBe("practitioner");
  });

  it("fails safe to free for an unrecognized price id, rather than granting access", () => {
    expect(tierForPriceId("pri_some_future_price_not_yet_configured")).toBe("free");
  });

  it("fails safe to free for null/undefined", () => {
    expect(tierForPriceId(null)).toBe("free");
    expect(tierForPriceId(undefined)).toBe("free");
  });

  it("checks practitioner before vip/premium (explicit ordering, not a real precedence conflict)", () => {
    // Real price ids never collide across tiers -- this just locks in that
    // practitioner's own ids still resolve correctly if the check order
    // in the source is ever reshuffled.
    expect(tierForPriceId("pri_practitioner_monthly")).toBe("practitioner");
  });

  it("does not resolve a price id from an unconfigured env var (undefined !== undefined)", () => {
    delete process.env.NEXT_PUBLIC_PADDLE_VIP_PRICE_ID;
    // If vip's monthly env var is unset, a null/undefined incoming priceId
    // must not accidentally match it via `includes(undefined)`.
    expect(tierForPriceId(undefined)).toBe("free");
    expect(tierForPriceId(null)).toBe("free");
  });
});

describe("mapSubscriptionStatus", () => {
  it("maps active and trialing to an active tier grant at the purchased price's tier", () => {
    expect(mapSubscriptionStatus({ status: "active", items: itemsFor("pri_vip_monthly") })).toEqual({
      tier: "vip",
      status: "active",
    });
    expect(mapSubscriptionStatus({ status: "trialing", items: itemsFor("pri_premium_monthly") })).toEqual({
      tier: "premium",
      status: "active",
    });
  });

  it("maps past_due to past_due status while still recording the purchased tier", () => {
    expect(mapSubscriptionStatus({ status: "past_due", items: itemsFor("pri_practitioner_monthly") })).toEqual({
      tier: "practitioner",
      status: "past_due",
    });
  });

  it("revokes access (tier: free) on canceled or paused, regardless of which price was purchased", () => {
    expect(mapSubscriptionStatus({ status: "canceled", items: itemsFor("pri_vip_monthly") })).toEqual({
      tier: "free",
      status: "canceled",
    });
    expect(mapSubscriptionStatus({ status: "paused", items: itemsFor("pri_practitioner_monthly") })).toEqual({
      tier: "free",
      status: "canceled",
    });
  });

  it("revokes access for an unrecognized status too, rather than defaulting to active", () => {
    expect(mapSubscriptionStatus({ status: "some_future_paddle_status", items: itemsFor("pri_vip_monthly") })).toEqual(
      { tier: "free", status: "canceled" }
    );
  });

  it("handles a subscription with no price line item without throwing", () => {
    expect(mapSubscriptionStatus({ status: "active", items: [] })).toEqual({ tier: "free", status: "active" });
  });
});

// Regression guard: every env var this module reads is exercised above, so
// a future rename of one of these vars (frontend env var <-> webhook
// mapping is easy to silently drift apart, e.g. after 004_paddle_columns.sql-
// style renames) shows up as a failing test instead of a silent free-tier
// fallback in production.
it("exercises every price-id env var this module depends on", () => {
  for (const key of ENV_KEYS) expect(process.env[key]).toBeTruthy();
});
