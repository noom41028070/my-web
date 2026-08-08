// @firehaha-plugin {"id":"official.reader-comfort-tools","name":"閱讀器舒適工具","version":"1.0.0","author":"Firehaha","description":"為測試閱讀與輸出閱讀器加入字級、行距、深色模式、閱讀進度、全螢幕與快捷鍵，遵守安全生命週期。"}
FirehahaPlugins.register({
  id: "official.reader-comfort-tools",

  setup(api) {
    const removeEditorStyle = api.addStyle("manager-hint", `
      .fh-reader-comfort-note{
        display:inline-flex;align-items:center;gap:6px;
        color:#455a64;font-size:12px;font-weight:700;
      }
    `);

    const removeTransform = api.registerReaderTransform(
      "reader-comfort",
      function transformReaderComfort(html, context) {
        if (typeof html !== "string" || !html.includes("</body>")) return html;
        if (html.includes('data-fh-reader-comfort="1"')) return html;

        const style = `
<style id="fh-reader-comfort-style" data-fh-reader-comfort="1">
:root{
  --fh-reader-font-scale:1;
  --fh-reader-line-height:1.85;
  --fh-reader-reading-width:760px;
}
html{scroll-behavior:smooth}
body{
  transition:background-color .2s ease,color .2s ease;
}
body.fh-reader-dark{
  background:#15181c!important;
  color:#e8eaed!important;
  color-scheme:dark;
}
body.fh-reader-dark .reader,
body.fh-reader-dark main,
body.fh-reader-dark article,
body.fh-reader-dark .page,
body.fh-reader-dark .content{
  background:#1d2127!important;
  color:#e8eaed!important;
}
body.fh-reader-dark button,
body.fh-reader-dark a{
  color:#e8eaed;
}
body.fh-reader-comfort-on .content,
body.fh-reader-comfort-on article,
body.fh-reader-comfort-on .reader-content,
body.fh-reader-comfort-on #readerContent{
  max-width:var(--fh-reader-reading-width);
  margin-left:auto;
  margin-right:auto;
  font-size:calc(1em * var(--fh-reader-font-scale))!important;
  line-height:var(--fh-reader-line-height)!important;
}
#fh-reader-progress{
  position:fixed;left:0;top:0;width:0;height:4px;
  background:#0096fa;z-index:2147483647;
  box-shadow:0 0 8px rgba(0,150,250,.55);
  transition:width .08s linear;
}
#fh-reader-comfort-toggle{
  position:fixed;right:14px;bottom:14px;z-index:2147483645;
  width:48px;height:48px;border:0;border-radius:50%;
  background:#0096fa;color:#fff;font-size:21px;font-weight:800;
  box-shadow:0 5px 18px rgba(0,0,0,.32);cursor:pointer;
  touch-action:manipulation;
}
#fh-reader-comfort-panel{
  position:fixed;right:14px;bottom:72px;z-index:2147483646;
  width:min(330px,calc(100vw - 28px));padding:14px;
  border:1px solid rgba(127,127,127,.28);border-radius:16px;
  background:rgba(255,255,255,.96);color:#263238;
  box-shadow:0 12px 36px rgba(0,0,0,.28);
  font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;
  backdrop-filter:blur(12px);display:none;
}
#fh-reader-comfort-panel.open{display:block}
body.fh-reader-dark #fh-reader-comfort-panel{
  background:rgba(32,36,42,.97);color:#f1f3f4;
}
.fh-reader-comfort-title{
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:10px;font-size:15px;font-weight:800;
}
.fh-reader-comfort-grid{
  display:grid;grid-template-columns:repeat(3,1fr);gap:8px;
}
.fh-reader-comfort-grid button,
#fh-reader-comfort-close{
  min-height:40px;padding:8px;border:1px solid rgba(127,127,127,.28);
  border-radius:10px;background:#f5f7f9;color:#263238;
  font:700 13px system-ui;cursor:pointer;touch-action:manipulation;
}
body.fh-reader-dark .fh-reader-comfort-grid button,
body.fh-reader-dark #fh-reader-comfort-close{
  background:#2b3037;color:#f1f3f4;
}
.fh-reader-comfort-grid button:focus-visible,
#fh-reader-comfort-toggle:focus-visible,
#fh-reader-comfort-close:focus-visible{
  outline:3px solid rgba(0,150,250,.42);outline-offset:2px;
}
.fh-reader-comfort-help{
  margin-top:10px;color:#607d8b;font-size:11px;
}
body.fh-reader-dark .fh-reader-comfort-help{color:#b0bec5}
@media(max-width:600px){
  #fh-reader-comfort-toggle{right:10px;bottom:10px}
  #fh-reader-comfort-panel{right:10px;bottom:68px;width:calc(100vw - 20px)}
}
@media print{
  #fh-reader-progress,#fh-reader-comfort-toggle,#fh-reader-comfort-panel{display:none!important}
}
</style>`;

        const markup = `
<div id="fh-reader-progress" aria-hidden="true"></div>
<button id="fh-reader-comfort-toggle" type="button" aria-label="開啟閱讀設定" aria-controls="fh-reader-comfort-panel" aria-expanded="false">Aa</button>
<section id="fh-reader-comfort-panel" aria-label="閱讀設定">
  <div class="fh-reader-comfort-title">
    <span>閱讀設定</span>
    <button id="fh-reader-comfort-close" type="button" aria-label="關閉閱讀設定">關閉</button>
  </div>
  <div class="fh-reader-comfort-grid">
    <button type="button" data-fh-action="font-down">字體－</button>
    <button type="button" data-fh-action="font-reset">字體重設</button>
    <button type="button" data-fh-action="font-up">字體＋</button>
    <button type="button" data-fh-action="line-down">行距－</button>
    <button type="button" data-fh-action="line-reset">行距重設</button>
    <button type="button" data-fh-action="line-up">行距＋</button>
    <button type="button" data-fh-action="theme">深色模式</button>
    <button type="button" data-fh-action="top">回到頂端</button>
    <button type="button" data-fh-action="fullscreen">全螢幕</button>
  </div>
  <div class="fh-reader-comfort-help">快捷鍵：A / D 調整字體，M 切換深色，Home 回頂端。</div>
</section>`;

        const script = `
<script data-fh-reader-comfort="1">
(function(){
  "use strict";
  if(window.__fhReaderComfortInstalled)return;
  window.__fhReaderComfortInstalled=true;

  var root=document.documentElement;
  var body=document.body;
  var panel=document.getElementById("fh-reader-comfort-panel");
  var toggle=document.getElementById("fh-reader-comfort-toggle");
  var closeBtn=document.getElementById("fh-reader-comfort-close");
  var progress=document.getElementById("fh-reader-progress");
  var key="firehaha.readerComfort.v1";
  var state={font:1,line:1.85,dark:false};

  try{
    var saved=JSON.parse(localStorage.getItem(key)||"null");
    if(saved&&typeof saved==="object"){
      if(Number.isFinite(Number(saved.font)))state.font=Number(saved.font);
      if(Number.isFinite(Number(saved.line)))state.line=Number(saved.line);
      state.dark=!!saved.dark;
    }
  }catch(error){}

  function clamp(value,min,max){return Math.min(max,Math.max(min,value));}
  function save(){
    try{localStorage.setItem(key,JSON.stringify(state));}catch(error){}
  }
  function apply(){
    state.font=clamp(state.font,.8,1.6);
    state.line=clamp(state.line,1.35,2.5);
    root.style.setProperty("--fh-reader-font-scale",String(state.font));
    root.style.setProperty("--fh-reader-line-height",String(state.line));
    body.classList.add("fh-reader-comfort-on");
    body.classList.toggle("fh-reader-dark",state.dark);
    var themeButton=panel&&panel.querySelector('[data-fh-action="theme"]');
    if(themeButton)themeButton.textContent=state.dark?"淺色模式":"深色模式";
    save();
  }
  function setOpen(open){
    if(!panel||!toggle)return;
    panel.classList.toggle("open",open);
    toggle.setAttribute("aria-expanded",open?"true":"false");
    toggle.setAttribute("aria-label",open?"關閉閱讀設定":"開啟閱讀設定");
  }
  function updateProgress(){
    if(!progress)return;
    var doc=document.documentElement;
    var max=Math.max(0,doc.scrollHeight-window.innerHeight);
    var ratio=max?Math.min(1,Math.max(0,window.scrollY/max)):0;
    progress.style.width=(ratio*100).toFixed(2)+"%";
  }
  function fullscreen(){
    try{
      if(document.fullscreenElement){document.exitFullscreen();}
      else if(document.documentElement.requestFullscreen){document.documentElement.requestFullscreen();}
    }catch(error){}
  }
  function action(name){
    if(name==="font-down")state.font-=.1;
    else if(name==="font-up")state.font+=.1;
    else if(name==="font-reset")state.font=1;
    else if(name==="line-down")state.line-=.1;
    else if(name==="line-up")state.line+=.1;
    else if(name==="line-reset")state.line=1.85;
    else if(name==="theme")state.dark=!state.dark;
    else if(name==="top")window.scrollTo({top:0,behavior:"smooth"});
    else if(name==="fullscreen")fullscreen();
    apply();
  }

  if(toggle)toggle.addEventListener("click",function(){setOpen(!panel.classList.contains("open"));});
  if(closeBtn)closeBtn.addEventListener("click",function(){setOpen(false);toggle.focus();});
  if(panel)panel.addEventListener("click",function(event){
    var button=event.target.closest("[data-fh-action]");
    if(button)action(button.getAttribute("data-fh-action"));
  });
  document.addEventListener("keydown",function(event){
    var target=event.target;
    if(target&&(target.matches("input,textarea,select")||target.isContentEditable))return;
    if(event.key==="Escape")setOpen(false);
    else if(event.key==="a"||event.key==="A")action("font-down");
    else if(event.key==="d"||event.key==="D")action("font-up");
    else if(event.key==="m"||event.key==="M")action("theme");
    else if(event.key==="Home")action("top");
  });
  window.addEventListener("scroll",updateProgress,{passive:true});
  window.addEventListener("resize",updateProgress,{passive:true});
  document.addEventListener("click",function(event){
    if(panel&&panel.classList.contains("open")&&!panel.contains(event.target)&&event.target!==toggle)setOpen(false);
    setTimeout(updateProgress,0);
  },true);

  apply();
  updateProgress();
})();
<\/script>`;

        let output = html;
        if (output.includes("</head>")) output = output.replace("</head>", style + "\n</head>");
        else output = style + output;
        return output.replace("</body>", markup + script + "\n</body>");
      },
      180
    );

    api.toast("閱讀器舒適工具已啟用");

    return function cleanup() {
      removeTransform();
      removeEditorStyle();
    };
  }
});
