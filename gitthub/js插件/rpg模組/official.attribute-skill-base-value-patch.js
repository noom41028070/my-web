// @firehaha-plugin {"id":"official.attribute-skill-base-value-patch","name":"屬性／技能基礎值增減與條件補丁","version":"1.1.0","author":"Firehaha","description":"讓屬性與技能基礎值支援增加、減少與如果式，並新增一般數值／屬性／技能／修正值的移除標籤；基礎屬性與技能仍不混入骰子修正值。"}

FirehahaPlugins.register({
  id: "official.attribute-skill-base-value-patch",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha Attribute / Skill Base Value Patch 1.1.0 */
(function () {
  "use strict";

  if (window.__fhAttributeSkillBaseValuePatchInstalled) {
    return;
  }

  window.__fhAttributeSkillBaseValuePatchInstalled = true;

  if (typeof applyAdventure !== "function") {
    console.warn(
      "[Attribute / Skill Base Value Patch] 找不到 applyAdventure"
    );
    return;
  }

  const originalApplyAdventure =
    applyAdventure;


  function clean(value) {
    return String(
      value == null ? "" : value
    ).trim();
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
    } catch (_) {}

    try {
      if (
        window.memorySave &&
        window.memorySave.adventure
      ) {
        return window.memorySave.adventure;
      }
    } catch (_) {}

    return null;
  }


  function ensureAttributeStore() {
    const adventure =
      adventureState();

    if (!adventure) {
      return null;
    }

    if (
      !adventure.attributes ||
      typeof adventure.attributes !== "object"
    ) {
      adventure.attributes = {};
    }

    if (
      !adventure.skills ||
      typeof adventure.skills !== "object"
    ) {
      adventure.skills = {};
    }

    if (
      !adventure.values ||
      typeof adventure.values !== "object"
    ) {
      adventure.values = {};
    }

    if (
      !adventure.modifiers ||
      typeof adventure.modifiers !== "object"
    ) {
      adventure.modifiers = {};
    }

    if (
      !adventure.skillModifiers ||
      typeof adventure.skillModifiers !== "object"
    ) {
      adventure.skillModifiers = {};
    }

    if (
      !adventure.applied ||
      typeof adventure.applied !== "object"
    ) {
      adventure.applied = {};
    }

    return adventure;
  }


  function pageIdentity(page) {
    if (!page) {
      return "unknown";
    }

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


  function normalizeRule(value) {
    const rule =
      clean(value)
        .toLowerCase()
        .replace(/\s+/g, " ");

    if (
      rule === ">=" ||
      rule === "至少" ||
      rule === "以上" ||
      rule === "大於等於"
    ) {
      return ">=";
    }

    if (
      rule === "<=" ||
      rule === "至多" ||
      rule === "以下" ||
      rule === "小於等於"
    ) {
      return "<=";
    }

    if (
      rule === ">" ||
      rule === "超過" ||
      rule === "大於"
    ) {
      return ">";
    }

    if (
      rule === "<" ||
      rule === "未滿" ||
      rule === "小於"
    ) {
      return "<";
    }

    if (
      rule === "!=" ||
      rule === "<>" ||
      rule === "不等於"
    ) {
      return "!=";
    }

    if (
      rule === "=" ||
      rule === "==" ||
      rule === "等於"
    ) {
      return "=";
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


  function attributeValue(name) {
    const adventure =
      ensureAttributeStore();

    if (!adventure) {
      return 0;
    }

    const raw =
      Number(
        adventure.attributes[
          clean(name)
        ]
      );

    return Number.isFinite(raw)
      ? raw
      : 0;
  }


  function skillValue(name) {
    const adventure =
      ensureAttributeStore();

    if (!adventure) {
      return 0;
    }

    const raw =
      Number(
        adventure.skills[
          clean(name)
        ]
      );

    return Number.isFinite(raw)
      ? raw
      : 0;
  }


  /*
   * 保護 [如果:屬性:...]，
   * 避免其他通用 If 外掛先把它用 modifiers / 最終值算掉。
   */
  function protectBaseValueIfBlocks(source) {
    const blocks = [];

    const html =
      String(source || "")
        .replace(
          /\[如果:(?:屬性|技能):[^|\]\r\n]+\|[^|\]\r\n]+\|-?\d+(?:\.\d+)?\][\s\S]*?\[\/如果\]/gi,

          function(whole) {
            const index =
              blocks.length;

            blocks.push(
              whole
            );

            return (
              "@@FH_BASE_VALUE_IF_" +
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
            /@@FH_BASE_VALUE_IF_(\d+)@@/g,

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
   * 屬性增減：
   *
   * 推薦語法：
   * [增加:屬性:力量:2]
   * [減少:屬性:力量:1]
   *
   * 也相容：
   * [增加屬性:力量:2]
   * [減少屬性:力量:1]
   * [屬性增加:力量:2]
   * [屬性減少:力量:1]
   *
   * 只改 adventure.attributes，
   * 完全不碰 adventure.modifiers。
   */
  function processAttributeChanges(
    source,
    page
  ) {
    const adventure =
      ensureAttributeStore();

    if (!adventure) {
      return String(source || "");
    }

    let tagIndex = 0;

    return String(source || "")
      .replace(
        /\[(?:增加\s*:\s*屬性|增加屬性|屬性增加)\s*:\s*([^:\]\r\n]+?)\s*:\s*(-?\d+(?:\.\d+)?)\s*\]|\[(?:減少\s*:\s*屬性|減少屬性|屬性減少)\s*:\s*([^:\]\r\n]+?)\s*:\s*(-?\d+(?:\.\d+)?)\s*\]/gi,

        function(
          whole,
          addNameText,
          addAmountText,
          subNameText,
          subAmountText
        ) {
          const index =
            tagIndex++;

          const isAdd =
            addNameText != null;

          const name =
            clean(
              isAdd
                ? addNameText
                : subNameText
            );

          const amount =
            Number(
              isAdd
                ? addAmountText
                : subAmountText
            );

          if (
            !name ||
            !Number.isFinite(amount)
          ) {
            return whole;
          }

          const applyKey =
            "__fh_attribute_base_patch__|" +
            pageIdentity(page) +
            "|" +
            index +
            "|" +
            (isAdd ? "add" : "sub") +
            "|" +
            name +
            "|" +
            amount;

          /*
           * Reader 可能重繪多次。
           * 同一頁同一個屬性效果只執行一次。
           */
          if (
            adventure.applied[
              applyKey
            ]
          ) {
            return "";
          }

          const current =
            attributeValue(name);

          adventure.attributes[
            name
          ] =
            isAdd
              ? current + amount
              : current - amount;

          adventure.applied[
            applyKey
          ] = true;

          return "";
        }
      );
  }



  /*
   * 技能增減：
   *
   * 推薦語法：
   * [增加:技能:開鎖:5]
   * [減少:技能:開鎖:3]
   *
   * 也相容：
   * [增加技能:開鎖:5]
   * [減少技能:開鎖:3]
   * [技能增加:開鎖:5]
   * [技能減少:開鎖:3]
   *
   * 只改 adventure.skills，
   * 完全不碰 adventure.skillModifiers。
   */
  function processSkillChanges(
    source,
    page
  ) {
    const adventure =
      ensureAttributeStore();

    if (!adventure) {
      return String(source || "");
    }

    let tagIndex = 0;

    return String(source || "")
      .replace(
        /\[(?:增加\s*:\s*技能|增加技能|技能增加)\s*:\s*([^:\]\r\n]+?)\s*:\s*(-?\d+(?:\.\d+)?)\s*\]|\[(?:減少\s*:\s*技能|減少技能|技能減少)\s*:\s*([^:\]\r\n]+?)\s*:\s*(-?\d+(?:\.\d+)?)\s*\]/gi,

        function(
          whole,
          addNameText,
          addAmountText,
          subNameText,
          subAmountText
        ) {
          const index =
            tagIndex++;

          const isAdd =
            addNameText != null;

          const name =
            clean(
              isAdd
                ? addNameText
                : subNameText
            );

          const amount =
            Number(
              isAdd
                ? addAmountText
                : subAmountText
            );

          if (
            !name ||
            !Number.isFinite(amount)
          ) {
            return whole;
          }

          const applyKey =
            "__fh_skill_base_patch__|" +
            pageIdentity(page) +
            "|" +
            index +
            "|" +
            (isAdd ? "add" : "sub") +
            "|" +
            name +
            "|" +
            amount;

          if (
            adventure.applied[
              applyKey
            ]
          ) {
            return "";
          }

          const current =
            skillValue(name);

          adventure.skills[
            name
          ] =
            isAdd
              ? current + amount
              : current - amount;

          adventure.applied[
            applyKey
          ] = true;

          return "";
        }
      );
  }



  /*
   * v1.1.0 移除系列
   *
   * 推薦語法：
   * [移除數值:HP]
   * [移除屬性:力量]
   * [移除技能:開鎖]
   * [移除修正值:力量]
   * [移除技能修正值:開鎖]
   *
   * 也相容：
   * [移除:數值:HP] / [數值移除:HP]
   * [移除:屬性:力量] / [屬性移除:力量]
   * [移除:技能:開鎖] / [技能移除:開鎖]
   * [移除:修正值:力量] / [修正值移除:力量]
   * [移除:技能修正值:開鎖] / [技能修正值移除:開鎖]
   *
   * 「移除」和「減少」不同：
   * 移除會 delete 該欄位，使它回到不存在狀態。
   */
  function processRemovalTags(
    source,
    page
  ) {
    const adventure =
      ensureAttributeStore();

    if (!adventure) {
      return String(source || "");
    }

    let tagIndex = 0;

    const typeToStore = {
      "數值": "values",
      "屬性": "attributes",
      "技能": "skills",
      "修正值": "modifiers",
      "技能修正值": "skillModifiers"
    };

    return String(source || "")
      .replace(
        /\[(?:移除\s*:\s*(數值|屬性|技能|修正值|技能修正值)|(數值|屬性|技能|修正值|技能修正值)移除|移除(數值|屬性|技能|修正值|技能修正值))\s*:\s*([^:\]\r\n]+?)\s*\]/gi,

        function(
          whole,
          typeA,
          typeB,
          typeC,
          nameText
        ) {
          const index =
            tagIndex++;

          const type =
            clean(
              typeA ||
              typeB ||
              typeC
            );

          const name =
            clean(nameText);

          const storeName =
            typeToStore[type];

          if (
            !storeName ||
            !name
          ) {
            return whole;
          }

          const applyKey =
            "__fh_remove_numeric_patch__|" +
            pageIdentity(page) +
            "|" +
            index +
            "|" +
            type +
            "|" +
            name;

          if (
            adventure.applied[
              applyKey
            ]
          ) {
            return "";
          }

          if (
            adventure[storeName] &&
            typeof adventure[storeName] === "object"
          ) {
            delete adventure[storeName][name];
          }

          adventure.applied[
            applyKey
          ] = true;

          return "";
        }
      );
  }


  /*
   * 屬性如果式：
   *
   * [如果:屬性:力量|至少|10]
   * 成功內容
   * [否則]
   * 失敗內容
   * [/如果]
   *
   * 只讀 attributes["力量"]。
   * 不加 modifiers["力量"]。
   */
  function processBaseValueIfBlocks(html) {
    return String(html || "")
      .replace(
        /\[如果:(屬性|技能):([^|\]\r\n]+?)\|([^|\]\r\n]+?)\|(-?\d+(?:\.\d+)?)\]([\s\S]*?)(?:\[否則\]([\s\S]*?))?\[\/如果\]/gi,

        function(
          whole,
          typeText,
          nameText,
          ruleText,
          expectedText,
          yesText,
          noText
        ) {
          const type =
            clean(typeText);

          const actual =
            type === "技能"
              ? skillValue(nameText)
              : attributeValue(nameText);

          const passed =
            compare(
              actual,
              ruleText,
              Number(expectedText)
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
       * 1. 先保護屬性如果式。
       */
      const protectedIf =
        protectBaseValueIfBlocks(
          originalContent
        );


      /*
       * 2. 執行屬性增加 / 減少。
       *    所以同頁下方的屬性如果式也能讀到更新後的基礎屬性。
       */
      let converted =
        processAttributeChanges(
          protectedIf.html,
          page
        );

      converted =
        processSkillChanges(
          converted,
          page
        );

      /*
       * 3. 移除系列最後執行。
       *    因此同頁若先增加再移除，最後會是「不存在」。
       */
      converted =
        processRemovalTags(
          converted,
          page
        );


      clonedPage[field] =
        converted;


      /*
       * 4. 交回原本 Adventure 處理其他標籤。
       */
      let html =
        originalApplyAdventure.call(
          this,
          clonedPage
        );


      /*
       * 5. 還原並處理屬性如果式。
       */
      html =
        protectedIf.restore(
          html
        );

      html =
        processBaseValueIfBlocks(
          html
        );


      return html;
    };


  /*
   * 給重新開始插件 / 除錯使用。
   */
  window.FirehahaAttributeSkillBaseValuePatch = {
    version:
      "1.1.0",

    getAttribute(name) {
      return attributeValue(name);
    },

    getSkill(name) {
      return skillValue(name);
    },

    compare:
      compare,

    resetRuntime() {
      /*
       * 這支本身沒有另外保存遊戲資料；
       * 實際屬性仍在 memorySave.adventure.attributes。
       * applied 會隨 adventure 重建一起清除。
       */
      return true;
    }
  };

})();
`;


    const removeTransform =
      api.registerReaderTransform(
        "reader",

        function(html, context) {
          html =
            String(
              html == null
                ? ""
                : html
            );

          const marker =
            "function renderAdventure(){";

          if (!html.includes(marker)) {
            console.warn(
              "[Attribute / Skill Base Value Patch] 找不到閱讀器插入位置"
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
         * 放在一般 If Block 之後，
         * 讓這支成為外層 wrapper，優先保護 [如果:屬性:...]。
         */
        275
      );


    api.toast(
      "屬性／技能基礎值增減、條件與移除補丁已啟用"
    );


    return function cleanup() {
      removeTransform();
    };
  }
});
