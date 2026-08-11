// @firehaha-plugin {"id":"official.game-initialize-tag","name":"遊戲初始化標籤","version":"1.0.1","author":"Firehaha","description":"在測試閱讀／正式輸出 Reader HTML 建立階段寫入 [初始化]。初始化時完整沿用 Reader Lifecycle 與 Runtime reset，使數值、骰子、媒體、一次性按鈕與各插件狀態一起回到新遊戲狀態；不顯示確認、不重新跳頁。"}

FirehahaPlugins.register({
  id: "official.game-initialize-tag",

  setup(api) {
    "use strict";

    const PATCH_MARK =
      "/* firehaha-game-initialize-tag-v1.0.1-full-lifecycle */";

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

          /* 1. 完整通知所有「重新開始前」生命週期 */
          'try{' +
            'if(window.FirehahaNewGameSaveSlots&&window.FirehahaNewGameSaveSlots.lifecycle&&typeof window.FirehahaNewGameSaveSlots.lifecycle.run==="function"){' +
              'window.FirehahaNewGameSaveSlots.lifecycle.run("before-restart",{source:"initialize-tag"});' +
            '}else if(window.FirehahaReaderLifecycle&&typeof window.FirehahaReaderLifecycle.run==="function"){' +
              'window.FirehahaReaderLifecycle.run("before-restart",{source:"initialize-tag"});' +
            '}else{' +
              'document.dispatchEvent(new CustomEvent("firehaha:reader-restart",{detail:{phase:"before",source:"initialize-tag"}}));' +
            '}' +
          '}catch(__fhBeforeError){console.warn("[初始化] before-restart 失敗",__fhBeforeError);}' +

          /* 2. 沿用主存檔插件的完整 Runtime reset coordinator */
          'try{' +
            'if(window.FirehahaNewGameSaveSlots&&typeof window.FirehahaNewGameSaveSlots.resetRuntime==="function"){' +
              'window.FirehahaNewGameSaveSlots.resetRuntime();' +
            '}' +
          '}catch(__fhRuntimeError){console.warn("[初始化] resetRuntime 失敗",__fhRuntimeError);}' +

          /* 3. 保留手動存檔，但清掉目前輪次 / auto / Adventure */
          'const __fhPreservedSlots=Array.isArray(memorySave.slots)?memorySave.slots:[];' +
          'memorySave={' +
            'slots:__fhPreservedSlots,' +
            'auto:null,' +
            'adventure:{' +
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
            '}' +
          '};' +

          /* 4. 清返回歷史與正在打字 / 舊 callback token */
          'try{if(Array.isArray(history))history.length=0}catch(__fhHistoryError){}' +
          'try{if(typeof typeToken!=="undefined")typeToken+=1}catch(__fhTokenError){}' +

          /* 5. DOM 通用保底：只清「明確屬於遊戲執行鎖」的屬性/類別 */
          'try{' +
            'document.querySelectorAll("[data-fh-roll-once]").forEach(function(n){' +
              'n.removeAttribute("data-fh-roll-once");' +
              'n.removeAttribute("aria-disabled");' +
              'if("disabled" in n)n.disabled=false;' +
              'if(n.style)n.style.pointerEvents="";' +
            '});' +
            'document.querySelectorAll(".fh-roll-once-locked,.fh-damage-helper-roll-locked,.fh-damage-single-lock-result").forEach(function(n){try{n.remove()}catch(_){}});' +
            'document.querySelectorAll(".fh-audio-button,.fh-video-button").forEach(function(n){' +
              'n.classList.remove("is-playing");' +
              'n.setAttribute("aria-pressed","false");' +
            '});' +
          '}catch(__fhDomResetError){console.warn("[初始化] DOM 鎖定清理失敗",__fhDomResetError);}' +

          /* 6. 儲存新的乾淨狀態 */
          'try{if(typeof persist==="function")persist()}catch(__fhPersistError){}' +

          /* 7. 完整通知所有「重新開始後」生命週期 */
          'try{' +
            'if(window.FirehahaNewGameSaveSlots&&window.FirehahaNewGameSaveSlots.lifecycle&&typeof window.FirehahaNewGameSaveSlots.lifecycle.run==="function"){' +
              'window.FirehahaNewGameSaveSlots.lifecycle.run("after-restart",{source:"initialize-tag"});' +
            '}else if(window.FirehahaReaderLifecycle&&typeof window.FirehahaReaderLifecycle.run==="function"){' +
              'window.FirehahaReaderLifecycle.run("after-restart",{source:"initialize-tag"});' +
            '}else{' +
              'document.dispatchEvent(new CustomEvent("firehaha:reader-restart",{detail:{phase:"after",source:"initialize-tag"}}));' +
            '}' +
          '}catch(__fhAfterError){console.warn("[初始化] after-restart 失敗",__fhAfterError);}' +

          /* 8. 下一個 event loop 再補一次 Runtime，防止舊 callback 把鎖寫回來 */
          'setTimeout(function(){' +
            'try{' +
              'if(window.FirehahaNewGameSaveSlots&&typeof window.FirehahaNewGameSaveSlots.resetRuntime==="function"){' +
                'window.FirehahaNewGameSaveSlots.resetRuntime();' +
              '}' +
            '}catch(_){}' +
            'try{if(typeof renderAdventure==="function")renderAdventure()}catch(_){}' +
          '},0);' +

          'try{' +
            'document.dispatchEvent(new CustomEvent("firehaha:game-initialized",{detail:{source:"initialize-tag",at:Date.now()}}));' +
          '}catch(_){}' +

        '}' +

        /* 移除標籤，接著讓原生 Adventure parser 繼續處理同頁其他設定 */
        'let html=__fhInitRaw.replace(/\\[(?:初始化|遊戲初始化|游戏初始化|initializegame|gameinitialize)\\]/gi,"");' +
        'const a=memorySave.adventure;';

      if (!html.includes(oldEntry)) {
        console.warn(
          "[Game Initialize Tag] 找不到 Reader applyAdventure 入口，未套用補丁。",
          context || {}
        );
        return html;
      }

      return html.replace(oldEntry, newEntry);
    }

    const removeTransform = api.registerReaderTransform(
      "reader",
      transformReader,
      120
    );

    api.toast(
      "遊戲初始化標籤 1.0.1 已啟用（完整 Runtime 重置覆蓋版）"
    );

    return function cleanup() {
      if (typeof removeTransform === "function") {
        removeTransform();
      }
    };
  }
});
