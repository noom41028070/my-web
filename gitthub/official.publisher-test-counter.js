// @firehaha-plugin {"id":"official.publisher-test-counter","name":"發布流程二號測試插件","version":"1.0.0","author":"Firehaha","description":"Plugin Publisher v3 的第二號測試插件。啟用後會在 Reader 右下角顯示 PUBLISH TEST #2，用來確認 Registry 能從 1 支正確合併成 2 支。","category":"test","tags":["發布測試","Plugin Hub","二號測試"],"status":"experimental"}

FirehahaPlugins.register({
  id: "official.publisher-test-counter",

  setup(api) {
    "use strict";

    const removeTransform = api.registerReaderTransform(
      "publisher-test-counter",
      function(html) {
        html = String(html == null ? "" : html);

        if (html.includes('data-fh-publisher-test-counter="1.0.0"')) {
          return html;
        }

        const injected = String.raw`
<style data-fh-publisher-test-counter="1.0.0">
#fhPublisherTestCounter{
  position:fixed;
  right:10px;
  bottom:10px;
  z-index:9998;
  padding:5px 8px;
  border:1px solid rgba(100,116,139,.25);
  border-radius:999px;
  background:rgba(255,255,255,.72);
  color:#64748b;
  font:800 10px/1 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;
  opacity:.65;
  pointer-events:none;
}
body.reader-dark #fhPublisherTestCounter{
  background:rgba(30,41,59,.75);
  color:#cbd5e1;
  border-color:#475569;
}
</style>
<div id="fhPublisherTestCounter">PUBLISH TEST #2</div>
`;

        if (/<\/body\s*>/i.test(html)) {
          return html.replace(/<\/body\s*>/i, injected + "\n</body>");
        }

        return html + injected;
      },
      710
    );

    api.toast("發布流程二號測試插件已啟用");

    return function cleanup() {
      removeTransform();
    };
  }
});
