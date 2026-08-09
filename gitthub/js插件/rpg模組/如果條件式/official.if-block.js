// @firehaha-plugin {"id":"official.if-block","name":"如果條件區塊","version":"1.0.1","author":"Firehaha","description":"以 [如果:條件]、[否則]、[/如果] 在同一頁中顯示不同正文，沿用主程式既有條件判斷"}

FirehahaPlugins.register({
  id: "official.if-block",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha If Block 1.0.0 - strengthened numeric parser */
(function () {
  "use strict";

  if (window.__firehahaIfBlockInstalled) {
    return;
  }

  window.__firehahaIfBlockInstalled = true;


  // =====================================================
  // 基礎工具
  // =====================================================

  function clean(value) {
    return String(
      value == null ? "" : value
    ).trim();
  }


  function decodeHtmlEntities(value) {
    let text =
      String(
        value == null ? "" : value
      );

    /*
     * Reader 正文經過 HTML 層後：
     *
     * <  可能變成 &lt;
     * >  可能變成 &gt;
     * &  可能再次變成 &amp;
     *
     * 因此最多解三輪，兼容：
     * &lt;
     * &amp;lt;
     * &amp;amp;lt;
     *
     * 這裡只處理「If 條件字串」，
     * 不會解碼整篇正文 HTML。
     */
    for (
      let i = 0;
      i < 3;
      i++
    ) {
      const next =
        text
          .replace(/&#x3c;/gi, "<")
          .replace(/&#60;/gi, "<")
          .replace(/&lt;/gi, "<")
          .replace(/&#x3e;/gi, ">")
          .replace(/&#62;/gi, ">")
          .replace(/&gt;/gi, ">")
          .replace(/&#x26;/gi, "&")
          .replace(/&#38;/gi, "&")
          .replace(/&amp;/gi, "&");

      if (
        next === text
      ) {
        break;
      }

      text = next;
    }

    return text;
  }


  function normalizeText(value) {
    return clean(
      decodeHtmlEntities(
        value
      )
    )
      .replace(/：/g, ":")
      .replace(/｜/g, "|")
      .replace(/＞/g, ">")
      .replace(/＜/g, "<")
      .replace(/＝/g, "=")
      .replace(/！/g, "!")
      .replace(/[－−]/g, "-");
  }


  function numberOrNull(value) {
    const n =
      Number(value);

    return Number.isFinite(n)
      ? n
      : null;
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
  // 比較運算子
  //
  // 本插件獨立運算元（正式推薦）：
  //
  // GE = Greater or Equal  大於等於
  // LE = Less or Equal     小於等於
  // GT = Greater Than      大於
  // LT = Less Than         小於
  // EQ = Equal             等於
  // NE = Not Equal         不等於
  //
  // 例如：
  // [如果:數值:HP|LE|0]
  // [如果:數值:HP|GE|10]
  //
  // 舊符號仍支援：
  // >= <= > < = == != <>
  //
  // 舊文字版亦保留：
  // 至少 / 至多 / 超過 / 未滿 / 等於 / 不等於
  //
  // English:
  // at least / at most / greater than / less than /
  // equal to / not equal to
  //
  // 日本語：
  // 以上 / 以下 / より大きい / 未満 / 等しい / 等しくない
  // =====================================================

  function normalizeOperator(value) {
    const raw =
      normalizeText(value);

    const word =
      raw
        .toLowerCase()
        .replace(/\s+/g, " ");


    /*
     * official.if-block 專用運算元。
     *
     * 這六個 token 不交給 hiddenCondition，
     * 也不依賴任何骰子／傷害插件的 parser。
     */
    if (word === "ge") {
      return ">=";
    }

    if (word === "le") {
      return "<=";
    }

    if (word === "gt") {
      return ">";
    }

    if (word === "lt") {
      return "<";
    }

    if (word === "eq") {
      return "=";
    }

    if (word === "ne") {
      return "!=";
    }


    if (
      word === ">=" ||
      word === "至少" ||
      word === "大於等於" ||
      word === "以上" ||
      word === "at least" ||
      word === "greater than or equal" ||
      word === "greater than or equal to"
    ) {
      return ">=";
    }

    if (
      word === "<=" ||
      word === "至多" ||
      word === "小於等於" ||
      word === "以下" ||
      word === "at most" ||
      word === "less than or equal" ||
      word === "less than or equal to"
    ) {
      return "<=";
    }

    if (
      word === ">" ||
      word === "超過" ||
      word === "大於" ||
      word === "greater than" ||
      word === "より大きい"
    ) {
      return ">";
    }

    if (
      word === "<" ||
      word === "未滿" ||
      word === "小於" ||
      word === "less than" ||
      word === "未満"
    ) {
      return "<";
    }

    if (
      word === "=" ||
      word === "==" ||
      word === "等於" ||
      word === "等于" ||
      word === "equal" ||
      word === "equal to" ||
      word === "等しい"
    ) {
      return "=";
    }

    if (
      word === "!=" ||
      word === "<>" ||
      word === "不等於" ||
      word === "不等于" ||
      word === "not equal" ||
      word === "not equal to" ||
      word === "等しくない"
    ) {
      return "!=";
    }

    return raw;
  }


  function compareNumbers(
    actual,
    operator,
    expected
  ) {
    const a =
      numberOrNull(actual);

    const b =
      numberOrNull(expected);

    const op =
      normalizeOperator(
        operator
      );

    if (
      a == null ||
      b == null
    ) {
      return false;
    }

    switch (op) {
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


  // =====================================================
  // 數值 / 屬性 / 技能讀值
  // =====================================================

  function getNumericSource(
    type,
    name
  ) {
    const adventure =
      getAdventure();

    if (!adventure) {
      return null;
    }

    const key =
      clean(name);

    if (!key) {
      return null;
    }

    switch (
      clean(type)
    ) {
      case "數值":
      case "value":
      case "values":
      case "数値":
        {
          const hasKey =
            !!(adventure.values &&
              Object.prototype.hasOwnProperty.call(
                adventure.values,
                key
              ));

          if (!hasKey) {
            // 找不到這個數值名稱：回傳 null，
            // 讓上層判斷邏輯知道「讀不到」而不是誤判成 0，
            // 避免例如 [如果:數值:HP|LE|0] 在打錯字/大小寫不符時永遠成立。
            return null;
          }

          return numberOrNull(
            adventure.values[key]
          ) ?? 0;
        }


      case "屬性":
      case "属性":
      case "attribute":
        {
          const hasKey =
            !!(adventure.attributes &&
              Object.prototype.hasOwnProperty.call(
                adventure.attributes,
                key
              ));

          if (!hasKey) {
            return null;
          }

          const base =
            numberOrNull(
              adventure.attributes[
                key
              ]
            ) ?? 0;

          /*
           * 屬性比較沿用「最終值」概念：
           * 基礎值 + 修正值。
           *
           * 這樣 [修正值:力量=2] 不會在如果式裡被忽略。
           */
          const modifier =
            numberOrNull(
              adventure.modifiers &&
              adventure.modifiers[
                key
              ]
            ) ?? 0;

          return base +
            modifier;
        }


      case "技能":
      case "skill":
      case "スキル":
        {
          const hasKey =
            !!(adventure.skills &&
              Object.prototype.hasOwnProperty.call(
                adventure.skills,
                key
              ));

          if (!hasKey) {
            return null;
          }

          const base =
            numberOrNull(
              adventure.skills[
                key
              ]
            ) ?? 0;

          const modifier =
            numberOrNull(
              adventure.skillModifiers &&
              adventure.skillModifiers[
                key
              ]
            ) ?? 0;

          return base +
            modifier;
        }
    }

    return null;
  }


  /*
   * 正式推薦：本插件獨立運算元
   *
   * [如果:數值:HP|GE|10]
   * [如果:數值:HP|LE|0]
   * [如果:屬性:力量|GT|15]
   * [如果:技能:開鎖|LT|60]
   * [如果:數值:金錢|EQ|100]
   * [如果:數值:HP|NE|0]
   *
   * 舊文字版仍相容：
   *
   * [如果:數值:HP|至少|10]
   * [如果:屬性:力量|至多|20]
   * [如果:技能:開鎖|以上|60]
   *
   * 舊版：
   *
   * [如果:數值:HP>=10]
   * [如果:屬性:力量<=20]
   *
   * 注意：
   * 符號版 Regex 故意把 >= / <= / != / == / <>
   * 放在單字元 > < = 前面，避免被拆錯。
   */
  function parseNumericCondition(
    condition
  ) {
    const text =
      normalizeText(
        condition
      );


    // ---------------------------------
    // official.if-block 獨立運算元：
    // 類型:名稱|GE/LE/GT/LT/EQ/NE|數字
    //
    // 這一層完全不解析 > < = 符號，
    // 因此不可能遇到 >= 被其他 Regex 拆開。
    // ---------------------------------
    let match =
      text.match(
        /^(數值|value|values|数値|屬性|属性|attribute|技能|skill|スキル)\s*:\s*([^|\r\n]+?)\s*\|\s*(GE|LE|GT|LT|EQ|NE)\s*\|\s*(-?\d+(?:\.\d+)?)$/i
      );

    if (match) {
      const actual =
        getNumericSource(
          match[1],
          match[2]
        );

      if (actual == null) {
        return null;
      }

      return compareNumbers(
        actual,
        match[3],
        match[4]
      );
    }


    // ---------------------------------
    // 舊文字分隔版：類型:名稱|規則|數字
    // ---------------------------------
    match =
      text.match(
        /^(數值|value|values|数値|屬性|属性|attribute|技能|skill|スキル)\s*:\s*([^|\r\n]+?)\s*\|\s*([^|\r\n]+?)\s*\|\s*(-?\d+(?:\.\d+)?)$/i
      );

    if (match) {
      const actual =
        getNumericSource(
          match[1],
          match[2]
        );

      if (actual == null) {
        return null;
      }

      return compareNumbers(
        actual,
        match[3],
        match[4]
      );
    }


    // ---------------------------------
    // 舊符號版：類型:名稱>=數字
    // 長運算子一定優先。
    // ---------------------------------
    match =
      text.match(
        /^(數值|value|values|数値|屬性|属性|attribute|技能|skill|スキル)\s*:\s*(.+?)\s*(>=|<=|==|!=|<>|>|<|=)\s*(-?\d+(?:\.\d+)?)$/i
      );

    if (match) {
      const actual =
        getNumericSource(
          match[1],
          match[2]
        );

      if (actual == null) {
        return null;
      }

      return compareNumbers(
        actual,
        match[3],
        match[4]
      );
    }


    return null;
  }


  // =====================================================
  // 條件責任分流
  //
  // 這支 If Block 不應該處理其他插件自己的條件。
  // 專用插件自己判，避免搶先 false。
  // =====================================================

  const delegatedPrefixes = [
    "骰子",
    "自動骰",
    "對抗",
    "對抗差值",
    "持續對抗",
    "持續對抗差值",
    "傷害",
    "傷害差值"
  ];


  function isDelegatedCondition(
    condition
  ) {
    const text =
      normalizeText(
        condition
      );

    return delegatedPrefixes
      .some(
        prefix =>
          text === prefix ||
          text.startsWith(
            prefix + ":"
          )
      );
  }


  // =====================================================
  // 條件判斷入口
  // =====================================================

  function checkCondition(
    condition
  ) {
    const normalized =
      normalizeText(
        condition
      );

    if (!normalized) {
      return false;
    }


    /*
     * 1. 數值 / 屬性 / 技能：
     *    由本插件自己解析。
     *
     *    不再把 >= / <= 全部交給 hiddenCondition，
     *    避免多層 Regex 造成「>= 被拆成 > 和 =」的笑話。
     */
    const numericResult =
      parseNumericCondition(
        normalized
      );

    if (
      numericResult !==
      null
    ) {
      return numericResult;
    }


    /*
     * 2. 其他主程式條件仍沿用 hiddenCondition。
     *
     * 持有 / 未持有 / 旗幟 / 任務 / 檢定 ...
     */
    try {
      if (
        typeof hiddenCondition ===
        "function"
      ) {
        return !!hiddenCondition(
          normalized
        );
      }

    } catch (error) {
      console.warn(
        "[If Block] hiddenCondition 判斷失敗：",
        normalized,
        error
      );
    }


    return false;
  }


  // =====================================================
  // 委派區塊保護
  //
  // 使用堆疊，不用簡單 .*? Regex，
  // 因此能正確處理巢狀 [如果]。
  // =====================================================

  function protectDelegatedBlocks(
    source
  ) {
    const input =
      String(
        source == null
          ? ""
          : source
      );


    const tokenRegex =
      /\[(如果|if)\s*:\s*([^\]]+?)\]|\[(否則|else)\]|\[\/(如果|if)\]/gi;


    const tokens =
      [];

    let match;


    while (
      (
        match =
          tokenRegex.exec(
            input
          )
      )
    ) {
      tokens.push({
        index:
          match.index,

        end:
          tokenRegex.lastIndex,

        open:
          !!match[1],

        condition:
          match[1]
            ? normalizeText(
                match[2]
              )
            : "",

        close:
          !!match[4]
      });
    }


    const ranges =
      [];

    const stack =
      [];


    for (
      let i =
        0;

      i <
        tokens.length;

      i++
    ) {
      const token =
        tokens[i];


      if (token.open) {
        stack.push({
          start:
            token.index,

          delegated:
            isDelegatedCondition(
              token.condition
            )
        });

        continue;
      }


      if (
        token.close &&
        stack.length
      ) {
        const opened =
          stack.pop();


        if (
          opened.delegated
        ) {
          /*
           * 如果外層已經是委派區塊，
           * 內層不必另外建立 range。
           */
          const hasDelegatedParent =
            stack.some(
              item =>
                item.delegated
            );


          if (
            !hasDelegatedParent
          ) {
            ranges.push({
              start:
                opened.start,

              end:
                token.end
            });
          }
        }
      }
    }


    if (!ranges.length) {
      return {
        source:
          input,

        restore(value) {
          return String(
            value == null
              ? ""
              : value
          );
        }
      };
    }


    ranges.sort(
      (a, b) =>
        a.start -
        b.start
    );


    const blocks =
      [];

    let output =
      "";

    let cursor =
      0;


    ranges.forEach(
      range => {
        output +=
          input.slice(
            cursor,
            range.start
          );


        const index =
          blocks.length;


        blocks.push(
          input.slice(
            range.start,
            range.end
          )
        );


        output +=
          "@@FH_IFBLOCK_DELEGATED_" +
          index +
          "@@";


        cursor =
          range.end;
      }
    );


    output +=
      input.slice(
        cursor
      );


    return {
      source:
        output,

      restore(value) {
        return String(
          value == null
            ? ""
            : value
        ).replace(
          /@@FH_IFBLOCK_DELEGATED_(\d+)@@/g,

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
              blocks[
                index
              ] != null
            )
              ? blocks[
                  index
                ]
              : whole;
          }
        );
      }
    };
  }


  // =====================================================
  // [如果] 區塊解析器
  // =====================================================

  function processIfBlocks(
    source
  ) {
    source =
      String(
        source == null
          ? ""
          : source
      );


    const delegated =
      protectDelegatedBlocks(
        source
      );


    source =
      delegated.source;


    const tokenRegex =
      /\[(如果|if)\s*:\s*([^\]]+?)\]|\[(否則|else)\]|\[\/(如果|if)\]/gi;


    const stack =
      [];

    let output =
      "";

    let cursor =
      0;

    let match;


    function currentVisible() {
      if (!stack.length) {
        return true;
      }


      const top =
        stack[
          stack.length -
          1
        ];


      return (
        top.parentVisible &&
        (
          top.inElse
            ? !top.passed
            : top.passed
        )
      );
    }


    while (
      (
        match =
          tokenRegex.exec(
            source
          )
      )
    ) {
      const content =
        source.slice(
          cursor,
          match.index
        );


      if (
        currentVisible()
      ) {
        output +=
          content;
      }


      // -------------------------------
      // [如果:條件]
      // -------------------------------
      if (match[1]) {
        const parentVisible =
          currentVisible();


        const condition =
          normalizeText(
            match[2]
          );


        const passed =
          parentVisible
            ? checkCondition(
                condition
              )
            : false;


        stack.push({
          condition:
            condition,

          passed:
            passed,

          inElse:
            false,

          parentVisible:
            parentVisible
        });
      }


      // -------------------------------
      // [否則]
      // -------------------------------
      else if (
        match[3]
      ) {
        if (
          !stack.length
        ) {
          console.warn(
            "[If Block] 發現沒有對應 [如果] 的 [否則]"
          );

        } else {
          const top =
            stack[
              stack.length -
              1
            ];


          if (
            top.inElse
          ) {
            console.warn(
              "[If Block] 同一個 [如果] 區塊出現多個 [否則]"
            );
          }


          top.inElse =
            true;
        }
      }


      // -------------------------------
      // [/如果]
      // -------------------------------
      else if (
        match[4]
      ) {
        if (
          !stack.length
        ) {
          console.warn(
            "[If Block] 發現沒有開頭的 [/如果]"
          );

        } else {
          stack.pop();
        }
      }


      cursor =
        tokenRegex.lastIndex;
    }


    const tail =
      source.slice(
        cursor
      );


    if (
      currentVisible()
    ) {
      output +=
        tail;
    }


    if (
      stack.length
    ) {
      console.warn(
        "[If Block] 有 " +
        stack.length +
        " 個 [如果] 缺少 [/如果]"
      );
    }


    return delegated.restore(
      output
    );
  }



  // =====================================================
  // Adventure 狀態變更後安全重畫
  //
  // 傷害扣 HP、回復 HP、其他橋接器可能在本次
  // applyAdventure() 後半段才改變 values。
  // If Block 在前半段已經判斷過，因此需要下一輪
  // renderAdventure() 才能以新值重新判斷。
  //
  // 這裡提供統一事件：
  // firehaha:adventure-state-changed
  //
  // 並做 requestAnimationFrame + running 防護，
  // 避免重畫遞迴。
  // =====================================================

  let refreshPending =
    false;

  let refreshRunning =
    false;


  function requestAdventureRefresh(
    reason
  ) {
    if (
      refreshPending ||
      refreshRunning
    ) {
      return false;
    }


    refreshPending =
      true;


    const run =
      function() {
        refreshPending =
          false;


        if (
          refreshRunning
        ) {
          return;
        }


        refreshRunning =
          true;


        try {
          if (
            typeof renderAdventure ===
              "function"
          ) {
            renderAdventure();
          }

        } catch (error) {
          console.warn(
            "[If Block] 狀態變更後重新判斷失敗：",
            reason || "",
            error
          );

        } finally {
          refreshRunning =
            false;
        }
      };


    if (
      typeof requestAnimationFrame ===
        "function"
    ) {
      requestAnimationFrame(
        run
      );

    } else {
      setTimeout(
        run,
        0
      );
    }


    return true;
  }


  document.addEventListener(
    "firehaha:adventure-state-changed",

    function(event) {
      const detail =
        event &&
        event.detail
          ? event.detail
          : {};

      requestAdventureRefresh(
        detail.reason ||
        "adventure-state-changed"
      );
    }
  );


  // =====================================================
  // 原生 Adventure 狀態同步補丁
  //
  // [增加] / [減少] / [數值] / [屬性] / [技能]
  // 等真正的狀態變更，是 originalApplyAdventure()
  // 裡面才發生。
  //
  // If Block 本身在它之前就已經判斷過一次，
  // 所以第一次判斷天然可能使用「舊值」。
  //
  // 解法：
  // 1. originalApplyAdventure() 前做狀態快照
  // 2. originalApplyAdventure() 後再做一次
  // 3. 若核心 RPG 狀態真的變了，安全重畫一次
  //
  // 原生 Adventure 自己已有 page/applied 防重複機制，
  // 第二次 render 不會再把同一頁 [增加]/[減少] 重複套用。
  // =====================================================

  function stableCloneForCompare(
    value
  ) {
    try {
      return JSON.stringify(
        value == null
          ? null
          : value
      );
    } catch (error) {
      return "";
    }
  }


  function adventureStateSnapshot() {
    const adventure =
      getAdventure();

    if (!adventure) {
      return "";
    }


    /*
     * 只監看會影響一般 If Block 的持久狀態。
     *
     * 不監看 dice / damage 動畫資料，
     * 避免骰子動畫每一小步都要求重畫。
     */
    return stableCloneForCompare({
      items:
        Array.isArray(
          adventure.items
        )
          ? adventure.items
          : [],

      flags:
        Array.isArray(
          adventure.flags
        )
          ? adventure.flags
          : [],

      values:
        adventure.values ||
        {},

      attributes:
        adventure.attributes ||
        {},

      modifiers:
        adventure.modifiers ||
        {},

      skills:
        adventure.skills ||
        {},

      skillModifiers:
        adventure.skillModifiers ||
        {},

      quests:
        adventure.quests ||
        {},

      names:
        adventure.names ||
        {}
    });
  }


  function notifyCoreAdventureChanged(
    before,
    after
  ) {
    if (
      before === after
    ) {
      return false;
    }


    /*
     * 統一事件：其他橋接器也可以監聽。
     */
    try {
      document.dispatchEvent(
        new CustomEvent(
          "firehaha:adventure-state-changed",
          {
            detail: {
              reason:
                "native-adventure-mutation",

              source:
                "official.if-block",

              at:
                Date.now()
            }
          }
        )
      );

      return true;

    } catch (error) {
      /*
       * CustomEvent 若受特殊環境限制，
       * 直接呼叫本插件 refresh 當保底。
       */
      return requestAdventureRefresh(
        "native-adventure-mutation"
      );
    }
  }


  // =====================================================
  // 公開 API
  // =====================================================

  window.FirehahaIfBlock = {
    version:
      "1.0.1",

    check:
      checkCondition,

    process:
      processIfBlocks,

    compare:
      compareNumbers,

    /*
     * Console 可直接測：
     * FirehahaIfBlock.test("數值:HP|LE|0")
     */
    test(condition) {
      const normalized =
        normalizeText(
          condition
        );

      return {
        condition:
          normalized,

        result:
          checkCondition(
            normalized
          )
      };
    },

    normalizeOperator:
      normalizeOperator,

    decodeHtmlEntities:
      decodeHtmlEntities,

    getNumericSource:
      getNumericSource,

    refresh:
      requestAdventureRefresh,

    snapshot:
      adventureStateSnapshot,

    /*
     * official.if-block 專用運算元。
     * 其他插件若需要引用，不必自行猜字串。
     */
    operators:
      Object.freeze({
        GE: ">=",
        LE: "<=",
        GT: ">",
        LT: "<",
        EQ: "=",
        NE: "!="
      }),

    delegatedPrefixes:
      delegatedPrefixes.slice()
  };


  // =====================================================
  // applyAdventure 包裝
  //
  // 必須先裁掉失敗分支，
  // 否則失敗區塊裡的 [增加] / [減少] / [取得]
  // 仍可能被原生 Adventure 執行。
  // =====================================================

  const originalApplyAdventure =
    applyAdventure;


  applyAdventure =
    function(page) {
      try {
        const originalContent =
          page &&
          page.content != null
            ? String(
                page.content
              )
            : "";


        const filteredContent =
          processIfBlocks(
            originalContent
          );


        const filteredPage =
          Object.assign(
            {},
            page,
            {
              content:
                filteredContent
            }
          );


        /*
         * If Block 已使用「目前狀態」裁好第一次分支。
         * 接下來原生 Adventure 可能執行：
         *
         * [數值]
         * [增加]
         * [減少]
         * [取得]
         * [失去]
         * [旗幟]
         * [取消旗幟]
         * [屬性]
         * [修正值]
         * [技能]
         * [技能修正值]
         * [任務]
         *
         * 因此執行前後各抓一次快照。
         */
        const stateBefore =
          adventureStateSnapshot();


        const html =
          originalApplyAdventure(
            filteredPage
          );


        const stateAfter =
          adventureStateSnapshot();


        if (
          stateBefore !==
          stateAfter
        ) {
          notifyCoreAdventureChanged(
            stateBefore,
            stateAfter
          );
        }


        return html;


      } catch (error) {
        console.warn(
          "[If Block] 處理頁面失敗",
          error
        );


        return originalApplyAdventure(
          page
        );
      }
    };

})();
`

    const removeTransform =
      api.registerReaderTransform(
        "if-block",

        function (html) {
          html = String(
            html == null ? "" : html
          );

          const marker =
            "function renderAdventure(){";

          if (!html.includes(marker)) {
            console.warn(
              "[If Block] 找不到閱讀器插入位置"
            );

            return html;
          }

          return html.replace(
            marker,
            patchCode + "\n" + marker
          );
        },

        /*
         * 放在目前顯示、名稱與自動跳轉插件之後，
         * 讓 If Block 成為 applyAdventure 的外層入口，
         * 先裁掉不成立的內容。
         */
        260
      );

    api.toast(
      "如果條件區塊已啟用"
    );

    return function cleanup() {
      removeTransform();
    };
  }
});