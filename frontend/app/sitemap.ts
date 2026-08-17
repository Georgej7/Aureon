import type { MetadataRoute } from "next";

const SITE_URL = "https://askaureon.com";

// Deliberately just the public marketing/auth/legal pages, not the
// authenticated app screens (dashboard, chat, tarot, etc.) -- those
// require a completed profile to show anything beyond a "create your
// profile first" gate, and submitting a pile of near-identical gated
// pages to search engines is a thin/duplicate-content problem, not an
// SEO win.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
