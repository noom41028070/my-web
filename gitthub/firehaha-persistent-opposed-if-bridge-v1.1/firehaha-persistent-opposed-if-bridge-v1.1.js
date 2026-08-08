// @firehaha-plugin {"id":"official.persistent-opposed-if-bridge-v1-1","name":"持續對抗如果式橋接 V1.1","version":"1.1.0","author":"Firehaha","description":"修正閱讀器將 [如果]、[否則]、[/如果] 拆成不同 DOM 文字節點時無法判定的問題，改用跨節點掃描與 Range 替換。"}

FirehahaPlugins.register({
  id: "official.persistent-opposed-if-bridge-v1-1",
  name: "持續對抗如果式橋接 V1.1",
  version: "1.1.0",
  description: "跨文字節點解析持續對抗條件區塊，修正閱讀器拆分標籤後無法判定的問題。",

  setup(api) {
    "use strict";

    const MARK = "data-fh-persistent-opposed-if-bridge-v11";

    const runtime = String.raw`
(function(){
"use strict";

if(window.__fhPersistentOpposedIfBridgeV11){return;}
window.__fhPersistentOpposedIfBridgeV11=true;

var scanning=false;
var queued=false;

function normalizeResult(value){
  var text=String(value||"").trim();
  if(text==="左"||text==="左勝"||text==="玩家勝"||text==="A勝")return "左勝";
  if(text==="右"||text==="右勝"||text==="敵人勝"||text==="敵方勝"||text==="B勝")return "右勝";
  if(text==="平"||text==="平手")return "平手";
  return text;
}

function getSaved(name){
  // 優先讀取持續保存版；未安裝時相容主程式已內建的通用對抗骰。
  var bridge=window.FirehahaPersistentOpposedDice||window.FirehahaOpposedDice;
  if(!bridge||typeof bridge.get!=="function")return null;
  try{
    return bridge.get(String(name||"").trim())||null;
  }catch(error){
    console.warn("[Persistent Opposed If V1.1]",error);
    return null;
  }
}

function compare(actual,operator,expected){
  var a=Number(actual);
  var b=Number(expected);
  if(!Number.isFinite(a)||!Number.isFinite(b))return false;
  if(operator===">=")return a>=b;
  if(operator==="<=")return a<=b;
  if(operator===">")return a>b;
  if(operator==="<")return a<b;
  if(operator==="!=")return a!==b;
  return a===b;
}

function evaluateCondition(condition){
  var text=String(condition||"").trim();
  var match;

  match=text.match(/^持續對抗:([^=]+)=(.+)$/);
  if(match){
    var name=String(match[1]||"").trim();
    var wanted=normalizeResult(match[2]);
    var saved=getSaved(name);

    if(!saved||!saved.result||saved.result==="等待"){
      return null;
    }

    return normalizeResult(saved.result)===wanted;
  }

  match=text.match(/^持續對抗差值:([^<>=!]+)\s*(>=|<=|==|!=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/);
  if(match){
    var diffName=String(match[1]||"").trim();
    var savedDiff=getSaved(diffName);

    if(!savedDiff||savedDiff.difference==null){
      return null;
    }

    return compare(savedDiff.difference,match[2],Number(match[3]));
  }

  return null;
}

function collectTextNodes(){
  if(!document.body)return [];

  var walker=document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  var nodes=[];

  while(walker.nextNode()){
    var node=walker.currentNode;
    var parent=node.parentElement;

    if(!parent)continue;

    if(parent.closest(
      "script,style,textarea,noscript,"+
      ".fh-persistent-opposed-card,"+
      ".fh-opposed-dice,"+
      ".story-dice,"+
      ".fh-auto-dice-result,"+
      ".fh-native-audio-control"
    )){
      continue;
    }

    nodes.push(node);
  }

  return nodes;
}

function findBlock(){
  var nodes=collectTextNodes();
  var openPattern=/\[如果:(持續對抗(?::|差值:)[^\]]+)\]/;

  for(var i=0;i<nodes.length;i++){
    var startNode=nodes[i];
    var startText=startNode.nodeValue||"";
    var open=startText.match(openPattern);

    if(!open)continue;

    var condition=String(open[1]||"").trim();
    var openIndex=startText.indexOf(open[0]);
    var pieces=[];
    var closeNode=null;
    var closeIndex=-1;

    var rest=startText.slice(openIndex+open[0].length);
    var sameClose=rest.indexOf("[/如果]");

    if(sameClose>=0){
      pieces=[rest.slice(0,sameClose)];
      closeNode=startNode;
      closeIndex=openIndex+open[0].length+sameClose;
    }else{
      pieces.push(rest);

      for(var j=i+1;j<nodes.length;j++){
        var current=nodes[j];
        var text=current.nodeValue||"";
        var closePos=text.indexOf("[/如果]");

        if(closePos>=0){
          pieces.push(text.slice(0,closePos));
          closeNode=current;
          closeIndex=closePos;
          break;
        }

        pieces.push(text);
      }
    }

    if(!closeNode)continue;

    var content=pieces.join("\n");
    var elseIndex=content.indexOf("[否則]");
    var yesText;
    var noText;

    if(elseIndex>=0){
      yesText=content.slice(0,elseIndex);
      noText=content.slice(elseIndex+"[否則]".length);
    }else{
      yesText=content;
      noText="";
    }

    return {
      condition:condition,
      startNode:startNode,
      startOffset:openIndex,
      endNode:closeNode,
      endOffset:closeIndex+"[/如果]".length,
      yesText:yesText,
      noText:noText
    };
  }

  return null;
}

function cleanupText(value){
  return String(value||"")
    .replace(/^\s*\n+/,"")
    .replace(/\n+\s*$/,"");
}

function replaceBlock(block,passed){
  var selected=cleanupText(
    passed ? block.yesText : block.noText
  );

  var range=document.createRange();

  try{
    range.setStart(block.startNode,block.startOffset);
    range.setEnd(block.endNode,block.endOffset);
    range.deleteContents();

    if(selected){
      range.insertNode(
        document.createTextNode(selected)
      );
    }

    range.detach();
    return true;
  }catch(error){
    console.warn("[Persistent Opposed If Range]",error);
    try{range.detach();}catch(e){}
    return false;
  }
}

function scan(){
  if(scanning||!document.body)return;

  scanning=true;

  try{
    var guard=0;

    while(guard<30){
      guard++;

      var block=findBlock();
      if(!block)break;

      var result=evaluateCondition(block.condition);

      if(result===null){
        break;
      }

      if(!replaceBlock(block,result)){
        break;
      }
    }
  }finally{
    scanning=false;
  }
}

function queueScan(){
  if(queued)return;

  queued=true;

  setTimeout(function(){
    queued=false;
    scan();
  },20);
}

function start(){
  scan();

  var observer=new MutationObserver(queueScan);

  observer.observe(document.body,{
    childList:true,
    subtree:true,
    characterData:true
  });

  setTimeout(scan,80);
  setTimeout(scan,250);
}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",start,{once:true});
}else{
  start();
}

window.FirehahaPersistentOpposedIfBridge={
  version:"1.1.0",
  scan:scan,
  evaluate:evaluateCondition
};

})();
`;

    const removeTransform =
      api.registerReaderTransform(
        "reader",
        function(html, context) {
          if(
            typeof html !== "string" ||
            html.includes(MARK)
          ){
            return html;
          }

          const script =
            `<script ${MARK}>` +
            runtime +
            `</scr` +
            `ipt>`;

          if(/<\/body\s*>/i.test(html)){
            return html.replace(
              /<\/body\s*>/i,
              script + "\n</body>"
            );
          }

          return html + script;
        },
        1250
      );

    api.toast(
      "持續對抗如果式橋接 V1.1 已啟用"
    );

    return function cleanup() {
      removeTransform();
    };
  }
});
