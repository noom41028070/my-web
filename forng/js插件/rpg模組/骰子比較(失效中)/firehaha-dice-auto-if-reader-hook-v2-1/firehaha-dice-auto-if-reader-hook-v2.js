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
           * 先讓原生 Adventure 引擎工作。
           *
           * 這樣：
           * [骰子:...]、[傷害骰...]、[檢定...]
           * 都仍由你的原生引擎負責。
           */
          let html =
            originalApplyAdventure(
              page
            );


          /*
           * 然後「無中生有」建立自動骰。
           */
          html =
            processAutoDice(
              html
            );


          /*
           * 最後才判定：
           * [如果:自動骰...]
           * [如果:骰子...]
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
