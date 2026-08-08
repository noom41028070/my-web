// @firehaha-plugin {"id":"official.attribute-list-display","name":"屬性列表顯示","version":"1.0.0","author":"Firehaha","description":"讓正文可用 {屬性列表} 顯示目前所有屬性的名稱與數值"}
FirehahaPlugins.register({
  id: "official.attribute-list-display",
  setup(api) {
    "use strict";
    const patchCode = String.raw`
/* Firehaha Attribute List Display */
(function () {
  if (window.__firehahaAttributeListDisplayInstalled) return;
  window.__firehahaAttributeListDisplayInstalled = true;
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
        /\{屬性列表(?:\s*:\s*([^}]*))?\}/gi,
        function (full, rawOptions) {
          const names = Object.keys(attributes);
          if (names.length === 0) return "";

          const options = String(rawOptions || "").trim();
          let separator = "、";
          let pairSeparator = ": ";

          if (options) {
            const parts = options.split("|");
            if (parts[0] !== undefined && parts[0] !== "") {
              separator = parts[0];
            }
            if (parts[1] !== undefined && parts[1] !== "") {
              pairSeparator = parts[1];
            }
          }

          return names
            .map(function (name) {
              return name + pairSeparator + String(attributes[name]);
            })
            .join(separator);
        }
      );
    } catch (error) {
      console.warn("[Attribute List Display]", error);
    }
    return html;
  };
})();
`;
    const removeTransform = api.registerReaderTransform(
      "attribute-list-display",
      function (html) {
        html = String(html == null ? "" : html);
        const marker = "function renderAdventure(){";
        if (!html.includes(marker)) {
          console.warn(
            "[Attribute List Display] 找不到閱讀器的 applyAdventure 插入位置"
          );
          return html;
        }
        return html.replace(
          marker,
          patchCode + "\n" + marker
        );
      },
      211
    );
    api.toast("屬性列表顯示已啟用");
    return function cleanup() {
      removeTransform();
    };
  }
});