// @firehaha-plugin {"id":"official.game-initialize-tag","name":"遊戲初始化標籤","version":"1.0.1","author":"Firehaha","description":"在測試閱讀／輸出閱讀器產生 HTML 前先注入 [初始化] 支援。第一次遇到時沿用官方重新開始／擴充存檔槽的 Runtime reset 能力，清空本輪 Adventure 與返回歷史；不建立按鈕、不套樣式、不跳頁、不顯示重新開始確認。"}

FirehahaPlugins.register({
  id: "official.game-initialize-tag",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha Game Initialize Tag 1.0.0 */
(function () {
  "use strict";

  if (window.__firehahaGameInitializeTag100Installed) return;
  window.__firehahaGameInitializeTag100Installed = true;

  const INIT_TAG_RE =
    /\[(?:初始化|遊戲初始化|游戏初始化|initializegame|gameinitialize)\]/gi;

  let initializing = false;

  function cleanAdventure() {
    return {
      items: [],
      flags: [],
      values: {},
      attributes: {},
      modifiers: {},
      skills: {},
      skillModifiers: {},
      quests: {},
      dice: {},
      checks: {},
      checkBands: {},
      damage: {},
      damageRules: {},
      successDice: {},
      diceModelVersion: 2,
      applied: {},
      definitionApplied: {},
      names: {},
      createdDisplayTags: {},

      /*
       * 這個標記會跟著 Adventure 進入存檔。
       * 「重新開始」建立新的 Adventure 後標記自然消失，
       * 因此下一輪再次遇到 [初始化] 時可以重新初始化。
       */
      __firehahaGameInitialized: true
    };
  }

  function hasInitialized() {
    try {
      return !!(
        typeof memorySave !== "undefined" &&
        memorySave &&
        memorySave.adventure &&
        memorySave.adventure.__firehahaGameInitialized
      );
    } catch (_) {
      return false;
    }
  }

  function saveNow() {
    try {
      if (typeof persist === "function") {
        persist();
      }
    } catch (error) {
      console.warn(
        "[Game Initialize Tag] 儲存初始化狀態失敗",
        error
      );
    }
  }

  function clearReaderHistory() {
    try {
      if (typeof history !== "undefined" && Array.isArray(history)) {
        history.length = 0;
      }
    } catch (error) {
      console.warn(
        "[Game Initialize Tag] 清除返回歷史失敗",
        error
      );
    }
  }

  function resetRuntimeThroughOfficialCore() {
    try {
      if (
        window.FirehahaNewGameSaveSlots &&
        typeof window.FirehahaNewGameSaveSlots.resetRuntime === "function"
      ) {
        window.FirehahaNewGameSaveSlots.resetRuntime();
        return true;
      }
    } catch (error) {
      console.warn(
        "[Game Initialize Tag] 官方 Runtime reset API 執行失敗",
        error
      );
    }

    /*
     * 不去模擬「重新開始」按鈕，也不呼叫 restartStory()。
     * restartStory() 會顯示確認視窗並重新 show 第一頁，
     * 對第一頁的 [初始化] 會造成循環。
     */
    return false;
  }

  function initializeGameOnce() {
    if (initializing || hasInitialized()) {
      return false;
    }

    if (
      typeof memorySave === "undefined" ||
      !memorySave
    ) {
      console.warn(
        "[Game Initialize Tag] 找不到 memorySave，略過初始化"
      );
      return false;
    }

    initializing = true;

    try {
      /*
       * 先通知／清掉各外掛 Runtime。
       * 官方 new-game-and-save-slots 1.0.5 的 resetRuntime()
       * 會再走既有 Reader Lifecycle reset-runtime。
       */
      resetRuntimeThroughOfficialCore();

      /*
       * 只重建「目前這一輪 Adventure」。
       * memorySave.slots 不動，所以手動存檔槽保留。
       */
      memorySave.adventure = cleanAdventure();

      /*
       * 初始化標籤所在頁就是起點，不重新 show()，
       * 因此不會產生藍色膠囊按鈕，也不會重新載入第一頁。
       */
      clearReaderHistory();
      saveNow();

      try {
        document.dispatchEvent(
          new CustomEvent("firehaha:game-initialized", {
            detail: {
              at: Date.now(),
              source: "initialize-tag"
            }
          })
        );
      } catch (_) {}

      console.info(
        "[Firehaha] [初始化] 已建立乾淨遊戲狀態"
      );

      return true;
    } finally {
      initializing = false;
    }
  }

  function pageSource(page) {
    if (!page) return "";

    const parts = [];

    try {
      if (typeof page.text === "string") parts.push(page.text);
    } catch (_) {}

    try {
      if (typeof page.content === "string") parts.push(page.content);
    } catch (_) {}

    try {
      if (typeof page.body === "string") parts.push(page.body);
    } catch (_) {}

    return parts.join("\n");
  }

  function pageHasInitializeTag(page) {
    const source = pageSource(page);
    INIT_TAG_RE.lastIndex = 0;
    return INIT_TAG_RE.test(source);
  }

  function stripInitializeTags(html) {
    INIT_TAG_RE.lastIndex = 0;
    return String(html == null ? "" : html).replace(INIT_TAG_RE, "");
  }

  /*
   * 第一層：
   * 在 applyAdventure 解析本頁其他 RPG 標籤之前先初始化。
   * 這樣同一頁後面的 [設定:]、[增加:] 等標籤會套用在新狀態上。
   */
  function wrapApplyAdventure() {
    if (
      typeof applyAdventure !== "function" ||
      applyAdventure.__firehahaGameInitializeTag100Wrapped
    ) {
      return false;
    }

    const oldApplyAdventure = applyAdventure;

    const wrapped = function(page) {
      try {
        if (pageHasInitializeTag(page)) {
          initializeGameOnce();
        }
      } catch (error) {
        console.warn(
          "[Game Initialize Tag] 初始化判定失敗",
          error
        );
      }

      let html = oldApplyAdventure.apply(this, arguments);

      try {
        html = stripInitializeTags(html);
      } catch (error) {
        console.warn(
          "[Game Initialize Tag] 移除初始化標籤失敗",
          error
        );
      }

      return html;
    };

    wrapped.__firehahaGameInitializeTag100Wrapped = true;
    wrapped.__firehahaGameInitializeTagOriginal = oldApplyAdventure;

    applyAdventure = wrapped;
    return true;
  }

  wrapApplyAdventure();

  /*
   * 有些 Reader 外掛會在稍後才替換 applyAdventure。
   * 短暫補掛幾次，避免安裝順序造成失效。
   */
  let wrapAttempts = 0;
  const wrapTimer = setInterval(function() {
    wrapAttempts += 1;
    wrapApplyAdventure();

    if (
      (
        typeof applyAdventure === "function" &&
        applyAdventure.__firehahaGameInitializeTag100Wrapped
      ) ||
      wrapAttempts >= 40
    ) {
      clearInterval(wrapTimer);
    }
  }, 100);

  /*
   * 第二層：
   * DOM 保底只負責把殘留的 [初始化] 文字移除。
   * 不在 DOM observer 直接觸發重置，避免渲染鏈重複執行初始化。
   */
  function stripTextNode(node) {
    if (!node || node.nodeType !== 3) return;

    const value = String(node.nodeValue || "");
    INIT_TAG_RE.lastIndex = 0;

    if (!INIT_TAG_RE.test(value)) return;

    INIT_TAG_RE.lastIndex = 0;
    node.nodeValue = value.replace(INIT_TAG_RE, "");
  }

  function scanInitializeTags(root) {
    if (!root) return;

    if (root.nodeType === 3) {
      stripTextNode(root);
      return;
    }

    if (root.nodeType !== 1 && root.nodeType !== 9) {
      return;
    }

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;

          if (
            parent &&
            parent.closest &&
            parent.closest("script,style,textarea,input,select,option")
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          const text = String(node.nodeValue || "");
          INIT_TAG_RE.lastIndex = 0;

          return INIT_TAG_RE.test(text)
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

    found.forEach(stripTextNode);
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
            stripTextNode(node);
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
      "[Game Initialize Tag] DOM 保底監看失敗",
      error
    );
  }

  window.FirehahaGameInitializeTag = {
    version: "1.0.1",

    initialize() {
      return initializeGameOnce();
    },

    isInitialized() {
      return hasInitialized();
    }
  };

  console.info(
    "[Firehaha] 遊戲初始化標籤 1.0.1 已於輸出前接入 Reader"
  );
})();
`;

    const removeTransform = api.registerReaderTransform(
      "reader",

      function(html, context) {
        html = String(html == null ? "" : html);

        if (
          html.includes(
            "__firehahaGameInitializeTag100Installed"
          )
        ) {
          return html;
        }

        /*
         * 跟正文重新開始按鈕採相同 Reader 插入位置：
         * renderAdventure() 定義前。
         */
        const marker = "function renderAdventure(){";

        if (!html.includes(marker)) {
          console.warn(
            "[Game Initialize Tag] 找不到 Reader 插入位置"
          );
          return html;
        }

        return html.replace(
          marker,
          patchCode + "\n" + marker
        );
      },

      120
    );

    api.toast(
      "遊戲初始化標籤 1.0.1 已啟用（輸出前注入）"
    );

    return function cleanup() {
      if (typeof removeTransform === "function") {
        removeTransform();
      }
    };
  }
});
