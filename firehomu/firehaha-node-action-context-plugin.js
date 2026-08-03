// @firehaha-plugin {"id":"official.node-action-context","name":"Node 操作與右鍵選單","version":"2.0.0","author":"Firehaha","description":"統一處理單一與群體 Node 的複製、剪下、貼上、刪除、重新命名、群組及右鍵選單。"}

FirehahaPlugins.register({

  id:
    "official.node-action-context",

  name:
    "Node 操作與右鍵選單",

  version:
    "2.0.0",


  async setup(api){

    "use strict";


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
        )
      ) &&
      Date.now() - startedAt < 12000
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


    if(
      !core ||
      !panel ||
      typeof core.createPage !==
        "function" ||
      typeof core.removePage !==
        "function"
    ){

      throw new Error(
        "GamebookCore 尚未完整就緒"
      );

    }


    // =====================================================
    // 狀態
    // =====================================================

    let activePage =
      null;


    let menu =
      null;


    let clipboard =
      null;


    let pasteCount =
      0;


    let longPressTimer =
      0;


    let longPressNode =
      null;


    let longPressX =
      0;


    let longPressY =
      0;


    let suppressNextClick =
      false;


    // =====================================================
    // 樣式
    // =====================================================

    const removeStyle =
      api.addStyle(
        "node-action-context",
        `
        #fh-node-action-menu{
          position:fixed;
          z-index:2147483000;
          min-width:235px;
          max-width:min(330px,calc(100vw - 20px));
          padding:7px;
          border:1px solid rgba(0,0,0,.14);
          border-radius:14px;
          background:rgba(255,255,255,.98);
          color:#252525;
          box-shadow:
            0 18px 46px rgba(0,0,0,.28),
            0 2px 8px rgba(0,0,0,.12);
          font-family:
            system-ui,
            -apple-system,
            "Segoe UI",
            "Noto Sans TC",
            sans-serif;
          user-select:none;
          backdrop-filter:blur(8px);
        }

        #fh-node-action-menu .fh-action-title{
          padding:8px 11px;
          color:#666;
          font-size:12px;
          font-weight:750;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }

        #fh-node-action-menu .fh-action-count{
          margin-left:6px;
          color:#7c3aed;
        }

        #fh-node-action-menu .fh-action-separator{
          height:1px;
          margin:5px 4px;
          background:#e5e5e5;
        }

        #fh-node-action-menu button{
          display:flex!important;
          width:100%!important;
          min-height:39px;
          align-items:center;
          justify-content:flex-start;
          gap:9px;
          box-sizing:border-box;
          margin:0;
          padding:9px 11px!important;
          border:0!important;
          border-radius:9px!important;
          background:transparent!important;
          color:#292929!important;
          font:650 14px/1.35 system-ui,sans-serif;
          text-align:left;
          cursor:pointer;
          transform:none!important;
          box-shadow:none!important;
        }

        #fh-node-action-menu button:hover,
        #fh-node-action-menu button:focus-visible{
          background:#edf6ff!important;
          color:#006fbf!important;
          outline:none;
        }

        #fh-node-action-menu button.fh-action-danger{
          color:#c62828!important;
        }

        #fh-node-action-menu button.fh-action-danger:hover{
          background:#fff0f0!important;
          color:#b71c1c!important;
        }

        #fh-node-action-menu button:disabled{
          opacity:.38;
          cursor:not-allowed;
        }

        #fh-node-action-menu .fh-action-icon{
          width:22px;
          flex:0 0 22px;
          text-align:center;
          font-size:16px;
        }

        @media(max-width:600px){

          #fh-node-action-menu{
            min-width:250px;
            padding:9px;
            border-radius:17px;
          }

          #fh-node-action-menu button{
            min-height:49px;
            padding:12px 13px!important;
            font-size:16px;
          }

          #fh-node-action-menu .fh-action-title{
            padding:9px 12px;
            font-size:13px;
          }

        }
        `
      );


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
        message
      );

    }


    function cloneData(value){

      return JSON.parse(
        JSON.stringify(
          value
        )
      );

    }


    function getSelectedSet(){

      if(
        window.selectedPages
        instanceof Set
      ){

        return window.selectedPages;

      }


      window.selectedPages =
        new Set();


      return window.selectedPages;

    }


    function getValidSelection(){

      return Array
        .from(
          getSelectedSet()
        )
        .filter(
          page =>
            core.pages.includes(page)
        );

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


    function getActionPages(
      page
    ){

      const selected =
        getValidSelection();


      if(
        page &&
        selected.length > 1 &&
        selected.includes(page)
      ){

        return selected;

      }


      return page
        ? [page]
        : [];

    }


    function serializePage(page){

      return {

        id:
          page.id,

        title:
          page.title || "",

        text:
          page.text || "",

        note:
          page.note || "",

        options:
          cloneData(
            page.options || []
          ),

        nextLinks:
          cloneData(
            page.nextLinks || []
          ),

        pathHistory:
          cloneData(
            page.pathHistory || []
          ),

        x:
          Number(page.x) || 0,

        y:
          Number(page.y) || 0,

        groupId:
          page.groupId || null,

        groupColor:
          page.groupColor || null

      };

    }


    function serializePages(
      pages
    ){

      return pages.map(
        serializePage
      );

    }


    function closeMenu(){

      if(menu){

        menu.remove();

        menu =
          null;

      }


      activePage =
        null;

    }


    function hideOldMenus(){

      const oldNodeMenu =
        document.getElementById(
          "node-context-menu"
        );


      if(oldNodeMenu){

        oldNodeMenu.style.display =
          "none";

      }


      document
        .querySelectorAll(
          ".context-menu"
        )
        .forEach(element => {

          if(
            element !== menu
          ){

            element.style.display =
              "none";

          }

        });

    }


    function positionMenu(
      element,
      x,
      y
    ){

      element.style.left =
        "0px";


      element.style.top =
        "0px";


      element.style.visibility =
        "hidden";


      document.body.appendChild(
        element
      );


      const rect =
        element.getBoundingClientRect();


      const edge =
        10;


      const left =
        Math.max(
          edge,
          Math.min(
            Number(x) || edge,
            window.innerWidth -
            rect.width -
            edge
          )
        );


      const top =
        Math.max(
          edge,
          Math.min(
            Number(y) || edge,
            window.innerHeight -
            rect.height -
            edge
          )
        );


      element.style.left =
        left + "px";


      element.style.top =
        top + "px";


      element.style.visibility =
        "visible";

    }


    function requestLineRender(){

      if(
        window.FirehahaRenderCore &&
        typeof window
          .FirehahaRenderCore
          .requestLines ===
          "function"
      ){

        window
          .FirehahaRenderCore
          .requestLines();

        return;

      }


      core.drawLines?.();

    }


    function syncSelectionStyle(){

      const selected =
        getSelectedSet();


      core.pages.forEach(page => {

        if(!page.element){
          return;
        }


        const active =
          selected.has(page);


        page.element.classList.toggle(
          "fh-node-selected",
          active
        );


        page.element.classList.toggle(
          "multiSelected",
          active
        );

      });


      const toolbar =
        document.getElementById(
          "multiSelectToolbar"
        );


      const count =
        document.getElementById(
          "multiSelectCount"
        );


      if(toolbar){

        toolbar.style.display =
          selected.size
            ? "flex"
            : "none";

      }


      if(count){

        count.textContent =
          `已選取 ${selected.size} 個頁面`;

      }

    }


    function selectCreatedPages(
      pages
    ){

      const selected =
        getSelectedSet();


      selected.clear();


      pages.forEach(page => {

        selected.add(page);

      });


      syncSelectionStyle();


      if(pages.length){

        core.selectPage?.(
          pages[0]
        );

      }

    }


    function saveAfterAction(){

      try{

        core.dataCenter
          ?.saveProject
          ?.({
            silent:true,
            auto:true
          });

      }catch(error){

        console.warn(
          "[Node Action save]",
          error
        );

      }

    }


    // =====================================================
    // Action Bridge
    // =====================================================

    const Actions = {


      getClipboardInfo(){

        return clipboard
          ? {
              kind:
                clipboard.kind,

              count:
                clipboard.items.length,

              cut:
                clipboard.cut === true
            }
          : {
              kind:null,
              count:0,
              cut:false
            };

      },


      copy(page){

        const pages =
          getActionPages(
            page ||
            activePage
          );


        if(!pages.length){

          toast(
            "沒有可複製的 Node"
          );

          return false;

        }


        clipboard = {

          kind:
            pages.length > 1
              ? "multi"
              : "single",

          cut:
            false,

          items:
            serializePages(
              pages
            ),

          createdAt:
            Date.now()

        };


        pasteCount =
          0;


        toast(
          pages.length > 1
            ? `已複製 ${pages.length} 個 Node`
            : "已複製 Node"
        );


        return true;

      },


      cut(page){

        const pages =
          getActionPages(
            page ||
            activePage
          );


        if(!pages.length){

          toast(
            "沒有可剪下的 Node"
          );

          return false;

        }


        clipboard = {

          kind:
            pages.length > 1
              ? "multi"
              : "single",

          cut:
            true,

          items:
            serializePages(
              pages
            ),

          createdAt:
            Date.now()

        };


        pasteCount =
          0;


        const removed =
          Actions.delete(
            page ||
            activePage,
            {
              confirm:false,
              fromCut:true
            }
          );


        if(!removed){

          clipboard =
            null;

          return false;

        }


        toast(
          pages.length > 1
            ? `已剪下 ${pages.length} 個 Node`
            : "已剪下 Node"
        );


        return true;

      },


      paste(){

        if(
          !clipboard ||
          !Array.isArray(
            clipboard.items
          ) ||
          !clipboard.items.length
        ){

          toast(
            "剪貼簿目前是空的"
          );

          return false;

        }


        pasteCount++;


        const offset =
          50 * pasteCount;


        const idMap =
          new Map();


        const groupMap =
          new Map();


        clipboard.items.forEach(item => {

          idMap.set(
            item.id,
            crypto.randomUUID()
          );


          if(
            item.groupId &&
            !groupMap.has(
              item.groupId
            )
          ){

            groupMap.set(
              item.groupId,
              "group_" +
              crypto.randomUUID()
            );

          }

        });


        const created =
          [];


        clipboard.items.forEach(item => {

          const options =
            cloneData(
              item.options || []
            );


          options.forEach(option => {

            if(
              option &&
              option.target &&
              idMap.has(
                option.target
              )
            ){

              option.target =
                idMap.get(
                  option.target
                );

            }

          });


          const nextLinks =
            cloneData(
              item.nextLinks || []
            );


          nextLinks.forEach(link => {

            if(
              typeof link === "string" &&
              idMap.has(link)
            ){

              const index =
                nextLinks.indexOf(
                  link
                );


              nextLinks[index] =
                idMap.get(link);

            }else if(
              link &&
              typeof link === "object"
            ){

              if(
                link.target &&
                idMap.has(
                  link.target
                )
              ){

                link.target =
                  idMap.get(
                    link.target
                  );

              }


              if(
                link.targetId &&
                idMap.has(
                  link.targetId
                )
              ){

                link.targetId =
                  idMap.get(
                    link.targetId
                  );

              }

            }

          });


          const newPage =
            core.createPage(
              {
                id:
                  idMap.get(
                    item.id
                  ),

                title:
                  String(
                    item.title ||
                    "未命名頁面"
                  ) +
                  "（複製）",

                text:
                  item.text || "",

                note:
                  item.note || "",

                options,

                nextLinks,

                pathHistory:
                  cloneData(
                    item.pathHistory ||
                    []
                  ),

                x:
                  Math.max(
                    0,
                    (Number(item.x) || 0) +
                    offset
                  ),

                y:
                  Math.max(
                    0,
                    (Number(item.y) || 0) +
                    offset
                  ),

                groupId:
                  item.groupId
                    ? groupMap.get(
                        item.groupId
                      )
                    : null,

                groupColor:
                  item.groupColor ||
                  null
              },
              {
                select:false
              }
            );


          if(newPage){

            created.push(
              newPage
            );

          }

        });


        selectCreatedPages(
          created
        );


        core.notifyChange?.(
          "node-action-paste",
          {
            count:
              created.length,

            clipboardKind:
              clipboard.kind
          }
        );


        requestLineRender();

        saveAfterAction();


        toast(
          `已貼上 ${created.length} 個 Node`
        );


        return created;

      },


      delete(
        page,
        options
      ){

        const settings =
          options || {};


        const requested =
          getActionPages(
            page ||
            activePage
          );


        if(!requested.length){

          toast(
            "沒有可刪除的 Node"
          );

          return false;

        }


        const protectedPage =
          core.pages[0];


        const victims =
          requested.filter(
            item =>
              item !== protectedPage &&
              core.pages.includes(item)
          );


        if(!victims.length){

          toast(
            "第一頁是專案入口，不能刪除"
          );

          return false;

        }


        if(
          settings.confirm !== false &&
          victims.length > 1 &&
          !confirm(
            `確定刪除選取的 ${victims.length} 個 Node？`
          )
        ){

          return false;

        }


        if(
          settings.confirm !== false &&
          victims.length === 1 &&
          !confirm(
            `確定刪除「${victims[0].title || "未命名頁面"}」？`
          )
        ){

          return false;

        }


        const victimIds =
          new Set(
            victims.map(
              item =>
                item.id
            )
          );


        const survivor =
          core.pages.find(
            item =>
              !victims.includes(item)
          ) ||
          protectedPage;


        const selected =
          getSelectedSet();


        selected.clear();


        victims.forEach(item => {

          core.removePage(
            item
          );

        });


        /*
         * core.removePage 本身會清理 options，
         * 這裡再兼容 nextLinks。
         */
        core.pages.forEach(item => {

          if(
            Array.isArray(
              item.nextLinks
            )
          ){

            item.nextLinks =
              item.nextLinks.filter(
                link => {

                  if(
                    typeof link ===
                      "string"
                  ){

                    return !victimIds.has(
                      link
                    );

                  }


                  if(
                    link &&
                    typeof link ===
                      "object"
                  ){

                    return !(
                      victimIds.has(
                        link.target
                      ) ||
                      victimIds.has(
                        link.targetId
                      )
                    );

                  }


                  return true;

                }
              );

          }

        });


        syncSelectionStyle();


        if(
          survivor &&
          core.pages.includes(
            survivor
          )
        ){

          core.selectPage?.(
            survivor
          );

        }


        core.notifyChange?.(
          settings.fromCut
            ? "node-action-cut"
            : "node-action-delete",
          {
            count:
              victims.length,

            deletedIds:
              Array.from(
                victimIds
              )
          }
        );


        requestLineRender();

        saveAfterAction();


        if(!settings.fromCut){

          toast(
            requested.includes(
              protectedPage
            )
              ? `已刪除 ${victims.length} 個 Node；第一頁已保留`
              : `已刪除 ${victims.length} 個 Node`
          );

        }


        return true;

      },


      rename(page){

        const target =
          page ||
          activePage;


        if(!target){
          return false;
        }


        if(
          getActionPages(target)
            .length > 1
        ){

          toast(
            "群體選取時無法同時重新命名"
          );

          return false;

        }


        const name =
          prompt(
            "輸入新的頁面名稱：",
            target.title || ""
          );


        if(name === null){
          return false;
        }


        const cleanName =
          String(name).trim();


        if(!cleanName){
          return false;
        }


        target.title =
          cleanName;


        if(target.element){

          target.element.textContent =
            cleanName;

        }


        core.selectPage?.(
          target
        );


        const titleInput =
          document.getElementById(
            "pageTitle"
          );


        if(titleInput){

          titleInput.value =
            cleanName;


          titleInput.dispatchEvent(
            new Event(
              "input",
              {
                bubbles:true
              }
            )
          );

        }


        core.notifyChange?.(
          "node-action-rename",
          {
            pageId:
              target.id,

            title:
              cleanName
          }
        );


        saveAfterAction();

        toast(
          "已重新命名"
        );


        return true;

      },


      group(page){

        const pages =
          getActionPages(
            page ||
            activePage
          );


        if(pages.length < 2){

          toast(
            "請先選取兩個以上的 Node"
          );

          return false;

        }


        const groupId =
          "group_" +
          crypto.randomUUID();


        const hue =
          Math.floor(
            Math.random() *
            360
          );


        const groupColor =
          `hsl(${hue} 70% 75%)`;


        pages.forEach(item => {

          item.groupId =
            groupId;

          item.groupColor =
            groupColor;


          if(item.element){

            item.element.dataset.groupId =
              groupId;


            item.element.style.setProperty(
              "--groupColor",
              groupColor
            );

          }

        });


        core.notifyChange?.(
          "node-action-group",
          {
            count:
              pages.length,

            groupId
          }
        );


        saveAfterAction();

        toast(
          `已將 ${pages.length} 個 Node 釘成群組`
        );


        return true;

      },


      ungroup(page){

        const target =
          page ||
          activePage;


        if(!target){
          return false;
        }


        let pages =
          getActionPages(
            target
          );


        if(
          pages.length === 1 &&
          target.groupId
        ){

          pages =
            core.pages.filter(
              item =>
                item.groupId ===
                target.groupId
            );

        }


        const grouped =
          pages.filter(
            item =>
              item.groupId
          );


        if(!grouped.length){

          toast(
            "目前沒有可解除的群組"
          );

          return false;

        }


        grouped.forEach(item => {

          item.groupId =
            null;

          item.groupColor =
            null;


          if(item.element){

            delete item
              .element
              .dataset
              .groupId;


            item.element.style.removeProperty(
              "--groupColor"
            );

          }

        });


        core.notifyChange?.(
          "node-action-ungroup",
          {
            count:
              grouped.length
          }
        );


        saveAfterAction();

        toast(
          `已解除 ${grouped.length} 個 Node 的群組`
        );


        return true;

      },


      clearSelection(){

        getSelectedSet().clear();

        syncSelectionStyle();

        return true;

      },


      run(
        action,
        page
      ){

        const fn =
          Actions[action];


        if(
          typeof fn !==
            "function"
        ){

          console.warn(
            "[FirehahaActions] 未知操作：",
            action
          );

          return false;

        }


        return fn(
          page
        );

      }

    };


    window.FirehahaActions =
      Actions;


    // =====================================================
    // 建立選單 UI
    // =====================================================

    function addSeparator(){

      const separator =
        document.createElement(
          "div"
        );


      separator.className =
        "fh-action-separator";


      menu.appendChild(
        separator
      );

    }


    function addButton(
      icon,
      label,
      action,
      options
    ){

      const settings =
        options || {};


      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      if(settings.danger){

        button.classList.add(
          "fh-action-danger"
        );

      }


      if(settings.disabled){

        button.disabled =
          true;

      }


      const iconBox =
        document.createElement(
          "span"
        );


      iconBox.className =
        "fh-action-icon";


      iconBox.textContent =
        icon;


      const labelBox =
        document.createElement(
          "span"
        );


      labelBox.textContent =
        label;


      button.append(
        iconBox,
        labelBox
      );


      button.addEventListener(
        "click",
        function(event){

          event.preventDefault();

          event.stopPropagation();


          try{

            action();

          }catch(error){

            console.error(
              "[Node Action Context]",
              error
            );


            toast(
              "操作失敗：" +
              String(
                error?.message ||
                error
              )
            );

          }finally{

            closeMenu();

          }

        }
      );


      menu.appendChild(
        button
      );

    }


    function createMenuBase(
      titleText,
      count
    ){

      closeMenu();

      hideOldMenus();


      menu =
        document.createElement(
          "div"
        );


      menu.id =
        "fh-node-action-menu";


      menu.setAttribute(
        "role",
        "menu"
      );


      const title =
        document.createElement(
          "div"
        );


      title.className =
        "fh-action-title";


      const text =
        document.createElement(
          "span"
        );


      text.textContent =
        titleText;


      title.appendChild(
        text
      );


      if(count > 1){

        const countText =
          document.createElement(
            "span"
          );


        countText.className =
          "fh-action-count";


        countText.textContent =
          `（已選 ${count} 個）`;


        title.appendChild(
          countText
        );

      }


      menu.appendChild(
        title
      );

    }


    function showNodeMenu(
      x,
      y,
      page
    ){

      activePage =
        page;


      const pages =
        getActionPages(
          page
        );


      const count =
        pages.length;


      createMenuBase(
        page.title ||
        "未命名 Node",
        count
      );


      addButton(
        "✏️",
        "重新命名",
        () =>
          Actions.rename(
            page
          ),
        {
          disabled:
            count > 1
        }
      );


      addSeparator();


      addButton(
        "📋",
        count > 1
          ? `複製 ${count} 個 Node`
          : "複製 Node",
        () =>
          Actions.copy(
            page
          )
      );


      addButton(
        "✂️",
        count > 1
          ? `剪下 ${count} 個 Node`
          : "剪下 Node",
        () =>
          Actions.cut(
            page
          )
      );


      addButton(
        "📥",
        clipboard?.items?.length > 1
          ? `貼上 ${clipboard.items.length} 個 Node`
          : "貼上 Node",
        () =>
          Actions.paste(),
        {
          disabled:
            !clipboard
        }
      );


      addSeparator();


      addButton(
        "📌",
        "釘成群組",
        () =>
          Actions.group(
            page
          ),
        {
          disabled:
            count < 2
        }
      );


      addButton(
        "🔓",
        "解除群組",
        () =>
          Actions.ungroup(
            page
          ),
        {
          disabled:
            !page.groupId &&
            !pages.some(
              item =>
                item.groupId
            )
        }
      );


      if(count > 1){

        addButton(
          "✖️",
          "取消群體選取",
          () =>
            Actions.clearSelection()
        );

      }


      addSeparator();


      addButton(
        "🗑️",
        count > 1
          ? `刪除 ${count} 個 Node`
          : "刪除 Node",
        () =>
          Actions.delete(
            page
          ),
        {
          danger:true
        }
      );


      positionMenu(
        menu,
        x,
        y
      );

    }


    function showCanvasMenu(
      x,
      y
    ){

      createMenuBase(
        "流程圖畫布",
        0
      );


      addButton(
        "📥",
        clipboard?.items?.length > 1
          ? `貼上 ${clipboard.items.length} 個 Node`
          : "貼上 Node",
        () =>
          Actions.paste(),
        {
          disabled:
            !clipboard
        }
      );


      if(
        getSelectedSet()
          .size > 0
      ){

        addSeparator();


        addButton(
          "✖️",
          "取消目前選取",
          () =>
            Actions.clearSelection()
        );

      }


      positionMenu(
        menu,
        x,
        y
      );

    }


    // =====================================================
    // 右鍵接管
    // =====================================================

    function onContextMenu(event){

      if(
        !panel.contains(
          event.target
        )
      ){

        return;

      }


      event.preventDefault();

      event.stopPropagation();

      event.stopImmediatePropagation();


      const node =
        event.target.closest?.(
          ".flowNode"
        );


      if(node){

        const page =
          pageOfNode(
            node
          );


        if(page){

          showNodeMenu(
            event.clientX,
            event.clientY,
            page
          );

        }


        return;

      }


      showCanvasMenu(
        event.clientX,
        event.clientY
      );

    }


    // =====================================================
    // 手機長按
    // =====================================================

    function cancelLongPress(){

      if(longPressTimer){

        clearTimeout(
          longPressTimer
        );


        longPressTimer =
          0;

      }


      longPressNode =
        null;

    }


    function onTouchStart(event){

      const node =
        event.target.closest?.(
          ".flowNode"
        );


      if(
        !node ||
        !panel.contains(node) ||
        !event.touches ||
        event.touches.length !== 1
      ){

        return;

      }


      event.stopImmediatePropagation();


      const touch =
        event.touches[0];


      longPressNode =
        node;


      longPressX =
        touch.clientX;


      longPressY =
        touch.clientY;


      longPressTimer =
        setTimeout(
          function(){

            const page =
              pageOfNode(
                longPressNode
              );


            if(page){

              suppressNextClick =
                true;


              showNodeMenu(
                longPressX,
                longPressY,
                page
              );

            }


            longPressTimer =
              0;

          },
          650
        );

    }


    function onTouchMove(event){

      if(
        !longPressTimer ||
        !event.touches ||
        !event.touches.length
      ){

        return;

      }


      const touch =
        event.touches[0];


      if(
        Math.abs(
          touch.clientX -
          longPressX
        ) > 10 ||
        Math.abs(
          touch.clientY -
          longPressY
        ) > 10
      ){

        cancelLongPress();

      }

    }


    function onTouchEnd(){

      cancelLongPress();

    }


    // =====================================================
    // 關閉選單
    // =====================================================

    function onDocumentPointerDown(event){

      if(
        menu &&
        !menu.contains(
          event.target
        )
      ){

        closeMenu();

      }

    }


    function onDocumentClick(event){

      if(!suppressNextClick){
        return;
      }


      suppressNextClick =
        false;


      event.preventDefault();

      event.stopImmediatePropagation();

    }


    function onKeyDown(event){

      if(
        event.key === "Escape"
      ){

        closeMenu();

      }

    }


    function onWindowChange(){

      closeMenu();

    }


    // =====================================================
    // 舊選單監控
    // =====================================================

    const oldMenuObserver =
      new MutationObserver(
        hideOldMenus
      );


    oldMenuObserver.observe(
      document.body,
      {
        childList:true,
        subtree:true
      }
    );


    // =====================================================
    // 安裝
    // =====================================================

    panel.addEventListener(
      "contextmenu",
      onContextMenu,
      true
    );


    panel.addEventListener(
      "touchstart",
      onTouchStart,
      true
    );


    panel.addEventListener(
      "touchmove",
      onTouchMove,
      true
    );


    panel.addEventListener(
      "touchend",
      onTouchEnd,
      true
    );


    panel.addEventListener(
      "touchcancel",
      onTouchEnd,
      true
    );


    document.addEventListener(
      "pointerdown",
      onDocumentPointerDown,
      true
    );


    document.addEventListener(
      "click",
      onDocumentClick,
      true
    );


    document.addEventListener(
      "keydown",
      onKeyDown,
      true
    );


    window.addEventListener(
      "resize",
      onWindowChange
    );


    window.addEventListener(
      "scroll",
      onWindowChange,
      true
    );


    hideOldMenus();


    api.toast(
      "Node 操作與新式右鍵選單已啟用"
    );


    // =====================================================
    // Cleanup
    // =====================================================

    return function cleanup(){

      cancelLongPress();

      closeMenu();


      oldMenuObserver.disconnect();


      panel.removeEventListener(
        "contextmenu",
        onContextMenu,
        true
      );


      panel.removeEventListener(
        "touchstart",
        onTouchStart,
        true
      );


      panel.removeEventListener(
        "touchmove",
        onTouchMove,
        true
      );


      panel.removeEventListener(
        "touchend",
        onTouchEnd,
        true
      );


      panel.removeEventListener(
        "touchcancel",
        onTouchEnd,
        true
      );


      document.removeEventListener(
        "pointerdown",
        onDocumentPointerDown,
        true
      );


      document.removeEventListener(
        "click",
        onDocumentClick,
        true
      );


      document.removeEventListener(
        "keydown",
        onKeyDown,
        true
      );


      window.removeEventListener(
        "resize",
        onWindowChange
      );


      window.removeEventListener(
        "scroll",
        onWindowChange,
        true
      );


      if(
        window.FirehahaActions ===
        Actions
      ){

        delete window
          .FirehahaActions;

      }


      clipboard =
        null;


      removeStyle();

    };

  }

});