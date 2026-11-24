import type { MetadataRoute } from 'next';

const BASE = 'https://gridstock.netlify.app';

/** The three public pages. Listings and requests are private, so they are never listed here. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/about`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/nda`, changeFrequency: 'monthly', priority: 0.4 },
  ];
}
