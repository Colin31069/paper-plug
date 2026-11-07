import { searchOpenAlex } from '../src/background/openalex.js';
import { searchSemanticScholar } from '../src/background/semanticscholar.js';
import { searchArxiv } from '../src/background/arxiv.js';
import { deduplicatePapers, rankPapers } from '../src/background/ranking.js';

console.log('--- Testing Live Scholarly APIs Fetch ---');

async function testLiveRetrieval() {
  const query = 'transformer attention is all you need';
  console.log(`Querying: "${query}"...`);

  const [openAlex, s2, arxiv] = await Promise.all([
    searchOpenAlex(query, 3),
    searchSemanticScholar(query, 3),
    searchArxiv(query, 3)
  ]);

  console.log(`OpenAlex returned: ${openAlex.length} papers`);
  if (openAlex[0]) {
    console.log(`  Sample: "${openAlex[0].title}" (${openAlex[0].year}) - DOI: ${openAlex[0].doi} - OA PDF: ${Boolean(openAlex[0].pdfUrl)}`);
  }

  console.log(`Semantic Scholar returned: ${s2.length} papers`);
  if (s2[0]) {
    console.log(`  Sample: "${s2[0].title}" (${s2[0].year}) - Citations: ${s2[0].citationCount}`);
  }

  console.log(`arXiv returned: ${arxiv.length} papers`);
  if (arxiv[0]) {
    console.log(`  Sample: "${arxiv[0].title}" (${arxiv[0].year}) - PDF: ${arxiv[0].pdfUrl}`);
  }

  const combined = [...openAlex, ...s2, ...arxiv];
  const deduped = deduplicatePapers(combined);
  const ranked = rankPapers(deduped);

  console.log(`\nTotal retrieved: ${combined.length} -> Deduplicated: ${deduped.length}`);
  console.log('Top ranked paper:');
  console.log(`  Title: ${ranked[0]?.title}`);
  console.log(`  Score: ${ranked[0]?.score}`);
  console.log(`  Source: ${ranked[0]?.source}`);
}

testLiveRetrieval().catch(err => {
  console.error('Live fetch test error:', err);
});
