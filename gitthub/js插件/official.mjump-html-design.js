// @firehaha-plugin {"id":"official.mjump-html-design","name":"HTML mjump 獨立跳頁","version":"2.1.0","author":"Firehaha","description":"HTML 專用 [mjump:頁碼|文字|樣式]。HTML 設計工具列提供 mjump 插入按鈕；Reader Artifact 產出前包裝 applyAdventure，先保護標籤再建立跳頁。"}
FirehahaPlugins.register({
  id: "official.mjump-html-design",

  setup(api) {
    "use strict";

    const STYLES = [
      "text","underline","classic","outline",
      "soft","dark","danger","choice","arrow","quiet"
    ];

    function clean(v) {
      return String(v == null ? "" : v).trim();
    }

    function buildTag() {
      const page = prompt("HTML mjump：前往第幾頁？", "2");
      if (page == null) return "";

      const n = clean(page);

      if (!/^\d+$/.test(n) || Number(n) < 1) {
        alert("頁碼必須是 1 以上的整數。");
        return "";
      }

      const label = prompt("顯示文字：", "前往下一頁");
      if (label == null) return "";

      const style = prompt(
        "樣式：\ntext / underline / classic / outline / soft / dark / danger / choice / arrow / quiet",
        "underline"
      );
      if (style == null) return "";

      const s = STYLES.includes(clean(style)) ? clean(style) : "underline";

      return "[mjump:" + n + "|" + clean(label) + "|" + s + "]";
    }

    function insertTextarea(el, text) {
      if (!el || !text) return false;

      const value = String(el.value || "");
      const start = Number.isFinite(el.selectionStart) ? el.selectionStart : value.length;
      const end = Number.isFinite(el.selectionEnd) ? el.selectionEnd : start;

      el.value =
        value.slice(0,start) +
        text +
        value.slice(end);

      const pos =
        start + text.length;

      el.focus();

      try {
        el.setSelectionRange(pos,pos);
      } catch (_) {}

      el.dispatchEvent(
        new Event(
          "input",
          { bubbles:true }
        )
      );

      return true;
    }

    function insertVisual(editor,text) {
      if (!editor || !text) return false;

      editor.focus();

      const selection =
        window.getSelection();

      let range = null;

      if (
        selection &&
        selection.rangeCount
      ) {
        const candidate =
          selection.getRangeAt(0);

        if (
          editor.contains(
            candidate.commonAncestorContainer
          )
        ) {
          range = candidate;
        }
      }

      if (!range) {
        range =
          document.createRange();

        range.selectNodeContents(editor);
        range.collapse(false);
      }

      range.deleteContents();

      const node =
        document.createTextNode(text);

      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);

      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }

      editor.dispatchEvent(
        new Event(
          "input",
          { bubbles:true }
        )
      );

      return true;
    }

    function htmlMode() {
      const source =
        document.getElementById(
          "htmlSourceEditor"
        );

      if (
        source &&
        getComputedStyle(source).display !==
          "none"
      ) {
        return "code";
      }

      return "visual";
    }

    function insertTag() {
      const tag = buildTag();
      if (!tag) return;

      if (htmlMode() === "code") {
        insertTextarea(
          document.getElementById(
            "htmlSourceEditor"
          ),
          tag
        );

        return;
      }

      insertVisual(
        document.getElementById(
          "htmlDesignEditor"
        ),
        tag
      );
    }

    function installUi() {
      if (
        document.getElementById(
          "firehaha-html-mjump-button"
        )
      ) {
        return true;
      }

      const toolbar =
        document.getElementById(
          "htmlDesignToolbar"
        );

      if (!toolbar) {
        return false;
      }

      const button =
        document.createElement(
          "button"
        );

      button.type = "button";
      button.id =
        "firehaha-html-mjump-button";
      button.textContent =
        "mjump";
      button.title =
        "插入 [mjump:頁碼|文字|樣式]";

      button.addEventListener(
        "mousedown",
        function(event){
          event.preventDefault();
        }
      );

      button.addEventListener(
        "click",
        insertTag
      );

      toolbar.appendChild(button);

      return true;
    }

    const readerCss = `
<style data-firehaha-style="mjump-210">
.fh-mjump-wrap{display:inline}
.fh-mjump{
  appearance:none!important;
  background:none!important;
  border:0!important;
  border-radius:0!important;
  box-shadow:none!important;
  padding:0!important;
  margin:0!important;
  color:inherit;
  text-decoration:none;
  font:inherit;
  line-height:inherit;
  cursor:pointer;
}
.fh-mjump--underline{text-decoration:underline;text-underline-offset:.16em}
.fh-mjump--quiet{opacity:.62;font-size:.94em}
.fh-mjump-wrap--classic,
.fh-mjump-wrap--outline,
.fh-mjump-wrap--soft,
.fh-mjump-wrap--dark,
.fh-mjump-wrap--danger,
.fh-mjump-wrap--choice{display:block;margin:10px 0}
.fh-mjump--classic,
.fh-mjump--outline,
.fh-mjump--soft,
.fh-mjump--dark,
.fh-mjump--danger,
.fh-mjump--choice{
  display:inline-block!important;
  padding:9px 14px!important;
  border-radius:10px!important;
  text-decoration:none!important
}
.fh-mjump--classic{background:#f3f4f6!important;border:1px solid #d1d5db!important;color:#1f2937!important}
.fh-mjump--outline{background:transparent!important;border:1px solid currentColor!important}
.fh-mjump--soft{background:rgba(59,130,246,.09)!important;border:1px solid rgba(59,130,246,.18)!important}
.fh-mjump--dark{background:#23272f!important;border:1px solid #23272f!important;color:#fff!important}
.fh-mjump--danger{background:#fff5f5!important;border:1px solid rgba(185,28,28,.35)!important;color:#b91c1c!important}
.fh-mjump--choice{display:block!important;width:min(100%,680px)!important;box-sizing:border-box;text-align:center;background:#fff!important;border:1px solid #d8dee7!important;color:#1f2937!important}
</style>`;

    const patchCode = String.raw`
/* Firehaha HTML mjump 2.1.0 */
(function(){
  "use strict";

  if (window.__fhMJump210) return;
  window.__fhMJump210 = true;

  const TAG_RE =
    /\[mjump\s*:\s*([^|\]\r\n]+?)(?:\s*\|\s*([^|\]\r\n]*?))?(?:\s*\|\s*([^\]\r\n]*?))?\s*\]/g;

  const VALID =
    new Set(["text","underline","classic","outline","soft","dark","danger","choice","arrow","quiet"]);

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
      const index =
        Number(ref) - 1;

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
      const byId =
        pages.find(
          function(page){
            return C(page && page.id) === ref;
          }
        );

      if (byId) {
        return C(byId.id);
      }

      const byTitle =
        pages.find(
          function(page){
            return C(page && page.title) === ref;
          }
        );

      if (byTitle) {
        return C(byTitle.id);
      }
    }

    return "";
  }

  function styleOf(raw){
    const style = C(raw);
    return VALID.has(style) ? style : "underline";
  }

  function prepare(source){
    const items = [];

    const text =
      String(source || "").replace(
        TAG_RE,
        function(whole,target,label,rawStyle){
          const token =
            "@@FH_MJUMP_" +
            items.length +
            "@@";

          const targetId =
            pageIdFromReference(target);

          const style =
            styleOf(rawStyle);

          const displayLabel =
            C(label) ||
            ("前往第 " + C(target) + " 頁");

          let textLabel =
            displayLabel;

          if (style === "arrow") {
            textLabel =
              "→ " +
              displayLabel;
          }

          const html =
            targetId
              ? (
                  '<span class="fh-mjump-wrap fh-mjump-wrap--' +
                  E(style) +
                  '">' +
                  '<a href="#" class="fh-mjump fh-mjump--' +
                  E(style) +
                  '" data-fh-mjump="' +
                  E(targetId) +
                  '">' +
                  E(textLabel) +
                  '</a>' +
                  '</span>'
                )
              : whole;

          items.push({
            token:token,
            html:html
          });

          return token;
        }
      );

    return {
      text:text,

      restore:function(html){
        let out =
          String(html || "");

        items.forEach(
          function(item){
            out =
              out.split(
                item.token
              ).join(
                item.html
              );
          }
        );

        return out;
      }
    };
  }

  if (
    typeof applyAdventure === "function" &&
    !applyAdventure.__fhMJump210Wrapped
  ) {
    const oldApplyAdventure =
      applyAdventure;

    const wrapped =
      function(page){
        const cloned =
          Object.assign(
            {},
            page || {}
          );

        const field =
          cloned.content != null
            ? "content"
            : "text";

        const prepared =
          prepare(
            cloned[field] || ""
          );

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

    wrapped.__fhMJump210Wrapped = true;
    wrapped.__fhMJumpOriginal = oldApplyAdventure;

    applyAdventure = wrapped;
  }

  document.addEventListener(
    "click",
    function(event){
      const link =
        event.target &&
        event.target.closest
          ? event.target.closest(".fh-mjump")
          : null;

      if (!link) return;

      event.preventDefault();
      event.stopPropagation();

      const target =
        C(
          link.dataset.fhMjump
        );

      if (
        target &&
        typeof show === "function"
      ) {
        show(target);
      }
    },
    true
  );

  window.FirehahaMJump = {
    version:"2.1.0"
  };
})();
`;

    const removeTransform =
      api.registerReaderTransform(
        "reader",

        function(html, context){
          html =
            String(
              html == null
                ? ""
                : html
            );

          /*
           * 這支只服務 HTML Reader。
           */
          if (
            context &&
            context.mode &&
            context.mode !== "html"
          ) {
            return html;
          }

          if (
            html.includes(
              "__fhMJump210"
            )
          ) {
            return html;
          }

          if (
            /<\/head\s*>/i.test(html)
          ) {
            html =
              html.replace(
                /<\/head\s*>/i,
                readerCss +
                "\n</head>"
              );
          }

          const marker =
            "function renderAdventure(){";

          if (
            !html.includes(marker)
          ) {
            console.warn(
              "[mjump] 找不到 Reader Artifact 插入位置"
            );

            return html;
          }

          return html.replace(
            marker,
            patchCode +
            "\n" +
            marker
          );
        },

        399
      );

    const removeStyle =
      api.addStyle(
        "main",
        `
#firehaha-html-mjump-button{
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

          if (
            attempts >= 160
          ) {
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
      "HTML mjump 2.1.0 已接入 Reader Artifact"
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

      const button =
        document.getElementById(
          "firehaha-html-mjump-button"
        );

      if (button) {
        button.remove();
      }
    };
  }
});
