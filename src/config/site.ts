export interface NavLink {
  readonly title: string;
  readonly href: string;
}

export interface CreatorConfig {
  readonly name: string;
  readonly url: string;
  readonly image: string;
  readonly bio: string;
}

export interface SiteConfig {
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  readonly url: string;
  readonly language: string;
  readonly timezone: string;
  readonly niche: string;
  readonly creator: CreatorConfig | null;
  readonly author: {
    readonly name: string;
    readonly role: string;
    readonly bio: string;
    readonly url: string;
  };
  readonly navLinks: readonly NavLink[];
  readonly footerLinks: {
    readonly navigation: readonly NavLink[];
    readonly topics: readonly NavLink[];
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
  name: process.env.SITE_NAME || "Fresh Angle",
  tagline: "Cutting-Edge AI & Tech Perspectives, Daily",
  description:
    "Fresh Angle delivers rigorous, unbiased, and deeply researched daily analysis on artificial intelligence, frontier models, machine learning breakthroughs, and technological innovation.",
  url: process.env.SITE_URL || "https://freshangle.vercel.app",
  language: "en-US",
  timezone: process.env.DEFAULT_TIMEZONE || "Asia/Kolkata",
  niche: "AI & technology news",
  creator: process.env.CREATOR_NAME
    ? {
        name: process.env.CREATOR_NAME,
        url: process.env.CREATOR_URL || "",
        image: process.env.CREATOR_IMAGE || "/images/creator.png",
        bio: "Founder, Software Craftsman & Senior Full-Stack Engineer passionate about autonomous systems and next-generation web intelligence.",
      }
    : null,
  author: {
    name: "Fresh Angle Editorial AI",
    role: "Automated Research & Synthesis Engine",
    bio: "An autonomous research system synthesizing peer-reviewed papers, engineering announcements, and industry dispatches into concise, factual briefings.",
    url: "https://freshangle.vercel.app/about",
  },
  navLinks: [
    { title: "Home", href: "/" },
    { title: "Blog", href: "/blog" },
    { title: "Categories", href: "/categories" },
    { title: "Tags", href: "/tags" },
    { title: "Archive", href: "/archive" },
    { title: "Search", href: "/search" },
    { title: "About", href: "/about" },
  ],
  footerLinks: {
    navigation: [
      { title: "Home", href: "/" },
      { title: "Blog", href: "/blog" },
      { title: "Categories", href: "/categories" },
      { title: "Tags", href: "/tags" },
      { title: "Archive", href: "/archive" },
      { title: "Search", href: "/search" },
      { title: "About", href: "/about" },
      { title: "Contact", href: "/contact" },
    ],
    topics: [
      {
        title: "Artificial Intelligence",
        href: "/category/artificial-intelligence",
      },
      {
        title: "Frontier Models & LLMs",
        href: "/category/frontier-models-llms",
      },
      { title: "Machine Learning", href: "/category/machine-learning" },
      { title: "Hardware & Silicon", href: "/category/hardware-silicon" },
    ],
    legal: [
      { title: "Privacy Policy", href: "/privacy-policy" },
      { title: "Terms of Service", href: "/terms" },
      { title: "Editorial Policy", href: "/editorial-policy" },
      { title: "AI Disclosure", href: "/ai-disclosure" },
      { title: "RSS Feed", href: "/feed.xml" },
    ],
  },
  social: {
    x: "https://x.com/freshangle_ai",
    github: "https://github.com/KSVenkatesh2002/Fresh-Angle",
    rss: "/feed.xml",
  },
  postsPerPage: 12,
} as const;
