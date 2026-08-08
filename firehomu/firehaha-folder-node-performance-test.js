// @firehaha-plugin {"id":"test.folder-node-performance-v3","name":"高效能收納型資料夾 Node V3","version":"3.0.0","author":"Firehaha","description":"重新設計的收納型資料夾 Node。支援命名、拖入、冷凍卸載、資料夾視窗、移出 Node 與安全刪除資料夾。只管理工作區顯示，不修改故事正文與閱讀資料。"}

FirehahaPlugins.register({

  id:
    "test.folder-node-performance-v3",

  name:
    "高效能收納型資料夾 Node V3",

  version:
    "3.0.0",


  async setup(api){

    "use strict";


    // =====================================================
    // 基本設定
    // =====================================================

    const READY_TIMEOUT =
      15000;


    /*
     * 繼續使用 V2 的存檔欄位名稱，
     * 舊專案不需要轉換。
     */
    const FEATURE_KEY =
      "folderNodes";


    const STORE_KEY =
      "__FirehahaFolderStoreV3";


    const DEFAULT_FROZEN =
      true;


    const CARD_WIDTH =
      180;


    const CARD_HEIGHT =
      78;


    const CARD_GAP_X =
      24;


    const CARD_GAP_Y =
      22;


    // =====================================================
    // 等待主程式
    // =====================================================

    const waitStartedAt =
      Date.now();


    while(
      (
        !window.GamebookCore ||
        !window.ProjectDataCenter
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


    if(!window.ProjectDataCenter){

      throw new Error(
        "找不到 ProjectDataCenter"
      );

    }


    const core =
      window.GamebookCore;


    const flowCanvas =
      core.elements?.flowCanvas ||
      document.getElementById(
        "flowCanvas"
      );


    const flowPanel =
      core.elements?.flowPanel ||
      document.getElementById(
        "flowPanel"
      );


    if(
      !flowCanvas ||
      !flowPanel
    ){

      throw new Error(
        "找不到流程畫布"
      );

    }


    // =====================================================
    // 永久 Store
    // =====================================================

    const store =
      window[STORE_KEY] ||
      (
        window[STORE_KEY] = {

          version:
            3,

          registered:
            false,

          folders:
            [],

          controller:
            null

        }
      );


    let folders =
      store.folders;


    let destroyed =
      false;


    let openedFolderId =
      null;


    let drawQueued =
      false;


    let draggedPage =
      null;


    let draggedPointerId =
      null;


    let lastPointerX =
      0;


    let lastPointerY =
      0;


    let menuState =
      null;


    const folderElements =
      new Map();


    const cleanupFunctions =
      [];


    // =====================================================
    // 共用工具
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
        "[Folder V3]",
        message
      );

    }


    function makeId(){

      if(
        window.crypto &&
        typeof crypto.randomUUID ===
          "function"
      ){

        return (
          "folder_" +
          crypto.randomUUID()
        );

      }


      return (
        "folder_" +
        Date.now().toString(36) +
        "_" +
        Math.random()
          .toString(36)
          .slice(2, 10)
      );

    }


    function clone(value){

      try{

        return structuredClone(
          value
        );

      }catch(error){

        return JSON.parse(
          JSON.stringify(value)
        );

      }

    }


    function numberOr(
      value,
      fallback
    ){

      const number =
        Number(value);


      return Number.isFinite(
        number
      )
        ? number
        : fallback;

    }


    function positive(
      value,
      fallback
    ){

      return Math.max(
        0,
        numberOr(
          value,
          fallback
        )
      );

    }


    function getPage(pageId){

      const id =
        String(
          pageId || ""
        );


      if(
        typeof core.getPageById ===
          "function"
      ){

        return core.getPageById(
          id
        );

      }


      return core.pages.find(
        page =>
          String(page?.id) === id
      ) || null;

    }


    function getCurrentPage(){

      return (
        core.currentPage ||
        window.getGamebookCurrentPage?.() ||
        null
      );

    }


    function getFolder(folderId){

      return folders.find(
        folder =>
          folder.id === folderId
      ) || null;

    }


    function getFolderForPage(
      pageId
    ){

      const id =
        String(pageId);


      return folders.find(
        folder => {

          return folder.nodes.some(
            entry =>
              entry.pageId === id
          );

        }
      ) || null;

    }


    function getFolderEntry(
      folder,
      pageId
    ){

      if(!folder){
        return null;
      }


      const id =
        String(pageId);


      return folder.nodes.find(
        entry =>
          entry.pageId === id
      ) || null;

    }


    function isPageDomConnected(
      page
    ){

      return Boolean(
        page?.element &&
        page.element.isConnected &&
        page.element.parentElement ===
          flowCanvas
      );

    }


    function markWorkspaceChanged(
      reason,
      detail
    ){

      try{

        if(
          typeof window.markDirty ===
            "function"
        ){

          window.markDirty();

        }

      }catch(error){}


      try{

        core.emit?.(
          "project:changed",
          {

            reason:
              reason ||
              "folder-v3",

            folderOnly:
              true,

            ...(detail || {})

          }
        );

      }catch(error){}

    }


    function requestDraw(){

      if(
        destroyed ||
        drawQueued ||
        document.hidden
      ){

        return;
      }


      drawQueued =
        true;


      requestAnimationFrame(
        () => {

          drawQueued =
            false;


          if(destroyed){
            return;
          }


          try{

            if(
              window.FirehahaPerformanceManager &&
              typeof window
                .FirehahaPerformanceManager
                .requestLines ===
                "function"
            ){

              window
                .FirehahaPerformanceManager
                .requestLines();

            }else{

              core.drawLines?.();

            }

          }catch(error){

            console.warn(
              "[Folder V3] 重畫失敗",
              error
            );

          }

        }
      );

    }


    // =====================================================
    // 資料正規化與舊版相容
    // =====================================================

    function normalizeFolders(){

      const existingPageIds =
        new Set(
          core.pages.map(
            page =>
              String(page.id)
          )
        );


      const assignedPageIds =
        new Set();


      folders =
        (
          Array.isArray(folders)
            ? folders
            : []
        )
          .filter(
            folder =>
              folder &&
              folder.id
          )
          .map(folder => {

            const normalized = {

              id:
                String(folder.id),

              name:
                String(
                  folder.name ||
                  "未命名資料夾"
                )
                  .trim() ||
                "未命名資料夾",

              x:
                positive(
                  folder.x,
                  240
                ),

              y:
                positive(
                  folder.y,
                  180
                ),

              frozen:
                typeof folder.frozen ===
                  "boolean"
                  ? folder.frozen
                  : DEFAULT_FROZEN,

              nodes:
                []

            };


            const sourceNodes =
              Array.isArray(
                folder.nodes
              )
                ? folder.nodes
                : [];


            sourceNodes.forEach(
              (
                entry,
                index
              ) => {

                if(!entry){
                  return;
                }


                const pageId =
                  String(
                    entry.pageId ||
                    entry.id ||
                    ""
                  );


                if(
                  !pageId ||
                  !existingPageIds.has(
                    pageId
                  ) ||
                  assignedPageIds.has(
                    pageId
                  )
                ){

                  return;
                }


                assignedPageIds.add(
                  pageId
                );


                normalized.nodes.push({

                  pageId,

                  mainX:
                    positive(
                      entry.mainX,
                      100
                    ),

                  mainY:
                    positive(
                      entry.mainY,
                      100
                    ),

                  innerX:
                    Math.max(
                      10,
                      numberOr(
                        entry.innerX,
                        24 +
                        (
                          index % 3
                        ) *
                        (
                          CARD_WIDTH +
                          CARD_GAP_X
                        )
                      )
                    ),

                  innerY:
                    Math.max(
                      10,
                      numberOr(
                        entry.innerY,
                        24 +
                        Math.floor(
                          index / 3
                        ) *
                        (
                          CARD_HEIGHT +
                          CARD_GAP_Y
                        )
                      )
                    )

                });

              }
            );


            return normalized;

          });


      store.folders =
        folders;

    }


    // =====================================================
    // Node DOM 生命週期
    // =====================================================

    function removePageDom(page){

      if(!page){
        return;
      }


      try{

        page.element?.remove();

      }catch(error){}


      /*
       * 清掉 DOM 引用，
       * 讓事件和元素可被垃圾回收。
       */
      page.element =
        null;

    }


    function hidePageDom(page){

      if(
        !page ||
        !page.element
      ){

        return;
      }


      page.element.style.display =
        "none";


      page.element.dataset
        .fhFolderStored =
        "1";

    }


    function ensurePageDom(page){

      if(!page){
        return null;
      }


      if(
        !isPageDomConnected(
          page
        )
      ){

        page.element =
          null;


        core.createFlowNode?.(
          page
        );

      }


      if(page.element){

        page.element.style.display =
          "";


        page.element.style.left =
          page.x + "px";


        page.element.style.top =
          page.y + "px";


        delete page.element.dataset
          .fhFolderStored;

      }


      return page.element;

    }


    function storePageVisual(
      folder,
      entry
    ){

      const page =
        getPage(
          entry.pageId
        );


      if(!page){
        return;
      }


      /*
       * 讓既有連線端點聚集在資料夾位置。
       */
      page.x =
        folder.x;


      page.y =
        folder.y;


      if(folder.frozen){

        removePageDom(
          page
        );

      }else{

        hidePageDom(
          page
        );

      }

    }


    function releasePageVisual(
      page,
      x,
      y
    ){

      if(!page){
        return;
      }


      page.x =
        positive(
          x,
          100
        );


      page.y =
        positive(
          y,
          100
        );


      ensurePageDom(
        page
      );

    }


    function applyVisualState(){

      normalizeFolders();


      const storedIds =
        new Set();


      folders.forEach(
        folder => {

          folder.nodes.forEach(
            entry => {

              storedIds.add(
                entry.pageId
              );

            }
          );

        }
      );


      core.pages.forEach(
        page => {

          if(
            storedIds.has(
              String(page.id)
            )
          ){

            return;
          }


          if(page.element){

            page.element.style.display =
              "";


            delete page.element.dataset
              .fhFolderStored;

          }

        }
      );


      folders.forEach(
        folder => {

          folder.nodes.forEach(
            entry => {

              storePageVisual(
                folder,
                entry
              );

            }
          );

        }
      );


      requestDraw();

    }


    function restoreAllPageVisuals(){

      folders.forEach(
        folder => {

          folder.nodes.forEach(
            entry => {

              const page =
                getPage(
                  entry.pageId
                );


              releasePageVisual(
                page,
                entry.mainX,
                entry.mainY
              );

            }
          );

        }
      );


      requestDraw();

    }


    // =====================================================
    // 資料夾統計
    // =====================================================

    function getFolderStats(folder){

      const internalIds =
        new Set(
          folder.nodes.map(
            entry =>
              entry.pageId
          )
        );


      let characterCount =
        0;


      let entryLinks =
        0;


      let exitLinks =
        0;


      folder.nodes.forEach(
        entry => {

          const page =
            getPage(
              entry.pageId
            );


          characterCount +=
            String(
              page?.text ||
              ""
            ).length;

        }
      );


      core.pages.forEach(
        page => {

          const sourceInside =
            internalIds.has(
              String(page.id)
            );


          const options =
            Array.isArray(
              page.options
            )
              ? page.options
              : [];


          options.forEach(
            option => {

              const targetId =
                String(
                  option?.target ||
                  ""
                );


              if(!targetId){
                return;
              }


              const targetInside =
                internalIds.has(
                  targetId
                );


              if(
                !sourceInside &&
                targetInside
              ){

                entryLinks++;

              }


              if(
                sourceInside &&
                !targetInside
              ){

                exitLinks++;

              }

            }
          );

        }
      );


      return {

        nodeCount:
          folder.nodes.length,

        characterCount,

        entryLinks,

        exitLinks

      };

    }


    // =====================================================
    // 建立資料夾
    // =====================================================

    function createFolder(
      name,
      x,
      y
    ){

      const folder = {

        id:
          makeId(),

        name:
          String(
            name ||
            "新資料夾"
          )
            .trim() ||
          "新資料夾",

        x:
          positive(
            x,
            240
          ),

        y:
          positive(
            y,
            180
          ),

        frozen:
          DEFAULT_FROZEN,

        nodes:
          []

      };


      folders.push(
        folder
      );


      store.folders =
        folders;


      renderFolderNode(
        folder
      );


      markWorkspaceChanged(
        "folder-created",
        {
          folderId:
            folder.id
        }
      );


      return folder;

    }


    // =====================================================
    // 重新命名
    // =====================================================

    function renameFolder(folder){

      if(!folder){
        return;
      }


      const value =
        prompt(
          "請輸入資料夾名稱：",
          folder.name
        );


      if(value == null){
        return;
      }


      const name =
        String(value)
          .trim();


      if(!name){
        return;
      }


      folder.name =
        name;


      updateFolderNode(
        folder
      );


      if(
        openedFolderId ===
          folder.id
      ){

        renderFolderWindow(
          folder
        );

      }


      markWorkspaceChanged(
        "folder-renamed",
        {
          folderId:
            folder.id
        }
      );

    }


    // =====================================================
    // 切換冷凍
    // =====================================================

    function setFolderFrozen(
      folder,
      frozen
    ){

      if(!folder){
        return false;
      }


      const next =
        Boolean(frozen);


      if(
        folder.frozen ===
          next
      ){

        return true;
      }


      folder.frozen =
        next;


      folder.nodes.forEach(
        entry => {

          storePageVisual(
            folder,
            entry
          );

        }
      );


      updateFolderNode(
        folder
      );


      if(
        openedFolderId ===
          folder.id
      ){

        renderFolderWindow(
          folder
        );

      }


      markWorkspaceChanged(
        next
          ? "folder-frozen"
          : "folder-unfrozen",
        {
          folderId:
            folder.id
        }
      );


      requestDraw();


      toast(
        next
          ? `「${folder.name}」已進入高效能冷凍模式`
          : `「${folder.name}」已切換為普通收納`
      );


      return true;

    }


    // =====================================================
    // 刪除資料夾
    // =====================================================

    function deleteFolder(folder){

      if(!folder){
        return false;
      }


      closeFolderMenu();


      const confirmed =
        confirm(
          `確定刪除資料夾「${folder.name}」？\n\n` +
          `資料夾內的 ${folder.nodes.length} 個 Node 不會被刪除，` +
          `會全部移回主畫布。`
        );


      if(!confirmed){
        return false;
      }


      const entries =
        [
          ...folder.nodes
        ];


      const baseX =
        folder.x + 230;


      const baseY =
        folder.y;


      /*
       * 先恢復所有 Node。
       */
      entries.forEach(
        (
          entry,
          index
        ) => {

          const page =
            getPage(
              entry.pageId
            );


          const column =
            index % 3;


          const row =
            Math.floor(
              index / 3
            );


          releasePageVisual(
            page,
            baseX +
            column * 210,
            baseY +
            row * 110
          );

        }
      );


      /*
       * 清空資料夾內容，
       * 避免之後還被視為已收納。
       */
      folder.nodes =
        [];


      folders =
        folders.filter(
          item =>
            item.id !== folder.id
        );


      store.folders =
        folders;


      folderElements
        .get(folder.id)
        ?.remove();


      folderElements.delete(
        folder.id
      );


      if(
        openedFolderId ===
          folder.id
      ){

        closeFolderWindow();

      }


      markWorkspaceChanged(
        "folder-deleted",
        {
          folderId:
            folder.id
        }
      );


      requestDraw();


      toast(
        `已刪除資料夾「${folder.name}」，Node 已移回主畫布`
      );


      return true;

    }


    // =====================================================
    // 冷凍目前頁面前先切換
    // =====================================================

    function findSafePageToSelect(
      excludedPage
    ){

      return core.pages.find(
        candidate => {

          if(
            !candidate ||
            candidate ===
              excludedPage
          ){

            return false;
          }


          return !getFolderForPage(
            String(candidate.id)
          );

        }
      ) || null;

    }


    function leaveCurrentPageBeforeStore(
      page
    ){

      if(
        getCurrentPage() !==
          page
      ){

        return true;
      }


      const replacement =
        findSafePageToSelect(
          page
        );


      if(!replacement){

        alert(
          "目前沒有其他可切換的 Node。\n" +
          "請先建立或移出另一個 Node，再收納目前頁面。"
        );


        return false;
      }


      /*
       * 先保存目前輸入框內容。
       */
      try{

        const textInput =
          document.getElementById(
            "pageText"
          );


        const titleInput =
          document.getElementById(
            "pageTitle"
          );


        const noteInput =
          document.getElementById(
            "pageNote"
          );


        if(textInput){

          page.text =
            String(
              textInput.value ||
              ""
            );

        }


        if(titleInput){

          page.title =
            String(
              titleInput.value ||
              ""
            );

        }


        if(noteInput){

          page.note =
            String(
              noteInput.value ||
              ""
            );

        }

      }catch(error){

        console.warn(
          "[Folder V3] 收納前同步頁面失敗",
          error
        );

      }


      core.selectPage?.(
        replacement
      );


      return true;

    }


    // =====================================================
    // 收入 Node
    // =====================================================

    function assignPageToFolder(
      page,
      folder
    ){

      if(
        !page ||
        !folder
      ){

        return false;
      }


      const pageId =
        String(page.id);


      const oldFolder =
        getFolderForPage(
          pageId
        );


      if(
        oldFolder &&
        oldFolder.id ===
          folder.id
      ){

        return false;
      }


      if(
        !leaveCurrentPageBeforeStore(
          page
        )
      ){

        return false;
      }


      /*
       * 保存主畫布原座標。
       *
       * 如果是從另一個資料夾轉移，
       * 使用舊資料夾保存的 mainX/mainY。
       */
      let mainX =
        positive(
          page.x,
          100
        );


      let mainY =
        positive(
          page.y,
          100
        );


      if(oldFolder){

        const oldEntry =
          getFolderEntry(
            oldFolder,
            pageId
          );


        if(oldEntry){

          mainX =
            oldEntry.mainX;


          mainY =
            oldEntry.mainY;

        }


        oldFolder.nodes =
          oldFolder.nodes.filter(
            entry =>
              entry.pageId !==
                pageId
          );


        updateFolderNode(
          oldFolder
        );


        if(
          openedFolderId ===
            oldFolder.id
        ){

          renderFolderWindow(
            oldFolder
          );

        }

      }


      const index =
        folder.nodes.length;


      const entry = {

        pageId,

        mainX,

        mainY,

        innerX:
          24 +
          (
            index % 3
          ) *
          (
            CARD_WIDTH +
            CARD_GAP_X
          ),

        innerY:
          24 +
          Math.floor(
            index / 3
          ) *
          (
            CARD_HEIGHT +
            CARD_GAP_Y
          )

      };


      folder.nodes.push(
        entry
      );


      storePageVisual(
        folder,
        entry
      );


      updateFolderNode(
        folder
      );


      if(
        openedFolderId ===
          folder.id
      ){

        renderFolderWindow(
          folder
        );

      }


      markWorkspaceChanged(
        "page-stored",
        {

          pageId,

          folderId:
            folder.id

        }
      );


      requestDraw();


      toast(
        `已將「${page.title || "未命名 Node"}」收入「${folder.name}」`
      );


      return true;

    }


    // =====================================================
    // 移出 Node
    // =====================================================

    function releasePageFromFolder(
      pageId,
      options
    ){

      const settings =
        Object.assign(
          {

            x:
              null,

            y:
              null,

            select:
              false

          },
          options || {}
        );


      const id =
        String(pageId);


      const folder =
        getFolderForPage(
          id
        );


      if(!folder){
        return false;
      }


      const entry =
        getFolderEntry(
          folder,
          id
        );


      const page =
        getPage(
          id
        );


      if(
        !entry ||
        !page
      ){

        folder.nodes =
          folder.nodes.filter(
            item =>
              item.pageId !== id
          );


        updateFolderNode(
          folder
        );


        return false;
      }


      folder.nodes =
        folder.nodes.filter(
          item =>
            item !== entry
        );


      const x =
        Number.isFinite(
          Number(settings.x)
        )
          ? Number(settings.x)
          : entry.mainX;


      const y =
        Number.isFinite(
          Number(settings.y)
        )
          ? Number(settings.y)
          : entry.mainY;


      releasePageVisual(
        page,
        x,
        y
      );


      updateFolderNode(
        folder
      );


      if(
        openedFolderId ===
          folder.id
      ){

        renderFolderWindow(
          folder
        );

      }


      if(settings.select){

        core.selectPage?.(
          page
        );

      }


      markWorkspaceChanged(
        "page-released",
        {

          pageId:
            id,

          folderId:
            folder.id

        }
      );


      requestDraw();


      toast(
        `已將「${page.title || "未命名 Node"}」移回主畫布`
      );


      return true;

    }


    // =====================================================
    // 畫布座標換算
    // =====================================================

    function clientToCanvas(
      clientX,
      clientY
    ){

      const rect =
        flowPanel
          .getBoundingClientRect();


      const scale =
        Number(
          window.__flowCanvasScale
        ) || 1;


      return {

        x:
          Math.max(
            0,
            (
              clientX -
              rect.left +
              flowPanel.scrollLeft
            ) / scale
          ),

        y:
          Math.max(
            0,
            (
              clientY -
              rect.top +
              flowPanel.scrollTop
            ) / scale
          )

      };

    }


    // =====================================================
    // 資料夾 Node UI
    // =====================================================

    function updateFolderNode(
      folder
    ){

      const element =
        folderElements.get(
          folder.id
        );


      if(!element){
        return;
      }


      const stats =
        getFolderStats(
          folder
        );


      element.style.left =
        folder.x + "px";


      element.style.top =
        folder.y + "px";


      element.classList.toggle(
        "is-frozen",
        folder.frozen
      );


      const icon =
        element.querySelector(
          ".fhv3-folder-icon"
        );


      const name =
        element.querySelector(
          ".fhv3-folder-name"
        );


      const count =
        element.querySelector(
          ".fhv3-folder-count"
        );


      const mode =
        element.querySelector(
          ".fhv3-folder-mode"
        );


      if(icon){

        icon.textContent =
          folder.frozen
            ? "❄️"
            : "📁";

      }


      if(name){

        name.textContent =
          folder.name;

      }


      if(count){

        count.textContent =
          `${stats.nodeCount} 個 Node・` +
          `${stats.characterCount.toLocaleString()} 字`;

      }


      if(mode){

        mode.textContent =
          folder.frozen
            ? "高效能冷凍"
            : "普通收納";

      }


      element.title =
        [
          folder.name,

          `${stats.nodeCount} 個 Node`,

          `${stats.characterCount.toLocaleString()} 字`,

          `入口 ${stats.entryLinks} 條`,

          `出口 ${stats.exitLinks} 條`

        ].join("\n");

    }


    function renderFolderNode(
      folder
    ){

      folderElements
        .get(folder.id)
        ?.remove();


      const element =
        document.createElement(
          "section"
        );


      element.className =
        "fhv3-folder-node";


      element.dataset.folderId =
        folder.id;


      element.innerHTML = `
        <div
          class="fhv3-folder-icon"
          aria-hidden="true"
        ></div>

        <div class="fhv3-folder-body">

          <div class="fhv3-folder-name"></div>

          <div class="fhv3-folder-count"></div>

          <div class="fhv3-folder-mode"></div>

        </div>

        <button
          type="button"
          class="fhv3-folder-menu-button"
          title="資料夾操作"
          aria-label="資料夾操作"
        >
          ⋮
        </button>
      `;


      flowCanvas.appendChild(
        element
      );


      folderElements.set(
        folder.id,
        element
      );


      updateFolderNode(
        folder
      );


      let startClientX =
        0;


      let startClientY =
        0;


      let startFolderX =
        0;


      let startFolderY =
        0;


      let moved =
        false;


      function onMove(event){

        if(
          event.pointerId !==
            element.__pointerId
        ){

          return;
        }


        const scale =
          Number(
            window.__flowCanvasScale
          ) || 1;


        const dx =
          (
            event.clientX -
            startClientX
          ) / scale;


        const dy =
          (
            event.clientY -
            startClientY
          ) / scale;


        if(
          Math.abs(dx) > 3 ||
          Math.abs(dy) > 3
        ){

          moved =
            true;

        }


        folder.x =
          Math.max(
            0,
            startFolderX + dx
          );


        folder.y =
          Math.max(
            0,
            startFolderY + dy
          );


        folder.nodes.forEach(
          entry => {

            const page =
              getPage(
                entry.pageId
              );


            if(page){

              page.x =
                folder.x;


              page.y =
                folder.y;

            }

          }
        );


        updateFolderNode(
          folder
        );


        requestDraw();

      }


      function finishDrag(event){

        if(
          event.pointerId !==
            element.__pointerId
        ){

          return;
        }


        try{

          element.releasePointerCapture(
            event.pointerId
          );

        }catch(error){}


        element.__pointerId =
          null;


        element.classList.remove(
          "is-dragging"
        );


        element.removeEventListener(
          "pointermove",
          onMove
        );


        element.removeEventListener(
          "pointerup",
          finishDrag
        );


        element.removeEventListener(
          "pointercancel",
          finishDrag
        );


        if(moved){

          markWorkspaceChanged(
            "folder-moved",
            {
              folderId:
                folder.id
            }
          );


          requestDraw();

        }else{

          openFolderWindow(
            folder
          );

        }

      }


      element.addEventListener(
        "pointerdown",
        event => {

          if(
            event.target.closest(
              ".fhv3-folder-menu-button"
            )
          ){

            return;
          }


          event.preventDefault();

          event.stopPropagation();


          closeFolderMenu();


          startClientX =
            event.clientX;


          startClientY =
            event.clientY;


          startFolderX =
            folder.x;


          startFolderY =
            folder.y;


          moved =
            false;


          element.__pointerId =
            event.pointerId;


          element.setPointerCapture(
            event.pointerId
          );


          element.classList.add(
            "is-dragging"
          );


          element.addEventListener(
            "pointermove",
            onMove
          );


          element.addEventListener(
            "pointerup",
            finishDrag
          );


          element.addEventListener(
            "pointercancel",
            finishDrag
          );

        }
      );


      element.addEventListener(
        "dblclick",
        event => {

          event.preventDefault();

          event.stopPropagation();


          renameFolder(
            folder
          );

        }
      );


      const menuButton =
        element.querySelector(
          ".fhv3-folder-menu-button"
        );


      menuButton.addEventListener(
        "pointerdown",
        event => {

          /*
           * 阻止畫布或其他捕獲事件介入。
           */
          event.stopPropagation();

        }
      );


      menuButton.addEventListener(
        "click",
        event => {

          event.preventDefault();

          event.stopPropagation();


          toggleFolderMenu(
            folder,
            menuButton
          );

        }
      );

    }


    function renderAllFolders(){

      folderElements.forEach(
        element => {

          element.remove();

        }
      );


      folderElements.clear();


      folders.forEach(
        renderFolderNode
      );

    }


    // =====================================================
    // V3 選單
    // =====================================================

    function closeFolderMenu(){

      if(!menuState){
        return;
      }


      try{

        document.removeEventListener(
          "pointerdown",
          menuState.outsideHandler,
          true
        );

      }catch(error){}


      try{

        window.removeEventListener(
          "resize",
          menuState.closeHandler
        );

      }catch(error){}


      try{

        flowPanel.removeEventListener(
          "scroll",
          menuState.closeHandler
        );

      }catch(error){}


      menuState.element?.remove();


      menuState =
        null;

    }


    function toggleFolderMenu(
      folder,
      anchor
    ){

      if(
        menuState &&
        menuState.folderId ===
          folder.id
      ){

        closeFolderMenu();

        return;
      }


      openFolderMenu(
        folder,
        anchor
      );

    }


    function openFolderMenu(
      folder,
      anchor
    ){

      closeFolderMenu();


      const menu =
        document.createElement(
          "div"
        );


      menu.className =
        "fhv3-folder-menu";


      menu.setAttribute(
        "role",
        "menu"
      );


      menu.innerHTML = `
        <button
          type="button"
          data-action="open"
        >
          📂 開啟資料夾
        </button>

        <button
          type="button"
          data-action="rename"
        >
          ✏️ 重新命名
        </button>

        <button
          type="button"
          data-action="toggle-freeze"
        >
          ${
            folder.frozen
              ? "📁 改成普通收納"
              : "❄️ 啟用高效能冷凍"
          }
        </button>

        <button
          type="button"
          data-action="delete"
          class="is-danger"
        >
          🗑️ 刪除資料夾
        </button>
      `;


      document.body.appendChild(
        menu
      );


      const rect =
        anchor
          .getBoundingClientRect();


      const menuRect =
        menu
          .getBoundingClientRect();


      const left =
        Math.max(
          8,
          Math.min(
            rect.right -
              menuRect.width,
            window.innerWidth -
              menuRect.width -
              8
          )
        );


      const top =
        Math.max(
          8,
          Math.min(
            rect.bottom + 6,
            window.innerHeight -
              menuRect.height -
              8
          )
        );


      menu.style.left =
        left + "px";


      menu.style.top =
        top + "px";


      /*
       * 使用 pointerup 而非 click，
       * 避免外層 pointerdown 先把選單移除。
       */
      menu.addEventListener(
        "pointerup",
        event => {

          const button =
            event.target.closest(
              "button[data-action]"
            );


          if(!button){
            return;
          }


          event.preventDefault();

          event.stopPropagation();


          const action =
            button.dataset.action;


          /*
           * 先關閉選單，再執行指令。
           * action 已經先保存，不會消失。
           */
          closeFolderMenu();


          switch(action){

            case "open":

              openFolderWindow(
                folder
              );

              break;


            case "rename":

              renameFolder(
                folder
              );

              break;


            case "toggle-freeze":

              setFolderFrozen(
                folder,
                !folder.frozen
              );

              break;


            case "delete":

              deleteFolder(
                folder
              );

              break;

          }

        }
      );


      const outsideHandler =
        event => {

          if(
            menu.contains(
              event.target
            ) ||
            anchor.contains(
              event.target
            )
          ){

            return;
          }


          closeFolderMenu();

        };


      const closeHandler =
        () => {

          closeFolderMenu();

        };


      menuState = {

        folderId:
          folder.id,

        element:
          menu,

        anchor,

        outsideHandler,

        closeHandler

      };


      /*
       * 延遲安裝外部監聽，
       * 避免開啟選單的同一個事件立刻把它關掉。
       */
      setTimeout(
        () => {

          if(
            !menuState ||
            menuState.element !==
              menu
          ){

            return;
          }


          document.addEventListener(
            "pointerdown",
            outsideHandler,
            true
          );


          window.addEventListener(
            "resize",
            closeHandler
          );


          flowPanel.addEventListener(
            "scroll",
            closeHandler,
            {
              passive:
                true
            }
          );

        },
        0
      );

    }


    // =====================================================
    // 資料夾視窗
    // =====================================================

    const overlay =
      document.createElement(
        "div"
      );


    overlay.id =
      "fhv3-folder-overlay";


    overlay.innerHTML = `
      <div
        id="fhv3-folder-window"
        role="dialog"
        aria-modal="true"
      >

        <header class="fhv3-window-header">

          <div class="fhv3-window-heading">

            <span
              class="fhv3-window-icon"
              aria-hidden="true"
            >
              📁
            </span>

            <div class="fhv3-window-heading-text">

              <strong
                class="fhv3-window-title"
              >
                資料夾
              </strong>

              <div
                class="fhv3-window-summary"
              ></div>

            </div>

          </div>

          <div class="fhv3-window-actions">

            <button
              type="button"
              data-window-action="freeze"
            >
              冷凍
            </button>

            <button
              type="button"
              data-window-action="rename"
            >
              重新命名
            </button>

            <button
              type="button"
              data-window-action="delete"
              class="is-danger"
            >
              刪除資料夾
            </button>

            <button
              type="button"
              data-window-action="close"
            >
              關閉
            </button>

          </div>

        </header>

        <div class="fhv3-window-notice"></div>

        <div class="fhv3-workspace"></div>

      </div>
    `;


    document.body.appendChild(
      overlay
    );


    cleanupFunctions.push(
      () => {

        overlay.remove();

      }
    );


    const workspace =
      overlay.querySelector(
        ".fhv3-workspace"
      );


    function closeFolderWindow(){

      openedFolderId =
        null;


      overlay.classList.remove(
        "open"
      );


      workspace.replaceChildren();

    }


    function openFolderWindow(folder){

      if(!folder){
        return;
      }


      closeFolderMenu();


      openedFolderId =
        folder.id;


      overlay.classList.add(
        "open"
      );


      renderFolderWindow(
        folder
      );

    }


    function renderFolderWindow(folder){

      if(
        !folder ||
        openedFolderId !==
          folder.id
      ){

        return;
      }


      const stats =
        getFolderStats(
          folder
        );


      const title =
        overlay.querySelector(
          ".fhv3-window-title"
        );


      const summary =
        overlay.querySelector(
          ".fhv3-window-summary"
        );


      const icon =
        overlay.querySelector(
          ".fhv3-window-icon"
        );


      const notice =
        overlay.querySelector(
          ".fhv3-window-notice"
        );


      const freezeButton =
        overlay.querySelector(
          '[data-window-action="freeze"]'
        );


      title.textContent =
        folder.name;


      summary.textContent =
        `${stats.nodeCount} 個 Node・` +
        `${stats.characterCount.toLocaleString()} 字・` +
        `入口 ${stats.entryLinks}・` +
        `出口 ${stats.exitLinks}`;


      icon.textContent =
        folder.frozen
          ? "❄️"
          : "📁";


      notice.textContent =
        folder.frozen
          ? "高效能冷凍中：真正的流程 Node DOM 已卸載。此視窗只顯示輕量索引卡。"
          : "普通收納中：流程 Node DOM 保留，但在主畫布隱藏。";


      freezeButton.textContent =
        folder.frozen
          ? "📁 普通收納"
          : "❄️ 高效能冷凍";


      workspace.replaceChildren();


      if(!folder.nodes.length){

        const empty =
          document.createElement(
            "div"
          );


        empty.className =
          "fhv3-empty";


        empty.textContent =
          "這個資料夾目前沒有 Node。\n" +
          "把主畫布上的 Node 拖到資料夾即可收納。";


        workspace.appendChild(
          empty
        );


        return;
      }


      folder.nodes.forEach(
        entry => {

          const page =
            getPage(
              entry.pageId
            );


          if(!page){
            return;
          }


          const card =
            document.createElement(
              "article"
            );


          card.className =
            "fhv3-page-card";


          card.dataset.pageId =
            String(page.id);


          card.style.left =
            entry.innerX + "px";


          card.style.top =
            entry.innerY + "px";


          const pageNumber =
            core.getPageNumber?.(
              page
            ) ||
            core.pages.indexOf(
              page
            ) + 1;


          card.innerHTML = `
            <span
              class="fhv3-page-number"
            ></span>

            <div
              class="fhv3-page-title"
            ></div>

            <div
              class="fhv3-page-meta"
            ></div>

            <button
              type="button"
              class="fhv3-page-release"
              title="移回主畫布"
            >
              ↗
            </button>
          `;


          card.querySelector(
            ".fhv3-page-number"
          ).textContent =
            `第 ${pageNumber} 頁`;


          card.querySelector(
            ".fhv3-page-title"
          ).textContent =
            page.title ||
            "未命名 Node";


          card.querySelector(
            ".fhv3-page-meta"
          ).textContent =
            `${String(page.text || "").length.toLocaleString()} 字・` +
            `${Array.isArray(page.options) ? page.options.length : 0} 個選項`;


          workspace.appendChild(
            card
          );


          makeFolderCardDraggable(
            card,
            folder,
            entry,
            page
          );


          card.querySelector(
            ".fhv3-page-release"
          ).addEventListener(
            "click",
            event => {

              event.preventDefault();

              event.stopPropagation();


              const index =
                folder.nodes.indexOf(
                  entry
                );


              releasePageFromFolder(
                page.id,
                {

                  x:
                    folder.x + 230,

                  y:
                    folder.y +
                    Math.max(
                      0,
                      index
                    ) * 90

                }
              );

            }
          );

        }
      );

    }


    function makeFolderCardDraggable(
      card,
      folder,
      entry,
      page
    ){

      let startClientX =
        0;


      let startClientY =
        0;


      let startInnerX =
        0;


      let startInnerY =
        0;


      let moved =
        false;


      function onMove(event){

        if(
          event.pointerId !==
            card.__pointerId
        ){

          return;
        }


        const dx =
          event.clientX -
          startClientX;


        const dy =
          event.clientY -
          startClientY;


        if(
          Math.abs(dx) > 4 ||
          Math.abs(dy) > 4
        ){

          moved =
            true;

        }


        entry.innerX =
          Math.max(
            10,
            startInnerX + dx
          );


        entry.innerY =
          Math.max(
            10,
            startInnerY + dy
          );


        card.style.left =
          entry.innerX + "px";


        card.style.top =
          entry.innerY + "px";

      }


      function finish(event){

        if(
          event.pointerId !==
            card.__pointerId
        ){

          return;
        }


        try{

          card.releasePointerCapture(
            event.pointerId
          );

        }catch(error){}


        card.__pointerId =
          null;


        card.classList.remove(
          "is-dragging"
        );


        card.removeEventListener(
          "pointermove",
          onMove
        );


        card.removeEventListener(
          "pointerup",
          finish
        );


        card.removeEventListener(
          "pointercancel",
          finish
        );


        const workspaceRect =
          workspace
            .getBoundingClientRect();


        const outside =
          (
            event.clientX <
              workspaceRect.left ||

            event.clientX >
              workspaceRect.right ||

            event.clientY <
              workspaceRect.top ||

            event.clientY >
              workspaceRect.bottom
          );


        if(
          moved &&
          outside
        ){

          const panelRect =
            flowPanel
              .getBoundingClientRect();


          const overFlowPanel =
            (
              event.clientX >=
                panelRect.left &&

              event.clientX <=
                panelRect.right &&

              event.clientY >=
                panelRect.top &&

              event.clientY <=
                panelRect.bottom
            );


          const point =
            clientToCanvas(
              event.clientX,
              event.clientY
            );


          releasePageFromFolder(
            page.id,
            {

              x:
                overFlowPanel
                  ? point.x
                  : folder.x + 230,

              y:
                overFlowPanel
                  ? point.y
                  : folder.y + 30

            }
          );


          return;
        }


        if(moved){

          markWorkspaceChanged(
            "folder-card-moved",
            {

              folderId:
                folder.id,

              pageId:
                page.id

            }
          );


          return;
        }


        core.selectPage?.(
          page
        );


        toast(
          `已切換到「${page.title || "未命名 Node"}」`
        );

      }


      card.addEventListener(
        "pointerdown",
        event => {

          if(
            event.target.closest(
              ".fhv3-page-release"
            )
          ){

            return;
          }


          event.preventDefault();

          event.stopPropagation();


          startClientX =
            event.clientX;


          startClientY =
            event.clientY;


          startInnerX =
            entry.innerX;


          startInnerY =
            entry.innerY;


          moved =
            false;


          card.__pointerId =
            event.pointerId;


          card.setPointerCapture(
            event.pointerId
          );


          card.classList.add(
            "is-dragging"
          );


          card.addEventListener(
            "pointermove",
            onMove
          );


          card.addEventListener(
            "pointerup",
            finish
          );


          card.addEventListener(
            "pointercancel",
            finish
          );

        }
      );

    }


    overlay.addEventListener(
      "click",
      event => {

        if(
          event.target ===
            overlay
        ){

          closeFolderWindow();

        }

      }
    );


    overlay.addEventListener(
      "click",
      event => {

        const button =
          event.target.closest(
            "button[data-window-action]"
          );


        if(!button){
          return;
        }


        const folder =
          getFolder(
            openedFolderId
          );


        const action =
          button.dataset
            .windowAction;


        switch(action){

          case "close":

            closeFolderWindow();

            break;


          case "rename":

            renameFolder(
              folder
            );

            break;


          case "freeze":

            if(folder){

              setFolderFrozen(
                folder,
                !folder.frozen
              );

            }

            break;


          case "delete":

            deleteFolder(
              folder
            );

            break;

        }

      }
    );


    // =====================================================
    // 偵測 Node 拖入資料夾
    // =====================================================

    function pageFromFlowElement(
      element
    ){

      if(!element){
        return null;
      }


      return core.pages.find(
        page =>
          page?.element ===
            element
      ) || null;

    }


    function getFolderUnderPointer(
      clientX,
      clientY
    ){

      const entries =
        Array.from(
          folderElements.entries()
        );


      for(
        let index =
          entries.length - 1;

        index >= 0;

        index--
      ){

        const [
          folderId,
          element
        ] =
          entries[index];


        const rect =
          element
            .getBoundingClientRect();


        if(
          clientX >=
            rect.left &&

          clientX <=
            rect.right &&

          clientY >=
            rect.top &&

          clientY <=
            rect.bottom
        ){

          return getFolder(
            folderId
          );

        }

      }


      return null;

    }


    function clearDropTarget(){

      folderElements.forEach(
        element => {

          element.classList.remove(
            "is-drop-target"
          );

        }
      );

    }


    function onDocumentPointerDown(
      event
    ){

      const element =
        event.target.closest?.(
          ".flowNode"
        );


      if(!element){
        return;
      }


      const page =
        pageFromFlowElement(
          element
        );


      if(!page){
        return;
      }


      draggedPage =
        page;


      draggedPointerId =
        event.pointerId;


      lastPointerX =
        event.clientX;


      lastPointerY =
        event.clientY;

    }


    function onDocumentPointerMove(
      event
    ){

      if(
        !draggedPage ||
        event.pointerId !==
          draggedPointerId
      ){

        return;
      }


      lastPointerX =
        event.clientX;


      lastPointerY =
        event.clientY;


      clearDropTarget();


      const folder =
        getFolderUnderPointer(
          event.clientX,
          event.clientY
        );


      if(folder){

        folderElements
          .get(folder.id)
          ?.classList.add(
            "is-drop-target"
          );

      }

    }


    function onDocumentPointerUp(
      event
    ){

      if(
        !draggedPage ||
        event.pointerId !==
          draggedPointerId
      ){

        return;
      }


      const page =
        draggedPage;


      const clientX =
        Number.isFinite(
          event.clientX
        )
          ? event.clientX
          : lastPointerX;


      const clientY =
        Number.isFinite(
          event.clientY
        )
          ? event.clientY
          : lastPointerY;


      draggedPage =
        null;


      draggedPointerId =
        null;


      clearDropTarget();


      /*
       * 等原始 Node 完成 pointerup，
       * 再執行資料夾收納。
       */
      setTimeout(
        () => {

          if(destroyed){
            return;
          }


          const folder =
            getFolderUnderPointer(
              clientX,
              clientY
            );


          if(folder){

            assignPageToFolder(
              page,
              folder
            );

          }

        },
        0
      );

    }


    document.addEventListener(
      "pointerdown",
      onDocumentPointerDown,
      true
    );


    document.addEventListener(
      "pointermove",
      onDocumentPointerMove,
      true
    );


    document.addEventListener(
      "pointerup",
      onDocumentPointerUp,
      true
    );


    document.addEventListener(
      "pointercancel",
      onDocumentPointerUp,
      true
    );


    cleanupFunctions.push(
      () => {

        document.removeEventListener(
          "pointerdown",
          onDocumentPointerDown,
          true
        );


        document.removeEventListener(
          "pointermove",
          onDocumentPointerMove,
          true
        );


        document.removeEventListener(
          "pointerup",
          onDocumentPointerUp,
          true
        );


        document.removeEventListener(
          "pointercancel",
          onDocumentPointerUp,
          true
        );

      }
    );


    // =====================================================
    // 新增資料夾按鈕
    // =====================================================

    const addButton =
      document.createElement(
        "button"
      );


    addButton.id =
      "folder-toggle-btn";


    addButton.type =
      "button";


    addButton.dataset.tool =
      "folder-node-v3";


    addButton.textContent =
      "❄️ 高效能資料夾 V3";


    addButton.addEventListener(
      "click",
      () => {

        const name =
          prompt(
            "新資料夾名稱：",
            "新資料夾"
          );


        if(name == null){
          return;
        }


        const rect =
          flowPanel
            .getBoundingClientRect();


        const center =
          clientToCanvas(
            rect.left +
            rect.width / 2,
            rect.top +
            rect.height / 2
          );


        createFolder(
          name,
          center.x - 100,
          center.y - 40
        );

      }
    );


    const header =
      document.querySelector(
        ".pixiv-editor-app > header"
      ) ||
      document.querySelector(
        ".pixiv-editor-container header"
      ) ||
      document.querySelector(
        "header"
      );


    if(header){

      header.appendChild(
        addButton
      );

    }else{

      document.body.appendChild(
        addButton
      );


      addButton.classList.add(
        "fhv3-floating-button"
      );

    }


    cleanupFunctions.push(
      () => {

        addButton.remove();

      }
    );


    // =====================================================
    // Core 事件
    // =====================================================

    const unsubscribeCreated =
      core.on?.(
        "page:created",
        () => {

          requestAnimationFrame(
            applyVisualState
          );

        }
      );


    const unsubscribeRemoved =
      core.on?.(
        "page:removed",
        payload => {

          const page =
            payload?.detail?.page;


          if(!page){
            return;
          }


          const pageId =
            String(page.id);


          folders.forEach(
            folder => {

              folder.nodes =
                folder.nodes.filter(
                  entry =>
                    entry.pageId !==
                      pageId
                );


              updateFolderNode(
                folder
              );

            }
          );


          if(openedFolderId){

            renderFolderWindow(
              getFolder(
                openedFolderId
              )
            );

          }


          markWorkspaceChanged(
            "folder-page-pruned",
            {
              pageId
            }
          );

        }
      );


    if(
      typeof unsubscribeCreated ===
        "function"
    ){

      cleanupFunctions.push(
        unsubscribeCreated
      );

    }


    if(
      typeof unsubscribeRemoved ===
        "function"
    ){

      cleanupFunctions.push(
        unsubscribeRemoved
      );

    }


    // =====================================================
    // 背景頁籤
    // =====================================================

    function onVisibilityChange(){

      if(
        !document.hidden
      ){

        requestDraw();

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
    // ProjectDataCenter
    // =====================================================

    store.controller = {

      rehydrate(){

        folders =
          store.folders;


        normalizeFolders();

        renderAllFolders();


        setTimeout(
          applyVisualState,
          0
        );

      }

    };


    if(!store.registered){

      ProjectDataCenter.register(

        FEATURE_KEY,

        {

          description:
            "高效能收納型資料夾 Node V3",

          defaultValue:
            [],

          resetOnMissing:
            true,


          save(){

            return clone(
              store.folders
            );

          },


          load(value){

            store.folders =
              Array.isArray(value)
                ? clone(value)
                : [];


            store.controller
              ?.rehydrate?.();

          },


          afterLoad(){

            setTimeout(
              () => {

                store.controller
                  ?.rehydrate?.();

              },
              60
            );

          }

        }

      );


      store.registered =
        true;

    }


    // =====================================================
    // 樣式
    // =====================================================

    const removeStyle =
      api.addStyle(

        "folder-node-performance-v3",

        `
        .fhv3-folder-node{
          position:absolute;
          z-index:7;
          width:210px;
          min-height:84px;
          box-sizing:border-box;
          display:flex;
          align-items:center;
          gap:11px;
          padding:12px 40px 12px 13px;
          border:3px solid #bd8121;
          border-radius:16px;
          background:
            linear-gradient(
              145deg,
              #fff4bf,
              #eec45e
            );
          box-shadow:
            0 6px 16px rgba(0,0,0,.24);
          color:#583800;
          cursor:grab;
          user-select:none;
          touch-action:none;
          contain:layout paint style;
        }

        .fhv3-folder-node.is-frozen{
          border-color:#4d74a6;
          background:
            linear-gradient(
              145deg,
              #edf7ff,
              #a8ccef
            );
          color:#173b62;
        }

        .fhv3-folder-node.is-dragging{
          z-index:40;
          cursor:grabbing;
          box-shadow:
            0 14px 32px rgba(0,0,0,.36);
        }

        .fhv3-folder-node.is-drop-target{
          border-color:#1976d2;
          box-shadow:
            0 0 0 6px rgba(25,118,210,.25),
            0 12px 28px rgba(0,0,0,.32);
          transform:scale(1.045);
        }

        .fhv3-folder-icon{
          flex:0 0 auto;
          font-size:31px;
          line-height:1;
          pointer-events:none;
        }

        .fhv3-folder-body{
          min-width:0;
          flex:1;
          pointer-events:none;
        }

        .fhv3-folder-name{
          overflow:hidden;
          font-size:15px;
          font-weight:800;
          line-height:1.35;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .fhv3-folder-count{
          margin-top:3px;
          overflow:hidden;
          font-size:10px;
          font-weight:650;
          opacity:.78;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .fhv3-folder-mode{
          margin-top:4px;
          display:inline-block;
          padding:2px 7px;
          border-radius:999px;
          background:rgba(255,255,255,.56);
          font-size:9px;
          font-weight:750;
        }

        .fhv3-folder-menu-button{
          position:absolute!important;
          top:8px;
          right:7px;
          width:29px!important;
          height:29px!important;
          min-width:0!important;
          padding:0!important;
          display:flex!important;
          align-items:center!important;
          justify-content:center!important;
          border:0!important;
          border-radius:50%!important;
          background:rgba(30,45,60,.14)!important;
          color:inherit!important;
          font-size:20px!important;
          line-height:1!important;
          touch-action:manipulation;
        }

        .fhv3-folder-menu{
          position:fixed;
          z-index:2147483000;
          width:220px;
          box-sizing:border-box;
          display:grid;
          gap:5px;
          padding:7px;
          border:1px solid #cbd2d8;
          border-radius:12px;
          background:#fff;
          box-shadow:
            0 14px 38px rgba(0,0,0,.30);
          font-family:
            system-ui,
            "Noto Sans TC",
            sans-serif;
        }

        .fhv3-folder-menu button{
          width:100%;
          min-height:39px;
          justify-content:flex-start;
          padding:9px 11px!important;
          border:0!important;
          border-radius:8px!important;
          background:#f2f4f6!important;
          color:#2f363c!important;
          font-size:13px!important;
          touch-action:manipulation;
        }

        .fhv3-folder-menu button:hover{
          background:#e7ebee!important;
        }

        .fhv3-folder-menu button.is-danger{
          background:#fff0f0!important;
          color:#a53b3b!important;
        }

        #fhv3-folder-overlay{
          position:fixed;
          inset:0;
          z-index:2147482000;
          box-sizing:border-box;
          display:none;
          align-items:center;
          justify-content:center;
          padding:16px;
          background:rgba(15,19,24,.62);
          font-family:
            system-ui,
            "Noto Sans TC",
            sans-serif;
        }

        #fhv3-folder-overlay.open{
          display:flex;
        }

        #fhv3-folder-window{
          width:min(960px,97vw);
          height:min(720px,90vh);
          min-height:400px;
          display:grid;
          grid-template-rows:auto auto 1fr;
          overflow:hidden;
          border:1px solid #c7cfd5;
          border-radius:17px;
          background:#edf1f4;
          box-shadow:
            0 22px 65px rgba(0,0,0,.44);
          contain:layout paint style;
        }

        .fhv3-window-header{
          min-height:60px;
          box-sizing:border-box;
          display:flex!important;
          align-items:center!important;
          justify-content:space-between!important;
          gap:12px!important;
          padding:9px 13px!important;
          background:#303942!important;
          color:#fff!important;
          box-shadow:none!important;
        }

        .fhv3-window-heading,
        .fhv3-window-actions{
          display:flex;
          align-items:center;
          gap:9px;
        }

        .fhv3-window-heading-text{
          min-width:0;
        }

        .fhv3-window-icon{
          font-size:27px;
        }

        .fhv3-window-title{
          display:block;
          max-width:360px;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .fhv3-window-summary{
          margin-top:2px;
          color:rgba(255,255,255,.72);
          font-size:10px;
          font-weight:500;
        }

        .fhv3-window-actions button{
          min-height:34px;
          padding:6px 10px!important;
          border-radius:18px!important;
          background:#596570!important;
          color:#fff!important;
          font-size:11px!important;
          touch-action:manipulation;
        }

        .fhv3-window-actions button.is-danger{
          background:#8b4444!important;
        }

        .fhv3-window-notice{
          padding:8px 13px;
          border-bottom:1px solid #d0d7dc;
          background:#fff8d8;
          color:#655418;
          font-size:11px;
          line-height:1.55;
        }

        .fhv3-workspace{
          position:relative;
          min-width:0;
          min-height:0;
          overflow:auto;
          background-color:#fafbfd;
          background-image:
            linear-gradient(
              rgba(0,0,0,.052) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(0,0,0,.052) 1px,
              transparent 1px
            );
          background-size:32px 32px;
          touch-action:none;
          contain:strict;
        }

        .fhv3-empty{
          position:absolute;
          left:50%;
          top:50%;
          width:min(420px,82%);
          transform:translate(-50%,-50%);
          color:#74808a;
          font-size:14px;
          line-height:1.8;
          text-align:center;
          white-space:pre-line;
          pointer-events:none;
        }

        .fhv3-page-card{
          position:absolute;
          width:${CARD_WIDTH}px;
          min-height:${CARD_HEIGHT}px;
          box-sizing:border-box;
          padding:11px 36px 10px 11px;
          border:2px solid #687984;
          border-radius:12px;
          background:
            linear-gradient(
              145deg,
              #fff,
              #edf2f5
            );
          box-shadow:
            0 4px 11px rgba(0,0,0,.20);
          color:#27333b;
          cursor:grab;
          user-select:none;
          touch-action:none;
          contain:layout paint style;
        }

        .fhv3-page-card.is-dragging{
          z-index:50;
          cursor:grabbing;
          opacity:.94;
          box-shadow:
            0 13px 30px rgba(0,0,0,.36);
        }

        .fhv3-page-number{
          display:block;
          margin-bottom:2px;
          color:#1976d2;
          font-size:9px;
          font-weight:750;
        }

        .fhv3-page-title{
          overflow:hidden;
          font-size:13px;
          font-weight:800;
          line-height:1.35;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .fhv3-page-meta{
          margin-top:4px;
          overflow:hidden;
          color:#74808a;
          font-size:9px;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .fhv3-page-release{
          position:absolute!important;
          top:8px;
          right:7px;
          width:28px!important;
          height:28px!important;
          min-width:0!important;
          padding:0!important;
          display:flex!important;
          align-items:center!important;
          justify-content:center!important;
          border-radius:50%!important;
          background:#607d8b!important;
          color:#fff!important;
          font-size:14px!important;
          touch-action:manipulation;
        }

        .fhv3-floating-button{
          position:fixed;
          left:12px;
          bottom:12px;
          z-index:1000000;
        }

        @media(max-width:700px){

          #fhv3-folder-overlay{
            padding:6px;
          }

          #fhv3-folder-window{
            width:99vw;
            height:91vh;
            border-radius:13px;
          }

          .fhv3-window-header{
            flex-wrap:wrap!important;
          }

          .fhv3-window-heading{
            width:100%;
          }

          .fhv3-window-actions{
            width:100%;
            overflow-x:auto;
          }

          .fhv3-window-actions button{
            flex:0 0 auto;
          }

          .fhv3-window-title{
            max-width:72vw;
          }

          .fhv3-folder-node{
            width:188px;
          }

          .fhv3-page-card{
            width:160px;
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

    normalizeFolders();

    renderAllFolders();

    applyVisualState();


    window.FirehahaFolderPerformance = {

      version:
        "3.0.0",

      mode:
        "import-test",


      get folders(){

        return folders;

      },


      create(
        name,
        x,
        y
      ){

        return createFolder(
          name,
          x,
          y
        );

      },


      open(folderId){

        const folder =
          getFolder(
            folderId
          );


        if(folder){

          openFolderWindow(
            folder
          );

        }


        return Boolean(folder);

      },


      rename(folderId){

        const folder =
          getFolder(
            folderId
          );


        if(!folder){
          return false;
        }


        renameFolder(
          folder
        );


        return true;

      },


      delete(folderId){

        return deleteFolder(
          getFolder(
            folderId
          )
        );

      },


      freeze(folderId){

        return setFolderFrozen(
          getFolder(
            folderId
          ),
          true
        );

      },


      unfreeze(folderId){

        return setFolderFrozen(
          getFolder(
            folderId
          ),
          false
        );

      },


      release(pageId){

        return releasePageFromFolder(
          pageId
        );

      },


      refresh(){

        normalizeFolders();

        renderAllFolders();

        applyVisualState();

      },


      getStats(){

        const storedPageCount =
          folders.reduce(
            (
              total,
              folder
            ) =>
              total +
              folder.nodes.length,
            0
          );


        const frozenPageCount =
          folders.reduce(
            (
              total,
              folder
            ) =>
              total +
              (
                folder.frozen
                  ? folder.nodes.length
                  : 0
              ),
            0
          );


        const liveFlowNodeCount =
          document.querySelectorAll(
            "#flowCanvas .flowNode"
          ).length;


        return {

          version:
            "3.0.0",

          active:
            !destroyed,

          folderCount:
            folders.length,

          storedPageCount,

          frozenPageCount,

          liveFlowNodeCount,

          totalPageCount:
            core.pages.length,

          estimatedUnloadedNodeCount:
            Math.max(
              0,
              core.pages.length -
              liveFlowNodeCount
            ),

          openedFolderId,

          menuOpen:
            Boolean(menuState)

        };

      }

    };


    toast(
      "高效能資料夾 Node V3 已啟用"
    );


    // =====================================================
    // Cleanup
    // =====================================================

    return function cleanup(){

      destroyed =
        true;


      closeFolderMenu();

      closeFolderWindow();


      restoreAllPageVisuals();


      folderElements.forEach(
        element => {

          element.remove();

        }
      );


      folderElements.clear();


      cleanupFunctions
        .splice(0)
        .reverse()
        .forEach(
          fn => {

            if(
              typeof fn !==
                "function"
            ){

              return;
            }


            try{

              fn();

            }catch(error){

              console.warn(
                "[Folder V3 cleanup]",
                error
              );

            }

          }
        );


      store.controller =
        null;


      if(
        window.FirehahaFolderPerformance
      ){

        delete window
          .FirehahaFolderPerformance;

      }


      toast(
        "高效能資料夾 Node V3 已停用"
      );

    };

  }

});