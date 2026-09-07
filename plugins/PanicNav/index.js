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

if(pstore.backLabel==null)pstore.backLabel='Back';
if(pstore.homeLabel==null)pstore.homeLabel='Home';
if(pstore.panicLabel==null)pstore.panicLabel='PANIC';
if(pstore.panicCloseModals==null)pstore.panicCloseModals=true;
if(pstore.panicCloseSheets==null)pstore.panicCloseSheets=true;
if(pstore.overlayEnabled==null)pstore.overlayEnabled=true;
if(pstore.overlayX==null)pstore.overlayX=18;
if(pstore.overlayY==null)pstore.overlayY=180;

function toast(msg){try{toastApi.showToast&&toastApi.showToast(msg);}catch(e){}}
function rootNavModule(){return findByProps('getRootNavigationRef')||null;}
function rootNav(){try{var m=rootNavModule();return m&&m.getRootNavigationRef&&m.getRootNavigationRef();}catch(e){return null;}}
function router(){return findByProps('transitionTo','transitionToGuild')||findByProps('transitionTo')||null;}
function modalActions(){return findByProps('popAll','pushLazy')||findByProps('popAll')||null;}
function sheetActions(){return findByProps('hideAllActionSheets')||findByProps('hideActionSheet','openLazy')||null;}
function goBack(){var n=rootNav();try{if(n&&n.canGoBack&&n.canGoBack()&&n.goBack){n.goBack();return true;}}catch(e){}toast('Nothing to go back to');return false;}
function goHome(){try{var r=router();if(r&&r.transitionTo){r.transitionTo('/channels/@me');return true;}}catch(e){}try{var n=rootNav();if(n&&n.navigate){n.navigate('Messages');return true;}}catch(e){}toast('Could not open Messages');return false;}
function panic(){try{if(pstore.panicCloseSheets!==false){var s=sheetActions();if(s&&s.hideAllActionSheets)s.hideAllActionSheets();else if(s&&s.hideActionSheet)s.hideActionSheet();}}catch(e){}try{if(pstore.panicCloseModals!==false){var m=modalActions();if(m&&m.popAll)m.popAll();}}catch(e){}goHome();}

function FloatingControls(){
  if(!React||!RN||pstore.overlayEnabled===false)return null;
  var View=RN.View,Text=RN.Text,Pressable=RN.Pressable||RN.TouchableOpacity,PanResponder=RN.PanResponder;
  var s=React.useState({x:Number(pstore.overlayX)||18,y:Number(pstore.overlayY)||180}),pos=s[0],setPos=s[1];
  var base=React.useRef(pos);base.current=pos;
  var start=React.useRef(pos);
  var pan=React.useMemo(function(){
    if(!PanResponder||!PanResponder.create)return{};
    return PanResponder.create({
      onStartShouldSetPanResponder:function(){return false;},
      onMoveShouldSetPanResponder:function(e,g){return Math.abs(g.dx)>4||Math.abs(g.dy)>4;},
      onPanResponderGrant:function(){start.current=base.current;},
      onPanResponderMove:function(e,g){setPos({x:start.current.x+g.dx,y:start.current.y+g.dy});},
      onPanResponderRelease:function(e,g){var x=Math.max(4,start.current.x+g.dx),y=Math.max(44,start.current.y+g.dy);pstore.overlayX=x;pstore.overlayY=y;setPos({x:x,y:y});},
      onPanResponderTerminate:function(e,g){var x=Math.max(4,start.current.x+g.dx),y=Math.max(44,start.current.y+g.dy);pstore.overlayX=x;pstore.overlayY=y;setPos({x:x,y:y});}
    });
  },[]);
  function b(label,fn,danger){return React.createElement(Pressable,{onPress:fn,style:{paddingVertical:9,paddingHorizontal:11,borderRadius:10,backgroundColor:danger?'#b3261e':'#34363c',marginHorizontal:2}},React.createElement(Text,{style:{color:'white',fontWeight:'800',fontSize:12}},label));}
  return React.createElement(View,Object.assign({pointerEvents:'box-none',style:{position:'absolute',left:pos.x,top:pos.y,zIndex:2147483647,elevation:9999}},pan.panHandlers||{}),
    React.createElement(View,{style:{flexDirection:'row',alignItems:'center',padding:5,borderRadius:14,backgroundColor:'rgba(20,20,22,0.94)',borderWidth:1,borderColor:'rgba(255,255,255,0.15)',shadowColor:'#000',shadowOpacity:0.35,shadowRadius:8,shadowOffset:{width:0,height:3}}},
      React.createElement(View,{style:{paddingHorizontal:7,paddingVertical:8}},React.createElement(Text,{style:{color:'#aaa',fontWeight:'900',fontSize:14}},'≡')),
      b(pstore.backLabel||'Back',goBack,false),
      b(pstore.homeLabel||'Home',goHome,false),
      b(pstore.panicLabel||'PANIC',panic,true)
    )
  );
}

