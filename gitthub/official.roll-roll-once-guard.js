// @firehaha-plugin {"id":"official.roll-roll-once-guard","name":"傷害骰單次防重擲","version":"1.0.0","author":"Firehaha","description":"配合 official.damage-dice-helper，鎖定同一頁同一次傷害骰；第一次擲骰後立即停用該按鈕，重新進入其他頁面後可再次擲骰。"}

FirehahaPlugins.register({
  id: "official.roll-roll-once-guard",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha Roll Roll Once Guard 1.0.0 */
(function () {
  "use strict";

  if (window.__fhRollRollOnceGuardInstalled) {
    return;
  }
  window.__fhRollRollOnceGuardInstalled = true;

  /*
   * 這支不再假設主程式本身有「傷害骰」核心。
   * 它只做兩件事：
   *
   * 1. 監看 damage-dice-helper / Reader 產生的傷害骰按鈕。
   * 2. 第一次點擊並產生新的 adventure.damage 結果後，
   *    直接把「那顆按鈕」鎖住，避免同一頁一直重骰。
   *
   * 同時保留來源層的 page + damageName 鎖，
   * 如果 Reader 因為擲骰而重新 render，也不會重新生出可按按鈕。
   */

  const locks = new Map();
  const pageBaselines = new Map();


  function clean(value) {
    return String(value == null ? "" : value).trim();
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


  function pageIdentity(page) {
    if (page) {
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
          return pair[0] + ":" + clean(value);
        }
      }
    }

    try {
      if (
        typeof currentId !== "undefined" &&
        currentId != null
      ) {
        return "current:" + clean(currentId);
      }
    } catch (error) {}

    return "unknown";
  }


  function damageMapSnapshot() {
    const adventure = getAdventure();
    const damage =
      adventure &&
      adventure.damage &&
      typeof adventure.damage === "object"
        ? adventure.damage
        : {};

    const result = Object.create(null);

    Object.keys(damage).forEach(function(name) {
      const raw = damage[name];

      try {
        result[name] = JSON.stringify(raw);
      } catch (error) {
        result[name] = String(
          raw &&
          typeof raw === "object"
            ? raw.total
            : raw
        );
      }
    });

    return result;
  }


  function changedDamageNames(before, after) {
    const names = new Set(
      Object.keys(before || {}).concat(
        Object.keys(after || {})
      )
    );

    const changed = [];

    names.forEach(function(name) {
      if (
        String((before || {})[name]) !==
        String((after || {})[name])
      ) {
        changed.push(name);
      }
    });

    return changed;
  }


  function currentPageKey() {
    return pageIdentity(null);
  }


  function lockKey(pageKey, damageName) {
    return clean(pageKey) + "||" + clean(damageName);
  }


  function markLocked(pageKey, damageName) {
    if (!damageName) return;

    locks.set(
      lockKey(pageKey, damageName),
      {
        pageKey: pageKey,
        damageName: damageName,
        lockedAt: Date.now()
      }
    );
  }


  function isLocked(pageKey, damageName) {
    return locks.has(
      lockKey(pageKey, damageName)
    );
  }


  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }


  function lockedMarkup(name) {
    const adventure = getAdventure();
    const raw =
      adventure &&
      adventure.damage
        ? adventure.damage[name]
        : null;

    const total = Number(
      raw &&
      typeof raw === "object"
        ? raw.total
        : raw
    );

    return (
      '<span class="fh-roll-once-locked" ' +
      'data-fh-roll-once-locked="' +
      escapeHtml(name) +
      '">' +
      '🎲 ' +
      escapeHtml(name) +
      (
        Number.isFinite(total)
          ? "：" + escapeHtml(total)
          : ""
      ) +
      '（本次已擲）' +
      '</span>'
    );
  }


  /*
   * 從作者標籤中抓出傷害名稱。
   */
  function attackDamageName(whole) {
    const m =
      String(whole || "").match(
        /^\[(?:攻擊傷害|attackdamage|attack-damage|攻撃ダメージ)\s*:\s*([^|\]\r\n]+?)\s*\|\s*([^|\]\r\n]+?)/i
      );

    return m ? clean(m[2]) : "";
  }


  function sourceLock(source, page) {
    let text = String(source || "");
    const pageKey = pageIdentity(page);

    text = text.replace(
      /\[(?:攻擊傷害|attackdamage|attack-damage|攻撃ダメージ)\s*:[^\]\r\n]+\]/gi,
      function(whole) {
        const name = attackDamageName(whole);

        if (
          name &&
          isLocked(pageKey, name)
        ) {
          return lockedMarkup(name);
        }

        return whole;
      }
    );

    text = text.replace(
      /\[(?:傷害|damage|ダメージ)\s*:\s*([^|\]\r\n]+?)\s*\|\s*([^|\]\r\n]+?)\s*\]/gi,
      function(whole, nameText) {
        const name = clean(nameText);

        if (
          name &&
          isLocked(pageKey, name)
        ) {
          return lockedMarkup(name);
        }

        return whole;
      }
    );

    text = text.replace(
      /\[傷害骰\s*:\s*([^:\]\r\n]+?)\s*:\s*([^\]\r\n]+?)\s*\]/gi,
      function(whole, nameText) {
        const name = clean(nameText);

        if (
          name &&
          isLocked(pageKey, name)
        ) {
          return lockedMarkup(name);
        }

        return whole;
      }
    );

    return text;
  }


  /*
   * DOM 層：找到實際被按下的控制項。
   * 不依賴固定 class，避免不同 Reader 版本失效。
   */
  function clickableFromEvent(event) {
    const target = event && event.target;

    if (
      !target ||
      !target.closest
    ) {
      return null;
    }

    return target.closest(
      'button,[role="button"],input[type="button"],input[type="submit"],a'
    );
  }


  function controlDescriptor(el) {
    if (!el) return "";

    const attrs = [
      el.textContent,
      el.value,
      el.title,
      el.getAttribute && el.getAttribute("aria-label"),
      el.getAttribute && el.getAttribute("data-name"),
      el.getAttribute && el.getAttribute("data-damage"),
      el.getAttribute && el.getAttribute("data-damage-name"),
      el.getAttribute && el.getAttribute("onclick")
    ];

    try {
      attrs.push(el.outerHTML);
    } catch (error) {}

    return attrs
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }


  function looksLikeDamageRollControl(el) {
    const d = controlDescriptor(el);

    /*
     * 傷害 helper / Reader 常見字樣。
     * 不只看中文，也保留英日文。
     */
    if (
      d.includes("傷害") ||
      d.includes("damage") ||
      d.includes("ダメージ")
    ) {
      return true;
    }

    return false;
  }


  function disableControl(el, damageName) {
    if (!el) return;

    try {
      el.disabled = true;
    } catch (error) {}

    try {
      el.setAttribute("aria-disabled", "true");
      el.setAttribute("data-fh-roll-once", "locked");
    } catch (error) {}

    try {
      el.style.pointerEvents = "none";
    } catch (error) {}

    const label =
      damageName
        ? (
            "🎲 " +
            damageName +
            "（本次已擲）"
          )
        : "🎲 本次已擲";

    /*
     * button / a 改文字；
     * input 改 value。
     */
    try {
      if (
        String(el.tagName).toUpperCase() === "INPUT"
      ) {
        el.value = label;
      } else {
        el.textContent = label;
      }
    } catch (error) {}
  }


  function inspectDamageChange(
    el,
    before,
    pageKey,
    attempt
  ) {
    const after = damageMapSnapshot();
    const changed =
      changedDamageNames(
        before,
        after
      );

    if (changed.length) {
      /*
       * 一次點擊正常只會產生一個傷害名稱。
       * 若特殊系統同時產生多種傷害，全部記錄鎖定，
       * 但按鈕顯示第一個即可。
       */
      changed.forEach(function(name) {
        markLocked(
          pageKey,
          name
        );
      });

      disableControl(
        el,
        changed[0]
      );

      return;
    }

    /*
     * 有些骰子動畫要一小段時間才寫入 memorySave，
     * 所以分段重查，不用高頻輪詢。
     */
    const delays = [
      60,
      180,
      420,
      850,
      1400
    ];

    if (attempt < delays.length) {
      setTimeout(
        function() {
          inspectDamageChange(
            el,
            before,
            pageKey,
            attempt + 1
          );
        },
        delays[attempt]
      );
    }
  }


  /*
   * 第一次點擊傷害骰：
   * 先讓原本 handler 正常執行，
   * 然後觀察 adventure.damage 是否出現新結果。
   */
  document.addEventListener(
    "click",
    function(event) {
      const el =
        clickableFromEvent(event);

      if (
        !el ||
        !looksLikeDamageRollControl(el)
      ) {
        return;
      }

      if (
        el.getAttribute &&
        el.getAttribute("data-fh-roll-once") === "locked"
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      const before =
        damageMapSnapshot();

      const pageKey =
        currentPageKey();

      /*
       * 防止同一顆按鈕在骰子動畫尚未完成前被連點。
       * 只是暫時標記 pending；若最後沒有產生傷害結果，
       * 會解除。
       */
      try {
        el.setAttribute(
          "data-fh-roll-once",
          "pending"
        );
      } catch (error) {}

      setTimeout(
        function() {
          inspectDamageChange(
            el,
            before,
            pageKey,
            0
          );
        },
        0
      );

      /*
       * 如果 2 秒後仍沒鎖，代表這顆其實不是傷害骰，
       * 或擲骰失敗；解除 pending。
       */
      setTimeout(
        function() {
          try {
            if (
              el.getAttribute("data-fh-roll-once") === "pending"
            ) {
              el.removeAttribute(
                "data-fh-roll-once"
              );
            }
          } catch (error) {}
        },
        2200
      );
    },
    true
  );


  /*
   * 如果 Reader 重新 render，
   * 來源層鎖會阻止同頁再次生成新的傷害骰。
   */
  if (typeof applyAdventure === "function") {
    const originalApplyAdventure =
      applyAdventure;

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

        clonedPage[field] =
          sourceLock(
            clonedPage[field],
            page
          );

        return originalApplyAdventure.call(
          this,
          clonedPage
        );
      };
  }


  window.FirehahaRollRollOnceGuard = {
    version:
      "1.0.0",

    inspect() {
      return Array.from(
        locks.values()
      );
    },

    clear() {
      locks.clear();
    },

    isLocked(pageKey, damageName) {
      return isLocked(
        pageKey,
        damageName
      );
    }
  };

})();
`;

    const css = `
.fh-roll-once-locked{
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
}
[data-fh-roll-once="locked"]{
  opacity:.72;
  cursor:not-allowed !important;
}
body.reader-dark .fh-roll-once-locked{
  background:#263238;
  border-color:#455a64;
  color:#cfd8dc;
}
`;

    const removeStyle =
      api.addStyle(
        "roll-roll-once-guard",
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

          if (!html.includes(marker)) {
            console.warn(
              "[Roll Roll Once Guard] 找不到閱讀器插入位置"
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
         * Damage Dice Helper 是 280。
         * 這支維持 300，讓它在 Reader 執行期包在外層，
         * 同時 DOM click guard 不依賴 wrapper 順序。
         */
        300
      );

    api.toast(
      "傷害骰單次防重擲已啟用"
    );

    return function cleanup() {
      removeTransform();
      removeStyle();
    };
  }
});
