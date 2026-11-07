/**
 * Distills conversational user prompts into crisp academic keywords.
 * Strips conversational fluff like "can you find papers about..." to optimize
 * BM25 and semantic matching across OpenAlex, arXiv, and Semantic Scholar.
 */
export function distillQuery(rawQuery) {
  if (!rawQuery || typeof rawQuery !== 'string') return '';

  let cleaned = rawQuery.trim();

  // Common conversational prefixes & filler phrases
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

  // Remove trailing question marks or punctuation
  cleaned = cleaned.replace(/[?.,!;:]+$/g, '').trim();

  // If cleaning resulted in an empty string, fallback to original trimmed
  return cleaned || rawQuery.trim();
}
