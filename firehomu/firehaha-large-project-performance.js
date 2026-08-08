// @firehaha-plugin {"id":"official.large-project-performance","name":"大型專案效能輔助器","version":"1.0.0","author":"Firehaha 官方開發者","description":"為 30 萬字或 300 Node 以上專案提供自動輕量畫布、超長內文延遲預覽與效能監測。"}
(function () {
  "use strict";

  FirehahaPlugins.register({
    id: "official.large-project-performance",
    name: "大型專案效能輔助器",
    version: "1.0.0",
    description: "大型專案自動降載；不修改作品內容與存檔格式。",
    setup(api) {
      const core = window.GamebookCore;
      if (!core || !Array.isArray(core.pages)) throw new Error("找不到 GamebookCore，請使用新版 Firehaha 編輯器。");
      const KEY = "firehaha.largeProjectPerformance.v1";
      const defaults = { auto: true, enabled: false, characterThreshold: 300000, nodeThreshold: 300, longNodeThreshold: 30000, previewDelay: 550, lightweightCanvas: true, deferOffscreen: true, hideLinesWhilePanning: true, delayLongPreview: true };
      let settings;
      try { settings = Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (_) { settings = Object.assign({}, defaults); }
      let active = false, forced = false, stats = null, scanTimer = 0, previewTimer = 0, bypassInput = false, destroyed = false;

      const removeStyle = api.addStyle("large-project", `
#fhLargeProjectButton{position:fixed;right:18px;bottom:230px;z-index:2147481700;border:0;border-radius:999px;padding:9px 13px;background:#334155;color:#fff;font-weight:850;box-shadow:0 7px 20px #0f172a44;cursor:pointer}#fhLargeProjectButton.active{background:#166534}#fhLargeProjectButton.warn{background:#a16207}
#fhLargeProjectPanel{display:none;position:fixed;right:84px;bottom:76px;z-index:2147483300;width:min(480px,90vw);max-height:82vh;overflow:auto;border:1px solid #8da0b5;border-radius:13px;background:#f8fafc;color:#172033;box-shadow:0 20px 70px #0f172a66}#fhLargeProjectPanel.open{display:block}.fhl-head{display:flex;align-items:center;justify-content:space-between;padding:10px 13px;background:#334155;color:#fff}.fhl-head button,.fhl-actions button{border:1px solid #94a3b8;border-radius:7px;background:#fff;color:#334155;padding:7px 10px;font-weight:750;cursor:pointer}.fhl-body{padding:12px}.fhl-summary{padding:9px;border-left:4px solid #3b82f6;border-radius:6px;background:#eaf3ff;line-height:1.55}.fhl-summary.active{border-color:#16a34a;background:#eaf8ee}.fhl-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}.fhl-grid label{display:grid;gap:4px;font-size:12px}.fhl-grid input{box-sizing:border-box;width:100%;padding:7px;border:1px solid #aab8c7;border-radius:6px}.fhl-switches label{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:start;margin:7px 0;font-size:13px}.fhl-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.fhl-log{margin-top:10px;padding:8px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;white-space:pre-wrap;font:12px/1.5 ui-monospace,monospace}
body.fh-large-project-mode.fh-large-lite .flowNode{animation:none!important;transition:none!important;box-shadow:none!important;text-shadow:none!important;filter:none!important;backdrop-filter:none!important}body.fh-large-project-mode.fh-large-defer .flowNode{content-visibility:auto;contain-intrinsic-size:180px 72px}body.fh-large-project-mode.fh-large-panning #linesCanvas{opacity:0!important}body.fh-large-project-mode #flowPanel{scroll-behavior:auto!important}@media(max-width:600px){#fhLargeProjectPanel{inset:8px;width:auto;max-height:none}}
`);
      const button = document.createElement("button");
      button.id = "fhLargeProjectButton"; button.type = "button"; button.textContent = "⚡ 大型專案";
      const panel = document.createElement("section");
      panel.id = "fhLargeProjectPanel";
      panel.innerHTML = `<header class="fhl-head"><strong>⚡ 大型專案效能輔助器</strong><button type="button" data-fhl-close>關閉</button></header><div class="fhl-body">
<div class="fhl-summary" data-fhl-summary>正在分析專案規模……</div>
<div class="fhl-grid"><label>自動啟動字數<input type="number" min="10000" max="5000000" step="10000" data-fhl="characterThreshold"></label><label>自動啟動 Node 數<input type="number" min="50" max="10000" step="50" data-fhl="nodeThreshold"></label><label>超長 Node 字數<input type="number" min="5000" max="1000000" step="5000" data-fhl="longNodeThreshold"></label><label>預覽延遲（ms）<input type="number" min="100" max="3000" step="50" data-fhl="previewDelay"></label></div>
<div class="fhl-switches"><label><input type="checkbox" data-fhl="auto"><span>達到門檻時自動啟用效能模式</span></label><label><input type="checkbox" data-fhl="lightweightCanvas"><span>關閉 Node 動畫、陰影與昂貴視覺效果</span></label><label><input type="checkbox" data-fhl="deferOffscreen"><span>讓畫面外的 Node 延遲繪製</span></label><label><input type="checkbox" data-fhl="hideLinesWhilePanning"><span>拖動畫布時暫時隱藏連線，放開後恢復</span></label><label><input type="checkbox" data-fhl="delayLongPreview"><span>超長單一 Node 停止逐字重算，停止輸入後再更新</span></label></div>
<div class="fhl-actions"><button type="button" data-fhl-toggle>手動啟用</button><button type="button" data-fhl-scan>重新分析</button><button type="button" data-fhl-save>保存設定</button></div><div class="fhl-log" data-fhl-log>尚無效能事件。</div></div>`;
      document.body.append(button, panel);
      const q = selector => panel.querySelector(selector);

      function countProject() {
        const pages = core.pages.filter(Boolean);
        let characters = 0, longest = 0, options = 0;
        pages.forEach(page => {
          const length = String(page.text || "").length + String(page.note || "").length;
          characters += length; longest = Math.max(longest, length); options += Array.isArray(page.options) ? page.options.length : 0;
        });
        return { characters, nodes: pages.length, options, longest, measuredAt: Date.now() };
      }
      function humanNumber(value) { return Number(value || 0).toLocaleString(); }
      function persist() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (_) {} }
      function applyMode(next, reason) {
        active = Boolean(next);
        document.body.classList.toggle("fh-large-project-mode", active);
        document.body.classList.toggle("fh-large-lite", active && settings.lightweightCanvas);
        document.body.classList.toggle("fh-large-defer", active && settings.deferOffscreen);
        if (!active) document.body.classList.remove("fh-large-panning");
        button.classList.toggle("active", active); button.classList.toggle("warn", !active && stats && (stats.characters >= settings.characterThreshold || stats.nodes >= settings.nodeThreshold));
        button.textContent = active ? "⚡ 效能模式：開" : "⚡ 大型專案";
        q("[data-fhl-toggle]").textContent = active ? "手動關閉" : "手動啟用";
        q("[data-fhl-log]").textContent = `${new Date().toLocaleTimeString()}　${active ? "已啟用" : "已關閉"}\n原因：${reason || "手動操作"}`;
        updateSummary();
      }
      function updateSummary() {
        if (!stats) return;
        const reached = stats.characters >= settings.characterThreshold || stats.nodes >= settings.nodeThreshold;
        const summary = q("[data-fhl-summary]");
        summary.classList.toggle("active", active);
        summary.textContent = `目前專案：${humanNumber(stats.characters)} 字／${humanNumber(stats.nodes)} Node／${humanNumber(stats.options)} 選項\n最長單一 Node：${humanNumber(stats.longest)} 字\n效能模式：${active ? "已啟用" : "未啟用"}${reached ? "（已達大型專案門檻）" : ""}`;
      }
      function analyze(reason) {
        stats = countProject();
        const reached = stats.characters >= settings.characterThreshold || stats.nodes >= settings.nodeThreshold;
        if (settings.auto && !forced && reached !== active) applyMode(reached, reached ? "專案已達自動門檻" : "專案低於自動門檻");
        else { button.classList.toggle("warn", !active && reached); updateSummary(); }
        return stats;
      }
      function scheduleAnalyze(reason) {
        clearTimeout(scanTimer); scanTimer = setTimeout(() => { if (!destroyed) analyze(reason); }, 700);
      }
      function loadControls() {
        panel.querySelectorAll("[data-fhl]").forEach(input => {
          const key = input.dataset.fhl;
          if (!(key in settings)) return;
          if (input.type === "checkbox") input.checked = Boolean(settings[key]); else input.value = settings[key];
        });
      }
      function saveControls() {
        panel.querySelectorAll("[data-fhl]").forEach(input => {
          const key = input.dataset.fhl;
          if (!(key in settings)) return;
          settings[key] = input.type === "checkbox" ? input.checked : Math.max(0, Number(input.value) || defaults[key]);
        });
        persist();
        if (active) applyMode(true, "已套用新的效能設定"); else analyze("設定已更新");
        api.toast("大型專案效能設定已保存。");
      }

      // 超長內文：攔截原本每個字都立即完整重算的 input，停止輸入後補送一次原生事件。
      const textInput = core.dom && core.dom.textInput;
      function delayedLongInput(event) {
        if (!active || !settings.delayLongPreview || bypassInput || event.target !== textInput) return;
        const value = textInput.value || "";
        if (value.length < settings.longNodeThreshold) return;
        event.stopImmediatePropagation();
        if (core.currentPage) core.currentPage.text = value;
        core.projectChanged = true;
        clearTimeout(previewTimer);
        q("[data-fhl-log]").textContent = `${new Date().toLocaleTimeString()}　超長 Node ${humanNumber(value.length)} 字\n已延遲即時預覽，停止輸入 ${settings.previewDelay} ms 後更新。`;
        previewTimer = setTimeout(() => {
          if (destroyed || !textInput) return;
          bypassInput = true;
          try { textInput.dispatchEvent(new Event("input", { bubbles: true })); }
          finally { bypassInput = false; }
          scheduleAnalyze("超長 Node 已更新");
        }, settings.previewDelay);
      }
      if (textInput) document.addEventListener("input", delayedLongInput, true);

      const flowPanel = core.dom && core.dom.flowPanel;
      function panStart(event) {
        if (!active || !settings.hideLinesWhilePanning || !flowPanel || !flowPanel.contains(event.target)) return;
        document.body.classList.add("fh-large-panning");
      }
      function panEnd() { document.body.classList.remove("fh-large-panning"); }
      if (flowPanel) flowPanel.addEventListener("pointerdown", panStart, true);
      window.addEventListener("pointerup", panEnd, true);
      const onProjectChanged = () => scheduleAnalyze("專案內容變更");
      document.addEventListener("gamebook:project:changed", onProjectChanged);

      button.onclick = () => { panel.classList.toggle("open"); if (panel.classList.contains("open")) analyze("開啟控制面板"); };
      q("[data-fhl-close]").onclick = () => panel.classList.remove("open");
      q("[data-fhl-scan]").onclick = () => { analyze("手動重新分析"); api.toast("專案規模分析完成。"); };
      q("[data-fhl-save]").onclick = saveControls;
      q("[data-fhl-toggle]").onclick = () => { forced = true; applyMode(!active, "使用者手動切換"); };
      loadControls(); analyze("插件啟動分析");
      api.toast(active ? "大型專案效能模式已自動啟用。" : "大型專案效能輔助器已待命。");

      window.FirehahaLargeProjectPerformance = Object.freeze({ version: "1.0.0", analyze, enable() { forced = true; applyMode(true, "外部呼叫"); }, disable() { forced = true; applyMode(false, "外部呼叫"); }, get active() { return active; }, get stats() { return stats && Object.assign({}, stats); } });
      return function cleanup() {
        destroyed = true; clearTimeout(scanTimer); clearTimeout(previewTimer);
        if (textInput) document.removeEventListener("input", delayedLongInput, true);
        if (flowPanel) flowPanel.removeEventListener("pointerdown", panStart, true);
        window.removeEventListener("pointerup", panEnd, true);
        document.removeEventListener("gamebook:project:changed", onProjectChanged);
        document.body.classList.remove("fh-large-project-mode", "fh-large-lite", "fh-large-defer", "fh-large-panning");
        button.remove(); panel.remove(); removeStyle();
        delete window.FirehahaLargeProjectPerformance;
      };
    }
  });
})();
