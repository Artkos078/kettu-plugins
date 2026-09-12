(function(){
'use strict';

var V=(typeof vendetta!=='undefined'&&vendetta)||globalThis.vendetta||globalThis.revenge||globalThis.bunny||{};
var RevengeNext=globalThis.revenge||null;
var metro=V.metro||{};
var patcher=V.patcher||{};
var common=metro.common||{};
var React=common.React;
var RN=common.ReactNative;
var storage=(V.plugin&&V.plugin.storage)||{};
var findByName=metro.findByName||function(){return null;};
var findByProps=metro.findByProps||function(){return null;};
var toastApi=(V.ui&&V.ui.toasts)||{};
var unpatches=[];
var timers=[];
var idsByTime={};
var idTimeOrder=[];
var status={row:false,component:false,copy:false};
var DISCORD_EPOCH=1420070400000;

if(storage.mode==null)storage.mode='exact';
if(storage.zone==null)storage.zone='local';
if(storage.clock24==null)storage.clock24=true;
if(storage.seconds==null)storage.seconds=true;
if(storage.milliseconds==null)storage.milliseconds=true;
if(storage.separateMessages==null)storage.separateMessages=false;
if(storage.copyMode==null)storage.copyMode='both';

function toast(message){
  try{
    if(toastApi.showToast)toastApi.showToast(String(message));
    else if(V.ui&&V.ui.showToast)V.ui.showToast(String(message));
  }catch(e){}
}

function pad(value,size){
  var out=String(Math.abs(Number(value)||0));
  while(out.length<(size||2))out='0'+out;
  return out;
}

function snowflakeMilliseconds(id){
  id=String(id||'');
  if(!/^\d{16,20}$/.test(id))return NaN;
  try{
    if(typeof BigInt==='function')return Number((BigInt(id)>>BigInt(22))+BigInt(DISCORD_EPOCH));
  }catch(e){}
  return NaN;
}

function valueMilliseconds(value){
  try{
    if(value instanceof Date)return value.getTime();
    if(value&&typeof value.valueOf==='function'){
      var direct=Number(value.valueOf());
      if(Number.isFinite(direct)&&direct>100000000000)return direct;
    }
    if(value&&value._d instanceof Date)return value._d.getTime();
    var parsed=Date.parse(String(value||''));
    if(Number.isFinite(parsed))return parsed;
  }catch(e){}
  return NaN;
}

function rememberId(id,value){
  var byId=snowflakeMilliseconds(id);
  var ms=Number.isFinite(byId)?byId:valueMilliseconds(value);
  if(!Number.isFinite(ms)||!id)return;
  var key=String(Math.round(ms));
  idsByTime[key]=String(id);
  idTimeOrder.push(key);
  if(idTimeOrder.length>1200){
    var old=idTimeOrder.shift();
    if(idTimeOrder.indexOf(old)===-1)delete idsByTime[old];
  }
}

function idFor(value,preferred){
  if(preferred&&/^\d{16,20}$/.test(String(preferred)))return String(preferred);
  var ms=valueMilliseconds(value);
  return Number.isFinite(ms)?idsByTime[String(Math.round(ms))]||'':'';
}

function dateFor(value,id){
  var snow=snowflakeMilliseconds(id);
  var ms=Number.isFinite(snow)?snow:valueMilliseconds(value);
  var date=new Date(ms);
  return Number.isFinite(date.getTime())?date:new Date();
}

function zoneSuffix(date,utc){
  if(utc)return'UTC';
  var offset=-date.getTimezoneOffset();
  var sign=offset>=0?'+':'-';
  var abs=Math.abs(offset);
  return'UTC'+sign+pad(Math.floor(abs/60))+':'+pad(abs%60);
}

function exactTime(value,id,forceZone){
  var date=dateFor(value,id);
  var utc=(forceZone||storage.zone)==='utc';
  var year=utc?date.getUTCFullYear():date.getFullYear();
  var month=(utc?date.getUTCMonth():date.getMonth())+1;
  var day=utc?date.getUTCDate():date.getDate();
  var hour=utc?date.getUTCHours():date.getHours();
  var minute=utc?date.getUTCMinutes():date.getMinutes();
  var second=utc?date.getUTCSeconds():date.getSeconds();
  var ms=utc?date.getUTCMilliseconds():date.getMilliseconds();
  var suffix='';
  var shownHour=hour;
  if(storage.clock24===false){
    suffix=hour>=12?' PM':' AM';
    shownHour=hour%12||12;
  }
  var time=(storage.clock24===false?String(shownHour):pad(shownHour))+':'+pad(minute);
  if(storage.seconds!==false)time+=':'+pad(second);
  if(storage.milliseconds!==false)time+='.'+pad(ms,3);
  return year+'-'+pad(month)+'-'+pad(day)+' '+time+suffix+' '+zoneSuffix(date,utc);
}

function relativeTime(value,id){
  var delta=dateFor(value,id).getTime()-Date.now();
  var future=delta>0;
  var amount=Math.abs(delta);
  var number,unit;
  if(amount<60000){number=Math.max(1,Math.round(amount/1000));unit='second';}
  else if(amount<3600000){number=Math.round(amount/60000);unit='minute';}
  else if(amount<86400000){number=Math.round(amount/3600000);unit='hour';}
  else if(amount<2592000000){number=Math.round(amount/86400000);unit='day';}
  else if(amount<31557600000){number=Math.round(amount/2629800000);unit='month';}
  else{number=Math.round(amount/31557600000);unit='year';}
  if(number!==1)unit+='s';
  return future?'in '+number+' '+unit:number+' '+unit+' ago';
}

function renderTime(value,id){
  var exact=exactTime(value,id);
  if(storage.mode==='relative')return relativeTime(value,id);
  if(storage.mode==='relativeExact')return relativeTime(value,id)+' • '+exact;
  return exact;
}

function wrapTimestamp(original,id){
  function formatted(){return renderTime(original,id);}
  if(typeof Proxy==='undefined')return formatted();
  try{
    return new Proxy(original,{
      get:function(target,prop){
        if(prop==='format'||prop==='calendar'||prop==='fromNow'||prop==='toISOString'||prop==='toString'||prop==='toJSON')return formatted;
        var value=target[prop];
        return typeof value==='function'?value.bind(target):value;
      }
    });
  }catch(e){return formatted();}
}

function messageIdFromProps(props,value){
  var possibilities=[props&&props.message&&props.message.id,props&&props.messageId,props&&props.id];
  for(var i=0;i<possibilities.length;i++)if(/^\d{16,20}$/.test(String(possibilities[i]||'')))return String(possibilities[i]);
  return idFor(value,'');
}

function clipboard(){
  var clip=(RN&&RN.Clipboard)||common.Clipboard;
  if(clip&&typeof clip.setString==='function')return clip;
  try{clip=findByProps('setString');}catch(e){}
  return clip&&typeof clip.setString==='function'?clip:null;
}

function copyTimestamp(value,id){
  var clip=clipboard();
  if(!clip){toast('Clipboard module is unavailable');return;}
  var exact=exactTime(value,id);
  var text=storage.copyMode==='id'?String(id||'No message ID available'):
    storage.copyMode==='time'?exact:
    id?exact+'\nMessage ID: '+id:exact;
  try{
    clip.setString(text);
    status.copy=true;
    toast(storage.copyMode==='id'?'Message ID copied':'Exact timestamp copied');
  }catch(e){toast('Could not copy timestamp');}
}

function patchRows(RowManager){
  if(status.row||!RowManager||!RowManager.prototype||typeof RowManager.prototype.generate!=='function')return false;
  try{
    var before=patcher.before('generate',RowManager.prototype,function(args){
      try{
        var row=args&&args[0];
        if(!row||row.rowType!==1||!row.message)return;
        var message=row.message;
        var id=String(message.id||'');
        rememberId(id,message.timestamp);
        if(storage.separateMessages)row.isFirst=true;
        // Current Kettu/Revenge message rows expect a rendered string. Older
        // builds also accept it, so avoid Moment/Date proxies on this path.
        if(message.timestamp!=null)message.__exactTimestamp=renderTime(message.timestamp,id);
        if(message.editedTimestamp!=null)message.__exactEditedTimestamp=renderTime(message.editedTimestamp,id);
      }catch(e){}
    });
    var after=patcher.after('generate',RowManager.prototype,function(args,result){
      try{
        var row=args&&args[0],message=row&&row.message;
        if(!message||!result||!result.message)return result;
        if(message.__exactTimestamp)result.message.timestamp=message.__exactTimestamp;
        if(message.__exactEditedTimestamp)result.message.editedTimestamp=message.__exactEditedTimestamp;
      }catch(e){}
      return result;
    });
    if(typeof before==='function')unpatches.push(before);
    if(typeof after==='function')unpatches.push(after);
    status.row=true;
    return true;
  }catch(e){return false;}
}

function patchRowsNext(){
  if(status.row||!RevengeNext)return false;
  var finders=RevengeNext.modules&&RevengeNext.modules.finders;
  var nextPatcher=RevengeNext.patcher;
  if(!finders||typeof finders.getModules!=='function'||typeof finders.withName!=='function'||!nextPatcher)return false;
  try{
    var rowUnpatchBefore=null,rowUnpatchInstead=null;
    var unsubscribe=finders.getModules(finders.withName('RowManager'),function(RowManager){
      if(status.row||!RowManager||!RowManager.prototype||typeof RowManager.prototype.generate!=='function')return;
      try{
        rowUnpatchBefore=nextPatcher.before(RowManager.prototype,'generate',function(args){
          try{
            var row=args&&args[0];
            if(!row||row.rowType!==1||!row.message)return args;
            var message=row.message;
            var id=String(message.id||'');
            rememberId(id,message.timestamp);
            if(storage.separateMessages)row.isFirst=true;
            if(message.timestamp!=null)message.__exactTimestamp=renderTime(message.timestamp,id);
            if(message.editedTimestamp!=null)message.__exactEditedTimestamp=renderTime(message.editedTimestamp,id);
          }catch(e){try{console.log('[ExactTimestamps] row hook',e);}catch(_) {}}
          return args;
        });
        rowUnpatchInstead=nextPatcher.instead(RowManager.prototype,'generate',function(args,original){
          if(typeof original!=='function')return undefined;
          var result=Reflect.apply(original,this,args);
          try{
            var row=args&&args[0],message=row&&row.message;
            if(!message||!result||!result.message)return result;
            if(message.__exactTimestamp)result.message.timestamp=message.__exactTimestamp;
            if(message.__exactEditedTimestamp)result.message.editedTimestamp=message.__exactEditedTimestamp;
          }catch(e){try{console.log('[ExactTimestamps] result hook',e);}catch(_) {}}
          return result;
        });
        status.row=true;
      }catch(e){try{console.log('[ExactTimestamps] next patch failed',e);}catch(_) {}}
    });
    unpatches.push(function(){
      try{if(typeof unsubscribe==='function')unsubscribe();}catch(e){}
      try{if(typeof rowUnpatchBefore==='function')rowUnpatchBefore();}catch(e){}
      try{if(typeof rowUnpatchInstead==='function')rowUnpatchInstead();}catch(e){}
    });
    return true;
  }catch(e){return false;}
}

function timestampModule(){
  var found=null;
  try{
    if(typeof metro.find==='function')found=metro.find(function(mod){
      if(!mod)return false;
      var values=typeof mod==='object'?Object.keys(mod).map(function(k){return mod[k];}):[mod];
      for(var i=0;i<values.length;i++){
        var value=values[i];
        if(typeof value==='string'&&value.indexOf('MESSAGE_EDITED_TIMESTAMP_A11Y_LABEL')!==-1)return true;
        if(typeof value==='function'){
          var source='';try{source=String(value);}catch(e){}
          if(source.indexOf('MESSAGE_EDITED_TIMESTAMP_A11Y_LABEL')!==-1||source.indexOf('MESSAGE_CREATED_TIMESTAMP_A11Y_LABEL')!==-1)return true;
        }
      }
      return false;
    });
  }catch(e){}
  if(found&&found.default)return found;
  var names=['MessageTimestamp','MessageTimestampContainer','Timestamp'];
  for(var n=0;n<names.length&&!found;n++)try{var candidate=findByName(names[n],false);if(candidate&&candidate.default)found=candidate;}catch(e){}
  return found&&found.default?found:null;
}

function patchTimestampComponent(module){
  if(status.component||!module||typeof module.default!=='function')return false;
  try{
    var before=patcher.before('default',module,function(args){
      try{
        var props=args&&args[0];
        if(!props)return;
        var original=props.timestamp;
        var id=messageIdFromProps(props,original);
        if(original!=null)props.timestamp=wrapTimestamp(original,id);
        if(props.editedTimestamp!=null)props.editedTimestamp=wrapTimestamp(props.editedTimestamp,id);
      }catch(e){}
    });
    var after=patcher.after('default',module,function(args,result){
      try{
        if(!React||!result)return result;
        var props=args&&args[0];
        var value=props&&(props.timestamp||props.editedTimestamp);
        var id=messageIdFromProps(props,value);
        var old=result.props&&result.props.onLongPress;
        return React.cloneElement(result,{
          onLongPress:function(event){
            if(typeof old==='function')try{old(event);}catch(e){}
            copyTimestamp(value,id);
          },
          delayLongPress:350
        });
      }catch(e){return result;}
    });
    if(typeof before==='function')unpatches.push(before);
    if(typeof after==='function')unpatches.push(after);
    status.component=true;
    return true;
  }catch(e){return false;}
}

function tryPatches(){
  if(!status.row)patchRowsNext();
  if(!status.row){
    var row=null;try{row=findByName('RowManager',false);}catch(e){}
    if(row)patchRows(row);
  }
  if(!status.component){
    var component=timestampModule();
    if(component)patchTimestampComponent(component);
  }
  return status.row||status.component;
}

function button(label,selected,onPress){
  var Pressable=RN.Pressable||RN.TouchableOpacity;
  return React.createElement(Pressable,{onPress:onPress,style:{paddingVertical:10,paddingHorizontal:12,borderRadius:9,marginRight:7,marginBottom:7,backgroundColor:selected?'#5865F2':'#2b2d31'}},
    React.createElement(RN.Text,{style:{color:'white',fontWeight:selected?'800':'600'}},label));
}

function Settings(){
  if(!React||!RN)return null;
  var View=RN.View,Text=RN.Text,Switch=RN.Switch,ScrollView=RN.ScrollView||RN.View;
  var state=React.useState(0),tick=state[0],setTick=state[1];
  function set(key,value){storage[key]=value;setTick(tick+1);}
  function title(value){return React.createElement(Text,{style:{color:'white',fontWeight:'800',fontSize:15,marginTop:18,marginBottom:9}},value);}
  function toggle(label,key){return React.createElement(View,{style:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:13}},React.createElement(Text,{style:{color:'white',flex:1,marginRight:12}},label),React.createElement(Switch,{value:storage[key]!==false,onValueChange:function(v){set(key,v);}}));}
  return React.createElement(ScrollView,{style:{padding:16}},
    React.createElement(Text,{style:{color:'white',fontWeight:'900',fontSize:24}},'Exact Timestamps'),
    React.createElement(Text,{style:{color:'#aaa',marginTop:7}},'Precise Discord message times. Long-press a timestamp to copy it.'),
    React.createElement(Text,{style:{color:status.row?'#6fdc8c':'#ffb86b',marginTop:10}},'Message row hook: '+(status.row?'ready':'waiting for Discord')),
    React.createElement(View,{style:{backgroundColor:'#1e1f22',borderRadius:11,padding:12,marginTop:14}},
      React.createElement(Text,{style:{color:'#b5bac1',fontSize:12}},'PREVIEW'),
      React.createElement(Text,{style:{color:'white',fontWeight:'700',marginTop:5}},renderTime(new Date(),'123456789012345678'))),
    title('Display'),
    React.createElement(View,{style:{flexDirection:'row',flexWrap:'wrap'}},
      button('Exact',storage.mode==='exact',function(){set('mode','exact');}),
      button('Relative',storage.mode==='relative',function(){set('mode','relative');}),
      button('Both',storage.mode==='relativeExact',function(){set('mode','relativeExact');})),
    title('Time zone'),
    React.createElement(View,{style:{flexDirection:'row',flexWrap:'wrap'}},
      button('Local',storage.zone==='local',function(){set('zone','local');}),
      button('UTC',storage.zone==='utc',function(){set('zone','utc');})),
    title('Long-press copies'),
    React.createElement(View,{style:{flexDirection:'row',flexWrap:'wrap'}},
      button('Time',storage.copyMode==='time',function(){set('copyMode','time');}),
      button('Message ID',storage.copyMode==='id',function(){set('copyMode','id');}),
      button('Both',storage.copyMode==='both',function(){set('copyMode','both');})),
    toggle('Use 24-hour clock','clock24'),
    toggle('Show seconds','seconds'),
    toggle('Show milliseconds','milliseconds'),
    toggle('Show name, avatar and time on every message','separateMessages'),
    React.createElement(Text,{style:{color:'#777',marginTop:20,marginBottom:30}},'Creation time is calculated from the Discord message snowflake whenever its ID is available. Existing messages may refresh after reopening the chat.')
  );
}

function onLoad(){
  tryPatches();
  var attempts=0;
  var timer=setInterval(function(){
    attempts++;
    tryPatches();
    if((status.row&&status.component)||attempts>=30){clearInterval(timer);}
  },1000);
  timers.push(timer);
}

function onUnload(){
  while(timers.length)try{clearInterval(timers.pop());}catch(e){}
  while(unpatches.length)try{unpatches.pop()();}catch(e){}
  status.row=false;status.component=false;
}

return{onLoad:onLoad,onUnload:onUnload,settings:Settings};
})()
