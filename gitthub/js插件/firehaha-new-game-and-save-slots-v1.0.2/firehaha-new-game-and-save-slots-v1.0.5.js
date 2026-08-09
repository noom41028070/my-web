// @firehaha-plugin {"id":"official.new-game-and-save-slots","name":"官方重新開始／擴充存檔槽","version":"1.0.5","author":"Firehaha","description":"在正式閱讀器加入完整重新開始、完整 RPG 手動存檔快照、讀檔 Runtime 同步與可擴充 Reader 生命週期協調。"}

FirehahaPlugins.register({
  id: "official.new-game-and-save-slots",

  setup(api) {
    const removeTransform = api.registerReaderTransform(
      "reader",

      function(html, context) {
        const marker =
          "/* firehaha-new-game-and-save-slots-v1.0.5 */";

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
#savePanel{
  pointer-events:auto;
  overflow:hidden;
}
#saveSlots{
  max-height:min(52vh,430px);
  overflow-y:auto;
  overscroll-behavior:contain;
  padding-right:3px;
}
.firehaha-reader-extra-tools.is-collapsed ~ #saveSlots{
  max-height:min(60vh,500px);
}
.firehaha-reader-extra-tools button{
  appearance:none;
  border:1px solid rgba(100,116,139,.32);
  border-radius:10px;
  padding:7px 11px;
  background:#fff;
  color:#334155;
  font:700 12px/1.2 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;
  cursor:pointer;
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
.firehaha-save-snapshot-note{
  margin:5px 0 8px;
  font-size:11px;
  line-height:1.45;
  color:#64748b;
}
body.reader-dark .firehaha-reader-extra-tools button{
  background:#263442;
  border-color:#506173;
  color:#e6eef6;
}
body.reader-dark .firehaha-reader-extra-tools .firehaha-new-game-btn{
  background:#3a2729;
  color:#ffb4ab;
}
body.reader-dark .firehaha-reader-extra-tools .firehaha-add-slot-btn{
  background:#22334a;
  color:#9fc5ff;
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

  if (window.__firehahaNewGameSaveSlots105) {
    return;
  }

  window.__firehahaNewGameSaveSlots105 = true;

  let restarting = false;
  let lifecycleRunning = false;


  // =====================================================
  // 共用 Reader Lifecycle
  // =====================================================

  const lifecycleHandlers =
    new Map();

  function lifecycleApi(){
    if (
      window.FirehahaReaderLifecycle &&
      window.FirehahaReaderLifecycle.__integratedV1
    ) {
      return window.FirehahaReaderLifecycle;
    }

    const api = {
      __integratedV1: true,
      version: "1.0.0",

      register(name, handlers){
        const key =
          String(name || "").trim();

        if (!key) {
          return function(){};
        }

        lifecycleHandlers.set(
          key,
          handlers || {}
        );

        return function(){
          lifecycleHandlers.delete(key);
        };
      },

      unregister(name){
        lifecycleHandlers.delete(
          String(name || "").trim()
        );
      },

      run(phase, detail){
        return runLifecycle(
          phase,
          detail
        );
      },

      list(){
        return Array.from(
          lifecycleHandlers.keys()
        );
      }
    };

    window.FirehahaReaderLifecycle =
      api;

    return api;
  }


  function dispatchLifecycleEvent(
    phase,
    detail
  ){
    const payload =
      Object.assign(
        {
          phase:
            phase,
          at:
            Date.now()
        },
        detail || {}
      );

    try {
      document.dispatchEvent(
        new CustomEvent(
          "firehaha:reader-lifecycle",
          {
            detail:
              payload
          }
        )
      );
    } catch (_) {}

    /*
     * 舊版相容：
     * 原本已經有插件在聽這個事件。
     */
    if (
      phase === "before-restart" ||
      phase === "after-restart"
    ) {
      try {
        document.dispatchEvent(
          new CustomEvent(
            "firehaha:reader-restart",
            {
              detail: {
                phase:
                  phase ===
                  "before-restart"
                    ? "before"
                    : "after"
              }
            }
          )
        );
      } catch (_) {}
    }
  }


  function runLifecycle(
    phase,
    detail
  ){
    if (lifecycleRunning) {
      dispatchLifecycleEvent(
        phase,
        detail
      );

      return;
    }

    lifecycleRunning =
      true;

    try {
      lifecycleHandlers.forEach(
        function(
          handlers,
          name
        ){
          if (!handlers) {
            return;
          }

          const fn =
            handlers[phase] ||
            handlers[
              phase.replace(
                /-([a-z])/g,
                function(
                  _,
                  letter
                ){
                  return letter
                    .toUpperCase();
                }
              )
            ];

          if (
            typeof fn !==
            "function"
          ) {
            return;
          }

          try {
            fn(
              Object.assign(
                {
                  phase:
                    phase,
                  name:
                    name
                },
                detail || {}
              )
            );
          } catch (error) {
            console.warn(
              "[Firehaha Lifecycle] " +
              name +
              " / " +
              phase +
              " 失敗",
              error
            );
          }
        }
      );

      dispatchLifecycleEvent(
        phase,
        detail
      );

    } finally {
      lifecycleRunning =
        false;
    }
  }


  lifecycleApi();


  // =====================================================
  // RPG State / Snapshot
  // =====================================================

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


  function cloneValue(value){
    try {
      if (
        typeof structuredClone ===
        "function"
      ) {
        return structuredClone(
          value
        );
      }
    } catch (_) {}

    try {
      return JSON.parse(
        JSON.stringify(
          value
        )
      );
    } catch (_) {
      return null;
    }
  }


  function normalizeAdventure(
    adventure
  ){
    const source =
      adventure &&
      typeof adventure ===
        "object"
        ? adventure
        : {};

    const empty =
      createEmptyAdventure();

    Object.keys(
      empty
    ).forEach(
      function(key){
        if (
          source[key] ==
          null
        ) {
          source[key] =
            cloneValue(
              empty[key]
            );
        }
      }
    );

    source.items =
      Array.isArray(
        source.items
      )
        ? source.items
        : [];

    source.flags =
      Array.isArray(
        source.flags
      )
        ? source.flags
        : [];

    [
      "values",
      "attributes",
      "modifiers",
      "skills",
      "skillModifiers",
      "quests",
      "dice",
      "checks",
      "checkBands",
      "damage",
      "damageRules",
      "successDice",
      "applied",
      "definitionApplied",
      "names",
      "createdDisplayTags"
    ].forEach(
      function(key){
        source[key] =
          source[key] &&
          typeof source[key] ===
            "object"
            ? source[key]
            : {};
      }
    );

    source.diceModelVersion =
      2;

    return source;
  }


  function firstPageId(){
    return (
      Array.isArray(pages) &&
      pages[0] &&
      pages[0].id
    ) || "";
  }


  function currentPageId(){
    try {
      return (
        typeof currentId !==
          "undefined"
          ? String(
              currentId ||
              ""
            )
          : ""
      );
    } catch (_) {
      return "";
    }
  }


  function stamp(){
    return new Date()
      .toLocaleString();
  }


  function makeSnapshot(
    id,
    label
  ){
    return {
      id:
        String(
          id ||
          currentPageId()
        ),

      time:
        stamp(),

      label:
        label ||
        "",

      snapshotVersion:
        2,

      adventure:
        cloneValue(
          normalizeAdventure(
            memorySave.adventure
          )
        )
    };
  }


  function saveNow(){
    try {
      if (
        typeof persist ===
        "function"
      ) {
        persist();
      }
    } catch (error) {
      console.warn(
        "[Firehaha] 儲存 Reader 狀態失敗",
        error
      );
    }
  }


  function toastSafe(
    message
  ){
    try {
      if (
        typeof toast ===
        "function"
      ) {
        toast(message);
        return;
      }
    } catch (_) {}

    console.info(
      "[Firehaha]",
      message
    );
  }


  function refreshSavePanel(){
    try {
      if (
        typeof renderSaves ===
        "function"
      ) {
        renderSaves();
      }
    } catch (_) {}
  }


  function refreshAdventurePanel(){
    try {
      if (
        typeof renderAdventure ===
        "function"
      ) {
        renderAdventure();
      }
    } catch (_) {}
  }


  // =====================================================
  // Runtime Reset Coordinator
  // =====================================================

  function callResetApi(
    name,
    methods
  ){
    try {
      const target =
        window[name];

      if (!target) {
        return false;
      }

      const candidates =
        Array.isArray(
          methods
        )
          ? methods
          : [
              methods
            ];

      for (
        const method of
        candidates
      ) {
        if (
          method &&
          typeof target[
            method
          ] ===
            "function"
        ) {
          target[
            method
          ]();

          return true;
        }
      }
    } catch (error) {
      console.warn(
        "[Firehaha] 重置 " +
        name +
        " 失敗",
        error
      );
    }

    return false;
  }


  function resetKnownMediaUi(){
    document
      .querySelectorAll(
        "audio,video"
      )
      .forEach(
        function(media){
          try {
            media.pause();
            media.currentTime =
              0;
            media.playbackRate =
              1;

            if (
              "volume" in
              media
            ) {
              media.volume =
                1;
            }
          } catch (_) {}
        }
      );

    document
      .querySelectorAll(
        ".fh-native-audio-error," +
        ".fh-video-error"
      )
      .forEach(
        function(note){
          note.remove();
        }
      );

    document
      .querySelectorAll(
        ".fh-video-overlay," +
        ".fh-video-background"
      )
      .forEach(
        function(layer){
          layer.remove();
        }
      );

    document
      .querySelectorAll(
        ".fh-audio-button," +
        ".fh-video-button"
      )
      .forEach(
        function(button){
          button.classList.remove(
            "is-playing"
          );

          button.setAttribute(
            "aria-pressed",
            "false"
          );
        }
      );
  }


  function resetDamageDiceRuntime(){
    callResetApi(
      "FirehahaDamageDiceHelper",
      [
        "clearDamageRollLocks",
        "resetDamageRollLocks",
        "reset"
      ]
    );

    callResetApi(
      "FirehahaRollRollOnceGuard",
      [
        "clear",
        "reset"
      ]
    );

    callResetApi(
      "FirehahaDamageDiceSingleLock",
      [
        "clear",
        "reset"
      ]
    );

    document
      .querySelectorAll(
        ".fh-damage-helper-roll-locked," +
        ".fh-roll-once-locked," +
        ".fh-damage-single-lock-result"
      )
      .forEach(
        function(node){
          try {
            node.remove();
          } catch (_) {}
        }
      );

    document
      .querySelectorAll(
        "[data-fh-roll-once]"
      )
      .forEach(
        function(node){
          try {
            node.removeAttribute(
              "data-fh-roll-once"
            );

            node.removeAttribute(
              "aria-disabled"
            );

            if (
              "disabled" in node
            ) {
              node.disabled =
                false;
            }

            if (node.style) {
              node.style.pointerEvents =
                "";
            }
          } catch (_) {}
        }
      );

    try {
      document.dispatchEvent(
        new CustomEvent(
          "firehaha:damage-runtime-reset",
          {
            detail: {
              at:
                Date.now()
            }
          }
        )
      );
    } catch (_) {}
  }


  function resetKnownPluginRuntime(
    reason
  ){
    /*
     * 只處理「目前 Reader 運作狀態」，
     * 不碰作者設定或編輯器設定。
     */
    callResetApi(
      "FirehahaAutoJump",
      [
        "reset",
        "clearHistory"
      ]
    );

    callResetApi(
      "FirehahaAutoDiceJump",
      [
        "reset",
        "clearHistory"
      ]
    );

    callResetApi(
      "FirehahaAutoDice",
      [
        "reset"
      ]
    );

    callResetApi(
      "FirehahaOpposedDice",
      [
        "reset"
      ]
    );

    callResetApi(
      "FirehahaOpposedDiceJumpSequence",
      [
        "reset"
      ]
    );

    callResetApi(
      "FirehahaNativeAudioRuntime",
      [
        "reset",
        "stopAll"
      ]
    );

    callResetApi(
      "FirehahaNativeVideoRuntime",
      [
        "reset",
        "stopAll"
      ]
    );

    callResetApi(
      "FirehahaDraggableText",
      [
        "resetAll",
        "reset"
      ]
    );

    callResetApi(
      "FirehahaDamageValueBridge",
      [
        "clearApplied",
        "reset"
      ]
    );

    resetDamageDiceRuntime();

    /*
     * 未來外掛不需要再修改這支存檔插件。
     * 只要註冊 lifecycle handler 或監聽
     * firehaha:reader-lifecycle 即可。
     */
    runLifecycle(
      "reset-runtime",
      {
        reason:
          reason ||
          "unknown"
      }
    );

    resetKnownMediaUi();
  }


  // =====================================================
  // Full Save / Load
  // =====================================================

  function saveSlot(
    index
  ){
    memorySave.slots =
      Array.isArray(
        memorySave.slots
      )
        ? memorySave.slots
        : [];

    while (
      memorySave.slots
        .length <= index
    ) {
      memorySave.slots
        .push(null);
    }

    const pageId =
      currentPageId();

    memorySave.slots[
      index
    ] =
      makeSnapshot(
        pageId
      );

    saveNow();
    refreshSavePanel();

    toastSafe(
      "槽位 " +
      (index + 1) +
      " 已保存完整 RPG 狀態"
    );
  }


  function restoreSnapshot(
    slot,
    source
  ){
    if (
      !slot ||
      !slot.id ||
      !pages.some(
        function(page){
          return (
            page.id ===
            slot.id
          );
        }
      )
    ) {
      return false;
    }

    runLifecycle(
      "before-load",
      {
        source:
          source ||
          "slot",
        slot:
          slot
      }
    );

    resetKnownPluginRuntime(
      "load"
    );

    if (
      slot.adventure &&
      typeof slot.adventure ===
        "object"
    ) {
      memorySave.adventure =
        normalizeAdventure(
          cloneValue(
            slot.adventure
          )
        );

    } else {
      /*
       * 舊版槽位只有頁面 ID / time。
       * 不能憑空還原當年的 RPG 狀態，
       * 因此只保留舊版的「位置書籤」行為。
       */
      toastSafe(
        "這是舊式書籤存檔，只能還原頁面位置；重新存檔後會升級為完整 RPG 快照"
      );
    }

    history.length =
      0;

    try {
      if (
        typeof typeToken !==
        "undefined"
      ) {
        typeToken +=
          1;
      }
    } catch (_) {}

    show(
      slot.id,
      true
    );

    saveNow();
    refreshSavePanel();
    refreshAdventurePanel();

    runLifecycle(
      "after-load",
      {
        source:
          source ||
          "slot",
        slot:
          slot
      }
    );

    return true;
  }


  /*
   * 主程式原本的 renderSaves() 只存：
   * { id, time }
   *
   * 用 capture listener 在核心 onclick 前接管，
   * 不修改主程式即可升級為：
   * { id, time, snapshotVersion, adventure }
   */
  document.addEventListener(
    "click",

    function(event){
      const saveButton =
        event.target &&
        event.target.closest
          ? event.target.closest(
              "[data-save]"
            )
          : null;

      if (saveButton) {
        const index =
          Number(
            saveButton.dataset
              .save
          );

        if (
          Number.isInteger(
            index
          )
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();

          saveSlot(index);
        }

        return;
      }


      const loadButton =
        event.target &&
        event.target.closest
          ? event.target.closest(
              "[data-load]"
            )
          : null;

      if (loadButton) {
        const index =
          Number(
            loadButton.dataset
              .load
          );

        const slot =
          Array.isArray(
            memorySave.slots
          )
            ? memorySave.slots[
                index
              ]
            : null;

        if (slot) {
          event.preventDefault();
          event.stopImmediatePropagation();

          restoreSnapshot(
            slot,
            "manual"
          );
        }

        return;
      }


      const autoButton =
        event.target &&
        event.target.closest
          ? event.target.closest(
              "[data-load-auto]"
            )
          : null;

      if (
        autoButton &&
        memorySave.auto
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();

        restoreSnapshot(
          memorySave.auto,
          "auto"
        );
      }
    },

    true
  );


  /*
   * 自動存檔原本也是位置書籤。
   * 包住 persist()：偵測 auto 的 id/time 改變時，
   * 把當下 adventure 快照補進去。
   */
  try {
    if (
      typeof persist ===
        "function" &&
      !persist
        .__firehahaFullSnapshotWrapped
    ) {
      const corePersist =
        persist;

      let lastAutoSignature =
        memorySave.auto
          ? [
              memorySave.auto.id,
              memorySave.auto.time
            ].join("::")
          : "";

      persist =
        function(){
          try {
            if (
              memorySave.auto
            ) {
              const signature =
                [
                  memorySave.auto.id,
                  memorySave.auto.time
                ].join("::");

              if (
                signature !==
                lastAutoSignature
              ) {
                lastAutoSignature =
                  signature;

                memorySave.auto
                  .snapshotVersion =
                  2;

                memorySave.auto
                  .adventure =
                  cloneValue(
                    normalizeAdventure(
                      memorySave.adventure
                    )
                  );
              }
            }
          } catch (
            error
          ) {
            console.warn(
              "[Firehaha] 自動存檔快照建立失敗",
              error
            );
          }

          return corePersist();
        };

      persist
        .__firehahaFullSnapshotWrapped =
        true;
    }
  } catch (error) {
    console.warn(
      "[Firehaha] 無法升級 persist()",
      error
    );
  }


  // =====================================================
  // Restart
  // =====================================================

  function setRestartButtonBusy(
    busy
  ){
    const button =
      document.querySelector(
        ".firehaha-new-game-btn"
      );

    if (!button) {
      return;
    }

    button.disabled =
      !!busy;

    button.textContent =
      busy
        ? "↻ 正在重新開始…"
        : "↻ 重新開始";
  }


  function resetKnownButtonUi(){
    const tools =
      document.getElementById(
        "firehaha-new-game-save-tools"
      );

    if (tools) {
      tools.classList.remove(
        "is-collapsed"
      );
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

    [
      "savePanel",
      "storyPanel"
    ].forEach(
      function(id){
        const panel =
          document.getElementById(
            id
          );

        if (panel) {
          panel.classList.remove(
            "open"
          );
        }
      }
    );
  }


  function completeRestart(
    startId
  ){
    try {
      /*
       * 再清一次，避免剛結束的骰子/媒體 callback
       * 在延遲期間重新建立 runtime state。
       */
      resetKnownPluginRuntime(
        "restart-final"
      );

      const preservedSlots =
        Array.isArray(
          memorySave.slots
        )
          ? cloneValue(
              memorySave.slots
            ) || []
          : [];

      memorySave = {
        slots:
          preservedSlots,

        auto:
          null,

        adventure:
          createEmptyAdventure()
      };

      /*
       * 新 adventure 建立完成後再清一次，
       * 避免傷害骰 Helper 仍拿舊 adventure 當 baseline。
       */
      resetDamageDiceRuntime();

      history.length =
        0;

      try {
        if (
          typeof typeToken !==
          "undefined"
        ) {
          typeToken +=
            1;
        }
      } catch (_) {}

      show(
        startId,
        true
      );

      /*
       * Reader 重畫後再清最後一次，
       * 防止舊骰 callback / wrapper 又把鎖定狀態建立回來。
       */
      setTimeout(
        function(){
          resetDamageDiceRuntime();

          try {
            if (
              typeof renderAdventure ===
              "function"
            ) {
              renderAdventure();
            }
          } catch (_) {}
        },
        0
      );

      saveNow();
      refreshSavePanel();
      refreshAdventurePanel();
      resetKnownButtonUi();

      runLifecycle(
        "after-restart",
        {
          startId:
            startId
        }
      );

      toastSafe(
        "故事、RPG、骰子、媒體與插件 Runtime 已全部重新開始；手動存檔保留"
      );

    } finally {
      restarting =
        false;

      setRestartButtonBusy(
        false
      );
    }
  }


  function restartStory(){
    if (restarting) {
      return;
    }

    const startId =
      firstPageId();

    if (!startId) {
      alert(
        "找不到故事起始頁面。"
      );

      return;
    }

    const accepted =
      confirm(
        "確定要重新開始故事嗎？\\n\\n" +
        "將會清除目前遊戲：\\n" +
        "・目前劇情位置與返回歷史\\n" +
        "・物品、旗幟、一般數值\\n" +
        "・屬性、技能與修正值\\n" +
        "・骰子、檢定、傷害與對抗結果\\n" +
        "・任務、名稱與自訂顯示標籤\\n" +
        "・一次性事件與插件 Runtime\\n" +
        "・音樂、影片、自動跳轉與待執行計時器\\n\\n" +
        "手動存檔槽會完整保留，可以之後讀回舊進度。"
      );

    if (!accepted) {
      return;
    }

    restarting =
      true;

    setRestartButtonBusy(
      true
    );

    runLifecycle(
      "before-restart",
      {
        startId:
          startId
      }
    );

    resetKnownPluginRuntime(
      "restart"
    );

    /*
     * 等原生骰動畫 callback 結束，
     * 避免舊骰值寫回新 adventure。
     */
    const rolling =
      document.querySelector(
        ".story-dice.rolling," +
        ".story-fate.rolling"
      );

    if (rolling) {
      toastSafe(
        "正在結束目前的擲骰，再重新開始…"
      );

      setTimeout(
        function(){
          completeRestart(
            startId
          );
        },
        900
      );

      return;
    }

    completeRestart(
      startId
    );
  }


  // =====================================================
  // Save Slot UI
  // =====================================================

  function addSaveSlot(){
    memorySave.slots =
      Array.isArray(
        memorySave.slots
      )
        ? memorySave.slots
        : [];

    memorySave.slots
      .push(null);

    saveNow();
    refreshSavePanel();

    toastSafe(
      "已新增存檔槽，目前共 " +
      memorySave.slots.length +
      " 格"
    );
  }


  function findToolHost(){
    return (
      document.getElementById(
        "savePanel"
      ) ||
      document.getElementById(
        "saveSlots"
      ) ||
      document.getElementById(
        "readerTools"
      ) ||
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
      document.createElement(
        "div"
      );

    tools.id =
      "firehaha-new-game-save-tools";

    tools.className =
      "firehaha-reader-extra-tools";


    const restartButton =
      document.createElement(
        "button"
      );

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
      document.createElement(
        "button"
      );

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
      document.createElement(
        "button"
      );

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


    const note =
      document.createElement(
        "div"
      );

    note.className =
      "firehaha-save-snapshot-note";

    note.textContent =
      "手動槽現在會保存頁面位置＋完整 RPG 狀態；舊式槽位讀取後重新存檔即可升級。";


    tools.append(
      restartButton,
      addSlotButton,
      collapseButton
    );


    if (
      host.id ===
      "savePanel"
    ) {
      const saveSlots =
        document.getElementById(
          "saveSlots"
        );

      if (saveSlots) {
        host.insertBefore(
          note,
          saveSlots
        );

        host.insertBefore(
          tools,
          note
        );
      } else {
        host.append(
          tools,
          note
        );
      }

    } else if (
      host.id ===
        "saveSlots" &&
      host.parentNode
    ) {
      host.parentNode
        .insertBefore(
          tools,
          host
        );

      host.parentNode
        .insertBefore(
          note,
          host
        );

    } else {
      host.append(
        tools,
        note
      );
    }
  }


  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      installButtons,
      {
        once:
          true
      }
    );
  } else {
    installButtons();
  }


  let attempts =
    0;

  const timer =
    setInterval(
      function(){
        attempts +=
          1;

        installButtons();

        if (
          document.getElementById(
            "firehaha-new-game-save-tools"
          ) ||
          attempts >=
            30
        ) {
          clearInterval(
            timer
          );
        }
      },
      250
    );


  window.FirehahaNewGameSaveSlots = {
    version:
      "1.0.5",

    restartStory:
      restartStory,

    addSaveSlot:
      addSaveSlot,

    saveSlot:
      saveSlot,

    loadSlot(index){
      const slot =
        Array.isArray(
          memorySave.slots
        )
          ? memorySave.slots[
              Number(index)
            ]
          : null;

      return restoreSnapshot(
        slot,
        "api"
      );
    },

    resetRuntime(){
      resetKnownPluginRuntime(
        "api"
      );
    },

    lifecycle:
      lifecycleApi()
  };


  console.info(
    "[Firehaha] 重新開始／擴充存檔槽 1.0.5 整合版已接入"
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
      "官方重新開始／擴充存檔槽 1.0.5 整合版已啟用"
    );

    return function cleanup() {
      if (
        typeof removeTransform ===
        "function"
      ) {
        removeTransform();
      }
    };
  }
});
