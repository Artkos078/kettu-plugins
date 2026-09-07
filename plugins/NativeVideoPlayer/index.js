(function(){
'use strict';

var V=(typeof vendetta!=='undefined'&&vendetta)||globalThis.vendetta||{};
var metro=V.metro||{};
var common=metro.common||{};
var patcher=V.patcher||{};
var React=common.React;
var RN=common.ReactNative;
var pstore=(V.plugin&&V.plugin.storage)||{};
var findByProps=metro.findByProps||function(){return null;};
var toastApi=(V.ui&&V.ui.toasts)||{};
var unpatches=[];
var hookStatus='not hooked';

if(pstore.enabled==null)pstore.enabled=true;
if(pstore.embeds==null)pstore.embeds=true;
if(pstore.useProxy==null)pstore.useProxy=false;
if(pstore.showToast==null)pstore.showToast=true;

function toast(msg){try{if(pstore.showToast!==false&&toastApi.showToast)toastApi.showToast(msg);}catch(e){}}
function linking(){
  try{if(RN&&RN.Linking&&RN.Linking.openURL)return RN.Linking;}catch(e){}
  try{var m=findByProps('openURL','canOpenURL');if(m&&m.openURL)return m;}catch(e){}
  try{var m2=findByProps('openURL','openDeeplink');if(m2&&m2.openURL)return m2;}catch(e){}
  return null;
}
function ext(name){
  name=String(name||'').split('?')[0].toLowerCase();
  var i=name.lastIndexOf('.');return i>=0?name.slice(i):'';
}
function isVideoAttachment(a){
  if(!a)return false;
  var ct=String(a.content_type||a.contentType||'').toLowerCase();
  if(ct.indexOf('video/')===0)return true;
  var e=ext(a.filename||a.url||a.proxy_url||a.proxyUrl);
  return ['.mp4','.mov','.m4v','.webm','.mkv','.avi','.mpeg','.mpg','.3gp'].indexOf(e)>=0;
}
function attachmentURL(a){
  if(!a)return null;
  if(pstore.useProxy){return a.proxy_url||a.proxyUrl||a.url||null;}
  return a.url||a.proxy_url||a.proxyUrl||null;
}
function findEmbedVideo(e){
  if(!e)return null;
  var v=e.video||{};
  var u=v.url||v.proxy_url||v.proxyUrl||null;
  if(u)return u;
  var candidates=[e.url,e.thumbnail&&e.thumbnail.url,e.image&&e.image.url];
  for(var i=0;i<candidates.length;i++){
    var c=candidates[i]; if(!c)continue;
    var x=ext(c); if(['.mp4','.mov','.m4v','.webm','.mkv','.avi','.mpeg','.mpg','.3gp'].indexOf(x)>=0)return c;
  }
  return null;
}
function openNative(url){
  if(!url)return false;
  var l=linking();
  if(!l||!l.openURL)return false;
  try{
    var r=l.openURL(String(url));
    if(r&&typeof r.catch==='function')r.catch(function(){toast('iOS could not open this video');});
    toast('Opening with iOS media handler');
    return true;
  }catch(e){return false;}
}
function extractTap(arg){
  if(!arg)return null;
  return arg.tapImageData||arg;
}
function nativeURLFromTap(arg){
  var t=extractTap(arg); if(!t)return null;
  var msg=t.message; if(!msg)return null;
  var type=t.type;
  if(type==='attachment'){
    var arr=msg.attachments||[];
    var idx=Number(t.index)||0;
    var a=arr[idx];
    if(isVideoAttachment(a))return attachmentURL(a);
  }
  if(pstore.embeds!==false&&type==='embed'){
    var embeds=msg.embeds||[];
    var ei=t.index!=null?Number(t.index):Number(t.embedIndex)||0;
    return findEmbedVideo(embeds[ei]);
  }
  return null;
}
function hook(){
  if(!patcher.instead)return false;
  var mod=null;
  try{mod=findByProps('handleMessagesTapImage');}catch(e){}
  if(!mod||typeof mod.handleMessagesTapImage!=='function'){
    hookStatus='handleMessagesTapImage missing';
    return false;
  }
  try{
    var u=patcher.instead('handleMessagesTapImage',mod,function(args,orig){
      try{
        if(pstore.enabled!==false){
          var url=nativeURLFromTap(args&&args[0]);
          if(url&&openNative(url))return null;
        }
      }catch(e){}
      return orig.apply(null,args);
    });
    if(typeof u==='function')unpatches.push(u);
    hookStatus='handleMessagesTapImage';
    return true;
  }catch(e){hookStatus='hook failed';return false;}
}
function Settings(){
  if(!React||!RN)return null;
  var View=RN.View,Text=RN.Text,Switch=RN.Switch,ScrollView=RN.ScrollView||RN.View,Pressable=RN.Pressable||RN.TouchableOpacity;
  var st=React.useState(0),tick=st[0],setTick=st[1];function bump(){setTick(tick+1);}
  function toggle(label,key,sub){return React.createElement(View,{style:{paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#2f3136'}},React.createElement(View,{style:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}},React.createElement(View,{style:{flex:1,marginRight:12}},React.createElement(Text,{style:{color:'white',fontWeight:'700',fontSize:16}},label),sub?React.createElement(Text,{style:{color:'#999',marginTop:4,fontSize:13}},sub):null),React.createElement(Switch,{value:pstore[key]!==false,onValueChange:function(v){pstore[key]=v;bump();}})));}
  function button(label,fn){return React.createElement(Pressable,{onPress:fn,style:{marginTop:14,paddingVertical:13,paddingHorizontal:14,borderRadius:12,backgroundColor:'#5865F2'}},React.createElement(Text,{style:{color:'white',fontWeight:'800',textAlign:'center'}},label));}
  return React.createElement(ScrollView,{style:{padding:16}},
    React.createElement(Text,{style:{color:'white',fontWeight:'900',fontSize:24}},'Native Video Player'),
    React.createElement(Text,{style:{color:'#aaa',marginTop:6}},'Target: Discord 305.1 / JS 88876 PTB'),
    React.createElement(Text,{style:{color:'#aaa',marginTop:4,marginBottom:10}},'Hook: '+hookStatus),
    toggle('Use iOS player for video attachments','enabled','Video attachments open through iOS Linking instead of Discord\'s media viewer.'),
    toggle('Also handle video embeds','embeds','Direct video URLs in embeds use the same native path when detectable.'),
    toggle('Prefer Discord proxy URL','useProxy','Useful if a direct CDN URL fails. Usually leave this off.'),
    toggle('Show open notification','showToast','Shows a small message when the native path is used.'),
    button('Test iOS handler',function(){var l=linking();toast(l&&l.openURL?'iOS Linking is available':'iOS Linking unavailable');})
  );
}
function onLoad(){var ok=hook();toast(ok?'NativeVideoPlayer loaded':'NativeVideoPlayer: video hook missing');}
function onUnload(){while(unpatches.length){try{unpatches.pop()();}catch(e){}}}
return{onLoad:onLoad,onUnload:onUnload,settings:Settings};
})()