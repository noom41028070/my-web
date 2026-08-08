// @firehaha-plugin {"id":"official.dice-auto-if-reader-hook","name":"骰子自動判定 Reader Hook","version":"2.0.0","author":"Firehaha","description":"直接掛入 Firehaha Reader 的 applyAdventure 流程，整合 D4/D6/D20/D100 自動骰、加減值、名稱與原生骰/自動骰如果判定。"}

FirehahaPlugins.register({
  id: "official.dice-auto-if-reader-hook",

  setup(api) {
    "use strict";

    const MARK =
      "data-fh-dice-auto-if-reader-hook-v2";


    // =====================================================
    // 真正放進 Reader 內部的 Runtime
    //
    // 重點：
    // 這段不是 DOM 掃描補丁。
    // 它會在 loadState() 前執行，
    // 直接包住 Reader 原本的 applyAdventure(page)。
    // =====================================================

    function readerRuntime() {
      "use strict";

      if (
        window.__fhDiceAutoIfReaderHookV2
      ) {
        return;
      }

      window.__fhDiceAutoIfReaderHookV2 =
        true;


      if (
        typeof applyAdventure !==
        "function"
      ) {
        console.warn(
          "[Dice Auto/If] 找不到 applyAdventure"
        );

        return;
      }


      const originalApplyAdventure =
        applyAdventure;


      let activePageId =
        null;


      let autoResults =
        Object.create(null);


      /*
       * 對外公開目前頁面的自動骰結果。
       *
       * 相容其他模組目前預期的：
       *   window.__fhAutoDiceResults["敵人"]
       *
       * 也提供正式 API：
       *   FirehahaAutoDice.get("敵人")
       */
      window.__fhAutoDiceResults =
        window.__fhAutoDiceResults ||
        Object.create(null);


      function publishAutoResults() {
        const exposed =
          Object.create(null);


        Object.keys(
          autoResults
        ).forEach(
          key => {
            const saved =
              autoResults[key];

            if (!saved) {
              return;
            }


            const total =
              Number(
                saved.total
              );


            if (
              !Number.isFinite(
                total
              )
            ) {
              return;
            }


            /*
             * 有名稱的骰子同時提供：
             *   敵人
             *   name:敵人
             *
             * 讓舊版 / 新版對抗骰都能讀。
             */
            if (
              String(key)
                .startsWith(
                  "name:"
                )
            ) {
              const label =
                String(key)
                  .slice(5);

              exposed[
                label
              ] =
                total;

              exposed[
                "name:" +
                label
              ] =
                total;
            } else {
              exposed[
                key
              ] =
                total;
            }
          }
        );


        window.__fhAutoDiceResults =
          exposed;


        return exposed;
      }


      window.FirehahaAutoDice = {
        version:
          "2.0.0",

        get(name) {
          const requested =
            String(name || "")
              .trim();

          if (requested) {
            const saved =
              autoResults[
                "name:" +
                requested
              ];

            return saved
              ? {
                  sides:
                    saved.sides,
                  raw:
                    saved.raw,
                  modifier:
                    saved.modifier,
                  total:
                    saved.total,
                  label:
                    saved.label
                }
              : null;
          }


          const values =
            Object.values(
              autoResults
            );

          if (!values.length) {
            return null;
          }

          const saved =
            values[
              values.length - 1
            ];

          return {
            sides:
              saved.sides,
            raw:
              saved.raw,
            modifier:
              saved.modifier,
            total:
              saved.total,
            label:
              saved.label
          };
        },

        getAll() {
          return publishAutoResults();
        },

        reset() {
          activePageId =
            null;

          autoResults =
            Object.create(null);

          window.__fhAutoDiceResults =
            Object.create(null);

          unnamedCounter =
            0;
        },

        compareWord(
          actual,
          rule,
          expected
        ) {
          return compareWord(
            actual,
            rule,
            expected
          );
        }
      };


      let unnamedCounter =
        0;


      function escapeHtml(value) {
        return String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }


      function rollDie(sides) {
        return (
          Math.floor(
            Math.random() *
            Number(sides)
          ) + 1
        );
      }


      function compare(
        actual,
        operator,
        expected
      ) {
        const a =
          Number(actual);

        const b =
          Number(expected);


        if (
          !Number.isFinite(a) ||
          !Number.isFinite(b)
        ) {
          return false;
        }


        switch (
          String(operator)
            .replace(/&lt;/gi, "<")
            .replace(/&gt;/gi, ">")
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
            return a !== b;

          case "=":
          case "==":
            return a === b;
        }


        return false;
      }


      /*
       * 文字版比較運算。
       *
       * 目的：
       * 避免 >= / <= 在多支骰子規則與 Regex 疊加時
       * 被其他解析器誤拆。
       *
       * 支援：
       * 大於等於 / 小於等於 / 大於 / 小於 / 等於 / 不等於
       *
       * 也接受較口語的：
       * 至少 / 至多 / 超過 / 未滿
       */
      function compareWord(
        actual,
        word,
        expected
      ) {
        const a =
          Number(actual);

        const b =
          Number(expected);

        if (
          !Number.isFinite(a) ||
          !Number.isFinite(b)
        ) {
          return false;
        }

        const rule =
          String(word || "")
            .trim()
            .replace(/\s+/g, "");

        switch(rule) {
          case "大於等於":
          case "至少":
          case "以上":
          case "大於等於成功":
            return a >= b;

          case "小於等於":
          case "至多":
          case "以下":
          case "小於等於成功":
            return a <= b;

          case "大於":
          case "超過":
          case "大於成功":
            return a > b;

          case "小於":
          case "未滿":
          case "小於成功":
            return a < b;

          case "等於":
          case "剛好":
          case "等於成功":
            return a === b;

          case "不等於":
          case "不是":
          case "不等於成功":
            return a !== b;
        }

        return false;
      }


      function resetForPage(
        page
      ) {
        const id =
          String(
            page &&
            page.id ||
            ""
          );


        if (
          id !== activePageId
        ) {
          activePageId =
            id;

          autoResults =
            Object.create(null);

          window.__fhAutoDiceResults =
            Object.create(null);

          unnamedCounter =
            0;
        }
      }


      function autoResultHtml(
        sides,
        raw,
        modifier,
        total,
        label
      ) {
        const modifierHtml =
          modifier
            ? (
                `<span class="fh-auto-dice-raw">${raw}</span>` +
                `<span class="fh-auto-dice-modifier">${modifier > 0 ? "+" : ""}${modifier}</span>` +
                `<span class="fh-auto-dice-equals">＝</span>` +
                `<strong class="fh-auto-dice-value">${total}</strong>`
              )
            : (
                `<strong class="fh-auto-dice-value">${total}</strong>`
              );


        return (
          `<span class="fh-auto-dice-result"` +
          ` data-dice="d${sides}"` +
          ` data-raw="${raw}"` +
          ` data-modifier="${modifier}"` +
          ` data-total="${total}"` +
          ` data-result="${total}">` +

          `<span class="fh-auto-dice-icon">🎲</span>` +

          (
            label
              ? `<span class="fh-auto-dice-label">${escapeHtml(label)}</span>`
              : ""
          ) +

          `<span class="fh-auto-dice-type">D${sides}</span>` +
          `<span class="fh-auto-dice-colon">：</span>` +
          `<span class="fh-auto-dice-detail">${modifierHtml}</span>` +
          `</span>`
        );
      }


      /*
       * 先掃描原始正文中的 [自動骰]，只建立結果、不改文字。
       *
       * 目的：
       * 在任何其他 [如果] 外掛看到正文之前，
       * autoResults 就已經有值，因此可以先完成
       * [如果:自動骰:名稱>=門檻] 的判定。
       */
      function prepareAutoDiceResults(
        source
      ) {
        let localIndex =
          0;

        String(source || "")
          .replace(
            /\[(?:自動骰|自動擲骰):d(4|6|20|100)([+-]\d+)?(?:\|([^\]]+))?\]/gi,

            function(
              whole,
              sidesText,
              modifierText,
              labelText
            ) {
              localIndex++;

              const sides =
                Number(sidesText);

              const modifier =
                Number(
                  modifierText ||
                  0
                ) || 0;

              const label =
                String(
                  labelText ||
                  ""
                ).trim();

              const key =
                label
                  ? "name:" + label
                  : "anon:" + localIndex;

              let saved =
                autoResults[key];

              if (!saved) {
                const raw =
                  rollDie(
                    sides
                  );

                saved = {
                  sides,
                  raw,
                  modifier,
                  total:
                    raw +
                    modifier,
                  label
                };

                autoResults[key] =
                  saved;
              }

              return whole;
            }
          );

        publishAutoResults();
      }


      /*
       * 只在「原始正文階段」先處理自動骰條件。
       *
       * 這樣其他通用 [如果] 外掛永遠看不到
       * [如果:自動骰...]，就不可能提前走錯 [否則]。
       */
      /*
       * =====================================================
       * 文字版自動骰條件（建議優先使用）
       * =====================================================
       *
       * 基本：
       *
       * [如果:自動骰:敵人|大於等於|10]
       * 命中成功
       * [否則]
       * 命中失敗
       * [/如果]
       *
       * 其他：
       *
       * [如果:自動骰:敵人|小於等於|10]
       * [如果:自動骰:敵人|大於|10]
       * [如果:自動骰:敵人|小於|10]
       * [如果:自動骰:敵人|等於|10]
       * [如果:自動骰:敵人|不等於|10]
       *
       * 口語別名：
       * 至少 = 大於等於
       * 至多 = 小於等於
       * 以上 = 大於等於
       * 以下 = 小於等於
       * 超過 = 大於
       * 未滿 = 小於
       *
       * 也容許：
       * 大於等於成功 / 小於等於成功
       * 等寫法。
       */
      function processRawAutoWordIfBlocks(
        source
      ) {
        const pattern =
          /\[如果:自動骰:([^|\]\r\n]+)\|([^|\]\r\n]+)\|(-?\d+(?:\.\d+)?)\]([\s\S]*?)(?:\[否則\]([\s\S]*?))?\[\/如果\]/gi;

        return String(source || "")
          .replace(
            pattern,

            function(
              whole,
              nameText,
              ruleText,
              expectedText,
              yesText,
              noText
            ) {
              const name =
                String(
                  nameText ||
                  ""
                ).trim();

              const rule =
                String(
                  ruleText ||
                  ""
                ).trim();

              const value =
                findAutoValue(
                  name
                );

              if (
                !Number.isFinite(
                  Number(value)
                )
              ) {
                return "";
              }

              const passed =
                compareWord(
                  value,
                  rule,
                  Number(
                    expectedText
                  )
                );

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
      }


      function processRawAutoIfBlocks(
        source
      ) {
        const pattern =
          /\[如果:自動骰(?::([^<>=!\]\r\n]+))?\s*(&lt;=?|&gt;=?|>=|<=|==|!=|>|<|=)\s*(-?\d+(?:\.\d+)?)\]([\s\S]*?)(?:\[否則\]([\s\S]*?))?\[\/如果\]/gi;

        return String(source || "")
          .replace(
            pattern,

            function(
              whole,
              name,
              operator,
              expected,
              yesText,
              noText
            ) {
              const value =
                findAutoValue(
                  String(
                    name ||
                    ""
                  ).trim()
                );

              if (
                !Number.isFinite(
                  Number(value)
                )
              ) {
                return "";
              }

              return compare(
                value,
                operator,
                Number(expected)
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
      }


      function processAutoDice(
        html
      ) {
        let localIndex =
          0;


        return String(html || "")
          .replace(
            /\[(?:自動骰|自動擲骰):d(4|6|20|100)([+-]\d+)?(?:\|([^\]]+))?\]/gi,

            function(
              whole,
              sidesText,
              modifierText,
              labelText
            ) {
              localIndex++;


              const sides =
                Number(sidesText);


              const modifier =
                Number(
                  modifierText ||
                  0
                ) || 0;


              const label =
                String(
                  labelText ||
                  ""
                ).trim();


              /*
               * 有名稱就用名稱當 key。
               * 沒名稱則用當頁出現順序。
               *
               * 同一頁因 revealText() 重畫時，
               * 不重新擲骰。
               * 離開再回到頁面時才會建立新結果。
               */
              const key =
                label
                  ? "name:" + label
                  : "anon:" + localIndex;


              let saved =
                autoResults[key];


              if (!saved) {
                const raw =
                  rollDie(
                    sides
                  );


                saved = {
                  sides,
                  raw,
                  modifier,
                  total:
                    raw +
                    modifier,
                  label
                };


                autoResults[key] =
                  saved;
              }


              /*
               * 每顆骰子建立/重用後立即公開，
               * 讓同一輪後續的對抗骰可以直接取得結果。
               */
              publishAutoResults();


              return autoResultHtml(
                saved.sides,
                saved.raw,
                saved.modifier,
                saved.total,
                saved.label
              );
            }
          );
      }


      function findAutoValue(
        name
      ) {
        const requested =
          String(name || "")
            .trim();


        if (requested) {
          const saved =
            autoResults[
              "name:" +
              requested
            ];


          return saved
            ? Number(
                saved.total
              )
            : null;
        }


        const values =
          Object.values(
            autoResults
          );


        if (!values.length) {
          return null;
        }


        return Number(
          values[
            values.length - 1
          ].total
        );
      }


      function nativeDiceEntries() {
        const adventure =
          window.memorySave &&
          memorySave.adventure;


        if (
          !adventure ||
          !adventure.dice
        ) {
          return [];
        }


        return Object.entries(
          adventure.dice
        )
          .filter(
            ([key]) => {
              return (
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
          );
      }


      function nativeTotal(
        value
      ) {
        if (
          value &&
          typeof value ===
          "object"
        ) {
          const number =
            Number(
              value.total
            );


          return Number.isFinite(
            number
          )
            ? number
            : null;
        }


        const number =
          Number(value);


        return Number.isFinite(
          number
        )
          ? number
          : null;
      }


      function findNativeValue(
        name
      ) {
        const requested =
          String(name || "")
            .trim();


        const entries =
          nativeDiceEntries();


        if (
          !entries.length
        ) {
          return null;
        }


        if (!requested) {
          /*
           * 原生無屬性骰通常使用 __last。
           */
          const direct =
            entries.find(
              ([key]) =>
                key ===
                "__last"
            );


          if (direct) {
            return nativeTotal(
              direct[1]
            );
          }


          return nativeTotal(
            entries[
              entries.length - 1
            ][1]
          );
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
                value =>
                  String(value)
                    .trim()
              );


          if (
            candidates.includes(
              requested
            )
          ) {
            return nativeTotal(
              data
            );
          }
        }


        return null;
      }


      function conditionValue(
        source,
        name
      ) {
        return (
          source ===
          "自動骰"
        )
          ? findAutoValue(
              name
            )
          : findNativeValue(
              name
            );
      }


      function processIfBlocks(
        html
      ) {
        const pattern =
          /\[如果:(骰子|自動骰)(?::([^<>=!\]\r\n]+))?\s*(&lt;=?|&gt;=?|>=|<=|==|!=|>|<|=)\s*(-?\d+(?:\.\d+)?)\]([\s\S]*?)(?:\[否則\]([\s\S]*?))?\[\/如果\]/gi;


        return String(html || "")
          .replace(
            pattern,

            function(
              whole,
              source,
              name,
              operator,
              expected,
              yesText,
              noText
            ) {
              const value =
                conditionValue(
                  String(source),
                  String(
                    name ||
                    ""
                  ).trim()
                );


              /*
               * 原生骰還沒擲時：
               * 不把整組控制標籤秀給讀者。
               *
               * 直接先隱藏條件區塊，
               * 等原生骰擲完造成頁面重畫後，
               * applyAdventure() 會再次判斷。
               */
              if (
                !Number.isFinite(
                  Number(value)
                )
              ) {
                return "";
              }


              const passed =
                compare(
                  value,
                  operator,
                  Number(expected)
                );


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
      }


      applyAdventure =
        function(
          page
        ) {
          resetForPage(
            page
          );


          /*
           * 1. 先讀原始正文。
           */
          const clonedPage =
            Object.assign(
              {},
              page || {}
            );

          let source =
            String(
              clonedPage.content ||
              ""
            );


          /*
           * 2. 在任何其他 Reader Hook 之前，
           *    先把本頁所有自動骰結果建立好。
           */
          prepareAutoDiceResults(
            source
          );


          /*
           * 3-A. 優先處理「文字版比較」。
           *
           * 例如：
           * [如果:自動骰:敵人|大於等於|10]
           *
           * 這套完全不依賴 >= / <=，
           * 可避開不同骰子規則之間的運算符號解析衝突。
           */
          source =
            processRawAutoWordIfBlocks(
              source
            );


          /*
           * 3-B. 再保留舊版 >= / <= / > / < / = 語法相容。
           */
          source =
            processRawAutoIfBlocks(
              source
            );


          clonedPage.content =
            source;


          /*
           * 4. 再交給原生 Adventure 與其他插件。
           */
          let html =
            originalApplyAdventure(
              clonedPage
            );


          /*
           * 5. 最後把正文中的 [自動骰] 標籤
           *    轉成漂亮的結果卡。
           *
           *    prepareAutoDiceResults 已經存好結果，
           *    所以這裡不會重新擲骰。
           */
          html =
            processAutoDice(
              html
            );


          publishAutoResults();


          /*
           * 6. 保留對原生 [如果:骰子...] 的相容。
           *
           *    [如果:自動骰...] 在第 3 步已經全部處理完，
           *    因此這裡通常只剩原生骰條件。
           */
          html =
            processIfBlocks(
              html
            );


          return html;
        };
    }


    const runtimeSource =
      "(" +
      readerRuntime.toString() +
      ")();";


    // =====================================================
    // CSS
    // =====================================================

    const css =
      `
<style ${MARK}>
.fh-auto-dice-result{
  display:inline-flex;
  align-items:center;
  gap:5px;
  margin:4px 5px;
  padding:6px 11px;
  border:1px solid #d5dde5;
  border-radius:999px;
  background:#f7f9fb;
  color:#2d3740;
  font:650 14px/1.45 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;
  vertical-align:middle;
}
.fh-auto-dice-icon{
  font-size:16px;
}
.fh-auto-dice-label{
  font-weight:800;
}
.fh-auto-dice-type{
  color:#607d8b;
  font-size:12px;
  font-weight:800;
}
.fh-auto-dice-detail{
  display:inline-flex;
  align-items:baseline;
  gap:4px;
}
.fh-auto-dice-raw{
  color:#4f5d68;
}
.fh-auto-dice-modifier{
  color:#7b4fc5;
  font-weight:800;
}
.fh-auto-dice-value{
  color:#17212b;
  font-size:17px;
}
body.reader-dark .fh-auto-dice-result{
  background:#222c36;
  border-color:#4b5d6d;
  color:#edf3f8;
}
body.reader-dark .fh-auto-dice-value{
  color:#fff;
}
</style>
`;


    // =====================================================
    // ReaderArtifact Transform
    //
    // 真正關鍵：
    // 找 Reader 自己的：
    //
    // }loadState();
    //
    // 把 Runtime 插在 loadState() 前。
    //
    // 這與你主程式的 Fate dice compatibility
    // 使用的是同一個掛點。
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
            "string"
          ) {
            return html;
          }


          if (
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
                css +
                "\n</head>"
              );
          } else {
            output =
              css +
              output;
          }


          /*
           * Firehaha Reader 的初始化掛點。
           */
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
            /*
             * 保底：
             * 若未來主程式改掉 marker，
             * 才退回 body 注入。
             */
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
         * Reader 主體已經 build 完再改。
         * Fate dice 也是直接處理 buildReader 結果。
         */
        600
      );


    api.toast(
      "骰子自動判定 Reader Hook 已啟用"
    );


    return function cleanup() {
      removeTransform();
    };
  }
});
