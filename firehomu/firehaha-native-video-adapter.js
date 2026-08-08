// @firehaha-plugin {"id":"official.native-video-adapter","name":"原生影片素材適配器","version":"1.0.1","author":"Firehaha","description":"讓原生素材庫支援影片、過場與背景影片，並支援新遊戲關閉播放器、取消跳頁與重置按鈕。"}

FirehahaPlugins.register({
  id: "official.native-video-adapter",
  name: "原生影片素材適配器",
  version: "1.0.1",

  async setup(api) {
    "use strict";


    // =====================================================
    // 基本設定
    // =====================================================

    const DB_NAME =
      "FirehahaNativeMediaVault";

    const DB_VERSION =
      1;

    const STORE_NAME =
      "media";

    const CACHE_KEY =
      "nativeVideoAssets";

    const PACKAGE_ID =
      "fh-native-video-package";

    const RUNTIME_MARK =
      "data-fh-native-video-runtime-v1-0-1";

    const VIDEO_EXTENSIONS =
      new Set([
        "mp4",
        "webm",
        "mov",
        "m4v",
        "ogv",
        "ogg",
        "mkv",
        "avi"
      ]);

    let db =
      null;

    let destroyed =
      false;

    let libraryObserver =
      null;

    let previewObserver =
      null;

    const localObjectUrls =
      new Map();

    const localPreviewVideos =
      new Map();

    const cleanupFunctions =
      [];


    // =====================================================
    // 等待原生 Adapter
    // =====================================================

    async function waitForAdapter() {
      const startedAt =
        Date.now();

      while (
        !window.FirehahaNativeAdapter &&
        Date.now() - startedAt < 12000
      ) {
        await new Promise(resolve => {
          setTimeout(resolve, 80);
        });
      }

      if (!window.FirehahaNativeAdapter) {
        throw new Error(
          "找不到 FirehahaNativeAdapter，請先載入原生素材庫與閱讀器適配核心"
        );
      }
    }


    await waitForAdapter();

    const adapter =
      window.FirehahaNativeAdapter;


    // =====================================================
    // 共用工具
    // =====================================================

    function makeId(prefix) {
      if (
        window.crypto &&
        typeof crypto.randomUUID ===
          "function"
      ) {
        return (
          prefix +
          crypto.randomUUID()
        );
      }

      return (
        prefix +
        Date.now().toString(36) +
        "_" +
        Math.random()
          .toString(36)
          .slice(2, 10)
      );
    }


    function extensionOf(name) {
      const text =
        String(name || "");

      const index =
        text.lastIndexOf(".");

      return index >= 0
        ? text
            .slice(index + 1)
            .toLowerCase()
        : "";
    }


    function isVideoFile(file) {
      if (!file) {
        return false;
      }

      return (
        String(file.type || "")
          .toLowerCase()
          .startsWith("video/") ||
        VIDEO_EXTENSIONS.has(
          extensionOf(file.name)
        )
      );
    }


    function isVideoMaterial(item) {
      if (!item) {
        return false;
      }

      return (
        String(
          item.kind ||
          item.type ||
          ""
        ).toLowerCase() === "video" ||
        String(item.mime || "")
          .toLowerCase()
          .startsWith("video/") ||
        VIDEO_EXTENSIONS.has(
          extensionOf(item.name)
        )
      );
    }


    function formatSize(bytes) {
      const size =
        Number(bytes) || 0;

      if (size < 1024) {
        return size + " B";
      }

      if (size < 1048576) {
        return (
          size / 1024
        ).toFixed(1) + " KB";
      }

      return (
        size / 1048576
      ).toFixed(1) + " MB";
    }


    function blobToDataUrl(blob) {
      return new Promise(
        (resolve, reject) => {
          const reader =
            new FileReader();

          reader.onload =
            () => {
              resolve(
                String(
                  reader.result || ""
                )
              );
            };

          reader.onerror =
            () => {
              reject(
                reader.error ||
                new Error(
                  "影片資料轉換失敗"
                )
              );
            };

          reader.readAsDataURL(blob);
        }
      );
    }


    function escapeJsonForHtml(value) {
      return JSON.stringify(value)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026");
    }


    function safeLabel(value, fallback) {
      return String(
        value ||
        fallback ||
        ""
      )
        .replace(/\]/g, "）")
        .replace(/\|/g, "｜")
        .trim();
    }


    function toast(message) {
      if (
        api &&
        typeof api.toast ===
          "function"
      ) {
        api.toast(message);
        return;
      }

      console.log(message);
    }


    function isVisible(element) {
      if (!element) {
        return false;
      }

      const style =
        getComputedStyle(element);

      return (
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    }


    // =====================================================
    // IndexedDB
    // 與音訊插件共用 FirehahaNativeMediaVault
    // =====================================================

    function openDatabase() {
      return new Promise(
        (resolve, reject) => {
          const request =
            indexedDB.open(
              DB_NAME,
              DB_VERSION
            );

          request.onupgradeneeded =
            event => {
              const database =
                event.target.result;

              if (
                !database.objectStoreNames
                  .contains(STORE_NAME)
              ) {
                const store =
                  database.createObjectStore(
                    STORE_NAME,
                    {
                      keyPath: "id"
                    }
                  );

                store.createIndex(
                  "kind",
                  "kind",
                  {
                    unique: false
                  }
                );

                store.createIndex(
                  "updatedAt",
                  "updatedAt",
                  {
                    unique: false
                  }
                );
              }
            };

          request.onsuccess =
            () => {
              resolve(
                request.result
              );
            };

          request.onerror =
            () => {
              reject(
                request.error ||
                new Error(
                  "無法開啟媒體資料庫"
                )
              );
            };
        }
      );
    }


    function requestResult(request) {
      return new Promise(
        (resolve, reject) => {
          request.onsuccess =
            () => {
              resolve(
                request.result
              );
            };

          request.onerror =
            () => {
              reject(
                request.error ||
                new Error(
                  "媒體資料庫操作失敗"
                )
              );
            };
        }
      );
    }


    function transactionDone(transaction) {
      return new Promise(
        (resolve, reject) => {
          transaction.oncomplete =
            () => resolve();

          transaction.onerror =
            () => {
              reject(
                transaction.error ||
                new Error(
                  "媒體資料庫交易失敗"
                )
              );
            };

          transaction.onabort =
            () => {
              reject(
                transaction.error ||
                new Error(
                  "媒體資料庫交易中止"
                )
              );
            };
        }
      );
    }


    async function putMedia(record) {
      const transaction =
        db.transaction(
          STORE_NAME,
          "readwrite"
        );

      transaction
        .objectStore(STORE_NAME)
        .put(record);

      await transactionDone(
        transaction
      );

      return record;
    }


    async function getMedia(id) {
      if (!id) {
        return null;
      }

      const transaction =
        db.transaction(
          STORE_NAME,
          "readonly"
        );

      return requestResult(
        transaction
          .objectStore(STORE_NAME)
          .get(String(id))
      );
    }


    async function deleteMedia(id) {
      if (!id) {
        return;
      }

      const transaction =
        db.transaction(
          STORE_NAME,
          "readwrite"
        );

      transaction
        .objectStore(STORE_NAME)
        .delete(String(id));

      await transactionDone(
        transaction
      );
    }


    // =====================================================
    // 註冊影片素材類型
    // =====================================================

    const unregisterType =
      adapter.assets.registerType({
        kind:
          "video",

        label:
          "影片",

        icon:
          "🎬",

        accept: [
          "video/*",
          ".mp4",
          ".webm",
          ".mov",
          ".m4v",
          ".ogv",
          ".mkv",
          ".avi"
        ],

        storage:
          "FirehahaNativeMediaVault",

        insertMode:
          "reference"
      });

    cleanupFunctions.push(
      unregisterType
    );


    // =====================================================
    // 匯入影片
    // =====================================================

    async function importVideoFile(file) {
      if (!isVideoFile(file)) {
        throw new Error(
          "不是可辨識的影片檔案"
        );
      }

      const assetId =
        makeId(
          "asset_video_"
        );

      const vaultId =
        makeId(
          "vid_"
        );

      const mime =
        file.type ||
        "video/mp4";

      await putMedia({
        id:
          vaultId,

        assetId,

        kind:
          "video",

        name:
          file.name,

        mime,

        size:
          file.size,

        blob:
          file,

        createdAt:
          Date.now(),

        updatedAt:
          Date.now()
      });

      const material =
        adapter.assets.add({
          id:
            assetId,

          assetId,

          vaultId,

          type:
            "video",

          kind:
            "video",

          name:
            file.name,

          mime,

          size:
            file.size,

          data:
            "",

          createdAt:
            Date.now(),

          updatedAt:
            Date.now()
        });

      return material;
    }


    async function importVideoFiles(files) {
      const list =
        Array.from(files || [])
          .filter(isVideoFile);

      if (!list.length) {
        return [];
      }

      const imported =
        [];

      for (const file of list) {
        try {
          const material =
            await importVideoFile(
              file
            );

          imported.push(
            material
          );

        } catch (error) {
          console.error(
            "[原生影片匯入失敗]",
            file?.name,
            error
          );

          alert(
            `「${file?.name || "影片"}」匯入失敗：` +
            String(
              error?.message ||
              error
            )
          );
        }
      }

      adapter.assets.refresh();

      if (imported.length) {
        toast(
          `已加入 ${imported.length} 個影片素材`
        );
      }

      return imported;
    }


    // =====================================================
    // 攔截原生檔案選擇器
    // =====================================================

    function onNativeFileChange(event) {
      const input =
        event.target;

      if (
        !input ||
        input.id !==
          "material-file-input"
      ) {
        return;
      }

      const files =
        Array.from(
          input.files || []
        );

      const videoFiles =
        files.filter(
          isVideoFile
        );

      if (!videoFiles.length) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const nonVideo =
        files.filter(
          file =>
            !isVideoFile(file)
        );

      input.value =
        "";

      if (nonVideo.length) {
        alert(
          "請將影片與圖片、文字或音訊分開選擇。\n本次只匯入影片。"
        );
      }

      importVideoFiles(
        videoFiles
      ).catch(error => {
        console.error(error);

        alert(
          "影片匯入失敗：" +
          String(
            error?.message ||
            error
          )
        );
      });
    }


    document.addEventListener(
      "change",
      onNativeFileChange,
      true
    );

    cleanupFunctions.push(() => {
      document.removeEventListener(
        "change",
        onNativeFileChange,
        true
      );
    });


    // =====================================================
    // 攔截拖入素材庫
    // =====================================================

    function onNativeLibraryDrop(event) {
      const dropZone =
        event.target?.closest?.(
          "#material-drop-zone"
        );

      if (!dropZone) {
        return;
      }

      const files =
        Array.from(
          event.dataTransfer?.files ||
          []
        );

      const videoFiles =
        files.filter(
          isVideoFile
        );

      if (!videoFiles.length) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      importVideoFiles(
        videoFiles
      ).catch(error => {
        console.error(error);

        alert(
          "影片拖入失敗：" +
          String(
            error?.message ||
            error
          )
        );
      });
    }


    document.addEventListener(
      "drop",
      onNativeLibraryDrop,
      true
    );

    cleanupFunctions.push(() => {
      document.removeEventListener(
        "drop",
        onNativeLibraryDrop,
        true
      );
    });


    // =====================================================
    // 編輯器插入工具
    // =====================================================

    function insertTextarea(
      textarea,
      text
    ) {
      if (!textarea) {
        throw new Error(
          "找不到文字編輯區"
        );
      }

      textarea.focus();

      const start =
        Number.isFinite(
          textarea.selectionStart
        )
          ? textarea.selectionStart
          : textarea.value.length;

      const end =
        Number.isFinite(
          textarea.selectionEnd
        )
          ? textarea.selectionEnd
          : start;

      textarea.setRangeText(
        text,
        start,
        end,
        "end"
      );

      textarea.dispatchEvent(
        new Event(
          "input",
          {
            bubbles: true
          }
        )
      );

      textarea.dispatchEvent(
        new Event(
          "change",
          {
            bubbles: true
          }
        )
      );
    }


    function insertIntoVisualEditor(
      editor,
      text
    ) {
      editor.focus();

      const node =
        document.createTextNode(
          text
        );

      const selection =
        window.getSelection();

      if (
        selection &&
        selection.rangeCount &&
        editor.contains(
          selection.anchorNode
        )
      ) {
        const range =
          selection.getRangeAt(0);

        range.deleteContents();
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);

        selection.removeAllRanges();
        selection.addRange(range);

      } else {
        editor.appendChild(node);
      }

      editor.dispatchEvent(
        new Event(
          "input",
          {
            bubbles: true
          }
        )
      );

      editor.dispatchEvent(
        new Event(
          "change",
          {
            bubbles: true
          }
        )
      );
    }


    function insertSyntax(text) {
      const htmlSource =
        document.getElementById(
          "htmlSourceEditor"
        );

      const htmlVisual =
        document.getElementById(
          "htmlDesignEditor"
        );

      const htmlWorkspace =
        document.getElementById(
          "htmlWorkspace"
        );

      const htmlActive =
        htmlWorkspace
          ? (
              htmlWorkspace.classList
                .contains("active") ||
              isVisible(
                htmlWorkspace
              )
            )
          : (
              isVisible(
                htmlSource
              ) ||
              isVisible(
                htmlVisual
              )
            );

      if (
        htmlActive &&
        isVisible(htmlSource)
      ) {
        insertTextarea(
          htmlSource,
          text
        );

        return;
      }

      if (
        htmlActive &&
        isVisible(htmlVisual) &&
        htmlVisual.isContentEditable
      ) {
        insertIntoVisualEditor(
          htmlVisual,
          text
        );

        return;
      }

      insertTextarea(
        document.getElementById(
          "pageText"
        ),
        text
      );
    }


    function materialId(material) {
      return String(
        material.assetId ||
        material.id
      );
    }


    function insertVideoPlayReference(
      material
    ) {
      const label =
        prompt(
          "影片按鈕要顯示什麼文字？",
          "觀看影片"
        );

      if (label == null) {
        return;
      }

      insertSyntax(
        "\n" +
        `[videoplay:${materialId(material)}|${safeLabel(label, "觀看影片")}]\n`
      );

      toast(
        "已插入影片播放標籤"
      );
    }


    function askTargetPage() {
      const value =
        prompt(
          "影片播放完後，要前往第幾頁？",
          "2"
        );

      if (value == null) {
        return null;
      }

      const pageNumber =
        Math.trunc(
          Number(value)
        );

      if (
        !Number.isFinite(
          pageNumber
        ) ||
        pageNumber < 1
      ) {
        alert(
          "頁碼必須是 1 以上的整數"
        );

        return null;
      }

      return pageNumber;
    }


    function insertVideoJumpReference(
      material
    ) {
      const pageNumber =
        askTargetPage();

      if (pageNumber == null) {
        return;
      }

      const label =
        prompt(
          "影片按鈕要顯示什麼文字？",
          "觀看影片並繼續"
        );

      if (label == null) {
        return;
      }

      insertSyntax(
        "\n" +
        `[videojump:${materialId(material)}|${pageNumber}|${safeLabel(label, "觀看影片並繼續")}]\n`
      );

      toast(
        `已插入影片跳頁標籤：第 ${pageNumber} 頁`
      );
    }


    function insertCutsceneReference(
      material
    ) {
      const pageNumber =
        askTargetPage();

      if (pageNumber == null) {
        return;
      }

      insertSyntax(
        "\n" +
        `[cutscene:${materialId(material)}|${pageNumber}]\n`
      );

      toast(
        `已插入過場動畫：播放完前往第 ${pageNumber} 頁`
      );
    }


    function insertVideoBackgroundReference(
      material
    ) {
      insertSyntax(
        "\n" +
        `[videobg:${materialId(material)}]\n`
      );

      toast(
        "已插入背景影片標籤"
      );
    }


    // =====================================================
    // 素材庫影片預覽
    // =====================================================

    async function toggleVideoPreview(
      material,
      button
    ) {
      const id =
        materialId(
          material
        );

      const existing =
        localPreviewVideos.get(
          id
        );

      if (
        existing &&
        !existing.paused
      ) {
        existing.pause();
        existing.currentTime =
          0;

        button.textContent =
          "▶ 預覽";

        return;
      }

      const record =
        await getMedia(
          material.vaultId
        );

      if (
        !record ||
        !(record.blob instanceof Blob)
      ) {
        throw new Error(
          "找不到影片 Blob"
        );
      }

      let objectUrl =
        localObjectUrls.get(
          id
        );

      if (!objectUrl) {
        objectUrl =
          URL.createObjectURL(
            record.blob
          );

        localObjectUrls.set(
          id,
          objectUrl
        );
      }

      let video =
        existing;

      if (!video) {
        video =
          document.createElement(
            "video"
          );

        video.src =
          objectUrl;

        video.controls =
          true;

        video.playsInline =
          true;

        video.preload =
          "metadata";

        video.style.position =
          "fixed";

        video.style.left =
          "50%";

        video.style.top =
          "50%";

        video.style.transform =
          "translate(-50%,-50%)";

        video.style.width =
          "min(900px,92vw)";

        video.style.maxHeight =
          "84vh";

        video.style.background =
          "#000";

        video.style.zIndex =
          "1000030";

        video.style.borderRadius =
          "12px";

        video.style.boxShadow =
          "0 15px 50px rgba(0,0,0,.55)";

        const closeButton =
          document.createElement(
            "button"
          );

        closeButton.type =
          "button";

        closeButton.textContent =
          "✕";

        closeButton.style.position =
          "fixed";

        closeButton.style.right =
          "20px";

        closeButton.style.top =
          "20px";

        closeButton.style.zIndex =
          "1000031";

        closeButton.style.fontSize =
          "18px";

        closeButton.addEventListener(
          "click",
          () => {
            video.pause();
            video.remove();
            closeButton.remove();

            button.textContent =
              "▶ 預覽";
          }
        );

        video.addEventListener(
          "ended",
          () => {
            video.remove();
            closeButton.remove();

            button.textContent =
              "▶ 預覽";
          }
        );

        video.__fhCloseButton =
          closeButton;

        localPreviewVideos.set(
          id,
          video
        );
      }

      if (!video.isConnected) {
        document.body.append(
          video,
          video.__fhCloseButton
        );
      }

      await video.play();

      button.textContent =
        "■ 停止";
    }


    // =====================================================
    // 強化素材卡片
    // =====================================================

    function enhanceMaterialCards() {
      const list =
        document.getElementById(
          "material-library-list"
        );

      if (!list) {
        return;
      }

      const allMaterials =
        adapter.assets.getAll();

      list
        .querySelectorAll(
          ".material-item"
        )
        .forEach(card => {
          const index =
            Number(
              card.dataset.idx
            );

          const material =
            card.__materialItem ||
            allMaterials[index];

          if (
            !isVideoMaterial(
              material
            )
          ) {
            return;
          }

          if (
            card.dataset
              .fhNativeVideoBound ===
              "1"
          ) {
            return;
          }

          card.dataset
            .fhNativeVideoBound =
            "1";

          card.dataset
            .materialKind =
            "video";

          card.classList.add(
            "fh-native-video-card"
          );

          const firstBox =
            Array.from(
              card.children
            ).find(element => {
              return (
                element.tagName !==
                  "BUTTON" &&
                !element.classList
                  .contains(
                    "material-name"
                  )
              );
            });

          if (firstBox) {
            firstBox.textContent =
              "🎬";

            firstBox.classList.add(
              "fh-native-video-icon"
            );
          }

          const details =
            document.createElement(
              "div"
            );

          details.className =
            "fh-native-video-meta";

          details.textContent =
            formatSize(
              material.size
            );

          const actions =
            document.createElement(
              "div"
            );

          actions.className =
            "fh-native-video-actions";

          const previewButton =
            document.createElement(
              "button"
            );

          previewButton.type =
            "button";

          previewButton.textContent =
            "▶ 預覽";

          const playButton =
            document.createElement(
              "button"
            );

          playButton.type =
            "button";

          playButton.textContent =
            "＋ 影片";

          const cutsceneButton =
            document.createElement(
              "button"
            );

          cutsceneButton.type =
            "button";

          cutsceneButton.textContent =
            "＋ 過場";

          const backgroundButton =
            document.createElement(
              "button"
            );

          backgroundButton.type =
            "button";

          backgroundButton.textContent =
            "＋ 背景";

          [
            previewButton,
            playButton,
            cutsceneButton,
            backgroundButton
          ].forEach(button => {
            button.addEventListener(
              "pointerdown",
              event => {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
              },
              true
            );
          });

          previewButton.addEventListener(
            "click",
            event => {
              event.preventDefault();
              event.stopPropagation();

              toggleVideoPreview(
                material,
                previewButton
              ).catch(error => {
                alert(
                  "影片預覽失敗：" +
                  String(
                    error?.message ||
                    error
                  )
                );
              });
            }
          );

          playButton.addEventListener(
            "click",
            event => {
              event.preventDefault();
              event.stopPropagation();

              const mode =
                confirm(
                  "按「確定」建立播放完跳頁按鈕。\n按「取消」建立普通影片按鈕。"
                );

              if (mode) {
                insertVideoJumpReference(
                  material
                );
              } else {
                insertVideoPlayReference(
                  material
                );
              }
            }
          );

          cutsceneButton.addEventListener(
            "click",
            event => {
              event.preventDefault();
              event.stopPropagation();

              insertCutsceneReference(
                material
              );
            }
          );

          backgroundButton.addEventListener(
            "click",
            event => {
              event.preventDefault();
              event.stopPropagation();

              insertVideoBackgroundReference(
                material
              );
            }
          );

          actions.append(
            previewButton,
            playButton,
            cutsceneButton,
            backgroundButton
          );

          const name =
            card.querySelector(
              ".material-name"
            );

          if (name) {
            name.insertAdjacentElement(
              "afterend",
              details
            );
          } else {
            card.appendChild(
              details
            );
          }

          card.appendChild(
            actions
          );

          const removeButton =
            card.querySelector(
              ".material-remove"
            );

          if (removeButton) {
            removeButton.addEventListener(
              "click",
              () => {
                const id =
                  materialId(
                    material
                  );

                const preview =
                  localPreviewVideos.get(
                    id
                  );

                if (preview) {
                  preview.pause();
                  preview.remove();
                  preview.__fhCloseButton
                    ?.remove();

                  localPreviewVideos.delete(
                    id
                  );
                }

                const url =
                  localObjectUrls.get(
                    id
                  );

                if (url) {
                  URL.revokeObjectURL(
                    url
                  );

                  localObjectUrls.delete(
                    id
                  );
                }

                deleteMedia(
                  material.vaultId
                ).catch(error => {
                  console.warn(
                    "刪除影片 Blob 失敗",
                    error
                  );
                });
              },
              true
            );
          }
        });
    }


    function installLibraryObserver() {
      const list =
        document.getElementById(
          "material-library-list"
        );

      if (!list) {
        return false;
      }

      libraryObserver
        ?.disconnect();

      libraryObserver =
        new MutationObserver(() => {
          requestAnimationFrame(
            enhanceMaterialCards
          );
        });

      libraryObserver.observe(
        list,
        {
          childList:
            true,

          subtree:
            true
        }
      );

      enhanceMaterialCards();

      return true;
    }


    if (!installLibraryObserver()) {
      const bodyWaiter =
        new MutationObserver(() => {
          if (
            installLibraryObserver()
          ) {
            bodyWaiter.disconnect();
          }
        });

      bodyWaiter.observe(
        document.body,
        {
          childList:
            true,

          subtree:
            true
        }
      );

      cleanupFunctions.push(() => {
        bodyWaiter.disconnect();
      });
    }


    // =====================================================
    // Reader Preflight
    // =====================================================

    const unregisterPreflight =
      adapter.reader.registerPreflight(
        "native-video-package",

        async context => {
          const materials =
            adapter.assets
              .listByKind(
                "video"
              );

          const packageData =
            Object.create(null);

          const missing =
            [];

          for (
            const material
            of materials
          ) {
            const assetId =
              materialId(
                material
              );

            const record =
              await getMedia(
                material.vaultId
              );

            if (
              !record ||
              !(record.blob instanceof Blob)
            ) {
              missing.push({
                assetId,

                name:
                  material.name
              });

              continue;
            }

            const dataUrl =
              await blobToDataUrl(
                record.blob
              );

            packageData[assetId] = {
              id:
                assetId,

              name:
                material.name,

              mime:
                material.mime ||
                record.mime ||
                "video/mp4",

              size:
                Number(
                  material.size ||
                  record.size ||
                  record.blob.size ||
                  0
                ),

              dataUrl
            };
          }

          context.cache[
            CACHE_KEY
          ] =
            packageData;

          return {
            count:
              Object.keys(
                packageData
              ).length,

            missing,

            bytes:
              Object.values(
                packageData
              ).reduce(
                (
                  total,
                  item
                ) =>
                  total +
                  String(
                    item.dataUrl ||
                    ""
                  ).length,

                0
              )
          };
        },

        110
      );

    cleanupFunctions.push(
      unregisterPreflight
    );


    // =====================================================
    // Reader Runtime Transform
    // =====================================================

    const unregisterTransform =
      adapter.reader.registerTransform(
        "native-video-runtime",

        function transformReader(
          html,
          context
        ) {
          if (
            typeof html !==
              "string" ||
            html.includes(
              RUNTIME_MARK
            )
          ) {
            return html;
          }

          const packageData =
            context.cache[
              CACHE_KEY
            ] || {};

          const packageJson =
            escapeJsonForHtml(
              packageData
            );

          const style = `
<style ${RUNTIME_MARK}>

.fh-video-button{
  display:block;
  width:100%;
  max-width:520px;
  box-sizing:border-box;
  margin:12px auto;
  padding:12px 18px;
  border:0;
  border-radius:24px;
  background:#435a74;
  color:#fff;
  font:700 15px/1.4 system-ui,"Noto Sans TC",sans-serif;
  cursor:pointer;
}

.fh-video-button.is-playing{
  background:#26705a;
}

.fh-video-overlay{
  position:fixed;
  inset:0;
  z-index:2147483000;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:20px;
  background:rgba(0,0,0,.92);
  box-sizing:border-box;
}

.fh-video-overlay video{
  width:min(1100px,96vw);
  max-height:90vh;
  background:#000;
  border-radius:8px;
}

.fh-video-close{
  position:fixed;
  right:18px;
  top:18px;
  z-index:2147483001;
  width:44px;
  height:44px;
  padding:0;
  border:0;
  border-radius:50%;
  background:rgba(255,255,255,.18);
  color:#fff;
  font-size:22px;
  cursor:pointer;
}

.fh-video-background{
  position:fixed;
  inset:0;
  z-index:-2;
  overflow:hidden;
  background:#000;
  pointer-events:none;
  transition:opacity 1.5s ease;
}

.fh-video-background video{
  width:100%;
  height:100%;
  object-fit:cover;
}

.fh-video-background::after{
  content:"";
  position:absolute;
  inset:0;
  background:rgba(0,0,0,.25);
}

.fh-video-background.is-fading{
  opacity:0;
}

.fh-video-error{
  max-width:520px;
  margin:8px auto;
  padding:8px 12px;
  border-radius:8px;
  background:#fff0f0;
  color:#913838;
  text-align:center;
  font:12px/1.5 system-ui,sans-serif;
}

</style>
`;

          const dataBlock =
            `<script ` +
            `type="application/json" ` +
            `id="${PACKAGE_ID}">` +
            packageJson +
            `</scr` +
            `ipt>`;

          const runtimeCode =
            String.raw`
(function(){

"use strict";

if(window.__fhNativeVideoRuntimeV101){
  return;
}

window.__fhNativeVideoRuntimeV101 =
true;


var packageElement =
document.getElementById(
  "fh-native-video-package"
);


var assets = {};


try{

  assets =
  JSON.parse(
    packageElement
    ?
    packageElement.textContent
    :
    "{}"
  );

}catch(error){

  console.error(
    "[Firehaha Video Package]",
    error
  );

}


var activeOverlay = null;

var activeButton = null;

var backgroundLayer = null;

var backgroundFadeTimer = null;

var mediaGeneration = 0;


function resetVideoButton(button){

  if(!button){
    return;
  }

  button.textContent =
  button.getAttribute(
    "data-video-label"
  ) ||
  "觀看影片";

  button.classList.remove(
    "is-playing"
  );

  button.setAttribute(
    "aria-pressed",
    "false"
  );

}


function getAsset(id){

  return (
    assets[id] ||
    null
  );

}


function showError(
  button,
  message
){

  var old =
  button.nextElementSibling;


  if(
    old &&
    old.classList.contains(
      "fh-video-error"
    )
  ){
    old.remove();
  }


  var note =
  document.createElement(
    "div"
  );


  note.className =
  "fh-video-error";


  note.textContent =
  message;


  button.insertAdjacentElement(
    "afterend",
    note
  );

}


function closeOverlay(){

  if(!activeOverlay){
    resetVideoButton(
      activeButton
    );

    activeButton = null;

    return;
  }


  var video =
  activeOverlay.querySelector(
    "video"
  );


  if(video){

    try{
      video.pause();
      video.currentTime=0;
    }catch(error){}

  }


  activeOverlay.remove();

  activeOverlay =
  null;

  resetVideoButton(
    activeButton
  );

  activeButton = null;

}


function navigate(pageNumber,reason){

  var navigation =
  window.FirehahaReaderNavigation;


  if(
    !navigation ||
    typeof navigation.goToPage !==
      "function"
  ){
    return false;
  }


  return navigation.goToPage(
    pageNumber,
    {
      reason:
      reason || "video",

      pushHistory:
      true
    }
  );

}


function playOverlay(
  id,
  options,
  button
){

  var generation =
  mediaGeneration;

  var asset =
  getAsset(id);


  if(
    !asset ||
    !asset.dataUrl
  ){

    if(button){

      showError(
        button,
        "找不到影片封裝資料"
      );

    }

    return;
  }


  closeOverlay();


  var settings =
  options || {};


  var overlay =
  document.createElement(
    "div"
  );


  overlay.className =
  "fh-video-overlay";


  if(settings.cutscene){

    overlay.style.background =
    "#000";

  }


  var video =
  document.createElement(
    "video"
  );


  video.src =
  asset.dataUrl;


  video.controls =
  settings.controls !== false;


  video.autoplay =
  false;


  video.playsInline =
  true;


  video.preload =
  "auto";


  var close =
  document.createElement(
    "button"
  );


  close.type =
  "button";


  close.className =
  "fh-video-close";


  close.textContent =
  "×";


  close.addEventListener(
    "click",
    function(){

      closeOverlay();

    }
  );


  overlay.append(
    video,
    close
  );


  document.body.appendChild(
    overlay
  );


  activeOverlay =
  overlay;

  activeButton =
  button || null;

  if(activeButton){
    activeButton.classList.add(
      "is-playing"
    );

    activeButton.setAttribute(
      "aria-pressed",
      "true"
    );

    activeButton.textContent =
    "▶ 播放中";
  }


  video.addEventListener(
    "ended",
    function(){

      if(
        generation !==
        mediaGeneration
      ){
        if(
          activeOverlay ===
          overlay
        ){
          closeOverlay();
        }

        return;
      }

      var pageNumber =
      settings.pageNumber;


      closeOverlay();


      if(
        Number.isFinite(
          Number(pageNumber)
        ) &&
        Number(pageNumber) >= 1
      ){

        navigate(
          Math.trunc(
            Number(pageNumber)
          ),
          settings.cutscene
          ?
          "cutscene"
          :
          "videojump"
        );

      }

    }
  );


  video.play()
  .catch(
    function(error){

      if(
        generation !==
        mediaGeneration
      ){
        return;
      }

      console.warn(
        "[Firehaha Video Play]",
        error
      );


      if(button){

        showError(
          button,
          "瀏覽器阻擋影片播放，請再按一次"
        );

      }

    }
  );

}


function showBackground(id){

  var generation =
  mediaGeneration;

  var asset =
  getAsset(id);


  if(
    !asset ||
    !asset.dataUrl
  ){
    return false;
  }


  removeBackground();


  var layer =
  document.createElement(
    "div"
  );


  layer.className =
  "fh-video-background";


  var video =
  document.createElement(
    "video"
  );


  video.src =
  asset.dataUrl;


  video.autoplay =
  true;


  video.muted =
  true;


  video.defaultMuted =
  true;


  video.loop =
  true;


  video.playsInline =
  true;


  video.preload =
  "auto";


  layer.appendChild(
    video
  );


  document.body.prepend(
    layer
  );


  backgroundLayer =
  layer;


  video.play()
  .catch(
    function(error){

      if(
        generation !==
        mediaGeneration
      ){
        return;
      }

      console.warn(
        "[Firehaha Background Video]",
        error
      );

    }
  );


  return true;

}


function removeBackground(){

  if(backgroundFadeTimer !== null){
    clearTimeout(
      backgroundFadeTimer
    );

    backgroundFadeTimer =
    null;
  }

  if(!backgroundLayer){
    return;
  }


  var video =
  backgroundLayer.querySelector(
    "video"
  );


  if(video){

    try{
      video.pause();
      video.currentTime=0;
    }catch(error){}

  }


  backgroundLayer.remove();

  backgroundLayer =
  null;

}


function fadeOutBackground(){

  if(!backgroundLayer){
    return;
  }


  var layer =
  backgroundLayer;

  if(backgroundFadeTimer !== null){
    clearTimeout(
      backgroundFadeTimer
    );
  }


  layer.classList.add(
    "is-fading"
  );


  backgroundFadeTimer =
  setTimeout(
    function(){

      backgroundFadeTimer =
      null;

      if(
        backgroundLayer === layer
      ){

        removeBackground();

      }else{

        layer.remove();

      }

    },
    1550
  );

}


function makeButton(
  action,
  id,
  label,
  pageNumber
){

  var button =
  document.createElement(
    "button"
  );


  button.type =
  "button";


  button.className =
  "fh-video-button";


  button.textContent =
  label;


  button.setAttribute(
    "data-video-action",
    action
  );


  button.setAttribute(
    "data-video-id",
    id
  );

  button.setAttribute(
    "data-video-label",
    label
  );

  button.setAttribute(
    "aria-pressed",
    "false"
  );


  button.addEventListener(
    "click",
    function(event){

      event.preventDefault();
      event.stopPropagation();


      if(action === "play"){

        playOverlay(
          id,
          {
            controls:
            true
          },
          button
        );

        return;

      }


      if(action === "jump"){

        playOverlay(
          id,
          {
            controls:
            true,

            pageNumber:
            pageNumber
          },
          button
        );

        return;

      }


      if(action === "cutscene"){

        playOverlay(
          id,
          {
            controls:
            false,

            cutscene:
            true,

            pageNumber:
            pageNumber
          },
          button
        );

      }

    }
  );


  return button;

}


function processEventNode(node){

  var text =
  node.nodeValue || "";


  var backgroundPattern =
  /\[videobg:([^\]]+)\]/gi;


  var backgroundMatch;


  while(
    (
      backgroundMatch =
      backgroundPattern.exec(text)
    )
  ){

    showBackground(
      backgroundMatch[1].trim()
    );

  }


  if(
    /\[videofadeout\]/i
    .test(text)
  ){

    fadeOutBackground();

  }else if(
    /\[videooff\]/i
    .test(text)
  ){

    removeBackground();

  }


  node.nodeValue =
  text
  .replace(
    /\[videobg:[^\]]+\]/gi,
    ""
  )
  .replace(
    /\[videofadeout\]/gi,
    ""
  )
  .replace(
    /\[videooff\]/gi,
    ""
  );

}


function scanVideoEvents(root){

  if(!root){
    return;
  }


  var walker =
  document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    null
  );


  var nodes = [];


  while(
    walker.nextNode()
  ){

    var node =
    walker.currentNode;


    if(
      node.parentElement &&
      !node.parentElement.closest(
        "script,style,textarea,noscript," +
        ".fh-video-button," +
        ".fh-video-overlay"
      ) &&
      /\[(?:videobg:|videooff\]|videofadeout\])/i
      .test(
        node.nodeValue || ""
      )
    ){

      nodes.push(node);

    }

  }


  nodes.forEach(
    processEventNode
  );

}


function processButtonNode(node){

  var text =
  node.nodeValue || "";


  var pattern =
  /\[(?:(videoplay):([^|\]]+)\|([^\]]+)|(videojump):([^|\]]+)\|(\d+)\|([^\]]+)|(cutscene):([^|\]]+)\|(\d+))\]/gi;


  if(!pattern.test(text)){
    return;
  }


  pattern.lastIndex =
  0;


  var fragment =
  document.createDocumentFragment();


  var lastIndex =
  0;


  var match;


  while(
    (
      match =
      pattern.exec(text)
    )
  ){

    if(
      match.index >
      lastIndex
    ){

      fragment.appendChild(
        document.createTextNode(
          text.slice(
            lastIndex,
            match.index
          )
        )
      );

    }


    if(match[1]){

      fragment.appendChild(
        makeButton(
          "play",
          match[2].trim(),
          match[3].trim(),
          null
        )
      );

    }else if(match[4]){

      fragment.appendChild(
        makeButton(
          "jump",
          match[5].trim(),
          match[7].trim(),
          Number(match[6])
        )
      );

    }else if(match[8]){

      fragment.appendChild(
        makeButton(
          "cutscene",
          match[9].trim(),
          "播放過場",
          Number(match[10])
        )
      );

    }


    lastIndex =
    pattern.lastIndex;

  }


  if(
    lastIndex <
    text.length
  ){

    fragment.appendChild(
      document.createTextNode(
        text.slice(
          lastIndex
        )
      )
    );

  }


  node.replaceWith(
    fragment
  );

}


function scanVideoButtons(root){

  if(!root){
    return;
  }


  var walker =
  document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    null
  );


  var nodes = [];


  while(
    walker.nextNode()
  ){

    var node =
    walker.currentNode;


    if(
      node.parentElement &&
      !node.parentElement.closest(
        "script,style,textarea,noscript," +
        ".fh-video-button," +
        ".fh-video-overlay"
      ) &&
      /\[(?:videoplay:|videojump:|cutscene:)/i
      .test(
        node.nodeValue || ""
      )
    ){

      nodes.push(node);

    }

  }


  nodes.forEach(
    processButtonNode
  );

}


function scan(){

  if(!document.body){
    return;
  }


  scanVideoEvents(
    document.body
  );


  scanVideoButtons(
    document.body
  );

}


function start(){

  scan();


  if(
    typeof MutationObserver ===
    "undefined"
  ){
    return;
  }


  var queued =
  false;


  var observer =
  new MutationObserver(
    function(){

      if(queued){
        return;
      }


      queued =
      true;


      setTimeout(
        function(){

          queued =
          false;


          scan();

        },
        0
      );

    }
  );


  observer.observe(
    document.body,
    {
      childList:
      true,

      subtree:
      true,

      characterData:
      true
    }
  );

}


function resetAllVideo(){

  mediaGeneration++;

  closeOverlay();

  removeBackground();

  document
  .querySelectorAll(
    ".fh-video-button"
  )
  .forEach(
    resetVideoButton
  );

  document
  .querySelectorAll(
    ".fh-video-error"
  )
  .forEach(
    function(note){
      note.remove();
    }
  );

}


window.FirehahaNativeVideoRuntime={
  version:"1.0.1",
  reset:resetAllVideo,
  stopAll:resetAllVideo
};


document.addEventListener(
  "firehaha:reader-restart",
  function(event){
    if(
      !event.detail ||
      event.detail.phase === "before"
    ){
      resetAllVideo();
    }
  }
);


if(
  document.readyState ===
  "loading"
){

  document.addEventListener(
    "DOMContentLoaded",
    start,
    {
      once:
      true
    }
  );

}else{

  start();

}

})();
`;

          const runtimeScript =
            `<script ${RUNTIME_MARK}>` +
            runtimeCode +
            `</scr` +
            `ipt>`;

          let output =
            html;

          if (
            /<\/head\s*>/i
              .test(output)
          ) {
            output =
              output.replace(
                /<\/head\s*>/i,
                style +
                "\n</head>"
              );

          } else {
            output =
              style +
              output;
          }

          const injection =
            dataBlock +
            "\n" +
            runtimeScript;

          if (
            /<\/body\s*>/i
              .test(output)
          ) {
            output =
              output.replace(
                /<\/body\s*>/i,
                injection +
                "\n</body>"
              );

          } else {
            output +=
              injection;
          }

          return output;
        },

        520
      );

    cleanupFunctions.push(
      unregisterTransform
    );


    // =====================================================
    // 編輯器預覽：隱藏事件標籤
    // 第一版不在小預覽中真正播放影片
    // =====================================================

    function cleanPreviewVideoTags() {
      [
        document.getElementById(
          "htmlPreview"
        ),

        document.getElementById(
          "htmlIntegratedPreview"
        )
      ]
        .filter(Boolean)
        .forEach(root => {
          const walker =
            document.createTreeWalker(
              root,
              NodeFilter.SHOW_TEXT,
              null
            );

          const nodes =
            [];

          while (
            walker.nextNode()
          ) {
            const node =
              walker.currentNode;

            if (
              node.parentElement &&
              !node.parentElement.closest(
                "script,style,textarea"
              ) &&
              /\[(?:videobg:|videooff\]|videofadeout\])/i
                .test(
                  node.nodeValue ||
                  ""
                )
            ) {
              nodes.push(node);
            }
          }

          nodes.forEach(node => {
            node.nodeValue =
              String(
                node.nodeValue ||
                ""
              )
                .replace(
                  /\[videobg:[^\]]+\]/gi,
                  ""
                )
                .replace(
                  /\[videooff\]/gi,
                  ""
                )
                .replace(
                  /\[videofadeout\]/gi,
                  ""
                );
          });
        });
    }


    let previewQueued =
      false;

    previewObserver =
      new MutationObserver(() => {
        if (previewQueued) {
          return;
        }

        previewQueued =
          true;

        setTimeout(() => {
          previewQueued =
            false;

          cleanPreviewVideoTags();
        }, 30);
      });

    previewObserver.observe(
      document.body,
      {
        childList:
          true,

        subtree:
          true,

        characterData:
          true
      }
    );

    cleanPreviewVideoTags();


    // =====================================================
    // 插件樣式
    // =====================================================

    const removeStyle =
      api.addStyle(
        "native-video-adapter",
        `
        .fh-native-video-card{
          border-color:#455a64!important;
          background:#f5f8fa!important;
        }

        .fh-native-video-icon{
          height:70px!important;
          display:flex!important;
          align-items:center!important;
          justify-content:center!important;
          border-radius:4px!important;
          background:#dfe7eb!important;
          font-size:30px!important;
        }

        .fh-native-video-meta{
          margin-top:3px;
          color:#777;
          font-size:10px;
          text-align:center;
        }

        .fh-native-video-actions{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:4px;
          margin-top:6px;
        }

        .fh-native-video-actions button{
          min-width:0;
          padding:6px 4px!important;
          border:0!important;
          border-radius:14px!important;
          background:#455a64!important;
          color:#fff!important;
          font-size:10px!important;
          cursor:pointer;
        }

        .fh-native-video-actions button:first-child{
          background:#526b5a!important;
        }
        `
      );

    cleanupFunctions.push(
      removeStyle
    );


    // =====================================================
    // 啟動
    // =====================================================

    db =
      await openDatabase();

    adapter.assets.refresh();


    window.FirehahaNativeVideo = {
      version:
        "1.0.1",

      dbName:
        DB_NAME,

      importFiles:
        importVideoFiles,

      getMedia,

      deleteMedia,

      insertPlay(
        materialOrId
      ) {
        const material =
          typeof materialOrId ===
            "string"
            ? adapter.assets.getById(
                materialOrId
              )
            : materialOrId;

        if (!material) {
          throw new Error(
            "找不到影片素材"
          );
        }

        insertVideoPlayReference(
          material
        );
      },

      insertCutscene(
        materialOrId
      ) {
        const material =
          typeof materialOrId ===
            "string"
            ? adapter.assets.getById(
                materialOrId
              )
            : materialOrId;

        if (!material) {
          throw new Error(
            "找不到影片素材"
          );
        }

        insertCutsceneReference(
          material
        );
      },

      getAll() {
        return adapter.assets
          .listByKind(
            "video"
          );
      }
    };


    toast(
      "原生影片素材適配器已啟用"
    );


    // =====================================================
    // 清理
    // =====================================================

    return function cleanup() {
      destroyed =
        true;

      libraryObserver
        ?.disconnect();

      previewObserver
        ?.disconnect();

      cleanupFunctions
        .splice(0)
        .reverse()
        .forEach(fn => {
          try {
            fn();
          } catch (error) {
            console.warn(
              "[Native Video cleanup]",
              error
            );
          }
        });

      localPreviewVideos.forEach(
        video => {
          try {
            video.pause();
            video.remove();
            video.__fhCloseButton
              ?.remove();
          } catch (error) {}
        }
      );

      localPreviewVideos.clear();

      localObjectUrls.forEach(
        url => {
          try {
            URL.revokeObjectURL(
              url
            );
          } catch (error) {}
        }
      );

      localObjectUrls.clear();

      if (
        window.FirehahaNativeVideo
      ) {
        delete window
          .FirehahaNativeVideo;
      }

      if (db) {
        db.close();
        db = null;
      }
    };
  }
});
