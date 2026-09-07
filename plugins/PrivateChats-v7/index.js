(function(){
'use strict';
var V=globalThis.vendetta||globalThis.revenge||globalThis.bunny||{};
var metro=V.metro||{};
var patcher=V.patcher||{};
var ui=V.ui||{};
var storage=V.storage||{};
var common=metro.common||{};
var findByProps=metro.findByProps||function(){return null;};
var React=common.React||findByProps('createElement','useState');
var RN=common.ReactNative||findByProps('View','Text','TextInput','Pressable');
var unpatches=[];
var unlocked=false;
var state=Object.assign({passcode:'2580',hiddenGuildIds:[],hiddenChannelIds:[],hideMedia:true},storage.privateChats||{});

function save(){
  state.hiddenGuildIds=Array.from(new Set((state.hiddenGuildIds||[]).map(String)));
  state.hiddenChannelIds=Array.from(new Set((state.hiddenChannelIds||[]).map(String)));
  try{storage.privateChats={passcode:String(state.passcode||'2580'),hiddenGuildIds:state.hiddenGuildIds,hiddenChannelIds:state.hiddenChannelIds,hideMedia:!!state.hideMedia};}catch(e){}
}
function toast(t){try{ui.toasts&&ui.toasts.showToast&&ui.toasts.showToast(t);}catch(e){}}
function stores(){return{
  guild:findByProps('getGuilds','getGuild')||findByProps('getGuild','getGuildCount'),
  channel:findByProps('getChannel','getDMFromUserId')||findByProps('getChannel','getMutableGuildChannelsForGuild'),
  privateSort:findByProps('getPrivateChannelIds')||findByProps('getSortedPrivateChannels'),
  message:findByProps('getMessage','getMessages')||findByProps('getMessages','getMessage')
};}
function guildById(id){var s=stores();try{return id&&s.guild&&s.guild.getGuild&&s.guild.getGuild(String(id));}catch(e){return null;}}
function channelById(id){var s=stores();try{return id&&s.channel&&s.channel.getChannel&&s.channel.getChannel(String(id));}catch(e){return null;}}
function isDMChannel(ch){return !!(ch&&!((ch.guild_id||ch.guildId))&&(Number(ch.type)===1||Number(ch.type)===3||Array.isArray(ch.recipients)));}
function labelFor(t){if(!t)return'';if(t.kind==='server'){var g=guildById(t.id);return(g&&g.name)||'server';}var ch=channelById(t.id);if(ch&&ch.name)return ch.name;return'DM';}
function filterList(v,ids){
  ids=ids||[];
  if(Array.isArray(v))return v.filter(function(x){var id=typeof x==='string'?x:(x&&(x.id||x.channelId||x.guildId));return id==null||ids.indexOf(String(id))===-1;});
  if(v&&typeof v==='object'){var o={};Object.keys(v).forEach(function(k){var x=v[k],id=(x&&(x.id||x.channelId||x.guildId))||k;if(ids.indexOf(String(id))===-1)o[k]=x;});return o;}
  return v;
}
function after(obj,name,fn){if(!obj||typeof obj[name]!=='function'||!patcher.after)return null;try{var u=patcher.after(name,obj,function(args,ret){return fn(ret,args);});if(typeof u==='function')unpatches.push(u);return u;}catch(e){return null;}}
function refresh(){var s=stores();[s.guild,s.privateSort].forEach(function(x){try{x&&x.emitChange&&x.emitChange();}catch(e){}});}
function isProtected(t){return t.kind==='server'?state.hiddenGuildIds.indexOf(String(t.id))!==-1:state.hiddenChannelIds.indexOf(String(t.id))!==-1;}
function toggleTarget(t){
  var id=String(t.id),was=isProtected(t);
  if(t.kind==='server'){
    state.hiddenGuildIds=was?state.hiddenGuildIds.filter(function(x){return String(x)!==id;}):state.hiddenGuildIds.concat([id]);
  }else{
    state.hiddenChannelIds=was?state.hiddenChannelIds.filter(function(x){return String(x)!==id;}):state.hiddenChannelIds.concat([id]);
  }
  save();unlocked=false;refresh();
  toast((was?'Unprotected ':'Protected ')+labelFor(t));
}
function patchStores(){
  var s=stores();
  after(s.guild,'getGuilds',function(ret){return unlocked?ret:filterList(ret,state.hiddenGuildIds);});
  after(s.guild,'getGuildsArray',function(ret){return unlocked?ret:filterList(ret,state.hiddenGuildIds);});
  after(s.privateSort,'getPrivateChannelIds',function(ret){return unlocked?ret:filterList(ret,state.hiddenChannelIds);});
  after(s.privateSort,'getSortedPrivateChannels',function(ret){return unlocked?ret:filterList(ret,state.hiddenChannelIds);});
  after(s.message,'getMessage',function(ret){if(!ret||unlocked||!state.hideMedia)return ret;var cid=ret.channel_id||ret.channelId;if(state.hiddenChannelIds.indexOf(String(cid))===-1)return ret;return Object.assign({},ret,{attachments:[],embeds:[],stickers:[],stickerItems:[]});});
}
function collectObjects(root,out,depth,seen){
  if(root==null||depth>4||out.length>80)return;
  var typ=typeof root;
  if(typ!=='object')return;
  if(seen.indexOf(root)!==-1)return;
  seen.push(root);out.push(root);
  if(Array.isArray(root)){for(var i=0;i<root.length&&i<30;i++)collectObjects(root[i],out,depth+1,seen);return;}
  var keys=['guild','channel','context','data','props','user','recipient','message','item','target'];
  for(var k=0;k<keys.length;k++){try{if(root[keys[k]]!=null)collectObjects(root[keys[k]],out,depth+1,seen);}catch(e){}}
}
function resolveTarget(args){
  var objs=[];collectObjects(args,objs,0,[]);
  var channelIds=[],guildIds=[],genericIds=[];
  for(var i=0;i<objs.length;i++){
    var o=objs[i];if(!o||typeof o!=='object')continue;
    try{
      if(o.channel&&o.channel.id){var oc=o.channel;if(isDMChannel(oc))return{kind:'dm',id:String(oc.id)};channelIds.push(String(oc.id));}
      if(o.guild&&o.guild.id){guildIds.push(String(o.guild.id));}
      if(o.channelId!=null)channelIds.push(String(o.channelId));
      if(o.channel_id!=null)channelIds.push(String(o.channel_id));
      if(o.guildId!=null)guildIds.push(String(o.guildId));
      if(o.guild_id!=null)guildIds.push(String(o.guild_id));
      if(o.id!=null)genericIds.push(String(o.id));
      if(o.id!=null&&isDMChannel(o))return{kind:'dm',id:String(o.id)};
      if(o.id!=null&&Array.isArray(o.features)&&guildById(o.id))return{kind:'server',id:String(o.id)};
    }catch(e){}
  }
  for(var c=0;c<channelIds.length;c++){var ch=channelById(channelIds[c]);if(isDMChannel(ch))return{kind:'dm',id:String(ch.id)};}
  for(var g=0;g<guildIds.length;g++){var guild=guildById(guildIds[g]);if(guild)return{kind:'server',id:String(guild.id)};}
  for(var n=0;n<genericIds.length;n++){var ch2=channelById(genericIds[n]);if(isDMChannel(ch2))return{kind:'dm',id:String(ch2.id)};}
  for(var m=0;m<genericIds.length;m++){var g2=guildById(genericIds[m]);if(g2)return{kind:'server',id:String(g2.id)};}
  return null;
}
function findRows(root){
  var seen=[];
  function walk(x,depth){
    if(x==null||depth>12)return null;
    if(Array.isArray(x)){
      var rowish=0;
      for(var i=0;i<x.length;i++){
        var p=x[i]&&x[i].props;
        if(p&&typeof p.onPress==='function'&&(typeof p.label==='string'||p.iconSource!=null))rowish++;
      }
      if(rowish>0)return x;
      for(var j=0;j<x.length;j++){var r=walk(x[j],depth+1);if(r)return r;}
      return null;
    }
    if(typeof x!=='object')return null;
    if(seen.indexOf(x)!==-1)return null;seen.push(x);
    try{if(x.props){var rp=walk(x.props.children,depth+1);if(rp)return rp;}}
    catch(e){}
    return null;
  }
  return walk(root,0);
}
function patchLongPressMenus(){
  var ActionSheet=findByProps('openLazy','hideActionSheet');
  var rowMod=findByProps('ActionSheetRow')||{};
  var ActionSheetRow=rowMod.ActionSheetRow;
  if(!ActionSheet||!ActionSheetRow||!React||!patcher.before||!patcher.after)return;
  var u=patcher.before('openLazy',ActionSheet,function(args){
    try{
      var key=String((args&&args[1])||'');
      var low=key.toLowerCase();
      if(low.indexOf('message')!==-1||low.indexOf('reaction')!==-1||low.indexOf('emoji')!==-1)return;
      var target=resolveTarget(args&&args.slice?args.slice(1):args);
      if(!target)return;
      var component=args&&args[0];
      if(!component||typeof component.then!=='function')return;
      component.then(function(instance){
        if(!instance||typeof instance.default!=='function')return;
        var once=null;
        once=patcher.after('default',instance,function(_renderArgs,tree){
          try{
            var rows=findRows(tree);if(!rows)return;
            var marker='privatechats-'+target.kind+'-'+target.id;
            for(var q=0;q<rows.length;q++){if(rows[q]&&rows[q].key===marker)return;}
            var already=isProtected(target);
            var label=(already?'Unprotect ':'Protect ')+(target.kind==='server'?'Server':'DM');
            rows.push(React.createElement(ActionSheetRow,{key:marker,label:label,onPress:function(){try{ActionSheet.hideActionSheet&&ActionSheet.hideActionSheet();}catch(e){}toggleTarget(target);}}));
          }finally{try{once&&once();}catch(e){}}
        });
      }).catch(function(){});
    }catch(e){}
  });
  if(typeof u==='function')unpatches.push(u);
}
function SettingsComponent(){
  if(!React||!RN)return null;
  var View=RN.View,Text=RN.Text,TextInput=RN.TextInput,Pressable=RN.Pressable||RN.TouchableOpacity,Switch=RN.Switch,ScrollView=RN.ScrollView||RN.View;
  var a=React.useState(''),code=a[0],setCode=a[1];
  var b=React.useState(String(state.passcode||'2580')),newPass=b[0],setNewPass=b[1];
  var c=React.useState(false),showPass=c[0],setShowPass=c[1];
  var d=React.useState(0),tick=d[0],setTick=d[1];
  var e=React.useState(unlocked?'UNLOCKED':'LOCKED'),status=e[0],setStatus=e[1];
  function bump(){setTick(tick+1);}
  function btn(label,onPress,secondary){return React.createElement(Pressable,{onPress:onPress,style:{paddingVertical:13,paddingHorizontal:14,borderRadius:10,backgroundColor:secondary?'#3f4147':'#5865F2',marginVertical:5}},React.createElement(Text,{style:{color:'white',fontWeight:'700',textAlign:'center'}},label));}
  function itemName(id,type){if(type==='g'){var g=guildById(id);return(g&&g.name)||id;}var ch=channelById(id);return(ch&&ch.name)||id;}
  function row(id,type){return React.createElement(View,{key:type+id,style:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:10}},React.createElement(Text,{style:{color:'white',flex:1}},itemName(id,type)),React.createElement(Pressable,{onPress:function(){if(type==='g')state.hiddenGuildIds=state.hiddenGuildIds.filter(function(x){return String(x)!==String(id);});else state.hiddenChannelIds=state.hiddenChannelIds.filter(function(x){return String(x)!==String(id);});save();refresh();bump();}},React.createElement(Text,{style:{color:'#ff6b6b',fontWeight:'700'}},'Remove')));}
  return React.createElement(ScrollView,{style:{padding:16}},
    React.createElement(Text,{style:{fontSize:22,fontWeight:'800',color:'white'}},'Private Chats'),
    React.createElement(Text,{style:{color:'#aaa',marginVertical:8}},'State: '+status),
    React.createElement(Text,{style:{color:'#ddd',marginBottom:12}},'Hold down a DM or server in Discord and choose Protect DM / Protect Server.'),
    React.createElement(TextInput,{value:code,onChangeText:setCode,placeholder:'Passcode',secureTextEntry:true,keyboardType:'number-pad',style:{borderWidth:1,borderColor:'#555',borderRadius:9,padding:10,color:'white',marginVertical:5}}),
    btn('Show Private',function(){if(String(code)===String(state.passcode)){unlocked=true;refresh();setCode('');setStatus('UNLOCKED');toast('Private chats shown');}else setStatus('Wrong passcode');}),
    btn('Hide Private',function(){unlocked=false;refresh();setStatus('LOCKED');toast('Private chats hidden');},true),
    React.createElement(Text,{style:{fontWeight:'700',color:'white',marginTop:18}},'Protected servers'),
    state.hiddenGuildIds.length?state.hiddenGuildIds.map(function(id){return row(String(id),'g');}):React.createElement(Text,{style:{color:'#888'}},'None'),
    React.createElement(Text,{style:{fontWeight:'700',color:'white',marginTop:18}},'Protected DMs'),
    state.hiddenChannelIds.length?state.hiddenChannelIds.map(function(id){return row(String(id),'c');}):React.createElement(Text,{style:{color:'#888'}},'None'),
    React.createElement(Text,{style:{fontWeight:'700',color:'white',marginTop:18}},'Passcode'),
    React.createElement(TextInput,{value:newPass,onChangeText:setNewPass,placeholder:'Passcode',secureTextEntry:!showPass,keyboardType:'number-pad',style:{borderWidth:1,borderColor:'#555',borderRadius:9,padding:10,color:'white',marginVertical:5}}),
    btn(showPass?'Hide Passcode':'Show Passcode',function(){setShowPass(!showPass);},true),
    btn('Save Passcode',function(){var p=String(newPass||'').trim();if(!p){toast('Passcode cannot be empty');return;}state.passcode=p;save();unlocked=false;refresh();setStatus('LOCKED');toast('Passcode saved');}),
    React.createElement(View,{style:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:18}},React.createElement(Text,{style:{color:'white',flex:1}},'Hide media while locked'),React.createElement(Switch,{value:!!state.hideMedia,onValueChange:function(v){state.hideMedia=!!v;save();bump();}}))
  );
}
function start(){unlocked=false;save();patchStores();patchLongPressMenus();toast('PrivateChats v7 loaded');}
function stop(){unlocked=false;while(unpatches.length){try{unpatches.pop()();}catch(e){}}}
return{onLoad:start,onUnload:stop,start:start,stop:stop,settings:SettingsComponent,SettingsComponent:SettingsComponent};
})()
