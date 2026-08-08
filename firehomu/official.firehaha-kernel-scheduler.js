// @firehaha-plugin {"id":"official.firehaha-kernel-scheduler","name":"Firehaha 核心排程器","version":"1.0.0","author":"Firehaha","description":"為主程式與外掛提供統一工作排程：合併重複請求、分離畫面幀與空閒工作、背景暫停、優先級、批次處理、錯誤隔離與效能統計。"}

FirehahaPlugins.register({

  id:
    "official.firehaha-kernel-scheduler",

  name:
    "Firehaha 核心排程器",

  version:
    "1.0.0",


  async setup(api){

    "use strict";


    // =====================================================
    // 基本設定
    // =====================================================

    const READY_TIMEOUT =
      15000;


    const KERNEL_VERSION =
      "1.0.0";


    /*
     * frame：
     * 下一個動畫幀執行，適合：
     * - 畫線
     * - Node 徽章
     * - UI 狀態
     *
     * idle：
     * 瀏覽器較空閒時執行，適合：
     * - 預覽
     * - 統計
     * - 搜尋索引
     * - 插件掃描
     *
     * immediate：
     * 微任務執行，適合很短的小工作。
     */
    const VALID_LANES =
      new Set([
        "immediate",
        "frame",
        "idle"
      ]);


    /*
     * 數字越小，優先級越高。
     */
    const DEFAULT_PRIORITY =
      100;


    const DEFAULT_IDLE_TIMEOUT =
      1000;


    const MAX_HISTORY =
      80;


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


    /*
     * 不允許兩個 Kernel 同時存在。
     */
    if(
      window.FirehahaKernel &&
      window.FirehahaKernel.active
    ){

      throw new Error(
        "Firehaha 核心排程器已經啟用"
      );

    }


    const core =
      window.GamebookCore;


    let destroyed =
      false;


    let suspended =
      false;


    let batchDepth =
      0;


    let frameHandle =
      0;


    let idleHandle =
      0;


    let immediateQueued =
      false;


    let frameRunning =
      false;


    let idleRunning =
      false;


    let immediateRunning =
      false;


    const cleanupFunctions =
      [];


    // =====================================================
    // Job 資料
    // =====================================================

    /*
     * jobs：
     *
     * jobId → {
     *   id,
     *   lane,
     *   priority,
     *   timeout,
     *   run,
     *   enabled,
     *   pending,
     *   payload,
     *   requestCount,
     *   actualRunCount,
     *   savedRunCount,
     *   errorCount,
     *   totalDuration,
     *   maximumDuration,
     *   lastDuration,
     *   lastRunAt
     * }
     */
    const jobs =
      new Map();


    /*
     * 每條 lane 的待執行工作。
     */
    const pending = {

      immediate:
        new Set(),

      frame:
        new Set(),

      idle:
        new Set()

    };


    /*
     * 最近執行紀錄。
     */
    const history =
      [];


    const stats = {

      startedAt:
        Date.now(),

      totalRequests:
        0,

      totalRuns:
        0,

      totalSavedRuns:
        0,

      totalErrors:
        0,

      frameFlushes:
        0,

      idleFlushes:
        0,

      immediateFlushes:
        0,

      hiddenDeferrals:
        0,

      suspendedDeferrals:
        0,

      batchDeferrals:
        0,

      manualFlushes:
        0,

      longestTask:
        0,

      longestTaskId:
        null,

      lastFlushDuration:
        0,

      maximumFlushDuration:
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
        "[Firehaha Kernel]",
        message
      );

    }


    function now(){

      return performance.now();

    }


    function round(
      value,
      digits
    ){

      const number =
        Number(value) || 0;


      const power =
        10 **
        (
          Number(digits) || 0
        );


      return Math.round(
        number * power
      ) / power;

    }


    function normalizeId(value){

      const id =
        String(value || "")
          .trim();


      if(!id){

        throw new Error(
          "工作 ID 不可為空"
        );

      }


      return id;

    }


    function normalizeLane(value){

      const lane =
        String(
          value ||
          "frame"
        );


      if(
        !VALID_LANES.has(
          lane
        )
      ){

        throw new Error(
          `不支援的排程 lane：${lane}`
        );

      }


      return lane;

    }


    function normalizePriority(value){

      const number =
        Number(value);


      return Number.isFinite(number)
        ? number
        : DEFAULT_PRIORITY;

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


    function requestIdle(
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
            timeout:
              timeout ||
              DEFAULT_IDLE_TIMEOUT
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
        48
      );

    }


    function pushHistory(record){

      history.unshift(
        record
      );


      if(
        history.length >
          MAX_HISTORY
      ){

        history.length =
          MAX_HISTORY;

      }

    }


    function mergePayload(
      previous,
      next,
      strategy
    ){

      /*
       * 預設只保留最後一次資料。
       */
      if(
        typeof strategy !==
          "function"
      ){

        return next;

      }


      try{

        return strategy(
          previous,
          next
        );

      }catch(error){

        console.warn(
          "[Firehaha Kernel] payload 合併失敗",
          error
        );


        return next;

      }

    }


    // =====================================================
    // 註冊工作
    // =====================================================

    function registerJob(
      definition
    ){

      if(
        !definition ||
        typeof definition !==
          "object"
      ){

        throw new Error(
          "registerJob() 需要工作設定物件"
        );

      }


      const id =
        normalizeId(
          definition.id
        );


      if(
        jobs.has(id)
      ){

        throw new Error(
          `工作已經註冊：${id}`
        );

      }


      if(
        typeof definition.run !==
          "function"
      ){

        throw new Error(
          `工作 ${id} 缺少 run()`
        );

      }


      const job = {

        id,

        label:
          String(
            definition.label ||
            id
          ),

        lane:
          normalizeLane(
            definition.lane
          ),

        priority:
          normalizePriority(
            definition.priority
          ),

        timeout:
          Math.max(
            50,
            Number(
              definition.timeout
            ) ||
            DEFAULT_IDLE_TIMEOUT
          ),

        run:
          definition.run,

        merge:
          typeof definition.merge ===
            "function"
            ? definition.merge
            : null,

        enabled:
          definition.enabled !==
            false,

        runWhenHidden:
          definition.runWhenHidden ===
            true,

        pending:
          false,

        payload:
          undefined,

        requestCount:
          0,

        actualRunCount:
          0,

        savedRunCount:
          0,

        errorCount:
          0,

        totalDuration:
          0,

        maximumDuration:
          0,

        lastDuration:
          0,

        lastRunAt:
          0

      };


      jobs.set(
        id,
        job
      );


      document.dispatchEvent(
        new CustomEvent(
          "firehaha:kernel-job-registered",
          {
            detail: {
              id:
                job.id,

              lane:
                job.lane,

              priority:
                job.priority
            }
          }
        )
      );


      return function unregister(){

        unregisterJob(
          id
        );

      };

    }


    function unregisterJob(jobId){

      const id =
        String(jobId || "");


      const job =
        jobs.get(id);


      if(!job){
        return false;
      }


      pending[job.lane]
        .delete(id);


      jobs.delete(id);


      document.dispatchEvent(
        new CustomEvent(
          "firehaha:kernel-job-unregistered",
          {
            detail: {
              id
            }
          }
        )
      );


      return true;

    }


    function enableJob(
      jobId,
      enabled
    ){

      const job =
        jobs.get(
          String(jobId)
        );


      if(!job){
        return false;
      }


      job.enabled =
        enabled !== false;


      if(!job.enabled){

        pending[job.lane]
          .delete(job.id);


        job.pending =
          false;

      }


      return true;

    }


    // =====================================================
    // 請求工作
    // =====================================================

    function request(
      jobId,
      payload
    ){

      if(destroyed){
        return false;
      }


      const id =
        String(jobId || "");


      const job =
        jobs.get(id);


      if(!job){

        console.warn(
          `[Firehaha Kernel] 找不到工作：${id}`
        );


        return false;
      }


      if(!job.enabled){
        return false;
      }


      stats.totalRequests++;


      job.requestCount++;


      if(job.pending){

        /*
         * 同一個工作尚未執行前再次請求，
         * 不建立第二份工作，只更新 payload。
         */
        job.savedRunCount++;


        stats.totalSavedRuns++;


        job.payload =
          mergePayload(
            job.payload,
            payload,
            job.merge
          );

      }else{

        job.pending =
          true;


        job.payload =
          payload;


        pending[job.lane]
          .add(job.id);

      }


      if(batchDepth > 0){

        stats.batchDeferrals++;


        return true;

      }


      scheduleLane(
        job.lane
      );


      return true;

    }


    function requestMany(
      requests
    ){

      if(
        !Array.isArray(requests)
      ){

        return;
      }


      batch(
        () => {

          requests.forEach(
            item => {

              if(
                typeof item ===
                  "string"
              ){

                request(
                  item
                );

                return;
              }


              if(
                item &&
                typeof item ===
                  "object"
              ){

                request(
                  item.id,
                  item.payload
                );

              }

            }
          );

        }
      );

    }


    // =====================================================
    // 排程 Lane
    // =====================================================

    function scheduleLane(lane){

      if(
        destroyed ||
        suspended ||
        batchDepth > 0
      ){

        if(suspended){

          stats
            .suspendedDeferrals++;

        }


        return;
      }


      if(lane === "immediate"){

        scheduleImmediate();

      }else if(
        lane === "frame"
      ){

        scheduleFrame();

      }else{

        scheduleIdleLane();

      }

    }


    function scheduleImmediate(){

      if(
        immediateQueued ||
        immediateRunning ||
        !pending.immediate.size
      ){

        return;
      }


      immediateQueued =
        true;


      queueMicrotask(
        () => {

          immediateQueued =
            false;


          flushLane(
            "immediate"
          );

        }
      );

    }


    function scheduleFrame(){

      if(
        frameHandle ||
        frameRunning ||
        !pending.frame.size
      ){

        return;
      }


      frameHandle =
        requestAnimationFrame(
          () => {

            frameHandle =
              0;


            flushLane(
              "frame"
            );

          }
        );

    }


    function scheduleIdleLane(){

      if(
        idleHandle ||
        idleRunning ||
        !pending.idle.size
      ){

        return;
      }


      let minimumTimeout =
        DEFAULT_IDLE_TIMEOUT;


      pending.idle.forEach(
        id => {

          const job =
            jobs.get(id);


          if(job){

            minimumTimeout =
              Math.min(
                minimumTimeout,
                job.timeout
              );

          }

        }
      );


      idleHandle =
        requestIdle(
          deadline => {

            idleHandle =
              0;


            flushLane(
              "idle",
              deadline
            );

          },
          minimumTimeout
        );

    }


    // =====================================================
    // 實際執行
    // =====================================================

    function sortedPendingJobs(
      lane
    ){

      return Array
        .from(
          pending[lane]
        )
        .map(
          id =>
            jobs.get(id)
        )
        .filter(Boolean)
        .sort(
          (
            first,
            second
          ) => {

            if(
              first.priority !==
                second.priority
            ){

              return (
                first.priority -
                second.priority
              );

            }


            return first.id
              .localeCompare(
                second.id
              );

          }
        );

    }


    async function executeJob(
      job,
      lane
    ){

      if(
        !job ||
        !job.enabled
      ){

        return;
      }


      if(
        document.hidden &&
        !job.runWhenHidden
      ){

        stats.hiddenDeferrals++;


        /*
         * 保留 pending，
         * 回到前景後再做。
         */
        job.pending =
          true;


        pending[lane]
          .add(job.id);


        return;
      }


      /*
       * 執行前先取走 payload。
       *
       * 執行期間若又收到 request，
       * 會排進下一輪，不會丟失。
       */
      const payload =
        job.payload;


      job.payload =
        undefined;


      job.pending =
        false;


      pending[lane]
        .delete(job.id);


      const started =
        now();


      let error =
        null;


      try{

        await job.run(
          payload,
          {

            id:
              job.id,

            lane,

            kernel:
              publicApi,

            request,

            requestMany,

            core,

            signal:
              {
                get destroyed(){

                  return destroyed;

                },

                get suspended(){

                  return suspended;

                }

              }

          }
        );

      }catch(caughtError){

        error =
          caughtError;


        job.errorCount++;


        stats.totalErrors++;


        console.error(
          `[Firehaha Kernel] 工作失敗：${job.id}`,
          caughtError
        );

      }


      const duration =
        now() -
        started;


      job.actualRunCount++;


      job.totalDuration +=
        duration;


      job.lastDuration =
        duration;


      job.maximumDuration =
        Math.max(
          job.maximumDuration,
          duration
        );


      job.lastRunAt =
        Date.now();


      stats.totalRuns++;


      if(
        duration >
        stats.longestTask
      ){

        stats.longestTask =
          duration;


        stats.longestTaskId =
          job.id;

      }


      pushHistory({

        id:
          job.id,

        label:
          job.label,

        lane,

        duration:
          round(
            duration,
            3
          ),

        error:
          error
            ? String(
                error.message ||
                error
              )
            : null,

        timestamp:
          Date.now()

      });


      document.dispatchEvent(
        new CustomEvent(
          "firehaha:kernel-job-finished",
          {
            detail: {

              id:
                job.id,

              lane,

              duration,

              error

            }
          }
        )
      );

    }


    async function flushLane(
      lane,
      deadline
    ){

      if(
        destroyed ||
        suspended
      ){

        return;
      }


      if(
        lane === "frame" &&
        frameRunning
      ){

        return;
      }


      if(
        lane === "idle" &&
        idleRunning
      ){

        return;
      }


      if(
        lane === "immediate" &&
        immediateRunning
      ){

        return;
      }


      if(lane === "frame"){

        frameRunning =
          true;


        stats.frameFlushes++;

      }else if(
        lane === "idle"
      ){

        idleRunning =
          true;


        stats.idleFlushes++;

      }else{

        immediateRunning =
          true;


        stats.immediateFlushes++;

      }


      const flushStarted =
        now();


      try{

        const list =
          sortedPendingJobs(
            lane
          );


        for(
          const job of list
        ){

          if(
            destroyed ||
            suspended
          ){

            break;
          }


          /*
           * idle lane 若時間用完，
           * 留到下一輪。
           */
          if(
            lane === "idle" &&
            deadline &&
            !deadline.didTimeout &&
            deadline.timeRemaining() <
              3
          ){

            break;
          }


          await executeJob(
            job,
            lane
          );

        }

      }finally{

        const duration =
          now() -
          flushStarted;


        stats.lastFlushDuration =
          duration;


        stats.maximumFlushDuration =
          Math.max(
            stats.maximumFlushDuration,
            duration
          );


        if(lane === "frame"){

          frameRunning =
            false;

        }else if(
          lane === "idle"
        ){

          idleRunning =
            false;

        }else{

          immediateRunning =
            false;

        }

      }


      /*
       * 執行期間若有新請求，
       * 再安排下一輪。
       */
      if(
        pending[lane].size
      ){

        scheduleLane(
          lane
        );

      }

    }


    // =====================================================
    // 批次
    // =====================================================

    function batch(callback){

      batchDepth++;


      try{

        return callback();

      }finally{

        batchDepth =
          Math.max(
            0,
            batchDepth - 1
          );


        if(batchDepth === 0){

          scheduleAllPending();

        }

      }

    }


    async function batchAsync(
      callback
    ){

      batchDepth++;


      try{

        return await callback();

      }finally{

        batchDepth =
          Math.max(
            0,
            batchDepth - 1
          );


        if(batchDepth === 0){

          scheduleAllPending();

        }

      }

    }


    function scheduleAllPending(){

      if(
        pending.immediate.size
      ){

        scheduleImmediate();

      }


      if(
        pending.frame.size
      ){

        scheduleFrame();

      }


      if(
        pending.idle.size
      ){

        scheduleIdleLane();

      }

    }


    // =====================================================
    // Suspend / Resume
    // =====================================================

    function suspend(){

      suspended =
        true;


      if(frameHandle){

        cancelAnimationFrame(
          frameHandle
        );


        frameHandle =
          0;

      }


      if(idleHandle){

        cancelIdle(
          idleHandle
        );


        idleHandle =
          0;

      }


      document.dispatchEvent(
        new CustomEvent(
          "firehaha:kernel-suspended"
        )
      );

    }


    function resume(options){

      suspended =
        false;


      scheduleAllPending();


      if(
        options?.flush === true
      ){

        flush();

      }


      document.dispatchEvent(
        new CustomEvent(
          "firehaha:kernel-resumed"
        )
      );

    }


    // =====================================================
    // 手動 Flush
    // =====================================================

    async function flush(lane){

      stats.manualFlushes++;


      if(lane){

        const normalized =
          normalizeLane(
            lane
          );


        await flushLane(
          normalized,
          {
            didTimeout:
              true,

            timeRemaining(){

              return Infinity;

            }
          }
        );


        return;
      }


      await flushLane(
        "immediate"
      );


      await flushLane(
        "frame"
      );


      await flushLane(
        "idle",
        {
          didTimeout:
            true,

          timeRemaining(){

            return Infinity;

          }
        }
      );

    }


    // =====================================================
    // 內建工作
    // =====================================================

    /*
     * 1. 流程線
     *
     * 優先交給既有 FirehahaRenderCore。
     */
    registerJob({

      id:
        "core.lines",

      label:
        "流程連線",

      lane:
        "frame",

      priority:
        10,

      run(){

        if(
          window.FirehahaRenderCore &&
          typeof window
            .FirehahaRenderCore
            .requestLines ===
            "function"
        ){

          window
            .FirehahaRenderCore
            .requestLines();


          return;

        }


        core.drawLines?.();

      }

    });


    /*
     * 2. Node 徽章
     */
    if(
      typeof core.refreshNodeBadges ===
        "function"
    ){

      registerJob({

        id:
          "core.badges",

        label:
          "Node 徽章",

        lane:
          "frame",

        priority:
          20,

        run(){

          core
            .refreshNodeBadges();

        }

      });

    }


    /*
     * 3. 分歧選項
     */
    if(
      typeof core.renderOptions ===
        "function"
    ){

      registerJob({

        id:
          "core.options",

        label:
          "分歧選項",

        lane:
          "frame",

        priority:
          30,

        run(){

          core.renderOptions();

        }

      });

    }


    /*
     * 4. 預覽
     *
     * 只提供給新外掛主動使用。
     * 不強制攔截主程式閉包內的 updatePreview()。
     */
    if(
      typeof core.updatePreview ===
        "function"
    ){

      registerJob({

        id:
          "core.preview",

        label:
          "內容預覽",

        lane:
          "idle",

        priority:
          50,

        timeout:
          900,

        run(){

          core.updatePreview();

        }

      });

    }


    /*
     * 5. 資料夾重畫
     */
    registerJob({

      id:
        "plugin.folder-refresh",

      label:
        "資料夾更新",

      lane:
        "frame",

      priority:
        40,

      run(){

        /*
         * 只在資料夾外掛有提供 refresh 時才執行。
         */
        window
          .FirehahaFolderPerformance
          ?.refresh?.();

      }

    });


    // =====================================================
    // 相容接口
    // =====================================================

    function requestLines(){

      return request(
        "core.lines"
      );

    }


    function requestPreview(){

      if(
        jobs.has(
          "core.preview"
        )
      ){

        return request(
          "core.preview"
        );

      }


      return false;

    }


    function requestBadges(){

      if(
        jobs.has(
          "core.badges"
        )
      ){

        return request(
          "core.badges"
        );

      }


      return false;

    }


    function requestOptions(){

      if(
        jobs.has(
          "core.options"
        )
      ){

        return request(
          "core.options"
        );

      }


      return false;

    }


    function requestWorkspaceRefresh(){

      return requestMany([
        "core.badges",
        "core.lines"
      ]);

    }


    function requestStoryRefresh(){

      return requestMany([
        "core.options",
        "core.badges",
        "core.lines",
        "core.preview"
      ]);

    }


    // =====================================================
    // 統計
    // =====================================================

    function getJobStats(){

      return Array
        .from(
          jobs.values()
        )
        .map(
          job => {

            return {

              id:
                job.id,

              label:
                job.label,

              lane:
                job.lane,

              priority:
                job.priority,

              enabled:
                job.enabled,

              pending:
                job.pending,

              requestCount:
                job.requestCount,

              actualRunCount:
                job.actualRunCount,

              savedRunCount:
                job.savedRunCount,

              saveRate:
                job.requestCount
                  ? round(
                      (
                        job.savedRunCount /
                        job.requestCount
                      ) *
                      100,
                      1
                    )
                  : 0,

              errorCount:
                job.errorCount,

              averageDuration:
                job.actualRunCount
                  ? round(
                      job.totalDuration /
                      job.actualRunCount,
                      3
                    )
                  : 0,

              lastDuration:
                round(
                  job.lastDuration,
                  3
                ),

              maximumDuration:
                round(
                  job.maximumDuration,
                  3
                ),

              lastRunAt:
                job.lastRunAt

            };

          }
        )
        .sort(
          (
            first,
            second
          ) => {

            if(
              first.lane !==
                second.lane
            ){

              return first.lane
                .localeCompare(
                  second.lane
                );

            }


            return (
              first.priority -
              second.priority
            );

          }
        );

    }


    function getStats(){

      return {

        version:
          KERNEL_VERSION,

        active:
          !destroyed,

        suspended,

        batchDepth,

        documentHidden:
          document.hidden,

        registeredJobs:
          jobs.size,

        pendingJobs: {

          immediate:
            pending.immediate.size,

          frame:
            pending.frame.size,

          idle:
            pending.idle.size

        },

        totalRequests:
          stats.totalRequests,

        totalRuns:
          stats.totalRuns,

        totalSavedRuns:
          stats.totalSavedRuns,

        overallSaveRate:
          stats.totalRequests
            ? round(
                (
                  stats.totalSavedRuns /
                  stats.totalRequests
                ) *
                100,
                1
              )
            : 0,

        totalErrors:
          stats.totalErrors,

        immediateFlushes:
          stats.immediateFlushes,

        frameFlushes:
          stats.frameFlushes,

        idleFlushes:
          stats.idleFlushes,

        hiddenDeferrals:
          stats.hiddenDeferrals,

        suspendedDeferrals:
          stats.suspendedDeferrals,

        batchDeferrals:
          stats.batchDeferrals,

        manualFlushes:
          stats.manualFlushes,

        longestTask:
          round(
            stats.longestTask,
            3
          ),

        longestTaskId:
          stats.longestTaskId,

        lastFlushDuration:
          round(
            stats.lastFlushDuration,
            3
          ),

        maximumFlushDuration:
          round(
            stats.maximumFlushDuration,
            3
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

        uptimeMs:
          Date.now() -
          stats.startedAt

      };

    }


    function resetStats(){

      stats.startedAt =
        Date.now();


      stats.totalRequests =
        0;


      stats.totalRuns =
        0;


      stats.totalSavedRuns =
        0;


      stats.totalErrors =
        0;


      stats.frameFlushes =
        0;


      stats.idleFlushes =
        0;


      stats.immediateFlushes =
        0;


      stats.hiddenDeferrals =
        0;


      stats.suspendedDeferrals =
        0;


      stats.batchDeferrals =
        0;


      stats.manualFlushes =
        0;


      stats.longestTask =
        0;


      stats.longestTaskId =
        null;


      stats.lastFlushDuration =
        0;


      stats.maximumFlushDuration =
        0;


      jobs.forEach(
        job => {

          job.requestCount =
            0;


          job.actualRunCount =
            0;


          job.savedRunCount =
            0;


          job.errorCount =
            0;


          job.totalDuration =
            0;


          job.maximumDuration =
            0;


          job.lastDuration =
            0;


          job.lastRunAt =
            0;

        }
      );


      history.length =
        0;

    }


    // =====================================================
    // 公開 API
    // =====================================================

    const publicApi = {

      version:
        KERNEL_VERSION,

      active:
        true,


      register:
        registerJob,

      unregister:
        unregisterJob,

      enable:
        enableJob,


      request,

      requestMany,


      batch,

      batchAsync,


      suspend,

      resume,

      flush,


      requestLines,

      requestPreview,

      requestBadges,

      requestOptions,

      requestWorkspaceRefresh,

      requestStoryRefresh,


      getStats,

      getJobStats,

      resetStats,


      getHistory(){

        return history.map(
          item => ({
            ...item
          })
        );

      },


      has(jobId){

        return jobs.has(
          String(jobId)
        );

      },


      isPending(jobId){

        return Boolean(
          jobs.get(
            String(jobId)
          )?.pending
        );

      },


      getJob(jobId){

        const job =
          jobs.get(
            String(jobId)
          );


        if(!job){
          return null;
        }


        return {

          id:
            job.id,

          label:
            job.label,

          lane:
            job.lane,

          priority:
            job.priority,

          enabled:
            job.enabled,

          pending:
            job.pending

        };

      }

    };


    window.FirehahaKernel =
      publicApi;


    /*
     * Scheduler 別名，方便其他外掛使用。
     */
    window.FirehahaScheduler =
      publicApi;


    // =====================================================
    // 頁籤前景恢復
    // =====================================================

    function onVisibilityChange(){

      if(
        !document.hidden &&
        !suspended
      ){

        scheduleAllPending();

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
    // 對其他外掛發布準備完成事件
    // =====================================================

    document.dispatchEvent(
      new CustomEvent(
        "firehaha:kernel-ready",
        {
          detail: {

            version:
              KERNEL_VERSION,

            kernel:
              publicApi

          }
        }
      )
    );


    toast(
      "Firehaha 核心排程器已啟用"
    );


    // =====================================================
    // Cleanup
    // =====================================================

    return async function cleanup(){

      destroyed =
        true;


      publicApi.active =
        false;


      if(frameHandle){

        cancelAnimationFrame(
          frameHandle
        );


        frameHandle =
          0;

      }


      if(idleHandle){

        cancelIdle(
          idleHandle
        );


        idleHandle =
          0;

      }


      pending.immediate.clear();

      pending.frame.clear();

      pending.idle.clear();


      jobs.clear();


      cleanupFunctions
        .splice(0)
        .reverse()
        .forEach(
          fn => {

            try{

              fn();

            }catch(error){

              console.warn(
                "[Firehaha Kernel cleanup]",
                error
              );

            }

          }
        );


      if(
        window.FirehahaKernel ===
          publicApi
      ){

        delete window
          .FirehahaKernel;

      }


      if(
        window.FirehahaScheduler ===
          publicApi
      ){

        delete window
          .FirehahaScheduler;

      }


      document.dispatchEvent(
        new CustomEvent(
          "firehaha:kernel-destroyed"
        )
      );


      toast(
        "Firehaha 核心排程器已停用"
      );

    };

  }

});