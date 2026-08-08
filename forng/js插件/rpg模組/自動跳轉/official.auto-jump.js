// @firehaha-plugin {"id":"official.auto-jump","name":"自動跳轉","version":"1.0.1","author":"Firehaha","description":"支援無條件與條件式自動跳轉，可依頁碼與延遲時間進入指定頁面，並支援新遊戲完整重置"}

FirehahaPlugins.register({
  id: "official.auto-jump",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha Auto Jump */
(function () {
  "use strict";

  if (window.__firehahaAutoJumpInstalled) {
    return;
  }

  window.__firehahaAutoJumpInstalled = true;

  /*
   * 記錄本次閱讀期間已執行的規則，
   * 避免第 3 頁與第 5 頁互相無限跳轉。
   */
  const executedRules = new Set();

  let pendingTimer = null;

  function clean(value) {
    return String(
      value == null ? "" : value
    ).trim();
  }

  function toNumber(value, fallback) {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : fallback;
  }

  function escapeAttribute(value) {
    return String(
      value == null ? "" : value
    )
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function normalizeColon(value) {
    return String(value || "")
      .replace(/：/g, ":");
  }

  const conditionKinds = [
    "持有",
    "物品",
    "item",

    "未持有",
    "not-item",

    "旗幟",
    "發生",
    "flag",

    "未發生",
    "not-flag",

    "數值",
    "value",

    "屬性",
    "attribute",

    "技能",
    "skill",

    "骰子",
    "dice",

    "傷害",
    "damage",

    "成功骰",
    "success-dice",

    "檢定",
    "check",

    "任務",
    "quest"
  ];

  function isConditionKind(value) {
    value = clean(value).toLowerCase();

    return conditionKinds.some(
      function (kind) {
        return kind.toLowerCase() === value;
      }
    );
  }

  /*
   * 支援：
   *
   * [自動跳轉:7]
   * [自動跳轉:7:1500]
   *
   * [自動跳轉:旗幟:拿到鑰匙:7]
   * [自動跳轉:數值:HP<=0:12]
   * [自動跳轉:數值:HP<=0:12:1500]
   */
  function parseRule(rawBody) {
    const body =
      normalizeColon(rawBody);

    const parts = body
      .split(":")
      .map(clean)
      .filter(function (part) {
        return part !== "";
      });

    if (!parts.length) {
      return null;
    }

    /*
     * 無條件：
     * 頁碼
     * 頁碼:延遲
     */
    if (!isConditionKind(parts[0])) {
      const targetPage =
        toNumber(parts[0], 0);

      const delay =
        Math.max(
          0,
          toNumber(parts[1], 0)
        );

      if (targetPage < 1) {
        return null;
      }

      return {
        condition: "",
        targetPage: targetPage,
        delay: delay
      };
    }

    /*
     * 條件式：
     * 類型:條件:頁碼
     * 類型:條件:頁碼:延遲
     */
    if (parts.length < 3) {
      return null;
    }

    const kind =
      parts.shift();

    let delay = 0;

    /*
     * 最後一段若有第四段以上，
     * 視為延遲毫秒。
     */
    if (parts.length >= 3) {
      delay = Math.max(
        0,
        toNumber(
          parts.pop(),
          0
        )
      );
    }

    const targetPage =
      toNumber(
        parts.pop(),
        0
      );

    const conditionValue =
      parts.join(":");

    if (
      !conditionValue ||
      targetPage < 1
    ) {
      return null;
    }

    return {
      condition:
        kind + ":" + conditionValue,

      targetPage: targetPage,

      delay: delay
    };
  }

  function findTargetPage(pageNumber) {
    const index =
      Number(pageNumber) - 1;

    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= pages.length
    ) {
      return null;
    }

    return pages[index] || null;
  }

  function conditionPasses(condition) {
    if (!condition) {
      return true;
    }

    try {
      return typeof hiddenCondition === "function"
        ? hiddenCondition(condition)
        : false;

    } catch (error) {
      console.warn(
        "[Auto Jump] 條件判斷失敗",
        condition,
        error
      );

      return false;
    }
  }

  function performJump(marker) {
    if (!marker) {
      return;
    }

    const rawRule =
      clean(marker.dataset.autoJumpRule);

    const sourceId =
      clean(marker.dataset.autoJumpSource);

    const rule =
      parseRule(rawRule);

    if (!rule) {
      console.warn(
        "[Auto Jump] 無法解析規則：",
        rawRule
      );

      marker.remove();
      return;
    }

    if (!conditionPasses(rule.condition)) {
      marker.remove();
      return;
    }

    const target =
      findTargetPage(
        rule.targetPage
      );

    if (!target) {
      console.warn(
        "[Auto Jump] 找不到第 " +
        rule.targetPage +
        " 頁"
      );

      marker.remove();
      return;
    }

    const ruleKey = [
      sourceId || currentId || "",
      rawRule
    ].join("::");

    if (executedRules.has(ruleKey)) {
      marker.remove();
      return;
    }

    /*
     * 不允許跳到目前頁面本身。
     */
    if (target.id === currentId) {
      console.warn(
        "[Auto Jump] 已阻止跳回目前頁面：",
        rule.targetPage
      );

      executedRules.add(ruleKey);
      marker.remove();
      return;
    }

    executedRules.add(ruleKey);

    marker.remove();

    clearTimeout(pendingTimer);

    pendingTimer = setTimeout(
      function () {
        try {
          if (
            typeof show === "function"
          ) {
            show(target.id);
          }

        } catch (error) {
          console.warn(
            "[Auto Jump] 跳轉失敗",
            error
          );
        }
      },

      Math.min(
        rule.delay,
        60000
      )
    );
  }

  /*
   * 每次頁面完成渲染後執行。
   */
  window.bindFirehahaAutoJump =
    function () {
      const markers =
        document.querySelectorAll(
          ".firehaha-auto-jump"
        );

      if (!markers.length) {
        return;
      }

      /*
       * 同一頁若放多條規則，
       * 依照正文出現順序判斷；
       * 第一個成立的規則會跳轉。
       */
      for (
        let index = 0;
        index < markers.length;
        index++
      ) {
        const marker =
          markers[index];

        const parsed =
          parseRule(
            marker.dataset.autoJumpRule
          );

        if (
          parsed &&
          conditionPasses(
            parsed.condition
          )
        ) {
          performJump(marker);
          break;
        }

        marker.remove();
      }
    };

  const originalApplyAdventure =
    applyAdventure;

  applyAdventure = function (page) {
    let html =
      originalApplyAdventure(page);

    try {
      html = String(html).replace(
        /\[(?:自動跳轉|autojump)\s*:\s*([^\]]+?)\s*\]/gi,

        function (
          full,
          rawRule
        ) {
          return (
            '<span' +
            ' class="firehaha-auto-jump"' +
            ' data-auto-jump-rule="' +
            escapeAttribute(rawRule) +
            '"' +
            ' data-auto-jump-source="' +
            escapeAttribute(
              page && page.id
                ? page.id
                : ""
            ) +
            '"' +
            ' hidden' +
            '></span>'
          );
        }
      );

    } catch (error) {
      console.warn(
        "[Auto Jump] 標籤處理失敗",
        error
      );
    }

    return html;
  };

  /*
   * 提供簡單控制 API。
   */
  window.FirehahaAutoJump = {
    version: "1.0.1",

    reset: function () {
      clearTimeout(pendingTimer);
      pendingTimer = null;
      executedRules.clear();
    },

    clearHistory: function () {
      executedRules.clear();
    },

    jumpToPage: function (
      pageNumber,
      delay
    ) {
      const target =
        findTargetPage(pageNumber);

      if (!target) {
        return false;
      }

      clearTimeout(pendingTimer);

      pendingTimer = setTimeout(
        function () {
          show(target.id);
        },

        Math.max(
          0,
          Number(delay) || 0
        )
      );

      return true;
    }
  };
})();
`;

    const removeTransform =
      api.registerReaderTransform(
        "auto-jump",

        function (html) {
          html = String(
            html == null ? "" : html
          );

          const marker =
            "function renderAdventure(){";

          if (!html.includes(marker)) {
            console.warn(
              "[Auto Jump] 找不到閱讀器插入位置"
            );

            return html;
          }

          html = html.replace(
            marker,
            patchCode + "\n" + marker
          );

          /*
           * 每次 show() 建立新頁面內容後，
           * 原本會執行 bindStoryDice()。
           * 在其後接上自動跳轉檢查。
           */
          html = html.replace(
            /bindStoryDice\(\);/g,

            "bindStoryDice();" +
            "if(typeof bindFirehahaAutoJump==='function')" +
            "bindFirehahaAutoJump();"
          );

          return html;
        },

        250
      );

    api.toast(
      "自動跳轉已啟用"
    );

    return function cleanup() {
      removeTransform();
    };
  }
});
