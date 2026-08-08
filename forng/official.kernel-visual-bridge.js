// @firehaha-plugin {"id":"official.kernel-visual-bridge","name":"Kernel 視覺圖形化橋接器","version":"1.0.2","author":"Firehaha","description":"自動把既有插件對 GamebookCore 與 FirehahaRenderCore 的公開更新呼叫橋接至 FirehahaKernel，提供圖形化狀態、開關、即時統計與安全還原。"}

FirehahaPlugins.register({

  id:
    "official.kernel-visual-bridge",

  name:
    "Kernel 視覺圖形化橋接器",

  version:
    "1.0.2",


  async setup(api){

    "use strict";


    // =====================================================
    // 基本設定
    // =====================================================

    const VERSION =
      "1.0.2";


    const READY_TIMEOUT =
      15000;


    const PANEL_ID =
      "fh-kernel-visual-bridge-panel";


    const STYLE_ID =
      "fh-kernel-visual-bridge-style";


    const UPDATE_INTERVAL =
      500;


    const PANEL_STATE_KEY =
      "firehaha.ui.kernel-visual-bridge.v2";


    // =====================================================
    // 等待 Kernel 與核心
    // =====================================================

    const waitStartedAt =
      Date.now();


    while(
      (
        !window.GamebookCore ||
        !window.FirehahaKernel
      ) &&
      Date.now() - waitStartedAt <
        READY_TIMEOUT
    ){

      await new Promise(
        resolve => {

          setTimeout(
            resolve,
            80
          );

        }
      );

    }


    if(!window.GamebookCore){

      throw new Error(
        "找不到 GamebookCore"
      );

    }


    if(!window.FirehahaKernel){

      throw new Error(
        "找不到 FirehahaKernel，請先啟用核心排程器"
      );

    }


    if(
      window.FirehahaKernelVisualBridge &&
      window.FirehahaKernelVisualBridge.active
    ){

      throw new Error(
        "Kernel 視覺橋接器已經啟用"
      );

    }


    const core =
      window.GamebookCore;


    const kernel =
      window.FirehahaKernel;


    const renderCore =
      window.FirehahaRenderCore ||
      null;


    function readPanelState(){

      try{

        const value =
          JSON.parse(
            window.localStorage.getItem(
              PANEL_STATE_KEY
            ) || "null"
          );


        return value &&
          typeof value === "object"
            ? value
            : null;

      }catch(error){

        return null;

      }

    }


    const savedPanelState =
      readPanelState();


    let destroyed =
      false;


    let minimized =
      savedPanelState?.minimized === true;


    let panelVisible =
      savedPanelState?.visible === true;


    let updateTimer =
      0;


    let panel =
      null;


    let floatingButton =
      null;


    const cleanupFunctions =
      [];


    function persistPanelState(){

      try{

        window.localStorage.setItem(
          PANEL_STATE_KEY,
          JSON.stringify({
            visible:
              panelVisible,

            minimized
          })
        );

      }catch(error){

        // file://、隱私模式或儲存空間受限時仍可正常操作。

      }

    }


    // =====================================================
    // 橋接開關
    // =====================================================

    const settings = {

      master:
        true,

      lines:
        true,

      preview:
        true,

      options:
        true,

      badges:
        true,

      renderCoreLines:
        true,

      eventAssist:
        true,

      backgroundPause:
        true

    };


    // =====================================================
    // 統計
    // =====================================================

    const stats = {

      startedAt:
        Date.now(),


      interceptedTotal:
        0,


      lineCalls:
        0,

      previewCalls:
        0,

      optionCalls:
        0,

      badgeCalls:
        0,

      renderCoreLineCalls:
        0,


      eventRequests:
        0,

      pageSelectedEvents:
        0,

      pageCreatedEvents:
        0,

      pageRemovedEvents:
        0,

      projectChangedEvents:
        0,


      directFallbacks:
        0,

      backgroundDeferrals:
        0,

      bridgeErrors:
        0,


      lastInterceptType:
        null,

      lastInterceptAt:
        0

    };


    // =====================================================
    // 保存原始函式
    // =====================================================

    const originals = {

      drawLines:
        typeof core.drawLines ===
          "function"
          ? core.drawLines
          : null,


      updatePreview:
        typeof core.updatePreview ===
          "function"
          ? core.updatePreview
          : null,


      renderOptions:
        typeof core.renderOptions ===
          "function"
          ? core.renderOptions
          : null,


      refreshNodeBadges:
        typeof core.refreshNodeBadges ===
          "function"
          ? core.refreshNodeBadges
          : null,


      renderRequestLines:
        renderCore &&
        typeof renderCore.requestLines ===
          "function"
          ? renderCore.requestLines
          : null,


      renderForceLines:
        renderCore &&
        typeof renderCore.forceLines ===
          "function"
          ? renderCore.forceLines
          : null

    };


    /*
     * 防止真正執行原函式時，
     * 再次被橋接器攔截。
     */
    const executionLocks = {

      lines:
        0,

      preview:
        0,

      options:
        0,

      badges:
        0,

      renderLines:
        0

    };


    // =====================================================
    // 工具
    // =====================================================

    function toast(message){

      if(
        api &&
        typeof api.toast ===
          "function"
      ){

        api.toast(
          message
        );

        return;
      }


      console.log(
        "[Kernel Visual Bridge]",
        message
      );

    }


    function round(
      value,
      digits
    ){

      const number =
        Number(value) || 0;


      const power =
        10 **
        (
          Number(digits) || 0
        );


      return Math.round(
        number * power
      ) / power;

    }


    function safeCall(
      callback,
      thisArg,
      args,
      label
    ){

      if(
        typeof callback !==
          "function"
      ){

        return;

      }


      try{

        return callback.apply(
          thisArg,
          args || []
        );

      }catch(error){

        stats.bridgeErrors++;


        console.error(
          `[Kernel Bridge] ${label || "函式"}執行失敗`,
          error
        );

      }

    }


    function markIntercept(type){

      stats.interceptedTotal++;


      stats.lastInterceptType =
        type;


      stats.lastInterceptAt =
        Date.now();

    }


    function maySchedule(){

      if(
        destroyed ||
        !settings.master
      ){

        return false;
      }


      if(
        settings.backgroundPause &&
        document.hidden
      ){

        stats.backgroundDeferrals++;


        return false;
      }


      return true;

    }


    function requestKernel(
      jobId,
      fallback,
      thisArg,
      args
    ){

      if(
        maySchedule() &&
        kernel.has?.(
          jobId
        )
      ){

        const accepted =
          kernel.request(
            jobId,
            {
              source:
                "kernel-visual-bridge",

              timestamp:
                Date.now()
            }
          );


        if(accepted){

          return true;

        }

      }


      stats.directFallbacks++;


      safeCall(
        fallback,
        thisArg,
        args,
        jobId + " fallback"
      );


      return false;

    }


    // =====================================================
    // Kernel Job 安全重建
    //
    // Kernel 原本的 Job 可能動態呼叫 core.drawLines()。
    // 若直接包裝 core.drawLines，會形成：
    //
    // core.drawLines
    // → Kernel
    // → core.lines
    // → core.drawLines
    // → Kernel
    //
    // 因此這裡將 Job 改成直接呼叫保存的原始函式。
    // =====================================================

    function replaceKernelJob(
      definition
    ){

      if(
        kernel.has(
          definition.id
        )
      ){

        kernel.unregister(
          definition.id
        );

      }


      return kernel.register(
        definition
      );

    }


    // =====================================================
    // 真正工作
    // =====================================================

    function runOriginalLines(){

      executionLocks.lines++;


      try{

        /*
         * 優先交給原本 RenderCore。
         */
        if(
          originals.renderRequestLines
        ){

          executionLocks.renderLines++;


          try{

            return originals
              .renderRequestLines
              .call(
                renderCore
              );

          }finally{

            executionLocks.renderLines--;

          }

        }


        return safeCall(
          originals.drawLines,
          core,
          [],
          "原始 drawLines"
        );

      }finally{

        executionLocks.lines--;

      }

    }


    function runOriginalPreview(){

      executionLocks.preview++;


      try{

        return safeCall(
          originals.updatePreview,
          core,
          [],
          "原始 updatePreview"
        );

      }finally{

        executionLocks.preview--;

      }

    }


    function runOriginalOptions(){

      executionLocks.options++;


      try{

        return safeCall(
          originals.renderOptions,
          core,
          [],
          "原始 renderOptions"
        );

      }finally{

        executionLocks.options--;

      }

    }


    function runOriginalBadges(){

      executionLocks.badges++;


      try{

        return safeCall(
          originals.refreshNodeBadges,
          core,
          [],
          "原始 refreshNodeBadges"
        );

      }finally{

        executionLocks.badges--;

      }

    }


    // =====================================================
    // 重建 Kernel 內建 Job
    // =====================================================

    replaceKernelJob({

      id:
        "core.lines",

      label:
        "流程連線（橋接）",

      lane:
        "frame",

      priority:
        10,

      run:
        runOriginalLines

    });


    if(
      originals.refreshNodeBadges
    ){

      replaceKernelJob({

        id:
          "core.badges",

        label:
          "Node 徽章（橋接）",

        lane:
          "frame",

        priority:
          20,

        run:
          runOriginalBadges

      });

    }


    if(
      originals.renderOptions
    ){

      replaceKernelJob({

        id:
          "core.options",

        label:
          "分歧選項（橋接）",

        lane:
          "frame",

        priority:
          30,

        run:
          runOriginalOptions

      });

    }


    if(
      originals.updatePreview
    ){

      replaceKernelJob({

        id:
          "core.preview",

        label:
          "內容預覽（橋接）",

        lane:
          "idle",

        priority:
          50,

        timeout:
          900,

        run:
          runOriginalPreview

      });

    }


    // =====================================================
    // 包裝公開 API
    // =====================================================

    function bridgedDrawLines(
      ...args
    ){

      if(
        executionLocks.lines > 0 ||
        !settings.master ||
        !settings.lines
      ){

        return safeCall(
          originals.drawLines,
          core,
          args,
          "drawLines"
        );

      }


      stats.lineCalls++;


      markIntercept(
        "流程連線"
      );


      requestKernel(
        "core.lines",
        originals.drawLines,
        core,
        args
      );

    }


    function bridgedUpdatePreview(
      ...args
    ){

      if(
        executionLocks.preview > 0 ||
        !settings.master ||
        !settings.preview
      ){

        return safeCall(
          originals.updatePreview,
          core,
          args,
          "updatePreview"
        );

      }


      stats.previewCalls++;


      markIntercept(
        "內容預覽"
      );


      requestKernel(
        "core.preview",
        originals.updatePreview,
        core,
        args
      );

    }


    function bridgedRenderOptions(
      ...args
    ){

      if(
        executionLocks.options > 0 ||
        !settings.master ||
        !settings.options
      ){

        return safeCall(
          originals.renderOptions,
          core,
          args,
          "renderOptions"
        );

      }


      stats.optionCalls++;


      markIntercept(
        "分歧選項"
      );


      requestKernel(
        "core.options",
        originals.renderOptions,
        core,
        args
      );

    }


    function bridgedRefreshBadges(
      ...args
    ){

      if(
        executionLocks.badges > 0 ||
        !settings.master ||
        !settings.badges
      ){

        return safeCall(
          originals.refreshNodeBadges,
          core,
          args,
          "refreshNodeBadges"
        );

      }


      stats.badgeCalls++;


      markIntercept(
        "Node 徽章"
      );


      requestKernel(
        "core.badges",
        originals.refreshNodeBadges,
        core,
        args
      );

    }


    function bridgedRenderRequestLines(
      ...args
    ){

      if(
        executionLocks.renderLines > 0 ||
        !settings.master ||
        !settings.renderCoreLines
      ){

        return safeCall(
          originals.renderRequestLines,
          renderCore,
          args,
          "RenderCore.requestLines"
        );

      }


      stats.renderCoreLineCalls++;


      markIntercept(
        "RenderCore 連線"
      );


      requestKernel(
        "core.lines",
        originals.renderRequestLines,
        renderCore,
        args
      );

    }


    if(
      originals.drawLines
    ){

      core.drawLines =
        bridgedDrawLines;

    }


    if(
      originals.updatePreview
    ){

      core.updatePreview =
        bridgedUpdatePreview;

    }


    if(
      originals.renderOptions
    ){

      core.renderOptions =
        bridgedRenderOptions;

    }


    if(
      originals.refreshNodeBadges
    ){

      core.refreshNodeBadges =
        bridgedRefreshBadges;

    }


    if(
      renderCore &&
      originals.renderRequestLines
    ){

      renderCore.requestLines =
        bridgedRenderRequestLines;

    }


    // =====================================================
    // 事件輔助
    //
    // 主程式閉包內直接呼叫的函式無法完全攔截。
    // 事件輔助可以在重要狀態改變後，
    // 統一要求最後一次正確更新。
    // =====================================================

    function requestWorkspaceRefresh(){

      if(
        !settings.master ||
        !settings.eventAssist
      ){

        return;

      }


      stats.eventRequests++;


      kernel.requestMany([
        "core.badges",
        "core.lines"
      ]);

    }


    function requestStoryRefresh(){

      if(
        !settings.master ||
        !settings.eventAssist
      ){

        return;

      }


      stats.eventRequests++;


      kernel.requestMany([
        "core.options",
        "core.badges",
        "core.lines",
        "core.preview"
      ]);

    }


    const unsubscribeSelected =
      core.on?.(
        "page:selected",
        () => {

          stats.pageSelectedEvents++;


          requestStoryRefresh();

        }
      );


    const unsubscribeCreated =
      core.on?.(
        "page:created",
        () => {

          stats.pageCreatedEvents++;


          requestStoryRefresh();

        }
      );


    const unsubscribeRemoved =
      core.on?.(
        "page:removed",
        () => {

          stats.pageRemovedEvents++;


          requestStoryRefresh();

        }
      );


    const unsubscribeChanged =
      core.on?.(
        "project:changed",
        event => {

          stats.projectChangedEvents++;


          if(
            event?.detail?.folderOnly
          ){

            requestWorkspaceRefresh();

          }else{

            requestStoryRefresh();

          }

        }
      );


    [
      unsubscribeSelected,
      unsubscribeCreated,
      unsubscribeRemoved,
      unsubscribeChanged
    ]
      .filter(
        callback =>
          typeof callback ===
            "function"
      )
      .forEach(
        callback => {

          cleanupFunctions.push(
            callback
          );

        }
      );


    // =====================================================
    // 頁籤恢復
    // =====================================================

    function onVisibilityChange(){

      if(
        document.hidden
      ){

        return;

      }


      if(
        settings.master &&
        settings.eventAssist
      ){

        requestWorkspaceRefresh();

      }

    }


    document.addEventListener(
      "visibilitychange",
      onVisibilityChange
    );


    cleanupFunctions.push(
      () => {

        document.removeEventListener(
          "visibilitychange",
          onVisibilityChange
        );

      }
    );


    // =====================================================
    // 視覺面板
    // =====================================================

    function makeSwitch(
      key,
      label,
      description
    ){

      const row =
        document.createElement(
          "label"
        );


      row.className =
        "fh-kvb-switch-row";


      row.innerHTML = `
        <span class="fh-kvb-switch-text">
          <strong></strong>
          <small></small>
        </span>

        <span class="fh-kvb-switch">
          <input type="checkbox">
          <span class="fh-kvb-switch-slider"></span>
        </span>
      `;


      row.querySelector(
        "strong"
      ).textContent =
        label;


      row.querySelector(
        "small"
      ).textContent =
        description;


      const input =
        row.querySelector(
          "input"
        );


      input.checked =
        Boolean(
          settings[key]
        );


      input.addEventListener(
        "change",
        () => {

          settings[key] =
            input.checked;


          if(
            key === "master"
          ){

            panel.classList.toggle(
              "is-disabled",
              !settings.master
            );

          }


          updatePanel();

        }
      );


      return row;

    }


    function buildPanel(){

      panel =
        document.createElement(
          "section"
        );


      panel.id =
        PANEL_ID;


      panel.innerHTML = `
        <header class="fh-kvb-header">

          <div class="fh-kvb-heading">

            <span class="fh-kvb-logo">
              ⚡
            </span>

            <div>
              <strong>
                Kernel 視覺橋接器
              </strong>

              <small class="fh-kvb-subtitle">
                自動接管既有公開 API
              </small>
            </div>

          </div>

          <div class="fh-kvb-header-actions">

            <button
              type="button"
              data-action="minimize"
              title="收起"
            >
              ─
            </button>

            <button
              type="button"
              data-action="close"
              title="隱藏"
            >
              ×
            </button>

          </div>

        </header>


        <div class="fh-kvb-body">

          <div class="fh-kvb-status-row">

            <span
              class="fh-kvb-status-dot"
            ></span>

            <strong
              class="fh-kvb-status-text"
            >
              橋接運作中
            </strong>

            <span
              class="fh-kvb-version"
            >
              V${VERSION}
            </span>

          </div>


          <div class="fh-kvb-flow">

            <div class="fh-kvb-flow-node">
              <span>🧩</span>
              <strong>既有插件</strong>
              <small>不需修改</small>
            </div>

            <div class="fh-kvb-flow-arrow">
              <span>→</span>
              <small class="fh-kvb-intercept-number">
                0
              </small>
            </div>

            <div class="fh-kvb-flow-node is-bridge">
              <span>🌉</span>
              <strong>橋接器</strong>
              <small>攔截公開 API</small>
            </div>

            <div class="fh-kvb-flow-arrow">
              <span>→</span>
              <small class="fh-kvb-kernel-request-number">
                0
              </small>
            </div>

            <div class="fh-kvb-flow-node is-kernel">
              <span>⚙️</span>
              <strong>Kernel</strong>
              <small>合併與排程</small>
            </div>

          </div>


          <div class="fh-kvb-metrics">

            <div class="fh-kvb-metric">
              <span>已攔截</span>
              <strong data-metric="intercepted">
                0
              </strong>
            </div>

            <div class="fh-kvb-metric">
              <span>Kernel 請求</span>
              <strong data-metric="requests">
                0
              </strong>
            </div>

            <div class="fh-kvb-metric">
              <span>省下工作</span>
              <strong data-metric="saved">
                0
              </strong>
            </div>

            <div class="fh-kvb-metric">
              <span>節省率</span>
              <strong data-metric="save-rate">
                0%
              </strong>
            </div>

          </div>


          <details
            class="fh-kvb-section"
            open
          >
            <summary>
              橋接管線
            </summary>

            <div class="fh-kvb-channel-list">

              <div
                class="fh-kvb-channel"
                data-channel="lines"
              >
                <span class="fh-kvb-channel-icon">
                  🔗
                </span>

                <span>
                  <strong>流程連線</strong>
                  <small>0 次</small>
                </span>

                <span class="fh-kvb-channel-state">
                  已接管
                </span>
              </div>


              <div
                class="fh-kvb-channel"
                data-channel="preview"
              >
                <span class="fh-kvb-channel-icon">
                  👁️
                </span>

                <span>
                  <strong>內容預覽</strong>
                  <small>0 次</small>
                </span>

                <span class="fh-kvb-channel-state">
                  已接管
                </span>
              </div>


              <div
                class="fh-kvb-channel"
                data-channel="options"
              >
                <span class="fh-kvb-channel-icon">
                  🌿
                </span>

                <span>
                  <strong>分歧選項</strong>
                  <small>0 次</small>
                </span>

                <span class="fh-kvb-channel-state">
                  已接管
                </span>
              </div>


              <div
                class="fh-kvb-channel"
                data-channel="badges"
              >
                <span class="fh-kvb-channel-icon">
                  🔢
                </span>

                <span>
                  <strong>Node 徽章</strong>
                  <small>0 次</small>
                </span>

                <span class="fh-kvb-channel-state">
                  已接管
                </span>
              </div>


              <div
                class="fh-kvb-channel"
                data-channel="render"
              >
                <span class="fh-kvb-channel-icon">
                  🎨
                </span>

                <span>
                  <strong>RenderCore</strong>
                  <small>0 次</small>
                </span>

                <span class="fh-kvb-channel-state">
                  已接管
                </span>
              </div>

            </div>
          </details>


          <details class="fh-kvb-section">

            <summary>
              接管設定
            </summary>

            <div class="fh-kvb-settings"></div>

          </details>


          <details class="fh-kvb-section">

            <summary>
              Kernel 狀態
            </summary>

            <div class="fh-kvb-kernel-state">

              <div>
                <span>註冊工作</span>
                <strong data-kernel="jobs">
                  0
                </strong>
              </div>

              <div>
                <span>等待工作</span>
                <strong data-kernel="pending">
                  0
                </strong>
              </div>

              <div>
                <span>實際執行</span>
                <strong data-kernel="runs">
                  0
                </strong>
              </div>

              <div>
                <span>最慢工作</span>
                <strong data-kernel="longest">
                  0 ms
                </strong>
              </div>

            </div>

          </details>


          <div class="fh-kvb-last-event">

            <span>
              最近攔截
            </span>

            <strong data-last-event>
              尚無
            </strong>

          </div>


          <div class="fh-kvb-actions">

            <button
              type="button"
              data-action="test"
            >
              🧪 測試橋接
            </button>

            <button
              type="button"
              data-action="flush"
            >
              ⚡ 立即完成
            </button>

            <button
              type="button"
              data-action="reset"
            >
              ↺ 重設統計
            </button>

          </div>

        </div>
      `;


      document.body.appendChild(
        panel
      );


      const settingsBox =
        panel.querySelector(
          ".fh-kvb-settings"
        );


      settingsBox.append(
        makeSwitch(
          "master",
          "總開關",
          "停用後所有公開方法直接執行原函式"
        ),

        makeSwitch(
          "lines",
          "流程連線",
          "接管 GamebookCore.drawLines"
        ),

        makeSwitch(
          "renderCoreLines",
          "RenderCore 連線",
          "接管 FirehahaRenderCore.requestLines"
        ),

        makeSwitch(
          "preview",
          "內容預覽",
          "接管 GamebookCore.updatePreview"
        ),

        makeSwitch(
          "options",
          "分歧選項",
          "接管 GamebookCore.renderOptions"
        ),

        makeSwitch(
          "badges",
          "Node 徽章",
          "接管 GamebookCore.refreshNodeBadges"
        ),

        makeSwitch(
          "eventAssist",
          "事件輔助",
          "頁面或專案變更後補上最後一次更新"
        ),

        makeSwitch(
          "backgroundPause",
          "背景暫停",
          "頁籤不在前景時暫緩橋接工作"
        )
      );


      panel.addEventListener(
        "click",
        event => {

          const button =
            event.target.closest(
              "button[data-action]"
            );


          if(!button){
            return;
          }


          const action =
            button.dataset.action;


          if(action === "minimize"){

            minimized =
              !minimized;


            panel.classList.toggle(
              "is-minimized",
              minimized
            );


            button.textContent =
              minimized
                ? "□"
                : "─";


            button.title =
              minimized
                ? "展開"
                : "收起";


            persistPanelState();


          }else if(
            action === "close"
          ){

            hidePanel();


          }else if(
            action === "flush"
          ){

            kernel.flush();


            toast(
              "已要求 Kernel 完成等待中的工作"
            );


          }else if(
            action === "reset"
          ){

            resetStats();


            toast(
              "橋接器與 Kernel 統計已重設"
            );


          }else if(
            action === "test"
          ){

            runBridgeTest();

          }

        }
      );


      makePanelDraggable();

    }


    // =====================================================
    // 面板拖曳
    // =====================================================

    function makePanelDraggable(){

      const header =
        panel.querySelector(
          ".fh-kvb-header"
        );


      let pointerId =
        null;


      let startX =
        0;


      let startY =
        0;


      let startLeft =
        0;


      let startTop =
        0;


      function move(event){

        if(
          event.pointerId !==
            pointerId
        ){

          return;
        }


        const nextLeft =
          Math.max(
            4,
            Math.min(
              window.innerWidth -
              panel.offsetWidth -
              4,

              startLeft +
              event.clientX -
              startX
            )
          );


        const nextTop =
          Math.max(
            4,
            Math.min(
              window.innerHeight -
              50,

              startTop +
              event.clientY -
              startY
            )
          );


        panel.style.left =
          nextLeft + "px";


        panel.style.top =
          nextTop + "px";


        panel.style.right =
          "auto";


        panel.style.bottom =
          "auto";

      }


      function finish(event){

        if(
          event.pointerId !==
            pointerId
        ){

          return;
        }


        try{

          header.releasePointerCapture(
            pointerId
          );

        }catch(error){}


        pointerId =
          null;


        header.removeEventListener(
          "pointermove",
          move
        );


        header.removeEventListener(
          "pointerup",
          finish
        );


        header.removeEventListener(
          "pointercancel",
          finish
        );

      }


      header.addEventListener(
        "pointerdown",
        event => {

          if(
            event.target.closest(
              "button"
            )
          ){

            return;
          }


          pointerId =
            event.pointerId;


          startX =
            event.clientX;


          startY =
            event.clientY;


          const rect =
            panel.getBoundingClientRect();


          startLeft =
            rect.left;


          startTop =
            rect.top;


          header.setPointerCapture(
            pointerId
          );


          header.addEventListener(
            "pointermove",
            move
          );


          header.addEventListener(
            "pointerup",
            finish
          );


          header.addEventListener(
            "pointercancel",
            finish
          );

        }
      );

    }


    // =====================================================
    // 浮動開啟按鈕
    // =====================================================

    function mountLauncherInMoreTools(
      button
    ){

      function mount(){

        const toolsPanel =
          document.querySelector(
            "body > .pro-more-panel.pro-floating-tools"
          );


        if(!toolsPanel){
          return false;
        }


        toolsPanel.appendChild(
          button
        );


        return true;

      }


      if(mount()){
        return;
      }


      document.body.appendChild(
        button
      );


      const observer =
        new MutationObserver(
          () => {

            if(mount()){
              observer.disconnect();
            }

          }
        );


      observer.observe(
        document.body,
        {
          childList:
            true
        }
      );


      const observerTimeout =
        window.setTimeout(
          () => {

            observer.disconnect();

          },
          5000
        );


      cleanupFunctions.push(
        () => {

          observer.disconnect();

          clearTimeout(
            observerTimeout
          );

        }
      );

    }


    function buildFloatingButton(){

      floatingButton =
        document.createElement(
          "button"
        );


      floatingButton.id =
        "fh-kvb-floating-button";


      floatingButton.type =
        "button";


      floatingButton.title =
        "開啟 Kernel 視覺橋接器";


      floatingButton.innerHTML = `
        <span>🌉</span>
        <strong>Kernel 視覺橋接器</strong>
      `;


      floatingButton.addEventListener(
        "click",
        showPanel
      );


      mountLauncherInMoreTools(
        floatingButton
      );

    }


    function hidePanel(){

      panelVisible =
        false;


      panel.style.display =
        "none";


      floatingButton.style.display =
        "flex";


      persistPanelState();

    }


    function showPanel(){

      panelVisible =
        true;


      document.querySelector(
        "body > .pro-more-panel.pro-floating-tools"
      )?.classList.remove(
        "open"
      );


      document.querySelector(
        ".pro-more-summary"
      )?.classList.remove(
        "active"
      );


      panel.style.display =
        "";


      floatingButton.style.display =
        "none";


      persistPanelState();


      updatePanel();

    }


    // =====================================================
    // 面板更新
    // =====================================================

    function setText(
      selector,
      value
    ){

      const element =
        panel?.querySelector(
          selector
        );


      if(element){

        element.textContent =
          String(value);

      }

    }


    function updateChannel(
      name,
      count,
      enabled
    ){

      const channel =
        panel?.querySelector(
          `[data-channel="${name}"]`
        );


      if(!channel){
        return;
      }


      channel.classList.toggle(
        "is-off",
        !enabled
      );


      const small =
        channel.querySelector(
          "small"
        );


      const state =
        channel.querySelector(
          ".fh-kvb-channel-state"
        );


      if(small){

        small.textContent =
          `${Number(count || 0).toLocaleString()} 次`;

      }


      if(state){

        state.textContent =
          enabled
            ? "已接管"
            : "直通";

      }

    }


    function updatePanel(){

      if(
        !panel ||
        !panelVisible
      ){

        return;
      }


      const kernelStats =
        kernel.getStats();


      const pendingCount =
        Number(
          kernelStats
            ?.pendingJobs
            ?.immediate ||
          0
        ) +
        Number(
          kernelStats
            ?.pendingJobs
            ?.frame ||
          0
        ) +
        Number(
          kernelStats
            ?.pendingJobs
            ?.idle ||
          0
        );


      setText(
        '[data-metric="intercepted"]',
        stats.interceptedTotal
          .toLocaleString()
      );


      setText(
        '[data-metric="requests"]',
        Number(
          kernelStats.totalRequests ||
          0
        ).toLocaleString()
      );


      setText(
        '[data-metric="saved"]',
        Number(
          kernelStats.totalSavedRuns ||
          0
        ).toLocaleString()
      );


      setText(
        '[data-metric="save-rate"]',
        `${kernelStats.overallSaveRate || 0}%`
      );


      setText(
        ".fh-kvb-intercept-number",
        stats.interceptedTotal
          .toLocaleString()
      );


      setText(
        ".fh-kvb-kernel-request-number",
        Number(
          kernelStats.totalRequests ||
          0
        ).toLocaleString()
      );


      setText(
        '[data-kernel="jobs"]',
        kernelStats.registeredJobs ||
        0
      );


      setText(
        '[data-kernel="pending"]',
        pendingCount
      );


      setText(
        '[data-kernel="runs"]',
        Number(
          kernelStats.totalRuns ||
          0
        ).toLocaleString()
      );


      setText(
        '[data-kernel="longest"]',
        `${round(
          kernelStats.longestTask,
          2
        )} ms`
      );


      const lastEventText =
        stats.lastInterceptType
          ? (
              stats.lastInterceptType +
              "・" +
              new Date(
                stats.lastInterceptAt
              ).toLocaleTimeString()
            )
          : "尚無";


      setText(
        "[data-last-event]",
        lastEventText
      );


      updateChannel(
        "lines",
        stats.lineCalls,
        settings.master &&
        settings.lines
      );


      updateChannel(
        "preview",
        stats.previewCalls,
        settings.master &&
        settings.preview
      );


      updateChannel(
        "options",
        stats.optionCalls,
        settings.master &&
        settings.options
      );


      updateChannel(
        "badges",
        stats.badgeCalls,
        settings.master &&
        settings.badges
      );


      updateChannel(
        "render",
        stats.renderCoreLineCalls,
        settings.master &&
        settings.renderCoreLines
      );


      const statusDot =
        panel.querySelector(
          ".fh-kvb-status-dot"
        );


      const statusText =
        panel.querySelector(
          ".fh-kvb-status-text"
        );


      if(settings.master){

        statusDot.classList.remove(
          "is-off"
        );


        statusText.textContent =
          document.hidden
            ? "背景暫緩中"
            : "橋接運作中";

      }else{

        statusDot.classList.add(
          "is-off"
        );


        statusText.textContent =
          "橋接已暫停";

      }


      panel.classList.toggle(
        "is-disabled",
        !settings.master
      );

    }


    // =====================================================
    // 測試
    // =====================================================

    function runBridgeTest(){

      const before =
        kernel.getJobStats()
          .find(
            job =>
              job.id ===
              "core.lines"
          );


      for(
        let index =
          0;

        index <
          100;

        index++
      ){

        core.drawLines();

      }


      setTimeout(
        () => {

          const after =
            kernel.getJobStats()
              .find(
                job =>
                  job.id ===
                  "core.lines"
              );


          const requestIncrease =
            Number(
              after?.requestCount ||
              0
            ) -
            Number(
              before?.requestCount ||
              0
            );


          const runIncrease =
            Number(
              after?.actualRunCount ||
              0
            ) -
            Number(
              before?.actualRunCount ||
              0
            );


          const savedIncrease =
            Number(
              after?.savedRunCount ||
              0
            ) -
            Number(
              before?.savedRunCount ||
              0
            );


          alert(
            "Kernel 橋接測試完成\n\n" +
            `提出請求：${requestIncrease}\n` +
            `實際執行：${runIncrease}\n` +
            `合併省下：${savedIncrease}\n\n` +
            (
              runIncrease <= 2 &&
              savedIncrease >= 90
                ? "✅ 橋接與合併運作正常"
                : "⚠️ 數值不符合預期，請檢查其他排程插件"
            )
          );


          updatePanel();

        },
        120
      );

    }


    // =====================================================
    // 統計與公開 API
    // =====================================================

    function getStats(){

      const kernelStats =
        kernel.getStats();


      return {

        version:
          VERSION,

        active:
          !destroyed,

        masterEnabled:
          settings.master,

        panelVisible,

        minimized,


        interceptedTotal:
          stats.interceptedTotal,

        interceptedLineCalls:
          stats.lineCalls,

        interceptedPreviewCalls:
          stats.previewCalls,

        interceptedOptionCalls:
          stats.optionCalls,

        interceptedBadgeCalls:
          stats.badgeCalls,

        interceptedRenderCoreCalls:
          stats.renderCoreLineCalls,


        eventRequests:
          stats.eventRequests,

        pageSelectedEvents:
          stats.pageSelectedEvents,

        pageCreatedEvents:
          stats.pageCreatedEvents,

        pageRemovedEvents:
          stats.pageRemovedEvents,

        projectChangedEvents:
          stats.projectChangedEvents,


        directFallbacks:
          stats.directFallbacks,

        backgroundDeferrals:
          stats.backgroundDeferrals,

        bridgeErrors:
          stats.bridgeErrors,


        lastInterceptType:
          stats.lastInterceptType,

        lastInterceptAt:
          stats.lastInterceptAt,


        kernelRequests:
          kernelStats.totalRequests,

        kernelRuns:
          kernelStats.totalRuns,

        kernelSavedRuns:
          kernelStats.totalSavedRuns,

        kernelSaveRate:
          kernelStats.overallSaveRate,

        kernelPending:
          kernelStats.pendingJobs,


        settings: {
          ...settings
        },


        uptimeMs:
          Date.now() -
          stats.startedAt

      };

    }


    function resetStats(){

      stats.startedAt =
        Date.now();


      stats.interceptedTotal =
        0;


      stats.lineCalls =
        0;

      stats.previewCalls =
        0;

      stats.optionCalls =
        0;

      stats.badgeCalls =
        0;

      stats.renderCoreLineCalls =
        0;


      stats.eventRequests =
        0;

      stats.pageSelectedEvents =
        0;

      stats.pageCreatedEvents =
        0;

      stats.pageRemovedEvents =
        0;

      stats.projectChangedEvents =
        0;


      stats.directFallbacks =
        0;

      stats.backgroundDeferrals =
        0;

      stats.bridgeErrors =
        0;


      stats.lastInterceptType =
        null;

      stats.lastInterceptAt =
        0;


      kernel.resetStats();


      updatePanel();

    }


    function setEnabled(
      key,
      enabled
    ){

      if(
        !Object.prototype
          .hasOwnProperty.call(
            settings,
            key
          )
      ){

        throw new Error(
          `找不到橋接設定：${key}`
        );

      }


      settings[key] =
        Boolean(enabled);


      updatePanel();


      return settings[key];

    }


    // =====================================================
    // 樣式
    // =====================================================

    const removeStyle =
      api.addStyle(

        STYLE_ID,

        `
        #${PANEL_ID}{
          position:fixed;
          right:18px;
          top:90px;
          /* 開啟後需高於編輯器；「更多工具」浮窗仍使用更高層級。 */
          z-index:20000;
          width:390px;
          max-width:calc(100vw - 20px);
          max-height:calc(100vh - 110px);
          overflow:hidden;
          display:flex;
          flex-direction:column;
          border:1px solid #b9c7d1;
          border-radius:17px;
          background:#f5f8fa;
          box-shadow:0 14px 40px rgba(0,0,0,.30);
          color:#263640;
          font-family:
            system-ui,
            "Noto Sans TC",
            sans-serif;
          contain:layout paint style;
        }

        #${PANEL_ID}.is-minimized{
          width:290px;
        }

        #${PANEL_ID}.is-minimized .fh-kvb-body{
          display:none;
        }

        #${PANEL_ID}.is-disabled{
          opacity:.82;
        }

        .fh-kvb-header{
          flex:0 0 auto;
          min-height:54px;
          box-sizing:border-box;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          padding:8px 10px 8px 13px;
          background:
            linear-gradient(
              135deg,
              #253745,
              #172630
            );
          color:#fff;
          cursor:move;
          user-select:none;
          touch-action:none;
        }

        .fh-kvb-heading{
          min-width:0;
          display:flex;
          align-items:center;
          gap:10px;
        }

        .fh-kvb-heading > div{
          min-width:0;
        }

        .fh-kvb-logo{
          flex:0 0 auto;
          width:34px;
          height:34px;
          display:flex;
          align-items:center;
          justify-content:center;
          border-radius:50%;
          background:rgba(255,255,255,.13);
          font-size:19px;
        }

        .fh-kvb-heading strong{
          display:block;
          overflow:hidden;
          font-size:14px;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .fh-kvb-subtitle{
          display:block;
          margin-top:1px;
          color:rgba(255,255,255,.67);
          font-size:9px;
        }

        .fh-kvb-header-actions{
          flex:0 0 auto;
          display:flex;
          gap:5px;
        }

        #${PANEL_ID} .fh-kvb-header-actions button{
          width:29px!important;
          height:29px!important;
          min-width:0!important;
          padding:0!important;
          display:flex!important;
          align-items:center!important;
          justify-content:center!important;
          border:0!important;
          border-radius:50%!important;
          background:rgba(255,255,255,.13)!important;
          color:#fff!important;
          font-size:16px!important;
        }

        .fh-kvb-body{
          min-height:0;
          overflow:auto;
          padding:12px;
        }

        .fh-kvb-status-row{
          display:flex;
          align-items:center;
          gap:7px;
          margin-bottom:11px;
        }

        .fh-kvb-status-dot{
          width:10px;
          height:10px;
          border-radius:50%;
          background:#36a566;
          box-shadow:0 0 0 4px rgba(54,165,102,.15);
        }

        .fh-kvb-status-dot.is-off{
          background:#a7aeb3;
          box-shadow:none;
        }

        .fh-kvb-status-text{
          font-size:12px;
        }

        .fh-kvb-version{
          margin-left:auto;
          padding:2px 7px;
          border-radius:999px;
          background:#e6edf2;
          color:#62717b;
          font-size:9px;
          font-weight:700;
        }

        .fh-kvb-flow{
          display:grid;
          grid-template-columns:
            minmax(0,1fr)
            34px
            minmax(0,1fr)
            34px
            minmax(0,1fr);
          align-items:center;
          gap:4px;
          margin-bottom:12px;
        }

        .fh-kvb-flow-node{
          min-width:0;
          min-height:77px;
          box-sizing:border-box;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          padding:7px 5px;
          border:1px solid #cfd9df;
          border-radius:11px;
          background:#fff;
          text-align:center;
        }

        .fh-kvb-flow-node.is-bridge{
          border-color:#5f8fb4;
          background:#edf7ff;
        }

        .fh-kvb-flow-node.is-kernel{
          border-color:#6d9e7c;
          background:#eff9f1;
        }

        .fh-kvb-flow-node > span{
          font-size:20px;
        }

        .fh-kvb-flow-node strong{
          max-width:100%;
          margin-top:3px;
          overflow:hidden;
          font-size:10px;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .fh-kvb-flow-node small{
          margin-top:2px;
          color:#76858f;
          font-size:8px;
        }

        .fh-kvb-flow-arrow{
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          color:#5b778c;
          font-size:19px;
        }

        .fh-kvb-flow-arrow small{
          min-width:25px;
          margin-top:1px;
          padding:1px 4px;
          border-radius:999px;
          background:#dfeaf1;
          color:#506673;
          font-size:8px;
          text-align:center;
        }

        .fh-kvb-metrics{
          display:grid;
          grid-template-columns:
            repeat(4,minmax(0,1fr));
          gap:6px;
          margin-bottom:11px;
        }

        .fh-kvb-metric{
          min-width:0;
          padding:8px 4px;
          border:1px solid #d5dde2;
          border-radius:9px;
          background:#fff;
          text-align:center;
        }

        .fh-kvb-metric span{
          display:block;
          overflow:hidden;
          color:#7a8891;
          font-size:8px;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .fh-kvb-metric strong{
          display:block;
          margin-top:3px;
          overflow:hidden;
          color:#27495e;
          font-size:15px;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .fh-kvb-section{
          margin-top:8px;
          overflow:hidden;
          border:1px solid #d4dde2;
          border-radius:10px;
          background:#fff;
        }

        .fh-kvb-section summary{
          padding:9px 11px;
          cursor:pointer;
          color:#40545f;
          font-size:11px;
          font-weight:750;
          user-select:none;
        }

        .fh-kvb-channel-list{
          display:grid;
          gap:5px;
          padding:0 8px 8px;
        }

        .fh-kvb-channel{
          display:grid;
          grid-template-columns:
            28px
            minmax(0,1fr)
            auto;
          align-items:center;
          gap:7px;
          padding:7px 8px;
          border-radius:8px;
          background:#eff7f1;
          border:1px solid #d3e4d7;
        }

        .fh-kvb-channel.is-off{
          background:#f2f3f4;
          border-color:#dfe2e4;
          opacity:.7;
        }

        .fh-kvb-channel-icon{
          font-size:16px;
          text-align:center;
        }

        .fh-kvb-channel > span:nth-child(2){
          min-width:0;
        }

        .fh-kvb-channel strong{
          display:block;
          overflow:hidden;
          font-size:10px;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .fh-kvb-channel small{
          display:block;
          margin-top:1px;
          color:#75838b;
          font-size:8px;
        }

        .fh-kvb-channel-state{
          padding:2px 6px;
          border-radius:999px;
          background:#d7ecdd;
          color:#39704a;
          font-size:8px;
          font-weight:750;
        }

        .fh-kvb-channel.is-off
        .fh-kvb-channel-state{
          background:#e2e4e5;
          color:#737c81;
        }

        .fh-kvb-settings{
          display:grid;
          gap:4px;
          padding:0 8px 8px;
        }

        .fh-kvb-switch-row{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          padding:7px 8px;
          border-radius:8px;
          background:#f5f7f8;
          cursor:pointer;
        }

        .fh-kvb-switch-text{
          min-width:0;
        }

        .fh-kvb-switch-text strong{
          display:block;
          font-size:10px;
        }

        .fh-kvb-switch-text small{
          display:block;
          margin-top:2px;
          color:#77858d;
          font-size:8px;
          line-height:1.35;
        }

        .fh-kvb-switch{
          position:relative;
          flex:0 0 auto;
          width:35px;
          height:20px;
        }

        .fh-kvb-switch input{
          position:absolute;
          opacity:0;
          pointer-events:none;
        }

        .fh-kvb-switch-slider{
          position:absolute;
          inset:0;
          border-radius:999px;
          background:#aab3b8;
          transition:.16s;
        }

        .fh-kvb-switch-slider::after{
          content:"";
          position:absolute;
          left:3px;
          top:3px;
          width:14px;
          height:14px;
          border-radius:50%;
          background:#fff;
          box-shadow:0 1px 3px rgba(0,0,0,.3);
          transition:.16s;
        }

        .fh-kvb-switch input:checked +
        .fh-kvb-switch-slider{
          background:#3d8bbd;
        }

        .fh-kvb-switch input:checked +
        .fh-kvb-switch-slider::after{
          transform:translateX(15px);
        }

        .fh-kvb-kernel-state{
          display:grid;
          grid-template-columns:
            repeat(2,minmax(0,1fr));
          gap:6px;
          padding:0 8px 8px;
        }

        .fh-kvb-kernel-state > div{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:5px;
          padding:7px 8px;
          border-radius:7px;
          background:#f5f7f8;
          font-size:9px;
        }

        .fh-kvb-kernel-state strong{
          color:#2d617f;
        }

        .fh-kvb-last-event{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:8px;
          margin-top:9px;
          padding:8px 9px;
          border-radius:8px;
          background:#eaf2f7;
          font-size:9px;
        }

        .fh-kvb-last-event span{
          color:#6d7b84;
        }

        .fh-kvb-last-event strong{
          max-width:65%;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .fh-kvb-actions{
          display:grid;
          grid-template-columns:
            repeat(3,minmax(0,1fr));
          gap:6px;
          margin-top:9px;
        }

        #${PANEL_ID} .fh-kvb-actions button{
          min-width:0!important;
          min-height:35px;
          padding:6px 5px!important;
          justify-content:center!important;
          border:0!important;
          border-radius:9px!important;
          background:#405c6d!important;
          color:#fff!important;
          font-size:9px!important;
        }

        #${PANEL_ID}
        .fh-kvb-actions button:first-child{
          background:#397b50!important;
        }

        #fh-kvb-floating-button{
          position:fixed!important;
          right:13px;
          bottom:13px;
          z-index:20000;
          min-width:64px!important;
          min-height:55px;
          display:none;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          gap:1px!important;
          padding:6px 9px!important;
          border:0!important;
          border-radius:14px!important;
          background:#263b48!important;
          color:#fff!important;
          box-shadow:0 5px 18px rgba(0,0,0,.32);
          font-size:9px!important;
        }

        #fh-kvb-floating-button span{
          font-size:20px;
        }

        #fh-kvb-floating-button strong{
          font-size:9px;
        }

        body > .pro-more-panel.pro-floating-tools
        > #fh-kvb-floating-button{
          position:static!important;
          inset:auto!important;
          width:100%!important;
          min-height:38px;
          flex-direction:row;
          justify-content:flex-start;
          gap:7px!important;
          padding:7px 10px!important;
          border:1px solid #dbe3ea!important;
          border-radius:8px!important;
          background:#f8fafc!important;
          color:#3f5162!important;
          box-shadow:none;
        }

        body > .pro-more-panel.pro-floating-tools
        > #fh-kvb-floating-button span{
          font-size:15px;
        }

        body > .pro-more-panel.pro-floating-tools
        > #fh-kvb-floating-button strong{
          font-size:11px;
        }

        @media(max-width:600px){

          #${PANEL_ID}{
            right:5px;
            top:60px;
            width:min(380px,calc(100vw - 10px));
            max-height:calc(100vh - 70px);
          }

          .fh-kvb-flow{
            grid-template-columns:
              minmax(0,1fr)
              24px
              minmax(0,1fr)
              24px
              minmax(0,1fr);
          }

          .fh-kvb-flow-node{
            min-height:70px;
          }

          .fh-kvb-metrics{
            grid-template-columns:
              repeat(2,minmax(0,1fr));
          }

        }
        `

      );


    cleanupFunctions.push(
      removeStyle
    );


    // =====================================================
    // 啟動介面
    // =====================================================

    buildPanel();

    buildFloatingButton();


    panel.classList.toggle(
      "is-minimized",
      minimized
    );


    const initialMinimizeButton =
      panel.querySelector(
        '[data-action="minimize"]'
      );


    if(initialMinimizeButton){

      initialMinimizeButton.textContent =
        minimized
          ? "□"
          : "─";


      initialMinimizeButton.title =
        minimized
          ? "展開"
          : "收起";

    }


    if(panelVisible){

      showPanel();

    }else{

      hidePanel();

    }


    updateTimer =
      window.setInterval(
        updatePanel,
        UPDATE_INTERVAL
      );


    cleanupFunctions.push(
      () => {

        clearInterval(
          updateTimer
        );

      }
    );


    // =====================================================
    // 公開 API
    // =====================================================

    const publicApi = {

      version:
        VERSION,

      active:
        true,


      show:
        showPanel,

      hide:
        hidePanel,


      getStats,

      resetStats,


      getSettings(){

        return {
          ...settings
        };

      },


      setEnabled,


      enableAll(){

        Object.keys(
          settings
        ).forEach(
          key => {

            settings[key] =
              true;

          }
        );


        updatePanel();

      },


      disableAll(){

        settings.master =
          false;


        updatePanel();

      },


      test:
        runBridgeTest,


      flush(){

        return kernel.flush();

      },


      requestStoryRefresh,

      requestWorkspaceRefresh

    };


    window.FirehahaKernelVisualBridge =
      publicApi;


    document.dispatchEvent(
      new CustomEvent(
        "firehaha:kernel-visual-bridge-ready",
        {
          detail: {

            version:
              VERSION,

            bridge:
              publicApi

          }
        }
      )
    );


    updatePanel();


    toast(
      "Kernel 視覺圖形化橋接器已啟用"
    );


    // =====================================================
    // Cleanup
    // =====================================================

    return function cleanup(){

      destroyed =
        true;


      publicApi.active =
        false;


      /*
       * 恢復原始公開方法。
       */
      if(
        core.drawLines ===
          bridgedDrawLines
      ){

        core.drawLines =
          originals.drawLines;

      }


      if(
        core.updatePreview ===
          bridgedUpdatePreview
      ){

        core.updatePreview =
          originals.updatePreview;

      }


      if(
        core.renderOptions ===
          bridgedRenderOptions
      ){

        core.renderOptions =
          originals.renderOptions;

      }


      if(
        core.refreshNodeBadges ===
          bridgedRefreshBadges
      ){

        core.refreshNodeBadges =
          originals.refreshNodeBadges;

      }


      if(
        renderCore &&
        renderCore.requestLines ===
          bridgedRenderRequestLines
      ){

        renderCore.requestLines =
          originals.renderRequestLines;

      }


      /*
       * 把 Kernel Job 恢復成直接使用原始函式。
       */
      if(
        kernel.has(
          "core.lines"
        )
      ){

        kernel.unregister(
          "core.lines"
        );

      }


      kernel.register({

        id:
          "core.lines",

        label:
          "流程連線",

        lane:
          "frame",

        priority:
          10,

        run:
          runOriginalLines

      });


      if(
        originals.refreshNodeBadges
      ){

        if(
          kernel.has(
            "core.badges"
          )
        ){

          kernel.unregister(
            "core.badges"
          );

        }


        kernel.register({

          id:
            "core.badges",

          label:
            "Node 徽章",

          lane:
            "frame",

          priority:
            20,

          run:
            runOriginalBadges

        });

      }


      if(
        originals.renderOptions
      ){

        if(
          kernel.has(
            "core.options"
          )
        ){

          kernel.unregister(
            "core.options"
          );

        }


        kernel.register({

          id:
            "core.options",

          label:
            "分歧選項",

          lane:
            "frame",

          priority:
            30,

          run:
            runOriginalOptions

        });

      }


      if(
        originals.updatePreview
      ){

        if(
          kernel.has(
            "core.preview"
          )
        ){

          kernel.unregister(
            "core.preview"
          );

        }


        kernel.register({

          id:
            "core.preview",

          label:
            "內容預覽",

          lane:
            "idle",

          priority:
            50,

          timeout:
            900,

          run:
            runOriginalPreview

        });

      }


      cleanupFunctions
        .splice(0)
        .reverse()
        .forEach(
          callback => {

            if(
              typeof callback !==
                "function"
            ){

              return;

            }


            try{

              callback();

            }catch(error){

              console.warn(
                "[Kernel Visual Bridge cleanup]",
                error
              );

            }

          }
        );


      panel?.remove();

      floatingButton?.remove();


      if(
        window.FirehahaKernelVisualBridge ===
          publicApi
      ){

        delete window
          .FirehahaKernelVisualBridge;

      }


      document.dispatchEvent(
        new CustomEvent(
          "firehaha:kernel-visual-bridge-destroyed"
        )
      );


      toast(
        "Kernel 視覺圖形化橋接器已停用"
      );

    };

  }

});
