// @firehaha-plugin {"id":"official.toolbox-organizer","name":"工具包收納盒","version":"2.0.0","author":"Firehaha","description":"非掃描式工具箱。啟動時一次收納浮動工具、官方語言選單與節點快速搜尋，不使用 MutationObserver，不持續重建介面。"}

FirehahaPlugins.register({

  id:
    "official.toolbox-organizer",

  name:
    "工具包收納盒",

  version:
    "2.0.0",


  async setup(api){

    "use strict";


    // =====================================================
    // 基本設定
    // =====================================================

    const READY_TIMEOUT =
      15000;


    const STORAGE_KEY =
      "FirehahaToolboxOrganizer_V2";


    const ORIGINAL_BUTTON_VISIBLE_TIME =
      8000;


    /*
     * 工具箱應放在所有一般外掛後面。
     *
     * 這支外掛只在啟動時搜尋一次。
     * 後續若真的新增工具，可手動按「重新整理工具」。
     */
    const TOOL_DEFINITIONS = [

      {
        selectors:[
          "#folder-toggle-btn",
          "#material-library-btn",
          "#material-library-button",
          '[data-tool="material-library"]'
        ],

        label:
          "素材庫",

        icon:
          "📁",

        group:
          "創作工具"
      },

      {
        selectors:[
          "#sticky-note-add-btn",
          "#add-sticky-note",
          '[data-tool="sticky-note"]'
        ],

        label:
          "新增便利貼",

        icon:
          "🗒️",

        group:
          "創作工具"
      },

      {
        selectors:[
          "#draw-mode-toggle-btn",
          "#draw-mode-btn",
          '[data-tool="drawing"]'
        ],

        label:
          "畫筆模式",

        icon:
          "🖊️",

        group:
          "創作工具"
      },

      {
        selectors:[
          "#dice-roller-btn",
          "#dice-button",
          '[data-tool="dice"]'
        ],

        label:
          "骰子",

        icon:
          "🎲",

        group:
          "創作工具"
      },

      {
        selectors:[
          "#firehahaPluginButton",
          "#firehaha-plugin-button",
          '[data-tool="plugin-manager"]'
        ],

        label:
          "JS 插件管理",

        icon:
          "🧩",

        group:
          "系統工具"
      }

    ];


    /*
     * 沒有固定 ID 的浮動工具，
     * 使用按鈕文字辨認。
     */
    const TEXT_DEFINITIONS = [

      {
        pattern:
          /大型專案/,

        label:
          "大型專案工具",

        icon:
          "⚡",

        group:
          "維護與測試"
      },

      {
        pattern:
          /30\s*萬字|30萬字|壓測/,

        label:
          "30 萬字壓測",

        icon:
          "🧪",

        group:
          "維護與測試"
      },

      {
        pattern:
          /DOCX|紙本/i,

        label:
          "DOCX 紙本工具",

        icon:
          "📄",

        group:
          "匯出工具"
      },

      {
        pattern:
          /系統狀態|系統診斷|健康監控/,

        label:
          "系統診斷",

        icon:
          "🩺",

        group:
          "維護與測試"
      }

    ];


    const GROUP_ORDER = [

      "創作工具",
      "專案工具",
      "匯出工具",
      "系統工具",
      "維護與測試",
      "其他工具"

    ];


    // =====================================================
    // 等待主程式和主要外掛建立
    // =====================================================

    const startedAt =
      Date.now();


    while(
      (
        !document.body ||
        !document.getElementById(
          "flowPanel"
        )
      ) &&
      Date.now() - startedAt <
        READY_TIMEOUT
    ){

      await new Promise(
        resolve => {

          
        }
      );

    }


    if(!document.body){

      throw new Error(
        "頁面尚未完成載入"
      );

    }


    // =====================================================
    // 執行狀態
    // =====================================================

    let destroyed =
      false;


    let opened =
      false;


    let rendering =
      false;


    let itemCount =
      0;


    let temporaryOriginalTimer =
      0;


    let originalsTemporarilyVisible =
      false;


    let miniMapOpenedByToolbox =
      false;


    /*
     * 啟動時取得並固定保存的工具清單。
     *
     * 不會因介面文字改變而重新搜尋。
     */
    let registeredTools =
      [];


    /*
     * 一般按鈕原始狀態。
     */
    const originalRecords =
      new Map();


    /*
     * 原始浮動工具列狀態。
     */
    const toolbarRecords =
      new Map();


    /*
     * 固定面板原始狀態。
     */
    const panelRecords =
      new Map();


    /*
     * 真實 Widget 的原始 DOM 位置。
     *
     * 目前主要用於官方語言選單。
     */
    const widgetRecords =
      new Map();


    const savedState =
      loadState();


    // =====================================================
    // 儲存工具箱開關狀態
    // =====================================================

    function loadState(){

      try{

        const raw =
          localStorage.getItem(
            STORAGE_KEY
          );


        if(!raw){

          return {
            opened:false
          };

        }


        const parsed =
          JSON.parse(
            raw
          );


        return {

          opened:
            parsed.opened === true

        };

      }catch(error){

        return {
          opened:false
        };

      }

    }


    function saveState(){

      try{

        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({

            opened

          })
        );

      }catch(error){}

    }


    // =====================================================
    // 樣式
    // =====================================================

    const removeStyle =
      api.addStyle(
        "toolbox-organizer-v2",
        `
        #fhToolboxDock{
          position:fixed;
          left:14px;
          bottom:14px;
          z-index:2147483100;
          display:flex;
          align-items:flex-end;
          gap:8px;
          font-family:
            system-ui,
            -apple-system,
            "Segoe UI",
            "Noto Sans TC",
            sans-serif;
          pointer-events:none;
        }

        #fhToolboxButton{
          pointer-events:auto;
          display:flex!important;
          align-items:center;
          justify-content:center;
          gap:7px;
          min-width:56px;
          min-height:46px;
          padding:9px 14px!important;
          border:
            1px solid
            rgba(255,255,255,.25)!important;
          border-radius:999px!important;
          background:
            linear-gradient(
              135deg,
              #263b58,
              #17263b
            )!important;
          color:#fff!important;
          font:
            800 13px/1.2
            system-ui,
            sans-serif!important;
          box-shadow:
            0 9px 28px
            rgba(13,30,51,.35)!important;
          cursor:pointer;
          transform:none!important;
          touch-action:manipulation;
        }

        #fhToolboxButton:hover{
          background:
            linear-gradient(
              135deg,
              #315078,
              #203650
            )!important;
          transform:
            translateY(-1px)!important;
        }

        #fhToolboxButton
        .fh-toolbox-count{
          display:grid;
          place-items:center;
          min-width:20px;
          height:20px;
          padding:0 5px;
          border-radius:999px;
          background:#fff;
          color:#24364e;
          font-size:11px;
        }

        #fhToolboxDrawer{
          pointer-events:auto;
          display:none;
          width:
            min(
              360px,
              calc(100vw - 28px)
            );
          max-height:
            min(
              680px,
              calc(100vh - 86px)
            );
          overflow:hidden;
          border:
            1px solid
            rgba(36,54,78,.2);
          border-radius:16px;
          background:
            rgba(250,252,255,.98);
          color:#26364a;
          box-shadow:
            0 20px 62px
            rgba(16,32,52,.34);
          backdrop-filter:
            blur(12px);
        }

        #fhToolboxDrawer.open{
          display:grid;
          grid-template-rows:
            auto
            minmax(0,1fr)
            auto;
        }

        #fhToolboxDrawer
        .fh-toolbox-head{
          display:flex;
          align-items:center;
          gap:8px;
          padding:11px 12px;
          border-bottom:
            1px solid #dfe6ee;
          background:#eef4fa;
        }

        #fhToolboxDrawer
        .fh-toolbox-head strong{
          margin-right:auto;
          font-size:14px;
        }

        #fhToolboxDrawer
        .fh-toolbox-head button,
        #fhToolboxDrawer
        .fh-toolbox-foot button{
          min-height:31px;
          padding:5px 9px!important;
          border:
            1px solid #cbd7e2!important;
          border-radius:8px!important;
          background:#fff!important;
          color:#334b64!important;
          font-size:12px!important;
          font-weight:750!important;
          transform:none!important;
          box-shadow:none!important;
          cursor:pointer;
        }

        #fhToolboxDrawer
        .fh-toolbox-body{
          overflow:auto;
          padding:10px;
          overscroll-behavior:contain;
        }

        #fhToolboxDrawer
        .fh-toolbox-group{
          margin:0 0 12px;
        }

        #fhToolboxDrawer
        .fh-toolbox-group:last-child{
          margin-bottom:0;
        }

        #fhToolboxDrawer
        .fh-toolbox-group-title{
          margin:0 0 6px;
          padding:0 4px;
          color:#718092;
          font-size:11px;
          font-weight:850;
          letter-spacing:.06em;
        }

        #fhToolboxDrawer
        .fh-toolbox-grid{
          display:grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0,1fr)
            );
          gap:7px;
        }

        #fhToolboxDrawer
        .fh-toolbox-item{
          display:flex!important;
          align-items:center;
          justify-content:flex-start;
          gap:8px;
          width:100%!important;
          min-height:44px;
          padding:9px 10px!important;
          border:
            1px solid #d7e0e9!important;
          border-radius:11px!important;
          background:#fff!important;
          color:#2b4057!important;
          font:
            750 13px/1.3
            system-ui,
            sans-serif!important;
          text-align:left;
          box-shadow:
            0 2px 8px
            rgba(38,59,83,.06)!important;
          transform:none!important;
          cursor:pointer;
        }

        #fhToolboxDrawer
        .fh-toolbox-item:hover{
          border-color:#7ba8d4!important;
          background:#edf6ff!important;
          color:#155f9a!important;
        }

        #fhToolboxDrawer
        .fh-toolbox-item.active{
          border-color:#6e55c7!important;
          background:#f2efff!important;
          color:#5134ae!important;
        }

        #fhToolboxDrawer
        .fh-toolbox-icon{
          width:22px;
          flex:0 0 22px;
          text-align:center;
          font-size:17px;
        }

        /*
         * Widget 佔滿一整列。
         */
        #fhToolboxDrawer
        .fh-toolbox-widget{
          grid-column:
            1 / -1;
          display:grid;
          gap:8px;
          padding:10px;
          border:
            1px solid #d7e0e9;
          border-radius:11px;
          background:#fff;
          box-shadow:
            0 2px 8px
            rgba(38,59,83,.06);
        }

        #fhToolboxDrawer
        .fh-toolbox-widget-head{
          display:flex;
          align-items:center;
          gap:8px;
          color:#2b4057;
          font-size:13px;
          font-weight:800;
        }

        #fhToolboxDrawer
        .fh-toolbox-widget-body{
          min-width:0;
        }

        /*
         * 官方語言選單進入工具箱後，
         * 取消原本浮動定位。
         */
        #fhToolboxDrawer
        .firehaha-language-switcher{
          position:static!important;
          inset:auto!important;
          top:auto!important;
          right:auto!important;
          bottom:auto!important;
          left:auto!important;
          z-index:auto!important;
          display:flex!important;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          width:100%!important;
          max-width:none!important;
          margin:0!important;
          padding:0!important;
          transform:none!important;
          box-shadow:none!important;
          background:transparent!important;
          border:0!important;
          color:#334b64!important;
        }

        #fhToolboxDrawer
        .firehaha-language-switcher
        select,
        #fhToolboxDrawer
        [data-firehaha-language]{
          flex:1;
          min-width:0;
          width:100%;
          min-height:38px;
          padding:7px 10px;
          border:
            1px solid #cbd7e2;
          border-radius:9px;
          background:#fff;
          color:#26364a;
          font:
            700 13px/1.3
            system-ui,
            sans-serif;
          cursor:pointer;
        }

        #fhToolboxDrawer
        .fh-toolbox-empty{
          padding:24px 12px;
          color:#718092;
          text-align:center;
          font-size:13px;
        }

        #fhToolboxDrawer
        .fh-toolbox-foot{
          display:flex;
          justify-content:space-between;
          gap:8px;
          padding:9px 10px;
          border-top:
            1px solid #dfe6ee;
          background:#f5f8fb;
        }

        /*
         * 被工具箱收納的一般原始入口。
         */
        .fh-toolbox-original-hidden{
          display:none!important;
        }

        /*
         * 被工具箱收納的搜尋面板。
         */
        #mini-map-plugin.fh-toolbox-panel-stored{
          display:none!important;
        }

        /*
         * 搜尋面板內新增的收回按鈕。
         */
        #mini-map-plugin
        .fh-toolbox-return-button{
          margin-left:auto!important;
          padding:2px 7px!important;
          border:0!important;
          border-radius:6px!important;
          background:
            rgba(255,255,255,.15)!important;
          color:#fff!important;
          font-size:16px!important;
          line-height:1!important;
          box-shadow:none!important;
          transform:none!important;
          cursor:pointer;
        }

        @media(max-width:700px){

          #fhToolboxDock{
            left:8px;
            right:8px;
            bottom:8px;
            align-items:stretch;
          }

          #fhToolboxButton{
            min-width:54px;
            min-height:50px;
            padding:
              10px 12px!important;
          }

          #fhToolboxDrawer{
            position:fixed;
            left:8px;
            right:8px;
            bottom:66px;
            width:auto;
            max-height:
              min(
                72vh,
                620px
              );
            border-radius:17px;
          }

          #fhToolboxDrawer
          .fh-toolbox-grid{
            grid-template-columns:
              repeat(
                2,
                minmax(0,1fr)
              );
          }

          #fhToolboxDrawer
          .fh-toolbox-item{
            min-height:50px;
            font-size:14px!important;
          }

        }
        `
      );


    // =====================================================
    // 建立工具箱
    // =====================================================

    const dock =
      document.createElement(
        "div"
      );


    dock.id =
      "fhToolboxDock";


    const drawer =
      document.createElement(
        "aside"
      );


    drawer.id =
      "fhToolboxDrawer";


    drawer.setAttribute(
      "aria-hidden",
      "true"
    );


    drawer.innerHTML =
      `
      <div class="fh-toolbox-head">

        <strong>
          🧰 工具包收納盒
        </strong>

        <button
          type="button"
          data-toolbox-refresh>
          重新整理工具
        </button>

        <button
          type="button"
          data-toolbox-close
          title="收起">
          ×
        </button>

      </div>

      <div
        class="fh-toolbox-body">
      </div>

      <div class="fh-toolbox-foot">

        <button
          type="button"
          data-toolbox-search>
          🔍 節點搜尋
        </button>

        <button
          type="button"
          data-toolbox-show-originals>
          👁 顯示原按鈕
        </button>

      </div>
      `;


    const toggleButton =
      document.createElement(
        "button"
      );


    toggleButton.id =
      "fhToolboxButton";


    toggleButton.type =
      "button";


    toggleButton.innerHTML =
      `
      <span>
        🧰 工具箱
      </span>

      <span
        class="fh-toolbox-count">
        0
      </span>
      `;


    dock.append(
      drawer,
      toggleButton
    );


    document.body.appendChild(
      dock
    );


    const bodyBox =
      drawer.querySelector(
        ".fh-toolbox-body"
      );


    const countBox =
      toggleButton.querySelector(
        ".fh-toolbox-count"
      );


    // =====================================================
    // 共用工具
    // =====================================================

    function normalizedText(element){

      return String(
        element?.textContent || ""
      )
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    }


    function isToolboxElement(element){

      return Boolean(
        element &&
        (
          element === dock ||
          dock.contains(element)
        )
      );

    }


    function isProtectedCoreElement(element){

      if(!element){
        return true;
      }


      if(isToolboxElement(element)){

        return true;

      }


      /*
       * 不收納主程式 Header 核心按鈕。
       * 語言選單由 Widget 管理，不經過這裡。
       */
      if(
        element.closest(
          ".pixiv-editor-app > header"
        )
      ){

        return true;

      }


      /*
       * 不收納編輯器內部控制按鈕。
       */
      if(
        element.closest(
          "#editorFloat"
        ) ||
        element.closest(
          "#previewFloat"
        ) ||
        element.closest(
          "#multiSelectToolbar"
        ) ||
        element.closest(
          "#draw-toolbar"
        ) ||
        element.closest(
          "#fhToolboxDock"
        )
      ){

        return true;

      }


      return false;

    }


    function isElementVisible(element){

      if(
        !element ||
        !element.isConnected
      ){

        return false;

      }


      const style =
        getComputedStyle(
          element
        );


      return (
        style.display !== "none" &&
        style.visibility !== "hidden"
      );

    }


    function findFirstSelector(
      selectors
    ){

      for(const selector of selectors){

        const element =
          document.querySelector(
            selector
          );


        if(element){

          return element;

        }

      }


      return null;

    }


    // =====================================================
    // 一般原始入口
    // =====================================================

    function saveOriginalElement(element){

      if(
        !element ||
        originalRecords.has(
          element
        )
      ){

        return;

      }


      originalRecords.set(
        element,
        {

          display:
            element.style.display,

          visibility:
            element.style.visibility,

          hidden:
            element.hidden

        }
      );

    }


    function hideOriginalElement(element){

      if(
        !element ||
        isToolboxElement(element)
      ){

        return;

      }


      saveOriginalElement(
        element
      );


      if(
        !originalsTemporarilyVisible
      ){

        element.classList.add(
          "fh-toolbox-original-hidden"
        );

      }

    }


    function restoreOriginalElement(element){

      if(!element){
        return;
      }


      const record =
        originalRecords.get(
          element
        );


      element.classList.remove(
        "fh-toolbox-original-hidden"
      );


      if(!record){
        return;
      }


      element.style.display =
        record.display || "";


      element.style.visibility =
        record.visibility || "";


      element.hidden =
        record.hidden === true;

    }


    function activateOriginalElement(element){

      if(
        !element ||
        !element.isConnected
      ){

        api.toast(
          "原工具入口已不存在"
        );

        return false;

      }


      element.classList.remove(
        "fh-toolbox-original-hidden"
      );


      try{

        element.click();

      }catch(error){

        console.error(
          "[Firehaha Toolbox] 工具執行失敗",
          error
        );


        api.toast(
          "工具開啟失敗"
        );


        return false;

      }finally{

        queueMicrotask(
          function(){

            if(
              destroyed ||
              originalsTemporarilyVisible ||
              !element.isConnected
            ){

              return;

            }


            element.classList.add(
              "fh-toolbox-original-hidden"
            );

          }
        );

      }


      return true;

    }


    // =====================================================
    // 浮動工具列
    // =====================================================

    function saveToolbar(toolbar){

      if(
        !toolbar ||
        toolbarRecords.has(
          toolbar
        )
      ){

        return;

      }


      toolbarRecords.set(
        toolbar,
        {

          display:
            toolbar.style.display,

          visibility:
            toolbar.style.visibility,

          hidden:
            toolbar.hidden

        }
      );

    }


    function hideToolbar(toolbar){

      if(!toolbar){
        return;
      }


      saveToolbar(
        toolbar
      );


      if(
        !originalsTemporarilyVisible
      ){

        toolbar.classList.add(
          "fh-toolbox-original-hidden"
        );

      }

    }


    function restoreToolbar(toolbar){

      const record =
        toolbarRecords.get(
          toolbar
        );


      toolbar.classList.remove(
        "fh-toolbox-original-hidden"
      );


      if(!record){
        return;
      }


      toolbar.style.display =
        record.display || "";


      toolbar.style.visibility =
        record.visibility || "";


      toolbar.hidden =
        record.hidden === true;

    }


    // =====================================================
    // Widget：官方語言選單
    // =====================================================

    function getLanguageSwitcher(){

      const wrapper =
        document.querySelector(
          ".firehaha-language-switcher"
        );


      if(wrapper){

        return wrapper;

      }


      const select =
        document.querySelector(
          "[data-firehaha-language]"
        );


      if(!select){

        return null;

      }


      return (
        select.closest("label") ||
        select
      );

    }


    function saveWidgetPosition(element){

      if(
        !element ||
        widgetRecords.has(
          element
        )
      ){

        return;

      }


      widgetRecords.set(
        element,
        {

          parent:
            element.parentNode,

          nextSibling:
            element.nextSibling,

          display:
            element.style.display,

          visibility:
            element.style.visibility,

          hidden:
            element.hidden

        }
      );

    }


    function restoreWidget(element){

      if(!element){
        return false;
      }


      const record =
        widgetRecords.get(
          element
        );


      if(!record){
        return false;
      }


      element.style.display =
        record.display || "";


      element.style.visibility =
        record.visibility || "";


      element.hidden =
        record.hidden === true;


      const parent =
        record.parent;


      if(
        parent &&
        parent.isConnected
      ){

        if(
          record.nextSibling &&
          record.nextSibling.parentNode ===
            parent
        ){

          parent.insertBefore(
            element,
            record.nextSibling
          );

        }else{

          parent.appendChild(
            element
          );

        }


        return true;

      }


      document.body.appendChild(
        element
      );


      return true;

    }


    // =====================================================
    // 節點快速搜尋面板
    // =====================================================

    function getMiniMapPanel(){

      return document.getElementById(
        "mini-map-plugin"
      );

    }


    function savePanel(panel){

      if(
        !panel ||
        panelRecords.has(
          panel
        )
      ){

        return;

      }


      panelRecords.set(
        panel,
        {

          display:
            panel.style.display,

          visibility:
            panel.style.visibility,

          hidden:
            panel.hidden

        }
      );

    }


    function addMiniMapReturnButton(panel){

      if(
        !panel ||
        panel.querySelector(
          ".fh-toolbox-return-button"
        )
      ){

        return;

      }


      const header =
        panel.querySelector(
          "#mini-map-header"
        ) ||
        panel.querySelector(
          "header"
        ) ||
        panel.firstElementChild;


      if(!header){
        return;
      }


      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.className =
        "fh-toolbox-return-button";


      button.title =
        "收回工具箱";


      button.textContent =
        "×";


      button.addEventListener(
        "click",
        function(event){

          event.preventDefault();

          event.stopPropagation();


          storeMiniMapPanel();

        }
      );


      header.appendChild(
        button
      );

    }


    function storeMiniMapPanel(){

      const panel =
        getMiniMapPanel();


      if(!panel){
        return false;
      }


      savePanel(
        panel
      );


      miniMapOpenedByToolbox =
        false;


      panel.classList.add(
        "fh-toolbox-panel-stored"
      );


      panel.setAttribute(
        "aria-hidden",
        "true"
      );


      return true;

    }


    function openMiniMapPanel(){

      const panel =
        getMiniMapPanel();


      if(!panel){

        api.toast(
          "找不到節點快速搜尋面板"
        );

        return false;

      }


      savePanel(
        panel
      );


      addMiniMapReturnButton(
        panel
      );


      miniMapOpenedByToolbox =
        true;


      panel.classList.remove(
        "fh-toolbox-panel-stored"
      );


      panel.removeAttribute(
        "aria-hidden"
      );


      panel.classList.remove(
        "fh-toolbox-original-hidden"
      );


      panel.hidden =
        false;


      /*
       * 某些舊版面板由 inline display 控制。
       */
      if(
        getComputedStyle(panel)
          .display === "none"
      ){

        panel.style.display =
          "block";

      }


      return true;

    }


    function restorePanel(panel){

      if(!panel){
        return;
      }


      const record =
        panelRecords.get(
          panel
        );


      panel.classList.remove(
        "fh-toolbox-panel-stored"
      );


      panel.removeAttribute(
        "aria-hidden"
      );


      panel
        .querySelector(
          ".fh-toolbox-return-button"
        )
        ?.remove();


      if(!record){
        return;
      }


      panel.style.display =
        record.display || "";


      panel.style.visibility =
        record.visibility || "";


      panel.hidden =
        record.hidden === true;

    }


    // =====================================================
    // 一次性工具收集
    // =====================================================

    function matchTextDefinition(text){

      for(const definition of TEXT_DEFINITIONS){

        definition.pattern.lastIndex =
          0;


        if(
          definition.pattern.test(
            text
          )
        ){

          return definition;

        }

      }


      return null;

    }


    function collectKnownTools(
      results,
      seenElements
    ){

      TOOL_DEFINITIONS.forEach(
        definition => {

          const element =
            findFirstSelector(
              definition.selectors
            );


          if(
            !element ||
            isToolboxElement(element) ||
            seenElements.has(element)
          ){

            return;

          }


          seenElements.add(
            element
          );


          hideOriginalElement(
            element
          );


          results.push({

            key:
              "known:" +
              definition.label,

            type:
              "button",

            label:
              definition.label,

            icon:
              definition.icon,

            group:
              definition.group,

            original:
              element

          });

        }
      );

    }


    function collectFloatToolbarTools(
      results,
      seenElements
    ){

      const toolbar =
        document.getElementById(
          "gamebook-float-toolbar"
        );


      if(!toolbar){
        return;
      }


      saveToolbar(
        toolbar
      );


      const buttons =
        Array.from(
          toolbar.querySelectorAll(
            "button"
          )
        );


      buttons.forEach(
        (
          button,
          index
        ) => {

          if(
            seenElements.has(
              button
            )
          ){

            return;

          }


          seenElements.add(
            button
          );


          const originalText =
            normalizedText(
              button
            );


          const matched =
            matchTextDefinition(
              originalText
            );


          results.push({

            key:
              "toolbar:" +
              (
                button.id ||
                index
              ),

            type:
              "button",

            label:
              matched?.label ||
              originalText ||
              "創作工具",

            icon:
              matched?.icon ||
              originalText.slice(0,2) ||
              "🛠️",

            group:
              matched?.group ||
              "創作工具",

            original:
              button

          });

        }
      );


      hideToolbar(
        toolbar
      );

    }


    function collectTextMatchedTools(
      results,
      seenElements
    ){

      const candidates =
        Array.from(
          document.querySelectorAll(
            "body > button," +
            "body > div > button," +
            ".pixiv-editor-container > button"
          )
        );


      candidates.forEach(
        (
          button,
          index
        ) => {

          if(
            !button ||
            seenElements.has(button) ||
            isProtectedCoreElement(button) ||
            button.closest(
              "#gamebook-float-toolbar"
            )
          ){

            return;

          }


          const originalText =
            normalizedText(
              button
            );


          if(!originalText){
            return;
          }


          const matched =
            matchTextDefinition(
              originalText
            );


          if(!matched){
            return;
          }


          seenElements.add(
            button
          );


          hideOriginalElement(
            button
          );


          results.push({

            key:
              "text:" +
              (
                button.id ||
                originalText ||
                index
              ),

            type:
              "button",

            label:
              matched.label,

            icon:
              matched.icon,

            group:
              matched.group,

            original:
              button

          });

        }
      );

    }


    function collectLanguageWidget(
      results,
      seenElements
    ){

      const languageSwitcher =
        getLanguageSwitcher();


      if(
        !languageSwitcher ||
        seenElements.has(
          languageSwitcher
        )
      ){

        return;

      }


      seenElements.add(
        languageSwitcher
      );


      saveWidgetPosition(
        languageSwitcher
      );


      results.push({

        key:
          "widget:official-language",

        type:
          "widget",

        label:
          "多國語言",

        icon:
          "🌐",

        group:
          "系統工具",

        element:
          languageSwitcher

      });

    }


    function collectMiniMapTool(
      results,
      seenElements
    ){

      const panel =
        getMiniMapPanel();


      if(!panel){
        return;
      }


      if(
        !seenElements.has(
          panel
        )
      ){

        seenElements.add(
          panel
        );

      }


      savePanel(
        panel
      );


      addMiniMapReturnButton(
        panel
      );


      /*
       * 使用者正在外部使用時不收回；
       * 一般啟動時則收納。
       */
      if(!miniMapOpenedByToolbox){

        storeMiniMapPanel();

      }


      results.push({

        key:
          "panel:mini-map",

        type:
          "button",

        label:
          "節點快速搜尋",

        icon:
          "🔍",

        group:
          "專案工具",

        panel,

        run:
          openMiniMapPanel

      });

    }


    function discoverTools(){

      const results =
        [];


      const seenElements =
        new Set();


      collectKnownTools(
        results,
        seenElements
      );


      collectFloatToolbarTools(
        results,
        seenElements
      );


      collectTextMatchedTools(
        results,
        seenElements
      );


      collectLanguageWidget(
        results,
        seenElements
      );


      collectMiniMapTool(
        results,
        seenElements
      );


      const unique =
        new Map();


      results.forEach(tool => {

        if(!unique.has(tool.key)){

          unique.set(
            tool.key,
            tool
          );

        }

      });


      registeredTools =
        Array.from(
          unique.values()
        );


      return registeredTools;

    }


    // =====================================================
    // 工具箱內容繪製
    // =====================================================

    function groupRank(groupName){

      const index =
        GROUP_ORDER.indexOf(
          groupName
        );


      return index === -1
        ? GROUP_ORDER.length
        : index;

    }


    function renderButtonTool(
      tool,
      grid
    ){

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.className =
        "fh-toolbox-item";


      if(
        tool.panel &&
        isElementVisible(
          tool.panel
        ) &&
        !tool.panel.classList.contains(
          "fh-toolbox-panel-stored"
        )
      ){

        button.classList.add(
          "active"
        );

      }


      const icon =
        document.createElement(
          "span"
        );


      icon.className =
        "fh-toolbox-icon";


      icon.textContent =
        tool.icon ||
        "🛠️";


      const label =
        document.createElement(
          "span"
        );


      label.textContent =
        tool.label ||
        "工具";


      button.append(
        icon,
        label
      );


      button.addEventListener(
        "click",
        function(){

          closeDrawer();


          if(
            typeof tool.run ===
              "function"
          ){

            tool.run();

            return;

          }


          activateOriginalElement(
            tool.original
          );

        }
      );


      grid.appendChild(
        button
      );

    }


    function renderWidgetTool(
      tool,
      grid
    ){

      const element =
        tool.element;


      if(!element){
        return;
      }


      saveWidgetPosition(
        element
      );


      const card =
        document.createElement(
          "div"
        );


      card.className =
        "fh-toolbox-widget";


      const head =
        document.createElement(
          "div"
        );


      head.className =
        "fh-toolbox-widget-head";


      const icon =
        document.createElement(
          "span"
        );


      icon.className =
        "fh-toolbox-icon";


      icon.textContent =
        tool.icon ||
        "⚙️";


      const label =
        document.createElement(
          "span"
        );


      label.textContent =
        tool.label ||
        "工具設定";


      head.append(
        icon,
        label
      );


      const widgetBody =
        document.createElement(
          "div"
        );


      widgetBody.className =
        "fh-toolbox-widget-body";


      element.classList.remove(
        "fh-toolbox-original-hidden"
      );


      element.hidden =
        false;


      widgetBody.appendChild(
        element
      );


      card.append(
        head,
        widgetBody
      );


      grid.appendChild(
        card
      );

    }


    function renderRegisteredTools(){

      if(
        destroyed ||
        rendering
      ){

        return;
      }


      rendering =
        true;


      try{

        const groups =
          new Map();


        registeredTools.forEach(tool => {

          const group =
            tool.group ||
            "其他工具";


          if(!groups.has(group)){

            groups.set(
              group,
              []
            );

          }


          groups
            .get(group)
            .push(
              tool
            );

        });


        bodyBox.innerHTML =
          "";


        if(!registeredTools.length){

          bodyBox.innerHTML =
            `
            <div class="fh-toolbox-empty">
              目前沒有找到可收納的工具。
            </div>
            `;

        }else{

          const orderedGroups =
            Array.from(
              groups.entries()
            )
            .sort(
              (
                first,
                second
              ) => {

                return (
                  groupRank(
                    first[0]
                  ) -
                  groupRank(
                    second[0]
                  )
                );

              }
            );


          orderedGroups.forEach(
            (
              [
                groupName,
                groupTools
              ]
            ) => {

              const section =
                document.createElement(
                  "section"
                );


              section.className =
                "fh-toolbox-group";


              const title =
                document.createElement(
                  "h3"
                );


              title.className =
                "fh-toolbox-group-title";


              title.textContent =
                groupName;


              const grid =
                document.createElement(
                  "div"
                );


              grid.className =
                "fh-toolbox-grid";


              groupTools.forEach(tool => {

                if(
                  tool.type ===
                    "widget"
                ){

                  renderWidgetTool(
                    tool,
                    grid
                  );

                }else{

                  renderButtonTool(
                    tool,
                    grid
                  );

                }

              });


              section.append(
                title,
                grid
              );


              bodyBox.appendChild(
                section
              );

            }
          );

        }


        itemCount =
          registeredTools.length;


        countBox.textContent =
          String(
            itemCount
          );

      }finally{

        rendering =
          false;

      }

    }


    /*
     * 手動重新整理。
     *
     * 先恢復 Widget，避免清空工具箱時
     * 把真實語言選單一起刪除。
     */
    function refreshTools(){

      widgetRecords.forEach(
        (
          record,
          element
        ) => {

          restoreWidget(
            element
          );

        }
      );


      registeredTools =
        [];


      discoverTools();

      renderRegisteredTools();


      document.dispatchEvent(
    new CustomEvent(
        "firehaha:toolbox-ready"
    )
);


      return itemCount;

    }


    // =====================================================
    // 工具箱開關
    // =====================================================

    function openDrawer(){

      opened =
        true;


      drawer.classList.add(
        "open"
      );


      drawer.setAttribute(
        "aria-hidden",
        "false"
      );


      saveState();

    }


    function closeDrawer(){

      opened =
        false;


      drawer.classList.remove(
        "open"
      );


      drawer.setAttribute(
        "aria-hidden",
        "true"
      );


      saveState();

    }


    function toggleDrawer(){

      if(opened){

        closeDrawer();

      }else{

        openDrawer();

      }

    }


    // =====================================================
    // 暫時顯示原始浮動入口
    // =====================================================

    function showOriginalsTemporarily(){

      originalsTemporarilyVisible =
        true;


      clearTimeout(
        temporaryOriginalTimer
      );


      originalRecords.forEach(
        (
          record,
          element
        ) => {

          if(element.isConnected){

            restoreOriginalElement(
              element
            );

          }

        }
      );


      toolbarRecords.forEach(
        (
          record,
          toolbar
        ) => {

          if(toolbar.isConnected){

            restoreToolbar(
              toolbar
            );

          }

        }
      );


      api.toast(
        "原浮動按鈕顯示 8 秒"
      );


      temporaryOriginalTimer =
        setTimeout(
          function(){

            temporaryOriginalTimer =
              0;


            if(destroyed){
              return;
            }


            originalsTemporarilyVisible =
              false;


            originalRecords.forEach(
              (
                record,
                element
              ) => {

                if(element.isConnected){

                  element.classList.add(
                    "fh-toolbox-original-hidden"
                  );

                }

              }
            );


            toolbarRecords.forEach(
              (
                record,
                toolbar
              ) => {

                if(toolbar.isConnected){

                  toolbar.classList.add(
                    "fh-toolbox-original-hidden"
                  );

                }

              }
            );

          },
          ORIGINAL_BUTTON_VISIBLE_TIME
        );

    }


    // =====================================================
    // 事件
    // =====================================================

    toggleButton.addEventListener(
      "click",
      toggleDrawer
    );


    drawer
      .querySelector(
        "[data-toolbox-close]"
      )
      .addEventListener(
        "click",
        closeDrawer
      );


    drawer
      .querySelector(
        "[data-toolbox-refresh]"
      )
      .addEventListener(
        "click",
        function(){

          refreshTools();


          api.toast(
            "工具入口已重新整理"
          );

        }
      );


    drawer
      .querySelector(
        "[data-toolbox-search]"
      )
      .addEventListener(
        "click",
        function(){

          closeDrawer();

          openMiniMapPanel();

        }
      );


    drawer
      .querySelector(
        "[data-toolbox-show-originals]"
      )
      .addEventListener(
        "click",
        function(){

          closeDrawer();

          showOriginalsTemporarily();

        }
      );


    function onDocumentPointerDown(event){

      if(
        opened &&
        !dock.contains(
          event.target
        )
      ){

        closeDrawer();

      }

    }


    function onKeyDown(event){

      if(
        event.key ===
          "Escape"
      ){

        closeDrawer();

      }

    }


    document.addEventListener(
      "pointerdown",
      onDocumentPointerDown,
      true
    );


    document.addEventListener(
      "keydown",
      onKeyDown,
      true
    );


    // =====================================================
    // 公開 API
    // =====================================================

    const ToolboxOrganizer = {

      version:
        "2.0.0",


      open:
        openDrawer,


      close:
        closeDrawer,


      toggle:
        toggleDrawer,


      refresh:
        refreshTools,


      rescan:
        refreshTools,


      openSearch:
        openMiniMapPanel,


      storeSearch:
        storeMiniMapPanel,


      showOriginals:
        showOriginalsTemporarily,


      getStats(){

        const languageSwitcher =
          getLanguageSwitcher();


        const miniMap =
          getMiniMapPanel();


        return {

          version:
            "2.0.0",

          mode:
            "manual-only",

          automaticScan:
            false,

          mutationObserver:
            false,

          itemCount,

          opened,

          originalsTemporarilyVisible,

          adoptedOriginals:
            originalRecords.size,

          storedToolbars:
            toolbarRecords.size,

          storedPanels:
            panelRecords.size,

          storedWidgets:
            widgetRecords.size,

          languageWidgetFound:
            Boolean(
              languageSwitcher
            ),

          languageWidgetInsideToolbox:
            Boolean(
              languageSwitcher &&
              dock.contains(
                languageSwitcher
              )
            ),

          miniMapOpenedByToolbox,

          miniMapStored:
            Boolean(
              miniMap &&
              miniMap.classList.contains(
                "fh-toolbox-panel-stored"
              )
            )

        };

      }

    };


    window.FirehahaToolboxOrganizer =
      ToolboxOrganizer;


    // =====================================================
    // 啟動：只整理一次
    // =====================================================

    discoverTools();

    renderRegisteredTools();


document.dispatchEvent(
    new CustomEvent(
        "firehaha:toolbox-ready"
    )
);


    if(savedState.opened){

      openDrawer();

    }


    api.toast(
      "非掃描式工具包收納盒已啟用"
    );


    // =====================================================
    // Cleanup
    // =====================================================

    return function cleanup(){

      destroyed =
        true;


      clearTimeout(
        temporaryOriginalTimer
      );


      temporaryOriginalTimer =
        0;


      document.removeEventListener(
        "pointerdown",
        onDocumentPointerDown,
        true
      );


      document.removeEventListener(
        "keydown",
        onKeyDown,
        true
      );
 
       


      /*
       * 必須先還原真實 Widget，
       * 再刪除工具箱 DOM。
       */
      widgetRecords.forEach(
        (
          record,
          element
        ) => {

          restoreWidget(
            element
          );

        }
      );


      originalRecords.forEach(
        (
          record,
          element
        ) => {

          if(element.isConnected){

            restoreOriginalElement(
              element
            );

          }

        }
      );


      toolbarRecords.forEach(
        (
          record,
          toolbar
        ) => {

          if(toolbar.isConnected){

            restoreToolbar(
              toolbar
            );

          }

        }
      );


      panelRecords.forEach(
        (
          record,
          panel
        ) => {

          if(panel.isConnected){

            restorePanel(
              panel
            );

          }

        }
      );


      dock.remove();

      removeStyle();


      if(
        window
          .FirehahaToolboxOrganizer ===
        ToolboxOrganizer
      ){

        delete window
          .FirehahaToolboxOrganizer;

      }

    };

  }

});