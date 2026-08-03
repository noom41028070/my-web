// @firehaha-plugin {"id":"official.drawing-zoom-coordinate-fix","name":"畫筆縮放座標修正","version":"1.0.0","author":"Firehaha","description":"修正流程畫布縮放後自由畫筆與局部橡皮擦的座標偏移，支援滑鼠、觸控與手寫筆。"}

FirehahaPlugins.register({

  id:
    "official.drawing-zoom-coordinate-fix",

  name:
    "畫筆縮放座標修正",

  version:
    "1.0.0",


  async setup(api){

    "use strict";


    // =====================================================
    // 等待主程式畫筆模組
    // =====================================================

    const READY_TIMEOUT =
      12000;


    const startedAt =
      Date.now();


    while(
      (
        !document.getElementById(
          "flowCanvas"
        ) ||
        !document.getElementById(
          "flowPanel"
        ) ||
        !document.getElementById(
          "drawLayer"
        ) ||
        !document.getElementById(
          "draw-toolbar"
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


    const flowCanvas =
      document.getElementById(
        "flowCanvas"
      );


    const flowPanel =
      document.getElementById(
        "flowPanel"
      );


    const drawLayer =
      document.getElementById(
        "drawLayer"
      );


    const drawToolbar =
      document.getElementById(
        "draw-toolbar"
      );


    const eraserCursor =
      document.getElementById(
        "eraser-cursor"
      );


    if(
      !flowCanvas ||
      !flowPanel ||
      !drawLayer ||
      !drawToolbar
    ){

      throw new Error(
        "找不到主程式畫筆模組"
      );

    }


    // =====================================================
    // 狀態
    // =====================================================

    let drawColor =
      "#e53935";


    let drawWidth =
      3;


    let eraserMode =
      false;


    let currentPath =
      null;


    let currentPoints =
      null;


    let drawing =
      false;


    let erasing =
      false;


    let activePointerId =
      null;


    let destroyed =
      false;


    let correctedPointCount =
      0;


    let completedStrokeCount =
      0;


    let erasedStrokeCount =
      0;


    const svgNS =
      "http://www.w3.org/2000/svg";


    // =====================================================
    // 工具
    // =====================================================

    function markProjectDirty(){

      if(
        typeof window.markDirty ===
          "function"
      ){

        try{

          window.markDirty();

        }catch(error){}

      }


      if(
        window.GamebookCore &&
        typeof window.GamebookCore
          .notifyChange ===
          "function"
      ){

        try{

          window.GamebookCore
            .notifyChange(
              "drawing-zoom-coordinate-fix"
            );

        }catch(error){}

      }

    }


    function pointsToD(points){

      if(
        !Array.isArray(points) ||
        !points.length
      ){

        return "";

      }


      return points
        .map(
          (point,index) => {

            return (
              index === 0
                ? "M "
                : "L "
            ) +
            point[0] +
            " " +
            point[1];

          }
        )
        .join(" ");

    }


    function parseDToPoints(d){

      const points =
        [];


      if(!d){
        return points;
      }


      const pattern =
        /[ML]\s*(-?[0-9.]+)\s+(-?[0-9.]+)/g;


      let match;


      while(
        (
          match =
            pattern.exec(d)
        )
      ){

        points.push([
          Number(match[1]),
          Number(match[2])
        ]);

      }


      return points;

    }


    /*
     * 優先使用主程式公開的縮放倍率。
     *
     * 若變數不存在，則利用實際顯示寬度
     * 與未縮放寬度反推出倍率。
     */
    function getCanvasScale(){

      const publicScale =
        Number(
          window.__flowCanvasScale
        );


      if(
        Number.isFinite(
          publicScale
        ) &&
        publicScale > 0
      ){

        return publicScale;

      }


      const rect =
        flowCanvas
          .getBoundingClientRect();


      const naturalWidth =
        flowCanvas.offsetWidth;


      if(
        naturalWidth > 0 &&
        rect.width > 0
      ){

        const measured =
          rect.width /
          naturalWidth;


        if(
          Number.isFinite(
            measured
          ) &&
          measured > 0
        ){

          return measured;

        }

      }


      return 1;

    }


    /*
     * 將瀏覽器畫面座標轉回未縮放的
     * flowCanvas 邏輯座標。
     *
     * getBoundingClientRect() 已經包含：
     * - flowPanel 捲動
     * - 畫布在視窗中的位置
     * - CSS transform 後的位置
     *
     * 因此只需要減去 rect.left/top，
     * 再除以縮放倍率。
     */
    function clientToCanvas(
      clientX,
      clientY
    ){

      const rect =
        flowCanvas
          .getBoundingClientRect();


      const scale =
        getCanvasScale();


      correctedPointCount++;


      return {

        x:
          (
            clientX -
            rect.left
          ) /
          scale,

        y:
          (
            clientY -
            rect.top
          ) /
          scale,

        scale

      };

    }


    function isDrawModeActive(){

      return (
        window.__drawModeActive ===
          true ||
        flowPanel.classList.contains(
          "drawing-active"
        )
      );

    }


    function currentEraserRadius(){

      return Math.max(
        14,
        drawWidth * 5
      );

    }


    function updateEraserCursor(
      clientX,
      clientY
    ){

      if(!eraserCursor){
        return;
      }


      /*
       * 筆刷寬度與橡皮擦半徑都是畫布邏輯尺寸。
       * 畫布放大後，游標在螢幕上的大小也應同步放大。
       */
      const screenRadius =
        currentEraserRadius() *
        getCanvasScale();


      eraserCursor.style.width =
        screenRadius * 2 +
        "px";


      eraserCursor.style.height =
        screenRadius * 2 +
        "px";


      eraserCursor.style.left =
        clientX -
        screenRadius +
        "px";


      eraserCursor.style.top =
        clientY -
        screenRadius +
        "px";


      eraserCursor.style.display =
        "block";

    }


    function hideEraserCursor(){

      if(eraserCursor){

        eraserCursor.style.display =
          "none";

      }

    }


    function renderDrawings(){

      if(
        typeof window.renderDrawings ===
          "function"
      ){

        window.renderDrawings();

      }

    }


    // =====================================================
    // 工具列狀態同步
    // =====================================================

function syncToolbarState(){

  const activeColor =
    drawToolbar.querySelector(
      ".draw-color.active[data-color]"
    );


  if(activeColor?.dataset.color){

    drawColor =
      activeColor.dataset.color;

  }


  const eraserButton =
    document.getElementById(
      "draw-eraser-btn"
    );


  /*
   * 初次載入時只同步按鈕外觀。
   * 後續切換完全由補丁自己的
   * onToolbarClickCapture 控制。
   */
  eraserMode =
    eraserButton
      ?.classList
      .contains(
        "active-tool"
      ) === true;


  if(eraserMode){

    drawToolbar
      .querySelectorAll(
        ".draw-color"
      )
      .forEach(dot => {

        dot.classList.remove(
          "active"
        );

      });

  }

}


    function onToolbarClickCapture(
  event
){

  /*
   * 橡皮擦按鈕：
   * 由補丁完整接管，阻止主程式閉包內
   * 另一套 eraserMode 再切換一次。
   */
  const eraserButton =
    event.target.closest?.(
      "#draw-eraser-btn"
    );


  if(eraserButton){

    event.preventDefault();

    event.stopPropagation();

    event.stopImmediatePropagation();


    eraserMode =
      !eraserMode;


    eraserButton.classList.toggle(
      "active-tool",
      eraserMode
    );


    if(eraserMode){

      /*
       * 進入橡皮擦時取消顏色選取提示，
       * 但保留 drawColor，之後切回畫筆仍可沿用。
       */
      drawToolbar
        .querySelectorAll(
          ".draw-color"
        )
        .forEach(dot => {

          dot.classList.remove(
            "active"
          );

        });


      /*
       * 清除尚未完成的畫筆暫存。
       */
      if(currentPath){

        currentPath.remove();

      }


      currentPath =
        null;

      currentPoints =
        null;

      drawing =
        false;


      api.toast(
        "橡皮擦模式"
      );

    }else{

      erasing =
        false;

      hideEraserCursor();


      /*
       * 關閉橡皮擦後恢復目前顏色的選取提示。
       */
      const colorDot =
        Array.from(
          drawToolbar.querySelectorAll(
            ".draw-color[data-color]"
          )
        ).find(dot => {

          return (
            dot.dataset.color ===
            drawColor
          );

        });


      colorDot?.classList.add(
        "active"
      );


      api.toast(
        "畫筆模式"
      );

    }


    return;

  }


  /*
   * 點擊顏色：
   * 切回畫筆模式。
   */
  const colorButton =
    event.target.closest?.(
      ".draw-color[data-color]"
    );


  if(colorButton){

    drawColor =
      colorButton.dataset.color ||
      drawColor;


    eraserMode =
      false;

    erasing =
      false;


    hideEraserCursor();


    const originalEraserButton =
      document.getElementById(
        "draw-eraser-btn"
      );


    originalEraserButton
      ?.classList
      .remove(
        "active-tool"
      );


    drawToolbar
      .querySelectorAll(
        ".draw-color"
      )
      .forEach(dot => {

        dot.classList.toggle(
          "active",
          dot === colorButton
        );

      });


    return;

  }


  /*
   * 筆刷粗細：
   * 只改寬度，不自動切換畫筆／橡皮擦。
   * 因此橡皮擦模式下也能調整擦除範圍。
   */
  const widthButton =
    event.target.closest?.(
      "button[data-w]"
    );


  if(widthButton){

    const nextWidth =
      Number(
        widthButton.dataset.w
      );


    if(
      Number.isFinite(
        nextWidth
      ) &&
      nextWidth > 0
    ){

      drawWidth =
        nextWidth;

    }

  }

}

    // =====================================================
    // 局部橡皮擦
    // =====================================================
/*
 * 計算某一點到線段的最短距離平方。
 *
 * 用平方避免大量 Math.sqrt，
 * 橡皮擦移動時會比較省效能。
 */
function pointToSegmentDistanceSquared(
  px,
  py,
  ax,
  ay,
  bx,
  by
){

  const abX =
    bx - ax;

  const abY =
    by - ay;


  const lengthSquared =
    abX * abX +
    abY * abY;


  if(lengthSquared === 0){

    const dx =
      px - ax;

    const dy =
      py - ay;


    return (
      dx * dx +
      dy * dy
    );

  }


  let t =
    (
      (px - ax) * abX +
      (py - ay) * abY
    ) /
    lengthSquared;


  t =
    Math.max(
      0,
      Math.min(
        1,
        t
      )
    );


  const nearestX =
    ax +
    t * abX;


  const nearestY =
    ay +
    t * abY;


  const dx =
    px - nearestX;

  const dy =
    py - nearestY;


  return (
    dx * dx +
    dy * dy
  );

}

  function eraseNear(position){

  const drawings =
    Array.isArray(
      window.allDrawings
    )
      ? window.allDrawings
      : [];


  if(!drawings.length){
    return false;
  }


  const radius =
    currentEraserRadius();


  const radiusSquared =
    radius * radius;


  let changed =
    false;


  const rebuilt =
    [];


  drawings.forEach(stroke => {

    const originalPoints =
      (
        Array.isArray(
          stroke.points
        ) &&
        stroke.points.length
      )
        ? stroke.points
        : parseDToPoints(
            stroke.d || ""
          );


    if(originalPoints.length < 2){

      /*
       * 單點資料：
       * 直接判斷點是否落在橡皮擦內。
       */
      if(originalPoints.length === 1){

        const dx =
          originalPoints[0][0] -
          position.x;


        const dy =
          originalPoints[0][1] -
          position.y;


        if(
          dx * dx +
          dy * dy >
          radiusSquared
        ){

          rebuilt.push({

            ...stroke,

            points:
              originalPoints.map(
                point => [
                  point[0],
                  point[1]
                ]
              )

          });

        }else{

          changed =
            true;

        }

      }


      return;

    }


    /*
     * 標記每一段線是否與橡皮擦圓形相交。
     */
    const erasedSegments =
      new Array(
        originalPoints.length - 1
      ).fill(false);


    for(
      let index = 0;
      index <
        originalPoints.length - 1;
      index++
    ){

      const a =
        originalPoints[index];


      const b =
        originalPoints[index + 1];


      const distanceSquared =
        pointToSegmentDistanceSquared(
          position.x,
          position.y,
          a[0],
          a[1],
          b[0],
          b[1]
        );


      if(
        distanceSquared <=
        radiusSquared
      ){

        erasedSegments[index] =
          true;

        changed =
          true;

      }

    }


    /*
     * 完全沒碰到這條線：
     * 保留原始資料，不需要拆分。
     */
    if(
      !erasedSegments.some(
        Boolean
      )
    ){

      rebuilt.push({

        ...stroke,

        points:
          originalPoints.map(
            point => [
              point[0],
              point[1]
            ]
          )

      });


      return;

    }


    /*
     * 將沒有被擦到的連續線段重新組成多條筆畫。
     */
    let run =
      [];


    function flushRun(){

      if(run.length >= 2){

        rebuilt.push({

          ...stroke,

          points:
            run,

          /*
           * 避免舊 d 優先於新 points。
           */
          d:
            undefined

        });

      }


      run =
        [];

    }


    for(
      let index = 0;
      index <
        erasedSegments.length;
      index++
    ){

      const a =
        originalPoints[index];


      const b =
        originalPoints[index + 1];


      if(erasedSegments[index]){

        flushRun();

        continue;

      }


      if(run.length === 0){

        run.push([
          a[0],
          a[1]
        ]);

      }


      run.push([
        b[0],
        b[1]
      ]);

    }


    flushRun();

  });


  if(!changed){
    return false;
  }


  window.allDrawings =
    rebuilt;


  erasedStrokeCount++;


  /*
   * 仍沿用主程式公開的渲染函式，
   * 保持存讀格式一致。
   */
  renderDrawings();


  markProjectDirty();


  return true;

}


    // =====================================================
    // 畫筆接管
    // =====================================================

    function stopNativeDrawingEvent(
      event
    ){

      /*
       * 使用 capture=true 安裝，
       * 在主程式原生畫筆事件前阻止它繼續執行。
       *
       * 否則主程式舊座標與插件新座標
       * 會同時畫出兩條線。
       */
      event.preventDefault();

      event.stopPropagation();

      event.stopImmediatePropagation();

    }


    function onPointerDown(
      event
    ){

      if(
        destroyed ||
        !isDrawModeActive()
      ){

        return;

      }


      if(
        event.button !== undefined &&
        event.button !== 0 &&
        event.pointerType !== "touch"
      ){

        return;

      }


      stopNativeDrawingEvent(
        event
      );


      activePointerId =
        event.pointerId;


      try{

        drawLayer.setPointerCapture(
          event.pointerId
        );

      }catch(error){}


      const position =
        clientToCanvas(
          event.clientX,
          event.clientY
        );


      if(eraserMode){

        erasing =
          true;


        updateEraserCursor(
          event.clientX,
          event.clientY
        );


        eraseNear(
          position
        );


        return;

      }


      drawing =
        true;


      currentPoints = [[
        position.x,
        position.y
      ]];


      currentPath =
        document.createElementNS(
          svgNS,
          "path"
        );


      currentPath.setAttribute(
        "d",
        pointsToD(
          currentPoints
        )
      );


      currentPath.setAttribute(
        "fill",
        "none"
      );


      currentPath.setAttribute(
        "stroke",
        drawColor
      );


      currentPath.setAttribute(
        "stroke-width",
        drawWidth
      );


      currentPath.setAttribute(
        "stroke-linecap",
        "round"
      );


      currentPath.setAttribute(
        "stroke-linejoin",
        "round"
      );


      drawLayer.appendChild(
        currentPath
      );

    }


    function onPointerMove(
      event
    ){

      if(
        destroyed ||
        !isDrawModeActive()
      ){

        return;

      }


      /*
       * 畫筆模式開啟時，要攔住主程式原本的
       * pointermove，即使目前尚未按下。
       *
       * 否則橡皮擦游標仍可能被舊邏輯改回錯誤尺寸。
       */
      stopNativeDrawingEvent(
        event
      );


      if(
        eraserMode
      ){

        updateEraserCursor(
          event.clientX,
          event.clientY
        );


        if(
          erasing &&
          (
            activePointerId === null ||
            event.pointerId ===
              activePointerId
          )
        ){

          eraseNear(
            clientToCanvas(
              event.clientX,
              event.clientY
            )
          );

        }


        return;

      }


      if(
        !drawing ||
        !currentPath ||
        !currentPoints ||
        (
          activePointerId !== null &&
          event.pointerId !==
            activePointerId
        )
      ){

        return;

      }


      const position =
        clientToCanvas(
          event.clientX,
          event.clientY
        );


      const lastPoint =
        currentPoints[
          currentPoints.length - 1
        ];


      /*
       * 過濾極小移動，避免高更新率手寫筆
       * 每秒塞入過多完全相近的點。
       */
      const dx =
        position.x -
        lastPoint[0];


      const dy =
        position.y -
        lastPoint[1];


      if(
        dx * dx +
        dy * dy <
        0.16
      ){

        return;

      }


      currentPoints.push([
        position.x,
        position.y
      ]);


      currentPath.setAttribute(
        "d",
        pointsToD(
          currentPoints
        )
      );

    }


    function finishStroke(
      event
    ){

      if(
        destroyed ||
        !isDrawModeActive()
      ){

        return;

      }


      stopNativeDrawingEvent(
        event
      );


      if(
        activePointerId !== null &&
        event.pointerId !== undefined &&
        event.pointerId !==
          activePointerId
      ){

        return;

      }


      if(
        currentPath &&
        currentPoints &&
        currentPoints.length >= 2
      ){

        window.allDrawings =
          Array.isArray(
            window.allDrawings
          )
            ? window.allDrawings
            : [];


        window.allDrawings.push({

          points:
            currentPoints,

          color:
            drawColor,

          width:
            drawWidth

        });


        completedStrokeCount++;


        markProjectDirty();

      }else if(currentPath){

        /*
         * 單點沒有形成有效線段，
         * 從 SVG 移除暫存 path。
         */
        currentPath.remove();

      }


      drawing =
        false;


      erasing =
        false;


      currentPath =
        null;


      currentPoints =
        null;


      activePointerId =
        null;

    }


    function onPointerLeave(){

      if(
        eraserMode &&
        !erasing
      ){

        hideEraserCursor();

      }

    }


    // =====================================================
    // 縮放與圖層同步
    // =====================================================

    function onWheelOrResize(){

      /*
       * 縮放時若正在畫線，先安全結束，
       * 避免同一條筆畫跨越兩種倍率。
       */
      if(
        drawing ||
        erasing
      ){

        drawing =
          false;

        erasing =
          false;

        currentPath?.remove();

        currentPath =
          null;

        currentPoints =
          null;

        activePointerId =
          null;

      }


      hideEraserCursor();

    }


    // =====================================================
    // 安裝事件
    // =====================================================

    syncToolbarState();


    drawToolbar.addEventListener(
      "click",
      onToolbarClickCapture,
      true
    );


    /*
     * capture=true 是此補丁的核心。
     * 必須在主程式舊的 bubble 監聽器前接管。
     */
    drawLayer.addEventListener(
      "pointerdown",
      onPointerDown,
      true
    );


    drawLayer.addEventListener(
      "pointermove",
      onPointerMove,
      true
    );


    drawLayer.addEventListener(
      "pointerup",
      finishStroke,
      true
    );


    drawLayer.addEventListener(
      "pointercancel",
      finishStroke,
      true
    );


    drawLayer.addEventListener(
      "pointerleave",
      onPointerLeave,
      true
    );


    flowPanel.addEventListener(
      "wheel",
      onWheelOrResize,
      true
    );


    window.addEventListener(
      "resize",
      onWheelOrResize
    );


    const DrawingZoomFix = {

      version:
        "1.0.0",


      clientToCanvas(
        clientX,
        clientY
      ){

        return clientToCanvas(
          clientX,
          clientY
        );

      },


      getScale(){

        return getCanvasScale();

      },


      getStats(){

        return {

          scale:
            getCanvasScale(),

          drawColor,

          drawWidth,

          eraserMode,

          drawing,

          erasing,

          correctedPointCount,

          completedStrokeCount,

          erasedStrokeCount

        };

      }

    };


    window.FirehahaDrawingZoomFix =
      DrawingZoomFix;


    api.toast(
      "畫筆縮放座標修正已啟用"
    );


    // =====================================================
    // Cleanup
    // =====================================================

    return function cleanup(){

      destroyed =
        true;


      drawToolbar.removeEventListener(
        "click",
        onToolbarClickCapture,
        true
      );


      drawLayer.removeEventListener(
        "pointerdown",
        onPointerDown,
        true
      );


      drawLayer.removeEventListener(
        "pointermove",
        onPointerMove,
        true
      );


      drawLayer.removeEventListener(
        "pointerup",
        finishStroke,
        true
      );


      drawLayer.removeEventListener(
        "pointercancel",
        finishStroke,
        true
      );


      drawLayer.removeEventListener(
        "pointerleave",
        onPointerLeave,
        true
      );


      flowPanel.removeEventListener(
        "wheel",
        onWheelOrResize,
        true
      );


      window.removeEventListener(
        "resize",
        onWheelOrResize
      );


      currentPath?.remove();


      drawing =
        false;

      erasing =
        false;

      currentPath =
        null;

      currentPoints =
        null;

      activePointerId =
        null;


      hideEraserCursor();


      if(
        window.FirehahaDrawingZoomFix ===
        DrawingZoomFix
      ){

        delete window
          .FirehahaDrawingZoomFix;

      }

    };

  }

});