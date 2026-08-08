// @firehaha-plugin {"id":"official.image-motion-studio","name":"圖片演出工作室 Image Motion Studio","version":"1.0.1","author":"Firehaha","description":"圖片演出工作室。V1.0.1 加入同頁同圖只初始化一次、防 MutationObserver 重播與動畫分層，避免與 Typography Studio 互搶展示權。"}

FirehahaPlugins.register({
  id:"official.image-motion-studio",
  name:"圖片演出工作室 Image Motion Studio",
  version:"1.0.1",

  async setup(api){
    "use strict";

    const FEATURE="imageMotionStudioV1";
    const PANEL="fh-image-motion-panel";
    const OPEN="fh-image-motion-open";
    const CARD="fh-image-motion-card-button";
    const STUDIO="fh-image-motion-studio-block";
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));

    const started=Date.now();
    while(!window.GamebookCore&&Date.now()-started<12000)await sleep(80);
    const core=window.GamebookCore||null;

    const pages=()=>core&&Array.isArray(core.pages)?core.pages:(Array.isArray(window.pages)?window.pages:[]);
    const current=()=>core&&core.currentPage?core.currentPage:(pages()[0]||null);
    const clone=v=>JSON.parse(JSON.stringify(v));
    const clamp=(v,a,b,d)=>Number.isFinite(Number(v))?Math.min(b,Math.max(a,Number(v))):d;

    function refs(page){
      const out=[],re=/\[img:([^\]]+)\]/gi;
      let m;
      while((m=re.exec(String(page&&page.text||""))))out.push({index:out.length,src:String(m[1]||"").trim()});
      return out;
    }

    const defaults={
      enabled:true,
      entrance:"fade", entranceDuration:700, entranceDelay:0,
      idle:"none", idleSpeed:4200, idleAmount:1,
      exit:"none", exitAfter:0, exitDuration:900,
      maxWidth:100, scale:1, rotate:0, opacity:1, radius:8,
      shadow:"soft", glowColor:"#ffffff",
      filter:"none", filterAmount:1, hover:"lift"
    };

    function norm(v){
      v=v&&typeof v==="object"?v:{};
      const pick=(x,list,d)=>list.includes(x)?x:d;
      return {
        enabled:v.enabled!==false,
        entrance:pick(v.entrance,["none","fade","slide-up","slide-down","slide-left","slide-right","zoom-in","zoom-out","blur","flip","cinema"],defaults.entrance),
        entranceDuration:clamp(v.entranceDuration,0,5000,700),
        entranceDelay:clamp(v.entranceDelay,0,10000,0),
        idle:pick(v.idle,["none","float","sway","drift","breathe","pulse","tremble","slow-zoom","orbit","glow"],"none"),
        idleSpeed:clamp(v.idleSpeed,400,20000,4200),
        idleAmount:clamp(v.idleAmount,.1,4,1),
        exit:pick(v.exit,["none","fade","fade-up","fade-down","shrink","expand","blur","cinema"],"none"),
        exitAfter:clamp(v.exitAfter,0,60000,0),
        exitDuration:clamp(v.exitDuration,100,10000,900),
        maxWidth:clamp(v.maxWidth,10,100,100),
        scale:clamp(v.scale,.2,3,1),
        rotate:clamp(v.rotate,-180,180,0),
        opacity:clamp(v.opacity,.05,1,1),
        radius:clamp(v.radius,0,80,8),
        shadow:pick(v.shadow,["none","soft","deep","glow","cinema"],"soft"),
        glowColor:/^#[0-9a-f]{6}$/i.test(String(v.glowColor||""))?v.glowColor:"#ffffff",
        filter:pick(v.filter,["none","soft","dream","mono","sepia","contrast","dark","bright"],"none"),
        filterAmount:clamp(v.filterAmount,0,3,1),
        hover:pick(v.hover,["none","lift","zoom","tilt","glow"],"lift")
      };
    }

    let state={version:1,pages:{}};
    function bucket(id){id=String(id);return state.pages[id]||(state.pages[id]={});}
    function cfg(id,index){
      const b=bucket(id),k=String(index);
      b[k]=norm(b[k]||defaults);
      return b[k];
    }

    let registered=false;
    const saveTimer=setInterval(()=>{
      if(registered||!window.ProjectDataCenter||typeof ProjectDataCenter.register!=="function")return;
      try{
        ProjectDataCenter.register(FEATURE,{
          description:"圖片演出：依 Node + 圖片順序保存",
          defaultValue:{version:1,pages:{}},
          resetOnMissing:true,
          save(){return clone(state)},
          load(v){
            state=v&&typeof v==="object"&&v.pages?{version:1,pages:v.pages}:{version:1,pages:{}};
            render();
          }
        });
        registered=true;
        clearInterval(saveTimer);
      }catch(e){console.warn("[Image Motion] save",e)}
    },500);

    function payload(){
      const out={};
      pages().forEach(page=>{
        const list=refs(page);
        if(!list.length)return;
        out[String(page.id)]=list.map((r,i)=>({src:r.src,settings:cfg(page.id,i)}));
      });
      return out;
    }
    const safe=v=>JSON.stringify(v).replace(/</g,"\\u003c").replace(/>/g,"\\u003e").replace(/&/g,"\\u0026");

    const removeReader=api.registerReaderTransform("image-motion-runtime",html=>{
      if(typeof html!=="string"||html.includes("data-fh-image-motion-runtime"))return html;
      const data=safe(payload());

      const css=`<style data-fh-image-motion-style>
.fh-img-motion{display:block;height:auto;margin-left:auto;margin-right:auto;transform-origin:center;will-change:transform,opacity,filter;isolation:isolate}
.fh-img-hover-lift:hover{translate:0 -5px}.fh-img-hover-zoom:hover{scale:1.045}.fh-img-hover-tilt:hover{rotate:1.2deg}
.fh-img-hover-glow:hover{filter:var(--fh-filter,none) drop-shadow(0 0 14px var(--fh-glow,#fff))!important}
@media(prefers-reduced-motion:reduce){.fh-img-motion{animation:none!important}}
</style>`;

      const runtime=`<script type="application/json" id="fh-image-motion-package">${data}</scr`+`ipt>
<script data-fh-image-motion-runtime>
(function(){
"use strict";
if(window.__fhImageMotionV1)return;window.__fhImageMotionV1=true;
var config={},last="",pending="",running=[];
var appliedPage="";
var appliedNodes=[];
try{var el=document.getElementById("fh-image-motion-package");config=el?JSON.parse(el.textContent||"{}"):{};}catch(e){}

function stop(){
 running.forEach(function(a){try{a.cancel()}catch(e){}});
 running=[];
 appliedNodes=[];
}
function sameNodeSet(nodes){
 if(appliedNodes.length!==nodes.length)return false;

 for(var i=0;i<nodes.length;i++){
   if(appliedNodes[i]!==nodes[i])return false;
 }

 return true;
}

function pid(){
 if(last&&config[last])return last;
 try{if(typeof currentId!=="undefined"&&config[String(currentId)])return String(currentId)}catch(e){}
 try{if(window.currentId&&config[String(window.currentId)])return String(window.currentId)}catch(e){}
 return "";
}
function imgs(){
 var r=document.getElementById("reader")||document;
 return Array.prototype.slice.call(r.querySelectorAll(".reader-layout-text img,.reader-text img,#readerText img,.novel-text img,#reader img")).filter(function(n,i,a){return a.indexOf(n)===i});
}
function baseTransform(c){return "scale("+(Number(c.scale)||1)+") rotate("+(Number(c.rotate)||0)+"deg)"}
function shadow(c){
 if(c.shadow==="soft")return"0 5px 18px rgba(0,0,0,.18)";
 if(c.shadow==="deep")return"0 12px 32px rgba(0,0,0,.34)";
 if(c.shadow==="glow")return"0 0 18px "+(c.glowColor||"#fff");
 if(c.shadow==="cinema")return"0 8px 30px rgba(0,0,0,.3)";
 return"none";
}
function filter(c){
 var a=Number(c.filterAmount)||1;
 if(c.filter==="soft")return"saturate(.92) contrast(.96)";
 if(c.filter==="dream")return"saturate(.86) brightness(1.08) contrast(.9)";
 if(c.filter==="mono")return"grayscale("+Math.min(1,a)+")";
 if(c.filter==="sepia")return"sepia("+Math.min(1,a)+")";
 if(c.filter==="contrast")return"contrast("+(1+a*.25)+")";
 if(c.filter==="dark")return"brightness("+Math.max(.25,1-a*.2)+")";
 if(c.filter==="bright")return"brightness("+(1+a*.18)+")";
 return"none";
}
function enter(k,c){
 var b=baseTransform(c),s=Number(c.scale)||1,r=Number(c.rotate)||0;
 if(k==="slide-up")return[{opacity:0,transform:"translateY(34px) "+b},{opacity:1,transform:b}];
 if(k==="slide-down")return[{opacity:0,transform:"translateY(-34px) "+b},{opacity:1,transform:b}];
 if(k==="slide-left")return[{opacity:0,transform:"translateX(-42px) "+b},{opacity:1,transform:b}];
 if(k==="slide-right")return[{opacity:0,transform:"translateX(42px) "+b},{opacity:1,transform:b}];
 if(k==="zoom-in")return[{opacity:0,transform:"scale("+(s*.78)+") rotate("+r+"deg)"},{opacity:1,transform:b}];
 if(k==="zoom-out")return[{opacity:0,transform:"scale("+(s*1.22)+") rotate("+r+"deg)"},{opacity:1,transform:b}];
 if(k==="blur")return[{opacity:0,filter:"blur(14px)"},{opacity:1,filter:"blur(0)"}];
 if(k==="flip")return[{opacity:0,transform:"perspective(800px) rotateY(55deg) "+b},{opacity:1,transform:b}];
 if(k==="cinema")return[{opacity:0,transform:"translateY(12px) scale("+(s*1.04)+")",filter:"blur(7px)"},{opacity:1,transform:b,filter:"blur(0)"}];
 return[{opacity:0},{opacity:1}];
}
function idle(k,c){
 var a=Number(c.idleAmount)||1,b=baseTransform(c),s=Number(c.scale)||1,r=Number(c.rotate)||0;
 if(k==="float")return[{transform:b},{transform:"translateY("+(-7*a)+"px) "+b},{transform:b}];
 if(k==="sway")return[{transform:"scale("+s+") rotate("+(r-.6*a)+"deg)"},{transform:"scale("+s+") rotate("+(r+.6*a)+"deg)"},{transform:"scale("+s+") rotate("+(r-.6*a)+"deg)"}];
 if(k==="drift")return[{transform:"translateX("+(-5*a)+"px) "+b},{transform:"translateX("+(5*a)+"px) "+b},{transform:"translateX("+(-5*a)+"px) "+b}];
 if(k==="breathe")return[{transform:b,opacity:1},{transform:"scale("+(s*(1+.018*a))+") rotate("+r+"deg)",opacity:.94},{transform:b,opacity:1}];
 if(k==="pulse")return[{opacity:1},{opacity:.68},{opacity:1}];
 if(k==="tremble")return[{transform:b},{transform:"translate("+(-1.2*a)+"px,0) "+b},{transform:"translate("+(1.2*a)+"px,"+(-a)+"px) "+b},{transform:b}];
 if(k==="slow-zoom")return[{transform:b},{transform:"scale("+(s*(1+.035*a))+") rotate("+r+"deg)"},{transform:b}];
 if(k==="orbit")return[{transform:b},{transform:"translate("+(4*a)+"px,"+(-3*a)+"px) "+b},{transform:"translate(0,"+(-5*a)+"px) "+b},{transform:"translate("+(-4*a)+"px,"+(-3*a)+"px) "+b},{transform:b}];
 if(k==="glow")return[{filter:"drop-shadow(0 0 0 var(--fh-glow,#fff))"},{filter:"drop-shadow(0 0 "+(12*a)+"px var(--fh-glow,#fff))"},{filter:"drop-shadow(0 0 0 var(--fh-glow,#fff))"}];
 return[{transform:b},{transform:b}];
}
function exit(k,c){
 var b=baseTransform(c),s=Number(c.scale)||1,r=Number(c.rotate)||0;
 if(k==="fade-up")return[{opacity:1,transform:b},{opacity:0,transform:"translateY(-28px) "+b}];
 if(k==="fade-down")return[{opacity:1,transform:b},{opacity:0,transform:"translateY(28px) "+b}];
 if(k==="shrink")return[{opacity:1,transform:b},{opacity:0,transform:"scale("+(s*.78)+") rotate("+r+"deg)"}];
 if(k==="expand")return[{opacity:1,transform:b},{opacity:0,transform:"scale("+(s*1.16)+") rotate("+r+"deg)"}];
 if(k==="blur")return[{opacity:1,filter:"blur(0)"},{opacity:0,filter:"blur(15px)"}];
 if(k==="cinema")return[{opacity:1,transform:b,filter:"blur(0)"},{opacity:0,transform:"translateY(-22px) scale("+(s*1.05)+")",filter:"blur(6px)"}];
 return[{opacity:1},{opacity:0}];
}
function decorate(n,c){
 n.classList.add("fh-img-motion");n.style.maxWidth=(Number(c.maxWidth)||100)+"%";n.style.opacity=String(Number(c.opacity)||1);
 n.style.borderRadius=(Number(c.radius)||0)+"px";n.style.boxShadow=shadow(c);n.style.filter=filter(c);
 n.style.setProperty("--fh-filter",filter(c));n.style.setProperty("--fh-glow",c.glowColor||"#fff");
 ["lift","zoom","tilt","glow"].forEach(function(x){n.classList.remove("fh-img-hover-"+x)});
 if(c.hover&&c.hover!=="none")n.classList.add("fh-img-hover-"+c.hover);
}
function animate(n,c,i){
 if(!n||!c||c.enabled===false)return;decorate(n,c);
 var startIdle=function(){
   if(!c.idle||c.idle==="none")return;
   var a=n.animate(idle(c.idle,c),{duration:Math.max(400,Number(c.idleSpeed)||4200),easing:c.idle==="tremble"?"linear":"ease-in-out",iterations:Infinity});running.push(a);
 };
 if(c.entrance&&c.entrance!=="none"){
   var e=n.animate(enter(c.entrance,c),{duration:Math.max(1,Number(c.entranceDuration)||700),delay:Math.max(0,Number(c.entranceDelay)||0)+i*80,easing:c.entrance==="cinema"?"cubic-bezier(.22,.61,.36,1)":"ease",fill:"both"});
   running.push(e);e.finished.then(function(){try{e.cancel()}catch(x){}n.style.opacity=String(Number(c.opacity)||1);n.style.transform=baseTransform(c);startIdle()}).catch(function(){});
 }else{n.style.transform=baseTransform(c);startIdle()}
 if(c.exit&&c.exit!=="none"&&Number(c.exitAfter)>0){
   var t=setTimeout(function(){var x=n.animate(exit(c.exit,c),{duration:Math.max(100,Number(c.exitDuration)||900),easing:"ease-in-out",fill:"forwards"});running.push(x)},Number(c.exitAfter));
   running.push({cancel:function(){clearTimeout(t)}});
 }
}
function apply(id,force){
 id=id?String(id):pid();
 if(id)last=id;

 var rec=config[id]||[];
 var nodes=imgs();

 /*
  * 同一 Node + 同一批 img DOM 已套過時，
  * MutationObserver 不可以再 cancel + replay。
  */
 if(
   !force &&
   appliedPage===id &&
   sameNodeSet(nodes)
 ){
   return;
 }

 stop();

 appliedPage=id;
 appliedNodes=nodes.slice();

 nodes.forEach(function(n,i){
   if(rec[i])animate(n,rec[i].settings,i);
 });
}
try{
 if(typeof show==="function"&&!show.__fhImgMotionWrapped){
   var old=show;show=function(id){
   var changed=id!=null&&String(id)!==last;
   if(id!=null)last=String(id);
   var r=old.apply(this,arguments);
   if(changed){
     appliedPage="";
     appliedNodes=[];
   }
   setTimeout(function(){apply(last,true)},0);
   setTimeout(function(){apply(last,false)},100);
   return r
 };
 show.__fhImgMotionWrapped=true;
 }
}catch(e){}
document.addEventListener("click",function(e){var b=e.target&&e.target.closest?e.target.closest("[data-target]"):null;if(b&&b.dataset&&b.dataset.target)pending=String(b.dataset.target)},true);
var reader=document.getElementById("reader");
if(reader){
 var q=false,o=new MutationObserver(function(){
   if(q)return;
   q=true;
   setTimeout(function(){
     q=false;
     if(pending){
       if(String(pending)!==last){
         appliedPage="";
         appliedNodes=[];
       }
       last=pending;
       pending="";
     }
     if(last)apply(last,false);
   },60)
 });
 o.observe(reader,{childList:true,subtree:true})
}
[0,150,450].forEach(function(d){setTimeout(function(){apply(last,false)},d)});
window.FirehahaImageMotionRuntime={version:"1.0.1",apply:apply};
})();
</scr`+`ipt>`;

      return html.replace(/<\/head\s*>/i,css+"\n</head>").replace(/<\/body\s*>/i,runtime+"\n</body>");
    },790);

    // =====================================================
    // 編輯器 UI
    // =====================================================

    let panel=null,selected=0,openButton=null,previewAnims=[],libraryObserver=null;

    function resolveSrc(ref){
      if(!ref)return"";
      if(/^local-image:\/\//i.test(ref)){
        const id=ref.replace(/^local-image:\/\//i,"");
        try{
          if(window.PixivImageAssets&&PixivImageAssets.assets&&PixivImageAssets.assets[id])return PixivImageAssets.assets[id];
        }catch(_){}
        return"";
      }
      return ref;
    }

    function stopPreview(){previewAnims.forEach(a=>{try{a.cancel()}catch(_){}});previewAnims=[]}

    const presets={
      still:{...defaults,entrance:"fade",idle:"none",exit:"none"},
      float:{...defaults,entrance:"slide-up",idle:"float",idleSpeed:4800,idleAmount:.8},
      cinema:{...defaults,entrance:"cinema",entranceDuration:1400,idle:"slow-zoom",idleSpeed:9000,exit:"cinema",exitAfter:6500,exitDuration:1400,shadow:"cinema"},
      dream:{...defaults,entrance:"blur",idle:"orbit",idleSpeed:7000,idleAmount:.7,filter:"dream",shadow:"glow",glowColor:"#d9e7ff"},
      horror:{...defaults,entrance:"blur",idle:"tremble",idleSpeed:1100,idleAmount:.5,filter:"dark",filterAmount:.7,shadow:"deep"},
      animated:{...defaults,entrance:"zoom-in",idle:"breathe",idleSpeed:3000,idleAmount:.45}
    };

    function controls(){
      const select=(key,items)=>`<select data-key="${key}">${items.map(x=>`<option value="${x[0]}">${x[1]}</option>`).join("")}</select>`;
      const range=(key,min,max,step)=>`<input type="range" min="${min}" max="${max}" step="${step}" data-key="${key}"><output data-output="${key}"></output>`;

      return `
<div class="fh-img-controls">
<label class="check"><input type="checkbox" data-key="enabled">啟用這張圖片演出</label>
<label>進場${select("entrance",[["none","無"],["fade","淡入"],["slide-up","由下浮入"],["slide-down","由上落入"],["slide-left","由左滑入"],["slide-right","由右滑入"],["zoom-in","縮小→放大"],["zoom-out","放大→歸位"],["blur","模糊聚焦"],["flip","3D 翻轉"],["cinema","電影式"]])}</label>
<label>進場時間${range("entranceDuration",0,4000,100)}</label>
<label>進場延遲${range("entranceDelay",0,5000,100)}</label>
<label>持續動畫${select("idle",[["none","靜止"],["float","上下漂浮"],["sway","輕微擺動"],["drift","左右漂移"],["breathe","呼吸縮放"],["pulse","明暗脈衝"],["tremble","微弱震動"],["slow-zoom","慢速推近"],["orbit","小幅環繞"],["glow","光暈脈動"]])}</label>
<label>持續速度${range("idleSpeed",400,12000,100)}</label>
<label>動畫幅度${range("idleAmount",.1,4,.1)}</label>
<label>退場${select("exit",[["none","無"],["fade","淡出"],["fade-up","向上淡出"],["fade-down","向下淡出"],["shrink","縮小消失"],["expand","放大消失"],["blur","模糊消散"],["cinema","電影式"]])}</label>
<label>幾秒後退場${range("exitAfter",0,20000,100)}</label>
<label>退場時間${range("exitDuration",100,6000,100)}</label>
<label>圖片寬度${range("maxWidth",10,100,1)}</label>
<label>基礎縮放${range("scale",.2,2,.05)}</label>
<label>旋轉${range("rotate",-30,30,.5)}</label>
<label>透明度${range("opacity",.05,1,.05)}</label>
<label>圓角${range("radius",0,50,1)}</label>
<label>陰影${select("shadow",[["none","無"],["soft","柔和"],["deep","深陰影"],["glow","發光"],["cinema","電影陰影"]])}</label>
<label>光暈色<input type="color" data-key="glowColor"></label>
<label>濾鏡${select("filter",[["none","無"],["soft","柔和"],["dream","夢境"],["mono","黑白"],["sepia","復古棕"],["contrast","強對比"],["dark","暗化"],["bright","亮化"]])}</label>
<label>濾鏡強度${range("filterAmount",0,3,.1)}</label>
<label>滑鼠回饋${select("hover",[["none","無"],["lift","浮起"],["zoom","放大"],["tilt","微傾斜"],["glow","發光"]])}</label>
</div>`;
    }

    function build(){
      const root=document.createElement("div");root.id=PANEL;
      root.innerHTML=`
<div class="fh-img-dialog">
 <div class="fh-img-head"><div><strong>🖼 Image Motion Studio</strong><small data-page></small></div><div><button data-preview>▶ 預覽</button><button data-close>✕ 關閉</button></div></div>
 <div class="fh-img-body">
   <div class="fh-img-preview"><img data-preview-image><div data-empty>目前 Node 沒有圖片</div></div>
   <div class="fh-img-tabs" data-tabs></div>
   <div class="fh-img-presets">
    <button data-preset="still">🖼 靜態展示</button><button data-preset="float">☁ 漂浮插圖</button><button data-preset="cinema">🎬 電影鏡頭</button>
    <button data-preset="dream">✨ 夢境插圖</button><button data-preset="horror">🕯 恐怖顫動</button><button data-preset="animated">🎞 動圖強調</button>
   </div>
   ${controls()}
   <div class="fh-img-actions"><button data-copy>本頁全部套用</button><button data-reset>重設此圖</button></div>
   <div class="fh-img-note">設定依「Node + 圖片順序」保存，不修改 <code>[img:...]</code>。若 GIF 在素材庫壓縮時已變單幀，本插件只能讓整張圖做動畫，無法恢復原始影格。</div>
 </div>
</div>`;
      document.body.appendChild(root);

      root.querySelector("[data-close]").onclick=()=>{stopPreview();root.classList.remove("open")};
      root.querySelector("[data-preview]").onclick=playPreview;

      root.querySelectorAll("[data-preset]").forEach(b=>b.onclick=()=>{
        const p=current(),list=refs(p);if(!p||!list[selected])return;
        bucket(p.id)[String(selected)]=norm(presets[b.dataset.preset]);render();playPreview();
      });

      root.querySelectorAll("[data-key]").forEach(input=>{
        const on=()=>{
          const p=current(),list=refs(p);if(!p||!list[selected])return;
          const c=cfg(p.id,selected),k=input.dataset.key;
          c[k]=input.type==="checkbox"?input.checked:(input.type==="range"||input.type==="number"?Number(input.value):input.value);
          bucket(p.id)[String(selected)]=norm(c);outputs(root,bucket(p.id)[String(selected)]);
        };
        input.addEventListener("input",on);input.addEventListener("change",on);
      });

      root.querySelector("[data-copy]").onclick=()=>{
        const p=current(),list=refs(p);if(!p||!list.length)return;
        const source=clone(cfg(p.id,selected));list.forEach((_,i)=>bucket(p.id)[String(i)]=clone(source));api.toast("已套用到目前 Node 全部圖片");
      };
      root.querySelector("[data-reset]").onclick=()=>{const p=current();if(!p)return;bucket(p.id)[String(selected)]=clone(defaults);render();playPreview()};
      return root;
    }

    function outputs(root,c){
      const map={
        entranceDuration:(c.entranceDuration/1000).toFixed(1)+"s",entranceDelay:(c.entranceDelay/1000).toFixed(1)+"s",
        idleSpeed:(c.idleSpeed/1000).toFixed(1)+"s",idleAmount:Number(c.idleAmount).toFixed(1)+"×",
        exitAfter:(c.exitAfter/1000).toFixed(1)+"s",exitDuration:(c.exitDuration/1000).toFixed(1)+"s",
        maxWidth:c.maxWidth+"%",scale:Number(c.scale).toFixed(2)+"×",rotate:c.rotate+"°",opacity:Math.round(c.opacity*100)+"%",
        radius:c.radius+"px",filterAmount:Number(c.filterAmount).toFixed(1)
      };
      Object.entries(map).forEach(([k,v])=>{const o=root.querySelector(`[data-output="${k}"]`);if(o)o.textContent=v});
    }

    function bind(root,c){
      root.querySelectorAll("[data-key]").forEach(input=>{
        const k=input.dataset.key;if(!(k in c))return;
        if(input.type==="checkbox")input.checked=!!c[k];else input.value=c[k];
      });outputs(root,c);
    }

    function playPreview(){
      stopPreview();
      const p=current(),list=refs(p);if(!p||!list[selected])return;
      const c=cfg(p.id,selected),img=panel.querySelector("[data-preview-image]");if(!img||!img.src)return;
      img.style.opacity=c.opacity;img.style.maxWidth=c.maxWidth+"%";img.style.borderRadius=c.radius+"px";img.style.transform=`scale(${c.scale}) rotate(${c.rotate}deg)`;
      const b=`scale(${c.scale}) rotate(${c.rotate}deg)`;
      if(c.entrance!=="none"){
        let f=[{opacity:0},{opacity:1}];
        if(c.entrance==="slide-up")f=[{opacity:0,transform:`translateY(34px) ${b}`},{opacity:1,transform:b}];
        if(c.entrance==="zoom-in")f=[{opacity:0,transform:`scale(${c.scale*.78})`},{opacity:1,transform:b}];
        if(c.entrance==="blur")f=[{opacity:0,filter:"blur(14px)"},{opacity:1,filter:"blur(0)"}];
        const a=img.animate(f,{duration:c.entranceDuration,delay:c.entranceDelay,easing:"ease",fill:"both"});previewAnims.push(a);
      }
      if(c.idle!=="none"){
        const a=c.idleAmount;let f=[{transform:b},{transform:b}];
        if(c.idle==="float")f=[{transform:b},{transform:`translateY(${-7*a}px) ${b}`},{transform:b}];
        if(c.idle==="sway")f=[{transform:`rotate(${-0.6*a}deg) ${b}`},{transform:`rotate(${0.6*a}deg) ${b}`},{transform:`rotate(${-0.6*a}deg) ${b}`}];
        if(c.idle==="breathe")f=[{transform:b},{transform:`scale(${c.scale*(1+.018*a)})`},{transform:b}];
        if(c.idle==="tremble")f=[{transform:b},{transform:`translate(${-a}px,0) ${b}`},{transform:`translate(${a}px,${-a}px) ${b}`},{transform:b}];
        const t=setTimeout(()=>{const x=img.animate(f,{duration:c.idleSpeed,easing:c.idle==="tremble"?"linear":"ease-in-out",iterations:Infinity});previewAnims.push(x)},c.entranceDuration+c.entranceDelay);
        previewAnims.push({cancel(){clearTimeout(t)}});
      }
      if(c.exit!=="none"&&c.exitAfter>0){
        const t=setTimeout(()=>{const x=img.animate([{opacity:1},{opacity:0}],{duration:c.exitDuration,easing:"ease-in-out",fill:"forwards"});previewAnims.push(x)},c.exitAfter);
        previewAnims.push({cancel(){clearTimeout(t)}});
      }
    }

    function render(){
      if(!panel)return;
      const p=current(),list=refs(p),tabs=panel.querySelector("[data-tabs]");
      panel.querySelector("[data-page]").textContent=p?(p.title||"未命名 Node"):"沒有選取 Node";tabs.innerHTML="";
      if(!p||!list.length){
        selected=0;panel.querySelector("[data-preview-image]").style.display="none";panel.querySelector("[data-empty]").style.display="";panel.querySelector(".fh-img-controls").classList.add("disabled");return;
      }
      panel.querySelector(".fh-img-controls").classList.remove("disabled");if(selected>=list.length)selected=0;
      list.forEach((r,i)=>{const b=document.createElement("button");b.textContent="圖片 "+(i+1);b.classList.toggle("active",i===selected);b.onclick=()=>{selected=i;render()};tabs.appendChild(b)});
      const img=panel.querySelector("[data-preview-image]"),empty=panel.querySelector("[data-empty]"),src=resolveSrc(list[selected].src);
      if(src){img.src=src;img.style.display="";empty.style.display="none"}else{img.removeAttribute("src");img.style.display="none";empty.style.display="";empty.textContent="找不到本機預覽，但 Reader 仍會依圖片順序套用效果"}
      bind(panel,cfg(p.id,selected));
    }

    panel=build();
    const open=index=>{if(Number.isInteger(index)&&index>=0)selected=index;render();panel.classList.add("open")};

    // =====================================================
    // 素材庫圖片卡
    // =====================================================

    function materialItems(){
      try{return window.MaterialLibraryAPI&&typeof MaterialLibraryAPI.load==="function"?MaterialLibraryAPI.load():[]}catch(_){return[]}
    }
    function isImage(item){
      if(!item)return false;
      const type=String(item.type||item.mime||"").toLowerCase(),data=String(item.data||"").slice(0,80).toLowerCase(),name=String(item.name||"");
      return type==="image"||type.startsWith("image/")||data.startsWith("data:image/")||/\.(png|jpe?g|gif|webp|bmp|svg|avif|apng)$/i.test(name);
    }
    function materialIndex(p,item){
      const list=refs(p),data=String(item.data||"");let id="";
      try{
        if(window.PixivImageAssets&&PixivImageAssets.assets){
          const f=Object.entries(PixivImageAssets.assets).find(([,v])=>String(v)===data);if(f)id=f[0];
        }
      }catch(_){}
      if(id){const i=list.findIndex(r=>r.src==="local-image://"+id);if(i>=0)return i}
      return list.findIndex(r=>r.src===data);
    }
    function enhanceCards(){
      const list=document.getElementById("material-library-list");if(!list)return false;
      list.querySelectorAll(".material-item").forEach(card=>{
        if(card.querySelector("."+CARD))return;
        const item=card.__materialItem||materialItems()[Number(card.dataset.idx)];if(!isImage(item))return;
        const b=document.createElement("button");b.type="button";b.className=CARD;b.textContent="✨ 圖片特效";
        b.addEventListener("pointerdown",e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()},true);
        b.onclick=e=>{
          e.preventDefault();e.stopPropagation();const p=current();if(!p)return;
          const i=materialIndex(p,item);
          if(i<0){alert("這張素材目前還沒有出現在這個 Node 正文中。\n請先把圖片拖進正文，再按「✨ 圖片特效」。");return}
          open(i);
        };
        card.appendChild(b);
      });return true;
    }
    function installLib(){
      const list=document.getElementById("material-library-list");if(!list)return false;
      libraryObserver?.disconnect();libraryObserver=new MutationObserver(()=>requestAnimationFrame(enhanceCards));libraryObserver.observe(list,{childList:true,subtree:true});enhanceCards();return true;
    }
    const libWait=setInterval(()=>{if(installLib())clearInterval(libWait)},500);

    // 排版工作室入口
    function attachStudio(){
      const host=document.querySelector(".rls-window")||document.querySelector(".rls-panel")||document.querySelector("#readerLayoutStudio");if(!host||host.querySelector("."+STUDIO))return;
      const block=document.createElement("section");block.className=STUDIO;block.innerHTML="<strong>🖼 圖片演出工作室</strong><span>靜態／動態圖片的進場、持續、退場、景深與濾鏡。</span><button type='button'>開啟 Image Motion Studio</button>";
      block.querySelector("button").onclick=()=>open();(host.querySelector(".rls-side")||host.querySelector(".rls-panel")||host).appendChild(block);
    }
    const studioObs=new MutationObserver(attachStudio);studioObs.observe(document.body,{childList:true,subtree:true});attachStudio();

    const header=document.querySelector(".pixiv-editor-container header, header");
    if(header&&!document.getElementById(OPEN)){openButton=document.createElement("button");openButton.id=OPEN;openButton.textContent="🖼 圖片演出";openButton.onclick=()=>open();header.appendChild(openButton)}

    const onPage=()=>{selected=0;if(panel.classList.contains("open"))render()};
    let unsub=null;try{if(core&&typeof core.on==="function")unsub=core.on("page:selected",onPage)}catch(_){}
    document.addEventListener("gamebook:page:selected",onPage);

    const removeStyle=api.addStyle("image-motion-studio-editor",`
#${PANEL}{position:fixed;inset:0;z-index:2147482900;display:none;align-items:center;justify-content:center;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));background:rgba(14,18,22,.64);font-family:system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif}
#${PANEL}.open{display:flex}#${PANEL} *{box-sizing:border-box}.fh-img-dialog{width:min(960px,97vw);max-height:92dvh;display:flex;flex-direction:column;overflow:hidden;border-radius:18px;background:#fff;color:#263238;box-shadow:0 24px 80px rgba(0,0,0,.45)}
.fh-img-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:13px 15px;background:#263238;color:#fff}.fh-img-head strong{display:block;font-size:17px}.fh-img-head small{display:block;opacity:.72}.fh-img-head>div:last-child{display:flex;gap:6px}.fh-img-body{min-height:0;overflow:auto;padding:14px}
.fh-img-preview{min-height:260px;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:20px;border:1px solid #dbe2e7;border-radius:15px;background:#f3f6f8}.fh-img-preview img{display:block;max-height:350px;height:auto;object-fit:contain;will-change:transform,opacity,filter}
.fh-img-tabs,.fh-img-presets,.fh-img-actions{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}.fh-img-tabs button.active{background:#455a64!important;color:#fff!important}.fh-img-presets button{background:#f5f8fa!important;color:#38505e!important;border:1px solid #ced9df!important}
.fh-img-controls{display:grid;grid-template-columns:1fr 1fr;gap:9px}.fh-img-controls.disabled{opacity:.4;pointer-events:none}.fh-img-controls>label{display:grid;gap:5px;padding:9px;border:1px solid #e0e5e9;border-radius:10px;background:#fafbfc;font-size:12px;font-weight:700}.fh-img-controls input,.fh-img-controls select{width:100%}.fh-img-controls output{color:#32698b;font-weight:800}.fh-img-controls .check{display:flex;flex-direction:row;align-items:center}.fh-img-controls .check input{width:auto}
.fh-img-note{margin-top:12px;padding:10px;border-radius:10px;background:#f4f6f7;color:#667780;font-size:11px;line-height:1.6}.${CARD}{width:100%!important;margin-top:5px!important;padding:5px 7px!important;border-radius:12px!important;background:#546e7a!important;color:#fff!important;font-size:10px!important}
.${STUDIO}{display:flex;flex-direction:column;gap:5px;margin-top:10px;padding:10px;border:1px solid #b6cad5;border-radius:10px;background:#f2f9fc;color:#3e5e6f}.${STUDIO}>span{font-size:11px}
@media(max-width:700px){#${PANEL}{padding:0}.fh-img-dialog{width:100vw;height:100dvh;max-height:none;border-radius:0}.fh-img-head{position:sticky;top:0;z-index:4;padding-top:max(10px,env(safe-area-inset-top))}.fh-img-controls{grid-template-columns:1fr}.fh-img-preview{min-height:210px;padding:14px}}
`);

    window.FirehahaImageMotionStudio={
      version:"1.0.1",open,
      get:(pageId,index)=>clone(cfg(pageId,index)),
      set:(pageId,index,value)=>{bucket(pageId)[String(index)]=norm(value);render();return true},
      listImages:pageId=>{const p=pages().find(x=>String(x.id)===String(pageId));return p?clone(refs(p)):[]}
    };

    api.toast("Image Motion Studio V1.0.1 已啟用：動畫分層與防重播已修正");

    return ()=>{
      clearInterval(saveTimer);clearInterval(libWait);stopPreview();libraryObserver?.disconnect();studioObs.disconnect();
      try{unsub?.()}catch(_){}
      document.removeEventListener("gamebook:page:selected",onPage);
      removeReader();removeStyle();openButton?.remove();panel?.remove();
      document.querySelectorAll("."+CARD).forEach(n=>n.remove());document.querySelectorAll("."+STUDIO).forEach(n=>n.remove());
      delete window.FirehahaImageMotionStudio;
    };
  }
});
