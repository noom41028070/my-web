// @firehaha-plugin {"id":"official.ultra-long-content-guard","name":"超長內容保護","version":"1.0.0","author":"Firehaha","description":"大型專案與超長 Node 的安全預覽、狀態提示與記憶體保護。"}
(function () {
  "use strict";
  if (window.__firehahaUltraLongContentGuard) return;
  window.__firehahaUltraLongContentGuard = true;

  const PREVIEW_SLICE = 100000;
  let panel;
  let lastDetail = null;

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  function ensurePanel() {
    if (panel) return panel;
    const style = document.createElement("style");
    style.textContent = `
      #fhLongContentGuard{position:fixed;left:16px;bottom:16px;z-index:2147482500;width:min(520px,calc(100vw - 32px));box-sizing:border-box;padding:11px 12px;border:1px solid #d79b31;border-radius:12px;background:#fff8e7;color:#563500;box-shadow:0 10px 32px rgba(90,55,0,.2);font:13px/1.55 system-ui,sans-serif}
      #fhLongContentGuard[hidden]{display:none}
      #fhLongContentGuard strong{display:block;font-size:14px}
      #fhLongContentGuard .fh-lg-meta{margin:3px 0 8px;color:#765527}
      #fhLongContentGuard .fh-lg-actions{display:flex;gap:7px;flex-wrap:wrap}
      #fhLongContentGuard button{padding:6px 9px;border:1px solid #b9862d;border-radius:8px;background:#fff;color:#604000;font-weight:700;cursor:pointer}
      body.fh-large-project .flowNode{transition:none!important;box-shadow:none!important}
      body.fh-large-project #flowCanvas{content-visibility:auto;contain-intrinsic-size:1600px 900px}
      @media(max-width:600px){#fhLongContentGuard{left:8px;right:8px;bottom:8px;width:auto}}
    `;
    document.head.appendChild(style);
    panel = document.createElement("aside");
    panel.id = "fhLongContentGuard";
    panel.hidden = true;
    panel.innerHTML = `
      <strong>🛡️ 超長內容安全模式</strong>
      <div class="fh-lg-meta" data-long-meta></div>
      <div class="fh-lg-actions">
        <button type="button" data-long-slice>預覽目前 Node 前 100,000 字</button>
        <button type="button" data-long-hide>收起提示</button>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector("[data-long-hide]").onclick = () => { panel.hidden = true; };
    panel.querySelector("[data-long-slice]").onclick = previewCurrentSlice;
    return panel;
  }

  function currentPage() {
    return window.GamebookCore && window.GamebookCore.currentPage;
  }

  function previewCurrentSlice() {
    const page = currentPage();
    if (!page) return;
    const full = String(page.text || "");
    const slice = full.slice(0, PREVIEW_SLICE);
    const suffix = full.length > PREVIEW_SLICE
      ? `\n\n—— 安全預覽只顯示前 ${formatNumber(PREVIEW_SLICE)} 字，其餘 ${formatNumber(full.length - PREVIEW_SLICE)} 字仍完整保存 ——`
      : "";
    const pixiv = document.querySelector("#previewText");
    const html = document.querySelector("#htmlPreview");
    if (pixiv) pixiv.textContent = slice + suffix;
    if (html) html.textContent = slice + suffix;
  }

  function show(detail) {
    lastDetail = detail || {};
    const ui = ensurePanel();
    ui.hidden = false;
    ui.querySelector("[data-long-meta]").textContent =
      `Node ${formatNumber(lastDetail.nodeChars)} 字；專案已超過自動預覽安全線。打字、切換與保存照常，僅停止高成本的即時全文預覽。`;
    document.body.classList.add("fh-large-project");
  }

  document.addEventListener("firehaha:long-content-safe-mode", event => show(event.detail));
  window.addEventListener("beforeunload", () => {
    const core = window.GamebookCore;
    const input = document.querySelector("#pageText");
    if (core && core.currentPage && input && core.currentPage.text !== input.value) {
      core.currentPage.text = input.value;
      core.projectChanged = true;
    }
  });

  window.FirehahaLongContentGuard = Object.freeze({
    version: "1.0.0",
    previewCurrentSlice,
    get active() { return !!lastDetail; }
  });
})();
