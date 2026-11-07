import assert from 'node:assert';
import { distillQuery } from '../src/background/query-distiller.js';
import { reconstructAbstract, normalizeDoi } from '../src/background/openalex.js';
import { deduplicatePapers, rankPapers } from '../src/background/ranking.js';

console.log('--- Running PaperPlug Core Algorithm Tests ---');

// Test 1: Query Distiller
console.log('Test 1: distillQuery...');
const q1 = distillQuery('can you please find some academic papers on transformer architecture?');
assert.strictEqual(q1.toLowerCase(), 'transformer architecture');

const q2 = distillQuery('what is the relationship between quantum error correction and fault tolerance');
assert.strictEqual(q2.toLowerCase(), 'quantum error correction and fault tolerance');

const q3 = distillQuery('DPO vs PPO reinforcement learning');
assert.strictEqual(q3, 'DPO vs PPO reinforcement learning');
console.log('✓ distillQuery passed');

// Test 2: Inverted Index Abstract Reconstruction & HTML stripping
console.log('Test 2: reconstructAbstract...');
const invertedIndex = {
  '<jats:title>Attention</jats:title>': [0],
  'is': [1],
  'all': [2],
  'you': [3],
  'need.': [4]
};
const abstract = reconstructAbstract(invertedIndex);
assert.strictEqual(abstract, 'Attention is all you need.');
console.log('✓ reconstructAbstract passed');

// Test 3: DOI Normalization
console.log('Test 3: normalizeDoi...');
assert.strictEqual(normalizeDoi('https://doi.org/10.1145/3308558.3313752'), '10.1145/3308558.3313752');
assert.strictEqual(normalizeDoi('http://dx.doi.org/10.48550/arXiv.1706.03762'), '10.48550/arxiv.1706.03762');
console.log('✓ normalizeDoi passed');

// Test 4: Two-Tier Deduplication
console.log('Test 4: deduplicatePapers...');
const samplePapers = [
  {
    id: 'oa_1',
    doi: '10.1000/182',
    title: 'Deep Residual Learning for Image Recognition',
    citationCount: 150000,
    authors: ['He', 'Zhang'],
    abstract: 'Deeper neural networks are more difficult to train.',
    pdfUrl: 'https://arxiv.org/pdf/1512.03385.pdf',
    source: 'OpenAlex',
    apiRank: 1
  },
  {
    id: 's2_1',
    doi: '10.1000/182', // Same DOI
    title: 'Deep Residual Learning for Image Recognition (Conference version)',
    citationCount: 155000, // Higher citation
    authors: ['Kaiming He', 'Xiangyu Zhang'],
    abstract: null,
    pdfUrl: null,
    source: 'Semantic Scholar',
    apiRank: 2
  },
  {
    id: 'arxiv_1',
    doi: null, // No DOI, but identical title
    title: 'Deep Residual Learning for Image Recognition',
    citationCount: 0,
    authors: ['K. He'],
    abstract: 'Preprint abstract',
    pdfUrl: 'https://arxiv.org/pdf/1512.03385.pdf',
    source: 'arXiv',
    apiRank: 1
  }
];

const deduped = deduplicatePapers(samplePapers);
assert.strictEqual(deduped.length, 1, `Expected 1 paper after deduping, got ${deduped.length}`);
assert.strictEqual(deduped[0].citationCount, 155000);
assert.strictEqual(deduped[0].pdfUrl, 'https://arxiv.org/pdf/1512.03385.pdf');
console.log('✓ deduplicatePapers passed');

// Test 5: Age-Normalized Composite Ranking
console.log('Test 5: rankPapers...');
const candidates = [
  {
    id: 'p1',
    title: 'Old Paper with huge citations',
    year: 2005,
    citationCount: 50000,
    abstract: 'A very detailed abstract about foundational discoveries in the field over many years.',
    pdfUrl: 'https://example.com/p1.pdf',
    isOpenAccess: true,
    apiRank: 1
  },
  {
    id: 'p2',
    title: 'Breakthrough Recent Paper',
    year: new Date().getFullYear() - 1, // 1 year old
    citationCount: 5000, // 5000 citations in 1 year = massive velocity!
    abstract: 'Groundbreaking recent breakthrough that completely revolutionizes the field.',
    pdfUrl: 'https://example.com/p2.pdf',
    isOpenAccess: true,
    apiRank: 2
  }
];

const ranked = rankPapers(candidates);
assert.strictEqual(ranked.length, 2);
assert.ok(ranked[0].score > 0);
assert.ok(ranked[1].score > 0);
console.log(`Rank 1: ${ranked[0].title} (Score: ${ranked[0].score}, Velocity: ${ranked[0].citationVelocity}/yr)`);
console.log(`Rank 2: ${ranked[1].title} (Score: ${ranked[1].score}, Velocity: ${ranked[1].citationVelocity}/yr)`);
console.log('✓ rankPapers passed');

console.log('\nAll core unit tests passed successfully! 🎉');
