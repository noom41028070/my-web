// @firehaha-plugin {"id":"official.install-demo","name":"一鍵安裝測試插件","version":"0.1.0","author":"Firehaha","description":"用來測試 plugin-install.html → firehaha.html → 安裝接收器 的發布流程。"}

FirehahaPlugins.register({
  id: "official.install-demo",

  setup(api) {
    const removeTransform =
      api.registerReaderTransform(
        "install-demo",
        function(html){
          return html.replace(
            "</body>",
            '<div style="position:fixed;left:8px;bottom:8px;opacity:.5;font:11px system-ui">Plugin install demo active</div></body>'
          );
        },
        500
      );

    api.toast("一鍵安裝測試插件已啟用");

    return function cleanup(){
      removeTransform();
    };
  }
});
