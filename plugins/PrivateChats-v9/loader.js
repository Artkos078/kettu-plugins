(function(){
'use strict';

var V=(typeof vendetta!=='undefined'&&vendetta)||globalThis.vendetta||{};
var metro=V.metro||{};
var patcher=V.patcher||{};
var ui=V.ui||{};
var utils=V.utils||{};
var common=metro.common||{};
var React=common.React;
var RN=common.ReactNative;
var pstore=(V.plugin&&V.plugin.storage)||{};
var core=null;
var scope=null;
var runtime=null;
var loadError=null;
var ownUnpatches=[];
var timers=[];

function log(){try{(V.logger&&V.logger.log?V.logger.log:console.log).apply(console,arguments);}catch(e){}}
function toast(t){try{ui.toasts&&ui.toasts.showToast&&ui.toasts.showToast(t);}catch(e){log('[PrivateChats v9.2]',t);}}
function add(u){if(typeof u==='function')ownUnpatches.push(u);return u;}
function after(name,parent,cb,once){try{return parent&&typeof parent[name]==='function'&&patcher.after?add(patcher.after(name,parent,cb,!!once)):null;}catch(e){return null;}}
function before(name,parent,cb,once){try{return parent&&typeof parent[name]==='function'&&patcher.before?add(patcher.before(name,parent,cb,!!once)):null;}catch(e){return null;}}
function instead(name,parent,cb,once){try{return parent&&typeof parent[name]==='function'&&patcher.instead?add(patcher.instead(name,parent,cb,!!once)):null;}catch(e){return null;}}
function store(name){try{return metro.findByStoreName&&metro.findByStoreName(name);}catch(e){return null;}}
function props(){try{return metro.findByProps&&metro.findByProps.apply(null,arguments);}catch(e){return null;}}
function nameRaw(n){try{return metro.findByName&&metro.findByName(n,false);}catch(e){return null;}}
function displayRaw(n){try{return metro.findByDisplayName&&metro.findByDisplayName(n,false);}catch(e){return null;}}

function transformCore(js){
  js=String(js||'');
  js=js.replace("var V=globalThis.vendetta||globalThis.revenge||globalThis.bunny||{};","var V=(typeof vendetta!=='undefined'&&vendetta)||globalThis.vendetta||globalThis.revenge||globalThis.bunny||{};");
  js=js.replace("var storage=V.storage||{};","var storage=(V.plugin&&V.plugin.storage)||{};");
  js=js.replace("var findByName=metro.findByName||function(){return null;};","var findByName=metro.findByName||function(){return null;};\nvar findByDisplayName=metro.findByDisplayName||function(){return null;};\nvar findByStoreName=metro.findByStoreName||function(){return null;};");
  js=js.replace(/function stores\(\)\{[\s\S]*?\n\}\nfunction guildById/,"function stores(){\n  return{\n    guild:findByStoreName('GuildStore'),\n    sortedGuild:findByStoreName('SortedGuildStore'),\n    channel:findByStoreName('ChannelStore'),\n    privateSort:findByStoreName('PrivateChannelSortStore'),\n    message:findByStoreName('MessageStore')\n  };\n}\nfunction guildById");
  js=js.replace("after(s.privateSort,'getSortedPrivateChannels',function(ret){return unlocked?ret:filterIds(ret,state.hiddenChannelIds);});","after(s.privateSort,'getSortedChannels',function(ret){if(unlocked||!Array.isArray(ret))return ret;return ret.map(function(group){return Array.isArray(group)?group.filter(function(x){var id=x&&(x.channelId||x.id);return id==null||state.hiddenChannelIds.indexOf(String(id))===-1;}):group;});});");
  js=js.replace(/findByName\('MessagesConnected',false\)/g,"findByDisplayName('MessagesConnected',false)");
  js=js.replace(/findByName\('MessagesWrapperConnected',false\)/g,"findByDisplayName('MessagesWrapperConnected',false)");
  js=js.replace("return{onLoad:start,onUnload:stop,start:start,stop:stop,settings:SettingsComponent,SettingsComponent:SettingsComponent};","V.__privateChatsRuntime={isUnlocked:function(){return unlocked;},isProtected:isProtected,isProtectedChannel:isProtectedChannel,isProtectedGuild:isProtectedGuild,toggleProtection:toggleProtection,lock:lock,unlock:unlock,refresh:refresh,state:state};\nreturn{onLoad:start,onUnload:stop,start:start,stop:stop,settings:SettingsComponent,SettingsComponent:SettingsComponent};");
  return js;
}

function makeScope(){
  var s=Object.assign({},V);
  s.plugin=V.plugin;
  s.storage=pstore;
  s.metro=Object.assign({},metro);
  var originalFind=metro.findByProps&&metro.findByProps.bind(metro);
  s.metro.findByProps=function(){
    var a=Array.prototype.slice.call(arguments);
    try{
      if(a.indexOf('getGuilds')>=0&&a.indexOf('getGuild')>=0)return store('GuildStore')||originalFind.apply(null,a);
      if(a.indexOf('getFastListGuildFolders')>=0)return store('SortedGuildStore')||originalFind.apply(null,a);
      if(a.indexOf('getChannel')>=0&&(a.indexOf('getDMFromUserId')>=0||a.length===1))return store('ChannelStore')||originalFind.apply(null,a);
      if(a.indexOf('getPrivateChannelIds')>=0)return store('PrivateChannelSortStore')||originalFind.apply(null,a);
      if(a.indexOf('getMessage')>=0&&a.indexOf('getMessages')>=0)return store('MessageStore')||originalFind.apply(null,a);
    }catch(e){}
    return originalFind?originalFind.apply(null,a):null;
  };
  return s;
}

async function fetchCoreSource(){
  var url=String((V.plugin&&V.plugin.id)||'')+'index.js';
  try{
    var f=(utils&&utils.safeFetch)||globalThis.fetch;
    if(!f)throw new Error('No fetch API');
    var r=await f(url,{cache:'no-store'});
    if(!r||!r.ok)throw new Error('HTTP '+(r&&r.status));
    var txt=await r.text();
    if(txt.indexOf('Private Chats')<0&&txt.indexOf('passHash')<0)throw new Error('Unexpected core file');
    try{pstore._privateChatsCoreV91=txt;}catch(e){}
    return txt;
  }catch(e){
    var cached=pstore._privateChatsCoreV91;
    if(typeof cached==='string'&&cached.length>1000)return cached;
    throw e;
  }
}

function state(){return runtime&&runtime.state||pstore.privateChats||{};}
function isUnlocked(){return !!(runtime&&runtime.isUnlocked&&runtime.isUnlocked());}
function protectedDm(id){return !!(runtime&&runtime.isProtected&&runtime.isProtected('dm',String(id)));}
function protectedServer(id){return !!(runtime&&runtime.isProtected&&runtime.isProtected('server',String(id)));}
function refresh(){try{runtime&&runtime.refresh&&runtime.refresh();}catch(e){}}
function toggle(kind,id){try{return runtime&&runtime.toggleProtection&&runtime.toggleProtection(kind,String(id));}catch(e){log(e);return false;}}

function patchExactDmLists(){
  var ps=store('PrivateChannelSortStore');
  if(!ps)return;
  after('getSortedChannels',ps,function(args,ret){
    if(isUnlocked()||!Array.isArray(ret))return ret;
    var hidden=(state().hiddenChannelIds||[]).map(String);
    return ret.map(function(group){return Array.isArray(group)?group.filter(function(x){var id=x&&(x.channelId||x.id);return id==null||hidden.indexOf(String(id))<0;}):group;});
  });
  var prs=store('PrivateChannelReadStateStore');
  if(prs)after('getUnreadPrivateChannelIds',prs,function(args,ret){if(isUnlocked()||!Array.isArray(ret))return ret;var hidden=(state().hiddenChannelIds||[]).map(String);return ret.filter(function(id){return hidden.indexOf(String(id))<0;});});
}

function recipients(ch){
  var a=[];if(!ch)return a;
  try{if(Array.isArray(ch.recipients))a=a.concat(ch.recipients);}catch(e){}
  try{var r=ch.getRecipientId&&ch.getRecipientId();if(r)a.push(r);}catch(e){}
  return a.map(String);
}
function hiddenDmForRecipients(ids){
  ids=(Array.isArray(ids)?ids:[ids]).filter(Boolean).map(String);
  var st=state(),hidden=(st.hiddenChannelIds||[]).map(String),cs=store('ChannelStore');
  if(!cs)return null;
  for(var i=0;i<hidden.length;i++){
    var ch=null;try{ch=cs.getChannel(hidden[i]);}catch(e){}
    var rr=recipients(ch);
    for(var j=0;j<rr.length;j++)if(ids.indexOf(rr[j])>=0)return hidden[i];
  }
  return null;
}
function patchDirectDmOpen(){
  var actions=props('openPrivateChannel','closePrivateChannel')||props('openPrivateChannel');
  if(!actions)return;
  instead('openPrivateChannel',actions,function(args,orig){
    if(!isUnlocked()){
      var o=args&&args[0]||{},id=hiddenDmForRecipients(o.recipientIds||o.recipientId||[]);
      if(id){toast('Private DM is locked');return Promise.resolve(null);}
    }
    return orig.apply(null,args);
  });
}

function rowModule(){var m=props('ActionSheetRow')||{};return m.ActionSheetRow||null;}
function findGroupArray(root,Row){
  var seen=[];
  function walk(x,d){
    if(x==null||d>18)return null;
    if(Array.isArray(x)){
      for(var i=0;i<x.length;i++)if(x[i]&&x[i].type===Row.Group)return x;
      for(var j=0;j<x.length;j++){var r=walk(x[j],d+1);if(r)return r;}
      return null;
    }
    if(typeof x!=='object'||seen.indexOf(x)>=0)return null;seen.push(x);
    try{return walk(x.props&&x.props.children,d+1);}catch(e){return null;}
  }
  return walk(root,0);
}
function injectDm(rendered,id,key,Sheet){
  var Row=rowModule();if(!Row||!React)return false;
  var groups=findGroupArray(rendered,Row);if(!groups)return false;
  var marker='privatechats-v92-dm-'+id;
  for(var i=0;i<groups.length;i++)if(groups[i]&&String(groups[i].key)===marker)return true;
  var already=protectedDm(id);
  var row=React.createElement(Row,{label:(already&&isUnlocked()?'Unprotect':'Protect')+' DM',onPress:function(){
    if(already&&!isUnlocked()){toast('Unlock PrivateChats before removing protection');return;}
    if(toggle('dm',id)){try{Sheet.hideActionSheet&&Sheet.hideActionSheet(key);}catch(e){}}
  }});
  groups.splice(Math.min(1,groups.length),0,React.createElement(Row.Group,{key:marker,hasIcons:false,children:[row]}));
  return true;
}
function patchDmLongPress(){
  var Sheet=props('openLazy','hideActionSheet');if(!Sheet)return;
  before('openLazy',Sheet,function(args){
    var key=String(args&&args[1]||'');if(key.indexOf('ChannelLongPress-')!==0)return;
    var id=key.slice('ChannelLongPress-'.length),promise=args&&args[0];
    if(!promise||typeof promise.then!=='function')return;
    promise.then(function(mod){
      if(!mod||typeof mod.default!=='function')return;
      var unDefault=null;
      try{unDefault=patcher.after('default',mod,function(a,outer){
        try{
          var el=outer&&typeof outer.type==='function'?outer:null;
          if(!el&&utils.findInReactTree)el=utils.findInReactTree(outer,function(n){return n&&typeof n.type==='function';});
          if(el&&typeof el.type==='function'){
            var unType=null;
            unType=patcher.after('type',el,function(ia,rendered){try{injectDm(rendered,id,key,Sheet);}finally{try{unType&&unType();}catch(e){}}},true);
          }else injectDm(outer,id,key,Sheet);
        }catch(e){log('DM menu render patch failed',e);}
        finally{try{unDefault&&unDefault();}catch(e){}}
      },true);ownUnpatches.push(unDefault);}catch(e){log('DM menu patch failed',e);}
    }).catch(function(){});
  });
}

function patchServerHoldMenu(){
  function install(){
    var mod=nameRaw('getGuildsBarGuildMenuItems');
    if(!mod||typeof mod.default!=='function')return false;
    after('default',mod,function(args,ret){
      if(!Array.isArray(ret))return ret;
      var id=args&&args[0];if(id==null)return ret;id=String(id);
      for(var z=0;z<ret.length;z++)if(ret[z]&&ret[z].__privateChatsV92)return ret;
      var first=ret[0]||{},item={__privateChatsV92:true,label:(protectedServer(id)&&isUnlocked()?'Unprotect':'Protect')+' Server',action:function(){
        if(protectedServer(id)&&!isUnlocked()){toast('Unlock PrivateChats before removing protection');return;}
        toggle('server',id);
      }};
      if(first.IconComponent)item.IconComponent=first.IconComponent;
      else if(first.iconSource)item.iconSource=first.iconSource;
      var copy=ret.slice();copy.unshift(item);return copy;
    });
    return true;
  }
  if(install())return;
  var count=0,t=setInterval(function(){count++;if(install()||count>=30)clearInterval(t);},1000);timers.push(t);
}

function patchMessageFallback(){
  var mod=displayRaw('MessagesConnected');if(!mod||typeof mod.default!=='function'||!React||!RN)return;
  after('default',mod,function(args,ret){
    if(isUnlocked())return ret;
    var p=args&&args[0]||{},cid=p.channelId||(p.channel&&p.channel.id)||(ret&&ret.props&&ret.props.channelId),gid=p.guildId||(p.channel&&(p.channel.guild_id||p.channel.guildId))||(ret&&ret.props&&ret.props.guildId);
    if(!((cid&&runtime&&runtime.isProtectedChannel&&runtime.isProtectedChannel(cid))||(gid&&protectedServer(gid))))return ret;
    var View=RN.View,Text=RN.Text;
    return React.createElement(View,{style:{flex:1,alignItems:'center',justifyContent:'center',padding:24}},React.createElement(Text,{style:{color:'white',fontSize:22,fontWeight:'800'}},'Private chat locked'),React.createElement(Text,{style:{color:'#aaa',marginTop:8,textAlign:'center'}},'Unlock PrivateChats to view this conversation.'));
  });
}

function installFixes(){
  patchExactDmLists();
  patchDirectDmOpen();
  patchDmLongPress();
  patchServerHoldMenu();
  patchMessageFallback();
  refresh();
}

async function load(){
  try{
    var source=transformCore(await fetchCoreSource());
    scope=makeScope();
    var old=globalThis.vendetta;
    try{
      globalThis.vendetta=scope;
      var raw=(0,eval)('vendetta=>{return '+source+'\n}')(scope);
      core=typeof raw==='function'?raw():raw;
      core=core&&core.default||core||{};
    }finally{globalThis.vendetta=old;}
    runtime=scope.__privateChatsRuntime||null;
    if(core&&typeof core.onLoad==='function')core.onLoad();
    runtime=scope.__privateChatsRuntime||runtime;
    installFixes();
    toast('PrivateChats v9.2 loaded');
  }catch(e){
    loadError=e;log('PrivateChats v9.2 load failed',e);toast('PrivateChats v9.2 failed to load core');
  }
}

function Settings(){
  if(!React||!RN)return null;
  var View=RN.View,Text=RN.Text;
  var s=React.useState(0),tick=s[0],setTick=s[1];
  React.useEffect(function(){
    if(core&&core.settings)return;
    var n=0,t=setInterval(function(){n++;setTick(function(x){return x+1;});if((core&&core.settings)||loadError||n>=20)clearInterval(t);},250);
    return function(){clearInterval(t);};
  },[]);
  if(core&&core.settings)return React.createElement(core.settings,{});
  return React.createElement(View,{style:{padding:18}},React.createElement(Text,{style:{color:'white',fontSize:20,fontWeight:'700'}},'PrivateChats v9.2'),React.createElement(Text,{style:{color:'#aaa',marginTop:10}},loadError?'Core failed to load. Refetch the plugin and reopen Configure.':'Loading security module…'));
}

function onLoad(){load();}
function onUnload(){
  while(timers.length){try{clearInterval(timers.pop());}catch(e){}}
  while(ownUnpatches.length){try{var u=ownUnpatches.pop();u&&u();}catch(e){}}
  try{core&&core.onUnload&&core.onUnload();}catch(e){}
  core=null;runtime=null;scope=null;
}

return{onLoad:onLoad,onUnload:onUnload,settings:Settings};
})()