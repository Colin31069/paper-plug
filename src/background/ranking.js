/**
 * Deduplication & Age-Normalized Composite Ranking Pipeline
 * Implements Argon's recommended Two-Tier Deduplication & Reciprocal Rank Fusion.
 */

/**
 * Tokenizes a title into lowercase alphanumeric tokens for similarity comparison.
 */
function tokenizeTitle(title) {
  if (!title) return new Set();
  const clean = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = clean.split(/\s+/).filter(w => w.length > 1);
  return new Set(tokens);
}

/**
 * Computes Jaccard similarity between two token sets.
 * J(A, B) = |A ∩ B| / |A ∪ B|
 */
function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Merges two duplicate paper objects, preserving the best metadata.
 */
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
    // Prefer lower (better) rank
    apiRank: Math.min(existing.apiRank || 99, incoming.apiRank || 99)
  };
}

/**
 * Two-tier deduplication:
 * Tier 1: Matching DOI.
 * Tier 2: Title Jaccard Similarity > 0.90 for records without matched DOI.
 */
export function deduplicatePapers(papers) {
  const doiMap = new Map();
  const nonDoiPapers = [];

  for (const paper of papers) {
    if (paper.doi) {
      if (doiMap.has(paper.doi)) {
        const merged = mergePapers(doiMap.get(paper.doi), paper);
        doiMap.set(paper.doi, merged);
      } else {
        doiMap.set(paper.doi, paper);
      }
    } else {
      nonDoiPapers.push(paper);
    }
  }

  const mergedList = Array.from(doiMap.values());

  // Deduplicate non-DOI papers against mergedList and each other using title Jaccard
  for (const paper of nonDoiPapers) {
    const paperTokens = tokenizeTitle(paper.title);
    let matched = false;

    for (let i = 0; i < mergedList.length; i++) {
      const existingTokens = tokenizeTitle(mergedList[i].title);
      if (jaccardSimilarity(paperTokens, existingTokens) >= 0.90) {
        mergedList[i] = mergePapers(mergedList[i], paper);
        matched = true;
        break;
      }
    }

    if (!matched) {
      mergedList.push(paper);
    }
  }

  return mergedList;
}

/**
 * Age-normalized composite score calculation:
 * Score = w1 * (1 / (k + Rank)) + w2 * ln(1 + Citations / Age) + w3 * HasAbstract + w4 * HasOpenAccess
 *
 * k = 60 (RRF constant)
 * w1 = 1.0 (API Rank weight)
 * w2 = 0.35 (Citation velocity weight)
 * w3 = 0.25 (Abstract completeness bonus)
 * w4 = 0.20 (Open Access PDF bonus)
 */
export function rankPapers(papers) {
  const currentYear = new Date().getFullYear();
  const k = 60;
  const w1 = 1.0;
  const w2 = 0.35;
  const w3 = 0.25;
  const w4 = 0.20;

  return papers
    .map(paper => {
      const rank = paper.apiRank || 20;
      const rankScore = 1.0 / (k + rank);

      const pubYear = paper.year || currentYear;
      const age = Math.max(1, currentYear - pubYear);
      const citationVelocity = (paper.citationCount || 0) / age;
      const velocityScore = Math.log(1 + citationVelocity);

      const hasAbstract = Boolean(paper.abstract && paper.abstract.length > 40) ? 1.0 : 0.0;
      const hasOpenAccess = Boolean(paper.pdfUrl || paper.isOpenAccess) ? 1.0 : 0.0;

      const compositeScore = (w1 * rankScore) +
                             (w2 * velocityScore) +
                             (w3 * hasAbstract) +
                             (w4 * hasOpenAccess);

      return {
        ...paper,
        score: parseFloat(compositeScore.toFixed(4)),
        citationVelocity: parseFloat(citationVelocity.toFixed(1))
      };
    })
    .sort((a, b) => b.score - a.score);
}
