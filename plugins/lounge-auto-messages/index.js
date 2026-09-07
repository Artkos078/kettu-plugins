(function(){
'use strict';

var V=(typeof vendetta!=='undefined'&&vendetta)||globalThis.vendetta||{};
var metro=V.metro||{};
var common=metro.common||{};
var RN=common.ReactNative||{};
var findByProps=metro.findByProps||function(){return null;};
var findByStoreName=metro.findByStoreName||function(){return null;};
var appStateSub=null;
var wasLoungeWhenBackgrounded=false;
var lastState='active';

function router(){return findByProps('transitionTo','transitionToGuild')||findByProps('transitionTo')||null;}
function rootNavModule(){return findByProps('getRootNavigationRef')||null;}
function rootNav(){try{var m=rootNavModule();return m&&m.getRootNavigationRef&&m.getRootNavigationRef();}catch(e){return null;}}
function guildStore(){return findByStoreName('GuildStore')||findByProps('getGuilds','getGuild')||findByProps('getGuild');}
function selectedGuildStore(){return findByStoreName('SelectedGuildStore')||findByProps('getGuildId');}

function goMessages(){
  try{var r=router();if(r&&r.transitionTo){r.transitionTo('/channels/@me');return true;}}catch(e){}
  try{var n=rootNav();if(n&&n.navigate){n.navigate('Messages');return true;}}catch(e){}
  return false;
}

function currentGuildId(){
  try{
    var s=selectedGuildStore();
    if(s&&typeof s.getGuildId==='function'){
      var gid=s.getGuildId();
      if(gid)return String(gid);
    }
  }catch(e){}
  return null;
}

function isTheLounge(){
  try{
    var gid=currentGuildId();
    if(!gid)return false;
    var gs=guildStore();
    var g=gs&&gs.getGuild&&gs.getGuild(gid);
    return !!g&&String(g.name||'').trim().toLowerCase()==='the lounge';
  }catch(e){return false;}
}

function handleAppState(next){
  next=String(next||'');

  // Only treat a real background state as backgrounding. iOS can emit
  // "inactive" for transient system UI, which previously caused false redirects.
  if(next==='background'&&lastState!=='background'){
    wasLoungeWhenBackgrounded=isTheLounge();
  }

  // Redirect after the app is active again. This is more reliable on iOS than
  // trying to navigate while the JS runtime is being suspended.
  if(next==='active'&&lastState==='background'&&wasLoungeWhenBackgrounded){
    wasLoungeWhenBackgrounded=false;
    setTimeout(goMessages,50);
  }

  if(next==='active'&&lastState!=='background'){
    wasLoungeWhenBackgrounded=false;
  }

  lastState=next||lastState;
}

function onLoad(){
  try{
    var AppState=RN&&RN.AppState;
    if(!AppState||typeof AppState.addEventListener!=='function')return;
    lastState=String(AppState.currentState||'active');
    appStateSub=AppState.addEventListener('change',handleAppState);
  }catch(e){}
}

function onUnload(){
  try{if(appStateSub&&typeof appStateSub.remove==='function')appStateSub.remove();}catch(e){}
  appStateSub=null;
  wasLoungeWhenBackgrounded=false;
}

return{onLoad:onLoad,onUnload:onUnload};
})()