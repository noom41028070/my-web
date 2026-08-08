// @firehaha-plugin {"id":"official.reader-dark-color-adapter","name":"閱讀器深色文字適配","version":"1.2.0","author":"Firehaha","description":"配合原生 reader-dark 與舒適工具 fh-reader-dark，在深色背景下自動將過暗文字調亮，切回淺色時恢復。"}
FirehahaPlugins.register({
  id: "official.reader-dark-color-adapter",

  setup(api) {
    const removeStyle = api.addStyle("main", `
      .fh-dark-color-adapter-status{font-size:12px;font-weight:700;color:#455a64}
    `);

    const removeTransform = api.registerReaderTransform("reader-dark-color-adapter", function(html) {
      if (typeof html !== "string" || !html.includes("</body>")) return html;
      if (html.includes('data-fh-dark-color-adapter="1"')) return html;

      const injected = `
<style data-fh-dark-color-adapter="1">
body.reader-dark [data-fh-dark-color-adjusted="1"],
body.fh-reader-dark [data-fh-dark-color-adjusted="1"]{
  color:var(--fh-dark-adapted-color)!important;
}
</style>
<script data-fh-dark-color-adapter="1">
(function(){
  "use strict";
  if(window.__fhDarkColorAdapterV12)return;
  window.__fhDarkColorAdapterV12=true;

  var MARK="data-fh-dark-color-adjusted";
  var CSS_VAR="--fh-dark-adapted-color";
  var pending=false;
  var applying=false;

  function clamp(value,min,max){
    return Math.max(min,Math.min(max,value));
  }

  function isDarkMode(){
    return !!(document.body && (
      document.body.classList.contains("reader-dark") ||
      document.body.classList.contains("fh-reader-dark")
    ));
  }

  function parseComputedRgb(value){
    var match=String(value||"").match(/rgba?\\(\\s*([\\d.]+)[,\\s]+([\\d.]+)[,\\s]+([\\d.]+)/i);
    if(!match)return null;
    return {r:Number(match[1]),g:Number(match[2]),b:Number(match[3])};
  }

  function relativeLuminance(color){
    function channel(value){
      value=value/255;
      return value<=0.03928?value/12.92:Math.pow((value+0.055)/1.055,2.4);
    }
    return 0.2126*channel(color.r)+0.7152*channel(color.g)+0.0722*channel(color.b);
  }

  function rgbToHsl(color){
    var r=color.r/255,g=color.g/255,b=color.b/255;
    var max=Math.max(r,g,b),min=Math.min(r,g,b);
    var h=0,s=0,l=(max+min)/2;
    if(max!==min){
      var d=max-min;
      s=l>0.5?d/(2-max-min):d/(max+min);
      if(max===r)h=(g-b)/d+(g<b?6:0);
      else if(max===g)h=(b-r)/d+2;
      else h=(r-g)/d+4;
      h/=6;
    }
    return {h:h*360,s:s*100,l:l*100};
  }

  function makeReadable(color){
    var hsl=rgbToHsl(color);
    var lum=relativeLuminance(color);

    if(hsl.s<14){
      if(lum<0.025)return "rgb(255,255,255)";
      if(lum<0.075)return "rgb(242,244,247)";
      return "rgb(218,223,229)";
    }

    var light=clamp(Math.max(hsl.l,74),74,87);
    var saturation=clamp(hsl.s,38,82);
    return "hsl("+Math.round(hsl.h)+" "+Math.round(saturation)+"% "+Math.round(light)+"%)";
  }

  function shouldSkip(element){
    if(!(element instanceof Element))return true;
    return !!element.closest(
      "#readerTools,#saveDock,#storyPanel,"+
      "#fh-reader-comfort-panel,#fh-reader-comfort-toggle,#fh-reader-progress,"+
      "script,style,noscript,svg,canvas,video,audio,input,textarea,select,option"
    );
  }

  function restoreAll(){
    document.querySelectorAll("["+MARK+"]").forEach(function(element){
      element.removeAttribute(MARK);
      element.style.removeProperty(CSS_VAR);
    });
  }

  function adaptElement(element){
    if(shouldSkip(element))return;
    var rgb=parseComputedRgb(getComputedStyle(element).color);
    if(!rgb)return;
    if(relativeLuminance(rgb)>=0.34)return;
    element.style.setProperty(CSS_VAR,makeReadable(rgb));
    element.setAttribute(MARK,"1");
  }

  function contentRoots(){
    var roots=Array.from(document.querySelectorAll(
      "#reader,.reader,.reader-container,.reader-content,#readerContent,"+
      ".reader-layout-title,.reader-layout-block,.content,article,main,.page,#app"
    ));
    return roots.length?roots:[document.body];
  }

  function apply(){
    if(applying||!document.body)return;
    applying=true;
    try{
      restoreAll();
      if(!isDarkMode())return;

      contentRoots().forEach(function(root){
        adaptElement(root);
        root.querySelectorAll(
          "p,div,span,strong,b,em,i,u,s,del,blockquote,li,"+
          "h1,h2,h3,h4,h5,h6,ruby,rt,a,font,label,small,"+
          ".reader-layout-title,.reader-layout-block,.choice-layout"
        ).forEach(adaptElement);
      });
    }finally{
      applying=false;
    }
  }

  function schedule(){
    if(pending)return;
    pending=true;
    requestAnimationFrame(function(){
      pending=false;
      apply();
    });
  }

  var observer=new MutationObserver(function(mutations){
    if(applying)return;
    for(var i=0;i<mutations.length;i++){
      var mutation=mutations[i];
      if(mutation.target===document.body && mutation.type==="attributes" && mutation.attributeName==="class"){
        schedule();
        return;
      }
      if(mutation.type==="childList" && mutation.addedNodes.length){
        schedule();
        return;
      }
    }
  });

  function start(){
    if(!document.body)return;
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["class"]});
    document.addEventListener("click",function(){setTimeout(schedule,0);},true);
    schedule();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
<\/script>`;

      return html.replace("</body>", injected + "\n</body>");
    }, 210);

    api.toast("閱讀器深色文字適配 1.2 已啟用");

    return function cleanup() {
      removeTransform();
      removeStyle();
    };
  }
});
