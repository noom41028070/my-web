// @firehaha-plugin {"id":"official.plugin-install-receiver","name":"插件安裝接收器（實驗）","version":"0.1.0","author":"Firehaha","description":"接收 plugin-install.html 傳入的 ?fh-install=插件ID，從 ./plugins/index.json 讀取插件並交給現有 FirehahaPlugins 安裝流程。實驗版。"}

FirehahaPlugins.register({
  id: "official.plugin-install-receiver",

  setup(api) {
    "use strict";

    const PARAM = "fh-install";
    const SOURCE_PARAM = "fh-install-source";
    const indexUrl = "./plugin-index.json";

    function cleanUrl(){
      try{
        const url = new URL(location.href);
        url.searchParams.delete(PARAM);
        url.searchParams.delete(SOURCE_PARAM);
        history.replaceState(null, "", url.href);
      }catch(_){}
    }

    function parseMetadata(code){
      const match = String(code || "").match(
        /\/\/\s*@firehaha-plugin\s*(\{[^\r\n]*\})/
      );

      if(!match){
        throw new Error("JS 缺少 @firehaha-plugin metadata");
      }

      let meta;
      try{
        meta = JSON.parse(match[1]);
      }catch(_){
        throw new Error("@firehaha-plugin metadata 不是有效 JSON");
      }

      if(!meta || !meta.id){
        throw new Error("插件 metadata 缺少 id");
      }

      if(!/FirehahaPlugins\.register\s*\(/.test(code)){
        throw new Error("JS 缺少 FirehahaPlugins.register()");
      }

      return meta;
    }

    /*
     * 優先尋找主程式本身可能已有的「從字串安裝插件」能力。
     * 若找不到，實驗版會提供下載後手動匯入的 fallback，
     * 不直接 eval 遠端 JS。
     */
    async function tryNativeInstall(code, meta){
      const candidates = [
        window.FirehahaPlugins && window.FirehahaPlugins.installFromText,
        window.FirehahaPlugins && window.FirehahaPlugins.importFromText,
        window.FirehahaPlugins && window.FirehahaPlugins.installCode,
        window.firehahaPluginInstallFromText,
        window.installPluginFromText
      ].filter(function(fn){
        return typeof fn === "function";
      });

      for(const fn of candidates){
        try{
          const result = await fn.call(
            window.FirehahaPlugins || window,
            code,
            {
              source:"deeplink",
              metadata:meta
            }
          );
          return {ok:true,result};
        }catch(error){
          console.warn("[Plugin Install Receiver] native install candidate failed", error);
        }
      }

      return {ok:false};
    }

    function downloadJs(code, filename){
      const blob = new Blob([code], {
        type:"text/javascript;charset=utf-8"
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "firehaha-plugin.js";
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(function(){
        URL.revokeObjectURL(url);
      }, 1000);
    }

    async function run(){
      const params = new URLSearchParams(location.search);
      const requestedId = (params.get(PARAM) || "").trim();

      if(!requestedId){
        return;
      }

      try{
        api.toast("收到插件安裝請求：" + requestedId);

        const indexRes = await fetch(indexUrl, {cache:"no-store"});
        if(!indexRes.ok){
          throw new Error("無法讀取 " + indexUrl);
        }

        const index = await indexRes.json();
        const entry = index[requestedId];

        if(!entry){
          throw new Error("插件索引找不到：" + requestedId);
        }

        const pluginUrl = new URL(entry.file, location.href);
        const pluginRes = await fetch(pluginUrl.href, {cache:"no-store"});

        if(!pluginRes.ok){
          throw new Error("插件 JS 下載失敗");
        }

        const code = await pluginRes.text();
        const meta = parseMetadata(code);

        if(meta.id !== requestedId){
          throw new Error(
            "插件 ID 不一致：網址要求 " +
            requestedId +
            "，JS 宣告 " +
            meta.id
          );
        }

        const ok = confirm(
          "安裝 Firehaha 插件？\n\n" +
          "名稱：" + (meta.name || meta.id) + "\n" +
          "ID：" + meta.id + "\n" +
          "版本：" + (meta.version || "?") + "\n" +
          "作者：" + (meta.author || "?") + "\n\n" +
          (meta.description || "")
        );

        if(!ok){
          cleanUrl();
          api.toast("已取消插件安裝");
          return;
        }

        const nativeResult = await tryNativeInstall(code, meta);

        if(nativeResult.ok){
          cleanUrl();
          api.toast((meta.name || meta.id) + " 已交給插件管理器安裝");
          return;
        }

        /*
         * 安全 fallback：
         * 現在主程式如果沒有公開「從字串安裝」API，
         * 就下載 JS，讓使用者走現有匯入按鈕。
         */
        downloadJs(
          code,
          (meta.id || "firehaha-plugin") + ".js"
        );

        cleanUrl();

        alert(
          "目前主程式沒有公開可直接接收 JS 文字的安裝 API。\n\n" +
          "已幫你下載：" + meta.id + ".js\n" +
          "請回到插件管理器，用現有「匯入 JS」安裝。\n\n" +
          "這代表「發布頁 → 主程式」跳轉已成功，" +
          "下一步只差把主程式現有匯入流程公開成 API。"
        );
      }catch(error){
        console.error("[Plugin Install Receiver]", error);
        cleanUrl();
        alert("插件安裝請求失敗：\n" + error.message);
      }
    }

    setTimeout(run, 0);

    return function cleanup(){};
  }
});
