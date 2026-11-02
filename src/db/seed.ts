import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

import { getDb } from './client';
import { categories, tags } from './schema';
import { slugify } from '@/lib/utils/slug';

const DEFAULT_CATEGORIES = [
  {
    name: 'Artificial Intelligence',
    description: 'Foundational breakthroughs, general intelligence research, and societal implications.',
  },
  {
    name: 'Frontier Models & LLMs',
    description: 'Deep dives into modern large language models, reasoning engines, and transformer architectures.',
  },
  {
    name: 'Machine Learning',
    description: 'Practical algorithms, training methodology, fine-tuning, and open-source models.',
  },
  {
    name: 'Robotics & Embodied AI',
    description: 'Physical autonomous systems, spatial intelligence, and robotic foundation models.',
  },
  {
    name: 'Hardware & Silicon',
    description: 'GPUs, TPUs, neural processing units, and high-performance computing clusters.',
  },
];

const DEFAULT_TAGS = [
  'Deep Learning',
  'LLM',
  'Open Source',
  'Reasoning',
  'Transformers',
  'Autonomous Agents',
  'NVIDIA',
  'Benchmarks',
  'Safety & Alignment',
  'Multimodal',
];

export async function seed(): Promise<void> {
  console.log('🌱 Starting database seeding...');
  const db = getDb();

  for (const cat of DEFAULT_CATEGORIES) {
    const slug = slugify(cat.name);
    await db
      .insert(categories)
      .values({
        slug,
        name: cat.name,
        description: cat.description,
      })
      .onConflictDoNothing({ target: categories.slug });
    console.log(`  ✓ Category: ${cat.name}`);
  }

  for (const tagName of DEFAULT_TAGS) {
    const slug = slugify(tagName);
    await db
      .insert(tags)
      .values({
        slug,
        name: tagName,
      })
      .onConflictDoNothing({ target: tags.slug });
    console.log(`  ✓ Tag: ${tagName}`);
  }

  console.log('✅ Seeding complete!');
}

// Execute if run directly
if (require.main === module || process.argv[1]?.includes('seed.ts')) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}
