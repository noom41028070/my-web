// @firehaha-plugin {"id":"official.reader-button-themes","name":"閱讀器多樣按鈕樣式","version":"1.0.0","author":"Firehaha","description":"讓每一頁分別指定音樂、選項與純文字按鈕的外觀樣式"}

FirehahaPlugins.register({
  id: "official.reader-button-themes",

  setup(api) {
    "use strict";

    /*
     * Keep the injected reader runtime as a real function and serialize it
     * below.  The old implementation wrapped this whole block in a template
     * literal, but the CSS inside it also uses a template literal.  Those
     * nested backticks ended the outer string early and made this file fail
     * to parse before the plugin could register.
     */
    function installReaderButtonThemes() {
  "use strict";

  if (window.__firehahaButtonThemesInstalled) {
    return;
  }

  window.__firehahaButtonThemesInstalled = true;

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

  /*
   * 中文名稱、英文名稱都可以使用。
   */
  const styleAliases = {
    "預設": "default",
    "default": "default",

    "藍色": "blue",
    "藍": "blue",
    "blue": "blue",

    "綠色": "green",
    "綠": "green",
    "green": "green",

    "紅色": "red",
    "紅": "red",
    "red": "red",

    "金色": "gold",
    "金": "gold",
    "gold": "gold",

    "紫色": "purple",
    "紫": "purple",
    "purple": "purple",

    "黑色": "dark",
    "黑": "dark",
    "暗色": "dark",
    "dark": "dark",

    "文字": "text",
    "純文字": "text",
    "text": "text",

    "外框": "outline",
    "線框": "outline",
    "outline": "outline",

    "圓角": "round",
    "膠囊": "round",
    "round": "round",

    "方形": "square",
    "square": "square",

    "玻璃": "glass",
    "透明": "glass",
    "glass": "glass",

    "紙張": "paper",
    "紙片": "paper",
    "paper": "paper",

    "像素": "pixel",
    "pixel": "pixel",

    "霓虹": "neon",
    "neon": "neon"
  };

  function normalizeStyle(value) {
    const name =
      clean(value).toLowerCase();

    return (
      styleAliases[name] ||
      styleAliases[clean(value)] ||
      "default"
    );
  }

  /*
   * 插入閱讀器樣式。
   */
  if (
    !document.getElementById(
      "firehaha-reader-button-theme-style"
    )
  ) {
    const style =
      document.createElement("style");

    style.id =
      "firehaha-reader-button-theme-style";

    style.textContent = String.raw`
.firehaha-page-button-theme {
  --fh-btn-bg:#3f7de8;
  --fh-btn-color:#fff;
  --fh-btn-border:#3f7de8;
  --fh-btn-shadow:0 4px 12px rgba(30,70,150,.25);

  display:block;
  width:100%;
}

.firehaha-page-button-theme button,
.firehaha-page-button-theme .firehaha-themed-button,
.firehaha-page-button-theme .option-button,
.firehaha-page-button-theme .choice-button,
.firehaha-page-button-theme .story-option {
  appearance:none;
  -webkit-appearance:none;

  display:inline-flex;
  align-items:center;
  justify-content:center;

  min-height:42px;
  margin:5px 4px;
  padding:9px 17px;

  border:1px solid var(--fh-btn-border);
  border-radius:10px;

  background:var(--fh-btn-bg);
  color:var(--fh-btn-color);

  box-shadow:var(--fh-btn-shadow);

  font:inherit;
  font-weight:700;
  line-height:1.4;
  text-align:center;
  text-decoration:none;

  cursor:pointer;
  user-select:none;
  -webkit-user-select:none;
  touch-action:manipulation;
  -webkit-tap-highlight-color:transparent;

  transition:
    transform .12s ease,
    filter .12s ease,
    box-shadow .12s ease,
    background .12s ease;
}

.firehaha-page-button-theme button:hover,
.firehaha-page-button-theme .firehaha-themed-button:hover,
.firehaha-page-button-theme .option-button:hover,
.firehaha-page-button-theme .choice-button:hover,
.firehaha-page-button-theme .story-option:hover {
  filter:brightness(1.07);
  transform:translateY(-1px);
}

.firehaha-page-button-theme button:active,
.firehaha-page-button-theme .firehaha-themed-button:active,
.firehaha-page-button-theme .option-button:active,
.firehaha-page-button-theme .choice-button:active,
.firehaha-page-button-theme .story-option:active {
  transform:scale(.97);
}

.firehaha-page-button-theme button:focus-visible,
.firehaha-page-button-theme .firehaha-themed-button:focus-visible {
  outline:3px solid rgba(50,130,255,.28);
  outline-offset:2px;
}


/* 藍色 */
.fh-theme-blue {
  --fh-btn-bg:#1689e8;
  --fh-btn-color:#fff;
  --fh-btn-border:#1689e8;
  --fh-btn-shadow:0 4px 13px rgba(22,137,232,.28);
}


/* 綠色 */
.fh-theme-green {
  --fh-btn-bg:#2f9f5b;
  --fh-btn-color:#fff;
  --fh-btn-border:#2f9f5b;
  --fh-btn-shadow:0 4px 13px rgba(47,159,91,.25);
}


/* 紅色 */
.fh-theme-red {
  --fh-btn-bg:#d94c55;
  --fh-btn-color:#fff;
  --fh-btn-border:#d94c55;
  --fh-btn-shadow:0 4px 13px rgba(217,76,85,.25);
}


/* 紫色 */
.fh-theme-purple {
  --fh-btn-bg:#8a59cc;
  --fh-btn-color:#fff;
  --fh-btn-border:#8a59cc;
  --fh-btn-shadow:0 4px 13px rgba(138,89,204,.26);
}


/* 金色 */
.fh-theme-gold {
  --fh-btn-bg:linear-gradient(135deg,#f4ce63,#d89a27);
  --fh-btn-color:#4b3400;
  --fh-btn-border:#cf9629;
  --fh-btn-shadow:0 4px 14px rgba(190,130,20,.28);
}


/* 暗色 */
.fh-theme-dark {
  --fh-btn-bg:linear-gradient(135deg,#34383f,#17191d);
  --fh-btn-color:#fff;
  --fh-btn-border:#4d525a;
  --fh-btn-shadow:0 5px 15px rgba(0,0,0,.32);
}


/* 純文字 */
.fh-theme-text {
  --fh-btn-bg:transparent;
  --fh-btn-color:#247bcc;
  --fh-btn-border:transparent;
  --fh-btn-shadow:none;
}

.fh-theme-text button,
.fh-theme-text .firehaha-themed-button,
.fh-theme-text .option-button,
.fh-theme-text .choice-button,
.fh-theme-text .story-option {
  min-height:auto;
  padding:5px 4px;
  border-radius:3px;
  text-decoration:underline;
  text-underline-offset:4px;
}


/* 外框 */
.fh-theme-outline {
  --fh-btn-bg:transparent;
  --fh-btn-color:#277ec8;
  --fh-btn-border:#277ec8;
  --fh-btn-shadow:none;
}


/* 膠囊 */
.fh-theme-round button,
.fh-theme-round .firehaha-themed-button,
.fh-theme-round .option-button,
.fh-theme-round .choice-button,
.fh-theme-round .story-option {
  border-radius:999px;
  padding-left:22px;
  padding-right:22px;
}


/* 方形 */
.fh-theme-square button,
.fh-theme-square .firehaha-themed-button,
.fh-theme-square .option-button,
.fh-theme-square .choice-button,
.fh-theme-square .story-option {
  border-radius:2px;
}


/* 玻璃 */
.fh-theme-glass {
  --fh-btn-bg:rgba(255,255,255,.28);
  --fh-btn-color:#26384a;
  --fh-btn-border:rgba(255,255,255,.55);
  --fh-btn-shadow:
    0 5px 18px rgba(30,50,70,.16),
    inset 0 1px 0 rgba(255,255,255,.65);
}

.fh-theme-glass button,
.fh-theme-glass .firehaha-themed-button,
.fh-theme-glass .option-button,
.fh-theme-glass .choice-button,
.fh-theme-glass .story-option {
  backdrop-filter:blur(9px);
  -webkit-backdrop-filter:blur(9px);
}


/* 紙張 */
.fh-theme-paper {
  --fh-btn-bg:#fffdf3;
  --fh-btn-color:#514a37;
  --fh-btn-border:#d5cba8;
  --fh-btn-shadow:
    2px 3px 0 #cabd91,
    0 6px 14px rgba(80,65,25,.13);
}

.fh-theme-paper button,
.fh-theme-paper .firehaha-themed-button,
.fh-theme-paper .option-button,
.fh-theme-paper .choice-button,
.fh-theme-paper .story-option {
  border-radius:4px 8px 5px 7px;
  font-family:
    "Noto Serif TC",
    "Yu Mincho",
    serif;
}


/* 像素 */
.fh-theme-pixel {
  --fh-btn-bg:#292d38;
  --fh-btn-color:#fff;
  --fh-btn-border:#fff;
  --fh-btn-shadow:
    4px 4px 0 #111,
    inset -3px -3px 0 rgba(0,0,0,.35),
    inset 3px 3px 0 rgba(255,255,255,.18);
}

.fh-theme-pixel button,
.fh-theme-pixel .firehaha-themed-button,
.fh-theme-pixel .option-button,
.fh-theme-pixel .choice-button,
.fh-theme-pixel .story-option {
  border-width:2px;
  border-radius:0;
  image-rendering:pixelated;
  font-family:
    monospace;
}


/* 霓虹 */
.fh-theme-neon {
  --fh-btn-bg:#11121a;
  --fh-btn-color:#67f7ff;
  --fh-btn-border:#67f7ff;
  --fh-btn-shadow:
    0 0 7px rgba(103,247,255,.8),
    0 0 17px rgba(103,247,255,.4),
    inset 0 0 8px rgba(103,247,255,.12);
}

.fh-theme-neon button,
.fh-theme-neon .firehaha-themed-button,
.fh-theme-neon .option-button,
.fh-theme-neon .choice-button,
.fh-theme-neon .story-option {
  text-shadow:
    0 0 6px rgba(103,247,255,.8);
}


/* 純文字按鈕 */
.firehaha-plain-text-button {
  vertical-align:middle;
}


/* 每顆按鈕自己的樣式優先 */
.firehaha-own-button-theme {
  margin:5px 4px;
}


/* 手機 */
@media(max-width:700px) {
  .firehaha-page-button-theme button,
  .firehaha-page-button-theme .firehaha-themed-button,
  .firehaha-page-button-theme .option-button,
  .firehaha-page-button-theme .choice-button,
  .firehaha-page-button-theme .story-option {
    min-height:46px;
    padding:11px 17px;
  }
}
`;

    document.head.appendChild(style);
  }

  /*
   * 保存原來的閱讀器正文解析器。
   */
  const originalApplyAdventure =
    applyAdventure;

  applyAdventure = function (page) {
    let html =
      originalApplyAdventure(page);

    try {
      html = String(
        html == null ? "" : html
      );

      let pageStyle =
        "default";

      /*
       * 每頁樣式：
       *
       * [按鈕樣式:藍色]
       * [buttonstyle:glass]
       *
       * 同一頁寫多個時，以最後一個為準。
       */
      html = html.replace(
        /\[(?:按鈕樣式|buttonstyle)\s*:\s*([^\]]+?)\s*\]/gi,

        function (
          full,
          rawStyle
        ) {
          pageStyle =
            normalizeStyle(rawStyle);

          return "";
        }
      );

      /*
       * 純文字按鈕：
       *
       * [文字按鈕:調查房間]
       *
       * 指定單顆按鈕樣式：
       *
       * [文字按鈕:危險警告|紅色]
       */
      html = html.replace(
        /\[(?:文字按鈕|純文字按鈕|textbutton)\s*:\s*([^\]|]+?)(?:\s*\|\s*([^\]]+?))?\s*\]/gi,

        function (
          full,
          rawText,
          rawStyle
        ) {
          const text =
            clean(rawText);

          if (!text) {
            return "";
          }

          const ownStyle =
            rawStyle
              ? normalizeStyle(rawStyle)
              : "";

          return (
            '<button type="button"' +
            ' class="' +
            'firehaha-plain-text-button ' +
            (
              ownStyle
                ? (
                    'firehaha-own-button-theme ' +
                    'fh-theme-' +
                    ownStyle
                  )
                : ""
            ) +
            '">' +
            escapeHtml(text) +
            "</button>"
          );
        }
      );

      /*
       * 整頁包裝。
       *
       * 音樂按鈕、選項按鈕和其他插件產生的
       * button 都會繼承這一頁的樣式。
       */
      html =
        '<div class="' +
        'firehaha-page-button-theme ' +
        'fh-theme-' +
        pageStyle +
        '" data-button-theme="' +
        pageStyle +
        '">' +
        html +
        "</div>";

    } catch (error) {
      console.warn(
        "[Reader Button Themes]",
        error
      );
    }

    return html;
  };

  window.FirehahaButtonThemes = {
    version: "1.0.0",

    styles: [
      "default",
      "blue",
      "green",
      "red",
      "gold",
      "purple",
      "dark",
      "text",
      "outline",
      "round",
      "square",
      "glass",
      "paper",
      "pixel",
      "neon"
    ],

    applyToCurrentPage: function (
      styleName
    ) {
      const style =
        normalizeStyle(styleName);

      document
        .querySelectorAll(
          ".firehaha-page-button-theme"
        )
        .forEach(function (container) {
          Array.from(
            container.classList
          ).forEach(function (name) {
            if (
              name.indexOf(
                "fh-theme-"
              ) === 0
            ) {
              container.classList.remove(
                name
              );
            }
          });

          container.classList.add(
            "fh-theme-" + style
          );

          container.dataset.buttonTheme =
            style;
        });
    }
  };
    }

    const patchCode =
      "(" + installReaderButtonThemes.toString() + ")();";

    const removeTransform =
      api.registerReaderTransform(
        "reader-button-themes",

        function (html) {
          html = String(
            html == null ? "" : html
          );

          const marker =
            "function renderAdventure(){";

          if (!html.includes(marker)) {
            console.warn(
              "[Reader Button Themes] 找不到閱讀器插入位置"
            );

            return html;
          }

          return html.replace(
            marker,
            patchCode + "\n" + marker
          );
        },

        /*
         * 稍晚執行，讓音樂等按鈕插件先建立按鈕，
         * 最後再由這支插件統一套上頁面樣式。
         */
        320
      );

    api.toast(
      "閱讀器多樣按鈕樣式已啟用"
    );

    return function cleanup() {
      removeTransform();
    };
  }
});
