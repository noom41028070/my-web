// @firehaha-plugin {"id":"official.native-asset-reader-adapter","name":"原生素材庫與閱讀器適配核心","version":"1.0.0","author":"Firehaha","description":"擴充原生素材庫API，提供素材類型註冊、短ID管理、變更事件，以及支援非同步準備的ReaderArtifact測試與輸出管線。"}

FirehahaPlugins.register({
  id: "official.native-asset-reader-adapter",
  name: "原生素材庫與閱讀器適配核心",
  version: "1.0.0",

  async setup(api) {
    "use strict";

    const ADAPTER_VERSION =
      "1.0.0";

    const READY_TIMEOUT =
      12000;

    const MATERIAL_CHANGE_EVENT =
      "firehaha:native-materials-changed";

    const READER_PREPARE_EVENT =
      "firehaha:reader-prepared";

    const READER_ERROR_EVENT =
      "firehaha:reader-prepare-error";

    let destroyed =
      false;

    let bypassReaderClick =
      false;

    let currentReaderIntent =
      null;

    const cleanupFunctions =
      [];

    const materialTypes =
      new Map();

    const readerPreflights =
      [];

    const adapterTransforms =
      new Map();

    const readerState = {
      preparing:
        false,

      intent:
        null,

      mode:
        null,

      startedAt:
        0,

      finishedAt:
        0,

      lastError:
        null,

      lastResult:
        null,

      cache:
        Object.create(null)
    };


    // =====================================================
    // 等待主程式原生模組
    // =====================================================

    async function waitForNativeModules() {
      const startedAt =
        Date.now();

      while (
        (
          !window.MaterialLibraryAPI ||
          !window.ReaderArtifactCore ||
          !window.SeparatedFormatReaders
        ) &&
        Date.now() - startedAt <
          READY_TIMEOUT
      ) {
        await new Promise(resolve => {
          setTimeout(
            resolve,
            80
          );
        });
      }

      if (
        !window.MaterialLibraryAPI
      ) {
        throw new Error(
          "MaterialLibraryAPI 尚未就緒"
        );
      }

      if (
        !window.ReaderArtifactCore
      ) {
        throw new Error(
          "ReaderArtifactCore 尚未就緒"
        );
      }

      if (
        !window.SeparatedFormatReaders
      ) {
        throw new Error(
          "SeparatedFormatReaders 尚未就緒"
        );
      }
    }


    await waitForNativeModules();


    // =====================================================
    // 共用工具
    // =====================================================

    function makeId(prefix) {
      const safePrefix =
        String(
          prefix || "asset_"
        );

      if (
        window.crypto &&
        typeof crypto.randomUUID ===
          "function"
      ) {
        return (
          safePrefix +
          crypto.randomUUID()
        );
      }

      return (
        safePrefix +
        Date.now().toString(36) +
        "_" +
        Math.random()
          .toString(36)
          .slice(2, 10)
      );
    }


    function cloneValue(value) {
      if (
        typeof structuredClone ===
        "function"
      ) {
        try {
          return structuredClone(
            value
          );
        } catch (error) {}
      }

      try {
        return JSON.parse(
          JSON.stringify(value)
        );
      } catch (error) {
        return value;
      }
    }


    function normalizeKind(value) {
      const text =
        String(value || "")
          .trim()
          .toLowerCase();

      if (
        text === "img"
      ) {
        return "image";
      }

      if (
        text === "document" ||
        text === "doc"
      ) {
        return "text";
      }

      return (
        text ||
        "unknown"
      );
    }


    function extensionOf(name) {
      const text =
        String(name || "");

      const index =
        text.lastIndexOf(".");

      if (
        index < 0
      ) {
        return "";
      }

      return text
        .slice(index + 1)
        .toLowerCase();
    }


    function normalizeMaterial(
      item,
      options
    ) {
      const input =
        item &&
        typeof item === "object"
          ? Object.assign({}, item)
          : {};

      const settings =
        options || {};

      const inferredKind =
        inferMaterialKind(
          input
        );

      input.id =
        String(
          input.id ||
          input.assetId ||
          input.vaultId ||
          makeId("asset_")
        );

      input.assetId =
        String(
          input.assetId ||
          input.id
        );

      input.type =
        normalizeKind(
          input.type ||
          input.kind ||
          inferredKind
        );

      input.kind =
        normalizeKind(
          input.kind ||
          input.type ||
          inferredKind
        );

      input.name =
        String(
          input.name ||
          settings.defaultName ||
          "未命名素材"
        );

      input.mime =
        String(
          input.mime ||
          (
            String(input.type)
              .includes("/")
              ? input.type
              : ""
          )
        );

      input.size =
        Number(
          input.size ||
          input.blob?.size ||
          0
        );

      input.createdAt =
        Number(
          input.createdAt ||
          Date.now()
        );

      input.updatedAt =
        Number(
          input.updatedAt ||
          Date.now()
        );

      return input;
    }


    function inferMaterialKind(item) {
      if (
        !item ||
        typeof item !== "object"
      ) {
        return "unknown";
      }

      const explicit =
        normalizeKind(
          item.kind ||
          item.type
        );

      if (
        explicit !== "unknown" &&
        !explicit.includes("/")
      ) {
        return explicit;
      }

      const mime =
        String(
          item.mime ||
          item.type ||
          ""
        ).toLowerCase();

      const name =
        String(
          item.name ||
          ""
        ).toLowerCase();

      const ext =
        extensionOf(name);

      if (
        mime.startsWith("image/") ||
        [
          "png",
          "jpg",
          "jpeg",
          "gif",
          "webp",
          "bmp",
          "svg",
          "avif"
        ].includes(ext)
      ) {
        return "image";
      }

      if (
        mime.startsWith("audio/") ||
        [
          "mp3",
          "wav",
          "ogg",
          "oga",
          "m4a",
          "aac",
          "flac",
          "weba"
        ].includes(ext)
      ) {
        return "audio";
      }

      if (
        mime.startsWith("video/") ||
        [
          "mp4",
          "webm",
          "mov",
          "mkv",
          "avi",
          "m4v"
        ].includes(ext)
      ) {
        return "video";
      }

      if (
        mime.startsWith("text/") ||
        [
          "txt",
          "md",
          "csv",
          "json",
          "html",
          "htm",
          "doc",
          "docx",
          "rtf"
        ].includes(ext)
      ) {
        return "text";
      }

      return "unknown";
    }


    function emit(
      type,
      detail
    ) {
      document.dispatchEvent(
        new CustomEvent(
          type,
          {
            detail
          }
        )
      );
    }


    // =====================================================
    // 素材類型註冊
    // =====================================================

    function registerMaterialType(
      definition
    ) {
      if (
        !definition ||
        typeof definition !==
          "object"
      ) {
        throw new TypeError(
          "registerType 需要素材類型設定"
        );
      }

      const kind =
        normalizeKind(
          definition.kind ||
          definition.id
        );

      if (
        !kind ||
        kind === "unknown"
      ) {
        throw new Error(
          "素材類型必須提供 kind"
        );
      }

      const record = {
        kind,

        label:
          String(
            definition.label ||
            kind
          ),

        icon:
          String(
            definition.icon ||
            "📦"
          ),

        accept:
          Array.isArray(
            definition.accept
          )
            ? definition.accept
                .map(String)
                .filter(Boolean)
            : String(
                definition.accept ||
                ""
              )
                .split(",")
                .map(value =>
                  value.trim()
                )
                .filter(Boolean),

        storage:
          String(
            definition.storage ||
            "native"
          ),

        insertMode:
          String(
            definition.insertMode ||
            "reference"
          ),

        test:
          typeof definition.test ===
            "function"
            ? definition.test
            : null,

        metadata:
          cloneValue(
            definition.metadata ||
            {}
          )
      };

      materialTypes.set(
        kind,
        record
      );

      updateNativeFileAccept();

      emit(
        "firehaha:material-type-registered",
        {
          kind,
          definition:
            cloneValue(record)
        }
      );

      return function unregister() {
        materialTypes.delete(
          kind
        );

        updateNativeFileAccept();
      };
    }


    function updateNativeFileAccept() {
      const input =
        document.getElementById(
          "material-file-input"
        );

      if (!input) {
        return;
      }

      const accepts =
        new Set();

      materialTypes.forEach(type => {
        type.accept.forEach(value => {
          accepts.add(value);
        });
      });

      if (
        !accepts.size
      ) {
        accepts.add("image/*");
        accepts.add(".txt");
      }

      input.accept =
        Array.from(accepts)
          .join(",");
    }


    registerMaterialType({
      kind:
        "image",

      label:
        "圖片",

      icon:
        "🖼️",

      accept: [
        "image/*"
      ],

      storage:
        "LocalImageVault",

      insertMode:
        "native"
    });


    registerMaterialType({
      kind:
        "text",

      label:
        "文字文件",

      icon:
        "📄",

      accept: [
        ".txt",
        "text/plain"
      ],

      storage:
        "native",

      insertMode:
        "text"
    });


    // =====================================================
    // 擴充原生 MaterialLibraryAPI
    // =====================================================

    const originalMaterialApi =
      window.MaterialLibraryAPI;

    const originalLoad =
      originalMaterialApi.load
        .bind(
          originalMaterialApi
        );

    const originalSave =
      originalMaterialApi.save
        .bind(
          originalMaterialApi
        );


    function loadMaterials() {
      const loaded =
        originalLoad();

      if (
        !Array.isArray(loaded)
      ) {
        return [];
      }

      return loaded.map(item =>
        normalizeMaterial(item)
      );
    }


    function saveMaterials(
      list,
      reason
    ) {
      const normalized =
        Array.isArray(list)
          ? list.map(item =>
              normalizeMaterial(item)
            )
          : [];

      originalSave(
        normalized
      );

      emit(
        MATERIAL_CHANGE_EVENT,
        {
          reason:
            String(
              reason ||
              "save"
            ),

          count:
            normalized.length,

          items:
            normalized.map(item => ({
              id:
                item.id,

              assetId:
                item.assetId,

              name:
                item.name,

              kind:
                item.kind,

              type:
                item.type,

              mime:
                item.mime,

              size:
                item.size,

              vaultId:
                item.vaultId ||
                null
            }))
        }
      );

      requestNativeMaterialRefresh();

      return normalized;
    }


    function getById(id) {
      const key =
        String(id || "");

      return (
        loadMaterials()
          .find(item => {
            return (
              item.id === key ||
              item.assetId === key ||
              item.vaultId === key
            );
          }) ||
        null
      );
    }


    function addMaterial(
      item,
      options
    ) {
      const settings =
        options || {};

      const list =
        loadMaterials();

      const normalized =
        normalizeMaterial(
          item,
          settings
        );

      const duplicateIndex =
        list.findIndex(existing => {
          return (
            existing.id ===
              normalized.id ||
            existing.assetId ===
              normalized.assetId
          );
        });

      if (
        duplicateIndex >= 0
      ) {
        if (
          settings.replace ===
          false
        ) {
          throw new Error(
            "素材 ID 已存在：" +
            normalized.id
          );
        }

        list[duplicateIndex] =
          Object.assign(
            {},
            list[duplicateIndex],
            normalized,
            {
              updatedAt:
                Date.now()
            }
          );

      } else {
        list.push(
          normalized
        );
      }

      saveMaterials(
        list,
        "add"
      );

      return normalized;
    }


    function updateMaterial(
      id,
      patch
    ) {
      const key =
        String(id || "");

      const list =
        loadMaterials();

      const index =
        list.findIndex(item => {
          return (
            item.id === key ||
            item.assetId === key ||
            item.vaultId === key
          );
        });

      if (
        index < 0
      ) {
        return null;
      }

      const current =
        list[index];

      const next =
        normalizeMaterial(
          Object.assign(
            {},
            current,
            patch || {},
            {
              id:
                current.id,

              assetId:
                current.assetId,

              updatedAt:
                Date.now()
            }
          )
        );

      list[index] =
        next;

      saveMaterials(
        list,
        "update"
      );

      return next;
    }


    function removeMaterial(id) {
      const key =
        String(id || "");

      const list =
        loadMaterials();

      const removed =
        [];

      const next =
        list.filter(item => {
          const matched =
            item.id === key ||
            item.assetId === key ||
            item.vaultId === key;

          if (matched) {
            removed.push(item);
          }

          return !matched;
        });

      if (
        !removed.length
      ) {
        return null;
      }

      saveMaterials(
        next,
        "remove"
      );

      return removed[0];
    }


    function clearMaterials() {
      const old =
        loadMaterials();

      saveMaterials(
        [],
        "clear"
      );

      return old;
    }


    function listByKind(kind) {
      const expected =
        normalizeKind(kind);

      return loadMaterials()
        .filter(item => {
          return (
            normalizeKind(
              item.kind ||
              inferMaterialKind(item)
            ) === expected
          );
        });
    }


    function requestNativeMaterialRefresh() {
      emit(
        "firehaha:native-material-refresh-request",
        {
          time:
            Date.now()
        }
      );

      const panel =
        document.getElementById(
          "material-library-panel"
        );

      if (
        !panel ||
        !panel.classList.contains(
          "open"
        )
      ) {
        return;
      }

      /*
       * 原生 renderMaterialList() 是區域函式，
       * 外部 JS 無法直接呼叫。
       *
       * 因此面板開啟時，尋找原生「素材庫」按鈕，
       * 重新觸發一次原生開啟流程。
       */
      const openButton =
        Array.from(
          document.querySelectorAll(
            "button"
          )
        ).find(button => {
          if (
            panel.contains(button)
          ) {
            return false;
          }

          const text =
            String(
              button.textContent || ""
            ).trim();

          return (
            text.includes("素材庫") ||
            text.includes("Material")
          );
        });

      if (openButton) {
        panel.classList.remove(
          "open"
        );

        requestAnimationFrame(() => {
          openButton.click();
        });
      }
    }


    const enhancedMaterialApi = {
      version:
        ADAPTER_VERSION,

      load:
        loadMaterials,

      save:
        saveMaterials,

      getAll:
        loadMaterials,

      getById,

      add:
        addMaterial,

      update:
        updateMaterial,

      remove:
        removeMaterial,

      clear:
        clearMaterials,

      listByKind,

      inferKind:
        inferMaterialKind,

      normalize:
        normalizeMaterial,

      makeId,

      registerType:
        registerMaterialType,

      getTypes() {
        return Array.from(
          materialTypes.values()
        ).map(type =>
          cloneValue(type)
        );
      },

      refresh:
        requestNativeMaterialRefresh,

      native:
        originalMaterialApi
    };


    window.MaterialLibraryAPI =
      enhancedMaterialApi;


    // =====================================================
    // Reader Preflight 管線
    // =====================================================

    function registerReaderPreflight(
      name,
      handler,
      priority
    ) {
      const safeName =
        String(name || "")
          .trim();

      if (
        !safeName ||
        typeof handler !==
          "function"
      ) {
        throw new TypeError(
          "registerPreflight 需要名稱與函式"
        );
      }

      const existing =
        readerPreflights.find(
          entry =>
            entry.name ===
            safeName
        );

      const record = {
        name:
          safeName,

        handler,

        priority:
          Number(priority) ||
          100
      };

      if (existing) {
        Object.assign(
          existing,
          record
        );

      } else {
        readerPreflights.push(
          record
        );
      }

      return function unregister() {
        const index =
          readerPreflights.findIndex(
            entry =>
              entry.name ===
              safeName
          );

        if (
          index >= 0
        ) {
          readerPreflights.splice(
            index,
            1
          );
        }
      };
    }


    async function prepareReader(
      intent,
      mode,
      extraContext
    ) {
      if (
        readerState.preparing
      ) {
        throw new Error(
          "閱讀器正在準備中"
        );
      }

      const normalizedIntent =
        intent === "export"
          ? "export"
          : "preview";

      const normalizedMode =
        mode === "html"
          ? "html"
          : "pixiv";

      readerState.preparing =
        true;

      readerState.intent =
        normalizedIntent;

      readerState.mode =
        normalizedMode;

      readerState.startedAt =
        Date.now();

      readerState.finishedAt =
        0;

      readerState.lastError =
        null;

      currentReaderIntent = {
        intent:
          normalizedIntent,

        mode:
          normalizedMode,

        token:
          makeId("reader_"),

        startedAt:
          readerState.startedAt,

        context:
          Object.assign(
            {},
            extraContext || {}
          )
      };

      const context = {
        intent:
          normalizedIntent,

        actualPurpose:
          normalizedIntent,

        mode:
          normalizedMode,

        token:
          currentReaderIntent.token,

        cache:
          readerState.cache,

        adapter:
          window.FirehahaNativeAdapter,

        nativePurpose:
          normalizedIntent ===
            "preview"
            ? "export"
            : "preview",

        extra:
          Object.assign(
            {},
            extraContext || {}
          )
      };

      try {
        const ordered =
          readerPreflights
            .slice()
            .sort((a, b) => {
              return (
                a.priority -
                  b.priority ||
                a.name.localeCompare(
                  b.name
                )
              );
            });

        const results =
          [];

        for (
          const entry
          of ordered
        ) {
          const value =
            await entry.handler(
              Object.freeze(
                Object.assign(
                  {},
                  context
                )
              )
            );

          results.push({
            name:
              entry.name,

            value
          });
        }

        readerState.finishedAt =
          Date.now();

        readerState.lastResult = {
          intent:
            normalizedIntent,

          mode:
            normalizedMode,

          token:
            context.token,

          duration:
            readerState.finishedAt -
            readerState.startedAt,

          results
        };

        emit(
          READER_PREPARE_EVENT,
          cloneValue(
            readerState.lastResult
          )
        );

        return readerState
          .lastResult;

      } catch (error) {
        readerState.lastError =
          error;

        emit(
          READER_ERROR_EVENT,
          {
            intent:
              normalizedIntent,

            mode:
              normalizedMode,

            message:
              String(
                error?.message ||
                error
              ),

            stack:
              String(
                error?.stack ||
                ""
              )
          }
        );

        throw error;

      } finally {
        readerState.preparing =
          false;
      }
    }


    // =====================================================
    // Adapter Transform
    //
    // 主程式目前：
    // 測試閱讀 purpose = export
    // 正式輸出 purpose = preview
    //
    // 這裡提供 actualPurpose 修正版。
    // =====================================================

    function registerAdapterTransform(
      name,
      transform,
      priority
    ) {
      const safeName =
        String(name || "")
          .trim();

      if (
        !safeName ||
        typeof transform !==
          "function"
      ) {
        throw new TypeError(
          "registerTransform 需要名稱與函式"
        );
      }

      const remove =
        api.registerReaderTransform(
          "native-adapter:" +
            safeName,

          function wrappedTransform(
            html,
            nativeContext
          ) {
            const intent =
              currentReaderIntent
                ?.intent ||
              (
                nativeContext
                  ?.purpose ===
                  "export"
                  ? "preview"
                  : nativeContext
                      ?.purpose ===
                      "preview"
                    ? "export"
                    : "runtime"
              );

            const fixedContext =
              Object.freeze({
                mode:
                  nativeContext
                    ?.mode ||
                  currentReaderIntent
                    ?.mode ||
                  "pixiv",

                purpose:
                  intent,

                actualPurpose:
                  intent,

                nativePurpose:
                  nativeContext
                    ?.purpose ||
                  "runtime",

                token:
                  currentReaderIntent
                    ?.token ||
                  null,

                cache:
                  readerState.cache,

                adapter:
                  window.FirehahaNativeAdapter,

                nativeContext:
                  nativeContext ||
                  {}
              });

            const result =
              transform(
                html,
                fixedContext
              );

            if (
              typeof result !==
              "string"
            ) {
              throw new Error(
                "Adapter transform 必須回傳 HTML 字串：" +
                safeName
              );
            }

            return result;
          },

          priority
        );

      adapterTransforms.set(
        safeName,
        remove
      );

      return function unregister() {
        adapterTransforms.delete(
          safeName
        );

        remove();
      };
    }



    // =====================================================
// ReaderArtifact 原生導航橋樑
//
// 將閱讀器閉包內的：
// pages / history / currentId / show()
// 安全公開成 window.FirehahaReaderNavigation。
//
// 其他音訊、影片、小遊戲插件只呼叫此接口，
// 不自行重寫閱讀器跳頁。
// =====================================================

registerAdapterTransform(
  "reader-navigation-bridge",

  function installReaderNavigationBridge(
    html
  ) {
    if (
      typeof html !== "string" ||
      html.includes(
        "data-fh-reader-navigation-v1"
      )
    ) {
      return html;
    }


    /*
     * 主程式目前輸出的 Reader Runtime 使用：
     *
     * function show(id,push=true){
     *
     * 這段程式必須插入同一個 script 與同一個閉包，
     * 才能存取 pages、history、currentId 和 show。
     */
    const exactMarker =
      "function show(id,push=true){";

    const flexibleMarker =
      /function\s+show\s*\(\s*id\s*,\s*push\s*=\s*true\s*\)\s*\{/;


    const bridgeCode = String.raw`
/* data-fh-reader-navigation-v1 */

(function installFirehahaReaderNavigation(){

"use strict";


if(
  window.FirehahaReaderNavigation &&
  window.FirehahaReaderNavigation.version ===
    "1.0.0"
){
  return;
}


/*
 * 將輸入正規化成頁碼。
 * 頁碼採用作者看到的 1、2、3……
 */
function normalizePageNumber(value){

  var number =
  Number(value);


  if(
    !Number.isFinite(number)
  ){
    return 0;
  }


  number =
  Math.trunc(number);


  return (
    number >= 1
    ?
    number
    :
    0
  );

}


/*
 * 只接受真正存在於 pages 的 ID。
 */
function resolveById(id){

  var key =
  String(id == null ? "" : id)
  .trim();


  if(!key){
    return null;
  }


  return (
    pages.find(
      function(page){
        return (
          page &&
          String(page.id) === key
        );
      }
    ) ||
    null
  );

}


/*
 * 頁碼為 1-based。
 */
function resolveByPageNumber(
  pageNumber
){

  var number =
  normalizePageNumber(
    pageNumber
  );


  if(!number){
    return null;
  }


  return (
    pages[number - 1] ||
    null
  );

}


/*
 * 標題搜尋先完整相符。
 * 多個同名頁面時取第一個。
 */
function resolveByTitle(title){

  var key =
  String(
    title == null
    ?
    ""
    :
    title
  ).trim();


  if(!key){
    return null;
  }


  return (
    pages.find(
      function(page){

        return (
          page &&
          String(
            page.title || ""
          ).trim() === key
        );

      }
    ) ||
    null
  );

}


/*
 * 通用目標解析：
 *
 * number          → 頁碼
 * {id:"..."}      → Node UUID
 * {page:3}        → 頁碼
 * {pageNumber:3}  → 頁碼
 * {title:"森林"}  → 標題
 * 純字串           → 先找 ID，再找標題
 */
function resolveTarget(target){

  if(
    typeof target === "number"
  ){
    return resolveByPageNumber(
      target
    );
  }


  if(
    target &&
    typeof target === "object"
  ){

    if(target.id != null){

      var byId =
      resolveById(
        target.id
      );


      if(byId){
        return byId;
      }

    }


    if(target.pageNumber != null){

      var byPageNumber =
      resolveByPageNumber(
        target.pageNumber
      );


      if(byPageNumber){
        return byPageNumber;
      }

    }


    if(target.page != null){

      var byPage =
      resolveByPageNumber(
        target.page
      );


      if(byPage){
        return byPage;
      }

    }


    if(target.title != null){

      return resolveByTitle(
        target.title
      );

    }


    return null;
  }


  var text =
  String(
    target == null
    ?
    ""
    :
    target
  ).trim();


  if(!text){
    return null;
  }


  /*
   * 純數字字串預設視為頁碼。
   */
  if(/^\d+$/.test(text)){

    return resolveByPageNumber(
      Number(text)
    );

  }


  return (
    resolveById(text) ||
    resolveByTitle(text)
  );

}


/*
 * 觸發導航事件，供音訊、影片、
 * UI 或其他 Runtime 監聽。
 */
function emitNavigationEvent(
  type,
  detail
){

  try{

    document.dispatchEvent(
      new CustomEvent(
        type,
        {
          detail:
          detail || {}
        }
      )
    );

  }catch(error){

    console.warn(
      "[Firehaha Navigation Event]",
      error
    );

  }

}


/*
 * 真正執行跳頁。
 *
 * 一律呼叫主程式原生 show()，
 * 不自行修改 reader.innerHTML。
 */
function navigateToPage(
  targetPage,
  options
){

  if(!targetPage){
    return false;
  }


  var settings =
  options &&
  typeof options === "object"
  ?
  options
  :
  {};


  var pushHistory =
  settings.pushHistory !== false;


  var fromId =
  currentId || "";


  emitNavigationEvent(
    "firehaha:reader-before-navigate",
    {
      fromId:
      fromId,

      toId:
      targetPage.id,

      toPageNumber:
      pages.indexOf(targetPage) + 1,

      reason:
      settings.reason || "adapter",

      pushHistory:
      pushHistory
    }
  );


  /*
   * 沿用主程式原生 show()。
   */
  show(
    targetPage.id,
    pushHistory
  );


  emitNavigationEvent(
    "firehaha:reader-navigated",
    {
      fromId:
      fromId,

      toId:
      currentId || targetPage.id,

      pageNumber:
      pages.findIndex(
        function(page){
          return (
            page &&
            page.id === currentId
          );
        }
      ) + 1,

      reason:
      settings.reason || "adapter",

      pushHistory:
      pushHistory
    }
  );


  return true;
}


var navigationApi = {

  version:
  "1.0.0",


  /*
   * 依 Node UUID 跳頁。
   */
  goToId:
  function goToId(
    id,
    options
  ){

    return navigateToPage(
      resolveById(id),
      options
    );

  },


  /*
   * 依 1-based 頁碼跳頁。
   */
  goToPage:
  function goToPage(
    pageNumber,
    options
  ){

    return navigateToPage(
      resolveByPageNumber(
        pageNumber
      ),
      options
    );

  },


  /*
   * 依完整標題跳頁。
   */
  goToTitle:
  function goToTitle(
    title,
    options
  ){

    return navigateToPage(
      resolveByTitle(title),
      options
    );

  },


  /*
   * 通用跳頁。
   */
  go:
  function go(
    target,
    options
  ){

    return navigateToPage(
      resolveTarget(target),
      options
    );

  },


  /*
   * 沿用原生返回歷史邏輯。
   */
  back:
  function back(options){

    if(
      !Array.isArray(history) ||
      history.length <= 1
    ){
      return false;
    }


    var settings =
    options &&
    typeof options === "object"
    ?
    options
    :
    {};


    var fromId =
    currentId || "";


    /*
     * 與主程式原生返回按鈕一致：
     *
     * history.pop();
     * show(history.pop(), true);
     */
    history.pop();


    var previousId =
    history.pop();


    if(!previousId){
      return false;
    }


    emitNavigationEvent(
      "firehaha:reader-before-navigate",
      {
        fromId:
        fromId,

        toId:
        previousId,

        reason:
        settings.reason ||
        "adapter-back",

        pushHistory:
        true
      }
    );


    show(
      previousId,
      true
    );


    emitNavigationEvent(
      "firehaha:reader-navigated",
      {
        fromId:
        fromId,

        toId:
        currentId || previousId,

        pageNumber:
        pages.findIndex(
          function(page){
            return (
              page &&
              page.id === currentId
            );
          }
        ) + 1,

        reason:
        settings.reason ||
        "adapter-back",

        pushHistory:
        true
      }
    );


    return true;
  },


  /*
   * 重新渲染目前頁面，但不新增歷史。
   */
  refresh:
  function refresh(){

    if(!currentId){
      return false;
    }


    show(
      currentId,
      false
    );


    return true;
  },


  resolve:
  function resolve(target){

    var page =
    resolveTarget(target);


    if(!page){
      return null;
    }


    return {
      id:
      page.id,

      title:
      String(
        page.title || ""
      ),

      pageNumber:
      pages.indexOf(page) + 1
    };

  },


  hasId:
  function hasId(id){

    return Boolean(
      resolveById(id)
    );

  },


  hasPage:
  function hasPage(pageNumber){

    return Boolean(
      resolveByPageNumber(
        pageNumber
      )
    );

  },


  hasTitle:
  function hasTitle(title){

    return Boolean(
      resolveByTitle(title)
    );

  },


  getCurrentId:
  function getCurrentId(){

    return (
      currentId ||
      ""
    );

  },


  getCurrentPageNumber:
  function getCurrentPageNumber(){

    var index =
    pages.findIndex(
      function(page){

        return (
          page &&
          page.id === currentId
        );

      }
    );


    return (
      index >= 0
      ?
      index + 1
      :
      0
    );

  },


  getCurrentPage:
  function getCurrentPage(){

    var page =
    resolveById(
      currentId
    );


    if(!page){
      return null;
    }


    return {
      id:
      page.id,

      title:
      String(
        page.title || ""
      ),

      pageNumber:
      pages.indexOf(page) + 1
    };

  },


  getPageCount:
  function getPageCount(){

    return pages.length;

  },


  /*
   * 只回傳安全的描述資料，
   * 不把整份 page 物件公開出去。
   */
  getPages:
  function getPages(){

    return pages.map(
      function(page,index){

        return {
          id:
          page && page.id
          ?
          page.id
          :
          "",

          title:
          String(
            page &&
            page.title
            ?
            page.title
            :
            ""
          ),

          pageNumber:
          index + 1
        };

      }
    );

  },


  getHistory:
  function getHistory(){

    return history.slice();

  },


  canGoBack:
  function canGoBack(){

    return (
      Array.isArray(history) &&
      history.length > 1
    );

  }
};


Object.defineProperty(
  window,
  "FirehahaReaderNavigation",
  {
    value:
    Object.freeze(
      navigationApi
    ),

    configurable:
    true,

    enumerable:
    false,

    writable:
    false
  }
);


emitNavigationEvent(
  "firehaha:reader-navigation-ready",
  {
    version:
    navigationApi.version,

    pageCount:
    pages.length
  }
);

})();
`;


    let output =
      html;

    let matchedMarker =
      "";


    if (
      output.includes(
        exactMarker
      )
    ) {
      matchedMarker =
        exactMarker;

    } else {
      const match =
        output.match(
          flexibleMarker
        );

      if (match) {
        matchedMarker =
          match[0];
      }
    }


    if (!matchedMarker) {
      console.warn(
        "[Firehaha Native Adapter] " +
        "找不到閱讀器 show() 插入點，" +
        "本次不安裝導航橋樑。"
      );

      return output;
    }


    /*
     * bridgeCode 與 show() 位於相同的 Reader Runtime 閉包。
     * 因此 bridgeCode 可以安全存取：
     *
     * pages
     * history
     * currentId
     * show()
     */
    output =
      output.replace(
        matchedMarker,
        bridgeCode +
        "\n" +
        matchedMarker
      );


    return output;
  },

  /*
   * 優先於音訊、影片等 Runtime。
   */
  40
);




    // =====================================================
    // 執行原生測試／輸出
    // =====================================================

    async function runReader(
      intent,
      mode,
      extraContext
    ) {
      const normalizedIntent =
        intent === "export"
          ? "export"
          : "preview";

      const normalizedMode =
        mode === "html"
          ? "html"
          : "pixiv";

      await prepareReader(
        normalizedIntent,
        normalizedMode,
        extraContext
      );

      if (
        !window
          .SeparatedFormatReaders
      ) {
        throw new Error(
          "SeparatedFormatReaders 尚未就緒"
        );
      }

      bypassReaderClick =
        true;

      try {
        if (
          normalizedIntent ===
          "export"
        ) {
          return window
            .SeparatedFormatReaders
            .export(
              normalizedMode
            );
        }

        return window
          .SeparatedFormatReaders
          .preview(
            normalizedMode
          );

      } finally {
        setTimeout(() => {
          bypassReaderClick =
            false;

          currentReaderIntent =
            null;
        }, 0);
      }
    }


    function previewReader(
      mode,
      extraContext
    ) {
      return runReader(
        "preview",
        mode,
        extraContext
      );
    }


    function exportReader(
      mode,
      extraContext
    ) {
      return runReader(
        "export",
        mode,
        extraContext
      );
    }


    // =====================================================
    // 攔截原生閱讀器操作按鈕
    // =====================================================

    async function readerClickInterceptor(
      event
    ) {
      if (
        destroyed ||
        bypassReaderClick
      ) {
        return;
      }

      const button =
        event.target?.closest?.(
          "[data-reader-action]"
        );

      if (!button) {
        return;
      }

      const action =
        button.dataset
          .readerAction;

      if (
        action !== "test" &&
        action !== "export"
      ) {
        return;
      }

      const bar =
        button.closest(
          ".format-reader-actions"
        );

      const mode =
        bar?.id
          ?.toLowerCase()
          .includes("html")
          ? "html"
          : "pixiv";

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      button.disabled =
        true;

      const oldText =
        button.textContent;

      button.textContent =
        action === "export"
          ? "準備輸出…"
          : "準備測試…";

      try {
        if (
          action === "export"
        ) {
          await exportReader(
            mode,
            {
              source:
                "native-button"
            }
          );

        } else {
          await previewReader(
            mode,
            {
              source:
                "native-button"
            }
          );
        }

      } catch (error) {
        console.error(
          "[Firehaha Native Adapter]",
          error
        );

        alert(
          (
            action === "export"
              ? "輸出準備失敗："
              : "測試閱讀準備失敗："
          ) +
          String(
            error?.message ||
            error
          )
        );

      } finally {
        button.disabled =
          false;

        button.textContent =
          oldText;
      }
    }


    document.addEventListener(
      "click",
      readerClickInterceptor,
      true
    );

    cleanupFunctions.push(() => {
      document.removeEventListener(
        "click",
        readerClickInterceptor,
        true
      );
    });


    // =====================================================
    // ReaderArtifact 狀態監測
    // =====================================================

    function onArtifactCreated(
      event
    ) {
      const detail =
        event.detail || {};

      readerState.lastArtifact = {
        mode:
          detail.mode,

        hash:
          detail.hash,

        bytes:
          detail.bytes,

        nativePurpose:
          detail.purpose,

        actualPurpose:
          currentReaderIntent
            ?.intent ||
          (
            detail.purpose ===
              "export"
              ? "preview"
              : detail.purpose ===
                  "preview"
                ? "export"
                : detail.purpose
          ),

        createdAt:
          Date.now()
      };
    }


    document.addEventListener(
      "readerartifact:created",
      onArtifactCreated
    );

    cleanupFunctions.push(() => {
      document.removeEventListener(
        "readerartifact:created",
        onArtifactCreated
      );
    });


    // =====================================================
    // 對外核心
    // =====================================================

    const nativeAdapter = {
      version:
        ADAPTER_VERSION,

      assets: {
        api:
          enhancedMaterialApi,

        registerType:
          registerMaterialType,

        getTypes() {
          return enhancedMaterialApi
            .getTypes();
        },

        getAll:
          loadMaterials,

        getById,

        add:
          addMaterial,

        update:
          updateMaterial,

        remove:
          removeMaterial,

        clear:
          clearMaterials,

        listByKind,

        inferKind:
          inferMaterialKind,

        normalize:
          normalizeMaterial,

        refresh:
          requestNativeMaterialRefresh,

        makeId
      },

      reader: {
        state:
          readerState,

        cache:
          readerState.cache,

        registerPreflight:
          registerReaderPreflight,

        registerTransform:
          registerAdapterTransform,

        prepare:
          prepareReader,

        preview:
          previewReader,

        export:
          exportReader,

        run:
          runReader,

        getIntent() {
          return currentReaderIntent
            ? Object.assign(
                {},
                currentReaderIntent
              )
            : null;
        },

        clearCache() {
          Object.keys(
            readerState.cache
          ).forEach(key => {
            delete readerState
              .cache[key];
          });
        }
      },

      lifecycle: {
        emit,

        on(type, listener, options) {
          document.addEventListener(
            type,
            listener,
            options
          );

          return function remove() {
            document.removeEventListener(
              type,
              listener,
              options
            );
          };
        }
      }
    };


    window.FirehahaNativeAdapter =
      nativeAdapter;


    // =====================================================
    // 測試用 Preflight
    // =====================================================

    const removeDefaultPreflight =
      registerReaderPreflight(
        "adapter-health-check",

        async context => {
          return {
            ok:
              true,

            intent:
              context.intent,

            mode:
              context.mode,

            materialCount:
              loadMaterials()
                .length,

            registeredTypes:
              materialTypes.size
          };
        },

        1
      );


    cleanupFunctions.push(
      removeDefaultPreflight
    );


    api.toast(
      "原生素材庫與閱讀器適配核心已啟用"
    );


    // =====================================================
    // 清理
    // =====================================================

    return function cleanup() {
      destroyed =
        true;

      cleanupFunctions
        .splice(0)
        .reverse()
        .forEach(fn => {
          try {
            fn();
          } catch (error) {
            console.warn(
              "[Native Adapter cleanup]",
              error
            );
          }
        });

      adapterTransforms.forEach(
        remove => {
          try {
            remove();
          } catch (error) {}
        }
      );

      adapterTransforms.clear();

      if (
        window.MaterialLibraryAPI ===
        enhancedMaterialApi
      ) {
        window.MaterialLibraryAPI =
          originalMaterialApi;
      }

      if (
        window.FirehahaNativeAdapter ===
        nativeAdapter
      ) {
        delete window
          .FirehahaNativeAdapter;
      }

      currentReaderIntent =
        null;
    };
  }
});