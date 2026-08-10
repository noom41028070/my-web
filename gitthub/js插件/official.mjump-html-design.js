// @firehaha-plugin {"id":"official.mjump-html-design","name":"HTML mjump 獨立跳頁","version":"2.0.0","author":"Firehaha","description":"為目前 Firehaha HTML 設計區加入獨立 mjump 插入按鈕；使用 [mjump:頁碼|文字|樣式]，支援所見即得與 HTML 原始碼，Reader 端解析跳頁。"}
FirehahaPlugins.register({
  id: "official.mjump-html-design",

  setup(api) {
    "use strict";

    const STYLES = [
      "text",
      "underline",
      "classic",
      "outline",
      "soft",
      "dark",
      "danger",
      "choice",
      "arrow",
      "quiet"
    ];

    function clean(value) {
      return String(value == null ? "" : value).trim();
    }

    function normalizeStyle(value) {
      const style = clean(value);
      return STYLES.includes(style)
        ? style
        : "underline";
    }

    function buildTag() {
      const page =
        prompt(
          "HTML mjump：前往第幾頁？",
          "2"
        );

      if (page == null) return "";

      const pageNumber =
        clean(page);

      if (
        !/^\d+$/.test(pageNumber) ||
        Number(pageNumber) < 1
      ) {
        alert(
          "頁碼必須是 1 以上的整數。"
        );

        return "";
      }

      const label =
        prompt(
          "顯示文字：",
          "前往下一頁"
        );

      if (label == null) return "";

      const style =
        prompt(
          "樣式：\n" +
          "text       純文字\n" +
          "underline  底線\n" +
          "classic    一般選項\n" +
          "outline    外框\n" +
          "soft       柔和\n" +
          "dark       深色\n" +
          "danger     危險\n" +
          "choice     長條選項\n" +
          "arrow      箭頭文字\n" +
          "quiet      淡色文字",
          "underline"
        );

      if (style == null) return "";

      return (
        "[mjump:" +
        pageNumber +
        "|" +
        clean(label) +
        "|" +
        normalizeStyle(style) +
        "]"
      );
    }

    function insertIntoTextarea(
      textarea,
      text
    ) {
      if (!textarea || !text) {
        return false;
      }

      const value =
        String(textarea.value || "");

      const start =
        Number.isFinite(
          textarea.selectionStart
        )
          ? textarea.selectionStart
          : value.length;

      const end =
        Number.isFinite(
          textarea.selectionEnd
        )
          ? textarea.selectionEnd
          : start;

      textarea.value =
        value.slice(0, start) +
        text +
        value.slice(end);

      const cursor =
        start +
        text.length;

      textarea.focus();

      try {
        textarea.setSelectionRange(
          cursor,
          cursor
        );
      } catch (_) {}

      /*
       * 主程式 hsrc 自己監聽 input -> saveHtml()
       */
      textarea.dispatchEvent(
        new Event(
          "input",
          { bubbles:true }
        )
      );

      return true;
    }

    function insertIntoVisual(
      editor,
      text
    ) {
      if (!editor || !text) {
        return false;
      }

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

        range.selectNodeContents(
          editor
        );

        range.collapse(false);
      }

      range.deleteContents();

      const textNode =
        document.createTextNode(
          text
        );

      range.insertNode(
        textNode
      );

      range.setStartAfter(
        textNode
      );

      range.collapse(true);

      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }

      /*
       * 主程式 hed 自己監聽 input -> saveHtml()
       */
      editor.dispatchEvent(
        new Event(
          "input",
          { bubbles:true }
        )
      );

      return true;
    }

    function getCurrentHtmlMode() {
      const active =
        document.querySelector(
          "#htmlWorkspace " +
          ".html-modebar " +
          "button.active[data-html-view]"
        );

      if (active) {
        return clean(
          active.dataset.htmlView
        );
      }

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

    function insertMJump() {
      const tag =
        buildTag();

      if (!tag) return;

      const mode =
        getCurrentHtmlMode();

      if (mode === "code") {
        if (
          !insertIntoTextarea(
            document.getElementById(
              "htmlSourceEditor"
            ),
            tag
          )
        ) {
          alert(
            "找不到 HTML 原始碼編輯器。"
          );
        }

        return;
      }

      if (
        !insertIntoVisual(
          document.getElementById(
            "htmlDesignEditor"
          ),
          tag
        )
      ) {
        alert(
          "找不到 HTML 所見即得編輯器。"
        );
      }
    }

    function installHtmlDesignButton() {
      if (
        document.getElementById(
          "firehaha-html-mjump-design-button"
        )
      ) {
        return true;
      }

      /*
       * 目前主程式正式 HTML 設計工具列。
       */
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

      button.type =
        "button";

      button.id =
        "firehaha-html-mjump-design-button";

      button.textContent =
        "mjump";

      button.title =
        "插入 HTML Reader 跳頁 [mjump:頁碼|文字|樣式]";

      /*
       * HTML 所見即得工具列原本也會阻止 mousedown 造成 selection 消失。
       */
      button.addEventListener(
        "mousedown",
        function(event) {
          event.preventDefault();
        }
      );

      button.addEventListener(
        "click",
        insertMJump
      );

      toolbar.appendChild(
        button
      );

      return true;
    }

    const readerRuntime = String.raw`
(function(){
  "use strict";

  if (
    window.__firehahaMJumpReader200
  ) {
    return;
  }

  window.__firehahaMJumpReader200 =
    true;

  const TAG_RE =
    /\[mjump:(\d+)(?:\|([^\]|]*))?(?:\|([^\]]*))?\]/g;

  const VALID =
    new Set([
      "text",
      "underline",
      "classic",
      "outline",
      "soft",
      "dark",
      "danger",
      "choice",
      "arrow",
      "quiet"
    ]);

  function clean(value) {
    return String(
      value == null ? "" : value
    ).trim();
  }

  function styleOf(value) {
    const style =
      clean(value);

    return VALID.has(style)
      ? style
      : "underline";
  }

  function createLink(
    page,
    label,
    style
  ) {
    label =
      clean(label) ||
      ("前往第 " + page + " 頁");

    style =
      styleOf(style);

    const link =
      document.createElement("a");

    link.href = "#";

    link.className =
      "firehaha-mjump-reader " +
      "firehaha-mjump-reader--" +
      style;

    link.dataset.mjumpPage =
      String(page);

    link.textContent =
      style === "arrow"
        ? ("→ " + label)
        : label;

    const wrap =
      document.createElement("span");

    wrap.className =
      "firehaha-mjump-wrap " +
      "firehaha-mjump-wrap--" +
      style;

    wrap.appendChild(
      link
    );

    return wrap;
  }

  function replaceNode(node) {
    if (
      !node ||
      node.nodeType !== 3
    ) {
      return false;
    }

    const text =
      String(node.nodeValue || "");

    if (
      !/\[mjump:\d+/.test(text)
    ) {
      return false;
    }

    TAG_RE.lastIndex = 0;

    if (!TAG_RE.test(text)) {
      return false;
    }

    TAG_RE.lastIndex = 0;

    const fragment =
      document.createDocumentFragment();

    let last = 0;
    let match;

    while (
      (match = TAG_RE.exec(text))
    ) {
      if (
        match.index > last
      ) {
        fragment.appendChild(
          document.createTextNode(
            text.slice(
              last,
              match.index
            )
          )
        );
      }

      fragment.appendChild(
        createLink(
          Number(match[1]),
          match[2],
          match[3]
        )
      );

      last =
        match.index +
        match[0].length;
    }

    if (
      last < text.length
    ) {
      fragment.appendChild(
        document.createTextNode(
          text.slice(last)
        )
      );
    }

    if (node.parentNode) {
      node.parentNode.replaceChild(
        fragment,
        node
      );

      return true;
    }

    return false;
  }

  function scan(root) {
    root =
      root ||
      document.body;

    if (!root) return;

    if (
      root.nodeType === 3
    ) {
      replaceNode(root);
      return;
    }

    const walker =
      document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            const parent =
              node.parentElement;

            if (
              !parent ||
              parent.closest(
                "script,style,textarea,input,select,option"
              )
            ) {
              return NodeFilter.FILTER_REJECT;
            }

            return /\[mjump:\d+/.test(
              String(
                node.nodeValue ||
                ""
              )
            )
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT;
          }
        }
      );

    const found = [];
    let node;

    while (
      (node = walker.nextNode())
    ) {
      found.push(node);
    }

    found.forEach(
      replaceNode
    );
  }

  function go(pageNumber) {
    const number =
      Number(pageNumber);

    try {
      if (
        typeof pages !== "undefined" &&
        Array.isArray(pages) &&
        pages[number - 1] &&
        typeof show === "function"
      ) {
        show(
          String(
            pages[number - 1].id ||
            ""
          )
        );

        return true;
      }
    } catch (error) {
      console.warn(
        "[mjump] Reader 跳頁失敗",
        error
      );
    }

    return false;
  }

  if (
    !document.getElementById(
      "firehaha-mjump-reader-style-200"
    )
  ) {
    const style =
      document.createElement("style");

    style.id =
      "firehaha-mjump-reader-style-200";

    style.textContent = [
      ".firehaha-mjump-wrap{display:inline}",
      ".firehaha-mjump-reader{appearance:none!important;background:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;padding:0!important;margin:0!important;color:inherit;text-decoration:none;font:inherit;line-height:inherit;cursor:pointer}",
      ".firehaha-mjump-reader--text{text-decoration:none}",
      ".firehaha-mjump-reader--underline{text-decoration:underline;text-underline-offset:.16em}",
      ".firehaha-mjump-reader--quiet{opacity:.62;font-size:.94em}",
      ".firehaha-mjump-wrap--classic,.firehaha-mjump-wrap--outline,.firehaha-mjump-wrap--soft,.firehaha-mjump-wrap--dark,.firehaha-mjump-wrap--danger,.firehaha-mjump-wrap--choice{display:block;margin:10px 0}",
      ".firehaha-mjump-reader--classic,.firehaha-mjump-reader--outline,.firehaha-mjump-reader--soft,.firehaha-mjump-reader--dark,.firehaha-mjump-reader--danger,.firehaha-mjump-reader--choice{display:inline-block!important;padding:9px 14px!important;border-radius:10px!important;text-decoration:none!important}",
      ".firehaha-mjump-reader--classic{background:#f3f4f6!important;border:1px solid #d1d5db!important;color:#1f2937!important}",
      ".firehaha-mjump-reader--outline{background:transparent!important;border:1px solid currentColor!important;color:inherit!important}",
      ".firehaha-mjump-reader--soft{background:rgba(59,130,246,.09)!important;border:1px solid rgba(59,130,246,.18)!important;color:inherit!important}",
      ".firehaha-mjump-reader--dark{background:#23272f!important;border:1px solid #23272f!important;color:#fff!important}",
      ".firehaha-mjump-reader--danger{background:#fff5f5!important;border:1px solid rgba(185,28,28,.35)!important;color:#b91c1c!important}",
      ".firehaha-mjump-reader--choice{display:block!important;width:min(100%,680px)!important;box-sizing:border-box;text-align:center;background:#fff!important;border:1px solid #d8dee7!important;color:#1f2937!important}",
      "body.reader-dark .firehaha-mjump-reader--classic{background:#2b3440!important;border-color:#465363!important;color:#eef4fb!important}",
      "body.reader-dark .firehaha-mjump-reader--danger{background:#3a2729!important;border-color:#6d4145!important;color:#ffb4ab!important}"
    ].join("");

    document.head.appendChild(
      style
    );
  }

  document.addEventListener(
    "click",

    function(event) {
      const link =
        event.target &&
        event.target.closest
          ? event.target.closest(
              ".firehaha-mjump-reader"
            )
          : null;

      if (!link) return;

      event.preventDefault();
      event.stopPropagation();

      go(
        Number(
          link.dataset.mjumpPage
        )
      );
    },

    true
  );

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      function() {
        scan(document.body);
      },
      { once:true }
    );
  } else {
    scan(document.body);
  }

  const observer =
    new MutationObserver(
      function(mutations) {
        mutations.forEach(
          function(mutation) {
            mutation.addedNodes.forEach(
              function(node) {
                if (
                  node.nodeType === 3
                ) {
                  replaceNode(node);
                } else if (
                  node.nodeType === 1
                ) {
                  scan(node);
                }
              }
            );
          }
        );
      }
    );

  observer.observe(
    document.body ||
    document.documentElement,
    {
      childList:true,
      subtree:true
    }
  );

  window.FirehahaMJump = {
    version:"2.0.0",
    go:go,
    scan:scan
  };
})();
`;

    const removeReaderTransform =
      api.registerReaderTransform(
        "reader",

        function(html) {
          html =
            String(
              html == null
                ? ""
                : html
            );

          if (
            html.includes(
              "__firehahaMJumpReader200"
            )
          ) {
            return html;
          }

          const payload =
            "\n<script>\n" +
            readerRuntime +
            "\n<\\/script>\n";

          if (
            /<\/body\s*>/i.test(html)
          ) {
            return html.replace(
              /<\/body\s*>/i,
              payload +
              "</body>"
            );
          }

          return html + payload;
        },

        410
      );

    const removeStyle =
      api.addStyle(
        "main",
        `
#firehaha-html-mjump-design-button{
  background:#fff!important;
  color:#263544!important;
  border:1px solid #ccd6df!important;
  font-weight:700!important;
}
`
      );

    function ensureUi() {
      installHtmlDesignButton();
    }

    let timer = null;

    function startTimer() {
      if (timer) return;

      let attempts = 0;

      timer =
        setInterval(
          function() {
            attempts += 1;
            ensureUi();

            if (
              attempts >= 240
            ) {
              clearInterval(timer);
              timer = null;
            }
          },
          250
        );
    }

    startTimer();

    const documentObserver =
      new MutationObserver(
        function() {
          ensureUi();
        }
      );

    try {
      documentObserver.observe(
        document.body ||
        document.documentElement,
        {
          childList:true,
          subtree:true
        }
      );
    } catch (_) {}

    ensureUi();

    window.FirehahaMJumpHtmlDesign = {
      version:"2.0.0",
      ensureUi:ensureUi
    };

    api.toast(
      "HTML mjump 獨立跳頁 2.0.0 已啟用"
    );

    return function cleanup() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }

      try {
        documentObserver.disconnect();
      } catch (_) {}

      if (
        typeof removeReaderTransform ===
        "function"
      ) {
        removeReaderTransform();
      }

      if (
        typeof removeStyle ===
        "function"
      ) {
        removeStyle();
      }

      const button =
        document.getElementById(
          "firehaha-html-mjump-design-button"
        );

      if (button) {
        button.remove();
      }
    };
  }
});
