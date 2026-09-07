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
var dispatcher=null;
var listeners=[];
var lastFire=0;
var status='not started';

if(pstore.enabled==null)pstore.enabled=true;
if(pstore.leftAction==null)pstore.leftAction='Home';
if(pstore.rightAction==null)pstore.rightAction='Back';
if(pstore.showFeedback==null)pstore.showFeedback=true;
if(pstore.cooldownMs==null)pstore.cooldownMs=900;

var ACTIONS=['Off','Back','Home','Panic'];

function toast(msg){try{if(pstore.showFeedback!==false&&toastApi.showToast)toastApi.showToast(msg);}catch(e){}}
function rootNavModule(){return findByProps('getRootNavigationRef')||null;}
function rootNav(){try{var m=rootNavModule();return m&&m.getRootNavigationRef&&m.getRootNavigationRef();}catch(e){return null;}}
function router(){return findByProps('transitionTo','transitionToGuild')||findByProps('transitionTo')||null;}
function modalActions(){return findByProps('popAll','pushLazy')||findByProps('popAll')||null;}
function sheetActions(){return findByProps('hideAllActionSheets')||findByProps('hideActionSheet','openLazy')||null;}

function goBack(){
  var n=rootNav();
  try{if(n&&typeof n.canGoBack==='function'&&n.canGoBack()&&typeof n.goBack==='function'){n.goBack();return true;}}catch(e){}
  toast('Nothing to go back to');
  return false;
}
function goHome(){
  try{var r=router();if(r&&typeof r.transitionTo==='function'){r.transitionTo('/channels/@me');return true;}}catch(e){}
  try{var n=rootNav();if(n&&typeof n.navigate==='function'){n.navigate('Messages');return true;}}catch(e){}
  toast('Could not open Messages');
  return false;
}
function panic(){
  try{var s=sheetActions();if(s&&typeof s.hideAllActionSheets==='function')s.hideAllActionSheets();else if(s&&typeof s.hideActionSheet==='function')s.hideActionSheet();}catch(e){}
  try{var m=modalActions();if(m&&typeof m.popAll==='function')m.popAll();}catch(e){}
  goHome();
  return true;
}
function runAction(action,direction){
  if(!pstore.enabled||action==='Off')return;
  var now=Date.now();
  if(now-lastFire<Math.max(250,Number(pstore.cooldownMs)||900))return;
  lastFire=now;
  if(action==='Back')goBack();
  else if(action==='Home')goHome();
  else if(action==='Panic')panic();
  toast(direction+' swipe → '+action);
}

function findDispatcher(){
  var m=findByProps('ComponentDispatch','ComponentDispatcher');
  if(m&&m.ComponentDispatch)return m.ComponentDispatch;
  var d=findByProps('dispatch','subscribe','unsubscribe');
  return d||null;
}
function subscribe(){
  dispatcher=findDispatcher();
  if(!dispatcher||typeof dispatcher.subscribe!=='function'){
    status='ComponentDispatch missing';
    return false;
  }
  var onShown=function(){runAction(String(pstore.leftAction||'Home'),'Left');};
  var onHidden=function(){runAction(String(pstore.rightAction||'Back'),'Right');};
  try{
    dispatcher.subscribe('CHANNEL_DETAILS_SHOWN',onShown);
    dispatcher.subscribe('CHANNEL_DETAILS_HIDDEN',onHidden);
    listeners=[['CHANNEL_DETAILS_SHOWN',onShown],['CHANNEL_DETAILS_HIDDEN',onHidden]];
    status='listening';
    return true;
  }catch(e){status='subscribe failed';return false;}
}
function unsubscribe(){
  if(!dispatcher||typeof dispatcher.unsubscribe!=='function')return;
  for(var i=0;i<listeners.length;i++){
    try{dispatcher.unsubscribe(listeners[i][0],listeners[i][1]);}catch(e){}
  }
  listeners=[];
}

function Settings(){
  if(!React||!RN)return null;
  var View=RN.View,Text=RN.Text,Pressable=RN.Pressable||RN.TouchableOpacity,Switch=RN.Switch,ScrollView=RN.ScrollView||RN.View,TextInput=RN.TextInput;
  var st=React.useState(0),tick=st[0],setTick=st[1];
  function bump(){setTick(tick+1);}
  function btn(label,onPress,danger){return React.createElement(Pressable,{onPress:onPress,style:{paddingVertical:13,paddingHorizontal:14,borderRadius:11,backgroundColor:danger?'#b3261e':'#5865F2',marginVertical:5}},React.createElement(Text,{style:{color:'white',fontWeight:'800',textAlign:'center'}},label));}
  function actionRow(title,key){
    var cur=String(pstore[key]||'Off');
    return React.createElement(View,{style:{marginTop:16}},
      React.createElement(Text,{style:{color:'white',fontWeight:'800',marginBottom:7}},title),
      React.createElement(View,{style:{flexDirection:'row',flexWrap:'wrap'}},ACTIONS.map(function(a){return React.createElement(Pressable,{key:a,onPress:function(){pstore[key]=a;bump();},style:{paddingVertical:9,paddingHorizontal:11,borderRadius:9,marginRight:6,marginBottom:6,backgroundColor:cur===a?'#5865F2':'#34363c'}},React.createElement(Text,{style:{color:'white',fontWeight:'700'}},a));}))
    );
  }
  return React.createElement(ScrollView,{style:{padding:16}},
    React.createElement(Text,{style:{color:'white',fontSize:24,fontWeight:'900'}},'PanicNav Gestures'),
    React.createElement(Text,{style:{color:'#aaa',marginTop:6}},'Status: '+status),
    React.createElement(Text,{style:{color:'#777',marginTop:8,marginBottom:14}},'Uses Discord\'s built-in channel/member-list swipe events. It does not render an overlay.'),
    React.createElement(View,{style:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}},React.createElement(Text,{style:{color:'white',flex:1}},'Enable swipe actions'),React.createElement(Switch,{value:pstore.enabled!==false,onValueChange:function(v){pstore.enabled=v;bump();}})),
    actionRow('Swipe left action','leftAction'),
    actionRow('Swipe right action','rightAction'),
    React.createElement(View,{style:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:12}},React.createElement(Text,{style:{color:'white',flex:1}},'Show gesture feedback'),React.createElement(Switch,{value:pstore.showFeedback!==false,onValueChange:function(v){pstore.showFeedback=v;bump();}})),
    React.createElement(Text,{style:{color:'white',fontWeight:'800',marginTop:18,marginBottom:6}},'Cooldown (ms)'),
    React.createElement(TextInput,{value:String(pstore.cooldownMs||900),keyboardType:'number-pad',onChangeText:function(v){var n=parseInt(v,10);if(isFinite(n))pstore.cooldownMs=Math.max(250,n);bump();},style:{borderWidth:1,borderColor:'#555',borderRadius:10,padding:10,color:'white'}}),
    React.createElement(Text,{style:{color:'#777',marginTop:12}},'Note: these events are also used when Discord opens/closes the member panel, so using the panel button can trigger the mapped action too.'),
    btn('Test Back',goBack),btn('Test Home',goHome),btn('Test Panic',panic,true)
  );
}

function onLoad(){var ok=subscribe();toast(ok?'PanicNav Gestures loaded':'PanicNav Gestures: '+status);}
function onUnload(){unsubscribe();}
return{onLoad:onLoad,onUnload:onUnload,settings:Settings,SettingsComponent:Settings};
})()