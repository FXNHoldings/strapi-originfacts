'use client';

import { useEffect, useState } from 'react';

const SHOW_THRESHOLD = 400;

const SOCIALS: { label: string; href: string; icon: 'facebook' | 'x' | 'linkedin' | 'reddit' }[] = [
  { label: 'Facebook', href: 'https://www.facebook.com/originfacts/', icon: 'facebook' },
  { label: 'X / Twitter', href: 'https://x.com/realoriginfacts', icon: 'x' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/143027896/', icon: 'linkedin' },
  { label: 'Reddit', href: 'https://www.reddit.com/r/Originfacts/', icon: 'reddit' },
];

export default function FixedSocialFollow() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_THRESHOLD);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <aside
      data-testid="fixed-social-follow"
      className={`fixed bottom-[30px] right-[50px] z-40 hidden flex-col items-center gap-2 transition-opacity duration-300 lg:flex ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {/* "FOLLOW" pill — dark capsule with vertical text */}
      <div className="flex h-[100px] w-[44px] items-center justify-center rounded-full bg-forest-950 shadow-[0_1px_3px_rgba(0,0,0,0.25)]">
        <span
          className="font-urbanist text-[11px] font-bold uppercase tracking-[0.25em] text-white [writing-mode:vertical-rl] [transform:rotate(180deg)]"
        >
          Follow
        </span>
      </div>

      {/* Social icons pill — white capsule, icons stacked vertically */}
      <ul className="flex w-[44px] flex-col items-center gap-5 rounded-full bg-white py-5 shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
        {SOCIALS.map((s) => (
          <li key={s.label}>
            <a
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
              className="flex h-5 w-5 items-center justify-center text-forest-950 transition hover:text-primary-emphasis"
            >
              <SocialIcon name={s.icon} />
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function SocialIcon({ name }: { name: 'facebook' | 'x' | 'linkedin' | 'reddit' }) {
  const cls = 'h-[18px] w-[18px] fill-current';
  switch (name) {
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-hidden>
          <path d="M22 12.06C22 6.48 17.52 2 11.94 2 6.36 2 1.88 6.48 1.88 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.78v-2.91h2.54V9.84c0-2.51 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46H15.1c-1.24 0-1.62.77-1.62 1.56v1.87h2.76l-.44 2.91h-2.32V22c4.78-.76 8.52-4.92 8.52-9.94z" />
        </svg>
      );
    case 'x':
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817-5.967 6.817H1.677l7.73-8.835L1.255 2.25h6.83l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-hidden>
          <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.8 0 0 .78 0 1.75v20.5C0 23.22.8 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.75V1.75C24 .78 23.2 0 22.22 0z" />
        </svg>
      );
    case 'reddit':
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-hidden>
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.74c.69 0 1.25.56 1.25 1.25a1.25 1.25 0 0 1-2.5.01c0-.69.56-1.26 1.25-1.26zm-5.01 1.4c2.62 0 4.99.87 6.66 2.23a1.81 1.81 0 0 1 2.4 2.75c0 .05.01.1.01.15 0 2.68-3.15 4.85-7.06 4.85s-7.06-2.17-7.06-4.85c0-.05 0-.1.01-.15a1.81 1.81 0 0 1 2.4-2.75C7.02 7.01 9.39 6.14 12 6.14zm-3.8 4.15a1.25 1.25 0 0 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm7.6 0a1.25 1.25 0 0 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm-3.8 4.66c-1 0-1.98.11-2.85.35-.25.07-.4.32-.33.57.06.2.24.34.45.34l.12-.02c.77-.21 1.65-.32 2.54-.32.89 0 1.77.11 2.54.32l.12.02c.21 0 .39-.14.45-.34a.46.46 0 0 0-.33-.57c-.87-.24-1.85-.35-2.85-.35z" />
        </svg>
      );
  }
}
