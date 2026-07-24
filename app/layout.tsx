import type { Metadata } from 'next';
import { Figtree, Inter, Plus_Jakarta_Sans, Urbanist } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CookieConsent from '@/components/CookieConsent';
import FixedRightBar from '@/components/FixedRightBar';
import FixedPopularNow from '@/components/FixedPopularNow';
import FixedScrollToTop from '@/components/FixedScrollToTop';
import FixedSocialFollow from '@/components/FixedSocialFollow';
import { ADSENSE_CLIENT, ADSENSE_ENABLED } from '@/lib/adsense';
import { listSidebarArticles } from '@/lib/strapi';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const urbanist = Urbanist({
  subsets: ['latin'],
  variable: '--font-urbanist',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

// Site-wide default font. Every Tailwind font-* utility resolves to this via
// the tailwind.config.ts fontFamily map.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

// Heading-only typeface. Wired into globals.css h1–h6 rule.
const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.originfacts.com'),
  title: {
    default: 'Originfacts — The facts behind every place worth visiting',
    template: '%s · Originfacts',
  },
  description:
    'The facts behind every place worth visiting — plus the latest on flights, hotels, airlines, airports and destinations.',
  openGraph: { type: 'website', siteName: 'Originfacts', locale: 'en_US' },
  twitter: { card: 'summary_large_image' },
  alternates: {
    canonical: '/',
    types: {
      'application/rss+xml': [{ url: '/feed.xml', title: 'Originfacts RSS' }],
    },
  },
  other: ADSENSE_ENABLED ? { 'google-adsense-account': ADSENSE_CLIENT } : {},
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sidebar = await listSidebarArticles(7).catch(() => ({ recent: [], popular: [] }));

  return (
    <html lang="en" className={`${inter.variable} ${urbanist.variable} ${jakarta.variable} ${figtree.variable}`}>
      <body className="min-h-screen flex flex-col font-sans font-normal grain" data-testid="app-shell">
        {/* Impact.com site verification — raw tag (React 19 hoists it into <head>).
            Kept as the verbatim <meta name=… value=…> Impact provides; not routed
            through Next's metadata API, which would rewrite `value` to `content`. */}
        <meta {...({ name: 'impact-site-verification', value: '3604ebda-47ea-4c1a-ad1e-8d7976f411ce' } as Record<string, string>)} />
        <Script id="consent-default" strategy="beforeInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied',
            wait_for_update: 500
          });
        `}</Script>
        {/* Google Analytics 4 — gtag.js loader + init for G-TY066MKR0Z. The
            consent-default block above runs first and keeps analytics_storage
            denied until the cookie banner grants consent, so this tag is
            GDPR-friendly out of the box. */}
        <Script
          id="ga4-loader"
          async
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-TY066MKR0Z"
        />
        <Script id="ga4-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-TY066MKR0Z');
        `}</Script>
        {/* AdSense loader — plain <script async>; React 19 hoists it into <head>
            so it sits exactly as the AdSense snippet expects. */}
        {ADSENSE_ENABLED && (
          // eslint-disable-next-line @next/next/no-sync-scripts
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        )}
        <Script id="tp-em-401311" strategy="afterInteractive">{`
          (function () {
            var script = document.createElement("script");
            script.async = 1;
            script.src = 'https://tp-em.com/NDAxMzEx.js?t=401311';
            document.head.appendChild(script);
          })();
        `}</Script>
        {/* Travelpayouts white-label metasearch loader. Lives in <head> per
            TP docs so the SDK is available on any page that drops in a
            <div id="tpwl-search"> / <div id="tpwl-tickets"> container.
            No-ops on pages without those containers. */}
        <Script id="tpwl-loader" strategy="afterInteractive">{`
          (function () {
            var script = document.createElement("script");
            script.async = 1;
            script.type = "module";
            script.src = "https://tpscr.com/wl_web/main.js?wl_id=16677";
            document.head.appendChild(script);
          })();
        `}</Script>
        <Header />
        <main className="flex-1">{children}</main>
        <FixedPopularNow articles={sidebar.popular} />
        <FixedRightBar popularPosts={sidebar.popular} />
        <FixedScrollToTop />
        <FixedSocialFollow />
        <Footer />
        <CookieConsent />
        {/* VigLink (Sovrn Commerce) — auto-affiliates outbound merchant links.
            Loaded just before </body> per Sovrn's install snippet. */}
        <Script id="viglink" strategy="afterInteractive">{`
          var vglnk = {key: 'afc24eff86a1f79d72ff2337684e5150'};
          (function(d, t) {var s = d.createElement(t);
            s.type = 'text/javascript';s.async = true;
            s.src = '//cdn.viglink.com/api/vglnk.js';
            var r = d.getElementsByTagName(t)[0];
            r.parentNode.insertBefore(s, r);
          }(document, 'script'));
        `}</Script>
      </body>
    </html>
  );
}
