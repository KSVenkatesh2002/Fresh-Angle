import fs from 'node:fs';
import path from 'node:path';

// Regex to catch raw Tailwind palette colors, hex arbitrary values, and non-semantic white/black classes
const RAW_COLOR_REGEX =
  /\b(?:bg|text|border|ring|fill|stroke|outline|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-[0-9]{2,3})?\b|\b(?:bg|text|border|ring|fill|stroke)-(?:white|black)\b|\b(?:bg|text|border|ring|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]|\b(?:bg|text|border|ring|fill|stroke)-\[(?:rgb|rgba|hsl|hsla)\([^)]+\)\]/g;

const ALLOWED_FILES = new Set(['globals.css']);

let errorCount = 0;

function checkFile(filePath: string): void {
  const fileName = path.basename(filePath);
  if (ALLOWED_FILES.has(fileName)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      return;
    }

    const matches = line.match(RAW_COLOR_REGEX);
    if (matches && matches.length > 0) {
      matches.forEach((matchedClass) => {
        console.error(
          `❌ [RAW COLOR VIOLATION] ${filePath}:${index + 1} -> Found forbidden raw color class "${matchedClass}". Use semantic theme tokens instead (background, surface, surface-muted, foreground, foreground-muted, border, primary, primary-foreground, accent, success, warning, danger, ring).`
        );
        errorCount++;
      });
    }
  });
}

function scanDir(dir: string): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next') {
        scanDir(fullPath);
      }
    } else if (
      entry.isFile() &&
      /\.(tsx?|jsx?|css)$/.test(entry.name)
    ) {
      checkFile(fullPath);
    }
  }
}

console.log('🔍 Checking for raw color classes in src/...');
scanDir(path.resolve(process.cwd(), 'src'));

if (errorCount > 0) {
  console.error(`\n❌ Failed: Found ${errorCount} forbidden raw color class usages.`);
  process.exit(1);
} else {
  console.log('✅ Clean! All components strictly use semantic theme tokens.');
  process.exit(0);
}
