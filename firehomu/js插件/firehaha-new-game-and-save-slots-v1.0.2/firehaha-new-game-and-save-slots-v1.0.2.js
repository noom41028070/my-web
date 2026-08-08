// @firehaha-plugin {"id":"official.new-game-and-save-slots","name":"官方重新開始／擴充存檔槽","version":"1.0.4","author":"Firehaha","description":"在正式閱讀器加入完整重新開始功能，重置遊戲、媒體播放器與所有已知互動狀態，並允許持續新增手動存檔槽"}

FirehahaPlugins.register({
  id: "official.new-game-and-save-slots",

  setup(api) {
    const removeTransform = api.registerReaderTransform(
      "reader",

      function(html, context) {
        const marker =
          "/* firehaha-new-game-and-save-slots-v1.0.4 */";

        if (html.includes(marker)) {
          return html;
        }

        const style = `
<style data-firehaha-style="new-game-save-slots">
.firehaha-reader-extra-tools{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin:10px 0;
  position:sticky;
  top:0;
  z-index:20;
  padding:8px 0;
  background:inherit;
}

/*
 * 防止大量存檔槽把面板撐出畫面。
 * 常見存檔容器會被限制高度，只有清單本身捲動。
 */
/*
 * 只讓存檔槽清單捲動。
 * 不修改 #saveDock 與 #readerTools，避免最新版主程式的
 * pointer-events 與固定定位被插件覆蓋。
 */
#savePanel{
  pointer-events:auto;
  overflow:hidden;
}

#saveSlots{
  max-height:min(52vh,430px);
  overflow-y:auto;
  overscroll-behavior:contain;
  scrollbar-gutter:stable;
  padding-top:4px;
  padding-right:2px;
}

#firehaha-new-game-save-tools{
  pointer-events:auto;
}

.firehaha-save-collapse-btn{
  color:#344054;
  border-color:rgba(52,64,84,.25);
  background:#f8fafc;
}

.firehaha-reader-extra-tools.is-collapsed{
  position:sticky;
  top:0;
}

.firehaha-reader-extra-tools.is-collapsed
.firehaha-new-game-btn,
.firehaha-reader-extra-tools.is-collapsed
.firehaha-add-slot-btn{
  display:none;
}
.firehaha-reader-extra-tools button{
  appearance:none;
  border:1px solid rgba(0,0,0,.16);
  border-radius:10px;
  padding:9px 13px;
  background:#fff;
  color:#222;
  font:700 13px system-ui,sans-serif;
  cursor:pointer;
  box-shadow:0 2px 8px rgba(0,0,0,.08);
}
.firehaha-reader-extra-tools button:hover{
  transform:translateY(-1px);
  box-shadow:0 4px 12px rgba(0,0,0,.12);
}
.firehaha-reader-extra-tools .firehaha-new-game-btn{
  color:#b42318;
  border-color:rgba(180,35,24,.3);
  background:#fff7f6;
}
.firehaha-reader-extra-tools .firehaha-add-slot-btn{
  color:#175cd3;
  border-color:rgba(23,92,211,.28);
  background:#f5f9ff;
}
</style>`;

        const runtime = `
<script>
${marker}
(function(){
  "use strict";

  if (
    typeof memorySave === "undefined" ||
    typeof history === "undefined" ||
    typeof pages === "undefined" ||
    typeof show !== "function"
  ) {
    console.warn(
      "[Firehaha] 重新開始／擴充存檔槽：找不到正式閱讀器核心"
    );
    return;
  }

  if (window.__firehahaNewGameSaveSlots104) {
    return;
  }

  window.__firehahaNewGameSaveSlots104 = true;

  let restarting = false;

  function createEmptyAdventure(){
    return {
      items: [],
      flags: [],
      values: {},
      attributes: {},
      modifiers: {},
      skills: {},
      skillModifiers: {},
      quests: {},
      dice: {},
      checks: {},
      checkBands: {},
      damage: {},
      damageRules: {},
      successDice: {},
      diceModelVersion: 2,
      applied: {},
      definitionApplied: {},
      names: {},
      createdDisplayTags: {}
    };
  }

  function firstPageId(){
    return (
      Array.isArray(pages) &&
      pages[0] &&
      pages[0].id
    ) || "";
  }

  function saveNow(){
    try {
      if (typeof persist === "function") {
        persist();
      }
    } catch (error) {
      console.warn(
        "[Firehaha] 儲存重新開始狀態失敗",
        error
      );
    }
  }

  function refreshSavePanel(){
    try {
      if (typeof renderSaves === "function") {
        renderSaves();
      }
    } catch (_) {}
  }

  function refreshAdventurePanel(){
    try {
      if (typeof renderAdventure === "function") {
        renderAdventure();
      }
    } catch (_) {}
  }

  function notifyRestartPhase(name){
    try {
      document.dispatchEvent(
        new CustomEvent(
          "firehaha:reader-restart",
          { detail: { phase: name } }
        )
      );
    } catch (_) {}
  }

  function callResetApi(name, fallback){
    try {
      const target = window[name];

      if (!target) {
        return;
      }

      if (typeof target.reset === "function") {
        target.reset();
        return;
      }

      if (
        fallback &&
        typeof target[fallback] === "function"
      ) {
        target[fallback]();
      }
    } catch (error) {
      console.warn(
        "[Firehaha] 重置 " + name + " 失敗",
        error
      );
    }
  }

  function resetKnownMediaUi(){
    /*
     * 除了官方媒體 API，再做一次通用保險：未來插件只要使用
     * 原生 audio/video 或沿用官方按鈕 class，也能回到初始狀態。
     */
    document
      .querySelectorAll("audio,video")
      .forEach(function(media){
        try {
          media.pause();
          media.currentTime = 0;
          media.playbackRate = 1;

          if (media.tagName === "AUDIO") {
            media.volume = 1;
          }
        } catch (_) {}
      });

    document
      .querySelectorAll(
        ".fh-native-audio-control"
      )
      .forEach(function(button){
        button.classList.remove(
          "is-playing"
        );

        button.setAttribute(
          "aria-pressed",
          "false"
        );

        const label =
          button.getAttribute(
            "data-audio-label"
          );

        if (label) {
          button.textContent = label;
        }
      });

    document
      .querySelectorAll(
        ".fh-video-button"
      )
      .forEach(function(button){
        button.classList.remove(
          "is-playing"
        );

        button.setAttribute(
          "aria-pressed",
          "false"
        );

        const label =
          button.getAttribute(
            "data-video-label"
          );

        if (label) {
          button.textContent = label;
        }
      });

    document
      .querySelectorAll(
        ".fh-native-audio-error," +
        ".fh-video-error"
      )
      .forEach(function(note){
        note.remove();
      });

    document
      .querySelectorAll(
        ".fh-video-overlay," +
        ".fh-video-background"
      )
      .forEach(function(layer){
        layer.remove();
      });
  }

  function resetKnownPluginRuntime(){
    /*
     * 這些插件除了 memorySave，還有自己的計時器或
     * 「已執行」集合；只換 adventure 並不足以成為新遊戲。
     */
    callResetApi(
      "FirehahaAutoJump",
      "clearHistory"
    );

    callResetApi(
      "FirehahaAutoDiceJump",
      "clearHistory"
    );

    callResetApi(
      "FirehahaNativeAudioRuntime",
      "stopAll"
    );

    callResetApi(
      "FirehahaNativeVideoRuntime",
      "stopAll"
    );

    callResetApi(
      "FirehahaDraggableText",
      "resetAll"
    );

    resetKnownMediaUi();
  }

  function setRestartButtonBusy(busy){
    const button =
      document.querySelector(
        ".firehaha-new-game-btn"
      );

    if (!button) {
      return;
    }

    button.disabled = !!busy;
    button.textContent = busy
      ? "↻ 正在重新開始…"
      : "↻ 重新開始";
  }

  function resetKnownButtonUi(){
    const tools =
      document.getElementById(
        "firehaha-new-game-save-tools"
      );

    if (tools) {
      tools.classList.remove("is-collapsed");
    }

    const collapseButton =
      document.querySelector(
        ".firehaha-save-collapse-btn"
      );

    if (collapseButton) {
      collapseButton.textContent =
        "▴ 收合工具";

      collapseButton.setAttribute(
        "aria-expanded",
        "true"
      );
    }

    ["savePanel", "storyPanel"].forEach(
      function(id){
        const panel =
          document.getElementById(id);

        if (panel) {
          panel.classList.remove("open");
        }
      }
    );
  }

  function completeRestart(startId){
    try {
      /*
       * 擲骰結束時可能剛好又建立一次自動跳轉；完成重開前
       * 再清一次，之後由新首頁自行建立它真正需要的規則。
       */
      resetKnownPluginRuntime();

      /*
       * 保留手動存檔槽。
       * 以全新的 adventure 取代舊物件，未來插件新增的
       * 遊戲欄位也不會因為漏列名稱而殘留。
       */
      const preservedSlots =
        Array.isArray(memorySave.slots)
          ? memorySave.slots.slice()
          : [];

      memorySave = {
        slots: preservedSlots,
        auto: null,
        adventure: createEmptyAdventure()
      };

      history.length = 0;

      try {
        if (typeof typeToken !== "undefined") {
          typeToken += 1;
        }
      } catch (_) {}

      /*
       * 重建起始頁會同時還原骰子、名字、選項與事件按鈕
       * 的 DOM 狀態，並重新套用首頁該有的初始設定。
       */
      show(startId, true);

      saveNow();
      refreshSavePanel();
      refreshAdventurePanel();
      resetKnownButtonUi();
      notifyRestartPhase("after");

      try {
        if (typeof toast === "function") {
          toast(
            "故事、媒體、RPG 狀態與互動按鈕已全部重新開始"
          );
        }
      } catch (_) {}
    } finally {
      restarting = false;
      setRestartButtonBusy(false);
    }
  }

  function restartStory(){
    if (restarting) {
      return;
    }

    const startId =
      firstPageId();

    if (!startId) {
      alert("找不到故事起始頁面。");
      return;
    }

    const accepted =
      confirm(
        "確定要重新開始故事嗎？\\n\\n" +
        "將會清除：\\n" +
        "・目前劇情位置\\n" +
        "・返回歷史\\n" +
        "・物品與旗標\\n" +
        "・屬性與技能\\n" +
        "・骰子與檢定結果\\n" +
        "・任務、名稱與自訂顯示標籤\\n" +
        "・已執行事件與所有互動按鈕狀態\\n" +
        "・音樂、影片、背景媒體與播放器按鈕\\n" +
        "・自動跳轉與骰後跳轉的等待狀態\\n\\n" +
        "手動存檔槽會保留，之後仍可讀取舊進度。"
      );

    if (!accepted) {
      return;
    }

    restarting = true;
    setRestartButtonBusy(true);
    notifyRestartPhase("before");
    resetKnownPluginRuntime();

    /*
     * 原生骰子動畫最長約 780ms。若玩家在擲骰途中重開，
     * 先讓舊回呼落在舊 adventure，再建立乾淨狀態，避免
     * 舊骰子結果於重開後寫回新遊戲。
     */
    const rolling =
      document.querySelector(
        ".story-dice.rolling," +
        ".story-fate.rolling"
      );

    if (rolling) {
      try {
        if (typeof toast === "function") {
          toast("正在結束目前的擲骰，再重新開始…");
        }
      } catch (_) {}

      setTimeout(
        function(){
          completeRestart(startId);
        },
        900
      );

      return;
    }

    completeRestart(startId);
  }

  function addSaveSlot(){
    memorySave.slots =
      Array.isArray(memorySave.slots)
        ? memorySave.slots
        : [];

    memorySave.slots.push(null);

    saveNow();
    refreshSavePanel();

    try {
      if (typeof toast === "function") {
        toast(
          "已新增存檔槽，目前共 " +
          memorySave.slots.length +
          " 格"
        );
      }
    } catch (_) {}
  }

  function findToolHost(){
    /*
     * 最新主程式的 #saveDock 使用 pointer-events:none，
     * 真正可互動的是內層 #savePanel。
     */
    return (
      document.getElementById("savePanel") ||
      document.getElementById("saveSlots") ||
      document.getElementById("readerTools") ||
      document.body
    );
  }

  function installButtons(){
    if (
      document.getElementById(
        "firehaha-new-game-save-tools"
      )
    ) {
      return;
    }

    const host =
      findToolHost();

    if (!host) {
      return;
    }

    const tools =
      document.createElement("div");

    tools.id =
      "firehaha-new-game-save-tools";

    tools.className =
      "firehaha-reader-extra-tools";

    const restartButton =
      document.createElement("button");

    restartButton.type =
      "button";

    restartButton.className =
      "firehaha-new-game-btn";

    restartButton.textContent =
      "↻ 重新開始";

    restartButton.addEventListener(
      "click",
      restartStory
    );

    const addSlotButton =
      document.createElement("button");

    addSlotButton.type =
      "button";

    addSlotButton.className =
      "firehaha-add-slot-btn";

    addSlotButton.textContent =
      "＋ 新增存檔槽";

    addSlotButton.addEventListener(
      "click",
      addSaveSlot
    );

    const collapseButton =
      document.createElement("button");

    collapseButton.type =
      "button";

    collapseButton.className =
      "firehaha-save-collapse-btn";

    collapseButton.textContent =
      "▴ 收合工具";

    collapseButton.setAttribute(
      "aria-expanded",
      "true"
    );

    collapseButton.addEventListener(
      "click",
      function(){
        const collapsed =
          tools.classList.toggle(
            "is-collapsed"
          );

        collapseButton.textContent =
          collapsed
            ? "▾ 展開工具"
            : "▴ 收合工具";

        collapseButton.setAttribute(
          "aria-expanded",
          collapsed
            ? "false"
            : "true"
        );
      }
    );

    tools.append(
      restartButton,
      addSlotButton,
      collapseButton
    );

    if (host.id === "savePanel") {
      const saveSlots =
        document.getElementById("saveSlots");

      if (saveSlots) {
        host.insertBefore(tools, saveSlots);
      } else {
        host.appendChild(tools);
      }
    } else if (
      host.id === "saveSlots" &&
      host.parentNode
    ) {
      host.parentNode.insertBefore(
        tools,
        host
      );
    } else {
      host.appendChild(tools);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      installButtons,
      { once: true }
    );
  } else {
    installButtons();
  }

  /*
   * 部分閱讀器面板會稍後才建立，
   * 因此補做短時間重試。
   */
  let attempts = 0;

  const timer =
    setInterval(function(){
      attempts += 1;
      installButtons();

      if (
        document.getElementById(
          "firehaha-new-game-save-tools"
        ) ||
        attempts >= 30
      ) {
        clearInterval(timer);
      }
    }, 250);

  window.FirehahaNewGameSaveSlots = {
    restartStory: restartStory,
    addSaveSlot: addSaveSlot
  };

  console.info(
    "[Firehaha] 重新開始／擴充存檔槽 1.0.4 已接入"
  );
})();
<\/script>`;

        const payload =
          style + runtime;

        if (/<\/body\s*>/i.test(html)) {
          return html.replace(
            /<\/body\s*>/i,
            payload + "\n</body>"
          );
        }

        return html + payload;
      },

      300
    );

    api.toast(
      "官方重新開始／擴充存檔槽 1.0.4 已啟用"
    );

    return function cleanup() {
      if (
        typeof removeTransform === "function"
      ) {
        removeTransform();
      }
    };
  }
});
