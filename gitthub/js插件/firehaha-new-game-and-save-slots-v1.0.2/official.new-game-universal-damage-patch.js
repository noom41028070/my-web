// @firehaha-plugin {"id":"official.new-game-universal-damage-patch","name":"重新開始 × 通用傷害正式補丁","version":"1.0.0","author":"Firehaha","description":"直接在 Reader Artifact 生成階段修補 official.new-game-and-save-slots v1.0.5，將 universalDamage 納入空白 adventure、存檔正規化與 Runtime reset。"}
FirehahaPlugins.register({
  id: "official.new-game-universal-damage-patch",

  setup(api) {
    "use strict";

    const removeTransform = api.registerReaderTransform(
      "reader",

      function(html, context) {
        html = String(html == null ? "" : html);

        const doneMarker =
          "/* firehaha-new-game-universal-damage-patch-v1.0.0 */";

        if (html.includes(doneMarker)) {
          return html;
        }

        /*
         * 這支不是在 Reader 執行後「旁聽事件」，
         * 而是在 Reader Artifact 建立時，直接修補
         * new-game-and-save-slots v1.0.5 已注入的程式碼。
         *
         * 因此很適合透過插件管理器安裝：
         * 管理器只要讓這個 transform 參與下一次測試閱讀 / 輸出即可。
         */

        if (
          !html.includes(
            "/* firehaha-new-game-and-save-slots-v1.0.5 */"
          )
        ) {
          console.warn(
            "[NewGame × UniversalDamage Patch] " +
            "Reader 中找不到 new-game-and-save-slots v1.0.5；" +
            "請確認該插件已啟用，而且本補丁優先度在它之後。"
          );

          return html;
        }

        let changed = false;


        // =====================================================
        // 1. createEmptyAdventure() 正式加入 universalDamage
        // =====================================================

        if (
          !html.includes(
            "universalDamage: {}"
          )
        ) {
          const before =
`      damage: {},
      damageRules: {},
      successDice: {},`;

          const after =
`      damage: {},
      damageRules: {},
      universalDamage: {},
      successDice: {},`;

          if (html.includes(before)) {
            html = html.replace(
              before,
              after
            );

            changed = true;
          } else {
            console.warn(
              "[NewGame × UniversalDamage Patch] " +
              "找不到 createEmptyAdventure() 的 damage 欄位"
            );
          }
        }


        // =====================================================
        // 2. normalizeAdventure() 納入 universalDamage
        //
        // 這樣手動存檔 / 讀檔也會把它視為正式 RPG 狀態欄位。
        // =====================================================

        const normalizeBefore =
`      "damage",
      "damageRules",
      "successDice",`;

        const normalizeAfter =
`      "damage",
      "damageRules",
      "universalDamage",
      "successDice",`;

        if (
          !html.includes(
            '"universalDamage",'
          )
        ) {
          if (
            html.includes(
              normalizeBefore
            )
          ) {
            html = html.replace(
              normalizeBefore,
              normalizeAfter
            );

            changed = true;
          } else {
            console.warn(
              "[NewGame × UniversalDamage Patch] " +
              "找不到 normalizeAdventure() 的欄位清單"
            );
          }
        }


        // =====================================================
        // 3. resetKnownPluginRuntime() 正式清 Universal Damage
        // =====================================================

        if (
          !html.includes(
            '"FirehahaUniversalDamage"'
          )
        ) {
          const resetBefore =
`    callResetApi(
      "FirehahaDamageValueBridge",
      [
        "clearApplied",
        "reset"
      ]
    );

    resetDamageDiceRuntime();`;

          const resetAfter =
`    callResetApi(
      "FirehahaDamageValueBridge",
      [
        "clearApplied",
        "reset"
      ]
    );

    /*
     * Universal Damage：
     * 清除 states、appliedReductions 與 universalDamage。
     */
    callResetApi(
      "FirehahaUniversalDamage",
      [
        "reset"
      ]
    );

    resetDamageDiceRuntime();`;

          if (
            html.includes(
              resetBefore
            )
          ) {
            html = html.replace(
              resetBefore,
              resetAfter
            );

            changed = true;
          } else {
            console.warn(
              "[NewGame × UniversalDamage Patch] " +
              "找不到 resetKnownPluginRuntime() 插入位置"
            );
          }
        }


        // =====================================================
        // 4. completeRestart() 新 adventure 建立後再保底一次
        //
        // UniversalDamage.reset() 在建立新 adventure 前會清舊狀態；
        // createEmptyAdventure() 現在已含 universalDamage:{}。
        // 再補一個 after-new-adventure reset，避免延遲 callback 復活。
        // =====================================================

        if (
          !html.includes(
            "firehaha-universal-damage-after-new-adventure"
          )
        ) {
          const restartBefore =
`      /*
       * 新 adventure 建立完成後再清一次，
       * 避免傷害骰 Helper 仍拿舊 adventure 當 baseline。
       */
      resetDamageDiceRuntime();`;

          const restartAfter =
`      /*
       * 新 adventure 建立完成後再清一次，
       * 避免傷害骰 Helper 仍拿舊 adventure 當 baseline。
       */
      resetDamageDiceRuntime();

      /* firehaha-universal-damage-after-new-adventure */
      callResetApi(
        "FirehahaUniversalDamage",
        [
          "reset"
        ]
      );

      if (
        memorySave &&
        memorySave.adventure
      ) {
        memorySave.adventure.universalDamage = {};
      }`;

          if (
            html.includes(
              restartBefore
            )
          ) {
            html = html.replace(
              restartBefore,
              restartAfter
            );

            changed = true;
          } else {
            console.warn(
              "[NewGame × UniversalDamage Patch] " +
              "找不到 completeRestart() 的新 adventure reset 位置"
            );
          }
        }


        if (!changed) {
          console.warn(
            "[NewGame × UniversalDamage Patch] " +
            "沒有任何段落被修改；可能主插件版本已變更"
          );

          return html;
        }


        /*
         * 加入 marker，方便直接從輸出 Reader 原始碼確認補丁是否真的進去。
         */
        html = html.replace(
          "/* firehaha-new-game-and-save-slots-v1.0.5 */",
          "/* firehaha-new-game-and-save-slots-v1.0.5 */\n" +
          doneMarker
        );

        console.info(
          "[NewGame × UniversalDamage Patch] Reader Artifact 已完成修補"
        );

        return html;
      },

      /*
       * new-game-and-save-slots = 300
       * Universal Damage 約 = 340
       *
       * 用 360：
       * 先讓兩支正式插件把內容寫進 Reader，
       * 最後再直接修補 new-game v1.0.5 的程式碼。
       */
      360
    );

    api.toast(
      "重新開始 × 通用傷害正式補丁已啟用"
    );

    return function cleanup() {
      removeTransform();
    };
  }
});
