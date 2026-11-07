/**
 * PaperPlug Background Service Worker
 * Manifest V3 entry point managing scholarly retrieval, deduplication, ranking, and side panel behavior.
 */

import { distillQuery } from './query-distiller.js';
import { searchOpenAlex } from './openalex.js';
import { searchSemanticScholar } from './semanticscholar.js';
import { searchArxiv } from './arxiv.js';
import { deduplicatePapers, rankPapers } from './ranking.js';
import { getCachedQuery, setCachedQuery } from './cache.js';

// Configure Side Panel behavior: open side panel whenever the user clicks the extension icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(err => console.error('[PaperPlug] Failed to configure side panel action:', err));

// Message Listener for requests from Side Panel or Content Scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SEARCH_PAPERS') {
    handlePaperSearch(request.query)
      .then(result => sendResponse(result))
      .catch(error => {
        console.error('[PaperPlug] Search error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }

  if (request.action === 'CLEAR_CACHE') {
    chrome.storage.local.clear().then(() => sendResponse({ success: true }));
    return true;
  }
});

/**
 * Executes multi-source scholarly retrieval pipeline.
 */
async function handlePaperSearch(rawQuery) {
  if (!rawQuery || !rawQuery.trim()) {
    return { success: false, error: 'Empty query provided' };
  }

  const query = rawQuery.trim();

  // 1. Check local cache (48-hour TTL)
  const cached = await getCachedQuery(query);
  if (cached && Array.isArray(cached) && cached.length > 0) {
    return {
      success: true,
      papers: cached,
      query,
      distilledQuery: query,
      cached: true
    };
  }

  // 2. Distill conversational query into academic keywords
  const distilledQuery = distillQuery(query);

  // 3. Parallel fetch across OpenAlex, Semantic Scholar, and arXiv
  const [openAlexRes, s2Res, arxivRes] = await Promise.allSettled([
    searchOpenAlex(distilledQuery, 15),
    searchSemanticScholar(distilledQuery, 10),
    searchArxiv(distilledQuery, 8)
  ]);

  const openAlexPapers = openAlexRes.status === 'fulfilled' ? openAlexRes.value : [];
  const s2Papers = s2Res.status === 'fulfilled' ? s2Res.value : [];
  const arxivPapers = arxivRes.status === 'fulfilled' ? arxivRes.value : [];

  const rawCombined = [...openAlexPapers, ...s2Papers, ...arxivPapers];

  if (rawCombined.length === 0) {
    return {
      success: true,
      papers: [],
      query,
      distilledQuery,
      cached: false
    };
  }

  // 4. Two-tier deduplication (DOI match + Jaccard Title similarity)
  const deduped = deduplicatePapers(rawCombined);

  // 5. Age-normalized composite ranking (RRF + Citation Velocity + Completeness)
  const ranked = rankPapers(deduped);

  // 6. Cache the clean, ranked results
  await setCachedQuery(query, ranked);

  return {
    success: true,
    papers: ranked,
    query,
    distilledQuery,
    cached: false
  };
}
