// @firehaha-plugin {"id":"official.number-display","name":"數值文字顯示","version":"1.0.0","author":"Firehaha","description":"橋接原有冒險數值系統，讓正文可用 {數值:名稱} 顯示目前數值"}

FirehahaPlugins.register({
  id: "official.number-display",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha Number Display */
(function () {
  if (window.__firehahaNumberDisplayInstalled) return;
  window.__firehahaNumberDisplayInstalled = true;

  const originalApplyAdventure = applyAdventure;

  applyAdventure = function (page) {
    let html = originalApplyAdventure(page);

    try {
      const values =
        memorySave &&
        memorySave.adventure &&
        memorySave.adventure.values
          ? memorySave.adventure.values
          : {};

      html = String(html).replace(
        /\{數值:\s*([^}]+?)\s*\}/gi,
        function (full, rawName) {
          const name = String(rawName || "").trim();

          if (!name) return "0";

          return Object.prototype.hasOwnProperty.call(values, name)
            ? String(values[name])
            : "0";
        }
      );
    } catch (error) {
      console.warn("[Number Display]", error);
    }

    return html;
  };
})();
`;

    const removeTransform = api.registerReaderTransform(
      "number-display",

      function (html) {
        html = String(html == null ? "" : html);

        const marker = "function renderAdventure(){";

        if (!html.includes(marker)) {
          console.warn(
            "[Number Display] 找不到閱讀器的 applyAdventure 插入位置"
          );

          return html;
        }

        return html.replace(
          marker,
          patchCode + "\n" + marker
        );
      },

      210
    );

    api.toast("數值文字顯示已啟用");

    return function cleanup() {
      removeTransform();
    };
  }
});