// @firehaha-plugin {"id":"official.plugin-install-receiver","name":"插件安裝接收器（實驗）","version":"0.2.0","author":"Firehaha","description":"接收插件發布頁的 ?fh-install=插件ID，下載並驗證插件後，直接交給 FirehahaPlugins.installSource() 使用主程式原生安裝流程。"}

FirehahaPlugins.register({
  id: "official.plugin-install-receiver",

  setup(api) {
    "use strict";

    const PARAM = "fh-install";
    const SOURCE_PARAM = "fh-install-source";
    const INDEX_URL = "./plugin-index.json";

    function cleanUrl() {
      try {
        const url = new URL(location.href);
        url.searchParams.delete(PARAM);
        url.searchParams.delete(SOURCE_PARAM);
        history.replaceState(null, "", url.href);
      } catch (_) {}
    }

    function parseMetadata(code) {
      const match = String(code || "").match(
        /\/\/\s*@firehaha-plugin\s*(\{[^\r\n]*\})/
      );

      if (!match) {
        throw new Error("下載的 JS 缺少 @firehaha-plugin 標頭");
      }

      let meta;
      try {
        meta = JSON.parse(match[1]);
      } catch (_) {
        throw new Error("@firehaha-plugin 標頭不是有效 JSON");
      }

      if (!meta || !meta.id) {
        throw new Error("插件標頭缺少 id");
      }

      if (!/FirehahaPlugins\.register\s*\(/.test(code)) {
        throw new Error("插件缺少 FirehahaPlugins.register()");
      }

      return meta;
    }

    async function runInstallRequest() {
      const params = new URLSearchParams(location.search);
      const requestedId = String(params.get(PARAM) || "").trim();

      if (!requestedId) return;

      /*
       * 先移除網址參數，避免重新整理後再次觸發安裝。
       * requestedId 已經保存在區域變數裡，不影響後續流程。
       */
      cleanUrl();

      try {
        api.toast("正在取得插件：" + requestedId);

        const indexResponse = await fetch(INDEX_URL, {
          cache: "no-store"
        });

        if (!indexResponse.ok) {
          throw new Error(
            "無法讀取 plugin-index.json（HTTP " +
            indexResponse.status +
            "）"
          );
        }

        const index = await indexResponse.json();
        const entry = index && index[requestedId];

        if (!entry) {
          throw new Error(
            "plugin-index.json 找不到插件：" + requestedId
          );
        }

        if (!entry.file) {
          throw new Error("插件索引缺少 file 欄位");
        }

        const pluginUrl = new URL(entry.file, location.href);

        const pluginResponse = await fetch(pluginUrl.href, {
          cache: "no-store"
        });

        if (!pluginResponse.ok) {
          throw new Error(
            "插件 JS 下載失敗（HTTP " +
            pluginResponse.status +
            "）"
          );
        }

        const code = await pluginResponse.text();
        const meta = parseMetadata(code);

        /*
         * 防止 manifest 指向錯誤插件。
         */
        if (String(meta.id) !== requestedId) {
          throw new Error(
            "插件 ID 不一致。\n" +
            "要求：" + requestedId + "\n" +
            "實際：" + meta.id
          );
        }

        /*
         * index.json 的版本如果有填，也順便比對。
         * 版本不同時不直接拒絕，避免發布時只忘了更新索引；
         * 但會在 console 留下警告。
         */
        if (
          entry.version &&
          meta.version &&
          String(entry.version) !== String(meta.version)
        ) {
          console.warn(
            "[Plugin Install Receiver] manifest/version mismatch:",
            entry.version,
            meta.version
          );
        }

        if (
          !window.FirehahaPlugins ||
          typeof window.FirehahaPlugins.installSource !== "function"
        ) {
          throw new Error(
            "目前 FirehahaPlugins.installSource() 不可用，" +
            "無法交給主程式原生插件管理器安裝。"
          );
        }

        /*
         * 關鍵：
         * 不 eval、不自行寫 IndexedDB。
         * 直接走 firehaha.html 已有的原生安裝流程。
         *
         * false = 外部／一般插件，不冒充 bundled official plugin。
         */
        const result =
          await window.FirehahaPlugins.installSource(
            code,
            false
          );

        console.info(
          "[Plugin Install Receiver] installSource completed:",
          requestedId,
          result
        );

      } catch (error) {
        console.error(
          "[Plugin Install Receiver 0.2.0]",
          error
        );

        alert(
          "插件一鍵安裝失敗：\n\n" +
          (error && error.message
            ? error.message
            : String(error))
        );
      }
    }

    /*
     * setup 完成後才處理 deeplink。
     * 避免插件管理器本身還在初始化。
     */
    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        function () {
          setTimeout(runInstallRequest, 0);
        },
        { once: true }
      );
    } else {
      setTimeout(runInstallRequest, 0);
    }

    api.toast("插件安裝接收器 0.2 已啟用");

    return function cleanup() {};
  }
});
