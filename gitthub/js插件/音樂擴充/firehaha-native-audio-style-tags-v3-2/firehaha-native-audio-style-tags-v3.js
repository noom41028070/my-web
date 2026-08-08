// @firehaha-plugin {"id":"official.native-audio-style-tags-v3","name":"原生音訊按鈕樣式標籤 V3","version":"3.0.0","author":"Firehaha","description":"依閱讀器實際文件順序解析樣式標籤；樣式標籤可位於獨立段落，下一個原生音訊按鈕會套用該樣式。"}

FirehahaPlugins.register({
  id: "official.native-audio-style-tags-v3",

  setup(api) {
    "use strict";

    const READER_MARK =
      "data-fh-native-audio-style-tags-v3";

    let editorObserver =
      null;

    let editorQueued =
      false;


    // =====================================================
    // 樣式標籤
    // =====================================================

    function normalizeColor(value) {
      const color =
        String(value || "")
          .trim();

      return color ||
        "#526b5a";
    }


    function parseStyleTag(text) {
      const value =
        String(text || "")
          .trim();

      let match;


      match =
        value.match(
          /^\[純文字無底線(?::([^\]]+))?\]$/
        );

      if (match) {
        return {
          type: "plain",
          color:
            normalizeColor(
              match[1]
            )
        };
      }


      match =
        value.match(
          /^\[純文字底線(?::([^\]]+))?\]$/
        );

      if (match) {
        return {
          type: "underline",
          color:
            normalizeColor(
              match[1]
            )
        };
      }


      match =
        value.match(
          /^\[分歧按鈕(?::([^\]]+))?\]$/
        );

      if (match) {
        return {
          type: "branch",
          color:
            normalizeColor(
              match[1]
            )
        };
      }


      return null;
    }


    function applyStyle(
      button,
      settings
    ) {
      if (
        !button ||
        !settings
      ) {
        return;
      }


      button.classList.remove(
        "fh-audio-tag-v3-plain",
        "fh-audio-tag-v3-underline",
        "fh-audio-tag-v3-branch"
      );


      button.classList.add(
        "fh-audio-tag-v3-" +
        settings.type
      );


      button.style.setProperty(
        "--fh-audio-tag-v3-color",
        settings.color
      );


      button.setAttribute(
        "data-fh-audio-tag-v3",
        "1"
      );
    }


    // =====================================================
    // 文件順序掃描
    //
    // 核心概念：
    //
    // [純文字無底線]
    //
    //        ↓ 不管中間被包成什麼 HTML
    //
    // <button class="fh-native-audio-control">
    //
    // 都會配對。
    // =====================================================

    function removeStyleTextNode(
      node,
      matchText
    ) {
      if (
        !node ||
        node.nodeType !==
          Node.TEXT_NODE
      ) {
        return;
      }


      const original =
        node.nodeValue || "";


      node.nodeValue =
        original.replace(
          matchText,
          ""
        );


      /*
       * 如果樣式標籤所在區塊變成空段落，
       * 就順便移除，避免留白。
       */
      const parent =
        node.parentElement;


      if (
        parent &&
        parent !== document.body &&
        parent.children.length === 0 &&
        parent.textContent.trim() === ""
      ) {
        const tag =
          parent.tagName;

        if (
          tag === "P" ||
          tag === "DIV" ||
          tag === "SPAN"
        ) {
          parent.remove();
        }
      }
    }


    function scanDocumentOrder(root) {
      if (!root) {
        return;
      }


      /*
       * TreeWalker 同時看文字與元素，
       * 依實際文件順序前進。
       */
      const walker =
        document.createTreeWalker(
          root,
          NodeFilter.SHOW_ELEMENT |
          NodeFilter.SHOW_TEXT,
          {
            acceptNode(node) {
              if (
                node.nodeType ===
                  Node.ELEMENT_NODE
              ) {
                const element =
                  node;

                if (
                  element.matches?.(
                    "script,style,textarea,noscript"
                  ) ||
                  element.closest?.(
                    "script,style,textarea,noscript"
                  )
                ) {
                  return NodeFilter
                    .FILTER_REJECT;
                }
              }

              return NodeFilter
                .FILTER_ACCEPT;
            }
          }
        );


      let pendingStyle =
        null;

      let pendingNode =
        null;

      let pendingMatch =
        null;

      let node;


      while (
        (
          node =
            walker.nextNode()
        )
      ) {

        /*
         * 先抓音訊按鈕。
         */
        if (
          node.nodeType ===
            Node.ELEMENT_NODE &&
          node.matches?.(
            ".fh-native-audio-control"
          )
        ) {

          if (pendingStyle) {
            applyStyle(
              node,
              pendingStyle
            );

            if (
              pendingNode &&
              pendingMatch
            ) {
              removeStyleTextNode(
                pendingNode,
                pendingMatch
              );
            }

            pendingStyle =
              null;

            pendingNode =
              null;

            pendingMatch =
              null;
          }

          continue;
        }


        /*
         * 文字節點中尋找樣式標籤。
         */
        if (
          node.nodeType !==
            Node.TEXT_NODE
        ) {
          continue;
        }


        const text =
          node.nodeValue || "";


        const pattern =
          /\[(純文字無底線|純文字底線|分歧按鈕)(?::([^\]\r\n]+))?\]/g;


        let match;


        while (
          (
            match =
              pattern.exec(text)
          )
        ) {

          const settings =
            parseStyleTag(
              match[0]
            );


          if (!settings) {
            continue;
          }


          /*
           * 有新的樣式標籤，就覆蓋上一個 pending。
           * 下一個原生音訊按鈕吃掉它。
           */
          pendingStyle =
            settings;

          pendingNode =
            node;

          pendingMatch =
            match[0];
        }
      }
    }


    function scanEditor() {
      scanDocumentOrder(
        document.body
      );
    }


    editorObserver =
      new MutationObserver(() => {
        if (
          editorQueued
        ) {
          return;
        }


        editorQueued =
          true;


        setTimeout(() => {
          editorQueued =
            false;

          scanEditor();

        }, 0);
      });


    editorObserver.observe(
      document.body,
      {
        childList: true,
        subtree: true,
        characterData: true
      }
    );


    scanEditor();


    // =====================================================
    // 編輯器樣式
    // =====================================================

    const removeStyle =
      api.addStyle(
        "native-audio-style-tags-v3",

        `
.fh-native-audio-control.fh-audio-tag-v3-branch{
  display:block!important;
  width:100%!important;
  max-width:520px!important;
  box-sizing:border-box!important;
  margin:12px auto!important;
  padding:13px 18px!important;

  border:0!important;
  border-radius:10px!important;

  background:
    var(
      --fh-audio-tag-v3-color,
      #526b5a
    )!important;

  color:#fff!important;

  font:
    700 15px/1.5
    system-ui,
    "Noto Sans TC",
    sans-serif!important;

  text-align:center!important;
  text-decoration:none!important;

  box-shadow:
    0 3px 0
    rgba(0,0,0,.20)!important;
}


.fh-native-audio-control.fh-audio-tag-v3-underline,
.fh-native-audio-control.fh-audio-tag-v3-plain{
  display:block!important;
  width:auto!important;
  max-width:100%!important;

  margin:8px auto!important;
  padding:3px 4px!important;

  border:0!important;
  border-radius:0!important;

  background:transparent!important;

  color:
    var(
      --fh-audio-tag-v3-color,
      #526b5a
    )!important;

  font:
    700 15px/1.6
    system-ui,
    "Noto Sans TC",
    sans-serif!important;

  text-align:center!important;

  box-shadow:none!important;
}


.fh-native-audio-control.fh-audio-tag-v3-underline{
  text-decoration:
    underline!important;

  text-decoration-thickness:
    1.5px!important;

  text-underline-offset:
    4px!important;
}


.fh-native-audio-control.fh-audio-tag-v3-plain{
  text-decoration:none!important;
}


.fh-native-audio-control.fh-audio-tag-v3-underline.is-playing,
.fh-native-audio-control.fh-audio-tag-v3-plain.is-playing{
  background:transparent!important;

  color:
    var(
      --fh-audio-tag-v3-color,
      #526b5a
    )!important;
}


.fh-native-audio-control.fh-audio-tag-v3-branch.is-playing{
  background:
    var(
      --fh-audio-tag-v3-color,
      #526b5a
    )!important;
}
`
      );


    // =====================================================
    // Reader Runtime
    //
    // 不改原始 HTML。
    // 等原生音訊 Runtime 建好按鈕後，
    // 用 MutationObserver 持續掃描文件順序。
    // =====================================================

    const removeTransform =
      api.registerReaderTransform(
        "reader",

        function(
          html,
          context
        ) {
          if (
            typeof html !==
              "string" ||
            html.includes(
              READER_MARK
            )
          ) {
            return html;
          }


          const readerStyle =
            `
<style ${READER_MARK}>

.fh-native-audio-control.fh-audio-tag-v3-branch{
 display:block!important;
 width:100%!important;
 max-width:520px!important;
 box-sizing:border-box!important;
 margin:12px auto!important;
 padding:13px 18px!important;
 border:0!important;
 border-radius:10px!important;
 background:var(--fh-audio-tag-v3-color,#526b5a)!important;
 color:#fff!important;
 font:700 15px/1.5 system-ui,"Noto Sans TC",sans-serif!important;
 text-align:center!important;
 text-decoration:none!important;
 box-shadow:0 3px 0 rgba(0,0,0,.20)!important;
}

.fh-native-audio-control.fh-audio-tag-v3-underline,
.fh-native-audio-control.fh-audio-tag-v3-plain{
 display:block!important;
 width:auto!important;
 max-width:100%!important;
 margin:8px auto!important;
 padding:3px 4px!important;
 border:0!important;
 border-radius:0!important;
 background:transparent!important;
 color:var(--fh-audio-tag-v3-color,#526b5a)!important;
 font:700 15px/1.6 system-ui,"Noto Sans TC",sans-serif!important;
 text-align:center!important;
 box-shadow:none!important;
}

.fh-native-audio-control.fh-audio-tag-v3-underline{
 text-decoration:underline!important;
 text-decoration-thickness:1.5px!important;
 text-underline-offset:4px!important;
}

.fh-native-audio-control.fh-audio-tag-v3-plain{
 text-decoration:none!important;
}

.fh-native-audio-control.fh-audio-tag-v3-underline.is-playing,
.fh-native-audio-control.fh-audio-tag-v3-plain.is-playing{
 background:transparent!important;
 color:var(--fh-audio-tag-v3-color,#526b5a)!important;
}

.fh-native-audio-control.fh-audio-tag-v3-branch.is-playing{
 background:var(--fh-audio-tag-v3-color,#526b5a)!important;
}

</style>
`;


          const runtime =
            `
<script ${READER_MARK}>
(function(){

"use strict";

if(
 window.__fhAudioStyleTagsV3
){
 return;
}

window.__fhAudioStyleTagsV3=true;


function parseStyleTag(text){

 var value=
 String(text || "")
 .trim();

 var match;


 match=
 value.match(
  /^\\[純文字無底線(?::([^\\]]+))?\\]$/
 );

 if(match){
  return {
   type:"plain",
   color:
    String(
     match[1] ||
     "#526b5a"
    ).trim()
  };
 }


 match=
 value.match(
  /^\\[純文字底線(?::([^\\]]+))?\\]$/
 );

 if(match){
  return {
   type:"underline",
   color:
    String(
     match[1] ||
     "#526b5a"
    ).trim()
  };
 }


 match=
 value.match(
  /^\\[分歧按鈕(?::([^\\]]+))?\\]$/
 );

 if(match){
  return {
   type:"branch",
   color:
    String(
     match[1] ||
     "#526b5a"
    ).trim()
  };
 }


 return null;
}


function applyStyle(
 button,
 settings
){

 button.classList.remove(
  "fh-audio-tag-v3-plain",
  "fh-audio-tag-v3-underline",
  "fh-audio-tag-v3-branch"
 );


 button.classList.add(
  "fh-audio-tag-v3-" +
  settings.type
 );


 button.style.setProperty(
  "--fh-audio-tag-v3-color",
  settings.color
 );


 button.setAttribute(
  "data-fh-audio-tag-v3",
  "1"
 );

}


function removeStyleNode(
 node,
 matchText
){

 if(
  !node ||
  node.nodeType !== 3
 ){
  return;
 }


 node.nodeValue=
 String(node.nodeValue || "")
 .replace(
  matchText,
  ""
 );


 var parent=
 node.parentElement;


 if(
  parent &&
  parent !== document.body &&
  parent.children.length === 0 &&
  parent.textContent.trim() === ""
 ){

  var tag=
  parent.tagName;


  if(
   tag === "P" ||
   tag === "DIV" ||
   tag === "SPAN"
  ){
   parent.remove();
  }

 }

}


function scan(){

 if(!document.body){
  return;
 }


 var walker=
 document.createTreeWalker(
  document.body,
  NodeFilter.SHOW_ELEMENT |
  NodeFilter.SHOW_TEXT,
  null
 );


 var pendingStyle=
 null;

 var pendingNode=
 null;

 var pendingMatch=
 null;

 var node;


 while(
  (
   node=
   walker.nextNode()
  )
 ){

  if(
   node.nodeType === 1 &&
   node.matches &&
   node.matches(
    ".fh-native-audio-control"
   )
  ){

   if(pendingStyle){

    applyStyle(
     node,
     pendingStyle
    );


    if(
     pendingNode &&
     pendingMatch
    ){
     removeStyleNode(
      pendingNode,
      pendingMatch
     );
    }


    pendingStyle=null;
    pendingNode=null;
    pendingMatch=null;

   }


   continue;
  }


  if(
   node.nodeType !== 3
  ){
   continue;
  }


  var text=
  node.nodeValue || "";


  var pattern=
  /\\[(純文字無底線|純文字底線|分歧按鈕)(?::([^\\]\\r\\n]+))?\\]/g;


  var match;


  while(
   (
    match=
    pattern.exec(text)
   )
  ){

   var settings=
   parseStyleTag(
    match[0]
   );


   if(!settings){
    continue;
   }


   pendingStyle=
   settings;

   pendingNode=
   node;

   pendingMatch=
   match[0];

  }

 }

}


function start(){

 scan();


 var queued=false;


 var observer=
 new MutationObserver(
  function(){

   if(queued){
    return;
   }


   queued=true;


   setTimeout(
    function(){

     queued=false;
     scan();

    },
    0
   );

  }
 );


 observer.observe(
  document.body,
  {
   childList:true,
   subtree:true,
   characterData:true
  }
 );

}


if(
 document.readyState ===
 "loading"
){

 document.addEventListener(
  "DOMContentLoaded",
  start,
  {
   once:true
  }
 );

}else{

 start();

}

})();
</scr` + `ipt>
`;


          let output =
            html;


          if (
            /<\/head\s*>/i
              .test(output)
          ) {
            output =
              output.replace(
                /<\/head\s*>/i,
                readerStyle +
                "\n</head>"
              );

          } else {
            output =
              readerStyle +
              output;
          }


          if (
            /<\/body\s*>/i
              .test(output)
          ) {
            output =
              output.replace(
                /<\/body\s*>/i,
                runtime +
                "\n</body>"
              );

          } else {
            output +=
              runtime;
          }


          return output;
        },

        700
      );


    api.toast(
      "原生音訊按鈕樣式標籤 V3 已啟用"
    );


    return function cleanup() {

      editorObserver
        ?.disconnect();


      removeTransform();
      removeStyle();

    };
  }
});
