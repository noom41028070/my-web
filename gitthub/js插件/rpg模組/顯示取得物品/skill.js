// @firehaha-plugin {"id":"official.skill-display","name":"技能文字顯示","version":"1.0.0","author":"Firehaha","description":"橋接原有冒險技能系統，讓正文可用 {技能:名稱} 顯示目前技能數值"}
FirehahaPlugins.register({
  id: "official.skill-display",
  setup(api) {
    "use strict";
    const patchCode = String.raw`
/* Firehaha Skill Display */
(function () {
  if (window.__firehahaSkillDisplayInstalled) return;
  window.__firehahaSkillDisplayInstalled = true;
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
        /\{技能:\s*([^}]+?)\s*\}/gi,
        function (full, rawName) {
          const name = String(rawName || "").trim();
          if (!name) return "0";
          return Object.prototype.hasOwnProperty.call(skills, name)
            ? String(skills[name])
            : "0";
        }
      );
    } catch (error) {
      console.warn("[Skill Display]", error);
    }
    return html;
  };
})();
`;
    const removeTransform = api.registerReaderTransform(
      "skill-display",
      function (html) {
        html = String(html == null ? "" : html);
        const marker = "function renderAdventure(){";
        if (!html.includes(marker)) {
          console.warn(
            "[Skill Display] 找不到閱讀器的 applyAdventure 插入位置"
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
    api.toast("技能文字顯示已啟用");
    return function cleanup() {
      removeTransform();
    };
  }
});