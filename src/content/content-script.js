/**
 * PaperPlug Content Script
 * Injected into ChatGPT and Gemini web tabs to execute framework-safe prompt injection.
 * Implements Argon's semantic selector waterfall & DataTransfer ClipboardEvent simulation.
 */

(() => {
  // Prevent duplicate execution
  if (window.__PAPERPLUG_CONTENT_SCRIPT_LOADED__) return;
  window.__PAPERPLUG_CONTENT_SCRIPT_LOADED__ = true;

  console.log('[PaperPlug] Content script loaded on host:', window.location.hostname);

  /**
   * Identifies host platform.
   */
  function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes('chatgpt.com') || host.includes('openai.com')) {
      return 'ChatGPT';
    }
    if (host.includes('gemini.google.com')) {
      return 'Gemini';
    }
    return 'Unknown';
  }

  /**
   * Locates the active prompt editor using Argon's semantic selector waterfall.
   */
  function findEditorElement(platform) {
    if (platform === 'ChatGPT') {
      const selectors = [
        '#prompt-textarea',
        'main form div[contenteditable="true"]',
        'div[role="textbox"]',
        'textarea[data-id="root"]',
        'textarea'
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.isConnected) return el;
      }
    } else if (platform === 'Gemini') {
      const selectors = [
        'rich-textarea div[contenteditable="true"]',
        'div[role="textbox"][aria-label*="prompt" i]',
        'div[contenteditable="true"]',
        'textarea'
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.isConnected) return el;
      }
    }
    return null;
  }

  /**
   * Framework-safe prompt injection into ProseMirror (ChatGPT) or Quill (Gemini).
   * Ensures React/Angular internal state sync and enables the "Send" button.
   */
  function injectTextIntoEditor(editorEl, textToInject) {
    if (!editorEl || !editorEl.isConnected) {
      throw new Error('Editor element is disconnected or not found.');
    }

    editorEl.focus();

    // Place cursor at the end of existing content
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editorEl);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    // 1. Primary: Trigger native editor state update via DataTransfer paste event
    let pasteSucceeded = false;
    try {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', textToInject);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
      });
      const dispatched = editorEl.dispatchEvent(pasteEvent);
      pasteSucceeded = dispatched && editorEl.textContent.includes(textToInject.slice(0, 20));
    } catch (e) {
      console.warn('[PaperPlug] ClipboardEvent paste attempt failed, trying fallback:', e);
    }

    // 2. Secondary Fallback: document.execCommand('insertText') + InputEvent
    if (!pasteSucceeded) {
      try {
        document.execCommand('insertText', false, textToInject);
      } catch (err) {
        // Fallback for standard textarea elements
        if (editorEl.tagName.toLowerCase() === 'textarea') {
          const start = editorEl.selectionStart || 0;
          const end = editorEl.selectionEnd || 0;
          editorEl.value = editorEl.value.substring(0, start) + textToInject + editorEl.value.substring(end);
          editorEl.selectionStart = editorEl.selectionEnd = start + textToInject.length;
        }
      }

      // Notify host framework of the input mutation
      editorEl.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: textToInject
      }));
    }

    editorEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Listen for injection commands from Side Panel
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'INJECT_TEXT') {
      const platform = detectPlatform();
      const editorEl = findEditorElement(platform);

      if (!editorEl) {
        sendResponse({
          success: false,
          error: `Could not locate prompt input on ${platform}. Please click into the chat box first.`
        });
        return;
      }

      try {
        injectTextIntoEditor(editorEl, request.text);
        sendResponse({
          success: true,
          platform
        });
      } catch (err) {
        sendResponse({
          success: false,
          error: err.message
        });
      }
    }

    if (request.action === 'GET_PAGE_INFO') {
      sendResponse({
        success: true,
        platform: detectPlatform(),
        hasEditor: Boolean(findEditorElement(detectPlatform()))
      });
    }
  });
})();
