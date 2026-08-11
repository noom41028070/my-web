// @firehaha-plugin {"id":"official.game-initialize-tag","name":"遊戲初始化標籤","version":"1.0.1","author":"Firehaha","description":"正式 Reader 的 [初始化] 標籤。等待 official.new-game-and-save-slots 1.0.5 Runtime 建立後，完整沿用其 resetRuntime / lifecycle 進行無確認、無跳頁式新遊戲初始化；保留手動存檔。"}

FirehahaPlugins.register({
  id: "official.game-initialize-tag",

  setup(api) {
    "use strict";

    const MARK =
      "/* firehaha-game-initialize-tag-v1.0.1-rewrite */";

    const ENTRY =
      'function applyAdventure(page){let html=String(page.content||"");const a=memorySave.adventure;';

    /*
     * applyAdventure 在 Reader 第一次 show() 時可能比
     * new-game-and-save-slots 的尾端 Runtime 更早執行。
     *
     * 所以這裡不直接 reset。
     * 只記錄「本頁要求初始化」，真正 reset 交給頁尾 bootstrap，
     * 等 FirehahaNewGameSaveSlots 1.0.5 已存在後再做。
     */
    const REPLACEMENT =
      MARK +
      'window.__fhInit101=window.__fhInit101||{' +
        'done:false,' +
        'pending:false,' +
        'running:false,' +
        'pageId:"",' +
        'suspend:false' +
      '};' +

      'function applyAdventure(page){' +
        'let html=String(page.content||"");' +
        'const __fhInitState=window.__fhInit101;' +
        'const __fhHasInit=/\\[(?:初始化|遊戲初始化|游戏初始化)\\]/i.test(html);' +

        'if(__fhHasInit&&!__fhInitState.done&&!__fhInitState.running&&!__fhInitState.suspend){' +
          '__fhInitState.pending=true;' +
          'try{' +
            '__fhInitState.pageId=String((page&&page.id)||currentId||"");' +
          '}catch(_){' +
            '__fhInitState.pageId=String((page&&page.id)||"");' +
          '}' +
        '}' +

        /* [初始化] 永遠是隱形控制標籤 */
        'html=html.replace(/\\[(?:初始化|遊戲初始化|游戏初始化)\\]/gi,"");' +
        'const a=memorySave.adventure;';

    const BOOTSTRAP = String.raw`
<script>
(function(){
  "use strict";

  if(window.__fhInit101BootstrapInstalled)return;
  window.__fhInit101BootstrapInstalled=true;

  window.__fhInit101=window.__fhInit101||{
    done:false,
    pending:false,
    running:false,
    pageId:"",
    suspend:false
  };

  function emptyAdventure(){
    /*
     * 與 official.new-game-and-save-slots 1.0.5
     * createEmptyAdventure() 欄位保持一致。
     */
    return {
      items:[],
      flags:[],
      values:{},
      attributes:{},
      modifiers:{},
      skills:{},
      skillModifiers:{},
      quests:{},
      dice:{},
      checks:{},
      checkBands:{},
      damage:{},
      damageRules:{},
      successDice:{},
      diceModelVersion:2,
      applied:{},
      definitionApplied:{},
      names:{},
      createdDisplayTags:{}
    };
  }

  function cloneSlots(){
    try{
      if(!memorySave||!Array.isArray(memorySave.slots))return [];
      if(typeof structuredClone==="function"){
        return structuredClone(memorySave.slots);
      }
      return JSON.parse(JSON.stringify(memorySave.slots));
    }catch(_){
      try{
        return Array.isArray(memorySave.slots)
          ? memorySave.slots.slice()
          : [];
      }catch(__){
        return [];
      }
    }
  }

  function saveNow(){
    try{
      if(typeof persist==="function")persist();
    }catch(error){
      console.warn("[初始化] persist 失敗",error);
    }
  }

  function renderPanels(){
    try{
      if(typeof renderSaves==="function")renderSaves();
    }catch(_){}
    try{
      if(typeof renderAdventure==="function")renderAdventure();
    }catch(_){}
  }

  function officialApi(){
    var core=window.FirehahaNewGameSaveSlots;
    if(
      !core ||
      String(core.version||"")!=="1.0.5" ||
      typeof core.resetRuntime!=="function"
    ){
      return null;
    }
    return core;
  }

  function silentInitialize(){
    var state=window.__fhInit101;

    if(
      !state ||
      state.done ||
      !state.pending ||
      state.running ||
      state.suspend
    ){
      return false;
    }

    var core=officialApi();
    if(!core)return false;

    state.running=true;
    state.pending=false;
    /*
     * show() 前先 done，避免重畫第一頁時再次排入初始化。
     * 這個 done 只存在 window；F5 後自然消失。
     */
    state.done=true;

    var targetId=String(state.pageId||"");

    try{
      /*
       * 完全採用官方 1.0.5 的公開生命週期。
       * 不自行掃 localStorage，也不自行猜插件 DOM。
       */
      try{
        if(
          core.lifecycle &&
          typeof core.lifecycle.run==="function"
        ){
          core.lifecycle.run(
            "before-restart",
            {
              startId:targetId,
              source:"initialize-tag"
            }
          );
        }
      }catch(error){
        console.warn("[初始化] before-restart 失敗",error);
      }

      /*
       * 第一輪：等同 restartStory() 的 resetKnownPluginRuntime("restart")
       * 對外公開版本。
       */
      core.resetRuntime();

      var preservedSlots=cloneSlots();

      /*
       * 與 completeRestart() 一樣：
       * 保留手動槽，清 auto，建立全新 Adventure。
       */
      memorySave={
        slots:preservedSlots,
        auto:null,
        adventure:emptyAdventure()
      };

      /*
       * 第二輪：
       * 官方 completeRestart() 在新 Adventure 建好後會再清傷害骰。
       * 對外沒有單獨 damage reset，因此再次呼叫官方 resetRuntime，
       * 讓所有已知 Runtime 都重新綁到新 Adventure。
       */
      core.resetRuntime();

      try{
        if(Array.isArray(history))history.length=0;
      }catch(_){}

      try{
        if(typeof typeToken!=="undefined")typeToken+=1;
      }catch(_){}

      /*
       * 重新顯示「含 [初始化] 的那一頁」。
       * 這一步很重要：第一次 applyAdventure 可能在 reset 前已跑過，
       * 重畫後該頁的 [數值:]、[屬性:] 等初始設定才會套到新 Adventure。
       */
      if(
        targetId &&
        typeof show==="function"
      ){
        try{
          show(targetId,true);
        }catch(error){
          console.warn("[初始化] 重畫起始頁失敗",error);
        }
      }

      /*
       * 仿官方 completeRestart()：
       * DOM 重畫後下一個 tick 再清一次 Runtime，
       * 防止舊骰 callback 把鎖寫回來。
       */
      setTimeout(function(){
        try{
          var latest=officialApi();
          if(latest)latest.resetRuntime();
        }catch(_){}
        renderPanels();
        saveNow();
      },0);

      saveNow();
      renderPanels();

      try{
        if(
          core.lifecycle &&
          typeof core.lifecycle.run==="function"
        ){
          core.lifecycle.run(
            "after-restart",
            {
              startId:targetId,
              source:"initialize-tag"
            }
          );
        }
      }catch(error){
        console.warn("[初始化] after-restart 失敗",error);
      }

      try{
        document.dispatchEvent(
          new CustomEvent(
            "firehaha:game-initialized",
            {
              detail:{
                source:"initialize-tag",
                startId:targetId,
                at:Date.now()
              }
            }
          )
        );
      }catch(_){}

      console.info(
        "[Firehaha] [初始化] 已透過 new-game-and-save-slots 1.0.5 完成"
      );

      return true;

    }finally{
      state.running=false;
    }
  }

  /*
   * 官方重新開始本身已經是完整新遊戲。
   * 它 show 第一頁時不要讓 [初始化] 插手，避免雙重 reset。
   */
  document.addEventListener(
    "firehaha:reader-lifecycle",
    function(event){
      try{
        var d=event&&event.detail||{};
        var state=window.__fhInit101;
        if(!state)return;

        if(
          d.phase==="before-restart" &&
          d.source!=="initialize-tag"
        ){
          state.suspend=true;
          state.pending=false;
        }

        if(
          d.phase==="after-restart" &&
          d.source!=="initialize-tag"
        ){
          state.suspend=false;
          /*
           * 官方 restartStory() 已經完成初始化，
           * 所以這一輪直接視為 done。
           */
          state.done=true;
          state.pending=false;
        }

        /*
         * 讀檔不能觸發第一頁 [初始化] 把存檔洗掉。
         */
        if(d.phase==="before-load"){
          state.suspend=true;
          state.pending=false;
        }

        if(d.phase==="after-load"){
          state.suspend=false;
          state.done=true;
          state.pending=false;
        }
      }catch(_){}
    },
    true
  );

  /*
   * Bootstrap 可能比 new-game 1.0.5 快一點載入，
   * 因此只等待官方 API 出現，不自行 fallback。
   */
  var attempts=0;
  var timer=setInterval(function(){
    attempts+=1;

    if(silentInitialize()){
      clearInterval(timer);
      return;
    }

    if(
      window.__fhInit101 &&
      window.__fhInit101.done
    ){
      clearInterval(timer);
      return;
    }

    /*
     * 約 10 秒後仍沒有官方 API 才停止。
     * 正常輸出不會走到這裡。
     */
    if(attempts>=100){
      clearInterval(timer);
      if(
        window.__fhInit101 &&
        window.__fhInit101.pending
      ){
        console.warn(
          "[初始化] 找不到 official.new-game-and-save-slots 1.0.5，未執行初始化。"
        );
      }
    }
  },100);

  /*
   * 若本插件腳本本身就在官方 API 之後載入，
   * 立即嘗試一次，不必等 100ms。
   */
  silentInitialize();

  window.FirehahaGameInitializeTag={
    version:"1.0.1",
    initialize:silentInitialize,
    state:function(){
      return Object.assign({},window.__fhInit101||{});
    }
  };
})();
<\/script>`;

    const removeTransform = api.registerReaderTransform(
      "reader",
      function(html, context) {
        html = String(html == null ? "" : html);

        if (html.includes(MARK)) {
          return html;
        }

        if (!html.includes(ENTRY)) {
          console.warn(
            "[Game Initialize Tag] 找不到正式 Reader applyAdventure() 入口。",
            context || {}
          );
          return html;
        }

        html = html.replace(
          ENTRY,
          REPLACEMENT
        );

        /*
         * 放頁尾；真正執行時仍會等待
         * FirehahaNewGameSaveSlots 1.0.5 API 出現。
         */
        if (/<\/body\s*>/i.test(html)) {
          return html.replace(
            /<\/body\s*>/i,
            BOOTSTRAP + "\n</body>"
          );
        }

        return html + BOOTSTRAP;
      },

      /*
       * 晚於 official.new-game-and-save-slots 的 300。
       * 即使宿主的 transform 排序不同，bootstrap 還有 API polling 保底。
       */
      420
    );

    api.toast(
      "遊戲初始化標籤 1.0.1 重寫版已啟用"
    );

    return function cleanup() {
      if (typeof removeTransform === "function") {
        removeTransform();
      }
    };
  }
});
