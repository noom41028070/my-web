// @firehaha-plugin {"id":"official.gamebook-inspector","name":"Gamebook 出版健檢器","version":"1.0.0","author":"Firehaha","description":"直接分析 pages/options/UUID 的 Gamebook 結構：壞掉目標、無法抵達 Node、無出口、循環區、節號衝突與 local-image 圖片引用。"}

FirehahaPlugins.register({
  id: "official.gamebook-inspector",
  name: "Gamebook 出版健檢器",
  version: "1.0.0",

  setup(api) {
    "use strict";

    const PANEL_ID = "fh-gamebook-inspector";
    const STYLE_ID = "fh-gamebook-inspector-style";
    let panel = null;
    let lastReport = null;

    const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));

    function getPages() {
      if (Array.isArray(window.pages)) return window.pages;
      try {
        if (typeof pages !== "undefined" && Array.isArray(pages)) return pages;
      } catch (_) {}
      if (window.FirehahaCore && Array.isArray(window.FirehahaCore.pages)) return window.FirehahaCore.pages;
      return [];
    }

    function sectionNumber(page, index) {
      const candidates = [
        page && page.sectionNumber,
        page && page.gamebookSection,
        page && page.section,
        page && page.paperSection
      ];
      for (const value of candidates) {
        const n = Number(value);
        if (Number.isInteger(n) && n > 0) return n;
      }

      const gb = window.FirehahaGamebookSectionNumbering ||
                 window.FirehahaGamebookSections ||
                 window.GamebookSectionNumbering;
      try {
        if (gb) {
          if (typeof gb.getNumber === "function") {
            const n = Number(gb.getNumber(page.id));
            if (Number.isInteger(n) && n > 0) return n;
          }
          if (gb.state && gb.state.numbers) {
            const n = Number(gb.state.numbers[page.id]);
            if (Number.isInteger(n) && n > 0) return n;
          }
        }
      } catch (_) {}
      return null;
    }

    function imageRefs(text) {
      const out = [];
      const re = /\[(?:紙本圖片|img):local-image:\/\/([a-z0-9_-]+)\]/gi;
      let m;
      while ((m = re.exec(String(text || "")))) out.push(m[1]);
      return out;
    }

    async function imageExists(id) {
      try {
        if (window.PixivImageAssets &&
            window.PixivImageAssets.assets &&
            window.PixivImageAssets.assets[id]) return true;
      } catch (_) {}
      try {
        if (window.LocalImageVault && typeof LocalImageVault.getImage === "function") {
          return !!(await LocalImageVault.getImage(id));
        }
      } catch (_) {}
      return false;
    }

    function stronglyConnected(ids, adjacency) {
      let index = 0;
      const stack = [], onStack = new Set(), idx = new Map(), low = new Map(), groups = [];

      function visit(v) {
        idx.set(v, index);
        low.set(v, index++);
        stack.push(v);
        onStack.add(v);

        for (const w of (adjacency.get(v) || [])) {
          if (!idx.has(w)) {
            visit(w);
            low.set(v, Math.min(low.get(v), low.get(w)));
          } else if (onStack.has(w)) {
            low.set(v, Math.min(low.get(v), idx.get(w)));
          }
        }

        if (low.get(v) === idx.get(v)) {
          const group = [];
          let w;
          do {
            w = stack.pop();
            onStack.delete(w);
            group.push(w);
          } while (w !== v);
          groups.push(group);
        }
      }

      ids.forEach(id => { if (!idx.has(id)) visit(id); });
      return groups;
    }

    async function inspect() {
      const list = getPages();
      const byId = new Map(list.filter(Boolean).map(p => [String(p.id), p]));
      const ids = [...byId.keys()];
      const adjacency = new Map(ids.map(id => [id, []]));
      const incoming = new Map(ids.map(id => [id, 0]));
      const brokenTargets = [];
      let optionCount = 0;

      list.forEach((page, pageIndex) => {
        if (!page) return;
        const pid = String(page.id);
        const opts = Array.isArray(page.options) ? page.options : [];
        opts.forEach((opt, optionIndex) => {
          if (!opt) return;
          optionCount++;
          const target = String(opt.target || "").trim();
          if (!target || !byId.has(target)) {
            brokenTargets.push({
              page, pageIndex, optionIndex,
              target: target || "(空白)",
              text: String(opt.text || "")
            });
            return;
          }
          adjacency.get(pid).push(target);
          incoming.set(target, (incoming.get(target) || 0) + 1);
        });
      });

      const startId = list[0] && String(list[0].id);
      const reachable = new Set();
      if (startId && byId.has(startId)) {
        const q = [startId];
        reachable.add(startId);
        while (q.length) {
          const id = q.shift();
          for (const next of adjacency.get(id) || []) {
            if (!reachable.has(next)) {
              reachable.add(next);
              q.push(next);
            }
          }
        }
      }

      const unreachable = list.filter(p => p && !reachable.has(String(p.id)));
      const noExit = list.filter(p => p && (adjacency.get(String(p.id)) || []).length === 0);

      const scc = stronglyConnected(ids, adjacency);
      const trappedCycles = [];
      scc.forEach(group => {
        const selfLoop = group.length === 1 &&
          (adjacency.get(group[0]) || []).includes(group[0]);
        if (group.length < 2 && !selfLoop) return;
        const set = new Set(group);
        let hasExit = false;
        group.forEach(id => {
          (adjacency.get(id) || []).forEach(t => {
            if (!set.has(t)) hasExit = true;
          });
        });
        if (!hasExit) trappedCycles.push(group.map(id => byId.get(id)));
      });

      const sectionMap = new Map();
      const missingSection = [];
      list.forEach((p, i) => {
        if (!p) return;
        const n = sectionNumber(p, i);
        if (n == null) {
          missingSection.push(p);
        } else {
          if (!sectionMap.has(n)) sectionMap.set(n, []);
          sectionMap.get(n).push(p);
        }
      });
      const duplicateSections = [...sectionMap.entries()]
        .filter(([, arr]) => arr.length > 1);

      const refs = [];
      list.forEach((p, i) => imageRefs(p && p.text).forEach(id => refs.push({id, page:p, pageIndex:i})));
      const uniqueImageIds = [...new Set(refs.map(x => x.id))];
      const missingImageIds = new Set();
      for (const id of uniqueImageIds) {
        if (!(await imageExists(id))) missingImageIds.add(id);
      }
      const missingImages = refs.filter(x => missingImageIds.has(x.id));

      const report = {
        createdAt: new Date().toISOString(),
        pages: list.length,
        options: optionCount,
        reachable: reachable.size,
        unreachable,
        noExit,
        brokenTargets,
        trappedCycles,
        duplicateSections,
        missingSection,
        images: uniqueImageIds.length,
        missingImages
      };
      lastReport = report;
      return report;
    }

    function titleOf(page, index) {
      const list = getPages();
      const i = index != null ? index : list.indexOf(page);
      return `${i >= 0 ? "#" + (i + 1) + " " : ""}${String(page?.title || page?.chapterTitle || "未命名 Node")}`;
    }

    function locate(page) {
      if (!page) return;
      try {
        if (typeof window.selectPage === "function") window.selectPage(page);
        else if (typeof selectPage === "function") selectPage(page);
      } catch (_) {}
      try {
        const flow = document.getElementById("flowPanel");
        if (flow && Number.isFinite(Number(page.x)) && Number.isFinite(Number(page.y))) {
          flow.scrollLeft = Math.max(0, Number(page.x) - flow.clientWidth / 2);
          flow.scrollTop = Math.max(0, Number(page.y) - flow.clientHeight / 2);
        }
      } catch (_) {}
      panel?.classList.remove("open");
    }

    function issueRow(icon, text, page, detail) {
      const pIndex = page ? getPages().indexOf(page) : -1;
      return `<div class="fhgi-issue">
        <div><b>${icon} ${esc(text)}</b>${detail ? `<small>${esc(detail)}</small>` : ""}</div>
        ${page ? `<button data-locate="${pIndex}">定位</button>` : ""}
      </div>`;
    }

    function render(r) {
      const problems = r.brokenTargets.length + r.unreachable.length +
        r.trappedCycles.length + r.duplicateSections.length + r.missingImages.length;
      let html = `
        <div class="fhgi-summary">
          <div><b>${r.pages}</b><span>Nodes</span></div>
          <div><b>${r.options}</b><span>選項</span></div>
          <div><b>${r.reachable}</b><span>可抵達</span></div>
          <div><b>${problems}</b><span>警告</span></div>
        </div>`;

      html += `<section><h3>🔗 結構</h3>`;
      if (!r.brokenTargets.length) html += `<p class="ok">✓ 所有選項 target 都存在</p>`;
      r.brokenTargets.forEach(x => html += issueRow("❌", `${titleOf(x.page,x.pageIndex)}：選項目標不存在`, x.page, `${x.text || "未命名選項"} → ${x.target}`));

      if (!r.unreachable.length) html += `<p class="ok">✓ 所有 Node 都能從第一頁抵達</p>`;
      r.unreachable.forEach(p => html += issueRow("⚠️", `${titleOf(p)} 無法從第一頁抵達`, p));

      if (!r.noExit.length) html += `<p class="ok">✓ 所有 Node 都有出口</p>`;
      else {
        html += `<p class="hint">無出口不一定是錯誤，也可能是正常結局。</p>`;
        r.noExit.forEach(p => html += issueRow("ℹ️", `${titleOf(p)} 沒有出口`, p, "請確認它是否為結局"));
      }

      if (!r.trappedCycles.length) html += `<p class="ok">✓ 沒發現封閉循環區</p>`;
      r.trappedCycles.forEach((group,i) => {
        html += issueRow("⚠️", `封閉循環 #${i+1}：${group.length} 個 Node 沒有離開此循環的連線`, group[0],
          group.map(p => p.title || "未命名").join(" → "));
      });
      html += `</section>`;

      html += `<section><h3>📖 紙本節號</h3>`;
      if (!r.duplicateSections.length) html += `<p class="ok">✓ 沒有發現重複節號</p>`;
      r.duplicateSections.forEach(([n,arr]) => html += issueRow("❌", `§${n} 被 ${arr.length} 個 Node 重複使用`, arr[0], arr.map(p=>p.title||"未命名").join("、")));
      if (r.missingSection.length) {
        html += `<p class="hint">ℹ️ ${r.missingSection.length} 個 Node 沒讀到紙本節號；若尚未使用節號插件可忽略。</p>`;
      }
      html += `</section>`;

      html += `<section><h3>🖼 素材</h3>`;
      html += r.images ? `<p class="ok">掃描到 ${r.images} 個 local-image 圖片 ID</p>` : `<p class="hint">目前正文沒有 local-image 圖片引用。</p>`;
      if (!r.missingImages.length && r.images) html += `<p class="ok">✓ 圖片引用都能找到素材</p>`;
      r.missingImages.forEach(x => html += issueRow("❌", `${titleOf(x.page,x.pageIndex)} 找不到圖片`, x.page, `local-image://${x.id}`));
      html += `</section>`;

      panel.querySelector("[data-results]").innerHTML = html;
      panel.querySelectorAll("[data-locate]").forEach(btn => {
        btn.onclick = () => locate(getPages()[Number(btn.dataset.locate)]);
      });
    }

    async function run() {
      const box = panel.querySelector("[data-results]");
      box.innerHTML = `<p class="hint">正在檢查 Story Graph 與素材…</p>`;
      try {
        const r = await inspect();
        render(r);
        api.toast(`健檢完成：${r.pages} Nodes / ${r.options} 選項`);
      } catch (e) {
        console.error(e);
        box.innerHTML = `<p class="bad">檢查失敗：${esc(e?.message || e)}</p>`;
      }
    }

    function exportReport() {
      if (!lastReport) return run().then(exportReport);
      const r = lastReport;
      const lines = [
        "Firehaha Gamebook Inspector",
        `時間：${r.createdAt}`,
        "",
        `Nodes：${r.pages}`,
        `選項：${r.options}`,
        `可抵達：${r.reachable}`,
        `無法抵達：${r.unreachable.length}`,
        `無出口：${r.noExit.length}`,
        `壞掉 target：${r.brokenTargets.length}`,
        `封閉循環：${r.trappedCycles.length}`,
        `重複節號：${r.duplicateSections.length}`,
        `圖片 ID：${r.images}`,
        `遺失圖片引用：${r.missingImages.length}`,
        "",
        "=== 壞掉 target ===",
        ...r.brokenTargets.map(x => `${titleOf(x.page,x.pageIndex)} | ${x.text} -> ${x.target}`),
        "",
        "=== 無法抵達 ===",
        ...r.unreachable.map(p => titleOf(p)),
        "",
        "=== 無出口（可能是結局） ===",
        ...r.noExit.map(p => titleOf(p)),
        "",
        "=== 封閉循環 ===",
        ...r.trappedCycles.map((g,i) => `#${i+1}: ${g.map(p=>p.title||"未命名").join(" -> ")}`),
        "",
        "=== 重複節號 ===",
        ...r.duplicateSections.map(([n,a]) => `§${n}: ${a.map(p=>p.title||"未命名").join("、")}`),
        "",
        "=== 遺失圖片 ===",
        ...r.missingImages.map(x => `${titleOf(x.page,x.pageIndex)} | local-image://${x.id}`)
      ];
      const blob = new Blob([lines.join("\n")], {type:"text/plain;charset=utf-8"});
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "gamebook-inspector-report.txt";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    function buildUI() {
      if (document.getElementById(PANEL_ID)) return;

      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
#${PANEL_ID}{position:fixed;inset:0 0 0 auto;width:min(460px,94vw);z-index:2147483000;background:#fff;color:#222;box-shadow:-8px 0 28px #0003;transform:translateX(105%);transition:.2s;display:flex;flex-direction:column;font-family:system-ui,sans-serif}
#${PANEL_ID}.open{transform:none}
#${PANEL_ID} header{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #ddd;background:#fafafa}
#${PANEL_ID} header b{flex:1}
#${PANEL_ID} button{border:1px solid #bbb;background:#fff;border-radius:8px;padding:7px 10px;cursor:pointer}
#${PANEL_ID} .fhgi-body{padding:12px;overflow:auto;flex:1}
#${PANEL_ID} .fhgi-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
#${PANEL_ID} .fhgi-summary div{background:#f3f4f6;border-radius:10px;padding:9px;text-align:center}
#${PANEL_ID} .fhgi-summary b{display:block;font-size:20px}
#${PANEL_ID} .fhgi-summary span{font-size:11px;color:#666}
#${PANEL_ID} section{border-top:1px solid #eee;margin-top:13px;padding-top:8px}
#${PANEL_ID} h3{margin:5px 0 8px}
#${PANEL_ID} .fhgi-issue{display:flex;gap:8px;align-items:center;padding:8px;border-radius:8px;background:#fff7ed;margin:6px 0}
#${PANEL_ID} .fhgi-issue>div{flex:1;min-width:0}
#${PANEL_ID} small{display:block;color:#666;word-break:break-all;margin-top:2px}
#${PANEL_ID} .ok{color:#166534}
#${PANEL_ID} .hint{color:#666;font-size:12px}
#${PANEL_ID} .bad{color:#b91c1c}
#fh-gamebook-inspector-open{margin-left:6px}
@media(max-width:600px){#${PANEL_ID}{width:100vw}.fhgi-summary{grid-template-columns:repeat(2,1fr)}}
`;
      document.head.appendChild(style);

      panel = document.createElement("div");
      panel.id = PANEL_ID;
      panel.innerHTML = `
        <header>
          <b>🔍 Gamebook Inspector</b>
          <button data-run>重新檢查</button>
          <button data-export>報告</button>
          <button data-close>✕</button>
        </header>
        <div class="fhgi-body"><div data-results><p class="hint">按「重新檢查」分析目前作品。</p></div></div>`;
      document.body.appendChild(panel);
      panel.querySelector("[data-close]").onclick = () => panel.classList.remove("open");
      panel.querySelector("[data-run]").onclick = run;
      panel.querySelector("[data-export]").onclick = exportReport;

      const header = document.querySelector("header");
      if (header) {
        const btn = document.createElement("button");
        btn.id = "fh-gamebook-inspector-open";
        btn.type = "button";
        btn.textContent = "🔍 健檢";
        btn.onclick = () => {
          panel.classList.add("open");
          run();
        };
        header.appendChild(btn);
      }
    }

    buildUI();

    window.FirehahaGamebookInspector = {
      version: "1.0.0",
      inspect,
      open() { panel?.classList.add("open"); return run(); },
      getLastReport() { return lastReport; }
    };

    api.toast("Gamebook 出版健檢器已啟用");

    return () => {
      document.getElementById("fh-gamebook-inspector-open")?.remove();
      document.getElementById(PANEL_ID)?.remove();
      document.getElementById(STYLE_ID)?.remove();
      delete window.FirehahaGamebookInspector;
    };
  }
});
