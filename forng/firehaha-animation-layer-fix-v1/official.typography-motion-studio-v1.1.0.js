// @firehaha-plugin {"id":"official.typography-motion-studio","name":"文字演出工作室 Typography Studio","version":"1.1.0","author":"Firehaha","description":"文字演出工作室。V1.1 將內文動畫改為文字專用層，排除 img/video/audio/canvas 等媒體，避免與圖片演出插件互相搶動畫控制權。"}

FirehahaPlugins.register({
  id: "official.typography-motion-studio",
  name: "文字演出工作室 Typography Studio",
  version: "1.1.0",

  async setup(api) {
    "use strict";

    const FEATURE_KEY = "typographyMotionStudioV1";
    const PANEL_ID = "fh-typography-motion-panel";
    const BUTTON_ID = "fh-typography-motion-open";
    const STUDIO_BLOCK_CLASS = "fh-typography-motion-studio-block";

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    const startedAt = Date.now();
    while (!window.GamebookCore && Date.now() - startedAt < 12000) {
      await sleep(80);
    }

    const core = window.GamebookCore || null;

    function getPages() {
      if (core && Array.isArray(core.pages)) return core.pages;

      try {
        if (typeof pages !== "undefined" && Array.isArray(pages)) return pages;
      } catch (_) {}

      return [];
    }

    function getCurrentPage() {
      if (core && core.currentPage) return core.currentPage;

      try {
        if (typeof currentPage !== "undefined" && currentPage) return currentPage;
      } catch (_) {}

      return getPages()[0] || null;
    }

    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function clamp(value, min, max, fallback) {
      const n = Number(value);
      return Number.isFinite(n)
        ? Math.min(max, Math.max(min, n))
        : fallback;
    }

    // =====================================================
    // 字體樣板
    // 不夾帶字型檔，只用 OS / generic fallback。
    // =====================================================

    const FONT_PRESETS = {
      modern: {
        label: "現代黑體",
        stack: 'system-ui,-apple-system,"Segoe UI","Noto Sans TC","Noto Sans JP",sans-serif'
      },
      novel: {
        label: "小說明體",
        stack: '"Hiragino Mincho ProN","Yu Mincho","YuMincho","Noto Serif TC","Noto Serif JP",serif'
      },
      elegant: {
        label: "優雅襯線",
        stack: 'Georgia,"Times New Roman","Noto Serif TC",serif'
      },
      retro: {
        label: "復古印刷",
        stack: '"Noto Serif TC","PMingLiU","MingLiU",serif'
      },
      gameui: {
        label: "遊戲 UI",
        stack: 'system-ui,"Arial Rounded MT Bold","Noto Sans TC",sans-serif'
      },
      terminal: {
        label: "等寬終端",
        stack: '"SFMono-Regular",Consolas,"Liberation Mono","Noto Sans Mono",monospace'
      },
      handwritten: {
        label: "手寫感",
        stack: '"Comic Sans MS","Segoe Print","Bradley Hand",cursive'
      },
      classic: {
        label: "古典書籍",
        stack: 'Palatino,"Palatino Linotype","Book Antiqua","Noto Serif TC",serif'
      }
    };

    const PRESETS = {
      calmNovel: {
        label: "📖 安靜小說",
        title: { fontPreset:"novel", color:"#24323b", fontSize:32, weight:700, letterSpacing:1, lineHeight:1.4, enter:"fade", enterDuration:800, idle:"none", idleSpeed:4000, idleAmount:1 },
        body:  { fontPreset:"novel", color:"#2c3033", fontSize:18, weight:400, letterSpacing:.4, lineHeight:1.9, enter:"fade", enterDuration:650, idle:"none", idleSpeed:4000, idleAmount:1 },
        choice:{ fontPreset:"modern", color:"#22313b", fontSize:16, weight:700, letterSpacing:.2, lineHeight:1.5, enter:"slide-up", enterDuration:500, idle:"none", idleSpeed:4000, idleAmount:1 }
      },
      rpg: {
        label: "⚔ RPG 對話",
        title: { fontPreset:"gameui", color:"#1f2b35", fontSize:34, weight:900, letterSpacing:1.5, lineHeight:1.3, enter:"zoom", enterDuration:520, idle:"pulse", idleSpeed:2500, idleAmount:1 },
        body:  { fontPreset:"modern", color:"#263238", fontSize:18, weight:500, letterSpacing:.2, lineHeight:1.75, enter:"slide-up", enterDuration:450, idle:"none", idleSpeed:4000, idleAmount:1 },
        choice:{ fontPreset:"gameui", color:"#263238", fontSize:16, weight:800, letterSpacing:.5, lineHeight:1.45, enter:"slide-left", enterDuration:450, idle:"breathe", idleSpeed:2500, idleAmount:1 }
      },
      horror: {
        label: "🕯 恐怖低語",
        title: { fontPreset:"novel", color:"#4d2626", fontSize:32, weight:600, letterSpacing:3, lineHeight:1.4, enter:"blur", enterDuration:1100, idle:"drift", idleSpeed:4200, idleAmount:1.2 },
        body:  { fontPreset:"novel", color:"#302727", fontSize:18, weight:400, letterSpacing:1, lineHeight:1.95, enter:"fade", enterDuration:900, idle:"breathe", idleSpeed:5000, idleAmount:.7 },
        choice:{ fontPreset:"novel", color:"#5a3030", fontSize:16, weight:600, letterSpacing:1.3, lineHeight:1.5, enter:"blur", enterDuration:800, idle:"tremble", idleSpeed:900, idleAmount:.6 }
      },
      dream: {
        label: "☁ 夢境",
        title: { fontPreset:"elegant", color:"#52506b", fontSize:34, weight:600, letterSpacing:2.5, lineHeight:1.4, enter:"blur", enterDuration:1200, idle:"float", idleSpeed:5000, idleAmount:1.2 },
        body:  { fontPreset:"elegant", color:"#4a4958", fontSize:18, weight:400, letterSpacing:.8, lineHeight:1.95, enter:"fade", enterDuration:1100, idle:"drift", idleSpeed:6000, idleAmount:.8 },
        choice:{ fontPreset:"elegant", color:"#55516e", fontSize:16, weight:600, letterSpacing:1, lineHeight:1.5, enter:"fade", enterDuration:900, idle:"glow", idleSpeed:4500, idleAmount:1 }
      },
      terminal: {
        label: "💻 系統終端",
        title: { fontPreset:"terminal", color:"#1f4530", fontSize:28, weight:800, letterSpacing:1, lineHeight:1.35, enter:"type-fade", enterDuration:600, idle:"pulse", idleSpeed:1800, idleAmount:.8 },
        body:  { fontPreset:"terminal", color:"#21392c", fontSize:16, weight:500, letterSpacing:.3, lineHeight:1.7, enter:"type-fade", enterDuration:700, idle:"none", idleSpeed:4000, idleAmount:1 },
        choice:{ fontPreset:"terminal", color:"#18492f", fontSize:15, weight:700, letterSpacing:.5, lineHeight:1.4, enter:"slide-left", enterDuration:350, idle:"glow", idleSpeed:2500, idleAmount:.8 }
      },
      print: {
        label: "📰 復古 Gamebook",
        title: { fontPreset:"retro", color:"#2c2925", fontSize:30, weight:800, letterSpacing:.5, lineHeight:1.35, enter:"fade", enterDuration:500, idle:"none", idleSpeed:4000, idleAmount:1 },
        body:  { fontPreset:"classic", color:"#2a2926", fontSize:18, weight:400, letterSpacing:.2, lineHeight:1.85, enter:"fade", enterDuration:450, idle:"none", idleSpeed:4000, idleAmount:1 },
        choice:{ fontPreset:"classic", color:"#242320", fontSize:16, weight:700, letterSpacing:.2, lineHeight:1.45, enter:"fade", enterDuration:350, idle:"none", idleSpeed:4000, idleAmount:1 }
      }
    };

    const defaults = clone(PRESETS.calmNovel);

    let state = {
      version: 1,
      global: clone(defaults),
      pages: {}
    };

    function normalizeTarget(source, fallback) {
      const base = fallback || {};
      const input = source && typeof source === "object" ? source : {};

      return {
        fontPreset: FONT_PRESETS[input.fontPreset] ? input.fontPreset : (base.fontPreset || "modern"),
        color: /^#[0-9a-f]{6}$/i.test(String(input.color || "")) ? input.color : (base.color || "#263238"),
        fontSize: clamp(input.fontSize, 10, 96, base.fontSize || 18),
        weight: clamp(input.weight, 100, 900, base.weight || 400),
        letterSpacing: clamp(input.letterSpacing, -3, 16, base.letterSpacing || 0),
        lineHeight: clamp(input.lineHeight, 1, 3, base.lineHeight || 1.7),

        enter: [
          "none","fade","slide-up","slide-down","slide-left","slide-right",
          "zoom","blur","type-fade","reveal"
        ].includes(input.enter) ? input.enter : (base.enter || "fade"),

        enterDuration: clamp(input.enterDuration, 0, 5000, base.enterDuration || 600),

        idle: [
          "none","breathe","sway","float","drift","tremble","pulse","glow"
        ].includes(input.idle) ? input.idle : (base.idle || "none"),

        idleSpeed: clamp(input.idleSpeed, 400, 12000, base.idleSpeed || 4000),
        idleAmount: clamp(input.idleAmount, .1, 3, base.idleAmount || 1)
      };
    }

    function normalizeState(value) {
      const src = value && typeof value === "object" ? value : {};
      const global = src.global && typeof src.global === "object" ? src.global : {};

      const output = {
        version: 1,
        global: {
          title: normalizeTarget(global.title, defaults.title),
          body: normalizeTarget(global.body, defaults.body),
          choice: normalizeTarget(global.choice, defaults.choice)
        },
        pages: {}
      };

      if (src.pages && typeof src.pages === "object") {
        Object.entries(src.pages).forEach(([pageId, record]) => {
          if (!record || typeof record !== "object") return;

          output.pages[pageId] = {
            enabled: record.enabled !== false,
            title: normalizeTarget(record.title, output.global.title),
            body: normalizeTarget(record.body, output.global.body),
            choice: normalizeTarget(record.choice, output.global.choice)
          };
        });
      }

      return output;
    }

    function settingsForPage(page) {
      if (!page) {
        return {
          enabled: true,
          title: clone(state.global.title),
          body: clone(state.global.body),
          choice: clone(state.global.choice)
        };
      }

      const id = String(page.id);

      if (!state.pages[id]) {
        state.pages[id] = {
          enabled: true,
          title: clone(state.global.title),
          body: clone(state.global.body),
          choice: clone(state.global.choice)
        };
      }

      return state.pages[id];
    }

    // =====================================================
    // Project save
    // =====================================================

    let registered = false;

    function registerData() {
      if (registered) return true;

      if (
        !window.ProjectDataCenter ||
        typeof ProjectDataCenter.register !== "function"
      ) {
        return false;
      }

      try {
        ProjectDataCenter.register(FEATURE_KEY, {
          description: "文字演出工作室：標題、內文、選項的字體與動畫",
          defaultValue: normalizeState({}),
          resetOnMissing: true,
          save() {
            return clone(state);
          },
          load(value) {
            state = normalizeState(value);
            renderPanel();
          }
        });

        registered = true;
        return true;
      } catch (error) {
        console.warn("[Typography Studio] ProjectDataCenter", error);
        return false;
      }
    }

    const registerTimer = setInterval(() => {
      if (registerData()) clearInterval(registerTimer);
    }, 500);

    // =====================================================
    // Reader package
    // =====================================================

    function readerPayload() {
      const pageStyles = {};

      getPages().forEach(page => {
        const s = settingsForPage(page);

        pageStyles[String(page.id)] = {
          enabled: s.enabled !== false,
          title: s.title,
          body: s.body,
          choice: s.choice,
          titleText: String(page.title || "")
        };
      });

      return {
        version: 1,
        fonts: Object.fromEntries(
          Object.entries(FONT_PRESETS).map(([key, item]) => [key, item.stack])
        ),
        pages: pageStyles,
        global: state.global
      };
    }

    function safeJson(value) {
      return JSON.stringify(value)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026");
    }

    const removeReaderTransform = api.registerReaderTransform(
      "typography-motion-runtime",

      function(html) {
        if (
          typeof html !== "string" ||
          html.includes("data-fh-typography-motion-runtime")
        ) {
          return html;
        }

        const payload = safeJson(readerPayload());

        const css = `
<style data-fh-typography-motion-style>
@keyframes fhTypoEnterFade{
  from{opacity:0}
  to{opacity:1}
}
@keyframes fhTypoEnterUp{
  from{opacity:0;transform:translateY(18px)}
  to{opacity:1;transform:translateY(0)}
}
@keyframes fhTypoEnterDown{
  from{opacity:0;transform:translateY(-18px)}
  to{opacity:1;transform:translateY(0)}
}
@keyframes fhTypoEnterLeft{
  from{opacity:0;transform:translateX(-22px)}
  to{opacity:1;transform:translateX(0)}
}
@keyframes fhTypoEnterRight{
  from{opacity:0;transform:translateX(22px)}
  to{opacity:1;transform:translateX(0)}
}
@keyframes fhTypoEnterZoom{
  from{opacity:0;transform:scale(.90)}
  to{opacity:1;transform:scale(1)}
}
@keyframes fhTypoEnterBlur{
  from{opacity:0;filter:blur(10px)}
  to{opacity:1;filter:blur(0)}
}
@keyframes fhTypoEnterTypeFade{
  0%{opacity:0;letter-spacing:.35em}
  100%{opacity:1}
}
@keyframes fhTypoEnterReveal{
  from{opacity:0;clip-path:inset(0 100% 0 0)}
  to{opacity:1;clip-path:inset(0 0 0 0)}
}

@keyframes fhTypoBreathe{
  0%,100%{opacity:1;transform:scale(1)}
  50%{opacity:.88;transform:scale(1.012)}
}
@keyframes fhTypoSway{
  0%,100%{transform:rotate(-.25deg)}
  50%{transform:rotate(.25deg)}
}
@keyframes fhTypoFloat{
  0%,100%{transform:translateY(0)}
  50%{transform:translateY(calc(-4px * var(--fh-idle-amount,1)))}
}
@keyframes fhTypoDrift{
  0%,100%{transform:translateX(calc(-2px * var(--fh-idle-amount,1)))}
  50%{transform:translateX(calc(2px * var(--fh-idle-amount,1)))}
}
@keyframes fhTypoTremble{
  0%,100%{transform:translate(0,0)}
  20%{transform:translate(calc(-1px * var(--fh-idle-amount,1)),0)}
  40%{transform:translate(calc(1px * var(--fh-idle-amount,1)),calc(-1px * var(--fh-idle-amount,1)))}
  60%{transform:translate(0,calc(1px * var(--fh-idle-amount,1)))}
  80%{transform:translate(calc(1px * var(--fh-idle-amount,1)),0)}
}
@keyframes fhTypoPulse{
  0%,100%{opacity:1}
  50%{opacity:.62}
}
@keyframes fhTypoGlow{
  0%,100%{text-shadow:0 0 0 currentColor}
  50%{text-shadow:0 0 calc(10px * var(--fh-idle-amount,1)) currentColor}
}

.fh-typo-enter-fade{animation:fhTypoEnterFade var(--fh-enter-duration,600ms) ease both}
.fh-typo-enter-slide-up{animation:fhTypoEnterUp var(--fh-enter-duration,600ms) ease both}
.fh-typo-enter-slide-down{animation:fhTypoEnterDown var(--fh-enter-duration,600ms) ease both}
.fh-typo-enter-slide-left{animation:fhTypoEnterLeft var(--fh-enter-duration,600ms) ease both}
.fh-typo-enter-slide-right{animation:fhTypoEnterRight var(--fh-enter-duration,600ms) ease both}
.fh-typo-enter-zoom{animation:fhTypoEnterZoom var(--fh-enter-duration,600ms) ease both}
.fh-typo-enter-blur{animation:fhTypoEnterBlur var(--fh-enter-duration,600ms) ease both}
.fh-typo-enter-type-fade{animation:fhTypoEnterTypeFade var(--fh-enter-duration,600ms) ease both}
.fh-typo-enter-reveal{animation:fhTypoEnterReveal var(--fh-enter-duration,600ms) ease both}

.fh-typo-idle-breathe{animation:fhTypoBreathe var(--fh-idle-speed,4000ms) ease-in-out infinite}
.fh-typo-idle-sway{animation:fhTypoSway var(--fh-idle-speed,4000ms) ease-in-out infinite}
.fh-typo-idle-float{animation:fhTypoFloat var(--fh-idle-speed,4000ms) ease-in-out infinite}
.fh-typo-idle-drift{animation:fhTypoDrift var(--fh-idle-speed,4000ms) ease-in-out infinite}
.fh-typo-idle-tremble{animation:fhTypoTremble var(--fh-idle-speed,900ms) linear infinite}
.fh-typo-idle-pulse{animation:fhTypoPulse var(--fh-idle-speed,2600ms) ease-in-out infinite}
.fh-typo-idle-glow{animation:fhTypoGlow var(--fh-idle-speed,3000ms) ease-in-out infinite}


[data-fh-typo-text-span]{
  display:inline;
  transform-origin:center;
  will-change:opacity,transform,filter,text-shadow;
}

@media(prefers-reduced-motion:reduce){
  [class*="fh-typo-enter-"],
  [class*="fh-typo-idle-"]{
    animation:none!important;
  }
}
</style>`;

        const runtime = `
<script type="application/json" id="fh-typography-motion-package">${payload}</scr` + `ipt>
<script data-fh-typography-motion-runtime>
(function(){
"use strict";

if(window.__fhTypographyMotionRuntimeV1)return;
window.__fhTypographyMotionRuntimeV1=true;

var pkg={pages:{},global:{},fonts:{}};
var lastPageId="";
var pendingPageId="";
var idleTimers=[];

try{
  var el=document.getElementById("fh-typography-motion-package");
  pkg=el?JSON.parse(el.textContent||"{}"):pkg;
}catch(error){
  console.warn("[Typography Studio] package",error);
}

var ALL_CLASSES=[
  "fh-typo-enter-fade",
  "fh-typo-enter-slide-up",
  "fh-typo-enter-slide-down",
  "fh-typo-enter-slide-left",
  "fh-typo-enter-slide-right",
  "fh-typo-enter-zoom",
  "fh-typo-enter-blur",
  "fh-typo-enter-type-fade",
  "fh-typo-enter-reveal",
  "fh-typo-idle-breathe",
  "fh-typo-idle-sway",
  "fh-typo-idle-float",
  "fh-typo-idle-drift",
  "fh-typo-idle-tremble",
  "fh-typo-idle-pulse",
  "fh-typo-idle-glow"
];

function clearIdleTimers(){
  idleTimers.forEach(function(timer){
    clearTimeout(timer);
  });
  idleTimers=[];
}

function elements(){
  var root=document.getElementById("reader")||document;

  var title=
    root.querySelector(".reader-layout-title")||
    root.querySelector(".reader-title")||
    root.querySelector("h1")||
    root.querySelector("h2");

  var bodyHost=
    root.querySelector(".reader-layout-text")||
    root.querySelector(".reader-text")||
    root.querySelector("#readerText")||
    root.querySelector(".novel-text");

  var choices=
    Array.prototype.slice.call(
      root.querySelectorAll(
        ".reader-layout-options .choice,"+
        ".reader-layout-options .reader-button,"+
        ".reader-layout-options button,"+
        ".reader-options .choice,"+
        ".reader-options button,"+
        ".choice[data-target],"+
        ".reader-button[data-target]"
      )
    );

  return {
    title:title,
    bodyHost:bodyHost,
    choices:choices
  };
}

function isMediaElement(node){
  if(!node||node.nodeType!==1)return false;

  var tag=String(node.tagName||"").toUpperCase();

  return (
    tag==="IMG"||
    tag==="VIDEO"||
    tag==="AUDIO"||
    tag==="CANVAS"||
    tag==="IFRAME"||
    tag==="SVG"||
    tag==="PICTURE"||
    tag==="SOURCE"
  );
}

function hasMediaAncestor(node,host){
  var current=node&&node.parentElement;

  while(current&&current!==host){
    if(isMediaElement(current))return true;
    current=current.parentElement;
  }

  return false;
}

/*
 * 只包純文字 Text Node。
 * 不把 img/video/canvas 包進動畫層，這樣媒體動畫完全交給 Image Motion。
 */
function prepareTextLayer(host){
  if(!host)return null;

  var old=host.querySelectorAll("[data-fh-typo-text-span]");
  old.forEach(function(span){
    span.classList.remove.apply(
      span.classList,
      ALL_CLASSES
    );
  });

  var walker=document.createTreeWalker(
    host,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode:function(node){
        if(!node||!node.nodeValue||!node.nodeValue.trim()){
          return NodeFilter.FILTER_REJECT;
        }

        var parent=node.parentElement;

        if(!parent){
          return NodeFilter.FILTER_REJECT;
        }

        if(
          parent.closest(
            "button,a,input,textarea,select,option,script,style"
          )
        ){
          return NodeFilter.FILTER_REJECT;
        }

        if(
          hasMediaAncestor(node,host)
        ){
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  var nodes=[];
  var current;

  while((current=walker.nextNode())){
    nodes.push(current);
  }

  nodes.forEach(function(textNode){
    if(
      textNode.parentElement&&
      textNode.parentElement.hasAttribute(
        "data-fh-typo-text-span"
      )
    ){
      return;
    }

    var span=document.createElement("span");
    span.setAttribute(
      "data-fh-typo-text-span",
      "1"
    );

    span.style.display="inline";
    textNode.parentNode.insertBefore(
      span,
      textNode
    );
    span.appendChild(textNode);
  });

  return Array.prototype.slice.call(
    host.querySelectorAll(
      "[data-fh-typo-text-span]"
    )
  );
}

function pageId(){
  if(lastPageId && pkg.pages[lastPageId])return lastPageId;

  try{
    if(typeof currentId!=="undefined"&&currentId&&pkg.pages[String(currentId)]){
      return String(currentId);
    }
  }catch(_){}

  try{
    if(window.currentId&&pkg.pages[String(window.currentId)]){
      return String(window.currentId);
    }
  }catch(_){}

  var els=elements();
  var text=els.title?String(els.title.textContent||"").trim():"";

  if(text){
    var ids=Object.keys(pkg.pages||{});
    for(var i=0;i<ids.length;i++){
      if(String(pkg.pages[ids[i]].titleText||"").trim()===text){
        return ids[i];
      }
    }
  }

  return "";
}

function clearClasses(node){
  if(!node)return;
  ALL_CLASSES.forEach(function(name){
    node.classList.remove(name);
  });
}

function applyBase(node,cfg){
  if(!node||!cfg)return;

  clearClasses(node);

  var font=pkg.fonts&&pkg.fonts[cfg.fontPreset]
    ? pkg.fonts[cfg.fontPreset]
    : "system-ui,sans-serif";

  node.style.fontFamily=font;
  node.style.color=cfg.color||"#263238";
  node.style.fontSize=String(Number(cfg.fontSize)||18)+"px";
  node.style.fontWeight=String(Number(cfg.weight)||400);
  node.style.letterSpacing=String(Number(cfg.letterSpacing)||0)+"px";
  node.style.lineHeight=String(Number(cfg.lineHeight)||1.7);
  node.style.setProperty("--fh-enter-duration",String(Number(cfg.enterDuration)||600)+"ms");
  node.style.setProperty("--fh-idle-speed",String(Number(cfg.idleSpeed)||4000)+"ms");
  node.style.setProperty("--fh-idle-amount",String(Number(cfg.idleAmount)||1));

  node.style.opacity="";
  node.style.transform="";
  node.style.filter="";
  node.style.clipPath="";
}

function enterClass(name){
  return name&&name!=="none"
    ? "fh-typo-enter-"+name
    : "";
}

function idleClass(name){
  return name&&name!=="none"
    ? "fh-typo-idle-"+name
    : "";
}

function animateNode(node,cfg,delay){
  if(!node||!cfg)return;

  applyBase(node,cfg);

  var enter=enterClass(cfg.enter);
  var idle=idleClass(cfg.idle);

  if(enter){
    node.classList.add(enter);
  }

  var startIdle=function(){
    if(enter){
      node.classList.remove(enter);
    }

    if(idle){
      node.classList.add(idle);
    }
  };

  var wait=
    Math.max(
      0,
      Number(delay)||0
    )+
    Math.max(
      0,
      Number(cfg.enterDuration)||0
    );

  if(wait>0){
    idleTimers.push(
      setTimeout(startIdle,wait)
    );
  }else{
    startIdle();
  }
}

function apply(explicitId,force){
  clearIdleTimers();

  var id=explicitId?String(explicitId):pageId();

  if(id){
    lastPageId=id;
  }

  var record=pkg.pages&&pkg.pages[id];

  if(!record||record.enabled===false)return;

  var els=elements();

  animateNode(
    els.title,
    record.title||pkg.global.title,
    0
  );

  /*
   * 內文只動畫文字 span。
   * 圖片/影片/Canvas 留給各自的媒體插件。
   */
  var textNodes=
    prepareTextLayer(
      els.bodyHost
    )||[];

  textNodes.forEach(
    function(node,index){
      animateNode(
        node,
        record.body||pkg.global.body,
        60+
        Math.min(
          index*18,
          260
        )
      );
    }
  );

  els.choices.forEach(function(node,index){
    animateNode(
      node,
      record.choice||pkg.global.choice,
      120+(index*70)
    );
  });
}

/*
 * 最可靠：攔 show(id)。
 */
try{
  if(typeof show==="function"&&!show.__fhTypographyWrapped){
    var originalShow=show;

    show=function(id){
      if(id!=null){
        lastPageId=String(id);
      }

      var result=originalShow.apply(this,arguments);

      setTimeout(function(){
        apply(lastPageId,true);
      },0);

      setTimeout(function(){
        apply(lastPageId,true);
      },80);

      return result;
    };

    show.__fhTypographyWrapped=true;
  }
}catch(error){}

/*
 * 作用域封閉時，capture data-target。
 */
document.addEventListener(
  "click",
  function(event){
    var button=
      event.target&&event.target.closest
        ? event.target.closest("[data-target]")
        : null;

    if(button&&button.dataset&&button.dataset.target){
      pendingPageId=String(button.dataset.target);
    }
  },
  true
);

var reader=document.getElementById("reader");

if(reader){
  var observer=new MutationObserver(function(){
    if(pendingPageId){
      lastPageId=pendingPageId;
      pendingPageId="";
      setTimeout(function(){
        apply(lastPageId,false);
      },0);
    }
  });

  observer.observe(reader,{
    childList:true,
    subtree:true
  });
}

[0,120,400].forEach(function(delay){
  setTimeout(function(){
    apply(lastPageId,false);
  },delay);
});

window.FirehahaTypographyMotionRuntime={
  version:"1.1.0",
  apply:apply,
  getPageId:pageId
};

})();
</scr` + `ipt>`;

        return html
          .replace(/<\/head\s*>/i, css + "\n</head>")
          .replace(/<\/body\s*>/i, runtime + "\n</body>");
      },

      780
    );

    // =====================================================
    // Editor preview
    // =====================================================

    let previewAnimations = [];
    let panel = null;
    let openButton = null;
    let activeTarget = "body";

    function cancelPreviewAnimations() {
      previewAnimations.forEach(animation => {
        try { animation.cancel(); } catch (_) {}
      });
      previewAnimations = [];
    }

    function previewFrames(kind) {
      switch(kind) {
        case "slide-up":
          return [{opacity:0,transform:"translateY(18px)"},{opacity:1,transform:"translateY(0)"}];
        case "slide-down":
          return [{opacity:0,transform:"translateY(-18px)"},{opacity:1,transform:"translateY(0)"}];
        case "slide-left":
          return [{opacity:0,transform:"translateX(-22px)"},{opacity:1,transform:"translateX(0)"}];
        case "slide-right":
          return [{opacity:0,transform:"translateX(22px)"},{opacity:1,transform:"translateX(0)"}];
        case "zoom":
          return [{opacity:0,transform:"scale(.9)"},{opacity:1,transform:"scale(1)"}];
        case "blur":
          return [{opacity:0,filter:"blur(10px)"},{opacity:1,filter:"blur(0)"}];
        case "type-fade":
          return [{opacity:0,letterSpacing:".35em"},{opacity:1}];
        case "reveal":
          return [{opacity:0,clipPath:"inset(0 100% 0 0)"},{opacity:1,clipPath:"inset(0 0 0 0)"}];
        case "fade":
          return [{opacity:0},{opacity:1}];
        default:
          return [{opacity:1},{opacity:1}];
      }
    }

    function idleFrames(kind, amount) {
      const a = Number(amount || 1);

      switch(kind) {
        case "breathe":
          return [
            {opacity:1,transform:"scale(1)"},
            {opacity:.88,transform:"scale(1.012)"},
            {opacity:1,transform:"scale(1)"}
          ];
        case "sway":
          return [
            {transform:"rotate(-.25deg)"},
            {transform:"rotate(.25deg)"},
            {transform:"rotate(-.25deg)"}
          ];
        case "float":
          return [
            {transform:"translateY(0)"},
            {transform:`translateY(${-4*a}px)`},
            {transform:"translateY(0)"}
          ];
        case "drift":
          return [
            {transform:`translateX(${-2*a}px)`},
            {transform:`translateX(${2*a}px)`},
            {transform:`translateX(${-2*a}px)`}
          ];
        case "tremble":
          return [
            {transform:"translate(0,0)"},
            {transform:`translate(${-1*a}px,0)`},
            {transform:`translate(${1*a}px,${-1*a}px)`},
            {transform:`translate(0,${1*a}px)`},
            {transform:"translate(0,0)"}
          ];
        case "pulse":
          return [{opacity:1},{opacity:.62},{opacity:1}];
        case "glow":
          return [
            {textShadow:"0 0 0 currentColor"},
            {textShadow:`0 0 ${10*a}px currentColor`},
            {textShadow:"0 0 0 currentColor"}
          ];
        default:
          return [{opacity:1},{opacity:1}];
      }
    }

    function applyPreviewStyle(element, cfg) {
      if (!element || !cfg) return;

      const font = FONT_PRESETS[cfg.fontPreset] || FONT_PRESETS.modern;

      element.style.fontFamily = font.stack;
      element.style.color = cfg.color;
      element.style.fontSize = cfg.fontSize + "px";
      element.style.fontWeight = cfg.weight;
      element.style.letterSpacing = cfg.letterSpacing + "px";
      element.style.lineHeight = cfg.lineHeight;
      element.style.opacity = "1";
      element.style.transform = "";
      element.style.filter = "";
      element.style.clipPath = "";
      element.style.textShadow = "";
    }

    function playPreview() {
      cancelPreviewAnimations();

      const page = getCurrentPage();
      if (!page || !panel) return;

      const record = settingsForPage(page);

      ["title","body","choice"].forEach((target, index) => {
        const element = panel.querySelector(`[data-preview="${target}"]`);
        const cfg = record[target];

        applyPreviewStyle(element, cfg);

        if (cfg.enter !== "none" && element.animate) {
          const enterAnimation = element.animate(
            previewFrames(cfg.enter),
            {
              duration: cfg.enterDuration,
              easing: "ease",
              fill: "forwards",
              delay: index * 80
            }
          );

          previewAnimations.push(enterAnimation);

          enterAnimation.finished
            .then(() => {
              try { enterAnimation.cancel(); } catch (_) {}

              if (cfg.idle !== "none" && element.animate) {
                const idleAnimation = element.animate(
                  idleFrames(cfg.idle, cfg.idleAmount),
                  {
                    duration: cfg.idleSpeed,
                    easing: cfg.idle === "tremble" ? "linear" : "ease-in-out",
                    iterations: Infinity
                  }
                );

                previewAnimations.push(idleAnimation);
              }
            })
            .catch(() => {});
        } else if (cfg.idle !== "none" && element.animate) {
          const idleAnimation = element.animate(
            idleFrames(cfg.idle, cfg.idleAmount),
            {
              duration: cfg.idleSpeed,
              easing: cfg.idle === "tremble" ? "linear" : "ease-in-out",
              iterations: Infinity
            }
          );

          previewAnimations.push(idleAnimation);
        }
      });
    }

    // =====================================================
    // UI
    // =====================================================

    function fontOptions() {
      return Object.entries(FONT_PRESETS)
        .map(([key, item]) => `<option value="${key}">${item.label}</option>`)
        .join("");
    }

    function controlsHtml() {
      return `
<div class="fh-typo-controls">

  <label>
    字體樣板
    <select data-key="fontPreset">${fontOptions()}</select>
  </label>

  <label>
    文字顏色
    <input type="color" data-key="color">
  </label>

  <label>
    字體大小
    <div class="fh-typo-number">
      <input type="range" min="10" max="64" step="1" data-key="fontSize">
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
    <div class="fh-typo-number">
      <input type="range" min="-3" max="12" step=".25" data-key="letterSpacing">
      <output data-output="letterSpacing"></output>
    </div>
  </label>

  <label>
    行高
    <div class="fh-typo-number">
      <input type="range" min="1" max="3" step=".05" data-key="lineHeight">
      <output data-output="lineHeight"></output>
    </div>
  </label>

  <label>
    開場動畫
    <select data-key="enter">
      <option value="none">靜止／無動畫</option>
      <option value="fade">淡入</option>
      <option value="slide-up">由下浮入</option>
      <option value="slide-down">由上落入</option>
      <option value="slide-left">由左滑入</option>
      <option value="slide-right">由右滑入</option>
      <option value="zoom">縮放出現</option>
      <option value="blur">模糊聚焦</option>
      <option value="type-fade">字距收束</option>
      <option value="reveal">橫向揭露</option>
    </select>
  </label>

  <label>
    開場時間
    <div class="fh-typo-number">
      <input type="range" min="0" max="3000" step="100" data-key="enterDuration">
      <output data-output="enterDuration"></output>
    </div>
  </label>

  <label>
    持續動畫
    <select data-key="idle">
      <option value="none">靜止</option>
      <option value="breathe">柔和呼吸</option>
      <option value="sway">輕微擺動</option>
      <option value="float">上下漂浮</option>
      <option value="drift">左右漂移</option>
      <option value="tremble">微弱顫抖</option>
      <option value="pulse">明暗脈衝</option>
      <option value="glow">柔和發光</option>
    </select>
  </label>

  <label>
    持續動畫速度
    <div class="fh-typo-number">
      <input type="range" min="400" max="10000" step="100" data-key="idleSpeed">
      <output data-output="idleSpeed"></output>
    </div>
  </label>

  <label>
    動畫幅度
    <div class="fh-typo-number">
      <input type="range" min=".1" max="3" step=".1" data-key="idleAmount">
      <output data-output="idleAmount"></output>
    </div>
  </label>

</div>`;
    }

    function buildPanel() {
      const root = document.createElement("div");
      root.id = PANEL_ID;

      root.innerHTML = `
<div class="fh-typo-dialog">

  <div class="fh-typo-head">
    <div>
      <strong>✨ Typography Studio</strong>
      <small data-current-page></small>
    </div>

    <div>
      <button type="button" data-preview-play>▶ 預覽</button>
      <button type="button" data-close>✕ 關閉</button>
    </div>
  </div>

  <div class="fh-typo-body">

    <div class="fh-typo-preview-stage">
      <div data-preview="title">章節標題</div>
      <div data-preview="body">
        這裡是內文動畫預覽。文字可以保持靜止，也可以在進場後持續漂浮、呼吸、微微擺動。
      </div>
      <button type="button" data-preview="choice">前往下一節</button>
    </div>

    <div class="fh-typo-presets">
      ${Object.entries(PRESETS).map(([key,item]) =>
        `<button type="button" data-preset="${key}">${item.label}</button>`
      ).join("")}
    </div>

    <div class="fh-typo-target-tabs">
      <button type="button" data-target-tab="title">章節標題</button>
      <button type="button" data-target-tab="body">內文</button>
      <button type="button" data-target-tab="choice">選項</button>
    </div>

    <label class="fh-typo-enable">
      <input type="checkbox" data-page-enabled>
      此 Node 使用文字演出
    </label>

    <div data-controls>
      ${controlsHtml()}
    </div>

    <div class="fh-typo-actions">
      <button type="button" data-copy-all>套用目前 Node 到全部</button>
      <button type="button" data-reset-page>重設本 Node</button>
    </div>

    <div class="fh-typo-note">
      字體樣板使用系統/generic font stack，不內嵌字型檔；不同裝置若沒有第一順位字體，會自動使用後備字體。
    </div>

  </div>
</div>`;

      document.body.appendChild(root);

      root.querySelector("[data-close]").onclick = () => {
        cancelPreviewAnimations();
        root.classList.remove("open");
      };

      root.querySelector("[data-preview-play]").onclick = playPreview;

      root.querySelectorAll("[data-target-tab]").forEach(button => {
        button.onclick = () => {
          activeTarget = button.dataset.targetTab;
          renderPanel();
        };
      });

      root.querySelectorAll("[data-preset]").forEach(button => {
        button.onclick = () => {
          const page = getCurrentPage();
          if (!page) return;

          const preset = PRESETS[button.dataset.preset];
          if (!preset) return;

          state.pages[String(page.id)] = {
            enabled: true,
            title: clone(preset.title),
            body: clone(preset.body),
            choice: clone(preset.choice)
          };

          renderPanel();
          playPreview();

          api.toast("已套用文字演出預設：" + preset.label.replace(/^[^\s]+\s*/,""));
        };
      });

      root.querySelector("[data-page-enabled]").onchange = event => {
        const page = getCurrentPage();
        if (!page) return;

        settingsForPage(page).enabled = !!event.target.checked;
      };

      root.querySelectorAll("[data-key]").forEach(input => {
        const handler = () => {
          const page = getCurrentPage();
          if (!page) return;

          const record = settingsForPage(page);
          const cfg = record[activeTarget];
          const key = input.dataset.key;

          if (input.type === "range" || input.type === "number") {
            cfg[key] = Number(input.value);
          } else {
            cfg[key] = input.value;
          }

          record[activeTarget] = normalizeTarget(cfg, state.global[activeTarget]);

          updateOutputs(root, record[activeTarget]);
          applyPreviewStyle(
            root.querySelector(`[data-preview="${activeTarget}"]`),
            record[activeTarget]
          );
        };

        input.addEventListener("input", handler);
        input.addEventListener("change", handler);
      });

      root.querySelector("[data-copy-all]").onclick = () => {
        const page = getCurrentPage();
        if (!page) return;

        if (!confirm("把目前 Node 的標題／內文／選項文字演出套用到全部 Node？")) return;

        const source = clone(settingsForPage(page));

        getPages().forEach(target => {
          state.pages[String(target.id)] = clone(source);
        });

        api.toast("已套用到全部 Node");
      };

      root.querySelector("[data-reset-page]").onclick = () => {
        const page = getCurrentPage();
        if (!page) return;

        state.pages[String(page.id)] = {
          enabled: true,
          title: clone(state.global.title),
          body: clone(state.global.body),
          choice: clone(state.global.choice)
        };

        renderPanel();
        playPreview();
      };

      return root;
    }

    function updateOutputs(root, cfg) {
      const map = {
        fontSize: cfg.fontSize + "px",
        letterSpacing: cfg.letterSpacing + "px",
        lineHeight: Number(cfg.lineHeight).toFixed(2),
        enterDuration: (cfg.enterDuration / 1000).toFixed(1) + "s",
        idleSpeed: (cfg.idleSpeed / 1000).toFixed(1) + "s",
        idleAmount: Number(cfg.idleAmount).toFixed(1) + "×"
      };

      Object.entries(map).forEach(([key, value]) => {
        const output = root.querySelector(`[data-output="${key}"]`);
        if (output) output.textContent = value;
      });
    }

    function bindControls(root, cfg) {
      root.querySelectorAll("[data-key]").forEach(input => {
        const key = input.dataset.key;
        if (!(key in cfg)) return;
        input.value = cfg[key];
      });

      updateOutputs(root, cfg);
    }

    function renderPanel() {
      if (!panel) return;

      const page = getCurrentPage();
      const pageLabel = panel.querySelector("[data-current-page]");

      if (!page) {
        pageLabel.textContent = "目前沒有選取 Node";
        return;
      }

      pageLabel.textContent = page.title || "未命名 Node";

      const record = settingsForPage(page);

      panel.querySelector("[data-page-enabled]").checked = record.enabled !== false;

      panel.querySelectorAll("[data-target-tab]").forEach(button => {
        button.classList.toggle("active", button.dataset.targetTab === activeTarget);
      });

      bindControls(panel, record[activeTarget]);

      ["title","body","choice"].forEach(target => {
        applyPreviewStyle(
          panel.querySelector(`[data-preview="${target}"]`),
          record[target]
        );
      });

      const titlePreview = panel.querySelector('[data-preview="title"]');
      if (titlePreview) titlePreview.textContent = page.title || "章節標題";
    }

    panel = buildPanel();

    function openPanel() {
      renderPanel();
      panel.classList.add("open");
    }

    // =====================================================
    // 排版工作室插入入口
    // =====================================================

    function studioHost() {
      return (
        document.querySelector(".rls-window") ||
        document.querySelector(".rls-panel") ||
        document.querySelector("#readerLayoutStudio")
      );
    }

    function attachToStudio() {
      const host = studioHost();
      if (!host) return;
      if (host.querySelector("." + STUDIO_BLOCK_CLASS)) return;

      const block = document.createElement("section");
      block.className = STUDIO_BLOCK_CLASS;
      block.innerHTML = `
        <strong>✨ 文字演出工作室</strong>
        <span>標題／內文／選項的字體樣板、開場動畫與持續動畫。</span>
        <button type="button">開啟 Typography Studio</button>
      `;

      block.querySelector("button").onclick = openPanel;

      const side =
        host.querySelector(".rls-side") ||
        host.querySelector(".rls-panel") ||
        host;

      side.appendChild(block);
    }

    const studioObserver = new MutationObserver(attachToStudio);
    studioObserver.observe(document.body, {childList:true, subtree:true});
    attachToStudio();

    // =====================================================
    // Header
    // =====================================================

    const header = document.querySelector(".pixiv-editor-container header, header");

    if (header && !document.getElementById(BUTTON_ID)) {
      openButton = document.createElement("button");
      openButton.id = BUTTON_ID;
      openButton.type = "button";
      openButton.textContent = "✨ 文字演出";
      openButton.onclick = openPanel;
      header.appendChild(openButton);
    }

    const pageChanged = () => {
      if (panel.classList.contains("open")) renderPanel();
    };

    let unsubscribe = null;

    try {
      if (core && typeof core.on === "function") {
        unsubscribe = core.on("page:selected", pageChanged);
      }
    } catch (_) {}

    document.addEventListener("gamebook:page:selected", pageChanged);

    // =====================================================
    // Editor CSS
    // =====================================================

    const removeStyle = api.addStyle("typography-motion-studio", `
#${PANEL_ID}{
  position:fixed;
  inset:0;
  z-index:2147482800;
  display:none;
  align-items:center;
  justify-content:center;
  padding:
    max(12px,env(safe-area-inset-top))
    max(12px,env(safe-area-inset-right))
    max(12px,env(safe-area-inset-bottom))
    max(12px,env(safe-area-inset-left));
  background:rgba(15,20,25,.62);
  font-family:system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;
}
#${PANEL_ID}.open{display:flex}
#${PANEL_ID} *{box-sizing:border-box}

.fh-typo-dialog{
  width:min(900px,97vw);
  max-height:92dvh;
  display:flex;
  flex-direction:column;
  overflow:hidden;
  border-radius:18px;
  background:#fff;
  color:#263238;
  box-shadow:0 24px 80px rgba(0,0,0,.42);
}

.fh-typo-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  padding:13px 15px;
  background:#263238;
  color:#fff;
}
.fh-typo-head strong{display:block;font-size:17px}
.fh-typo-head small{display:block;margin-top:2px;opacity:.72}
.fh-typo-head>div:last-child{display:flex;gap:6px}

.fh-typo-body{
  min-height:0;
  overflow:auto;
  padding:14px;
}

.fh-typo-preview-stage{
  display:grid;
  gap:12px;
  min-height:230px;
  align-content:center;
  margin-bottom:12px;
  padding:28px 22px;
  overflow:hidden;
  border:1px solid #dbe2e7;
  border-radius:15px;
  background:linear-gradient(180deg,#fbfcfd,#eef4f7);
}
.fh-typo-preview-stage [data-preview="title"]{
  text-align:center;
}
.fh-typo-preview-stage [data-preview="body"]{
  max-width:680px;
  margin:0 auto;
}
.fh-typo-preview-stage [data-preview="choice"]{
  width:max-content;
  max-width:100%;
  margin:0 auto;
  padding:8px 15px;
  border:1px solid #c9d4da;
  border-radius:999px;
  background:#fff;
}

.fh-typo-presets,
.fh-typo-target-tabs,
.fh-typo-actions{
  display:flex;
  gap:7px;
  flex-wrap:wrap;
  margin:10px 0;
}
.fh-typo-presets button{
  background:#f4f7f9!important;
  color:#344955!important;
  border:1px solid #ced9df!important;
}
.fh-typo-target-tabs button.active{
  background:#455a64!important;
  color:#fff!important;
}

.fh-typo-enable{
  display:flex;
  align-items:center;
  gap:7px;
  margin:10px 0;
  padding:8px 10px;
  border-radius:10px;
  background:#eef8ff;
  font-weight:700;
}
.fh-typo-enable input{width:auto}

.fh-typo-controls{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:9px;
}
.fh-typo-controls>label{
  display:grid;
  gap:5px;
  padding:9px;
  border:1px solid #e0e5e9;
  border-radius:10px;
  background:#fafbfc;
  font-size:12px;
  font-weight:700;
}
.fh-typo-controls input,
.fh-typo-controls select{width:100%}

.fh-typo-number{
  display:grid;
  grid-template-columns:minmax(0,1fr) 62px;
  align-items:center;
  gap:7px;
}
.fh-typo-number output{
  text-align:right;
  color:#32698b;
  font-weight:800;
}

.fh-typo-note{
  margin-top:12px;
  padding:9px 11px;
  border-radius:10px;
  background:#f6f7f8;
  color:#667680;
  font-size:11px;
  line-height:1.55;
}

.${STUDIO_BLOCK_CLASS}{
  display:flex;
  flex-direction:column;
  gap:5px;
  margin-top:10px;
  padding:10px;
  border:1px solid #b5c9d5;
  border-radius:10px;
  background:#f2f9fc;
  color:#3c5c6d;
}
.${STUDIO_BLOCK_CLASS}>span{font-size:11px;line-height:1.5}

@media(max-width:700px){
  #${PANEL_ID}{padding:0}
  .fh-typo-dialog{
    width:100vw;
    height:100dvh;
    max-height:none;
    border-radius:0;
  }
  .fh-typo-head{
    position:sticky;
    top:0;
    z-index:4;
    padding-top:max(10px,env(safe-area-inset-top));
  }
  .fh-typo-controls{grid-template-columns:1fr}
  .fh-typo-preview-stage{min-height:210px;padding:22px 14px}
}
`);

    window.FirehahaTypographyMotionStudio = {
      version: "1.1.0",
      fonts: clone(FONT_PRESETS),
      presets: clone(PRESETS),
      open: openPanel,

      get(pageId) {
        const page = getPages().find(p => String(p.id) === String(pageId));
        return page ? clone(settingsForPage(page)) : null;
      },

      set(pageId, value) {
        const page = getPages().find(p => String(p.id) === String(pageId));
        if (!page) return false;

        const current = settingsForPage(page);

        state.pages[String(page.id)] = {
          enabled: value && value.enabled !== false,
          title: normalizeTarget(value && value.title, current.title),
          body: normalizeTarget(value && value.body, current.body),
          choice: normalizeTarget(value && value.choice, current.choice)
        };

        renderPanel();
        return true;
      }
    };

    api.toast("Typography Studio V1.1 已啟用：文字與圖片動畫已分層");

    return function cleanup() {
      clearInterval(registerTimer);
      cancelPreviewAnimations();
      studioObserver.disconnect();

      try { unsubscribe?.(); } catch (_) {}

      document.removeEventListener("gamebook:page:selected", pageChanged);

      removeReaderTransform();
      removeStyle();

      openButton?.remove();
      panel?.remove();

      document.querySelectorAll("." + STUDIO_BLOCK_CLASS).forEach(node => node.remove());

      delete window.FirehahaTypographyMotionStudio;
    };
  }
});
