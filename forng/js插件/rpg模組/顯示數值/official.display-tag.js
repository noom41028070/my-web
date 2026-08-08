// @firehaha-plugin {"id":"official.display-tag","name":"統一文字顯示標籤","version":"1.0.0","author":"Firehaha","description":"以 {顯示:類型:名稱:格式:預設文字} 統一顯示閱讀器中的冒險資料"}

FirehahaPlugins.register({
  id: "official.display-tag",

  setup(api) {
    "use strict";

    const patchCode = String.raw`
/* Firehaha Unified Display Tag */
(function () {
  "use strict";

  if (window.__firehahaDisplayTagInstalled) {
    return;
  }

  window.__firehahaDisplayTagInstalled = true;

  const resolvers = Object.create(null);

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function hasOwn(object, key) {
    return !!object &&
      Object.prototype.hasOwnProperty.call(object, key);
  }

  function result(found, value) {
    return {
      found: !!found,
      value: value
    };
  }

  function stringify(value) {
    if (value == null) {
      return "";
    }

    if (typeof value === "object") {
      if (hasOwn(value, "total")) {
        return String(value.total);
      }

      if (hasOwn(value, "result")) {
        return String(value.result);
      }

      try {
        return JSON.stringify(value);
      } catch (error) {
        return String(value);
      }
    }

    return String(value);
  }

  function register(type, resolver) {
    type = clean(type);

    if (!type || typeof resolver !== "function") {
      return function () {};
    }

    resolvers[type] = resolver;

    return function removeResolver() {
      if (resolvers[type] === resolver) {
        delete resolvers[type];
      }
    };
  }

  function alias(aliasName, originalName) {
    register(aliasName, function (name, format, adventure) {
      const resolver = resolvers[originalName];

      return resolver
        ? resolver(name, format, adventure)
        : result(false, "");
    });
  }

  /*
   * 數值
   * {顯示:數值:體力}
   */
  register("數值", function (name, format, adventure) {
    const values = adventure.values || {};

    return hasOwn(values, name)
      ? result(true, values[name])
      : result(false, 0);
  });

  /*
   * 物品
   *
   * {顯示:物品:鑰匙}
   * {顯示:物品:藥水:數量}
   * {顯示:物品:鑰匙:是否持有}
   */
  register("物品", function (name, format, adventure) {
    const items = Array.isArray(adventure.items)
      ? adventure.items
      : [];

    const count = items.filter(function (item) {
      return String(item) === name;
    }).length;

    if (format === "數量") {
      return result(count > 0, count);
    }

    if (
      format === "布林" ||
      format === "真假"
    ) {
      return result(true, count > 0 ? "true" : "false");
    }

    return result(
      count > 0,
      count > 0 ? "持有" : "未持有"
    );
  });

  /*
   * 旗幟
   *
   * {顯示:旗幟:擊敗魔王}
   */
  register("旗幟", function (name, format, adventure) {
    const flags = Array.isArray(adventure.flags)
      ? adventure.flags
      : [];

    const owned = flags.includes(name);

    if (
      format === "布林" ||
      format === "真假"
    ) {
      return result(true, owned ? "true" : "false");
    }

    return result(
      owned,
      owned ? "已達成" : "未達成"
    );
  });

  alias("旗標", "旗幟");

  /*
   * 屬性
   *
   * {顯示:屬性:力量}
   * {顯示:屬性:力量:基礎}
   * {顯示:屬性:力量:修正}
   */
  register("屬性", function (name, format, adventure) {
    const baseMap = adventure.attributes || {};
    const modifierMap = adventure.modifiers || {};

    const hasBase = hasOwn(baseMap, name);
    const hasModifier = hasOwn(modifierMap, name);

    const base = Number(baseMap[name]) || 0;
    const modifier = Number(modifierMap[name]) || 0;

    if (format === "基礎") {
      return result(hasBase, base);
    }

    if (format === "修正") {
      return result(hasModifier, modifier);
    }

    return result(
      hasBase || hasModifier,
      base + modifier
    );
  });

  /*
   * 技能
   *
   * {顯示:技能:開鎖}
   * {顯示:技能:開鎖:基礎}
   * {顯示:技能:開鎖:修正}
   */
  register("技能", function (name, format, adventure) {
    const baseMap = adventure.skills || {};
    const modifierMap =
      adventure.skillModifiers || {};

    const hasBase = hasOwn(baseMap, name);
    const hasModifier = hasOwn(modifierMap, name);

    const base = Number(baseMap[name]) || 0;
    const modifier = Number(modifierMap[name]) || 0;

    if (format === "基礎") {
      return result(hasBase, base);
    }

    if (format === "修正") {
      return result(hasModifier, modifier);
    }

    return result(
      hasBase || hasModifier,
      base + modifier
    );
  });

  /*
   * 任務
   *
   * {顯示:任務:尋找公主}
   */
  register("任務", function (name, format, adventure) {
    const quests = adventure.quests || {};

    return hasOwn(quests, name)
      ? result(true, quests[name])
      : result(false, "");
  });

  /*
   * 骰子
   *
   * {顯示:骰子:最後結果}
   * {顯示:骰子:開鎖}
   * {顯示:骰子:開鎖:過程}
   * {顯示:骰子:開鎖:公式}
   */
  register("骰子", function (name, format, adventure) {
    const dice = adventure.dice || {};

    let key = name;

    if (
      name === "最後結果" ||
      name === "最後" ||
      name === "最近"
    ) {
      key = "__last";
    }

    if (!hasOwn(dice, key)) {
      return result(false, "");
    }

    const data = dice[key];

    if (
      data == null ||
      typeof data !== "object"
    ) {
      return result(true, data);
    }

    if (
      format === "過程" ||
      format === "詳細"
    ) {
      return result(
        true,
        data.breakdown || data.total || ""
      );
    }

    if (format === "公式") {
      return result(
        true,
        data.formula || ""
      );
    }

    if (format === "結果") {
      return result(
        true,
        data.result || data.total || ""
      );
    }

    return result(
      true,
      hasOwn(data, "total")
        ? data.total
        : stringify(data)
    );
  });

  /*
   * 檢定
   *
   * {顯示:檢定:開鎖}
   * {顯示:檢定:開鎖:結果}
   * {顯示:檢定:開鎖:總值}
   */
  register("檢定", function (name, format, adventure) {
    const checks = adventure.checks || {};

    if (!hasOwn(checks, name)) {
      return result(false, "");
    }

    const data = checks[name];

    if (
      data == null ||
      typeof data !== "object"
    ) {
      return result(true, data);
    }

    if (format === "結果") {
      return result(
        true,
        data.result || ""
      );
    }

    if (
      format === "總值" ||
      format === "數值"
    ) {
      return result(
        true,
        data.total ?? data.value ?? ""
      );
    }

    return result(
      true,
      data.result ??
      data.total ??
      stringify(data)
    );
  });

  /*
   * 傷害
   *
   * {顯示:傷害:長劍}
   * {顯示:傷害:長劍:過程}
   */
  register("傷害", function (name, format, adventure) {
    const damage = adventure.damage || {};

    if (!hasOwn(damage, name)) {
      return result(false, "");
    }

    const data = damage[name];

    if (
      data == null ||
      typeof data !== "object"
    ) {
      return result(true, data);
    }

    if (
      format === "過程" ||
      format === "詳細"
    ) {
      return result(
        true,
        data.breakdown || stringify(data)
      );
    }

    return result(
      true,
      data.total ??
      data.damage ??
      data.result ??
      stringify(data)
    );
  });

  /*
   * 成功骰
   *
   * {顯示:成功骰:射擊}
   * {顯示:成功骰:射擊:成功數}
   * {顯示:成功骰:射擊:結果}
   */
  register("成功骰", function (name, format, adventure) {
    const pool = adventure.successDice || {};

    if (!hasOwn(pool, name)) {
      return result(false, "");
    }

    const data = pool[name];

    if (
      data == null ||
      typeof data !== "object"
    ) {
      return result(true, data);
    }

    if (
      format === "成功數" ||
      format === "數量"
    ) {
      return result(
        true,
        data.successes ?? 0
      );
    }

    if (format === "需求") {
      return result(
        true,
        data.required ?? 0
      );
    }

    if (format === "結果") {
      return result(
        true,
        data.result || ""
      );
    }

    return result(
      true,
      data.result ??
      data.successes ??
      stringify(data)
    );
  });

  function resolveTag(body, adventure) {
    body = String(body || "")
      .replace(/：/g, ":");

    const parts = body.split(":");

    const type = clean(parts[0]);
    const name = clean(parts[1]);
    const format = clean(parts[2]);
    const fallback = parts.length >= 4
      ? clean(parts.slice(3).join(":"))
      : "";

    if (!type || !name) {
      return fallback;
    }

    const resolver = resolvers[type];

    if (!resolver) {
      return fallback || "{顯示:" + body + "}";
    }

    try {
      const output =
        resolver(name, format, adventure);

      if (
        !output ||
        output.found === false ||
        output.value == null ||
        output.value === ""
      ) {
        return fallback;
      }

      return stringify(output.value);

    } catch (error) {
      console.warn(
        "[Display Tag]",
        type,
        name,
        error
      );

      return fallback;
    }
  }

  window.FirehahaDisplayTag = {
    version: "1.0.0",
    register: register,
    resolvers: resolvers,

    resolve: function (
      type,
      name,
      format,
      fallback
    ) {
      const adventure =
        memorySave &&
        memorySave.adventure
          ? memorySave.adventure
          : {};

      const body = [
        type,
        name,
        format,
        fallback
      ].join(":");

      return resolveTag(body, adventure);
    }
  };

  const originalApplyAdventure =
    applyAdventure;

  applyAdventure = function (page) {
    let html = originalApplyAdventure(page);

    try {
      const adventure =
        memorySave &&
        memorySave.adventure
          ? memorySave.adventure
          : {};

      html = String(html).replace(
        /\{顯示:([^{}]+)\}/gi,
        function (full, body) {
          return resolveTag(
            body,
            adventure
          );
        }
      );

    } catch (error) {
      console.warn(
        "[Display Tag]",
        error
      );
    }

    return html;
  };
})();
`;

    const removeTransform =
      api.registerReaderTransform(
        "display-tag",

        function (html) {
          html = String(
            html == null ? "" : html
          );

          const marker =
            "function renderAdventure(){";

          if (!html.includes(marker)) {
            console.warn(
              "[Display Tag] 找不到閱讀器插入位置"
            );

            return html;
          }

          return html.replace(
            marker,
            patchCode + "\n" + marker
          );
        },

        230
      );

    api.toast(
      "統一文字顯示標籤已啟用"
    );

    return function cleanup() {
      removeTransform();
    };
  }
});