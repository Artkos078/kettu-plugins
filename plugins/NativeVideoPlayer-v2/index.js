(function(){
'use strict';

var V=(typeof vendetta!=='undefined'&&vendetta)||globalThis.vendetta||{};
var metro=V.metro||{};
var common=metro.common||{};
var React=common.React;
var RN=common.ReactNative;
var pstore=(V.plugin&&V.plugin.storage)||{};
var findByProps=metro.findByProps||function(){return null;};
var toastApi=(V.ui&&V.ui.toasts)||{};

var originalRender=null;
var VideoClass=null;
var hookStatus='not loaded';
var openedCount=0;
var lastUrl='';

if(pstore.enabled==null)pstore.enabled=true;
// Do not also open Discord's media viewer. Triggering both viewers can leave
// Discord's overlay on top of the native player and block its close control.
pstore.callOriginalOnPress=false;

function toast(msg){try{toastApi.showToast&&toastApi.showToast(msg);}catch(e){}}

function getLinker(){
  try{if(common.url&&typeof common.url.openURL==='function')return common.url;}catch(e){}
  try{var m=findByProps('openURL','openDeeplink');if(m&&typeof m.openURL==='function')return m;}catch(e){}
  try{if(RN&&RN.Linking&&typeof RN.Linking.openURL==='function')return RN.Linking;}catch(e){}
  return null;
}

function openNative(url){
  if(!url)return false;
  var linker=getLinker();
  if(!linker){toast('iOS URL handler unavailable');return false;}
  try{
    lastUrl=String(url);
    openedCount++;
    var r=linker.openURL(String(url));
    if(r&&typeof r.catch==='function')r.catch(function(){toast('Could not open video with iOS');});
    return true;
  }catch(e){toast('Could not open video with iOS');return false;}
}

function installHook(){
  try{
    var mod=findByProps('createVideoControls','VideoComponent');
    var C=mod&&mod.default;
    if(!C||!C.prototype||typeof C.prototype.render!=='function'){
      hookStatus='common Video class missing';
      return false;
    }
    VideoClass=C;
    originalRender=C.prototype.render;
    C.prototype.render=function(){
      try{
        var src=this.props&&this.props.src;
        var url=src&&src.videoURI;
        if(pstore.enabled!==false&&url){
          var self=this;
          if(!self.__nativeVideoOriginalOpen&&typeof self.handleOpenFullScreen==='function'){
            self.__nativeVideoOriginalOpen=self.handleOpenFullScreen.bind(self);
          }
          self.handleOpenFullScreen=function(){
            if(openNative(url))return;
            try{if(typeof self.__nativeVideoOriginalOpen==='function')return self.__nativeVideoOriginalOpen();}catch(e){}
            try{if(self.props&&typeof self.props.onPress==='function')return self.props.onPress();}catch(e){}
          };
        }
      }catch(e){}
      return originalRender.apply(this,arguments);
    };
    hookStatus='common Video.render → native videoURI only';
    return true;
  }catch(e){
    hookStatus='hook error';
    try{console.log('[NativeVideoPlayer v2]',e);}catch(_){}
    return false;
  }
}

function uninstallHook(){
  try{if(VideoClass&&originalRender&&VideoClass.prototype.render!==originalRender)VideoClass.prototype.render=originalRender;}catch(e){}
  VideoClass=null;
  originalRender=null;
}

function Settings(){
  if(!React||!RN)return null;
  var View=RN.View,Text=RN.Text,Pressable=RN.Pressable||RN.TouchableOpacity,Switch=RN.Switch,ScrollView=RN.ScrollView||RN.View;
  var st=React.useState(0),tick=st[0],setTick=st[1];
  function bump(){setTick(tick+1);}
  return React.createElement(ScrollView,{style:{padding:16}},
    React.createElement(Text,{style:{color:'white',fontSize:24,fontWeight:'900'}},'NativeVideoPlayer v2.1'),
    React.createElement(Text,{style:{color:'#aaa',marginTop:8}},'Hook: '+hookStatus),
    React.createElement(Text,{style:{color:'#aaa',marginTop:4}},'Opened with iOS: '+openedCount),
    React.createElement(Text,{style:{color:'#777',marginTop:4}},lastUrl?('Last URL: '+lastUrl.slice(0,120)):'No video opened yet.'),
    React.createElement(Text,{style:{color:'#777',marginTop:12}},'Discord\'s media viewer is no longer opened at the same time. This prevents an overlapping viewer from blocking the native close button.'),
    React.createElement(View,{style:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:16}},
      React.createElement(Text,{style:{color:'white',flex:1,marginRight:12}},'Use iOS handler for videos'),
      React.createElement(Switch,{value:pstore.enabled!==false,onValueChange:function(v){pstore.enabled=v;bump();}})
    )
  );
}

function onLoad(){var ok=installHook();toast(ok?'NativeVideoPlayer v2.1 ready':'NativeVideoPlayer hook missing');}
function onUnload(){uninstallHook();}

return{onLoad:onLoad,onUnload:onUnload,settings:Settings};
})()