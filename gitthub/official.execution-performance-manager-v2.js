// @firehaha-plugin {"id":"official.execution-performance-manager-v2","name":"執行效率總管 V2","version":"2.0.0","author":"Firehaha","description":"重磅效能調度器：整合預覽去重、繪線合併、長文字自適應、空閒排程、拖曳降載、背景暫停、長任務偵測與正確的增量統計。"}

FirehahaPlugins.register({

  id:
    "official.execution-performance-manager-v2",

  name:
    "執行效率總管 V2",

  version:
    "2.0.0",


  async setup(api){

    "use strict";


    // =====================================================
    // 基本設定
    // =====================================================

    const READY_TIMEOUT =
      15000;


    const DEFAULT_PROFILE =
      "balanced";


    const MAX_PREVIEW_WAIT = {

      performance:
        500,

      balanced:
        900,

      saver:
        1600

    };


    const PROFILE_MULTIPLIER = {

      performance:
        0.7,

      balanced:
        1,

      saver:
        1.55

    };


    // =====================================================
    // 等待核心
    // =====================================================

    const waitStartedAt =
      Date.now();


    while(
      !window.GamebookCore &&
      Date.now() - waitStartedAt <
        READY_TIMEOUT
    ){

      await new Promise(
        resolve => {

          setTimeout(
            resolve,
            80
          );

        }
      );

    }


    if(!window.GamebookCore){

      throw new Error(
        "找不到 GamebookCore"
      );

    }


    const core =
      window.GamebookCore;


    const cleanupFunctions =
      [];


    const pageText =
      document.getElementById(
        "pageText"
      );


    // =====================================================
    // 執行狀態
    // =====================================================

    let destroyed =
      false;


    let suspended =
      false;


    let dragging =
      false;


    let profile =
      DEFAULT_PROFILE;


    let previewTimer =
      0;


    let previewIdleHandle =
      0;


    let previewFirstRequestAt =
      0;


    let pendingPreviewArgs =
      null;


    let lineFrame =
      0;


    let pendingLineArgs =
      null;


    let lastLineFrameAt =
      0;


    let adaptivePenalty =
      0;


    let longTaskObserver =
      null;


    // =====================================================
    // 保存原始核心方法
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
    // RenderCore 基準值
    // =====================================================

    function readRenderStats(){

      try{

        return (
          window.FirehahaRenderCore
            ?.getRenderStats?.() ||
          null
        );

      }catch(error){

        return null;

      }

    }


    let renderBaseline =
      readRenderStats();


    // =====================================================
    // 統計
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

      forcedPreviewUpdates:
        0,

      idlePreviewUpdates:
        0,

      previewErrors:
        0,

      previewTotalDuration:
        0,

      previewMaxDuration:
        0,

      lastPreviewDuration:
        0,

      lastPreviewAt:
        0,


      lineRequests:
        0,

      localActualLineDraws:
        0,

      localSavedLineDraws:
        0,

      lineErrors:
        0,

      lineTotalDuration:
        0,

      lineMaxDuration:
        0,

      lastLineDuration:
        0,

      lastLineAt:
        0,


      hiddenDeferrals:
        0,

      suspendedDeferrals:
        0,

      dragDeferrals:
        0,


      longTasks:
        0,

      longTaskTotalDuration:
        0,

      lastLongTaskDuration:
        0,


      modeChanges:
        0,

      profileChanges:
        0,

      maximumWaitFlushes:
        0

    };


    // =====================================================
    // 工具
    // =====================================================

    function toast(message){

      if(
        api &&
        typeof api.toast ===
          "function"
      ){

        api.toast(
          message
        );

        return;
      }


      console.log(
        "[Performance V2]",
        message
      );

    }


    function safeNumber(
      value,
      fallback
    ){

      const number =
        Number(value);


      return Number.isFinite(number)
        ? number
        : fallback;

    }


    function round(
      value,
      digits
    ){

      const power =
        10 **
        (
          digits || 0
        );


      return Math.round(
        value * power
      ) / power;

    }


    function cancelIdle(handle){

      if(!handle){
        return;
      }


      if(
        typeof cancelIdleCallback ===
          "function"
      ){

        cancelIdleCallback(
          handle
        );

      }else{

        clearTimeout(
          handle
        );

      }

    }


    function scheduleIdle(
      callback,
      timeout
    ){

      if(
        typeof requestIdleCallback ===
          "function"
      ){

        return requestIdleCallback(
          callback,
          {
            timeout
          }
        );

      }


      return window.setTimeout(
        () => {

          callback({

            didTimeout:
              true,

            timeRemaining(){

              return 0;

            }

          });

        },
        Math.min(
          timeout,
          80
        )
      );

    }


    function getCurrentTextLength(){

      if(pageText){

        return String(
          pageText.value ||
          ""
        ).length;

      }


      return String(
        core.currentPage?.text ||
        ""
      ).length;

    }


    function getDeviceInfo(){

      return {

        hardwareConcurrency:
          safeNumber(
            navigator.hardwareConcurrency,
            4
          ),

        deviceMemory:
          safeNumber(
            navigator.deviceMemory,
            4
          ),

        mobile:
          matchMedia(
            "(pointer:coarse)"
          ).matches,

        reducedMotion:
          matchMedia(
            "(prefers-reduced-motion: reduce)"
          ).matches

      };

    }


    const deviceInfo =
      getDeviceInfo();


    // =====================================================
    // 自動模式判定
    // =====================================================

    function getTextMode(){

      const length =
        getCurrentTextLength();


      if(length >= 300000){

        return {

          name:
            "ultra-long",

          length,

          baseDelay:
            720,

          useIdle:
            true

        };

      }


      if(length >= 100000){

        return {

          name:
            "very-long",

          length,

          baseDelay:
            480,

          useIdle:
            true

        };

      }


      if(length >= 30000){

        return {

          name:
            "long",

          length,

          baseDelay:
            280,

          useIdle:
            true

        };

      }


      if(length >= 8000){

        return {

          name:
            "medium",

          length,

          baseDelay:
            155,

          useIdle:
            false

        };

      }


      return {

        name:
          "normal",

        length,

        baseDelay:
          85,

        useIdle:
          false

      };

    }


    let currentMode =
      getTextMode();


    function updateMode(){

      const next =
        getTextMode();


      if(
        next.name !==
          currentMode.name
      ){

        stats.modeChanges++;

      }


      currentMode =
        next;


      return next;

    }


    function getAdaptiveDelay(){

      const mode =
        updateMode();


      let delay =
        mode.baseDelay;


      delay *=
        PROFILE_MULTIPLIER[
          profile
        ] || 1;


      if(
        deviceInfo.mobile
      ){

        delay *=
          1.18;

      }


      if(
        deviceInfo.hardwareConcurrency <=
          4
      ){

        delay *=
          1.12;

      }


      if(
        deviceInfo.deviceMemory <=
          4
      ){

        delay *=
          1.12;

      }


      if(dragging){

        delay =
          Math.max(
            delay,
            280
          );

      }


      delay +=
        adaptivePenalty;


      return Math.round(
        Math.min(
          1400,
          Math.max(
            45,
            delay
          )
        )
      );

    }


    // =====================================================
    // 原始預覽執行
    // =====================================================

    function executeOriginalPreview(
      args,
      source
    ){

      if(
        destroyed ||
        !original.updatePreview
      ){

        return;

      }


      if(suspended){

        stats
          .suspendedDeferrals++;


        pendingPreviewArgs =
          args || [];


        return;

      }


      if(document.hidden){

        stats
          .hiddenDeferrals++;


        pendingPreviewArgs =
          args || [];


        return;

      }


      if(dragging){

        stats
          .dragDeferrals++;


        pendingPreviewArgs =
          args || [];


        return;

      }


      const started =
        performance.now();


      try{

        original.updatePreview.apply(
          core,
          args || []
        );

      }catch(error){

        stats.previewErrors++;


        console.error(
          "[Performance V2] 預覽更新失敗",
          error
        );

      }finally{

        const duration =
          performance.now() -
          started;


        stats
          .actualPreviewUpdates++;


        stats.previewTotalDuration +=
          duration;


        stats.lastPreviewDuration =
          duration;


        stats.previewMaxDuration =
          Math.max(
            stats.previewMaxDuration,
            duration
          );


        stats.lastPreviewAt =
          Date.now();


        if(
          source === "idle"
        ){

          stats.idlePreviewUpdates++;

        }


        /*
         * 預覽耗時過長時，自動增加下次延遲。
         */
        if(duration >= 80){

          adaptivePenalty =
            Math.min(
              500,
              adaptivePenalty + 80
            );

        }else if(
          duration <= 20
        ){

          adaptivePenalty =
            Math.max(
              0,
              adaptivePenalty - 20
            );

        }

      }

    }


    // =====================================================
    // 預覽排程
    // =====================================================

    function clearPreviewSchedule(){

      if(previewTimer){

        clearTimeout(
          previewTimer
        );


        previewTimer =
          0;

      }


      if(previewIdleHandle){

        cancelIdle(
          previewIdleHandle
        );


        previewIdleHandle =
          0;

      }

    }


    function runPendingPreview(
      source
    ){

      clearPreviewSchedule();


      if(
        !pendingPreviewArgs
      ){

        previewFirstRequestAt =
          0;


        return;

      }


      const args =
        pendingPreviewArgs;


      pendingPreviewArgs =
        null;


      previewFirstRequestAt =
        0;


      executeOriginalPreview(
        args,
        source
      );

    }


    function schedulePreviewExecution(){

      clearPreviewSchedule();


      const mode =
        updateMode();


      const delay =
        getAdaptiveDelay();


      const maxWait =
        MAX_PREVIEW_WAIT[
          profile
        ] ||
        MAX_PREVIEW_WAIT.balanced;


      const elapsed =
        previewFirstRequestAt
          ? Date.now() -
            previewFirstRequestAt
          : 0;


      if(
        elapsed >=
          maxWait
      ){

        stats
          .maximumWaitFlushes++;


        stats
          .forcedPreviewUpdates++;


        runPendingPreview(
          "max-wait"
        );


        return;

      }


      previewTimer =
        window.setTimeout(
          () => {

            previewTimer =
              0;


            if(
              mode.useIdle
            ){

              previewIdleHandle =
                scheduleIdle(
                  () => {

                    previewIdleHandle =
                      0;


                    runPendingPreview(
                      "idle"
                    );

                  },
                  Math.max(
                    180,
                    maxWait -
                    elapsed
                  )
                );

            }else{

              runPendingPreview(
                "timer"
              );

            }

          },
          delay
        );

    }


    function requestPreview(
      ...args
    ){

      stats.previewRequests++;


      if(
        pendingPreviewArgs
      ){

        stats
          .savedPreviewUpdates++;

      }


      pendingPreviewArgs =
        args;


      if(
        !previewFirstRequestAt
      ){

        previewFirstRequestAt =
          Date.now();

      }


      schedulePreviewExecution();

    }


    // =====================================================
    // 繪線排程
    // =====================================================

    function getRenderCore(){

      const renderCore =
        window.FirehahaRenderCore;


      if(
        renderCore &&
        typeof renderCore.requestLines ===
          "function"
      ){

        return renderCore;

      }


      return null;

    }


    function executeOriginalLines(
      args
    ){

      if(
        destroyed ||
        !original.drawLines
      ){

        return;

      }


      if(suspended){

        stats
          .suspendedDeferrals++;


        pendingLineArgs =
          args || [];


        return;

      }


      if(document.hidden){

        stats
          .hiddenDeferrals++;


        pendingLineArgs =
          args || [];


        return;

      }


      const started =
        performance.now();


      try{

        original.drawLines.apply(
          core,
          args || []
        );

      }catch(error){

        stats.lineErrors++;


        console.error(
          "[Performance V2] 繪線失敗",
          error
        );

      }finally{

        const duration =
          performance.now() -
          started;


        stats
          .localActualLineDraws++;


        stats.lineTotalDuration +=
          duration;


        stats.lastLineDuration =
          duration;


        stats.lineMaxDuration =
          Math.max(
            stats.lineMaxDuration,
            duration
          );


        stats.lastLineAt =
          Date.now();

      }

    }


    function requestLines(
      ...args
    ){

      stats.lineRequests++;


      pendingLineArgs =
        args;


      const renderCore =
        getRenderCore();


      if(renderCore){

        try{

          renderCore.requestLines(
            ...args
          );


          pendingLineArgs =
            null;

        }catch(error){

          console.warn(
            "[Performance V2] RenderCore 請求失敗",
            error
          );

        }


        return;

      }


      if(lineFrame){

        stats
          .localSavedLineDraws++;


        return;

      }


      lineFrame =
        requestAnimationFrame(
          time => {

            lineFrame =
              0;


            lastLineFrameAt =
              time;


            const nextArgs =
              pendingLineArgs ||
              [];


            pendingLineArgs =
              null;


            executeOriginalLines(
              nextArgs
            );

          }
        );

    }


    // =====================================================
    // Flush
    // =====================================================

    function flushPreview(){

      if(
        !pendingPreviewArgs
      ){

        return;

      }


      stats
        .forcedPreviewUpdates++;


      runPendingPreview(
        "flush"
      );

    }


    function flushLines(){

      const renderCore =
        getRenderCore();


      if(
        renderCore &&
        typeof renderCore.forceLines ===
          "function"
      ){

        try{

          renderCore.forceLines();


          pendingLineArgs =
            null;


          return;

        }catch(error){}

      }


      if(lineFrame){

        cancelAnimationFrame(
          lineFrame
        );


        lineFrame =
          0;

      }


      if(pendingLineArgs){

        const args =
          pendingLineArgs;


        pendingLineArgs =
          null;


        executeOriginalLines(
          args
        );

      }

    }


    function flushAll(){

      flushLines();

      flushPreview();

    }


    // =====================================================
    // 包裝核心方法
    // =====================================================

    if(
      original.updatePreview
    ){

      core.updatePreview =
        requestPreview;

    }


    if(
      original.drawLines
    ){

      core.drawLines =
        requestLines;

    }


    // =====================================================
    // 拖曳降載
    // =====================================================

    function isHeavyDragTarget(
      target
    ){

      return Boolean(
        target?.closest?.(
          [
            ".flowNode",
            ".fhv3-folder-node",
            ".fhp-folder-node",
            ".fh-folder-node",
            ".note",
            ".sticky-note"
          ].join(",")
        )
      );

    }


    function onPointerDown(
      event
    ){

      if(
        isHeavyDragTarget(
          event.target
        )
      ){

        dragging =
          true;

      }

    }


    function onPointerUp(){

      if(!dragging){
        return;
      }


      dragging =
        false;


      /*
       * 拖曳完成後補最後一次。
       */
      requestLines();


      if(
        pendingPreviewArgs
      ){

        schedulePreviewExecution();

      }

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
    // 背景頁籤
    // =====================================================

    function onVisibilityChange(){

      if(document.hidden){
        return;
      }


      /*
       * 回到前景時只補一次最新狀態。
       */
      requestLines();


      if(
        pendingPreviewArgs
      ){

        schedulePreviewExecution();

      }

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
    // 長任務偵測
    // =====================================================

    if(
      typeof PerformanceObserver ===
        "function"
    ){

      try{

        longTaskObserver =
          new PerformanceObserver(
            list => {

              list
                .getEntries()
                .forEach(
                  entry => {

                    const duration =
                      safeNumber(
                        entry.duration,
                        0
                      );


                    stats.longTasks++;


                    stats
                      .longTaskTotalDuration +=
                      duration;


                    stats
                      .lastLongTaskDuration =
                      duration;


                    /*
                     * 若短時間出現長任務，
                     * 自動提高預覽延遲。
                     */
                    if(duration >= 100){

                      adaptivePenalty =
                        Math.min(
                          500,
                          adaptivePenalty +
                          40
                        );

                    }

                  }
                );

            }
          );


        longTaskObserver.observe(
          {
            entryTypes: [
              "longtask"
            ]
          }
        );


        cleanupFunctions.push(
          () => {

            longTaskObserver
              ?.disconnect();

          }
        );

      }catch(error){

        longTaskObserver =
          null;

      }

    }


    // =====================================================
    // 專案切換後補更新
    // =====================================================

    const unsubscribeSelected =
      core.on?.(
        "page:selected",
        () => {

          adaptivePenalty =
            Math.max(
              0,
              adaptivePenalty - 30
            );


          requestPreview();

          requestLines();

        }
      );


    if(
      typeof unsubscribeSelected ===
        "function"
    ){

      cleanupFunctions.push(
        unsubscribeSelected
      );

    }


    // =====================================================
    // 統計計算
    // =====================================================

    function getRenderDelta(){

      const current =
        readRenderStats();


      if(
        !current ||
        !renderBaseline
      ){

        return {

          actual:
            stats.localActualLineDraws,

          saved:
            stats.localSavedLineDraws

        };

      }


      return {

        actual:
          Math.max(
            0,
            safeNumber(
              current.actualDrawCount,
              0
            ) -
            safeNumber(
              renderBaseline.actualDrawCount,
              0
            )
          ),

        saved:
          Math.max(
            0,
            safeNumber(
              current.savedDraws,
              0
            ) -
            safeNumber(
              renderBaseline.savedDraws,
              0
            )
          )

      };

    }


    function resetStats(){

      stats.startedAt =
        Date.now();


      stats.previewRequests =
        0;

      stats.actualPreviewUpdates =
        0;

      stats.savedPreviewUpdates =
        0;

      stats.forcedPreviewUpdates =
        0;

      stats.idlePreviewUpdates =
        0;

      stats.previewErrors =
        0;

      stats.previewTotalDuration =
        0;

      stats.previewMaxDuration =
        0;

      stats.lastPreviewDuration =
        0;

      stats.lastPreviewAt =
        0;


      stats.lineRequests =
        0;

      stats.localActualLineDraws =
        0;

      stats.localSavedLineDraws =
        0;

      stats.lineErrors =
        0;

      stats.lineTotalDuration =
        0;

      stats.lineMaxDuration =
        0;

      stats.lastLineDuration =
        0;

      stats.lastLineAt =
        0;


      stats.hiddenDeferrals =
        0;

      stats.suspendedDeferrals =
        0;

      stats.dragDeferrals =
        0;


      stats.longTasks =
        0;

      stats.longTaskTotalDuration =
        0;

      stats.lastLongTaskDuration =
        0;


      stats.modeChanges =
        0;

      stats.maximumWaitFlushes =
        0;


      renderBaseline =
        readRenderStats();

    }


    // =====================================================
    // 對外 API
    // =====================================================

    window.FirehahaPerformanceManager = {

      version:
        "2.0.0",


      requestPreview,

      requestLines,

      flush:
        flushAll,


      suspend(){

        suspended =
          true;

      },


      resume(options){

        suspended =
          false;


        if(
          options?.flush !==
            false
        ){

          flushAll();

        }

      },


      isSuspended(){

        return suspended;

      },


      setProfile(nextProfile){

        const allowed =
          new Set([
            "performance",
            "balanced",
            "saver"
          ]);


        if(
          !allowed.has(
            nextProfile
          )
        ){

          throw new Error(
            "模式只能是 performance、balanced 或 saver"
          );

        }


        if(
          profile !==
            nextProfile
        ){

          stats.profileChanges++;

        }


        profile =
          nextProfile;


        return profile;

      },


      getProfile(){

        return profile;

      },


      resetStats,


      getStats(){

        const renderDelta =
          getRenderDelta();


        const mode =
          updateMode();


        const previewSaveRate =
          stats.previewRequests
            ? (
                stats.savedPreviewUpdates /
                stats.previewRequests
              ) *
              100
            : 0;


        const lineTotal =
          renderDelta.actual +
          renderDelta.saved;


        const lineSaveRate =
          lineTotal
            ? (
                renderDelta.saved /
                lineTotal
              ) *
              100
            : 0;


        return {

          version:
            "2.0.0",


          active:
            !destroyed,

          suspended,

          dragging,

          documentHidden:
            document.hidden,


          profile,

          currentMode:
            mode.name,

          currentTextLength:
            mode.length,

          previewDelay:
            getAdaptiveDelay(),

          adaptivePenalty,


          previewRequests:
            stats.previewRequests,

          actualPreviewUpdates:
            stats.actualPreviewUpdates,

          savedPreviewUpdates:
            stats.savedPreviewUpdates,

          forcedPreviewUpdates:
            stats.forcedPreviewUpdates,

          idlePreviewUpdates:
            stats.idlePreviewUpdates,

          previewSaveRate:
            round(
              previewSaveRate,
              1
            ),

          averagePreviewDuration:
            stats.actualPreviewUpdates
              ? round(
                  stats.previewTotalDuration /
                  stats.actualPreviewUpdates,
                  3
                )
              : 0,

          lastPreviewDuration:
            round(
              stats.lastPreviewDuration,
              3
            ),

          maximumPreviewDuration:
            round(
              stats.previewMaxDuration,
              3
            ),

          previewErrors:
            stats.previewErrors,


          lineRequests:
            stats.lineRequests,

          actualLineDraws:
            renderDelta.actual,

          savedLineDraws:
            renderDelta.saved,

          lineSaveRate:
            round(
              lineSaveRate,
              1
            ),

          averageLineDuration:
            stats.localActualLineDraws
              ? round(
                  stats.lineTotalDuration /
                  stats.localActualLineDraws,
                  3
                )
              : 0,

          lastLineDuration:
            round(
              stats.lastLineDuration,
              3
            ),

          maximumLineDuration:
            round(
              stats.lineMaxDuration,
              3
            ),

          lineErrors:
            stats.lineErrors,


          hiddenDeferrals:
            stats.hiddenDeferrals,

          suspendedDeferrals:
            stats.suspendedDeferrals,

          dragDeferrals:
            stats.dragDeferrals,

          maximumWaitFlushes:
            stats.maximumWaitFlushes,


          longTasks:
            stats.longTasks,

          averageLongTaskDuration:
            stats.longTasks
              ? round(
                  stats.longTaskTotalDuration /
                  stats.longTasks,
                  2
                )
              : 0,

          lastLongTaskDuration:
            round(
              stats.lastLongTaskDuration,
              2
            ),


          liveFlowNodeCount:
            document.querySelectorAll(
              "#flowCanvas .flowNode"
            ).length,

          folderNodeCount:
            document.querySelectorAll(
              [
                ".fhv3-folder-node",
                ".fhp-folder-node",
                ".fh-folder-node"
              ].join(",")
            ).length,


          hardwareConcurrency:
            deviceInfo.hardwareConcurrency,

          deviceMemory:
            deviceInfo.deviceMemory,

          mobilePointer:
            deviceInfo.mobile,


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
              "2.0.0",

            profile

          }

        }
      )
    );


    toast(
      "執行效率總管 V2 已啟用"
    );


    // =====================================================
    // Cleanup
    // =====================================================

    return function cleanup(){

      destroyed =
        true;


      clearPreviewSchedule();


      if(lineFrame){

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


      if(
        original.updatePreview &&
        core.updatePreview ===
          requestPreview
      ){

        core.updatePreview =
          original.updatePreview;

      }


      if(
        original.drawLines &&
        core.drawLines ===
          requestLines
      ){

        core.drawLines =
          original.drawLines;

      }


      cleanupFunctions
        .splice(0)
        .reverse()
        .forEach(
          fn => {

            if(
              typeof fn !==
                "function"
            ){

              return;
            }


            try{

              fn();

            }catch(error){

              console.warn(
                "[Performance V2 cleanup]",
                error
              );

            }

          }
        );


      if(
        window.FirehahaPerformanceManager
      ){

        delete window
          .FirehahaPerformanceManager;

      }


      toast(
        "執行效率總管 V2 已停用"
      );

    };

  }

});