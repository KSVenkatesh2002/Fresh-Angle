export interface TopicFeed {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly category: string;
  readonly weight: number;
}

export const TOPIC_FEEDS: readonly TopicFeed[] = [
  {
    id: "hn-top",
    name: "Hacker News Frontpage",
    url: "https://news.ycombinator.com/rss",
    category: "Industry & Community",
    weight: 1.0,
  },
  {
    id: "ars-technica",
    name: "Ars Technica Tech & AI",
    url: "https://feeds.arstechnica.com/arstechnica/technology-lab",
    category: "Technology & Computing",
    weight: 0.9,
  },
  {
    id: "verge-ai",
    name: "The Verge - Artificial Intelligence",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    category: "AI Trends",
    weight: 0.95,
  },
  {
    id: "techcrunch-ai",
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    category: "Startups & Ventures",
    weight: 0.85,
  },
  {
    id: "venturebeat-ai",
    name: "VentureBeat AI",
    url: "https://venturebeat.com/category/ai/feed/",
    category: "Enterprise AI",
    weight: 0.9,
  },
] as const;

export const NICHE_KEYWORDS: readonly string[] = [
  "ai",
  "artificial intelligence",
  "machine learning",
  "deep learning",
  "llm",
  "large language model",
  "gpt",
  "gemini",
  "claude",
  "llama",
  "mistral",
  "deepseek",
  "neural network",
  "transformer",
  "autonomous",
  "robotics",
  "gpu",
  "nvidia",
  "ai chip",
  "diffusion model",
  "agentic",
  "multimodal",
  "rag",
  "reasoning model",
] as const;
