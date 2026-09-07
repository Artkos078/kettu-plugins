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
var status={controls:false,loader:false};

if(pstore.seconds==null)pstore.seconds=10;
if(pstore.enabled==null)pstore.enabled=true;
if(pstore.doubleTapMs==null)pstore.doubleTapMs=300;

function toast(msg){try{toastApi.showToast&&toastApi.showToast(msg);}catch(e){}}
function clamp(n,min,max){return Math.max(min,Math.min(max,n));}

function resolveVideoModule(){
  try{return findByProps('createVideoControls','VideoComponent');}catch(e){return null;}
}

function patchControls(){
  var m=resolveVideoModule();
  if(!m||typeof m.createVideoControls!=='function'||!patcher.after)return false;
  try{
    var u=patcher.after('createVideoControls',m,function(args,ret){
      if(!ret||!ret.props)return ret;
      if(ret.__videoSkipTracked)return ret;
      ret.__videoSkipTracked=true;
      ret.__videoSkipCurrent=0;
      ret.__videoSkipDuration=0;
      var old=ret.props.onProgress;
      ret.props.onProgress=function(ev){
        try{
          var x=ev&&ev.nativeEvent?ev.nativeEvent:ev||{};
          if(Number.isFinite(Number(x.currentTime)))ret.__videoSkipCurrent=Number(x.currentTime);
          if(Number.isFinite(Number(x.seekableDuration)))ret.__videoSkipDuration=Number(x.seekableDuration);
          else if(Number.isFinite(Number(x.playableDuration)))ret.__videoSkipDuration=Number(x.playableDuration);
        }catch(e){}
        return old&&old.apply(this,arguments);
      };
      return ret;
    });
    if(typeof u==='function')unpatches.push(u);
    status.controls=true;
    return true;
  }catch(e){return false;}
}

function resolveLoader(){
  var raw=null;
  try{raw=findByName('MediaModalLoader',false);}catch(e){}
  if(raw&&raw.default)return raw;
  try{raw=findByDisplayName('MediaModalLoader',false);}catch(e){}
  if(raw&&raw.default)return raw;
  return raw;
}

function GestureLayer(props){
  if(!React||!RN||pstore.enabled===false)return null;
  var View=RN.View,Pressable=RN.Pressable||RN.TouchableWithoutFeedback||RN.TouchableOpacity;
  if(!View||!Pressable)return null;
  var controls=props.controls;
  var left=React.useRef(0),right=React.useRef(0);
  function hit(dir){
    var now=Date.now();
    var ref=dir<0?left:right;
    var windowMs=clamp(Number(pstore.doubleTapMs)||300,180,500);
    if(now-ref.current<=windowMs){
      ref.current=0;
      try{
        var cur=Number(controls&&controls.__videoSkipCurrent)||0;
        var dur=Number(controls&&controls.__videoSkipDuration)||0;
        var jump=clamp(Number(pstore.seconds)||10,1,60);
        var target=cur+(dir*jump);
        if(dur>0)target=clamp(target,0,dur);else target=Math.max(0,target);
        if(controls&&typeof controls.seek==='function'){
          controls.seek(target);
          controls.__videoSkipCurrent=target;
          toast((dir<0?'↶ ':'↷ ')+jump+'s');
        }
      }catch(e){}
    }else ref.current=now;
  }
  return React.createElement(View,{pointerEvents:'box-none',style:{position:'absolute',left:0,right:0,top:0,bottom:0,zIndex:50}},
    React.createElement(Pressable,{onPress:function(){hit(-1);},style:{position:'absolute',left:0,top:0,bottom:0,width:'35%',backgroundColor:'transparent'},accessibilityLabel:'Rewind '+pstore.seconds+' seconds'}),
    React.createElement(Pressable,{onPress:function(){hit(1);},style:{position:'absolute',right:0,top:0,bottom:0,width:'35%',backgroundColor:'transparent'},accessibilityLabel:'Forward '+pstore.seconds+' seconds'})
  );
}

function patchLoader(){
  if(!React||!patcher.after)return false;
  var raw=resolveLoader();
  if(!raw)return false;
  try{
    var target=raw.default||raw;
    if(target&&typeof target.type==='function'){
      var u=patcher.after('type',target,function(args,ret){
        var p=args&&args[0];
        if(!p||!p.source||!p.source.videoURI||!p.controls)return ret;
        return React.createElement(React.Fragment,null,ret,React.createElement(GestureLayer,{controls:p.controls,key:'video-skip-gestures'}));
      });
      if(typeof u==='function')unpatches.push(u);
      status.loader=true;
      return true;
    }
    if(raw.default&&typeof raw.default==='function'){
      var u2=patcher.after('default',raw,function(args,ret){
        var p=args&&args[0];
        if(!p||!p.source||!p.source.videoURI||!p.controls)return ret;
        return React.createElement(React.Fragment,null,ret,React.createElement(GestureLayer,{controls:p.controls,key:'video-skip-gestures'}));
      });
      if(typeof u2==='function')unpatches.push(u2);
      status.loader=true;
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
    React.createElement(Text,{style:{color:'white',fontWeight:'900',fontSize:24}},'Video Skip Gestures'),
    React.createElement(Text,{style:{color:'#aaa',marginTop:7}},'Fullscreen video: double-tap left to rewind and right to skip forward.'),
    React.createElement(Text,{style:{color:status.controls&&status.loader?'#6fdc8c':'#ffb86b',marginTop:12}},'Hooks: controls '+(status.controls?'OK':'missing')+' · fullscreen '+(status.loader?'OK':'missing')),
    React.createElement(View,{style:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:18}},React.createElement(Text,{style:{color:'white'}},'Enable double-tap skip'),React.createElement(Switch,{value:pstore.enabled!==false,onValueChange:function(v){pstore.enabled=v;bump();}})),
    row('Skip amount in seconds','seconds'),
    row('Double-tap window in ms','doubleTapMs'),
    React.createElement(Text,{style:{color:'#777',marginTop:18,marginBottom:30}},'The center 30% of the fullscreen video is untouched so Discord\'s normal controls remain accessible.')
  );
}

function onLoad(){
  patchControls();
  patchLoader();
  toast(status.controls&&status.loader?'Video skip gestures loaded':'Video skip gestures: one or more hooks missing');
}
function onUnload(){while(unpatches.length){try{unpatches.pop()();}catch(e){}}}
return{onLoad:onLoad,onUnload:onUnload,settings:Settings};
})()