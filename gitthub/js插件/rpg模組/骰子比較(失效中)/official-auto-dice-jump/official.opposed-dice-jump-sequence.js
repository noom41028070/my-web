// @firehaha-plugin {"id":"official.opposed-dice-jump-sequence","name":"對抗骰先後攻跳轉","version":"2.0.0","author":"Firehaha","description":"獨立玩家骰/敵人骰先後攻與勝負跳頁。重寫版：不使用 MutationObserver、不依賴舊自動骰、不覆蓋 Reader DOM。"}
FirehahaPlugins.register({
  id: "official.opposed-dice-jump-sequence",

  setup(api) {
    "use strict";

    const css = `
<style data-fh-odj2>
.fh-odj2{max-width:540px;margin:14px auto;padding:12px 14px;box-sizing:border-box;border:1px solid #d4dce4;border-radius:14px;background:#f8fafc;color:#26323c;font:600 14px/1.45 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif}
.fh-odj2-title{text-align:center;font-weight:800;margin-bottom:9px}
.fh-odj2-row{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:9px;align-items:center}
.fh-odj2-row span{padding:9px 10px;border:1px solid #e0e6eb;border-radius:10px;background:#fff;text-align:center;min-width:0}
.fh-odj2-row b{display:block;font-size:12px;color:#607080;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fh-odj2-row strong{display:block;margin-top:2px;font-size:23px;color:#18232d}
.fh-odj2-row em{font-style:normal;font-size:11px;font-weight:900;color:#8a98a6}
.fh-odj2-msg{text-align:center;margin-top:9px;font-size:12px;color:#667684}
body.reader-dark .fh-odj2{background:#1d2730;border-color:#43505c;color:#eef4f8}
body.reader-dark .fh-odj2-row span{background:#25313b;border-color:#44535f}
body.reader-dark .fh-odj2-row b,body.reader-dark .fh-odj2-msg{color:#bac5ce}
body.reader-dark .fh-odj2-row strong{color:#fff}
</style>`;

    const patch = String.raw`
(function(){
"use strict";
if(window.__fhOpposedJumpV200)return;
window.__fhOpposedJumpV200=true;

const states=new Map();
const timers=new Set();

function C(v){return String(v==null?"":v).trim()}
function E(v){return C(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function later(fn,ms){const t=setTimeout(function(){timers.delete(t);fn()},ms);timers.add(t);return t}
function norm(v){return C(v).replace(/^(?:骰子|屬性|技能)\s*:/,"")}
function keyOf(pageId,rule){return C(pageId)+"::"+C(rule)}

function roll(formula){
  const m=C(formula).match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if(!m)return null;
  const count=Number(m[1]||1),sides=Number(m[2]),bonus=Number(m[3]||0);
  if(!Number.isInteger(count)||count<1||count>100||!Number.isInteger(sides)||sides<2||sides>1000)return null;
  const rolls=[];let total=bonus;
  for(let i=0;i<count;i++){const n=Math.floor(Math.random()*sides)+1;rolls.push(n);total+=n}
  return {formula:C(formula),rolls:rolls,bonus:bonus,total:total};
}

function findPlayerButton(name){
  const target=norm(name);
  const list=Array.from(document.querySelectorAll(".story-dice"));
  for(let i=list.length-1;i>=0;i--){
    const b=list[i];
    const names=[
      C(b.dataset.key),C(b.dataset.attribute),C(b.dataset.checkName),
      norm(b.dataset.key),norm(b.dataset.attribute),norm(b.dataset.checkName)
    ].filter(Boolean);
    if(names.includes(target))return b;
  }
  return null;
}

function readPlayerResult(button){
  if(!button)return null;
  const p=button.querySelector(".dice-process");
  const s=C(p&&p.textContent);
  if(!s||s.includes("點擊")||s.includes("擲骰中"))return null;
  const eq=Array.from(s.matchAll(/[＝=]\s*(-?\d+(?:\.\d+)?)/g));
  if(eq.length)return Number(eq[eq.length-1][1]);
  const ar=Array.from(s.matchAll(/→\s*(-?\d+(?:\.\d+)?)/g));
  return ar.length?Number(ar[ar.length-1][1]):null;
}

function getCard(k){
  const list=Array.from(document.querySelectorAll(".fh-odj2"));
  return list.find(function(card){return C(card.dataset.odjKey)===k})||null;
}

function paint(k){
  const s=states.get(k),card=getCard(k);
  if(!s||!card)return;
  const p=card.querySelector(".fh-odj2-player");
  const e=card.querySelector(".fh-odj2-enemy");
  const m=card.querySelector(".fh-odj2-msg");
  if(p)p.textContent=s.player==null?"等待玩家":String(s.player);
  if(e)e.textContent=s.enemy==null?"等待敵人":String(s.enemy);
  if(m)m.textContent=s.message||"";
}

function getMeta(card){
  return {
    player:C(card.dataset.odjPlayer),
    enemy:C(card.dataset.odjEnemy),
    formula:C(card.dataset.odjFormula),
    order:C(card.dataset.odjOrder),
    mode:C(card.dataset.odjMode),
    left:C(card.dataset.odjLeft),
    right:C(card.dataset.odjRight),
    tie:C(card.dataset.odjTie),
    delay:C(card.dataset.odjDelay)
  };
}

function jump(number,delay){
  const i=Number(number)-1;
  const p=Array.isArray(pages)&&Number.isInteger(i)&&i>=0&&i<pages.length?pages[i]:null;
  if(!p){console.warn("[對抗跳轉] 找不到第 "+number+" 頁");return}
  later(function(){if(typeof show==="function")show(p.id)},Math.max(0,Number(delay)||0));
}

function finish(k,meta){
  const s=states.get(k);
  if(!s||s.finished||s.player==null||s.enemy==null)return;
  let result="平手";
  if(s.player!==s.enemy){
    result=meta.mode==="低者勝"
      ?(s.player<s.enemy?"左勝":"右勝")
      :(s.player>s.enemy?"左勝":"右勝");
  }
  const target=result==="左勝"?meta.left:result==="右勝"?meta.right:meta.tie;
  s.finished=true;
  s.message=meta.mode+"｜"+result+"｜"+s.player+" VS "+s.enemy;
  paint(k);
  console.info("[對抗跳轉]",{玩家:s.player,敵人:s.enemy,結果:result,跳頁:target});
  jump(target,meta.delay);
}

function enemyTurn(k,meta){
  const s=states.get(k);
  if(!s||s.finished||s.enemy!=null)return;
  s.message=meta.enemy+" 擲骰中…";
  paint(k);

  later(function(){
    const r=roll(meta.formula);
    if(!r){s.message="敵人骰式錯誤："+meta.formula;paint(k);return}
    s.enemy=r.total;
    s.message=meta.enemy+"："+r.formula+" → "+r.rolls.join(", ")+(r.bonus?(r.bonus>0?" +":" ")+r.bonus:"")+" = "+r.total;
    paint(k);

    if(meta.order==="敵人先攻"){
      s.waitingPlayer=true;
      s.message+="｜等待玩家擲骰";
      paint(k);
    }else{
      finish(k,meta);
    }
  },300);
}

function waitPlayerResult(k,meta,clicked){
  const s=states.get(k);
  if(!s||s.finished||s.readingPlayer)return;
  s.readingPlayer=true;
  s.message="玩家擲骰中…";
  paint(k);
  const started=Date.now();

  (function poll(){
    const current=findPlayerButton(meta.player)||clicked;
    const value=readPlayerResult(current);

    if(Number.isFinite(value)){
      s.readingPlayer=false;
      s.waitingPlayer=false;
      s.player=value;
      s.message="玩家："+value;
      paint(k);

      if(meta.order==="玩家先攻")enemyTurn(k,meta);
      else if(s.enemy!=null)finish(k,meta);
      return;
    }

    if(Date.now()-started>8000){
      s.readingPlayer=false;
      s.message="未讀到玩家骰結果";
      paint(k);
      console.warn("[對抗跳轉] 玩家骰結果逾時："+meta.player);
      return;
    }

    later(poll,80);
  })();
}

function bind(){
  document.querySelectorAll(".fh-odj2").forEach(function(card){
    const k=C(card.dataset.odjKey);
    const meta=getMeta(card);

    if(!states.has(k)){
      states.set(k,{
        player:null,
        enemy:null,
        finished:false,
        readingPlayer:false,
        waitingPlayer:meta.order==="玩家先攻",
        message:meta.order+"｜"+meta.mode
      });

      if(meta.order==="敵人先攻"){
        enemyTurn(k,meta);
      }
    }

    paint(k);
  });
}

document.addEventListener("click",function(event){
  const clicked=event.target&&event.target.closest
    ?event.target.closest(".story-dice")
    :null;

  if(!clicked)return;

  document.querySelectorAll(".fh-odj2").forEach(function(card){
    const k=C(card.dataset.odjKey);
    const meta=getMeta(card);
    const s=states.get(k);

    if(!s||s.finished||!s.waitingPlayer)return;

    const wanted=findPlayerButton(meta.player);
    if(wanted===clicked){
      later(function(){waitPlayerResult(k,meta,clicked)},30);
    }
  });
},true);

window.bindFirehahaOpposedDiceJumpSequence=bind;

window.FirehahaOpposedDiceJumpSequence={
  version:"2.0.0",
  reset:function(){
    timers.forEach(clearTimeout);
    timers.clear();
    states.clear();
  }
};

try{
  if(window.FirehahaReaderLifecycle&&typeof window.FirehahaReaderLifecycle.register==="function"){
    window.FirehahaReaderLifecycle.register("opposed-dice-jump-sequence",{
      "reset-runtime":window.FirehahaOpposedDiceJumpSequence.reset,
      "before-restart":window.FirehahaOpposedDiceJumpSequence.reset,
      "before-load":window.FirehahaOpposedDiceJumpSequence.reset
    });
  }
}catch(_){}

if(typeof applyAdventure==="function"&&!applyAdventure.__fhODJ2Wrapped){
  const oldApplyAdventure=applyAdventure;

  applyAdventure=function(page){
    const q=Object.assign({},page||{});
    let source=String(q.content||"");

    source=source.replace(
      /\[(?:獨立對抗跳轉|對抗跳轉)\s*:\s*([^|\]]+?)\s*\|\s*骰子\s*:\s*([^|\]]+?)\s*\|\s*([^:|\]]+?)\s*:\s*([^|\]]+?)\s*\|\s*(玩家先攻|敵人先攻)\s*\|\s*(高者勝|低者勝)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)(?:\s*\|\s*(\d+))?\s*\]/gi,
      function(full,name,player,enemy,formula,order,mode,left,right,tie,delay){
        const rule=[name,player,enemy,formula,order,mode,left,right,tie,delay||0].join("|");
        const k=keyOf(q.id||"",rule);
        const saved=states.get(k);

        const playerText=saved&&saved.player!=null?String(saved.player):"等待玩家";
        const enemyText=saved&&saved.enemy!=null?String(saved.enemy):"等待敵人";
        const message=saved&&saved.message?saved.message:(order+"｜"+mode);

        return '<div class="fh-odj2"'+
          ' data-odj-key="'+E(k)+'"'+
          ' data-odj-player="'+E(player)+'"'+
          ' data-odj-enemy="'+E(enemy)+'"'+
          ' data-odj-formula="'+E(formula)+'"'+
          ' data-odj-order="'+E(order)+'"'+
          ' data-odj-mode="'+E(mode)+'"'+
          ' data-odj-left="'+E(left)+'"'+
          ' data-odj-right="'+E(right)+'"'+
          ' data-odj-tie="'+E(tie)+'"'+
          ' data-odj-delay="'+E(delay||0)+'">'+
          '<div class="fh-odj2-title">⚔️ '+E(name)+'</div>'+
          '<div class="fh-odj2-row">'+
            '<span><b>玩家 '+E(player)+'</b><strong class="fh-odj2-player">'+E(playerText)+'</strong></span>'+
            '<em>VS</em>'+
            '<span><b>'+E(enemy)+' '+E(formula)+'</b><strong class="fh-odj2-enemy">'+E(enemyText)+'</strong></span>'+
          '</div>'+
          '<div class="fh-odj2-msg">'+E(message)+'</div>'+
        '</div>';
      }
    );

    q.content=source;
    const html=oldApplyAdventure.call(this,q);
    later(bind,0);
    return html;
  };

  applyAdventure.__fhODJ2Wrapped=true;
}

later(bind,0);
console.info("[對抗跳轉] v2.0.0 重寫版已載入");
})();
`;

    const removeTransform = api.registerReaderTransform(
      "reader",
      function(html, context) {
        html = String(html == null ? "" : html);

        if (html.includes("__fhOpposedJumpV200")) {
          return html;
        }

        if (/<\/head\s*>/i.test(html)) {
          html = html.replace(/<\/head\s*>/i, css + "\n</head>");
        } else {
          html = css + html;
        }

        const marker = "function renderAdventure(){";

        if (!html.includes(marker)) {
          console.warn("[對抗跳轉] 找不到 Reader 插入位置");
          return html;
        }

        return html.replace(marker, patch + "\n" + marker);
      },
      295
    );

    api.toast("對抗骰先後攻跳轉 v2.0.0 已啟用");

    return function cleanup() {
      removeTransform();
    };
  }
});