function patchOverlay(){
  if(!React||!patcher.after)return false;
  var nav=findByProps('NavigationContainer')||common.NavigationNative;
  if(nav&&typeof nav.NavigationContainer==='function'){
    try{var u=patcher.after('NavigationContainer',nav,function(args,ret){return React.createElement(React.Fragment,null,ret,React.createElement(FloatingControls));});if(typeof u==='function')unpatches.push(u);return true;}catch(e){}
  }
  var providers=[findByProps('ThemeProvider','AccessibilityProvider'),findByProps('NavigationContainerRefContext')];
  for(var i=0;i<providers.length;i++){
    var m=providers[i];if(!m)continue;
    var keys=Object.keys(m);
    for(var j=0;j<keys.length;j++){
      var k=keys[j];if(typeof m[k]!=='function')continue;
      try{var uu=patcher.after(k,m,function(args,ret){if(!ret)return ret;return React.createElement(React.Fragment,null,ret,React.createElement(FloatingControls));},true);if(typeof uu==='function'){unpatches.push(uu);return true;}}catch(e){}
    }
  }
  return false;
}

function Settings(){
  if(!React||!RN)return null;
  var View=RN.View,Text=RN.Text,TextInput=RN.TextInput,Pressable=RN.Pressable||RN.TouchableOpacity,Switch=RN.Switch,ScrollView=RN.ScrollView||RN.View;
  var st=React.useState(0),tick=st[0],setTick=st[1];function bump(){setTick(tick+1);}
  function button(label,onPress,danger){return React.createElement(Pressable,{onPress:onPress,style:{paddingVertical:14,paddingHorizontal:14,borderRadius:12,backgroundColor:danger?'#b3261e':'#5865F2',marginVertical:6}},React.createElement(Text,{style:{color:'white',fontWeight:'800',textAlign:'center',fontSize:16}},label));}
  function input(label,key){return React.createElement(View,{style:{marginTop:12}},React.createElement(Text,{style:{color:'white',fontWeight:'700',marginBottom:5}},label),React.createElement(TextInput,{value:String(pstore[key]||''),onChangeText:function(v){pstore[key]=v;bump();},style:{borderWidth:1,borderColor:'#555',borderRadius:10,padding:11,color:'white'}}));}
  function toggle(label,key){return React.createElement(View,{style:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:16}},React.createElement(Text,{style:{color:'white',flex:1,marginRight:12}},label),React.createElement(Switch,{value:pstore[key]!==false,onValueChange:function(v){pstore[key]=v;bump();}}));}
  return React.createElement(ScrollView,{style:{padding:16}},
    React.createElement(Text,{style:{color:'white',fontWeight:'900',fontSize:24}},'PanicNav'),
    React.createElement(Text,{style:{color:'#aaa',marginTop:6,marginBottom:14}},'The floating controls stay over Discord and can be dragged by the ≡ handle.'),
    toggle('Show floating controls', 'overlayEnabled'),
    button('Reset floating position',function(){pstore.overlayX=18;pstore.overlayY=180;toast('Position reset');}),
    button(pstore.backLabel||'Back',goBack),button(pstore.homeLabel||'Home',goHome),button(pstore.panicLabel||'PANIC',panic,true),
    input('Back button','backLabel'),input('Home button','homeLabel'),input('Panic button','panicLabel'),
    toggle('Panic closes action sheets','panicCloseSheets'),toggle('Panic closes modals','panicCloseModals')
  );
}

function onLoad(){var ok=patchOverlay();toast(ok?'PanicNav floating controls loaded':'PanicNav loaded; overlay hook unavailable');}
function onUnload(){while(unpatches.length){try{unpatches.pop()();}catch(e){}}}
return{onLoad:onLoad,onUnload:onUnload,settings:Settings};
})()