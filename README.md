# 📚 PaperPlug - Free Academic Paper Search for ChatGPT & Gemini

> **100% Free & Open-Access Scholarly Literature Assistant for AI Chat (ChatGPT & Gemini Web)**  
> Eliminates paywalled search limitations, retrieves papers from **OpenAlex (250M+ works)**, **arXiv**, and **Semantic Scholar**, and injects structured, hallucination-resistant academic context directly into your chat.

---

## 🌟 Why PaperPlug?

Standard ChatGPT and Gemini web search features rely on general search engines (Bing / Google Search), often missing paywalled papers, preprints, citation velocities, and open-access PDFs. Commercial academic plugins (e.g., ScholarAI, Consensus) charge heavy monthly subscriptions.

**PaperPlug is built from the ground up to be completely free, privacy-first, and zero-maintenance:**
- **Zero Server Bills ($0/month)**: Pure client-side Manifest V3 architecture with Chrome's native **Side Panel API**. No intermediary servers or database costs.
- **Independent IP Quotas**: Requests originate from your browser, completely avoiding shared-IP rate limiting (`HTTP 429`) common on cloud proxies.
- **Multi-Source Scholarly Retrieval**:
  - **OpenAlex Polite Pool**: Access to 250M+ scholarly records with high-throughput 100k requests/day.
  - **arXiv**: Real-time preprints across CS, AI, Math, and Physics.
  - **Semantic Scholar (S2)**: AI-generated TLDR summaries and citation counts.
- **Two-Tier Deduplication & Composite Scoring**:
  - Automatically merges identical DOIs and computes title token Jaccard similarity (>0.90) for arXiv preprints.
  - Ranks candidates using **Reciprocal Rank Fusion ($k=60$)** combined with **log-dampened citation velocity ($\text{Citations} / \text{Age}$)** and Open Access availability.
- **Framework-Safe Chat Injection**:
  - Seamlessly injects formatted Markdown references into **ChatGPT** (React + ProseMirror) and **Gemini** (Angular + Quill) via synthetic `ClipboardEvent` paste dispatching.
  - Includes a one-click **Clipboard Copy** fallback so you are never blocked by host DOM updates.

---

## 🚀 Quick Start / Installation Guide

You can load and test PaperPlug in any Chromium-based browser (Chrome, Edge, Brave, Arc) in under 60 seconds:

1. **Open Extensions Management**:
   - In Google Chrome, navigate to `chrome://extensions/`
   - In Microsoft Edge, navigate to `edge://extensions/`
2. **Enable Developer Mode**:
   - Toggle the **"Developer mode"** switch located at the top-right corner.
3. **Load Unpacked**:
   - Click the **"Load unpacked"** (載入未封裝項目) button.
   - Select this folder: `e:\Onedrive\Documents\Antigravity\paper-plug`
4. **Pin the Extension**:
   - Click the puzzle piece icon in your Chrome toolbar and pin **PaperPlug**.

---

## 📖 How to Use

1. **Open ChatGPT or Gemini**:
   - Visit [chatgpt.com](https://chatgpt.com) or [gemini.google.com](https://gemini.google.com).
2. **Open PaperPlug Side Panel**:
   - Click the **PaperPlug** icon in your browser toolbar. The native Chrome Side Panel will open on the right.
   - You will see the status badge indicate **"Connected to ChatGPT"** or **"Connected to Gemini"**.
3. **Search Academic Literature**:
   - Enter your research query or topic (e.g. `direct preference optimization`, `transformer attention`, `quantum error correction`).
   - PaperPlug automatically filters conversational filler phrases and fetches matching papers.
4. **Preview & Filter**:
   - Use quick filter chips (Open Access PDF only, Recent $\le 3$ years, High Citations $\ge 20$).
   - Expand paper abstracts and verify citation metrics.
   - By default, the **Top 5** papers are pre-selected.
5. **Inject into Chat**:
   - Click **"🚀 Inject into Chat"** or press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> (<kbd>Cmd</kbd> + <kbd>Enter</kbd> on macOS).
   - PaperPlug formats the selected literature into a structured Markdown block and pastes it directly into the prompt box!
   - Send the message to ChatGPT or Gemini to get an evidence-grounded literature review!

---

## 🛠️ Project Structure

```text
paper-plug/
├── manifest.json              # Chrome Manifest V3 configuration (Side Panel & Host Permissions)
├── package.json               # Development scripts & test runner
├── README.md                  # Documentation and usage guide
├── assets/                    # Crisp extension icons (16, 32, 48, 128px)
├── src/
│   ├── background/
│   │   ├── service-worker.js  # Background worker & request orchestrator
│   │   ├── openalex.js        # OpenAlex Polite Pool client & inverted index abstract rebuilder
│   │   ├── semanticscholar.js # Semantic Scholar S2 graph client & TLDR extractor
│   │   ├── arxiv.js           # arXiv Atom XML parser (Worker-compatible)
│   │   ├── query-distiller.js # Conversational stop-word stripper & keyword refiner
│   │   ├── ranking.js         # Two-tier deduplication & composite citation ranking
│   │   └── cache.js           # Local storage query cache with 48h TTL
│   ├── content/
│   │   └── content-script.js  # Semantic selector waterfall & framework-safe paste injector
│   └── sidepanel/
│       ├── sidepanel.html     # Native Side Panel user interface
│       ├── sidepanel.css      # Responsive Dark/Light theme stylesheet
│       └── sidepanel.js       # Side panel controller, filters, and prompt generator
└── test/
    ├── pipeline.test.js       # Core algorithm unit test suite
    └── live-fetch.test.js     # Live API retrieval verification test
```

---

## 🧪 Testing

Run core algorithm unit tests:
```bash
npm test
```

Run live API fetch test:
```bash
npm run test:live
```

---

## 📜 License
MIT License - Free for all researchers, students, and developers.
