// @firehaha-plugin {"id":"official.dice-if-conflict-arbiter","name":"骰子如果式衝突仲裁器","version":"1.0.0","author":"Firehaha","description":"統一仲裁原生骰、自動骰、對抗骰與持續對抗的 [如果] 條件，避免多支 Reader Hook 提前吃掉條件或錯走否則。"}

FirehahaPlugins.register({
  id: "official.dice-if-conflict-arbiter",

  setup(api) {
    "use strict";

    const MARK =
      "data-fh-dice-if-conflict-arbiter-v1";

    function readerRuntime() {
      "use strict";

      if (window.__fhDiceIfConflictArbiterV1) {
        return;
      }

      window.__fhDiceIfConflictArbiterV1 =
        true;

      if (typeof applyAdventure !== "function") {
        console.warn(
          "[Dice If Arbiter] 找不到 applyAdventure"
        );
        return;
      }

      /*
       * 這支必須最後包住目前已經被其他插件包過的 applyAdventure。
       * 因此 oldApplyAdventure 代表：
       *
       * 主程式
       * + auto-dice-jump
       * + dice-auto-if
       * + opposed-dice
       * + 其他較早掛入的 Reader Hook
       */
      const oldApplyAdventure =
        applyAdventure;


      function num(value) {
        const n =
          Number(value);

        return Number.isFinite(n)
          ? n
          : null;
      }


      function normalizeOperator(value) {
        return String(value || "")
          .replace(/&lt;/gi, "<")
          .replace(/&gt;/gi, ">")
          .replace(/＞/g, ">")
          .replace(/＜/g, "<")
          .replace(/＝/g, "=")
          .trim();
      }


      function compare(
        actual,
        operator,
        expected
      ) {
        const a =
          num(actual);

        const b =
          num(expected);

        if (
          a == null ||
          b == null
        ) {
          return false;
        }

        switch (
          normalizeOperator(operator)
        ) {
          case ">=":
            return a >= b;

          case "<=":
            return a <= b;

          case ">":
            return a > b;

          case "<":
            return a < b;

          case "!=":
          case "<>":
            return a !== b;

          case "=":
          case "==":
            return a === b;
        }

        return false;
      }


      function normalizeResult(value) {
        const text =
          String(value || "")
            .trim();

        if (
          text === "左" ||
          text === "左勝" ||
          text === "左方勝" ||
          text === "左方勝出" ||
          text === "玩家勝" ||
          text === "玩家勝出" ||
          text === "玩家方勝" ||
          text === "玩家方勝出" ||
          text === "玩家獲勝" ||
          text === "A勝" ||
          text === "A方勝"
        ) {
          return "左勝";
        }

        if (
          text === "右" ||
          text === "右勝" ||
          text === "右方勝" ||
          text === "右方勝出" ||
          text === "敵人勝" ||
          text === "敵方勝" ||
          text === "敵方勝出" ||
          text === "敵人勝出" ||
          text === "敵方獲勝" ||
          text === "B勝" ||
          text === "B方勝"
        ) {
          return "右勝";
        }

        if (
          text === "平" ||
          text === "平手" ||
          text === "平局" ||
          text === "和局"
        ) {
          return "平手";
        }

        return text;
      }


      function getAdventure() {
        try {
          if (
            typeof memorySave !==
              "undefined" &&
            memorySave &&
            memorySave.adventure
          ) {
            return memorySave.adventure;
          }
        } catch (error) {}

        try {
          if (
            window.memorySave &&
            window.memorySave.adventure
          ) {
            return window.memorySave.adventure;
          }
        } catch (error) {}

        return null;
      }


      function nativeTotal(value) {
        if (
          value &&
          typeof value === "object"
        ) {
          const total =
            num(value.total);

          if (total != null) {
            return total;
          }

          const direct =
            num(value.value);

          return direct;
        }

        return num(value);
      }


      function findNativeDice(name) {
        const requested =
          String(name || "")
            .trim();

        const adventure =
          getAdventure();

        if (
          adventure &&
          adventure.dice
        ) {
          const entries =
            Object.entries(
              adventure.dice
            )
              .filter(
                ([key]) =>
                  !String(key)
                    .startsWith(
                      "__damage_"
                    ) &&
                  !String(key)
                    .startsWith(
                      "__success_"
                    ) &&
                  !String(key)
                    .startsWith(
                      "__check_"
                    )
              );

          if (!requested) {
            const last =
              entries.find(
                ([key]) =>
                  key === "__last"
              ) ||
              entries[
                entries.length - 1
              ];

            if (last) {
              return nativeTotal(
                last[1]
              );
            }
          }

          for (
            let i =
              entries.length - 1;

            i >= 0;

            i--
          ) {
            const [
              key,
              value
            ] =
              entries[i];

            const data =
              (
                value &&
                typeof value ===
                  "object"
              )
                ? value
                : {
                    total:
                      value,
                    attribute:
                      key
                  };

            const attribute =
              String(
                data.attribute ||
                ""
              ).trim();

            const candidates =
              [
                String(key),
                attribute,
                String(key)
                  .replace(
                    /^(?:屬性|技能|attribute|skill):/i,
                    ""
                  ),
                attribute
                  .replace(
                    /^(?:屬性|技能|attribute|skill):/i,
                    ""
                  )
              ]
                .map(
                  item =>
                    String(item)
                      .trim()
                );

            if (
              candidates.includes(
                requested
              )
            ) {
              const total =
                nativeTotal(
                  data
                );

              if (total != null) {
                return total;
              }
            }
          }
        }


        /*
         * memorySave 還沒拿到時，用目前 Reader DOM 保底。
         */
        const buttons =
          Array.from(
            document.querySelectorAll(
              ".story-dice"
            )
          );

        for (
          let i =
            buttons.length - 1;

          i >= 0;

          i--
        ) {
          const button =
            buttons[i];

          const process =
            button.querySelector(
              ".dice-process"
            );

          if (!process) {
            continue;
          }

          const text =
            String(
              process.textContent ||
              ""
            ).trim();

          if (
            !text ||
            text.includes("點擊") ||
            text.includes("擲骰中")
          ) {
            continue;
          }

          const matches =
            Array.from(
              text.matchAll(
                /[＝=]\s*(-?\d+(?:\.\d+)?)/g
              )
            );

          if (!matches.length) {
            continue;
          }

          const total =
            num(
              matches[
                matches.length - 1
              ][1]
            );

          if (total == null) {
            continue;
          }

          const key =
            String(
              button.dataset.key ||
              ""
            ).trim();

          const attribute =
            String(
              button.dataset.attribute ||
              ""
            ).trim();

          const candidates =
            [
              key,
              attribute,
              key.replace(
                /^(?:屬性|技能|attribute|skill):/i,
                ""
              ),
              attribute.replace(
                /^(?:屬性|技能|attribute|skill):/i,
                ""
              )
            ]
              .map(
                item =>
                  String(item)
                    .trim()
              );

          if (
            !requested ||
            candidates.includes(
              requested
            )
          ) {
            return total;
          }
        }

        return null;
      }


      function findAutoDice(name) {
        const requested =
          String(name || "")
            .trim();

        /*
         * 正式 API 優先。
         */
        try {
          if (
            window.FirehahaAutoDice &&
            typeof
              window.FirehahaAutoDice.get ===
                "function"
          ) {
            const data =
              window.FirehahaAutoDice.get(
                requested
              );

            if (data != null) {
              const value =
                (
                  typeof data ===
                    "object"
                )
                  ? num(
                      data.total ??
                      data.value
                    )
                  : num(data);

              if (value != null) {
                return value;
              }
            }
          }
        } catch (error) {}


        /*
         * 相容舊版公開結果。
         */
        const exposed =
          window.__fhAutoDiceResults;

        if (exposed) {
          if (requested) {
            const direct =
              exposed[
                requested
              ] ??
              exposed[
                "name:" +
                requested
              ];

            const value =
              (
                direct &&
                typeof direct ===
                  "object"
              )
                ? num(
                    direct.total ??
                    direct.value
                  )
                : num(direct);

            if (value != null) {
              return value;
            }
          } else {
            const values =
              Object.values(
                exposed
              );

            for (
              let i =
                values.length - 1;

              i >= 0;

              i--
            ) {
              const item =
                values[i];

              const value =
                (
                  item &&
                  typeof item ===
                    "object"
                )
                  ? num(
                      item.total ??
                      item.value
                    )
                  : num(item);

              if (value != null) {
                return value;
              }
            }
          }
        }


        /*
         * 最後才掃目前 DOM。
         */
        const elements =
          Array.from(
            document.querySelectorAll(
              ".fh-auto-dice-result"
            )
          );

        for (
          let i =
            elements.length - 1;

          i >= 0;

          i--
        ) {
          const element =
            elements[i];

          const label =
            String(
              element
                .querySelector(
                  ".fh-auto-dice-label"
                )
                ?.textContent ||
              ""
            ).trim();

          if (
            requested &&
            label !== requested
          ) {
            continue;
          }

          const value =
            num(
              element.getAttribute(
                "data-total"
              ) ||
              element.getAttribute(
                "data-result"
              )
            );

          if (value != null) {
            return value;
          }
        }

        return null;
      }


      function getOpposed(name, persistent) {
        const requested =
          String(name || "")
            .trim();

        const primary =
          persistent
            ? (
                window
                  .FirehahaPersistentOpposedDice ||
                window
                  .FirehahaOpposedDice
              )
            : window
                .FirehahaOpposedDice;

        if (
          !primary ||
          typeof primary.get !==
            "function"
        ) {
          return null;
        }

        try {
          return (
            primary.get(
              requested
            ) ||
            null
          );
        } catch (error) {
          return null;
        }
      }


      function protectIfBlocks(source) {
        const blocks = [];

        /*
         * 只攔截這支仲裁器負責的條件。
         * 其他 [如果:旗幟]、[如果:持有] 等仍交回原本系統。
         */
        const pattern =
          /\[如果:(?:(?:骰子|自動骰)(?::[^<>=!\]\r\n]+)?\s*(?:&lt;=?|&gt;=?|>=|<=|==|!=|<>|>|<|=)\s*-?\d+(?:\.\d+)?|(?:對抗|持續對抗):[^=\]\r\n]+=[^\]\r\n]+|(?:對抗差值|持續對抗差值):[^<>=!\]\r\n]+\s*(?:>=|<=|==|!=|<>|>|<|=)\s*-?\d+(?:\.\d+)?)\][\s\S]*?\[\/如果\]/gi;

        const html =
          String(source || "")
            .replace(
              pattern,
              function(whole) {
                const index =
                  blocks.length;

                blocks.push(
                  whole
                );

                return (
                  "@@FH_IF_ARBITER_" +
                  index +
                  "@@"
                );
              }
            );

        return {
          html,

          restore(value) {
            return String(
              value || ""
            ).replace(
              /@@FH_IF_ARBITER_(\d+)@@/g,
              function(
                whole,
                indexText
              ) {
                const index =
                  Number(
                    indexText
                  );

                return (
                  Number.isInteger(
                    index
                  ) &&
                  blocks[index] != null
                )
                  ? blocks[index]
                  : whole;
              }
            );
          }
        };
      }


      function evaluateCondition(
        condition
      ) {
        const text =
          String(
            condition || ""
          ).trim();

        let match;


        /*
         * [如果:骰子:力量>=15]
         * [如果:骰子>=15]
         */
        match =
          text.match(
            /^骰子(?::([^<>=!]+))?\s*(>=|<=|==|!=|<>|>|<|=)\s*(-?\d+(?:\.\d+)?)$/
          );

        if (match) {
          const value =
            findNativeDice(
              match[1] ||
              ""
            );

          if (value == null) {
            return null;
          }

          return compare(
            value,
            match[2],
            match[3]
          );
        }


        /*
         * [如果:自動骰:敵人>=10]
         * [如果:自動骰>=10]
         */
        match =
          text.match(
            /^自動骰(?::([^<>=!]+))?\s*(>=|<=|==|!=|<>|>|<|=)\s*(-?\d+(?:\.\d+)?)$/
          );

        if (match) {
          const value =
            findAutoDice(
              match[1] ||
              ""
            );

          if (value == null) {
            return null;
          }

          return compare(
            value,
            match[2],
            match[3]
          );
        }


        /*
         * [如果:對抗:決鬥=左勝]
         */
        match =
          text.match(
            /^對抗:([^=]+)=(.+)$/
          );

        if (match) {
          const data =
            getOpposed(
              match[1],
              false
            );

          if (
            !data ||
            !data.result ||
            data.result === "等待"
          ) {
            return null;
          }

          return (
            normalizeResult(
              data.result
            ) ===
            normalizeResult(
              match[2]
            )
          );
        }


        /*
         * [如果:持續對抗:決鬥=左勝]
         */
        match =
          text.match(
            /^持續對抗:([^=]+)=(.+)$/
          );

        if (match) {
          const data =
            getOpposed(
              match[1],
              true
            );

          if (
            !data ||
            !data.result ||
            data.result === "等待"
          ) {
            return null;
          }

          return (
            normalizeResult(
              data.result
            ) ===
            normalizeResult(
              match[2]
            )
          );
        }


        /*
         * [如果:對抗差值:決鬥>=5]
         */
        match =
          text.match(
            /^對抗差值:([^<>=!]+)\s*(>=|<=|==|!=|<>|>|<|=)\s*(-?\d+(?:\.\d+)?)$/
          );

        if (match) {
          const data =
            getOpposed(
              match[1],
              false
            );

          if (
            !data ||
            data.difference == null
          ) {
            return null;
          }

          return compare(
            data.difference,
            match[2],
            match[3]
          );
        }


        /*
         * [如果:持續對抗差值:決鬥>=5]
         */
        match =
          text.match(
            /^持續對抗差值:([^<>=!]+)\s*(>=|<=|==|!=|<>|>|<|=)\s*(-?\d+(?:\.\d+)?)$/
          );

        if (match) {
          const data =
            getOpposed(
              match[1],
              true
            );

          if (
            !data ||
            data.difference == null
          ) {
            return null;
          }

          return compare(
            data.difference,
            match[2],
            match[3]
          );
        }

        return null;
      }


      function processIfBlocks(html) {
        const pattern =
          /\[如果:([^\]\r\n]+)\]([\s\S]*?)(?:\[否則\]([\s\S]*?))?\[\/如果\]/gi;

        return String(
          html || ""
        ).replace(
          pattern,
          function(
            whole,
            condition,
            yesText,
            noText
          ) {
            const result =
              evaluateCondition(
                condition
              );

            /*
             * 尚未有結果時，不把控制標籤顯示給讀者。
             * 下一次 Reader 重畫仍會從原始 page.content
             * 重新進入仲裁器，所以結果出現後即可重新判定。
             */
            if (result === null) {
              return "";
            }

            return result
              ? String(
                  yesText || ""
                )
              : String(
                  noText || ""
                );
          }
        );
      }


      applyAdventure =
        function(page) {
          const clonedPage =
            Object.assign(
              {},
              page || {}
            );

          /*
           * 最外層先保護所有骰子相關如果式，
           * 讓裡面的三支插件都看不到它們，
           * 避免任何一支提早吃掉 [如果]/[否則]。
           */
          const protectedIf =
            protectIfBlocks(
              clonedPage.content ||
              ""
            );

          clonedPage.content =
            protectedIf.html;


          /*
           * 讓原本所有骰子模組照常完成：
           * - 原生骰
           * - 自動骰
           * - 對抗骰
           * - 自動跳轉
           */
          let html =
            oldApplyAdventure(
              clonedPage
            );


          /*
           * 所有骰值 / 對抗結果都建立後才還原。
           */
          html =
            protectedIf.restore(
              html
            );


          /*
           * 最後只由仲裁器做一次條件判定。
           */
          html =
            processIfBlocks(
              html
            );


          return html;
        };


      window.FirehahaDiceIfArbiter = {
        version:
          "1.0.0",

        evaluate:
          evaluateCondition,

        getNativeDice:
          findNativeDice,

        getAutoDice:
          findAutoDice,

        getOpposed(name) {
          return getOpposed(
            name,
            false
          );
        }
      };
    }


    const runtimeSource =
      "(" +
      readerRuntime.toString() +
      ")();";


    const removeTransform =
      api.registerReaderTransform(
        "reader",

        function(
          html,
          context
        ) {
          if (
            typeof html !== "string" ||
            html.includes(MARK)
          ) {
            return html;
          }


          const script =
            `<script ${MARK}>` +
            runtimeSource +
            `</scr` +
            `ipt>`;


          /*
           * 關鍵：
           * 不再依賴 "}loadState();"。
           *
           * 只找最後還存在的 loadState();
           * 並插在它正前方。
           *
           * 因為本 Transform 優先度最高，
           * 此時其他 Reader Hook 都已經完成注入，
           * 所以本 Runtime 會最後包住 applyAdventure。
           */
          const matches =
            Array.from(
              html.matchAll(
                /loadState\(\);/g
              )
            );


          if (
            matches.length
          ) {
            const last =
              matches[
                matches.length - 1
              ];

            const index =
              last.index;

            return (
              html.slice(
                0,
                index
              ) +
              script +
              "\n" +
              html.slice(
                index
              )
            );
          }


          /*
           * 最後保底：body 尾端。
           */
          if (
            /<\/body\s*>/i
              .test(html)
          ) {
            return html.replace(
              /<\/body\s*>/i,
              script +
              "\n</body>"
            );
          }

          return (
            html +
            script
          );
        },

        /*
         * 刻意比目前 255 / 600 / 850 / 1250 都晚。
         * 它就是最後仲裁層。
         */
        2000
      );


    api.toast(
      "骰子如果式衝突仲裁器已啟用"
    );


    return function cleanup() {
      removeTransform();
    };
  }
});
