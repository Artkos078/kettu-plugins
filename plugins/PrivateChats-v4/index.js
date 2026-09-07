var plugin=(function(){
'use strict';
var metro=bunny.metro||{};
var common=metro.common||{};
var findByProps=metro.findByProps||function(){return null;};
var findByStoreName=metro.findByStoreName||function(){return null;};
var React=common.React||findByProps('createElement','useState');
var RN=common.ReactNative||findByProps('View','Text','TextInput','Pressable');
var patcher=(bunny.api&&bunny.api.patcher)||{};
var toasts=(bunny.ui&&bunny.ui.toasts)||{};
var data=bunny.plugin.createStorage();
if(data.passcode==null)data.passcode='2580';
if(!Array.isArray(data.hiddenGuildIds))data.hiddenGuildIds=[];
if(!Array.isArray(data.hiddenChannelIds))data.hiddenChannelIds=[];
if(data.hideMedia==null)data.hideMedia=true;
var unlocked=false;
var localUnpatches=[];
function toast(t){try{toasts.showToast&&toasts.showToast(t);}catch(e){}}
function uniq(a){return Array.from(new Set((a||[]).map(String)));}
function normalize(){data.hiddenGuildIds=uniq(data.hiddenGuildIds);data.hiddenChannelIds=uniq(data.hiddenChannelIds);}
function stores(){
 var guild=findByStoreName('GuildStore')||findByProps('getGuilds','getGuild');
 var channel=findByStoreName('ChannelStore')||findByProps('getChannel','getDMFromUserId');
 var privateSort=findByStoreName('PrivateChannelSortStore')||findByProps('getPrivateChannelIds')||findByProps('getSortedPrivateChannels');
 var selectedChannel=findByStoreName('SelectedChannelStore')||findByProps('getChannelId','getVoiceChannelId')||findByProps('getLastSelectedChannelId');
 var selectedGuild=findByStoreName('SelectedGuildStore')||findByProps('getGuildId','getLastSelectedGuildId');
 var message=findByStoreName('MessageStore')||findByProps('getMessage','getMessages');
 return{guild:guild,channel:channel,privateSort:privateSort,selectedChannel:selectedChannel,selectedGuild:selectedGuild,message:message};
}
function context(){
 var s=stores(),cid=null,gid=null,ch=null,g=null;
 try{cid=(s.selectedChannel&&s.selectedChannel.getChannelId&&s.selectedChannel.getChannelId())||(s.selectedChannel&&s.selectedChannel.getLastSelectedChannelId&&s.selectedChannel.getLastSelectedChannelId())||null;}catch(e){}
 try{gid=(s.selectedGuild&&s.selectedGuild.getGuildId&&s.selectedGuild.getGuildId())||(s.selectedGuild&&s.selectedGuild.getLastSelectedGuildId&&s.selectedGuild.getLastSelectedGuildId())||null;}catch(e){}
 try{if(cid&&s.channel&&s.channel.getChannel)ch=s.channel.getChannel(cid);}catch(e){}
 if(!gid&&ch)gid=ch.guild_id||ch.guildId||null;
 try{if(gid&&s.guild&&s.guild.getGuild)g=s.guild.getGuild(gid);}catch(e){}
 return{channelId:cid?String(cid):null,guildId:gid?String(gid):null,channel:ch,guild:g};
}
function filterList(v,ids){
 ids=ids||[];
 if(Array.isArray(v))return v.filter(function(x){var id=typeof x==='string'?x:(x&&(x.id||x.channelId||x.guildId));return id==null||ids.indexOf(String(id))===-1;});
 if(v&&typeof v==='object'){var o={};Object.keys(v).forEach(function(k){var x=v[k],id=(x&&(x.id||x.channelId||x.guildId))||k;if(ids.indexOf(String(id))===-1)o[k]=x;});return o;}
 return v;
}
function after(obj,name,fn){
 if(!obj||typeof obj[name]!=='function'||!patcher.after)return;
 try{var un=patcher.after(name,obj,function(args,ret){return fn(ret,args);});if(typeof un==='function')localUnpatches.push(un);}catch(e){try{bunny.plugin.logger.warn('[PrivateChats] patch '+name+' failed',e);}catch(_) {}}
}
function refresh(){var s=stores();[s.guild,s.privateSort].forEach(function(x){try{x&&x.emitChange&&x.emitChange();}catch(e){}});}
function addCurrentServer(){var c=context();if(!c.guildId){toast('Open a server first');return false;}if(data.hiddenGuildIds.indexOf(c.guildId)===-1)data.hiddenGuildIds.push(c.guildId);normalize();unlocked=false;refresh();toast('Protected '+((c.guild&&c.guild.name)||'current server'));return true;}
function addCurrentDM(){var c=context();if(!c.channelId){toast('Open a DM first');return false;}if(c.guildId){toast('Open a DM, not a server channel');return false;}if(data.hiddenChannelIds.indexOf(c.channelId)===-1)data.hiddenChannelIds.push(c.channelId);normalize();unlocked=false;refresh();toast('Protected current DM');return true;}
function patchStores(){
 var s=stores();
 after(s.guild,'getGuilds',function(ret){return unlocked?ret:filterList(ret,data.hiddenGuildIds);});
 after(s.guild,'getGuildsArray',function(ret){return unlocked?ret:filterList(ret,data.hiddenGuildIds);});
 after(s.privateSort,'getPrivateChannelIds',function(ret){return unlocked?ret:filterList(ret,data.hiddenChannelIds);});
 after(s.privateSort,'getSortedPrivateChannels',function(ret){return unlocked?ret:filterList(ret,data.hiddenChannelIds);});
 after(s.message,'getMessage',function(ret){if(!ret||unlocked||!data.hideMedia)return ret;var cid=ret.channel_id||ret.channelId;if(data.hiddenChannelIds.indexOf(String(cid))===-1)return ret;return Object.assign({},ret,{attachments:[],embeds:[],stickers:[],stickerItems:[]});});
}
function SettingsComponent(){
 if(!React||!RN)return null;
 var View=RN.View,Text=RN.Text,TextInput=RN.TextInput,Pressable=RN.Pressable||RN.TouchableOpacity,Switch=RN.Switch,ScrollView=RN.ScrollView||RN.View;
 var a=React.useState(''),code=a[0],setCode=a[1];
 var b=React.useState(String(data.passcode||'2580')),newPass=b[0],setNewPass=b[1];
 var c=React.useState(false),showPass=c[0],setShowPass=c[1];
 var d=React.useState(0),tick=d[0],setTick=d[1];
 var e=React.useState(unlocked?'UNLOCKED':'LOCKED'),status=e[0],setStatus=e[1];
 function bump(){setTick(tick+1);}
 function btn(label,onPress,secondary){return React.createElement(Pressable,{onPress:onPress,style:{paddingVertical:13,paddingHorizontal:14,borderRadius:10,backgroundColor:secondary?'#3f4147':'#5865F2',marginVertical:5}},React.createElement(Text,{style:{color:'white',fontWeight:'700',textAlign:'center'}},label));}
 function row(id,type){return React.createElement(View,{key:type+id,style:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:10}},React.createElement(Text,{style:{color:'white',flex:1}},id),React.createElement(Pressable,{onPress:function(){if(type==='g')data.hiddenGuildIds=data.hiddenGuildIds.filter(function(x){return String(x)!==String(id);});else data.hiddenChannelIds=data.hiddenChannelIds.filter(function(x){return String(x)!==String(id);});normalize();refresh();bump();}},React.createElement(Text,{style:{color:'#ff6b6b',fontWeight:'700'}},'Remove')));}
 return React.createElement(ScrollView,{style:{padding:16}},
  React.createElement(Text,{style:{fontSize:22,fontWeight:'800',color:'white'}},'Private Chats v4'),
  React.createElement(Text,{style:{color:'#aaa',marginVertical:8}},'State: '+status),
  React.createElement(TextInput,{value:code,onChangeText:setCode,placeholder:'Passcode',secureTextEntry:true,keyboardType:'number-pad',style:{borderWidth:1,borderColor:'#555',borderRadius:9,padding:10,color:'white',marginVertical:5}}),
  btn('Show Private',function(){if(String(code)===String(data.passcode)){unlocked=true;refresh();setCode('');setStatus('UNLOCKED');toast('Private chats shown');}else setStatus('Wrong passcode');}),
  btn('Hide Private',function(){unlocked=false;refresh();setStatus('LOCKED');toast('Private chats hidden');},true),
  React.createElement(Text,{style:{fontWeight:'700',color:'white',marginTop:18}},'Protect what is open now'),
  btn('Protect Current Server',function(){if(addCurrentServer())bump();}),
  btn('Protect Current DM',function(){if(addCurrentDM())bump();}),
  React.createElement(Text,{style:{fontWeight:'700',color:'white',marginTop:18}},'Protected servers'),
  data.hiddenGuildIds.length?data.hiddenGuildIds.map(function(id){return row(String(id),'g');}):React.createElement(Text,{style:{color:'#888'}},'None'),
  React.createElement(Text,{style:{fontWeight:'700',color:'white',marginTop:18}},'Protected DMs'),
  data.hiddenChannelIds.length?data.hiddenChannelIds.map(function(id){return row(String(id),'c');}):React.createElement(Text,{style:{color:'#888'}},'None'),
  React.createElement(Text,{style:{fontWeight:'700',color:'white',marginTop:18}},'Passcode'),
  React.createElement(TextInput,{value:newPass,onChangeText:setNewPass,placeholder:'Passcode',secureTextEntry:!showPass,keyboardType:'number-pad',style:{borderWidth:1,borderColor:'#555',borderRadius:9,padding:10,color:'white',marginVertical:5}}),
  btn(showPass?'Hide Passcode':'Show Passcode',function(){setShowPass(!showPass);},true),
  btn('Save Passcode',function(){var p=String(newPass||'').trim();if(!p){toast('Passcode cannot be empty');return;}data.passcode=p;unlocked=false;refresh();setStatus('LOCKED');toast('Passcode saved');}),
  React.createElement(View,{style:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:18}},React.createElement(Text,{style:{color:'white',flex:1}},'Hide media while locked'),React.createElement(Switch,{value:!!data.hideMedia,onValueChange:function(v){data.hideMedia=!!v;bump();}}))
 );
}
function start(){unlocked=false;normalize();patchStores();toast('PrivateChats v4 loaded');}
function stop(){unlocked=false;while(localUnpatches.length){try{localUnpatches.pop()();}catch(e){}}}
return{default:{start:start,stop:stop,SettingsComponent:SettingsComponent}};
})();