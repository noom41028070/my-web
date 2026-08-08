// @firehaha-plugin {"id":"official.damage-value-attribute-bridge","name":"傷害骰・數值・屬性橋接器","version":"1.0.0","author":"Firehaha","description":"沿用主程式 adventure.damage / values / attributes，將傷害骰結果一次性套用到 HP 等一般數值，並可用屬性作固定減傷。"}

FirehahaPlugins.register({
  id: "official.damage-value-attribute-bridge",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha Damage / Value / Attribute Bridge 1.0.0 */
(function () {
  "use strict";

  if (window.__fhDamageValueAttributeBridgeInstalled) return;
  window.__fhDamageValueAttributeBridgeInstalled = true;

  if (typeof applyAdventure !== "function") {
    console.warn("[Damage Value Bridge] 找不到 applyAdventure");
    return;
  }

  const originalApplyAdventure = applyAdventure;

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
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

  function ensureBridgeState(adventure) {
    if (!adventure) return null;

    adventure.applied =
      adventure.applied &&
      typeof adventure.applied === "object"
        ? adventure.applied
        : {};

    adventure.applied.damageValueBridge =
      adventure.applied.damageValueBridge &&
      typeof adventure.applied.damageValueBridge === "object"
        ? adventure.applied.damageValueBridge
        : {};

    return adventure.applied.damageValueBridge;
  }

  function notifyAdventureStateChanged(
    detail
  ) {
    try {
      document.dispatchEvent(
        new CustomEvent(
          "firehaha:adventure-state-changed",
          {
            detail:
              Object.assign(
                {
                  reason:
                    "damage-value-bridge",
                  at:
                    Date.now()
                },
                detail || {}
              )
          }
        )
      );
    } catch (error) {
      console.warn(
        "[Damage Value Bridge] 狀態變更通知失敗",
        error
      );
    }
  }


  function persistSafe() {
    try {
      if (typeof persist === "function") persist();
    } catch (error) {
      console.warn("[Damage Value Bridge] persist 失敗", error);
    }
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

    const raw = adventure.damage[target];
    const total = num(
      raw && typeof raw === "object"
        ? raw.total
        : raw
    );

    if (total == null) return null;

    return {
      name: target,
      total,
      breakdown: clean(
        raw && typeof raw === "object"
          ? raw.breakdown
          : ""
      ),
      raw
    };
  }

  function getValue(name) {
    const adventure = getAdventure();
    const target = clean(name);

    if (!adventure || !target) return null;

    adventure.values =
      adventure.values &&
      typeof adventure.values === "object"
        ? adventure.values
        : {};

    const value = num(adventure.values[target]);
    return value == null ? 0 : value;
  }

  function setValue(name, value) {
    const adventure = getAdventure();
    const target = clean(name);
    const next = num(value);

    if (!adventure || !target || next == null) {
      return false;
    }

    adventure.values =
      adventure.values &&
      typeof adventure.values === "object"
        ? adventure.values
        : {};

    adventure.values[target] = next;
    persistSafe();
    return true;
  }

  function getAttribute(name) {
    const adventure = getAdventure();
    const target = clean(name);

    if (
      !adventure ||
      !adventure.attributes ||
      !target
    ) {
      return null;
    }

    const base = num(adventure.attributes[target]);
    if (base == null) return null;

    const modifier =
      adventure.modifiers
        ? num(adventure.modifiers[target])
        : null;

    return base + (modifier == null ? 0 : modifier);
  }

  function damageFingerprint(damage) {
    if (!damage) return "";

    const raw =
      damage.raw &&
      typeof damage.raw === "object"
        ? damage.raw
        : {};

    let rolls = "";

    try {
      rolls = Array.isArray(raw.rolls)
        ? JSON.stringify(raw.rolls)
        : "";
    } catch (error) {}

    return [
      damage.total,
      damage.breakdown,
      rolls
    ].join("::");
  }

  function applicationKey(
    page,
    damageName,
    valueName,
    extra
  ) {
    const pageId =
      clean(page && page.id) ||
      (
        typeof currentId !== "undefined"
          ? clean(currentId)
          : ""
      );

    return [
      pageId,
      clean(damageName),
      clean(valueName),
      clean(extra)
    ].join("::");
  }

  function alreadyApplied(key, fingerprint) {
    const state = ensureBridgeState(getAdventure());
    return !!(state && state[key] === fingerprint);
  }

  function markApplied(key, fingerprint) {
    const state = ensureBridgeState(getAdventure());
    if (!state) return;
    state[key] = fingerprint;
    persistSafe();
  }

  function applyDamageToValue(
    page,
    damageName,
    valueName,
    reductionAttribute,
    minimumDamage
  ) {
    const damage = getDamage(damageName);
    if (!damage) return null;

    const reductionName = clean(reductionAttribute);
    const minimumRaw = num(minimumDamage);
    const minimum = Math.max(
      0,
      minimumRaw == null ? 0 : minimumRaw
    );

    let reduction = 0;

    if (reductionName) {
      const attributeValue = getAttribute(reductionName);

      if (attributeValue != null) {
        reduction = Math.max(0, attributeValue);
      }
    }

    const finalDamage = Math.max(
      minimum,
      damage.total - reduction
    );

    const fingerprint = damageFingerprint(damage);

    const key = applicationKey(
      page,
      damageName,
      valueName,
      [reductionName, minimum].join("|")
    );

    if (alreadyApplied(key, fingerprint)) {
      return {
        applied: false,
        repeated: true,
        originalDamage: damage.total,
        reduction,
        finalDamage,
        remaining: getValue(valueName)
      };
    }

    const before = getValue(valueName);

    /*
     * 一般資源值預設不允許被傷害扣成負數。
     *
     * HP 5 - 傷害 8
     * 舊版：-3
     * 新版：0
     */
    const after = Math.max(
      0,
      before - finalDamage
    );

    if (!setValue(valueName, after)) {
      return null;
    }

    markApplied(key, fingerprint);


    /*
     * HP / MP 等 values 已真正改變。
     * 通知 If Block 在本輪結束後安全重畫一次，
     * 讓 [如果:數值:HP|...] 立刻改用新數值判定。
     */
    notifyAdventureStateChanged({
      source:
        "damage",

      damageName:
        damageName,

      valueName:
        valueName,

      before:
        before,

      after:
        after,

      damage:
        finalDamage
    });


    return {
      applied: true,
      repeated: false,
      originalDamage: damage.total,
      reduction,
      finalDamage,
      before,
      remaining: after,

      /*
       * 超出 0 以下的部分另外保留，
       * 未來如果要做「過量傷害 / 死亡判定」可以直接讀。
       */
      overkill:
        Math.max(
          0,
          finalDamage - before
        )
    };
  }

  /*
   * 標籤：
   *
   * [傷害扣除:長劍|HP]
   * → 長劍傷害直接扣 HP
   * → HP 最低停在 0，不會扣成負數
   *
   * [傷害扣除:長劍|HP|護甲]
   * → 傷害 - 護甲（含護甲修正值）後扣 HP
   *
   * [傷害扣除:長劍|HP|護甲|1]
   * → 同上，但至少造成 1 點傷害
   *
   * English:
   * [applydamage:Longsword|HP|Armor|1]
   *
   * 日本語:
   * [ダメージ適用:長剣|HP|防御|1]
   */
  function processApplyTags(source, page) {
    return String(source || "").replace(
      /\[(?:傷害扣除|套用傷害|applydamage|apply-damage|ダメージ適用)\s*:\s*([^|\]\r\n]+?)\s*\|\s*([^|\]\r\n]+?)(?:\s*\|\s*([^|\]\r\n]+?))?(?:\s*\|\s*(-?\d+(?:\.\d+)?))?\s*\]/gi,
      function(
        whole,
        damageText,
        valueText,
        attributeText,
        minimumText
      ) {
        const damageName = clean(damageText);
        const valueName = clean(valueText);
        const attributeName = clean(attributeText);

        if (!damageName || !valueName) {
          return whole;
        }

        applyDamageToValue(
          page,
          damageName,
          valueName,
          attributeName,
          minimumText
        );

        /*
         * 不管尚未擲骰或已套用，
         * 控制標籤本身都不顯示給讀者。
         * 傷害結果出現後 Reader 重畫會重新執行，
         * 一次性保護會避免重複扣血。
         */
        return "";
      }
    );
  }

  function processDisplays(html) {
    return String(html || "").replace(
      /\[(?:顯示橋接數值|bridgevalue|ブリッジ数値)\s*:\s*([^\]\r\n]+?)\s*\]/gi,
      function(whole, valueText) {
        const name = clean(valueText);
        return String(getValue(name));
      }
    );
  }

  applyAdventure = function(page) {
    const clonedPage = Object.assign({}, page || {});

    const field =
      clonedPage.content != null
        ? "content"
        : "text";

    let source = String(clonedPage[field] || "");

    /*
     * 先保護橋接標籤，避免內層 Adventure / If Block 誤處理。
     */
    const blocks = [];

    source = source.replace(
      /\[(?:傷害扣除|套用傷害|applydamage|apply-damage|ダメージ適用)\s*:[^\]]+\]/gi,
      function(whole) {
        const index = blocks.length;
        blocks.push(whole);
        return "@@FH_DAMAGE_VALUE_APPLY_" + index + "@@";
      }
    );

    clonedPage[field] = source;

    /*
     * 先讓內層傷害骰 Helper / 主程式完成擲骰與 adventure.damage。
     */
    let html = originalApplyAdventure.call(
      this,
      clonedPage
    );

    html = String(html || "").replace(
      /@@FH_DAMAGE_VALUE_APPLY_(\d+)@@/g,
      function(whole, indexText) {
        const index = Number(indexText);

        return (
          Number.isInteger(index) &&
          blocks[index] != null
        )
          ? blocks[index]
          : whole;
      }
    );

    /*
     * 有 damage 結果後才真正扣 values。
     */
    html = processApplyTags(
      html,
      page
    );

    html = processDisplays(html);

    return html;
  };

  window.FirehahaDamageValueBridge = {
    version: "1.0.0",

    getValue,
    setValue,
    getAttribute,
    getDamage,

    apply(
      damageName,
      valueName,
      reductionAttribute,
      minimumDamage
    ) {
      return applyDamageToValue(
        {
          id:
            typeof currentId !== "undefined"
              ? currentId
              : ""
        },
        damageName,
        valueName,
        reductionAttribute,
        minimumDamage
      );
    },

    clearApplied() {
      const adventure = getAdventure();

      if (adventure && adventure.applied) {
        adventure.applied.damageValueBridge = {};
        persistSafe();
      }
    }
  };
})();
`;

    const removeTransform =
      api.registerReaderTransform(
        "reader",

        function(html) {
          html = String(
            html == null ? "" : html
          );

          const marker =
            "function renderAdventure(){";

          if (!html.includes(marker)) {
            console.warn(
              "[Damage Value Bridge] 找不到閱讀器插入位置"
            );
            return html;
          }

          return html.replace(
            marker,
            patchCode + "\n" + marker
          );
        },

        /*
         * 比傷害骰 Helper 更晚，讓本橋接器成為外層。
         */
        300
      );

    api.toast(
      "傷害骰・數值・屬性橋接器已啟用"
    );

    return function cleanup() {
      removeTransform();
    };
  }
});
