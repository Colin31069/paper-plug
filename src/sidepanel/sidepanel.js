/**
 * PaperPlug Side Panel Controller
 * Handles user interactions, filters, rendering, and chat injection.
 */

// State Management
const state = {
  rawPapers: [],
  filteredPapers: [],
  selectedIds: new Set(),
  activeFilters: {
    oa: false,
    recent: false,
    cited: false
  },
  currentQuery: '',
  activeTab: null,
  activePlatform: 'Unknown'
};

// DOM Elements
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const clearBtn = document.getElementById('clearBtn');
const platformIndicator = document.getElementById('platformIndicator');
const statusDot = document.getElementById('statusDot');
const platformName = document.getElementById('platformName');

const filterOa = document.getElementById('filterOa');
const filterRecent = document.getElementById('filterRecent');
const filterCited = document.getElementById('filterCited');

const statusBar = document.getElementById('statusBar');
const statsText = document.getElementById('statsText');
const selectAllBtn = document.getElementById('selectAllBtn');
const deselectAllBtn = document.getElementById('deselectAllBtn');

const resultsContainer = document.getElementById('resultsContainer');
const emptyState = document.getElementById('emptyState');
const loadingState = document.getElementById('loadingState');
const paperList = document.getElementById('paperList');

const actionFooter = document.getElementById('actionFooter');
const selectedCount = document.getElementById('selectedCount');
const tokenEst = document.getElementById('tokenEst');
const injectBtn = document.getElementById('injectBtn');
const copyPromptBtn = document.getElementById('copyPromptBtn');
const toastEl = document.getElementById('toast');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initActiveTabWatcher();
  initEventHandlers();
});

/**
 * Monitors active tab to determine if connected to ChatGPT or Gemini.
 */
async function initActiveTabWatcher() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    state.activeTab = tab;
    updatePlatformUI(tab);
  } catch (err) {
    console.warn('[PaperPlug] Failed to query active tab:', err);
  }

  // Update when tab switches
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      state.activeTab = tab;
      updatePlatformUI(tab);
    } catch (e) {}
  });

  // Update when tab updates URL
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (state.activeTab && state.activeTab.id === tabId && changeInfo.url) {
      state.activeTab = tab;
      updatePlatformUI(tab);
    }
  });
}

function updatePlatformUI(tab) {
  if (!tab || !tab.url) {
    setPlatformStatus('Disconnected', false);
    return;
  }

  if (tab.url.includes('chatgpt.com') || tab.url.includes('chat.openai.com')) {
    state.activePlatform = 'ChatGPT';
    setPlatformStatus('ChatGPT', true);
  } else if (tab.url.includes('gemini.google.com')) {
    state.activePlatform = 'Gemini';
    setPlatformStatus('Gemini', true);
  } else {
    state.activePlatform = 'Other Tab';
    setPlatformStatus('No Chat Open', false);
  }
}

function setPlatformStatus(name, isConnected) {
  platformName.textContent = name;
  statusDot.className = `status-dot ${isConnected ? 'connected' : 'disconnected'}`;
}

/**
 * Event Handlers Setup
 */
function initEventHandlers() {
  // Search Form Submit
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (query) executeSearch(query);
  });

  // Search Input Clear Button Visibility
  searchInput.addEventListener('input', () => {
    clearBtn.style.display = searchInput.value ? 'block' : 'none';
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    searchInput.focus();
  });

  // Sample Query Tags Click
  document.querySelectorAll('.sample-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const q = tag.getAttribute('data-query');
      searchInput.value = q;
      clearBtn.style.display = 'block';
      executeSearch(q);
    });
  });

  // Filter Chips
  filterOa.addEventListener('click', () => toggleFilter('oa', filterOa));
  filterRecent.addEventListener('click', () => toggleFilter('recent', filterRecent));
  filterCited.addEventListener('click', () => toggleFilter('cited', filterCited));

  // Selection Buttons
  selectAllBtn.addEventListener('click', () => {
    state.filteredPapers.forEach(p => state.selectedIds.add(p.id));
    updateSelectionUI();
  });

  deselectAllBtn.addEventListener('click', () => {
    state.selectedIds.clear();
    updateSelectionUI();
  });

  // Inject & Copy Buttons
  injectBtn.addEventListener('click', handleInject);
  copyPromptBtn.addEventListener('click', handleCopyPrompt);

  // Keyboard Shortcut: Ctrl+Enter / Cmd+Enter to Inject
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (state.selectedIds.size > 0) {
        handleInject();
      }
    }
  });
}

function toggleFilter(filterKey, chipEl) {
  state.activeFilters[filterKey] = !state.activeFilters[filterKey];
  chipEl.classList.toggle('active', state.activeFilters[filterKey]);
  applyFiltersAndRender();
}

/**
 * Executes scholarly search via background service worker.
 */
