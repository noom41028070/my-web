// @firehaha-plugin {"id":"official.create-tag","name":"建立自訂標籤","version":"1.0.0","author":"Firehaha","description":"讓作者以 [建立標籤] 建立簡短引用名稱，並串接統一文字顯示標籤"}

FirehahaPlugins.register({
  id: "official.create-tag",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha Create Tag */
(function () {
  "use strict";

  if (window.__firehahaCreateTagInstalled) {
    return;
  }

  window.__firehahaCreateTagInstalled = true;

  function clean(value) {
    return String(
      value == null ? "" : value
    ).trim();
  }

  function normalize(value) {
    return String(
      value == null ? "" : value
    )
      .replace(/：/g, ":")
      .replace(/＝/g, "=");
  }

  function hasOwn(object, key) {
    return !!object &&
      Object.prototype.hasOwnProperty.call(
        object,
        key
      );
  }

  function getAdventure() {
    if (
      !memorySave ||
      !memorySave.adventure
    ) {
      return null;
    }

    return memorySave.adventure;
  }

  function getStore() {
    const adventure = getAdventure();

    if (!adventure) {
      return Object.create(null);
    }

    if (
      !adventure.createdDisplayTags ||
      typeof adventure.createdDisplayTags !== "object"
    ) {
      adventure.createdDisplayTags =
        Object.create(null);
    }

    return adventure.createdDisplayTags;
  }

  function isValidAlias(alias) {
    alias = clean(alias);

    if (!alias) {
      return false;
    }

    /*
     * 不允許會破壞標籤結構的字元。
     */
    return !/[{}\[\]=]/.test(alias);
  }

  function isValidTarget(target) {
    target = clean(target);

    /*
     * 至少要是：
     * 類型:名稱
     */
    return (
      !!target &&
      target.includes(":")
    );
  }

  function define(alias, target) {
    alias = clean(alias);
    target = clean(normalize(target));

    if (
      !isValidAlias(alias) ||
      !isValidTarget(target)
    ) {
      return false;
    }

    /*
     * 下列兩種都允許：
     *
     * 數值:HP
     * 顯示:數值:HP
     */
    target = target.replace(
      /^顯示\s*:/,
      ""
    );

    getStore()[alias] = target;

    return true;
  }

  function remove(alias) {
    alias = clean(alias);

    const store = getStore();

    if (hasOwn(store, alias)) {
      delete store[alias];
      return true;
    }

    return false;
  }

  function clear() {
    const store = getStore();

    Object.keys(store).forEach(
      function (key) {
        delete store[key];
      }
    );
  }

  function htmlToLines(body) {
    return String(body || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|li)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .split(/\r?\n/);
  }

  function parseDefinitionLine(line) {
    line = clean(normalize(line));

    if (!line) {
      return;
    }

    /*
     * 分類標題與註解不處理：
     *
     * =====角色=====
     * # 角色
     * // 角色
     * ; 角色
     */
    if (
      /^=+.*=+$/.test(line) ||
      /^(?:#|\/\/|;)/.test(line)
    ) {
      return;
    }

    const equalIndex =
      line.indexOf("=");

    if (equalIndex <= 0) {
      return;
    }

    const alias =
      line.slice(0, equalIndex);

    const target =
      line.slice(equalIndex + 1);

    define(alias, target);
  }

  function scanBlockDefinitions(html) {
    return String(html).replace(
      /\[建立標籤\]([\s\S]*?)\[\/建立標籤\]/gi,

      function (full, body) {
        htmlToLines(body).forEach(
          parseDefinitionLine
        );

        /*
         * 建立區塊只執行，
         * 不顯示在正文。
         */
        return "";
      }
    );
  }

  function scanSingleDefinitions(html) {
    return String(html).replace(
      /\[建立標籤\s*:\s*([^=\]]+?)\s*[=＝]\s*([^\]]+?)\s*\]/gi,

      function (
        full,
        alias,
        target
      ) {
        define(alias, target);

        return "";
      }
    );
  }

  function scanRemoveTags(html) {
    html = String(html).replace(
      /\[移除標籤\s*:\s*([^\]]+?)\s*\]/gi,

      function (full, alias) {
        remove(alias);
        return "";
      }
    );

    html = html.replace(
      /\[清除建立標籤\]/gi,

      function () {
        clear();
        return "";
      }
    );

    return html;
  }

  function expandAliases(html) {
    const store = getStore();

    return String(html).replace(
      /\{([^{}]+)\}/g,

      function (full, rawAlias) {
        const alias =
          clean(rawAlias);

        if (!hasOwn(store, alias)) {
          return full;
        }

        return (
          "{顯示:" +
          store[alias] +
          "}"
        );
      }
    );
  }

  window.FirehahaCreateTag = {
    version: "1.0.0",

    define: define,

    remove: remove,

    clear: clear,

    get: function (alias) {
      alias = clean(alias);

      const store = getStore();

      return hasOwn(store, alias)
        ? store[alias]
        : undefined;
    },

    has: function (alias) {
      return hasOwn(
        getStore(),
        clean(alias)
      );
    },

    all: function () {
      return Object.assign(
        {},
        getStore()
      );
    }
  };

  const originalApplyAdventure =
    applyAdventure;

  applyAdventure = function (page) {
    let html =
      originalApplyAdventure(page);

    try {
      /*
       * 依照正文中的出現順序：
       *
       * 1. 建立定義
       * 2. 移除或清除定義
       * 3. 展開 {簡稱}
       */
      html =
        scanBlockDefinitions(html);

      html =
        scanSingleDefinitions(html);

      html =
        scanRemoveTags(html);

      html =
        expandAliases(html);

    } catch (error) {
      console.warn(
        "[Create Tag]",
        error
      );
    }

    return html;
  };
})();
`;

    const removeTransform =
      api.registerReaderTransform(
        "create-tag",

        function (html) {
          html = String(
            html == null ? "" : html
          );

          const marker =
            "function renderAdventure(){";

          if (!html.includes(marker)) {
            console.warn(
              "[Create Tag] 找不到閱讀器插入位置"
            );

            return html;
          }

          return html.replace(
            marker,
            patchCode + "\n" + marker
          );
        },

        /*
         * 必須早於 official.display-tag 的 230。
         *
         * 流程：
         * {生命}
         * → {顯示:數值:HP}
         * → 10
         */
        220
      );

    api.toast(
      "建立自訂標籤已啟用"
    );

    return function cleanup() {
      removeTransform();
    };
  }
});