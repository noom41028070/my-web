// @firehaha-plugin {"id":"official.demo-little-star","name":"小星星示範插件","version":"1.0.0","author":"Firehaha 官方開發者","description":"在測試與輸出閱讀器右下角顯示一顆無害的小星星，不讀寫專案或存檔。"}

FirehahaPlugins.register({
  id: "official.demo-little-star",

  setup(api) {
    // 這段 CSS 只會跟著 ReaderArtifact 進入測試與輸出閱讀器。
    const readerStyle = `
      <style id="little-star-demo-style">
        .little-star-demo {
          position: fixed;
          right: 18px;
          bottom: 18px;
          z-index: 9999;
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border: 1px solid rgba(255, 190, 40, 0.65);
          border-radius: 50%;
          background: rgba(255, 248, 218, 0.9);
          color: #d88a00;
          font-size: 23px;
          box-shadow: 0 6px 18px rgba(80, 55, 0, 0.18);
          pointer-events: none;
          animation: littleStarFloat 1.8s ease-in-out infinite;
        }

        @keyframes littleStarFloat {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-6px) rotate(5deg); }
        }
      </style>
    `;

    const readerElement = `
      <div class="little-star-demo"
           title="小星星示範插件"
           aria-label="小星星示範插件">★</div>
    `;

    const removeReaderTransform = api.registerReaderTransform(
      "little-star",
      function addLittleStar(html) {
        let output = html;

        if (!output.includes('id="little-star-demo-style"')) {
          output = output.replace("</head>", readerStyle + "</head>");
        }

        if (!output.includes('class="little-star-demo"')) {
          output = output.replace("</body>", readerElement + "</body>");
        }

        return output;
      },
      300
    );

    api.toast("小星星示範插件已啟用：測試閱讀時會看到右下角星星");

    // 停用或移除插件時，撤銷 ReaderArtifact 轉換。
    return function cleanup() {
      removeReaderTransform();
    };
  }
});
