// @firehaha-plugin {"id":"official.game-initialize-tag","name":"遊戲初始化標籤","version":"1.0.1","author":"Firehaha","description":"在測試閱讀／正式輸出 Reader HTML 建立階段寫入 [初始化]。初始化鎖只存在本次頁面 Runtime，不寫入存檔；因此重新整理／重新開啟 Reader 時會重新初始化，同一次遊戲中 jump 回第一頁則不會重複初始化。"}

FirehahaPlugins.register({
  id: "official.game-initialize-tag",

  setup(api) {
    "use strict";

    const PATCH_MARK =
      "/* firehaha-game-initialize-tag-v1.0.1-runtime-only-lock */";

    function transformReader(html, context) {
      html = String(html == null ? "" : html);

      if (html.includes(PATCH_MARK)) {
        return html;
      }

      const oldEntry =
        'function applyAdventure(page){let html=String(page.content||"");const a=memorySave.adventure;';

      const newEntry =
        PATCH_MARK +

        /*
         * Runtime-only 狀態：
         * 重新整理後 window 重建，因此 initialized=false。
         * 絕對不寫入 memorySave / localStorage。
         */
        'window.__fhGameInitializeState=window.__fhGameInitializeState||{initialized:false,running:false};' +

        'function applyAdventure(page){' +
        'const __fhInitRaw=String(page&&page.content||"");' +
        'const __fhHasInit=/\\[(?:初始化|遊戲初始化|游戏初始化|initializegame|gameinitialize)\\]/i.test(__fhInitRaw);' +
        'const __fhInitState=window.__fhGameInitializeState;' +

        'if(__fhHasInit&&!__fhInitState.initialized&&!__fhInitState.running){' +
          /*
           * 必須先鎖住，避免 lifecycle / render 回呼期間又進入 applyAdventure。
           */
          '__fhInitState.running=true;' +
          '__fhInitState.initialized=true;' +

          'try{' +

            /* -------------------------------------------------
             * 1. 重新開始前生命週期
             * ------------------------------------------------- */
            'try{' +
              'if(window.FirehahaReaderLifecycle&&typeof window.FirehahaReaderLifecycle.run==="function"){' +
                'window.FirehahaReaderLifecycle.run("before-restart",{source:"initialize-tag"});' +
              '}else{' +
                'document.dispatchEvent(new CustomEvent("firehaha:reader-restart",{' +
                  'detail:{phase:"before",source:"initialize-tag"}' +
                '}));' +
              '}' +
            '}catch(__fhBeforeError){' +
              'console.warn("[初始化] before-restart 失敗",__fhBeforeError);' +
            '}' +

            /* -------------------------------------------------
             * 2. 官方 new-game Runtime reset
             * ------------------------------------------------- */
            'try{' +
              'if(window.FirehahaNewGameSaveSlots&&typeof window.FirehahaNewGameSaveSlots.resetRuntime==="function"){' +
                'window.FirehahaNewGameSaveSlots.resetRuntime();' +
              '}' +
            '}catch(__fhRuntimeError){' +
              'console.warn("[初始化] resetRuntime 失敗",__fhRuntimeError);' +
            '}' +

            /* -------------------------------------------------
             * 3. 建立全新 Adventure
             *
             * 注意：
             * 不再保存 __firehahaGameInitialized。
             * slots 保留，auto 清掉。
             * ------------------------------------------------- */
            'const __fhSlots=memorySave&&Array.isArray(memorySave.slots)?memorySave.slots:[];' +

            'if(memorySave){' +
              'memorySave.slots=__fhSlots;' +
              'memorySave.auto=null;' +
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
                'createdDisplayTags:{}' +
              '};' +
            '}' +

            /* -------------------------------------------------
             * 4. Reader 自己的歷史 / 打字 Runtime
             * ------------------------------------------------- */
            'try{' +
              'if(Array.isArray(history))history.length=0;' +
            '}catch(_){}' +

            'try{' +
              'if(typeof typeToken!=="undefined")typeToken+=1;' +
            '}catch(_){}' +

            /* -------------------------------------------------
             * 5. 通用 DOM 鎖保底
             * ------------------------------------------------- */
            'try{' +
              'document.querySelectorAll("[data-fh-roll-once]").forEach(function(node){' +
                'node.removeAttribute("data-fh-roll-once");' +
                'node.removeAttribute("aria-disabled");' +
                'if("disabled" in node)node.disabled=false;' +
                'if(node.style)node.style.pointerEvents="";' +
              '});' +

              'document.querySelectorAll(' +
                '".fh-damage-helper-roll-locked," +' +
                '".fh-roll-once-locked," +' +
                '".fh-damage-single-lock-result"' +
              ').forEach(function(node){' +
                'try{node.remove()}catch(_){}' +
              '});' +
            '}catch(__fhDomError){' +
              'console.warn("[初始化] DOM Runtime 清理失敗",__fhDomError);' +
            '}' +

            /* -------------------------------------------------
             * 6. 保存乾淨 Adventure
             *
             * 可以 persist Adventure，
             * 但初始化鎖本身不在 Adventure 裡。
             * ------------------------------------------------- */
            'try{' +
              'if(typeof persist==="function")persist();' +
            '}catch(__fhPersistError){' +
              'console.warn("[初始化] persist 失敗",__fhPersistError);' +
            '}' +

            /* -------------------------------------------------
             * 7. 重新開始後生命週期
             * ------------------------------------------------- */
            'try{' +
              'if(window.FirehahaReaderLifecycle&&typeof window.FirehahaReaderLifecycle.run==="function"){' +
                'window.FirehahaReaderLifecycle.run("after-restart",{source:"initialize-tag"});' +
              '}else{' +
                'document.dispatchEvent(new CustomEvent("firehaha:reader-restart",{' +
                  'detail:{phase:"after",source:"initialize-tag"}' +
                '}));' +
              '}' +
            '}catch(__fhAfterError){' +
              'console.warn("[初始化] after-restart 失敗",__fhAfterError);' +
            '}' +

            'try{' +
              'document.dispatchEvent(new CustomEvent("firehaha:game-initialized",{' +
                'detail:{source:"initialize-tag",at:Date.now()}' +
              '}));' +
            '}catch(_){}' +

          '}finally{' +
            '__fhInitState.running=false;' +
          '}' +
        '}' +

        /*
         * 標籤永遠不顯示。
         * 初始化完成後才取得 a，讓同頁後續原生 Adventure 標籤
         * 使用新的 Adventure。
         */
        'let html=__fhInitRaw.replace(/\\[(?:初始化|遊戲初始化|游戏初始化|initializegame|gameinitialize)\\]/gi,"");' +
        'const a=memorySave.adventure;';

      if (!html.includes(oldEntry)) {
        console.warn(
          "[Game Initialize Tag] 找不到 Reader applyAdventure 入口，未套用初始化補丁。",
          context || {}
        );
        return html;
      }

      html = html.replace(oldEntry, newEntry);

      /*
       * 正式「重新開始」後要允許同一個 HTML Runtime 再初始化。
       *
       * 監聽原有 restart lifecycle。
       * source=initialize-tag 時不解鎖，避免初始化自己的 lifecycle
       * 把 runtime lock 清掉。
       */
      const bodyPatch = `
<script>
(function(){
  if(window.__fhGameInitializeRestartUnlockInstalled)return;
  window.__fhGameInitializeRestartUnlockInstalled=true;

  document.addEventListener("firehaha:reader-lifecycle",function(event){
    try{
      var d=event&&event.detail||{};
      if(
        d.phase==="before-restart" &&
        d.source!=="initialize-tag" &&
        window.__fhGameInitializeState
      ){
        window.__fhGameInitializeState.initialized=false;
      }
    }catch(_){}
  });

  document.addEventListener("firehaha:reader-restart",function(event){
    try{
      var d=event&&event.detail||{};
      /*
       * 舊 lifecycle 相容事件通常沒有 source，
       * 只有真正的重新開始流程進來時才在 before 解鎖；
       * 初始化正在 running 時絕不解鎖。
       */
      if(
        d.phase==="before" &&
        window.__fhGameInitializeState &&
        !window.__fhGameInitializeState.running
      ){
        window.__fhGameInitializeState.initialized=false;
      }
    }catch(_){}
  });
})();
<\/script>`;

      if (/<\/body\s*>/i.test(html)) {
        html = html.replace(/<\/body\s*>/i, bodyPatch + "\n</body>");
      } else {
        html += bodyPatch;
      }

      return html;
    }

    const removeTransform = api.registerReaderTransform(
      "reader",
      transformReader,
      120
    );

    api.toast(
      "遊戲初始化標籤 1.0.1 已啟用（重新整理重置修正版）"
    );

    return function cleanup() {
      if (typeof removeTransform === "function") {
        removeTransform();
      }
    };
  }
});
