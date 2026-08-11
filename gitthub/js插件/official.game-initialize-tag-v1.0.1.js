// @firehaha-plugin {"id":"official.game-initialize-tag","name":"遊戲初始化標籤","version":"1.0.1","author":"Firehaha","description":"將 [初始化] 轉成可自訂樣式的文字／選項控制，不使用 button 元素，避免 Reader 全域藍色膠囊 CSS。點擊後呼叫 official.new-game-and-save-slots 1.0.5 的 restartStory()。"}

FirehahaPlugins.register({
  id: "official.game-initialize-tag",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha Game Initialize Link 1.0.1 */
(function () {
  "use strict";

  if (window.__firehahaGameInitializeLink101Installed) return;
  window.__firehahaGameInitializeLink101Installed = true;

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

    if (!raw) return "text";

    const aliases = {
      "文字": "text",
      "純文字": "text",
      "纯文字": "text",
      "text": "text",

      "選項": "option",
      "选项": "option",
      "option": "option",

      "底線": "underline",
      "underline": "underline",

      "框線": "outline",
      "描邊": "outline",
      "描边": "outline",
      "outline": "outline",

      "無樣式": "plain",
      "无样式": "plain",
      "plain": "plain",
      "raw": "plain",

      "預設": "text",
      "默认": "text",
      "default": "text"
    };

    return aliases[raw] || "text";
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
        "[Game Initialize Link] restartStory API failed",
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
   * 關鍵修正：
   * 完全不用 <button>。
   * Reader 的全域 button CSS 因此無法把它變成藍色膠囊。
   */
  if (!document.getElementById("firehaha-inline-initialize-link-style")) {
    const style = document.createElement("style");
    style.id = "firehaha-inline-initialize-link-style";
    style.textContent = [
      ".fh-init-action{font:inherit;color:inherit;cursor:pointer;touch-action:manipulation;}",

      ".fh-init-style-text{display:inline;text-decoration:none;}",

      ".fh-init-style-underline{display:inline;text-decoration:underline;text-underline-offset:3px;}",

      ".fh-init-style-option{display:inline-block;}",

      ".fh-init-style-outline{display:inline-block;border:1px solid currentColor;border-radius:6px;padding:7px 12px;background:transparent;}",

      ".fh-init-style-plain{display:inline;}",

      ".fh-init-action:focus-visible{outline:2px solid currentColor;outline-offset:3px;}"
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
   * [初始化:開始遊戲|底線]
   * [初始化:開始遊戲|框線]
   * [初始化:開始遊戲|無樣式]
   */
  const TAG_RE =
    /\[(?:初始化|遊戲初始化|游戏初始化)(?:\s*:\s*([^\]|]*?))?(?:\s*\|\s*([^\]]*?))?\s*\]/gi;

  function buildAction(label, styleName) {
    const text = clean(label) || "初始化遊戲";
    const style = normalizeStyle(styleName);

    return (
      '<span ' +
      'class="fh-init-action fh-init-style-' + style + '" ' +
      'data-firehaha-init="1" ' +
      'role="button" ' +
      'tabindex="0" ' +
      'data-init-style="' + style + '"' +
      '>' +
      escapeHtml(text) +
      '</span>'
    );
  }

  function replaceTagsInHtml(html) {
    TAG_RE.lastIndex = 0;

    return String(html == null ? "" : html).replace(
      TAG_RE,
      function(whole, label, styleName) {
        return buildAction(label, styleName);
      }
    );
  }

  function wrapApplyAdventure() {
    if (
      typeof applyAdventure !== "function" ||
      applyAdventure.__firehahaGameInitializeLink101Wrapped
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
          "[Game Initialize Link] applyAdventure parse failed",
          error
        );
      }

      return html;
    };

    wrapped.__firehahaGameInitializeLink101Wrapped = true;
    wrapped.__firehahaGameInitializeLinkOriginal = oldApplyAdventure;
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
        applyAdventure.__firehahaGameInitializeLink101Wrapped
      ) ||
      wrapAttempts >= 40
    ) {
      clearInterval(wrapTimer);
    }
  }, 100);

  /*
   * DOM fallback。
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

      const holder = document.createElement("span");
      holder.innerHTML = buildAction(match[1], match[2]);

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

  function scan(root) {
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
        scan(document.body);
      },
      { once: true }
    );
  } else {
    scan(document.body);
  }

  try {
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 3) {
            replaceTextNode(node);
          } else if (node.nodeType === 1) {
            scan(node);
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
  } catch (_) {}

  function activate(target) {
    if (!target) return false;

    const action =
      target.closest
        ? target.closest("[data-firehaha-init='1']")
        : null;

    if (!action) return false;

    initializeGame();
    return true;
  }

  document.addEventListener(
    "click",
    function(event) {
      if (!activate(event.target)) return;

      event.preventDefault();
      event.stopPropagation();
    },
    true
  );

  document.addEventListener(
    "keydown",
    function(event) {
      if (
        event.key !== "Enter" &&
        event.key !== " "
      ) {
        return;
      }

      if (!activate(event.target)) return;

      event.preventDefault();
      event.stopPropagation();
    },
    true
  );

  console.info(
    "[Firehaha] 遊戲初始化標籤 1.0.1 非 button 樣式版已接入 Reader"
  );
})();
`;

    const removeTransform = api.registerReaderTransform(
      "reader",

      function(html, context) {
        html = String(html == null ? "" : html);

        if (
          html.includes(
            "__firehahaGameInitializeLink101Installed"
          )
        ) {
          return html;
        }

        const marker = "function renderAdventure(){";

        if (!html.includes(marker)) {
          console.warn(
            "[Game Initialize Link] 找不到 Reader 插入位置",
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
      "遊戲初始化標籤 1.0.1 非 button 樣式版已啟用"
    );

    return function cleanup() {
      if (typeof removeTransform === "function") {
        removeTransform();
      }
    };
  }
});
