// @firehaha-plugin {"id":"official.game-initialize-tag","name":"遊戲初始化標籤","version":"1.0.1","author":"Firehaha","description":"將 [初始化] 或 [初始化:文字] 轉成正文初始化按鈕。按下後直接呼叫 official.new-game-and-save-slots 1.0.5 的 restartStory()，完整重置遊戲狀態並回到第一頁。"}

FirehahaPlugins.register({
  id: "official.game-initialize-tag",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha Game Initialize Button 1.0.1 */
(function () {
  "use strict";

  if (window.__firehahaGameInitializeButton101Installed) return;
  window.__firehahaGameInitializeButton101Installed = true;

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

  function initializeGame() {
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
        "[Game Initialize Button] restartStory API failed",
        error
      );
    }

    /*
     * 官方主插件還沒就緒時，退回點擊它自己的「重新開始」按鈕。
     */
    try {
      const button = document.querySelector(".firehaha-new-game-btn");
      if (button) {
        button.click();
        return true;
      }
    } catch (error) {
      console.warn(
        "[Game Initialize Button] restart button fallback failed",
        error
      );
    }

    try {
      if (typeof toast === "function") {
        toast("請先啟用「官方重新開始／擴充存檔槽」1.0.5");
      } else {
        alert("請先啟用「官方重新開始／擴充存檔槽」1.0.5。");
      }
    } catch (_) {}

    return false;
  }

  window.FirehahaGameInitializeTag = {
    version: "1.0.1",
    initialize: initializeGame
  };

  /*
   * 不再執行自動初始化。
   * [初始化] 現在只是一顆明確由玩家觸發的控制按鈕。
   *
   * 使用與正文重新開始按鈕相近的結構，
   * 但 class 獨立，避免事件衝突。
   */
  if (!document.getElementById("firehaha-inline-initialize-button-style")) {
    const style = document.createElement("style");
    style.id = "firehaha-inline-initialize-button-style";
    style.textContent = [
      ".firehaha-inline-initialize-wrap{display:flex;justify-content:center;margin:18px 0;}",
      ".firehaha-inline-initialize-button{appearance:none;border:1px solid rgba(100,116,139,.32);border-radius:10px;padding:9px 14px;background:#fff;color:#334155;font:700 14px/1.2 system-ui,-apple-system,'Segoe UI','Noto Sans TC',sans-serif;cursor:pointer;}",
      ".firehaha-inline-initialize-button:hover{filter:brightness(.98);}",
      "body.reader-dark .firehaha-inline-initialize-button{background:#263442;border-color:#506173;color:#e6eef6;}"
    ].join("");
    document.head.appendChild(style);
  }

  function buttonHtml(label) {
    return (
      '<div class="firehaha-inline-initialize-wrap">' +
      '<button type="button" class="firehaha-inline-initialize-button">' +
      escapeHtml(clean(label) || "初始化遊戲") +
      "</button></div>"
    );
  }

  const TAG_RE =
    /\[(?:初始化|遊戲初始化|游戏初始化)(?:\s*:\s*([^\]]*?))?\s*\]/gi;

  /*
   * 第一層：包裝 applyAdventure。
   */
  function wrapApplyAdventure() {
    if (
      typeof applyAdventure !== "function" ||
      applyAdventure.__firehahaGameInitializeButton101Wrapped
    ) {
      return false;
    }

    const oldApplyAdventure = applyAdventure;

    const wrapped = function(page) {
      let html = oldApplyAdventure.apply(this, arguments);

      try {
        html = String(html == null ? "" : html).replace(
          TAG_RE,
          function(whole, rawLabel) {
            return buttonHtml(rawLabel);
          }
        );
      } catch (error) {
        console.warn(
          "[Game Initialize Button] applyAdventure parse failed",
          error
        );
      }

      return html;
    };

    wrapped.__firehahaGameInitializeButton101Wrapped = true;
    wrapped.__firehahaGameInitializeButtonOriginal = oldApplyAdventure;
    applyAdventure = wrapped;

    return true;
  }

  wrapApplyAdventure();

  /*
   * 其他 Reader 外掛可能稍後再次包裝 applyAdventure，
   * 短暫重試，避免插件順序造成失效。
   */
  let wrapAttempts = 0;
  const wrapTimer = setInterval(function() {
    wrapAttempts += 1;
    wrapApplyAdventure();

    if (
      (
        typeof applyAdventure === "function" &&
        applyAdventure.__firehahaGameInitializeButton101Wrapped
      ) ||
      wrapAttempts >= 40
    ) {
      clearInterval(wrapTimer);
    }
  }, 100);

  /*
   * 第二層：DOM 保底。
   * 如果某個外掛把 [初始化] 以純文字留到畫面上，
   * 直接在文字節點轉成按鈕。
   */
  function textNodeHasTag(node) {
    return (
      node &&
      node.nodeType === 3 &&
      /\[(?:初始化|遊戲初始化|游戏初始化)/i.test(
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
      wrap.className = "firehaha-inline-initialize-wrap";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "firehaha-inline-initialize-button";
      button.textContent =
        clean(match[1]) || "初始化遊戲";

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

  function scanInitializeTags(root) {
    root = root || document.body;
    if (!root) return;

    if (root.nodeType === 3) {
      replaceTextNode(root);
      return;
    }

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

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      function() {
        scanInitializeTags(document.body);
      },
      { once: true }
    );
  } else {
    scanInitializeTags(document.body);
  }

  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === 3) {
          replaceTextNode(node);
        } else if (node.nodeType === 1) {
          scanInitializeTags(node);
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
      "[Game Initialize Button] DOM observer failed",
      error
    );
  }

  /*
   * 點擊時只做一件事：
   * 交給 official.new-game-and-save-slots 1.0.5 的 restartStory()。
   *
   * 那邊會自行：
   * - 顯示確認
   * - before-restart
   * - resetKnownPluginRuntime
   * - 建立空 Adventure
   * - 清 Reader 返回歷史
   * - 回第一頁
   * - after-restart
   * - 保留手動存檔槽
   */
  document.addEventListener(
    "click",
    function(event) {
      const button =
        event.target && event.target.closest
          ? event.target.closest(".firehaha-inline-initialize-button")
          : null;

      if (!button) return;

      event.preventDefault();
      event.stopPropagation();

      initializeGame();
    },
    true
  );

  console.info(
    "[Firehaha] 遊戲初始化標籤 1.0.1 按鈕版已接入 Reader"
  );
})();
`;

    const removeTransform = api.registerReaderTransform(
      "reader",

      function(html, context) {
        html = String(html == null ? "" : html);

        if (
          html.includes(
            "__firehahaGameInitializeButton101Installed"
          )
        ) {
          return html;
        }

        /*
         * 與正文重新開始按鈕使用相同安全插入點。
         * 讓測試閱讀與正式輸出 HTML 都自帶功能。
         */
        const marker = "function renderAdventure(){";

        if (!html.includes(marker)) {
          console.warn(
            "[Game Initialize Button] 找不到 Reader 插入位置",
            context || {}
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
      "遊戲初始化標籤 1.0.1 按鈕版已啟用"
    );

    return function cleanup() {
      if (typeof removeTransform === "function") {
        removeTransform();
      }
    };
  }
});
