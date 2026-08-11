// @firehaha-plugin {"id":"official.game-initialize-tag","name":"遊戲初始化標籤","version":"1.0.1","author":"Firehaha","description":"在測試閱讀／正式輸出 Reader HTML 建立階段，直接把 [初始化] 能力寫入原生 applyAdventure。每輪第一次遇到時清空 Adventure；不建立按鈕、不套樣式、不跳頁。"}

FirehahaPlugins.register({
  id: "official.game-initialize-tag",

  setup(api) {
    "use strict";

    const PATCH_MARK =
      "/* firehaha-game-initialize-tag-v1.0.1-export-safe */";

    /*
     * 不再依賴「Reader 開啟後包裝 applyAdventure」。
     * 直接在 createReaderArtifact() 的 HTML transform 階段，
     * 改寫正式 Reader 內建的 applyAdventure()。
     *
     * 因此：
     * - 測試閱讀有效
     * - 正式輸出後單獨開 HTML 也有效
     * - 不需要外部 JS 跟著輸出檔
     */
    function transformReader(html, context) {
      html = String(html == null ? "" : html);

      if (html.includes(PATCH_MARK)) {
        return html;
      }

      const oldEntry =
        'function applyAdventure(page){let html=String(page.content||"");const a=memorySave.adventure;';

      const newEntry =
        PATCH_MARK +
        'function applyAdventure(page){' +
        'const __fhInitRaw=String(page&&page.content||"");' +
        'const __fhHasInit=/\\[(?:初始化|遊戲初始化|游戏初始化|initializegame|gameinitialize)\\]/i.test(__fhInitRaw);' +
        'if(__fhHasInit&&memorySave&&memorySave.adventure&&!memorySave.adventure.__firehahaGameInitialized){' +

          /*
           * 若「重新開始／存檔槽」插件有把 Runtime API 一起輸出，
           * 優先沿用它；沒有也不會影響初始化本體。
           */
          'try{' +
            'if(window.FirehahaNewGameSaveSlots&&typeof window.FirehahaNewGameSaveSlots.resetRuntime==="function"){' +
              'window.FirehahaNewGameSaveSlots.resetRuntime();' +
            '}' +
          '}catch(__fhInitRuntimeError){' +
            'console.warn("[Game Initialize Tag] Runtime reset 失敗",__fhInitRuntimeError);' +
          '}' +

          /*
           * 只重建目前 Adventure。
           * slots / auto 存檔資料不碰。
           */
          'memorySave.adventure={' +
            'items:[],' +
            'flags:[],' +
            'values:{},' +
            'attributes:{},' +
            'modifiers:{},' +
            'skills:{},' +
            'skillModifiers:{},' +
            'quests:{},' +
            'dice:{},' +
            'checks:{},' +
            'checkBands:{},' +
            'damage:{},' +
            'damageRules:{},' +
            'successDice:{},' +
            'diceModelVersion:2,' +
            'applied:{},' +
            'definitionApplied:{},' +
            'names:{},' +
            'createdDisplayTags:{},' +
            '__firehahaGameInitialized:true' +
          '};' +

          /*
           * 第一頁就是新一輪起點。
           * 清返回歷史，但不 show()、不重新載入頁面。
           */
          'try{if(Array.isArray(history))history.length=0}catch(__fhHistoryError){}' +
          'try{if(typeof persist==="function")persist()}catch(__fhPersistError){}' +

          'try{' +
            'document.dispatchEvent(new CustomEvent("firehaha:game-initialized",{' +
              'detail:{source:"initialize-tag",at:Date.now()}' +
            '}));' +
          '}catch(__fhEventError){}' +
        '}' +

        /*
         * 初始化完成後才取得 a，
         * 確保後續本頁的 [數值:] / [屬性:] 等，
         * 都寫進「新的」 Adventure。
         */
        'let html=__fhInitRaw.replace(/\\[(?:初始化|遊戲初始化|游戏初始化|initializegame|gameinitialize)\\]/gi,"");' +
        'const a=memorySave.adventure;';

      if (!html.includes(oldEntry)) {
        console.warn(
          "[Game Initialize Tag] 找不到正式 Reader 的 applyAdventure 入口，未套用初始化補丁。",
          context || {}
        );
        return html;
      }

      html = html.replace(oldEntry, newEntry);

      return html;
    }

    /*
     * priority 保持偏前。
     * 真正關鍵不是 priority，而是補丁直接寫入最終 artifact HTML。
     */
    const removeTransform = api.registerReaderTransform(
      "reader",
      transformReader,
      120
    );

    api.toast(
      "遊戲初始化標籤 1.0.1 已啟用（正式輸出修正版）"
    );

    return function cleanup() {
      if (typeof removeTransform === "function") {
        removeTransform();
      }
    };
  }
});
