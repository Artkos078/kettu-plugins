(function(){
'use strict';

var V=(typeof vendetta!=='undefined'&&vendetta)||globalThis.vendetta||{};
var metro=V.metro||{};
var common=metro.common||{};
var RN=common.ReactNative;
var findByProps=metro.findByProps||function(){return null;};
var appStateSub=null;
var forceMessagesOnResume=false;
var lastState='active';

function router(){return findByProps('transitionTo','transitionToGuild')||findByProps('transitionTo')||null;}
function rootNavModule(){return findByProps('getRootNavigationRef')||null;}
function rootNav(){try{var m=rootNavModule();return m&&m.getRootNavigationRef&&m.getRootNavigationRef();}catch(e){return null;}}
function guildStore(){return findByProps('getGuilds','getGuild')||findByProps('getGuild');}
function channelStore(){return findByProps('getChannel','getDMFromUserId')||findByProps('getChannel');}
function selectedChannelStore(){return findByProps('getChannelId')||findByProps('getLastSelectedChannelId');}

function goMessages(){
  try{var r=router();if(r&&r.transitionTo){r.transitionTo('/channels/@me');return true;}}catch(e){}
  try{var n=rootNav();if(n&&n.navigate){n.navigate('Messages');return true;}}catch(e){}
  return false;
}

function guildIdFromRouteState(node){
  if(!node||typeof node!=='object')return null;
  try{
    var p=node.params||{};
    var gid=p.guildId||p.guild_id||p.serverId||p.server_id;
    if(gid)return String(gid);
  }catch(e){}
  try{
    if(Array.isArray(node.routes)){
      var idx=typeof node.index==='number'?node.index:node.routes.length-1;
      var active=node.routes[idx];
      var hit=guildIdFromRouteState(active);if(hit)return hit;
      for(var i=node.routes.length-1;i>=0;i--){hit=guildIdFromRouteState(node.routes[i]);if(hit)return hit;}
    }
  }catch(e){}
  try{if(node.state){var nested=guildIdFromRouteState(node.state);if(nested)return nested;}}catch(e){}
  return null;
}

function currentGuildId(){
  try{
    var n=rootNav();
    if(n&&n.getRootState){var gid=guildIdFromRouteState(n.getRootState());if(gid)return gid;}
  }catch(e){}
  try{
    var s=selectedChannelStore();
    var cid=null;
    if(s&&s.getChannelId)cid=s.getChannelId();
    else if(s&&s.getLastSelectedChannelId)cid=s.getLastSelectedChannelId();
    if(cid){
      var cs=channelStore(),ch=cs&&cs.getChannel&&cs.getChannel(String(cid));
      var gid2=ch&&(ch.guild_id||ch.guildId);
      if(gid2)return String(gid2);
    }
  }catch(e){}
  return null;
}

function isTheLounge(){
  try{
    var gid=currentGuildId();if(!gid)return false;
    var gs=guildStore(),g=gs&&gs.getGuild&&gs.getGuild(gid);
    return !!g&&String(g.name||'').trim().toLowerCase()==='the lounge';
  }catch(e){return false;}
}

function handleAppState(next){
  next=String(next||'');
  if((next==='inactive'||next==='background')&&lastState==='active'){
    if(isTheLounge()){
      forceMessagesOnResume=true;
      goMessages();
    }
  }
  if(next==='active'&&forceMessagesOnResume){
    forceMessagesOnResume=false;
    goMessages();
  }
  lastState=next||lastState;
}

function onLoad(){
  try{
    var AppState=RN&&RN.AppState;
    if(!AppState||!AppState.addEventListener)return;
    lastState=String(AppState.currentState||'active');
    appStateSub=AppState.addEventListener('change',handleAppState);
  }catch(e){}
}

function onUnload(){
  try{if(appStateSub&&appStateSub.remove)appStateSub.remove();}catch(e){}
  appStateSub=null;
  forceMessagesOnResume=false;
}

return{onLoad:onLoad,onUnload:onUnload};
})()