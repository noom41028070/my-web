// @firehaha-plugin {"id":"official.damage-dice-helper","name":"原生傷害骰直覺標籤助手","version":"1.0.0","author":"Firehaha","description":"沿用主程式原生傷害骰與重擊資料，提供較直覺的傷害、重擊、傷害如果式與結果顯示標籤，不建立第二套傷害資料。"}

FirehahaPlugins.register({
  id: "official.damage-dice-helper",

  setup(api) {
    "use strict";

    const MARK = "data-fh-damage-dice-helper";

    function readerRuntime() {
      "use strict";

      if (window.__fhDamageDiceHelperInstalled) return;
      window.__fhDamageDiceHelperInstalled = true;

      if (typeof applyAdventure !== "function") {
        console.warn("[Damage Dice Helper] 找不到 applyAdventure");
        return;
      }

      const originalApplyAdventure = applyAdventure;

      function esc(value) {
        return String(value == null ? "" : value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }

      function clean(value) {
        return String(value == null ? "" : value).trim();
      }

      function normalizeWord(value) {
        return clean(value).toLowerCase().replace(/\s+/g, " ");
      }

      function normalizeOperator(value) {
        const word = normalizeWord(value);

        if (
          word === ">=" ||
          word === "至少" ||
          word === "以上" ||
          word === "大於等於" ||
          word === "at least" ||
          word === "greater than or equal" ||
          word === "greater than or equal to"
        ) return ">=";

        if (
          word === "<=" ||
          word === "至多" ||
          word === "以下" ||
          word === "小於等於" ||
          word === "at most" ||
          word === "less than or equal" ||
          word === "less than or equal to"
        ) return "<=";

        if (
          word === ">" ||
          word === "超過" ||
          word === "大於" ||
          word === "greater than" ||
          word === "より大きい"
        ) return ">";

        if (
          word === "<" ||
          word === "未滿" ||
          word === "小於" ||
          word === "less than" ||
          word === "未満"
        ) return "<";

        if (
          word === "=" ||
          word === "==" ||
          word === "等於" ||
          word === "equal" ||
          word === "equal to" ||
          word === "等しい"
        ) return "=";

        if (
          word === "!=" ||
          word === "<>" ||
          word === "不等於" ||
          word === "not equal" ||
          word === "not equal to" ||
          word === "等しくない"
        ) return "!=";

        return clean(value);
      }

      function compare(actual, operator, expected) {
        const a = Number(actual);
        const b = Number(expected);
        const op = normalizeOperator(operator);

        if (!Number.isFinite(a) || !Number.isFinite(b)) return false;

        if (op === ">=") return a >= b;
        if (op === "<=") return a <= b;
        if (op === ">") return a > b;
        if (op === "<") return a < b;
        if (op === "!=") return a !== b;
        return a === b;
      }

      function getAdventure() {
        try {
          if (
            typeof memorySave !== "undefined" &&
            memorySave &&
            memorySave.adventure
          ) {
            return memorySave.adventure;
          }
        } catch (error) {}

        try {
          if (window.memorySave && window.memorySave.adventure) {
            return window.memorySave.adventure;
          }
        } catch (error) {}

        return null;
      }

      function getDamage(name) {
        const adventure = getAdventure();
        const target = clean(name);

        if (
          !adventure ||
          !adventure.damage ||
          !target ||
          !adventure.damage[target]
        ) {
          return null;
        }

        const data = adventure.damage[target];
        const total = Number(
          data && typeof data === "object"
            ? data.total
            : data
        );

        if (!Number.isFinite(total)) return null;

        return {
          name: target,
          total: total,
          breakdown: clean(
            data && typeof data === "object"
              ? data.breakdown
              : ""
          )
        };
      }

      function validDiceFormula(value) {
        return /^\d*d\d+(?:[+-]\d+)?$/i.test(clean(value));
      }

      function normalizeCriticalMode(value) {
        const word = normalizeWord(value);

        if (
          word === "骰數加倍" ||
          word === "double dice" ||
          word === "double dice count" ||
          word === "ダイス数2倍" ||
          word === "ダイス数を2倍"
        ) return "骰數加倍";

        if (
          word === "傷害加倍" ||
          word === "double damage" ||
          word === "ダメージ2倍" ||
          word === "ダメージを2倍"
        ) return "傷害加倍";

        if (
          word === "最大傷害" ||
          word === "maximum damage" ||
          word === "max damage" ||
          word === "最大ダメージ"
        ) return "最大傷害";

        return clean(value);
      }

      /*
       * 先把 Helper 標籤轉成主程式原生標籤。
       * 原生引擎仍是唯一負責擲骰、重擊與 adventure.damage 的核心。
       */
      function expandNativeTags(source) {
        let text = String(source || "");

        // [傷害:長劍|1d8+3]
        // [damage:Longsword|1d8+3]
        // [ダメージ:長剣|1d8+3]
        text = text.replace(
          /\[(?:傷害|damage|ダメージ)\s*:\s*([^|\]\r\n]+?)\s*\|\s*([^|\]\r\n]+?)\s*\]/gi,
          function (whole, name, formula) {
            name = clean(name);
            formula = clean(formula);

            if (!name || !validDiceFormula(formula)) {
              return whole;
            }

            return "[傷害骰:" + name + ":" + formula + "]";
          }
        );

        // [傷害重擊:長劍|攻擊|大成功|骰數加倍]
        // [damagecritical:Longsword|Attack|Critical|double dice]
        // [ダメージクリティカル:長剣|攻撃|大成功|ダイス数2倍]
        text = text.replace(
          /\[(?:傷害重擊|damagecritical|damage-critical|ダメージクリティカル)\s*:\s*([^|\]\r\n]+?)\s*\|\s*([^|\]\r\n]+?)\s*\|\s*([^|\]\r\n]+?)\s*\|\s*([^|\]\r\n]+?)\s*\]/gi,
          function (whole, damageName, checkName, resultName, modeName) {
            damageName = clean(damageName);
            checkName = clean(checkName);
            resultName = clean(resultName);
            modeName = normalizeCriticalMode(modeName);

            if (
              !damageName ||
              !checkName ||
              !resultName ||
              !["骰數加倍", "傷害加倍", "最大傷害"].includes(modeName)
            ) {
              return whole;
            }

            return (
              "[重擊:" +
              damageName +
              ":" +
              checkName +
              "=" +
              resultName +
              ":" +
              modeName +
              "]"
            );
          }
        );

        return text;
      }

      function processDamageIfBlocks(html) {
        /*
         * 建議語法：
         * [如果:傷害:長劍|至少|10]重創[否則]輕傷[/如果]
         *
         * 英文/日文運算字也可：
         * |at least|10
         * |以上|10
         */
        const pattern =
          /\[如果:傷害:([^|\]\r\n]+?)\|([^|\]\r\n]+?)\|(-?\d+(?:\.\d+)?)\]([\s\S]*?)(?:\[否則\]([\s\S]*?))?\[\/如果\]/gi;

        return String(html || "").replace(
          pattern,
          function (
            whole,
            name,
            operator,
            expected,
            yesText,
            noText
          ) {
            const damage = getDamage(name);

            // 尚未擲傷害骰時，不顯示控制標籤或錯誤分支。
            if (!damage) return "";

            return compare(
              damage.total,
              operator,
              Number(expected)
            )
              ? String(yesText || "")
              : String(noText || "");
          }
        );
      }

      function processDamageDisplay(html) {
        return String(html || "").replace(
          /\[(?:顯示傷害|showdamage|ダメージ表示)\s*:\s*([^\]\r\n]+?)\s*\]/gi,
          function (whole, name) {
            const damage = getDamage(name);

            if (!damage) {
              return (
                '<span class="fh-damage-helper-result fh-damage-helper-waiting">' +
                '<span class="fh-damage-helper-name">' +
                esc(clean(name)) +
                "</span>" +
                '<span class="fh-damage-helper-value">—</span>' +
                "</span>"
              );
            }

            return (
              '<span class="fh-damage-helper-result">' +
              '<span class="fh-damage-helper-name">' +
              esc(damage.name) +
              "</span>" +
              '<span class="fh-damage-helper-value">' +
              esc(damage.total) +
              "</span>" +
              (
                damage.breakdown
                  ? '<span class="fh-damage-helper-breakdown">' +
                    esc(damage.breakdown) +
                    "</span>"
                  : ""
              ) +
              "</span>"
            );
          }
        );
      }

      applyAdventure = function (page) {
        const clonedPage = Object.assign({}, page || {});

        if ("content" in clonedPage) {
          clonedPage.content = expandNativeTags(clonedPage.content);
        }

        if ("text" in clonedPage) {
          clonedPage.text = expandNativeTags(clonedPage.text);
        }

        // 先交給原生 Adventure 引擎建立傷害骰、處理重擊。
        let html = originalApplyAdventure.call(this, clonedPage);

        // 再讀原生 adventure.damage 做顯示與條件判斷。
        html = processDamageIfBlocks(html);
        html = processDamageDisplay(html);

        return html;
      };

      window.FirehahaDamageDiceHelper = {
        version: "1.0.0",

        get(name) {
          return getDamage(name);
        },

        compare(actual, operator, expected) {
          return compare(actual, operator, expected);
        }
      };
    }

    const runtimeSource =
      "(" + readerRuntime.toString() + ")();";

    const css = `
<style ${MARK}>
.fh-damage-helper-result{
  display:inline-flex;
  align-items:center;
  gap:7px;
  margin:4px 5px;
  padding:6px 11px;
  border:1px solid #d8dee5;
  border-radius:999px;
  background:#f7f9fb;
  color:#263238;
  font:650 14px/1.4 system-ui,-apple-system,"Segoe UI","Noto Sans TC","Noto Sans JP",sans-serif;
  vertical-align:middle;
}
.fh-damage-helper-name{
  font-weight:800;
}
.fh-damage-helper-name::before{
  content:"⚔️ ";
}
.fh-damage-helper-value{
  font-size:17px;
  font-weight:900;
}
.fh-damage-helper-breakdown{
  color:#607d8b;
  font-size:12px;
}
.fh-damage-helper-waiting{
  opacity:.65;
}
body.reader-dark .fh-damage-helper-result{
  background:#222c36;
  border-color:#4b5d6d;
  color:#f3f7fa;
}
body.reader-dark .fh-damage-helper-breakdown{
  color:#b0bec5;
}
</style>
`;

    const removeTransform = api.registerReaderTransform(
      "reader",
      function (html) {
        if (typeof html !== "string") return html;
        if (html.includes(MARK)) return html;

        let output = html;

        // 與現有骰子插件採同一掛點：插在 loadState() 前，
        // 讓 runtime 能直接讀 Reader lexical memorySave。
        const loadStatePattern = /([}\s;])loadState\(\);/;

        if (loadStatePattern.test(output)) {
          output = output.replace(
            loadStatePattern,
            "$1\n" + runtimeSource + "\nloadState();"
          );
        } else {
          // 保底：至少插入 body 結尾，避免整支插件完全失效。
          output = output.replace(
            "</body>",
            "<script " + MARK + ">" +
              runtimeSource.replace(/<\/script/gi, "<\\/script") +
            "<\\/script>" +
            "</body>"
          );
        }

        output = output.replace(
          "</head>",
          css + "\n</head>"
        );

        return output;
      },
      245
    );

    api.toast("原生傷害骰直覺標籤助手已啟用");

    return function () {
      removeTransform();
    };
  }
});
