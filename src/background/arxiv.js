/**
 * arXiv API Client
 * Fast, lightweight Atom XML query and parsing without DOMParser dependencies.
 */
import { normalizeDoi } from './openalex.js';

/**
 * Searches arXiv preprint repository.
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function searchArxiv(query, limit = 8) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodedQuery}&start=0&max_results=${limit}&sortBy=relevance&sortOrder=descending`;

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/atom+xml, application/xml, text/xml'
      }
    });

    if (!res.ok) {
      console.warn(`[PaperPlug] arXiv query failed: HTTP ${res.status}`);
      return [];
    }

    const xmlText = await res.text();
    return parseArxivAtom(xmlText);
  } catch (err) {
    console.error('[PaperPlug] Error fetching from arXiv:', err);
    return [];
  }
}

/**
 * Robust regex-based Atom XML parser compatible with Service Worker execution context.
 */
function parseArxivAtom(xml) {
  const entries = [];
  const entryRegex = /<entry[\s\S]*?<\/entry>/gi;
  let match;
  let rank = 1;

  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[0];

    // Title
    const titleMatch = /<title[\s\S]*?>([\s\S]*?)<\/title>/i.exec(block);
    let title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : 'Untitled';

    // Summary (Abstract)
    const summaryMatch = /<summary[\s\S]*?>([\s\S]*?)<\/summary>/i.exec(block);
    let abstract = summaryMatch ? summaryMatch[1].replace(/\s+/g, ' ').trim() : null;

    // Id / URL
    const idMatch = /<id[\s\S]*?>([\s\S]*?)<\/id>/i.exec(block);
    let absUrl = idMatch ? idMatch[1].trim() : null;

    // Published date & year
    const pubMatch = /<published[\s\S]*?>([\s\S]*?)<\/published>/i.exec(block);
    let year = null;
    if (pubMatch) {
      const parsedYear = new Date(pubMatch[1]).getFullYear();
      if (!isNaN(parsedYear)) year = parsedYear;
    }

    // Authors
    const authors = [];
    const authorRegex = /<author[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi;
    let authorMatch;
    while ((authorMatch = authorRegex.exec(block)) !== null) {
      authors.push(authorMatch[1].trim());
    }

    // DOI (if journal reference exists)
    const doiMatch = /<arxiv:doi[\s\S]*?>([\s\S]*?)<\/arxiv:doi>/i.exec(block);
    const doi = doiMatch ? normalizeDoi(doiMatch[1]) : null;

    // PDF Link
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
      citationCount: 0, // arXiv API does not track citations directly
      authors: authors.slice(0, 5),
      allAuthorsCount: authors.length,
      abstract,
      pdfUrl,
      isOpenAccess: true, // All arXiv papers are Open Access
      url: absUrl,
      source: 'arXiv',
      apiRank: rank++
    });
  }

  return entries;
}
