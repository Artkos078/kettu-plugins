(function(){
'use strict';

var V=(typeof vendetta!=='undefined'&&vendetta)||globalThis.vendetta||globalThis.revenge||globalThis.bunny||{};
var metro=V.metro||{};
var common=metro.common||{};
var ui=V.ui||{};
var utils=V.utils||{};
var React=common.React;
var RN=common.ReactNative;
var pstore=(V.plugin&&V.plugin.storage)||V.storage||{};
var runtime=null;
var loadError=null;
var started=false;

function props(){try{return metro.findByProps&&metro.findByProps.apply(metro,arguments);}catch(e){return null;}}
function toast(t){try{if(ui.toasts&&ui.toasts.showToast)ui.toasts.showToast(String(t));else if(ui.showToast)ui.showToast(String(t));}catch(e){try{console.log('[ChannelMediaGallery]',t);}catch(_){}}}

if(!React)React=props('createElement','useState')||globalThis.React;
if(!RN)RN=props('View','Text','TextInput','Pressable')||{};

function patchCore(js){
  js=String(js||'');
  js=js.replace("var V = globalThis.vendetta || globalThis.revenge || globalThis.bunny || {};","var V = (typeof vendetta !== 'undefined' && vendetta) || globalThis.vendetta || globalThis.revenge || globalThis.bunny || {};");
  js=js.replace("var findByProps = metro.findByProps || V.findByProps || function () { return null; };","function findByProps(){ try { if (typeof metro.findByProps === 'function') return metro.findByProps.apply(metro, arguments); } catch(e) {} try { if (typeof V.findByProps === 'function') return V.findByProps.apply(V, arguments); } catch(e) {} return null; }");
  js=js.replace("function onLoad() {\n    rememberCurrentChannel();\n    if (timer) clearInterval(timer);\n    timer = setInterval(rememberCurrentChannel, 1500);\n    toast(\"Channel Media Gallery loaded\");\n  }","function onLoad() {\n    try { rememberCurrentChannel(); } catch(e) { status.last = 'Channel tracker unavailable: ' + (e && e.message ? e.message : e); }\n    try { if (timer) clearInterval(timer); timer = setInterval(function(){ try { rememberCurrentChannel(); } catch(e) {} }, 1500); } catch(e2) {}\n    toast('Channel Media Gallery loaded');\n  }");
  return js;
}

async function fetchCore(){
  var bases=[];
  try{if(V.plugin&&V.plugin.id)bases.push(String(V.plugin.id));}catch(e){}
  bases.push('https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/plugins/ChannelMediaGallery-v1/');
  var f=(utils&&utils.safeFetch)||globalThis.fetch;
  if(!f)throw new Error('No fetch API');
  var last=null;
  for(var i=0;i<bases.length;i++){
    try{
      var r=await f(bases[i]+'index.js?v=1.1.12&t='+Date.now(),{cache:'no-store'});
      if(!r||!r.ok)throw new Error('HTTP '+(r&&r.status));
      var txt=await r.text();
      if(txt.indexOf('Channel Media Gallery')<0)throw new Error('Wrong core file');
      return txt;
    }catch(e){last=e;}
  }
  throw last||new Error('Could not fetch core');
}

async function start(){
  if(started)return;
  started=true;
  try{
    var src=patchCore(await fetchCore());
    runtime=(0,eval)(src);
    if(runtime&&typeof runtime.onLoad==='function')runtime.onLoad();
    else if(runtime&&typeof runtime.start==='function')runtime.start();
    toast('Channel Media Gallery loader ready');
  }catch(e){
    loadError=e;
    toast('Channel Media Gallery core failed; config still opens');
  }
}

function stop(){
  started=false;
  try{if(runtime&&typeof runtime.onUnload==='function')runtime.onUnload();else if(runtime&&typeof runtime.stop==='function')runtime.stop();}catch(e){}
  runtime=null;
}

function Settings(){
  if(runtime&&runtime.settings){
    try{return React.createElement(runtime.settings,{});}catch(e){loadError=e;}
  }
  if(runtime&&runtime.SettingsComponent){
    try{return React.createElement(runtime.SettingsComponent,{});}catch(e2){loadError=e2;}
  }
  if(!React||!RN||!RN.View||!RN.Text)return null;
  var View=RN.View,Text=RN.Text,Pressable=RN.Pressable||RN.TouchableOpacity;
  return React.createElement(View,{style:{padding:16}},
    React.createElement(Text,{style:{color:'white',fontSize:24,fontWeight:'900'}},'Channel Media Gallery'),
    React.createElement(Text,{style:{color:'#ffb86b',marginTop:10}},loadError?'Core load error: '+(loadError.message||String(loadError)):'Core is loading. Close and reopen this settings page.'),
    React.createElement(Text,{style:{color:'#aaa',marginTop:10}},'This loader is active, so Kettu toggle/config is working. The gallery core loads from index.js.'),
    Pressable?React.createElement(Pressable,{onPress:start,style:{marginTop:16,padding:13,borderRadius:8,backgroundColor:'#5865f2',alignItems:'center'}},React.createElement(Text,{style:{color:'white',fontWeight:'800'}},'Retry Load Gallery Core')):null
  );
}

return{onLoad:start,onUnload:stop,start:start,stop:stop,settings:Settings,SettingsComponent:Settings};
})()
