// @firehaha-plugin {"id":"official.universal-damage-dice","name":"通用傷害骰","version":"1.0.5","author":"Firehaha","description":"獨立於舊傷害骰系統的通用傷害層：支援通用傷害骰、預設一次鎖定、可重骰 N 次、指定單顆重骰、以及對一般數值扣除傷害。"}
FirehahaPlugins.register({
  id: "official.universal-damage-dice",

  setup(api) {
    "use strict";

    const css = `
<style data-fh-universal-damage-dice>
.fh-udmg{
  box-sizing:border-box;
  margin:10px 0;
  padding:10px 12px;
  border:1px solid #d6dee7;
  border-radius:12px;
  background:#f8fafc;
  color:#26323c;
  font:650 13px/1.45 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;
}
.fh-udmg-row{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  align-items:center;
}
.fh-udmg-title{font-weight:850}
.fh-udmg-total{
  min-width:42px;
  font-size:20px;
  font-weight:900;
  color:#17212b;
}
.fh-udmg-detail,.fh-udmg-note{
  margin-top:5px;
  color:#64748b;
  font-size:11px;
}
.fh-udmg button{
  appearance:none;
  border:1px solid #c8d2dc;
  border-radius:9px;
  background:#fff;
  color:#334155;
  padding:7px 10px;
  font:750 12px/1.2 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;
  cursor:pointer;
}
.fh-udmg button:disabled{
  opacity:.48;
  cursor:default;
}
body.reader-dark .fh-udmg{
  background:#1d2730;
  border-color:#43505c;
  color:#eef4f8;
}
body.reader-dark .fh-udmg button{
  background:#25313b;
  border-color:#506173;
  color:#eef4f8;
}
body.reader-dark .fh-udmg-total{color:#fff}
body.reader-dark .fh-udmg-detail,
body.reader-dark .fh-udmg-note{color:#bac5ce}
</style>`;

    const runtime = String.raw`
(function(){
"use strict";

if(window.__fhUniversalDamageDice105)return;
window.__fhUniversalDamageDice105=true;

if(typeof applyAdventure!=="function"){
  console.warn("[Universal Damage] 找不到 applyAdventure");
  return;
}

const oldApplyAdventure=applyAdventure;
const states=new Map();
const appliedReductions=new Set();

function C(v){return String(v==null?"":v).trim()}
function E(v){
  return C(v)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}
function pageKey(page){
  if(page){
    for(const k of ["id","pageId","index","no","number","title"]){
      if(page[k]!=null&&C(page[k]))return k+":"+C(page[k]);
    }
  }
  try{
    if(typeof currentId!=="undefined"&&C(currentId))return "current:"+C(currentId);
  }catch(_){}
  return "unknown";
}
function parseFormula(formula){
  const m=C(formula).match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if(!m)return null;
  const count=Number(m[1]||1);
  const sides=Number(m[2]);
  const bonus=Number(m[3]||0);
  if(
    !Number.isInteger(count)||count<1||count>100||
    !Number.isInteger(sides)||sides<2||sides>1000
  )return null;
  return {
    formula:C(formula),
    count:count,
    sides:sides,
    bonus:bonus
  };
}
function rollOne(sides){
  return Math.floor(Math.random()*sides)+1;
}
function resultFrom(formula,rolls){
  const f=parseFormula(formula);
  if(!f)return null;
  const total=rolls.reduce(function(sum,n){return sum+Number(n||0)},f.bonus);
  return {
    formula:f.formula,
    count:f.count,
    sides:f.sides,
    bonus:f.bonus,
    rolls:rolls.slice(),
    total:total,
    breakdown:
      f.formula+
      "["+rolls.join(",")+"]"+
      (f.bonus>0?("+"+f.bonus):(f.bonus<0?String(f.bonus):""))+
      "="+total
  };
}
function rollAll(formula){
  const f=parseFormula(formula);
  if(!f)return null;
  const rolls=[];
  for(let i=0;i<f.count;i++)rolls.push(rollOne(f.sides));
  return resultFrom(f.formula,rolls);
}
function ordinalIndex(text){
  const t=C(text).replace(/\s+/g,"");
  const map={
    "第一顆":0,"第1顆":0,"1":0,
    "第二顆":1,"第2顆":1,"2":1,
    "第三顆":2,"第3顆":2,"3":2,
    "第四顆":3,"第4顆":3,"4":3,
    "第五顆":4,"第5顆":4,"5":4,
    "第六顆":5,"第6顆":5,"6":5,
    "第七顆":6,"第7顆":6,"7":6,
    "第八顆":7,"第8顆":7,"8":7
  };
  return Object.prototype.hasOwnProperty.call(map,t)?map[t]:null;
}
function getAdventure(){
  try{
    if(typeof memorySave!=="undefined"&&memorySave&&memorySave.adventure){
      return memorySave.adventure;
    }
  }catch(_){}
  try{
    if(window.memorySave&&window.memorySave.adventure){
      return window.memorySave.adventure;
    }
  }catch(_){}
  return null;
}
function persistSafe(){
  try{
    if(typeof persist==="function")persist();
  }catch(error){
    console.warn("[Universal Damage] persist 失敗",error);
  }
}

function rerenderSafe(){
  try{
    if(typeof renderAdventure==="function"){
      setTimeout(
        function(){
          try{
            renderAdventure();
          }catch(error){
            console.warn(
              "[Universal Damage] renderAdventure 失敗",
              error
            );
          }
        },
        0
      );
    }
  }catch(_){}
}
function ensureStore(){
  const a=getAdventure();
  if(!a)return null;
  a.universalDamage=
    a.universalDamage&&typeof a.universalDamage==="object"
      ?a.universalDamage
      :{};
  a.values=
    a.values&&typeof a.values==="object"
      ?a.values
      :{};
  return a;
}
function saveResult(state){
  const a=ensureStore();
  if(!a||!state.result)return false;

  a.universalDamage[state.name]={
    name:state.name,
    formula:state.formula,
    rolls:state.result.rolls.slice(),
    bonus:state.result.bonus,
    total:state.result.total,
    breakdown:state.result.breakdown,
    rerollsUsed:state.rerollsUsed,
    maxRerolls:state.maxRerolls,
    dieIndex:state.dieIndex,
    committed:true
  };

  state.committed=true;
  persistSafe();

  try{
    document.dispatchEvent(
      new CustomEvent(
        "firehaha:universal-damage-changed",
        {
          detail:{
            name:state.name,
            total:state.result.total,
            rolls:state.result.rolls.slice()
          }
        }
      )
    );
  }catch(_){}

  /*
   * 保留一次相容性重繪，讓其他讀取 universalDamage 的 UI 有機會同步。
   * v1.0.4 的扣值本身已不依賴這次重繪。
   */
  rerenderSafe();

  return true;
}
function loadSaved(name){
  const a=getAdventure();
  const raw=a&&a.universalDamage?a.universalDamage[C(name)]:null;
  if(!raw||!Number.isFinite(Number(raw.total)))return null;
  return {
    formula:C(raw.formula),
    rolls:Array.isArray(raw.rolls)?raw.rolls.map(Number).filter(Number.isFinite):[],
    bonus:Number(raw.bonus||0),
    total:Number(raw.total),
    breakdown:C(raw.breakdown)
  };
}
function stateKey(page,name,index){
  return pageKey(page)+"::"+C(name)+"::"+index;
}
function ensureState(page,name,index,formula,maxRerolls,dieIndex){
  const key=stateKey(page,name,index);
  let s=states.get(key);
  if(!s){
    const saved=loadSaved(name);
    s={
      key:key,
      page:page,
      name:C(name),
      formula:C(formula),
      maxRerolls:Number(maxRerolls||0),
      rerollsUsed:0,
      dieIndex:dieIndex,
      result:saved,
      committed:!!saved,
      reductions:[]
    };
    states.set(key,s);
  }else{
    s.page=page;
    s.formula=C(formula);
    s.maxRerolls=Number(maxRerolls||0);
    s.dieIndex=dieIndex;
  }
  return s;
}
function getPanel(key){
  return Array.from(document.querySelectorAll(".fh-udmg"))
    .find(function(el){return C(el.dataset.udmgKey)===key})||null;
}
function paint(state){
  const panel=getPanel(state.key);
  if(!panel)return;
  const total=panel.querySelector(".fh-udmg-total");
  const detail=panel.querySelector(".fh-udmg-detail");
  const note=panel.querySelector(".fh-udmg-note");
  const rollBtn=panel.querySelector("[data-udmg-action='roll']");
  const rerollBtn=panel.querySelector("[data-udmg-action='reroll']");
  const confirmBtn=panel.querySelector("[data-udmg-action='confirm']");

  if(total){
    total.textContent=state.result?String(state.result.total):"尚未擲骰";
  }
  if(detail){
    detail.textContent=state.result?state.result.breakdown:"";
  }

  const remain=Math.max(0,state.maxRerolls-state.rerollsUsed);

  if(note){
    if(state.maxRerolls<=0){
      note.textContent=
        state.committed
          ?"本次傷害骰已鎖定，不能重骰"
          :"擲出後立即鎖定";
    }else{
      const target=
        state.dieIndex==null
          ?"整組重骰"
          :"只重骰第 "+(state.dieIndex+1)+" 顆";
      note.textContent=
        target+
        "｜剩餘重骰 "+remain+" 次"+
        (state.committed?"｜傷害已確認":"");
    }
  }

  if(rollBtn)rollBtn.disabled=!!state.result;
  if(rerollBtn){
    rerollBtn.disabled=
      !state.result||
      state.committed||
      remain<=0;
  }
  if(confirmBtn){
    confirmBtn.disabled=
      !state.result||
      state.committed;
  }
}
function bindPanels(){
  document.querySelectorAll(".fh-udmg").forEach(function(panel){
    const s=states.get(C(panel.dataset.udmgKey));
    if(s)paint(s);
  });
}
function initialRoll(state){
  if(state.result)return;
  const r=rollAll(state.formula);
  if(!r)return;
  state.result=r;

  if(state.maxRerolls<=0){
    if(saveResult(state)){
      state.reductions.forEach(function(rule){
        rule.lastResult=applyReduction(state.page,rule.valueName,state.name);
      });
      document.querySelectorAll("[data-udmg-reduction]").forEach(function(el){
        const key=C(el.dataset.udmgReduction);
        const rule=state.reductions.find(function(r){return r.key===key});
        if(!rule||!rule.lastResult)return;
        const rr=rule.lastResult;
        el.textContent=rr.ready
          ?rule.valueName+"："+rr.before+" − "+rr.amount+" = "+rr.after
          :(rr.message||("等待通用傷害骰："+state.name));
      });
    }
  }

  paint(state);
}
function reroll(state){
  if(
    !state.result||
    state.committed||
    state.rerollsUsed>=state.maxRerolls
  )return;

  const f=parseFormula(state.formula);
  if(!f)return;

  let rolls=state.result.rolls.slice();

  if(state.dieIndex==null){
    rolls=[];
    for(let i=0;i<f.count;i++)rolls.push(rollOne(f.sides));
  }else{
    if(
      state.dieIndex<0||
      state.dieIndex>=rolls.length
    ){
      console.warn(
        "[Universal Damage] 沒有第 "+
        (state.dieIndex+1)+
        " 顆骰"
      );
      return;
    }
    rolls[state.dieIndex]=rollOne(f.sides);
  }

  state.result=resultFrom(state.formula,rolls);
  state.rerollsUsed++;
  paint(state);
}
function confirm(state){
  if(!state.result||state.committed)return;

  if(!saveResult(state))return;

  /*
   * v1.0.4：
   * 確認傷害就是 commit 點。
   * 不再等待 Reader 下一次重新整理才執行 [減少通用傷害]。
   */
  state.reductions.forEach(function(rule){
    const result=applyReduction(
      state.page,
      rule.valueName,
      state.name
    );

    rule.lastResult=result||null;
  });

  paint(state);

  /*
   * 直接更新目前畫面上的扣值訊息。
   * 即使 Firehaha 的 renderAdventure 沒有重新掛回當前頁，
   * 使用者也會立刻看到 HP 扣除結果。
   */
  document.querySelectorAll("[data-udmg-reduction]").forEach(function(el){
    const key=C(el.dataset.udmgReduction);
    const rule=state.reductions.find(function(r){return r.key===key});
    if(!rule||!rule.lastResult)return;

    const r=rule.lastResult;

    if(r.ready){
      el.textContent=
        rule.valueName+
        "："+r.before+
        " − "+r.amount+
        " = "+r.after;
    }else{
      el.textContent=
        r.message||
        ("等待通用傷害骰："+state.name);
    }
  });
}
document.addEventListener(
  "click",
  function(event){
    const button=
      event.target&&event.target.closest
        ?event.target.closest(".fh-udmg button[data-udmg-action]")
        :null;

    if(!button)return;

    const panel=button.closest(".fh-udmg");
    const state=states.get(C(panel&&panel.dataset.udmgKey));
    if(!state)return;

    event.preventDefault();
    event.stopPropagation();

    const action=C(button.dataset.udmgAction);

    if(action==="roll")initialRoll(state);
    else if(action==="reroll")reroll(state);
    else if(action==="confirm")confirm(state);
  },
  true
);

function reductionFingerprint(page,valueName,damageName,total){
  return [
    pageKey(page),
    C(valueName),
    C(damageName),
    Number(total)
  ].join("::");
}
function applyReduction(page,valueName,damageName){
  const a=ensureStore();
  if(!a)return null;

  const dmg=a.universalDamage&&a.universalDamage[C(damageName)];
  if(!dmg||!Number.isFinite(Number(dmg.total))){
    return {
      ready:false,
      message:"等待通用傷害骰："+C(damageName)
    };
  }

  const before=Number(a.values[C(valueName)]||0);
  const amount=Number(dmg.total);
  const fp=reductionFingerprint(page,valueName,damageName,amount);

  if(!appliedReductions.has(fp)){
    a.values[C(valueName)]=Math.max(0,before-amount);
    appliedReductions.add(fp);
    persistSafe();

    try{
      document.dispatchEvent(
        new CustomEvent(
          "firehaha:adventure-state-changed",
          {
            detail:{
              type:"universal-damage",
              name:C(valueName),
              damageName:C(damageName),
              before:before,
              damage:amount,
              after:a.values[C(valueName)]
            }
          }
        )
      );
    }catch(_){}
  }

  return {
    ready:true,
    before:before,
    amount:amount,
    after:Number(a.values[C(valueName)]||0)
  };
}
function panelHtml(state){
  const value=state.result?String(state.result.total):"尚未擲骰";
  const rerollButton=
    state.maxRerolls>0
      ?'<button type="button" data-udmg-action="reroll">↻ 重骰</button>'
      :"";
  const confirmButton=
    state.maxRerolls>0
      ?'<button type="button" data-udmg-action="confirm">✓ 確認傷害</button>'
      :"";

  return (
    '<div class="fh-udmg" data-udmg-key="'+E(state.key)+'">'+
      '<div class="fh-udmg-row">'+
        '<span class="fh-udmg-title">🎲 '+E(state.name)+'</span>'+
        '<span class="fh-udmg-total">'+E(value)+'</span>'+
        '<button type="button" data-udmg-action="roll">擲傷害</button>'+
        rerollButton+
        confirmButton+
      '</div>'+
      '<div class="fh-udmg-detail">'+E(state.result?state.result.breakdown:"")+'</div>'+
      '<div class="fh-udmg-note"></div>'+
    '</div>'
  );
}
function prepare(source,page){
  let text=String(source||"");
  const items=[];
  let occurrence=0;

  /*
   * 支援：
   * [通用傷害骰:長劍|1d8+3]
   *
   * [可重骰傷害骰:2]
   * [通用傷害骰:長劍|2d6+3]
   *
   * [可重骰傷害骰:2|第一顆]
   * [通用傷害骰:長劍|2d6+3]
   *
   * [不能重骰傷害骰]
   * [通用傷害骰:長劍|1d8+3]
   *
   * 沒寫控制標籤時，預設不可重骰。
   *
   * v1.0.1 修正：
   * 可直接匹配 [通用傷害骰:名稱|骰式]，
   * 不再錯誤要求前面多一個 "["。
   */

  /*
   * v1.0.2：
   * Firehaha 正文有時不是純文字，而會變成：
   *
   * <div>[可重骰傷害骰:2]</div>
   * <div>[通用傷害骰:長劍|1d8+3]</div>
   *
   * 因此不能只接受兩個標籤之間的空白。
   * 這裡分成兩輪：
   * 1. 先吃「控制標籤 + 中間 HTML 包裝 + 通用傷害骰」
   * 2. 再處理沒有控制標籤的普通通用傷害骰。
   */

  function buildDamageToken(
    whole,
    ruleText,
    countText,
    dieText,
    nameText,
    formulaText,
    preservedGap
  ){
    const name=C(nameText);
    const formula=C(formulaText);
    const f=parseFormula(formula);

    if(!name||!f){
      return whole;
    }

    let maxRerolls=0;
    let dieIndex=null;

    if(C(ruleText).startsWith("可")){
      maxRerolls=Math.max(
        1,
        Math.floor(Number(countText||1))
      );

      if(dieText){
        dieIndex=ordinalIndex(dieText);

        if(dieIndex==null){
          console.warn(
            "[Universal Damage] 無法辨識指定骰：",
            dieText
          );
          return whole;
        }

        if(dieIndex>=f.count){
          console.warn(
            "[Universal Damage] "+
            formula+
            " 沒有第 "+
            (dieIndex+1)+
            " 顆骰"
          );
          return whole;
        }
      }
    }

    const state=
      ensureState(
        page,
        name,
        occurrence++,
        formula,
        maxRerolls,
        dieIndex
      );

    const token=
      "@@FH_UDMG_"+items.length+"@@";

    items.push({
      token:token,
      html:panelHtml(state)
    });

    /*
     * 保留 </div><div> 之類的中間 HTML，
     * 只移除控制標籤本身。
     */
    return String(preservedGap||"")+token;
  }

  // 第一輪：明確有控制標籤。
  text=text.replace(
    /\[(不能重骰傷害骰|可重骰傷害骰)(?::\s*(\d+))?(?:\s*\|\s*([^\]]+?))?\]((?:\s|<[^>]+>)*)\[通用傷害骰\s*:\s*([^|\]\r\n]+?)\s*\|\s*([^\]\r\n]+?)\]/gi,
    function(
      whole,
      ruleText,
      countText,
      dieText,
      gap,
      nameText,
      formulaText
    ){
      return buildDamageToken(
        whole,
        ruleText,
        countText,
        dieText,
        nameText,
        formulaText,
        gap
      );
    }
  );

  // 第二輪：沒有控制標籤，預設不可重骰。
  text=text.replace(
    /\[通用傷害骰\s*:\s*([^|\]\r\n]+?)\s*\|\s*([^\]\r\n]+?)\]/gi,
    function(
      whole,
      nameText,
      formulaText
    ){
      return buildDamageToken(
        whole,
        "",
        "",
        "",
        nameText,
        formulaText,
        ""
      );
    }
  );

  /*
   * [減少通用傷害:敵人HP|長劍]
   */
  text=text.replace(
    /\[減少通用傷害\s*:\s*([^|\]\r\n]+?)\s*\|\s*([^\]\r\n]+?)\]/gi,
    function(whole,valueName,damageName){
      valueName=C(valueName);
      damageName=C(damageName);

      /*
       * 找本頁對應的通用傷害骰。
       * 可重骰模式在「確認傷害」之前，不在 render 階段扣值。
       */
      const state=Array.from(states.values()).find(function(s){
        return (
          pageKey(s.page)===pageKey(page)&&
          s.name===damageName
        );
      });

      if(state&&state.maxRerolls>0&&!state.committed){
        const ruleKey=
          state.key+"::reduce::"+valueName+"::"+damageName;

        if(!state.reductions.some(function(r){return r.key===ruleKey})){
          state.reductions.push({
            key:ruleKey,
            valueName:valueName,
            damageName:damageName,
            lastResult:null
          });
        }

        return (
          '<span class="fh-udmg-note" data-udmg-reduction="'+
          E(ruleKey)+
          '">等待確認傷害：'+
          E(damageName)+
          '</span>'
        );
      }

      /*
       * v1.0.5：不可重骰也先登記 reduction。
       * 這樣第一次擲骰 commit 時即可立刻扣值，不必等整頁重繪。
       */
      if(state){
        const ruleKey=state.key+"::reduce::"+valueName+"::"+damageName;
        let rule=state.reductions.find(function(r){return r.key===ruleKey});
        if(!rule){
          rule={
            key:ruleKey,
            valueName:valueName,
            damageName:damageName,
            lastResult:null
          };
          state.reductions.push(rule);
        }

        if(state.committed){
          rule.lastResult=applyReduction(page,valueName,damageName);
        }

        const result=rule.lastResult;
        return (
          '<span class="fh-udmg-note" data-udmg-reduction="'+E(ruleKey)+'">'+
          (
            result&&result.ready
              ?E(valueName)+"："+result.before+" − "+result.amount+" = "+result.after
              :E(result?result.message:("等待通用傷害骰："+damageName))
          )+
          '</span>'
        );
      }

      const result=applyReduction(page,valueName,damageName);
      return (
        '<span class="fh-udmg-note">'+
        E(
          result&&result.ready
            ?valueName+"："+result.before+" − "+result.amount+" = "+result.after
            :(result?result.message:"等待通用傷害")
        )+
        '</span>'
      );
    }
  );

  return {
    text:text,
    restore:function(html){
      let out=String(html||"");
      items.forEach(function(item){
        out=out.split(item.token).join(item.html);
      });
      return out;
    }
  };
}

applyAdventure=function(page){
  const cloned=Object.assign({},page||{});
  const field=
    cloned.content!=null
      ?"content"
      :"text";

  const prepared=
    prepare(
      cloned[field]||"",
      page
    );

  cloned[field]=prepared.text;

  let html=
    oldApplyAdventure.call(
      this,
      cloned
    );

  html=
    prepared.restore(
      html
    );

  setTimeout(bindPanels,0);

  return html;
};

window.FirehahaUniversalDamage={
  version:"1.0.5",

  get:function(name){
    const a=getAdventure();
    const raw=
      a&&a.universalDamage
        ?a.universalDamage[C(name)]
        :null;

    return raw
      ?JSON.parse(JSON.stringify(raw))
      :null;
  },

  getAll:function(){
    const a=getAdventure();
    return Object.assign(
      {},
      a&&a.universalDamage
        ?a.universalDamage
        :{}
    );
  },

  reset:function(){
    states.clear();
    appliedReductions.clear();

    const a=getAdventure();
    if(a){
      a.universalDamage={};
    }
  }
};

try{
  if(
    window.FirehahaReaderLifecycle&&
    typeof window.FirehahaReaderLifecycle.register==="function"
  ){
    window.FirehahaReaderLifecycle.register(
      "universal-damage-dice",
      {
        "reset-runtime":
          window.FirehahaUniversalDamage.reset,
        "before-restart":
          window.FirehahaUniversalDamage.reset,
        "before-load":
          function(){
            states.clear();
            appliedReductions.clear();
          }
      }
    );
  }
}catch(_){}

console.info(
  "[Universal Damage] 1.0.5 已載入"
);
})();
`;

    const removeTransform =
      api.registerReaderTransform(
        "reader",
        function(html, context) {
          html=
            String(
              html==null
                ?""
                :html
            );

          if(
            html.includes(
              "__fhUniversalDamageDice105"
            )
          ){
            return html;
          }

          if(/<\/head\s*>/i.test(html)){
            html=
              html.replace(
                /<\/head\s*>/i,
                css+"\n</head>"
              );
          }else{
            html=
              css+html;
          }

          const marker=
            "function renderAdventure(){";

          if(!html.includes(marker)){
            console.warn(
              "[Universal Damage] 找不到 Reader 插入位置"
            );

            return html;
          }

          return html.replace(
            marker,
            runtime+
            "\n"+
            marker
          );
        },
        340
      );

    api.toast(
      "通用傷害骰 1.0.5 已啟用"
    );

    return function cleanup() {
      removeTransform();
    };
  }
});
