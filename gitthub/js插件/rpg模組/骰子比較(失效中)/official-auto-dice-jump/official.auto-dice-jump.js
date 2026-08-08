// @firehaha-plugin {"id":"official.auto-dice-jump","name":"自動擲骰跳轉","version":"1.0.1","author":"Firehaha","description":"沿用主程式原生漂亮骰子，自動擲骰後依總值或檢定結果跳轉，並支援新遊戲完整重置"}

FirehahaPlugins.register({
  id: "official.auto-dice-jump",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha Auto Dice Jump 1.0.1 - native dice expanded */
(function () {
  "use strict";

  if (window.__firehahaAutoDiceJumpInstalled) return;
  window.__firehahaAutoDiceJumpInstalled = true;

  const executedRules = new Set();
  const pendingTimers = new Set();

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalize(value) {
    return String(value == null ? "" : value)
      .replace(/：/g, ":")
      .replace(/｜/g, "|")
      .replace(/＋/g, "+")
      .replace(/[－−]/g, "-")
      .replace(/＞/g, ">")
      .replace(/＜/g, "<")
      .replace(/＝/g, "=");
  }

  function normalizeSourceName(value) {
    return clean(normalize(value))
      .replace(/^(?:屬性|技能|attribute|skill)\s*:/i, "");
  }

  function normalizeRule(value) {
    const rule = clean(normalize(value)).toLowerCase().replace(/\s+/g, " ");

    if (rule === ">=" || rule === "至少" || rule === "以上" ||
        rule === "at least" || rule === "greater than or equal" ||
        rule === "greater than or equal to" ||
        rule === "以上" || rule === "以上なら") return ">=";

    if (rule === "<=" || rule === "至多" || rule === "以下" ||
        rule === "at most" || rule === "less than or equal" ||
        rule === "less than or equal to" ||
        rule === "以下なら") return "<=";

    if (rule === ">" || rule === "超過" || rule === "大於" ||
        rule === "greater than" || rule === "より大きい") return ">";

    if (rule === "<" || rule === "未滿" || rule === "小於" ||
        rule === "less than" || rule === "未満") return "<";

    if (rule === "=" || rule === "==" || rule === "等於" ||
        rule === "equal" || rule === "equal to" ||
        rule === "等しい") return "=";

    if (rule === "!=" || rule === "<>" || rule === "不等於" ||
        rule === "not equal" || rule === "not equal to" ||
        rule === "等しくない") return "!=";

    return clean(normalize(value));
  }

  function escapeAttribute(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function toPage(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : 0;
  }

  function toDelay(value) {
    const number = Number(value);
    return Number.isFinite(number)
      ? Math.max(0, Math.min(60000, number))
      : 0;
  }

  function findPage(pageNumber) {
    const index = Number(pageNumber) - 1;

    if (
      !Array.isArray(pages) ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= pages.length
    ) {
      return null;
    }

    return pages[index] || null;
  }

  function compare(actual, operator, expected) {
    const op = normalizeRule(operator);

    if (op === ">") return actual > expected;
    if (op === ">=") return actual >= expected;
    if (op === "<") return actual < expected;
    if (op === "<=") return actual <= expected;
    if (op === "=" || op === "==") return actual === expected;
    if (op === "!=" || op === "<>") return actual !== expected;

    return false;
  }

  function numericResult(value) {
    if (value && typeof value === "object") {
      if (Number.isFinite(Number(value.total))) return Number(value.total);
      if (Number.isFinite(Number(value.value))) return Number(value.value);
      if (Number.isFinite(Number(value.successes))) return Number(value.successes);
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function schedule(callback, delay) {
    const timer = setTimeout(function () {
      pendingTimers.delete(timer);
      callback();
    }, delay);

    pendingTimers.add(timer);
    return timer;
  }

  function jumpTo(pageNumber, delay) {
    const target = findPage(pageNumber);

    if (!target) {
      console.warn("[Auto Dice Jump] 找不到第 " + pageNumber + " 頁");
      return false;
    }

    schedule(function () {
      try {
        if (typeof show === "function") {
          show(target.id);
        }
      } catch (error) {
        console.warn("[Auto Dice Jump] 跳轉失敗", error);
      }
    }, Math.max(850, toDelay(delay)));

    return true;
  }

  function currentAdventure() {
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

  /*
   * -----------------------------------------------------
   * 原生骰資料解析
   * -----------------------------------------------------
   *
   * 舊版直接用 "屬性:力量" 當 adventure.dice key。
   * 但主程式可能實際保存成：
   *   力量
   *   屬性:力量
   *   __last
   * 或把名稱放在 value.attribute。
   *
   * 這裡全部相容。
   */
  function nativeDiceEntries() {
    const adventure = currentAdventure();
    if (!adventure || !adventure.dice) return [];
    return Object.entries(adventure.dice);
  }

  function matchesDiceName(key, value, requested) {
    const target = normalizeSourceName(requested);
    if (!target) return true;

    const data =
      value && typeof value === "object"
        ? value
        : { attribute: key };

    const rawKey = clean(key);
    const attribute = clean(data.attribute || "");
    const candidates = [
      rawKey,
      attribute,
      normalizeSourceName(rawKey),
      normalizeSourceName(attribute)
    ].filter(Boolean);

    return candidates.includes(target) ||
      candidates.includes(clean(requested));
  }

  function resolveNativeDice(name) {
    const entries = nativeDiceEntries();
    if (!entries.length) return null;

    const requested = clean(name);

    if (!requested || requested === "__last" || requested === "無") {
      const direct = entries.find(function (pair) {
        return pair[0] === "__last";
      });

      const pair = direct || entries[entries.length - 1];
      if (!pair) return null;

      const total = numericResult(pair[1]);
      return total == null
        ? null
        : { key: pair[0], data: pair[1], total: total };
    }

    for (let i = entries.length - 1; i >= 0; i--) {
      const pair = entries[i];

      if (!matchesDiceName(pair[0], pair[1], requested)) {
        continue;
      }

      const total = numericResult(pair[1]);

      if (total != null) {
        return {
          key: pair[0],
          data: pair[1],
          total: total
        };
      }
    }

    return null;
  }

  function resolveCheck(name) {
    const adventure = currentAdventure();
    const target = clean(name);

    if (!adventure || !adventure.checks || !target) return null;

    const result = adventure.checks[target];
    if (!result) return null;

    const total = numericResult(result);

    return {
      data: result,
      total: total,
      result: clean(result.result)
    };
  }

  function resultSnapshot(marker) {
    const mode = clean(marker.dataset.adjMode);

    if (mode === "check") {
      const resolved = resolveCheck(marker.dataset.adjCheckName);
      return resolved
        ? JSON.stringify({
            result: resolved.result,
            total: resolved.total,
            breakdown: resolved.data && resolved.data.breakdown
          })
        : "";
    }

    const resolved = resolveNativeDice(
      marker.dataset.adjDiceName ||
      marker.dataset.adjDiceKey ||
      ""
    );

    return resolved
      ? JSON.stringify({
          key: resolved.key,
          total: resolved.total,
          breakdown:
            resolved.data &&
            typeof resolved.data === "object"
              ? resolved.data.breakdown
              : "",
          rolls:
            resolved.data &&
            typeof resolved.data === "object"
              ? resolved.data.rolls
              : null
        })
      : "";
  }

  function decideTarget(marker) {
    const successPage = toPage(marker.dataset.adjSuccessPage);
    const failurePage = toPage(marker.dataset.adjFailurePage);

    if (marker.dataset.adjMode === "check") {
      const resolved = resolveCheck(marker.dataset.adjCheckName);

      if (!resolved) return 0;

      const passed = !!(
        resolved.result &&
        resolved.result !== "失敗"
      );

      return passed ? successPage : failurePage;
    }

    const resolved = resolveNativeDice(
      marker.dataset.adjDiceName ||
      marker.dataset.adjDiceKey ||
      ""
    );

    const actual = resolved ? resolved.total : null;
    const expected = Number(marker.dataset.adjExpected);
    const operator = clean(marker.dataset.adjOperator);

    if (
      actual == null ||
      !Number.isFinite(expected) ||
      !operator
    ) {
      return 0;
    }

    return compare(actual, operator, expected)
      ? successPage
      : failurePage;
  }

  function parseDisplayedDiceTotal(button) {
    if (!button) return null;

    const process = button.querySelector(".dice-process");
    if (!process) return null;

    const text = clean(process.textContent);

    if (
      !text ||
      text.includes("點擊") ||
      text.includes("擲骰中")
    ) {
      return null;
    }

    const equals = Array.from(
      text.matchAll(/[＝=]\s*(-?\d+(?:\.\d+)?)/g)
    );

    if (equals.length) {
      return Number(equals[equals.length - 1][1]);
    }

    const success = text.match(/成功\s*(-?\d+(?:\.\d+)?)\s*顆/);

    if (success) {
      return Number(success[1]);
    }

    const arrows = Array.from(
      text.matchAll(/→\s*(-?\d+(?:\.\d+)?)/g)
    );

    if (arrows.length) {
      return Number(arrows[arrows.length - 1][1]);
    }

    return null;
  }

  function buttonMatchesSource(button, sourceName) {
    if (!button) return false;

    const target = normalizeSourceName(sourceName);
    if (!target) return true;

    const key = clean(button.dataset.key || "");
    const attribute = clean(button.dataset.attribute || "");
    const checkName = clean(button.dataset.checkName || "");

    const candidates = [
      key,
      attribute,
      checkName,
      normalizeSourceName(key),
      normalizeSourceName(attribute),
      normalizeSourceName(checkName)
    ].filter(Boolean);

    return candidates.includes(target) ||
      candidates.includes(clean(sourceName));
  }

  function findNativeDice(marker) {
    const content =
      marker.closest(".content") ||
      document.getElementById("reader") ||
      document;

    const buttons = Array.from(
      content.querySelectorAll(".story-dice")
    );

    if (!buttons.length) return null;

    const wantedName =
      clean(
        marker.dataset.adjDiceName ||
        marker.dataset.adjCheckName ||
        ""
      );

    /*
     * 優先找 marker 前方且名稱吻合的最後一顆原生骰。
     */
    let candidate = null;

    for (let index = 0; index < buttons.length; index++) {
      const button = buttons[index];

      if (
        wantedName &&
        !buttonMatchesSource(button, wantedName)
      ) {
        continue;
      }

      const position =
        button.compareDocumentPosition(marker);

      if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
        candidate = button;
      }
    }

    if (candidate) return candidate;

    /*
     * 找不到前方吻合項目時，名稱吻合即可。
     */
    if (wantedName) {
      const named = buttons.find(function (button) {
        return buttonMatchesSource(button, wantedName);
      });

      if (named) return named;
    }

    /*
     * 最後保留舊版行為。
     */
    return buttons[0] || null;
  }

  function waitForResult(marker, button, beforeSnapshot) {
    const startedAt = Date.now();

    function poll() {
      const snapshot = resultSnapshot(marker);
      const elapsed = Date.now() - startedAt;

      /*
       * 主要判斷：memorySave 的結果有更新。
       */
      if (
        snapshot &&
        snapshot !== beforeSnapshot &&
        elapsed >= 500
      ) {
        const targetPage = decideTarget(marker);
        const delay = toDelay(marker.dataset.adjDelay);

        if (targetPage > 0) {
          jumpTo(targetPage, delay);
        } else {
          console.warn(
            "[Auto Dice Jump] 骰子已有結果，但沒有有效的目標頁"
          );
        }

        return;
      }

      /*
       * 保底：有些主程式版本沒有把名稱正確存入 dice key，
       * 但畫面上的原生骰已經顯示結果。
       */
      const domValue = parseDisplayedDiceTotal(button);

      if (
        Number.isFinite(domValue) &&
        elapsed >= 700 &&
        marker.dataset.adjMode !== "check"
      ) {
        const expected = Number(marker.dataset.adjExpected);
        const operator = clean(marker.dataset.adjOperator);

        if (Number.isFinite(expected) && operator) {
          const targetPage = compare(domValue, operator, expected)
            ? toPage(marker.dataset.adjSuccessPage)
            : toPage(marker.dataset.adjFailurePage);

          if (targetPage > 0) {
            jumpTo(
              targetPage,
              toDelay(marker.dataset.adjDelay)
            );
            return;
          }
        }
      }

      if (elapsed > 8000) {
        console.warn("[Auto Dice Jump] 等待原生骰子結果逾時");
        return;
      }

      schedule(poll, 100);
    }

    schedule(poll, 100);
  }

  function executeMarker(marker) {
    if (!marker) return false;

    const rawRule = clean(marker.dataset.adjRule);
    const sourceId =
      clean(marker.dataset.adjSource) ||
      (typeof currentId !== "undefined" ? currentId : "");

    const key = [sourceId, rawRule].join("::");

    if (executedRules.has(key)) {
      marker.remove();
      return false;
    }

    const button = findNativeDice(marker);

    if (!button) {
      console.warn("[Auto Dice Jump] 找不到對應的原生骰子按鈕");
      marker.remove();
      return false;
    }

    /*
     * 新版不再硬性排除 story-damage / story-success-dice / story-fate。
     * 只要它仍是 .story-dice 且能產生可讀結果，就允許執行。
     */
    executedRules.add(key);

    const beforeSnapshot = resultSnapshot(marker);

    marker.remove();

    schedule(function () {
      try {
        button.click();
        waitForResult(marker, button, beforeSnapshot);
      } catch (error) {
        console.warn("[Auto Dice Jump] 自動擲骰失敗", error);
      }
    }, 120);

    return true;
  }

  window.bindFirehahaAutoDiceJump = function () {
    const markers = Array.from(
      document.querySelectorAll(".firehaha-auto-dice-jump")
    );

    if (!markers.length) return;

    /*
     * 每頁仍只自動執行第一條，避免多顆骰同時自動點擊造成跳頁競態。
     */
    executeMarker(markers[0]);

    markers.slice(1).forEach(function (marker) {
      marker.remove();
    });
  };

  function makeMarker(page, rule, attributes) {
    return (
      '<span class="firehaha-auto-dice-jump"' +
      ' data-adj-rule="' + escapeAttribute(rule) + '"' +
      ' data-adj-source="' +
      escapeAttribute(page && page.id ? page.id : "") +
      '"' +
      attributes +
      ' hidden></span>'
    );
  }

  function makeDiceMarker(
    page,
    rule,
    diceName,
    operator,
    expected,
    successPage,
    failurePage,
    delay
  ) {
    return makeMarker(
      page,
      rule,
      ' data-adj-mode="dice"' +
      ' data-adj-dice-name="' + escapeAttribute(diceName || "") + '"' +
      ' data-adj-dice-key="' + escapeAttribute(diceName || "__last") + '"' +
      ' data-adj-operator="' + escapeAttribute(normalizeRule(operator)) + '"' +
      ' data-adj-expected="' + escapeAttribute(expected) + '"' +
      ' data-adj-success-page="' +
      escapeAttribute(successPage === "-" ? "0" : successPage) +
      '"' +
      ' data-adj-failure-page="' +
      escapeAttribute(failurePage === "-" ? "0" : failurePage) +
      '"' +
      ' data-adj-delay="' + escapeAttribute(delay || "0") + '"'
    );
  }

  /*
   * -----------------------------------------------------
   * applyAdventure 包裝
   * -----------------------------------------------------
   */
  if (
    typeof applyAdventure === "function" &&
    !applyAdventure.__firehahaAutoDiceJumpWrapped
  ) {
    const originalApplyAdventure = applyAdventure;

    applyAdventure = function (page) {
      const clonedPage = Object.assign({}, page || {});
      let source = String(clonedPage.content || "");

      /*
       * A. 自動建立原生骰並擲骰後跳轉
       *
       * 舊版：
       * [自動骰跳轉:1d20|屬性:力量|>=|15|7|8|1200]
       *
       * 新增文字比較：
       * [自動骰跳轉:1d20|屬性:力量|至少|15|7|8|1200]
       */
      source = source.replace(
        /\[(?:自動骰跳轉|autodicejump)\s*:\s*([^\]|]+?)\s*\|\s*([^\]|]*?)\s*\|\s*([^\]|]+?)\s*\|\s*(-?\d+(?:\.\d+)?)\s*\|\s*(\d+|-)\s*\|\s*(\d+|-)(?:\s*\|\s*(\d+))?\s*\]/gi,
        function (
          full,
          formula,
          diceSource,
          operator,
          expected,
          successPage,
          failurePage,
          delay
        ) {
          formula = clean(normalize(formula));
          diceSource = clean(normalize(diceSource));
          operator = normalizeRule(operator);

          if (!["", ">", ">=", "<", "<=", "=", "==", "!=", "<>"].includes(operator)) {
            return full;
          }

          const diceMatch =
            formula.match(/^(\d*)d(\d+)([+-]\d+)?$/i);

          if (!diceMatch) return full;

          const count = diceMatch[1] || "";
          const sides = diceMatch[2];
          const bonus = diceMatch[3] || "";

          const nativeTag =
            "[骰子:" +
            count +
            "d" +
            sides +
            bonus +
            (diceSource && diceSource !== "無"
              ? ":" + diceSource
              : "") +
            "]";

          const diceName =
            diceSource && diceSource !== "無"
              ? diceSource
              : "__last";

          const rule = [
            "auto",
            formula,
            diceSource,
            operator,
            expected,
            successPage,
            failurePage,
            delay || "0"
          ].join("|");

          return (
            nativeTag +
            makeDiceMarker(
              page,
              rule,
              diceName,
              operator,
              expected,
              successPage,
              failurePage,
              delay
            )
          );
        }
      );

      /*
       * B. 直接使用正文中「已存在的原生骰子」自動擲骰並跳轉
       *
       * 用法：
       *
       * [骰子:1d20:力量]
       * [原生骰跳轉:力量|至少|15|7|8|1200]
       *
       * 也可：
       * [原生骰跳轉:力量|>=|15|7|8|1200]
       *
       * 第一欄填骰子名稱 / 屬性名稱。
       * 留空或填 __last 代表最近一顆原生骰。
       */
      source = source.replace(
        /\[(?:原生骰跳轉|原生骰子跳轉|nativedicejump)\s*:\s*([^|\]]*?)\s*\|\s*([^|\]]+?)\s*\|\s*(-?\d+(?:\.\d+)?)\s*\|\s*(\d+|-)\s*\|\s*(\d+|-)(?:\s*\|\s*(\d+))?\s*\]/gi,
        function (
          full,
          diceName,
          operator,
          expected,
          successPage,
          failurePage,
          delay
        ) {
          diceName = clean(normalize(diceName)) || "__last";
          operator = normalizeRule(operator);

          if (![">", ">=", "<", "<=", "=", "==", "!=", "<>"].includes(operator)) {
            return full;
          }

          const rule = [
            "native",
            diceName,
            operator,
            expected,
            successPage,
            failurePage,
            delay || "0"
          ].join("|");

          return makeDiceMarker(
            page,
            rule,
            diceName,
            operator,
            expected,
            successPage,
            failurePage,
            delay
          );
        }
      );

      /*
       * C. 原生檢定
       *
       * [自動檢定跳轉:開鎖|1d100|<=|技能:開鎖|7|8|1200]
       */
      source = source.replace(
        /\[(?:自動檢定跳轉|autocheckjump)\s*:\s*([^\]|]+?)\s*\|\s*([^\]|]+?)\s*\|\s*(>=|<=|!=|<>|=|>|<)\s*\|\s*([^\]|]+?)\s*\|\s*(\d+|-)\s*\|\s*(\d+|-)(?:\s*\|\s*(\d+))?\s*\]/gi,
        function (
          full,
          checkName,
          formula,
          operator,
          target,
          successPage,
          failurePage,
          delay
        ) {
          checkName = clean(checkName);
          formula = clean(normalize(formula));
          target = clean(normalize(target));

          const diceMatch =
            formula.match(/^(\d*)d(\d+)([+-]\d+)?$/i);

          if (!checkName || !diceMatch || !target) return full;

          const count = diceMatch[1] || "";
          const sides = diceMatch[2];
          const bonus = diceMatch[3] || "";

          const nativeTag =
            "[檢定:" +
            checkName +
            ":" +
            count +
            "d" +
            sides +
            bonus +
            ":" +
            operator +
            ":" +
            target +
            "]";

          const rule = [
            "check",
            checkName,
            formula,
            operator,
            target,
            successPage,
            failurePage,
            delay || "0"
          ].join("|");

          return (
            nativeTag +
            makeMarker(
              page,
              rule,
              ' data-adj-mode="check"' +
              ' data-adj-check-name="' +
              escapeAttribute(checkName) +
              '"' +
              ' data-adj-success-page="' +
              escapeAttribute(successPage === "-" ? "0" : successPage) +
              '"' +
              ' data-adj-failure-page="' +
              escapeAttribute(failurePage === "-" ? "0" : failurePage) +
              '"' +
              ' data-adj-delay="' + escapeAttribute(delay || "0") + '"'
            )
          );
        }
      );

      clonedPage.content = source;
      return originalApplyAdventure.call(this, clonedPage);
    };

    applyAdventure.__firehahaAutoDiceJumpWrapped = true;
    applyAdventure.__firehahaAutoDiceJumpOriginal =
      originalApplyAdventure;
  }

  window.FirehahaAutoDiceJump = {
    version: "1.0.1",

    reset: function () {
      pendingTimers.forEach(function (timer) {
        clearTimeout(timer);
      });

      pendingTimers.clear();
      executedRules.clear();
    },

    clearHistory: function () {
      executedRules.clear();
    },

    jumpToPage: jumpTo,

    compare: compare,

    resolveNativeDice: resolveNativeDice
  };
})();
`

    const removeTransform = api.registerReaderTransform(
      "auto-dice-jump",
      function (html) {
        html = String(html == null ? "" : html);

        const insertionMarker = "function renderAdventure(){";

        if (!html.includes(insertionMarker)) {
          console.warn(
            "[Auto Dice Jump] 找不到閱讀器插入位置"
          );
          return html;
        }

        html = html.replace(
          insertionMarker,
          patchCode + "\n" + insertionMarker
        );

        /*
         * 原生 show() 建立漂亮骰子並綁定事件後，
         * 再執行自動擲骰。
         */
        html = html.replace(
          /bindStoryDice\(\);/g,
          "bindStoryDice();" +
          "if(typeof bindFirehahaAutoDiceJump==='function')" +
          "bindFirehahaAutoDiceJump();"
        );

        return html;
      },
      255
    );

    api.toast("自動擲骰跳轉已啟用");

    return function cleanup() {
      removeTransform();
    };
  }
});
