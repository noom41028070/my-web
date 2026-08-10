// @firehaha-plugin {"id":"official.restart-story-button","name":"正文重新開始按鈕","version":"1.2.0","author":"Firehaha","description":"在正文使用 [重新開始按鈕] 或 [重新開始按鈕:文字] 建立重新開始按鈕；除了 applyAdventure 解析外，再提供 DOM 層保底掃描，避免其他 Reader 外掛改寫渲染鏈後標籤失效。"}
FirehahaPlugins.register({
  id: "official.restart-story-button",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha Restart Story Button 1.2.0 */
(function () {
  "use strict";

  if (window.__firehahaRestartStoryButton120Installed) return;
  window.__firehahaRestartStoryButton120Installed = true;

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function restartStory() {
    try {
      if (
        window.FirehahaNewGameSaveSlots &&
        typeof window.FirehahaNewGameSaveSlots.restartStory === "function"
      ) {
        window.FirehahaNewGameSaveSlots.restartStory();
        return true;
      }
    } catch (error) {
      console.warn(
        "[Restart Story Button] New Game restart API failed",
        error
      );
    }

    try {
      const button = document.querySelector(".firehaha-new-game-btn");
      if (button) {
        button.click();
        return true;
      }
    } catch (error) {
      console.warn(
        "[Restart Story Button] restart button fallback failed",
        error
      );
    }

    try {
      if (typeof toast === "function") {
        toast("請先啟用「官方重新開始／擴充存檔槽」插件");
      } else {
        alert("請先啟用「官方重新開始／擴充存檔槽」插件。");
      }
    } catch (_) {}

    return false;
  }

  window.FirehahaRestartStoryButton = {
    version: "1.2.0",
    restart: restartStory
  };

  if (!document.getElementById("firehaha-inline-restart-button-style")) {
    const style = document.createElement("style");
    style.id = "firehaha-inline-restart-button-style";
    style.textContent = [
      ".firehaha-inline-restart-wrap{display:flex;justify-content:center;margin:18px 0;}",
      ".firehaha-inline-restart-button{appearance:none;border:1px solid rgba(180,35,24,.35);border-radius:12px;padding:10px 16px;background:#fff7f6;color:#b42318;font:800 14px/1.2 system-ui,-apple-system,'Segoe UI','Noto Sans TC',sans-serif;cursor:pointer;box-shadow:0 4px 12px rgba(15,23,42,.08);}",
      ".firehaha-inline-restart-button:hover{transform:translateY(-1px);}",
      "body.reader-dark .firehaha-inline-restart-button{background:#3a2729;border-color:#6d4145;color:#ffb4ab;}"
    ].join("");
    document.head.appendChild(style);
  }

  function buttonHtml(label) {
    return (
      '<div class="firehaha-inline-restart-wrap">' +
      '<button type="button" class="firehaha-inline-restart-button">' +
      escapeHtml(clean(label) || "↻ 重新開始") +
      "</button></div>"
    );
  }

  /*
   * 第一層：正常 applyAdventure 包裝。
   */
  function wrapApplyAdventure() {
    if (
      typeof applyAdventure !== "function" ||
      applyAdventure.__firehahaRestartStoryButton120Wrapped
    ) {
      return false;
    }

    const oldApplyAdventure = applyAdventure;

    const wrapped = function(page) {
      let html = oldApplyAdventure.apply(this, arguments);

      try {
        html = String(html == null ? "" : html).replace(
          /\[(?:重新開始按鈕|重新開始按钮|restartbutton)(?:\s*:\s*([^\]]*?))?\s*\]/gi,
          function(whole, rawLabel) {
            return buttonHtml(rawLabel);
          }
        );
      } catch (error) {
        console.warn(
          "[Restart Story Button] applyAdventure parse failed",
          error
        );
      }

      return html;
    };

    wrapped.__firehahaRestartStoryButton120Wrapped = true;
    wrapped.__firehahaRestartStoryButtonOriginal = oldApplyAdventure;

    applyAdventure = wrapped;
    return true;
  }

  wrapApplyAdventure();

  /*
   * 第二層：DOM 保底。
   *
   * 你的 Reader 可能被其他資料 / 骰子外掛重新包裝 applyAdventure，
   * 導致本插件不是最外層。這裡不再依賴渲染鏈順序：
   * 只掃描真正顯示在正文 DOM 裡的文字節點。
   *
   * 因此即使畫面已經出現：
   * [重新開始按鈕:重新挑戰]
   * 也會被轉成按鈕。
   */
  const TAG_RE =
    /\[(?:重新開始按鈕|重新開始按钮|restartbutton)(?:\s*:\s*([^\]]*?))?\s*\]/gi;

  function textNodeHasTag(node) {
    return (
      node &&
      node.nodeType === 3 &&
      /\[(?:重新開始按鈕|重新開始按钮|restartbutton)/i.test(
        String(node.nodeValue || "")
      )
    );
  }

  function replaceTextNode(node) {
    if (!textNodeHasTag(node)) return false;

    const text = String(node.nodeValue || "");
    TAG_RE.lastIndex = 0;

    if (!TAG_RE.test(text)) return false;
    TAG_RE.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let last = 0;
    let match;

    while ((match = TAG_RE.exec(text))) {
      if (match.index > last) {
        frag.appendChild(
          document.createTextNode(
            text.slice(last, match.index)
          )
        );
      }

      const wrap = document.createElement("div");
      wrap.className = "firehaha-inline-restart-wrap";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "firehaha-inline-restart-button";
      button.textContent =
        clean(match[1]) || "↻ 重新開始";

      wrap.appendChild(button);
      frag.appendChild(wrap);

      last = match.index + match[0].length;
    }

    if (last < text.length) {
      frag.appendChild(
        document.createTextNode(
          text.slice(last)
        )
      );
    }

    node.parentNode.replaceChild(frag, node);
    return true;
  }

  function scanRestartTags(root) {
    root = root || document.body;
    if (!root) return;

    if (root.nodeType === 3) {
      replaceTextNode(root);
      return;
    }

    /*
     * 排除 script / style / textarea / input，
     * 避免去改 Reader 自己的程式碼與表單。
     */
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;

          if (!parent) {
            return NodeFilter.FILTER_REJECT;
          }

          if (
            parent.closest(
              "script,style,textarea,input,select,option"
            )
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          return textNodeHasTag(node)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const found = [];
    let node;

    while ((node = walker.nextNode())) {
      found.push(node);
    }

    found.forEach(replaceTextNode);
  }

  /*
   * 初次 Reader 完成後掃一次。
   */
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      function() {
        scanRestartTags(document.body);
      },
      { once: true }
    );
  } else {
    scanRestartTags(document.body);
  }

  /*
   * Reader 換頁時通常只改一小段 DOM。
   * observer 只處理新增節點，不反覆掃整個 document。
   */
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === 3) {
          replaceTextNode(node);
        } else if (node.nodeType === 1) {
          scanRestartTags(node);
        }
      });
    });
  });

  try {
    observer.observe(
      document.body || document.documentElement,
      {
        childList: true,
        subtree: true
      }
    );
  } catch (error) {
    console.warn(
      "[Restart Story Button] DOM fallback observer failed",
      error
    );
  }

  document.addEventListener(
    "click",
    function(event) {
      const button =
        event.target && event.target.closest
          ? event.target.closest(".firehaha-inline-restart-button")
          : null;

      if (!button) return;

      event.preventDefault();
      event.stopPropagation();
      restartStory();
    },
    true
  );

  console.info(
    "[Firehaha] 正文重新開始按鈕 1.2.0 已接入 Reader"
  );
})();
`;

    const removeTransform = api.registerReaderTransform(
      "reader",

      function(html, context) {
        html = String(html == null ? "" : html);

        if (
          html.includes(
            "__firehahaRestartStoryButton120Installed"
          )
        ) {
          return html;
        }

        const marker = "function renderAdventure(){";

        if (!html.includes(marker)) {
          console.warn(
            "[Restart Story Button] 找不到 Reader 插入位置"
          );
          return html;
        }

        return html.replace(
          marker,
          patchCode + "\n" + marker
        );
      },

      390
    );

    api.toast(
      "正文重新開始按鈕 1.2.0 已啟用"
    );

    return function cleanup() {
      removeTransform();
    };
  }
});
