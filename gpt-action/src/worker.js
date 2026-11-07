/**
 * PaperPlug ChatGPT Action Backend - Cloudflare Worker
 * Fully serverless, free, zero-maintenance API for ChatGPT Custom GPT Actions.
 * Queries OpenAlex, arXiv, and Semantic Scholar with composite ranking.
 */

// --- Query Distiller ---
function distillQuery(rawQuery) {
  if (!rawQuery || typeof rawQuery !== 'string') return '';
  let cleaned = rawQuery.trim();
  const stopPhrases = [
    /^(can you\s+)?(please\s+)?(find|search|give me|look for|show me|get me|retrieve)\s+(me\s+)?(some\s+)?(academic\s+|scientific\s+)?papers\s+(on|about|regarding|related to|for)\s+/i,
    /^(can you\s+)?(please\s+)?(find|search|give me|look for|tell me about)\s+(research|literature|studies)\s+(on|about|regarding|in)\s+/i,
    /^(what is|what are|explain|describe)\s+the\s+(relationship|connection|correlation|difference)\s+between\s+/i,
    /^(what are|what is)\s+(the\s+)?(recent\s+|latest\s+)?(advances|developments|breakthroughs|findings)\s+(in|on|regarding)\s+/i,
    /^(i need|i want|help me find)\s+(papers|articles|literature|research)\s+(on|about|discussing)\s+/i,
    /^(please\s+)?(summarize|review)\s+(the\s+)?(literature|papers)\s+(on|about)\s+/i
  ];
  for (const pattern of stopPhrases) {
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, '');
      break;
    }
  }
  cleaned = cleaned.replace(/[?.,!;:]+$/g, '').trim();
  return cleaned || rawQuery.trim();
}

// --- DOI & Inverted Index Helpers ---
function normalizeDoi(doi) {
  if (!doi || typeof doi !== 'string') return null;
  return doi.toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '').trim();
}

function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') return null;
  let maxIndex = 0;
  for (const positions of Object.values(invertedIndex)) {
    for (const pos of positions) {
      if (pos > maxIndex) maxIndex = pos;
    }
  }
  const words = new Array(maxIndex + 1);
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }
  return words
    .join(' ')
    .replace(/<[^>]+>/g, '') // Strip JATS XML / HTML
    .replace(/\s+/g, ' ')
    .trim();
}

// --- API Integrations ---

async function fetchOpenAlex(query, limit = 12) {
  try {
    const encoded = encodeURIComponent(query);
    const select = 'id,doi,title,publication_year,cited_by_count,open_access,abstract_inverted_index,authorships';
    const mailto = 'academic-bot@paperplug.org';
    const url = `https://api.openalex.org/works?search=${encoded}&per_page=${limit}&select=${select}&mailto=${mailto}`;

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': `PaperPlug/1.0 (mailto:${mailto})`
      },
      signal: AbortSignal.timeout(4500)
    });

    if (!res.ok) return [];
    const data = await res.json();
    const results = data.results || [];

    return results.map((item, index) => {
      const authors = (item.authorships || []).map(a => a.author?.display_name).filter(Boolean);
      const abstract = reconstructAbstract(item.abstract_inverted_index);
      const doi = normalizeDoi(item.doi);

      return {
        id: item.id || `oa_${index}`,
        doi,
        title: item.title || 'Untitled Paper',
        year: item.publication_year || null,
        citationCount: item.cited_by_count || 0,
        authors: authors.slice(0, 5),
        abstract: abstract || null,
        pdfUrl: item.open_access?.oa_url || null,
        isOpenAccess: Boolean(item.open_access?.is_oa),
        url: item.doi || (item.id ? `https://openalex.org/${item.id}` : null),
        source: 'OpenAlex',
        apiRank: index + 1
      };
    });
  } catch (e) {
    return [];
  }
}

