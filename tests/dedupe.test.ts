import { describe, it, expect } from 'vitest';
import {
  computeJaccardSimilarity,
  computeLevenshteinSimilarity,
  isDuplicateTopic,
} from '@/services/research/dedupe';

describe('Similarity and Duplicate Detection', () => {
  it('computes high Jaccard similarity for overlapping word sets', () => {
    const textA = 'OpenAI releases new reasoning model architecture';
    const textB = 'OpenAI launches new reasoning model architecture';

    const sim = computeJaccardSimilarity(textA, textB);
    expect(sim).toBeGreaterThanOrEqual(0.6);
  });

  it('computes low similarity for distinct topics', () => {
    const textA = 'OpenAI launches new reasoning model o3';
    const textB = 'NVIDIA unveils quantum computing supercomputer architecture';

    const sim = computeJaccardSimilarity(textA, textB);
    expect(sim).toBeLessThan(0.2);
  });

  it('flags near-duplicate topics correctly', () => {
    const pastTitles = [
      'DeepSeek V3 Model Weights Released to Open Source Community',
      'Meta Introduces Llama 3 with 400B Parameters',
    ];

    const duplicateCandidate = 'DeepSeek V3 Model Weights Released to Open Source';
    const result = isDuplicateTopic(duplicateCandidate, pastTitles);

    expect(result.isDuplicate).toBe(true);
    expect(result.score).toBeGreaterThan(0.7);
  });

  it('permits novel topics that have not been covered', () => {
    const pastTitles = [
      'DeepSeek V3 Model Weights Released',
      'Meta Introduces Llama 3',
    ];

    const novelCandidate = 'Mistral Large 2 Demonstrates Exceptional Multilingual Coding';
    const result = isDuplicateTopic(novelCandidate, pastTitles);

    expect(result.isDuplicate).toBe(false);
  });
});
