// @firehaha-plugin {"id":"official.system-settings","name":"系統設定","version":"1.1.0","author":"Firehaha","description":"提供安全重啟工作區、工具箱定位、設定備份與基本系統資訊。"}

FirehahaPlugins.register({

  id:
    "official.system-settings",

  name:
    "系統設定",

  version:
    "1.1.0",


  async setup(api){

    "use strict";


    // =====================================================
    // 基本設定
    // =====================================================

    const STORAGE_KEY =
      "FirehahaSystemSettings_V1";


    const DEFAULT_SETTINGS = {

      transitionPage:
        "./firehaha-restart.html",

      transitionDelay:
        1500,

      saveBeforeRestart:
        true,

      confirmBeforeRestart:
        true,

      toolboxPosition:
        "left-bottom",

      rememberPanelPosition:
        true,

      panelLeft:
        null,

      panelTop:
        null

    };


    const TOOLBOX_POSITIONS = [
      "left-bottom",
      "right-bottom",
      "left-top",
      "right-top"
    ];


    let destroyed =
      false;


    let dragState =
      null;


    let settings =
      loadSettings();


    // =====================================================
    // 設定資料
    // =====================================================

    function normalizeSettings(value){

      const source =
        value &&
        typeof value === "object"
          ? value
          : {};


      const delay =
        Number(
          source.transitionDelay
        );


      return {

        transitionPage:
          String(
            source.transitionPage ||
            DEFAULT_SETTINGS.transitionPage
          ),

        transitionDelay:
          Math.max(
            300,
            Math.min(
              10000,
              Number.isFinite(delay)
                ? delay
                : DEFAULT_SETTINGS.transitionDelay
            )
          ),

        saveBeforeRestart:
          source.saveBeforeRestart !==
            false,

        confirmBeforeRestart:
          source.confirmBeforeRestart !==
            false,

        toolboxPosition:
          TOOLBOX_POSITIONS.includes(
            source.toolboxPosition
          )
            ? source.toolboxPosition
            : DEFAULT_SETTINGS.toolboxPosition,

        rememberPanelPosition:
          source.rememberPanelPosition !==
            false,

        panelLeft:
          typeof source.panelLeft ===
            "string"
            ? source.panelLeft
            : null,

        panelTop:
          typeof source.panelTop ===
            "string"
            ? source.panelTop
            : null

      };

    }


    function loadSettings(){

      try{

        const raw =
          localStorage.getItem(
            STORAGE_KEY
          );


        if(!raw){

          return normalizeSettings(
            DEFAULT_SETTINGS
          );

        }


        return normalizeSettings(
          JSON.parse(raw)
        );

      }catch(error){

        console.warn(
          "[System Settings] 設定讀取失敗",
          error
        );


        return normalizeSettings(
          DEFAULT_SETTINGS
        );

      }

    }


    function saveSettings(){

      try{

        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(
            settings
          )
        );


        return true;

      }catch(error){

        console.warn(
          "[System Settings] 設定儲存失敗",
          error
        );


        return false;

      }

    }


    // =====================================================
    // 樣式
    // =====================================================

    const removeStyle =
      api.addStyle(
        "system-settings-v1-1",
        `
        #firehaha-system-settings-button{
          cursor:pointer;
        }

        #fhSystemSettingsPanel{
          position:fixed;
          left:50%;
          top:50%;
          z-index:2147483000;
          display:none;
          width:min(620px,calc(100vw - 28px));
          max-height:min(760px,calc(100vh - 28px));
          overflow:hidden;
          border:1px solid rgba(46,70,95,.22);
          border-radius:17px;
          background:#f9fbfd;
          color:#27394c;
          box-shadow:0 24px 80px rgba(20,38,58,.38);
          transform:translate(-50%,-50%);
          font-family:
            system-ui,
            -apple-system,
            "Segoe UI",
            "Noto Sans TC",
            sans-serif;
        }

        #fhSystemSettingsPanel.open{
          display:grid;
          grid-template-rows:
            auto
            minmax(0,1fr)
            auto;
        }

        #fhSystemSettingsPanel
        .fh-settings-header{
          display:flex;
          align-items:center;
          gap:8px;
          padding:12px 14px;
          border-bottom:1px solid #dbe4ed;
          background:#edf3f8;
          cursor:move;
          user-select:none;
          touch-action:none;
        }

        #fhSystemSettingsPanel
        .fh-settings-header strong{
          margin-right:auto;
          font-size:15px;
        }

        #fhSystemSettingsPanel
        .fh-settings-close{
          width:34px;
          height:34px;
          padding:0!important;
          border:1px solid #c7d3df!important;
          border-radius:9px!important;
          background:#fff!important;
          color:#3b5066!important;
          font-size:18px!important;
          box-shadow:none!important;
          transform:none!important;
        }

        #fhSystemSettingsPanel
        .fh-settings-body{
          overflow:auto;
          padding:14px;
        }

        #fhSystemSettingsPanel
        .fh-settings-section{
          margin-bottom:14px;
          padding:13px;
          border:1px solid #dce4ec;
          border-radius:13px;
          background:#fff;
        }

        #fhSystemSettingsPanel
        .fh-settings-section:last-child{
          margin-bottom:0;
        }

        #fhSystemSettingsPanel h3{
          margin:0 0 11px;
          font-size:14px;
        }

        #fhSystemSettingsPanel
        .fh-setting-row{
          display:grid;
          grid-template-columns:
            minmax(150px,210px)
            minmax(0,1fr);
          align-items:center;
          gap:10px;
          margin-bottom:10px;
        }

        #fhSystemSettingsPanel
        .fh-setting-row:last-child{
          margin-bottom:0;
        }

        #fhSystemSettingsPanel label{
          font-size:13px;
          font-weight:750;
        }

        #fhSystemSettingsPanel
        input[type="text"],
        #fhSystemSettingsPanel
        input[type="number"],
        #fhSystemSettingsPanel
        select{
          width:100%;
          min-height:38px;
          padding:7px 10px;
          border:1px solid #c8d4df;
          border-radius:9px;
          background:#fff;
          color:#26394c;
          font:650 13px/1.3
            system-ui,
            sans-serif;
        }

        #fhSystemSettingsPanel
        .fh-check-row{
          display:flex;
          align-items:center;
          gap:9px;
          margin:9px 0;
          font-size:13px;
          font-weight:700;
        }

        #fhSystemSettingsPanel
        .fh-check-row input{
          width:18px;
          height:18px;
        }

        #fhSystemSettingsPanel
        .fh-settings-actions{
          display:flex;
          flex-wrap:wrap;
          gap:8px;
        }

        #fhSystemSettingsPanel button{
          min-height:38px;
          padding:7px 12px!important;
          border:1px solid #c6d2dd!important;
          border-radius:9px!important;
          background:#fff!important;
          color:#324a61!important;
          font-size:13px!important;
          font-weight:750!important;
          box-shadow:none!important;
          transform:none!important;
          cursor:pointer;
        }

        #fhSystemSettingsPanel
        button.primary{
          border-color:#315f8e!important;
          background:#315f8e!important;
          color:#fff!important;
        }

        #fhSystemSettingsPanel
        button.danger{
          border-color:#cb7777!important;
          color:#a43838!important;
        }

        #fhSystemSettingsPanel
        .fh-system-info{
          display:grid;
          grid-template-columns:
            repeat(2,minmax(0,1fr));
          gap:8px;
        }

        #fhSystemSettingsPanel
        .fh-system-info div{
          padding:9px;
          border-radius:9px;
          background:#edf3f8;
          font-size:12px;
        }

        #fhSystemSettingsPanel
        .fh-system-info strong{
          display:block;
          margin-bottom:3px;
          font-size:11px;
          color:#738294;
        }

        #fhSystemSettingsPanel
        .fh-settings-footer{
          display:flex;
          justify-content:flex-end;
          gap:8px;
          padding:11px 14px;
          border-top:1px solid #dbe4ed;
          background:#f1f5f8;
        }

        .fh-system-settings-hidden-input{
          display:none!important;
        }

        @media(max-width:650px){

          #fhSystemSettingsPanel{
            left:8px!important;
            right:8px!important;
            top:8px!important;
            bottom:8px!important;
            width:auto;
            max-height:none;
            transform:none!important;
          }

          #fhSystemSettingsPanel
          .fh-setting-row{
            grid-template-columns:1fr;
            gap:5px;
          }

          #fhSystemSettingsPanel
          .fh-system-info{
            grid-template-columns:1fr;
          }

        }
        `
      );


    // =====================================================
    // 建立入口
    // =====================================================

    const settingsButton =
      document.createElement(
        "button"
      );


    settingsButton.id =
      "firehaha-system-settings-button";


    settingsButton.type =
      "button";


    settingsButton.dataset.tool =
      "system-settings";


    settingsButton.textContent =
      "⚙️ 系統設定";


    const floatToolbar =
      document.getElementById(
        "gamebook-float-toolbar"
      );


    if(floatToolbar){

      floatToolbar.appendChild(
        settingsButton
      );

    }else{

      settingsButton.style.position =
        "fixed";


      settingsButton.style.right =
        "16px";


      settingsButton.style.bottom =
        "16px";


      settingsButton.style.zIndex =
        "2147482000";


      document.body.appendChild(
        settingsButton
      );

    }


    // =====================================================
    // 建立面板
    // =====================================================

    const panel =
      document.createElement(
        "section"
      );


    panel.id =
      "fhSystemSettingsPanel";


    panel.setAttribute(
      "aria-hidden",
      "true"
    );


    panel.innerHTML =
      `
      <div class="fh-settings-header">

        <strong>
          ⚙️ Firehaha 系統設定
        </strong>

        <button
          type="button"
          class="fh-settings-close"
          data-settings-close>
          ×
        </button>

      </div>

      <div class="fh-settings-body">

        <section class="fh-settings-section">

          <h3>
            🔄 工作區重新啟動
          </h3>

          <div class="fh-setting-row">

            <label>
              過渡頁位置
            </label>

            <input
              type="text"
              data-setting-transition-page
            >

          </div>

          <div class="fh-setting-row">

            <label>
              過渡時間（毫秒）
            </label>

            <input
              type="number"
              min="300"
              max="10000"
              step="100"
              data-setting-transition-delay
            >

          </div>

          <label class="fh-check-row">

            <input
              type="checkbox"
              data-setting-save-before-restart
            >

            重新啟動前嘗試保存目前專案

          </label>

          <label class="fh-check-row">

            <input
              type="checkbox"
              data-setting-confirm-restart
            >

            重新啟動前顯示確認訊息

          </label>

          <div class="fh-settings-actions">

            <button
              type="button"
              class="primary"
              data-action-safe-restart>
              安全重啟工作區
            </button>

            <button
              type="button"
              data-action-normal-reload>
              一般重新整理
            </button>

          </div>

        </section>

        <section class="fh-settings-section">

          <h3>
            🧰 工具箱與介面
          </h3>

          <div class="fh-setting-row">

            <label>
              工具箱位置
            </label>

            <select
              data-setting-toolbox-position>

              <option value="left-bottom">
                左下角
              </option>

              <option value="right-bottom">
                右下角
              </option>

              <option value="left-top">
                左上角
              </option>

              <option value="right-top">
                右上角
              </option>

            </select>

          </div>

          <label class="fh-check-row">

            <input
              type="checkbox"
              data-setting-remember-position
            >

            記住系統設定視窗位置

          </label>

          <div class="fh-settings-actions">

            <button
              type="button"
              data-action-center-panel>
              設定視窗置中
            </button>

          </div>

        </section>

        <section class="fh-settings-section">

          <h3>
            🧾 系統資訊
          </h3>

          <div
            class="fh-system-info"
            data-system-info>
          </div>

        </section>

        <section class="fh-settings-section">

          <h3>
            💾 設定備份
          </h3>

          <div class="fh-settings-actions">

            <button
              type="button"
              data-action-export-settings>
              匯出設定
            </button>

            <button
              type="button"
              data-action-import-settings>
              匯入設定
            </button>

            <button
              type="button"
              class="danger"
              data-action-reset-settings>
              重設系統設定
            </button>

          </div>

        </section>

      </div>

      <div class="fh-settings-footer">

        <button
          type="button"
          data-settings-close>
          關閉
        </button>

        <button
          type="button"
          class="primary"
          data-action-save-settings>
          儲存設定
        </button>

      </div>
      `;


    const importInput =
      document.createElement(
        "input"
      );


    importInput.type =
      "file";


    importInput.accept =
      ".json,application/json";


    importInput.className =
      "fh-system-settings-hidden-input";


    document.body.append(
      panel,
      importInput
    );


    // =====================================================
    // DOM 欄位
    // =====================================================

    const header =
      panel.querySelector(
        ".fh-settings-header"
      );


    const transitionPageInput =
      panel.querySelector(
        "[data-setting-transition-page]"
      );


    const transitionDelayInput =
      panel.querySelector(
        "[data-setting-transition-delay]"
      );


    const saveBeforeRestartInput =
      panel.querySelector(
        "[data-setting-save-before-restart]"
      );


    const confirmRestartInput =
      panel.querySelector(
        "[data-setting-confirm-restart]"
      );


    const toolboxPositionInput =
      panel.querySelector(
        "[data-setting-toolbox-position]"
      );


    const rememberPositionInput =
      panel.querySelector(
        "[data-setting-remember-position]"
      );


    const systemInfoBox =
      panel.querySelector(
        "[data-system-info]"
      );


    // =====================================================
    // 欄位同步
    // =====================================================

    function fillFields(){

      transitionPageInput.value =
        settings.transitionPage;


      transitionDelayInput.value =
        settings.transitionDelay;


      saveBeforeRestartInput.checked =
        settings.saveBeforeRestart;


      confirmRestartInput.checked =
        settings.confirmBeforeRestart;


      toolboxPositionInput.value =
        settings.toolboxPosition;


      rememberPositionInput.checked =
        settings.rememberPanelPosition;

    }


    function readFields(){

      settings =
        normalizeSettings({

          ...settings,

          transitionPage:
            transitionPageInput.value,

          transitionDelay:
            transitionDelayInput.value,

          saveBeforeRestart:
            saveBeforeRestartInput.checked,

          confirmBeforeRestart:
            confirmRestartInput.checked,

          toolboxPosition:
            toolboxPositionInput.value,

          rememberPanelPosition:
            rememberPositionInput.checked

        });


      return settings;

    }


    // =====================================================
    // 工具箱定位
    // =====================================================

    function setDockPosition(
      dock,
      left,
      top,
      right,
      bottom
    ){

      dock.style.setProperty(
        "left",
        left,
        "important"
      );


      dock.style.setProperty(
        "top",
        top,
        "important"
      );


      dock.style.setProperty(
        "right",
        right,
        "important"
      );


      dock.style.setProperty(
        "bottom",
        bottom,
        "important"
      );

    }


    function applyToolboxPosition(){

      const dock =
        document.getElementById(
          "fhToolboxDock"
        );


      if(!dock){

        console.warn(
          "[System Settings] 工具箱尚未建立"
        );


        return false;

      }


      switch(
        settings.toolboxPosition
      ){

        case "right-bottom":

          setDockPosition(
            dock,
            "auto",
            "auto",
            "14px",
            "14px"
          );

          break;


        case "left-top":

          setDockPosition(
            dock,
            "14px",
            "14px",
            "auto",
            "auto"
          );

          break;


        case "right-top":

          setDockPosition(
            dock,
            "auto",
            "14px",
            "14px",
            "auto"
          );

          break;


        default:

          setDockPosition(
            dock,
            "14px",
            "auto",
            "auto",
            "14px"
          );

      }


      document.dispatchEvent(
        new CustomEvent(
          "firehaha:toolbox-position-applied",
          {
            detail:{
              position:
                settings.toolboxPosition
            }
          }
        )
      );


      return true;

    }


    function onToolboxReady(){

      applyToolboxPosition();

    }


    function onToolboxPositionChanged(){

      readFields();

      saveSettings();

      applyToolboxPosition();

    }


    // =====================================================
    // 系統資訊
    // =====================================================

    function approximateStorageSize(){

      let characters =
        0;


      try{

        for(
          let index = 0;
          index < localStorage.length;
          index++
        ){

          const key =
            localStorage.key(
              index
            );


          const value =
            localStorage.getItem(
              key
            );


          characters +=
            String(key || "").length +
            String(value || "").length;

        }

      }catch(error){}


      return Math.round(
        characters *
        2 /
        1024
      );

    }


    function refreshSystemInfo(){

      const pages =
        window.GamebookCore?.pages;


      const nodeCount =
        Array.isArray(pages)
          ? pages.length
          : 0;


      const pluginCount =
        document.querySelectorAll(
          'script[data-firehaha-bundled]'
        ).length;


      const toolboxStats =
        window
          .FirehahaToolboxOrganizer
          ?.getStats?.();


      systemInfoBox.innerHTML =
        `
        <div>
          <strong>Node 數量</strong>
          ${nodeCount}
        </div>

        <div>
          <strong>官方外掛引用</strong>
          ${pluginCount}
        </div>

        <div>
          <strong>工具箱模式</strong>
          ${
            toolboxStats?.mode ||
            "尚未載入"
          }
        </div>

        <div>
          <strong>工具箱位置</strong>
          ${settings.toolboxPosition}
        </div>

        <div>
          <strong>本機儲存估計</strong>
          ${approximateStorageSize()} KB
        </div>

        <div>
          <strong>系統設定版本</strong>
          1.1.0
        </div>
        `;

    }


    // =====================================================
    // 面板開關
    // =====================================================

    function openPanel(){

      fillFields();

      refreshSystemInfo();


      panel.classList.add(
        "open"
      );


      panel.setAttribute(
        "aria-hidden",
        "false"
      );


      if(
        settings.rememberPanelPosition &&
        settings.panelLeft &&
        settings.panelTop &&
        innerWidth > 650
      ){

        panel.style.left =
          settings.panelLeft;


        panel.style.top =
          settings.panelTop;


        panel.style.transform =
          "none";

      }

    }


    function closePanel(){

      panel.classList.remove(
        "open"
      );


      panel.setAttribute(
        "aria-hidden",
        "true"
      );

    }


    function centerPanel(){

      panel.style.left =
        "50%";


      panel.style.top =
        "50%";


      panel.style.transform =
        "translate(-50%,-50%)";


      settings.panelLeft =
        null;


      settings.panelTop =
        null;


      saveSettings();

    }


    // =====================================================
    // 面板拖曳
    // =====================================================

    function onHeaderPointerDown(event){

      if(
        event.button !== 0 ||
        event.target.closest("button") ||
        innerWidth <= 650
      ){

        return;

      }


      const rect =
        panel.getBoundingClientRect();


      dragState = {

        pointerId:
          event.pointerId,

        offsetX:
          event.clientX -
          rect.left,

        offsetY:
          event.clientY -
          rect.top

      };


      panel.style.transform =
        "none";


      header.setPointerCapture?.(
        event.pointerId
      );


      event.preventDefault();

    }


    function onHeaderPointerMove(event){

      if(
        !dragState ||
        event.pointerId !==
          dragState.pointerId
      ){

        return;

      }


      const maxLeft =
        Math.max(
          8,
          innerWidth -
          panel.offsetWidth -
          8
        );


      const maxTop =
        Math.max(
          8,
          innerHeight -
          panel.offsetHeight -
          8
        );


      const left =
        Math.max(
          8,
          Math.min(
            maxLeft,
            event.clientX -
            dragState.offsetX
          )
        );


      const top =
        Math.max(
          8,
          Math.min(
            maxTop,
            event.clientY -
            dragState.offsetY
          )
        );


      panel.style.left =
        left +
        "px";


      panel.style.top =
        top +
        "px";

    }


    function onHeaderPointerUp(event){

      if(
        !dragState ||
        event.pointerId !==
          dragState.pointerId
      ){

        return;

      }


      dragState =
        null;


      if(
        settings.rememberPanelPosition
      ){

        settings.panelLeft =
          panel.style.left;


        settings.panelTop =
          panel.style.top;


        saveSettings();

      }

    }


    // =====================================================
    // 安全重啟
    // =====================================================

    async function attemptSaveProject(){

      if(
        !settings.saveBeforeRestart
      ){

        return true;

      }


      const saveButton =
        document.getElementById(
          "saveProject"
        );


      if(!saveButton){

        console.warn(
          "[System Settings] 找不到保存專案按鈕"
        );


        return false;

      }


      try{

        saveButton.click();


        await new Promise(
          resolve => {

            setTimeout(
              resolve,
              350
            );

          }
        );


        return true;

      }catch(error){

        console.warn(
          "[System Settings] 保存嘗試失敗",
          error
        );


        return false;

      }

    }


    function buildTransitionUrl(){

      const transition =
        new URL(
          settings.transitionPage,
          location.href
        );


      transition.searchParams.set(
        "return",
        location.href
      );


      transition.searchParams.set(
        "delay",
        String(
          settings.transitionDelay
        )
      );


      return transition.href;

    }


    async function safeRestart(){

      readFields();

      saveSettings();


      if(
        settings.confirmBeforeRestart
      ){

        const approved =
          confirm(
            "即將保存目前工作並透過過渡頁重新建立工作區。\n\n是否繼續？"
          );


        if(!approved){
          return;
        }

      }


      document.dispatchEvent(
        new CustomEvent(
          "firehaha:before-workspace-restart",
          {
            detail:{
              time:
                Date.now()
            }
          }
        )
      );


      await attemptSaveProject();


      try{

        sessionStorage.setItem(
          "FirehahaWorkspaceRestart",
          JSON.stringify({

            time:
              Date.now(),

            returnUrl:
              location.href

          })
        );

      }catch(error){}


      location.replace(
        buildTransitionUrl()
      );

    }


    // =====================================================
    // 設定匯出入
    // =====================================================

    function downloadText(
      name,
      text
    ){

      const blob =
        new Blob(
          [text],
          {
            type:
              "application/json;charset=utf-8"
          }
        );


      const url =
        URL.createObjectURL(
          blob
        );


      const anchor =
        document.createElement(
          "a"
        );


      anchor.href =
        url;


      anchor.download =
        name;


      anchor.click();


      setTimeout(
        function(){

          URL.revokeObjectURL(
            url
          );

        },
        1000
      );

    }


    function exportSettings(){

      readFields();

      saveSettings();


      downloadText(
        "firehaha-system-settings.json",
        JSON.stringify(
          {
            format:
              "FirehahaSystemSettings",

            version:
              "1.1.0",

            settings
          },
          null,
          2
        )
      );

    }


    function importSettingsFile(file){

      const reader =
        new FileReader();


      reader.onload =
        function(){

          try{

            const parsed =
              JSON.parse(
                String(
                  reader.result || ""
                )
              );


            settings =
              normalizeSettings(
                parsed.settings ||
                parsed
              );


            saveSettings();

            fillFields();

            applyToolboxPosition();

            refreshSystemInfo();


            api.toast(
              "系統設定已匯入"
            );

          }catch(error){

            console.error(
              "[System Settings] 匯入失敗",
              error
            );


            alert(
              "設定檔格式錯誤"
            );

          }

        };


      reader.readAsText(
        file,
        "UTF-8"
      );

    }


    function resetSettings(){

      const approved =
        confirm(
          "只會重設系統設定，不會刪除作品或專案。\n\n是否繼續？"
        );


      if(!approved){
        return;
      }


      settings =
        normalizeSettings(
          DEFAULT_SETTINGS
        );


      saveSettings();

      fillFields();

      centerPanel();

      applyToolboxPosition();

      refreshSystemInfo();


      api.toast(
        "系統設定已重設"
      );

    }


    // =====================================================
    // 一般儲存
    // =====================================================

    function saveCurrentSettings(){

      readFields();

      saveSettings();

      applyToolboxPosition();

      refreshSystemInfo();


      api.toast(
        "系統設定已儲存"
      );

    }


    // =====================================================
    // 事件安裝
    // =====================================================

    settingsButton.addEventListener(
      "click",
      openPanel
    );


    panel
      .querySelectorAll(
        "[data-settings-close]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            closePanel
          );

        }
      );


    panel
      .querySelector(
        "[data-action-save-settings]"
      )
      .addEventListener(
        "click",
        saveCurrentSettings
      );


    panel
      .querySelector(
        "[data-action-safe-restart]"
      )
      .addEventListener(
        "click",
        safeRestart
      );


    panel
      .querySelector(
        "[data-action-normal-reload]"
      )
      .addEventListener(
        "click",
        function(){

          readFields();

          saveSettings();


          if(
            !settings.confirmBeforeRestart ||
            confirm(
              "確定直接重新整理目前頁面？"
            )
          ){

            location.reload();

          }

        }
      );


    panel
      .querySelector(
        "[data-action-center-panel]"
      )
      .addEventListener(
        "click",
        centerPanel
      );


    panel
      .querySelector(
        "[data-action-export-settings]"
      )
      .addEventListener(
        "click",
        exportSettings
      );


    panel
      .querySelector(
        "[data-action-import-settings]"
      )
      .addEventListener(
        "click",
        function(){

          importInput.click();

        }
      );


    panel
      .querySelector(
        "[data-action-reset-settings]"
      )
      .addEventListener(
        "click",
        resetSettings
      );


    toolboxPositionInput.addEventListener(
      "change",
      onToolboxPositionChanged
    );


    importInput.addEventListener(
      "change",
      function(){

        const file =
          importInput.files?.[0];


        if(file){

          importSettingsFile(
            file
          );

        }


        importInput.value =
          "";

      }
    );


    header.addEventListener(
      "pointerdown",
      onHeaderPointerDown
    );


    header.addEventListener(
      "pointermove",
      onHeaderPointerMove
    );


    header.addEventListener(
      "pointerup",
      onHeaderPointerUp
    );


    header.addEventListener(
      "pointercancel",
      onHeaderPointerUp
    );


    /*
     * 系統設定先載入、工具箱後載入。
     * 工具箱建立完成後會送出這個事件。
     */
    document.addEventListener(
      "firehaha:toolbox-ready",
      onToolboxReady
    );


    // =====================================================
    // 公開 API
    // =====================================================

    const SystemSettings = {

      version:
        "1.1.0",


      open:
        openPanel,


      close:
        closePanel,


      restart:
        safeRestart,


      save:
        saveCurrentSettings,


      applyToolboxPosition,


      getSettings(){

        return {
          ...settings
        };

      },


      setToolboxPosition(position){

        if(
          !TOOLBOX_POSITIONS.includes(
            position
          )
        ){

          return false;

        }


        settings.toolboxPosition =
          position;


        toolboxPositionInput.value =
          position;


        saveSettings();


        return applyToolboxPosition();

      },


      getStats(){

        return {

          version:
            "1.1.0",

          transitionPage:
            settings.transitionPage,

          transitionDelay:
            settings.transitionDelay,

          saveBeforeRestart:
            settings.saveBeforeRestart,

          toolboxPosition:
            settings.toolboxPosition,

          toolboxFound:
            Boolean(
              document.getElementById(
                "fhToolboxDock"
              )
            ),

          panelOpen:
            panel.classList.contains(
              "open"
            )

        };

      }

    };


    window.FirehahaSystemSettings =
      SystemSettings;


    // =====================================================
    // 啟動
    // =====================================================

    fillFields();


    /*
     * 如果工具箱已經先存在，也立即套用一次。
     * 如果尚未存在，就等待 toolbox-ready。
     */
    applyToolboxPosition();


    api.toast(
      "系統設定 1.1 已啟用"
    );


    // =====================================================
    // Cleanup
    // =====================================================

    return function cleanup(){

      destroyed =
        true;


      document.removeEventListener(
        "firehaha:toolbox-ready",
        onToolboxReady
      );


      toolboxPositionInput.removeEventListener(
        "change",
        onToolboxPositionChanged
      );


      header.removeEventListener(
        "pointerdown",
        onHeaderPointerDown
      );


      header.removeEventListener(
        "pointermove",
        onHeaderPointerMove
      );


      header.removeEventListener(
        "pointerup",
        onHeaderPointerUp
      );


      header.removeEventListener(
        "pointercancel",
        onHeaderPointerUp
      );


      settingsButton.remove();

      panel.remove();

      importInput.remove();

      removeStyle();


      if(
        window.FirehahaSystemSettings ===
        SystemSettings
      ){

        delete window
          .FirehahaSystemSettings;

      }

    };

  }

});