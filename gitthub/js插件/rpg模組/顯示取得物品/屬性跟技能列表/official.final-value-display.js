// @firehaha-plugin {"id":"official.final-value-display","name":"最終數值顯示","version":"1.0.0","author":"Firehaha","description":"橋接屬性／技能與其修正值，讓正文可用 {屬性最終:名稱}、{技能最終:名稱}、{屬性最終列表}、{技能最終列表} 顯示加總後的最終數值"}
FirehahaPlugins.register({
  id: "official.final-value-display",
  setup(api) {
    "use strict";
    const patchCode = String.raw`
/* Firehaha Final Value Display */
(function () {
  if (window.__firehahaFinalValueDisplayInstalled) return;
  window.__firehahaFinalValueDisplayInstalled = true;
  const originalApplyAdventure = applyAdventure;

  function getAdventure() {
    return (memorySave && memorySave.adventure) || {};
  }

  function finalValue(baseMap, modMap, name) {
    const base =
      baseMap && Object.prototype.hasOwnProperty.call(baseMap, name)
        ? Number(baseMap[name])
        : 0;
    const mod =
      modMap && Object.prototype.hasOwnProperty.call(modMap, name)
        ? Number(modMap[name])
        : 0;
    const total = (Number.isFinite(base) ? base : 0) + (Number.isFinite(mod) ? mod : 0);
    return total;
  }

  function allNames(baseMap, modMap) {
    const set = {};
    if (baseMap) Object.keys(baseMap).forEach(function (k) { set[k] = true; });
    if (modMap) Object.keys(modMap).forEach(function (k) { set[k] = true; });
    return Object.keys(set);
  }

  function parseListOptions(rawOptions) {
    let separator = "、";
    let pairSeparator = ": ";
    const options = String(rawOptions || "").trim();
    if (options) {
      const parts = options.split("|");
      if (parts[0] !== undefined && parts[0] !== "") separator = parts[0];
      if (parts[1] !== undefined && parts[1] !== "") pairSeparator = parts[1];
    }
    return { separator: separator, pairSeparator: pairSeparator };
  }

  applyAdventure = function (page) {
    let html = originalApplyAdventure(page);
    try {
      const adventure = getAdventure();
      const attributes = adventure.attributes || {};
      const modifiers = adventure.modifiers || {};
      const skills = adventure.skills || {};
      const skillModifiers = adventure.skillModifiers || {};

      html = String(html).replace(
        /\{屬性最終:\s*([^}]+?)\s*\}/gi,
        function (full, rawName) {
          const name = String(rawName || "").trim();
          if (!name) return "0";
          return String(finalValue(attributes, modifiers, name));
        }
      );

      html = String(html).replace(
        /\{技能最終:\s*([^}]+?)\s*\}/gi,
        function (full, rawName) {
          const name = String(rawName || "").trim();
          if (!name) return "0";
          return String(finalValue(skills, skillModifiers, name));
        }
      );

      html = String(html).replace(
        /\{屬性最終列表(?:\s*:\s*([^}]*))?\}/gi,
        function (full, rawOptions) {
          const names = allNames(attributes, modifiers);
          if (names.length === 0) return "";
          const opt = parseListOptions(rawOptions);
          return names
            .map(function (name) {
              return name + opt.pairSeparator + String(finalValue(attributes, modifiers, name));
            })
            .join(opt.separator);
        }
      );

      html = String(html).replace(
        /\{技能最終列表(?:\s*:\s*([^}]*))?\}/gi,
        function (full, rawOptions) {
          const names = allNames(skills, skillModifiers);
          if (names.length === 0) return "";
          const opt = parseListOptions(rawOptions);
          return names
            .map(function (name) {
              return name + opt.pairSeparator + String(finalValue(skills, skillModifiers, name));
            })
            .join(opt.separator);
        }
      );
    } catch (error) {
      console.warn("[Final Value Display]", error);
    }
    return html;
  };
})();
`;
    const removeTransform = api.registerReaderTransform(
      "final-value-display",
      function (html) {
        html = String(html == null ? "" : html);
        const marker = "function renderAdventure(){";
        if (!html.includes(marker)) {
          console.warn(
            "[Final Value Display] 找不到閱讀器的 applyAdventure 插入位置"
          );
          return html;
        }
        return html.replace(
          marker,
          patchCode + "\n" + marker
        );
      },
      213
    );
    api.toast("最終數值顯示已啟用");
    return function cleanup() {
      removeTransform();
    };
  }
});