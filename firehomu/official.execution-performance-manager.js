// @firehaha-plugin {"id":"official.execution-performance-manager","name":"執行效率總管","version":"1.0.0","author":"Firehaha","description":"合併重複預覽與繪線請求、背景頁籤暫停非必要更新、依正文長度自動調整延遲，並提供效能統計。"}

FirehahaPlugins.register({

  id:
    "official.execution-performance-manager",

  name:
    "執行效率總管",

  version:
    "1.0.0",


  async setup(api) {

    "use strict";


    // =====================================================
    // 等待主核心
    // =====================================================

    const READY_TIMEOUT =
      15000;


    const startedAt =
      Date.now();


    while (
      !window.GamebookCore &&
      Date.now() - startedAt <
        READY_TIMEOUT
    ) {

      await new Promise(
        resolve => {

          setTimeout(
            resolve,
            80
          );

        }
      );

    }


    if (!window.GamebookCore) {

      throw new Error(
        "找不到 GamebookCore"
      );

    }


    const core =
      window.GamebookCore;


    const cleanupFunctions =
      [];


    let destroyed =
      false;


    let suspended =
      false;


    let dragging =
      false;


    let previewTimer =
      0;


    let lineFrame =
      0;


    let pendingPreviewArgs =
      null;


    let pendingLineArgs =
      null;


    // =====================================================
    // 統計資料
    // =====================================================

    const stats = {

      startedAt:
        Date.now(),


      previewRequests:
        0,

      actualPreviewUpdates:
        0,

      savedPreviewUpdates:
        0,

      lastPreviewTime:
        0,

      lastPreviewDuration:
        0,


      lineRequests:
        0,

      actualLineDraws:
        0,

      savedLineDraws:
        0,

      lastLineTime:
        0,

      lastLineDuration:
        0,


      hiddenSkips:
        0,

      suspendedSkips:
        0,

      longTextModeEntries:
        0,


      currentMode:
        "normal",

      currentTextLength:
        0

    };


    // =====================================================
    // 保存核心原始函式
    // =====================================================

    const original = {

      updatePreview:
        typeof core.updatePreview ===
          "function"
          ? core.updatePreview
          : null,


      drawLines:
        typeof core.drawLines ===
          "function"
          ? core.drawLines
          : null

    };


    // =====================================================
    // 工具
    // =====================================================

    function toast(message) {

      if (
        api &&
        typeof api.toast ===
          "function"
      ) {

        api.toast(message);

        return;

      }


      console.log(
        "[Performance Manager]",
        message
      );

    }


    function getCurrentTextLength() {

      const pageText =
        document.getElementById(
          "pageText"
        );


      if (pageText) {

        return String(
          pageText.value || ""
        ).length;

      }


      return String(
        core.currentPage?.text || ""
      ).length;

    }


    // =====================================================
    // 依正文長度決定預覽延遲
    // =====================================================

    function getPreviewDelay() {

      const length =
        getCurrentTextLength();


      stats.currentTextLength =
        length;


      let mode =
        "normal";


      let delay =
        90;


      if (length >= 300000) {

        mode =
          "ultra-long";

        delay =
          700;

      } else if (
        length >= 100000
      ) {

        mode =
          "very-long";

        delay =
          450;

      } else if (
        length >= 30000
      ) {

        mode =
          "long";

        delay =
          260;

      } else if (
        length >= 8000
      ) {

        mode =
          "medium";

        delay =
          150;

      }


      if (
        mode !==
          stats.currentMode &&

        (
          mode === "long" ||
          mode === "very-long" ||
          mode === "ultra-long"
        )
      ) {

        stats
          .longTextModeEntries++;

      }


      stats.currentMode =
        mode;


      /*
       * 拖曳期間降低預覽更新頻率。
       */
      if (dragging) {

        delay =
          Math.max(
            delay,
            220
          );

      }


      return delay;

    }


    // =====================================================
    // 實際執行預覽
    // =====================================================

    function callOriginalPreview(
      args
    ) {

      if (
        destroyed ||
        suspended ||
        !original.updatePreview
      ) {

        if (suspended) {

          stats
            .suspendedSkips++;

        }


        return;

      }


      /*
       * 頁籤在背景時暫時不做預覽。
       */
      if (document.hidden) {

        stats.hiddenSkips++;


        pendingPreviewArgs =
          args;


        return;

      }


      const started =
        performance.now();


      try {

        original.updatePreview.apply(
          core,
          args || []
        );

      } catch (error) {

        console.error(
          "[Performance Manager] 預覽更新失敗",
          error
        );

      } finally {

        stats
          .actualPreviewUpdates++;


        stats.lastPreviewTime =
          Date.now();


        stats.lastPreviewDuration =
          performance.now() -
          started;

      }

    }


    // =====================================================
    // 預覽 Debounce
    // =====================================================

    function requestPreview(
      ...args
    ) {

      stats.previewRequests++;


      if (previewTimer) {

        clearTimeout(
          previewTimer
        );


        stats
          .savedPreviewUpdates++;

      }


      pendingPreviewArgs =
        args;


      const delay =
        getPreviewDelay();


      previewTimer =
        window.setTimeout(
          () => {

            previewTimer =
              0;


            const nextArgs =
              pendingPreviewArgs ||
              [];


            pendingPreviewArgs =
              null;


            callOriginalPreview(
              nextArgs
            );

          },

          delay
        );

    }


    // =====================================================
    // 實際繪線
    // =====================================================

    function callOriginalLines(
      args
    ) {

      if (
        destroyed ||
        suspended ||
        !original.drawLines
      ) {

        if (suspended) {

          stats
            .suspendedSkips++;

        }


        return;

      }


      /*
       * 背景頁籤不畫線。
       */
      if (document.hidden) {

        stats.hiddenSkips++;


        pendingLineArgs =
          args;


        return;

      }


      const started =
        performance.now();


      try {

        original.drawLines.apply(
          core,
          args || []
        );

      } catch (error) {

        console.error(
          "[Performance Manager] 繪線失敗",
          error
        );

      } finally {

        stats
          .actualLineDraws++;


        stats.lastLineTime =
          Date.now();


        stats.lastLineDuration =
          performance.now() -
          started;

      }

    }


    // =====================================================
    // 繪線 requestAnimationFrame 合併
    // =====================================================

    function requestLines(
      ...args
    ) {

      stats.lineRequests++;


      pendingLineArgs =
        args;


      if (lineFrame) {

        stats.savedLineDraws++;

        return;

      }


      lineFrame =
        requestAnimationFrame(
          () => {

            lineFrame =
              0;


            const nextArgs =
              pendingLineArgs ||
              [];


            pendingLineArgs =
              null;


            callOriginalLines(
              nextArgs
            );

          }
        );

    }


    // =====================================================
    // 強制完成等待中的更新
    // =====================================================

    function flushPreview() {

      if (previewTimer) {

        clearTimeout(
          previewTimer
        );


        previewTimer =
          0;

      }


      if (
        pendingPreviewArgs
      ) {

        const args =
          pendingPreviewArgs;


        pendingPreviewArgs =
          null;


        callOriginalPreview(
          args
        );

      }

    }


    function flushLines() {

      if (lineFrame) {

        cancelAnimationFrame(
          lineFrame
        );


        lineFrame =
          0;

      }


      if (
        pendingLineArgs
      ) {

        const args =
          pendingLineArgs;


        pendingLineArgs =
          null;


        callOriginalLines(
          args
        );

      }

    }


    // =====================================================
    // 包裝核心預覽函式
    //
    // 不碰：
    // - pages[]
    // - 正文資料
    // - 存檔
    // - 匯出
    // =====================================================

    if (
      original.updatePreview
    ) {

      core.updatePreview =
        requestPreview;

    }


    // =====================================================
    // 包裝繪線函式
    //
    // 若已有 FirehahaRenderCore，
    // 優先沿用原有排程器。
    // =====================================================

    if (
      window.FirehahaRenderCore &&
      typeof window
        .FirehahaRenderCore
        .requestLines ===
        "function"
    ) {

      const renderCore =
        window.FirehahaRenderCore;


      core.drawLines =
        function(
          ...args
        ) {

          stats.lineRequests++;


          const before =
            renderCore
              .getRenderStats?.();


          renderCore.requestLines(
            ...args
          );


          const after =
            renderCore
              .getRenderStats?.();


          if (
            before &&
            after &&

            Number(
              after.savedDraws
            ) >
            Number(
              before.savedDraws
            )
          ) {

            stats.savedLineDraws++;

          }

        };

    } else if (
      original.drawLines
    ) {

      core.drawLines =
        requestLines;

    }


    // =====================================================
    // 拖曳狀態
    // =====================================================

    function onPointerDown(
      event
    ) {

      if (
        event.target.closest?.(
          [
            ".flowNode",
            ".fhp-folder-node",
            ".fh-folder-node"
          ].join(",")
        )
      ) {

        dragging =
          true;

      }

    }


    function onPointerUp() {

      if (!dragging) {

        return;

      }


      dragging =
        false;


      /*
       * 拖曳結束後補一次線與預覽。
       */
      requestLines();

      requestPreview();

    }


    document.addEventListener(
      "pointerdown",
      onPointerDown,
      true
    );


    document.addEventListener(
      "pointerup",
      onPointerUp,
      true
    );


    document.addEventListener(
      "pointercancel",
      onPointerUp,
      true
    );


    cleanupFunctions.push(
      () => {

        document.removeEventListener(
          "pointerdown",
          onPointerDown,
          true
        );


        document.removeEventListener(
          "pointerup",
          onPointerUp,
          true
        );


        document.removeEventListener(
          "pointercancel",
          onPointerUp,
          true
        );

      }
    );


    // =====================================================
    // 背景頁籤恢復
    // =====================================================

    function onVisibilityChange() {

      if (
        document.hidden
      ) {

        return;

      }


      /*
       * 回到前景時，
       * 只補最後一次等待中的工作。
       */
      flushLines();

      flushPreview();

    }


    document.addEventListener(
      "visibilitychange",
      onVisibilityChange
    );


    cleanupFunctions.push(
      () => {

        document.removeEventListener(
          "visibilitychange",
          onVisibilityChange
        );

      }
    );


    // =====================================================
    // 對外 API
    // =====================================================

    window.FirehahaPerformanceManager = {

      version:
        "1.0.0",


      requestPreview,

      requestLines,


      flush() {

        flushLines();

        flushPreview();

      },


      suspend() {

        suspended =
          true;

      },


      resume(options) {

        suspended =
          false;


        if (
          options?.flush !==
            false
        ) {

          flushLines();

          flushPreview();

        }

      },


      isSuspended() {

        return suspended;

      },


      getStats() {

        const renderStats =
          window.FirehahaRenderCore
            ?.getRenderStats?.();


        return {

          version:
            "1.0.0",


          active:
            !destroyed,


          suspended,

          dragging,


          documentHidden:
            document.hidden,


          previewRequests:
            stats.previewRequests,


          actualPreviewUpdates:
            stats.actualPreviewUpdates,


          savedPreviewUpdates:
            stats.savedPreviewUpdates,


          previewSaveRate:
            stats.previewRequests
              ? Number(
                  (
                    stats.savedPreviewUpdates /
                    stats.previewRequests *
                    100
                  ).toFixed(1)
                )
              : 0,


          lastPreviewDuration:
            Number(
              stats
                .lastPreviewDuration
                .toFixed(3)
            ),


          lineRequests:
            stats.lineRequests,


          actualLineDraws:
            renderStats
              ?.actualDrawCount ??
            stats.actualLineDraws,


          savedLineDraws:
            renderStats
              ?.savedDraws ??
            stats.savedLineDraws,


          lastLineDuration:
            Number(
              stats
                .lastLineDuration
                .toFixed(3)
            ),


          hiddenSkips:
            stats.hiddenSkips,


          suspendedSkips:
            stats.suspendedSkips,


          longTextModeEntries:
            stats.longTextModeEntries,


          currentMode:
            stats.currentMode,


          currentTextLength:
            getCurrentTextLength(),


          previewDelay:
            getPreviewDelay(),


          liveFlowNodeCount:
            document
              .querySelectorAll(
                "#flowCanvas .flowNode"
              )
              .length,


          uptimeMs:
            Date.now() -
            stats.startedAt

        };

      }

    };


    // =====================================================
    // 通知其他外掛
    // =====================================================

    document.dispatchEvent(
      new CustomEvent(
        "firehaha:performance-manager-ready",
        {

          detail: {

            version:
              "1.0.0"

          }

        }
      )
    );


    toast(
      "執行效率總管已啟用"
    );


    // =====================================================
    // Cleanup
    // =====================================================

    return function cleanup() {

      destroyed =
        true;


      if (previewTimer) {

        clearTimeout(
          previewTimer
        );


        previewTimer =
          0;

      }


      if (lineFrame) {

        cancelAnimationFrame(
          lineFrame
        );


        lineFrame =
          0;

      }


      pendingPreviewArgs =
        null;


      pendingLineArgs =
        null;


      /*
       * 恢復核心原始函式。
       */
      if (
        original.updatePreview &&
        core.updatePreview ===
          requestPreview
      ) {

        core.updatePreview =
          original.updatePreview;

      }


      if (
        original.drawLines
      ) {

        core.drawLines =
          original.drawLines;

      }


      cleanupFunctions
        .splice(0)
        .reverse()
        .forEach(
          fn => {

            try {

              fn();

            } catch (error) {

              console.warn(
                "[Performance cleanup]",
                error
              );

            }

          }
        );


      if (
        window
          .FirehahaPerformanceManager
      ) {

        delete window
          .FirehahaPerformanceManager;

      }


      toast(
        "執行效率總管已停用"
      );

    };

  }

});