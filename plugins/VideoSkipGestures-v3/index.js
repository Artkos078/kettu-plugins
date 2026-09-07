(function(){
'use strict';

var V=(typeof vendetta!=='undefined'&&vendetta)||globalThis.vendetta||{};
var metro=V.metro||{};
var patcher=V.patcher||{};
var common=metro.common||{};
var React=common.React;
var RN=common.ReactNative;
var pstore=(V.plugin&&V.plugin.storage)||{};
var findByName=metro.findByName||function(){return null;};
var findByDisplayName=metro.findByDisplayName||function(){return null;};
var toastApi=(V.ui&&V.ui.toasts)||{};
var unpatches=[];
var status={overlay:false};

if(pstore.seconds==null)pstore.seconds=10;
if(pstore.enabled==null)pstore.enabled=true;
if(pstore.doubleTapMs==null)pstore.doubleTapMs=320;

function toast(msg){try{toastApi.showToast&&toastApi.showToast(msg);}catch(e){}}
function clamp(n,min,max){return Math.max(min,Math.min(max,n));}

function GestureLayer(props){
  if(!React||!RN||pstore.enabled===false)return null;
  var View=RN.View;
  var Pressable=RN.Pressable||RN.TouchableOpacity||RN.TouchableWithoutFeedback;
  if(!View||!Pressable)return null;

  var controls=props.controls;
  var current=React.useRef(0);
  var duration=React.useRef(0);
  var leftTap=React.useRef(0);
  var rightTap=React.useRef(0);
  var locked=React.useRef(false);

  try{
    if(controls&&typeof controls.useSubscribe==='function'){
      controls.useSubscribe(
        function(cur,dur){
          var c=Number(cur),d=Number(dur);
          if(Number.isFinite(c))current.current=c;
          if(Number.isFinite(d))duration.current=d;
        },
        function(){},
        function(){}
      );
    }
  }catch(e){}

  function doubleTap(dir){
    if(locked.current)return;
    var now=Date.now();
    var ref=dir<0?leftTap:rightTap;
    var ms=clamp(Number(pstore.doubleTapMs)||320,180,600);

    if(now-ref.current<=ms){
      ref.current=0;
      try{
        if(!controls||typeof controls.seek!=='function')return;
        var jump=clamp(Number(pstore.seconds)||10,1,60);
        var cur=Number(current.current)||0;
        var dur=Number(duration.current)||0;
        var target=cur+(dir*jump);
        target=dur>0?clamp(target,0,dur):Math.max(0,target);
        locked.current=true;
        controls.seek(target);
        current.current=target;
        setTimeout(function(){locked.current=false;},120);
      }catch(e){locked.current=false;}
    }else{
      ref.current=now;
    }
  }

  // Keep the top and bottom control bars completely untouched so Discord's
  // close button, scrubber, play/pause, and other native controls remain tappable.
  var hitStyle={position:'absolute',top:72,bottom:72,backgroundColor:'transparent'};

  return React.createElement(View,{pointerEvents:'box-none',style:{position:'absolute',left:0,right:0,top:0,bottom:0,zIndex:40,elevation:40}},
    React.createElement(Pressable,{
      pointerEvents:'auto',
      onPress:function(){doubleTap(-1);},
      style:Object.assign({},hitStyle,{left:0,width:'30%'}),
      accessibilityLabel:'Rewind '+pstore.seconds+' seconds'
    }),
    React.createElement(Pressable,{
      pointerEvents:'auto',
      onPress:function(){doubleTap(1);},
      style:Object.assign({},hitStyle,{right:0,width:'30%'}),
      accessibilityLabel:'Forward '+pstore.seconds+' seconds'
    })
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
  if(!raw||!raw.default||typeof raw.default!=='function')return false;

  try{
    var u=patcher.after('default',raw,function(args,ret){
      try{
        if(!ret||!ret.props)return ret;
        var p=ret.props;
        var source=p.source;
        var index=p.index;
        var get=p.getVideoControls;
        if(!source||!source.videoURI||typeof get!=='function')return ret;
        var controls=get(index,source);
        if(!controls||typeof controls.seek!=='function')return ret;
        return React.createElement(React.Fragment,null,
          ret,
          React.createElement(GestureLayer,{controls:controls,key:'video-skip-media-modal-v3-1'})
        );
      }catch(e){return ret;}
    });
    if(typeof u==='function')unpatches.push(u);
    status.overlay=true;
    return true;
  }catch(e){return false;}
}

function Settings(){
  if(!React||!RN)return null;
  var View=RN.View,Text=RN.Text,TextInput=RN.TextInput,Switch=RN.Switch,ScrollView=RN.ScrollView||RN.View;
  var s=React.useState(0),tick=s[0],setTick=s[1];
  function bump(){setTick(tick+1);}
  function row(label,key){return React.createElement(View,{style:{marginTop:16}},
    React.createElement(Text,{style:{color:'white',fontWeight:'700',marginBottom:6}},label),
    React.createElement(TextInput,{keyboardType:'number-pad',value:String(pstore[key]),onChangeText:function(v){var n=Number(v);if(Number.isFinite(n))pstore[key]=n;bump();},style:{borderWidth:1,borderColor:'#555',borderRadius:10,padding:11,color:'white'}})
  );}
  return React.createElement(ScrollView,{style:{padding:16}},
    React.createElement(Text,{style:{color:'white',fontWeight:'900',fontSize:24}},'Video Skip Gestures v3.1'),
    React.createElement(Text,{style:{color:'#aaa',marginTop:7}},'Discord media viewer only. Double-tap left to rewind and right to skip forward.'),
    React.createElement(Text,{style:{color:status.overlay?'#6fdc8c':'#ffb86b',marginTop:12}},'Media overlay hook: '+(status.overlay?'OK':'missing')),
    React.createElement(View,{style:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:18}},
      React.createElement(Text,{style:{color:'white'}},'Enable double-tap skip'),
      React.createElement(Switch,{value:pstore.enabled!==false,onValueChange:function(v){pstore.enabled=v;bump();}})
    ),
    row('Skip amount in seconds','seconds'),
    row('Double-tap window in ms','doubleTapMs'),
    React.createElement(Text,{style:{color:'#777',marginTop:18,marginBottom:30}},'The top and bottom control areas are excluded from gesture interception so the X and playback controls remain clickable.')
  );
}

function onLoad(){
  patchMediaOverlay();
  toast(status.overlay?'Video skip gestures v3.1 loaded':'Video skip gestures: media overlay hook missing');
}
function onUnload(){while(unpatches.length){try{unpatches.pop()();}catch(e){}}}
return{onLoad:onLoad,onUnload:onUnload,settings:Settings};
})()