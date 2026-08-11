// @firehaha-plugin {"id":"official.game-initialize-tag","name":"遊戲初始化標籤","version":"1.0.1","author":"Firehaha","description":"將 [初始化] 轉成可自訂樣式的正文按鈕。按下後直接呼叫 official.new-game-and-save-slots 1.0.5 的 restartStory()；樣式可由標籤指定，不綁死藍色膠囊。"}

FirehahaPlugins.register({
  id: "official.game-initialize-tag",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha Game Initialize Button 1.0.1 - styled */
(function () {
  "use strict";

  if (window.__firehahaGameInitializeButton101StyledInstalled) return;
  window.__firehahaGameInitializeButton101StyledInstalled = true;

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

  function normalizeStyle(value) {
    const raw = clean(value).toLowerCase();

    if (!raw) return "default";

    const aliases = {
      "預設": "default",
      "默认": "default",
      "default": "default",

      "文字": "text",
      "純文字": "text",
      "纯文字": "text",
      "text": "text",

      "選項": "option",
      "选项": "option",
      "option": "option",

      "按鈕": "button",
      "按钮": "button",
      "button": "button",

      "框線": "outline",
      "描邊": "outline",
      "描边": "outline",
      "outline": "outline",

      "無樣式": "plain",
      "无样式": "plain",
      "plain": "plain",
      "raw": "plain"
    };

    return aliases[raw] || "default";
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

    try {
      const button = document.querySelector(".firehaha-new-game-btn");
      if (button) {
        button.click();
        return true;
      }
    } catch (_) {}

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
   * 只提供「可選樣式」，不再強迫所有初始化按鈕長一樣。
   * plain 模式完全不套本插件視覺樣式。
   */
  if (!document.getElementById("firehaha-inline-initialize-button-style")) {
    const style = document.createElement("style");
    style.id = "firehaha-inline-initialize-button-style";
    style.textContent = [
      ".fh-init-wrap{margin:14px 0;}",

      ".fh-init-btn{font:inherit;cursor:pointer;}",

      ".fh-init-style-default{appearance:none;border:1px solid rgba(100,116,139,.32);border-radius:8px;padding:8px 13px;background:transparent;color:inherit;}",

      ".fh-init-style-button{appearance:none;border:1px solid rgba(100,116,139,.38);border-radius:6px;padding:8px 14px;background:rgba(148,163,184,.12);color:inherit;}",

      ".fh-init-style-outline{appearance:none;border:1px solid currentColor;border-radius:6px;padding:8px 14px;background:transparent;color:inherit;}",

      ".fh-init-style-text{appearance:none;border:0;padding:0;background:none;color:inherit;text-decoration:underline;text-underline-offset:3px;}",

      /*
       * option 故意使用很少 CSS，讓 Reader / 排版工作室既有
       * 選項樣式有機會接手。
       */
      ".fh-init-style-option{font:inherit;cursor:pointer;}",

      /*
       * plain：本插件完全不控制外觀。
       */
      ".fh-init-style-plain{font:inherit;cursor:pointer;}",

      "body.reader-dark .fh-init-style-default,body.reader-dark .fh-init-style-button,body.reader-dark .fh-init-style-outline{color:inherit;}"
    ].join("");
    document.head.appendChild(style);
  }

  /*
   * 語法：
   *
   * [初始化]
   * [初始化:開始遊戲]
   * [初始化:開始遊戲|文字]
   * [初始化:開始遊戲|選項]
   * [初始化:開始遊戲|按鈕]
   * [初始化:開始遊戲|框線]
   * [初始化:開始遊戲|無樣式]
   *
   * 也支援：
   * [遊戲初始化:開始遊戲|文字]
   */
  const TAG_RE =
    /\[(?:初始化|遊戲初始化|游戏初始化)(?:\s*:\s*([^\]|]*?))?(?:\s*\|\s*([^\]]*?))?\s*\]/gi;

  function buildButton(label, styleName) {
    const text = clean(label) || "初始化遊戲";
    const style = normalizeStyle(styleName);

    const className =
      "fh-init-btn firehaha-inline-initialize-button " +
      "fh-init-style-" + style;

    /*
     * option 模式多掛幾個中性 class，
     * 方便排版工作室用選擇器抓取。
     */
    const extra =
      style === "option"
        ? " data-firehaha-init-style=\"option\""
        : "";

    return (
      '<span class="fh-init-wrap">' +
      '<button type="button" class="' +
      className +
      '" data-firehaha-init="1"' +
      extra +
      ">" +
      escapeHtml(text) +
      "</button></span>"
    );
  }

  function replaceTagsInHtml(html) {
    TAG_RE.lastIndex = 0;
    return String(html == null ? "" : html).replace(
      TAG_RE,
      function(whole, label, styleName) {
        return buildButton(label, styleName);
      }
    );
  }

  function wrapApplyAdventure() {
    if (
      typeof applyAdventure !== "function" ||
      applyAdventure.__firehahaGameInitializeButton101StyledWrapped
    ) {
      return false;
    }

    const oldApplyAdventure = applyAdventure;

    const wrapped = function(page) {
      let html = oldApplyAdventure.apply(this, arguments);

      try {
        html = replaceTagsInHtml(html);
      } catch (error) {
        console.warn(
          "[Game Initialize Button] applyAdventure parse failed",
          error
        );
      }

      return html;
    };

    wrapped.__firehahaGameInitializeButton101StyledWrapped = true;
    wrapped.__firehahaGameInitializeButtonOriginal = oldApplyAdventure;
    applyAdventure = wrapped;

    return true;
  }

  wrapApplyAdventure();

  let wrapAttempts = 0;
  const wrapTimer = setInterval(function() {
    wrapAttempts += 1;
    wrapApplyAdventure();

    if (
      (
        typeof applyAdventure === "function" &&
        applyAdventure.__firehahaGameInitializeButton101StyledWrapped
      ) ||
      wrapAttempts >= 40
    ) {
      clearInterval(wrapTimer);
    }
  }, 100);

  /*
   * DOM 保底：若標籤最後仍以純文字進 DOM，轉成按鈕。
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
          document.createTextNode(text.slice(last, match.index))
        );
      }

      const holder = document.createElement("span");
      holder.innerHTML = buildButton(match[1], match[2]);

      while (holder.firstChild) {
        frag.appendChild(holder.firstChild);
      }

      last = match.index + match[0].length;
    }

    if (last < text.length) {
      frag.appendChild(
        document.createTextNode(text.slice(last))
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

          if (!parent) return NodeFilter.FILTER_REJECT;

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

  try {
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

  document.addEventListener(
    "click",
    function(event) {
      const button =
        event.target && event.target.closest
          ? event.target.closest("[data-firehaha-init='1']")
          : null;

      if (!button) return;

      event.preventDefault();
      event.stopPropagation();

      initializeGame();
    },
    true
  );

  console.info(
    "[Firehaha] 遊戲初始化標籤 1.0.1 樣式標籤版已接入 Reader"
  );
})();
`;

    const removeTransform = api.registerReaderTransform(
      "reader",

      function(html, context) {
        html = String(html == null ? "" : html);

        if (
          html.includes(
            "__firehahaGameInitializeButton101StyledInstalled"
          )
        ) {
          return html;
        }

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
      "遊戲初始化標籤 1.0.1 樣式版已啟用"
    );

    return function cleanup() {
      if (typeof removeTransform === "function") {
        removeTransform();
      }
    };
  }
});