async function executeSearch(query) {
  state.currentQuery = query;
  showLoading(true);

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'SEARCH_PAPERS',
      query
    });

    showLoading(false);

    if (!response || !response.success) {
      showToast(response?.error || 'Search encountered an error.', 'error');
      return;
    }

    state.rawPapers = response.papers || [];

    // Pre-select top 5 papers by default (per Argon's recommendation)
    state.selectedIds.clear();
    state.rawPapers.slice(0, 5).forEach(p => state.selectedIds.add(p.id));

    applyFiltersAndRender();

    if (response.cached) {
      showToast('Loaded instantly from local cache (48h TTL)', 'info');
    }
  } catch (err) {
    showLoading(false);
    showToast(`Failed to connect to background: ${err.message}`, 'error');
  }
}

/**
 * Applies filters (Open Access, Recent, Citations) and re-renders card list.
 */
function applyFiltersAndRender() {
  const currentYear = new Date().getFullYear();

  state.filteredPapers = state.rawPapers.filter(paper => {
    if (state.activeFilters.oa && !paper.isOpenAccess && !paper.pdfUrl) {
      return false;
    }
    if (state.activeFilters.recent && (!paper.year || currentYear - paper.year > 3)) {
      return false;
    }
    if (state.activeFilters.cited && (paper.citationCount || 0) < 20) {
      return false;
    }
    return true;
  });

  renderPapersList();
  updateSelectionUI();
}

/**
 * Renders paper cards.
 */
function renderPapersList() {
  paperList.innerHTML = '';

  if (state.filteredPapers.length === 0) {
    emptyState.style.display = 'block';
    emptyState.querySelector('h3').textContent = 'No matching papers found';
    emptyState.querySelector('p').textContent = 'Try adjusting your filters or search keywords.';
    statusBar.style.display = 'none';
    actionFooter.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  statusBar.style.display = 'flex';
  statsText.textContent = `${state.filteredPapers.length} papers found (Top ranked)`;
  actionFooter.style.display = 'flex';

  state.filteredPapers.forEach((paper, index) => {
    const card = document.createElement('div');
    const isSelected = state.selectedIds.has(paper.id);
    card.className = `paper-card ${isSelected ? 'selected' : ''}`;
    card.dataset.id = paper.id;

    // Authors formatting
    let authorsText = 'Unknown Authors';
    if (paper.authors && paper.authors.length > 0) {
      if (paper.authors.length === 1) {
        authorsText = paper.authors[0];
      } else if (paper.authors.length === 2) {
        authorsText = `${paper.authors[0]} & ${paper.authors[1]}`;
      } else {
        authorsText = `${paper.authors[0]} et al.`;
      }
    }

    const yearText = paper.year ? `${paper.year}` : 'N/A';
    const paperLink = paper.url || (paper.doi ? `https://doi.org/${paper.doi}` : '#');

    card.innerHTML = `
      <div class="card-header">
        <input type="checkbox" class="card-checkbox" ${isSelected ? 'checked' : ''} aria-label="Select paper">
        <div class="card-title-group">
          <a href="${paperLink}" target="_blank" rel="noopener noreferrer" class="card-title" title="Open paper reference">
            ${escapeHtml(paper.title)}
            <span class="ext-icon">↗</span>
          </a>
          <div class="card-meta">
            <span class="authors-text">${escapeHtml(authorsText)}</span>
            <span class="meta-dot">•</span>
            <span class="year-text">${yearText}</span>
            <span class="pill pill-citations" title="${paper.citationCount} Citations (Velocity: ${paper.citationVelocity || 0}/yr)">
              🔥 ${paper.citationCount}
            </span>
            ${paper.pdfUrl ? `
              <a href="${paper.pdfUrl}" target="_blank" rel="noopener noreferrer" class="pill pill-oa" title="Direct Open Access PDF">
                📄 PDF
              </a>
            ` : ''}
            <span class="pill pill-source">${paper.source}</span>
          </div>
        </div>
      </div>
      ${paper.abstract ? `
        <div class="card-abstract-section">
          <button type="button" class="abstract-toggle-btn">
            <span class="arrow">▶</span> Abstract
          </button>
          <div class="abstract-body" style="display: none;">
            ${escapeHtml(paper.abstract)}
          </div>
        </div>
      ` : ''}
    `;

    // Checkbox Toggle
    const checkbox = card.querySelector('.card-checkbox');
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        state.selectedIds.add(paper.id);
        card.classList.add('selected');
      } else {
        state.selectedIds.delete(paper.id);
        card.classList.remove('selected');
      }
      updateSelectionUI();
    });

    // Abstract Accordion Toggle
    const abstractToggleBtn = card.querySelector('.abstract-toggle-btn');
    if (abstractToggleBtn) {
      abstractToggleBtn.addEventListener('click', () => {
        const body = card.querySelector('.abstract-body');
        const arrow = abstractToggleBtn.querySelector('.arrow');
        const isHidden = body.style.display === 'none';
        body.style.display = isHidden ? 'block' : 'none';
        arrow.textContent = isHidden ? '▼' : '▶';
      });
    }

    paperList.appendChild(card);
  });
}

