import type { MetadataRoute } from 'next';

/** The public pages may be crawled. Everything behind sign-in is closed to crawlers, and says noindex as well. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/deals', '/inbox', '/listings', '/requests', '/login'] },
    sitemap: 'https://gridstock.netlify.app/sitemap.xml',
  };
}
