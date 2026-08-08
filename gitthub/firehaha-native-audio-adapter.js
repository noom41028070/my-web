// @firehaha-plugin {"id":"official.native-audio-adapter","name":"原生音訊素材適配器","version":"1.0.1","author":"Firehaha","description":"擴充原生素材庫支援音訊檔，封裝至測試閱讀及正式輸出，並支援新遊戲重置播放器、進度與按鈕。"}

FirehahaPlugins.register({
  id: "official.native-audio-adapter",
  name: "原生音訊素材適配器",
  version: "1.0.1",

  async setup(api) {
    "use strict";

    const DB_NAME =
      "FirehahaNativeMediaVault";

    const DB_VERSION =
      1;

    const STORE_NAME =
      "media";

    const CACHE_KEY =
      "nativeAudioAssets";

    const PACKAGE_ID =
      "fh-native-audio-package";

    const RUNTIME_MARK =
      "data-fh-native-audio-runtime-v1-0-1";

    const AUDIO_EXTENSIONS =
      new Set([
        "mp3",
        "wav",
        "ogg",
        "oga",
        "m4a",
        "aac",
        "flac",
        "weba"
      ]);

    let db =
      null;

    let destroyed =
      false;

    let libraryObserver =
      null;

    let previewObserver =
      null;

    const localPlayers =
      new Map();

    const localObjectUrls =
      new Map();

    const cleanupFunctions =
      [];


    // =====================================================
    // 等待原生適配核心
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

      if (
        !window.FirehahaNativeAdapter
      ) {
        throw new Error(
          "找不到 FirehahaNativeAdapter，請先載入原生素材庫與閱讀器適配核心"
        );
      }
    }


    await waitForAdapter();

    const adapter =
      window.FirehahaNativeAdapter;


    // =====================================================
    // 工具
    // =====================================================

    function makeId(prefix) {
      if (
        crypto &&
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
      const value =
        String(name || "");

      const index =
        value.lastIndexOf(".");

      return index >= 0
        ? value
            .slice(index + 1)
            .toLowerCase()
        : "";
    }


    function isAudioFile(file) {
      if (!file) {
        return false;
      }

      return (
        String(file.type || "")
          .toLowerCase()
          .startsWith("audio/") ||
        AUDIO_EXTENSIONS.has(
          extensionOf(file.name)
        )
      );
    }


    function isAudioMaterial(item) {
      if (!item) {
        return false;
      }

      return (
        String(
          item.kind ||
          item.type ||
          ""
        ).toLowerCase() === "audio" ||
        String(item.mime || "")
          .toLowerCase()
          .startsWith("audio/") ||
        AUDIO_EXTENSIONS.has(
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
                  "音訊資料轉換失敗"
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


    // =====================================================
    // IndexedDB：只保存音訊 Blob
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
              resolve(request.result);
            };

          request.onerror =
            () => {
              reject(
                request.error ||
                new Error(
                  "無法開啟原生媒體資料庫"
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
              resolve(request.result);
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
                  "媒體資料庫交易已中止"
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
    // 註冊 audio 素材類型
    // =====================================================

    const unregisterType =
      adapter.assets.registerType({
        kind:
          "audio",

        label:
          "音訊",

        icon:
          "🎵",

        accept: [
          "audio/*",
          ".mp3",
          ".wav",
          ".ogg",
          ".oga",
          ".m4a",
          ".aac",
          ".flac",
          ".weba"
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
    // 匯入音訊
    // =====================================================

    async function importAudioFile(file) {
      if (!isAudioFile(file)) {
        throw new Error(
          "不是可辨識的音訊檔案"
        );
      }

      const assetId =
        makeId("asset_audio_");

      const vaultId =
        makeId("aud_");

      const mime =
        file.type ||
        "audio/mpeg";

      await putMedia({
        id:
          vaultId,

        assetId,

        kind:
          "audio",

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
            "audio",

          kind:
            "audio",

          name:
            file.name,

          mime,

          size:
            file.size,

          /*
           * 保持原生素材 JSON 精簡。
           * 真正 Blob 只存在 IndexedDB。
           */
          data:
            "",

          createdAt:
            Date.now(),

          updatedAt:
            Date.now()
        });

      return material;
    }


    async function importAudioFiles(files) {
      const list =
        Array.from(files || [])
          .filter(isAudioFile);

      if (!list.length) {
        return [];
      }

      const imported =
        [];

      for (const file of list) {
        try {
          const material =
            await importAudioFile(file);

          imported.push(material);

        } catch (error) {
          console.error(
            "[原生音訊匯入失敗]",
            file?.name,
            error
          );

          alert(
            `「${file?.name || "音訊"}」匯入失敗：` +
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
          `已加入 ${imported.length} 個音訊素材`
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

      const audioFiles =
        files.filter(isAudioFile);

      if (!audioFiles.length) {
        return;
      }

      /*
       * 避免原生程式把音訊誤當文字檔讀取。
       */
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const nonAudio =
        files.filter(
          file =>
            !isAudioFile(file)
        );

      input.value =
        "";

      if (nonAudio.length) {
        alert(
          "請將音訊與圖片／文字檔分開選擇。\n本次只匯入音訊檔案。"
        );
      }

      importAudioFiles(audioFiles)
        .catch(error => {
          console.error(error);

          alert(
            "音訊匯入失敗：" +
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
    // 攔截拖入原生素材庫
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

      const audioFiles =
        files.filter(isAudioFile);

      if (!audioFiles.length) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const nonAudio =
        files.filter(
          file =>
            !isAudioFile(file)
        );

      if (nonAudio.length) {
        alert(
          "請將音訊與圖片／文字檔分開拖入。\n本次只匯入音訊檔案。"
        );
      }

      importAudioFiles(audioFiles)
        .catch(error => {
          console.error(error);

          alert(
            "音訊匯入失敗：" +
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
    // 插入短 BGM 語法
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


    function buildBgmSyntax(material) {
      const id =
        String(
          material.assetId ||
          material.id
        );

      return (
        "\n" +
        `[bgmplay:${id}|播放音樂]\n` +
        `[bgmstop:${id}|停止音樂]\n`
      );
    }

//跳頁邏輯

    function buildBgmJumpSyntax(
  material,
  pageNumber,
  label
) {
  const id =
    String(
      material.assetId ||
      material.id
    );

  const target =
    Math.max(
      1,
      Math.trunc(
        Number(pageNumber) || 1
      )
    );

  const buttonLabel =
    String(
      label ||
      "播放音樂並前進"
    )
      .replace(/\]/g, "）")
      .replace(/\|/g, "｜")
      .trim();

  return (
    "\n" +
    `[bgmjump:${id}|${target}|${buttonLabel}]\n`
  );
}


    function insertIntoVisualEditor(
      editor,
      text
    ) {
      editor.focus();

      const node =
        document.createTextNode(text);

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


    function insertBgmReference(material) {
      const syntax =
        buildBgmSyntax(material);

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
              isVisible(htmlWorkspace)
            )
          : (
              isVisible(htmlSource) ||
              isVisible(htmlVisual)
            );

      if (
        htmlActive &&
        isVisible(htmlSource)
      ) {
        insertTextarea(
          htmlSource,
          syntax
        );

        toast(
          "已插入 HTML BGM 控制語法"
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
          syntax
        );

        toast(
          "已插入 HTML BGM 控制語法"
        );

        return;
      }

      const pageText =
        document.getElementById(
          "pageText"
        );

      insertTextarea(
        pageText,
        syntax
      );

      toast(
        "已插入 BGM 控制語法"
      );
    }

    function insertBgmJumpReference(
  material
) {
  const pageNumber =
    prompt(
      "播放音樂後，要前往第幾頁？",
      "2"
    );

  if (pageNumber == null) {
    return;
  }

  const target =
    Math.trunc(
      Number(pageNumber)
    );

  if (
    !Number.isFinite(target) ||
    target < 1
  ) {
    alert(
      "頁碼必須是 1 以上的整數"
    );

    return;
  }

  const label =
    prompt(
      "按鈕要顯示什麼文字？",
      `播放音樂並前往第 ${target} 頁`
    );

  if (label == null) {
    return;
  }

  const syntax =
    buildBgmJumpSyntax(
      material,
      target,
      label
    );

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
          isVisible(htmlWorkspace)
        )
      : (
          isVisible(htmlSource) ||
          isVisible(htmlVisual)
        );

  if (
    htmlActive &&
    isVisible(htmlSource)
  ) {
    insertTextarea(
      htmlSource,
      syntax
    );

    toast(
      `已插入音樂跳頁標籤：第 ${target} 頁`
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
      syntax
    );

    toast(
      `已插入音樂跳頁標籤：第 ${target} 頁`
    );

    return;
  }

  const pageText =
    document.getElementById(
      "pageText"
    );

  insertTextarea(
    pageText,
    syntax
  );

  toast(
    `已插入音樂跳頁標籤：第 ${target} 頁`
  );
}



    // =====================================================
    // 試聽
    // =====================================================

    async function togglePreview(
      material,
      button
    ) {
      const id =
        String(
          material.assetId ||
          material.id
        );

      const existing =
        localPlayers.get(id);

      if (
        existing &&
        !existing.paused
      ) {
        existing.pause();
        existing.currentTime = 0;

        button.textContent =
          "▶ 試聽";

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
          "找不到音訊 Blob"
        );
      }

      let objectUrl =
        localObjectUrls.get(id);

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

      let audio =
        existing;

      if (!audio) {
        audio =
          new Audio(objectUrl);

        audio.preload =
          "metadata";

        localPlayers.set(
          id,
          audio
        );

        audio.addEventListener(
          "ended",
          () => {
            button.textContent =
              "▶ 試聽";
          }
        );
      }

      for (
        const [
          otherId,
          otherAudio
        ]
        of localPlayers
      ) {
        if (
          otherId !== id
        ) {
          try {
            otherAudio.pause();
            otherAudio.currentTime = 0;
          } catch (error) {}
        }
      }

      await audio.play();

      button.textContent =
        "■ 停止";
    }


    // =====================================================
    // 強化原生素材卡片
    // =====================================================

    function enhanceMaterialCards() {
      const list =
        document.getElementById(
          "material-library-list"
        );

      if (!list) {
        return;
      }

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
            adapter.assets.getAll()[index];

          if (
            !isAudioMaterial(material)
          ) {
            return;
          }

          if (
            card.dataset
              .fhNativeAudioBound ===
              "1"
          ) {
            return;
          }

          card.dataset
            .fhNativeAudioBound =
            "1";

          card.dataset
            .materialKind =
            "audio";

          card.classList.add(
            "fh-native-audio-card"
          );

          const firstBox =
            Array.from(card.children)
              .find(element => {
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
              "🎵";

            firstBox.classList.add(
              "fh-native-audio-icon"
            );
          }

          const details =
            document.createElement(
              "div"
            );

          details.className =
            "fh-native-audio-meta";

          details.textContent =
            formatSize(
              material.size
            );


          const actions =
            document.createElement(
              "div"
            );

          actions.className =
            "fh-native-audio-actions";


          const previewButton =
            document.createElement(
              "button"
            );

          previewButton.type =
            "button";

          previewButton.textContent =
            "▶ 試聽";


          const insertButton =
            document.createElement(
              "button"
            );

          insertButton.type =
            "button";

          insertButton.textContent =
            "＋ BGM";

          const jumpButton =
  document.createElement(
    "button"
  );

jumpButton.type =
  "button";

jumpButton.textContent =
  "＋ 跳頁";


[
  previewButton,
  insertButton,
  jumpButton
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

              togglePreview(
                material,
                previewButton
              ).catch(error => {
                console.error(error);

                alert(
                  "試聽失敗：" +
                  String(
                    error?.message ||
                    error
                  )
                );
              });
            }
          );


          insertButton.addEventListener(
            "click",
            event => {
              event.preventDefault();
              event.stopPropagation();

              try {
                insertBgmReference(
                  material
                );

              } catch (error) {
                alert(
                  "插入 BGM 失敗：" +
                  String(
                    error?.message ||
                    error
                  )
                );
              }
            }
          );



jumpButton.addEventListener(
  "click",
  event => {
    event.preventDefault();
    event.stopPropagation();

    try {
      insertBgmJumpReference(
        material
      );

    } catch (error) {
      alert(
        "插入音樂跳頁失敗：" +
        String(
          error?.message ||
          error
        )
      );
    }
  }
);


         actions.append(
  previewButton,
  insertButton,
  jumpButton
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
                  String(
                    material.assetId ||
                    material.id
                  );

                const audio =
                  localPlayers.get(id);

                if (audio) {
                  audio.pause();
                  localPlayers.delete(id);
                }

                const objectUrl =
                  localObjectUrls.get(id);

                if (objectUrl) {
                  URL.revokeObjectURL(
                    objectUrl
                  );

                  localObjectUrls.delete(
                    id
                  );
                }

                deleteMedia(
                  material.vaultId
                ).catch(error => {
                  console.warn(
                    "刪除音訊 Blob 失敗",
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
          childList: true,
          subtree: true
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
          childList: true,
          subtree: true
        }
      );

      cleanupFunctions.push(() => {
        bodyWaiter.disconnect();
      });
    }


    // =====================================================
    // Reader Preflight
    //
    // 第一版封裝原生素材庫內全部音訊。
    // 成功後再改成只封裝作品實際引用的 ID。
    // =====================================================

    const unregisterPreflight =
      adapter.reader.registerPreflight(
        "native-audio-package",

        async context => {
          const materials =
            adapter.assets
              .listByKind("audio");

          const packageData =
            Object.create(null);

          const missing =
            [];

          for (const material of materials) {
            const assetId =
              String(
                material.assetId ||
                material.id
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
                "audio/mpeg",

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

          context.cache[CACHE_KEY] =
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
                (total, item) =>
                  total +
                  String(
                    item.dataUrl || ""
                  ).length,

                0
              )
          };
        },

        100
      );

    cleanupFunctions.push(
      unregisterPreflight
    );


    // =====================================================
    // ReaderArtifact Transform
    // =====================================================

    const unregisterTransform =
      adapter.reader.registerTransform(
        "native-audio-runtime",

        function transformReader(
          html,
          context
        ) {
          if (
            typeof html !== "string" ||
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
.fh-native-audio-control{
  display:block;
  width:100%;
  max-width:520px;
  box-sizing:border-box;
  margin:12px auto;
  padding:12px 18px;
  border:0;
  border-radius:24px;
  background:#526b5a;
  color:#fff;
  font:700 15px/1.4 system-ui,"Noto Sans TC",sans-serif;
  text-align:center;
  cursor:pointer;
  touch-action:manipulation;
}

.fh-native-audio-control:active{
  transform:scale(.98);
}

.fh-native-audio-control.is-playing{
  background:#397b50;
}

.fh-native-audio-control.is-stop{
  background:#765050;
}

.fh-native-audio-error{
  max-width:520px;
  box-sizing:border-box;
  margin:8px auto;
  padding:8px 12px;
  border-radius:8px;
  background:#fff0f0;
  color:#913838;
  font:12px/1.5 system-ui,sans-serif;
  text-align:center;
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

if(window.__fhNativeAudioRuntimeV101){
  return;
}

window.__fhNativeAudioRuntimeV101=true;

var packageElement=
document.getElementById(
  "fh-native-audio-package"
);

var assets={};

try{
  assets=JSON.parse(
    packageElement
    ?
    packageElement.textContent
    :
    "{}"
  );
}catch(error){
  console.error(
    "[Firehaha Audio Package]",
    error
  );
}

var players={};

var playerGenerations={};

var playbackGeneration=0;

var fadeTimers=[];


function removeFadeTimer(timer){

  var index=
  fadeTimers.indexOf(timer);

  if(index >= 0){
    fadeTimers.splice(index,1);
  }

}


function clearFadeTimers(){

  fadeTimers
  .splice(0)
  .forEach(
    function(timer){
      clearInterval(timer);
    }
  );

}


function getPlayer(id){

  if(players[id]){
    return players[id];
  }

  var asset=
  assets[id];

  if(
    !asset ||
    !asset.dataUrl
  ){
    return null;
  }

  var audio=
  new Audio(
    asset.dataUrl
  );

  audio.preload=
  "auto";

  audio.loop=
  true;

  players[id]=
  audio;

  return audio;

}


function stopOthers(exceptId){

  Object.keys(players)
  .forEach(
    function(id){

      if(
        exceptId &&
        id === exceptId
      ){
        return;
      }

      try{
        players[id].pause();
        players[id].currentTime=0;
      }catch(error){}

    }
  );

}


function clearError(button){

  var next=
  button.nextElementSibling;

  if(
    next &&
    next.classList.contains(
      "fh-native-audio-error"
    )
  ){
    next.remove();
  }

}


function showError(
  button,
  message
){

  clearError(button);

  var note=
  document.createElement(
    "div"
  );

  note.className=
  "fh-native-audio-error";

  note.textContent=
  message;

  button.insertAdjacentElement(
    "afterend",
    note
  );

}


function resetButtons(id){

  document
  .querySelectorAll(
    '.fh-native-audio-control[data-audio-id="' +
    id.replace(/"/g,'\\"') +
    '"]'
  )
  .forEach(
    function(button){

    var action =
button.getAttribute(
  "data-audio-action"
);

if(
  action !== "play" &&
  action !== "jump"
){
  return;
}

      button.textContent=
      button.getAttribute(
        "data-audio-label"
      ) ||
      "播放音樂";

      button.classList.remove(
        "is-playing"
      );

      button.setAttribute(
        "aria-pressed",
        "false"
      );

    }
  );

}


function playAudio(
  id,
  button
){

  var generation=
  playbackGeneration;

  playerGenerations[id]=
  generation;

  var audio=
  getPlayer(id);

  if(!audio){

    showError(
      button,
      "找不到這首音訊的封裝資料"
    );

    return Promise.resolve(
      false
    );
  }

  stopOthers(id);

  var result;

  try{
    result=audio.play();
  }catch(error){

    showError(
      button,
      "音訊播放失敗"
    );

    return Promise.resolve(
      false
    );
  }

  return Promise.resolve(result)
  .then(
    function(){

      if(
        generation !==
        playbackGeneration
      ){
        if(
          playerGenerations[id] ===
          generation
        ){
          try{
            audio.pause();
            audio.currentTime=0;
          }catch(error){}
        }

        return false;
      }

      clearError(button);

      document
      .querySelectorAll(
        ".fh-native-audio-control.is-playing"
      )
      .forEach(
        function(element){

          element.classList.remove(
            "is-playing"
          );

        }
      );

      button.classList.add(
        "is-playing"
      );

      button.setAttribute(
        "aria-pressed",
        "true"
      );

      button.textContent=
      "♪ 播放中";

      return true;

    }
  )
  .catch(
    function(error){

      if(
        generation !==
        playbackGeneration
      ){
        return false;
      }

      console.warn(
        "[Firehaha Audio Play]",
        error
      );

      showError(
        button,
        "瀏覽器阻擋播放，請再按一次"
      );

      return false;

    }
  );

}

function playAndJump(
  id,
  pageNumber,
  button
){

  playAudio(
    id,
    button
  )
  .then(
    function(played){

      if(!played){
        return;
      }

      var navigation=
      window.FirehahaReaderNavigation;

      if(
        !navigation ||
        typeof navigation.goToPage !==
          "function"
      ){

        showError(
          button,
          "閱讀器導航橋樑尚未載入"
        );

        return;
      }

      var target=
      Number(pageNumber);

      if(
        !Number.isFinite(target) ||
        target < 1
      ){

        showError(
          button,
          "無效的目標頁碼"
        );

        return;
      }

      var success=
      navigation.goToPage(
        Math.trunc(target),
        {
          reason:
          "bgmjump",

          pushHistory:
          true
        }
      );

      if(!success){

        showError(
          button,
          "找不到第 " +
          Math.trunc(target) +
          " 頁"
        );

      }

    }
  );

}


function stopAllAudio(){

  clearFadeTimers();

  Object.keys(players)
  .forEach(
    function(id){

      var audio=
      players[id];

      try{
        audio.pause();
        audio.currentTime=0;
        audio.volume=1;
      }catch(error){}

      resetButtons(id);

    }
  );

}


function resetAllAudio(){

  playbackGeneration++;

  stopAllAudio();

  document
  .querySelectorAll(
    ".fh-native-audio-control"
  )
  .forEach(
    function(button){

      button.textContent=
      button.getAttribute(
        "data-audio-label"
      ) ||
      (
        button.getAttribute(
          "data-audio-action"
        ) === "stop"
        ?
        "停止音樂"
        :
        "播放音樂"
      );

      button.classList.remove(
        "is-playing"
      );

      button.setAttribute(
        "aria-pressed",
        "false"
      );

    }
  );

  document
  .querySelectorAll(
    ".fh-native-audio-error"
  )
  .forEach(
    function(note){
      note.remove();
    }
  );

}


function fadeOutAllAudio(){

  clearFadeTimers();

  var duration=
  1500;

  var stepTime=
  50;

  var steps=
  Math.max(
    1,
    Math.round(
      duration / stepTime
    )
  );

  Object.keys(players)
  .forEach(
    function(id){

      var audio=
      players[id];

      if(
        !audio ||
        audio.paused
      ){
        return;
      }

      var startVolume=
      Number.isFinite(
        audio.volume
      )
      ?
      audio.volume
      :
      1;

      var currentStep=
      0;

      var timer=
      setInterval(
        function(){

          currentStep++;

          var ratio=
          1 -
          currentStep / steps;

          audio.volume=
          Math.max(
            0,
            startVolume * ratio
          );

          if(
            currentStep >= steps
          ){

            clearInterval(timer);

            removeFadeTimer(timer);

            try{
              audio.pause();
              audio.currentTime=0;
              audio.volume=startVolume;
            }catch(error){}

            resetButtons(id);

          }

        },
        stepTime
      );

      fadeTimers.push(timer);

    }
  );

}



function stopAudio(id){

  var audio=
  getPlayer(id);

  if(audio){

    try{
      audio.pause();
      audio.currentTime=0;
    }catch(error){}

  }

  resetButtons(id);

}


function makeButton(
  action,
  id,
  label,
  pageNumber
){

  var button=
  document.createElement(
    "button"
  );

  button.type=
  "button";

  button.className=
  "fh-native-audio-control";

  button.setAttribute(
    "data-audio-action",
    action
  );

  button.setAttribute(
    "data-audio-id",
    id
  );

  button.setAttribute(
    "data-audio-label",
    label
  );

  button.setAttribute(
    "aria-pressed",
    "false"
  );

  if(pageNumber != null){

    button.setAttribute(
      "data-audio-jump-page",
      String(pageNumber)
    );

  }

  button.textContent=
  label;

  if(action === "stop"){

    button.classList.add(
      "is-stop"
    );

  }

  button.addEventListener(
    "click",
    function(event){

      event.preventDefault();
      event.stopPropagation();

      if(action === "play"){

        playAudio(
          id,
          button
        );

        return;
      }

      if(action === "jump"){

        playAndJump(
          id,
          pageNumber,
          button
        );

        return;
      }

      stopAudio(id);

    }
  );

  return button;

}

function processTextNode(node){

  var text=
  node.nodeValue || "";

  /*
   * 支援：
   *
   * [bgmplay:ID|文字]
   * [bgmstop:ID|文字]
   * [bgmjump:ID|頁碼|文字]
   */
  var pattern=
/\[bgm(?:(play|stop):([^|\]]+)(?:\|([^\]]+))?|jump:([^|\]]+)\|(\d+)\|([^\]]+)|off|fadeout)\]/gi;

  if(!pattern.test(text)){
    return;
  }

  pattern.lastIndex=0;

  var fragment=
  document.createDocumentFragment();

  var lastIndex=0;
  var match;

  while(
    (
      match=
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

    /*
     * bgmjump 分支
     */

     var fullTag=
match[0].toLowerCase();


if(
  fullTag === "[bgmoff]"
){

  stopAllAudio();

  lastIndex=
  pattern.lastIndex;

  continue;
}


if(
  fullTag === "[bgmfadeout]"
){

  fadeOutAllAudio();

  lastIndex=
  pattern.lastIndex;

  continue;
}
    if(match[4]){

      var jumpId=
      match[4].trim();

      var pageNumber=
      Number(match[5]);

      var jumpLabel=
      String(
        match[6] ||
        "播放音樂並前進"
      ).trim();

      fragment.appendChild(
        makeButton(
          "jump",
          jumpId,
          jumpLabel,
          pageNumber
        )
      );

    }else{

      /*
       * bgmplay / bgmstop 分支
       */
      var action=
      match[1].toLowerCase();

      var id=
      match[2].trim();

      var label=
      (
        match[3] ||
        (
          action === "play"
          ?
          "播放音樂"
          :
          "停止音樂"
        )
      ).trim();

      fragment.appendChild(
        makeButton(
          action,
          id,
          label,
          null
        )
      );

    }

    lastIndex=
    pattern.lastIndex;

  }

  if(
    lastIndex <
    text.length
  ){

    fragment.appendChild(
      document.createTextNode(
        text.slice(lastIndex)
      )
    );

  }

  node.replaceWith(
    fragment
  );

}

function processBgmEventTextNode(node){

  var text =
  node.nodeValue || "";

  var hasOff =
  /\[bgmoff\]/i.test(text);

  var hasFadeout =
  /\[bgmfadeout\]/i.test(text);


  if(
    !hasOff &&
    !hasFadeout
  ){
    return;
  }


  /*
   * 同一個文字節點若同時存在兩種標籤，
   * 淡出優先於立即停止。
   */
  if(hasFadeout){

    fadeOutAllAudio();

  }else if(hasOff){

    stopAllAudio();

  }


  /*
   * 執行後移除標籤，
   * 不讓讀者看到原始文字。
   */
  node.nodeValue =
  text
  .replace(
    /\[bgmfadeout\]/gi,
    ""
  )
  .replace(
    /\[bgmoff\]/gi,
    ""
  );

}


function scanBgmEvents(root){

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

    var parent =
    node.parentElement;


    if(!parent){
      continue;
    }


    if(
      parent.closest(
        "script,style,textarea,noscript," +
        ".fh-native-audio-control," +
        ".fh-native-audio-error"
      )
    ){
      continue;
    }


    if(
      /\[bgm(?:off|fadeout)\]/i
      .test(
        node.nodeValue || ""
      )
    ){
      nodes.push(node);
    }

  }


  nodes.forEach(
    processBgmEventTextNode
  );

}




function scan(){

  if(!document.body){
    return;
  }


  /*
   * 先處理不顯示按鈕的事件標籤。
   */
  scanBgmEvents(
    document.body
  );


  /*
   * 再處理播放、停止、跳頁按鈕標籤。
   */
  var walker=
  document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  var nodes=[];

  while(walker.nextNode()){

    var node=
    walker.currentNode;

    var parent=
    node.parentElement;

    if(!parent){
      continue;
    }

    if(
      parent.closest(
        "script,style,textarea,noscript," +
        ".fh-native-audio-control," +
        ".fh-native-audio-error"
      )
    ){
      continue;
    }

    if(
      /\[bgm(?:play|stop|jump):|\[bgm(?:off|fadeout)\]/i
      .test(
        node.nodeValue || ""
      )
    ){
      nodes.push(node);
    }

  }

  nodes.forEach(
    processTextNode
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

  var queued=false;

  var observer=
  new MutationObserver(
    function(){

      if(queued){
        return;
      }

      queued=true;

      setTimeout(
        function(){

          queued=false;
          scan();

        },
        0
      );

    }
  );

  observer.observe(
    document.body,
    {
      childList:true,
      subtree:true,
      characterData:true
    }
  );

}


window.FirehahaNativeAudioRuntime={
  version:"1.0.1",
  reset:resetAllAudio,
  stopAll:resetAllAudio
};


document.addEventListener(
  "firehaha:reader-restart",
  function(event){
    if(
      !event.detail ||
      event.detail.phase === "before"
    ){
      resetAllAudio();
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
      once:true
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
            /<\/head\s*>/i.test(
              output
            )
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
            /<\/body\s*>/i.test(
              output
            )
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

        500
      );

    cleanupFunctions.push(
      unregisterTransform
    );


    // =====================================================
    // 編輯器 HTML 預覽
    // 直接從 IndexedDB Blob 播放，不需要 Base64
    // =====================================================

    async function getLocalPreviewPlayer(id) {
      if (
        localPlayers.has(
          "preview:" + id
        )
      ) {
        return localPlayers.get(
          "preview:" + id
        );
      }

      const material =
        adapter.assets.getById(id);

      if (!material) {
        return null;
      }

      const record =
        await getMedia(
          material.vaultId
        );

      if (
        !record ||
        !(record.blob instanceof Blob)
      ) {
        return null;
      }

      const key =
        "preview:" + id;

      const objectUrl =
        URL.createObjectURL(
          record.blob
        );

      localObjectUrls.set(
        key,
        objectUrl
      );

      const audio =
        new Audio(objectUrl);

      audio.loop =
        true;

      audio.preload =
        "metadata";

      localPlayers.set(
        key,
        audio
      );

      return audio;
    }


   function processPreviewTextNode(node) {
  const text =
    node.nodeValue || "";

  const pattern =
  /\[bgm(?:(play|stop):([^|\]]+)(?:\|([^\]]+))?|jump:([^|\]]+)\|(\d+)\|([^\]]+)|off|fadeout)\]/gi;

  if (!pattern.test(text)) {
    return;
  }

  pattern.lastIndex =
    0;

  const fragment =
    document.createDocumentFragment();

  let lastIndex =
    0;

  let match;

  while (
    (
      match =
        pattern.exec(text)
    )
  ) {
    if (
      match.index >
      lastIndex
    ) {
      fragment.appendChild(
        document.createTextNode(
          text.slice(
            lastIndex,
            match.index
          )
        )
      );
    }

    let action;
    let id;
    let label;
    let pageNumber =
      null;

    if (match[4]) {
      action =
        "jump";

      id =
        match[4].trim();

      pageNumber =
        Number(match[5]);

      label =
        String(
          match[6] ||
          "播放音樂並前進"
        ).trim();

    } else {
      action =
        match[1].toLowerCase();

      id =
        match[2].trim();

      label =
        (
          match[3] ||
          (
            action === "play"
              ? "播放音樂"
              : "停止音樂"
          )
        ).trim();
    }

    const button =
      document.createElement(
        "button"
      );

    button.type =
      "button";

    button.className =
      "fh-native-audio-control";

    button.textContent =
      label;

    if (action === "stop") {
      button.classList.add(
        "is-stop"
      );
    }

    button.addEventListener(
      "click",
      async event => {
        event.preventDefault();
        event.stopPropagation();

        const audio =
          await getLocalPreviewPlayer(
            id
          );

        if (!audio) {
          alert(
            "找不到本機音訊資料"
          );

          return;
        }

        if (action === "stop") {
          audio.pause();
          audio.currentTime =
            0;

          return;
        }

        try {
          await audio.play();

          button.textContent =
            "♪ 播放中";

          button.classList.add(
            "is-playing"
          );

        } catch (error) {
          alert(
            "播放失敗：" +
            String(
              error?.message ||
              error
            )
          );

          return;
        }

        /*
         * 編輯器內的 HTML 小預覽不是完整閱讀器，
         * 通常沒有 FirehahaReaderNavigation。
         *
         * 因此只有在導航橋樑存在時才跳頁。
         */
        if (action === "jump") {
          const navigation =
            window
              .FirehahaReaderNavigation;

          if (
            navigation &&
            typeof navigation.goToPage ===
              "function"
          ) {
            navigation.goToPage(
              pageNumber,
              {
                reason:
                  "bgmjump-preview",

                pushHistory:
                  true
              }
            );

          } else {
            toast(
              `此按鈕會在測試閱讀中前往第 ${pageNumber} 頁`
            );
          }
        }
      }
    );

    fragment.appendChild(
      button
    );

    lastIndex =
      pattern.lastIndex;
  }

  if (
    lastIndex <
    text.length
  ) {
    fragment.appendChild(
      document.createTextNode(
        text.slice(lastIndex)
      )
    );
  }

  node.replaceWith(
    fragment
  );
}


function stopAllLocalPreviewAudio(){

  localPlayers.forEach(
    audio => {

      try {

        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1;

      } catch (error) {}

    }
  );

}


function fadeOutAllLocalPreviewAudio(){

  const duration =
    1500;

  const stepTime =
    50;

  const steps =
    Math.max(
      1,
      Math.round(
        duration / stepTime
      )
    );


  localPlayers.forEach(
    audio => {

      if(
        !audio ||
        audio.paused
      ){
        return;
      }


      const originalVolume =
        Number.isFinite(
          audio.volume
        )
          ? audio.volume
          : 1;


      let currentStep =
        0;


      const timer =
        setInterval(() => {

          currentStep++;


          const ratio =
            1 -
            currentStep / steps;


          audio.volume =
            Math.max(
              0,
              originalVolume * ratio
            );


          if(
            currentStep >= steps
          ){

            clearInterval(
              timer
            );


            try {

              audio.pause();
              audio.currentTime = 0;
              audio.volume =
                originalVolume;

            } catch (error) {}

          }

        }, stepTime);

    }
  );

}


function processPreviewBgmEventNode(
  node
) {

  const text =
    node.nodeValue || "";


  const hasOff =
    /\[bgmoff\]/i.test(text);


  const hasFadeout =
    /\[bgmfadeout\]/i.test(text);


  if(
    !hasOff &&
    !hasFadeout
  ){
    return;
  }


  if(hasFadeout){

    fadeOutAllLocalPreviewAudio();

  }else if(hasOff){

    stopAllLocalPreviewAudio();

  }


  node.nodeValue =
    text
      .replace(
        /\[bgmfadeout\]/gi,
        ""
      )
      .replace(
        /\[bgmoff\]/gi,
        ""
      );

}


function scanPreviewBgmEvents(root){

  if(!root){
    return;
  }


  const walker =
    document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      null
    );


  const nodes =
    [];


  while(
    walker.nextNode()
  ){

    const node =
      walker.currentNode;


    if(
      node.parentElement &&
      !node.parentElement.closest(
        "script,style,textarea," +
        ".fh-native-audio-control"
      ) &&
      /\[bgm(?:off|fadeout)\]/i
        .test(
          node.nodeValue || ""
        )
    ){
      nodes.push(node);
    }

  }


  nodes.forEach(
    processPreviewBgmEventNode
  );

}

function scanEditorPreview() {
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

  /*
   * 先執行自動停止事件。
   */
  scanPreviewBgmEvents(
    root
  );


  /*
   * 再解析播放、停止、跳頁按鈕。
   */
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
            "script,style,textarea," +
            ".fh-native-audio-control"
          ) &&
          /\[bgm(?:play|stop|jump):/i
            .test(
              node.nodeValue || ""
            )
        ) {
          nodes.push(node);
        }
      }

      nodes.forEach(
        processPreviewTextNode
      );
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

      scanEditorPreview();
    }, 20);
  });

previewObserver.observe(
  document.body,
  {
    childList: true,
    subtree: true,
    characterData: true
  }
);

scanEditorPreview();



    // =====================================================
    // 樣式
    // =====================================================

    const removeStyle =
      api.addStyle(
        "native-audio-adapter",
        `
        .fh-native-audio-card{
          border-color:#7e57c2!important;
          background:#faf7ff!important;
        }

        .fh-native-audio-icon{
          height:70px!important;
          display:flex!important;
          align-items:center!important;
          justify-content:center!important;
          border-radius:4px!important;
          background:#ede7f6!important;
          font-size:30px!important;
        }

        .fh-native-audio-meta{
          margin-top:3px;
          color:#777;
          font-size:10px;
          text-align:center;
        }

        .fh-native-audio-actions{
          display:flex;
          gap:4px;
          margin-top:6px;
        }

        .fh-native-audio-actions button{
          flex:1;
          min-width:0;
          padding:6px 5px!important;
          border:0!important;
          border-radius:14px!important;
          background:#5e35b1!important;
          color:#fff!important;
          font-size:10px!important;
          cursor:pointer;
        }

        .fh-native-audio-actions button:first-child{
          background:#526b5a!important;
        }

        .fh-native-audio-control{
          display:block;
          width:100%;
          max-width:520px;
          box-sizing:border-box;
          margin:12px auto;
          padding:12px 18px;
          border:0;
          border-radius:24px;
          background:#526b5a;
          color:#fff;
          font:700 15px/1.4 system-ui,"Noto Sans TC",sans-serif;
          text-align:center;
          cursor:pointer;
          touch-action:manipulation;
        }

        .fh-native-audio-control.is-playing{
          background:#397b50;
        }

        .fh-native-audio-control.is-stop{
          background:#765050;
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

    window.FirehahaNativeAudio = {
      version:
        "1.0.1",

      dbName:
        DB_NAME,

      importFiles:
        importAudioFiles,

      getMedia,

      deleteMedia,

      insert(materialOrId) {
        const material =
          typeof materialOrId ===
            "string"
            ? adapter.assets.getById(
                materialOrId
              )
            : materialOrId;

        if (!material) {
          throw new Error(
            "找不到指定音訊素材"
          );
        }

        insertBgmReference(
          material
        );
      },

      getAll() {
        return adapter.assets
          .listByKind("audio");
      }
    };

    toast(
      "原生音訊素材適配器已啟用"
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
              "[Native Audio cleanup]",
              error
            );
          }
        });

      localPlayers.forEach(
        audio => {
          try {
            audio.pause();
          } catch (error) {}
        }
      );

      localPlayers.clear();

      localObjectUrls.forEach(
        url => {
          try {
            URL.revokeObjectURL(url);
          } catch (error) {}
        }
      );

      localObjectUrls.clear();

      document
        .querySelectorAll(
          "[data-fh-native-audio-bound]"
        )
        .forEach(element => {
          delete element.dataset
            .fhNativeAudioBound;
        });

      if (
        window.FirehahaNativeAudio
      ) {
        delete window
          .FirehahaNativeAudio;
      }

      if (db) {
        db.close();
        db = null;
      }
    };
  }
});
