// @firehaha-plugin {"id":"official.attribute-skill-native-fix","name":"官方屬性／技能原生修正","version":"1.5.0","author":"Firehaha","description":"修正測試閱讀返回按鈕與屬性技能數值在返回時回溯的問題，沿用主程式原生冒險紀錄"}

FirehahaPlugins.register({
  id: "official.attribute-skill-native-fix",

  setup(api) {
    const removeTransform = api.registerReaderTransform(
      "reader",

      function(html, context) {
        const marker =
          "/* firehaha-attribute-skill-native-fix-v1.5.0 */";

        if (html.includes(marker)) {
          return html;
        }

        const runtime = `
<script>
${marker}
(function(){
  "use strict";

  if (
    typeof applyAdventure !== "function" ||
    typeof memorySave === "undefined"
  ) {
    console.warn(
      "[Firehaha] 屬性／技能原生修正：找不到閱讀器冒險核心"
    );
    return;
  }

  if (applyAdventure.__firehahaAttributeSkillFix150) {
    return;
  }

  const originalApplyAdventure = applyAdventure;

  function ensureAdventure(){
    memorySave.adventure =
      memorySave.adventure || {};

    const a = memorySave.adventure;

    a.attributes =
      a.attributes && typeof a.attributes === "object"
        ? a.attributes
        : {};

    a.modifiers =
      a.modifiers && typeof a.modifiers === "object"
        ? a.modifiers
        : {};

    a.skills =
      a.skills && typeof a.skills === "object"
        ? a.skills
        : {};

    a.skillModifiers =
      a.skillModifiers && typeof a.skillModifiers === "object"
        ? a.skillModifiers
        : {};

    /*
     * 記錄「哪一頁的哪一條設定」已經套用。
     * 不能只用 page.id，否則作者修改標籤後不會更新；
     * 也不能每次進頁都套用，否則按返回會讓數值倒退。
     */
    a.definitionApplied =
      a.definitionApplied &&
      typeof a.definitionApplied === "object"
        ? a.definitionApplied
        : {};

    return a;
  }

  function normalizeNumber(value){
    const number = Number(value);
    return Number.isFinite(number)
      ? number
      : null;
  }

  function applyDefinitionOnce(
    adventure,
    page,
    type,
    index,
    name,
    value,
    store
  ){
    name = String(name || "").trim();
    value = normalizeNumber(value);

    if (!name || value === null) {
      return false;
    }

    const pageId =
      String(page && page.id || "");

    /*
     * key 包含標籤內容。
     * 例如作者把 [屬性:力量=10] 改成 =12，
     * 新內容會得到新 key，因此可以重新同步。
     */
    const key = [
      pageId,
      type,
      String(index),
      name,
      String(value)
    ].join("|");

    if (adventure.definitionApplied[key]) {
      return false;
    }

    store[name] = value;
    adventure.definitionApplied[key] = true;

    return true;
  }

  function applyPageDefinitions(page){
    if (!page) {
      return false;
    }

    const adventure =
      ensureAdventure();

    const text =
      String(
        page.content != null
          ? page.content
          : page.text || ""
      );

    let changed = false;
    let index = 0;

    index = 0;
    text.replace(
      /\\[屬性\\s*:\\s*([^=\\]\\r\\n]+?)\\s*=\\s*(-?\\d+(?:\\.\\d+)?)\\s*\\]/gi,
      function(match, name, value){
        changed =
          applyDefinitionOnce(
            adventure,
            page,
            "attribute",
            index++,
            name,
            value,
            adventure.attributes
          ) || changed;

        return match;
      }
    );

    index = 0;
    text.replace(
      /\\[修正值\\s*:\\s*([^=\\]\\r\\n]+?)\\s*=\\s*([+-]?\\d+(?:\\.\\d+)?)\\s*\\]/gi,
      function(match, name, value){
        changed =
          applyDefinitionOnce(
            adventure,
            page,
            "modifier",
            index++,
            name,
            value,
            adventure.modifiers
          ) || changed;

        return match;
      }
    );

    index = 0;
    text.replace(
      /\\[技能\\s*:\\s*([^=\\]\\r\\n]+?)\\s*=\\s*(-?\\d+(?:\\.\\d+)?)\\s*\\]/gi,
      function(match, name, value){
        changed =
          applyDefinitionOnce(
            adventure,
            page,
            "skill",
            index++,
            name,
            value,
            adventure.skills
          ) || changed;

        return match;
      }
    );

    index = 0;
    text.replace(
      /\\[技能修正值\\s*:\\s*([^=\\]\\r\\n]+?)\\s*=\\s*([+-]?\\d+(?:\\.\\d+)?)\\s*\\]/gi,
      function(match, name, value){
        changed =
          applyDefinitionOnce(
            adventure,
            page,
            "skill-modifier",
            index++,
            name,
            value,
            adventure.skillModifiers
          ) || changed;

        return match;
      }
    );

    if (changed) {
      try {
        if (typeof persist === "function") {
          persist();
        }
      } catch (_) {}
    }

    return changed;
  }

  function wrappedApplyAdventure(page){
    /*
     * 先處理可更新、但不可因返回而回溯的設定標籤；
     * 再交回主程式原生 applyAdventure 處理顯示、
     * 物品、旗幟、骰子與原生 applied 防重複。
     */
    applyPageDefinitions(page);

    return originalApplyAdventure.call(
      this,
      page
    );
  }

  wrappedApplyAdventure.__firehahaAttributeSkillFix150 =
    true;

  wrappedApplyAdventure.__originalApplyAdventure =
    originalApplyAdventure;

  applyAdventure =
    wrappedApplyAdventure;


  /*
   * 主程式建立閱讀器後，第一頁已經執行過一次 show(currentId,false)。
   * 插件在其後才載入，因此只補同步第一頁資料；
   * 不呼叫 renderAdventure()、show() 或 renderStory()，
   * 避免重設 history 與返回按鈕。
   */
  try {
    if (
      typeof pages !== "undefined" &&
      Array.isArray(pages) &&
      typeof currentId !== "undefined"
    ) {
      const firstCurrentPage =
        pages.find(function(page){
          return String(page.id) === String(currentId);
        });

      if (firstCurrentPage) {
        applyPageDefinitions(firstCurrentPage);
      }
    }
  } catch (error) {
    console.warn(
      "[Firehaha] 首頁屬性／技能同步失敗",
      error
    );
  }


  /*
   * 主程式原本以 history.length > 1 顯示返回按鈕。
   * 正常情況不會重建按鈕；只有測試閱讀器漏掉時才補上。
   */
  function ensureBackButton(){
    try {
      if (
        typeof history === "undefined" ||
        !Array.isArray(history) ||
        history.length <= 1 ||
        typeof currentId === "undefined" ||
        typeof pages === "undefined"
      ) {
        return;
      }

      const page =
        pages.find(function(item){
          return String(item.id) === String(currentId);
        });

      if (
        !page ||
        page.rules && page.rules.noBack
      ) {
        return;
      }

      const readerElement =
        document.getElementById("reader");

      if (
        !readerElement ||
        readerElement.querySelector(".back")
      ) {
        return;
      }

      const button =
        document.createElement("button");

      button.className = "back";
      button.type = "button";
      button.textContent = "← 返回";

      button.onclick = function(){
        if (history.length <= 1) {
          return;
        }

        history.pop();

        const previousId =
          history.pop();

        if (previousId) {
          show(previousId, true);
        }
      };

      readerElement.appendChild(button);
    } catch (error) {
      console.warn(
        "[Firehaha] 返回按鈕補強失敗",
        error
      );
    }
  }

  /*
   * 包裝主程式 show()，但不更改其 history 操作。
   * 原生頁面完成後才檢查返回按鈕。
   */
  if (
    typeof show === "function" &&
    !show.__firehahaAttributeSkillBackFix150
  ) {
    const originalShow = show;

    const wrappedShow = function(id, push){
      const result =
        originalShow.call(
          this,
          id,
          arguments.length >= 2
            ? push
            : true
        );

      setTimeout(
        ensureBackButton,
        0
      );

      return result;
    };

    wrappedShow.__firehahaAttributeSkillBackFix150 =
      true;

    wrappedShow.__originalShow =
      originalShow;

    show = wrappedShow;
  }

  setTimeout(
    ensureBackButton,
    0
  );

  console.info(
    "[Firehaha] 屬性／技能原生修正 1.5.0 已接入"
  );
})();
<\/script>`;

        if (/<\/body\s*>/i.test(html)) {
          return html.replace(
            /<\/body\s*>/i,
            runtime + "\n</body>"
          );
        }

        return html + runtime;
      },

      200
    );

    api.toast(
      "官方屬性／技能原生修正 1.5.0 已啟用"
    );

    return function cleanup(){
      if (typeof removeTransform === "function") {
        removeTransform();
      }
    };
  }
});
