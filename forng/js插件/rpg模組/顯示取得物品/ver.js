// @firehaha-plugin {"id":"official.attribute-display","name":"屬性文字顯示","version":"1.0.0","author":"Firehaha","description":"橋接原有冒險屬性系統，讓正文可用 {屬性:名稱} 顯示目前屬性數值"}
FirehahaPlugins.register({
  id: "official.attribute-display",
  setup(api) {
    "use strict";
    const patchCode = String.raw`
/* Firehaha Attribute Display */
(function () {
  if (window.__firehahaAttributeDisplayInstalled) return;
  window.__firehahaAttributeDisplayInstalled = true;
  const originalApplyAdventure = applyAdventure;
  applyAdventure = function (page) {
    let html = originalApplyAdventure(page);
    try {
      const attributes =
        memorySave &&
        memorySave.adventure &&
        memorySave.adventure.attributes
          ? memorySave.adventure.attributes
          : {};
      html = String(html).replace(
        /\{屬性:\s*([^}]+?)\s*\}/gi,
        function (full, rawName) {
          const name = String(rawName || "").trim();
          if (!name) return "0";
          return Object.prototype.hasOwnProperty.call(attributes, name)
            ? String(attributes[name])
            : "0";
        }
      );
    } catch (error) {
      console.warn("[Attribute Display]", error);
    }
    return html;
  };
})();
`;
    const removeTransform = api.registerReaderTransform(
      "attribute-display",
      function (html) {
        html = String(html == null ? "" : html);
        const marker = "function renderAdventure(){";
        if (!html.includes(marker)) {
          console.warn(
            "[Attribute Display] 找不到閱讀器的 applyAdventure 插入位置"
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
    api.toast("屬性文字顯示已啟用");
    return function cleanup() {
      removeTransform();
    };
  }
});