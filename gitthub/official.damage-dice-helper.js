// @firehaha-plugin {"id":"official.damage-dice-helper","name":"原生傷害骰直覺標籤助手","version":"1.0.0","author":"Firehaha","description":"沿用主程式原生傷害骰、重擊與 adventure.damage，提供傷害標籤、重擊、傷害判斷，以及把已擲出的傷害結果交給原生數值減少系統。"}

FirehahaPlugins.register({
  id: "official.damage-dice-helper",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha Damage Dice Helper 1.0.0 - Attack/Damage Bridge */
(function () {
  "use strict";

  if (window.__fhDamageDiceHelperInstalled) {
    return;
  }

  window.__fhDamageDiceHelperInstalled = true;

  if (typeof applyAdventure !== "function") {
    console.warn("[Damage Dice Helper] 找不到 applyAdventure");
    return;
  }

  const originalApplyAdventure = applyAdventure;


  function clean(value) {
    return String(
      value == null ? "" : value
    ).trim();
  }


  function escapeHtml(value) {
    return String(
      value == null ? "" : value
    )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }


  function adventureState() {
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
      if (
        window.memorySave &&
        window.memorySave.adventure
      ) {
        return window.memorySave.adventure;
      }
    } catch (error) {}

    return null;
  }


  function getCheck(name) {
    const target =
      clean(name);

    const adventure =
      adventureState();

    if (
      !target ||
      !adventure ||
      !adventure.checks ||
      !adventure.checks[target]
    ) {
      return null;
    }

    const raw =
      adventure.checks[target];

    const total =
      Number(
        raw &&
        typeof raw === "object"
          ? raw.total
          : NaN
      );

    return {
      name:
        target,

      total:
        Number.isFinite(total)
          ? total
          : null,

      result:
        clean(
          raw &&
          typeof raw === "object"
            ? raw.result
            : ""
        ),

      breakdown:
        clean(
          raw &&
          typeof raw === "object"
            ? raw.breakdown
            : ""
        ),

      raw:
        raw
    };
  }


  /*
   * 主程式檢定的基礎結果是「成功 / 失敗」，
   * 進階等級可能是「大成功 / 特殊成功 / 大失敗」等作者自訂名稱。
   *
   * 這裡採最保守的橋接規則：
   * - 沒結果：尚未檢定
   * - 結果名稱包含「失敗」：視為未命中
   * - 其他非空結果：視為命中
   *
   * 因此「大成功」可正常進入傷害階段，「大失敗」不會。
   */
  function checkPassed(check) {
    if (
      !check ||
      !check.result
    ) {
      return null;
    }

    return !String(
      check.result
    ).includes("失敗");
  }


  function getDamage(name) {
    const target =
      clean(name);

    const adventure =
      adventureState();

    if (
      !target ||
      !adventure ||
      !adventure.damage ||
      !adventure.damage[target]
    ) {
      return null;
    }

    const raw =
      adventure.damage[target];

    const total =
      Number(
        raw &&
        typeof raw === "object"
          ? raw.total
          : raw
      );

    if (!Number.isFinite(total)) {
      return null;
    }

    return {
      name:
        target,

      total:
        total,

      breakdown:
        clean(
          raw &&
          typeof raw === "object"
            ? raw.breakdown
            : ""
        ),

      raw:
        raw
    };
  }



  /*
   * =====================================================
   * 傷害骰單次鎖定（直接整合在 Helper 內）
   * =====================================================
   *
   * 規則：
   * - 同一頁 + 同一傷害名稱 + 第幾個傷害骰，各自只允許產生一次新的傷害骰結果。
   * - 第一次進入頁面時，把當時既有的 damage 結果記為 baseline。
   * - 本頁擲骰後，只要 damage[name] 相對 baseline 有變化，
   *   後續重繪只鎖住同一個出現位置，不影響同頁其他同名傷害骰。
   * - 換頁後建立新的 baseline，因此同名武器可再次擲骰。
   *
   * 這樣不需要額外防重擲外掛，也不需要猜 DOM 按鈕結構。
   */
  const damageRollOnceStates =
    new Map();


  function pageIdentity(page) {
    if (!page) return "unknown";

    const candidates = [
      ["id", page.id],
      ["pageId", page.pageId],
      ["index", page.index],
      ["no", page.no],
      ["number", page.number],
      ["title", page.title]
    ];

    for (const pair of candidates) {
      const value = pair[1];

      if (
        value !== undefined &&
        value !== null &&
        clean(value) !== ""
      ) {
        return (
          pair[0] +
          ":" +
          clean(value)
        );
      }
    }

    return "unknown";
  }


  function damageRaw(name) {
    const adventure =
      adventureState();

    const target =
      clean(name);

    if (
      !adventure ||
      !adventure.damage ||
      !target ||
      adventure.damage[target] == null
    ) {
      return null;
    }

    return adventure.damage[target];
  }


  function damageSignature(raw) {
    if (raw == null) {
      return "NONE";
    }

    if (
      raw &&
      typeof raw === "object"
    ) {
      try {
        return JSON.stringify(raw);
      } catch (error) {
        return [
          "OBJ",
          String(raw.total),
          clean(raw.breakdown),
          clean(raw.formula),
          clean(raw.result)
        ].join("|");
      }
    }

    return (
      "VALUE|" +
      String(raw)
    );
  }


  function damageRollState(
    page,
    damageName,
    occurrenceIndex
  ) {
    const pageKey =
      pageIdentity(page);

    const name =
      clean(damageName);

    const occurrence =
      Number.isInteger(
        Number(occurrenceIndex)
      )
        ? Number(occurrenceIndex)
        : 0;

    const key =
      pageKey +
      "||" +
      name +
      "||" +
      occurrence;

    let state =
      damageRollOnceStates.get(
        key
      );

    if (!state) {
      const raw =
        damageRaw(name);

      state = {
        key,
        pageKey,
        damageName:
          name,

        occurrenceIndex:
          occurrence,

        baselineRaw:
          raw,

        baselineSignature:
          damageSignature(raw),

        locked:
          false
      };

      damageRollOnceStates.set(
        key,
        state
      );
    }

    if (!state.locked) {
      const now =
        damageRaw(name);

      const nowSignature =
        damageSignature(now);

      /*
       * 原生/既有傷害骰若建立新 object：
       *   now !== baselineRaw
       *
       * 若是在同一 object 上改值：
       *   signature 也會改變。
       */
      if (
        now != null &&
        (
          now !== state.baselineRaw ||
          nowSignature !==
            state.baselineSignature
        )
      ) {
        state.locked =
          true;
      }
    }

    return state;
  }


  function damageRollLocked(
    page,
    damageName,
    occurrenceIndex
  ) {
    return damageRollState(
      page,
      damageName,
      occurrenceIndex
    ).locked;
  }


  function damageRollLockedMarkup(
    damageName
  ) {
    const result =
      getDamage(
        damageName
      );

    const totalText =
      result &&
      Number.isFinite(
        result.total
      )
        ? (
            "：" +
            escapeHtml(
              result.total
            )
          )
        : "";

    return (
      '<span class="fh-damage-helper-roll-locked">' +
      '🎲 ' +
      escapeHtml(
        damageName
      ) +
      totalText +
      '（本次已擲）' +
      '</span>'
    );
  }


  function normalizeRule(value) {
    const rule =
      clean(value)
        .toLowerCase()
        .replace(/\s+/g, " ");

    if (
      rule === ">=" ||
      rule === "至少" ||
      rule === "以上" ||
      rule === "大於等於" ||
      rule === "at least" ||
      rule === "greater than or equal" ||
      rule === "greater than or equal to"
    ) {
      return ">=";
    }

    if (
      rule === "<=" ||
      rule === "至多" ||
      rule === "以下" ||
      rule === "小於等於" ||
      rule === "at most" ||
      rule === "less than or equal" ||
      rule === "less than or equal to"
    ) {
      return "<=";
    }

    if (
      rule === ">" ||
      rule === "超過" ||
      rule === "大於" ||
      rule === "greater than" ||
      rule === "より大きい"
    ) {
      return ">";
    }

    if (
      rule === "<" ||
      rule === "未滿" ||
      rule === "小於" ||
      rule === "less than" ||
      rule === "未満"
    ) {
      return "<";
    }

    if (
      rule === "=" ||
      rule === "==" ||
      rule === "等於" ||
      rule === "equal" ||
      rule === "equal to" ||
      rule === "等しい"
    ) {
      return "=";
    }

    if (
      rule === "!=" ||
      rule === "<>" ||
      rule === "不等於" ||
      rule === "not equal" ||
      rule === "not equal to" ||
      rule === "等しくない"
    ) {
      return "!=";
    }

    return clean(value);
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

    const op =
      normalizeRule(operator);

    if (
      !Number.isFinite(a) ||
      !Number.isFinite(b)
    ) {
      return false;
    }

    if (op === ">=") return a >= b;
    if (op === "<=") return a <= b;
    if (op === ">") return a > b;
    if (op === "<") return a < b;
    if (op === "!=") return a !== b;

    return a === b;
  }


  function validFormula(value) {
    return /^\d*d\d+(?:[+-]\d+)?$/i.test(
      clean(value)
    );
  }


  function normalizeCriticalMode(value) {
    const mode =
      clean(value)
        .toLowerCase()
        .replace(/\s+/g, " ");

    if (
      mode === "骰數加倍" ||
      mode === "double dice" ||
      mode === "double dice count" ||
      mode === "ダイス数2倍" ||
      mode === "ダイス数を2倍"
    ) {
      return "骰數加倍";
    }

    if (
      mode === "傷害加倍" ||
      mode === "double damage" ||
      mode === "ダメージ2倍" ||
      mode === "ダメージを2倍"
    ) {
      return "傷害加倍";
    }

    if (
      mode === "最大傷害" ||
      mode === "maximum damage" ||
      mode === "max damage" ||
      mode === "最大ダメージ"
    ) {
      return "最大傷害";
    }

    return clean(value);
  }


  /*
   * =====================================================
   * 攻擊 → 傷害橋接
   * =====================================================
   *
   * 基本：
   *
   * [檢定:攻擊:1d20+5:>=:15]
   * [攻擊傷害:攻擊|長劍|1d8+3]
   *
   * 尚未擲「攻擊」：
   *   不建立傷害骰。
   *
   * 攻擊 = 失敗 / 大失敗：
   *   不建立傷害骰。
   *
   * 攻擊 = 成功 / 大成功 / 其他成功等級：
   *   轉成 [傷害骰:長劍:1d8+3]
   *
   *
   * 一體式重擊：
   *
   * [攻擊傷害:攻擊|長劍|1d8+3|大成功|骰數加倍]
   *
   * 會在命中後轉成：
   *
   * [重擊:長劍:攻擊=大成功:骰數加倍]
   * [傷害骰:長劍:1d8+3]
   */
  function processAttackDamageTags(source, page) {
    let text =
      String(source || "");

    /*
     * 同一頁可有多個同名傷害骰。
     * 以「同名傷害第幾次出現」作為獨立鎖定識別。
     */
    const damageOccurrences =
      Object.create(null);

    function nextDamageOccurrence(name) {
      const key =
        clean(name);

      const index =
        Number(
          damageOccurrences[key] || 0
        );

      damageOccurrences[key] =
        index + 1;

      return index;
    }


    /*
     * 先處理有重擊設定的 5 欄版本。
     */
    text =
      text.replace(
        /\[(?:攻擊傷害|attackdamage|attack-damage|攻撃ダメージ)\s*:\s*([^|\]\r\n]+?)\s*\|\s*([^|\]\r\n]+?)\s*\|\s*([^|\]\r\n]+?)\s*\|\s*([^|\]\r\n]+?)\s*\|\s*([^|\]\r\n]+?)\s*\]/gi,

        function(
          whole,
          checkText,
          damageText,
          formulaText,
          criticalResultText,
          criticalModeText
        ) {
          const checkName =
            clean(checkText);

          const damageName =
            clean(damageText);

          const formula =
            clean(formulaText);

          const criticalResult =
            clean(
              criticalResultText
            );

          const criticalMode =
            normalizeCriticalMode(
              criticalModeText
            );

          if (
            !checkName ||
            !damageName ||
            !validFormula(formula) ||
            !criticalResult ||
            ![
              "骰數加倍",
              "傷害加倍",
              "最大傷害"
            ].includes(
              criticalMode
            )
          ) {
            return whole;
          }


          const check =
            getCheck(
              checkName
            );

          const passed =
            checkPassed(
              check
            );


          /*
           * 尚未檢定，或檢定失敗：
           * 不把傷害骰交給原生引擎。
           *
           * 下一次攻擊骰完成後，頁面重畫時會從原始正文重新判斷。
           */
          if (passed !== true) {
            return "";
          }


          /*
           * 本頁這個傷害名稱若已經擲過，
           * 不再重新產生傷害骰。
           */
          const occurrenceIndex =
            nextDamageOccurrence(
              damageName
            );

          if (
            damageRollLocked(
              page,
              damageName,
              occurrenceIndex
            )
          ) {
            return damageRollLockedMarkup(
              damageName
            );
          }


          return (
            "[重擊:" +
            damageName +
            ":" +
            checkName +
            "=" +
            criticalResult +
            ":" +
            criticalMode +
            "]" +
            "[傷害骰:" +
            damageName +
            ":" +
            formula +
            "]"
          );
        }
      );


    /*
     * 再處理基本 3 欄版本。
     */
    text =
      text.replace(
        /\[(?:攻擊傷害|attackdamage|attack-damage|攻撃ダメージ)\s*:\s*([^|\]\r\n]+?)\s*\|\s*([^|\]\r\n]+?)\s*\|\s*([^|\]\r\n]+?)\s*\]/gi,

        function(
          whole,
          checkText,
          damageText,
          formulaText
        ) {
          const checkName =
            clean(checkText);

          const damageName =
            clean(damageText);

          const formula =
            clean(formulaText);

          if (
            !checkName ||
            !damageName ||
            !validFormula(formula)
          ) {
            return whole;
          }


          const check =
            getCheck(
              checkName
            );

          const passed =
            checkPassed(
              check
            );


          if (passed !== true) {
            return "";
          }


          const occurrenceIndex =
            nextDamageOccurrence(
              damageName
            );

          if (
            damageRollLocked(
              page,
              damageName,
              occurrenceIndex
            )
          ) {
            return damageRollLockedMarkup(
              damageName
            );
          }


          return (
            "[傷害骰:" +
            damageName +
            ":" +
            formula +
            "]"
          );
        }
      );


    return text;
  }


  /*
   * =====================================================
   * 非骰子效果 → 原生數值系統橋接
   * =====================================================
   *
   * 用途：
   * - 選項造成固定傷害
   * - 回復生命
   * - 增加 / 減少攻擊、防禦、好感、金錢等一般數值
   * - 直接設定某個數值
   *
   * 這些標籤本身不另外建立新數值系統，
   * 只轉成主程式原生：
   *   [增加:名稱:數字]
   *   [減少:名稱:數字]
   *   [數值:名稱=數字]
   *
   * 例：
   * [直接傷害:玩家HP|3]
   * → [減少:玩家HP:3]
   *
   * [恢復:玩家HP|5]
   * → [增加:玩家HP:5]
   *
   * [加值:攻擊加值|2]
   * → [增加:攻擊加值:2]
   *
   * [減值:防禦加值|1]
   * → [減少:防禦加值:1]
   *
   * [效果:設定|毒素層數|0]
   * → [數值:毒素層數=0]
   */
  function processDirectValueEffectTags(source) {
    let text =
      String(source || "");

    /*
     * 統一式：
     * [效果:增加|名稱|數字]
     * [效果:減少|名稱|數字]
     * [效果:設定|名稱|數字]
     */
    text =
      text.replace(
        /\[(?:效果|effect)\s*:\s*(增加|減少|設定|add|increase|subtract|decrease|set)\s*\|\s*([^|\]\r\n]+?)\s*\|\s*(-?\d+(?:\.\d+)?)\s*\]/gi,

        function(
          whole,
          modeText,
          nameText,
          amountText
        ) {
          const mode =
            clean(modeText)
              .toLowerCase();

          const name =
            clean(nameText);

          const amount =
            Number(amountText);

          if (
            !name ||
            !Number.isFinite(amount)
          ) {
            return whole;
          }

          if (
            mode === "增加" ||
            mode === "add" ||
            mode === "increase"
          ) {
            return (
              "[增加:" +
              name +
              ":" +
              amount +
              "]"
            );
          }

          if (
            mode === "減少" ||
            mode === "subtract" ||
            mode === "decrease"
          ) {
            return (
              "[減少:" +
              name +
              ":" +
              amount +
              "]"
            );
          }

          return (
            "[數值:" +
            name +
            "=" +
            amount +
            "]"
          );
        }
      );


    /*
     * 固定傷害：
     * [直接傷害:玩家HP|3]
     * [固定傷害:玩家HP|3]
     */
    text =
      text.replace(
        /\[(?:直接傷害|固定傷害|directdamage|direct-damage|fixeddamage|fixed-damage)\s*:\s*([^|\]\r\n]+?)\s*\|\s*(-?\d+(?:\.\d+)?)\s*\]/gi,

        function(
          whole,
          nameText,
          amountText
        ) {
          const name =
            clean(nameText);

          const amount =
            Number(amountText);

          if (
            !name ||
            !Number.isFinite(amount)
          ) {
            return whole;
          }

          return (
            "[減少:" +
            name +
            ":" +
            amount +
            "]"
          );
        }
      );


    /*
     * 回復：
     * [恢復:玩家HP|5]
     * [治療:玩家HP|5]
     */
    text =
      text.replace(
        /\[(?:恢復|回復|治療|heal|restore)\s*:\s*([^|\]\r\n]+?)\s*\|\s*(-?\d+(?:\.\d+)?)\s*\]/gi,

        function(
          whole,
          nameText,
          amountText
        ) {
          const name =
            clean(nameText);

          const amount =
            Number(amountText);

          if (
            !name ||
            !Number.isFinite(amount)
          ) {
            return whole;
          }

          return (
            "[增加:" +
            name +
            ":" +
            amount +
            "]"
          );
        }
      );


    /*
     * 一般加值 / 減值：
     * [加值:攻擊加值|2]
     * [減值:防禦加值|1]
     */
    text =
      text.replace(
        /\[(加值|減值|bonus|penalty)\s*:\s*([^|\]\r\n]+?)\s*\|\s*(-?\d+(?:\.\d+)?)\s*\]/gi,

        function(
          whole,
          modeText,
          nameText,
          amountText
        ) {
          const mode =
            clean(modeText)
              .toLowerCase();

          const name =
            clean(nameText);

          const amount =
            Number(amountText);

          if (
            !name ||
            !Number.isFinite(amount)
          ) {
            return whole;
          }

          const isAdd =
            mode === "加值" ||
            mode === "bonus";

          return (
            "[" +
            (
              isAdd
                ? "增加"
                : "減少"
            ) +
            ":" +
            name +
            ":" +
            amount +
            "]"
          );
        }
      );


    return text;
  }


  /*
   * =====================================================
   * 舊版簡化標籤仍保留
   * =====================================================
   *
   * [傷害:長劍|1d8+3]
   * → [傷害骰:長劍:1d8+3]
   *
   * 這個模式不檢查命中；
   * 適合陷阱傷害、環境傷害、必中技能等。
   */
  function expandStandaloneDamageTags(source, page) {
    let text =
      String(source || "");

    const damageOccurrences =
      Object.create(null);

    function nextDamageOccurrence(name) {
      const key =
        clean(name);

      const index =
        Number(
          damageOccurrences[key] || 0
        );

      damageOccurrences[key] =
        index + 1;

      return index;
    }


    text =
      text.replace(
        /\[(?:傷害|damage|ダメージ)\s*:\s*([^|\]\r\n]+?)\s*\|\s*([^|\]\r\n]+?)\s*\]/gi,

        function(
          whole,
          nameText,
          formulaText
        ) {
          const name =
            clean(nameText);

          const formula =
            clean(formulaText);

          if (
            !name ||
            !validFormula(formula)
          ) {
            return whole;
          }

          const occurrenceIndex =
            nextDamageOccurrence(
              name
            );

          if (
            damageRollLocked(
              page,
              name,
              occurrenceIndex
            )
          ) {
            return damageRollLockedMarkup(
              name
            );
          }

          return (
            "[傷害骰:" +
            name +
            ":" +
            formula +
            "]"
          );
        }
      );


    /*
     * 獨立重擊簡化標籤也保留。
     */
    text =
      text.replace(
        /\[(?:傷害重擊|damagecritical|damage-critical|ダメージクリティカル)\s*:\s*([^|\]\r\n]+?)\s*\|\s*([^|\]\r\n]+?)\s*\|\s*([^|\]\r\n]+?)\s*\|\s*([^|\]\r\n]+?)\s*\]/gi,

        function(
          whole,
          damageText,
          checkText,
          resultText,
          modeText
        ) {
          const damageName =
            clean(damageText);

          const checkName =
            clean(checkText);

          const resultName =
            clean(resultText);

          const criticalMode =
            normalizeCriticalMode(
              modeText
            );

          if (
            !damageName ||
            !checkName ||
            !resultName ||
            ![
              "骰數加倍",
              "傷害加倍",
              "最大傷害"
            ].includes(
              criticalMode
            )
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
            criticalMode +
            "]"
          );
        }
      );


    return text;
  }


  /*
   * 保護傷害如果式，避免通用 If Block 提前處理。
   */
  function protectDamageIfBlocks(source) {
    const blocks = [];

    const html =
      String(source || "")
        .replace(
          /\[如果:傷害:[^|\]\r\n]+\|[^|\]\r\n]+\|-?\d+(?:\.\d+)?\][\s\S]*?\[\/如果\]/gi,

          function(whole) {
            const index =
              blocks.length;

            blocks.push(
              whole
            );

            return (
              "@@FH_DAMAGE_IF_" +
              index +
              "@@"
            );
          }
        );

    return {
      html,

      restore(value) {
        return String(value || "")
          .replace(
            /@@FH_DAMAGE_IF_(\d+)@@/g,

            function(
              whole,
              indexText
            ) {
              const index =
                Number(indexText);

              return (
                Number.isInteger(index) &&
                blocks[index] != null
              )
                ? blocks[index]
                : whole;
            }
          );
      }
    };
  }


  /*
   * [如果:傷害:長劍|至少|10]
   * 重創
   * [否則]
   * 輕傷
   * [/如果]
   */
  function processDamageIfBlocks(html) {
    return String(html || "")
      .replace(
        /\[如果:傷害:([^|\]\r\n]+?)\|([^|\]\r\n]+?)\|(-?\d+(?:\.\d+)?)\]([\s\S]*?)(?:\[否則\]([\s\S]*?))?\[\/如果\]/gi,

        function(
          whole,
          nameText,
          ruleText,
          expectedText,
          yesText,
          noText
        ) {
          const result =
            getDamage(
              nameText
            );

          if (!result) {
            return "";
          }

          const passed =
            compare(
              result.total,
              ruleText,
              Number(
                expectedText
              )
            );

          return passed
            ? String(
                yesText || ""
              )
            : String(
                noText || ""
              );
        }
      );
  }


  /*
   * =====================================================
   * 傷害結果 → 數值減少橋接
   * =====================================================
   *
   * [減少傷害:敵人HP|長劍]
   *
   * 處理順序：
   * 1. 先讀 memorySave.adventure.damage["長劍"]
   * 2. 取得已完成傷害骰的 total
   * 3. 再把 total 扣到 memorySave.adventure.values["敵人HP"]
   *
   * 這裡刻意把「傷害骰」與「數值扣除」分開：
   * - 傷害骰只負責產生/保存結果
   * - [減少傷害] 才決定把哪個傷害結果套到哪個數值
   *
   * 同一個傷害結果、同一個目標、同一個頁面只套用一次，
   * 避免閱讀器重繪時重複扣血。
   */

  const damageReductionObjectUses =
    typeof WeakMap === "function"
      ? new WeakMap()
      : null;

  const damageReductionPrimitiveUses =
    Object.create(null);


  function pageIdentity(page) {
    if (!page) return "unknown";

    const candidates = [
      page.id,
      page.pageId,
      page.index,
      page.no,
      page.number,
      page.title
    ];

    for (const value of candidates) {
      if (
        value !== undefined &&
        value !== null &&
        clean(value) !== ""
      ) {
        return clean(value);
      }
    }

    return "unknown";
  }


  function hasAppliedDamageReduction(
    result,
    useKey
  ) {
    const raw =
      result && result.raw;

    if (
      raw &&
      typeof raw === "object" &&
      damageReductionObjectUses
    ) {
      let set =
        damageReductionObjectUses.get(raw);

      if (!set) {
        set = new Set();
        damageReductionObjectUses.set(
          raw,
          set
        );
      }

      if (set.has(useKey)) {
        return true;
      }

      set.add(useKey);
      return false;
    }

    const fallbackKey =
      useKey +
      "|" +
      String(
        result && result.total
      ) +
      "|" +
      String(
        result && result.breakdown || ""
      );

    if (
      damageReductionPrimitiveUses[
        fallbackKey
      ]
    ) {
      return true;
    }

    damageReductionPrimitiveUses[
      fallbackKey
    ] = true;

    return false;
  }


  function reduceAdventureValue(
    valueName,
    amount
  ) {
    const adventure =
      adventureState();

    if (
      !adventure ||
      !adventure.values
    ) {
      return false;
    }

    const current =
      Number(
        adventure.values[
          valueName
        ]
      );

    const damage =
      Number(amount);

    if (
      !Number.isFinite(current) ||
      !Number.isFinite(damage)
    ) {
      return false;
    }

    adventure.values[
      valueName
    ] =
      current - damage;

    return true;
  }


  function processDamageValueReductions(
    source,
    page
  ) {
    let tagIndex = 0;

    return String(source || "")
      .replace(
        /\[(?:減少傷害|扣除傷害|reducedamage|reduce-damage|ダメージ減少)\s*:\s*([^|\]\r\n]+?)\s*\|\s*([^\]\r\n]+?)\s*\]/gi,

        function(
          whole,
          valueNameText,
          damageNameText
        ) {
          const index =
            tagIndex++;

          const valueName =
            clean(valueNameText);

          const damageName =
            clean(damageNameText);

          const result =
            getDamage(
              damageName
            );

          /*
           * 還沒有傷害結果時：
           * 先不扣，也不把標籤轉成固定數值。
           * 等傷害骰完成、閱讀器下一次重畫時再讀取結果。
           */
          if (
            !valueName ||
            !damageName ||
            !result ||
            !Number.isFinite(
              result.total
            )
          ) {
            return "";
          }

          const useKey =
            pageIdentity(page) +
            "|" +
            valueName +
            "|" +
            damageName +
            "|" +
            index;

          if (
            hasAppliedDamageReduction(
              result,
              useKey
            )
          ) {
            return "";
          }

          const applied =
            reduceAdventureValue(
              valueName,
              result.total
            );

          if (!applied) {
            console.warn(
              "[Damage Dice Helper] 無法套用傷害到數值：",
              valueName,
              result.total
            );
          }

          return "";
        }
      );
  }


  /*
   * [顯示傷害:長劍]
   */
  function processDamageDisplays(html) {
    return String(html || "")
      .replace(
        /\[(?:顯示傷害|showdamage|ダメージ表示)\s*:\s*([^\]\r\n]+?)\s*\]/gi,

        function(
          whole,
          nameText
        ) {
          const name =
            clean(nameText);

          const result =
            getDamage(name);

          if (!result) {
            return (
              '<span class="fh-damage-helper-display fh-damage-helper-empty">' +
              '<span class="fh-damage-helper-name">' +
              escapeHtml(name) +
              '</span>' +
              '<span class="fh-damage-helper-total">—</span>' +
              '</span>'
            );
          }

          return (
            '<span class="fh-damage-helper-display">' +
            '<span class="fh-damage-helper-name">' +
            escapeHtml(
              result.name
            ) +
            '</span>' +
            '<span class="fh-damage-helper-total">' +
            escapeHtml(
              result.total
            ) +
            '</span>' +
            (
              result.breakdown
                ? (
                    '<span class="fh-damage-helper-breakdown">' +
                    escapeHtml(
                      result.breakdown
                    ) +
                    '</span>'
                  )
                : ""
            ) +
            '</span>'
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

      const field =
        clonedPage.content != null
          ? "content"
          : "text";

      const originalContent =
        String(
          clonedPage[field] || ""
        );


      /*
       * 1. 傷害結果如果式先保護。
       */
      const protectedIf =
        protectDamageIfBlocks(
          originalContent
        );


      /*
       * 2. 先處理攻擊→傷害橋接。
       *
       * 這一步會直接讀「上一輪/目前已完成」的原生檢定結果。
       */
      let converted =
        processAttackDamageTags(
          protectedIf.html,
          page
        );


      /*
       * 3. 再處理陷阱 / 環境 / 必中傷害等獨立傷害標籤。
       */
      converted =
        expandStandaloneDamageTags(
          converted,
          page
        );


      /*
       * 4. 非骰子的固定效果先轉成交給主程式原生數值標籤。
       *
       * 例如：
       * [直接傷害:玩家HP|3]
       * → [減少:玩家HP:3]
       *
       * [加值:攻擊加值|2]
       * → [增加:攻擊加值:2]
       */
      converted =
        processDirectValueEffectTags(
          converted
        );


      clonedPage[field] =
        converted;


      /*
       * 5. 交回主程式原生 Adventure。
       *
       * 主程式仍是唯一負責：
       * - [檢定]
       * - [傷害骰]
       * - [重擊]
       * - 擲骰動畫
       * - memorySave.adventure.checks
       * - memorySave.adventure.damage
       */
      let html =
        originalApplyAdventure.call(
          this,
          clonedPage
        );


      /*
       * 6. 還原傷害結果如果式並依原生 damage 判定。
       */
      html =
        protectedIf.restore(
          html
        );

      /*
       * 先讀取已經存在的傷害骰結果，再扣指定數值。
       * 這一步放在原生 Adventure 之後，
       * 避免傷害骰尚未完成時就把標籤固定成舊值。
       */
      html =
        processDamageValueReductions(
          html,
          page
        );

      html =
        processDamageIfBlocks(
          html
        );

      html =
        processDamageDisplays(
          html
        );


      return html;
    };


  window.FirehahaDamageDiceHelper = {
    version:
      "1.0.0",

    getCheck:
      getCheck,

    checkPassed:
      checkPassed,

    get:
      getDamage,

    compare:
      compare,

    expandAttackDamage:
      processAttackDamageTags,

    expandDirectEffects:
      processDirectValueEffectTags,

    expandDamageReduction:
      processDamageValueReductions,

    isDamageRollLocked:
      damageRollLocked,

    inspectDamageRollLocks() {
      return Array.from(
        damageRollOnceStates.values()
      ).map(function(state) {
        return {
          pageKey:
            state.pageKey,

          damageName:
            state.damageName,

          occurrenceIndex:
            state.occurrenceIndex,

          locked:
            state.locked,

          baselineSignature:
            state.baselineSignature
        };
      });
    },

    clearDamageRollLocks() {
      damageRollOnceStates.clear();
    }
  };

})();
`


    const css = `
