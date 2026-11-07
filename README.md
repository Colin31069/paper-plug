# 📚 PaperPlug - Free Academic Paper Search for ChatGPT & Gemini

> **100% Free & Open-Access Scholarly Literature Assistant for AI Chat (ChatGPT & Gemini Web)**  
> Eliminates paywalled search limitations, retrieves papers from **OpenAlex (250M+ works)**, **arXiv**, and **Semantic Scholar**, and injects structured, hallucination-resistant academic context directly into your chat.

---

## 🌟 Why PaperPlug?

Standard ChatGPT and Gemini web search features rely on general search engines (Bing / Google Search), often missing paywalled papers, preprints, citation velocities, and open-access PDFs. Commercial academic plugins (e.g., ScholarAI, Consensus) charge heavy monthly subscriptions.

**PaperPlug gives you two flexible ways to use it for free:**
1. **🤖 Native ChatGPT Plugin (Custom GPT Action)**: Placed directly inside ChatGPT! ChatGPT autonomously triggers `searchAcademicPapers` via function calling, parses academic JSON, and generates grounded literature reviews. (Works across ChatGPT Web, iOS, Android, and Desktop apps).
2. **🌐 Chrome / Edge Side Panel Extension**: A client-side browser sidepanel that works across both ChatGPT and Gemini web interfaces without any setup.

---

## 🤖 方式一：將 PaperPlug 裝進 ChatGPT（原生 Custom GPT Action 插件）

詳細請參考 [gpt-action/HOW_TO_CREATE_CHATGPT_PLUGIN.md](file:///e:/Onedrive/Documents/Antigravity/paper-plug/gpt-action/HOW_TO_CREATE_CHATGPT_PLUGIN.md)：
1. **免費用 Cloudflare Workers 部署 API**（每天 100,000 次免費呼叫，30 秒內在網頁貼上 `gpt-action/src/worker.js` 即可上線）。
2. **在 ChatGPT 建立 Custom GPT**：
   - 點擊 ChatGPT 左側「Explore GPTs」 -> 「+ Create」 -> 「Configure」。
   - 填寫 Instructions，並在「Actions」貼上 `gpt-action/openapi.json`。
3. **完成！** 只要在聊天室問「幫我找某某領域的論文」，ChatGPT 就會自動調用 PaperPlug 搜尋並整理摘要回覆你！

---

## 🌐 方式二：瀏覽器原生側邊欄擴充功能 (Chrome / Edge Side Panel)

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
