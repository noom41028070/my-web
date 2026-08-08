// @firehaha-plugin {"id":"official.layout-studio-title-effects","name":"排版工作室・章節標題演出","version":"1.4.0","author":"Firehaha","description":"擴充視覺排版工作室與舊版核心排版：章節標題顏色、字級、字重、字距、對齊、陰影、進場動畫與停留後淡出。V1.4 改用 Web Animations API 執行漸變淡出，新增多種標題退場動畫樣式。"}

FirehahaPlugins.register({
  id: "official.layout-studio-title-effects",
  name: "排版工作室・章節標題演出",
  version: "1.4.0",

  async setup(api) {
    "use strict";

    const FEATURE_KEY =
      "layoutStudioTitleEffectsV1";

    const PANEL_ID =
      "fh-title-effects-panel";

    const BUTTON_ID =
      "fh-title-effects-open";

    const STUDIO_BLOCK_CLASS =
      "fh-title-effects-studio-block";

    const sleep =
      ms =>
        new Promise(
          resolve =>
            setTimeout(resolve, ms)
        );


    // =====================================================
    // 等待主程式
    // =====================================================

    const startedAt =
      Date.now();

    while (
      !window.GamebookCore &&
      Date.now() - startedAt <
        12000
    ) {
      await sleep(80);
    }


    const core =
      window.GamebookCore ||
      null;


    function getPages() {
      if (
        core &&
        Array.isArray(
          core.pages
        )
      ) {
        return core.pages;
      }

      try {
        if (
          typeof pages !==
            "undefined" &&
          Array.isArray(pages)
        ) {
          return pages;
        }
      } catch (error) {}

      return [];
    }


    function currentPage() {
      if (
        core &&
        core.currentPage
      ) {
        return core.currentPage;
      }

      try {
        if (
          typeof currentPage !==
            "undefined"
        ) {
          return currentPage;
        }
      } catch (error) {}

      return getPages()[0] ||
        null;
    }


    function clone(value) {
      return JSON.parse(
        JSON.stringify(value)
      );
    }


    function clamp(
      value,
      min,
      max,
      fallback
    ) {
      const number =
        Number(value);

      return Number.isFinite(number)
        ? Math.min(
            max,
            Math.max(
              min,
              number
            )
          )
        : fallback;
    }


    // =====================================================
    // 插件資料
    // =====================================================

    const defaults = {
      color:
        "#172b3a",

      fontSize:
        30,

      weight:
        800,

      letterSpacing:
        0,

      align:
        "center",

      shadow:
        "soft",

      enterAnimation:
        "fade",

      enterDuration:
        700,

      fadeOut:
        false,

      fadeStyle:
        "fade",

      holdDuration:
        2200,

      fadeDuration:
        900,

      collapseAfterFade:
        false
    };


    let state = {
      pages: {}
    };


    function normalizeSettings(
      value
    ) {
      const source =
        value &&
        typeof value ===
          "object"
          ? value
          : {};

      return {
        color:
          /^#[0-9a-f]{6}$/i.test(
            String(
              source.color ||
              ""
            )
          )
            ? source.color
            : defaults.color,

        fontSize:
          clamp(
            source.fontSize,
            12,
            96,
            defaults.fontSize
          ),

        weight:
          clamp(
            source.weight,
            100,
            900,
            defaults.weight
          ),

        letterSpacing:
          clamp(
            source.letterSpacing,
            -3,
            16,
            defaults.letterSpacing
          ),

        align:
          [
            "left",
            "center",
            "right"
          ].includes(
            source.align
          )
            ? source.align
            : defaults.align,

        shadow:
          [
            "none",
            "soft",
            "glow",
            "cinema"
          ].includes(
            source.shadow
          )
            ? source.shadow
            : defaults.shadow,

        enterAnimation:
          [
            "none",
            "fade",
            "slide-up",
            "slide-down",
            "zoom",
            "blur"
          ].includes(
            source.enterAnimation
          )
            ? source.enterAnimation
            : defaults.enterAnimation,

        enterDuration:
          clamp(
            source.enterDuration,
            0,
            5000,
            defaults.enterDuration
          ),

        fadeOut:
          !!source.fadeOut,

        fadeStyle:
          [
            "fade",
            "fade-up",
            "fade-down",
            "shrink",
            "expand",
            "blur",
            "spread",
            "cinema"
          ].includes(
            source.fadeStyle
          )
            ? source.fadeStyle
            : defaults.fadeStyle,

        holdDuration:
          clamp(
            source.holdDuration,
            0,
            20000,
            defaults.holdDuration
          ),

        fadeDuration:
          clamp(
            source.fadeDuration,
            100,
            10000,
            defaults.fadeDuration
          ),

        collapseAfterFade:
          !!source.collapseAfterFade
      };
    }


    function settingsFor(
      page
    ) {
      if (!page) {
        return clone(
          defaults
        );
      }

      const id =
        String(page.id);

      state.pages[id] =
        normalizeSettings(
          state.pages[id] ||
          readLegacyStyle(page)
        );

      return state.pages[id];
    }


    // =====================================================
    // 舊／新排版核心同步
    // =====================================================

    function dualState() {
      return (
        window.DualFormatWorkspace &&
        window.DualFormatWorkspace
          .state
      ) || null;
    }


    function legacyNode(
      page,
      create
    ) {
      const ds =
        dualState();

      if (
        !ds ||
        !page
      ) {
        return null;
      }

      ds.readerExperience =
        ds.readerExperience ||
        {
          nodes: {},
          export: {}
        };

      ds.readerExperience.nodes =
        ds.readerExperience.nodes ||
        {};

      const id =
        String(page.id);

      if (
        !ds.readerExperience
          .nodes[id] &&
        create
      ) {
        ds.readerExperience
          .nodes[id] = {};
      }

      return (
        ds.readerExperience
          .nodes[id] ||
        null
      );
    }


    function pageDesign(
      page,
      create
    ) {
      const ds =
        dualState();

      if (
        !ds ||
        !page ||
        !ds.pages
      ) {
        return null;
      }

      const id =
        String(page.id);

      let record =
        ds.pages[id];

      if (!record) {
        /*
         * 某些版本 pages 可能不是純 id map。
         */
        record =
          Object.values(
            ds.pages
          ).find(
            item =>
              item &&
              String(
                item.id ||
                item.pageId ||
                ""
              ) === id
          );
      }

      if (
        record &&
        !record.pageDesign &&
        create
      ) {
        record.pageDesign = {};
      }

      return (
        record &&
        record.pageDesign
      ) || null;
    }


    function readLegacyStyle(
      page
    ) {
      const node =
        legacyNode(
          page,
          false
        );

      const design =
        pageDesign(
          page,
          false
        );

      const style =
        (
          design &&
          design.titleStyle
        ) ||
        (
          node &&
          node.titleStyle
        ) ||
        {};

      const extension =
        (
          node &&
          node.titleEffects
        ) ||
        (
          design &&
          design.titleEffects
        ) ||
        {};

      return {
        ...style,
        ...extension
      };
    }


    function shadowCss(
      kind,
      color
    ) {
      switch (kind) {
        case "soft":
          return (
            "0 3px 12px " +
            "rgba(0,0,0,.20)"
          );

        case "glow":
          return (
            "0 0 12px " +
            color +
            ",0 0 28px " +
            color
          );

        case "cinema":
          return (
            "0 2px 2px " +
            "rgba(0,0,0,.35)," +
            "0 7px 22px " +
            "rgba(0,0,0,.28)"
          );

        default:
          return "none";
      }
    }


    function writeLegacyStyle(
      page,
      settings
    ) {
      if (!page) {
        return;
      }

      const visualStyle = {
        /*
         * 保留舊版已經存在的其他欄位。
         */
        fontSize:
          settings.fontSize,

        weight:
          settings.weight,

        color:
          settings.color,

        animation:
          settings.enterAnimation ===
          "none"
            ? "none"
            : settings.enterAnimation ===
              "zoom"
              ? "pop"
              : "fade",

        letterSpacing:
          settings.letterSpacing,

        textAlign:
          settings.align,

        textShadow:
          shadowCss(
            settings.shadow,
            settings.color
          )
      };


      const extension = {
        enterAnimation:
          settings.enterAnimation,

        enterDuration:
          settings.enterDuration,

        fadeOut:
          settings.fadeOut,

        fadeStyle:
          settings.fadeStyle,

        holdDuration:
          settings.holdDuration,

        fadeDuration:
          settings.fadeDuration,

        collapseAfterFade:
          settings.collapseAfterFade
      };


      const node =
        legacyNode(
          page,
          true
        );

      if (node) {
        node.titleStyle = {
          ...(
            node.titleStyle ||
            {}
          ),
          ...visualStyle
        };

        node.titleEffects = {
          ...extension
        };
      }


      const design =
        pageDesign(
          page,
          true
        );

      if (design) {
        design.titleStyle = {
          ...(
            design.titleStyle ||
            {}
          ),
          ...visualStyle
        };

        design.titleEffects = {
          ...extension
        };
      }


      /*
       * 某些新核心允許直接把 pageDesign 掛到 page。
       * 這裡只是補一份，不強迫依賴它。
       */
      if (
        page.pageDesign &&
        typeof page.pageDesign ===
          "object"
      ) {
        page.pageDesign.titleStyle = {
          ...(
            page.pageDesign
              .titleStyle ||
            {}
          ),
          ...visualStyle
        };

        page.pageDesign.titleEffects = {
          ...extension
        };
      }


      try {
        if (
          core &&
          typeof core.notifyChange ===
            "function"
        ) {
          core.notifyChange(
            "title-effects-change",
            {
              page
            }
          );
        }
      } catch (error) {}
    }


    // =====================================================
    // ProjectDataCenter
    // =====================================================

    let registered =
      false;

    function registerData() {
      if (
        registered
      ) {
        return true;
      }

      if (
        !window.ProjectDataCenter ||
        typeof ProjectDataCenter
          .register !==
          "function"
      ) {
        return false;
      }

      try {
        ProjectDataCenter.register(
          FEATURE_KEY,
          {
            description:
              "排版工作室章節標題演出：顏色、字級、進場、淡出",

            defaultValue:
              {
                pages: {}
              },

            resetOnMissing:
              true,

            save() {
              return clone(
                state
              );
            },

            load(value) {
              state =
                value &&
                typeof value ===
                  "object"
                  ? {
                      pages:
                        value.pages &&
                        typeof value.pages ===
                          "object"
                          ? value.pages
                          : {}
                    }
                  : {
                      pages: {}
                    };

              getPages()
                .forEach(
                  page => {
                    const id =
                      String(
                        page.id
                      );

                    if (
                      state.pages[id]
                    ) {
                      state.pages[id] =
                        normalizeSettings(
                          state.pages[id]
                        );

                      writeLegacyStyle(
                        page,
                        state.pages[id]
                      );
                    }
                  }
                );

              renderPanel();
            }
          }
        );

        registered =
          true;

        return true;

      } catch (error) {
        console.warn(
          "[Title Effects] ProjectDataCenter",
          error
        );

        return false;
      }
    }


    const registerTimer =
      setInterval(
        () => {
          if (
            registerData()
          ) {
            clearInterval(
              registerTimer
            );
          }
        },
        500
      );


    // =====================================================
    // Reader Transform
    // =====================================================

    function readerPayload() {
      const output =
        {};

      getPages()
        .forEach(
          page => {
            const settings =
              settingsFor(
                page
              );

            writeLegacyStyle(
              page,
              settings
            );

            output[
              String(
                page.id
              )
            ] = {
              ...settings,
              title:
                String(
                  page.title ||
                  ""
                )
            };
          }
        );

      return output;
    }


    function escapeJson(
      value
    ) {
      return JSON.stringify(
        value
      )
        .replace(
          /</g,
          "\\u003c"
        )
        .replace(
          />/g,
          "\\u003e"
        )
        .replace(
          /&/g,
          "\\u0026"
        );
    }


    const removeReaderTransform =
      api.registerReaderTransform(
        "title-effects-reader",

        function(
          html
        ) {
          if (
            typeof html !==
              "string" ||
            html.includes(
              "data-fh-title-effects-runtime"
            )
          ) {
            return html;
          }

          const payload =
            escapeJson(
              readerPayload()
            );

          const css = `
<style data-fh-title-effects-style>
@keyframes fhTitleFadeIn{
  from{opacity:0}
  to{opacity:1}
}
@keyframes fhTitleSlideUp{
  from{opacity:0;transform:translateY(24px)}
  to{opacity:1;transform:translateY(0)}
}
@keyframes fhTitleSlideDown{
  from{opacity:0;transform:translateY(-24px)}
  to{opacity:1;transform:translateY(0)}
}
@keyframes fhTitleZoom{
  from{opacity:0;transform:scale(.82)}
  to{opacity:1;transform:scale(1)}
}
@keyframes fhTitleBlur{
  from{opacity:0;filter:blur(12px)}
  to{opacity:1;filter:blur(0)}
}

.fh-title-enter-fade{
  animation:fhTitleFadeIn var(--fh-title-enter-duration,700ms) ease both!important;
}
.fh-title-enter-slide-up{
  animation:fhTitleSlideUp var(--fh-title-enter-duration,700ms) cubic-bezier(.2,.8,.2,1) both!important;
}
.fh-title-enter-slide-down{
  animation:fhTitleSlideDown var(--fh-title-enter-duration,700ms) cubic-bezier(.2,.8,.2,1) both!important;
}
.fh-title-enter-zoom{
  animation:fhTitleZoom var(--fh-title-enter-duration,700ms) cubic-bezier(.2,.8,.2,1) both!important;
}
.fh-title-enter-blur{
  animation:fhTitleBlur var(--fh-title-enter-duration,700ms) ease both!important;
}

.fh-title-is-fading{
  /*
   * 關鍵：
   * 進場 animation 使用 fill-mode:both，會持續佔住 opacity:1。
   * 淡出開始時必須先解除 animation，transition 才能接管 opacity。
   */
  animation:none!important;
  opacity:0!important;
  transition:
    opacity var(--fh-title-fade-duration,900ms) ease,
    max-height var(--fh-title-fade-duration,900ms) ease,
    margin var(--fh-title-fade-duration,900ms) ease,
    padding var(--fh-title-fade-duration,900ms) ease!important;
}

.fh-title-collapse{
  max-height:0!important;
  overflow:hidden!important;
  margin-top:0!important;
  margin-bottom:0!important;
  padding-top:0!important;
  padding-bottom:0!important;
  pointer-events:none!important;
}

@media(prefers-reduced-motion:reduce){
  .fh-title-enter-fade,
  .fh-title-enter-slide-up,
  .fh-title-enter-slide-down,
  .fh-title-enter-zoom,
  .fh-title-enter-blur{
    animation:none!important;
  }

  .fh-title-is-fading{
    transition:none!important;
  }
}
</style>`;

          const runtime = `
<script type="application/json" id="fh-title-effects-package">${payload}</scr` + `ipt>
<script data-fh-title-effects-runtime>
(function(){
"use strict";

if(window.__fhTitleEffectsRuntimeV1){
  return;
}

window.__fhTitleEffectsRuntimeV1=true;

var config={};

try{
  var packageNode=
    document.getElementById(
      "fh-title-effects-package"
    );

  config=
    packageNode
      ? JSON.parse(
          packageNode.textContent||
          "{}"
        )
      : {};
}catch(error){
  console.warn(
    "[Title Effects] package",
    error
  );
}


var timer=null;
var collapseTimer=null;
var fadeAnimation=null;
var lastPageId="";
var lastAppliedId="";
var lastAppliedNode=null;
var pendingTargetId="";


function titleNode(){
  return (
    document.querySelector(
      "#reader .reader-layout-title"
    ) ||
    document.querySelector(
      "#reader .reader-title"
    ) ||
    document.querySelector(
      ".reader-container .reader-title"
    ) ||
    document.querySelector(
      "#reader h1"
    ) ||
    document.querySelector(
      "#reader h2"
    )
  );
}


function currentPageId(){
  /*
   * 最可靠：由 show(id, push) 直接記錄。
   */
  if(lastPageId && config[lastPageId]){
    return lastPageId;
  }

  /*
   * 相容部分舊 Reader 的全域 currentId。
   */
  try{
    if(
      typeof currentId!=="undefined" &&
      currentId &&
      config[String(currentId)]
    ){
      return String(currentId);
    }
  }catch(_){}

  try{
    if(
      typeof window.currentId!=="undefined" &&
      window.currentId &&
      config[String(window.currentId)]
    ){
      return String(window.currentId);
    }
  }catch(_){}

  /*
   * 最後才用標題文字比對。
   */
  var node=titleNode();

  var text=node
    ? String(node.textContent||"").trim()
    : "";

  if(!text){
    return "";
  }

  var ids=Object.keys(config);

  for(var i=0;i<ids.length;i++){
    if(
      String(config[ids[i]].title||"").trim()===text
    ){
      return ids[i];
    }
  }

  return "";
}


function clearTimers(){
  if(timer){
    clearTimeout(timer);
    timer=null;
  }

  if(collapseTimer){
    clearTimeout(collapseTimer);
    collapseTimer=null;
  }

  if(fadeAnimation){
    try{
      fadeAnimation.cancel();
    }catch(error){}
    fadeAnimation=null;
  }
}


function removeAnimationClasses(
  node
){
  [
    "fh-title-enter-fade",
    "fh-title-enter-slide-up",
    "fh-title-enter-slide-down",
    "fh-title-enter-zoom",
    "fh-title-enter-blur",
    "fh-title-is-fading",
    "fh-title-collapse"
  ].forEach(
    function(name){
      node.classList.remove(name);
    }
  );
}


function shadowValue(
  type,
  color
){
  if(type==="soft"){
    return "0 3px 12px rgba(0,0,0,.20)";
  }

  if(type==="glow"){
    return "0 0 12px "+color+",0 0 28px "+color;
  }

  if(type==="cinema"){
    return "0 2px 2px rgba(0,0,0,.35),0 7px 22px rgba(0,0,0,.28)";
  }

  return "none";
}


function fadeFrames(
  style,
  node
){
  var computed=
    getComputedStyle(node);

  var baseLetter=
    parseFloat(
      computed.letterSpacing
    );

  if(
    !Number.isFinite(
      baseLetter
    )
  ){
    baseLetter=0;
  }

  switch(style){

    case "fade-up":
      return [
        {
          opacity:1,
          transform:"translateY(0)"
        },
        {
          opacity:0,
          transform:"translateY(-32px)"
        }
      ];

    case "fade-down":
      return [
        {
          opacity:1,
          transform:"translateY(0)"
        },
        {
          opacity:0,
          transform:"translateY(32px)"
        }
      ];

    case "shrink":
      return [
        {
          opacity:1,
          transform:"scale(1)"
        },
        {
          opacity:0,
          transform:"scale(.82)"
        }
      ];

    case "expand":
      return [
        {
          opacity:1,
          transform:"scale(1)"
        },
        {
          opacity:0,
          transform:"scale(1.16)"
        }
      ];

    case "blur":
      return [
        {
          opacity:1,
          filter:"blur(0px)"
        },
        {
          opacity:.55,
          filter:"blur(4px)",
          offset:.55
        },
        {
          opacity:0,
          filter:"blur(14px)"
        }
      ];

    case "spread":
      return [
        {
          opacity:1,
          letterSpacing:
            baseLetter+"px"
        },
        {
          opacity:.65,
          letterSpacing:
            (baseLetter+4)+"px",
          offset:.55
        },
        {
          opacity:0,
          letterSpacing:
            (baseLetter+12)+"px"
        }
      ];

    case "cinema":
      return [
        {
          opacity:1,
          transform:
            "translateY(0) scale(1)",
          filter:
            "blur(0px)"
        },
        {
          opacity:.8,
          transform:
            "translateY(-4px) scale(1.015)",
          filter:
            "blur(0px)",
          offset:.38
        },
        {
          opacity:0,
          transform:
            "translateY(-20px) scale(1.04)",
          filter:
            "blur(5px)"
        }
      ];

    default:
      return [
        {
          opacity:1
        },
        {
          opacity:.72,
          offset:.35
        },
        {
          opacity:.28,
          offset:.75
        },
        {
          opacity:0
        }
      ];
  }
}


function runFadeOut(
  node,
  cfg
){
  /*
   * 先解除進場 animation 的 fill-mode。
   */
  [
    "fh-title-enter-fade",
    "fh-title-enter-slide-up",
    "fh-title-enter-slide-down",
    "fh-title-enter-zoom",
    "fh-title-enter-blur"
  ].forEach(
    function(name){
      node.classList.remove(name);
    }
  );

  node.classList.remove(
    "fh-title-is-fading",
    "fh-title-collapse"
  );

  /*
   * WAAPI 可以明確建立 1 → 0 的時間曲線，
   * 不受原 Reader CSS transition / animation 優先序干擾。
   */
  if(
    typeof node.animate===
      "function"
  ){
    try{
      fadeAnimation=
        node.animate(
          fadeFrames(
            cfg.fadeStyle||
            "fade",
            node
          ),
          {
            duration:
              Math.max(
                100,
                Number(
                  cfg.fadeDuration
                )||
                900
              ),
            easing:
              cfg.fadeStyle===
                "cinema"
                ? "cubic-bezier(.22,.61,.36,1)"
                : "ease-in-out",
            fill:
              "forwards"
          }
        );

      fadeAnimation.onfinish=
        function(){
          /*
           * 動畫完成後才把 opacity 固定為 0，
           * 所以中間過程一定會完整播放。
           */
          node.style.opacity=
            "0";

          if(
            cfg.collapseAfterFade
          ){
            node.classList.add(
              "fh-title-collapse"
            );
          }
        };

      return;
    }catch(error){
      console.warn(
        "[Title Effects] WAAPI fade",
        error
      );
    }
  }

  /*
   * 極舊瀏覽器 fallback。
   */
  node.style.transition=
    "opacity "+
    Math.max(
      100,
      Number(
        cfg.fadeDuration
      )||
      900
    )+
    "ms ease-in-out";

  void node.offsetWidth;

  node.style.opacity="0";
}


function apply(explicitId,force){
  var node=titleNode();

  if(!node){
    return;
  }

  var id=
    explicitId
      ? String(explicitId)
      : currentPageId();

  if(id){
    lastPageId=id;
  }

  var cfg=config[id];

  if(!cfg){
    return;
  }

  /*
   * 關鍵修正：
   * Reader 的 typewrite() 會持續改變 DOM。
   * MutationObserver 只可以補抓「新頁/新標題」，
   * 不能每次字被改動就重設淡出計時器。
   */
  if(
    !force &&
    lastAppliedNode===node &&
    lastAppliedId===id
  ){
    return;
  }

  lastAppliedNode=node;
  lastAppliedId=id;

  clearTimers();

  removeAnimationClasses(
    node
  );

  node.style.color=
    cfg.color||
    "#172b3a";

  node.style.fontSize=
    String(
      Number(cfg.fontSize)||
      30
    )+
    "px";

  node.style.fontWeight=
    String(
      Number(cfg.weight)||
      800
    );

  node.style.letterSpacing=
    String(
      Number(cfg.letterSpacing)||
      0
    )+
    "px";

  node.style.textAlign=
    cfg.align||
    "center";

  node.style.textShadow=
    shadowValue(
      cfg.shadow,
      cfg.color||
      "#172b3a"
    );

  node.style.setProperty(
    "--fh-title-enter-duration",
    String(
      Number(cfg.enterDuration)||
      700
    )+
    "ms"
  );

  node.style.setProperty(
    "--fh-title-fade-duration",
    String(
      Number(cfg.fadeDuration)||
      900
    )+
    "ms"
  );


  if(
    cfg.enterAnimation &&
    cfg.enterAnimation!=="none"
  ){
    node.classList.add(
      "fh-title-enter-"+
      cfg.enterAnimation
    );
  }


  if(cfg.fadeOut){
    timer=
      setTimeout(
        function(){
          runFadeOut(
            node,
            cfg
          );
        },
        Math.max(
          0,
          Number(
            cfg.holdDuration
          )||
          0
        )
      );
  }
}


/*
 * 現代 Reader：show() 後重新安排。
 */
try{
  if(
    typeof show==="function" &&
    !show.__fhTitleEffectsWrapped
  ){
    var originalShow=
      show;

    show=function(id){
      clearTimers();

      if(id!=null){
        lastPageId=String(id);
      }

      var result=
        originalShow.apply(
          this,
          arguments
        );

      /*
       * show() 完成 DOM 更新後，直接用真正的 page id 套演出。
       */
      setTimeout(
        function(){
          apply(lastPageId,true);
        },
        0
      );

      /*
       * 某些舊 Reader 會延遲重建標題，再補一次。
       */
      setTimeout(
        function(){
          apply(lastPageId,true);
        },
        60
      );

      return result;
    };

    show.__fhTitleEffectsWrapped=
      true;
  }
}catch(error){}


/*
 * 即使某些 Reader 把 show() 放在封閉作用域，
 * 選項按鈕本身仍有 data-target。
 * 在 capture 階段先記下下一頁 ID，DOM 換頁後由 observer 套用。
 */
document.addEventListener(
  "click",
  function(event){
    var button=
      event.target &&
      event.target.closest
        ? event.target.closest("[data-target]")
        : null;

    if(
      button &&
      button.dataset &&
      button.dataset.target
    ){
      pendingTargetId=
        String(
          button.dataset.target
        );
    }
  },
  true
);


/*
 * 舊版 Reader：監看 #reader 標題重新建立。
 */
var reader=
  document.getElementById(
    "reader"
  );

if(reader){
  var observer=
    new MutationObserver(
      function(){
        /*
         * 不 force。
         * 同一頁 typewriter 引起的 DOM 變動會被 apply() 忽略。
         */
        setTimeout(
          function(){
            apply(
              pendingTargetId ||
              lastPageId ||
              "",
              false
            );

            pendingTargetId="";
          },
          0
        );
      }
    );

  observer.observe(
    reader,
    {
      childList:true,
      subtree:true
    }
  );
}


/*
 * 第一頁通常在外掛 Runtime 載入前已經 show() 完成，
 * 因此用標題文字/目前 ID 補抓。
 */
[0,80,300].forEach(
  function(delay){
    setTimeout(
      function(){
        apply(
          lastPageId || "",
          delay===0
        );
      },
      delay
    );
  }
);


window.FirehahaTitleEffectsRuntime={
  version:"1.4.0",
  apply:apply,
  config:config,
  getCurrentPageId:function(){
    return currentPageId();
  }
};

})();
</scr` + `ipt>`;

          return html
            .replace(
              /<\/head\s*>/i,
              css +
              "\n</head>"
            )
            .replace(
              /<\/body\s*>/i,
              runtime +
              "\n</body>"
            );
        },

        760
      );


    // =====================================================
    // 編輯器預覽
    // =====================================================

    function previewElement() {
      /*
       * 第一優先使用本插件視窗內的預覽標題。
       * 避免排版工作室在面板後面被遮住，看起來像「沒反應」。
       */
      return (
        panel?.querySelector(
          "[data-live-preview-title]"
        ) ||
        document.querySelector(
          ".rls-title"
        ) ||
        document.querySelector(
          ".core-preview-title"
        ) ||
        document.querySelector(
          "#htmlIntegratedPreview h1"
        ) ||
        document.querySelector(
          "#htmlIntegratedPreview h2"
        ) ||
        null
      );
    }


    let previewTimer =
      null;

    let previewFadeAnimation =
      null;


    function previewFadeFrames(
      style,
      element
    ) {
      const computed =
        getComputedStyle(
          element
        );

      let letter =
        parseFloat(
          computed.letterSpacing
        );

      if (
        !Number.isFinite(
          letter
        )
      ) {
        letter =
          0;
      }


      switch (style) {
        case "fade-up":
          return [
            {
              opacity: 1,
              transform:
                "translateY(0)"
            },
            {
              opacity: 0,
              transform:
                "translateY(-32px)"
            }
          ];

        case "fade-down":
          return [
            {
              opacity: 1,
              transform:
                "translateY(0)"
            },
            {
              opacity: 0,
              transform:
                "translateY(32px)"
            }
          ];

        case "shrink":
          return [
            {
              opacity: 1,
              transform:
                "scale(1)"
            },
            {
              opacity: 0,
              transform:
                "scale(.82)"
            }
          ];

        case "expand":
          return [
            {
              opacity: 1,
              transform:
                "scale(1)"
            },
            {
              opacity: 0,
              transform:
                "scale(1.16)"
            }
          ];

        case "blur":
          return [
            {
              opacity: 1,
              filter:
                "blur(0px)"
            },
            {
              opacity: .55,
              filter:
                "blur(4px)",
              offset: .55
            },
            {
              opacity: 0,
              filter:
                "blur(14px)"
            }
          ];

        case "spread":
          return [
            {
              opacity: 1,
              letterSpacing:
                letter +
                "px"
            },
            {
              opacity: .65,
              letterSpacing:
                (
                  letter +
                  4
                ) +
                "px",
              offset: .55
            },
            {
              opacity: 0,
              letterSpacing:
                (
                  letter +
                  12
                ) +
                "px"
            }
          ];

        case "cinema":
          return [
            {
              opacity: 1,
              transform:
                "translateY(0) scale(1)",
              filter:
                "blur(0px)"
            },
            {
              opacity: .8,
              transform:
                "translateY(-4px) scale(1.015)",
              filter:
                "blur(0px)",
              offset: .38
            },
            {
              opacity: 0,
              transform:
                "translateY(-20px) scale(1.04)",
              filter:
                "blur(5px)"
            }
          ];

        default:
          return [
            {
              opacity: 1
            },
            {
              opacity: .72,
              offset: .35
            },
            {
              opacity: .28,
              offset: .75
            },
            {
              opacity: 0
            }
          ];
      }
    }


    function applyPreview(
      settings
    ) {
      const element =
        previewElement();

      if (!element) {
        return;
      }

      if (
        previewTimer
      ) {
        clearTimeout(
          previewTimer
        );
      }

      if (
        previewFadeAnimation
      ) {
        try {
          previewFadeAnimation
            .cancel();
        } catch (error) {}

        previewFadeAnimation =
          null;
      }

      element.style.color =
        settings.color;

      element.style.fontSize =
        settings.fontSize +
        "px";

      element.style.fontWeight =
        settings.weight;

      element.style.letterSpacing =
        settings.letterSpacing +
        "px";

      element.style.textAlign =
        settings.align;

      element.style.textShadow =
        shadowCss(
          settings.shadow,
          settings.color
        );

      if (
        typeof element.getAnimations ===
          "function"
      ) {
        element.getAnimations()
          .forEach(
            animation =>
              animation.cancel()
          );
      }

      element.style.opacity =
        "1";

      element.style.maxHeight =
        "";

      element.style.margin =
        "";

      element.style.padding =
        "";

      element.style.transition =
        "none";

      element.style.transform =
        "";

      element.style.filter =
        "";

      /*
       * 強制一次 layout，讓連續按「預覽」時動畫可重新開始。
       */
      void element.offsetWidth;

      /*
       * 小型進場預覽。
       */
      const duration =
        settings.enterDuration;

      const keyframes = {
        fade: [
          {
            opacity: 0
          },
          {
            opacity: 1
          }
        ],

        "slide-up": [
          {
            opacity: 0,
            transform:
              "translateY(24px)"
          },
          {
            opacity: 1,
            transform:
              "translateY(0)"
          }
        ],

        "slide-down": [
          {
            opacity: 0,
            transform:
              "translateY(-24px)"
          },
          {
            opacity: 1,
            transform:
              "translateY(0)"
          }
        ],

        zoom: [
          {
            opacity: 0,
            transform:
              "scale(.82)"
          },
          {
            opacity: 1,
            transform:
              "scale(1)"
          }
        ],

        blur: [
          {
            opacity: 0,
            filter:
              "blur(12px)"
          },
          {
            opacity: 1,
            filter:
              "blur(0)"
          }
        ]
      };


      if (
        settings.enterAnimation !==
          "none" &&
        typeof element.animate ===
          "function"
      ) {
        element.animate(
          keyframes[
            settings.enterAnimation
          ] ||
          keyframes.fade,
          {
            duration,
            easing:
              "ease",
            fill:
              "both"
          }
        );
      }


      if (
        settings.fadeOut
      ) {
        previewTimer =
          setTimeout(
            () => {
              if (
                typeof element.getAnimations ===
                  "function"
              ) {
                element.getAnimations()
                  .forEach(
                    animation =>
                      animation.cancel()
                  );
              }

              element.style.opacity =
                "1";

              element.style.transform =
                "";

              element.style.filter =
                "";

              if (
                typeof element.animate ===
                  "function"
              ) {
                previewFadeAnimation =
                  element.animate(
                    previewFadeFrames(
                      settings.fadeStyle ||
                      "fade",
                      element
                    ),
                    {
                      duration:
                        Math.max(
                          100,
                          Number(
                            settings.fadeDuration
                          ) ||
                          900
                        ),
                      easing:
                        settings.fadeStyle ===
                          "cinema"
                          ? "cubic-bezier(.22,.61,.36,1)"
                          : "ease-in-out",
                      fill:
                        "forwards"
                    }
                  );

                previewFadeAnimation.onfinish =
                  () => {
                    element.style.opacity =
                      "0";

                    if (
                      settings.collapseAfterFade
                    ) {
                      element.style.maxHeight =
                        "0";

                      element.style.margin =
                        "0";

                      element.style.padding =
                        "0";

                      element.style.overflow =
                        "hidden";
                    }
                  };

              } else {
                element.style.transition =
                  (
                    "opacity " +
                    settings.fadeDuration +
                    "ms ease-in-out"
                  );

                element.style.opacity =
                  "0";
              }
            },
            settings.holdDuration
          );
      }
    }


    // =====================================================
    // UI
    // =====================================================

    let panel =
      null;

    let openButton =
      null;


    function controlHtml() {
      return `
<div class="fh-title-effects-grid">

  <label>
    標題顏色
    <input type="color" data-key="color">
  </label>

  <label>
    字體大小
    <div class="fh-title-number">
      <input type="range" min="12" max="96" step="1" data-key="fontSize">
      <output data-output="fontSize"></output>
    </div>
  </label>

  <label>
    字重
    <select data-key="weight">
      <option value="300">細</option>
      <option value="400">一般</option>
      <option value="500">中等</option>
      <option value="600">半粗</option>
      <option value="700">粗體</option>
      <option value="800">特粗</option>
      <option value="900">黑體</option>
    </select>
  </label>

  <label>
    字距
    <div class="fh-title-number">
      <input type="range" min="-3" max="16" step=".5" data-key="letterSpacing">
      <output data-output="letterSpacing"></output>
    </div>
  </label>

  <label>
    對齊
    <select data-key="align">
      <option value="left">靠左</option>
      <option value="center">置中</option>
      <option value="right">靠右</option>
    </select>
  </label>

  <label>
    標題陰影
    <select data-key="shadow">
      <option value="none">無</option>
      <option value="soft">柔和陰影</option>
      <option value="glow">發光</option>
      <option value="cinema">電影陰影</option>
    </select>
  </label>

  <label>
    進場動畫
    <select data-key="enterAnimation">
      <option value="none">無</option>
      <option value="fade">淡入</option>
      <option value="slide-up">由下浮入</option>
      <option value="slide-down">由上落入</option>
      <option value="zoom">縮放出現</option>
      <option value="blur">模糊聚焦</option>
    </select>
  </label>

  <label>
    進場時間
    <div class="fh-title-number">
      <input type="range" min="0" max="3000" step="100" data-key="enterDuration">
      <output data-output="enterDuration"></output>
    </div>
  </label>

</div>

<div class="fh-title-fade-box">
  <label class="fh-title-check">
    <input type="checkbox" data-key="fadeOut">
    <strong>章節標題停留後自動淡出</strong>
  </label>

  <div class="fh-title-effects-grid" data-fade-controls>

    <label>
      淡出樣式
      <select data-key="fadeStyle">
        <option value="fade">柔和漸隱</option>
        <option value="fade-up">向上飄散</option>
        <option value="fade-down">向下沉沒</option>
        <option value="shrink">縮小消失</option>
        <option value="expand">放大消失</option>
        <option value="blur">模糊消散</option>
        <option value="spread">字距拉開</option>
        <option value="cinema">電影式退場</option>
      </select>
    </label>

    <label>
      停留多久
      <div class="fh-title-number">
        <input type="range" min="0" max="10000" step="100" data-key="holdDuration">
        <output data-output="holdDuration"></output>
      </div>
    </label>

    <label>
      淡出時間
      <div class="fh-title-number">
        <input type="range" min="100" max="5000" step="100" data-key="fadeDuration">
        <output data-output="fadeDuration"></output>
      </div>
    </label>

    <label class="fh-title-check">
      <input type="checkbox" data-key="collapseAfterFade">
      淡出後收起標題空間
    </label>
  </div>
</div>
`;
    }


    function buildPanel() {
      const root =
        document.createElement(
          "div"
        );

      root.id =
        PANEL_ID;

      root.innerHTML = `
<div class="fh-title-effects-dialog">

  <div class="fh-title-effects-head">
    <div>
      <strong>🎬 章節標題演出</strong>
      <small data-current-title></small>
    </div>

    <div>
      <button type="button" data-preview>▶ 預覽</button>
      <button type="button" data-close>✕ 關閉</button>
    </div>
  </div>

  <div class="fh-title-effects-body">

    <div class="fh-title-live-preview">
      <div class="fh-title-live-preview-label">即時預覽</div>
      <div data-live-preview-title>章節標題預覽</div>
    </div>

    <p class="fh-title-effects-note">
      此設定會同步到目前排版工作室的 titleStyle，也會同步舊版核心 readerExperience.nodes[].titleStyle。
    </p>

    ${controlHtml()}

    <div class="fh-title-actions">
      <button type="button" data-reset>重設本頁</button>
      <button type="button" data-copy-all>套用到全部章節</button>
    </div>

  </div>
</div>
`;

      document.body
        .appendChild(
          root
        );


      root.querySelector(
        "[data-close]"
      ).onclick =
        () =>
          root.classList
            .remove(
              "open"
            );


      root.querySelector(
        "[data-preview]"
      ).onclick =
        () => {
          const page =
            currentPage();

          if (!page) {
            return;
          }

          applyPreview(
            settingsFor(
              page
            )
          );
        };


      root.querySelector(
        "[data-reset]"
      ).onclick =
        () => {
          const page =
            currentPage();

          if (!page) {
            return;
          }

          state.pages[
            String(
              page.id
            )
          ] = clone(
            defaults
          );

          writeLegacyStyle(
            page,
            state.pages[
              String(
                page.id
              )
            ]
          );

          renderPanel();

          api.toast(
            "已重設目前章節標題樣式"
          );
        };


      root.querySelector(
        "[data-copy-all]"
      ).onclick =
        () => {
          const page =
            currentPage();

          if (!page) {
            return;
          }

          if (
            !confirm(
              "將目前章節的標題樣式與淡出演出套用到全部 Node？"
            )
          ) {
            return;
          }

          const source =
            clone(
              settingsFor(
                page
              )
            );

          getPages()
            .forEach(
              target => {
                state.pages[
                  String(
                    target.id
                  )
                ] =
                  clone(
                    source
                  );

                writeLegacyStyle(
                  target,
                  state.pages[
                    String(
                      target.id
                    )
                  ]
                );
              }
            );

          renderPanel();

          api.toast(
            "已套用到全部章節"
          );
        };


      root.querySelectorAll(
        "[data-key]"
      ).forEach(
        input => {
          const handler =
            () => {
              const page =
                currentPage();

              if (!page) {
                return;
              }

              const settings =
                settingsFor(
                  page
                );

              const key =
                input.dataset.key;

              if (
                input.type ===
                  "checkbox"
              ) {
                settings[key] =
                  input.checked;

              } else if (
                input.type ===
                  "range" ||
                input.type ===
                  "number"
              ) {
                settings[key] =
                  Number(
                    input.value
                  );

              } else {
                settings[key] =
                  input.value;
              }

              state.pages[
                String(
                  page.id
                )
              ] =
                normalizeSettings(
                  settings
                );

              writeLegacyStyle(
                page,
                state.pages[
                  String(
                    page.id
                  )
                ]
              );

              updateOutputs(
                root,
                state.pages[
                  String(
                    page.id
                  )
                ]
              );

              applyPreview(
                state.pages[
                  String(
                    page.id
                  )
                ]
              );
            };

          input.addEventListener(
            "input",
            handler
          );

          input.addEventListener(
            "change",
            handler
          );
        }
      );


      return root;
    }


    function updateOutputs(
      root,
      settings
    ) {
      const map = {
        fontSize:
          settings.fontSize +
          "px",

        letterSpacing:
          settings.letterSpacing +
          "px",

        enterDuration:
          (
            settings.enterDuration /
            1000
          ).toFixed(1) +
          "s",

        holdDuration:
          (
            settings.holdDuration /
            1000
          ).toFixed(1) +
          "s",

        fadeDuration:
          (
            settings.fadeDuration /
            1000
          ).toFixed(1) +
          "s"
      };


      Object.entries(map)
        .forEach(
          (
            [
              key,
              label
            ]
          ) => {
            const output =
              root.querySelector(
                `[data-output="${key}"]`
              );

            if (output) {
              output.textContent =
                label;
            }
          }
        );


      const fadeControls =
        root.querySelector(
          "[data-fade-controls]"
        );

      if (fadeControls) {
        fadeControls.classList.toggle(
          "disabled",
          !settings.fadeOut
        );
      }
    }


    function bindValues(
      root,
      settings
    ) {
      root.querySelectorAll(
        "[data-key]"
      ).forEach(
        input => {
          const key =
            input.dataset.key;

          if (
            !(key in settings)
          ) {
            return;
          }

          if (
            input.type ===
              "checkbox"
          ) {
            input.checked =
              !!settings[key];

          } else {
            input.value =
              settings[key];
          }
        }
      );

      updateOutputs(
        root,
        settings
      );
    }


    function renderPanel() {
      if (!panel) {
        return;
      }

      const page =
        currentPage();

      const titleBox =
        panel.querySelector(
          "[data-current-title]"
        );

      if (!page) {
        titleBox.textContent =
          "目前沒有選取 Node";

        return;
      }

      titleBox.textContent =
        (
          page.title ||
          "未命名章節"
        );

      const livePreview =
        panel.querySelector(
          "[data-live-preview-title]"
        );

      if (livePreview) {
        livePreview.textContent =
          page.title ||
          "章節標題預覽";
      }

      const settings =
        settingsFor(
          page
        );

      writeLegacyStyle(
        page,
        settings
      );

      bindValues(
        panel,
        settings
      );
    }


    function openPanel() {
      renderPanel();

      panel.classList.add(
        "open"
      );
    }


    panel =
      buildPanel();


    // =====================================================
    // 排版工作室內直接插入控制區
    // =====================================================

    function studioHost() {
      return (
        document.querySelector(
          ".rls-window"
        ) ||
        document.querySelector(
          ".rls-panel"
        ) ||
        document.querySelector(
          "#readerLayoutStudio"
        )
      );
    }


    function attachToStudio() {
      const host =
        studioHost();

      if (!host) {
        return;
      }

      if (
        host.querySelector(
          "." +
          STUDIO_BLOCK_CLASS
        )
      ) {
        return;
      }

      const block =
        document.createElement(
          "section"
        );

      block.className =
        STUDIO_BLOCK_CLASS;

      block.innerHTML = `
<strong>🎬 章節標題演出</strong>
<span>
  顏色、字級、進場與「停留後淡出」。
  同步新／舊核心排版資料。
</span>
<button type="button">開啟標題演出</button>
`;

      block.querySelector(
        "button"
      ).onclick =
        openPanel;


      const side =
        host.querySelector(
          ".rls-side"
        ) ||
        host.querySelector(
          ".rls-panel"
        ) ||
        host;

      side.appendChild(
        block
      );
    }


    const studioObserver =
      new MutationObserver(
        () => {
          attachToStudio();
        }
      );

    studioObserver.observe(
      document.body,
      {
        childList:
          true,
        subtree:
          true
      }
    );


    attachToStudio();


    // =====================================================
    // Header 工具
    // =====================================================

    const header =
      document.querySelector(
        ".pixiv-editor-container header, header"
      );


    if (
      header &&
      !document.getElementById(
        BUTTON_ID
      )
    ) {
      openButton =
        document.createElement(
          "button"
        );

      openButton.id =
        BUTTON_ID;

      openButton.type =
        "button";

      openButton.textContent =
        "🎬 標題演出";

      openButton.onclick =
        openPanel;

      header.appendChild(
        openButton
      );
    }


    // =====================================================
    // Page change
    // =====================================================

    const pageChange =
      () => {
        if (
          panel.classList
            .contains(
              "open"
            )
        ) {
          renderPanel();
        }
      };


    let unsubscribe =
      null;

    try {
      if (
        core &&
        typeof core.on ===
          "function"
      ) {
        unsubscribe =
          core.on(
            "page:selected",
            pageChange
          );
      }
    } catch (error) {}


    document.addEventListener(
      "gamebook:page:selected",
      pageChange
    );


    // =====================================================
    // CSS
    // =====================================================

    const removeStyle =
      api.addStyle(
        "title-effects-editor",
        `
#${PANEL_ID}{
  position:fixed;
  inset:0;
  z-index:2147482700;
  display:none;
  align-items:center;
  justify-content:center;
  padding:
    max(12px,env(safe-area-inset-top))
    max(12px,env(safe-area-inset-right))
    max(12px,env(safe-area-inset-bottom))
    max(12px,env(safe-area-inset-left));
  background:rgba(15,20,25,.60);
  font-family:system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;
}

#${PANEL_ID}.open{
  display:flex;
}

#${PANEL_ID} *{
  box-sizing:border-box;
}

.fh-title-effects-dialog{
  width:min(780px,96vw);
  max-height:90dvh;
  display:flex;
  flex-direction:column;
  overflow:hidden;
  border-radius:18px;
  background:#fff;
  color:#263238;
  box-shadow:0 24px 80px rgba(0,0,0,.42);
}

.fh-title-effects-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  padding:13px 15px;
  background:#263238;
  color:#fff;
}

.fh-title-effects-head>div:first-child{
  min-width:0;
}

.fh-title-effects-head strong{
  display:block;
  font-size:17px;
}

.fh-title-effects-head small{
  display:block;
  margin-top:2px;
  opacity:.75;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.fh-title-effects-head>div:last-child{
  display:flex;
  gap:6px;
}

.fh-title-effects-body{
  overflow:auto;
  padding:14px;
}

.fh-title-live-preview{
  position:relative;
  min-height:150px;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
  margin-bottom:12px;
  padding:22px;
  border:1px solid #d9e1e6;
  border-radius:14px;
  background:
    linear-gradient(180deg,#f9fbfd,#eef4f8);
}

.fh-title-live-preview-label{
  position:absolute;
  top:8px;
  left:10px;
  padding:3px 7px;
  border-radius:999px;
  background:#dfeaf1;
  color:#526b79;
  font-size:10px;
  font-weight:700;
}

[data-live-preview-title]{
  width:100%;
  text-align:center;
  line-height:1.35;
  overflow:hidden;
  will-change:opacity,transform,filter;
}

.fh-title-effects-note{
  margin:0 0 13px;
  padding:9px 11px;
  border-radius:10px;
  background:#eef7ff;
  color:#456276;
  font-size:12px;
}

.fh-title-effects-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px;
}

.fh-title-effects-grid>label{
  display:grid;
  gap:5px;
  padding:9px;
  border:1px solid #e0e5e9;
  border-radius:10px;
  background:#fafbfc;
  font-size:12px;
  font-weight:700;
}

.fh-title-effects-grid input,
.fh-title-effects-grid select{
  width:100%;
}

.fh-title-number{
  display:grid;
  grid-template-columns:minmax(0,1fr) 58px;
  align-items:center;
  gap:7px;
}

.fh-title-number output{
  text-align:right;
  font-weight:800;
  color:#32698b;
}

.fh-title-fade-box{
  margin-top:12px;
  padding:12px;
  border:1px solid #e6d6af;
  border-radius:12px;
  background:#fffaf0;
}

.fh-title-check{
  display:flex!important;
  grid-template-columns:none!important;
  flex-direction:row!important;
  align-items:center;
  gap:7px!important;
}

.fh-title-check input{
  width:auto!important;
}

[data-fade-controls].disabled{
  margin-top:8px;
  opacity:.45;
  pointer-events:none;
}

.fh-title-actions{
  display:flex;
  gap:7px;
  flex-wrap:wrap;
  margin-top:13px;
}

.${STUDIO_BLOCK_CLASS}{
  display:flex;
  flex-direction:column;
  gap:5px;
  margin-top:12px;
  padding:10px;
  border:1px solid #a9cbe1;
  border-radius:10px;
  background:#eef8ff;
  color:#35586e;
}

.${STUDIO_BLOCK_CLASS}>span{
  font-size:11px;
  line-height:1.5;
}

.${STUDIO_BLOCK_CLASS}>button{
  margin-top:3px;
}

@media(max-width:650px){
  #${PANEL_ID}{
    padding:0;
  }

  .fh-title-effects-dialog{
    width:100vw;
    height:100dvh;
    max-height:none;
    border-radius:0;
  }

  .fh-title-effects-head{
    position:sticky;
    top:0;
    z-index:3;
    padding-top:
      max(
        10px,
        env(safe-area-inset-top)
      );
  }

  .fh-title-effects-grid{
    grid-template-columns:1fr;
  }

  .fh-title-effects-head button{
    padding:7px 8px!important;
    font-size:12px!important;
  }
}
`
      );


    // =====================================================
    // Public API
    // =====================================================

    window.FirehahaTitleEffects = {
      version:
        "1.4.0",

      open:
        openPanel,

      get(
        pageId
      ) {
        const page =
          getPages().find(
            item =>
              String(
                item.id
              ) ===
              String(
                pageId
              )
          );

        return page
          ? clone(
              settingsFor(
                page
              )
            )
          : null;
      },

      set(
        pageId,
        value
      ) {
        const page =
          getPages().find(
            item =>
              String(
                item.id
              ) ===
              String(
                pageId
              )
          );

        if (!page) {
          return false;
        }

        state.pages[
          String(
            page.id
          )
        ] =
          normalizeSettings(
            value
          );

        writeLegacyStyle(
          page,
          state.pages[
            String(
              page.id
            )
          ]
        );

        renderPanel();

        return true;
      },

      applyToAll(
        value
      ) {
        const normalized =
          normalizeSettings(
            value
          );

        getPages()
          .forEach(
            page => {
              state.pages[
                String(
                  page.id
                )
              ] =
                clone(
                  normalized
                );

              writeLegacyStyle(
                page,
                state.pages[
                  String(
                    page.id
                  )
                ]
              );
            }
          );
      }
    };


    api.toast(
      "章節標題演出 V1.4 已啟用：新增多種漸變退場動畫"
    );


    return function cleanup() {
      clearInterval(
        registerTimer
      );

      if (
        previewTimer
      ) {
        clearTimeout(
          previewTimer
        );
      }

      studioObserver.disconnect();

      try {
        unsubscribe?.();
      } catch (error) {}

      document.removeEventListener(
        "gamebook:page:selected",
        pageChange
      );

      removeReaderTransform();
      removeStyle();

      openButton?.remove();
      panel?.remove();

      document.querySelectorAll(
        "." +
        STUDIO_BLOCK_CLASS
      ).forEach(
        item =>
          item.remove()
      );

      delete window
        .FirehahaTitleEffects;
    };
  }
});
