// @firehaha-plugin {"id":"official.render-scheduler","name":"流程圖重繪排程器","version":"1.0.0","author":"Firehaha","description":"合併流程圖短時間內的重複連線重繪請求，降低大型專案拖曳時的負擔。"}

FirehahaPlugins.register({
  id: "official.render-scheduler",
  name: "流程圖重繪排程器",
  version: "1.0.0",

  async setup(api) {
    "use strict";

    const READY_TIMEOUT =
      12000;

    let frameId =
      0;

    let pending =
      false;

    let destroyed =
      false;

    let requestCount =
      0;

    let actualDrawCount =
      0;

    let lastDrawTime =
      0;


    async function waitForRenderCore() {
      const startedAt =
        Date.now();

      while (
        (
          !window.FirehahaRenderCore ||
          typeof window.FirehahaRenderCore
            .drawImmediately !== "function"
        ) &&
        Date.now() - startedAt <
          READY_TIMEOUT
      ) {
        await new Promise(resolve => {
          setTimeout(resolve, 80);
        });
      }

      if (
        !window.FirehahaRenderCore ||
        typeof window.FirehahaRenderCore
          .drawImmediately !== "function"
      ) {
        throw new Error(
          "找不到 FirehahaRenderCore.drawImmediately，請先在主程式加入渲染橋樑"
        );
      }
    }


    await waitForRenderCore();

    const core =
      window.FirehahaRenderCore;

    const previousRequestLines =
      core.requestLines;


    function performDraw() {
      frameId =
        0;

      pending =
        false;

      if (destroyed) {
        return;
      }

      const startedAt =
        performance.now();

      try {
        core.drawImmediately();

      } catch (error) {
        console.error(
          "[Firehaha Render Scheduler]",
          error
        );

        return;
      }

      actualDrawCount++;

      lastDrawTime =
        performance.now() -
        startedAt;

      document.dispatchEvent(
        new CustomEvent(
          "firehaha:lines-rendered",
          {
            detail: {
              duration:
                lastDrawTime,

              requestCount,

              actualDrawCount
            }
          }
        )
      );
    }


    function requestLines() {
      requestCount++;

      if (
        destroyed ||
        pending
      ) {
        return;
      }

      pending =
        true;

      frameId =
        requestAnimationFrame(
          performDraw
        );
    }


    function forceLines() {
      if (frameId) {
        cancelAnimationFrame(
          frameId
        );

        frameId =
          0;
      }

      pending =
        false;

      performDraw();
    }


    core.requestLines =
      requestLines;

    core.forceLines =
      forceLines;

    core.getRenderStats =
      function getRenderStats() {
        return {
          pending,

          requestCount,

          actualDrawCount,

          savedDraws:
            Math.max(
              0,
              requestCount -
              actualDrawCount
            ),

          lastDrawTime
        };
      };


    api.toast(
      "流程圖重繪排程器已啟用"
    );


    return function cleanup() {
      destroyed =
        true;

      if (frameId) {
        cancelAnimationFrame(
          frameId
        );

        frameId =
          0;
      }

      if (
        core.requestLines ===
        requestLines
      ) {
        if (
          typeof previousRequestLines ===
          "function"
        ) {
          core.requestLines =
            previousRequestLines;

        } else {
          delete core.requestLines;
        }
      }

      if (
        core.forceLines ===
        forceLines
      ) {
        delete core.forceLines;
      }

      delete core.getRenderStats;
    };
  }
});