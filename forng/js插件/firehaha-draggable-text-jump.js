// @firehaha-plugin {"id":"official.draggable-text","name":"拖曳文字元件","version":"1.1.0","author":"Firehaha","description":"將正文文字建立成可使用滑鼠、手機觸控或觸控筆拖曳的互動元件，並可設定「拖曳到目標後自動跳轉頁面」"}

FirehahaPlugins.register({
  id: "official.draggable-text",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha Draggable Text 1.1 (with Drag-to-Target Jump) */
(function () {
  "use strict";

  if (window.__firehahaDraggableTextInstalled) {
    return;
  }

  window.__firehahaDraggableTextInstalled = true;

  function clean(value) {
    return String(
      value == null ? "" : value
    ).trim();
  }

  function escapeHtml(value) {
    return String(
      value == null ? "" : value
    )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  }

  /*
   * 將元件限制在閱讀器內容區附近，
   * 避免拖到視窗外之後找不到。
   */
  function clampPosition(element, x, y) {
    const parent =
      element.offsetParent ||
      element.parentElement;

    if (!parent) {
      return {
        x: x,
        y: y
      };
    }

    const parentRect =
      parent.getBoundingClientRect();

    const elementRect =
      element.getBoundingClientRect();

    const minX =
      -elementRect.width * 0.65;

    const minY =
      -elementRect.height * 0.65;

    const maxX =
      Math.max(
        minX,
        parentRect.width -
        elementRect.width * 0.35
      );

    const maxY =
      Math.max(
        minY,
        parentRect.height -
        elementRect.height * 0.35
      );

    return {
      x: Math.min(
        maxX,
        Math.max(minX, x)
      ),

      y: Math.min(
        maxY,
        Math.max(minY, y)
      )
    };
  }

  /*
   * ---- 拖曳跳轉（Drag to Target → Jump）相關輔助函式 ----
   *
   * 這些函式只服務「拖曳跳轉」元件（帶有
   * .firehaha-dragjump-source / .firehaha-dragjump-target
   * class 的節點），一般的拖曳文字元件不受影響。
   */

  function dragJumpStageOf(element) {
    return element.closest(
      ".firehaha-dragjump-stage"
    );
  }

  function dragJumpTargetOf(element) {
    const stage =
      dragJumpStageOf(element);

    return stage
      ? stage.querySelector(
          ".firehaha-dragjump-target"
        )
      : null;
  }

  /*
   * 判斷拖曳中的元件「中心點」
   * 是否落在目標區塊範圍內。
   * 用中心點判斷比整體重疊判斷更直覺，
   * 使用者只要把文字拖到框框中間就會觸發。
   */
  function isOverDragJumpTarget(element, target) {
    if (!target) {
      return false;
    }

    const elementRect =
      element.getBoundingClientRect();

    const targetRect =
      target.getBoundingClientRect();

    const centerX =
      elementRect.left +
      elementRect.width / 2;

    const centerY =
      elementRect.top +
      elementRect.height / 2;

    return (
      centerX >= targetRect.left &&
      centerX <= targetRect.right &&
      centerY >= targetRect.top &&
      centerY <= targetRect.bottom
    );
  }

  /*
   * 依照 [拖曳跳轉:...] 標籤裡填的「頁碼」文字，
   * 嘗試找到對應的頁面。
   * 支援三種寫法（依序嘗試）：
   *   1. 頁面順序編號（從 1 開始，等同編輯器 [jump:N] 的用法）
   *   2. 頁面內部 ID（進階用法，複製自編輯器）
   *   3. 頁面標題（完全相符，方便編寫者直接用標題指定）
   */
  function resolveDragJumpPage(reference) {
    const raw = clean(reference);

    if (
      !raw ||
      typeof pages === "undefined" ||
      !Array.isArray(pages)
    ) {
      return null;
    }

    const numeric = Number(raw);

    if (
      Number.isFinite(numeric) &&
      numeric > 0
    ) {
      const byIndex =
        pages[numeric - 1];

      if (byIndex) {
        return byIndex;
      }
    }

    const byId = pages.find(
      function (p) {
        return p && p.id === raw;
      }
    );

    if (byId) {
      return byId;
    }

    const byTitle = pages.find(
      function (p) {
        return (
          p &&
          clean(p.title) === raw
        );
      }
    );

    return byTitle || null;
  }

  /*
   * 實際觸發換頁。
   * show() 是主程式 reader 既有的換頁函式，
   * 這裡直接沿用，行為會跟點擊一般選項按鈕一致
   * （會記錄歷史紀錄、套用存檔點規則等）。
   */
  function performDragJump(reference) {
    const targetPage =
      resolveDragJumpPage(reference);

    if (
      targetPage &&
      typeof show === "function"
    ) {
      show(targetPage.id);
      return;
    }

    if (typeof toast === "function") {
      toast(
        "拖曳跳轉：找不到頁面「" +
        reference +
        "」"
      );
    } else {
      console.warn(
        "[Draggable Text] 拖曳跳轉找不到頁面：",
        reference
      );
    }
  }

  /*
   * 拖放成功後的收尾動作：
   * 鎖定元件、把它吸附到目標中心、
   * 給一點視覺回饋，然後延遲一小段時間再跳轉，
   * 讓使用者看得到「吸進去了」的動畫。
   */
  function completeDragJump(element, target) {
    element.dataset.dragjumpDone = "1";

    element.classList.remove(
      "is-dragging"
    );

    element.classList.add(
      "is-dropped"
    );

    target.classList.remove(
      "is-target-hover"
    );

    target.classList.add(
      "is-completed"
    );

    const stage =
      dragJumpStageOf(element);

    if (stage) {
      const stageRect =
        stage.getBoundingClientRect();

      const targetRect =
        target.getBoundingClientRect();

      const elementRect =
        element.getBoundingClientRect();

      const targetCenterX =
        targetRect.left +
        targetRect.width / 2 -
        stageRect.left;

      const targetCenterY =
        targetRect.top +
        targetRect.height / 2 -
        stageRect.top;

      const elementCenterX =
        elementRect.left +
        elementRect.width / 2 -
        stageRect.left;

      const elementCenterY =
        elementRect.top +
        elementRect.height / 2 -
        stageRect.top;

      const deltaX =
        targetCenterX -
        elementCenterX;

      const deltaY =
        targetCenterY -
        elementCenterY;

      const currentX =
        toNumber(
          element.dataset.dragX
        );

      const currentY =
        toNumber(
          element.dataset.dragY
        );

      element.style.transition =
        "transform .22s ease";

      element.style.transform =
        "translate3d(" +
        (currentX + deltaX) +
        "px," +
        (currentY + deltaY) +
        "px,0)";
    }

    const pageRef =
      target.dataset.dragjumpPage ||
      "";

    setTimeout(
      function () {
        performDragJump(pageRef);
      },
      480
    );
  }

  function bindElement(element) {
    if (
      !element ||
      element.dataset.dragTextBound === "1"
    ) {
      return;
    }

    element.dataset.dragTextBound = "1";

    const isDragJumpSource =
      element.classList.contains(
        "firehaha-dragjump-source"
      );

    let dragging = false;
    let pointerId = null;

    let startClientX = 0;
    let startClientY = 0;

    let startX =
      toNumber(element.dataset.dragX);

    let startY =
      toNumber(element.dataset.dragY);

    function applyPosition(x, y) {
      const position =
        clampPosition(
          element,
          x,
          y
        );

      element.dataset.dragX =
        String(position.x);

      element.dataset.dragY =
        String(position.y);

      element.style.transform =
        "translate3d(" +
        position.x +
        "px," +
        position.y +
        "px,0)";
    }

    applyPosition(
      startX,
      startY
    );

    element.addEventListener(
      "pointerdown",

      function (event) {
        /*
         * 已經成功拖到目標並跳轉過的元件，
         * 不再允許重新拖曳。
         */
        if (
          isDragJumpSource &&
          element.dataset.dragjumpDone === "1"
        ) {
          return;
        }

        /*
         * 滑鼠只接受左鍵。
         * 手機、觸控筆沒有這個限制。
         */
        if (
          event.pointerType === "mouse" &&
          event.button !== 0
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        dragging = true;
        pointerId = event.pointerId;

        startClientX =
          event.clientX;

        startClientY =
          event.clientY;

        startX =
          toNumber(
            element.dataset.dragX
          );

        startY =
          toNumber(
            element.dataset.dragY
          );

        element.style.transition = "";

        element.classList.add(
          "is-dragging"
        );

        try {
          element.setPointerCapture(
            pointerId
          );
        } catch (error) {
          /* 某些舊瀏覽器可能不支援 */
        }
      }
    );

    element.addEventListener(
      "pointermove",

      function (event) {
        if (
          !dragging ||
          event.pointerId !== pointerId
        ) {
          return;
        }

        event.preventDefault();

        const nextX =
          startX +
          event.clientX -
          startClientX;

        const nextY =
          startY +
          event.clientY -
          startClientY;

        applyPosition(
          nextX,
          nextY
        );

        if (isDragJumpSource) {
          const target =
            dragJumpTargetOf(element);

          if (target) {
            if (
              isOverDragJumpTarget(
                element,
                target
              )
            ) {
              target.classList.add(
                "is-target-hover"
              );
            } else {
              target.classList.remove(
                "is-target-hover"
              );
            }
          }
        }
      }
    );

    function stopDrag(event) {
      if (
        !dragging ||
        (
          event &&
          event.pointerId !== pointerId
        )
      ) {
        return;
      }

      dragging = false;

      element.classList.remove(
        "is-dragging"
      );

      try {
        if (
          pointerId != null &&
          element.hasPointerCapture(
            pointerId
          )
        ) {
          element.releasePointerCapture(
            pointerId
          );
        }
      } catch (error) {
        /* 忽略 */
      }

      pointerId = null;

      if (
        isDragJumpSource &&
        element.dataset.dragjumpDone !== "1"
      ) {
        const target =
          dragJumpTargetOf(element);

        if (
          target &&
          isOverDragJumpTarget(
            element,
            target
          )
        ) {
          completeDragJump(
            element,
            target
          );
        } else if (target) {
          target.classList.remove(
            "is-target-hover"
          );
        }
      }
    }

    element.addEventListener(
      "pointerup",
      stopDrag
    );

    element.addEventListener(
      "pointercancel",
      stopDrag
    );

    element.addEventListener(
      "lostpointercapture",
      stopDrag
    );

    /*
     * 雙擊或手機快速點兩下，回到原位。
     * 已完成拖曳跳轉的元件不再回應雙擊。
     */
    element.addEventListener(
      "dblclick",

      function (event) {
        if (
          isDragJumpSource &&
          element.dataset.dragjumpDone === "1"
        ) {
          return;
        }

        event.preventDefault();

        element.style.transition = "";

        applyPosition(0, 0);

        if (isDragJumpSource) {
          const target =
            dragJumpTargetOf(element);

          if (target) {
            target.classList.remove(
              "is-target-hover"
            );
          }
        }
      }
    );
  }

  window.bindFirehahaDraggableText =
    function () {
      document
        .querySelectorAll(
          ".firehaha-draggable-text"
        )
        .forEach(bindElement);
    };

  window.FirehahaDraggableText = {
    version: "1.1.0",

    resetAll: function () {
      document
        .querySelectorAll(
          ".firehaha-draggable-text"
        )
        .forEach(function (element) {
          element.dataset.dragX = "0";
          element.dataset.dragY = "0";
          element.dataset.dragjumpDone = "";
          element.style.transition = "";
          element.style.transform =
            "translate3d(0,0,0)";
          element.classList.remove(
            "is-dropped"
          );
        });

      document
        .querySelectorAll(
          ".firehaha-dragjump-target"
        )
        .forEach(function (target) {
          target.classList.remove(
            "is-completed",
            "is-target-hover"
          );
        });
    }
  };

  if (
    !document.getElementById(
      "firehaha-draggable-text-style"
    )
  ) {
    const style =
      document.createElement("style");

    style.id =
      "firehaha-draggable-text-style";

    style.textContent = [
      ".firehaha-draggable-text-stage{",
      "position:relative;",
      "min-height:90px;",
      "margin:16px 0;",
      "padding:14px;",
      "overflow:hidden;",
      "border:1px dashed rgba(80,90,110,.35);",
      "border-radius:12px;",
      "background:rgba(245,247,250,.72);",
      "}",

      ".firehaha-draggable-text{",
      "position:relative;",
      "display:inline-flex;",
      "align-items:center;",
      "justify-content:center;",
      "max-width:100%;",
      "padding:10px 16px;",
      "border:1px solid rgba(70,80,100,.22);",
      "border-radius:10px;",
      "background:#fff;",
      "box-shadow:0 4px 13px rgba(0,0,0,.13);",
      "font-weight:700;",
      "line-height:1.5;",
      "word-break:break-word;",
      "cursor:grab;",
      "user-select:none;",
      "-webkit-user-select:none;",
      "touch-action:none;",
      "-webkit-touch-callout:none;",
      "-webkit-tap-highlight-color:transparent;",
      "will-change:transform;",
      "transform:translate3d(0,0,0);",
      "transition:box-shadow .12s ease,",
      "opacity .12s ease;",
      "z-index:6;",
      "}",

      ".firehaha-draggable-text:hover{",
      "box-shadow:0 7px 18px rgba(0,0,0,.18);",
      "}",

      ".firehaha-draggable-text.is-dragging{",
      "z-index:20;",
      "cursor:grabbing;",
      "opacity:.92;",
      "box-shadow:0 12px 28px rgba(0,0,0,.28);",
      "}",

      ".firehaha-draggable-text-hint{",
      "display:block;",
      "margin-top:8px;",
      "color:#77808d;",
      "font-size:11px;",
      "line-height:1.4;",
      "pointer-events:none;",
      "}",

      /* ---- 拖曳跳轉樣式 ---- */

      ".firehaha-dragjump-stage{",
      "min-height:120px;",
      "padding:16px 132px 16px 16px;",
      "}",

      ".firehaha-draggable-text.is-dropped{",
      "cursor:default;",
      "box-shadow:0 0 0 3px rgba(46,125,50,.35),",
      "0 8px 20px rgba(0,0,0,.18);",
      "}",

      ".firehaha-dragjump-target{",
      "position:absolute;",
      "right:14px;",
      "top:50%;",
      "transform:translateY(-50%);",
      "width:104px;",
      "height:78px;",
      "display:flex;",
      "flex-direction:column;",
      "align-items:center;",
      "justify-content:center;",
      "gap:2px;",
      "padding:6px;",
      "box-sizing:border-box;",
      "border:2px dashed rgba(46,125,50,.55);",
      "border-radius:14px;",
      "background:rgba(232,245,233,.55);",
      "color:#2e7d32;",
      "font-size:11px;",
      "font-weight:700;",
      "line-height:1.3;",
      "text-align:center;",
      "pointer-events:none;",
      "z-index:2;",
      "transition:background .15s ease,",
      "border-color .15s ease,",
      "box-shadow .15s ease,",
      "transform .15s ease;",
      "}",

      ".firehaha-dragjump-target-icon{",
      "font-size:18px;",
      "line-height:1;",
      "}",

      ".firehaha-dragjump-target.is-target-hover{",
      "background:rgba(46,125,50,.18);",
      "border-color:#2e7d32;",
      "border-style:solid;",
      "box-shadow:0 0 0 4px rgba(46,125,50,.15);",
      "transform:translateY(-50%) scale(1.05);",
      "}",

      ".firehaha-dragjump-target.is-completed{",
      "background:rgba(46,125,50,.28);",
      "border-style:solid;",
      "border-color:#1b5e20;",
      "color:#1b5e20;",
      "}",

      "@media(max-width:700px){",
      ".firehaha-draggable-text-stage{",
      "min-height:120px;",
      "padding:12px;",
      "}",
      ".firehaha-draggable-text{",
      "min-height:44px;",
      "padding:12px 16px;",
      "}",
      ".firehaha-dragjump-stage{",
      "padding:14px 14px 112px 14px;",
      "}",
      ".firehaha-dragjump-target{",
      "right:50%;",
      "top:auto;",
      "bottom:12px;",
      "transform:translateX(50%);",
      "}",
      ".firehaha-dragjump-target.is-target-hover{",
      "transform:translateX(50%) scale(1.05);",
      "}",
      "}"
    ].join("");

    document.head.appendChild(style);
  }

  const originalApplyAdventure =
    applyAdventure;

  applyAdventure = function (page) {
    let html =
      originalApplyAdventure(page);

    try {
      /*
       * 基本格式（純拖曳定位，不會換頁）：
       *
       * [拖曳文字:把我拖走]
       *
       * 第二個參數可設定提示文字：
       *
       * [拖曳文字:鑰匙|拖曳這段文字]
       */
      html = String(html).replace(
        /\[(?:拖曳文字|dragtext)\s*:\s*([^\]|]+?)(?:\s*\|\s*([^\]]*?))?\s*\]/gi,

        function (
          full,
          rawText,
          rawHint
        ) {
          const text =
            clean(rawText);

          const hint =
            clean(rawHint);

          if (!text) {
            return "";
          }

          return (
            '<div class="' +
            'firehaha-draggable-text-stage">' +

            '<span' +
            ' class="firehaha-draggable-text"' +
            ' data-drag-x="0"' +
            ' data-drag-y="0"' +
            ' tabindex="0">' +

            escapeHtml(text) +

            "</span>" +

            (
              hint
                ? (
                    '<span class="' +
                    'firehaha-draggable-text-hint">' +
                    escapeHtml(hint) +
                    "</span>"
                  )
                : ""
            ) +

            "</div>"
          );
        }
      );

      /*
       * 拖曳跳轉格式（拖到目標後自動換頁）：
       *
       * [拖曳跳轉:文字|提示|頁碼]
       *
       * 例如：
       * [拖曳跳轉:鑰匙|拖到門上|5]
       *
       * 「頁碼」可以是：
       *  1. 頁面順序編號（從 1 開始，等同編輯器 [jump:N] 的用法）
       *  2. 頁面內部 ID（進階用法）
       *  3. 頁面標題（完全相符）
       *
       * 提示文字可留空，預設會顯示「拖到這裡」。
       */
      html = String(html).replace(
        /\[(?:拖曳跳轉|dragjump)\s*:\s*([^\]|]+?)\s*\|\s*([^\]|]*?)\s*\|\s*([^\]]+?)\s*\]/gi,

        function (
          full,
          rawText,
          rawHint,
          rawTarget
        ) {
          const text =
            clean(rawText);

          const hint =
            clean(rawHint) ||
            "拖到這裡";

          const pageRef =
            clean(rawTarget);

          if (!text || !pageRef) {
            return "";
          }

          return (
            '<div class="' +
            'firehaha-draggable-text-stage ' +
            'firehaha-dragjump-stage">' +

            '<div class="firehaha-dragjump-target"' +
            ' data-dragjump-page="' +
            escapeHtml(pageRef) +
            '">' +

            '<span class="' +
            'firehaha-dragjump-target-icon"' +
            ' aria-hidden="true">🎯</span>' +

            '<span class="' +
            'firehaha-dragjump-target-label">' +
            escapeHtml(hint) +
            "</span>" +

            "</div>" +

            '<span' +
            ' class="firehaha-draggable-text' +
            ' firehaha-dragjump-source"' +
            ' data-drag-x="0"' +
            ' data-drag-y="0"' +
            ' tabindex="0">' +

            escapeHtml(text) +

            "</span>" +

            "</div>"
          );
        }
      );

    } catch (error) {
      console.warn(
        "[Draggable Text]",
        error
      );
    }

    return html;
  };
})();
`;

    const removeTransform =
      api.registerReaderTransform(
        "draggable-text",

        function (html) {
          html = String(
            html == null ? "" : html
          );

          const marker =
            "function renderAdventure(){";

          if (!html.includes(marker)) {
            console.warn(
              "[Draggable Text] 找不到閱讀器插入位置"
            );

            return html;
          }

          html = html.replace(
            marker,
            patchCode + "\n" + marker
          );

          /*
           * 閱讀器每次重建頁面內容後重新綁定。
           */
          html = html.replace(
            /bindStoryDice\(\);/g,

            "bindStoryDice();" +
            "if(typeof bindFirehahaDraggableText==='function')" +
            "bindFirehahaDraggableText();"
          );

          return html;
        },

        265
      );

    api.toast(
      "拖曳文字元件已啟用（含拖曳跳轉）"
    );

    return function cleanup() {
      removeTransform();
    };
  }
});
