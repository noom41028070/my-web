// @firehaha-plugin {"id":"official.firehaha-developer-center","name":"Firehaha 開發者中心","version":"1.0.2","author":"Firehaha","description":"圖形化監看 GamebookCore、RenderCore、Kernel、插件、Node、記憶體、長任務、錯誤與事件。以唯讀診斷為主，不修改正文、存檔或輸出格式。"}

FirehahaPlugins.register({

  id:
    "official.firehaha-developer-center",

  name:
    "Firehaha 開發者中心",

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


    const UPDATE_INTERVAL =
      1000;


    const PANEL_STATE_KEY =
      "firehaha.ui.developer-center.v2";


    const MAX_EVENTS =
      80;


    const MAX_ERRORS =
      30;


    const MAX_LONG_TASKS =
      40;


    // =====================================================
    // 等待主核心
    // =====================================================

    const waitStartedAt =
      Date.now();


    while(
      !window.GamebookCore &&
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


    if(
      window.FirehahaDeveloperCenter &&
      window.FirehahaDeveloperCenter.active
    ){

      throw new Error(
        "Firehaha 開發者中心已經啟用"
      );

    }


    const core =
      window.GamebookCore;


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


    let panelVisible =
      savedPanelState?.visible === true;


    let minimized =
      savedPanelState?.minimized === true;


    let samplingPaused =
      false;


    let activeTab =
      "overview";


    let updateTimer =
      0;


    let longTaskObserver =
      null;


    let panel =
      null;


    let reopenButton =
      null;


    let lastSampleAt =
      0;


    let pluginRecords =
      [];


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
    // 記錄
    // =====================================================

    const eventLog =
      [];


    const errorLog =
      [];


    const longTaskLog =
      [];


    const counters = {

      startedAt:
        Date.now(),


      samples:
        0,


      gamebookEvents:
        0,


      pluginEnabled:
        0,

      pluginDisabled:
        0,


      kernelJobs:
        0,


      errors:
        0,

      promiseErrors:
        0,


      longTasks:
        0,

      longTaskTotal:
        0,

      longestTask:
        0,


      inputEvents:
        0,

      changeEvents:
        0,

      pointerEvents:
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
        "[Firehaha Developer Center]",
        message
      );

    }


    function safeNumber(
      value,
      fallback
    ){

      const number =
        Number(value);


      return Number.isFinite(number)
        ? number
        : (
            fallback === undefined
              ? 0
              : fallback
          );

    }


    function round(
      value,
      digits
    ){

      const number =
        safeNumber(
          value,
          0
        );


      const power =
        10 **
        safeNumber(
          digits,
          0
        );


      return Math.round(
        number * power
      ) / power;

    }


    function formatNumber(value){

      return safeNumber(
        value,
        0
      ).toLocaleString();

    }


    function formatBytes(bytes){

      const value =
        safeNumber(
          bytes,
          0
        );


      if(value < 1024){

        return (
          Math.round(value) +
          " B"
        );

      }


      if(value < 1024 ** 2){

        return (
          round(
            value / 1024,
            1
          ) +
          " KB"
        );

      }


      if(value < 1024 ** 3){

        return (
          round(
            value / 1024 ** 2,
            1
          ) +
          " MB"
        );

      }


      return (
        round(
          value / 1024 ** 3,
          2
        ) +
        " GB"
      );

    }


    function formatDuration(ms){

      const value =
        safeNumber(
          ms,
          0
        );


      if(value < 1000){

        return (
          round(value, 1) +
          " ms"
        );

      }


      return (
        round(
          value / 1000,
          2
        ) +
        " s"
      );

    }


    function formatTime(timestamp){

      if(!timestamp){

        return "—";

      }


      try{

        return new Date(
          timestamp
        ).toLocaleTimeString();

      }catch(error){

        return "—";

      }

    }


    function escapeHtml(value){

      return String(
        value == null
          ? ""
          : value
      ).replace(
        /[&<>"']/g,
        character => {

          return {

            "&":
              "&amp;",

            "<":
              "&lt;",

            ">":
              "&gt;",

            '"':
              "&quot;",

            "'":
              "&#39;"

          }[character];

        }
      );

    }


    function pushLimited(
      list,
      item,
      maximum
    ){

      list.unshift(
        item
      );


      if(
        list.length >
        maximum
      ){

        list.length =
          maximum;

      }

    }


    function getPages(){

      return Array.isArray(
        core.pages
      )
        ? core.pages
        : [];

    }


    function getCurrentPage(){

      return (
        core.currentPage ||
        window.getGamebookCurrentPage?.() ||
        null
      );

    }


    function getCurrentTextLength(){

      const textarea =
        document.getElementById(
          "pageText"
        );


      if(textarea){

        return String(
          textarea.value ||
          ""
        ).length;

      }


      return String(
        getCurrentPage()?.text ||
        ""
      ).length;

    }


    function calculateProjectCharacters(){

      let total =
        0;


      getPages().forEach(
        page => {

          total +=
            String(
              page?.text ||
              ""
            ).length;

        }
      );


      return total;

    }


    function calculateOptionCount(){

      let total =
        0;


      getPages().forEach(
        page => {

          total +=
            Array.isArray(
              page?.options
            )
              ? page.options.length
              : 0;

        }
      );


      return total;

    }


    function readRenderStats(){

      try{

        return (
          window.FirehahaRenderCore
            ?.getRenderStats?.() ||
          null
        );

      }catch(error){

        return null;

      }

    }


    function readKernelStats(){

      try{

        return (
          window.FirehahaKernel
            ?.getStats?.() ||
          null
        );

      }catch(error){

        return null;

      }

    }


    function readBridgeStats(){

      try{

        return (
          window
            .FirehahaKernelVisualBridge
            ?.getStats?.() ||
          null
        );

      }catch(error){

        return null;

      }

    }


    function readFolderStats(){

      try{

        return (
          window
            .FirehahaFolderPerformance
            ?.getStats?.() ||
          null
        );

      }catch(error){

        return null;

      }

    }


    function readPerformanceManagerStats(){

      try{

        return (
          window
            .FirehahaPerformanceManager
            ?.getStats?.() ||
          null
        );

      }catch(error){

        return null;

      }

    }


    function readMemory(){

      const memory =
        performance.memory;


      if(!memory){

        return null;

      }


      return {

        used:
          safeNumber(
            memory.usedJSHeapSize
          ),

        total:
          safeNumber(
            memory.totalJSHeapSize
          ),

        limit:
          safeNumber(
            memory.jsHeapSizeLimit
          )

      };

    }


    // =====================================================
    // 狀態快照
    // =====================================================

    function buildSnapshot(){

      const pages =
        getPages();


      const currentPage =
        getCurrentPage();


      const render =
        readRenderStats();


      const kernel =
        readKernelStats();


      const bridge =
        readBridgeStats();


      const folder =
        readFolderStats();


      const performanceManager =
        readPerformanceManagerStats();


      const memory =
        readMemory();


      const flowNodes =
        document.querySelectorAll(
          "#flowCanvas .flowNode"
        ).length;


      const folderNodes =
        document.querySelectorAll(
          [
            ".fhv3-folder-node",
            ".fhp-folder-node",
            ".fh-folder-node"
          ].join(",")
        ).length;


      const notes =
        document.querySelectorAll(
          [
            ".corkboard-note",
            ".sticky-note",
            ".note"
          ].join(",")
        ).length;


      const materialItems =
        document.querySelectorAll(
          "#material-library-list .material-item"
        ).length;


      return {

        timestamp:
          Date.now(),


        core: {

          available:
            Boolean(
              window.GamebookCore
            ),

          pageCount:
            pages.length,

          currentPageId:
            currentPage?.id ||
            null,

          currentPageTitle:
            currentPage?.title ||
            "未選取",

          currentTextLength:
            getCurrentTextLength(),

          projectCharacters:
            calculateProjectCharacters(),

          optionCount:
            calculateOptionCount(),

          selectedCount:
            window.selectedPages
              ?.size ||
            0

        },


        workspace: {

          flowNodes,

          folderNodes,

          notes,

          materialItems,

          canvases:
            document
              .querySelectorAll(
                "canvas"
              )
              .length,

          domElements:
            document
              .getElementsByTagName(
                "*"
              )
              .length

        },


        render,

        kernel,

        bridge,

        folder,

        performanceManager,

        memory,


        browser: {

          hidden:
            document.hidden,

          online:
            navigator.onLine,

          cores:
            navigator.hardwareConcurrency ||
            null,

          deviceMemory:
            navigator.deviceMemory ||
            null,

          coarsePointer:
            matchMedia(
              "(pointer:coarse)"
            ).matches

        }

      };

    }


    let snapshot =
      buildSnapshot();


    // =====================================================
    // 插件資料
    // =====================================================

    async function refreshPluginRecords(){

      if(
        !window.FirehahaPlugins ||
        typeof window
          .FirehahaPlugins
          .list !==
          "function"
      ){

        pluginRecords =
          [];

        return pluginRecords;

      }


      try{

        const records =
          await window
            .FirehahaPlugins
            .list();


        pluginRecords =
          Array.isArray(records)
            ? records
            : [];


        return pluginRecords;

      }catch(error){

        pushError(
          "plugin-list",
          error
        );


        pluginRecords =
          [];


        return pluginRecords;

      }

    }


    function getBundledPlugins(){

      return Array
        .from(
          document.querySelectorAll(
            "script[data-firehaha-bundled]"
          )
        )
        .map(
          script => {

            return {

              id:
                script.dataset
                  .firehahaBundled,

              source:
                script.getAttribute(
                  "src"
                ) ||
                "內嵌",

              loaded:
                true

            };

          }
        );

    }


    // =====================================================
    // 事件與錯誤
    // =====================================================

    function pushEvent(
      type,
      detail
    ){

      counters.gamebookEvents++;


      let summary =
        "";


      try{

        if(
          detail &&
          typeof detail ===
            "object"
        ){

          summary =
            detail.page?.title ||
            detail.id ||
            detail.reason ||
            detail.type ||
            "";

        }else{

          summary =
            String(
              detail || ""
            );

        }

      }catch(error){}


      pushLimited(
        eventLog,
        {

          type,

          summary:
            String(summary),

          timestamp:
            Date.now()

        },
        MAX_EVENTS
      );

    }


    function pushError(
      type,
      error
    ){

      counters.errors++;


      const message =
        String(
          error?.message ||
          error ||
          "未知錯誤"
        );


      const stack =
        String(
          error?.stack ||
          ""
        );


      pushLimited(
        errorLog,
        {

          type,

          message,

          stack,

          timestamp:
            Date.now()

        },
        MAX_ERRORS
      );

    }


    function onWindowError(event){

      pushError(
        "window.error",
        event.error ||
        event.message
      );


      renderCurrentTab();

    }


    function onUnhandledRejection(event){

      counters.promiseErrors++;


      pushError(
        "unhandledrejection",
        event.reason
      );


      renderCurrentTab();

    }


    window.addEventListener(
      "error",
      onWindowError
    );


    window.addEventListener(
      "unhandledrejection",
      onUnhandledRejection
    );


    cleanupFunctions.push(
      () => {

        window.removeEventListener(
          "error",
          onWindowError
        );


        window.removeEventListener(
          "unhandledrejection",
          onUnhandledRejection
        );

      }
    );


    // =====================================================
    // GamebookCore 事件
    // =====================================================

    const coreEventNames = [

      "page:selected",

      "page:created",

      "page:removed",

      "project:changed",

      "project:loaded",

      "project:saved",

      "options:rendered",

      "preview:updated",

      "lines:drawn"

    ];


    coreEventNames.forEach(
      eventName => {

        try{

          const unsubscribe =
            core.on?.(
              eventName,
              payload => {

                pushEvent(
                  eventName,
                  payload?.detail
                );


                if(
                  !samplingPaused
                ){

                  sample();

                }

              }
            );


          if(
            typeof unsubscribe ===
              "function"
          ){

            cleanupFunctions.push(
              unsubscribe
            );

          }

        }catch(error){}

      }
    );


    // =====================================================
    // 插件與 Kernel 事件
    // =====================================================

    const documentEvents = {

      "firehaha:plugin-enabled":
        event => {

          counters.pluginEnabled++;


          pushEvent(
            "plugin-enabled",
            event.detail
          );


          refreshPluginRecords();

        },


      "firehaha:plugin-disabled":
        event => {

          counters.pluginDisabled++;


          pushEvent(
            "plugin-disabled",
            event.detail
          );


          refreshPluginRecords();

        },


      "firehaha:kernel-job-registered":
        event => {

          counters.kernelJobs++;


          pushEvent(
            "kernel-job-registered",
            event.detail
          );

        },


      "firehaha:kernel-job-finished":
        event => {

          pushEvent(
            "kernel-job-finished",
            {

              id:
                event.detail?.id,

              reason:
                event.detail?.duration != null
                  ? (
                      round(
                        event.detail.duration,
                        2
                      ) +
                      "ms"
                    )
                  : ""

            }
          );

        },


      "firehaha:long-content-safe-mode":
        event => {

          pushEvent(
            "long-content-safe-mode",
            event.detail
          );

        },


      "readerartifact:created":
        event => {

          pushEvent(
            "readerartifact-created",
            event.detail
          );

        },


      "readerartifact:exported":
        event => {

          pushEvent(
            "readerartifact-exported",
            event.detail
          );

        }

    };


    Object.entries(
      documentEvents
    ).forEach(
      (
        [
          name,
          handler
        ]
      ) => {

        document.addEventListener(
          name,
          handler
        );


        cleanupFunctions.push(
          () => {

            document.removeEventListener(
              name,
              handler
            );

          }
        );

      }
    );


    // =====================================================
    // 輸入統計
    // =====================================================

    function onInput(event){

      if(
        event.target.closest?.(
          "#pageText,#pageTitle,#pageNote,#options"
        )
      ){

        counters.inputEvents++;

      }

    }


    function onChange(event){

      if(
        event.target.closest?.(
          ".pixiv-editor-container"
        )
      ){

        counters.changeEvents++;

      }

    }


    function onPointer(){

      counters.pointerEvents++;

    }


    document.addEventListener(
      "input",
      onInput,
      true
    );


    document.addEventListener(
      "change",
      onChange,
      true
    );


    document.addEventListener(
      "pointerdown",
      onPointer,
      true
    );


    cleanupFunctions.push(
      () => {

        document.removeEventListener(
          "input",
          onInput,
          true
        );


        document.removeEventListener(
          "change",
          onChange,
          true
        );


        document.removeEventListener(
          "pointerdown",
          onPointer,
          true
        );

      }
    );


    // =====================================================
    // 長任務監控
    // =====================================================

    if(
      typeof PerformanceObserver ===
        "function"
    ){

      try{

        longTaskObserver =
          new PerformanceObserver(
            list => {

              list
                .getEntries()
                .forEach(
                  entry => {

                    const duration =
                      safeNumber(
                        entry.duration
                      );


                    counters.longTasks++;


                    counters.longTaskTotal +=
                      duration;


                    counters.longestTask =
                      Math.max(
                        counters.longestTask,
                        duration
                      );


                    pushLimited(
                      longTaskLog,
                      {

                        duration,

                        name:
                          entry.name ||
                          "longtask",

                        timestamp:
                          Date.now()

                      },
                      MAX_LONG_TASKS
                    );

                  }
                );


              if(
                activeTab ===
                  "performance"
              ){

                renderCurrentTab();

              }

            }
          );


        longTaskObserver.observe(
          {

            entryTypes: [
              "longtask"
            ]

          }
        );


        cleanupFunctions.push(
          () => {

            longTaskObserver
              ?.disconnect();

          }
        );

      }catch(error){

        longTaskObserver =
          null;

      }

    }


    // =====================================================
    // UI 建立
    // =====================================================

    function buildPanel(){

      panel =
        document.createElement(
          "section"
        );


      panel.id =
        "fh-developer-center";


      panel.innerHTML = `
        <header class="fh-dev-header">

          <div class="fh-dev-title">

            <span class="fh-dev-logo">
              🛠️
            </span>

            <div>
              <strong>
                Firehaha 開發者中心
              </strong>

              <small>
                核心、效能、插件與事件監控
              </small>
            </div>

          </div>


          <div class="fh-dev-header-actions">

            <button
              type="button"
              data-action="minimize"
              title="收起"
            >
              ─
            </button>

            <button
              type="button"
              data-action="hide"
              title="隱藏"
            >
              ×
            </button>

          </div>

        </header>


        <nav class="fh-dev-tabs">

          <button
            type="button"
            data-tab="overview"
            class="active"
          >
            總覽
          </button>

          <button
            type="button"
            data-tab="render"
          >
            渲染
          </button>

          <button
            type="button"
            data-tab="kernel"
          >
            Kernel
          </button>

          <button
            type="button"
            data-tab="plugins"
          >
            插件
          </button>

          <button
            type="button"
            data-tab="performance"
          >
            效能
          </button>

          <button
            type="button"
            data-tab="events"
          >
            事件
          </button>

          <button
            type="button"
            data-tab="errors"
          >
            錯誤
          </button>

        </nav>


        <main class="fh-dev-content"></main>


        <footer class="fh-dev-footer">

          <span class="fh-dev-sample-status">
            即時監控中
          </span>


          <div>

            <button
              type="button"
              data-action="pause"
            >
              ⏸ 暫停監控
            </button>

            <button
              type="button"
              data-action="refresh"
            >
              ↻ 更新
            </button>

            <button
              type="button"
              data-action="reset"
            >
              清除紀錄
            </button>

          </div>

        </footer>
      `;


      document.body.appendChild(
        panel
      );


      panel.addEventListener(
        "click",
        onPanelClick
      );


      makePanelDraggable();

    }


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


    function buildReopenButton(){

      reopenButton =
        document.createElement(
          "button"
        );


      reopenButton.id =
        "fh-developer-center-reopen";


      reopenButton.type =
        "button";


      reopenButton.innerHTML = `
        <span>🛠️</span>
        <strong>開發者中心</strong>
      `;


      reopenButton.title =
        "開啟 Firehaha 開發者中心";


      reopenButton.addEventListener(
        "click",
        showPanel
      );


      mountLauncherInMoreTools(
        reopenButton
      );

    }


    // =====================================================
    // UI 共用元件
    // =====================================================

    function statusBadge(
      good,
      goodText,
      badText
    ){

      return `
        <span class="fh-dev-status ${
          good
            ? "ok"
            : "off"
        }">
          ${
            good
              ? goodText
              : badText
          }
        </span>
      `;

    }


    function metric(
      label,
      value,
      description
    ){

      return `
        <div class="fh-dev-metric">

          <span>
            ${escapeHtml(label)}
          </span>

          <strong>
            ${escapeHtml(value)}
          </strong>

          ${
            description
              ? `
                <small>
                  ${escapeHtml(description)}
                </small>
              `
              : ""
          }

        </div>
      `;

    }


    function section(
      title,
      content
    ){

      return `
        <section class="fh-dev-section">

          <h3>
            ${escapeHtml(title)}
          </h3>

          ${content}

        </section>
      `;

    }


    function emptyState(message){

      return `
        <div class="fh-dev-empty">
          ${escapeHtml(message)}
        </div>
      `;

    }


    function healthClass(value){

      if(value === "bad"){

        return "bad";

      }


      if(value === "warn"){

        return "warn";

      }


      return "ok";

    }


    // =====================================================
    // 各頁面渲染
    // =====================================================

    function renderOverview(){

      const coreStats =
        snapshot.core;


      const workspace =
        snapshot.workspace;


      const memory =
        snapshot.memory;


      const systemRows = [

        {
          label:
            "GamebookCore",

          good:
            snapshot.core.available
        },

        {
          label:
            "RenderCore",

          good:
            Boolean(
              snapshot.render
            )
        },

        {
          label:
            "Kernel",

          good:
            Boolean(
              snapshot.kernel
            )
        },

        {
          label:
            "視覺橋接器",

          good:
            Boolean(
              snapshot.bridge
            )
        },

        {
          label:
            "資料夾效能",

          good:
            Boolean(
              snapshot.folder
            )
        },

        {
          label:
            "原生素材",

          good:
            Boolean(
              window.FirehahaNativeAdapter
            )
        }

      ];


      return `
        <div class="fh-dev-metric-grid">

          ${metric(
            "故事頁面",
            formatNumber(
              coreStats.pageCount
            ),
            "pages[]"
          )}

          ${metric(
            "主畫布 Node",
            formatNumber(
              workspace.flowNodes
            ),
            "目前實際 DOM"
          )}

          ${metric(
            "專案總字數",
            formatNumber(
              coreStats.projectCharacters
            ),
            "所有 Node 正文"
          )}

          ${metric(
            "目前 Node",
            formatNumber(
              coreStats.currentTextLength
            ),
            coreStats.currentPageTitle
          )}

          ${metric(
            "分歧選項",
            formatNumber(
              coreStats.optionCount
            ),
            "全專案合計"
          )}

          ${metric(
            "DOM 元素",
            formatNumber(
              workspace.domElements
            ),
            "整個頁面"
          )}

        </div>


        ${section(
          "系統模組",
          `
            <div class="fh-dev-module-list">

              ${
                systemRows.map(
                  item => {

                    return `
                      <div class="fh-dev-module">

                        <span>
                          ${escapeHtml(
                            item.label
                          )}
                        </span>

                        ${statusBadge(
                          item.good,
                          "已啟用",
                          "未偵測"
                        )}

                      </div>
                    `;

                  }
                ).join("")
              }

            </div>
          `
        )}


        ${section(
          "目前工作區",
          `
            <div class="fh-dev-info-grid">

              <div>
                <span>目前頁面</span>
                <strong>
                  ${escapeHtml(
                    coreStats.currentPageTitle
                  )}
                </strong>
              </div>

              <div>
                <span>目前 ID</span>
                <strong class="fh-dev-code">
                  ${escapeHtml(
                    coreStats.currentPageId ||
                    "—"
                  )}
                </strong>
              </div>

              <div>
                <span>框選數量</span>
                <strong>
                  ${formatNumber(
                    coreStats.selectedCount
                  )}
                </strong>
              </div>

              <div>
                <span>資料夾 Node</span>
                <strong>
                  ${formatNumber(
                    workspace.folderNodes
                  )}
                </strong>
              </div>

              <div>
                <span>便利貼</span>
                <strong>
                  ${formatNumber(
                    workspace.notes
                  )}
                </strong>
              </div>

              <div>
                <span>素材卡</span>
                <strong>
                  ${formatNumber(
                    workspace.materialItems
                  )}
                </strong>
              </div>

            </div>
          `
        )}


        ${section(
          "瀏覽器環境",
          `
            <div class="fh-dev-info-grid">

              <div>
                <span>處理器執行緒</span>
                <strong>
                  ${
                    snapshot.browser.cores ||
                    "未知"
                  }
                </strong>
              </div>

              <div>
                <span>裝置記憶體</span>
                <strong>
                  ${
                    snapshot.browser.deviceMemory
                      ? (
                          snapshot
                            .browser
                            .deviceMemory +
                          " GB"
                        )
                      : "未提供"
                  }
                </strong>
              </div>

              <div>
                <span>指標類型</span>
                <strong>
                  ${
                    snapshot
                      .browser
                      .coarsePointer
                      ? "觸控"
                      : "滑鼠／精細"
                  }
                </strong>
              </div>

              <div>
                <span>頁籤狀態</span>
                <strong>
                  ${
                    snapshot.browser.hidden
                      ? "背景"
                      : "前景"
                  }
                </strong>
              </div>

              <div>
                <span>網路</span>
                <strong>
                  ${
                    snapshot.browser.online
                      ? "連線中"
                      : "離線"
                  }
                </strong>
              </div>

              <div>
                <span>JS Heap</span>
                <strong>
                  ${
                    memory
                      ? formatBytes(
                          memory.used
                        )
                      : "瀏覽器未提供"
                  }
                </strong>
              </div>

            </div>
          `
        )}
      `;

    }


    function renderRenderCore(){

      const render =
        snapshot.render;


      if(!render){

        return emptyState(
          "沒有偵測到 FirehahaRenderCore。"
        );

      }


      const requestCount =
        safeNumber(
          render.requestCount
        );


      const actualCount =
        safeNumber(
          render.actualDrawCount
        );


      const saved =
        safeNumber(
          render.savedDraws
        );


      const savingRate =
        requestCount
          ? (
              saved /
              requestCount *
              100
            )
          : 0;


      return `
        <div class="fh-dev-metric-grid">

          ${metric(
            "繪線請求",
            formatNumber(
              requestCount
            )
          )}

          ${metric(
            "實際繪製",
            formatNumber(
              actualCount
            )
          )}

          ${metric(
            "省下重繪",
            formatNumber(
              saved
            )
          )}

          ${metric(
            "合併率",
            round(
              savingRate,
              1
            ) + "%"
          )}

          ${metric(
            "上次耗時",
            formatDuration(
              render.lastDrawTime
            )
          )}

          ${metric(
            "等待中",
            render.pending
              ? "是"
              : "否"
          )}

        </div>


        ${section(
          "RenderCore 操作",
          `
            <div class="fh-dev-action-row">

              <button
                type="button"
                data-action="request-lines"
              >
                🔗 請求繪線
              </button>

              <button
                type="button"
                data-action="force-lines"
              >
                ⚡ 強制繪線
              </button>

              <button
                type="button"
                data-action="render-test"
              >
                🧪 100 次合併測試
              </button>

            </div>

            <p class="fh-dev-note">
              測試只會提出重複繪線請求，不會改動 Node 或正文。
            </p>
          `
        )}


        ${section(
          "原始狀態",
          `
            <pre class="fh-dev-json">${
              escapeHtml(
                JSON.stringify(
                  render,
                  null,
                  2
                )
              )
            }</pre>
          `
        )}
      `;

    }


    function renderKernel(){

      const kernel =
        snapshot.kernel;


      if(!kernel){

        return emptyState(
          "目前沒有啟用 Firehaha Kernel。開發者中心仍可獨立使用。"
        );

      }


      const pending =
        safeNumber(
          kernel.pendingJobs?.immediate
        ) +
        safeNumber(
          kernel.pendingJobs?.frame
        ) +
        safeNumber(
          kernel.pendingJobs?.idle
        );


      let jobRows =
        "";


      try{

        const jobs =
          window.FirehahaKernel
            ?.getJobStats?.() ||
          [];


        jobRows =
          jobs.map(
            job => {

              return `
                <tr>

                  <td>
                    <strong>
                      ${escapeHtml(
                        job.label ||
                        job.id
                      )}
                    </strong>

                    <small class="fh-dev-code">
                      ${escapeHtml(
                        job.id
                      )}
                    </small>
                  </td>

                  <td>
                    ${escapeHtml(
                      job.lane
                    )}
                  </td>

                  <td>
                    ${formatNumber(
                      job.requestCount
                    )}
                  </td>

                  <td>
                    ${formatNumber(
                      job.actualRunCount
                    )}
                  </td>

                  <td>
                    ${formatNumber(
                      job.savedRunCount
                    )}
                  </td>

                  <td>
                    ${formatDuration(
                      job.maximumDuration
                    )}
                  </td>

                </tr>
              `;

            }
          ).join("");

      }catch(error){}


      return `
        <div class="fh-dev-metric-grid">

          ${metric(
            "註冊工作",
            formatNumber(
              kernel.registeredJobs
            )
          )}

          ${metric(
            "等待工作",
            formatNumber(
              pending
            )
          )}

          ${metric(
            "提出請求",
            formatNumber(
              kernel.totalRequests
            )
          )}

          ${metric(
            "實際執行",
            formatNumber(
              kernel.totalRuns
            )
          )}

          ${metric(
            "省下工作",
            formatNumber(
              kernel.totalSavedRuns
            )
          )}

          ${metric(
            "整體節省率",
            round(
              kernel.overallSaveRate,
              1
            ) + "%"
          )}

        </div>


        ${section(
          "Kernel 操作",
          `
            <div class="fh-dev-action-row">

              <button
                type="button"
                data-action="kernel-flush"
              >
                ⚡ 完成等待工作
              </button>

              <button
                type="button"
                data-action="kernel-test"
              >
                🧪 合併測試
              </button>

              <button
                type="button"
                data-action="kernel-reset"
              >
                ↺ 重設 Kernel 統計
              </button>

            </div>
          `
        )}


        ${section(
          "工作清單",
          jobRows
            ? `
              <div class="fh-dev-table-wrap">

                <table class="fh-dev-table">

                  <thead>
                    <tr>
                      <th>工作</th>
                      <th>Lane</th>
                      <th>請求</th>
                      <th>執行</th>
                      <th>省下</th>
                      <th>最慢</th>
                    </tr>
                  </thead>

                  <tbody>
                    ${jobRows}
                  </tbody>

                </table>

              </div>
            `
            : emptyState(
                "Kernel 沒有提供工作統計。"
              )
        )}
      `;

    }


    function renderPlugins(){

      const bundled =
        getBundledPlugins();


      const importedEnabled =
        pluginRecords.filter(
          record =>
            record.enabled
        );


      const importedDisabled =
        pluginRecords.filter(
          record =>
            !record.enabled
        );


      const rows =
        pluginRecords.map(
          record => {

            return `
              <tr>

                <td>

                  <strong>
                    ${escapeHtml(
                      record.name ||
                      record.id
                    )}
                  </strong>

                  <small class="fh-dev-code">
                    ${escapeHtml(
                      record.id
                    )}
                  </small>

                </td>

                <td>
                  ${escapeHtml(
                    record.version ||
                    "—"
                  )}
                </td>

                <td>
                  ${
                    statusBadge(
                      record.enabled,
                      "啟用",
                      "停用"
                    )
                  }
                </td>

                <td>
                  ${
                    record.lastError
                      ? `
                        <span
                          class="fh-dev-status bad"
                          title="${escapeHtml(
                            record.lastError
                          )}"
                        >
                          有錯誤
                        </span>
                      `
                      : "—"
                  }
                </td>

              </tr>
            `;

          }
        ).join("");


      const bundledRows =
        bundled.map(
          record => {

            return `
              <div class="fh-dev-bundled-item">

                <span>
                  ${escapeHtml(
                    record.id
                  )}
                </span>

                <small>
                  ${escapeHtml(
                    record.source
                  )}
                </small>

              </div>
            `;

          }
        ).join("");


      return `
        <div class="fh-dev-metric-grid">

          ${metric(
            "匯入插件",
            formatNumber(
              pluginRecords.length
            )
          )}

          ${metric(
            "啟用",
            formatNumber(
              importedEnabled.length
            )
          )}

          ${metric(
            "停用",
            formatNumber(
              importedDisabled.length
            )
          )}

          ${metric(
            "綁定插件",
            formatNumber(
              bundled.length
            )
          )}

        </div>


        ${section(
          "插件工具",
          `
            <div class="fh-dev-action-row">

              <button
                type="button"
                data-action="open-plugin-manager"
              >
                🧩 開啟插件管理器
              </button>

              <button
                type="button"
                data-action="refresh-plugins"
              >
                ↻ 重新讀取插件
              </button>

            </div>
          `
        )}


        ${section(
          "匯入型插件",
          rows
            ? `
              <div class="fh-dev-table-wrap">

                <table class="fh-dev-table">

                  <thead>
                    <tr>
                      <th>插件</th>
                      <th>版本</th>
                      <th>狀態</th>
                      <th>錯誤</th>
                    </tr>
                  </thead>

                  <tbody>
                    ${rows}
                  </tbody>

                </table>

              </div>
            `
            : emptyState(
                "目前沒有讀取到匯入型插件紀錄。"
              )
        )}


        ${section(
          "主程式綁定插件",
          bundledRows
            ? `
              <div class="fh-dev-bundled-list">
                ${bundledRows}
              </div>
            `
            : emptyState(
                "沒有偵測到 data-firehaha-bundled 腳本。"
              )
        )}
      `;

    }


    function renderPerformance(){

      const memory =
        snapshot.memory;


      const averageLongTask =
        counters.longTasks
          ? (
              counters.longTaskTotal /
              counters.longTasks
            )
          : 0;


      const longTaskRows =
        longTaskLog.map(
          task => {

            let level =
              "ok";


            if(
              task.duration >= 1000
            ){

              level =
                "bad";

            }else if(
              task.duration >= 200
            ){

              level =
                "warn";

            }


            return `
              <div class="fh-dev-log-row">

                <span class="fh-dev-level ${level}">
                  ${formatDuration(
                    task.duration
                  )}
                </span>

                <span>
                  ${escapeHtml(
                    task.name
                  )}
                </span>

                <time>
                  ${formatTime(
                    task.timestamp
                  )}
                </time>

              </div>
            `;

          }
        ).join("");


      return `
        <div class="fh-dev-metric-grid">

          ${metric(
            "長任務",
            formatNumber(
              counters.longTasks
            ),
            "超過約 50ms"
          )}

          ${metric(
            "平均長任務",
            formatDuration(
              averageLongTask
            )
          )}

          ${metric(
            "最長任務",
            formatDuration(
              counters.longestTask
            )
          )}

          ${metric(
            "Input 事件",
            formatNumber(
              counters.inputEvents
            )
          )}

          ${metric(
            "Change 事件",
            formatNumber(
              counters.changeEvents
            )
          )}

          ${metric(
            "Pointer 操作",
            formatNumber(
              counters.pointerEvents
            )
          )}

        </div>


        ${
          memory
            ? section(
                "JavaScript 記憶體",
                `
                  <div class="fh-dev-memory">

                    <div>
                      <span>使用中</span>
                      <strong>
                        ${formatBytes(
                          memory.used
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>已配置</span>
                      <strong>
                        ${formatBytes(
                          memory.total
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>上限</span>
                      <strong>
                        ${formatBytes(
                          memory.limit
                        )}
                      </strong>
                    </div>

                    <div class="fh-dev-progress">

                      <span style="width:${
                        Math.min(
                          100,
                          memory.limit
                            ? (
                                memory.used /
                                memory.limit *
                                100
                              )
                            : 0
                        )
                      }%"></span>

                    </div>

                  </div>
                `
              )
            : section(
                "JavaScript 記憶體",
                emptyState(
                  "此瀏覽器沒有公開 performance.memory。"
                )
              )
        }


        ${section(
          "長任務紀錄",
          longTaskRows ||
          emptyState(
            "目前尚未偵測到長任務。"
          )
        )}


        ${section(
          "效能工具",
          `
            <div class="fh-dev-action-row">

              <button
                type="button"
                data-action="clear-performance"
              >
                清除長任務紀錄
              </button>

              <button
                type="button"
                data-action="select-small-page"
              >
                切換到最短 Node
              </button>

              <button
                type="button"
                data-action="folder-stats"
              >
                查看資料夾統計
              </button>

            </div>
          `
        )}
      `;

    }


    function renderEvents(){

      const rows =
        eventLog.map(
          item => {

            return `
              <div class="fh-dev-event-row">

                <time>
                  ${formatTime(
                    item.timestamp
                  )}
                </time>

                <strong>
                  ${escapeHtml(
                    item.type
                  )}
                </strong>

                <span>
                  ${escapeHtml(
                    item.summary ||
                    ""
                  )}
                </span>

              </div>
            `;

          }
        ).join("");


      return `
        <div class="fh-dev-metric-grid">

          ${metric(
            "核心事件",
            formatNumber(
              counters.gamebookEvents
            )
          )}

          ${metric(
            "插件啟用",
            formatNumber(
              counters.pluginEnabled
            )
          )}

          ${metric(
            "插件停用",
            formatNumber(
              counters.pluginDisabled
            )
          )}

          ${metric(
            "Kernel 工作註冊",
            formatNumber(
              counters.kernelJobs
            )
          )}

        </div>


        ${section(
          "最近事件",
          rows ||
          emptyState(
            "尚未收到可監控事件。"
          )
        )}
      `;

    }


    function renderErrors(){

      const rows =
        errorLog.map(
          item => {

            return `
              <details class="fh-dev-error-item">

                <summary>

                  <span>
                    ${formatTime(
                      item.timestamp
                    )}
                  </span>

                  <strong>
                    ${escapeHtml(
                      item.type
                    )}
                  </strong>

                  <span>
                    ${escapeHtml(
                      item.message
                    )}
                  </span>

                </summary>

                ${
                  item.stack
                    ? `
                      <pre>${escapeHtml(
                        item.stack
                      )}</pre>
                    `
                    : ""
                }

              </details>
            `;

          }
        ).join("");


      return `
        <div class="fh-dev-metric-grid">

          ${metric(
            "一般錯誤",
            formatNumber(
              counters.errors
            )
          )}

          ${metric(
            "Promise 錯誤",
            formatNumber(
              counters.promiseErrors
            )
          )}

          ${metric(
            "目前紀錄",
            formatNumber(
              errorLog.length
            )
          )}

        </div>


        ${section(
          "錯誤紀錄",
          rows ||
          emptyState(
            "目前沒有捕捉到 JavaScript 錯誤。"
          )
        )}
      `;

    }


    function renderCurrentTab(){

      if(
        destroyed ||
        !panel ||
        !panelVisible ||
        minimized
      ){

        return;
      }


      const content =
        panel.querySelector(
          ".fh-dev-content"
        );


      if(!content){
        return;
      }


      if(
        activeTab ===
          "render"
      ){

        content.innerHTML =
          renderRenderCore();

      }else if(
        activeTab ===
          "kernel"
      ){

        content.innerHTML =
          renderKernel();

      }else if(
        activeTab ===
          "plugins"
      ){

        content.innerHTML =
          renderPlugins();

      }else if(
        activeTab ===
          "performance"
      ){

        content.innerHTML =
          renderPerformance();

      }else if(
        activeTab ===
          "events"
      ){

        content.innerHTML =
          renderEvents();

      }else if(
        activeTab ===
          "errors"
      ){

        content.innerHTML =
          renderErrors();

      }else{

        content.innerHTML =
          renderOverview();

      }

    }


    // =====================================================
    // 面板操作
    // =====================================================

    async function onPanelClick(event){

      const tabButton =
        event.target.closest(
          "button[data-tab]"
        );


      if(tabButton){

        activeTab =
          tabButton.dataset.tab;


        panel
          .querySelectorAll(
            "button[data-tab]"
          )
          .forEach(
            button => {

              button.classList.toggle(
                "active",
                button === tabButton
              );

            }
          );


        if(
          activeTab ===
            "plugins"
        ){

          await refreshPluginRecords();

        }


        sample();

        return;

      }


      const button =
        event.target.closest(
          "button[data-action]"
        );


      if(!button){
        return;
      }


      const action =
        button.dataset.action;


      if(
        action === "minimize"
      ){

        minimized =
          !minimized;


        panel.classList.toggle(
          "minimized",
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


        return;

      }


      if(
        action === "hide"
      ){

        hidePanel();

        return;

      }


      if(
        action === "pause"
      ){

        samplingPaused =
          !samplingPaused;


        button.textContent =
          samplingPaused
            ? "▶ 恢復監控"
            : "⏸ 暫停監控";


        updateSampleStatus();

        return;

      }


      if(
        action === "refresh"
      ){

        await refreshPluginRecords();

        sample();

        return;

      }


      if(
        action === "reset"
      ){

        clearLogs();

        return;

      }


      if(
        action ===
          "request-lines"
      ){

        window
          .FirehahaRenderCore
          ?.requestLines?.();


        toast(
          "已提出繪線請求"
        );

      }


      if(
        action ===
          "force-lines"
      ){

        window
          .FirehahaRenderCore
          ?.forceLines?.();


        toast(
          "已強制重新繪線"
        );

      }


      if(
        action ===
          "render-test"
      ){

        runRenderTest();

      }


      if(
        action ===
          "kernel-flush"
      ){

        await window
          .FirehahaKernel
          ?.flush?.();


        toast(
          "Kernel 等待工作已處理"
        );

      }


      if(
        action ===
          "kernel-test"
      ){

        runKernelTest();

      }


      if(
        action ===
          "kernel-reset"
      ){

        window
          .FirehahaKernel
          ?.resetStats?.();


        toast(
          "Kernel 統計已重設"
        );

      }


      if(
        action ===
          "open-plugin-manager"
      ){

        window
          .FirehahaPlugins
          ?.open?.();

      }


      if(
        action ===
          "refresh-plugins"
      ){

        await refreshPluginRecords();


        renderCurrentTab();

      }


      if(
        action ===
          "clear-performance"
      ){

        longTaskLog.length =
          0;


        counters.longTasks =
          0;


        counters.longTaskTotal =
          0;


        counters.longestTask =
          0;


        renderCurrentTab();

      }


      if(
        action ===
          "select-small-page"
      ){

        selectSmallestPage();

      }


      if(
        action ===
          "folder-stats"
      ){

        const folderStats =
          readFolderStats();


        alert(
          folderStats
            ? JSON.stringify(
                folderStats,
                null,
                2
              )
            : "沒有偵測到資料夾效能插件"
        );

      }


      sample();

    }


    // =====================================================
    // 測試工具
    // =====================================================

    function runRenderTest(){

      const renderCore =
        window.FirehahaRenderCore;


      if(
        !renderCore ||
        typeof renderCore.requestLines !==
          "function"
      ){

        alert(
          "找不到 FirehahaRenderCore.requestLines()"
        );

        return;

      }


      const before =
        renderCore
          .getRenderStats?.() ||
        {};


      for(
        let index =
          0;

        index < 100;

        index++
      ){

        renderCore.requestLines();

      }


      setTimeout(
        () => {

          const after =
            renderCore
              .getRenderStats?.() ||
            {};


          alert(
            "RenderCore 合併測試\n\n" +
            "請求增加：" +
            (
              safeNumber(
                after.requestCount
              ) -
              safeNumber(
                before.requestCount
              )
            ) +
            "\n實際繪製增加：" +
            (
              safeNumber(
                after.actualDrawCount
              ) -
              safeNumber(
                before.actualDrawCount
              )
            ) +
            "\n省下增加：" +
            (
              safeNumber(
                after.savedDraws
              ) -
              safeNumber(
                before.savedDraws
              )
            )
          );


          sample();

        },
        120
      );

    }


    function runKernelTest(){

      const kernel =
        window.FirehahaKernel;


      if(
        !kernel ||
        typeof kernel.requestLines !==
          "function"
      ){

        alert(
          "沒有偵測到 Firehaha Kernel"
        );

        return;

      }


      const before =
        kernel
          .getJobStats?.()
          ?.find(
            job =>
              job.id ===
              "core.lines"
          ) ||
        {};


      for(
        let index =
          0;

        index < 100;

        index++
      ){

        kernel.requestLines();

      }


      setTimeout(
        () => {

          const after =
            kernel
              .getJobStats?.()
              ?.find(
                job =>
                  job.id ===
                  "core.lines"
              ) ||
            {};


          alert(
            "Kernel 合併測試\n\n" +
            "請求增加：" +
            (
              safeNumber(
                after.requestCount
              ) -
              safeNumber(
                before.requestCount
              )
            ) +
            "\n實際執行增加：" +
            (
              safeNumber(
                after.actualRunCount
              ) -
              safeNumber(
                before.actualRunCount
              )
            ) +
            "\n省下增加：" +
            (
              safeNumber(
                after.savedRunCount
              ) -
              safeNumber(
                before.savedRunCount
              )
            )
          );


          sample();

        },
        120
      );

    }


    function selectSmallestPage(){

      const pages =
        getPages();


      const candidate =
        pages
          .filter(
            page =>
              !window
                .FirehahaFolderPerformance
                ?.folders
                ?.some?.(
                  folder =>
                    folder.nodes?.some?.(
                      entry =>
                        String(
                          entry.pageId
                        ) ===
                        String(
                          page.id
                        )
                    )
                )
          )
          .sort(
            (
              first,
              second
            ) => {

              return (
                String(
                  first?.text ||
                  ""
                ).length -
                String(
                  second?.text ||
                  ""
                ).length
              );

            }
          )[0];


      if(!candidate){

        alert(
          "找不到可切換的普通 Node"
        );

        return;

      }


      core.selectPage?.(
        candidate
      );


      toast(
        `已切換到最短 Node：${
          candidate.title ||
          "未命名"
        }`
      );

    }


    // =====================================================
    // 採樣
    // =====================================================

    function sample(){

      if(
        destroyed ||
        samplingPaused
      ){

        return snapshot;

      }


      snapshot =
        buildSnapshot();


      counters.samples++;


      lastSampleAt =
        Date.now();


      updateSampleStatus();


      renderCurrentTab();


      return snapshot;

    }


    function updateSampleStatus(){

      const status =
        panel?.querySelector(
          ".fh-dev-sample-status"
        );


      if(!status){
        return;
      }


      if(samplingPaused){

        status.textContent =
          "監控已暫停";


        status.classList.add(
          "paused"
        );

      }else{

        status.textContent =
          `即時監控中・${
            formatTime(
              lastSampleAt
            )
          }`;


        status.classList.remove(
          "paused"
        );

      }

    }


    function clearLogs(){

      eventLog.length =
        0;


      errorLog.length =
        0;


      longTaskLog.length =
        0;


      counters.gamebookEvents =
        0;


      counters.pluginEnabled =
        0;


      counters.pluginDisabled =
        0;


      counters.kernelJobs =
        0;


      counters.errors =
        0;


      counters.promiseErrors =
        0;


      counters.longTasks =
        0;


      counters.longTaskTotal =
        0;


      counters.longestTask =
        0;


      counters.inputEvents =
        0;


      counters.changeEvents =
        0;


      counters.pointerEvents =
        0;


      renderCurrentTab();


      toast(
        "開發者中心紀錄已清除"
      );

    }


    // =====================================================
    // 開關面板
    // =====================================================

    function hidePanel(){

      panelVisible =
        false;


      panel.style.display =
        "none";


      reopenButton.style.display =
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
        "flex";


      reopenButton.style.display =
        "none";


      persistPanelState();


      sample();

    }


    // =====================================================
    // 拖曳
    // =====================================================

    function makePanelDraggable(){

      const header =
        panel.querySelector(
          ".fh-dev-header"
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


        const left =
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


        const top =
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
          left + "px";


        panel.style.top =
          top + "px";


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
    // 樣式
    // =====================================================

    const removeStyle =
      api.addStyle(

        "firehaha-developer-center",

        `
        #fh-developer-center{
          position:fixed;
          top:76px;
          left:18px;
          /* 開啟後需高於編輯器；「更多工具」浮窗仍使用更高層級。 */
          z-index:20000;
          width:570px;
          max-width:calc(100vw - 20px);
          height:min(760px,calc(100vh - 92px));
          display:flex;
          flex-direction:column;
          overflow:hidden;
          border:1px solid #bac5cc;
          border-radius:17px;
          background:#edf1f4;
          box-shadow:0 16px 48px rgba(0,0,0,.34);
          color:#26343d;
          font-family:
            system-ui,
            "Noto Sans TC",
            sans-serif;
          contain:layout paint style;
        }

        #fh-developer-center.minimized{
          width:330px;
          height:auto;
        }

        #fh-developer-center.minimized
        .fh-dev-tabs,
        #fh-developer-center.minimized
        .fh-dev-content,
        #fh-developer-center.minimized
        .fh-dev-footer{
          display:none;
        }

        .fh-dev-header{
          flex:0 0 auto;
          min-height:56px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          padding:8px 10px 8px 13px;
          background:
            linear-gradient(
              135deg,
              #263b48,
              #162630
            );
          color:#fff;
          cursor:move;
          user-select:none;
          touch-action:none;
        }

        .fh-dev-title{
          min-width:0;
          display:flex;
          align-items:center;
          gap:10px;
        }

        .fh-dev-title > div{
          min-width:0;
        }

        .fh-dev-logo{
          width:36px;
          height:36px;
          display:flex;
          align-items:center;
          justify-content:center;
          border-radius:50%;
          background:rgba(255,255,255,.13);
          font-size:20px;
        }

        .fh-dev-title strong{
          display:block;
          overflow:hidden;
          font-size:14px;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .fh-dev-title small{
          display:block;
          margin-top:2px;
          color:rgba(255,255,255,.67);
          font-size:9px;
        }

        .fh-dev-header-actions{
          display:flex;
          gap:5px;
        }

        #fh-developer-center
        .fh-dev-header-actions button{
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

        .fh-dev-tabs{
          flex:0 0 auto;
          display:flex;
          gap:4px;
          overflow-x:auto;
          padding:7px;
          border-bottom:1px solid #cbd3d8;
          background:#fff;
        }

        #fh-developer-center
        .fh-dev-tabs button{
          flex:0 0 auto;
          min-height:32px;
          padding:5px 10px!important;
          border:0!important;
          border-radius:16px!important;
          background:#e8edf0!important;
          color:#52636e!important;
          font-size:10px!important;
        }

        #fh-developer-center
        .fh-dev-tabs button.active{
          background:#2478aa!important;
          color:#fff!important;
        }

        .fh-dev-content{
          flex:1;
          min-height:0;
          overflow:auto;
          padding:11px;
        }

        .fh-dev-metric-grid{
          display:grid;
          grid-template-columns:
            repeat(3,minmax(0,1fr));
          gap:7px;
        }

        .fh-dev-metric{
          min-width:0;
          padding:10px 8px;
          border:1px solid #d1d9de;
          border-radius:10px;
          background:#fff;
          text-align:center;
        }

        .fh-dev-metric > span{
          display:block;
          overflow:hidden;
          color:#77858d;
          font-size:9px;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .fh-dev-metric > strong{
          display:block;
          margin-top:3px;
          overflow:hidden;
          color:#23536e;
          font-size:18px;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .fh-dev-metric > small{
          display:block;
          margin-top:2px;
          overflow:hidden;
          color:#8b969c;
          font-size:8px;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .fh-dev-section{
          margin-top:10px;
          padding:10px;
          border:1px solid #d1d9de;
          border-radius:11px;
          background:#fff;
        }

        .fh-dev-section h3{
          margin:0 0 9px!important;
          padding:0 0 7px;
          border-bottom:1px solid #e0e5e8;
          color:#40535e!important;
          font-size:11px!important;
        }

        .fh-dev-module-list{
          display:grid;
          grid-template-columns:
            repeat(2,minmax(0,1fr));
          gap:6px;
        }

        .fh-dev-module{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:6px;
          padding:7px 8px;
          border-radius:8px;
          background:#f2f5f6;
          font-size:10px;
        }

        .fh-dev-status{
          flex:0 0 auto;
          padding:2px 7px;
          border-radius:999px;
          font-size:8px;
          font-weight:750;
        }

        .fh-dev-status.ok{
          background:#dcefe1;
          color:#367148;
        }

        .fh-dev-status.off{
          background:#e6e8e9;
          color:#737d82;
        }

        .fh-dev-status.bad{
          background:#f7dddd;
          color:#9a4141;
        }

        .fh-dev-info-grid{
          display:grid;
          grid-template-columns:
            repeat(2,minmax(0,1fr));
          gap:6px;
        }

        .fh-dev-info-grid > div{
          min-width:0;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:7px;
          padding:7px 8px;
          border-radius:8px;
          background:#f3f6f7;
          font-size:9px;
        }

        .fh-dev-info-grid span{
          color:#728089;
        }

        .fh-dev-info-grid strong{
          min-width:0;
          overflow:hidden;
          text-align:right;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .fh-dev-code{
          display:block;
          font-family:
            ui-monospace,
            Consolas,
            monospace;
          font-size:8px!important;
        }

        .fh-dev-action-row{
          display:flex;
          flex-wrap:wrap;
          gap:6px;
        }

        #fh-developer-center
        .fh-dev-action-row button{
          min-height:34px;
          padding:6px 10px!important;
          border:0!important;
          border-radius:17px!important;
          background:#405f71!important;
          color:#fff!important;
          font-size:9px!important;
        }

        .fh-dev-note{
          margin:8px 0 0!important;
          color:#7c898f;
          font-size:9px;
          line-height:1.5;
        }

        .fh-dev-json{
          max-height:270px;
          overflow:auto;
          margin:0;
          padding:9px;
          border-radius:8px;
          background:#19262e;
          color:#d6e2e8;
          font:9px/1.55
            ui-monospace,
            Consolas,
            monospace;
          white-space:pre-wrap;
          word-break:break-word;
        }

        .fh-dev-table-wrap{
          overflow:auto;
        }

        .fh-dev-table{
          width:100%;
          border-collapse:collapse;
          font-size:9px;
        }

        .fh-dev-table th,
        .fh-dev-table td{
          padding:7px 6px;
          border-bottom:1px solid #e1e6e9;
          text-align:left;
          vertical-align:middle;
          white-space:nowrap;
        }

        .fh-dev-table th{
          color:#718089;
          font-size:8px;
        }

        .fh-dev-table td:first-child{
          max-width:210px;
          white-space:normal;
        }

        .fh-dev-table td:first-child strong{
          display:block;
        }

        .fh-dev-bundled-list{
          display:grid;
          gap:5px;
        }

        .fh-dev-bundled-item{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:8px;
          padding:7px 8px;
          border-radius:7px;
          background:#f2f5f6;
          font-size:9px;
        }

        .fh-dev-bundled-item small{
          max-width:52%;
          overflow:hidden;
          color:#7e8b92;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .fh-dev-memory{
          display:grid;
          grid-template-columns:
            repeat(3,minmax(0,1fr));
          gap:6px;
        }

        .fh-dev-memory > div:not(.fh-dev-progress){
          padding:8px;
          border-radius:8px;
          background:#f3f6f7;
          text-align:center;
        }

        .fh-dev-memory span{
          display:block;
          color:#77858d;
          font-size:8px;
        }

        .fh-dev-memory strong{
          display:block;
          margin-top:3px;
          font-size:11px;
        }

        .fh-dev-progress{
          grid-column:1 / -1;
          height:10px;
          overflow:hidden;
          border-radius:999px;
          background:#dfe5e8;
        }

        .fh-dev-progress span{
          display:block;
          height:100%;
          border-radius:inherit;
          background:#397fa8;
        }

        .fh-dev-log-row,
        .fh-dev-event-row{
          display:grid;
          align-items:center;
          gap:7px;
          padding:7px 5px;
          border-bottom:1px solid #e5e9eb;
          font-size:9px;
        }

        .fh-dev-log-row{
          grid-template-columns:
            68px
            minmax(0,1fr)
            auto;
        }

        .fh-dev-event-row{
          grid-template-columns:
            62px
            155px
            minmax(0,1fr);
        }

        .fh-dev-log-row time,
        .fh-dev-event-row time{
          color:#87939a;
          font-size:8px;
        }

        .fh-dev-level{
          padding:2px 5px;
          border-radius:999px;
          text-align:center;
          font-size:8px;
          font-weight:700;
        }

        .fh-dev-level.ok{
          background:#e0eee4;
          color:#397249;
        }

        .fh-dev-level.warn{
          background:#fff1c9;
          color:#8b681b;
        }

        .fh-dev-level.bad{
          background:#f7dada;
          color:#9c3e3e;
        }

        .fh-dev-error-item{
          margin-bottom:6px;
          border:1px solid #ead1d1;
          border-radius:8px;
          background:#fff7f7;
        }

        .fh-dev-error-item summary{
          display:grid;
          grid-template-columns:
            62px
            120px
            minmax(0,1fr);
          gap:7px;
          padding:8px;
          cursor:pointer;
          font-size:9px;
        }

        .fh-dev-error-item pre{
          max-height:240px;
          overflow:auto;
          margin:0;
          padding:9px;
          border-top:1px solid #ead1d1;
          background:#302425;
          color:#ffdede;
          font:8px/1.5
            ui-monospace,
            Consolas,
            monospace;
          white-space:pre-wrap;
          word-break:break-word;
        }

        .fh-dev-empty{
          padding:24px 12px;
          color:#7b888f;
          font-size:10px;
          text-align:center;
        }

        .fh-dev-footer{
          flex:0 0 auto;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:8px;
          padding:7px 9px;
          border-top:1px solid #cbd3d8;
          background:#fff;
        }

        .fh-dev-sample-status{
          color:#397249;
          font-size:8px;
        }

        .fh-dev-sample-status.paused{
          color:#956c25;
        }

        .fh-dev-footer > div{
          display:flex;
          gap:5px;
        }

        #fh-developer-center
        .fh-dev-footer button{
          min-height:29px;
          padding:4px 8px!important;
          border:0!important;
          border-radius:15px!important;
          background:#526773!important;
          color:#fff!important;
          font-size:8px!important;
        }

        #fh-developer-center-reopen{
          position:fixed!important;
          left:12px;
          bottom:12px;
          z-index:20000;
          min-width:58px!important;
          min-height:54px;
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
          box-shadow:0 5px 18px rgba(0,0,0,.34);
        }

        #fh-developer-center-reopen span{
          font-size:20px;
        }

        #fh-developer-center-reopen strong{
          font-size:8px;
        }

        body > .pro-more-panel.pro-floating-tools
        > #fh-developer-center-reopen{
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
        > #fh-developer-center-reopen span{
          font-size:15px;
        }

        body > .pro-more-panel.pro-floating-tools
        > #fh-developer-center-reopen strong{
          font-size:11px;
        }

        @media(max-width:650px){

          #fh-developer-center{
            top:58px;
            left:5px;
            width:calc(100vw - 10px);
            height:calc(100vh - 66px);
          }

          .fh-dev-metric-grid{
            grid-template-columns:
              repeat(2,minmax(0,1fr));
          }

          .fh-dev-module-list,
          .fh-dev-info-grid{
            grid-template-columns:1fr;
          }

          .fh-dev-event-row{
            grid-template-columns:
              55px
              115px
              minmax(0,1fr);
          }

        }
        `

      );


    cleanupFunctions.push(
      removeStyle
    );


    // =====================================================
    // 啟動
    // =====================================================

    buildPanel();

    buildReopenButton();


    panel.classList.toggle(
      "minimized",
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


    await refreshPluginRecords();


    sample();


    updateTimer =
      window.setInterval(
        () => {

          if(
            !samplingPaused
          ){

            sample();

          }

        },
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


      refresh:
        sample,


      pause(){

        samplingPaused =
          true;


        updateSampleStatus();

      },


      resume(){

        samplingPaused =
          false;


        sample();

      },


      isPaused(){

        return samplingPaused;

      },


      clearLogs,


      getSnapshot(){

        return {
          ...snapshot
        };

      },


      getEvents(){

        return eventLog.map(
          item => ({
            ...item
          })
        );

      },


      getErrors(){

        return errorLog.map(
          item => ({
            ...item
          })
        );

      },


      getLongTasks(){

        return longTaskLog.map(
          item => ({
            ...item
          })
        );

      },


      async getPluginRecords(){

        await refreshPluginRecords();


        return pluginRecords.map(
          item => ({
            ...item
          })
        );

      },


      getStats(){

        return {

          version:
            VERSION,

          active:
            !destroyed,

          panelVisible,

          minimized,

          samplingPaused,

          activeTab,

          samples:
            counters.samples,

          events:
            eventLog.length,

          errors:
            errorLog.length,

          longTasks:
            counters.longTasks,

          longestTask:
            counters.longestTask,

          uptimeMs:
            Date.now() -
            counters.startedAt

        };

      }

    };


    window.FirehahaDeveloperCenter =
      publicApi;


    document.dispatchEvent(
      new CustomEvent(
        "firehaha:developer-center-ready",
        {

          detail: {

            version:
              VERSION,

            developerCenter:
              publicApi

          }

        }
      )
    );


    toast(
      "Firehaha 開發者中心已啟用"
    );


    // =====================================================
    // Cleanup
    // =====================================================

    return function cleanup(){

      destroyed =
        true;


      publicApi.active =
        false;


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
                "[Developer Center cleanup]",
                error
              );

            }

          }
        );


      panel?.remove();

      reopenButton?.remove();


      if(
        window.FirehahaDeveloperCenter ===
        publicApi
      ){

        delete window
          .FirehahaDeveloperCenter;

      }


      document.dispatchEvent(
        new CustomEvent(
          "firehaha:developer-center-destroyed"
        )
      );


      toast(
        "Firehaha 開發者中心已停用"
      );

    };

  }

});
