// @firehaha-plugin {"id":"official.pixiv-Jump-design","name":"Pixiv Jump 獨立跳頁","version":"2.0.0","author":"Firehaha","description":"為目前 Firehaha Pixiv 設計區加入獨立 Jump 插入按鈕；使用 [Jump:頁碼|文字|樣式]，預覽為純文字樣式，Reader 可點擊跳頁，輸出 Pixiv 時轉為 [jump:頁碼]。"}
FirehahaPlugins.register({
  id: "official.pixiv-Jump-design",

  setup(api) {
    "use strict";

    const TAG_RE =
      /\[Jump:(\d+)(?:\|([^\]|]*))?(?:\|([^\]]*))?\]/g;

    const STYLES = [
      "plain",
      "underline",
      "bold",
      "arrow",
      "bracket",
      "quiet",
      "double",
      "dot"
    ];

    function clean(value) {
      return String(value == null ? "" : value).trim();
    }

    function normalizeStyle(value) {
      const style = clean(value);
      return STYLES.includes(style) ? style : "underline";
    }

    function escapeHtml(value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function displayText(page, label, style) {
      label = clean(label) || ("前往第 " + page + " 頁");
      style = normalizeStyle(style);

      if (style === "arrow") return "→ " + label;
      if (style === "bracket") return "＞ " + label;
      if (style === "dot") return "・" + label;

      return label;
    }

    function buildTag() {
      const page = prompt("Pixiv Jump：前往第幾頁？", "2");
      if (page == null) return "";

      const pageNumber = clean(page);

      if (!/^\d+$/.test(pageNumber) || Number(pageNumber) < 1) {
        alert("頁碼必須是 1 以上的整數。");
        return "";
      }

      const label = prompt("顯示文字：", "前往下一頁");
      if (label == null) return "";

      const style = prompt(
        "純文字樣式：\n" +
        "plain      純文字\n" +
        "underline  底線\n" +
        "bold       粗體\n" +
        "arrow      箭頭\n" +
        "bracket    ＞ 樣式\n" +
        "quiet      淡色\n" +
        "double     雙底線\n" +
        "dot        點底線",
        "underline"
      );

      if (style == null) return "";

      return (
        "[Jump:" +
        pageNumber +
        "|" +
        clean(label) +
        "|" +
        normalizeStyle(style) +
        "]"
      );
    }

    function insertIntoTextarea(textarea, text) {
      if (!textarea || !text) return false;

      const value = String(textarea.value || "");
      const start = Number.isFinite(textarea.selectionStart)
        ? textarea.selectionStart
        : value.length;
      const end = Number.isFinite(textarea.selectionEnd)
        ? textarea.selectionEnd
        : start;

      textarea.value =
        value.slice(0, start) +
        text +
        value.slice(end);

      const cursor = start + text.length;

      textarea.focus();

      try {
        textarea.setSelectionRange(cursor, cursor);
      } catch (_) {}

      textarea.dispatchEvent(
        new Event("input", {
          bubbles: true
        })
      );

      return true;
    }

    function createInsertButton(id, label, textareaGetter) {
      const button = document.createElement("button");

      button.type = "button";
      button.id = id;
      button.textContent = label;
      button.title =
        "插入 [Jump:頁碼|文字|樣式]";

      /*
       * 工具列按鈕 mousedown 不讓 textarea 先失焦，
       * 避免插入位置跑到最後。
       */
      button.addEventListener(
        "mousedown",
        function(event) {
          event.preventDefault();
        }
      );

      button.addEventListener(
        "click",
        function() {
          const tag = buildTag();
          if (!tag) return;

          const textarea = textareaGetter();

          if (!insertIntoTextarea(textarea, tag)) {
            alert("找不到 Pixiv 編輯區。");
          }
        }
      );

      return button;
    }

    function installPixivDesignButton() {
      if (
        document.getElementById(
          "firehaha-pixiv-Jump-design-button"
        )
      ) {
        return true;
      }

      /*
       * 主程式會把原本 .pixiv-toolbar 搬進 #pixivWorkspace。
       * 優先使用現在真正的工作區位置。
       */
      const toolbar =
        document.querySelector(
          "#pixivWorkspace .pixiv-toolbar"
        ) ||
        document.querySelector(
          ".pixiv-toolbar"
        );

      const pageText =
        document.getElementById("pageText");

      if (!toolbar || !pageText) {
        return false;
      }

      toolbar.appendChild(
        createInsertButton(
          "firehaha-pixiv-Jump-design-button",
          "Jump",
          function() {
            return document.getElementById("pageText");
          }
        )
      );

      return true;
    }

    function installSourceButton() {
      if (
        document.getElementById(
          "firehaha-pixiv-Jump-source-button"
        )
      ) {
        return true;
      }

      /*
       * Pixiv 原始碼視窗是按下按鈕後才動態建立，
       * 因此這裡不能假設它一開始就存在。
       */
      const toolbar =
        document.querySelector(
          ".pixiv-source-window .source-toolbar"
        );

      const source =
        document.getElementById("source-text");

      if (!toolbar || !source) {
        return false;
      }

      toolbar.appendChild(
        createInsertButton(
          "firehaha-pixiv-Jump-source-button",
          "Jump",
          function() {
            return document.getElementById("source-text");
          }
        )
      );

      return true;
    }

    /*
     * Firehaha 目前 Pixiv 所見即得預覽使用內部 pixivRender()，
     * 這是主程式 IIFE 內的區域函式，外部插件不能安全覆寫。
     *
     * 因此直接在 #pixivIntegratedPreview 完成渲染後，
     * 把仍以文字存在的 [Jump:...] 換成純文字樣式節點。
     */
    function replacePreviewTextNode(node) {
      if (!node || node.nodeType !== 3) return false;

      const text = String(node.nodeValue || "");

      if (!/\[Jump:\d+/.test(text)) {
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

      while ((match = TAG_RE.exec(text))) {
        if (match.index > last) {
          fragment.appendChild(
            document.createTextNode(
              text.slice(last, match.index)
            )
          );
        }

        const page = Number(match[1]);
        const label = match[2];
        const style = normalizeStyle(match[3]);

        const span =
          document.createElement("span");

        span.className =
          "firehaha-pixiv-Jump-preview " +
          "firehaha-pixiv-Jump-preview--" +
          style;

        span.dataset.jumpPage =
          String(page);

        span.textContent =
          displayText(
            page,
            label,
            style
          );

        fragment.appendChild(span);

        last =
          match.index +
          match[0].length;
      }

      if (last < text.length) {
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

    function scanPixivPreview(root) {
      root =
        root ||
        document.getElementById(
          "pixivIntegratedPreview"
        );

      if (!root) return;

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

              return /\[Jump:\d+/.test(
                String(node.nodeValue || "")
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
        replacePreviewTextNode
      );
    }

    /*
     * Pixiv 真正輸出目前直接呼叫主程式 generatePixiv()。
     * 這個函式不是公開 API，不能直接包裝。
     *
     * 因此在 exportPixiv 的 capture 階段，
     * 暫時只把作者正文中的 [Jump:...] 轉成 Pixiv [jump:N]。
     * 主程式同步建立 Blob 後，在 setTimeout(0) 還原作者原文。
     */
    function installPixivExportBridge() {
      const button =
        document.getElementById(
          "exportPixiv"
        );

      if (
        !button ||
        button.dataset.firehahaJumpExportBridge === "1"
      ) {
        return !!button;
      }

      button.dataset.firehahaJumpExportBridge =
        "1";

      button.addEventListener(
        "click",

        function() {
          try {
            if (
              typeof pages === "undefined" ||
              !Array.isArray(pages)
            ) {
              return;
            }

            const backup =
              pages.map(
                function(page) {
                  return String(
                    page &&
                    page.text ||
                    ""
                  );
                }
              );

            let changed = false;

            pages.forEach(
              function(page) {
                if (!page) return;

                const before =
                  String(page.text || "");

                const after =
                  before.replace(
                    TAG_RE,
                    function(
                      _whole,
                      pageNumber
                    ) {
                      return (
                        "[jump:" +
                        pageNumber +
                        "]"
                      );
                    }
                  );

                if (after !== before) {
                  page.text = after;
                  changed = true;
                }
              }
            );

            if (!changed) return;

            setTimeout(
              function() {
                pages.forEach(
                  function(page, index) {
                    if (page) {
                      page.text =
                        backup[index];
                    }
                  }
                );

                try {
                  const input =
                    document.getElementById(
                      "pageText"
                    );

                  if (
                    input &&
                    window.GamebookCore &&
                    GamebookCore.currentPage
                  ) {
                    input.value =
                      String(
                        GamebookCore.currentPage.text ||
                        ""
                      );
                  }
                } catch (_) {}
              },
              0
            );

          } catch (error) {
            console.warn(
              "[Pixiv Jump] 輸出轉換失敗",
              error
            );
          }
        },

        true
      );

      return true;
    }

    /*
     * Reader Runtime：
     * 測試閱讀 / HTML Reader Artifact 裡，
     * [Jump:] 也可以顯示為純文字跳頁。
     */
    const readerRuntime = String.raw`
(function(){
  "use strict";

  if (
    window.__firehahaPixivJumpReader200
  ) {
    return;
  }

  window.__firehahaPixivJumpReader200 =
    true;

  const TAG_RE =
    /\[Jump:(\d+)(?:\|([^\]|]*))?(?:\|([^\]]*))?\]/g;

  const VALID =
    new Set([
      "plain",
      "underline",
      "bold",
      "arrow",
      "bracket",
      "quiet",
      "double",
      "dot"
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

  function labelOf(
    page,
    label,
    style
  ) {
    label =
      clean(label) ||
      ("前往第 " + page + " 頁");

    if (style === "arrow") {
      return "→ " + label;
    }

    if (style === "bracket") {
      return "＞ " + label;
    }

    if (style === "dot") {
      return "・" + label;
    }

    return label;
  }

  function createLink(
    page,
    label,
    style
  ) {
    style =
      styleOf(style);

    const link =
      document.createElement("a");

    link.href = "#";

    link.className =
      "firehaha-Jump-reader " +
      "firehaha-Jump-reader--" +
      style;

    link.dataset.jumpPage =
      String(page);

    link.textContent =
      labelOf(
        page,
        label,
        style
      );

    return link;
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
      !/\[Jump:\d+/.test(text)
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

    if (root.nodeType === 3) {
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

            return /\[Jump:\d+/.test(
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
        "[Pixiv Jump] Reader 跳頁失敗",
        error
      );
    }

    return false;
  }

  if (
    !document.getElementById(
      "firehaha-Jump-reader-style-200"
    )
  ) {
    const style =
      document.createElement("style");

    style.id =
      "firehaha-Jump-reader-style-200";

    style.textContent = [
      ".firehaha-Jump-reader{appearance:none!important;background:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;padding:0!important;margin:0!important;color:inherit!important;font:inherit!important;cursor:pointer}",
      ".firehaha-Jump-reader--plain{text-decoration:none}",
      ".firehaha-Jump-reader--underline{text-decoration:underline;text-underline-offset:.16em}",
      ".firehaha-Jump-reader--bold{font-weight:800}",
      ".firehaha-Jump-reader--quiet{opacity:.62;font-size:.94em}",
      ".firehaha-Jump-reader--double{text-decoration:underline double;text-underline-offset:.16em}",
      ".firehaha-Jump-reader--dot{text-decoration:underline dotted;text-underline-offset:.18em}"
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
              ".firehaha-Jump-reader"
            )
          : null;

      if (!link) return;

      event.preventDefault();
      event.stopPropagation();

      go(
        Number(
          link.dataset.jumpPage
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

  window.FirehahaPixivJump = {
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
              "__firehahaPixivJumpReader200"
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

        405
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

.firehaha-pixiv-Jump-preview{
  display:inline!important;
  padding:0!important;
  margin:0!important;
  border:0!important;
  border-radius:0!important;
  background:none!important;
  box-shadow:none!important;
  color:inherit!important;
  font:inherit!important;
}

.firehaha-pixiv-Jump-preview--plain{
  text-decoration:none;
}

.firehaha-pixiv-Jump-preview--underline{
  text-decoration:underline;
  text-underline-offset:.16em;
}

.firehaha-pixiv-Jump-preview--bold{
  font-weight:800!important;
}

.firehaha-pixiv-Jump-preview--quiet{
  opacity:.62;
  font-size:.94em;
}

.firehaha-pixiv-Jump-preview--double{
  text-decoration:underline double;
  text-underline-offset:.16em;
}

.firehaha-pixiv-Jump-preview--dot{
  text-decoration:underline dotted;
  text-underline-offset:.18em;
}
`
      );

    function ensureUi() {
      installPixivDesignButton();
      installSourceButton();
      installPixivExportBridge();

      const preview =
        document.getElementById(
          "pixivIntegratedPreview"
        );

      if (preview) {
        scanPixivPreview(preview);
      }
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
        function(mutations) {
          ensureUi();

          mutations.forEach(
            function(mutation) {
              mutation.addedNodes.forEach(
                function(node) {
                  if (
                    node.nodeType === 1 &&
                    (
                      node.id ===
                        "pixivIntegratedPreview" ||
                      (
                        node.querySelector &&
                        node.querySelector(
                          "#pixivIntegratedPreview"
                        )
                      )
                    )
                  ) {
                    setTimeout(
                      function() {
                        scanPixivPreview();
                      },
                      0
                    );
                  }
                }
              );
            }
          );
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

    window.FirehahaPixivJumpDesign = {
      version:"2.0.0",
      ensureUi:ensureUi,
      scanPreview:scanPixivPreview
    };

    api.toast(
      "Pixiv Jump 獨立跳頁 2.0.0 已啟用"
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

      [
        "firehaha-pixiv-Jump-design-button",
        "firehaha-pixiv-Jump-source-button"
      ].forEach(
        function(id) {
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
