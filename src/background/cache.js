/**
 * Local Caching System with 48-Hour TTL
 * Uses chrome.storage.local for fast, persistent, zero-configuration storage.
 */

const TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Creates a simple hash key for query string.
 */
function hashQuery(query) {
  let hash = 0;
  const str = query.toLowerCase().trim();
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return `paperplug_q_${Math.abs(hash)}`;
}

/**
 * Gets cached search results if valid.
 */
export async function getCachedQuery(query) {
  try {
    const key = hashQuery(query);
    const result = await chrome.storage.local.get([key]);
    const entry = result[key];

    if (!entry) return null;

    if (Date.now() - entry.timestamp > TTL_MS) {
      // Expired
      await chrome.storage.local.remove([key]);
      return null;
    }

    return entry.papers;
  } catch (err) {
    console.warn('[PaperPlug] Cache read error:', err);
    return null;
  }
}

/**
 * Saves search results to cache with current timestamp.
 */
export async function setCachedQuery(query, papers) {
  try {
    const key = hashQuery(query);
    const entry = {
      query: query.trim(),
      timestamp: Date.now(),
      papers
    };
    await chrome.storage.local.set({ [key]: entry });
  } catch (err) {
    console.warn('[PaperPlug] Cache write error:', err);
  }
}