async function fetchSemanticScholar(query, limit = 8) {
  try {
    const encoded = encodeURIComponent(query);
    const fields = 'paperId,title,abstract,year,citationCount,openAccessPdf,authors,tldr,externalIds';
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encoded}&limit=${limit}&fields=${fields}`;

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PaperPlug/1.0 (mailto:academic-bot@paperplug.org)'
      },
      signal: AbortSignal.timeout(3500)
    });
    if (!res.ok) return [];

    const data = await res.json();
    const papers = data.data || [];

    return papers.map((item, index) => {
      const authors = (item.authors || []).map(a => a.name).filter(Boolean);
      const doi = normalizeDoi(item.externalIds?.DOI);
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
        abstract,
        pdfUrl,
        isOpenAccess: Boolean(pdfUrl),
        url: paperUrl,
        source: 'Semantic Scholar',
        apiRank: index + 1
      };
    });
  } catch (e) {
    return [];
  }
}

async function fetchArxiv(query, limit = 8) {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://export.arxiv.org/api/query?search_query=all:${encoded}&start=0&max_results=${limit}&sortBy=relevance&sortOrder=descending`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'PaperPlug/1.0 (mailto:academic-bot@paperplug.org)'
      },
      signal: AbortSignal.timeout(4500)
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const entries = [];
    const entryRegex = /<entry[\s\S]*?<\/entry>/gi;
    let match;
    let rank = 1;

    while ((match = entryRegex.exec(xml)) !== null) {
      const block = match[0];
      const titleMatch = /<title[\s\S]*?>([\s\S]*?)<\/title>/i.exec(block);
      const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : 'Untitled';

      const summaryMatch = /<summary[\s\S]*?>([\s\S]*?)<\/summary>/i.exec(block);
      const abstract = summaryMatch ? summaryMatch[1].replace(/\s+/g, ' ').trim() : null;

      const idMatch = /<id[\s\S]*?>([\s\S]*?)<\/id>/i.exec(block);
      const absUrl = idMatch ? idMatch[1].trim() : null;

      const pubMatch = /<published[\s\S]*?>([\s\S]*?)<\/published>/i.exec(block);
      let year = null;
      if (pubMatch) {
        const d = new Date(pubMatch[1]).getFullYear();
        if (!isNaN(d)) year = d;
      }

      const authors = [];
      const authorRegex = /<author[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi;
      let aMatch;
      while ((aMatch = authorRegex.exec(block)) !== null) {
        authors.push(aMatch[1].trim());
      }

      const doiMatch = /<arxiv:doi[\s\S]*?>([\s\S]*?)<\/arxiv:doi>/i.exec(block);
      const doi = doiMatch ? normalizeDoi(doiMatch[1]) : null;

      let pdfUrl = null;
      const pdfLinkMatch = /<link[^>]+title=["']pdf["'][^>]+href=["']([^"']+)["']/i.exec(block) ||
                           /<link[^>]+href=["']([^"']+)["'][^>]+title=["']pdf["']/i.exec(block);
      if (pdfLinkMatch) {
        pdfUrl = pdfLinkMatch[1];
      } else if (absUrl && absUrl.includes('/abs/')) {
        pdfUrl = absUrl.replace('/abs/', '/pdf/') + '.pdf';
      }

      entries.push({
        id: absUrl || `arxiv_${rank}`,
        doi,
        title,
        year,
        citationCount: 0,
        authors: authors.slice(0, 5),
        abstract,
        pdfUrl,
        isOpenAccess: true,
        url: absUrl,
        source: 'arXiv',
        apiRank: rank++
      });
    }

    return entries;
  } catch (e) {
    return [];
  }
}

// --- Deduplication & Ranking ---

function tokenizeTitle(title) {
  if (!title) return new Set();
  const clean = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = clean.split(/\s+/).filter(w => w.length > 1);
  return new Set(tokens);
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function mergePapers(existing, incoming) {
  return {
    ...existing,
    doi: existing.doi || incoming.doi,
    citationCount: Math.max(existing.citationCount || 0, incoming.citationCount || 0),
    abstract: existing.abstract || incoming.abstract,
    pdfUrl: existing.pdfUrl || incoming.pdfUrl,
    isOpenAccess: existing.isOpenAccess || incoming.isOpenAccess,
    url: existing.url || incoming.url,
    year: existing.year || incoming.year,
    authors: (existing.authors && existing.authors.length > 0) ? existing.authors : incoming.authors,
    source: existing.source === incoming.source ? existing.source : `${existing.source} + ${incoming.source}`,
    apiRank: Math.min(existing.apiRank || 99, incoming.apiRank || 99)
  };
}

function deduplicateAndRank(papers) {
  // 1. Two-tier deduplication
  const doiMap = new Map();
  const nonDoi = [];

  for (const p of papers) {
    if (p.doi) {
      if (doiMap.has(p.doi)) {
        doiMap.set(p.doi, mergePapers(doiMap.get(p.doi), p));
      } else {
        doiMap.set(p.doi, p);
      }
    } else {
      nonDoi.push(p);
    }
  }

  const merged = Array.from(doiMap.values());

  for (const p of nonDoi) {
    const pTokens = tokenizeTitle(p.title);
    let matched = false;
    for (let i = 0; i < merged.length; i++) {
      if (jaccardSimilarity(pTokens, tokenizeTitle(merged[i].title)) >= 0.90) {
        merged[i] = mergePapers(merged[i], p);
        matched = true;
        break;
      }
    }
    if (!matched) merged.push(p);
  }

  // 2. Age-normalized composite ranking
  const currentYear = new Date().getFullYear();
  const k = 60;
  const w1 = 1.0;
  const w2 = 0.35;
  const w3 = 0.25;
  const w4 = 0.20;

  return merged
    .map(p => {
      const rank = p.apiRank || 20;
      const rankScore = 1.0 / (k + rank);

      const age = Math.max(1, currentYear - (p.year || currentYear));
      const velocity = (p.citationCount || 0) / age;
      const velocityScore = Math.log(1 + velocity);

      const hasAbstract = (p.abstract && p.abstract.length > 40) ? 1.0 : 0.0;
      const hasOa = (p.pdfUrl || p.isOpenAccess) ? 1.0 : 0.0;

      const score = (w1 * rankScore) + (w2 * velocityScore) + (w3 * hasAbstract) + (w4 * hasOa);

      return {
        ...p,
        score: parseFloat(score.toFixed(4)),
        citationVelocity: parseFloat(velocity.toFixed(1))
      };
    })
    .sort((a, b) => b.score - a.score);
}

// --- Cloudflare Worker Request Handler ---

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check / root
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'online',
        service: 'PaperPlug ChatGPT Action API',
        endpoints: ['/api/search-papers', '/openapi.json']
      }), { headers: corsHeaders });
    }

    // Search Papers Endpoint
    if (url.pathname === '/api/search-papers') {
      const rawQuery = url.searchParams.get('query');
      if (!rawQuery || !rawQuery.trim()) {
        return new Response(JSON.stringify({
          success: false,
          error: "Missing required 'query' parameter."
        }), { status: 400, headers: corsHeaders });
      }

      const limit = Math.min(15, Math.max(1, parseInt(url.searchParams.get('limit') || '8', 10)));
      const openAccessOnly = url.searchParams.get('open_access_only') === 'true';

      const distilled = distillQuery(rawQuery);

      // Concurrent multi-source fetch
      const [oaRes, s2Res, arxivRes] = await Promise.allSettled([
        fetchOpenAlex(distilled, 12),
        fetchSemanticScholar(distilled, 8),
        fetchArxiv(distilled, 8)
      ]);

      const papersCombined = [
        ...(oaRes.status === 'fulfilled' ? oaRes.value : []),
        ...(s2Res.status === 'fulfilled' ? s2Res.value : []),
        ...(arxivRes.status === 'fulfilled' ? arxivRes.value : [])
      ];

      let ranked = deduplicateAndRank(papersCombined);

      if (openAccessOnly) {
        ranked = ranked.filter(p => p.isOpenAccess && p.pdfUrl);
      }

      const topPapers = ranked.slice(0, limit).map(p => ({
        title: p.title,
        authors: p.authors || [],
        year: p.year,
        citation_count: p.citationCount || 0,
        citation_velocity: p.citationVelocity || 0,
        doi: p.doi,
        paper_url: p.url,
        open_access_pdf_url: p.pdfUrl,
        is_open_access: Boolean(p.isOpenAccess),
        source: p.source,
        abstract: p.abstract
      }));

      return new Response(JSON.stringify({
        success: true,
        query: rawQuery,
        total_found: topPapers.length,
        papers: topPapers
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          // Cache in Cloudflare CDN edge for 2 hours for identical query
          'Cache-Control': 'public, max-age=7200'
        }
      });
    }

    return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
      status: 404,
      headers: corsHeaders
    });
  }
};
