// @firehaha-plugin {"id":"official.name-variable-plus","name":"名稱變數補充","version":"1.0.0","author":"Firehaha","description":"擴充名稱變數，支援輸入名稱後跳頁與預設名稱按鈕"}

FirehahaPlugins.register({
  id: "official.name-variable-plus",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha Name Variable Plus */
(function () {
  "use strict";

  if (window.__firehahaNameVariablePlusInstalled) {
    return;
  }

  window.__firehahaNameVariablePlusInstalled = true;

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

  function normalize(value) {
    return String(
      value == null ? "" : value
    )
      .replace(/：/g, ":")
      .replace(/＝/g, "=");
  }

  function getTargetPage(pageNumber) {
    const number =
      Number(pageNumber);

    if (
      !Number.isInteger(number) ||
      number < 1 ||
      !Array.isArray(pages) ||
      number > pages.length
    ) {
      return null;
    }

    return pages[number - 1] || null;
  }

  function saveName(key, value) {
    key = clean(key);
    value = clean(value);

    if (!key) {
      return false;
    }

    if (
      window.FirehahaNames &&
      typeof window.FirehahaNames.set ===
        "function"
    ) {
      return window.FirehahaNames.set(
        key,
        value
      );
    }

    /*
     * 保險用：
     * 即使名稱核心 API 不存在，
     * 仍嘗試寫入原本的 memorySave。
     */
    if (
      memorySave &&
      memorySave.adventure
    ) {
      if (
        !memorySave.adventure.names ||
        typeof memorySave.adventure.names !==
          "object"
      ) {
        memorySave.adventure.names = {};
      }

      memorySave.adventure.names[key] =
        value;

      return true;
    }

    return false;
  }

  function saveAndJump(
    key,
    value,
    fallback,
    pageNumber
  ) {
    value =
      clean(value) ||
      clean(fallback) ||
      "無名旅人";

    if (!saveName(key, value)) {
      return false;
    }

    if (typeof persist === "function") {
      persist();
    }

    const target =
      getTargetPage(pageNumber);

    if (!target) {
      console.warn(
        "[Name Variable Plus] 找不到第 " +
        pageNumber +
        " 頁"
      );

      return false;
    }

    if (typeof show === "function") {
      show(target.id);
      return true;
    }

    return false;
  }

  /*
   * 每次故事頁渲染完成後綁定。
   */
  window.bindFirehahaNameVariablePlus =
    function () {

      /*
       * 自訂輸入後跳頁
       */
      document
        .querySelectorAll(
          ".firehaha-name-jump-save"
        )
        .forEach(function (button) {

          if (
            button.dataset.nameJumpBound ===
            "1"
          ) {
            return;
          }

          button.dataset.nameJumpBound = "1";

          button.onclick = function (event) {
            event.preventDefault();
            event.stopPropagation();

            const box =
              button.closest(
                ".firehaha-name-jump-box"
              );

            if (!box) {
              return;
            }

            const input =
              box.querySelector(
                ".firehaha-name-jump-input"
              );

            if (!input) {
              return;
            }

            const key =
              clean(box.dataset.nameKey);

            const fallback =
              clean(box.dataset.fallback);

            const targetPage =
              clean(box.dataset.targetPage);

            const value =
              clean(input.value) ||
              fallback;

            button.disabled = true;
            button.textContent = "處理中…";

            const success =
              saveAndJump(
                key,
                value,
                fallback,
                targetPage
              );

            if (!success) {
              button.disabled = false;
              button.textContent =
                box.dataset.buttonText ||
                "確認";
            }
          };
        });

      /*
       * Enter 也可確認並跳頁
       */
      document
        .querySelectorAll(
          ".firehaha-name-jump-input"
        )
        .forEach(function (input) {

          if (
            input.dataset.nameEnterBound ===
            "1"
          ) {
            return;
          }

          input.dataset.nameEnterBound = "1";

          input.addEventListener(
            "keydown",

            function (event) {
              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();

              const box =
                input.closest(
                  ".firehaha-name-jump-box"
                );

              const button =
                box
                  ? box.querySelector(
                      ".firehaha-name-jump-save"
                    )
                  : null;

              if (button) {
                button.click();
              }
            }
          );
        });

      /*
       * 預設名稱按鈕
       */
      document
        .querySelectorAll(
          ".firehaha-name-preset"
        )
        .forEach(function (button) {

          if (
            button.dataset.namePresetBound ===
            "1"
          ) {
            return;
          }

          button.dataset.namePresetBound = "1";

          button.onclick = function (event) {
            event.preventDefault();
            event.stopPropagation();

            const key =
              clean(button.dataset.nameKey);

            const value =
              clean(button.dataset.nameValue);

            const targetPage =
              clean(button.dataset.targetPage);

            button.disabled = true;
            button.textContent = "處理中…";

            const success =
              saveAndJump(
                key,
                value,
                value,
                targetPage
              );

            if (!success) {
              button.disabled = false;
              button.textContent =
                button.dataset.buttonText ||
                value ||
                "使用預設名稱";
            }
          };
        });
    };

  /*
   * 補充樣式
   */
  if (
    !document.getElementById(
      "firehaha-name-variable-plus-style"
    )
  ) {
    const style =
      document.createElement("style");

    style.id =
      "firehaha-name-variable-plus-style";

    style.textContent = [
      ".firehaha-name-jump-box{",
      "margin:16px 0;",
      "padding:14px;",
      "border:1px solid #d8dde5;",
      "border-radius:12px;",
      "background:#f8fafc;",
      "display:flex;",
      "gap:8px;",
      "flex-wrap:wrap;",
      "align-items:center;",
      "}",

      ".firehaha-name-jump-input{",
      "flex:1;",
      "min-width:160px;",
      "padding:10px 12px;",
      "border:1px solid #b8c1cc;",
      "border-radius:8px;",
      "font-size:16px;",
      "background:#fff;",
      "color:#222;",
      "}",

      ".firehaha-name-jump-save,",
      ".firehaha-name-preset{",
      "padding:10px 16px;",
      "border:0;",
      "border-radius:8px;",
      "background:#1976d2;",
      "color:#fff;",
      "font-weight:700;",
      "cursor:pointer;",
      "touch-action:manipulation;",
      "}",

      ".firehaha-name-preset{",
      "display:inline-flex;",
      "margin:4px 6px 4px 0;",
      "background:#546e7a;",
      "}",

      ".firehaha-name-jump-save:disabled,",
      ".firehaha-name-preset:disabled{",
      "opacity:.65;",
      "cursor:wait;",
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
      html = normalize(html);

      /*
       * 輸入名稱並跳頁
       *
       * [名字輸入跳頁:
       * 玩家名稱:
       * 請替角色取名:
       * 無名旅人:
       * 確認名字:
       * 5]
       */
      html = String(html).replace(
        /\[名字輸入跳頁:\s*([^:\]]+?)\s*:\s*([^:\]]*?)\s*:\s*([^:\]]*?)\s*:\s*([^:\]]*?)\s*:\s*(\d+)\s*\]/gi,

        function (
          full,
          rawKey,
          rawPlaceholder,
          rawFallback,
          rawButtonText,
          rawTargetPage
        ) {
          const key =
            clean(rawKey);

          const placeholder =
            clean(rawPlaceholder) ||
            "請輸入名稱";

          const fallback =
            clean(rawFallback) ||
            "無名旅人";

          const buttonText =
            clean(rawButtonText) ||
            "確認";

          const targetPage =
            clean(rawTargetPage);

          let current = "";

          if (
            window.FirehahaNames &&
            typeof window.FirehahaNames.get ===
              "function"
          ) {
            current =
              window.FirehahaNames.get(
                key,
                ""
              );
          }

          return (
            '<div class="firehaha-name-jump-box"' +

            ' data-name-key="' +
            escapeHtml(key) +
            '"' +

            ' data-fallback="' +
            escapeHtml(fallback) +
            '"' +

            ' data-button-text="' +
            escapeHtml(buttonText) +
            '"' +

            ' data-target-page="' +
            escapeHtml(targetPage) +
            '">' +

            '<input' +
            ' type="text"' +
            ' class="firehaha-name-jump-input"' +
            ' maxlength="40"' +
            ' autocomplete="off"' +
            ' placeholder="' +
            escapeHtml(placeholder) +
            '"' +
            ' value="' +
            escapeHtml(current) +
            '">' +

            '<button' +
            ' type="button"' +
            ' class="firehaha-name-jump-save">' +
            escapeHtml(buttonText) +
            '</button>' +

            '</div>'
          );
        }
      );

      /*
       * 預設名稱按鈕
       *
       * [預設名稱:
       * 玩家名稱=阿爾斯:
       * 使用阿爾斯:
       * 5]
       */
      html = html.replace(
        /\[預設名稱:\s*([^=\]:]+?)\s*=\s*([^:\]]+?)\s*:\s*([^:\]]*?)\s*:\s*(\d+)\s*\]/gi,

        function (
          full,
          rawKey,
          rawValue,
          rawButtonText,
          rawTargetPage
        ) {
          const key =
            clean(rawKey);

          const value =
            clean(rawValue);

          const buttonText =
            clean(rawButtonText) ||
            (
              value
                ? "使用「" + value + "」"
                : "使用預設名稱"
            );

          const targetPage =
            clean(rawTargetPage);

          return (
            '<button' +
            ' type="button"' +
            ' class="firehaha-name-preset"' +

            ' data-name-key="' +
            escapeHtml(key) +
            '"' +

            ' data-name-value="' +
            escapeHtml(value) +
            '"' +

            ' data-target-page="' +
            escapeHtml(targetPage) +
            '"' +

            ' data-button-text="' +
            escapeHtml(buttonText) +
            '">' +

            escapeHtml(buttonText) +

            '</button>'
          );
        }
      );

    } catch (error) {
      console.warn(
        "[Name Variable Plus]",
        error
      );
    }

    return html;
  };
})();
`;

    const removeTransform =
      api.registerReaderTransform(
        "name-variable-plus",

        function (html) {
          html = String(
            html == null ? "" : html
          );

          const marker =
            "function renderAdventure(){";

          if (!html.includes(marker)) {
            console.warn(
              "[Name Variable Plus] 找不到閱讀器插入位置"
            );

            return html;
          }

          html = html.replace(
            marker,
            patchCode + "\n" + marker
          );

          /*
           * 每次閱讀器重建頁面後，
           * 重新綁定新增的按鈕。
           */
          html = html.replace(
            /bindStoryDice\(\);/g,

            "bindStoryDice();" +
            "if(typeof bindFirehahaNameVariablePlus==='function')" +
            "bindFirehahaNameVariablePlus();"
          );

          return html;
        },

        /*
         * 原名稱插件為 240，
         * 補充插件接在它後面。
         */
        245
      );

    api.toast(
      "名稱變數補充已啟用"
    );

    return function cleanup() {
      removeTransform();
    };
  }
});