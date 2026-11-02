export interface NavLink {
  readonly title: string;
  readonly href: string;
}

export interface SiteConfig {
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  readonly url: string;
  readonly language: string;
  readonly niche: string;
  readonly author: {
    readonly name: string;
    readonly role: string;
    readonly bio: string;
    readonly url: string;
  };
  readonly navLinks: readonly NavLink[];
  readonly footerLinks: {
    readonly navigation: readonly NavLink[];
    readonly legal: readonly NavLink[];
  };
  readonly social: {
    readonly x?: string;
    readonly github?: string;
    readonly rss: string;
  };
  readonly postsPerPage: number;
}

export const siteConfig: SiteConfig = {
  name: 'Fresh Angle',
  tagline: 'Cutting-Edge AI & Tech Perspectives, Daily',
  description:
    'Fresh Angle delivers rigorous, unbiased, and deeply researched daily analysis on artificial intelligence, frontier models, machine learning breakthroughs, and technological innovation.',
  url: process.env.SITE_URL || 'https://freshangle.vercel.app',
  language: 'en-US',
  niche: 'AI & technology news',
  author: {
    name: 'Fresh Angle Editorial AI',
    role: 'Automated Research & Synthesis Engine',
    bio: 'An autonomous research system synthesizing peer-reviewed papers, engineering announcements, and industry dispatches into concise, factual briefings.',
    url: 'https://freshangle.vercel.app/about',
  },
  navLinks: [
    { title: 'Home', href: '/' },
    { title: 'Blog', href: '/blog' },
    { title: 'Search', href: '/search' },
    { title: 'About', href: '/about' },
  ],
  footerLinks: {
    navigation: [
      { title: 'Home', href: '/' },
      { title: 'Blog', href: '/blog' },
      { title: 'Search', href: '/search' },
      { title: 'About', href: '/about' },
      { title: 'Contact', href: '/contact' },
    ],
    legal: [
      { title: 'Privacy Policy', href: '/privacy-policy' },
      { title: 'AI Disclosure', href: '/ai-disclosure' },
      { title: 'RSS Feed', href: '/feed.xml' },
    ],
  },
  social: {
    x: 'https://x.com/freshangle_ai',
    github: 'https://github.com/freshangle/blog',
    rss: '/feed.xml',
  },
  postsPerPage: 9,
} as const;
