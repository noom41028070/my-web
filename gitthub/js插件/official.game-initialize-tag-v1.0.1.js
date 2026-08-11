// @firehaha-plugin {"id":"official.game-initialize-tag","name":"遊戲初始化標籤","version":"1.0.1","author":"Firehaha","description":"把 [初始化] 解析成 Reader 原生 choice 虛擬選項，沿用 jump 的 visualStyle/freeLayout/animation 渲染；點擊後呼叫 official.new-game-and-save-slots 1.0.5 restartStory()。"}

FirehahaPlugins.register({
  id: "official.game-initialize-tag",

  setup(api) {
    "use strict";

    const MARK = "/* firehaha-game-initialize-tag-v1.0.1-native-choice */";

    const helperCode = String.raw`
${MARK}
function firehahaParseInitOptions(page){
  const raw=String(page&&page.content||"");
  const out=[];
  const re=/\[初始化(?::([^\]]*))?\]/gi;
  let m;

  function clamp(n,min,max,fallback){
    n=Number(n);
    return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
  }

  function color(v,fallback){
    v=String(v||"").trim();
    return /^#[0-9a-f]{6}$/i.test(v)?v:fallback;
  }

  function parseBool(v){
    v=String(v||"").trim().toLowerCase();
    return v==="1"||v==="true"||v==="是"||v==="yes";
  }

  while((m=re.exec(raw))){
    const body=String(m[1]||"").trim();
    const parts=body?body.split("|").map(x=>x.trim()).filter(Boolean):[];
    const label=parts.shift()||"開始遊戲";

    const style={
      preset:"plain",
      fontSize:18,
      color:"#222222",
      background:"#ffffff",
      opacity:0,
      radius:0,
      weight:500,
      italic:false,
      animation:"fade"
    };

    const free={
      enabled:false,
      x:50,
      y:50,
      width:30,
      height:12,
      z:10
    };

    let variant="link";

    parts.forEach(token=>{
      const lower=token.toLowerCase();

      if(["plain","elegant","solid","outline","glass","neon"].includes(lower)){
        style.preset=lower;
        return;
      }

      if(token==="簡潔")style.preset="plain";
      else if(token==="典雅")style.preset="elegant";
      else if(token==="實色")style.preset="solid";
      else if(token==="線框")style.preset="outline";
      else if(token==="玻璃")style.preset="glass";
      else if(token==="霓虹")style.preset="neon";

      else if(token==="文字")variant="link";
      else if(token==="按鈕")variant="button";
      else if(token==="卡片")variant="card";

      else {
        const kv=token.split("=");
        if(kv.length<2)return;

        const key=kv.shift().trim().toLowerCase();
        const value=kv.join("=").trim();

        if(key==="樣式"||key==="style"){
          const map={
            "簡潔":"plain","典雅":"elegant","實色":"solid",
            "線框":"outline","玻璃":"glass","霓虹":"neon"
          };
          style.preset=map[value]||value;
          if(!["plain","elegant","solid","outline","glass","neon"].includes(style.preset)){
            style.preset="plain";
          }
        }
        else if(key==="形式"||key==="variant"){
          const map={"文字":"link","按鈕":"button","卡片":"card"};
          variant=map[value]||value;
          if(!["link","button","card"].includes(variant))variant="link";
        }
        else if(key==="字體"||key==="字級"||key==="fontsize"){
          style.fontSize=clamp(value,10,96,18);
        }
        else if(key==="文字色"||key==="顏色"||key==="color"){
          style.color=color(value,"#222222");
        }
        else if(key==="背景"||key==="background"){
          style.background=color(value,"#ffffff");
        }
        else if(key==="透明"||key==="透明度"||key==="opacity"){
          style.opacity=clamp(value,0,1,0);
        }
        else if(key==="圓角"||key==="radius"){
          style.radius=clamp(value,0,80,0);
        }
        else if(key==="粗細"||key==="weight"){
          style.weight=clamp(value,300,900,500);
        }
        else if(key==="斜體"||key==="italic"){
          style.italic=parseBool(value);
        }
        else if(key==="動畫"||key==="animation"){
          const map={"無":"none","淡入":"fade","滑入":"slide","彈出":"pop","呼吸":"pulse"};
          style.animation=map[value]||value;
          if(!["none","fade","slide","pop","pulse"].includes(style.animation)){
            style.animation="none";
          }
        }
        else if(key==="位置"||key==="position"){
          const xy=value.split(",").map(Number);
          if(xy.length>=2){
            free.enabled=true;
            free.x=clamp(xy[0],0,100,50);
            free.y=clamp(xy[1],0,100,50);
          }
        }
        else if(key==="寬"||key==="width"){
          free.enabled=true;
          free.width=clamp(value,5,100,30);
        }
        else if(key==="高"||key==="height"){
          free.enabled=true;
          free.height=clamp(value,5,100,12);
        }
        else if(key==="層級"||key==="z"){
          free.enabled=true;
          free.z=Number(value)||10;
        }
      }
    });

    /*
     * 如果使用者選了非透明風格，但沒另外指定 opacity，
     * 給它可見背景；plain/outline 則保持透明。
     */
    if(
      style.opacity===0 &&
      ["solid","glass","neon","elegant"].includes(style.preset)
    ){
      style.opacity=.94;
    }

    out.push({
      type:"initialize",
      text:label,
      target:"",
      initVariant:variant,
      spacing:{top:0,right:0,bottom:0,left:0},
      freeLayout:free,
      visualStyle:style
    });
  }

  return out;
}

function firehahaStripInitTags(html){
  return String(html||"").replace(/\[初始化(?::[^\]]*)?\]/gi,"");
}
`;

    const oldContentChoices =
      'const contentHtml=applyAdventure(p),style=s.choiceStyle||"link",choiceBg=`linear-gradient(${Number(s.choiceAngle)||0}deg,${s.choiceBackground||"#fff"},${s.choiceBackground2||s.choiceBackground||"#fff"})`;const choices=(p.options||[]).filter(o=>o.text)';

    const newContentChoices =
      'const contentHtml=firehahaStripInitTags(applyAdventure(p)),style=s.choiceStyle||"link",choiceBg=`linear-gradient(${Number(s.choiceAngle)||0}deg,${s.choiceBackground||"#fff"},${s.choiceBackground2||s.choiceBackground||"#fff"})`;const choices=(p.options||[]).concat(firehahaParseInitOptions(p)).filter(o=>o.text)';

    const oldRenderTail =
      'if(o.type==="continuation")return `<div class="${wrapClass}" style="${layout}"><button class="choice choice-continuation" data-target="${esc(o.target||"")}" style="${custom}"><span>${esc(label)}</span><span class="continue-arrow" aria-hidden="true">›</span></button></div>`;return `<div class="${wrapClass}" style="${layout}"><button class="choice choice-${style}" data-target="${esc(o.target||"")}" style="${custom}">${esc(label)}</button></div>`';

    const newRenderTail =
      'if(o.type==="continuation")return `<div class="${wrapClass}" style="${layout}"><button class="choice choice-continuation" data-target="${esc(o.target||"")}" style="${custom}"><span>${esc(label)}</span><span class="continue-arrow" aria-hidden="true">›</span></button></div>`;if(o.type==="initialize"){const iv=["link","button","card"].includes(o.initVariant)?o.initVariant:"link";return `<div class="${wrapClass}" style="${layout}"><button type="button" class="choice choice-${iv} firehaha-init-choice" data-firehaha-init="1" style="${custom}">${esc(label)}</button></div>`}return `<div class="${wrapClass}" style="${layout}"><button class="choice choice-${style}" data-target="${esc(o.target||"")}" style="${custom}">${esc(label)}</button></div>`';

    const oldBind =
      'reader.querySelectorAll("[data-target]").forEach(b=>b.onclick=()=>{if(b.dataset.target)show(b.dataset.target)});const back=reader.querySelector(".back");';

    const newBind =
      'reader.querySelectorAll("[data-target]").forEach(b=>b.onclick=()=>{if(b.dataset.target)show(b.dataset.target)});reader.querySelectorAll("[data-firehaha-init]").forEach(b=>b.onclick=()=>{if(window.FirehahaNewGameSaveSlots&&typeof window.FirehahaNewGameSaveSlots.restartStory==="function"){window.FirehahaNewGameSaveSlots.restartStory()}else{const fallback=document.querySelector(".firehaha-new-game-btn");if(fallback)fallback.click();else if(typeof toast==="function")toast("請先啟用重新開始／存檔槽 1.0.5")}});const back=reader.querySelector(".back");';

    const removeTransform = api.registerReaderTransform(
      "reader",
      function(html, context) {
        html = String(html == null ? "" : html);

        if (html.includes(MARK)) return html;

        const helperMarker = 'function show(id,push=true){';

        if (!html.includes(helperMarker)) {
          console.warn(
            "[Game Initialize Tag] 找不到 Reader show() 插入位置",
            context || {}
          );
          return html;
        }

        if (!html.includes(oldContentChoices)) {
          console.warn(
            "[Game Initialize Tag] 找不到 choices 建立位置",
            context || {}
          );
          return html;
        }

        if (!html.includes(oldRenderTail)) {
          console.warn(
            "[Game Initialize Tag] 找不到 choice render 尾端",
            context || {}
          );
          return html;
        }

        if (!html.includes(oldBind)) {
          console.warn(
            "[Game Initialize Tag] 找不到 choice click 綁定位置",
            context || {}
          );
          return html;
        }

        html = html.replace(
          helperMarker,
          helperCode + "\n" + helperMarker
        );

        html = html.replace(
          oldContentChoices,
          newContentChoices
        );

        html = html.replace(
          oldRenderTail,
          newRenderTail
        );

        html = html.replace(
          oldBind,
          newBind
        );

        return html;
      },
      430
    );

    api.toast(
      "遊戲初始化標籤 1.0.1 已切換為原生 choice 渲染"
    );

    return function cleanup() {
      if (typeof removeTransform === "function") {
        removeTransform();
      }
    };
  }
});
