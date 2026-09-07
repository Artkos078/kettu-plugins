(function(){
'use strict';

var V=(typeof vendetta!=='undefined'&&vendetta)||globalThis.vendetta||globalThis.revenge||{};
var metro=V.metro||{};
var patcher=V.patcher||{};
var ui=V.ui||{};
var common=metro.common||{};
var findByProps=metro.findByProps||function(){return null;};
var findByName=metro.findByName||function(){return null;};
var findByStoreName=metro.findByStoreName||function(){return null;};
var React=common.React||findByProps('createElement','useState');
var RN=common.ReactNative||findByProps('View','Text','TextInput','Pressable');
var scopedStorage=V.plugin&&V.plugin.storage;
var data=scopedStorage||{passcode:'2580',hiddenGuildIds:[],hiddenChannelIds:[],hideMedia:true};
var unpatches=[];
var unlocked=false;

if(data.passcode==null)data.passcode='2580';
if(!Array.isArray(data.hiddenGuildIds))data.hiddenGuildIds=[];
if(!Array.isArray(data.hiddenChannelIds))data.hiddenChannelIds=[];
if(data.hideMedia==null)data.hideMedia=true;

function uniq(a){return Array.from(new Set((a||[]).map(String)));}
function normalize(){data.hiddenGuildIds=uniq(data.hiddenGuildIds);data.hiddenChannelIds=uniq(data.hiddenChannelIds);}
function toast(t){try{ui.toasts&&ui.toasts.showToast&&ui.toasts.showToast(t);}catch(e){}}
function addUnpatch(u){if(typeof u==='function')unpatches.push(u);return u;}
function before(obj,name,fn,once){if(!obj||typeof obj[name]!=='function'||!patcher.before)return null;try{return addUnpatch(patcher.before(name,obj,fn,!!once));}catch(e){return null;}}
function after(obj,name,fn,once){if(!obj||typeof obj[name]!=='function'||!patcher.after)return null;try{return addUnpatch(patcher.after(name,obj,fn,!!once));}catch(e){return null;}}

function stores(){
 return{
  guild:findByStoreName('GuildStore')||findByProps('getGuilds','getGuild'),
  sortedGuild:findByStoreName('SortedGuildStore')||findByProps('getFastListGuildFolders'),
  channel:findByStoreName('ChannelStore')||findByProps('getChannel','getDMFromUserId'),
  privateSort:findByStoreName('PrivateChannelSortStore')||findByProps('getPrivateChannelIds')||findByProps('getSortedPrivateChannels'),
  message:findByStoreName('MessageStore')||findByProps('getMessage','getMessages')
 };
}
function guildById(id){var s=stores();try{return id&&s.guild&&s.guild.getGuild&&s.guild.getGuild(String(id));}catch(e){return null;}}
function channelById(id){var s=stores();try{return id&&s.channel&&s.channel.getChannel&&s.channel.getChannel(String(id));}catch(e){return null;}}
function isHiddenGuild(id){return !unlocked&&id!=null&&data.hiddenGuildIds.indexOf(String(id))!==-1;}
function isHiddenChannel(id){return !unlocked&&id!=null&&data.hiddenChannelIds.indexOf(String(id))!==-1;}
function isDM(ch){if(!ch)return false;var gid=ch.guild_id||ch.guildId;if(gid)return false;var type=Number(ch.type);return type===1||type===3||Array.isArray(ch.recipients)||Array.isArray(ch.rawRecipients);}
function refresh(){
 var s=stores();
 [s.guild,s.sortedGuild,s.privateSort,s.channel].forEach(function(x){try{x&&x.emitChange&&x.emitChange();}catch(e){}});
 try{setTimeout(function(){[s.guild,s.sortedGuild,s.privateSort,s.channel].forEach(function(x){try{x&&x.emitChange&&x.emitChange();}catch(e){}});},50);}catch(e){}
}

function filterIdArray(arr,ids){if(!Array.isArray(arr))return arr;return arr.filter(function(x){var id=typeof x==='string'?x:(x&&(x.id||x.channelId||x.guildId));return id==null||ids.indexOf(String(id))===-1;});}
function filterGuildNodes(value,depth,seen){
 if(unlocked||value==null||depth>8)return value;
 if(typeof value!=='object')return value;
 if(seen.indexOf(value)!==-1)return value;seen.push(value);
 if(Array.isArray(value)){
  var out=[];
  for(var i=0;i<value.length;i++){var v=filterGuildNodes(value[i],depth+1,seen);if(v!=null)out.push(v);}
  return out;
 }
 var direct=value.guildId||value.guild_id||(value.guild&&value.guild.id);
 if(direct&&isHiddenGuild(direct))return null;
 var id=value.id;
 if(id&&isHiddenGuild(id)&&(value.guild||value.type==='GUILD'||value.type===0||value.guildId||value.guild_id))return null;
 var changed=false,o=value;
 function clone(){if(o===value)o=Object.assign({},value);}
 ['guildIds','guild_ids'].forEach(function(k){if(Array.isArray(value[k])){var nv=value[k].filter(function(x){return !isHiddenGuild(x);});if(nv.length!==value[k].length){clone();o[k]=nv;changed=true;}}});
 ['children','items','guilds','folders'].forEach(function(k){if(value[k]!=null){var nv=filterGuildNodes(value[k],depth+1,seen);if(nv!==value[k]){clone();o[k]=nv;changed=true;}}});
 if(value.data&&typeof value.data==='object'){
  var did=value.data.id||value.data.guildId||value.data.guild_id;
  if(did&&isHiddenGuild(did))return null;
  var nd=filterGuildNodes(value.data,depth+1,seen);if(nd!==value.data){clone();o.data=nd;changed=true;}
 }
 return changed?o:value;
}
function filterPrivateResult(v){
 if(unlocked)return v;
 if(Array.isArray(v))return v.filter(function(x){var id=typeof x==='string'?x:(x&&(x.id||x.channelId));return id==null||!isHiddenChannel(id);});
 if(v&&typeof v==='object'){
  var o={};Object.keys(v).forEach(function(k){var x=v[k],id=(x&&(x.id||x.channelId))||k;if(!isHiddenChannel(id))o[k]=x;});return o;
 }
 return v;
}
function scrubPrivateProps(root,depth,seen){
 if(unlocked||root==null||depth>10||typeof root!=='object')return root;
 if(seen.indexOf(root)!==-1)return root;seen.push(root);
 if(Array.isArray(root)){for(var i=0;i<root.length;i++)scrubPrivateProps(root[i],depth+1,seen);return root;}
 var keys=Object.keys(root);
 for(var k=0;k<keys.length;k++){
  var key=keys[k],val=root[key];
  if((key==='privateChannelIds'||key==='private_channel_ids'||key==='privateChannels')&&Array.isArray(val)){
   try{root[key]=filterPrivateResult(val);}catch(e){}
  }else if(val&&typeof val==='object'){
   scrubPrivateProps(val,depth+1,seen);
  }
 }
 return root;
}

function patchStores(){
 var s=stores();
 after(s.guild,'getGuilds',function(args,ret){if(unlocked)return ret;var o={};if(ret&&typeof ret==='object')Object.keys(ret).forEach(function(k){if(!isHiddenGuild(k))o[k]=ret[k];});return o;});
 after(s.guild,'getGuildsArray',function(args,ret){return unlocked?ret:filterIdArray(ret,data.hiddenGuildIds);});
 after(s.sortedGuild,'getFastListGuildFolders',function(args,ret){return unlocked?ret:filterGuildNodes(ret,0,[]);});
 after(s.sortedGuild,'getFlattenedGuildIds',function(args,ret){return unlocked?ret:filterIdArray(ret,data.hiddenGuildIds);});
 after(s.privateSort,'getPrivateChannelIds',function(args,ret){return filterPrivateResult(ret);});
 after(s.privateSort,'getSortedPrivateChannels',function(args,ret){return filterPrivateResult(ret);});
 after(s.privateSort,'getSortedChannels',function(args,ret){return filterPrivateResult(ret);});
 after(s.message,'getMessage',function(args,ret){if(!ret||unlocked||!data.hideMedia)return ret;var cid=ret.channel_id||ret.channelId;if(!isHiddenChannel(cid))return ret;return Object.assign({},ret,{attachments:[],embeds:[],stickers:[],stickerItems:[]});});
}

function patchPrivateChannelComponents(){
 var names=['ConnectedPrivateChannels','PrivateChannels','PrivateChannelList','MessagesConnected','MessagesWrapperConnected'];
 names.forEach(function(name){
  var mod=null;try{mod=findByName(name,false);}catch(e){}
  if(!mod)return;
  var parent=mod&&typeof mod.default==='function'?mod:null;
  if(!parent)return;
  after(parent,'default',function(args,ret){
   try{scrubPrivateProps(args,0,[]);scrubPrivateProps(ret,0,[]);}catch(e){}
   try{
    if(ret&&typeof ret.type==='function'&&!ret.__privateChatsPatched){
     ret.__privateChatsPatched=true;
     before(ret,'type',function(a){try{scrubPrivateProps(a,0,[]);}catch(e){}return a;});
     after(ret,'type',function(a,r){try{scrubPrivateProps(r,0,[]);}catch(e){}return r;});
    }
   }catch(e){}
   return ret;
  });
 });
}

function targetLabel(kind,id){if(kind==='server'){var g=guildById(id);return(g&&g.name)||'server';}var c=channelById(id);return(c&&c.name)||'DM';}
function isProtected(kind,id){return kind==='server'?data.hiddenGuildIds.indexOf(String(id))!==-1:data.hiddenChannelIds.indexOf(String(id))!==-1;}
function toggleTarget(kind,id){
 id=String(id);var was=isProtected(kind,id);
 if(kind==='server')data.hiddenGuildIds=was?data.hiddenGuildIds.filter(function(x){return String(x)!==id;}):uniq(data.hiddenGuildIds.concat([id]));
 else data.hiddenChannelIds=was?data.hiddenChannelIds.filter(function(x){return String(x)!==id;}):uniq(data.hiddenChannelIds.concat([id]));
 unlocked=false;normalize();refresh();toast((was?'Unprotected ':'Protected ')+targetLabel(kind,id));
}

function makeProtectRow(kind,id,ActionSheet){
 var rowMod=findByProps('ActionSheetRow')||{};
 var Row=rowMod.ActionSheetRow;
 var Forms=ui.components&&ui.components.Forms;
 var FormRow=Forms&&Forms.FormRow;
 var C=Row||FormRow;
 if(!React||!C)return null;
 var label=(isProtected(kind,id)?'Unprotect ':'Protect ')+(kind==='server'?'Server':'DM');
 return React.createElement(C,{key:'privatechats-'+kind+'-'+id,label:label,onPress:function(){try{ActionSheet&&ActionSheet.hideActionSheet&&ActionSheet.hideActionSheet();}catch(e){}toggleTarget(kind,id);}});
}
function looksLikeRows(arr){
 if(!Array.isArray(arr)||!arr.length)return false;var n=0;
 for(var i=0;i<arr.length;i++){var p=arr[i]&&arr[i].props;if(p&&(typeof p.onPress==='function'||p.label!=null||p.iconSource!=null))n++;}
 return n>0;
}
function injectRowDeep(root,row,depth,seen){
 if(!root||!row||depth>14)return false;
 if(Array.isArray(root)){
  if(looksLikeRows(root)){
   for(var i=0;i<root.length;i++){if(root[i]&&root[i].key===row.key)return true;}
   root.push(row);return true;
  }
  for(var j=0;j<root.length;j++)if(injectRowDeep(root[j],row,depth+1,seen))return true;
  return false;
 }
 if(typeof root!=='object')return false;
 if(seen.indexOf(root)!==-1)return false;seen.push(root);
 try{if(root.props&&injectRowDeep(root.props.children,row,depth+1,seen))return true;}catch(e){}
 var keys=['children','content','items','actions'];
 for(var k=0;k<keys.length;k++){try{if(root[keys[k]]&&injectRowDeep(root[keys[k]],row,depth+1,seen))return true;}catch(e){}}
 return false;
}
function injectKnownDMPath(tree,row){
 try{
  var a=tree&&tree.props&&tree.props.children;
  if(Array.isArray(a)&&a[1]&&a[1].props&&a[1].props.children&&a[1].props.children.props){
   var b=a[1].props.children.props.children;
   if(Array.isArray(b)&&Array.isArray(b[0])){b[0].push(row);return true;}
  }
 }catch(e){}
 return false;
}
function patchSheetPromise(component,kind,id,ActionSheet){
 if(!component||typeof component.then!=='function')return;
 component.then(function(instance){
  if(!instance||typeof instance.default!=='function')return;
  patcher.after('default',instance,function(args,outer){
   var row=makeProtectRow(kind,id,ActionSheet);
   try{injectRowDeep(outer,row,0,[]);}catch(e){}
   try{
    if(outer&&typeof outer.type==='function'){
     patcher.after('type',outer,function(a,inner){
      var r=makeProtectRow(kind,id,ActionSheet);
      var ok=false;try{ok=injectKnownDMPath(inner,r);}catch(e){}
      if(!ok)try{injectRowDeep(inner,r,0,[]);}catch(e){}
      return inner;
     },true);
    }
   }catch(e){}
   return outer;
  },true);
 }).catch(function(){});
}
function patchActionSheets(){
 var ActionSheet=findByProps('openLazy','hideActionSheet');
 if(!ActionSheet)return;
 before(ActionSheet,'openLazy',function(args){
  try{
   var component=args&&args[0],key=String((args&&args[1])||''),props=(args&&args[2])||{};
   var kind=null,id=null;
   if(key.indexOf('ChannelLongPress-')===0){id=key.substring(key.lastIndexOf('-')+1);var ch=channelById(id);if(!ch||!isDM(ch))return args;kind='dm';}
   else if(key.indexOf('GuildActionSheet:')===0){id=key.substring(key.lastIndexOf(':')+1);kind='server';}
   else if(props&&props.guild&&props.guild.id){id=String(props.guild.id);kind='server';}
   else if(props&&props.guildId&&key.toLowerCase().indexOf('guild')!==-1){id=String(props.guildId);kind='server';}
   if(kind&&id)patchSheetPromise(component,kind,id,ActionSheet);
  }catch(e){}
  return args;
 });
}

function Settings(){
 if(!React||!RN)return null;
 var View=RN.View,Text=RN.Text,TextInput=RN.TextInput,Pressable=RN.Pressable||RN.TouchableOpacity,Switch=RN.Switch,ScrollView=RN.ScrollView||RN.View;
 var a=React.useState(''),code=a[0],setCode=a[1];
 var b=React.useState(String(data.passcode||'2580')),newPass=b[0],setNewPass=b[1];
 var c=React.useState(false),showPass=c[0],setShowPass=c[1];
 var d=React.useState(0),tick=d[0],setTick=d[1];
 var e=React.useState(unlocked?'UNLOCKED':'LOCKED'),status=e[0],setStatus=e[1];
 function bump(){setTick(tick+1);}
 function btn(label,onPress,secondary){return React.createElement(Pressable,{onPress:onPress,style:{paddingVertical:13,paddingHorizontal:14,borderRadius:10,backgroundColor:secondary?'#3f4147':'#5865F2',marginVertical:5}},React.createElement(Text,{style:{color:'white',fontWeight:'700',textAlign:'center'}},label));}
 function nameFor(id,type){if(type==='g'){var g=guildById(id);return(g&&g.name)||id;}var ch=channelById(id);return(ch&&ch.name)||id;}
 function item(id,type){return React.createElement(View,{key:type+id,style:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:10}},React.createElement(Text,{style:{color:'white',flex:1}},nameFor(id,type)),React.createElement(Pressable,{onPress:function(){if(type==='g')data.hiddenGuildIds=data.hiddenGuildIds.filter(function(x){return String(x)!==String(id);});else data.hiddenChannelIds=data.hiddenChannelIds.filter(function(x){return String(x)!==String(id);});normalize();refresh();bump();}},React.createElement(Text,{style:{color:'#ff6b6b',fontWeight:'700'}},'Remove')));}
 return React.createElement(ScrollView,{style:{padding:16}},
  React.createElement(Text,{style:{fontSize:22,fontWeight:'800',color:'white'}},'Private Chats'),
  React.createElement(Text,{style:{color:'#aaa',marginVertical:8}},'State: '+status),
  React.createElement(Text,{style:{color:'#ddd',marginBottom:10}},'Hold a DM or server and choose Protect. Protected items stay hidden until Show Private succeeds.'),
  React.createElement(TextInput,{value:code,onChangeText:setCode,placeholder:'Passcode',secureTextEntry:true,keyboardType:'number-pad',style:{borderWidth:1,borderColor:'#555',borderRadius:9,padding:10,color:'white',marginVertical:5}}),
  btn('Show Private',function(){if(String(code)===String(data.passcode)){unlocked=true;refresh();setCode('');setStatus('UNLOCKED');toast('Private chats shown');}else setStatus('Wrong passcode');}),
  btn('Hide Private',function(){unlocked=false;refresh();setStatus('LOCKED');toast('Private chats hidden');},true),
  React.createElement(Text,{style:{fontWeight:'700',color:'white',marginTop:18}},'Protected servers'),
  data.hiddenGuildIds.length?data.hiddenGuildIds.map(function(id){return item(String(id),'g');}):React.createElement(Text,{style:{color:'#888'}},'None'),
  React.createElement(Text,{style:{fontWeight:'700',color:'white',marginTop:18}},'Protected DMs'),
  data.hiddenChannelIds.length?data.hiddenChannelIds.map(function(id){return item(String(id),'c');}):React.createElement(Text,{style:{color:'#888'}},'None'),
  React.createElement(Text,{style:{fontWeight:'700',color:'white',marginTop:18}},'Passcode'),
  React.createElement(TextInput,{value:newPass,onChangeText:setNewPass,placeholder:'Passcode',secureTextEntry:!showPass,keyboardType:'number-pad',style:{borderWidth:1,borderColor:'#555',borderRadius:9,padding:10,color:'white',marginVertical:5}}),
  btn(showPass?'Hide Passcode':'Show Passcode',function(){setShowPass(!showPass);},true),
  btn('Save Passcode',function(){var p=String(newPass||'').trim();if(!p){toast('Passcode cannot be empty');return;}data.passcode=p;unlocked=false;refresh();setStatus('LOCKED');toast('Passcode saved');}),
  React.createElement(View,{style:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:18}},React.createElement(Text,{style:{color:'white',flex:1}},'Hide media while locked'),React.createElement(Switch,{value:!!data.hideMedia,onValueChange:function(v){data.hideMedia=!!v;bump();}}))
 );
}

function start(){unlocked=false;normalize();patchStores();patchPrivateChannelComponents();patchActionSheets();refresh();toast('PrivateChats v9 loaded');}
function stop(){unlocked=false;while(unpatches.length){try{unpatches.pop()();}catch(e){}}refresh();}
return{onLoad:start,onUnload:stop,settings:Settings,SettingsComponent:Settings,start:start,stop:stop};
})()