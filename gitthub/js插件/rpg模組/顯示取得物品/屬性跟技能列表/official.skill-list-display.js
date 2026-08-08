// @firehaha-plugin {"id":"official.skill-list-display","name":"技能列表顯示","version":"1.0.0","author":"Firehaha","description":"讓正文可用 {技能列表} 顯示目前所有技能的名稱與數值"}
FirehahaPlugins.register({
  id: "official.skill-list-display",
  setup(api) {
    "use strict";
    const patchCode = String.raw`
/* Firehaha Skill List Display */
(function () {
  if (window.__firehahaSkillListDisplayInstalled) return;
  window.__firehahaSkillListDisplayInstalled = true;
  const originalApplyAdventure = applyAdventure;
  applyAdventure = function (page) {
    let html = originalApplyAdventure(page);
    try {
      const skills =
        memorySave &&
        memorySave.adventure &&
        memorySave.adventure.skills
          ? memorySave.adventure.skills
          : {};
      html = String(html).replace(
        /\{技能列表(?:\s*:\s*([^}]*))?\}/gi,
        function (full, rawOptions) {
          const names = Object.keys(skills);
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
              return name + pairSeparator + String(skills[name]);
            })
            .join(separator);
        }
      );
    } catch (error) {
      console.warn("[Skill List Display]", error);
    }
    return html;
  };
})();
`;
    const removeTransform = api.registerReaderTransform(
      "skill-list-display",
      function (html) {
        html = String(html == null ? "" : html);
        const marker = "function renderAdventure(){";
        if (!html.includes(marker)) {
          console.warn(
            "[Skill List Display] 找不到閱讀器的 applyAdventure 插入位置"
          );
          return html;
        }
        return html.replace(
          marker,
          patchCode + "\n" + marker
        );
      },
      212
    );
    api.toast("技能列表顯示已啟用");
    return function cleanup() {
      removeTransform();
    };
  }
});