import assert from 'node:assert';
import worker from '../gpt-action/src/worker.js';

console.log('--- Testing Cloudflare Worker Request Handler ---');

async function testWorker() {
  // Test 1: Health check
  const healthReq = new Request('https://paperplug-api.workers.dev/health');
  const healthRes = await worker.fetch(healthReq, {}, {});
  assert.strictEqual(healthRes.status, 200);
  const healthData = await healthRes.json();
  assert.strictEqual(healthData.status, 'online');
  console.log('✓ Health check passed');

  // Test 2: Search endpoint with missing query
  const badReq = new Request('https://paperplug-api.workers.dev/api/search-papers');
  const badRes = await worker.fetch(badReq, {}, {});
  assert.strictEqual(badRes.status, 400);
  console.log('✓ Missing query validation passed');

  // Test 3: Search endpoint with valid query
  console.log('Querying: "quantum computing error correction"...');
  const searchReq = new Request('https://paperplug-api.workers.dev/api/search-papers?query=quantum%20computing%20error%20correction&limit=4');
  const searchRes = await worker.fetch(searchReq, {}, {});
  assert.strictEqual(searchRes.status, 200);
  const searchData = await searchRes.json();

  assert.strictEqual(searchData.success, true);
  assert.ok(searchData.papers.length > 0, 'Should find at least 1 paper');
  console.log(`✓ Search returned ${searchData.papers.length} papers`);

  const top = searchData.papers[0];
  console.log(`Top paper: "${top.title}" (${top.year})`);
  console.log(`  Source: ${top.source}`);
  console.log(`  Citations: ${top.citation_count}`);
  console.log(`  Open Access: ${top.is_open_access}`);
  console.log(`  Abstract exists: ${Boolean(top.abstract)}`);

  console.log('\nAll Cloudflare Worker tests passed! 🎉');
}

testWorker().catch(err => {
  console.error('Worker test failed:', err);
  process.exit(1);
});
