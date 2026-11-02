import sharp from 'sharp';
import { PIPELINE_CONFIG } from '@/config/pipeline';

/**
 * Resizes an image buffer to 1200x630 and converts it into compressed WebP.
 * Adjusts quality iteratively to stay below target size limit (~125KB).
 */
export async function processImageToWebp(input: Buffer | Uint8Array): Promise<Buffer> {
  const targetWidth = PIPELINE_CONFIG.limits.coverWidth;
  const targetHeight = PIPELINE_CONFIG.limits.coverHeight;
  const maxSizeBytes = PIPELINE_CONFIG.limits.maxCoverSizeBytes;

  const sharpInstance = sharp(input).resize(targetWidth, targetHeight, {
    fit: 'cover',
    position: 'center',
  });

  let quality = 82;
  let outputBuffer = await sharpInstance.webp({ quality, effort: 4 }).toBuffer();

  // If size exceeds target, progressively reduce quality
  while (outputBuffer.length > maxSizeBytes && quality > 45) {
    quality -= 8;
    outputBuffer = await sharp(input)
      .resize(targetWidth, targetHeight, { fit: 'cover', position: 'center' })
      .webp({ quality, effort: 4 })
      .toBuffer();
  }

  return outputBuffer;
}

/**
 * Generates an SVG-based branded fallback cover image and converts to 1200x630 WebP.
 */
export async function generateDefaultBrandedCover(
  title: string,
  category: string = 'Artificial Intelligence'
): Promise<Buffer> {
  const width = PIPELINE_CONFIG.limits.coverWidth;
  const height = PIPELINE_CONFIG.limits.coverHeight;

  // Escape special xml characters
  const safeTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const safeCategory = category
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Truncate title if too long for layout
  const displayTitle =
    safeTitle.length > 70 ? `${safeTitle.substring(0, 67)}...` : safeTitle;

  const svg = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0a0f1d" />
        <stop offset="50%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="#1e1b4b" />
      </linearGradient>
      <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#3b82f6" />
        <stop offset="100%" stop-color="#8b5cf6" />
      </linearGradient>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
      </pattern>
    </defs>

    <rect width="${width}" height="${height}" fill="url(#bgGrad)" />
    <rect width="${width}" height="${height}" fill="url(#grid)" />

    <!-- Top Badge -->
    <rect x="80" y="80" width="180" height="36" rx="8" fill="rgba(59, 130, 246, 0.15)" stroke="rgba(59, 130, 246, 0.3)" />
    <text x="96" y="103" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#60a5fa" letter-spacing="1">
      ${safeCategory.toUpperCase()}
    </text>

    <!-- Main Title -->
    <text x="80" y="220" font-family="system-ui, sans-serif" font-size="46" font-weight="800" fill="#f8fafc" width="1040">
      ${displayTitle}
    </text>

    <!-- Bottom Brand Bar -->
    <line x1="80" y1="520" x2="1120" y2="520" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
    <circle cx="95" cy="555" r="14" fill="url(#accentGrad)" />
    <text x="120" y="561" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="#f8fafc">
      Fresh Angle
    </text>
    <text x="235" y="560" font-family="system-ui, sans-serif" font-size="14" font-weight="400" fill="#94a3b8">
      • Daily AI &amp; Tech Intelligence
    </text>
  </svg>
  `;

  return sharp(Buffer.from(svg))
    .webp({ quality: 85 })
    .toBuffer();
}
