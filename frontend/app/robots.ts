import type { MetadataRoute } from "next";

const SITE_URL = "https://askaureon.com";

// Disallowing the authenticated app screens for the same reason they're
// left out of sitemap.ts -- an anonymous crawler hits a "create your
// profile first" gate on all of them, not real content, so there's
// nothing worth indexing there. /prototype is an unlinked WebGL
// proof-of-concept, never meant to be discovered at all.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/chat",
        "/onboarding",
        "/natal-report",
        "/compatibility",
        "/baby-compatibility",
        "/vedic",
        "/human-design",
        "/tarot",
        "/chinese-zodiac",
        "/feng-shui",
        "/matrix-of-destiny",
        "/solar-return",
        "/progressed",
        "/composite",
        "/astrocartography",
        "/ephemeris",
        "/aspect-search",
        "/void-of-course",
        "/timing",
        "/famous-people",
        "/clients",
        "/prototype",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
