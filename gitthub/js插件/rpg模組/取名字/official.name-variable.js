// @firehaha-plugin {"id":"official.name-variable","name":"名稱變數","version":"1.1.0","author":"Firehaha","description":"提供閱讀器名稱輸入、儲存與文字引用"}

FirehahaPlugins.register({
  id: "official.name-variable",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha Name Variable 1.1 */
(function () {
  "use strict";

  if (window.__firehahaNameVariableInstalled) return;
  window.__firehahaNameVariableInstalled = true;

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getStore() {
    const adventure = memorySave.adventure;

    if (
      !adventure.names ||
      typeof adventure.names !== "object"
    ) {
      adventure.names = {};
    }

    return adventure.names;
  }

  function getName(key, fallback) {
    key = clean(key);

    const store = getStore();

    return Object.prototype.hasOwnProperty.call(store, key)
      ? String(store[key])
      : String(fallback == null ? "" : fallback);
  }

  function setName(key, value) {
    key = clean(key);
    value = clean(value);

    if (!key) return false;

    getStore()[key] = value;
    return true;
  }

  function removeName(key) {
    key = clean(key);

    const store = getStore();

    if (!Object.prototype.hasOwnProperty.call(store, key)) {
      return false;
    }

    delete store[key];
    return true;
  }

  window.FirehahaNames = {
    version: "1.1.0",
    get: getName,
    set: setName,
    remove: removeName,

    all: function () {
      return Object.assign({}, getStore());
    }
  };

  /* 每次故事頁渲染後呼叫 */
  window.bindFirehahaNameInputs = function () {
    document
      .querySelectorAll(".firehaha-name-save")
      .forEach(function (button) {
        if (button.dataset.nameBound === "1") return;

        button.dataset.nameBound = "1";

        button.onclick = function (event) {
          event.preventDefault();
          event.stopPropagation();

          const box = button.closest(
            ".firehaha-name-box"
          );

          if (!box) return;

          const input = box.querySelector(
            ".firehaha-name-input"
          );

          if (!input) return;

          const key = clean(
            box.dataset.nameKey
          );

          const fallback = clean(
            box.dataset.fallback
          );

          const value =
            clean(input.value) ||
            fallback ||
            "無名旅人";

          if (!setName(key, value)) return;

          /*
           * 主程式本身會把整份 memorySave
           * JSON 化寫進 localStorage。
           */
          if (typeof persist === "function") {
            persist();
          }

          /*
           * 不立刻整頁重建輸入框，
           * 先直接更新本頁所有名稱文字。
           */
          document
            .querySelectorAll(
              '[data-firehaha-name-view="' +
              CSS.escape(key) +
              '"]'
            )
            .forEach(function (view) {
              view.textContent = value;
            });

          input.value = value;
          button.textContent = "已儲存";

          setTimeout(function () {
            button.textContent =
              box.dataset.buttonText ||
              "確認";
          }, 900);

          if (typeof renderAdventure === "function") {
            renderAdventure();
          }
        };
      });

    document
      .querySelectorAll(".firehaha-name-input")
      .forEach(function (input) {
        if (input.dataset.enterBound === "1") return;

        input.dataset.enterBound = "1";

        input.addEventListener(
          "keydown",
          function (event) {
            if (event.key !== "Enter") return;

            event.preventDefault();

            const box = input.closest(
              ".firehaha-name-box"
            );

            const button = box
              ? box.querySelector(
                  ".firehaha-name-save"
                )
              : null;

            if (button) button.click();
          }
        );
      });
  };

  if (
    !document.getElementById(
      "firehaha-name-variable-style"
    )
  ) {
    const style = document.createElement("style");

    style.id = "firehaha-name-variable-style";

    style.textContent =
      ".firehaha-name-box{" +
      "margin:16px 0;padding:14px;" +
      "border:1px solid #d8dde5;" +
      "border-radius:12px;background:#f8fafc;" +
      "display:flex;gap:8px;flex-wrap:wrap;" +
      "align-items:center}" +

      ".firehaha-name-input{" +
      "flex:1;min-width:160px;padding:10px 12px;" +
      "border:1px solid #b8c1cc;border-radius:8px;" +
      "font-size:16px;background:#fff;color:#222}" +

      ".firehaha-name-save{" +
      "padding:10px 16px;border:0;border-radius:8px;" +
      "background:#1976d2;color:#fff;font-weight:700;" +
      "cursor:pointer;touch-action:manipulation}";

    document.head.appendChild(style);
  }

  const originalApplyAdventure = applyAdventure;

  applyAdventure = function (page) {
    let html = originalApplyAdventure(page);

    try {
      /* 固定設定名稱 */
      html = String(html).replace(
        /\[名稱:\s*([^=\]]+?)\s*=\s*([^\]]*?)\s*\]/gi,

        function (full, rawKey, rawValue) {
          setName(rawKey, rawValue);
          return "";
        }
      );

      /* 清除名稱 */
      html = html.replace(
        /\[清除名稱:\s*([^\]]+?)\s*\]/gi,

        function (full, rawKey) {
          removeName(rawKey);
          return "";
        }
      );

      /*
       * [名字輸入:玩家名稱]
       *
       * 完整：
       * [名字輸入:玩家名稱:提示:預設名稱:按鈕文字]
       */
      html = html.replace(
        /\[名字輸入:\s*([^:\]]+?)(?:\s*:\s*([^:\]]*?))?(?:\s*:\s*([^:\]]*?))?(?:\s*:\s*([^\]]*?))?\s*\]/gi,

        function (
          full,
          rawKey,
          rawPlaceholder,
          rawFallback,
          rawButtonText
        ) {
          const key = clean(rawKey);

          const placeholder =
            clean(rawPlaceholder) ||
            "請輸入名稱";

          const fallback =
            clean(rawFallback) ||
            "無名旅人";

          const buttonText =
            clean(rawButtonText) ||
            "確認";

          const current =
            getName(key, "");

          return (
            '<div class="firehaha-name-box"' +
            ' data-name-key="' +
            escapeHtml(key) +
            '"' +
            ' data-fallback="' +
            escapeHtml(fallback) +
            '"' +
            ' data-button-text="' +
            escapeHtml(buttonText) +
            '">' +

            '<input type="text"' +
            ' class="firehaha-name-input"' +
            ' maxlength="40"' +
            ' autocomplete="off"' +
            ' placeholder="' +
            escapeHtml(placeholder) +
            '"' +
            ' value="' +
            escapeHtml(current) +
            '">' +

            '<button type="button"' +
            ' class="firehaha-name-save">' +
            escapeHtml(buttonText) +
            '</button>' +

            '</div>'
          );
        }
      );

      /*
       * {名稱:玩家名稱}
       * {名稱:玩家名稱:無名旅人}
       */
      html = html.replace(
        /\{名稱:\s*([^}:]+?)(?:\s*:\s*([^}]*?))?\s*\}/gi,

        function (full, rawKey, rawFallback) {
          const key = clean(rawKey);

          const fallback =
            rawFallback == null
              ? ""
              : clean(rawFallback);

          return (
            '<span data-firehaha-name-view="' +
            escapeHtml(key) +
            '">' +
            escapeHtml(
              getName(key, fallback)
            ) +
            '</span>'
          );
        }
      );

      /*
       * 配合統一顯示：
       * {顯示:名稱:玩家名稱::無名旅人}
       */
      html = html.replace(
        /\{顯示:名稱:\s*([^}:]+?)(?:\s*:\s*([^}:]*?))?(?:\s*:\s*([^}]*?))?\s*\}/gi,

        function (
          full,
          rawKey,
          rawFormat,
          rawFallback
        ) {
          const key = clean(rawKey);

          const fallback =
            rawFallback == null
              ? ""
              : clean(rawFallback);

          return (
            '<span data-firehaha-name-view="' +
            escapeHtml(key) +
            '">' +
            escapeHtml(
              getName(key, fallback)
            ) +
            '</span>'
          );
        }
      );

    } catch (error) {
      console.warn(
        "[Name Variable]",
        error
      );
    }

    return html;
  };
})();
`;

    const removeTransform =
      api.registerReaderTransform(
        "name-variable",

        function (html) {
          html = String(
            html == null ? "" : html
          );

          const marker =
            "function renderAdventure(){";

          if (!html.includes(marker)) {
            console.warn(
              "[Name Variable] 找不到閱讀器插入位置"
            );
            return html;
          }

          html = html.replace(
            marker,
            patchCode + "\n" + marker
          );

          /*
           * 主程式每次 show() 重建內容後，
           * 原本會呼叫 bindStoryDice()。
           * 我們順便接上名稱輸入框綁定。
           */
          html = html.replace(
            /bindStoryDice\(\);/g,
            "bindStoryDice();" +
            "if(typeof bindFirehahaNameInputs==='function')" +
            "bindFirehahaNameInputs();"
          );

          return html;
        },

        240
      );

    api.toast("名稱變數已啟用");

    return function cleanup() {
      removeTransform();
    };
  }
});