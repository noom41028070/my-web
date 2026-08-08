// @firehaha-plugin {"id":"official.auto-dice-jump","name":"自動擲骰跳轉","version":"1.0.1","author":"Firehaha","description":"沿用主程式原生漂亮骰子，自動擲骰後依總值或檢定結果跳轉，並支援新遊戲完整重置"}

FirehahaPlugins.register({
  id: "official.auto-dice-jump",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha Auto Dice Jump 1.0.0 */
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
    operator = normalize(operator);

    if (operator === ">") return actual > expected;
    if (operator === ">=") return actual >= expected;
    if (operator === "<") return actual < expected;
    if (operator === "<=") return actual <= expected;
    if (operator === "=" || operator === "==") return actual === expected;
    if (operator === "!=" || operator === "<>") return actual !== expected;

    return false;
  }

  function numericResult(value) {
    if (value && typeof value === "object") {
      if (Number.isFinite(Number(value.total))) return Number(value.total);
      if (Number.isFinite(Number(value.value))) return Number(value.value);
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
      console.warn(
        "[Auto Dice Jump] 找不到第 " + pageNumber + " 頁"
      );
      return false;
    }

    /*
     * 原生骰子完成動畫後，還會重新整理目前頁面。
     * 因此至少保留 850ms，避免跳頁後又被拉回原頁。
     */
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
    return (
      typeof memorySave !== "undefined" &&
      memorySave &&
      memorySave.adventure
    )
      ? memorySave.adventure
      : null;
  }

  function resultSnapshot(marker) {
    const adventure = currentAdventure();
    if (!adventure) return "";

    const mode = marker.dataset.adjMode;

    if (mode === "check") {
      const name = clean(marker.dataset.adjCheckName);
      const result = adventure.checks && adventure.checks[name];

      return result
        ? JSON.stringify({
            result: result.result,
            total: result.total,
            breakdown: result.breakdown
          })
        : "";
    }

    const key = clean(marker.dataset.adjDiceKey) || "__last";
    const result = adventure.dice && adventure.dice[key];

    return result
      ? JSON.stringify({
          total: result.total,
          breakdown: result.breakdown,
          rolls: result.rolls
        })
      : "";
  }

  function decideTarget(marker) {
    const adventure = currentAdventure();
    if (!adventure) return 0;

    const successPage = toPage(marker.dataset.adjSuccessPage);
    const failurePage = toPage(marker.dataset.adjFailurePage);

    if (marker.dataset.adjMode === "check") {
      const name = clean(marker.dataset.adjCheckName);
      const result = adventure.checks && adventure.checks[name];
      const passed = !!(
        result &&
        result.result &&
        result.result !== "失敗"
      );

      return passed ? successPage : failurePage;
    }

    const key = clean(marker.dataset.adjDiceKey) || "__last";
    const result = adventure.dice && adventure.dice[key];
    const actual = numericResult(result);
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

  function findNativeDice(marker) {
    const content =
      marker.closest(".content") ||
      document.getElementById("reader") ||
      document;

    const buttons = Array.from(
      content.querySelectorAll(".story-dice")
    );

    if (!buttons.length) return null;

    /*
     * 標記會緊接在插件產生的原生骰子後面。
     * 優先尋找標記之前最後一顆骰子。
     */
    let candidate = null;

    for (let index = 0; index < buttons.length; index++) {
      const position =
        buttons[index].compareDocumentPosition(marker);

      if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
        candidate = buttons[index];
      }
    }

    return candidate || buttons[0];
  }

  function waitForResult(marker, button, beforeSnapshot) {
    const startedAt = Date.now();

    function poll() {
      if (!document.documentElement.contains(button)) {
        /*
         * 原生骰子會重新渲染頁面。
         * 即使舊按鈕已離開 DOM，冒險紀錄仍保留結果。
         */
      }

      const snapshot = resultSnapshot(marker);
      const elapsed = Date.now() - startedAt;

      if (
        snapshot &&
        snapshot !== beforeSnapshot &&
        elapsed >= 700
      ) {
        const targetPage = decideTarget(marker);
        const delay = toDelay(marker.dataset.adjDelay);

        if (targetPage > 0) {
          jumpTo(targetPage, delay);
        } else {
          console.warn(
            "[Auto Dice Jump] 結果成立，但沒有有效的目標頁"
          );
        }

        return;
      }

      if (elapsed > 6000) {
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
      console.warn("[Auto Dice Jump] 找不到原生骰子按鈕");
      marker.remove();
      return false;
    }

    if (
      button.classList.contains("story-damage") ||
      button.classList.contains("story-success-dice") ||
      button.classList.contains("story-fate")
    ) {
      console.warn(
        "[Auto Dice Jump] 此版本只支援原生骰子與原生檢定"
      );
      marker.remove();
      return false;
    }

    executedRules.add(key);

    const beforeSnapshot = resultSnapshot(marker);

    /*
     * 標記先移除，畫面只留下主程式漂亮的原生骰子。
     */
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
     * 同一頁只執行正文中第一條自動擲骰跳轉規則。
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

  /*
   * 先把組合標籤轉成主程式原生標籤，
   * 再交給原生 applyAdventure() 建立漂亮骰子。
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
       * 普通骰子：
       * [自動骰跳轉:1d20|屬性:力量|>=|15|7|8|1200]
       *
       * 骰式｜來源｜運算子｜門檻｜成功頁｜失敗頁｜延遲
       */
      source = source.replace(
        /\[(?:自動骰跳轉|autodicejump)\s*:\s*([^\]|]+?)\s*\|\s*([^\]|]*?)\s*\|\s*(>=|<=|!=|<>|=|>|<)\s*\|\s*(-?\d+(?:\.\d+)?)\s*\|\s*(\d+|-)\s*\|\s*(\d+|-)(?:\s*\|\s*(\d+))?\s*\]/gi,
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

          const key =
            diceSource && diceSource !== "無"
              ? diceSource
              : "__last";

          const rule = [
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
            makeMarker(
              page,
              rule,
              ' data-adj-mode="dice"' +
              ' data-adj-dice-key="' + escapeAttribute(key) + '"' +
              ' data-adj-operator="' + escapeAttribute(operator) + '"' +
              ' data-adj-expected="' + escapeAttribute(expected) + '"' +
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

      /*
       * 原生檢定：
       * [自動檢定跳轉:開鎖|1d100|<=|技能:開鎖|7|8|1200]
       *
       * 名稱｜骰式｜運算子｜目標｜成功頁｜失敗頁｜延遲
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

    jumpToPage: jumpTo
  };
})();
`;

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
