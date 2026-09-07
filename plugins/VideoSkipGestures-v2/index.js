(function(){
'use strict';

var V=(typeof vendetta!=='undefined'&&vendetta)||globalThis.vendetta||{};
var metro=V.metro||{};
var patcher=V.patcher||{};
var common=metro.common||{};
var React=common.React;
var RN=common.ReactNative;
var pstore=(V.plugin&&V.plugin.storage)||{};
var findByProps=metro.findByProps||function(){return null;};
var findByName=metro.findByName||function(){return null;};
var findByDisplayName=metro.findByDisplayName||function(){return null;};
var toastApi=(V.ui&&V.ui.toasts)||{};
var unpatches=[];
var status={controls:false,overlay:false};

if(pstore.seconds==null)pstore.seconds=10;
if(pstore.enabled==null)pstore.enabled=true;
if(pstore.doubleTapMs==null)pstore.doubleTapMs=320;

function toast(msg){try{toastApi.showToast&&toastApi.showToast(msg);}catch(e){}}
function clamp(n,min,max){return Math.max(min,Math.min(max,n));}

function resolveVideoModule(){
  try{return findByProps('createVideoControls','VideoComponent')||findByProps('createVideoControls');}catch(e){return null;}
}

function patchControls(){
  var m=resolveVideoModule();
  if(!m||typeof m.createVideoControls!=='function'||!patcher.after)return false;
  try{
    var u=patcher.after('createVideoControls',m,function(args,ret){
      if(!ret||!ret.props||ret.__vsg2)return ret;
      ret.__vsg2=true;
      ret.__vsgCurrent=0;
      ret.__vsgDuration=0;
      var oldProgress=ret.props.onProgress;
      ret.props.onProgress=function(ev){
        try{
          var x=ev&&ev.nativeEvent?ev.nativeEvent:ev||{};
          var cur=Number(x.currentTime),dur=Number(x.seekableDuration);
          if(Number.isFinite(cur))ret.__vsgCurrent=cur;
          if(Number.isFinite(dur))ret.__vsgDuration=dur;
          else if(Number.isFinite(Number(x.playableDuration)))ret.__vsgDuration=Number(x.playableDuration);
        }catch(e){}
        return oldProgress&&oldProgress.apply(this,arguments);
      };
      return ret;
    });
    if(typeof u==='function')unpatches.push(u);
    status.controls=true;
    return true;
  }catch(e){return false;}
}

function GestureLayer(props){
  if(!React||!RN||pstore.enabled===false)return null;
  var View=RN.View;
  var Pressable=RN.Pressable||RN.TouchableOpacity||RN.TouchableWithoutFeedback;
  if(!View||!Pressable)return null;
  var controls=props.controls;
  var left=React.useRef(0),right=React.useRef(0);

  function doubleTap(dir){
    var now=Date.now();
    var ref=dir<0?left:right;
    var ms=clamp(Number(pstore.doubleTapMs)||320,180,600);
    if(now-ref.current<=ms){
      ref.current=0;
      try{
        var jump=clamp(Number(pstore.seconds)||10,1,60);
        var cur=Number(controls&&controls.__vsgCurrent)||0;
        var dur=Number(controls&&controls.__vsgDuration)||0;
        var target=cur+(dir*jump);
        target=dur>0?clamp(target,0,dur):Math.max(0,target);
        if(controls&&typeof controls.seek==='function'){
          controls.seek(target);
          controls.__vsgCurrent=target;
          toast((dir<0?'↶ ':'↷ ')+jump+'s');
        }
      }catch(e){}
    }else{
      ref.current=now;
    }
  }

  return React.createElement(View,{pointerEvents:'box-none',style:{position:'absolute',left:0,right:0,top:0,bottom:0,zIndex:999,elevation:999}},
    React.createElement(Pressable,{pointerEvents:'auto',onPress:function(){doubleTap(-1);},style:{position:'absolute',left:0,top:0,bottom:0,width:'34%',backgroundColor:'transparent'},accessibilityLabel:'Rewind '+pstore.seconds+' seconds'}),
    React.createElement(Pressable,{pointerEvents:'auto',onPress:function(){doubleTap(1);},style:{position:'absolute',right:0,top:0,bottom:0,width:'34%',backgroundColor:'transparent'},accessibilityLabel:'Forward '+pstore.seconds+' seconds'})
  );
}

function resolveOverlayModule(){
  var raw=null;
  try{raw=findByName('MediaModalOverlayGuard',false);}catch(e){}
  if(raw&&raw.default)return raw;
  try{raw=findByName('MediaModalOverlay',false);}catch(e){}
  if(raw&&raw.default)return raw;
  try{raw=findByDisplayName('MediaModalOverlayGuard',false);}catch(e){}
  if(raw&&raw.default)return raw;
  return raw;
}

function patchMediaOverlay(){
  if(!React||!patcher.after)return false;
  var raw=resolveOverlayModule();
  if(!raw)return false;
  try{
    if(raw.default&&typeof raw.default==='function'){
      var u=patcher.after('default',raw,function(args,ret){
        try{
          if(!ret||!ret.props)return ret;
          var p=ret.props;
          var source=p.source;
          var index=p.index;
          var get=p.getVideoControls;
          if(!source||!source.videoURI||typeof get!=='function')return ret;
          var controls=get(index,source);
          if(!controls)return ret;
          return React.createElement(React.Fragment,null,ret,React.createElement(GestureLayer,{controls:controls,key:'video-skip-media-modal-v2'}));
        }catch(e){return ret;}
      });
      if(typeof u==='function')unpatches.push(u);
      status.overlay=true;
      return true;
    }
  }catch(e){}
  return false;
}

function Settings(){
  if(!React||!RN)return null;
  var View=RN.View,Text=RN.Text,TextInput=RN.TextInput,Switch=RN.Switch,ScrollView=RN.ScrollView||RN.View;
  var s=React.useState(0),tick=s[0],setTick=s[1];
  function bump(){setTick(tick+1);}
  function row(label,key){return React.createElement(View,{style:{marginTop:16}},React.createElement(Text,{style:{color:'white',fontWeight:'700',marginBottom:6}},label),React.createElement(TextInput,{keyboardType:'number-pad',value:String(pstore[key]),onChangeText:function(v){var n=Number(v);if(Number.isFinite(n))pstore[key]=n;bump();},style:{borderWidth:1,borderColor:'#555',borderRadius:10,padding:11,color:'white'}}));}
  return React.createElement(ScrollView,{style:{padding:16}},
    React.createElement(Text,{style:{color:'white',fontWeight:'900',fontSize:24}},'Video Skip Gestures v2'),
    React.createElement(Text,{style:{color:'#aaa',marginTop:7}},'Expanded Discord media viewer: double-tap left to rewind and right to skip forward.'),
    React.createElement(Text,{style:{color:status.controls&&status.overlay?'#6fdc8c':'#ffb86b',marginTop:12}},'Hooks: controls '+(status.controls?'OK':'missing')+' · media overlay '+(status.overlay?'OK':'missing')),
    React.createElement(View,{style:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:18}},React.createElement(Text,{style:{color:'white'}},'Enable double-tap skip'),React.createElement(Switch,{value:pstore.enabled!==false,onValueChange:function(v){pstore.enabled=v;bump();}})),
    row('Skip amount in seconds','seconds'),
    row('Double-tap window in ms','doubleTapMs'),
    React.createElement(Text,{style:{color:'#777',marginTop:18,marginBottom:30}},'Works in Discord’s expanded media screen; it does not require native fullscreen. The center area is left for normal Discord controls.')
  );
}

function onLoad(){
  patchControls();
  patchMediaOverlay();
  toast(status.controls&&status.overlay?'Video skip gestures v2 loaded':'Video skip gestures v2: hook missing');
}
function onUnload(){while(unpatches.length){try{unpatches.pop()();}catch(e){}}}
return{onLoad:onLoad,onUnload:onUnload,settings:Settings};
})()