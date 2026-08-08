// @firehaha-plugin {"id":"official.preview-render-guard","name":"預覽渲染保護器","version":"1.0.0","author":"Firehaha","description":"超長 Node 自動切斷高成本即時預覽，完整保留正文與輸出資料，並防止其他模組重新渲染全文。"}

FirehahaPlugins.register({

  id:
    "official.preview-render-guard",

  name:
    "預覽渲染保護器",

  version:
    "1.0.0",


  async setup(api){

    "use strict";


    // =====================================================
    // 設定
    // =====================================================

    const READY_TIMEOUT =
      12000;


    /*
     * 單一 Node 超過此字數後，
     * 進入一般安全預覽。
     */
    const SOFT_NODE_LIMIT =
      120000;


    /*
     * 30 萬字極端測試：
     * 進入更嚴格的預覽模式。
     */
    const HARD_NODE_LIMIT =
      300000;


    /*
     * 整個專案正文總量超過此值，
     * 即使目前 Node 未超過 12 萬字，
     * 也降低預覽負擔。
     */
    const PROJECT_LIMIT =
      500000;


    const SOFT_PREVIEW_SLICE =
      10000;


    const HARD_PREVIEW_SLICE =
      5000;


    /*
     * 輸入停止後多久更新安全預覽。
     * 不必每個按鍵都操作 DOM。
     */
    const INPUT_DELAY =
      100;


    // =====================================================
    // 等待主程式
    // =====================================================

    const startedAt =
      Date.now();


    while(
      (
        !window.GamebookCore ||
        !document.getElementById(
          "pageText"
        ) ||
        !document.getElementById(
          "previewText"
        ) ||
        !document.getElementById(
          "htmlPreview"
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


    const textInput =
      document.getElementById(
        "pageText"
      );


    const pixivPreview =
      document.getElementById(
        "previewText"
      );


    const htmlPreview =
      document.getElementById(
        "htmlPreview"
      );


    if(
      !core ||
      !textInput ||
      !pixivPreview ||
      !htmlPreview
    ){

      throw new Error(
        "找不到正文或預覽元件"
      );

    }


    // =====================================================
    // 狀態
    // =====================================================

    let active =
      false;


    let mode =
      "normal";


    let currentNodeChars =
      0;


    let currentProjectChars =
      0;


    let currentSliceLimit =
      SOFT_PREVIEW_SLICE;


    let inputTimer =
      0;


    let enforceFrame =
      0;


    let writingPreview =
      false;


    let destroyed =
      false;


    let lastRenderedPageId =
      null;


    let lastRenderedLength =
      -1;


    let interceptedInputCount =
      0;


    let safeRenderCount =
      0;


    let preventedFullRenderCount =
      0;


    // =====================================================
    // 樣式與狀態提示
    // =====================================================

    const removeStyle =
      api.addStyle(
        "preview-render-guard",
        `
        #fhPreviewRenderGuard{
          position:fixed;
          left:16px;
          bottom:16px;
          z-index:2147482600;
          display:none;
          width:min(510px,calc(100vw - 32px));
          box-sizing:border-box;
          padding:11px 13px;
          border:1px solid #d5962c;
          border-radius:12px;
          background:#fff8e7;
          color:#563500;
          box-shadow:0 10px 32px rgba(90,55,0,.20);
          font:13px/1.55 system-ui,sans-serif;
        }

        #fhPreviewRenderGuard.active{
          display:block;
        }

        #fhPreviewRenderGuard strong{
          display:block;
          margin-bottom:3px;
          font-size:14px;
        }

        #fhPreviewRenderGuard .fh-prg-meta{
          color:#765527;
        }

        #fhPreviewRenderGuard .fh-prg-actions{
          display:flex;
          flex-wrap:wrap;
          gap:7px;
          margin-top:8px;
        }

        #fhPreviewRenderGuard button{
          padding:6px 10px!important;
          border:1px solid #bd8a31!important;
          border-radius:8px!important;
          background:#fff!important;
          color:#604000!important;
          font-weight:750!important;
          cursor:pointer;
        }

        body.fh-preview-safe-mode #previewText,
        body.fh-preview-safe-mode #htmlPreview{
          contain:content;
        }

        @media(max-width:600px){

          #fhPreviewRenderGuard{
            left:8px;
            right:8px;
            bottom:8px;
            width:auto;
          }

        }
        `
      );


    const panel =
      document.createElement(
        "aside"
      );


    panel.id =
      "fhPreviewRenderGuard";


    panel.innerHTML =
      `
      <strong>🛡️ 預覽渲染安全模式</strong>

      <div
        class="fh-prg-meta"
        data-preview-guard-meta>
      </div>

      <div class="fh-prg-actions">

        <button
          type="button"
          data-preview-guard-refresh>
          重新整理安全預覽
        </button>

        <button
          type="button"
          data-preview-guard-hide>
          收起提示
        </button>

      </div>
      `;


    document.body.appendChild(
      panel
    );


    const metaBox =
      panel.querySelector(
        "[data-preview-guard-meta]"
      );


    panel
      .querySelector(
        "[data-preview-guard-refresh]"
      )
      .addEventListener(
        "click",
        function(){

          evaluateAndRender(
            "manual-refresh",
            true
          );

        }
      );


    panel
      .querySelector(
        "[data-preview-guard-hide]"
      )
      .addEventListener(
        "click",
        function(){

          panel.classList.remove(
            "active"
          );

        }
      );


    // =====================================================
    // 共用工具
    // =====================================================

    function formatNumber(value){

      return Number(
        value || 0
      ).toLocaleString();

    }


    function getCurrentPage(){

      return core.currentPage ||
        null;

    }


    function calculateProjectChars(){

      let total =
        0;


      const pages =
        Array.isArray(
          core.pages
        )
          ? core.pages
          : [];


      for(const page of pages){

        total +=
          String(
            page?.text || ""
          ).length;


        /*
         * 超過門檻後不必再繼續掃完整專案。
         * 我們只需要知道它已經超線。
         */
        if(
          total >
          PROJECT_LIMIT
        ){

          break;

        }

      }


      return total;

    }


    function calculateState(){

      const page =
        getCurrentPage();


      const nodeChars =
        String(
          page?.text ||
          textInput.value ||
          ""
        ).length;


      const projectChars =
        calculateProjectChars();


      let nextMode =
        "normal";


      let sliceLimit =
        SOFT_PREVIEW_SLICE;


      if(
        nodeChars >=
        HARD_NODE_LIMIT
      ){

        nextMode =
          "hard";

        sliceLimit =
          HARD_PREVIEW_SLICE;

      }else if(
        nodeChars >=
          SOFT_NODE_LIMIT ||
        projectChars >=
          PROJECT_LIMIT
      ){

        nextMode =
          "soft";

        sliceLimit =
          SOFT_PREVIEW_SLICE;

      }


      return {

        active:
          nextMode !==
          "normal",

        mode:
          nextMode,

        nodeChars,

        projectChars,

        sliceLimit

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


      const slice =
        source.slice(
          0,
          state.sliceLimit
        );


      const hiddenChars =
        Math.max(
          0,
          source.length -
          slice.length
        );


      const modeText =
        state.mode === "hard"
          ? "30 萬字極端安全模式"
          : "超長內容安全模式";


      const suffix =
        hiddenChars > 0
          ? (
            "\n\n" +
            "—— " +
            modeText +
            "：編輯器預覽只顯示前 " +
            formatNumber(
              state.sliceLimit
            ) +
            " 字，其餘 " +
            formatNumber(
              hiddenChars
            ) +
            " 字仍完整保存在正文與專案中 ——"
          )
          : "";


      return slice +
        suffix;

    }


    function updatePanel(
      state
    ){

      if(!state.active){

        panel.classList.remove(
          "active"
        );

        document.body.classList.remove(
          "fh-preview-safe-mode"
        );

        return;

      }


      panel.classList.add(
        "active"
      );


      document.body.classList.add(
        "fh-preview-safe-mode"
      );


      const modeText =
        state.mode === "hard"
          ? "極端模式"
          : "安全模式";


      metaBox.textContent =
        `${modeText}：目前 Node ` +
        `${formatNumber(state.nodeChars)} 字；` +
        `專案掃描量 ${formatNumber(state.projectChars)} 字。` +
        `即時預覽限制為前 ` +
        `${formatNumber(state.sliceLimit)} 字。`;

    }


    // =====================================================
    // 安全預覽
    // =====================================================

    function renderSafePreview(
      state,
      reason
    ){

      if(
        destroyed ||
        !state.active
      ){

        return false;

      }


      const page =
        getCurrentPage();


      if(!page){
        return false;
      }


      const fullText =
        String(
          page.text ||
          textInput.value ||
          ""
        );


      /*
       * 相同頁面、相同長度且不是強制更新，
       * 就不重複寫入 DOM。
       */
      if(
        reason !== "force" &&
        lastRenderedPageId ===
          page.id &&
        lastRenderedLength ===
          fullText.length &&
        pixivPreview.dataset
          .fhSafePreview ===
          "1" &&
        htmlPreview.dataset
          .fhSafePreview ===
          "1"
      ){

        return true;

      }


      const safeText =
        createSafeText(
          fullText,
          state
        );


      writingPreview =
        true;


      /*
       * 兩個預覽都使用 textContent。
       *
       * 這很重要：
       * 安全模式不執行 HTML 標籤、Ruby、
       * 圖片、音訊或影片的全文解析。
       */
      pixivPreview.textContent =
        safeText;


      htmlPreview.textContent =
        safeText;


      pixivPreview.dataset
        .fhSafePreview =
        "1";


      htmlPreview.dataset
        .fhSafePreview =
        "1";


      pixivPreview.dataset
        .fhPreviewMode =
        state.mode;


      htmlPreview.dataset
        .fhPreviewMode =
        state.mode;


      lastRenderedPageId =
        page.id;


      lastRenderedLength =
        fullText.length;


      safeRenderCount++;


      requestAnimationFrame(
        function(){

          writingPreview =
            false;

        }
      );


      document.dispatchEvent(
        new CustomEvent(
          "firehaha:preview-safe-rendered",
          {
            detail:{

              reason:
                reason || "unknown",

              mode:
                state.mode,

              pageId:
                page.id,

              nodeChars:
                state.nodeChars,

              projectChars:
                state.projectChars,

              sliceLimit:
                state.sliceLimit

            }
          }
        )
      );


      return true;

    }


    function restoreNormalState(){

      active =
        false;


      mode =
        "normal";


      currentNodeChars =
        0;


      currentProjectChars =
        0;


      lastRenderedPageId =
        null;


      lastRenderedLength =
        -1;


      delete pixivPreview
        .dataset
        .fhSafePreview;


      delete htmlPreview
        .dataset
        .fhSafePreview;


      delete pixivPreview
        .dataset
        .fhPreviewMode;


      delete htmlPreview
        .dataset
        .fhPreviewMode;


      updatePanel({
        active:false
      });

    }


    function evaluateAndRender(
      reason,
      force
    ){

      const state =
        calculateState();


      active =
        state.active;


      mode =
        state.mode;


      currentNodeChars =
        state.nodeChars;


      currentProjectChars =
        state.projectChars;


      currentSliceLimit =
        state.sliceLimit;


      updatePanel(
        state
      );


      if(!state.active){

        restoreNormalState();

        return false;

      }


      if(force){

        lastRenderedLength =
          -1;

      }


      renderSafePreview(
        state,
        force
          ? "force"
          : reason
      );


      /*
       * 相容原本超長內容提示插件。
       */
      document.dispatchEvent(
        new CustomEvent(
          "firehaha:long-content-safe-mode",
          {
            detail:{

              reason:
                reason || "preview-guard",

              mode:
                state.mode,

              nodeChars:
                state.nodeChars,

              projectChars:
                state.projectChars,

              sliceLimit:
                state.sliceLimit

            }
          }
        )
      );


      return true;

    }


    function scheduleSafeRender(
      reason
    ){

      clearTimeout(
        inputTimer
      );


      inputTimer =
        setTimeout(
          function(){

            inputTimer =
              0;

            evaluateAndRender(
              reason || "scheduled",
              false
            );

          },
          INPUT_DELAY
        );

    }


    function scheduleEnforce(){

      if(
        destroyed ||
        enforceFrame
      ){

        return;

      }


      enforceFrame =
        requestAnimationFrame(
          function(){

            enforceFrame =
              0;


            if(
              !active ||
              writingPreview
            ){

              return;

            }


            const pixivSafe =
              pixivPreview.dataset
                .fhSafePreview ===
                "1";


            const htmlSafe =
              htmlPreview.dataset
                .fhSafePreview ===
                "1";


            /*
             * 其他模組若覆寫 innerHTML/textContent，
             * dataset 可能還在，但內容已改變。
             * 使用長度作基本防線。
             */
            const suspiciousPixiv =
              pixivPreview.textContent.length >
              currentSliceLimit +
              2000;


            const suspiciousHtml =
              htmlPreview.textContent.length >
              currentSliceLimit +
              2000;


            if(
              !pixivSafe ||
              !htmlSafe ||
              suspiciousPixiv ||
              suspiciousHtml
            ){

              preventedFullRenderCount++;


              evaluateAndRender(
                "preview-overwrite-blocked",
                true
              );

            }

          }
        );

    }


    // =====================================================
    // 正文輸入攔截
    // =====================================================

    function onTextInputCapture(
      event
    ){

      if(
        destroyed ||
        event.target !==
          textInput
      ){

        return;

      }


      const page =
        getCurrentPage();


      if(!page){
        return;
      }


      const value =
        textInput.value;


      /*
       * 先用目前輸入長度快速判斷。
       * 不必每個按鍵都掃整個專案。
       */
      const clearlyHeavy =
        value.length >=
        SOFT_NODE_LIMIT;


      const previouslyActive =
        active;


      if(
        !clearlyHeavy &&
        !previouslyActive
      ){

        /*
         * 短內容：
         * 完全交還主程式原本 input 監聽器。
         */
        return;

      }


      /*
       * 超長內容時阻止主程式原本的 input 處理。
       * 避免它排程 updatePreview() 與
       * updateHTMLPreview()。
       */
      event.stopImmediatePropagation();


      page.text =
        value;


      core.projectChanged =
        true;


      interceptedInputCount++;


      scheduleSafeRender(
        "input"
      );


      /*
       * 讓其他非預覽模組知道正文有變更，
       * 但不呼叫 core.notifyChange()，
       * 因為 notifyChange() 內部會再次 updatePreview()。
       */
      document.dispatchEvent(
        new CustomEvent(
          "firehaha:preview-guard-text-changed",
          {
            detail:{

              page,

              pageId:
                page.id,

              length:
                value.length

            }
          }
        )
      );

    }


    // =====================================================
    // 預覽 DOM 防止被覆寫
    // =====================================================

    const previewObserver =
      new MutationObserver(
        function(){

          if(
            writingPreview ||
            !active
          ){

            return;

          }


          scheduleEnforce();

        }
      );


    previewObserver.observe(
      pixivPreview,
      {
        childList:true,
        subtree:true,
        characterData:true
      }
    );


    previewObserver.observe(
      htmlPreview,
      {
        childList:true,
        subtree:true,
        characterData:true
      }
    );


    // =====================================================
    // 主程式事件同步
    // =====================================================

    const cleanupCoreEvents =
      [];


    if(
      typeof core.on ===
        "function"
    ){

      cleanupCoreEvents.push(
        core.on(
          "page:selected",
          function(){

            scheduleSafeRender(
              "page-selected"
            );

          }
        )
      );


      cleanupCoreEvents.push(
        core.on(
          "project:changed",
          function(){

            scheduleSafeRender(
              "project-changed"
            );

          }
        )
      );

    }


    function onLongContentEvent(){

      scheduleSafeRender(
        "long-content-event"
      );

    }


    function onProjectImported(){

      scheduleSafeRender(
        "project-imported"
      );

    }


    document.addEventListener(
      "firehaha:long-content-safe-mode",
      onLongContentEvent
    );


    document.addEventListener(
      "firehaha:project-imported",
      onProjectImported
    );


    /*
     * capture=true：
     * 在主程式正文 input 監聽器之前判斷。
     */
    textInput.addEventListener(
      "input",
      onTextInputCapture,
      true
    );


    // =====================================================
    // 公開 API
    // =====================================================

    const PreviewGuard = {

      version:
        "1.0.0",


      evaluate(){

        return evaluateAndRender(
          "api-evaluate",
          false
        );

      },


      forceSafePreview(){

        return evaluateAndRender(
          "api-force",
          true
        );

      },


      getStats(){

        return {

          active,

          mode,

          nodeChars:
            currentNodeChars,

          projectChars:
            currentProjectChars,

          sliceLimit:
            currentSliceLimit,

          interceptedInputCount,

          safeRenderCount,

          preventedFullRenderCount

        };

      }

    };


    window.FirehahaPreviewGuard =
      PreviewGuard;


    evaluateAndRender(
      "startup",
      false
    );


    api.toast(
      "預覽渲染保護器已啟用"
    );


    // =====================================================
    // Cleanup
    // =====================================================

    return function cleanup(){

      destroyed =
        true;


      clearTimeout(
        inputTimer
      );


      if(enforceFrame){

        cancelAnimationFrame(
          enforceFrame
        );

        enforceFrame =
          0;

      }


      previewObserver.disconnect();


      textInput.removeEventListener(
        "input",
        onTextInputCapture,
        true
      );


      document.removeEventListener(
        "firehaha:long-content-safe-mode",
        onLongContentEvent
      );


      document.removeEventListener(
        "firehaha:project-imported",
        onProjectImported
      );


      cleanupCoreEvents.forEach(
        cleanup => {

          try{

            if(
              typeof cleanup ===
                "function"
            ){

              cleanup();

            }

          }catch(error){}

        }
      );


      if(
        window.FirehahaPreviewGuard ===
        PreviewGuard
      ){

        delete window
          .FirehahaPreviewGuard;

      }


      restoreNormalState();

      panel.remove();

      removeStyle();

    };

  }

});