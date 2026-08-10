// @firehaha-plugin {"id":"official.modifier-value-patch","name":"修正值增減轉譯補丁","version":"1.1.0","author":"Firehaha","description":"把修正值／技能修正值的增加、減少與移除標籤，在 Reader 進入原生 Adventure 前轉成主程式原生修正值設定流程；骰子、冒險紀錄、存檔共用同一份 modifiers / skillModifiers。"}
FirehahaPlugins.register({
  id: "official.modifier-value-patch",

  setup(api) {
    "use strict";

    const runtime = String.raw`
/* Firehaha Modifier Value Translator 1.1.0 */
(function(){
"use strict";

if(window.__fhModifierValueTranslator110)return;
window.__fhModifierValueTranslator110=true;

if(typeof applyAdventure!=="function"){
  console.warn("[Modifier Translator] 找不到 applyAdventure");
  return;
}

const oldApplyAdventure=applyAdventure;

function C(v){
  return String(v==null?"":v).trim();
}

function getAdventure(){
  try{
    if(
      typeof memorySave!=="undefined" &&
      memorySave &&
      memorySave.adventure
    ){
      return memorySave.adventure;
    }
  }catch(_){}

  try{
    if(
      window.memorySave &&
      window.memorySave.adventure
    ){
      return window.memorySave.adventure;
    }
  }catch(_){}

  return null;
}

function ensureStores(){
  const a=getAdventure();
  if(!a)return null;

  a.modifiers=
    a.modifiers &&
    typeof a.modifiers==="object"
      ?a.modifiers
      :{};

  a.skillModifiers=
    a.skillModifiers &&
    typeof a.skillModifiers==="object"
      ?a.skillModifiers
      :{};

  a.applied=
    a.applied &&
    typeof a.applied==="object"
      ?a.applied
      :{};

  return a;
}

function persistSafe(){
  try{
    if(typeof persist==="function")persist();
  }catch(error){
    console.warn(
      "[Modifier Translator] persist 失敗",
      error
    );
  }
}

function notifyChanged(){
  try{
    document.dispatchEvent(
      new CustomEvent(
        "firehaha:adventure-state-changed",
        {
          detail:{
            reason:"native-modifier-translation",
            source:"official.modifier-value-patch",
            at:Date.now()
          }
        }
      )
    );
  }catch(_){}
}

function numberOrZero(v){
  const n=Number(v);
  return Number.isFinite(n)?n:0;
}

/*
 * 將同一頁的：
 *
 * [修正值:力量=2]
 * [增加:修正值:力量:3]
 *
 * 先依正文順序計算成：
 *
 * [修正值:力量=5]
 *
 * 再交回主程式原生 applyAdventure。
 *
 * 技能修正值完全同理。
 */
function translateModifierTags(source,page){
  const a=ensureStores();

  if(!a){
    return {
      text:String(source||""),
      removals:[]
    };
  }

  /*
   * 原生 Adventure 已經處理過這頁，就不要再次運算。
   * 這直接沿用主程式原生 a.applied[page.id] 的一次性生命週期。
   */
  const pageId=
    page && page.id!=null
      ?String(page.id)
      :"";

  if(
    pageId &&
    a.applied[pageId]
  ){
    return {
      text:String(source||""),
      removals:[]
    };
  }

  const working={
    modifiers:Object.assign({},a.modifiers),
    skillModifiers:Object.assign({},a.skillModifiers)
  };

  const touched={
    modifiers:new Set(),
    skillModifiers:new Set()
  };

  const removed={
    modifiers:new Set(),
    skillModifiers:new Set()
  };

  const tokenRe=
    /\[(?:修正值\s*:\s*([^=\]\r\n]+?)\s*=\s*([+-]?\d+(?:\.\d+)?)|技能修正值\s*:\s*([^=\]\r\n]+?)\s*=\s*([+-]?\d+(?:\.\d+)?)|(增加|減少)\s*:\s*(修正值|技能修正值)\s*:\s*([^:\]\r\n]+?)\s*:\s*([+-]?\d+(?:\.\d+)?)|(增加|減少)(修正值|技能修正值)\s*:\s*([^:\]\r\n]+?)\s*:\s*([+-]?\d+(?:\.\d+)?)|(修正值|技能修正值)(增加|減少)\s*:\s*([^:\]\r\n]+?)\s*:\s*([+-]?\d+(?:\.\d+)?)|移除\s*:\s*(修正值|技能修正值)\s*:\s*([^:\]\r\n]+?)|(修正值|技能修正值)移除\s*:\s*([^:\]\r\n]+?)|移除(修正值|技能修正值)\s*:\s*([^:\]\r\n]+?))\s*\]/gi;

  let text=String(source||"");

  text=text.replace(
    tokenRe,
    function(
      whole,
      setModName,
      setModValue,
      setSkillName,
      setSkillValue,
      actionA,
      typeA,
      nameA,
      amountA,
      actionB,
      typeB,
      nameB,
      amountB,
      typeC,
      actionC,
      nameC,
      amountC,
      removeTypeA,
      removeNameA,
      removeTypeB,
      removeNameB,
      removeTypeC,
      removeNameC
    ){
      let type="";
      let name="";
      let action="";
      let amount=null;

      if(setModName!=null){
        type="修正值";
        name=C(setModName);
        action="設定";
        amount=Number(setModValue);
      }else if(setSkillName!=null){
        type="技能修正值";
        name=C(setSkillName);
        action="設定";
        amount=Number(setSkillValue);
      }else if(actionA){
        action=C(actionA);
        type=C(typeA);
        name=C(nameA);
        amount=Number(amountA);
      }else if(actionB){
        action=C(actionB);
        type=C(typeB);
        name=C(nameB);
        amount=Number(amountB);
      }else if(actionC){
        action=C(actionC);
        type=C(typeC);
        name=C(nameC);
        amount=Number(amountC);
      }else{
        action="移除";
        type=C(
          removeTypeA ||
          removeTypeB ||
          removeTypeC
        );
        name=C(
          removeNameA ||
          removeNameB ||
          removeNameC
        );
      }

      if(!name){
        return whole;
      }

      const storeName=
        type==="技能修正值"
          ?"skillModifiers"
          :"modifiers";

      const store=working[storeName];

      touched[storeName].add(name);

      if(action==="設定"){
        store[name]=numberOrZero(amount);
        removed[storeName].delete(name);
      }else if(action==="增加"){
        store[name]=
          numberOrZero(store[name])+
          numberOrZero(amount);
        removed[storeName].delete(name);
      }else if(action==="減少"){
        store[name]=
          numberOrZero(store[name])-
          numberOrZero(amount);
        removed[storeName].delete(name);
      }else if(action==="移除"){
        delete store[name];
        removed[storeName].add(name);
      }

      /*
       * 原標籤全部拿掉。
       * 後面統一附加最後結果的原生 [修正值:=] 標籤。
       */
      return "";
    }
  );

  const nativeTags=[];

  touched.modifiers.forEach(function(name){
    if(removed.modifiers.has(name))return;

    nativeTags.push(
      "[修正值:"+
      name+
      "="+
      numberOrZero(
        working.modifiers[name]
      )+
      "]"
    );
  });

  touched.skillModifiers.forEach(function(name){
    if(removed.skillModifiers.has(name))return;

    nativeTags.push(
      "[技能修正值:"+
      name+
      "="+
      numberOrZero(
        working.skillModifiers[name]
      )+
      "]"
    );
  });

  if(nativeTags.length){
    text += "\n" + nativeTags.join("\n");
  }

  const removals=[];

  removed.modifiers.forEach(function(name){
    removals.push({
      store:"modifiers",
      name:name
    });
  });

  removed.skillModifiers.forEach(function(name){
    removals.push({
      store:"skillModifiers",
      name:name
    });
  });

  return {
    text:text,
    removals:removals
  };
}

applyAdventure=function(page){
  const a=ensureStores();

  if(!a){
    return oldApplyAdventure.apply(
      this,
      arguments
    );
  }

  const cloned=
    Object.assign(
      {},
      page||{}
    );

  const field=
    cloned.content!=null
      ?"content"
      :"text";

  const pageId=
    page && page.id!=null
      ?String(page.id)
      :"";

  const wasApplied=
    !!(
      pageId &&
      a.applied[pageId]
    );

  const translated=
    translateModifierTags(
      cloned[field]||"",
      page
    );

  cloned[field]=translated.text;

  const html=
    oldApplyAdventure.call(
      this,
      cloned
    );

  /*
   * 「移除」沒有原生設定標籤可表示，所以只在這裡做最後一步 delete。
   * 但是否執行仍完全沿用原生 page applied：
   * 已處理過的頁面不會再次移除。
   */
  if(
    !wasApplied &&
    translated.removals.length
  ){
    translated.removals.forEach(
      function(item){
        if(
          a[item.store] &&
          typeof a[item.store]==="object"
        ){
          delete a[item.store][item.name];
        }
      }
    );

    persistSafe();
    notifyChanged();
  }

  return html;
};

window.FirehahaModifierValuePatch={
  version:"1.1.0",

  getModifier:function(name){
    const a=ensureStores();
    return a
      ?numberOrZero(
          a.modifiers[C(name)]
        )
      :0;
  },

  getSkillModifier:function(name){
    const a=ensureStores();
    return a
      ?numberOrZero(
          a.skillModifiers[C(name)]
        )
      :0;
  }
};

console.info(
  "[Firehaha] 修正值原生轉譯補丁 1.1.0 已接入 Reader"
);
})();
`;

    const removeTransform =
      api.registerReaderTransform(
        "reader",

        function(html, context) {
          html=String(
            html==null
              ?""
              :html
          );

          if(
            html.includes(
              "__fhModifierValueTranslator110"
            )
          ){
            return html;
          }

          const marker=
            "function renderAdventure(){";

          if(!html.includes(marker)){
            console.warn(
              "[Modifier Translator] 找不到 Reader 插入位置"
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

        /*
         * If Block 是 260。
         * 這支放 345，讓條件先裁掉失敗分支，
         * 再把剩下的修正值增減轉成原生設定標籤。
         */
        345
      );

    api.toast(
      "修正值原生轉譯補丁 1.1.0 已啟用"
    );

    return function cleanup() {
      removeTransform();
    };
  }
});
