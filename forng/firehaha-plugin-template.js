// @firehaha-plugin {"id":"official.example-toy","name":"官方範例玩具","version":"1.0.0","author":"你的名字","description":"示範安全生命週期與閱讀器同步"}
FirehahaPlugins.register({
  id: "official.example-toy",
  setup(api) {
    const removeStyle = api.addStyle("main", ".example-plugin-badge{color:#7c3aed;font-weight:800}");
    const removeTransform = api.registerReaderTransform("reader", function(html, context) {
      return html.replace("</body>", "<div class=\"example-plugin-badge\">插件已同步到閱讀器</div></body>");
    }, 200);
    api.toast("官方範例插件已啟用");
    return function cleanup() {
      removeTransform();
      removeStyle();
    };
  }
});
