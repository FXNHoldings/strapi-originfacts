import type { MetadataRoute } from 'next';

const SITE_URL = 'https://www.originfacts.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: 'AhrefsSiteAudit',
        allow: '/',
      },
      {
        userAgent: 'AhrefsBot',
        allow: '/',
      },
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
