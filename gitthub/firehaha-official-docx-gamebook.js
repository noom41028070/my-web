// @firehaha-plugin {"id":"official.docx-gamebook","name":"DOCX 紙本 Gamebook 工作室","version":"0.2.0","author":"Firehaha 官方開發者","description":"將 Node 專案與紙本標籤轉譯成人類易懂的文字，輸出可編輯、可點擊跳轉的 DOCX 遊戲書。"}
(function () {
  "use strict";

  FirehahaPlugins.register({
    id: "official.docx-gamebook",
    name: "DOCX 紙本 Gamebook 工作室",
    version: "0.2.0",
    description: "紙本標籤人話轉譯、自動段落編號、路線檢查與 DOCX 輸出。",
    setup(api) {
      const core = window.GamebookCore || null;
      const NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
      const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
      const PAGE_SIZES = {
        A4: { w: 11906, h: 16838, label: "A4" },
        A5: { w: 8391, h: 11906, label: "A5" },
        B5: { w: 9979, h: 14173, label: "B5" },
        Letter: { w: 12240, h: 15840, label: "Letter" }
      };

      function esc(value) {
        return String(value == null ? "" : value)
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
      }
      function stripHtml(value) {
        return String(value == null ? "" : value)
          .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p\s*>/gi, "\n")
          .replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ")
          .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&amp;/gi, "&")
          .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'");
      }
      function safeName(value, fallback) {
        const text = String(value || fallback || "gamebook").trim()
          .replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ");
        return text || "gamebook";
      }
      function bookmarkName(id, index) {
        let name = "N_" + String(id || index + 1).replace(/[^A-Za-z0-9_]/g, "_");
        if (name.length > 38) name = name.slice(0, 38);
        return name;
      }
      function seededRandom(seed) {
        let state = 2166136261 >>> 0;
        String(seed || "firehaha").split("").forEach(ch => {
          state ^= ch.charCodeAt(0); state = Math.imul(state, 16777619) >>> 0;
        });
        return function () {
          state += 0x6D2B79F5;
          let t = state; t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }
      function orderPages(source, mode, seed) {
        const pages = Array.from(source || []).filter(Boolean);
        if (mode === "canvas") {
          return pages.sort((a, b) => (Number(a.y) || 0) - (Number(b.y) || 0) || (Number(a.x) || 0) - (Number(b.x) || 0));
        }
        if (mode === "random") {
          const rand = seededRandom(seed);
          for (let i = pages.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [pages[i], pages[j]] = [pages[j], pages[i]];
          }
        }
        return pages;
      }
      function paperText(value) {
        let text = stripHtml(value);
        function signedValue(name, raw) {
          const amount = Number(raw);
          if (!Number.isFinite(amount)) return `調整「${name}」的數值：${raw}。`;
          if (amount > 0) return `在冒險紀錄表上，將「${name}」增加 ${amount} 點。`;
          if (amount < 0) return `在冒險紀錄表上，將「${name}」減少 ${Math.abs(amount)} 點。`;
          return `「${name}」的數值維持不變。`;
        }
        function checkSentence(name, dice, operator, target) {
          const op = ({ ">=": "達到或高於", ">": "高於", "<=": "不高於", "<": "低於", "=": "等於", "==": "等於" })[operator] || operator;
          return `進行「${name}」檢定：擲 ${dice}。若結果${op} ${target}，檢定成功；否則檢定失敗。`;
        }
        text = text
          .replace(/\[紙本:分頁\]/g, "")
          .replace(/\[紙本:取得:([^\]]+)\]/g, (_, item) => `在冒險紀錄表的物品欄寫下「${item}」。`)
          .replace(/\[紙本:失去:([^\]]+)\]/g, (_, item) => `從冒險紀錄表的物品欄劃除「${item}」。`)
          .replace(/\[紙本:記錄:([^\]]+)\]/g, (_, flag) => `在冒險紀錄表上勾選事件「${flag}」。`)
          .replace(/\[紙本:劃除記錄:([^\]]+)\]/g, (_, flag) => `從冒險紀錄表上劃除事件「${flag}」。`)
          .replace(/\[紙本:若持有:([^\]]+)\]/g, (_, item) => `如果你持有「${item}」，可以選擇：`)
          .replace(/\[紙本:若未持有:([^\]]+)\]/g, (_, item) => `如果你沒有「${item}」，可以選擇：`)
          .replace(/\[紙本:若記錄:([^\]]+)\]/g, (_, flag) => `如果你已記錄事件「${flag}」，可以選擇：`)
          .replace(/\[紙本:若未記錄:([^\]]+)\]/g, (_, flag) => `如果你尚未記錄事件「${flag}」，可以選擇：`)
          .replace(/\[紙本:數值:([^:\]]+):([+-]?\d+(?:\.\d+)?)\]/g, (_, name, amount) => signedValue(name, amount))
          .replace(/\[紙本:填寫:([^:\]]+):預設=([^\]]*)\]/g, (_, name, initial) => `${name}：${initial || "__________"}／__________`)
          .replace(/\[紙本:填寫:([^\]]+)\]/g, (_, name) => `${name}：____________________`)
          .replace(/\[紙本:勾選:([^\]]+)\]/g, (_, label) => `□ ${label}`)
          .replace(/\[紙本:檢定:([^:\]]+):([^:\]]+):(>=|<=|==|>|<|=):([^\]]+)\]/g, (_, name, dice, op, target) => checkSentence(name, dice, op, target))
          .replace(/\[紙本:紀錄表\]/g, "請在冒險紀錄表上更新目前的物品、事件與數值。")
          .replace(/\[紙本樣式:警告\]([\s\S]*?)\[\/紙本樣式\]/g, "注意：$1")
          .replace(/\[紙本樣式:規則\]([\s\S]*?)\[\/紙本樣式\]/g, "規則：$1")
          .replace(/\[紙本樣式:引言\]([\s\S]*?)\[\/紙本樣式\]/g, "「$1」")
          .replace(/\[紙本樣式:[^\]]+\]([\s\S]*?)\[\/紙本樣式\]/g, "$1")
          // 電子標籤沒有紙本覆寫時，採用相同的人話規則。
          .replace(/\[隱藏:持有:([^\]]+)\]/g, (_, item) => `如果你持有「${item}」，可以選擇：`)
          .replace(/\[隱藏:未持有:([^\]]+)\]/g, (_, item) => `如果你沒有「${item}」，可以選擇：`)
          .replace(/\[隱藏:旗幟:([^\]]+)\]/g, (_, flag) => `如果你已記錄事件「${flag}」，可以選擇：`)
          .replace(/\[隱藏:未旗幟:([^\]]+)\]/g, (_, flag) => `如果你尚未記錄事件「${flag}」，可以選擇：`)
          .replace(/\[隱藏:骰子:([^\]]+)\]/g, (_, result) => `如果最近一次檢定符合「${result}」，可以選擇：`)
          .replace(/\[取得:([^\]]+)\]/g, (_, item) => `在冒險紀錄表的物品欄寫下「${item}」。`)
          .replace(/\[失去:([^\]]+)\]/g, (_, item) => `從冒險紀錄表的物品欄劃除「${item}」。`)
          .replace(/\[旗幟:([^\]]+)\]/g, (_, flag) => `在冒險紀錄表上勾選事件「${flag}」。`)
          .replace(/\[移除旗幟:([^\]]+)\]/g, (_, flag) => `從冒險紀錄表上劃除事件「${flag}」。`)
          .replace(/\[屬性:([^=:\]]+)[=:]([^\]]+)\]/g, (_, name, value) => `在冒險紀錄表上將屬性「${name}」記為 ${value}。`)
          .replace(/\[技能:([^=:\]]+)[=:]([^\]]+)\]/g, (_, name, value) => `在冒險紀錄表上將技能「${name}」記為 ${value}。`)
          .replace(/\[檢定:([^:\]]+):([^:\]]+):(>=|<=|==|>|<|=):([^\]]+)\]/g, (_, name, dice, op, target) => checkSentence(name, dice, op, target))
          .replace(/\[傷害骰:([^:\]]+):([^\]]+)\]/g, (_, name, dice) => `使用「${name}」造成傷害時，擲 ${dice} 決定傷害。`)
          .replace(/\[noback\]/gi, "").replace(/\[nosave\]/gi, "")
          .replace(/\[savepoint:([^\]]+)\]/gi, (_, name) => `你可以在此記錄存檔點「${name}」。`)
          .replace(/\[紙本:([^\]]+)\]/g, (_, instruction) => `紙本指示：${instruction.replace(/:/g, "／")}。`);
        return text.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      }
      function buildManuscript(sourcePages, settings) {
        settings = Object.assign({ order: "current", seed: "firehaha", start: 1 }, settings || {});
        const ordered = orderPages(sourcePages, settings.order, settings.seed);
        const numberById = new Map();
        ordered.forEach((page, index) => numberById.set(page.id, Number(settings.start || 1) + index));
        return ordered.map((page, index) => ({
          id: page.id,
          number: numberById.get(page.id),
          bookmark: bookmarkName(page.id, index),
          title: stripHtml(page.title || "未命名段落").trim() || "未命名段落",
          text: paperText(page.text || page.note || ""),
          forcePageBreak: /\[紙本:分頁\]/.test(String(page.text || page.note || "")),
          choices: Array.from(page.options || []).filter(option => option && String(option.text || "").trim()).map(option => ({
            text: paperText(option.text),
            targetId: option.target || "",
            targetNumber: numberById.has(option.target) ? numberById.get(option.target) : null,
            targetBookmark: numberById.has(option.target) ? bookmarkName(option.target, ordered.findIndex(p => p.id === option.target)) : ""
          }))
        }));
      }
      function validate(sourcePages) {
        const pages = Array.from(sourcePages || []).filter(Boolean);
        const ids = new Set(pages.map(page => page.id));
        const incoming = new Map(pages.map(page => [page.id, 0]));
        const issues = [];
        pages.forEach((page, index) => {
          const options = Array.from(page.options || []).filter(Boolean);
          if (!options.some(option => option.target)) issues.push({ level: "info", node: index + 1, text: "沒有連往其他段落的選項（可能是結局）。" });
          options.forEach((option, optionIndex) => {
            if (!option.target) issues.push({ level: "warn", node: index + 1, text: `選項 ${optionIndex + 1} 尚未設定目標。` });
            else if (!ids.has(option.target)) issues.push({ level: "error", node: index + 1, text: `選項 ${optionIndex + 1} 指向不存在的 Node。` });
            else incoming.set(option.target, (incoming.get(option.target) || 0) + 1);
          });
        });
        pages.forEach((page, index) => {
          if (index > 0 && incoming.get(page.id) === 0) issues.push({ level: "warn", node: index + 1, text: "沒有任何選項連入這個 Node。" });
        });
        return issues;
      }

      function xmlTextRun(text, props) {
        const preserve = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : "";
        return `<w:r>${props || ""}<w:t${preserve}>${esc(text)}</w:t></w:r>`;
      }
      function paragraph(text, style, options) {
        options = options || {};
        const pPr = [style ? `<w:pStyle w:val="${esc(style)}"/>` : "", options.keepNext ? "<w:keepNext/>" : "", options.pageBreakBefore ? "<w:pageBreakBefore/>" : "", options.align ? `<w:jc w:val="${esc(options.align)}"/>` : ""].join("");
        const runs = String(text || "").split("\n").map((line, index) => (index ? "<w:r><w:br/></w:r>" : "") + xmlTextRun(line, options.runProps || "")).join("");
        return `<w:p><w:pPr>${pPr}</w:pPr>${runs}</w:p>`;
      }
      function choiceParagraph(choice) {
        const label = choice.targetNumber == null ? `${choice.text}（目標未設定）` : `${choice.text}，前往 ${choice.targetNumber}。`;
        const run = xmlTextRun(label, '<w:rPr><w:color w:val="1F5E8C"/><w:u w:val="single"/></w:rPr>');
        const content = choice.targetBookmark ? `<w:hyperlink w:anchor="${esc(choice.targetBookmark)}" w:history="1">${run}</w:hyperlink>` : run;
        return `<w:p><w:pPr><w:pStyle w:val="Choice"/><w:keepNext/></w:pPr>${content}</w:p>`;
      }
      function pageGeometry(settings) {
        const size = PAGE_SIZES[settings.pageSize] || PAGE_SIZES.A5;
        const margin = Math.max(360, Math.round(Number(settings.marginCm || 1.8) / 2.54 * 1440));
        return `<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="${size.w}" w:h="${size.h}"/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="420" w:footer="420" w:gutter="0"/><w:cols w:space="720"/><w:docGrid w:linePitch="312"/></w:sectPr>`;
      }
      function documentXml(manuscript, settings) {
        const body = [];
        let bookmarkId = 10;
        if (settings.cover) {
          body.push(paragraph(settings.title || "未命名作品", "BookTitle", { align: "center" }));
          if (settings.author) body.push(paragraph(settings.author, "BookSubtitle", { align: "center" }));
          body.push(paragraph(`共 ${manuscript.length} 個段落`, "BookMeta", { align: "center" }));
          body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
        }
        manuscript.forEach((section, index) => {
          const breakBefore = Boolean(index > 0 && (settings.eachNodePage || section.forcePageBreak));
          body.push(`<w:p><w:pPr><w:pStyle w:val="Heading1"/>${breakBefore ? "<w:pageBreakBefore/>" : ""}<w:keepNext/></w:pPr><w:bookmarkStart w:id="${bookmarkId}" w:name="${esc(section.bookmark)}"/>${xmlTextRun(String(section.number), '<w:rPr><w:b/><w:color w:val="173A5E"/></w:rPr>')}<w:bookmarkEnd w:id="${bookmarkId}"/></w:p>`);
          bookmarkId++;
          if (settings.showTitles && section.title) body.push(paragraph(section.title, "Heading2", { keepNext: true }));
          if (section.text) section.text.split(/\n\s*\n/).forEach(block => body.push(paragraph(block, "Normal")));
          section.choices.forEach(choice => body.push(choiceParagraph(choice)));
        });
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${NS}" xmlns:r="${REL_NS}"><w:body>${body.join("")}${pageGeometry(settings)}</w:body></w:document>`;
      }
      function stylesXml(settings) {
        const font = esc(settings.font || "Noto Serif CJK TC");
        const size = Math.max(16, Math.round(Number(settings.fontSize || 11) * 2));
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${NS}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:lang w:val="zh-TW" w:eastAsia="zh-TW"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/><w:widowControl/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="BookTitle"><w:name w:val="Book Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="2400" w:after="240"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:color w:val="173A5E"/><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="BookSubtitle"><w:name w:val="Book Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="160"/><w:jc w:val="center"/></w:pPr><w:rPr><w:color w:val="555555"/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="BookMeta"><w:name w:val="Book Meta"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240"/><w:jc w:val="center"/></w:pPr><w:rPr><w:color w:val="777777"/><w:sz w:val="20"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="360" w:after="200"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="173A5E"/><w:sz w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="2E5D7B"/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Choice"><w:name w:val="Gamebook Choice"/><w:basedOn w:val="Normal"/><w:pPr><w:keepLines/><w:spacing w:before="60" w:after="80"/><w:ind w:left="360" w:hanging="180"/></w:pPr></w:style>
</w:styles>`;
      }
      function footerXml(settings) {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="${NS}"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:color w:val="777777"/><w:sz w:val="18"/></w:rPr><w:t>${esc(settings.title || "Gamebook")} · </w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:rPr><w:color w:val="777777"/><w:sz w:val="18"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`;
      }
      function packageFiles(manuscript, settings) {
        const now = new Date().toISOString();
        return {
          "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
          "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
          "docProps/core.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(settings.title || "Gamebook")}</dc:title><dc:creator>${esc(settings.author || "Firehaha 作者")}</dc:creator><cp:lastModifiedBy>Firehaha DOCX Plugin</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`,
          "docProps/app.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Firehaha Gamebook Studio</Application><AppVersion>0.1</AppVersion></Properties>`,
          "word/document.xml": documentXml(manuscript, settings),
          "word/styles.xml": stylesXml(settings),
          "word/settings.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="${NS}"><w:zoom w:percent="100"/><w:updateFields w:val="true"/><w:compat/></w:settings>`,
          "word/footer1.xml": footerXml(settings),
          "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`
        };
      }

      const crcTable = (() => {
        const table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
          let c = n;
          for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
          table[n] = c >>> 0;
        }
        return table;
      })();
      function crc32(bytes) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
      }
      function u16(value) { return new Uint8Array([value & 255, (value >>> 8) & 255]); }
      function u32(value) { return new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]); }
      function join(parts) {
        const size = parts.reduce((sum, part) => sum + part.length, 0), out = new Uint8Array(size);
        let offset = 0; parts.forEach(part => { out.set(part, offset); offset += part.length; }); return out;
      }
      function zipStore(files) {
        const encoder = new TextEncoder(), locals = [], centrals = [];
        let offset = 0, count = 0;
        Object.entries(files).forEach(([filename, value]) => {
          const name = encoder.encode(filename), data = encoder.encode(String(value)), crc = crc32(data);
          const local = join([u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data]);
          const central = join([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]);
          locals.push(local); centrals.push(central); offset += local.length; count++;
        });
        const centralData = join(centrals);
        return join([...locals, centralData, u32(0x06054b50), u16(0), u16(0), u16(count), u16(count), u32(centralData.length), u32(offset), u16(0)]);
      }
      function buildDocx(sourcePages, settings) {
        const manuscript = buildManuscript(sourcePages, settings);
        return new Blob([zipStore(packageFiles(manuscript, settings))], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      }
      function download(blob, filename) {
        const url = URL.createObjectURL(blob), anchor = document.createElement("a");
        anchor.href = url; anchor.download = filename; anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      }

      const publicCore = Object.freeze({ version: "0.2.0", PAGE_SIZES, paperText, orderPages, buildManuscript, validate, buildDocx });
      window.FirehahaDocxPaperCore = publicCore;
      if (typeof document === "undefined") return;

      const removeStyle = api.addStyle("docx-gamebook", `
#fhDocxButton{position:fixed;right:18px;bottom:126px;z-index:2147481900;border:0;border-radius:999px;padding:10px 14px;background:#1d5d7b;color:#fff;font-weight:850;box-shadow:0 8px 22px #173a5e44;cursor:pointer}
#fhDocxStudio{display:none;position:fixed;inset:4vh 4vw;z-index:2147483100;background:#f5f7fa;color:#172b3a;border:1px solid #7894a6;border-radius:14px;box-shadow:0 25px 90px #10253588;overflow:hidden;grid-template-rows:auto 1fr auto}
#fhDocxStudio.open{display:grid}.fhd-head{display:flex;align-items:center;justify-content:space-between;padding:11px 16px;background:#173a5e;color:#fff}.fhd-head button,.fhd-foot button{border:1px solid #90a9b8;border-radius:8px;background:#fff;color:#173a5e;padding:8px 12px;font-weight:750;cursor:pointer}.fhd-main{display:grid;grid-template-columns:minmax(280px,360px) 1fr;min-height:0}.fhd-controls{overflow:auto;padding:14px;border-right:1px solid #ccd8df}.fhd-controls fieldset{margin:0 0 12px;padding:10px;border:1px solid #c5d3dc;border-radius:9px}.fhd-controls legend{font-weight:850}.fhd-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.fhd-controls label{display:grid;gap:4px;margin:6px 0;font-size:13px}.fhd-controls input,.fhd-controls select,.fhd-controls textarea{box-sizing:border-box;width:100%;padding:7px;border:1px solid #9fb1bd;border-radius:6px;background:#fff}.fhd-preview{overflow:auto;padding:22px;background:#253746}.fhd-paper{box-sizing:border-box;width:min(760px,100%);min-height:88%;margin:auto;padding:7%;background:#fff;color:#222;box-shadow:0 8px 30px #0007}.fhd-paper h1{color:#173a5e}.fhd-section{padding:8px 0 14px;border-bottom:1px solid #dbe2e7}.fhd-section h2{margin:0 0 6px}.fhd-section h3{margin:0 0 8px;color:#2e5d7b}.fhd-section p{white-space:pre-wrap;line-height:1.6}.fhd-choice{margin-left:18px;color:#1f5e8c;text-decoration:underline}.fhd-report{max-height:160px;overflow:auto;margin-top:8px;padding:8px;background:#fff;border:1px solid #ccd8df;border-radius:7px;font-size:12px}.fhd-report .error{color:#a51e1e}.fhd-report .warn{color:#9a5a00}.fhd-tag-guide details{margin:5px 0;padding:5px 7px;border-radius:6px;background:#eef4f7}.fhd-tag-guide summary{cursor:pointer;font-weight:750}.fhd-tag-guide code{display:block;margin:4px 0;padding:5px;border-radius:4px;background:#173a5e;color:#fff;white-space:pre-wrap;user-select:all}.fhd-human-preview{white-space:pre-wrap;margin-top:6px;padding:8px;border-left:4px solid #2c7a55;background:#ecf8f1;line-height:1.5}.fhd-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;background:#fff;border-top:1px solid #ccd8df}.fhd-foot .primary{background:#1d6f42;color:#fff;border-color:#1d6f42}.fhd-status{font-size:13px;color:#526875}@media(max-width:760px){#fhDocxStudio{inset:0;border-radius:0}.fhd-main{grid-template-columns:1fr}.fhd-controls{border-right:0;border-bottom:1px solid #ccd8df;max-height:48vh}.fhd-preview{min-height:45vh}.fhd-grid{grid-template-columns:1fr}}
`);
      const button = document.createElement("button");
      button.id = "fhDocxButton"; button.type = "button"; button.textContent = "📄 DOCX 紙本";
      const studio = document.createElement("section");
      studio.id = "fhDocxStudio";
      studio.innerHTML = `<header class="fhd-head"><strong>📄 DOCX 紙本 Gamebook 工作室（試作版）</strong><button type="button" data-fhd-close>關閉</button></header>
<div class="fhd-main"><aside class="fhd-controls">
<fieldset><legend>作品資料</legend><label>作品名稱<input data-fhd="title" value="未命名作品"></label><label>作者<input data-fhd="author" placeholder="作者名稱"></label></fieldset>
<fieldset><legend>紙張與文字</legend><div class="fhd-grid"><label>紙張<select data-fhd="pageSize"><option>A5</option><option>A4</option><option>B5</option><option>Letter</option></select></label><label>邊界（cm）<input data-fhd="marginCm" type="number" min="0.8" max="4" step="0.1" value="1.8"></label><label>字體<input data-fhd="font" value="Noto Serif CJK TC"></label><label>字級（pt）<input data-fhd="fontSize" type="number" min="8" max="18" value="11"></label></div><label><input data-fhd="cover" type="checkbox" checked> 產生封面</label><label><input data-fhd="showTitles" type="checkbox" checked> 顯示 Node 標題</label><label><input data-fhd="eachNodePage" type="checkbox"> 每個段落從新頁開始</label></fieldset>
<fieldset><legend>段落編號</legend><label>排列方式<select data-fhd="order"><option value="current">目前 Node 順序</option><option value="canvas">依畫布位置（上到下、左到右）</option><option value="random">種子亂數排列</option></select></label><div class="fhd-grid"><label>起始編號<input data-fhd="start" type="number" min="1" value="1"></label><label>亂數種子<input data-fhd="seed" value="firehaha"></label></div><small>重新排列會同步更新所有「前往 N」引用，不會修改原專案。</small></fieldset>
<fieldset class="fhd-tag-guide"><legend>紙本標籤與人話翻譯</legend>
<details open><summary>物品與事件</summary><code>[紙本:取得:銀色鑰匙]\n[紙本:失去:銀色鑰匙]\n[紙本:記錄:見過守門人]</code><small>輸出後會要求讀者在冒險紀錄表寫下、劃除或勾選。</small></details>
<details><summary>可見條件</summary><code>[紙本:若持有:銀色鑰匙]打開鐵門\n[紙本:若記錄:見過守門人]向他打招呼</code><small>紙本不隱藏選項，而是清楚告訴讀者何時可以選。</small></details>
<details><summary>數值、填寫與勾選</summary><code>[紙本:數值:生命值:-2]\n[紙本:填寫:角色名稱]\n[紙本:勾選:讀過古老石碑]</code></details>
<details><summary>骰子檢定</summary><code>[紙本:檢定:力量:2d6:&gt;=:8]</code><small>轉成「擲 2d6，結果達到或高於 8 即成功」。</small></details>
<details><summary>排版指令</summary><code>[紙本:分頁]\n[紙本樣式:警告]踏入後無法返回。[/紙本樣式]</code></details>
<label>試貼一段標籤<textarea data-fhd-human-input rows="3">[紙本:取得:銀色鑰匙]</textarea></label><button type="button" data-fhd-human-run>翻譯成人話</button><div class="fhd-human-preview" data-fhd-human-output></div>
</fieldset>
<fieldset><legend>輸出前檢查</legend><button type="button" data-fhd-validate>重新檢查</button><div class="fhd-report" data-fhd-report></div></fieldset>
</aside><main class="fhd-preview"><article class="fhd-paper" data-fhd-preview></article></main></div>
<footer class="fhd-foot"><span class="fhd-status" data-fhd-status>尚未產生預覽</span><span><button type="button" data-fhd-refresh>更新預覽</button> <button type="button" class="primary" data-fhd-export>輸出 DOCX</button></span></footer>`;
      document.body.append(button, studio);

      function pagesNow() { return core && Array.isArray(core.pages) ? core.pages : (Array.isArray(window.pages) ? window.pages : []); }
      function settingsNow() {
        const value = key => studio.querySelector(`[data-fhd="${key}"]`);
        return { title: value("title").value.trim() || "未命名作品", author: value("author").value.trim(), pageSize: value("pageSize").value, marginCm: Number(value("marginCm").value) || 1.8, font: value("font").value.trim() || "Noto Serif CJK TC", fontSize: Number(value("fontSize").value) || 11, cover: value("cover").checked, showTitles: value("showTitles").checked, eachNodePage: value("eachNodePage").checked, order: value("order").value, start: Number(value("start").value) || 1, seed: value("seed").value };
      }
      function renderReport() {
        const issues = validate(pagesNow()), report = studio.querySelector("[data-fhd-report]");
        report.innerHTML = issues.length ? issues.map(issue => `<div class="${issue.level}">Node ${issue.node}：${esc(issue.text)}</div>`).join("") : '<div>✓ 沒有發現斷裂的目標或孤立 Node。</div>';
        return issues;
      }
      function renderPreview() {
        const settings = settingsNow(), manuscript = buildManuscript(pagesNow(), settings), preview = studio.querySelector("[data-fhd-preview]");
        preview.innerHTML = `${settings.cover ? `<h1>${esc(settings.title)}</h1>${settings.author ? `<p>${esc(settings.author)}</p>` : ""}<hr>` : ""}${manuscript.map(section => `<section class="fhd-section"><h2>${section.number}</h2>${settings.showTitles ? `<h3>${esc(section.title)}</h3>` : ""}<p>${esc(section.text)}</p>${section.choices.map(choice => `<div class="fhd-choice">${esc(choice.text)}${choice.targetNumber == null ? "（目標未設定）" : `，前往 ${choice.targetNumber}。`}</div>`).join("")}</section>`).join("") || "<p>目前沒有可輸出的 Node。</p>"}`;
        studio.querySelector("[data-fhd-status]").textContent = `已預覽 ${manuscript.length} 個段落；DOCX 將使用相同編號資料。`;
        renderReport();
      }
      button.onclick = () => { studio.classList.add("open"); const first = pagesNow()[0]; if (first && /^未命名作品$/.test(studio.querySelector('[data-fhd="title"]').value)) studio.querySelector('[data-fhd="title"]').value = stripHtml(first.title || "未命名作品"); renderPreview(); };
      studio.querySelector("[data-fhd-close]").onclick = () => studio.classList.remove("open");
      studio.querySelector("[data-fhd-refresh]").onclick = renderPreview;
      studio.querySelector("[data-fhd-validate]").onclick = renderReport;
      function renderHumanTranslation() {
        const source = studio.querySelector("[data-fhd-human-input]").value;
        studio.querySelector("[data-fhd-human-output]").textContent = paperText(source) || "（這段標籤只控制排版，不會顯示文字。）";
      }
      studio.querySelector("[data-fhd-human-run]").onclick = renderHumanTranslation;
      studio.querySelector("[data-fhd-human-input]").addEventListener("input", renderHumanTranslation);
      renderHumanTranslation();
      studio.querySelector("[data-fhd-export]").onclick = () => {
        const pages = pagesNow(), settings = settingsNow();
        if (!pages.length) return api.toast("目前沒有可輸出的 Node");
        const serious = validate(pages).filter(issue => issue.level === "error");
        if (serious.length && !confirm(`發現 ${serious.length} 個指向不存在 Node 的錯誤，仍要輸出嗎？`)) return;
        download(buildDocx(pages, settings), safeName(settings.title, "gamebook") + ".docx");
        studio.querySelector("[data-fhd-status]").textContent = `已輸出：${settings.title}.docx`;
        api.toast("DOCX 已產生；請用 Word 或 LibreOffice 開啟檢查分頁。");
      };
      const onProject = () => { if (studio.classList.contains("open")) renderPreview(); };
      document.addEventListener("gamebook:project:changed", onProject);
      api.toast("DOCX 紙本 Gamebook 工作室已啟用");
      return function cleanup() {
        document.removeEventListener("gamebook:project:changed", onProject);
        button.remove(); studio.remove(); removeStyle();
        if (window.FirehahaDocxPaperCore === publicCore) delete window.FirehahaDocxPaperCore;
      };
    }
  });
})();
