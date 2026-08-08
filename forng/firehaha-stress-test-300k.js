// @firehaha-plugin {"id":"official.stress-test-300k","name":"30 萬字承壓測試器","version":"1.0.0","author":"Firehaha 官方開發者","description":"安全產生 30 萬字測試專案，量測建立時間、事件迴圈延遲與資料體積，並可一鍵移除測試 Node。"}
(function () {
  "use strict";

  FirehahaPlugins.register({
    id: "official.stress-test-300k",
    name: "30 萬字承壓測試器",
    version: "1.0.0",
    description: "不覆蓋原稿的 30 萬字單 Node／多 Node 壓力測試。",
    setup(api) {
      const core = window.GamebookCore;
      if (!core || !Array.isArray(core.pages)) throw new Error("找不到 GamebookCore，請在新版 Firehaha 編輯器中使用此插件。");
      const TEST_MARK = "__firehahaStress300k";
      let cancelled = false;
      let running = false;
      let lastReport = null;
      const createdIds = new Set();

      const removeStyle = api.addStyle("stress-300k", `
#fhStressButton{position:fixed;right:18px;bottom:178px;z-index:2147481800;border:0;border-radius:999px;padding:10px 14px;background:#9a3412;color:#fff;font-weight:850;box-shadow:0 8px 24px #7c2d1244;cursor:pointer}
#fhStressModal{display:none;position:fixed;left:50%;top:50%;z-index:2147483200;width:min(720px,94vw);height:min(760px,90vh);min-width:320px;min-height:420px;transform:translate(-50%,-50%);resize:both;overflow:hidden;border:1px solid #bf6c4c;border-radius:14px;background:#fff8f4;color:#35150b;box-shadow:0 25px 90px #43140788;grid-template-rows:auto 1fr auto}
#fhStressModal.open{display:grid}.fhs-head{display:flex;justify-content:space-between;align-items:center;padding:11px 14px;background:#9a3412;color:#fff}.fhs-head button,.fhs-actions button,.fhs-controls button{border:1px solid #c78c74;border-radius:8px;background:#fff;color:#7c2d12;padding:8px 11px;font-weight:750;cursor:pointer}.fhs-body{overflow:auto;padding:14px}.fhs-warning{padding:10px;border-left:5px solid #dc6b23;border-radius:7px;background:#fff0df;line-height:1.55}.fhs-controls{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.fhs-controls label{display:grid;gap:4px;font-size:13px}.fhs-controls input,.fhs-controls select{box-sizing:border-box;width:100%;padding:8px;border:1px solid #c8a18f;border-radius:7px;background:#fff}.fhs-controls .wide{grid-column:1/-1}.fhs-check{display:flex!important;grid-template-columns:auto 1fr!important;align-items:start;gap:8px!important}.fhs-check input{width:auto}.fhs-progress{height:18px;border-radius:999px;overflow:hidden;background:#ead7ce}.fhs-progress span{display:block;width:0;height:100%;background:linear-gradient(90deg,#ea580c,#9a3412);transition:width .12s}.fhs-status{margin:8px 0;white-space:pre-wrap;line-height:1.5}.fhs-report{padding:10px;border:1px solid #dab5a5;border-radius:8px;background:#fff;white-space:pre-wrap;font:12px/1.55 ui-monospace,monospace}.fhs-actions{display:flex;justify-content:space-between;gap:8px;padding:10px 14px;border-top:1px solid #dfc4b8;background:#fff}.fhs-actions span{display:flex;gap:7px}.fhs-actions .danger{background:#a51e1e;color:#fff;border-color:#a51e1e}.fhs-actions .primary{background:#9a3412;color:#fff;border-color:#9a3412}.fhs-actions button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:580px){#fhStressModal{inset:0;width:auto;height:auto;min-width:0;min-height:0;transform:none;resize:none;border-radius:0}.fhs-controls{grid-template-columns:1fr}.fhs-controls .wide{grid-column:auto}.fhs-actions{align-items:stretch;flex-direction:column}.fhs-actions span{display:grid;grid-template-columns:1fr 1fr}}
`);

      const button = document.createElement("button");
      button.id = "fhStressButton";
      button.type = "button";
      button.textContent = "🧪 30萬字壓測";
      const modal = document.createElement("section");
      modal.id = "fhStressModal";
      modal.innerHTML = `<header class="fhs-head"><strong>🧪 30 萬字承壓測試器</strong><button type="button" data-fhs-close>關閉</button></header>
<div class="fhs-body"><div class="fhs-warning"><strong>先保存專案：</strong>測試會在目前專案新增大量文字與 Node。預設不改寫既有內容，完成後可一鍵移除測試資料；但如果瀏覽器記憶體不足，仍可能暫時失去回應。</div>
<div class="fhs-controls">
<label>總字元數<input type="number" min="1000" max="1000000" step="1000" value="300000" data-fhs-total></label>
<label>測試 Node 數<input type="number" min="1" max="1000" value="1" data-fhs-nodes></label>
<label>測試模式<select data-fhs-mode><option value="single">單一 Node 極長內文</option><option value="distributed">平均分散到多個 Node</option></select></label>
<label>內容類型<select data-fhs-content><option value="story">繁體中文故事段落</option><option value="tags">故事＋紙本／電子標籤</option><option value="mixed">中英日與符號混合</option></select></label>
<label class="wide fhs-check"><input type="checkbox" checked data-fhs-chain><span>多 Node 模式建立「前往下一節」鏈結（同時測試分歧線與引用）</span></label>
<label class="wide fhs-check"><input type="checkbox" data-fhs-select><span>完成後選取第一個測試 Node（單一 Node 會把 30 萬字載入編輯器，可能明顯停頓）</span></label>
<label class="wide fhs-check"><input type="checkbox" data-fhs-confirm><span>我已保存／備份目前專案，並了解壓測可能讓頁面暫時無回應。</span></label>
</div>
<div class="fhs-progress"><span data-fhs-bar></span></div><div class="fhs-status" data-fhs-status>尚未開始測試。</div><div class="fhs-report" data-fhs-report>測試完成後會顯示建立時間、最大事件延遲、資料大小與記憶體資訊。</div></div>
<footer class="fhs-actions"><span><button type="button" data-fhs-clean>移除測試資料</button><button type="button" data-fhs-report-download>下載報告</button></span><span><button type="button" class="danger" data-fhs-cancel disabled>取消</button><button type="button" class="primary" data-fhs-run>開始壓測</button></span></footer>`;
      document.body.append(button, modal);

      const q = selector => modal.querySelector(selector);
      const setStatus = text => { q("[data-fhs-status]").textContent = text; };
      const setProgress = value => { q("[data-fhs-bar]").style.width = Math.max(0, Math.min(100, value)) + "%"; };
      const nextFrame = () => new Promise(resolve => setTimeout(resolve, 0));
      function formatBytes(bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / 1048576).toFixed(2) + " MB";
      }
      function templates(kind) {
        if (kind === "tags") return [
          "雨水沿著古老旅店的窗框滑落。你聽見走廊盡頭傳來低沉的鐘聲，於是握緊手中的燈。\n[取得:銀色鑰匙]\n[紙本:記錄:聽見午夜鐘聲]\n",
          "守門人凝視著你，沒有立刻回答。\n[隱藏:持有:銀色鑰匙]交出鑰匙\n[紙本:檢定:意志:2d6:>=:8]\n",
          "你翻開冒險紀錄，重新確認一路上留下的線索。\n[紙本:數值:生命值:-1]\n[紙本:勾選:調查過石碑]\n"
        ];
        if (kind === "mixed") return [
          "繁體中文測試：霧中的旅人沿著石階前進。 English stress paragraph: The path continues beyond the gate. 日本語テスト：古い扉の向こうから風が吹いてくる。 ★◆→ 12345\n",
          "標點測試：「引號」、（括號）、——破折號……省略號；emoji 🗝️🎲📖。 HTML-like <tag> & entities should remain text.\n"
        ];
        return [
          "霧氣從山谷緩慢升起，濕潤的石板路延伸到看不見的遠方。旅人停下腳步，確認背包中的乾糧、繩索與那把來歷不明的銀色鑰匙。遠處傳來鐘聲，提醒他必須在天黑以前作出選擇。\n",
          "森林裡沒有真正的寂靜。樹葉彼此摩擦，溪水穿過岩縫，偶爾還能聽見某種巨大生物踩斷枯枝的聲音。你深吸一口氣，繼續向前。\n"
        ];
      }
      function makeText(length, kind, offset) {
        const source = templates(kind), parts = [];
        let count = 0, index = offset || 0;
        while (count < length) {
          const part = source[index++ % source.length];
          const remaining = length - count;
          parts.push(part.length <= remaining ? part : part.slice(0, remaining));
          count += Math.min(part.length, remaining);
        }
        return parts.join("");
      }
      function readConfig() {
        const total = Math.max(1000, Math.min(1000000, Number(q("[data-fhs-total]").value) || 300000));
        let nodeCount = Math.max(1, Math.min(1000, Number(q("[data-fhs-nodes]").value) || 1));
        const mode = q("[data-fhs-mode]").value;
        if (mode === "single") nodeCount = 1;
        return { total, nodeCount, mode, content: q("[data-fhs-content]").value, chain: q("[data-fhs-chain]").checked, select: q("[data-fhs-select]").checked };
      }
      function makePage(index, text) {
        const page = new core.NovelPage();
        page.title = `【壓測】第 ${index + 1} 節`;
        page.text = text;
        page.note = "由 30 萬字承壓測試器建立，可使用插件一鍵移除。";
        page.options = [];
        page.x = 140 + (index % 8) * 240;
        page.y = 140 + Math.floor(index / 8) * 150;
        page[TEST_MARK] = true;
        return page;
      }
      function memoryInfo() {
        const mem = performance && performance.memory;
        return mem ? { usedJSHeapSize: mem.usedJSHeapSize, totalJSHeapSize: mem.totalJSHeapSize, jsHeapSizeLimit: mem.jsHeapSizeLimit } : null;
      }
      function renderReport(report) {
        const memory = report.memoryAfter;
        q("[data-fhs-report]").textContent = [
          `結果：${report.cancelled ? "已取消" : "完成"}`,
          `文字：${report.actualCharacters.toLocaleString()} 字元／${report.createdNodes.toLocaleString()} 個 Node`,
          `建立時間：${report.elapsedMs.toFixed(1)} ms`,
          `平均：${report.createdNodes ? (report.elapsedMs / report.createdNodes).toFixed(2) : "0"} ms／Node`,
          `最大事件迴圈延遲：${report.maxEventLoopLagMs.toFixed(1)} ms`,
          `測試資料 JSON：約 ${formatBytes(report.approxJsonBytes)}`,
          memory ? `JS Heap：${formatBytes(memory.usedJSHeapSize)}／${formatBytes(memory.jsHeapSizeLimit)}` : "JS Heap：瀏覽器未提供記憶體數據",
          `時間：${new Date(report.finishedAt).toLocaleString()}`
        ].join("\n");
      }
      async function runStress() {
        if (running) return;
        if (!q("[data-fhs-confirm]").checked) return api.toast("請先保存專案並勾選備份確認。");
        const config = readConfig();
        running = true; cancelled = false;
        q("[data-fhs-run]").disabled = true; q("[data-fhs-cancel]").disabled = false;
        setProgress(0); setStatus("準備測試資料……");
        const beforeMemory = memoryInfo(), started = performance.now();
        let expectedTick = performance.now() + 50, maxLag = 0;
        const lagTimer = setInterval(() => {
          const now = performance.now(); maxLag = Math.max(maxLag, Math.max(0, now - expectedTick)); expectedTick = now + 50;
        }, 50);
        const pages = [], base = Math.floor(config.total / config.nodeCount), remainder = config.total % config.nodeCount;
        try {
          for (let index = 0; index < config.nodeCount; index++) {
            if (cancelled) break;
            const length = base + (index < remainder ? 1 : 0);
            const page = makePage(index, makeText(length, config.content, index));
            pages.push(page); core.pages.push(page); createdIds.add(page.id);
            if (typeof core.createFlowNode === "function") core.createFlowNode(page);
            if (index % 8 === 0 || index === config.nodeCount - 1) {
              setProgress((index + 1) / config.nodeCount * 82);
              setStatus(`建立測試 Node：${index + 1}／${config.nodeCount}\n已產生約 ${pages.reduce((sum, p) => sum + p.text.length, 0).toLocaleString()} 字元`);
              await nextFrame();
            }
          }
          if (config.chain && pages.length > 1) {
            pages.forEach((page, index) => {
              if (pages[index + 1]) page.options = [{ text: "繼續壓力測試", target: pages[index + 1].id }];
            });
          }
          setProgress(88); setStatus("更新節點連線與預覽……"); await nextFrame();
          if (typeof core.notifyChange === "function") core.notifyChange("stress-test-300k", { characters: config.total, nodes: pages.length });
          else { if (typeof core.drawLines === "function") core.drawLines(); if (typeof core.updatePreview === "function") core.updatePreview(); }
          setProgress(96); await nextFrame();
          if (config.select && pages[0] && typeof core.selectPage === "function") core.selectPage(pages[0]);
          const actualCharacters = pages.reduce((sum, page) => sum + page.text.length, 0);
          const approxJsonBytes = new Blob([JSON.stringify(pages.map(page => ({ id: page.id, title: page.title, text: page.text, options: page.options })))]).size;
          lastReport = { plugin: "official.stress-test-300k", version: "1.0.0", config, cancelled, createdNodes: pages.length, actualCharacters, elapsedMs: performance.now() - started, maxEventLoopLagMs: maxLag, approxJsonBytes, memoryBefore: beforeMemory, memoryAfter: memoryInfo(), finishedAt: Date.now(), userAgent: navigator.userAgent };
          setProgress(100); setStatus(cancelled ? "測試已取消；已建立的測試 Node 可按下方按鈕移除。" : "承壓資料建立完成。請嘗試切換 Node、編輯、保存專案、測試閱讀與 DOCX 輸出。");
          renderReport(lastReport);
        } catch (error) {
          lastReport = { plugin: "official.stress-test-300k", version: "1.0.0", config, cancelled: true, error: String(error && error.stack || error), createdNodes: pages.length, actualCharacters: pages.reduce((sum, page) => sum + page.text.length, 0), elapsedMs: performance.now() - started, maxEventLoopLagMs: maxLag, approxJsonBytes: 0, memoryBefore: beforeMemory, memoryAfter: memoryInfo(), finishedAt: Date.now(), userAgent: navigator.userAgent };
          setStatus("測試中止：" + String(error.message || error)); renderReport(lastReport); console.error(error);
        } finally {
          clearInterval(lagTimer); running = false;
          q("[data-fhs-run]").disabled = false; q("[data-fhs-cancel]").disabled = true;
        }
      }
      function removeTests() {
        if (running) return api.toast("請先取消目前的壓測。");
        const marked = core.pages.filter(page => page && (createdIds.has(page.id) || page[TEST_MARK]));
        if (!marked.length) return api.toast("目前找不到此插件建立的測試 Node。");
        if (!confirm(`將移除 ${marked.length} 個壓測 Node，不會移除其他 Node。確定繼續嗎？`)) return;
        const ids = new Set(marked.map(page => page.id));
        for (let index = core.pages.length - 1; index >= 0; index--) {
          const page = core.pages[index];
          if (!ids.has(page.id)) continue;
          if (page.element && typeof page.element.remove === "function") page.element.remove();
          core.pages.splice(index, 1); createdIds.delete(page.id);
        }
        core.pages.forEach(page => { if (Array.isArray(page.options)) page.options = page.options.filter(option => !ids.has(option && option.target)); });
        if (typeof core.notifyChange === "function") core.notifyChange("stress-test-300k-cleanup", { removed: ids.size });
        setProgress(0); setStatus(`已移除 ${ids.size} 個測試 Node。`); api.toast("壓測資料已移除。");
      }
      function downloadReport() {
        if (!lastReport) return api.toast("尚未產生測試報告。");
        const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob), anchor = document.createElement("a");
        anchor.href = url; anchor.download = `firehaha-stress-${lastReport.actualCharacters || 0}-${Date.now()}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1200);
      }

      button.onclick = () => modal.classList.add("open");
      q("[data-fhs-close]").onclick = () => { if (!running) modal.classList.remove("open"); else api.toast("壓測執行中，請先取消或等待完成。"); };
      q("[data-fhs-mode]").onchange = event => { if (event.target.value === "single") q("[data-fhs-nodes]").value = "1"; else if (Number(q("[data-fhs-nodes]").value) <= 1) q("[data-fhs-nodes]").value = "300"; };
      q("[data-fhs-run]").onclick = runStress;
      q("[data-fhs-cancel]").onclick = () => { cancelled = true; setStatus("正在取消；會在目前批次完成後停止……"); };
      q("[data-fhs-clean]").onclick = removeTests;
      q("[data-fhs-report-download]").onclick = downloadReport;
      api.toast("30 萬字承壓測試器已啟用；請先保存專案。");

      return function cleanup() {
        cancelled = true;
        button.remove(); modal.remove(); removeStyle();
      };
    }
  });
})();
