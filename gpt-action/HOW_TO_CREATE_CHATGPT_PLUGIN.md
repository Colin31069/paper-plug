# 🤖 如何將 PaperPlug 做成 ChatGPT 內建的「自訂 GPT 插件（Custom GPT Action）」

這份教學將帶你在 **3 分鐘內**，將 PaperPlug 發布為 ChatGPT 裡面的原生插件（Custom GPT）。完成後，只要在 ChatGPT 聊天，**ChatGPT 就會自動調用此插件搜尋論文、下載摘要並向你報告**！

---

## 步驟一：免費部署 API（使用 Cloudflare Workers，完全免費免伺服器）

因為 ChatGPT 需要透過公開 HTTPS 網址呼叫你的插件，Cloudflare Workers 每天提供 **100,000 次免費請求額度**，且完全不用租主機。

### 方式 A：免安裝任何工具，直接在網頁操作（最推薦）
1. 前往 [Cloudflare 官網](https://dash.cloudflare.com/) 登入或免費註冊帳號。
2. 在左側選單點擊 **Workers & Pages** -> **Create application** -> **Create Worker**。
3. 命名為 `paperplug-api`，點擊 **Deploy**。
4. 部署完成後，點擊 **Edit code**（編輯代碼）。
5. 將專案中的 `gpt-action/src/worker.js` 完整內容複製，覆蓋貼上到 Cloudflare 的編輯器中。
6. 點擊右上角 **Deploy**（保存並部署）。
7. 複製你的 Worker 網址（例如：`https://paperplug-api.<你的帳號名>.workers.dev`）。

### 方式 B：透過終端機指令部署
在專案目錄執行：
```bash
cd gpt-action
npx wrangler deploy
```

---

## 步驟二：在 ChatGPT 中建立 Custom GPT

1. 打開 [ChatGPT 網頁版](https://chatgpt.com/)，點擊左側欄的 **Explore GPTs（探索 GPT）**。
2. 點擊右上角 **+ Create（建立）**，切換到 **Configure（設定）** 標籤頁。

### 填寫基本資料：
* **Name（名稱）**：`PaperPlug Academic Search`
* **Description（簡介）**：`Free academic paper search engine querying OpenAlex (250M+ papers), arXiv, and Semantic Scholar.`
* **Instructions（系統提示詞 / 運作指示）**：
  直接複製貼上下方框內的 Prompt：

```markdown
You are PaperPlug Scholar, an elite academic research assistant with real-time access to global scientific literature databases (OpenAlex, arXiv, and Semantic Scholar) via your custom action.

### Core Workflow:
1. Whenever the user asks for academic papers, research findings, literature reviews, or state-of-the-art methods on any topic, YOU MUST ALWAYS call the `searchAcademicPapers` action.
2. Formulate clean, keyword-dense query parameters for the API (e.g., extract core scientific terms, acronyms, and methodology names, stripping conversational filler words).
3. By default, retrieve the top 6-8 papers.

### Output Structure:
When presenting search results:
- **Paper Title & Year**: Formatted with clickable link to the paper URL/DOI.
- **Authors**: List first 2-3 authors with "et al."
- **Key Metrics**: Citation count, Citation velocity (citations/year), and Open Access PDF availability.
- **Executive Summary**: Provide a grounded 2-3 sentence synthesis of what the paper achieves, its methodology, and major empirical findings based strictly on the retrieved abstract.
- **Open Access Direct PDF**: If `open_access_pdf_url` is provided, highlight it clearly so the user can read the full text with one click.

### Grounding & Research Ethics:
- Never fabricate citations or hallucinate DOIs. Only cite papers returned by the action.
- If a paper has no abstract, report its title, authors, year, and DOI, and state that the abstract is restricted by the publisher.
- Offer proactive follow-up options: "Would you like me to dive deeper into the methodology of paper [X], or compare the empirical results between [X] and [Y]?"
```

---

## 步驟三：加入 Action（綁定 OpenAPI 規範）

1. 在同一個設定頁面往下滑，點擊最下方的 **Create new action（建立新動作）**。
2. 在 **Schema（規格定義）** 欄位中，打開專案的 `gpt-action/openapi.json`：
   * 將裡面的 `https://paperplug-api.workers.dev` 修改為你步驟一獲得的真實 Worker 網址（例如 `https://paperplug-api.myname.workers.dev`）。
   * 將整個 JSON 內容貼入 Schema 框中。
3. 貼上後，下方會自動出現一個綠色的可用動作：
   * `searchAcademicPapers` (`GET /api/search-papers`)
4. 點擊右側的 **Test（測試）** 按鈕，ChatGPT 會立即發送一次測試請求，驗證成功會顯示綠色勾勾！
5. 右上角點擊 **Save（儲存）** 或 **Publish（發布）**：
   * 你可以選擇 **Only me（僅自己使用）**，或者 **Anyone with a link（任何有連結的人）**。

---

## 🚀 成果：如何在對話中調用它？

1. **直接與此 GPT 聊天**：
   在左側選單切換到你剛建好的 `PaperPlug Academic Search`，輸入：
   > 「幫我找最近關於 DPO（Direct Preference Optimization）在大型語言模型應用的代表性論文」

2. **在任何現有 ChatGPT 對話中 @ 呼叫**：
   在一般對話框中輸入 `@PaperPlug Academic Search 幫我找關於量子糾錯表面碼的論文`，ChatGPT 就會無縫調用這款免費外掛！
