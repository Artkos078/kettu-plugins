(function(){
'use strict';

var V=(typeof vendetta!=='undefined'&&vendetta)||globalThis.vendetta||globalThis.revenge||globalThis.bunny||{};
var metro=V.metro||{};
var common=metro.common||{};
var ui=V.ui||{};
var utils=V.utils||{};
var React=common.React;
var RN=common.ReactNative;
var runtime=null;
var loadError=null;
var loading=false;
var started=false;
var lastUrl='';
var listeners=[];
var loadSeq=0;

function props(){try{return metro.findByProps&&metro.findByProps.apply(metro,arguments);}catch(e){return null;}}
function toast(t){try{if(ui.toasts&&ui.toasts.showToast)ui.toasts.showToast(String(t));else if(ui.showToast)ui.showToast(String(t));}catch(e){try{console.log('[ChannelMediaGallery]',t);}catch(_){}}}
function errText(e){try{return (e&&e.stack)||((e&&e.message)||String(e));}catch(_){return 'Unknown error';}}
function notify(){loadSeq++;for(var i=0;i<listeners.length;i++){try{listeners[i](loadSeq);}catch(_){}}}
function subscribe(fn){listeners.push(fn);return function(){listeners=listeners.filter(function(x){return x!==fn;});};}

if(!React)React=props('createElement','useState')||globalThis.React;
if(!RN)RN=props('View','Text','TextInput','Pressable','ScrollView')||{};

function withSlash(x){x=String(x||'');return x&&x.charAt(x.length-1)!=='/'?x+'/':x;}
function patchCore(js){
  js=String(js||'');
  js=js.replace('var V = globalThis.vendetta || globalThis.revenge || globalThis.bunny || {};','var V = (typeof vendetta !== "undefined" && vendetta) || globalThis.vendetta || globalThis.revenge || globalThis.bunny || {};');
  return js;
}

function urls(){
  var tag='v=1.1.20&cache=folder&t='+Date.now();
  var out=[];
  try{if(V.plugin&&V.plugin.id)out.push(withSlash(V.plugin.id)+'index.js?'+tag);}catch(e){}
  out.push('https://cdn.jsdelivr.net/gh/Artkos078/kettu-plugins@main/plugins/ChannelMediaGallery-cachebuster/index.js?'+tag);
  out.push('https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/plugins/ChannelMediaGallery-cachebuster/index.js?'+tag);
  out.push('https://github.com/Artkos078/kettu-plugins/raw/main/plugins/ChannelMediaGallery-cachebuster/index.js?'+tag);
  return out;
}

function timeout(ms,url){return new Promise(function(_,reject){setTimeout(function(){reject(new Error('Timed out fetching '+url));},ms);});}
async function fetchText(url){
  var f=(utils&&utils.safeFetch)||globalThis.fetch;
  if(!f)throw new Error('No fetch API in Kettu');
  var task=(async function(){
    var r;
    try{r=await f(url,{cache:'no-store'});}catch(e){r=await f(url);}
    if(!r)throw new Error('Empty fetch response');
    if(r.ok===false)throw new Error('HTTP '+(r.status||'?'));
    if(typeof r.text==='function')return await r.text();
    if(typeof r.body==='string')return r.body;
    if(typeof r.data==='string')return r.data;
    throw new Error('Fetch returned no text');
  })();
  return await Promise.race([task,timeout(9000,url)]);
}

async function loadCore(){
  var list=urls();
  var errors=[];
  for(var i=0;i<list.length;i++){
    lastUrl=list[i];
    try{
      var txt=await fetchText(list[i]);
      if(!txt||txt.indexOf('Channel Media Gallery')<0)throw new Error('Wrong core text');
      return patchCore(txt);
    }catch(e){errors.push((i+1)+'. '+list[i]+' -> '+errText(e).split('\n')[0]);}
  }
  throw new Error(errors.join('\n'));
}

async function start(force){
  if(loading)return;
  if(started&&!force)return;
  loading=true;
  loadError=null;
  notify();
  try{
    if(force)stop();
    var src=await loadCore();
    runtime=(0,eval)('(function(vendetta){return '+src+';})')(V);
    if(runtime&&typeof runtime.onLoad==='function')runtime.onLoad();
    else if(runtime&&typeof runtime.start==='function')runtime.start();
    started=true;
    toast('Channel Media Gallery loaded');
    notify();
  }catch(e){
    loadError=e;
    runtime=null;
    started=false;
    toast('Channel Media Gallery load failed; open config for details');
    notify();
  }finally{loading=false;notify();}
}

function stop(){
  started=false;
  try{if(runtime&&typeof runtime.onUnload==='function')runtime.onUnload();else if(runtime&&typeof runtime.stop==='function')runtime.stop();}catch(e){}
  runtime=null;
}

function Settings(){
  try{
    if(React&&React.useState){var pair=React.useState(loadSeq);var setTick=pair[1];if(React.useEffect)React.useEffect(function(){return subscribe(setTick);},[]);}
  }catch(_hook){}
  try{if(!runtime&&!loading)start(false);}catch(_e){}
  if(runtime&&runtime.settings){try{return React.createElement(runtime.settings,{});}catch(e){loadError=e;}}
  if(runtime&&runtime.SettingsComponent){try{return React.createElement(runtime.SettingsComponent,{});}catch(e2){loadError=e2;}}
  if(!React||!RN||!RN.View||!RN.Text)return null;
  var View=RN.View,Text=RN.Text,Pressable=RN.Pressable||RN.TouchableOpacity,ScrollView=RN.ScrollView||View;
  var detail=loadError?errText(loadError):(loading?'Loading gallery core...':'Open this page again or press retry.');
  return React.createElement(ScrollView,{style:{padding:16}},
    React.createElement(Text,{style:{color:'white',fontSize:24,fontWeight:'900'}},'Channel Media Gallery Cachebuster Loader 1.1.20'),
    React.createElement(Text,{style:{color:loadError?'#ff6b6b':'#ffb86b',marginTop:10}},detail),
    React.createElement(Text,{style:{color:'#aaa',marginTop:10}},'Last URL: '+(lastUrl||'none yet')),
    Pressable?React.createElement(Pressable,{onPress:function(){start(true);},style:{marginTop:16,padding:13,borderRadius:8,backgroundColor:'#5865f2',alignItems:'center'}},React.createElement(Text,{style:{color:'white',fontWeight:'800'}},'Retry Load Gallery')):null
  );
}

return{onLoad:start,onUnload:stop,start:start,stop:stop,settings:Settings,SettingsComponent:Settings};
})()
