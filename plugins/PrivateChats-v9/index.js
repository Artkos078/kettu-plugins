(function(){
'use strict';

var V=globalThis.vendetta||globalThis.revenge||globalThis.bunny||{};
var metro=V.metro||{};
var patcher=V.patcher||{};
var ui=V.ui||{};
var storage=V.storage||{};
var common=metro.common||{};
var findByProps=metro.findByProps||function(){return null;};
var findByName=metro.findByName||function(){return null;};
var React=common.React||findByProps('createElement','useState');
var RN=common.ReactNative||findByProps('View','Text','TextInput','Pressable');
var unpatches=[];
var appStateSub=null;
var unlocked=false;
var failedAttempts=0;
var lockoutUntil=0;
var diag={dmMenu:false,serverMenu:false,dmHide:false,serverHide:false,routeLock:false,messageLock:false};

var state=Object.assign({
  passHash:null,
  passSalt:null,
  passcode:null,
  hiddenGuildIds:[],
  hiddenChannelIds:[],
  hideMedia:true,
  autoLockBackground:true
},storage.privateChats||{});

function toast(t){
  try{if(ui.toasts&&ui.toasts.showToast)ui.toasts.showToast(t);else if(ui.showToast)ui.showToast(t);}
  catch(e){try{console.log('[PrivateChats]',t);}catch(_){}}
}

function utf8(s){
  try{return unescape(encodeURIComponent(String(s)));}
  catch(e){return String(s);}
}
function sha256(ascii){
  ascii=utf8(ascii);
  function rightRotate(value,amount){return(value>>>amount)|(value<<(32-amount));}
  var mathPow=Math.pow,maxWord=mathPow(2,32),lengthProperty='length',i,j;
  var result='',words=[],asciiBitLength=ascii[lengthProperty]*8;
  var hash=sha256.h=sha256.h||[],k=sha256.k=sha256.k||[],primeCounter=k[lengthProperty];
  var isComposite={};
  for(var candidate=2;primeCounter<64;candidate++){
    if(!isComposite[candidate]){
      for(i=0;i<313;i+=candidate)isComposite[i]=candidate;
      hash[primeCounter]=(mathPow(candidate,.5)*maxWord)|0;
      k[primeCounter++]=(mathPow(candidate,1/3)*maxWord)|0;
    }
  }
  ascii+='\x80';
  while(ascii[lengthProperty]%64-56)ascii+='\x00';
  for(i=0;i<ascii[lengthProperty];i++){
    j=ascii.charCodeAt(i);
    if(j>>8)return'';
    words[i>>2]|=j<<((3-i)%4)*8;
  }
  words[words[lengthProperty]]=(asciiBitLength/maxWord)|0;
  words[words[lengthProperty]]=asciiBitLength;
  for(j=0;j<words[lengthProperty];){
    var w=words.slice(j,j+=16),oldHash=hash.slice(0),a=hash[0],b=hash[1],c=hash[2],d=hash[3],e=hash[4],f=hash[5],g=hash[6],h=hash[7];
    for(i=0;i<64;i++){
      var w15=w[i-15],w2=w[i-2];
      var s0=i<16?0:(rightRotate(w15,7)^rightRotate(w15,18)^(w15>>>3));
      var s1=i<16?0:(rightRotate(w2,17)^rightRotate(w2,19)^(w2>>>10));
      var wi=i<16?w[i]:(w[i-16]+s0+w[i-7]+s1)|0;
      w[i]=wi;
      var S1=rightRotate(e,6)^rightRotate(e,11)^rightRotate(e,25);
      var ch=(e&f)^((~e)&g);
      var temp1=(h+S1+ch+k[i]+wi)|0;
      var S0=rightRotate(a,2)^rightRotate(a,13)^rightRotate(a,22);
      var maj=(a&b)^(a&c)^(b&c);
      var temp2=(S0+maj)|0;
      h=g;g=f;f=e;e=(d+temp1)|0;d=c;c=b;b=a;a=(temp1+temp2)|0;
    }
    hash=[(oldHash[0]+a)|0,(oldHash[1]+b)|0,(oldHash[2]+c)|0,(oldHash[3]+d)|0,(oldHash[4]+e)|0,(oldHash[5]+f)|0,(oldHash[6]+g)|0,(oldHash[7]+h)|0];
  }
  for(i=0;i<8;i++)for(j=3;j+1;j--){var bv=(hash[i]>>(j*8))&255;result+=(bv<16?'0':'')+bv.toString(16);}
  return result;
}
function randomSalt(){
  var out='';
  try{
    if(globalThis.crypto&&globalThis.crypto.getRandomValues){
      var a=new Uint8Array(16);globalThis.crypto.getRandomValues(a);
      for(var i=0;i<a.length;i++)out+=('0'+a[i].toString(16)).slice(-2);
      return out;
    }
  }catch(e){}
  for(var j=0;j<32;j++)out+=Math.floor(Math.random()*16).toString(16);
  return out+Date.now().toString(16);
}
function derive(pass,salt){
  var x=sha256(String(salt)+'\u0000'+String(pass));
  for(var i=0;i<10000;i++)x=sha256(x+String(salt));
  return x;
}
function migratePasscode(){
  if(!state.passHash){
    var legacy=String(state.passcode||'2580');
    state.passSalt=randomSalt();
    state.passHash=derive(legacy,state.passSalt);
    state.passcode=null;
  }
}
function save(){
  state.hiddenGuildIds=Array.from(new Set((state.hiddenGuildIds||[]).map(String)));
  state.hiddenChannelIds=Array.from(new Set((state.hiddenChannelIds||[]).map(String)));
  migratePasscode();
  try{
    storage.privateChats={
      passHash:String(state.passHash||''),
      passSalt:String(state.passSalt||''),
      hiddenGuildIds:state.hiddenGuildIds,
      hiddenChannelIds:state.hiddenChannelIds,
      hideMedia:!!state.hideMedia,
      autoLockBackground:state.autoLockBackground!==false
    };
  }catch(e){}
}
function verifyPass(pass){
  var now=Date.now();
  if(now<lockoutUntil){toast('Too many attempts. Try again later.');return false;}
  migratePasscode();
  var ok=derive(String(pass||''),String(state.passSalt||''))===String(state.passHash||'');
  if(ok){failedAttempts=0;lockoutUntil=0;return true;}
  failedAttempts++;
  if(failedAttempts>=5){failedAttempts=0;lockoutUntil=Date.now()+60000;toast('Locked for 60 seconds after repeated wrong passcodes.');}
  return false;
}
function setPass(currentPass,newPass){
  if(!verifyPass(currentPass))return false;
  var p=String(newPass||'');
  if(p.length<6){toast('Use at least 6 characters for the new passcode.');return false;}
  state.passSalt=randomSalt();
  state.passHash=derive(p,state.passSalt);
  state.passcode=null;
  save();
  unlocked=false;
  refresh();
  return true;
}
function lock(silent){unlocked=false;refresh();if(!silent)toast('Private chats locked');}
function unlock(pass){
  if(!verifyPass(pass)){toast('Wrong passcode');return false;}
  unlocked=true;refresh();toast('Private chats unlocked');return true;
}

function stores(){
  return{
    guild:findByProps('getGuilds','getGuild')||findByProps('getGuild','getGuildCount'),
    sortedGuild:findByProps('getFastListGuildFolders','getGuildsTree'),
    channel:findByProps('getChannel','getDMFromUserId')||findByProps('getChannel','getMutableGuildChannelsForGuild'),
    privateSort:findByProps('getPrivateChannelIds')||findByProps('getSortedPrivateChannels'),
    message:findByProps('getMessage','getMessages')||findByProps('getMessages','getMessage')
  };
}
function guildById(id){var s=stores();try{return id&&s.guild&&s.guild.getGuild&&s.guild.getGuild(String(id));}catch(e){return null;}}
function channelById(id){var s=stores();try{return id&&s.channel&&s.channel.getChannel&&s.channel.getChannel(String(id));}catch(e){return null;}}
function channelGuildId(id){var ch=channelById(id);return ch?String(ch.guild_id||ch.guildId||''):'';}
function isProtectedChannel(id){
  id=String(id||'');if(!id)return false;
  if(state.hiddenChannelIds.indexOf(id)!==-1)return true;
  var gid=channelGuildId(id);return !!gid&&state.hiddenGuildIds.indexOf(gid)!==-1;
}
function isProtectedGuild(id){return state.hiddenGuildIds.indexOf(String(id||''))!==-1;}
function isProtected(kind,id){return kind==='server'?isProtectedGuild(id):state.hiddenChannelIds.indexOf(String(id||''))!==-1;}

function addUnpatch(u){if(typeof u==='function')unpatches.push(u);return u;}
function after(obj,name,fn,oneTime){
  if(!obj||typeof obj[name]!=='function'||!patcher.after)return null;
  try{return addUnpatch(patcher.after(name,obj,function(args,ret){return fn(ret,args);},oneTime));}catch(e){return null;}
}
function before(obj,name,fn,oneTime){
  if(!obj||typeof obj[name]!=='function'||!patcher.before)return null;
  try{return addUnpatch(patcher.before(name,obj,fn,oneTime));}catch(e){return null;}
}
function instead(obj,name,fn){
  if(!obj||typeof obj[name]!=='function'||!patcher.instead)return null;
  try{return addUnpatch(patcher.instead(name,obj,fn));}catch(e){return null;}
}
function refresh(){
  var s=stores();[s.guild,s.sortedGuild,s.privateSort,s.channel].forEach(function(x){try{x&&x.emitChange&&x.emitChange();}catch(e){}});
}

function filterIds(v,ids){
  if(!Array.isArray(v))return v;
  return v.filter(function(x){var id=typeof x==='string'?x:(x&&(x.id||x.channelId||x.guildId));return id==null||ids.indexOf(String(id))===-1;});
}
function filterGuildNodes(nodes){
  if(unlocked||!Array.isArray(nodes))return nodes;
  var hidden=state.hiddenGuildIds;
  var out=[];
  for(var i=0;i<nodes.length;i++){
    var node=nodes[i];if(!node||typeof node!=='object'){out.push(node);continue;}
    if(node.id!=null&&hidden.indexOf(String(node.id))!==-1)continue;
    if(Array.isArray(node.children)){
      var kids=[];
      for(var j=0;j<node.children.length;j++){
        var kid=node.children[j];
        if(kid&&kid.id!=null&&hidden.indexOf(String(kid.id))!==-1)continue;
        kids.push(kid);
      }
      if(node.children.length&&kids.length===0)continue;
      var clone=Object.assign({},node,{children:kids});out.push(clone);
    }else out.push(node);
  }
  return out;
}
function sanitizeMessage(m){
  if(!m||unlocked)return m;
  var cid=m.channel_id||m.channelId;
  if(!isProtectedChannel(cid))return m;
  return Object.assign({},m,{content:'',attachments:[],embeds:[],stickers:[],stickerItems:[],components:[]});
}
function patchDataSources(){
  var s=stores();
  if(s.privateSort&&typeof s.privateSort.getPrivateChannelIds==='function')diag.dmHide=true;
  if(s.sortedGuild&&typeof s.sortedGuild.getFastListGuildFolders==='function')diag.serverHide=true;
  after(s.privateSort,'getPrivateChannelIds',function(ret){return unlocked?ret:filterIds(ret,state.hiddenChannelIds);});
  after(s.privateSort,'getSortedPrivateChannels',function(ret){return unlocked?ret:filterIds(ret,state.hiddenChannelIds);});
  after(s.sortedGuild,'getFastListGuildFolders',function(ret){return filterGuildNodes(ret);});
  after(s.guild,'getGuilds',function(ret){
    if(unlocked||!ret||typeof ret!=='object')return ret;
    var copy={};Object.keys(ret).forEach(function(k){if(!isProtectedGuild(k))copy[k]=ret[k];});return copy;
  });
  after(s.message,'getMessage',function(ret){return sanitizeMessage(ret);});

  var PrivateChannels=findByName('ConnectedPrivateChannels',false);
  if(PrivateChannels&&PrivateChannels.default){
    after(PrivateChannels,'default',function(ret){
      if(!ret||!ret.type)return ret;
      try{
        var local=patcher.before('type',ret,function(args){
          try{var p=args&&args[0];if(!unlocked&&p&&Array.isArray(p.privateChannelIds))p.privateChannelIds=filterIds(p.privateChannelIds,state.hiddenChannelIds);}catch(e){}
        },true);
        if(typeof local==='function')unpatches.push(local);
      }catch(e){}
      return ret;
    });
  }
}

function parseRoute(path){
  var s=String(path||'');
  var m=s.match(/\/channels\/([^\/?#]+)\/([^\/?#]+)/);
  if(!m)return null;
  if(m[1]==='@me')return{kind:'dm',channelId:m[2]};
  return{kind:'server',guildId:m[1],channelId:m[2]};
}
function routeBlocked(path){
  if(unlocked)return false;
  var r=parseRoute(path);if(!r)return false;
  if(r.kind==='dm')return state.hiddenChannelIds.indexOf(String(r.channelId))!==-1;
  return isProtectedGuild(r.guildId)||isProtectedChannel(r.channelId);
}
function patchNavigation(){
  var router=findByProps('transitionTo','transitionToGuild')||findByProps('transitionTo');
  if(router&&(router.transitionTo||router.transitionToGuild))diag.routeLock=true;
  if(router&&router.transitionTo){
    instead(router,'transitionTo',function(args,orig){
      if(routeBlocked(args&&args[0])){toast('Private chat is locked');return;}
      return orig.apply(null,args);
    });
  }
  if(router&&router.transitionToGuild){
    instead(router,'transitionToGuild',function(args,orig){
      var gid=args&&args[0],cid=args&&args[1];
      if(!unlocked&&(isProtectedGuild(gid)||isProtectedChannel(cid))){toast('Private server is locked');return;}
      return orig.apply(null,args);
    });
  }
}

function LockedView(){
  if(!React||!RN)return null;
  var View=RN.View,Text=RN.Text,TextInput=RN.TextInput,Pressable=RN.Pressable||RN.TouchableOpacity;
  var st=React.useState(''),code=st[0],setCode=st[1];
  return React.createElement(View,{style:{flex:1,alignItems:'center',justifyContent:'center',padding:24}},
    React.createElement(Text,{style:{color:'white',fontSize:24,fontWeight:'800',marginBottom:10}},'Private chat locked'),
    React.createElement(Text,{style:{color:'#aaa',textAlign:'center',marginBottom:16}},'Enter your PrivateChats passcode to unlock protected chats.'),
    React.createElement(TextInput,{value:code,onChangeText:setCode,secureTextEntry:true,placeholder:'Passcode',style:{width:'100%',maxWidth:360,borderWidth:1,borderColor:'#555',borderRadius:10,padding:12,color:'white',marginBottom:10}}),
    React.createElement(Pressable,{onPress:function(){if(unlock(code))setCode('');},style:{width:'100%',maxWidth:360,padding:13,borderRadius:10,backgroundColor:'#5865F2'}},React.createElement(Text,{style:{color:'white',fontWeight:'700',textAlign:'center'}},'Unlock'))
  );
}
function patchMessageView(){
  var mods=[findByName('MessagesConnected',false),findByName('MessagesWrapperConnected',false)];
  if(mods.some(function(m){return !!(m&&m.default);}))diag.messageLock=true;
  mods.forEach(function(mod){
    if(!mod||!mod.default)return;
    after(mod,'default',function(ret,args){
      if(unlocked)return ret;
      var p=(args&&args[0])||{};
      var cid=p.channelId||p.channel_id||(ret&&ret.props&&(ret.props.channelId||ret.props.channel_id));
      var gid=p.guildId||p.guild_id||(ret&&ret.props&&(ret.props.guildId||ret.props.guild_id));
      if((cid&&isProtectedChannel(cid))||(gid&&isProtectedGuild(gid)))return React.createElement(LockedView,{});
      return ret;
    });
  });
}

function rowModule(){var m=findByProps('ActionSheetRow')||{};return m.ActionSheetRow||null;}
function findGroupChildren(root,Row){
  var seen=[];
  function walk(x,depth){
    if(x==null||depth>14)return null;
    if(Array.isArray(x)){
      for(var i=0;i<x.length;i++){var e=x[i];if(e&&e.type===Row.Group&&Array.isArray(e.props&&e.props.children))return x;}
      for(var j=0;j<x.length;j++){var q=walk(x[j],depth+1);if(q)return q;}return null;
    }
    if(typeof x!=='object'||seen.indexOf(x)!==-1)return null;seen.push(x);
    try{return walk(x.props&&x.props.children,depth+1);}catch(e){return null;}
  }
  return walk(root,0);
}
function makeProtectGroup(kind,id,Row,close){
  var already=isProtected(kind,id);
  var label=(already?'Unprotect ':'Protect ')+(kind==='server'?'Server':'DM');
  var action=function(){
    if(already&&!unlocked){toast('Unlock PrivateChats before removing protection');return;}
    toggleProtection(kind,id);try{close&&close();}catch(e){}
  };
  var r=React.createElement(Row,{key:'privatechats-'+kind+'-'+id,label:label,onPress:action});
  return React.createElement(Row.Group,{key:'privatechats-group-'+kind+'-'+id,hasIcons:false,children:[r]});
}
function goHome(){
  try{var r=findByProps('transitionTo','transitionToGuild')||findByProps('transitionTo');if(r&&r.transitionTo)r.transitionTo('/channels/@me');}catch(e){}
}
function toggleProtection(kind,id){
  id=String(id);var was=isProtected(kind,id);
  if(was&&!unlocked){toast('Unlock PrivateChats before removing protection');return false;}
  if(kind==='server')state.hiddenGuildIds=was?state.hiddenGuildIds.filter(function(x){return String(x)!==id;}):state.hiddenGuildIds.concat([id]);
  else state.hiddenChannelIds=was?state.hiddenChannelIds.filter(function(x){return String(x)!==id;}):state.hiddenChannelIds.concat([id]);
  save();lock(true);if(!was)goHome();
  var obj=kind==='server'?guildById(id):channelById(id);
  toast((was?'Unprotected ':'Protected ')+((obj&&obj.name)||(kind==='server'?'server':'DM')));
  return true;
}
function patchContextMenus(){
  var Row=rowModule();if(!Row||!React)return;
  var ActionSheet=findByProps('openLazy','hideActionSheet')||{};

  var dm=findByName('ChannelLongPressActionSheetConnected',false);
  if(dm&&dm.default){diag.dmMenu=true;
    after(dm,'default',function(ret,args){
      var p=args&&args[0],ch=p&&p.channel;
      if(!ch||!(ch.isDM&&ch.isDM())&&!(ch.isGroupDM&&ch.isGroupDM()))return ret;
      var groups=findGroupChildren(ret,Row);if(!groups)return ret;
      var marker='privatechats-group-dm-'+ch.id;
      for(var i=0;i<groups.length;i++)if(groups[i]&&String(groups[i].key)===marker)return ret;
      groups.push(makeProtectGroup('dm',String(ch.id),Row,function(){try{ActionSheet.hideActionSheet&&ActionSheet.hideActionSheet();}catch(e){}}));
      return ret;
    });
  }

  var guildActions=findByProps('GuildActionSheetPrimaryActions','GuildActionSheetSecondaryActions');
  if(guildActions&&guildActions.GuildActionSheetSecondaryActions){diag.serverMenu=true;
    after(guildActions,'GuildActionSheetSecondaryActions',function(ret,args){
      var p=args&&args[0],g=p&&p.guild;if(!g||!g.id)return ret;
      var group=makeProtectGroup('server',String(g.id),Row,function(){try{ActionSheet.hideActionSheet&&ActionSheet.hideActionSheet();}catch(e){}});
      if(!ret)return group;
      var kids=ret.props&&ret.props.children;
      if(Array.isArray(kids)){
        var marker='privatechats-server-'+g.id;
        for(var i=0;i<kids.length;i++)if(kids[i]&&String(kids[i].key)===marker)return ret;
        kids.push(React.createElement(React.Fragment,{key:marker,children:group.props.children}));
        return ret;
      }
      return React.createElement(Row.Group,{hasIcons:false,children:[ret,group.props.children[0]]});
    });
  }
}

function patchAppState(){
  try{
    var A=RN&&RN.AppState;
    if(A&&typeof A.addEventListener==='function'){
      appStateSub=A.addEventListener('change',function(next){
        if(state.autoLockBackground!==false&&(next==='background'||next==='inactive'))lock(true);
      });
    }
  }catch(e){}
}

function SettingsComponent(){
  if(!React||!RN)return null;
  var View=RN.View,Text=RN.Text,TextInput=RN.TextInput,Pressable=RN.Pressable||RN.TouchableOpacity,Switch=RN.Switch,ScrollView=RN.ScrollView||RN.View;
  var a=React.useState(''),code=a[0],setCode=a[1];
  var b=React.useState(''),currentPass=b[0],setCurrentPass=b[1];
  var c=React.useState(''),newPass=c[0],setNewPass=c[1];
  var d=React.useState(0),tick=d[0],setTick=d[1];
  function bump(){setTick(tick+1);}
  function btn(label,onPress,secondary){return React.createElement(Pressable,{onPress:onPress,style:{paddingVertical:13,paddingHorizontal:14,borderRadius:10,backgroundColor:secondary?'#3f4147':'#5865F2',marginVertical:5}},React.createElement(Text,{style:{color:'white',fontWeight:'700',textAlign:'center'}},label));}
  function itemName(id,type){if(type==='g'){var g=guildById(id);return(g&&g.name)||id;}var ch=channelById(id);return(ch&&ch.name)||id;}
  function row(id,type){return React.createElement(View,{key:type+id,style:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:10}},React.createElement(Text,{style:{color:'white',flex:1}},itemName(id,type)),React.createElement(Pressable,{onPress:function(){if(!unlocked){toast('Unlock first');return;}if(type==='g')state.hiddenGuildIds=state.hiddenGuildIds.filter(function(x){return String(x)!==String(id);});else state.hiddenChannelIds=state.hiddenChannelIds.filter(function(x){return String(x)!==String(id);});save();refresh();bump();}},React.createElement(Text,{style:{color:'#ff6b6b',fontWeight:'700'}},'Remove')));}
  return React.createElement(ScrollView,{style:{padding:16}},
    React.createElement(Text,{style:{fontSize:22,fontWeight:'800',color:'white'}},'Private Chats'),
    React.createElement(Text,{style:{color:unlocked?'#8ddf8d':'#aaa',marginVertical:8}},'State: '+(unlocked?'UNLOCKED':'LOCKED')),
    React.createElement(Text,{style:{color:'#aaa',marginBottom:12}},'Protected chats are hidden and navigation/content is blocked while locked. The passcode is stored as a salted hash, so it cannot be displayed after it is saved.'),
    React.createElement(Text,{style:{color:'#777',marginBottom:12,fontSize:12}},'Hooks: DM menu '+(diag.dmMenu?'OK':'missing')+' · Server menu '+(diag.serverMenu?'OK':'missing')+' · DM hide '+(diag.dmHide?'OK':'missing')+' · Server hide '+(diag.serverHide?'OK':'missing')+' · Route lock '+(diag.routeLock?'OK':'missing')+' · Message lock '+(diag.messageLock?'OK':'missing')),
    React.createElement(TextInput,{value:code,onChangeText:setCode,placeholder:'Passcode',secureTextEntry:true,style:{borderWidth:1,borderColor:'#555',borderRadius:9,padding:10,color:'white',marginVertical:5}}),
    btn('Show Private',function(){if(unlock(code)){setCode('');bump();}}),
    btn('Hide Private',function(){lock(false);bump();},true),
    React.createElement(Text,{style:{fontWeight:'700',color:'white',marginTop:18}},'Protected servers'),
    unlocked?(state.hiddenGuildIds.length?state.hiddenGuildIds.map(function(id){return row(String(id),'g');}):React.createElement(Text,{style:{color:'#888'}},'None')):React.createElement(Text,{style:{color:'#888'}},state.hiddenGuildIds.length+' protected'),
    React.createElement(Text,{style:{fontWeight:'700',color:'white',marginTop:18}},'Protected DMs'),
    unlocked?(state.hiddenChannelIds.length?state.hiddenChannelIds.map(function(id){return row(String(id),'c');}):React.createElement(Text,{style:{color:'#888'}},'None')):React.createElement(Text,{style:{color:'#888'}},state.hiddenChannelIds.length+' protected'),
    React.createElement(Text,{style:{fontWeight:'700',color:'white',marginTop:18}},'Change passcode'),
    React.createElement(TextInput,{value:currentPass,onChangeText:setCurrentPass,placeholder:'Current passcode',secureTextEntry:true,style:{borderWidth:1,borderColor:'#555',borderRadius:9,padding:10,color:'white',marginVertical:5}}),
    React.createElement(TextInput,{value:newPass,onChangeText:setNewPass,placeholder:'New passcode (6+ characters)',secureTextEntry:true,style:{borderWidth:1,borderColor:'#555',borderRadius:9,padding:10,color:'white',marginVertical:5}}),
    btn('Change Passcode',function(){if(setPass(currentPass,newPass)){setCurrentPass('');setNewPass('');toast('Passcode changed and PrivateChats locked');bump();}}),
    React.createElement(View,{style:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:18}},React.createElement(Text,{style:{color:'white',flex:1}},'Hide media/content while locked'),React.createElement(Switch,{value:!!state.hideMedia,onValueChange:function(v){state.hideMedia=!!v;save();bump();}})),
    React.createElement(View,{style:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:18}},React.createElement(Text,{style:{color:'white',flex:1}},'Auto-lock when app backgrounds'),React.createElement(Switch,{value:state.autoLockBackground!==false,onValueChange:function(v){state.autoLockBackground=!!v;save();bump();}}))
  );
}

function start(){
  migratePasscode();save();unlocked=false;
  patchDataSources();patchNavigation();patchMessageView();patchContextMenus();patchAppState();
  toast('PrivateChats v9 security loaded');
}
function stop(){
  unlocked=false;
  try{if(appStateSub&&typeof appStateSub.remove==='function')appStateSub.remove();else if(typeof appStateSub==='function')appStateSub();}catch(e){}
  appStateSub=null;
  while(unpatches.length){try{unpatches.pop()();}catch(e){}}
}

return{onLoad:start,onUnload:stop,start:start,stop:stop,settings:SettingsComponent,SettingsComponent:SettingsComponent};
})()