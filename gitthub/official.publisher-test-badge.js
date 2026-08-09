// @firehaha-plugin {"id":"official.publisher-test-badge","name":"發布流程測試徽章","version":"1.0.0","author":"Firehaha","description":"用來測試 Plugin Publisher / Plugin Hub 一鍵發布流程。啟用後會在 Reader 左下角顯示一個淡淡的 TEST 徽章。","category":"test","tags":["發布測試","Plugin Hub"],"status":"experimental"}

FirehahaPlugins.register({
  id: "official.publisher-test-badge",

  setup(api) {
    "use strict";

    const removeTransform =
      api.registerReaderTransform(
        "publisher-test-badge",
        function(html) {
          html = String(html == null ? "" : html);

          if (
            html.includes(
              'data-fh-publisher-test-badge="1.0.0"'
            )
          ) {
            return html;
          }

          const injected = String.raw`
<style data-fh-publisher-test-badge="1.0.0">
#fhPublisherTestBadge{
  position:fixed;
  left:10px;
  bottom:10px;
  z-index:9999;
  padding:5px 8px;
  border:1px solid rgba(100,116,139,.25);
  border-radius:999px;
  background:rgba(255,255,255,.72);
  color:#64748b;
  font:800 10px/1 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;
  opacity:.65;
  pointer-events:none;
}
body.reader-dark #fhPublisherTestBadge{
  background:rgba(30,41,59,.75);
  color:#cbd5e1;
  border-color:#475569;
}
</style>
<div id="fhPublisherTestBadge">TEST PLUGIN</div>
`;

          if (/<\/body\s*>/i.test(html)) {
            return html.replace(
              /<\/body\s*>/i,
              injected + "\n</body>"
            );
          }

          return html + injected;
        },
        700
      );

    api.toast(
      "發布流程測試徽章已啟用"
    );

    return function cleanup() {
      removeTransform();
    };
  }
});
