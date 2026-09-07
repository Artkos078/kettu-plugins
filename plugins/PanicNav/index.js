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

if(pstore.backLabel==null)pstore.backLabel='Back';
if(pstore.back2Label==null)pstore.back2Label='Back 2';
if(pstore.homeLabel==null)pstore.homeLabel='Home';
if(pstore.panicLabel==null)pstore.panicLabel='PANIC';
if(pstore.panicCloseModals==null)pstore.panicCloseModals=true;
if(pstore.panicCloseSheets==null)pstore.panicCloseSheets=true;

function toast(msg){
  try{toastApi.showToast&&toastApi.showToast(msg);}catch(e){}
}

function rootNavModule(){
  return findByProps('getRootNavigationRef')||null;
}
function rootNav(){
  try{var m=rootNavModule();return m&&m.getRootNavigationRef&&m.getRootNavigationRef();}catch(e){return null;}
}
function router(){
  return findByProps('transitionTo','transitionToGuild')||findByProps('transitionTo')||null;
}
function modalActions(){
  return findByProps('popAll','pushLazy')||findByProps('popAll')||null;
}
function sheetActions(){
  return findByProps('hideAllActionSheets')||findByProps('hideActionSheet','openLazy')||null;
}

function goBack(count){
  count=Math.max(1,Number(count)||1);
  var n=rootNav();
  if(!n){toast('Navigation unavailable');return false;}
  var moved=false;
  try{
    for(var i=0;i<count;i++){
      if(typeof n.canGoBack==='function'&&!n.canGoBack())break;
      if(typeof n.goBack==='function'){n.goBack();moved=true;}
      else break;
    }
  }catch(e){}
  if(!moved)toast('Nothing to go back to');
  return moved;
}

function goHome(){
  try{
    var r=router();
    if(r&&typeof r.transitionTo==='function'){
      r.transitionTo('/channels/@me');
      return true;
    }
  }catch(e){}
  try{
    var n=rootNav();
    if(n&&typeof n.navigate==='function'){
      n.navigate('Messages');
      return true;
    }
  }catch(e){}
  toast('Could not open Messages');
  return false;
}

function panic(){
  try{
    if(pstore.panicCloseSheets!==false){
      var s=sheetActions();
      if(s&&typeof s.hideAllActionSheets==='function')s.hideAllActionSheets();
      else if(s&&typeof s.hideActionSheet==='function')s.hideActionSheet();
    }
  }catch(e){}
  try{
    if(pstore.panicCloseModals!==false){
      var m=modalActions();
      if(m&&typeof m.popAll==='function')m.popAll();
    }
  }catch(e){}
  goHome();
  toast('Panic navigation activated');
}

function Settings(){
  if(!React||!RN)return null;
  var View=RN.View,Text=RN.Text,TextInput=RN.TextInput,Pressable=RN.Pressable||RN.TouchableOpacity,Switch=RN.Switch,ScrollView=RN.ScrollView||RN.View;
  var tickState=React.useState(0),tick=tickState[0],setTick=tickState[1];
  function bump(){setTick(tick+1);}
  function button(label,onPress,danger){
    return React.createElement(Pressable,{onPress:onPress,style:{paddingVertical:14,paddingHorizontal:14,borderRadius:12,backgroundColor:danger?'#b3261e':'#5865F2',marginVertical:6}},
      React.createElement(Text,{style:{color:'white',fontWeight:'800',textAlign:'center',fontSize:16}},label));
  }
  function input(label,key){
    return React.createElement(View,{style:{marginTop:12}},
      React.createElement(Text,{style:{color:'white',fontWeight:'700',marginBottom:5}},label),
      React.createElement(TextInput,{value:String(pstore[key]||''),onChangeText:function(v){pstore[key]=v;bump();},style:{borderWidth:1,borderColor:'#555',borderRadius:10,padding:11,color:'white'}}));
  }
  function toggle(label,key){
    return React.createElement(View,{style:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:16}},
      React.createElement(Text,{style:{color:'white',flex:1,marginRight:12}},label),
      React.createElement(Switch,{value:pstore[key]!==false,onValueChange:function(v){pstore[key]=v;bump();}}));
  }
  return React.createElement(ScrollView,{style:{padding:16}},
    React.createElement(Text,{style:{color:'white',fontWeight:'900',fontSize:24}},'PanicNav'),
    React.createElement(Text,{style:{color:'#aaa',marginTop:6,marginBottom:14}},'Independent navigation controls. Panic closes Discord overlays and returns directly to Messages.'),
    button(pstore.backLabel||'Back',function(){goBack(1);}),
    button(pstore.back2Label||'Back 2',function(){goBack(2);}),
    button(pstore.homeLabel||'Home',goHome),
    button(pstore.panicLabel||'PANIC',panic,true),
    React.createElement(Text,{style:{color:'white',fontWeight:'800',fontSize:18,marginTop:22}},'Customize labels'),
    input('Back button', 'backLabel'),
    input('Back 2 button', 'back2Label'),
    input('Home button', 'homeLabel'),
    input('Panic button', 'panicLabel'),
    toggle('Panic closes action sheets', 'panicCloseSheets'),
    toggle('Panic closes modals', 'panicCloseModals')
  );
}

function onLoad(){toast('PanicNav loaded');}
function onUnload(){}

return{onLoad:onLoad,onUnload:onUnload,settings:Settings};
})()