// @firehaha-plugin {"id":"official.draggable-text","name":"拖曳文字元件","version":"1.0.0","author":"Firehaha","description":"將正文文字建立成可使用滑鼠、手機觸控或觸控筆拖曳的互動元件"}

FirehahaPlugins.register({
  id: "official.draggable-text",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha Draggable Text 1.0 */
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

  function bindElement(element) {
    if (
      !element ||
      element.dataset.dragTextBound === "1"
    ) {
      return;
    }

    element.dataset.dragTextBound = "1";

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
     */
    element.addEventListener(
      "dblclick",

      function (event) {
        event.preventDefault();

        applyPosition(0, 0);
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
    version: "1.0.0",

    resetAll: function () {
      document
        .querySelectorAll(
          ".firehaha-draggable-text"
        )
        .forEach(function (element) {
          element.dataset.dragX = "0";
          element.dataset.dragY = "0";
          element.style.transform =
            "translate3d(0,0,0)";
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

      "@media(max-width:700px){",
      ".firehaha-draggable-text-stage{",
      "min-height:120px;",
      "padding:12px;",
      "}",
      ".firehaha-draggable-text{",
      "min-height:44px;",
      "padding:12px 16px;",
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
       * 基本格式：
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
      "拖曳文字元件已啟用"
    );

    return function cleanup() {
      removeTransform();
    };
  }
});