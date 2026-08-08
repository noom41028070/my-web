// @firehaha-plugin {"id":"official.opposed-dice-engine-v1-1","name":"通用對抗骰模組 V1.1","version":"1.1.0","author":"Firehaha","description":"針對 Firehaha Reader 原生骰子資料建立通用對抗系統，可比較普通骰、檢定、傷害骰、成功骰、命運骰、自動骰與固定值，支援高者勝/低者勝、平手規則與如果條件。"}

FirehahaPlugins.register({
  id: "official.opposed-dice-engine-v1-1",

  setup(api) {
    "use strict";

    const MARK =
      "data-fh-opposed-dice-engine-v1-1";


    // =====================================================
    // Reader Runtime
    // =====================================================

    function readerRuntime() {
      "use strict";

      if (
        window.__fhOpposedDiceEngineV11
      ) {
        return;
      }

      window.__fhOpposedDiceEngineV11 =
        true;


      if (
        typeof applyAdventure !==
        "function"
      ) {
        console.warn(
          "[Opposed Dice] 找不到 applyAdventure"
        );
        return;
      }


      const oldApplyAdventure =
        applyAdventure;


      const opposedResults =
        Object.create(null);


      function esc(value) {
        return String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }


      function num(value) {
        const n =
          Number(value);

        return Number.isFinite(n)
          ? n
          : null;
      }


      function normalizeResultWord(
        value
      ) {
        const text =
          String(value || "")
            .trim();

        if (
          text === "左" ||
          text === "左勝" ||
          text === "玩家勝" ||
          text === "A勝"
        ) {
          return "左勝";
        }

        if (
          text === "右" ||
          text === "右勝" ||
          text === "敵方勝" ||
          text === "B勝"
        ) {
          return "右勝";
        }

        if (
          text === "平" ||
          text === "平手"
        ) {
          return "平手";
        }

        return text;
      }


      function getAdventure() {
        /*
         * Firehaha Reader 的 memorySave 可能是同一支 Reader
         * script 裡的 let / const，未必會成為 window.memorySave。
         *
         * 這個 Runtime 本身就是在 loadState() 前插進同一作用域，
         * 所以優先直接讀 lexical memorySave。
         */
        try {
          if (
            typeof memorySave !== "undefined" &&
            memorySave &&
            memorySave.adventure
          ) {
            return memorySave.adventure;
          }
        } catch (error) {}


        /*
         * 相容未來若主程式改成 window.memorySave。
         */
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


      // =====================================================
      // 普通骰
      // =====================================================

      function diceEntries() {
        const a =
          getAdventure();

        if (
          !a ||
          !a.dice
        ) {
          return [];
        }

        return Object.entries(
          a.dice
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
      }


      function diceData(
        key,
        value
      ) {
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
                  key ===
                  "__last"
                    ? ""
                    : key
              };

        return {
          key:
            String(key),

          total:
            num(
              data.total
            ),

          attribute:
            String(
              data.attribute ||
              ""
            ).trim(),

          result:
            String(
              data.result ||
              ""
            ).trim(),

          breakdown:
            String(
              data.breakdown ||
              ""
            ).trim()
        };
      }


      function parseDisplayedDiceTotal(
        button
      ) {
        if (!button) {
          return null;
        }

        const process =
          button.querySelector(
            ".dice-process"
          );

        if (!process) {
          return null;
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
          return null;
        }


        /*
         * 一般原生骰：
         * 1d20[9]=9
         * 1d20[9]＋14＝23
         *
         * 主程式目前主要使用全形 ＝，
         * 但也相容半形 =。
         */
        const equals =
          Array.from(
            text.matchAll(
              /[＝=]\s*(-?\d+(?:\.\d+)?)/g
            )
          );

        if (equals.length) {
          return Number(
            equals[
              equals.length - 1
            ][1]
          );
        }


        /*
         * 成功骰池顯示：
         * 成功 3 顆
         */
        const success =
          text.match(
            /成功\s*(-?\d+(?:\.\d+)?)\s*顆/
          );

        if (success) {
          return Number(
            success[1]
          );
        }


        /*
         * 有些結果最後使用箭頭。
         */
        const arrows =
          Array.from(
            text.matchAll(
              /→\s*(-?\d+(?:\.\d+)?)/g
            )
          );

        if (arrows.length) {
          return Number(
            arrows[
              arrows.length - 1
            ][1]
          );
        }


        return null;
      }


      function findDiceFromDom(
        name
      ) {
        const buttons =
          Array.from(
            document.querySelectorAll(
              ".story-dice"
            )
          );

        if (!buttons.length) {
          return null;
        }


        const target =
          String(name || "")
            .trim();


        for (
          let i =
            buttons.length - 1;

          i >= 0;

          i--
        ) {
          const button =
            buttons[i];


          const value =
            parseDisplayedDiceTotal(
              button
            );


          if (
            !Number.isFinite(value)
          ) {
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


          const checkName =
            String(
              button.dataset.checkName ||
              ""
            ).trim();


          const candidates =
            [
              key,
              attribute,
              checkName,
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
                value =>
                  String(value)
                    .trim()
              )
              .filter(Boolean);


          if (
            !target ||
            candidates.includes(
              target
            )
          ) {
            return {
              type:
                "骰子",
              name:
                target ||
                attribute ||
                key ||
                "最近骰",
              value,
              detail:
                String(
                  button
                    .querySelector(
                      ".dice-process"
                    )
                    ?.textContent ||
                  ""
                ).trim()
            };
          }
        }


        return null;
      }


      function findDice(
        name
      ) {
        const entries =
          diceEntries();

        if (
          !entries.length
        ) {
          return findDiceFromDom(
            name
          );
        }

        const target =
          String(name || "")
            .trim();

        if (!target) {
          const last =
            entries.find(
              ([key]) =>
                key ===
                "__last"
            );

          const pair =
            last ||
            entries[
              entries.length - 1
            ];

          const data =
            diceData(
              pair[0],
              pair[1]
            );

          return (
            data.total == null
          )
            ? null
            : {
                type:
                  "骰子",
                name:
                  data.attribute ||
                  "最近骰",
                value:
                  data.total,
                detail:
                  data.breakdown
              };
        }


        for (
          let i =
            entries.length - 1;

          i >= 0;

          i--
        ) {
          const data =
            diceData(
              entries[i][0],
              entries[i][1]
            );

          const candidates =
            [
              data.key,
              data.attribute,
              data.key.replace(
                /^(?:屬性|技能|attribute|skill):/i,
                ""
              ),
              data.attribute.replace(
                /^(?:屬性|技能|attribute|skill):/i,
                ""
              )
            ]
              .map(
                value =>
                  String(value)
                    .trim()
              );

          if (
            candidates.includes(
              target
            ) &&
            data.total != null
          ) {
            return {
              type:
                "骰子",
              name:
                target,
              value:
                data.total,
              detail:
                data.breakdown
            };
          }
        }

        /*
         * memorySave 有資料但名稱沒對上時，
         * 再用目前畫面上的原生骰 DOM 當最後保底。
         */
        return findDiceFromDom(
          name
        );
      }


      // =====================================================
      // 檢定
      // =====================================================

      function findCheck(
        name
      ) {
        const a =
          getAdventure();

        const target =
          String(name || "")
            .trim();

        if (
          !a ||
          !a.checks ||
          !target ||
          !a.checks[target]
        ) {
          return null;
        }

        const data =
          a.checks[target];

        const value =
          num(
            data.total
          );

        if (
          value == null
        ) {
          return null;
        }

        return {
          type:
            "檢定",
          name:
            target,
          value,
          result:
            String(
              data.result ||
              ""
            ),
          detail:
            String(
              data.breakdown ||
              ""
            )
        };
      }


      // =====================================================
      // 傷害骰
      // =====================================================

      function findDamage(
        name
      ) {
        const a =
          getAdventure();

        const target =
          String(name || "")
            .trim();

        if (
          !a ||
          !a.damage ||
          !target ||
          !a.damage[target]
        ) {
          return null;
        }

        const data =
          a.damage[target];

        const value =
          num(
            data.total
          );

        if (
          value == null
        ) {
          return null;
        }

        return {
          type:
            "傷害",
          name:
            target,
          value,
          detail:
            String(
              data.breakdown ||
              ""
            )
        };
      }


      // =====================================================
      // 成功骰池
      // =====================================================

      function findSuccessDice(
        name
      ) {
        const a =
          getAdventure();

        const target =
          String(name || "")
            .trim();

        if (
          !a ||
          !a.successDice ||
          !target ||
          !a.successDice[target]
        ) {
          return null;
        }

        const data =
          a.successDice[target];

        const value =
          num(
            data.successes ??
            data.total
          );

        if (
          value == null
        ) {
          return null;
        }

        return {
          type:
            "成功骰",
          name:
            target,
          value,
          result:
            String(
              data.result ||
              ""
            ),
          detail:
            String(
              data.breakdown ||
              ""
            )
        };
      }


      // =====================================================
      // 命運骰
      //
      // 主程式命運骰存入：
      // memorySave.adventure.dice["命運:"+名稱]
      // =====================================================

      function findFate(
        name
      ) {
        const a =
          getAdventure();

        const target =
          String(name || "")
            .trim();

        if (
          !a ||
          !a.dice ||
          !target
        ) {
          return null;
        }

        const data =
          a.dice[
            "命運:" +
            target
          ];

        if (!data) {
          return null;
        }

        const value =
          num(
            data.total
          );

        if (
          value == null
        ) {
          return null;
        }

        return {
          type:
            "命運骰",
          name:
            target,
          value,
          result:
            String(
              data.result ||
              ""
            ),
          detail:
            String(
              data.fateBreakdown ||
              data.breakdown ||
              ""
            )
        };
      }


      // =====================================================
      // 自動骰
      //
      // 相容前一顆 Reader Hook：
      // 畫面上會產生 .fh-auto-dice-result
      //
      // 若對抗骰和自動骰在同一次 applyAdventure
      // 中生成，DOM 尚未存在，所以再向
      // window.__fhAutoDiceResults 取值。
      // 若不存在則只使用 DOM。
      // =====================================================

      function findAutoDice(
        name
      ) {
        const target =
          String(name || "")
            .trim();


        /*
         * 先找上一顆模組可能公開的資料。
         */
        const exposed =
          window.__fhAutoDiceResults;

        if (
          exposed &&
          target &&
          exposed[target] != null
        ) {
          const value =
            num(
              exposed[target]
            );

          if (
            value != null
          ) {
            return {
              type:
                "自動骰",
              name:
                target,
              value
            };
          }
        }


        /*
         * 再從目前閱讀器 DOM 找。
         */
        const elements =
          Array.from(
            document.querySelectorAll(
              ".fh-auto-dice-result"
            )
          );


        if (
          !elements.length
        ) {
          return null;
        }


        if (!target) {
          const element =
            elements[
              elements.length - 1
            ];

          const value =
            num(
              element.getAttribute(
                "data-total"
              ) ||
              element.getAttribute(
                "data-result"
              )
            );

          if (
            value == null
          ) {
            return null;
          }

          return {
            type:
              "自動骰",
            name:
              "最近自動骰",
            value
          };
        }


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
            label !== target
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

          if (
            value != null
          ) {
            return {
              type:
                "自動骰",
              name:
                target,
              value
            };
          }
        }

        return null;
      }


      // =====================================================
      // 固定值
      // =====================================================

      function findFixed(
        text
      ) {
        const value =
          num(text);

        return (
          value == null
        )
          ? null
          : {
              type:
                "固定",
              name:
                String(text),
              value
            };
      }


      // =====================================================
      // 通用來源解析
      //
      // 骰子:力量
      // 檢定:開鎖
      // 傷害:長劍
      // 成功骰:駭入
      // 命運骰:閃避
      // 自動骰:敵人
      // 固定:15
      // =====================================================

      function resolveSource(
        expression
      ) {
        const text =
          String(
            expression ||
            ""
          ).trim();

        if (!text) {
          return null;
        }


        const colon =
          text.indexOf(
            ":"
          );


        const type =
          (
            colon >= 0
              ? text.slice(
                  0,
                  colon
                )
              : text
          ).trim();


        const name =
          (
            colon >= 0
              ? text.slice(
                  colon + 1
                )
              : ""
          ).trim();


        switch(type) {
          case "骰子":
            return findDice(
              name
            );

          case "檢定":
            return findCheck(
              name
            );

          case "傷害":
          case "傷害骰":
            return findDamage(
              name
            );

          case "成功骰":
          case "成功骰池":
            return findSuccessDice(
              name
            );

          case "命運":
          case "命運骰":
            return findFate(
              name
            );

          case "自動骰":
            return findAutoDice(
              name
            );

          case "固定":
          case "數值":
            return findFixed(
              name
            );
        }


        /*
         * 單純數字也視為固定值。
         */
        if (
          /^-?\d+(?:\.\d+)?$/
            .test(text)
        ) {
          return findFixed(
            text
          );
        }


        return null;
      }


      // =====================================================
      // 勝負規則
      //
      // 高者勝（預設）
      // 低者勝
      // 接近者勝:<固定值>
      //
      // 平手：
      // 平手（預設）
      // 左勝
      // 右勝
      // =====================================================

      function decide(
        left,
        right,
        mode,
        tieMode
      ) {
        const rule =
          String(
            mode ||
            "高者勝"
          ).trim();


        let leftMetric =
          left.value;

        let rightMetric =
          right.value;


        if (
          rule.startsWith(
            "接近者勝:"
          )
        ) {
          const target =
            num(
              rule.slice(
                "接近者勝:"
                  .length
              )
            );

          if (
            target != null
          ) {
            leftMetric =
              -Math.abs(
                left.value -
                target
              );

            rightMetric =
              -Math.abs(
                right.value -
                target
              );
          }
        }


        if (
          rule === "低者勝"
        ) {
          if (
            leftMetric <
            rightMetric
          ) {
            return "左勝";
          }

          if (
            rightMetric <
            leftMetric
          ) {
            return "右勝";
          }
        } else {
          if (
            leftMetric >
            rightMetric
          ) {
            return "左勝";
          }

          if (
            rightMetric >
            leftMetric
          ) {
            return "右勝";
          }
        }


        const tie =
          normalizeResultWord(
            tieMode ||
            "平手"
          );


        if (
          tie === "左勝" ||
          tie === "右勝"
        ) {
          return tie;
        }


        return "平手";
      }


      function resultCard(
        name,
        left,
        right,
        rule,
        result
      ) {
        const difference =
          Math.abs(
            left.value -
            right.value
          );


        return (
          `<div class="fh-opposed-dice"` +
          ` data-opposed-name="${esc(name)}"` +
          ` data-opposed-result="${esc(result)}"` +
          ` data-left="${left.value}"` +
          ` data-right="${right.value}"` +
          ` data-difference="${difference}">` +

          `<div class="fh-opposed-title">⚔️ ${esc(name)}</div>` +

          `<div class="fh-opposed-row">` +
          `<span class="fh-opposed-side left">` +
          `<b>${esc(left.type)} ${esc(left.name)}</b>` +
          `<strong>${left.value}</strong>` +
          `</span>` +

          `<span class="fh-opposed-vs">VS</span>` +

          `<span class="fh-opposed-side right">` +
          `<b>${esc(right.type)} ${esc(right.name)}</b>` +
          `<strong>${right.value}</strong>` +
          `</span>` +
          `</div>` +

          `<div class="fh-opposed-summary">` +
          `${esc(rule)}｜${esc(result)}｜差值 ${difference}` +
          `</div>` +

          `</div>`
        );
      }


      function waitingCard(
        name,
        leftText,
        rightText,
        leftReady,
        rightReady
      ) {
        const missing =
          !leftReady && !rightReady
            ? "左右雙方"
            : !leftReady
              ? "左方"
              : "右方";

        return (
          `<div class="fh-opposed-dice waiting"` +
          ` data-opposed-name="${esc(name)}"` +
          ` data-opposed-result="等待">` +
          `<div class="fh-opposed-title">⚔️ ${esc(name)}</div>` +
          `<div class="fh-opposed-summary">等待${missing}骰值｜${esc(leftText)} VS ${esc(rightText)}</div>` +
          `</div>`
        );
      }


      // =====================================================
      // 對抗標籤
      //
      // 基本：
      // [對抗骰:決鬥|骰子:力量|自動骰:敵人]
      //
      // 完整：
      // [對抗骰:潛行|骰子:敏捷|檢定:守衛察覺|高者勝|平手]
      //
      // 低者勝：
      // [對抗骰:恐怖檢定|骰子:意志|固定:30|低者勝|平手]
      //
      // 接近目標：
      // [對抗骰:競速|骰子:駕駛|自動骰:對手|接近者勝:50|平手]
      // =====================================================

      function processOpposed(
        html
      ) {
        const pattern =
          /\[對抗骰:([^|\]]+)\|([^|\]]+)\|([^|\]]+)(?:\|([^|\]]+))?(?:\|([^\]]+))?\]/gi;


        return String(html || "")
          .replace(
            pattern,

            function(
              whole,
              nameText,
              leftText,
              rightText,
              ruleText,
              tieText
            ) {
              const name =
                String(
                  nameText ||
                  ""
                ).trim();


              const leftExpr =
                String(
                  leftText ||
                  ""
                ).trim();


              const rightExpr =
                String(
                  rightText ||
                  ""
                ).trim();


              const rule =
                String(
                  ruleText ||
                  "高者勝"
                ).trim();


              const tieMode =
                String(
                  tieText ||
                  "平手"
                ).trim();


              const left =
                resolveSource(
                  leftExpr
                );


              const right =
                resolveSource(
                  rightExpr
                );


              if (
                !left ||
                !right
              ) {
                opposedResults[
                  name
                ] = {
                  ready:
                    false,
                  result:
                    "等待",
                  left:
                    left ||
                    null,
                  right:
                    right ||
                    null,
                  difference:
                    null
                };


                return waitingCard(
                  name,
                  leftExpr,
                  rightExpr,
                  !!left,
                  !!right
                );
              }


              const result =
                decide(
                  left,
                  right,
                  rule,
                  tieMode
                );


              const difference =
                Math.abs(
                  left.value -
                  right.value
                );


              opposedResults[
                name
              ] = {
                ready:
                  true,
                result,
                left,
                right,
                difference,
                rule
              };


              return resultCard(
                name,
                left,
                right,
                rule,
                result
              );
            }
          );
      }


      // =====================================================
      // 對抗如果條件
      //
      // [如果:對抗:決鬥=左勝]
      // ...
      // [否則]
      // ...
      // [/如果]
      //
      // [如果:對抗:決鬥=右勝]
      //
      // [如果:對抗:決鬥=平手]
      //
      // 差值：
      // [如果:對抗差值:決鬥>=5]
      // 壓倒性勝利
      // [/如果]
      // =====================================================

      function processOpposedIf(
        html
      ) {
        let output =
          String(html || "");


        const resultPattern =
          /\[如果:對抗:([^=\]\r\n]+)=([^\]\r\n]+)\]([\s\S]*?)(?:\[否則\]([\s\S]*?))?\[\/如果\]/gi;


        output =
          output.replace(
            resultPattern,

            function(
              whole,
              nameText,
              wantedText,
              yesText,
              noText
            ) {
              const name =
                String(
                  nameText ||
                  ""
                ).trim();


              const wanted =
                normalizeResultWord(
                  wantedText
                );


              const data =
                opposedResults[
                  name
                ];


              if (
                !data ||
                !data.ready
              ) {
                return "";
              }


              return (
                normalizeResultWord(
                  data.result
                ) ===
                wanted
              )
                ? String(
                    yesText ||
                    ""
                  )
                : String(
                    noText ||
                    ""
                  );
            }
          );


        const differencePattern =
          /\[如果:對抗差值:([^<>=!\]\r\n]+)\s*(>=|<=|==|!=|>|<|=)\s*(-?\d+(?:\.\d+)?)\]([\s\S]*?)(?:\[否則\]([\s\S]*?))?\[\/如果\]/gi;


        output =
          output.replace(
            differencePattern,

            function(
              whole,
              nameText,
              operator,
              expectedText,
              yesText,
              noText
            ) {
              const name =
                String(
                  nameText ||
                  ""
                ).trim();


              const data =
                opposedResults[
                  name
                ];


              if (
                !data ||
                !data.ready ||
                data.difference ==
                  null
              ) {
                return "";
              }


              const actual =
                Number(
                  data.difference
                );


              const expected =
                Number(
                  expectedText
                );


              let passed =
                false;


              if (
                operator === ">="
              ) {
                passed =
                  actual >=
                  expected;
              } else if (
                operator === "<="
              ) {
                passed =
                  actual <=
                  expected;
              } else if (
                operator === ">"
              ) {
                passed =
                  actual >
                  expected;
              } else if (
                operator === "<"
              ) {
                passed =
                  actual <
                  expected;
              } else if (
                operator === "!="
              ) {
                passed =
                  actual !==
                  expected;
              } else {
                passed =
                  actual ===
                  expected;
              }


              return passed
                ? String(
                    yesText ||
                    ""
                  )
                : String(
                    noText ||
                    ""
                  );
            }
          );


        return output;
      }


      // =====================================================
      // 掛入 applyAdventure
      //
      // 先跑原生骰子引擎，
      // 再解析對抗，
      // 最後解析對抗條件。
      // =====================================================

      applyAdventure =
        function(page) {
          let html =
            oldApplyAdventure(
              page
            );


          /*
           * 每次頁面重畫重新計算，
           * 但骰子本身不重擲，
           * 因為值都由原生 memorySave
           * 或自動骰模組保存。
           */
          Object.keys(
            opposedResults
          ).forEach(
            key => {
              delete opposedResults[
                key
              ];
            }
          );


          html =
            processOpposed(
              html
            );


          html =
            processOpposedIf(
              html
            );


          return html;
        };


      // =====================================================
      // 對外 API，之後其他外掛也能讀對抗結果
      // =====================================================

      window.FirehahaOpposedDice = {
        version:
          "1.1.0",

        get(name) {
          return (
            opposedResults[
              String(name || "")
                .trim()
            ] ||
            null
          );
        },

        getAll() {
          return {
            ...opposedResults
          };
        },

        resolveSource
      };
    }


    const runtimeSource =
      "(" +
      readerRuntime.toString() +
      ")();";


    // =====================================================
    // Reader CSS
    // =====================================================

    const style =
      `
<style ${MARK}>
.fh-opposed-dice{
  max-width:540px;
  box-sizing:border-box;
  margin:14px auto;
  padding:12px 14px;
  border:1px solid #d4dce4;
  border-radius:14px;
  background:#f8fafc;
  color:#26323c;
  font:600 14px/1.45 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;
}

.fh-opposed-title{
  margin-bottom:9px;
  font-size:15px;
  font-weight:800;
  text-align:center;
}

.fh-opposed-row{
  display:grid;
  grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);
  align-items:center;
  gap:9px;
}

.fh-opposed-side{
  min-width:0;
  padding:9px 10px;
  border-radius:10px;
  background:#fff;
  border:1px solid #e0e6eb;
  text-align:center;
}

.fh-opposed-side b{
  display:block;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:12px;
  color:#607080;
}

.fh-opposed-side strong{
  display:block;
  margin-top:2px;
  font-size:23px;
  color:#18232d;
}

.fh-opposed-vs{
  font-size:11px;
  font-weight:900;
  color:#8a98a6;
}

.fh-opposed-summary{
  margin-top:9px;
  text-align:center;
  font-size:12px;
  color:#667684;
}

.fh-opposed-dice.waiting{
  border-style:dashed;
  opacity:.82;
}

body.reader-dark .fh-opposed-dice{
  background:#1d2730;
  border-color:#43505c;
  color:#eef4f8;
}

body.reader-dark .fh-opposed-side{
  background:#25313b;
  border-color:#44535f;
}

body.reader-dark .fh-opposed-side b,
body.reader-dark .fh-opposed-summary{
  color:#bac5ce;
}

body.reader-dark .fh-opposed-side strong{
  color:#fff;
}
</style>
`;


    // =====================================================
    // Reader Transform
    //
    // 跟前面成功的 Reader Hook 同一種掛法：
    // 在 loadState() 前包 applyAdventure。
    // =====================================================

    const removeTransform =
      api.registerReaderTransform(
        "reader",

        function(
          html,
          context
        ) {
          if (
            typeof html !==
              "string" ||
            html.includes(
              MARK
            )
          ) {
            return html;
          }


          let output =
            html;


          if (
            /<\/head\s*>/i
              .test(output)
          ) {
            output =
              output.replace(
                /<\/head\s*>/i,
                style +
                "\n</head>"
              );
          } else {
            output =
              style +
              output;
          }


          const marker =
            "}loadState();";


          if (
            output.includes(
              marker
            )
          ) {
            output =
              output.replace(
                marker,
                "}" +
                runtimeSource +
                "loadState();"
              );
          } else {
            const fallback =
              `<script ${MARK}>` +
              runtimeSource +
              `</scr` +
              `ipt>`;


            if (
              /<\/body\s*>/i
                .test(output)
            ) {
              output =
                output.replace(
                  /<\/body\s*>/i,
                  fallback +
                  "\n</body>"
                );
            } else {
              output +=
                fallback;
            }
          }


          return output;
        },

        /*
         * 放在自動骰 Hook 後面，
         * 讓它能讀到自動骰產生的結果。
         */
        850
      );


    api.toast(
      "通用對抗骰模組 V1.1 已啟用"
    );


    return function cleanup() {
      removeTransform();
    };
  }
});
