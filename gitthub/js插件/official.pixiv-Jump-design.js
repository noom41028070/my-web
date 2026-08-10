// @firehaha-plugin {"id":"official.pixiv-Jump-design","name":"Pixiv Jump 獨立跳頁","version":"2.1.0","author":"Firehaha","description":"Pixiv 專用 [Jump:頁碼|文字|樣式]。編輯器提供 Jump 插入按鈕；Reader Artifact 產出前包裝 applyAdventure，先保護標籤再建立純文字跳頁，避免原生 [jump:] 解析衝突。"}
FirehahaPlugins.register({
  id: "official.pixiv-Jump-design",

  setup(api) {
    "use strict";

    const STYLES = [
      "plain","underline","bold","arrow",
      "bracket","quiet","double","dot"
    ];

    function clean(v) {
      return String(v == null ? "" : v).trim();
    }

    function buildTag() {
      const page = prompt("Pixiv Jump：前往第幾頁？", "2");
      if (page == null) return "";

      const n = clean(page);
      if (!/^\d+$/.test(n) || Number(n) < 1) {
        alert("頁碼必須是 1 以上的整數。");
        return "";
      }

      const label = prompt("顯示文字：", "前往下一頁");
      if (label == null) return "";

      const style = prompt(
        "純文字樣式：\nplain / underline / bold / arrow / bracket / quiet / double / dot",
        "underline"
      );
      if (style == null) return "";

      const s = STYLES.includes(clean(style)) ? clean(style) : "underline";

      return "[Jump:" + n + "|" + clean(label) + "|" + s + "]";
    }

    function insertTextarea(el, text) {
      if (!el || !text) return false;

      const value = String(el.value || "");
      const start = Number.isFinite(el.selectionStart) ? el.selectionStart : value.length;
      const end = Number.isFinite(el.selectionEnd) ? el.selectionEnd : start;

      el.value = value.slice(0, start) + text + value.slice(end);

      const pos = start + text.length;
      el.focus();
      try { el.setSelectionRange(pos, pos); } catch (_) {}

      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }

    function makeButton(id, label, toolbar, editorGetter) {
      if (document.getElementById(id)) return true;
      if (!toolbar) return false;

      const button = document.createElement("button");
      button.type = "button";
      button.id = id;
      button.textContent = label;
      button.title = "插入 [Jump:頁碼|文字|樣式]";

      button.addEventListener("mousedown", function(event) {
        event.preventDefault();
      });

      button.addEventListener("click", function() {
        const tag = buildTag();
        if (!tag) return;
        insertTextarea(editorGetter(), tag);
      });

      toolbar.appendChild(button);
      return true;
    }

    function installUi() {
      const designToolbar =
        document.querySelector("#pixivWorkspace .pixiv-toolbar") ||
        document.querySelector(".pixiv-toolbar");

      makeButton(
        "firehaha-pixiv-Jump-design-button",
        "Jump",
        designToolbar,
        function() {
          return document.getElementById("pageText");
        }
      );

      const sourceToolbar =
        document.querySelector(".pixiv-source-window .source-toolbar");

      if (sourceToolbar) {
        makeButton(
          "firehaha-pixiv-Jump-source-button",
          "Jump",
          sourceToolbar,
          function() {
            return document.getElementById("source-text");
          }
        );
      }
    }

    const readerCss = `
<style data-firehaha-style="pixiv-Jump-210">
.fh-pixiv-Jump{
  appearance:none!important;
  background:none!important;
  border:0!important;
  border-radius:0!important;
  box-shadow:none!important;
  padding:0!important;
  margin:0!important;
  color:inherit!important;
  font:inherit!important;
  cursor:pointer;
}
.fh-pixiv-Jump--plain{text-decoration:none}
.fh-pixiv-Jump--underline{text-decoration:underline;text-underline-offset:.16em}
.fh-pixiv-Jump--bold{font-weight:800}
.fh-pixiv-Jump--quiet{opacity:.62;font-size:.94em}
.fh-pixiv-Jump--double{text-decoration:underline double;text-underline-offset:.16em}
.fh-pixiv-Jump--dot{text-decoration:underline dotted;text-underline-offset:.18em}
</style>`;

    const patchCode = String.raw`
/* Firehaha Pixiv Jump 2.1.0 */
(function(){
  "use strict";

  if (window.__fhPixivJump210) return;
  window.__fhPixivJump210 = true;

  const TAG_RE =
    /\[Jump\s*:\s*([^|\]\r\n]+?)(?:\s*\|\s*([^|\]\r\n]*?))?(?:\s*\|\s*([^\]\r\n]*?))?\s*\]/g;

  const VALID =
    new Set(["plain","underline","bold","arrow","bracket","quiet","double","dot"]);

  function C(v){
    return String(v == null ? "" : v).trim();
  }

  function E(v){
    return String(v == null ? "" : v)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#39;");
  }

  function pageIdFromReference(ref){
    ref = C(ref);

    if (!ref) return "";

    if (/^\d+$/.test(ref)) {
      const index = Number(ref) - 1;

      if (
        typeof pages !== "undefined" &&
        Array.isArray(pages) &&
        pages[index]
      ) {
        return C(pages[index].id);
      }

      return "";
    }

    if (
      typeof pages !== "undefined" &&
      Array.isArray(pages)
    ) {
      const byId = pages.find(
        function(page){
          return C(page && page.id) === ref;
        }
      );

      if (byId) return C(byId.id);

      const byTitle = pages.find(
        function(page){
          return C(page && page.title) === ref;
        }
      );

      if (byTitle) return C(byTitle.id);
    }

    return "";
  }

  function styleOf(raw){
    const style = C(raw);
    return VALID.has(style) ? style : "underline";
  }

  function labelOf(target,label,style){
    label = C(label) || ("前往第 " + C(target) + " 頁");

    if (style === "arrow") return "→ " + label;
    if (style === "bracket") return "＞ " + label;
    if (style === "dot") return "・" + label;

    return label;
  }

  function prepare(source){
    const items = [];

    const text = String(source || "").replace(
      TAG_RE,
      function(whole,target,label,rawStyle){
        const token =
          "@@FH_PIXIV_JUMP_" +
          items.length +
          "@@";

        const targetId =
          pageIdFromReference(target);

        const style =
          styleOf(rawStyle);

        const html =
          targetId
            ? (
                '<a href="#" class="fh-pixiv-Jump fh-pixiv-Jump--' +
                E(style) +
                '" data-fh-pixiv-jump="' +
                E(targetId) +
                '">' +
                E(labelOf(target,label,style)) +
                '</a>'
              )
            : whole;

        items.push({
          token: token,
          html: html
        });

        return token;
      }
    );

    return {
      text: text,

      restore: function(html){
        let out = String(html || "");

        items.forEach(
          function(item){
            out = out.split(item.token).join(item.html);
          }
        );

        return out;
      }
    };
  }

  if (
    typeof applyAdventure === "function" &&
    !applyAdventure.__fhPixivJump210Wrapped
  ) {
    const oldApplyAdventure =
      applyAdventure;

    const wrapped =
      function(page){
        const cloned =
          Object.assign({},page || {});

        const field =
          cloned.content != null
            ? "content"
            : "text";

        const prepared =
          prepare(cloned[field] || "");

        cloned[field] =
          prepared.text;

        let html =
          oldApplyAdventure.call(
            this,
            cloned
          );

        html =
          prepared.restore(
            html
          );

        return html;
      };

    wrapped.__fhPixivJump210Wrapped = true;
    wrapped.__fhPixivJumpOriginal = oldApplyAdventure;

    applyAdventure = wrapped;
  }

  document.addEventListener(
    "click",
    function(event){
      const link =
        event.target &&
        event.target.closest
          ? event.target.closest(".fh-pixiv-Jump")
          : null;

      if (!link) return;

      event.preventDefault();
      event.stopPropagation();

      const target =
        C(link.dataset.fhPixivJump);

      if (
        target &&
        typeof show === "function"
      ) {
        show(target);
      }
    },
    true
  );

  window.FirehahaPixivJump = {
    version:"2.1.0"
  };
})();
`;

    const removeTransform =
      api.registerReaderTransform(
        "reader",

        function(html, context){
          html = String(html == null ? "" : html);

          /*
           * 這支只服務 Pixiv Reader。
           */
          if (
            context &&
            context.mode &&
            context.mode !== "pixiv"
          ) {
            return html;
          }

          if (
            html.includes(
              "__fhPixivJump210"
            )
          ) {
            return html;
          }

          if (/<\/head\s*>/i.test(html)) {
            html = html.replace(
              /<\/head\s*>/i,
              readerCss + "\n</head>"
            );
          }

          const marker =
            "function renderAdventure(){";

          if (!html.includes(marker)) {
            console.warn(
              "[Pixiv Jump] 找不到 Reader Artifact 插入位置"
            );

            return html;
          }

          return html.replace(
            marker,
            patchCode + "\n" + marker
          );
        },

        398
      );

    const removeStyle =
      api.addStyle(
        "main",
        `
#firehaha-pixiv-Jump-design-button,
#firehaha-pixiv-Jump-source-button{
  background:#fff!important;
  color:#263544!important;
  border:1px solid #ccd6df!important;
  font-weight:700!important;
}
`
      );

    installUi();

    let attempts = 0;

    const timer =
      setInterval(
        function(){
          attempts += 1;
          installUi();

          if (attempts >= 160) {
            clearInterval(timer);
          }
        },
        250
      );

    const observer =
      new MutationObserver(
        function(){
          installUi();
        }
      );

    try {
      observer.observe(
        document.body ||
        document.documentElement,
        {
          childList:true,
          subtree:true
        }
      );
    } catch (_) {}

    api.toast(
      "Pixiv Jump 2.1.0 已接入 Reader Artifact"
    );

    return function cleanup(){
      clearInterval(timer);

      try {
        observer.disconnect();
      } catch (_) {}

      removeTransform();

      if (
        typeof removeStyle === "function"
      ) {
        removeStyle();
      }

      [
        "firehaha-pixiv-Jump-design-button",
        "firehaha-pixiv-Jump-source-button"
      ].forEach(
        function(id){
          const element =
            document.getElementById(id);

          if (element) {
            element.remove();
          }
        }
      );
    };
  }
});
