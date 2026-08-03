// @firehaha-plugin {"id":"official.node-box-delete","name":"Node 框選與 Delete 刪除","version":"1.2.0","author":"Firehaha","description":"高效能框選 Node、單點選取、Ctrl 多選與 Delete 安全刪除；保留第一頁並同步清理排版資料。"}

FirehahaPlugins.register({

  id:
    "official.node-box-delete",

  name:
    "Node 框選與 Delete 刪除",

  version:
    "1.2.0",


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
      !panel
    ){
      throw new Error(
        "Node 畫布尚未就緒"
      );
    }


    const selected =
      window.selectedPages ||
      (
        window.selectedPages =
          new Set()
      );


    /*
     * 只紀錄目前真正已套用選取樣式的頁面。
     * 避免 sync() 每次掃描全部 core.pages。
     */
    const renderedSelected =
      new Set();


    /*
     * Node → Page 快速索引。
     * 不必每次單擊都 core.pages.find()。
     */
    const pageByElement =
      new WeakMap();


    function rebuildPageElementIndex(){

      core.pages.forEach(page => {

        if(page?.element){

          pageByElement.set(
            page.element,
            page
          );

        }

      });

    }


    rebuildPageElementIndex();


    // =====================================================
    // 樣式
    // =====================================================

    const styleOff =
      api.addStyle(
        "selection",
        `
        .flowNode.fh-node-selected,
        .flowNode.multiSelected{
          outline:3px solid #7c3aed!important;
          outline-offset:3px!important;
          box-shadow:
            0 0 0 6px #7c3aed24,
            0 8px 22px #34205c38!important;
        }

        #fhNodeSelectBox{
          position:fixed;
          z-index:2147481700;
          border:2px solid #6d3bd1;
          background:#7c3aed24;
          pointer-events:none;
          box-sizing:border-box;
        }

        #fhNodeSelectMode{
          position:fixed;
          left:18px;
          bottom:126px;
          z-index:2147481800;
          border:0;
          border-radius:999px;
          padding:10px 14px;
          background:#6b3cc3;
          color:#fff;
          font-weight:850;
          box-shadow:0 7px 22px #3d246740;
          cursor:pointer;
        }

        #fhNodeSelectMode.off{
          background:#687078;
        }

        @media(max-width:600px){

          #fhNodeSelectMode{
            left:10px;
            bottom:120px;
          }

        }
        `
      );


    // =====================================================
    // 模式按鈕
    // =====================================================

    const mode =
      document.createElement(
        "button"
      );


    mode.id =
      "fhNodeSelectMode";


    mode.type =
      "button";


    mode.textContent =
      "▧ 框選模式：開";


    document.body.appendChild(
      mode
    );


    // =====================================================
    // 狀態
    // =====================================================

    let enabled =
      true;


    let dragging =
      false;


    let startX =
      0;


    let startY =
      0;


    let box =
      null;


    let moved =
      false;


    let additive =
      false;


    /*
     * 框選排程器。
     */
    let selectionFrame =
      0;


    let latestPointerX =
      0;


    let latestPointerY =
      0;


    /*
     * Ctrl 多選時，要保存開始框選前的選取集合。
     * 離開框選範圍的 Node 不應誤刪原本選取。
     */
    let selectionAtDragStart =
      new Set();


/*
 * 框選結束後，阻止瀏覽器補發的 click
 * 被主程式原生空白點擊邏輯清除選取。
 */
let suppressNextCanvasClick =
  false;

     /*
 * 多選 Node 群組拖曳狀態。
 */
let groupDragging =
  false;

let groupDragPointerId =
  null;

let groupDragStartClientX =
  0;

let groupDragStartClientY =
  0;

let groupDragFrame =
  0;

let groupDragLatestX =
  0;

let groupDragLatestY =
  0;

let groupDragOrigins =
  new Map();

let groupDragLeadPage =
  null;


    // =====================================================
    // 共用工具
    // =====================================================

    function editable(target){

      if(
        !target ||
        typeof target.closest !==
          "function"
      ){
        return false;
      }


      return Boolean(
        target.closest(
          [
            "input",
            "textarea",
            "select",
            '[contenteditable="true"]',
            "#htmlDesignEditor",
            "#htmlSourceEditor",
            "#source-text"
          ].join(",")
        )
      );

    }


    function pageOf(node){

      if(!node){
        return null;
      }


      const cached =
        pageByElement.get(
          node
        );


      if(cached){
        return cached;
      }


      const page =
        core.pages.find(
          item =>
            item.element === node
        ) || null;


      if(page){
        pageByElement.set(
          node,
          page
        );
      }


      return page;

    }


    // =====================================================
    // 差異式更新選取樣式
    // =====================================================

    function sync(){

      /*
       * 移除已取消選取的樣式。
       */
      Array
        .from(
          renderedSelected
        )
        .forEach(page => {

          if(
            selected.has(page) &&
            core.pages.includes(page)
          ){
            return;
          }


          page.element
            ?.classList
            .remove(
              "fh-node-selected"
            );


          renderedSelected.delete(
            page
          );

        });


      /*
       * 只替新選取的頁面增加樣式。
       */
      selected.forEach(page => {

        if(
          !core.pages.includes(page)
        ){
          selected.delete(page);
          return;
        }


        if(
          renderedSelected.has(page)
        ){
          return;
        }


        page.element
          ?.classList
          .add(
            "fh-node-selected"
          );


        renderedSelected.add(
          page
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

        const display =
          selected.size
            ? "flex"
            : "none";


        if(
          toolbar.style.display !==
          display
        ){
          toolbar.style.display =
            display;
        }

      }


      if(count){

        const text =
          `已選取 ${selected.size} 個頁面`;


        if(
          count.textContent !== text
        ){
          count.textContent =
            text;
        }

      }

    }


    function clear(){

      selected.clear();

      sync();

    }


    // =====================================================
    // 模式切換
    // =====================================================

    function toggleMode(){

      enabled =
        !enabled;


      mode.classList.toggle(
        "off",
        !enabled
      );


      mode.textContent =
        enabled
          ? "▧ 框選模式：開"
          : "✥ 畫布平移模式";


      if(!enabled){

        cancelSelectionFrame();

        dragging =
          false;


        box?.remove();

        box =
          null;

      }


      api.toast(
        enabled
          ? "可直接拖曳框選 Node"
          : "已恢復空白處拖曳平移"
      );

    }


    mode.addEventListener(
      "click",
      toggleMode
    );


   function requestLineRender(){

  const renderCore =
    window.FirehahaRenderCore;

  if(
    renderCore &&
    typeof renderCore.requestLines ===
      "function"
  ){
    renderCore.requestLines();
    return;
  }


  /*
   * GamebookCore 若有公開重繪接口就使用。
   * 沒有也沒關係，主程式下一次操作仍會更新。
   */
  core.drawLines?.();

}


function processGroupDrag(){

  if(
    !groupDragging ||
    !groupDragLeadPage
  ){
    return;
  }


  const scale =
    Number(
      window.__flowCanvasScale
    ) || 1;


  const dx =
    (
      groupDragLatestX -
      groupDragStartClientX
    ) / scale;


  const dy =
    (
      groupDragLatestY -
      groupDragStartClientY
    ) / scale;


  groupDragOrigins.forEach(
    (origin,page)=>{

      if(
        !core.pages.includes(page)
      ){
        return;
      }


      page.x =
        Math.max(
          0,
          origin.x + dx
        );


      page.y =
        Math.max(
          0,
          origin.y + dy
        );


      if(page.element){

        page.element.style.left =
          page.x + "px";

        page.element.style.top =
          page.y + "px";

      }

    }
  );


  requestLineRender();

}


function scheduleGroupDrag(){

  if(groupDragFrame){
    return;
  }


  groupDragFrame =
    requestAnimationFrame(
      function(){

        groupDragFrame =
          0;

        processGroupDrag();

      }
    );

}


function stopGroupDrag(){

  if(!groupDragging){
    return;
  }


  if(groupDragFrame){

    cancelAnimationFrame(
      groupDragFrame
    );

    groupDragFrame =
      0;

  }


  processGroupDrag();


  groupDragging =
    false;

  groupDragPointerId =
    null;

  groupDragLeadPage =
    null;

  groupDragOrigins.clear();


  core.notifyChange?.(
    "node-multi-move",
    {
      count:
        selected.size
    }
  );

}


function onSelectedNodePointerDown(
  event
){

  if(
    !enabled ||
    event.button !== 0 ||
    selected.size <= 1
  ){
    return;
  }


  const node =
    event.target.closest(
      ".flowNode"
    );


  if(
    !node ||
    !panel.contains(node)
  ){
    return;
  }


  const page =
    pageOf(node);


  /*
   * 點到未選取的 Node 時，
   * 仍交給主程式原本單節點拖曳。
   */
  if(
    !page ||
    !selected.has(page)
  ){
    return;
  }


  /*
   * 重要：
   * 阻止主程式 dragNode 同時啟動，
   * 否則主程式和插件會各移動一次。
   */
  event.preventDefault();

  event.stopImmediatePropagation();


  groupDragging =
    true;

  groupDragPointerId =
    event.pointerId;

  groupDragLeadPage =
    page;


  groupDragStartClientX =
    event.clientX;

  groupDragStartClientY =
    event.clientY;

  groupDragLatestX =
    event.clientX;

  groupDragLatestY =
    event.clientY;


  groupDragOrigins.clear();


  selected.forEach(item=>{

    if(
      core.pages.includes(item)
    ){
      groupDragOrigins.set(
        item,
        {
          x:
            Number(item.x) || 0,

          y:
            Number(item.y) || 0
        }
      );
    }

  });


  try{

    node.setPointerCapture(
      event.pointerId
    );

  }catch(error){}

}

function onGroupPointerMove(
  event
){

  if(
    !groupDragging ||
    event.pointerId !==
      groupDragPointerId
  ){
    return;
  }


  event.preventDefault();

  event.stopImmediatePropagation();


  groupDragLatestX =
    event.clientX;

  groupDragLatestY =
    event.clientY;


  scheduleGroupDrag();

}


function onGroupPointerUp(
  event
){

  if(
    !groupDragging ||
    event.pointerId !==
      groupDragPointerId
  ){
    return;
  }


  event.preventDefault();

  event.stopImmediatePropagation();


  groupDragLatestX =
    event.clientX;

  groupDragLatestY =
    event.clientY;


  stopGroupDrag();

}


    // =====================================================
    // 單點選取
    // =====================================================

    function onNodeClick(event){

      if(
        !enabled ||
        event.button !== 0
      ){
        return;
      }


      const node =
        event.target.closest(
          ".flowNode"
        );


      if(
        !node ||
        !panel.contains(node)
      ){
        return;
      }


      const page =
        pageOf(node);


      if(!page){
        return;
      }


      event.preventDefault();

      event.stopImmediatePropagation();


      if(
        event.ctrlKey ||
        event.metaKey
      ){

        if(selected.has(page)){

          selected.delete(page);

        }else{

          selected.add(page);

        }

      }else if(
        !(
          selected.size > 1 &&
          selected.has(page)
        )
      ){

        selected.clear();

        selected.add(page);

      }


      sync();


      core.selectPage?.(
        page
      );

    }


    // =====================================================
    // 開始框選
    // =====================================================

    function onDown(event){

      if(
        !enabled ||
        event.button !== 0 ||
        window.__drawModeActive ||
        event.target.closest(
          ".flowNode"
        ) ||
        editable(
          event.target
        )
      ){
        return;
      }


      if(
        !panel.contains(
          event.target
        )
      ){
        return;
      }


      event.preventDefault();

      event.stopImmediatePropagation();


      dragging =
        true;


      moved =
        false;


    /*
 * 框選模式下，一律允許追加選取。
 *
 * 不再要求持續按 Ctrl，
 * 讓滑鼠和手機觸控的操作一致。
 */
additive =
  true;


startX =
  event.clientX;


startY =
  event.clientY;


latestPointerX =
  startX;


latestPointerY =
  startY;


/*
 * 保存框選開始前已選取的 Node。
 * 新框到的 Node 會加入這個集合。
 */
selectionAtDragStart =
  new Set(
    selected
  );


      box =
        document.createElement(
          "div"
        );


      box.id =
        "fhNodeSelectBox";


      box.style.left =
        startX + "px";


      box.style.top =
        startY + "px";


      box.style.width =
        "0px";


      box.style.height =
        "0px";


      document.body.appendChild(
        box
      );

    }


    // =====================================================
    // 真正執行框選判定
    // =====================================================

    function processSelectionMove(
      clientX,
      clientY
    ){

      if(
        !dragging ||
        !box
      ){
        return;
      }


      const left =
        Math.min(
          startX,
          clientX
        );


      const top =
        Math.min(
          startY,
          clientY
        );


      const right =
        Math.max(
          startX,
          clientX
        );


      const bottom =
        Math.max(
          startY,
          clientY
        );


      if(
        !moved &&
        (
          Math.abs(
            clientX - startX
          ) > 4 ||
          Math.abs(
            clientY - startY
          ) > 4
        )
      ){
        moved =
          true;
      }


      box.style.left =
        left + "px";


      box.style.top =
        top + "px";


      box.style.width =
        right - left + "px";


      box.style.height =
        bottom - top + "px";


      /*
       * 產生這一幀框選範圍內的頁面集合。
       */
      const hitPages =
        new Set();


      core.pages.forEach(page => {

        const element =
          page.element;


        if(!element){
          return;
        }


        const rect =
          element
            .getBoundingClientRect();


        const hit =
          !(
            rect.right < left ||
            rect.left > right ||
            rect.bottom < top ||
            rect.top > bottom
          );


        if(hit){

          hitPages.add(page);

        }

      });


      /*
       * 普通框選：
       * 選取集合完全等於框內集合。
       *
       * Ctrl 框選：
       * 保留開始框選前的集合，再加上框內集合。
       */
      selected.clear();


      if(additive){

        selectionAtDragStart
          .forEach(page => {

            if(
              core.pages.includes(page)
            ){
              selected.add(page);
            }

          });

      }


      hitPages.forEach(page => {

        selected.add(page);

      });


      sync();

    }


    // =====================================================
    // pointermove 排程
    // =====================================================

    function onMove(event){

      if(
        !dragging ||
        !box
      ){
        return;
      }


      latestPointerX =
        event.clientX;


      latestPointerY =
        event.clientY;


      /*
       * 同一畫面幀內，
       * 不重複掃描全部 Node。
       */
      if(selectionFrame){
        return;
      }


      selectionFrame =
        requestAnimationFrame(
          function(){

            selectionFrame =
              0;


            processSelectionMove(
              latestPointerX,
              latestPointerY
            );

          }
        );

    }


    function cancelSelectionFrame(){

      if(!selectionFrame){
        return;
      }


      cancelAnimationFrame(
        selectionFrame
      );


      selectionFrame =
        0;

    }


    // =====================================================
    // 結束框選
    // =====================================================

    function onUp(){

      if(!dragging){
        return;
      }


      /*
       * 先取消尚未執行的動畫幀，
       * 再同步最後一次指標位置。
       */
      cancelSelectionFrame();


      if(box){

        processSelectionMove(
          latestPointerX,
          latestPointerY
        );

      }

      /*
 * 只有真的拖出框選矩形時，
 * 才攔截接下來那一次 click。
 */
if(moved){

  suppressNextCanvasClick =
    true;

}


      dragging =
        false;


      box?.remove();


      box =
        null;


      selectionAtDragStart =
        new Set();


      /*
 * 沒有實際拖曳，只是在空白處輕點：
 * 清除全部選取。
 *
 * 手機也可以用點一下空白處取消。
 */
if(!moved){

  clear();

}

    }



function suppressSelectionEndClick(
  event
){

  if(
    !suppressNextCanvasClick
  ){
    return;
  }


  suppressNextCanvasClick =
    false;


  /*
   * 阻止主程式原生的：
   * 點空白處清除多選
   * 或 Node 單選 click。
   */
  event.preventDefault();

  event.stopImmediatePropagation();

}





    // =====================================================
    // Delete 安全刪除
    // =====================================================

    async function onKey(event){

      if(
        event.key !== "Delete" ||
        event.repeat ||
        editable(
          event.target
        ) ||
        !selected.size
      ){
        return;
      }


      event.preventDefault();

      event.stopPropagation();


      const protectedPage =
        core.pages[0];


      const requested =
        Array
          .from(selected)
          .filter(
            page =>
              core.pages.includes(page)
          );


      const victims =
        requested.filter(
          page =>
            page !== protectedPage
        );


      if(!victims.length){

        selected.clear();


        if(protectedPage){

          selected.add(
            protectedPage
          );

        }


        sync();


        api.toast(
          "第一頁是專案入口，不能刪除"
        );


        return;
      }


      if(
        victims.length > 1 &&
        !confirm(
          `刪除選取的 ${victims.length} 個 Node？連向它們的選項也會一併清理。`
        )
      ){
        return;
      }


      const victimSet =
        new Set(
          victims
        );


      const deletedIds =
        victims.map(
          page =>
            page.id
        );


      const deletedIdSet =
        new Set(
          deletedIds
        );


      const survivor =
        core.pages.find(
          page =>
            !victimSet.has(page)
        ) ||
        protectedPage;


      selected.clear();

      sync();


      if(survivor){

        core.selectPage?.(
          survivor
        );

      }


      victims.forEach(page => {

        core.removePage(
          page
        );

      });


      const dual =
        window
          .DualFormatWorkspace
          ?.state;


      if(dual){

        dual.pages ||= {};


        dual.readerExperience ||= {
          nodes:{},
          export:{}
        };


        dual.readerExperience.nodes ||=
          {};


        deletedIds.forEach(id => {

          delete dual.pages[id];

          delete dual
            .readerExperience
            .nodes[id];

        });


        window
          .DualFormatWorkspace
          .loadHtml
          ?.();


        window
          .DualFormatWorkspace
          .renderHtml
          ?.();


        window
          .DualFormatWorkspace
          .renderPixiv
          ?.();

      }


      core.pages.forEach(page => {

        if(
          !Array.isArray(
            page.options
          )
        ){
          return;
        }


        page.options.forEach(
          option => {

            if(
              deletedIdSet.has(
                option.target
              )
            ){
              option.target =
                "";
            }

          }
        );

      });


      rebuildPageElementIndex();

      sync();


      core.notifyChange?.(
        "node-delete-key",
        {
          count:
            victims.length,

          deletedIds
        }
      );


      try{

        core.dataCenter
          ?.saveProject
          ?.({
            silent:true,
            auto:true
          });

      }catch(error){

        console.warn(
          "Node delete save sync",
          error
        );

      }


      setTimeout(
        function(){

          selected.clear();

          sync();


          try{

            core.dataCenter
              ?.saveProject
              ?.({
                silent:true,
                auto:true
              });

          }catch(error){}

        },
        0
      );


      api.toast(
        `已刪除 ${victims.length} 個 Node` +
        (
          requested.includes(
            protectedPage
          )
            ? "；第一頁已保留"
            : ""
        )
      );

    }


    // =====================================================
    // 新增頁面前清空框選
    // =====================================================

    const addPageButton =
      document.getElementById(
        "addPage"
      );


    function beforeAdd(){

      selected.clear();

      sync();

    }


    // =====================================================
    // DOM 監聽
    //
    // 只監聽節點新增／移除，
    // 不監聽 class，避免 sync() 自我觸發。
    // =====================================================

    let observerQueued =
      false;


    const observer =
      new MutationObserver(
        function(mutations){

          const changed =
            mutations.some(
              mutation =>
                mutation.type ===
                  "childList"
            );


          if(
            !changed ||
            observerQueued
          ){
            return;
          }


          observerQueued =
            true;


          requestAnimationFrame(
            function(){

              observerQueued =
                false;


              rebuildPageElementIndex();

              sync();

            }
          );

        }
      );


    observer.observe(
      panel,
      {
        childList:true,
        subtree:true
      }
    );


    // =====================================================
    // 安裝事件
    // =====================================================








/*
 * 必須使用 capture，
 * 才能在主程式 Node 的 pointerdown 前接管。
 */
panel.addEventListener(
  "pointerdown",
  onSelectedNodePointerDown,
  true
);


window.addEventListener(
  "pointermove",
  onGroupPointerMove,
  true
);


window.addEventListener(
  "pointerup",
  onGroupPointerUp,
  true
);


window.addEventListener(
  "pointercancel",
  onGroupPointerUp,
  true
);



panel.addEventListener(
  "click",
  suppressSelectionEndClick,
  true
);



    panel.addEventListener(
      "click",
      onNodeClick,
      true
    );


    panel.addEventListener(
      "pointerdown",
      onDown,
      true
    );


    window.addEventListener(
      "pointermove",
      onMove,
      true
    );


    window.addEventListener(
      "pointerup",
      onUp,
      true
    );


    window.addEventListener(
      "pointercancel",
      onUp,
      true
    );


    window.addEventListener(
      "keydown",
      onKey,
      true
    );


    addPageButton
      ?.addEventListener(
        "pointerdown",
        beforeAdd,
        true
      );


    sync();


    api.toast(
      "Node 框選與 Delete 刪除已啟用"
    );


    // =====================================================
// Cleanup
// =====================================================

return function cleanup(){

  /*
   * 清除框選排程
   */
  cancelSelectionFrame();


  /*
   * 清除多選群組拖曳排程與狀態
   */
  if(groupDragFrame){

    cancelAnimationFrame(
      groupDragFrame
    );

    groupDragFrame =
      0;

  }


  groupDragging =
    false;

  groupDragPointerId =
    null;

  groupDragLeadPage =
    null;

  groupDragOrigins.clear();


  /*
   * 停止 DOM Observer
   */
  observer.disconnect();


  /*
   * 移除多選群組拖曳事件
   */
  panel.removeEventListener(
    "pointerdown",
    onSelectedNodePointerDown,
    true
  );


  window.removeEventListener(
    "pointermove",
    onGroupPointerMove,
    true
  );


  window.removeEventListener(
    "pointerup",
    onGroupPointerUp,
    true
  );


  window.removeEventListener(
    "pointercancel",
    onGroupPointerUp,
    true
  );


panel.removeEventListener(
  "click",
  suppressSelectionEndClick,
  true
);


  /*
   * 移除原本框選事件
   */
  panel.removeEventListener(
    "click",
    onNodeClick,
    true
  );


  panel.removeEventListener(
    "pointerdown",
    onDown,
    true
  );


  window.removeEventListener(
    "pointermove",
    onMove,
    true
  );


  window.removeEventListener(
    "pointerup",
    onUp,
    true
  );


  window.removeEventListener(
    "pointercancel",
    onUp,
    true
  );


  window.removeEventListener(
    "keydown",
    onKey,
    true
  );


  addPageButton
    ?.removeEventListener(
      "pointerdown",
      beforeAdd,
      true
    );


  mode.removeEventListener(
    "click",
    toggleMode
  );


  /*
   * 移除殘留 UI
   */
  box?.remove();

  box =
    null;


  mode.remove();


  /*
   * 清除所有 Node 選取樣式
   */
  renderedSelected.forEach(
    page => {

      page.element
        ?.classList
        .remove(
          "fh-node-selected"
        );

    }
  );


  renderedSelected.clear();

  selected.clear();


  /*
   * 移除插件樣式
   */
  styleOff();

};

}

});