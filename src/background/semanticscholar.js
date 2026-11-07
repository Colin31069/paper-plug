/**
 * Semantic Scholar API Client (S2)
 * Provides AI-generated TLDR summaries, citation graphs, and abstract fallbacks.
 */
import { normalizeDoi } from './openalex.js';

/**
 * Searches Semantic Scholar papers.
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function searchSemanticScholar(query, limit = 10) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const fields = 'paperId,title,abstract,year,citationCount,openAccessPdf,authors,tldr,externalIds';
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodedQuery}&limit=${limit}&fields=${fields}`;

    const headers = { 'Accept': 'application/json' };

    // Optional user-provided Semantic Scholar API key for higher rate limits
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const stored = await chrome.storage.local.get(['s2_api_key']);
        if (stored?.s2_api_key) {
          headers['x-api-key'] = stored.s2_api_key;
        }
      } catch (e) {}
    }

    const res = await fetch(url, { headers });

    if (!res.ok) {
      // 429 or other rate limit / status code
      console.warn(`[PaperPlug] Semantic Scholar query failed: HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const papers = data.data || [];

    return papers.map((item, index) => {
      const authors = (item.authors || [])
        .map(a => a.name)
        .filter(Boolean);

      const rawDoi = item.externalIds?.DOI || null;
      const doi = normalizeDoi(rawDoi);

      // Clean abstract or prefer TLDR if abstract is absent
      let abstract = item.abstract || null;
      if (item.tldr?.text) {
        abstract = abstract ? `[TLDR]: ${item.tldr.text}\n\n${abstract}` : `[TLDR]: ${item.tldr.text}`;
      }

      const pdfUrl = item.openAccessPdf?.url || null;
      const paperUrl = doi ? `https://doi.org/${doi}` : (item.paperId ? `https://www.semanticscholar.org/paper/${item.paperId}` : null);

      return {
        id: item.paperId || `s2_${index}`,
        doi,
        title: item.title || 'Untitled Paper',
        year: item.year || null,
        citationCount: item.citationCount || 0,
        authors: authors.slice(0, 5),
        allAuthorsCount: authors.length,
        abstract,
        pdfUrl,
        isOpenAccess: Boolean(pdfUrl),
        url: paperUrl,
        source: 'Semantic Scholar',
        apiRank: index + 1
      };
    });
  } catch (err) {
    console.error('[PaperPlug] Error fetching from Semantic Scholar:', err);
    return [];
  }
}
