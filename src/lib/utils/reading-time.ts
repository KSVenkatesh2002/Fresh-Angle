/**
 * Calculates estimated reading time in minutes based on average 200 words per minute.
 */
export function calculateReadingTime(content: string): number {
  if (!content || content.trim().length === 0) {
    return 1;
  }

  // Remove code blocks, HTML tags, markdown symbols for accurate word count
  const cleanText = content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`.*?`/g, '') // Remove inline code
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/[#*_[\]()~>-]/g, ' ') // Remove markdown syntax
    .trim();

  const words = cleanText.split(/\s+/).filter((w) => w.length > 0);
  const wordsPerMinute = 200;
  const minutes = Math.ceil(words.length / wordsPerMinute);

  return Math.max(1, minutes);
}
