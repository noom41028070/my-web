// @firehaha-plugin {"id":"official.if-block","name":"如果條件區塊","version":"1.0.0","author":"Firehaha","description":"以 [如果:條件]、[否則]、[/如果] 在同一頁中顯示不同正文，沿用主程式既有條件判斷"}

FirehahaPlugins.register({
  id: "official.if-block",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha If Block */
(function () {
  "use strict";

  if (window.__firehahaIfBlockInstalled) {
    return;
  }

  window.__firehahaIfBlockInstalled = true;

  function clean(value) {
    return String(
      value == null ? "" : value
    ).trim();
  }

  /*
   * 完全沿用主程式的 hiddenCondition()。
   *
   * 因此可使用與 [隱藏:...] 相同的條件：
   *
   * 數值:HP>=5
   * 持有:古老鑰匙
   * 未持有:火把
   * 旗幟:完成任務
   * 屬性:力量>=3
   * 技能:開鎖>=2
   * 任務:主線=完成
   * 檢定:開鎖=成功
   */
  function checkCondition(condition) {
    condition = clean(condition);

    if (!condition) {
      return false;
    }

    try {
      return (
        typeof hiddenCondition === "function" &&
        hiddenCondition(condition)
      );

    } catch (error) {
      console.warn(
        "[If Block] 條件判斷失敗：",
        condition,
        error
      );

      return false;
    }
  }

  /*
   * 區塊資料：
   *
   * {
   *   condition: "數值:HP>=5",
   *   passed: true,
   *   inElse: false,
   *   parentVisible: true
   * }
   */
  function processIfBlocks(source) {
    source = String(
      source == null ? "" : source
    );

    /*
     * 只切割控制標籤，
     * 其他正文與遊戲標籤都原樣保留。
     */
    const tokenRegex =
      /\[(如果|if)\s*:\s*([^\]]+?)\]|\[(否則|else)\]|\[\/(如果|if)\]/gi;

    const stack = [];

    let output = "";
    let cursor = 0;
    let match;

    function currentVisible() {
      if (!stack.length) {
        return true;
      }

      const top =
        stack[stack.length - 1];

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
      (match = tokenRegex.exec(source))
    ) {
      /*
       * 先處理控制標籤前面的普通內容。
       */
      const content =
        source.slice(
          cursor,
          match.index
        );

      if (currentVisible()) {
        output += content;
      }

      /*
       * [如果:條件]
       */
      if (match[1]) {
        const parentVisible =
          currentVisible();

        const condition =
          clean(match[2]);

        /*
         * 父層已經不可見時，
         * 不必真的執行內層判斷。
         */
        const passed =
          parentVisible
            ? checkCondition(condition)
            : false;

        stack.push({
          condition: condition,
          passed: passed,
          inElse: false,
          parentVisible: parentVisible
        });
      }

      /*
       * [否則]
       */
      else if (match[3]) {
        if (!stack.length) {
          console.warn(
            "[If Block] 發現沒有對應 [如果] 的 [否則]"
          );

        } else {
          const top =
            stack[stack.length - 1];

          if (top.inElse) {
            console.warn(
              "[If Block] 同一個 [如果] 區塊出現多個 [否則]"
            );
          }

          top.inElse = true;
        }
      }

      /*
       * [/如果]
       */
      else if (match[4]) {
        if (!stack.length) {
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

    /*
     * 最後一個控制標籤後面的內容。
     */
    const tail =
      source.slice(cursor);

    if (currentVisible()) {
      output += tail;
    }

    if (stack.length) {
      console.warn(
        "[If Block] 有 " +
        stack.length +
        " 個 [如果] 缺少 [/如果]"
      );
    }

    return output;
  }

  /*
   * 提供給其他閱讀器插件使用。
   */
  window.FirehahaIfBlock = {
    version: "1.0.0",

    check: checkCondition,

    process: processIfBlocks
  };

  const originalApplyAdventure =
    applyAdventure;

  applyAdventure = function (page) {
    try {
      /*
       * 必須先處理 [如果]。
       *
       * 不成立區塊裡的：
       * [增加]
       * [減少]
       * [取得]
       * [失去]
       * [旗幟]
       *
       * 都必須先移除，不能交給原本
       * applyAdventure() 執行。
       */
      const originalContent =
        page && page.content != null
          ? String(page.content)
          : "";

      const filteredContent =
        processIfBlocks(
          originalContent
        );

      /*
       * 建立淺層副本，
       * 不直接修改原始 page 資料。
       */
      const filteredPage =
        Object.assign(
          {},
          page,
          {
            content: filteredContent
          }
        );

      return originalApplyAdventure(
        filteredPage
      );

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
`;

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