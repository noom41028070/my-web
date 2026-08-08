// @firehaha-plugin {"id":"official.item-display","name":"物品文字顯示","version":"1.0.0","author":"Firehaha","description":"橋接原有攜帶物品系統，支援物品持有狀態與物品清單顯示"}

FirehahaPlugins.register({
  id: "official.item-display",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha Item Display */
(function () {
  if (window.__firehahaItemDisplayInstalled) return;
  window.__firehahaItemDisplayInstalled = true;

  const originalApplyAdventure = applyAdventure;

  applyAdventure = function (page) {
    let html = originalApplyAdventure(page);

    try {
      const items =
        memorySave &&
        memorySave.adventure &&
        Array.isArray(memorySave.adventure.items)
          ? memorySave.adventure.items
          : [];

      /*
       * {物品:名稱}
       *
       * 有物品：持有
       * 沒有物品：未持有
       */
      html = String(html).replace(
        /\{物品:\s*([^}]+?)\s*\}/gi,
        function (full, rawName) {
          const name = String(rawName || "").trim();

          if (!name) {
            return "未持有";
          }

          return items.includes(name)
            ? "持有"
            : "未持有";
        }
      );

      /*
       * {物品清單}
       *
       * 顯示目前全部攜帶物品。
       */
      html = html.replace(
        /\{物品清單\}/gi,
        function () {
          return items.length
            ? items.join("、")
            : "目前沒有攜帶物品";
        }
      );

    } catch (error) {
      console.warn(
        "[Item Display]",
        error
      );
    }

    return html;
  };
})();
`;

    const removeTransform =
      api.registerReaderTransform(
        "item-display",

        function (html) {
          html = String(
            html == null ? "" : html
          );

          const marker =
            "function renderAdventure(){";

          if (!html.includes(marker)) {
            console.warn(
              "[Item Display] 找不到閱讀器插入位置"
            );

            return html;
          }

          return html.replace(
            marker,
            patchCode + "\n" + marker
          );
        },

        220
      );

    api.toast(
      "物品文字顯示已啟用"
    );

    return function cleanup() {
      removeTransform();
    };
  }
});