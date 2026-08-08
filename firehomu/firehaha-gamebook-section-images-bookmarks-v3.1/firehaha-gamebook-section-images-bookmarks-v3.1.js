// @firehaha-plugin {"id":"official.gamebook-section-numbering-v3.1","name":"Gamebook 紙本節號＋圖片＋DOCX跳頁 V3.1","version":"3.1.0","author":"Firehaha","description":"為 Firehaha Node 分配紙本 Gamebook Section 節號，整合原生素材庫與 PixivImageAssets，支援素材卡插入紙本圖片，並將 local-image 圖片真正封裝進 DOCX word/media。"}

FirehahaPlugins.register({
  id: "official.gamebook-section-numbering-v3.1",
  name: "Gamebook 紙本節號＋圖片＋DOCX跳頁 V3.1",
  version: "3.1.0",
  description: "為 Node 分配紙本節號，插入紙本圖片，並輸出含 Word 書籤、跳頁與圖片封裝的 DOCX。",

  setup(api) {
    "use strict";

    const STATE_KEY =
      "gamebookSectionNumbering";

    const PANEL_ID =
      "fh-gamebook-section-panel";

    const BUTTON_ID =
      "fh-gamebook-section-button";

    const BADGE_CLASS =
      "fh-gamebook-section-badge";

    const state = {
      version: 1,
      numbers: {},
      locked: {},
      settings: {
        mode: "shuffle",
        keepFirstAtOne: true,
        sectionPrefix: "第 ",
        sectionSuffix: " 節",
        gotoPrefix: "前往第 ",
        gotoSuffix: " 節",
        imageWidthCm: 12,
        includePixivImages: true
      }
    };

    let panel = null;
    let headerButton = null;
    let saveTimer = null;
    let projectRegistered = false;


    // =====================================================
    // Core access
    // =====================================================

    function getPages() {
      try {
        if (
          typeof pages !== "undefined" &&
          Array.isArray(pages)
        ) {
          return pages;
        }
      } catch (error) {}

      if (
        window.FirehahaEditorCore &&
        Array.isArray(
          window.FirehahaEditorCore.pages
        )
      ) {
        return window.FirehahaEditorCore.pages;
      }

      return [];
    }


    function clone(value) {
      return JSON.parse(
        JSON.stringify(value)
      );
    }


    function assignObject(
      target,
      source
    ) {
      Object.keys(target)
        .forEach(
          key => delete target[key]
        );

      Object.assign(
        target,
        source || {}
      );
    }


    // =====================================================
    // Save / load
    // =====================================================

    function exportState() {
      return {
        version:
          1,

        numbers:
          clone(
            state.numbers
          ),

        locked:
          clone(
            state.locked
          ),

        settings:
          clone(
            state.settings
          )
      };
    }


    function importState(
      value
    ) {
      const data =
        value &&
        typeof value ===
          "object"
          ? value
          : {};

      assignObject(
        state.numbers,
        data.numbers
      );

      assignObject(
        state.locked,
        data.locked
      );

      Object.assign(
        state.settings,
        data.settings ||
        {}
      );

      normalizeMap();
      refreshBadges();
      renderPanel();
    }


    function registerProjectData() {
      if (
        projectRegistered
      ) {
        return true;
      }

      if (
        !window.ProjectDataCenter ||
        typeof ProjectDataCenter.register !==
          "function"
      ) {
        return false;
      }

      try {
        ProjectDataCenter.register(
          STATE_KEY,
          {
            description:
              "Gamebook 紙本 Section 節號與鎖定設定",

            defaultValue:
              {
                version: 1,
                numbers: {},
                locked: {},
                settings: {
                  mode:
                    "shuffle",

                  keepFirstAtOne:
                    true,

                  sectionPrefix:
                    "第 ",

                  sectionSuffix:
                    " 節",

                  gotoPrefix:
                    "前往第 ",

                  gotoSuffix:
                    " 節",

                  imageWidthCm:
                    12,

                  includePixivImages:
                    true
                }
              },

            resetOnMissing:
              true,

            save:
              () =>
                exportState(),

            load:
              value =>
                importState(
                  value
                )
          }
        );

        projectRegistered =
          true;

        return true;

      } catch (error) {
        console.warn(
          "[Gamebook Sections] ProjectDataCenter register",
          error
        );

        return false;
      }
    }


    const registerTimer =
      setInterval(
        () => {
          if (
            registerProjectData()
          ) {
            clearInterval(
              registerTimer
            );
          }
        },
        500
      );


    function requestSave() {
      clearTimeout(
        saveTimer
      );

      saveTimer =
        setTimeout(
          () => {
            try {
              if (
                typeof window.saveProject ===
                  "function"
              ) {
                window.saveProject({
                  silent:
                    true
                });
              }
            } catch (error) {}
          },
          400
        );
    }


    // =====================================================
    // Number management
    // =====================================================

    function normalizeMap() {
      const list =
        getPages();

      const ids =
        new Set(
          list.map(
            page =>
              String(
                page.id
              )
          )
        );

      Object.keys(
        state.numbers
      ).forEach(
        id => {
          if (
            !ids.has(id)
          ) {
            delete state.numbers[
              id
            ];

            delete state.locked[
              id
            ];
          }
        }
      );


      const used =
        new Set();

      Object.entries(
        state.numbers
      ).forEach(
        ([id, value]) => {
          const number =
            Math.trunc(
              Number(value)
            );

          if (
            number < 1 ||
            !Number.isFinite(
              number
            ) ||
            used.has(
              number
            )
          ) {
            delete state.numbers[
              id
            ];

            delete state.locked[
              id
            ];

            return;
          }

          state.numbers[
            id
          ] =
            number;

          used.add(
            number
          );
        }
      );
    }


    function shuffleArray(
      input
    ) {
      const array =
        input.slice();

      for (
        let i =
          array.length - 1;

        i > 0;

        i--
      ) {
        const j =
          Math.floor(
            Math.random() *
            (
              i + 1
            )
          );

        [
          array[i],
          array[j]
        ] =
          [
            array[j],
            array[i]
          ];
      }

      return array;
    }


    function generateNumbers(
      mode
    ) {
      const list =
        getPages();

      if (
        !list.length
      ) {
        alert(
          "目前沒有 Node。"
        );

        return;
      }

      normalizeMap();

      const max =
        list.length;

      const reserved =
        new Set();

      const next =
        {};


      /*
       * 保留鎖定節號。
       */
      list.forEach(
        page => {
          const id =
            String(
              page.id
            );

          const value =
            Number(
              state.numbers[
                id
              ]
            );

          if (
            state.locked[id] &&
            Number.isFinite(value) &&
            value >= 1 &&
            value <= max &&
            !reserved.has(
              value
            )
          ) {
            next[id] =
              value;

            reserved.add(
              value
            );
          }
        }
      );


      /*
       * 第一個 Node 可固定為 Section 1。
       */
      if (
        state.settings
          .keepFirstAtOne &&
        list[0]
      ) {
        const firstId =
          String(
            list[0].id
          );

        const owner =
          Object.keys(
            next
          ).find(
            id =>
              next[id] ===
              1
          );

        if (
          !owner ||
          owner ===
            firstId
        ) {
          next[firstId] =
            1;

          reserved.add(
            1
          );
        }
      }


      let available =
        [];

      for (
        let number =
          1;

        number <= max;

        number++
      ) {
        if (
          !reserved.has(
            number
          )
        ) {
          available.push(
            number
          );
        }
      }


      if (
        mode ===
        "shuffle"
      ) {
        available =
          shuffleArray(
            available
          );
      }


      const remaining =
        list.filter(
          page => {
            const id =
              String(
                page.id
              );

            return !Object
              .prototype
              .hasOwnProperty
              .call(
                next,
                id
              );
          }
        );


      remaining.forEach(
        (
          page,
          index
        ) => {
          next[
            String(
              page.id
            )
          ] =
            available[
              index
            ];
        }
      );


      assignObject(
        state.numbers,
        next
      );

      state.settings.mode =
        mode;

      refreshBadges();
      renderPanel();
      requestSave();

      api.toast(
        mode ===
          "shuffle"
          ? "Gamebook 節號已重新洗牌"
          : "Gamebook 節號已依序建立"
      );
    }


    function ensureNumbers() {
      const list =
        getPages();

      if (
        list.length &&
        list.some(
          page =>
            !Number.isFinite(
              Number(
                state.numbers[
                  String(
                    page.id
                  )
                ]
              )
            )
        )
      ) {
        generateNumbers(
          state.settings.mode ||
          "shuffle"
        );
      }
    }


    function setNumber(
      pageId,
      value
    ) {
      const id =
        String(
          pageId
        );

      const number =
        Math.trunc(
          Number(value)
        );

      const max =
        getPages().length;

      if (
        !Number.isFinite(number) ||
        number < 1 ||
        number > max
      ) {
        alert(
          `節號必須介於 1～${max}。`
        );

        renderPanel();

        return;
      }

      const occupied =
        Object.entries(
          state.numbers
        ).find(
          ([otherId, otherNumber]) =>
            otherId !==
              id &&
            Number(
              otherNumber
            ) ===
              number
        );

      if (
        occupied
      ) {
        /*
         * 手動換號時直接互換，
         * 避免產生重複節號。
         */
        const old =
          state.numbers[
            id
          ];

        state.numbers[
          occupied[0]
        ] =
          old;

        state.numbers[
          id
        ] =
          number;

      } else {
        state.numbers[
          id
        ] =
          number;
      }

      refreshBadges();
      renderPanel();
      requestSave();
    }


    function sectionOf(
      pageOrId
    ) {
      const id =
        typeof pageOrId ===
          "string"
          ? pageOrId
          : pageOrId &&
            pageOrId.id;

      const value =
        Number(
          state.numbers[
            String(
              id ||
              ""
            )
          ]
        );

      return Number.isFinite(
        value
      )
        ? value
        : null;
    }


    // =====================================================
    // Flow badges
    // =====================================================

    function refreshBadges() {
      const list =
        getPages();

      document
        .querySelectorAll(
          "." +
          BADGE_CLASS
        )
        .forEach(
          badge =>
            badge.remove()
        );

      list.forEach(
        page => {
          if (
            !page.element
          ) {
            return;
          }

          const number =
            sectionOf(
              page
            );

          if (
            number == null
          ) {
            return;
          }

          const badge =
            document.createElement(
              "span"
            );

          badge.className =
            BADGE_CLASS;

          badge.textContent =
            "§" +
            number;

          badge.title =
            `紙本 Section ${number}`;

          page.element
            .appendChild(
              badge
            );
        }
      );
    }


    const badgeTimer =
      setInterval(
        refreshBadges,
        1200
      );


    // =====================================================
    // Paper text generation
    // =====================================================

    function cleanPaperText(
      text
    ) {
      return String(
        text ||
        ""
      )
        /*
         * 紙本輸出不執行 Reader Runtime 標籤。
         * 第一版只移除明顯純 Reader 控制標籤；
         * 作者正文與未知標籤保留，避免誤刪。
         */
        .replace(
          /\[(?:bgmoff|bgmfadeout)\]/gi,
          ""
        )
        .replace(
          /\[bgm(?:play|stop|jump):[^\]]+\]/gi,
          ""
        )
        .trim();
    }


    function formatSectionTitle(
      number
    ) {
      return (
        String(
          state.settings
            .sectionPrefix ??
          "第 "
        ) +
        number +
        String(
          state.settings
            .sectionSuffix ??
          " 節"
        )
      );
    }


    function formatGoto(
      number
    ) {
      return (
        String(
          state.settings
            .gotoPrefix ??
          "前往第 "
        ) +
        number +
        String(
          state.settings
            .gotoSuffix ??
          " 節"
        )
      );
    }


    function buildSections() {
      ensureNumbers();

      const list =
        getPages();

      const byId =
        new Map(
          list.map(
            page => [
              String(
                page.id
              ),
              page
            ]
          )
        );

      return list
        .map(
          page => {
            const number =
              sectionOf(
                page
              );

            const choices =
              (
                Array.isArray(
                  page.options
                )
                  ? page.options
                  : []
              )
                .filter(
                  option =>
                    option &&
                    option.target &&
                    byId.has(
                      String(
                        option.target
                      )
                    )
                )
                .map(
                  option => {
                    const target =
                      byId.get(
                        String(
                          option.target
                        )
                      );

                    return {
                      text:
                        String(
                          option.text ||
                          ""
                        ).trim(),

                      section:
                        sectionOf(
                          target
                        )
                    };
                  }
                )
                .filter(
                  item =>
                    item.section !=
                    null
                );

            return {
              id:
                String(
                  page.id
                ),

              number,

              title:
                String(
                  page.title ||
                  ""
                ).trim(),

              text:
                cleanPaperText(
                  page.text
                ),

              choices
            };
          }
        )
        .filter(
          item =>
            item.number !=
            null
        )
        .sort(
          (
            a,
            b
          ) =>
            a.number -
            b.number
        );
    }


    function buildTxt() {
      ensureNumbers();

      const list =
        getPages();

      const pageIndexById =
        new Map(
          list.map(
            (
              page,
              index
            ) => [
              String(
                page.id
              ),
              index + 1
            ]
          )
        );


      /*
       * Pixiv 文字輸出維持原本閱讀器語法：
       *
       *   [chapter:...]
       *   [jump:N]
       *   [newpage]
       *
       * 這裡的 N 是 Pixiv 輸出頁序，
       * 不是紙本 Gamebook Section Number。
       *
       * 紙本節號只影響 DOCX。
       */
      const blocks =
        list.map(
          page => {
            const lines =
              [];

            const chapter =
              String(
                page.chapterTitle ||
                page.title ||
                ""
              ).trim();


            if (
              chapter
            ) {
              lines.push(
                `[chapter:${chapter}]`
              );
            }


            const text =
              String(
                page.text ||
                ""
              ).trim();


            if (
              text
            ) {
              lines.push(
                text
              );
            }


            const options =
              Array.isArray(
                page.options
              )
                ? page.options
                : [];


            options.forEach(
              option => {
                if (
                  !option ||
                  !option.target
                ) {
                  return;
                }


                const targetPage =
                  pageIndexById.get(
                    String(
                      option.target
                    )
                  );


                if (
                  !targetPage
                ) {
                  return;
                }


                const label =
                  String(
                    option.text ||
                    ""
                  ).trim();


                if (
                  label
                ) {
                  lines.push(
                    "",
                    label
                  );
                }


                /*
                 * 關鍵：
                 * Pixiv 繼續使用 [jump:]，
                 * 不轉成「前往第 N 節」。
                 */
                lines.push(
                  `[jump:${targetPage}]`
                );
              }
            );


            return lines.join(
              "\n"
            );
          }
        );


      return blocks.join(
        "\n\n[newpage]\n\n"
      );
    }


    function safeFileBase() {
      const first =
        getPages()[0];

      return String(
        first &&
        first.title ||
        "gamebook"
      )
        .replace(
          /[\\/:*?"<>|\u0000-\u001f]+/g,
          "_"
        )
        .trim()
        .slice(
          0,
          80
        ) ||
        "gamebook";
    }


    function downloadBlob(
      blob,
      name
    ) {
      const url =
        URL.createObjectURL(
          blob
        );

      const anchor =
        document.createElement(
          "a"
        );

      anchor.href =
        url;

      anchor.download =
        name;

      anchor.click();

      setTimeout(
        () =>
          URL.revokeObjectURL(
            url
          ),
        1200
      );
    }


    function exportTxt() {
      const text =
        buildTxt();

      downloadBlob(
        new Blob(
          [
            text
          ],
          {
            type:
              "text/plain;charset=utf-8"
          }
        ),

        safeFileBase() +
        "_gamebook_sections.txt"
      );

      api.toast(
        "已輸出紙本節號 TXT"
      );
    }



    // =====================================================
    // 紙本圖片：整合現有素材庫 / PixivImageAssets / LocalImageVault
    //
    // 支援正文：
    // [img:local-image://px_xxx]          ← 既有 Pixiv 圖片
    // [紙本圖片:local-image://px_xxx]     ← 本插件素材卡插入
    //
    // DOCX 時轉成 PNG 放進 word/media/。
    // =====================================================

    function isLocalImageRef(value) {
      return /^local-image:\/\/[a-z0-9_-]+$/i.test(
        String(value || "").trim()
      );
    }


    function imageIdFromRef(value) {
      const match =
        String(value || "")
          .trim()
          .match(
            /^local-image:\/\/([a-z0-9_-]+)$/i
          );

      return match
        ? match[1]
        : "";
    }


    function parsePaperBlocks(text) {
      const source =
        String(text || "");

      const pattern =
        /\[(紙本圖片|img):((?:local-image:\/\/[a-z0-9_-]+)|(?:data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\r\n]+))\]/gi;

      const blocks =
        [];

      let last =
        0;

      let match;


      while (
        (
          match =
            pattern.exec(
              source
            )
        )
      ) {
        if (
          match.index >
          last
        ) {
          blocks.push({
            type:
              "text",

            text:
              source.slice(
                last,
                match.index
              )
          });
        }


        const kind =
          String(
            match[1] ||
            ""
          ).toLowerCase();


        /*
         * [img:] 是既有 Pixiv 圖片。
         * 可以由面板設定是否也帶入 DOCX。
         *
         * [紙本圖片:] 則一定帶入。
         */
        if (
          kind ===
            "紙本圖片" ||
          state.settings
            .includePixivImages !==
            false
        ) {
          blocks.push({
            type:
              "image",

            ref:
              String(
                match[2] ||
                ""
              ).trim()
          });
        }


        last =
          pattern.lastIndex;
      }


      if (
        last <
        source.length
      ) {
        blocks.push({
          type:
            "text",

          text:
            source.slice(
              last
            )
        });
      }


      return blocks;
    }


    async function resolveImageDataUrl(
      ref
    ) {
      const value =
        String(
          ref ||
          ""
        ).trim();


      if (
        /^data:image\//i
          .test(
            value
          )
      ) {
        return value;
      }


      const id =
        imageIdFromRef(
          value
        );


      if (!id) {
        return "";
      }


      /*
       * 第一來源：
       * PixivImageAssets 的專案內短網址資產。
       */
      try {
        const assets =
          window.PixivImageAssets &&
          window.PixivImageAssets
            .assets;

        if (
          assets &&
          assets[id]
        ) {
          return String(
            assets[id]
          );
        }
      } catch (error) {}


      /*
       * 第二來源：
       * 原生 IndexedDB 圖片保險庫。
       */
      try {
        if (
          window.LocalImageVault &&
          typeof LocalImageVault.getImage ===
            "function"
        ) {
          const data =
            await LocalImageVault
              .getImage(
                id
              );

          if (data) {
            return String(
              data
            );
          }
        }
      } catch (error) {
        console.warn(
          "[Gamebook DOCX] LocalImageVault 圖片讀取失敗",
          id,
          error
        );
      }


      return "";
    }


    function loadImageElement(
      src
    ) {
      return new Promise(
        (
          resolve,
          reject
        ) => {
          const image =
            new Image();

          image.onload =
            () =>
              resolve(
                image
              );

          image.onerror =
            () =>
              reject(
                new Error(
                  "圖片解碼失敗"
                )
              );

          image.src =
            src;
        }
      );
    }


    function canvasToBlob(
      canvas,
      type,
      quality
    ) {
      return new Promise(
        (
          resolve,
          reject
        ) => {
          canvas.toBlob(
            blob => {
              if (blob) {
                resolve(
                  blob
                );
              } else {
                reject(
                  new Error(
                    "圖片轉檔失敗"
                  )
                );
              }
            },
            type,
            quality
          );
        }
      );
    }


    async function normalizeImageForDocx(
      dataUrl
    ) {
      const image =
        await loadImageElement(
          dataUrl
        );


      const naturalWidth =
        Math.max(
          1,
          Number(
            image.naturalWidth ||
            image.width ||
            1
          )
        );


      const naturalHeight =
        Math.max(
          1,
          Number(
            image.naturalHeight ||
            image.height ||
            1
          )
        );


      /*
       * DOCX 不直接依賴 WebP / AVIF。
       * 統一轉 PNG，提高 Word / LibreOffice 相容性。
       *
       * 紙本用不需要超大像素，限制長邊 1800，
       * 避免 DOCX 因原圖尺寸膨脹。
       */
      const scale =
        Math.min(
          1,
          1800 /
          Math.max(
            naturalWidth,
            naturalHeight
          )
        );


      const width =
        Math.max(
          1,
          Math.round(
            naturalWidth *
            scale
          )
        );


      const height =
        Math.max(
          1,
          Math.round(
            naturalHeight *
            scale
          )
        );


      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width =
        width;

      canvas.height =
        height;


      const ctx =
        canvas.getContext(
          "2d"
        );


      if (!ctx) {
        throw new Error(
          "無法建立圖片 Canvas"
        );
      }


      ctx.drawImage(
        image,
        0,
        0,
        width,
        height
      );


      const blob =
        await canvasToBlob(
          canvas,
          "image/png"
        );


      const bytes =
        new Uint8Array(
          await blob.arrayBuffer()
        );


      return {
        bytes,
        pixelWidth:
          width,
        pixelHeight:
          height
      };
    }


    async function prepareDocxImages(
      sections
    ) {
      const refs =
        [];


      sections.forEach(
        section => {
          parsePaperBlocks(
            section.text
          ).forEach(
            block => {
              if (
                block.type ===
                "image" &&
                !refs.includes(
                  block.ref
                )
              ) {
                refs.push(
                  block.ref
                );
              }
            }
          );
        }
      );


      const map =
        new Map();


      const missing =
        [];


      let index =
        0;


      for (
        const ref of refs
      ) {
        const dataUrl =
          await resolveImageDataUrl(
            ref
          );


        if (!dataUrl) {
          missing.push(
            ref
          );

          continue;
        }


        try {
          const normalized =
            await normalizeImageForDocx(
              dataUrl
            );


          index++;


          const widthCm =
            Math.min(
              17,
              Math.max(
                2,
                Number(
                  state.settings
                    .imageWidthCm
                ) ||
                12
              )
            );


          const cx =
            Math.round(
              widthCm *
              360000
            );


          const ratio =
            normalized.pixelHeight /
            normalized.pixelWidth;


          const cy =
            Math.max(
              1,
              Math.round(
                cx *
                ratio
              )
            );


          map.set(
            ref,
            {
              ref,
              rId:
                "rIdImg" +
                index,
              fileName:
                "image" +
                index +
                ".png",
              bytes:
                normalized.bytes,
              cx,
              cy,
              docPrId:
                1000 +
                index
            }
          );

        } catch (error) {
          missing.push(
            ref
          );

          console.warn(
            "[Gamebook DOCX] 圖片封裝失敗",
            ref,
            error
          );
        }
      }


      return {
        map,
        missing
      };
    }


    function wImageParagraph(
      image
    ) {
      if (!image) {
        return "";
      }


      return (
        '<w:p>' +
        '<w:pPr><w:jc w:val="center"/><w:spacing w:before="100" w:after="140"/></w:pPr>' +
        '<w:r><w:drawing>' +

        `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
        `<wp:extent cx="${image.cx}" cy="${image.cy}"/>` +
        `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
        `<wp:docPr id="${image.docPrId}" name="${xmlEscape(image.fileName)}"/>` +
        '<wp:cNvGraphicFramePr>' +
        '<a:graphicFrameLocks noChangeAspect="1"/>' +
        '</wp:cNvGraphicFramePr>' +

        '<a:graphic>' +
        '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +

        '<pic:pic>' +

        '<pic:nvPicPr>' +
        `<pic:cNvPr id="0" name="${xmlEscape(image.fileName)}"/>` +
        '<pic:cNvPicPr/>' +
        '</pic:nvPicPr>' +

        '<pic:blipFill>' +
        `<a:blip r:embed="${image.rId}"/>` +
        '<a:stretch><a:fillRect/></a:stretch>' +
        '</pic:blipFill>' +

        '<pic:spPr>' +
        '<a:xfrm>' +
        '<a:off x="0" y="0"/>' +
        `<a:ext cx="${image.cx}" cy="${image.cy}"/>` +
        '</a:xfrm>' +
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
        '</pic:spPr>' +

        '</pic:pic>' +

        '</a:graphicData>' +
        '</a:graphic>' +

        '</wp:inline>' +

        '</w:drawing></w:r>' +
        '</w:p>'
      );
    }


    function sectionContentToXml(
      text,
      imageMap
    ) {
      return parsePaperBlocks(
        text
      )
        .map(
          block => {
            if (
              block.type ===
              "image"
            ) {
              const image =
                imageMap.get(
                  block.ref
                );

              return image
                ? wImageParagraph(
                    image
                  )
                : wParagraph(
                    wText(
                      "〔圖片無法封裝：" +
                      block.ref +
                      "〕"
                    ),
                    {
                      spaceAfter:
                        100
                    }
                  );
            }


            return bodyTextToParagraphs(
              block.text
            );
          }
        )
        .join(
          ""
        );
    }


    function insertAtEditorCaret(
      text
    ) {
      const textarea =
        document.getElementById(
          "pageText"
        );


      if (!textarea) {
        throw new Error(
          "找不到正文編輯區"
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
            bubbles:
              true
          }
        )
      );


      textarea.dispatchEvent(
        new Event(
          "change",
          {
            bubbles:
              true
          }
        )
      );
    }


    function insertPaperImageFromMaterial(
      material
    ) {
      if (
        !material ||
        !String(
          material.data ||
          ""
        ).startsWith(
          "data:image/"
        )
      ) {
        throw new Error(
          "這不是圖片素材"
        );
      }


      if (
        !window.PixivImageAssets ||
        typeof PixivImageAssets.remember !==
          "function"
      ) {
        throw new Error(
          "找不到 PixivImageAssets"
        );
      }


      const id =
        PixivImageAssets.remember(
          material.data
        );


      insertAtEditorCaret(
        "\n[紙本圖片:local-image://" +
        id +
        "]\n"
      );


      api.toast(
        "已插入紙本 DOCX 圖片"
      );
    }


    let materialObserver =
      null;


    function enhanceMaterialCardsForPaper() {
      const list =
        document.getElementById(
          "material-library-list"
        );


      if (!list) {
        return false;
      }


      list.querySelectorAll(
        ".material-item"
      ).forEach(
        card => {
          if (
            card.dataset
              .fhPaperImageBound ===
              "1"
          ) {
            return;
          }


          const item =
            card.__materialItem ||
            (
              window.MaterialLibraryAPI &&
              typeof MaterialLibraryAPI.load ===
                "function"
                ? MaterialLibraryAPI.load()[
                    Number(
                      card.dataset.idx
                    )
                  ]
                : null
            );


          const isImage =
            !!(
              item &&
              (
                item.type ===
                  "image" ||
                String(
                  item.type ||
                  ""
                ).startsWith(
                  "image/"
                ) ||
                String(
                  item.data ||
                  ""
                ).startsWith(
                  "data:image/"
                )
              )
            );


          if (!isImage) {
            return;
          }


          card.dataset
            .fhPaperImageBound =
            "1";


          const button =
            document.createElement(
              "button"
            );


          button.type =
            "button";


          button.className =
            "fh-paper-image-insert";


          button.textContent =
            "＋紙本圖";


          button.title =
            "插入可封裝到 DOCX 的紙本圖片";


          button.addEventListener(
            "pointerdown",
            event => {
              event.preventDefault();
              event.stopPropagation();
              event.stopImmediatePropagation();
            },
            true
          );


          button.addEventListener(
            "click",
            event => {
              event.preventDefault();
              event.stopPropagation();


              try {
                insertPaperImageFromMaterial(
                  item
                );

              } catch (error) {
                alert(
                  "插入紙本圖片失敗：" +
                  String(
                    error &&
                    error.message ||
                    error
                  )
                );
              }
            }
          );


          card.appendChild(
            button
          );
        }
      );


      return true;
    }


    function installMaterialObserver() {
      const list =
        document.getElementById(
          "material-library-list"
        );


      if (!list) {
        return false;
      }


      materialObserver
        ?.disconnect();


      materialObserver =
        new MutationObserver(
          () =>
            requestAnimationFrame(
              enhanceMaterialCardsForPaper
            )
        );


      materialObserver.observe(
        list,
        {
          childList:
            true,
          subtree:
            true
        }
      );


      enhanceMaterialCardsForPaper();


      return true;
    }


    const materialWaiter =
      setInterval(
        () => {
          if (
            installMaterialObserver()
          ) {
            clearInterval(
              materialWaiter
            );
          }
        },
        500
      );


    // =====================================================
    // Minimal DOCX writer
    // Store-only ZIP, no external library required.
    // =====================================================

    function crc32Table() {
      const table =
        new Uint32Array(
          256
        );

      for (
        let n =
          0;

        n < 256;

        n++
      ) {
        let c =
          n;

        for (
          let k =
            0;

          k < 8;

          k++
        ) {
          c =
            (
              c &
              1
            )
              ? (
                  0xedb88320 ^
                  (
                    c >>>
                    1
                  )
                )
              : (
                  c >>>
                  1
                );
        }

        table[n] =
          c >>> 0;
      }

      return table;
    }


    const CRC_TABLE =
      crc32Table();


    function crc32(
      bytes
    ) {
      let crc =
        0xffffffff;

      for (
        let i =
          0;

        i <
        bytes.length;

        i++
      ) {
        crc =
          CRC_TABLE[
            (
              crc ^
              bytes[i]
            ) &
            0xff
          ] ^
          (
            crc >>>
            8
          );
      }

      return (
        crc ^
        0xffffffff
      ) >>> 0;
    }


    function u16(
      value
    ) {
      return new Uint8Array(
        [
          value &
            255,

          (
            value >>>
            8
          ) &
            255
        ]
      );
    }


    function u32(
      value
    ) {
      return new Uint8Array(
        [
          value &
            255,

          (
            value >>>
            8
          ) &
            255,

          (
            value >>>
            16
          ) &
            255,

          (
            value >>>
            24
          ) &
            255
        ]
      );
    }


    function concatBytes(
      parts
    ) {
      let length =
        0;

      parts.forEach(
        part => {
          length +=
            part.length;
        }
      );

      const out =
        new Uint8Array(
          length
        );

      let offset =
        0;

      parts.forEach(
        part => {
          out.set(
            part,
            offset
          );

          offset +=
            part.length;
        }
      );

      return out;
    }


    function makeZip(
      files
    ) {
      const encoder =
        new TextEncoder();

      const locals =
        [];

      const centrals =
        [];

      let offset =
        0;

      files.forEach(
        file => {
          const name =
            encoder.encode(
              file.name
            );

          const data =
            typeof file.data ===
              "string"
              ? encoder.encode(
                  file.data
                )
              : file.data;

          const crc =
            crc32(
              data
            );


          const local =
            concatBytes(
              [
                u32(
                  0x04034b50
                ),

                u16(
                  20
                ),

                u16(
                  0
                ),

                u16(
                  0
                ),

                u16(
                  0
                ),

                u16(
                  0
                ),

                u32(
                  crc
                ),

                u32(
                  data.length
                ),

                u32(
                  data.length
                ),

                u16(
                  name.length
                ),

                u16(
                  0
                ),

                name,
                data
              ]
            );


          const central =
            concatBytes(
              [
                u32(
                  0x02014b50
                ),

                u16(
                  20
                ),

                u16(
                  20
                ),

                u16(
                  0
                ),

                u16(
                  0
                ),

                u16(
                  0
                ),

                u16(
                  0
                ),

                u32(
                  crc
                ),

                u32(
                  data.length
                ),

                u32(
                  data.length
                ),

                u16(
                  name.length
                ),

                u16(
                  0
                ),

                u16(
                  0
                ),

                u16(
                  0
                ),

                u16(
                  0
                ),

                u32(
                  0
                ),

                u32(
                  offset
                ),

                name
              ]
            );


          locals.push(
            local
          );

          centrals.push(
            central
          );

          offset +=
            local.length;
        }
      );


      const centralData =
        concatBytes(
          centrals
        );


      const end =
        concatBytes(
          [
            u32(
              0x06054b50
            ),

            u16(
              0
            ),

            u16(
              0
            ),

            u16(
              files.length
            ),

            u16(
              files.length
            ),

            u32(
              centralData.length
            ),

            u32(
              offset
            ),

            u16(
              0
            )
          ]
        );


      return concatBytes(
        [
          ...locals,
          centralData,
          end
        ]
      );
    }


    function xmlEscape(
      value
    ) {
      return String(
        value ??
        ""
      )
        .replace(
          /&/g,
          "&amp;"
        )
        .replace(
          /</g,
          "&lt;"
        )
        .replace(
          />/g,
          "&gt;"
        )
        .replace(
          /"/g,
          "&quot;"
        )
        .replace(
          /'/g,
          "&apos;"
        );
    }


    function wText(
      text,
      options
    ) {
      const settings =
        options ||
        {};

      const properties =
        [];

      if (
        settings.bold
      ) {
        properties.push(
          "<w:b/>"
        );
      }

      if (
        settings.size
      ) {
        properties.push(
          `<w:sz w:val="${settings.size}"/>`,
          `<w:szCs w:val="${settings.size}"/>`
        );
      }

      return (
        "<w:r>" +
        (
          properties.length
            ? (
                "<w:rPr>" +
                properties.join(
                  ""
                ) +
                "</w:rPr>"
              )
            : ""
        ) +
        `<w:t xml:space="preserve">${xmlEscape(text)}</w:t>` +
        "</w:r>"
      );
    }


    function wParagraph(
      runs,
      options
    ) {
      const settings =
        options ||
        {};

      const props =
        [];

      if (
        settings.center
      ) {
        props.push(
          '<w:jc w:val="center"/>'
        );
      }

      if (
        settings.spaceAfter !=
        null
      ) {
        props.push(
          `<w:spacing w:after="${settings.spaceAfter}"/>`
        );
      }

      return (
        "<w:p>" +
        (
          props.length
            ? (
                "<w:pPr>" +
                props.join(
                  ""
                ) +
                "</w:pPr>"
              )
            : ""
        ) +
        runs +
        "</w:p>"
      );
    }


    function bodyTextToParagraphs(
      text
    ) {
      const lines =
        String(
          text ||
          ""
        )
          .replace(
            /\r\n?/g,
            "\n"
          )
          .split(
            "\n"
          );

      return lines
        .map(
          line =>
            wParagraph(
              wText(
                line
              ),
              {
                spaceAfter:
                  line.trim()
                    ? 100
                    : 40
              }
            )
        )
        .join(
          ""
        );
    }


    function bookmarkNameForSection(number) {
      return "FH_SECTION_" + String(number).replace(/[^0-9]/g, "");
    }


    function wSectionBookmarkParagraph(section, bookmarkId) {
      const name = bookmarkNameForSection(section.number);

      return (
        "<w:p>" +
        '<w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/></w:pPr>' +
        `<w:bookmarkStart w:id="${bookmarkId}" w:name="${name}"/>` +
        wText(String(section.number), { bold: true, size: 32 }) +
        `<w:bookmarkEnd w:id="${bookmarkId}"/>` +
        "</w:p>"
      );
    }


    function wInternalLinkParagraph(text, targetSection) {
      const anchor = bookmarkNameForSection(targetSection);

      return (
        "<w:p>" +
        '<w:pPr><w:spacing w:after="80"/></w:pPr>' +
        `<w:hyperlink w:anchor="${anchor}" w:history="1">` +
        "<w:r>" +
        "<w:rPr><w:rStyle w:val=\"Hyperlink\"/><w:u w:val=\"single\"/></w:rPr>" +
        `<w:t xml:space="preserve">${xmlEscape(text)}</w:t>` +
        "</w:r>" +
        "</w:hyperlink>" +
        "</w:p>"
      );
    }


    function makeDocumentXml(
      sections,
      imageMap
    ) {
      let body =
        "";


      sections.forEach(
        section => {
          body +=
            wSectionBookmarkParagraph(
              section,
              section.number
            );


          if (
            section.title
          ) {
            body +=
              wParagraph(
                wText(
                  section.title,
                  {
                    bold:
                      true,

                    size:
                      24
                  }
                ),
                {
                  spaceAfter:
                    160
                }
              );
          }


          if (
            section.text
          ) {
            body +=
              sectionContentToXml(
                section.text,
                imageMap
              );
          }


          if (
            section.choices.length
          ) {
            body +=
              wParagraph(
                "",
                {
                  spaceAfter:
                    40
                }
              );


            section.choices
              .forEach(
                choice => {
                  const label =
                    choice.text ||
                    "繼續";

                  body +=
                    wInternalLinkParagraph(
                      `${label}　—　${formatGoto(choice.section)}`,
                      choice.section
                    );
                }
              );
          }


          body +=
            wParagraph(
              "",
              {
                spaceAfter:
                  260
              }
            );
        }
      );


      return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document ' +
        'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
        'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
        'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
        '<w:body>' +
        body +
        '<w:sectPr>' +
        '<w:pgSz w:w="11906" w:h="16838"/>' +
        '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>' +
        '</w:sectPr>' +
        '</w:body>' +
        '</w:document>'
      );
    }


    async function makeDocx() {
      const sections =
        buildSections();


      const prepared =
        await prepareDocxImages(
          sections
        );


      const documentXml =
        makeDocumentXml(
          sections,
          prepared.map
        );


      const imageRelationships =
        Array.from(
          prepared.map.values()
        )
          .map(
            image =>
              `<Relationship Id="${image.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${image.fileName}"/>`
          )
          .join(
            ""
          );


      const files =
        [
          {
            name:
              "[Content_Types].xml",

            data:
              '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
              '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
              '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
              '<Default Extension="xml" ContentType="application/xml"/>' +
              '<Default Extension="png" ContentType="image/png"/>' +
              '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
              '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
              '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
              '</Types>'
          },

          {
            name:
              "_rels/.rels",

            data:
              '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
              '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
              '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
              '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
              '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
              '</Relationships>'
          },

          {
            name:
              "word/document.xml",

            data:
              documentXml
          },

          {
            name:
              "word/_rels/document.xml.rels",

            data:
              '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
              '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
              '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
              imageRelationships +
              '</Relationships>'
          },

          {
            name:
              "word/styles.xml",

            data:
              '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
              '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
              '<w:style w:type="character" w:styleId="Hyperlink">' +
              '<w:name w:val="Hyperlink"/>' +
              '<w:uiPriority w:val="99"/>' +
              '<w:unhideWhenUsed/>' +
              '<w:rPr><w:u w:val="single"/></w:rPr>' +
              '</w:style>' +
              '</w:styles>'
          },

          {
            name:
              "docProps/core.xml",

            data:
              '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
              '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
              `<dc:title>${xmlEscape(safeFileBase())}</dc:title>` +
              '<dc:creator>Firehaha Gamebook Section + Image Tool</dc:creator>' +
              '</cp:coreProperties>'
          },

          {
            name:
              "docProps/app.xml",

            data:
              '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
              '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
              '<Application>Firehaha</Application>' +
              '</Properties>'
          }
        ];


      Array.from(
        prepared.map.values()
      ).forEach(
        image => {
          files.push({
            name:
              "word/media/" +
              image.fileName,

            data:
              image.bytes
          });
        }
      );


      return {
        bytes:
          makeZip(
            files
          ),

        imageCount:
          prepared.map.size,

        missing:
          prepared.missing
      };
    }


    async function exportDocx() {
      api.toast(
        "正在封裝 Gamebook DOCX 圖片…"
      );


      try {
        const result =
          await makeDocx();


        downloadBlob(
          new Blob(
            [
              result.bytes
            ],
            {
              type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            }
          ),

          safeFileBase() +
          "_gamebook_clickable_sections.docx"
        );


        if (
          result.missing.length
        ) {
          alert(
            `DOCX 已輸出，共封裝 ${result.imageCount} 張圖片。\n另有 ${result.missing.length} 張圖片找不到本機資料，已在文件中留下提示。`
          );

        } else {
          api.toast(
            `DOCX 已輸出，封裝 ${result.imageCount} 張圖片`
          );
        }

      } catch (error) {
        console.error(
          "[Gamebook DOCX export]",
          error
        );

        alert(
          "DOCX 輸出失敗：" +
          String(
            error &&
            error.message ||
            error
          )
        );
      }
    }


    // =====================================================
    // UI
    // =====================================================

    function makePanel() {
      const root =
        document.createElement(
          "div"
        );

      root.id =
        PANEL_ID;

      root.innerHTML =
        `
<div class="fh-section-dialog">
  <div class="fh-section-head">
    <strong>📖 Gamebook 節號</strong>
    <button type="button" data-close>✕</button>
  </div>

  <div class="fh-section-body">

    <div class="fh-section-actions">
      <button type="button" data-sequential>依序編號</button>
      <button type="button" data-shuffle>🎲 隨機洗牌</button>
    </div>

    <label class="fh-section-check">
      <input type="checkbox" data-first-one>
      第一個 Node 固定為第 1 節
    </label>

    <div class="fh-section-format">
      <label>
        節標題前綴
        <input type="text" data-section-prefix>
      </label>

      <label>
        節標題後綴
        <input type="text" data-section-suffix>
      </label>

      <label>
        跳轉前綴
        <input type="text" data-goto-prefix>
      </label>

      <label>
        跳轉後綴
        <input type="text" data-goto-suffix>
      </label>
    </div>

    <div class="fh-section-note">
      Node UUID 仍是故事真正連線；紙本節號只供 DOCX。Pixiv TXT 維持原生 [jump:N] 跳頁語法。
    </div>

    <div class="fh-section-image-settings">
      <label>
        DOCX 圖片寬度（cm）
        <input type="number" min="2" max="17" step="0.5" data-image-width>
      </label>

      <label class="fh-section-check">
        <input type="checkbox" data-include-pixiv-images>
        DOCX 自動包含既有 [img:local-image://...] 圖片
      </label>

      <div class="fh-section-note">
        素材庫圖片卡會新增「＋紙本圖」。DOCX 會封裝圖片；每個 Section 同時建立 Word 書籤，選項文字可直接點擊跳到目標節。
      </div>
    </div>

    <div class="fh-section-list" data-list></div>

    <div class="fh-section-export">
      <button type="button" data-txt>📄 輸出節號 TXT</button>
      <button type="button" data-docx>📝 輸出節號 DOCX</button>
    </div>
  </div>
</div>
`;

      document.body
        .appendChild(
          root
        );

      root
        .querySelector(
          "[data-close]"
        )
        .addEventListener(
          "click",
          () =>
            root.classList
              .remove(
                "open"
              )
        );


      root
        .querySelector(
          "[data-sequential]"
        )
        .addEventListener(
          "click",
          () =>
            generateNumbers(
              "sequential"
            )
        );


      root
        .querySelector(
          "[data-shuffle]"
        )
        .addEventListener(
          "click",
          () =>
            generateNumbers(
              "shuffle"
            )
        );


      root
        .querySelector(
          "[data-txt]"
        )
        .addEventListener(
          "click",
          exportTxt
        );


      root
        .querySelector(
          "[data-docx]"
        )
        .addEventListener(
          "click",
          exportDocx
        );


      const imageWidthInput =
        root.querySelector(
          "[data-image-width]"
        );

      imageWidthInput.addEventListener(
        "change",
        () => {
          state.settings
            .imageWidthCm =
            Math.min(
              17,
              Math.max(
                2,
                Number(
                  imageWidthInput.value
                ) ||
                12
              )
            );

          requestSave();
        }
      );


      const includePixivImages =
        root.querySelector(
          "[data-include-pixiv-images]"
        );

      includePixivImages.addEventListener(
        "change",
        () => {
          state.settings
            .includePixivImages =
            includePixivImages.checked;

          requestSave();
        }
      );


      const first =
        root.querySelector(
          "[data-first-one]"
        );

      first.addEventListener(
        "change",
        () => {
          state.settings
            .keepFirstAtOne =
            first.checked;

          requestSave();
        }
      );


      [
        [
          "sectionPrefix",
          "[data-section-prefix]"
        ],

        [
          "sectionSuffix",
          "[data-section-suffix]"
        ],

        [
          "gotoPrefix",
          "[data-goto-prefix]"
        ],

        [
          "gotoSuffix",
          "[data-goto-suffix]"
        ]
      ].forEach(
        (
          [
            key,
            selector
          ]
        ) => {
          const input =
            root.querySelector(
              selector
            );

          input.addEventListener(
            "input",
            () => {
              state.settings[
                key
              ] =
                input.value;

              requestSave();
            }
          );
        }
      );


      return root;
    }


    function renderPanel() {
      if (
        !panel
      ) {
        return;
      }

      const list =
        getPages();

      panel
        .querySelector(
          "[data-first-one]"
        )
        .checked =
          !!state.settings
            .keepFirstAtOne;


      panel
        .querySelector(
          "[data-image-width]"
        )
        .value =
          Number(
            state.settings
              .imageWidthCm
          ) ||
          12;


      panel
        .querySelector(
          "[data-include-pixiv-images]"
        )
        .checked =
          state.settings
            .includePixivImages !==
            false;


      panel
        .querySelector(
          "[data-section-prefix]"
        )
        .value =
          state.settings
            .sectionPrefix ??
          "第 ";


      panel
        .querySelector(
          "[data-section-suffix]"
        )
        .value =
          state.settings
            .sectionSuffix ??
          " 節";


      panel
        .querySelector(
          "[data-goto-prefix]"
        )
        .value =
          state.settings
            .gotoPrefix ??
          "前往第 ";


      panel
        .querySelector(
          "[data-goto-suffix]"
        )
        .value =
          state.settings
            .gotoSuffix ??
          " 節";


      const box =
        panel.querySelector(
          "[data-list]"
        );

      box.innerHTML =
        "";


      const ordered =
        list.slice()
          .sort(
            (
              a,
              b
            ) =>
              (
                sectionOf(a) ||
                999999
              ) -
              (
                sectionOf(b) ||
                999999
              )
          );


      ordered.forEach(
        page => {
          const id =
            String(
              page.id
            );

          const row =
            document.createElement(
              "div"
            );

          row.className =
            "fh-section-row";


          const number =
            document.createElement(
              "input"
            );

          number.type =
            "number";

          number.min =
            "1";

          number.max =
            String(
              list.length
            );

          number.value =
            sectionOf(page) ??
            "";

          number.addEventListener(
            "change",
            () =>
              setNumber(
                id,
                number.value
              )
          );


          const title =
            document.createElement(
              "span"
            );

          title.textContent =
            page.title ||
            "未命名 Node";


          const lockLabel =
            document.createElement(
              "label"
            );

          lockLabel.className =
            "fh-section-lock";


          const lock =
            document.createElement(
              "input"
            );

          lock.type =
            "checkbox";

          lock.checked =
            !!state.locked[
              id
            ];

          lock.addEventListener(
            "change",
            () => {
              state.locked[
                id
              ] =
                lock.checked;

              requestSave();
            }
          );


          lockLabel.append(
            lock,
            document.createTextNode(
              "鎖定"
            )
          );


          row.append(
            number,
            title,
            lockLabel
          );

          box.appendChild(
            row
          );
        }
      );
    }


    function openPanel() {
      ensureNumbers();
      renderPanel();

      panel.classList
        .add(
          "open"
        );
    }


    function installUi() {
      if (
        document.getElementById(
          BUTTON_ID
        )
      ) {
        return;
      }

      const morePanel =
        document.querySelector(
          ".pro-more-panel.pro-floating-tools"
        );

      const header =
        morePanel ||
        document.querySelector(
          ".pixiv-editor-app > header, .pixiv-editor-container > header, header"
        );

      if (
        !header
      ) {
        return;
      }

      headerButton =
        document.createElement(
          "button"
        );

      headerButton.id =
        BUTTON_ID;

      headerButton.type =
        "button";

      headerButton.textContent =
        "📖 節號";

      headerButton.addEventListener(
        "click",
        openPanel
      );

      header.appendChild(
        headerButton
      );

      panel =
        makePanel();

      renderPanel();
      refreshBadges();
    }


    // 先同步建立一次，讓主程式的工具列整理器能在初始化時一起收納；
    // 若工具列已整理完成，installUi 會直接放進「更多工具」面板。
    installUi();

    const uiTimer =
      setInterval(
        () => {
          installUi();

          if (
            headerButton &&
            panel
          ) {
            clearInterval(
              uiTimer
            );
          }
        },
        300
      );


    // =====================================================
    // API
    // =====================================================

    window.FirehahaGamebookSections = {
      version:
        "3.1.0",

      state,

      generateSequential() {
        generateNumbers(
          "sequential"
        );
      },

      shuffle() {
        generateNumbers(
          "shuffle"
        );
      },

      get(
        pageOrId
      ) {
        return sectionOf(
          pageOrId
        );
      },

      getMap() {
        return clone(
          state.numbers
        );
      },

      buildSections,

      buildTxt,

      exportTxt,

      exportDocx,

      insertPaperImage:
        insertPaperImageFromMaterial,

      resolveImageDataUrl,

      open:
        openPanel
    };


    const removeStyle =
      api.addStyle(
        "gamebook-section-numbering",
        `
#${BUTTON_ID}{
  background:#6d4c41!important;
}

.${BADGE_CLASS}{
  position:absolute;
  right:-10px;
  bottom:-10px;
  z-index:20;
  min-width:34px;
  height:24px;
  box-sizing:border-box;
  padding:3px 7px;
  border-radius:999px;
  background:#5d4037;
  color:#fff;
  font:800 11px/18px system-ui,sans-serif;
  box-shadow:0 2px 6px rgba(0,0,0,.28);
  pointer-events:none;
}

#${PANEL_ID}{
  position:fixed;
  inset:0;
  z-index:1000060;
  display:none;
  align-items:center;
  justify-content:center;
  padding:16px;
  background:rgba(20,24,28,.5);
  font-family:system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;
}

#${PANEL_ID}.open{
  display:flex;
}

.fh-section-dialog{
  width:min(720px,96vw);
  max-height:90vh;
  display:flex;
  flex-direction:column;
  overflow:hidden;
  border-radius:18px;
  background:#fff;
  color:#263238;
  box-shadow:0 24px 70px rgba(0,0,0,.35);
}

.fh-section-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:14px 18px;
  background:#5d4037;
  color:#fff;
}

.fh-section-head strong{
  font-size:17px;
}

.fh-section-head button{
  padding:5px 10px!important;
  background:rgba(255,255,255,.15)!important;
}

.fh-section-body{
  overflow:auto;
  padding:16px;
}

.fh-section-actions,
.fh-section-export{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}

.fh-section-actions button,
.fh-section-export button{
  background:#6d4c41!important;
}

.fh-section-check{
  display:flex;
  align-items:center;
  gap:7px;
  margin:14px 0;
}

.fh-section-format{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:8px;
  margin-bottom:12px;
}

.fh-section-format label{
  display:flex;
  flex-direction:column;
  gap:4px;
  font-size:12px;
  font-weight:700;
}

.fh-section-format input{
  width:100%;
}

.fh-section-note{
  margin:10px 0;
  padding:9px 11px;
  border-radius:9px;
  background:#efebe9;
  color:#5d4037;
  font-size:12px;
}

.fh-section-list{
  display:flex;
  flex-direction:column;
  gap:6px;
  max-height:42vh;
  overflow:auto;
  margin:12px 0;
}

.fh-section-row{
  display:grid;
  grid-template-columns:75px minmax(0,1fr) auto;
  gap:8px;
  align-items:center;
  padding:8px;
  border:1px solid #e3dedb;
  border-radius:10px;
}

.fh-section-row>input{
  width:70px;
  text-align:center;
}

.fh-section-row>span{
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-weight:700;
}

.fh-section-lock{
  display:flex;
  align-items:center;
  gap:4px;
  font-size:12px;
}

.fh-paper-image-insert{
  width:100%!important;
  margin-top:5px!important;
  padding:5px 6px!important;
  border-radius:12px!important;
  background:#795548!important;
  color:#fff!important;
  font-size:10px!important;
  justify-content:center!important;
}

.fh-section-image-settings{
  margin:12px 0;
  padding:10px;
  border:1px solid #e3dedb;
  border-radius:10px;
  background:#fffaf7;
}

.fh-section-image-settings>label:first-child{
  display:flex;
  flex-direction:column;
  gap:4px;
  font-size:12px;
  font-weight:700;
}

.fh-section-image-settings input[type="number"]{
  width:120px;
}

@media(max-width:600px){
  .fh-section-format{
    grid-template-columns:1fr;
  }

  .fh-section-row{
    grid-template-columns:65px minmax(0,1fr);
  }

  .fh-section-lock{
    grid-column:2;
  }
}
`
      );


    api.toast(
      "Gamebook V3.1 已啟用：Pixiv 保留 [jump:]，DOCX 使用書籤跳頁"
    );


    return function cleanup() {
      clearInterval(
        registerTimer
      );

      clearInterval(
        badgeTimer
      );

      clearInterval(
        uiTimer
      );

      clearInterval(
        materialWaiter
      );

      materialObserver
        ?.disconnect();

      clearTimeout(
        saveTimer
      );

      document
        .querySelectorAll(
          "." +
          BADGE_CLASS
        )
        .forEach(
          element =>
            element.remove()
        );


      document
        .querySelectorAll(
          ".fh-paper-image-insert"
        )
        .forEach(
          element =>
            element.remove()
        );


      panel?.remove();
      headerButton?.remove();

      removeStyle();

      if (
        window.FirehahaGamebookSections
      ) {
        delete window
          .FirehahaGamebookSections;
      }
    };
  }
});
