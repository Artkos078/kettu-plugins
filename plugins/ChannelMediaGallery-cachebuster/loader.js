(function(){
'use strict';
var V=(typeof vendetta!=='undefined'&&vendetta)||globalThis.vendetta||globalThis.revenge||globalThis.bunny||{};
var metro=V.metro||{};
var common=metro.common||{};
var ui=V.ui||{};
var utils=V.utils||{};
var React=common.React||null;
var RN=common.ReactNative||null;
var runtime=null;
var loading=false;
var error=null;
var last='Ready';
var corePath='ChannelMediaGallery-cachebuster';
var title='Channel Media Gallery Cachebuster Config 1.1.26';
function find(){try{return metro.findByProps&&metro.findByProps.apply(metro,arguments);}catch(e){return null;}}
if(!React)React=find('createElement','useState')||globalThis.React;
if(!RN)RN=find('View','Text','Pressable','ScrollView')||{};
function say(x){last=String(x);try{if(ui.toasts&&ui.toasts.showToast)ui.toasts.showToast(String(x));else if(ui.showToast)ui.showToast(String(x));}catch(e){}try{console.log('[ChannelMediaGallery]',x);}catch(e2){}}
function text(e){try{return (e&&e.message)||String(e);}catch(_){return 'Unknown error';}}
function patch(s){s=String(s||'');return s.replace('var V = globalThis.vendetta || globalThis.revenge || globalThis.bunny || {};','var V = (typeof vendetta !== "undefined" && vendetta) || globalThis.vendetta || globalThis.revenge || globalThis.bunny || {};');}
function urlList(){var t='v=1.1.26&t='+Date.now();var a=[];try{if(V.plugin&&V.plugin.id)a.push(String(V.plugin.id).replace(/\/?$/,'/')+'index.js?'+t);}catch(e){}a.push('https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/plugins/'+corePath+'/index.js?'+t);return a;}
function timeout(ms,u){return new Promise(function(_,rej){setTimeout(function(){rej(new Error('Timeout: '+u));},ms);});}
async function fetchText(u){var f=(utils&&utils.safeFetch)||globalThis.fetch;if(!f)throw new Error('No fetch API');var p=(async function(){var r;try{r=await f(u,{cache:'no-store'});}catch(e){r=await f(u);}if(!r)throw new Error('No response');if(r.ok===false)throw new Error('HTTP '+(r.status||'?'));if(typeof r.text==='function')return await r.text();if(typeof r.body==='string')return r.body;if(typeof r.data==='string')return r.data;throw new Error('No text body');})();return await Promise.race([p,timeout(8000,u)]);}
async function load(force){if(loading)return;if(runtime&&!force)return;loading=true;error=null;say('Loading gallery...');var urls=urlList(),errs=[];try{for(var i=0;i<urls.length;i++){try{var src=await fetchText(urls[i]);if(!src||src.indexOf('Channel Media Gallery')<0)throw new Error('Wrong file');runtime=(0,eval)('(function(vendetta){return '+patch(src)+';})')(V);if(runtime&&runtime.default)runtime=runtime.default;if(runtime&&runtime.onLoad)runtime.onLoad();else if(runtime&&runtime.start)runtime.start();say('Channel Media Gallery loaded');return;}catch(e){errs.push(urls[i]+' -> '+text(e));}}throw new Error(errs.join('\n'));}catch(e2){error=e2;say('Gallery load failed');}finally{loading=false;}}
function onLoad(){return load(false);}
function onUnload(){try{if(runtime&&runtime.onUnload)runtime.onUnload();else if(runtime&&runtime.stop)runtime.stop();}catch(e){}runtime=null;}
function Settings(){
 if(runtime&&runtime.settings){try{return React.createElement(runtime.settings,{});}catch(e){error=e;}}
 if(runtime&&runtime.SettingsComponent){try{return React.createElement(runtime.SettingsComponent,{});}catch(e2){error=e2;}}
 if(!React||!RN||!RN.View||!RN.Text)return null;
 var View=RN.View,Text=RN.Text,Pressable=RN.Pressable||RN.TouchableOpacity,Scroll=RN.ScrollView||View;
 function btn(label,fn,color){return Pressable?React.createElement(Pressable,{onPress:fn,style:{marginTop:12,padding:13,borderRadius:9,backgroundColor:color||'#5865f2',alignItems:'center'}},React.createElement(Text,{style:{color:'white',fontWeight:'800'}},label)):null;}
 return React.createElement(Scroll,{style:{padding:16}},
  React.createElement(Text,{style:{color:'white',fontSize:24,fontWeight:'900'}},title),
  React.createElement(Text,{style:{color:error?'#ff6b6b':'#ffb86b',marginTop:10}},error?text(error):(loading?'Loading gallery...':last)),
  React.createElement(Text,{style:{color:'#aaa',marginTop:10}},'Small loader is active. If load fails, this page shows the exact error.'),
  btn('Retry Load Gallery',function(){load(true);},'#5865f2'),
  btn('Hi',function(){say('Hi!');},'#444')
 );
}
var plugin={onLoad:onLoad,onUnload:onUnload,start:onLoad,stop:onUnload,settings:Settings,Settings:Settings,SettingsComponent:Settings,getSettingsPanel:Settings};
return{default:plugin,__esModule:true,onLoad:onLoad,onUnload:onUnload,start:onLoad,stop:onUnload,settings:Settings,Settings:Settings,SettingsComponent:Settings,getSettingsPanel:Settings};
})()