.fh-damage-helper-display{
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
  font-weight:850;
}
.fh-damage-helper-name::before{
  content:"⚔️ ";
}
.fh-damage-helper-total{
  font-size:17px;
  font-weight:900;
}
.fh-damage-helper-breakdown{
  color:#607d8b;
  font-size:12px;
}
.fh-damage-helper-empty{
  opacity:.6;
}
.fh-damage-helper-roll-locked{
  display:inline-flex;
  align-items:center;
  gap:5px;
  margin:4px 5px;
  padding:6px 10px;
  border:1px solid #cfd8dc;
  border-radius:999px;
  background:#f5f7f8;
  color:#546e7a;
  font:700 13px/1.4 system-ui,-apple-system,"Segoe UI","Noto Sans TC","Noto Sans JP",sans-serif;
  user-select:none;
  cursor:default;
}
body.reader-dark .fh-damage-helper-display{
  background:#222c36;
  border-color:#4b5d6d;
  color:#f4f7fa;
}
body.reader-dark .fh-damage-helper-breakdown{
  color:#b0bec5;
}
body.reader-dark .fh-damage-helper-roll-locked{
  background:#263238;
  border-color:#455a64;
  color:#cfd8dc;
}
`;


    const removeStyle =
      api.addStyle(
        "damage-dice-helper",
        css
      );


    const removeTransform =
      api.registerReaderTransform(
        "reader",

        function(html) {
          html =
            String(
              html == null
                ? ""
                : html
            );

          const marker =
            "function renderAdventure(){";


          /*
           * 與你目前正常運作的 If Block、
           * Auto Dice Jump 採同一個 Reader 掛點。
           */
          if (
            !html.includes(marker)
          ) {
            console.warn(
              "[Damage Dice Helper] 找不到閱讀器插入位置"
            );

            return html;
          }


          return html.replace(
            marker,
            patchCode +
            "\n" +
            marker
          );
        },

        /*
         * 比 official.if-block(260) 晚，
         * 讓這支成為外層 wrapper，
         * 可以先保護 [如果:傷害:...]。
         */
        280
      );


    api.toast(
      "原生傷害骰直覺標籤助手已啟用"
    );


    return function cleanup() {
      removeTransform();
      removeStyle();
    };
  }
});
