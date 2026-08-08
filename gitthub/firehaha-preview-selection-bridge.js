// @firehaha-plugin {"id":"official.preview-selection-bridge","name":"Node 切換預覽橋樑","version":"1.0.0","author":"Firehaha","description":"在不修改主程式的情況下，於切換超長 Node 前暫時提供安全文字切片，避免主程式解析完整 12 萬至 30 萬字預覽；切換後立即還原完整正文。"}

FirehahaPlugins.register({

  id:
    "official.preview-selection-bridge",

  name:
    "Node 切換預覽橋樑",

  version:
    "1.0.0",


  async setup(api){

    "use strict";


    // =====================================================
    // 設定
    // =====================================================

    const READY_TIMEOUT =
      12000;


    const SOFT_NODE_LIMIT =
      120000;


    const HARD_NODE_LIMIT =
      300000;


    const SOFT_SLICE_LIMIT =
      10000;


    const HARD_SLICE_LIMIT =
      5000;


    // =====================================================
    // 等待主程式
    // =====================================================

    const startedAt =
      Date.now();


    while(
      (
        !window.GamebookCore ||
        !document.getElementById(
          "flowPanel"
        ) ||
        !document.getElementById(
          "pageText"
        )
      ) &&
      Date.now() - startedAt <
        READY_TIMEOUT
    ){

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            80
          )
      );

    }


    const core =
      window.GamebookCore;


    const panel =
      document.getElementById(
        "flowPanel"
      );


    const textInput =
      document.getElementById(
        "pageText"
      );


    if(
      !core ||
      !panel ||
      !textInput ||
      !Array.isArray(
        core.pages
      )
    ){

      throw new Error(
        "GamebookCore、流程圖或正文編輯器尚未就緒"
      );

    }


    // =====================================================
    // 狀態
    // =====================================================

    let destroyed =
      false;


    let bridgeCount =
      0;


    let restoredCount =
      0;


    let skippedCount =
      0;


    let activeTransaction =
      null;


    let transactionId =
      0;


    /*
     * 防止同一個 Node 點擊同時被：
     *
     * 1. 捕獲階段點擊橋樑
     * 2. GamebookCore.selectPage 包裝
     *
     * 重複處理。
     */
    let handlingSelection =
      false;


    const originalCoreSelectPage =
      typeof core.selectPage ===
        "function"
        ? core.selectPage
        : null;


    // =====================================================
    // 工具
    // =====================================================

    function formatNumber(value){

      return Number(
        value || 0
      ).toLocaleString();

    }


    function pageOfNode(node){

      if(!node){
        return null;
      }


      return (
        core.pages.find(
          page =>
            page.element === node
        ) ||
        null
      );

    }


    function getPageState(page){

      const length =
        String(
          page?.text || ""
        ).length;


      if(
        length >=
        HARD_NODE_LIMIT
      ){

        return {

          heavy:
            true,

          mode:
            "hard",

          length,

          sliceLimit:
            HARD_SLICE_LIMIT

        };

      }


      if(
        length >=
        SOFT_NODE_LIMIT
      ){

        return {

          heavy:
            true,

          mode:
            "soft",

          length,

          sliceLimit:
            SOFT_SLICE_LIMIT

        };

      }


      return {

        heavy:
          false,

        mode:
          "normal",

        length,

        sliceLimit:
          length

      };

    }


    function createSafeText(
      fullText,
      state
    ){

      const source =
        String(
          fullText || ""
        );


      /*
       * 這裡不加入提示文字。
       *
       * 主程式只需要拿到安全切片完成
       * Pixiv／HTML 預覽解析。
       *
       * 最終提示由 Preview Guard 負責。
       */
      return source.slice(
        0,
        state.sliceLimit
      );

    }


    function notifyBridge(
      type,
      detail
    ){

      document.dispatchEvent(
        new CustomEvent(
          type,
          {
            detail:
              detail || {}
          }
        )
      );

    }


    function forceSafePreview(){

      const guard =
        window.FirehahaPreviewGuard;


      if(
        guard &&
        typeof guard.forceSafePreview ===
          "function"
      ){

        try{

          guard.forceSafePreview();

          return true;

        }catch(error){

          console.warn(
            "[Preview Selection Bridge] " +
            "Preview Guard 更新失敗",
            error
          );

        }

      }


      return false;

    }


    // =====================================================
    // 暫時切片交易
    // =====================================================

    function beginTransaction(
      page,
      reason
    ){

      if(
        destroyed ||
        !page ||
        !core.pages.includes(page)
      ){

        return null;

      }


      const state =
        getPageState(
          page
        );


      if(!state.heavy){

        skippedCount++;

        return null;

      }


      /*
       * 若前一次交易還沒有完成，
       * 先恢復前一個 Node。
       */
      if(activeTransaction){

        restoreTransaction(
          activeTransaction,
          "replaced-by-new-selection"
        );

      }


      const fullText =
        String(
          page.text || ""
        );


      const safeText =
        createSafeText(
          fullText,
          state
        );


      const transaction = {

        id:
          ++transactionId,

        page,

        pageId:
          page.id,

        reason:
          reason || "unknown",

        mode:
          state.mode,

        fullText,

        safeText,

        originalLength:
          fullText.length,

        sliceLimit:
          state.sliceLimit,

        startedAt:
          performance.now(),

        restored:
          false

      };


      activeTransaction =
        transaction;


      /*
       * 關鍵：
       *
       * 主程式下一步執行 selectPage(page) 時，
       * 只會取得安全切片。
       */
      page.text =
        safeText;


      bridgeCount++;


      notifyBridge(
        "firehaha:preview-selection-bridge-start",
        {
          transactionId:
            transaction.id,

          pageId:
            page.id,

          reason:
            transaction.reason,

          mode:
            transaction.mode,

          originalLength:
            transaction.originalLength,

          sliceLimit:
            transaction.sliceLimit
        }
      );


      return transaction;

    }


    function restoreTransaction(
      transaction,
      reason
    ){

      if(
        !transaction ||
        transaction.restored
      ){

        return false;

      }


      transaction.restored =
        true;


      const page =
        transaction.page;


      /*
       * 只有 page.text 仍是橋樑放進去的切片時，
       * 才還原全文。
       *
       * 若其他模組在這段期間真的修改過正文，
       * 不覆蓋它的新內容。
       */
      if(
        page &&
        page.text ===
          transaction.safeText
      ){

        page.text =
          transaction.fullText;

      }


      /*
       * 主程式 selectPage() 已把切片放入 textarea。
       *
       * 如果目前仍是同一個 Node，
       * 在瀏覽器繪製畫面前恢復完整正文。
       */
      if(
        page &&
        core.currentPage === page
      ){

        if(
          textInput.value ===
            transaction.safeText
        ){

          textInput.value =
            transaction.fullText;

        }

      }


      if(
        activeTransaction ===
          transaction
      ){

        activeTransaction =
          null;

      }


      restoredCount++;


      notifyBridge(
        "firehaha:preview-selection-bridge-restored",
        {
          transactionId:
            transaction.id,

          pageId:
            transaction.pageId,

          reason:
            reason || "completed",

          mode:
            transaction.mode,

          originalLength:
            transaction.originalLength,

          sliceLimit:
            transaction.sliceLimit,

          duration:
            performance.now() -
            transaction.startedAt
        }
      );


      /*
       * 主程式已經用安全切片完成一次解析。
       *
       * 下一幀再交給 Preview Guard 寫入
       * 正式的安全提示與安全預覽。
       */
      requestAnimationFrame(
        function(){

          if(destroyed){
            return;
          }


          forceSafePreview();

        }
      );


      return true;

    }


    function scheduleRestore(
      transaction,
      reason
    ){

      if(!transaction){
        return;
      }


      /*
       * queueMicrotask 會在目前 click 事件內
       * 所有同步處理結束後執行，
       * 但通常早於瀏覽器下一次繪製。
       *
       * 因此使用者不會看到 textarea
       * 短暫變成 5,000 字。
       */
      queueMicrotask(
        function(){

          restoreTransaction(
            transaction,
            reason || "microtask"
          );

        }
      );

    }


    // =====================================================
    // 原生 Node 點擊攔截
    // =====================================================

    function onNodeClickCapture(event){

      if(
        destroyed ||
        event.button !== 0
      ){

        return;

      }


      const node =
        event.target.closest?.(
          ".flowNode"
        );


      if(
        !node ||
        !panel.contains(node)
      ){

        return;

      }


      const page =
        pageOfNode(
          node
        );


      if(!page){
        return;
      }


      const state =
        getPageState(
          page
        );


      if(!state.heavy){
        return;
      }


      /*
       * 不阻止主程式 click。
       *
       * 只在主程式 onclick 執行前，
       * 暫時替換 page.text。
       */
      handlingSelection =
        true;


      const transaction =
        beginTransaction(
          page,
          "native-node-click"
        );


      scheduleRestore(
        transaction,
        "native-node-click-completed"
      );


      queueMicrotask(
        function(){

          handlingSelection =
            false;

        }
      );

    }


    // =====================================================
    // 包裝 GamebookCore.selectPage
    // =====================================================

    function bridgedCoreSelectPage(
      page,
      ...args
    ){

      if(
        destroyed ||
        !originalCoreSelectPage
      ){

        return originalCoreSelectPage
          ?.call(
            core,
            page,
            ...args
          );

      }


      /*
       * Node 原生 click 已經建立交易時，
       * 不重複建立。
       */
      if(handlingSelection){

        return originalCoreSelectPage.call(
          core,
          page,
          ...args
        );

      }


      const state =
        getPageState(
          page
        );


      if(!state.heavy){

        return originalCoreSelectPage.call(
          core,
          page,
          ...args
        );

      }


      handlingSelection =
        true;


      const transaction =
        beginTransaction(
          page,
          "gamebook-core-select"
        );


      let result;


      try{

        result =
          originalCoreSelectPage.call(
            core,
            page,
            ...args
          );

      }finally{

        restoreTransaction(
          transaction,
          "gamebook-core-select-completed"
        );


        handlingSelection =
          false;

      }


      return result;

    }


    if(originalCoreSelectPage){

      core.selectPage =
        bridgedCoreSelectPage;

    }


    // =====================================================
    // 切換後的補強檢查
    // =====================================================

    function evaluateCurrentPage(
      reason
    ){

      if(destroyed){
        return;
      }


      const page =
        core.currentPage;


      if(!page){
        return;
      }


      const state =
        getPageState(
          page
        );


      if(!state.heavy){
        return;
      }


      /*
       * 若某個切換路徑沒有經過 click
       * 或 GamebookCore.selectPage，
       * 仍通知 Preview Guard 重建安全預覽。
       *
       * 這是補強，不會再讓主程式解析全文。
       */
      requestAnimationFrame(
        function(){

          if(
            destroyed ||
            core.currentPage !== page
          ){

            return;

          }


          forceSafePreview();


          notifyBridge(
            "firehaha:preview-selection-bridge-evaluated",
            {
              pageId:
                page.id,

              reason:
                reason || "evaluation",

              mode:
                state.mode,

              originalLength:
                state.length,

              sliceLimit:
                state.sliceLimit
            }
          );

        }
      );

    }


    function onLongContentSafeMode(){

      evaluateCurrentPage(
        "long-content-safe-mode"
      );

    }


    function onProjectImported(){

      evaluateCurrentPage(
        "project-imported"
      );

    }


    function onPluginEnabled(){

      evaluateCurrentPage(
        "plugin-enabled"
      );

    }


    document.addEventListener(
      "firehaha:long-content-safe-mode",
      onLongContentSafeMode
    );


    document.addEventListener(
      "firehaha:project-imported",
      onProjectImported
    );


    document.addEventListener(
      "firehaha:plugin-enabled",
      onPluginEnabled
    );


    /*
     * 捕獲階段：
     * 必須早於 Node 原本的 onclick。
     */
    panel.addEventListener(
      "click",
      onNodeClickCapture,
      true
    );


    // =====================================================
    // 公開 API
    // =====================================================

    const PreviewSelectionBridge = {

      version:
        "1.0.0",


      evaluate(){

        evaluateCurrentPage(
          "api-evaluate"
        );


        return true;

      },


      getPageState(page){

        return getPageState(
          page ||
          core.currentPage
        );

      },


      getStats(){

        return {

          bridgeCount,

          restoredCount,

          skippedCount,

          activeTransaction:
            activeTransaction
              ? {
                  id:
                    activeTransaction.id,

                  pageId:
                    activeTransaction.pageId,

                  mode:
                    activeTransaction.mode,

                  originalLength:
                    activeTransaction
                      .originalLength,

                  sliceLimit:
                    activeTransaction
                      .sliceLimit
                }
              : null,

          previewGuardAvailable:
            Boolean(
              window.FirehahaPreviewGuard &&
              typeof window
                .FirehahaPreviewGuard
                .forceSafePreview ===
                "function"
            )
        };

      }

    };


    window.FirehahaPreviewSelectionBridge =
      PreviewSelectionBridge;


    evaluateCurrentPage(
      "startup"
    );


    api.toast(
      "Node 切換預覽橋樑已啟用"
    );


    // =====================================================
    // Cleanup
    // =====================================================

    return function cleanup(){

      destroyed =
        true;


      panel.removeEventListener(
        "click",
        onNodeClickCapture,
        true
      );


      document.removeEventListener(
        "firehaha:long-content-safe-mode",
        onLongContentSafeMode
      );


      document.removeEventListener(
        "firehaha:project-imported",
        onProjectImported
      );


      document.removeEventListener(
        "firehaha:plugin-enabled",
        onPluginEnabled
      );


      if(activeTransaction){

        restoreTransaction(
          activeTransaction,
          "plugin-cleanup"
        );

      }


      if(
        originalCoreSelectPage &&
        core.selectPage ===
          bridgedCoreSelectPage
      ){

        core.selectPage =
          originalCoreSelectPage;

      }


      if(
        window
          .FirehahaPreviewSelectionBridge ===
        PreviewSelectionBridge
      ){

        delete window
          .FirehahaPreviewSelectionBridge;

      }

    };

  }

});