/**
 * Updates Selection counter, estimated tokens, and disabled button states.
 */
function updateSelectionUI() {
  const count = state.selectedIds.size;
  selectedCount.textContent = count;

  // Approximate token calculation: ~4 chars per token across selected titles and abstracts
  let charCount = 0;
  for (const paper of state.rawPapers) {
    if (state.selectedIds.has(paper.id)) {
      charCount += (paper.title || '').length + (paper.abstract || '').length + 200;
    }
  }
  const estTokens = Math.round(charCount / 4);
  tokenEst.textContent = `(~${estTokens} tokens)`;

  injectBtn.disabled = count === 0;
  copyPromptBtn.disabled = count === 0;

  // Sync checkboxes in DOM
  document.querySelectorAll('.paper-card').forEach(card => {
    const id = card.dataset.id;
    const isChecked = state.selectedIds.has(id);
    const cb = card.querySelector('.card-checkbox');
    if (cb) cb.checked = isChecked;
    card.classList.toggle('selected', isChecked);
  });
}

/**
 * Builds Argon's structured grounded prompt template.
 */
function buildStructuredPrompt() {
  const selectedPapers = state.rawPapers.filter(p => state.selectedIds.has(p.id));

  if (selectedPapers.length === 0) return '';

  const paperBlocks = selectedPapers.map((p, idx) => {
    const authorsStr = (p.authors && p.authors.length > 0) ? p.authors.join(', ') : 'N/A';
    const doiUrl = p.doi ? `https://doi.org/${p.doi}` : (p.url || 'N/A');
    const pdfUrl = p.pdfUrl || 'Not available';
    const abstractText = p.abstract ? p.abstract.replace(/\n+/g, ' ') : 'No abstract available.';

    return `[${idx + 1}] **${p.title}** (${p.year || 'N/A'})
- **Authors**: ${authorsStr}
- **Citations**: ${p.citationCount} | **Source**: ${p.source}
- **Link/DOI**: ${doiUrl}
- **Open Access PDF**: ${pdfUrl}
- **Abstract**:
> ${abstractText}`;
  }).join('\n\n');

  return `Please analyze and synthesize the following verified academic literature regarding "${state.currentQuery}":

### Reference Literature:
${paperBlocks}

---
### Research Synthesis Instructions:
Based strictly on the academic literature cited above:
1. Summarize the core methodology, findings, and contributions of each paper.
2. Compare their approaches, trade-offs, and points of divergence.
3. Formulate an evidence-grounded synthesis addressing: "${state.currentQuery}"`;
}

/**
 * Injects prompt directly into active ChatGPT / Gemini tab.
 */
async function handleInject() {
  if (state.selectedIds.size === 0) return;

  const promptText = buildStructuredPrompt();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      showToast('No active browser tab found.', 'error');
      return;
    }

    const isChat = tab.url && (tab.url.includes('chatgpt.com') || tab.url.includes('gemini.google.com') || tab.url.includes('openai.com'));

    if (!isChat) {
      showToast('Please open ChatGPT or Gemini in the active tab to inject.', 'error');
      return;
    }

    // Send injection message to content script
    const res = await chrome.tabs.sendMessage(tab.id, {
      action: 'INJECT_TEXT',
      text: promptText
    });

    if (res && res.success) {
      showToast(`Successfully injected into ${res.platform}! 🚀`, 'success');
    } else {
      // Content script failed or element not found, fallback to copy
      await navigator.clipboard.writeText(promptText);
      showToast(res?.error || 'Could not inject directly; prompt copied to clipboard!', 'info');
    }
  } catch (err) {
    // If content script was not yet loaded on this tab, copy to clipboard as safety net
    await navigator.clipboard.writeText(promptText);
    showToast('Copied formatted prompt to clipboard! (Paste with Ctrl+V into chat)', 'info');
  }
}

/**
 * Clipboard Safety Net: Copies formatted prompt to clipboard.
 */
async function handleCopyPrompt() {
  if (state.selectedIds.size === 0) return;

  const promptText = buildStructuredPrompt();
  try {
    await navigator.clipboard.writeText(promptText);
    showToast('Prompt copied to clipboard! 📋', 'success');
  } catch (err) {
    showToast('Failed to copy to clipboard.', 'error');
  }
}

/**
 * Toast notifications.
 */
function showToast(message, type = 'info') {
  toastEl.textContent = message;
  toastEl.className = `toast show ${type}`;
  setTimeout(() => {
    toastEl.className = 'toast';
  }, 3200);
}

function showLoading(isLoading) {
  loadingState.style.display = isLoading ? 'block' : 'none';
  if (isLoading) {
    emptyState.style.display = 'none';
    paperList.style.display = 'none';
    statusBar.style.display = 'none';
    actionFooter.style.display = 'none';
  } else {
    paperList.style.display = 'flex';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
