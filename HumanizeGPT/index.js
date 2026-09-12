(function(){
'use strict';

var V=(typeof vendetta!=='undefined'&&vendetta)||globalThis.vendetta||globalThis.revenge||globalThis.bunny||{};
var metro=V.metro||{};
var patcher=V.patcher||{};
var common=metro.common||{};
var React=common.React;
var RN=common.ReactNative;
var ui=V.ui||{};
var toasts=ui.toasts||{};
var storage=(V.plugin&&V.plugin.storage)||V.storage&&V.storage.humanizeGPT||{};
var findByProps=metro.findByProps||function(){return null;};
var unpatches=[];
var bypass=false;
var status='Not started';

if(storage.apiKey==null)storage.apiKey='';
if(storage.model==null)storage.model='gpt-4o-mini';
if(storage.tone==null)storage.tone='Natural and casual';
if(storage.preserveMeaning==null)storage.preserveMeaning=true;
if(storage.maxCharacters==null)storage.maxCharacters=2000;

function toast(message){
  try{if(toasts.showToast)toasts.showToast(String(message));else if(ui.showToast)ui.showToast(String(message));}
  catch(e){try{console.log('[HumanizeGPT]',message);}catch(_){}}
}

function extractText(message){
  if(typeof message==='string')return message;
  if(message&&typeof message.content==='string')return message.content;
  return'';
}

function withText(message,text){
  if(typeof message==='string')return text;
  return Object.assign({},message,{content:text});
}

function commandText(text){
  var m=String(text||'').match(/^\s*\/(?:humanize|humanise|hgpt)(?:\s+|$)([\s\S]*)$/i);
  return m?m[1].trim():null;
}

function outputText(json){
  if(json&&typeof json.output_text==='string'&&json.output_text.trim())return json.output_text.trim();
  var out=json&&json.output;
  if(Array.isArray(out)){
    for(var i=0;i<out.length;i++){
      var content=out[i]&&out[i].content;
      if(!Array.isArray(content))continue;
      for(var j=0;j<content.length;j++){
        var item=content[j];
        if(item&&typeof item.text==='string'&&item.text.trim())return item.text.trim();
      }
    }
  }
  return'';
}

async function humanize(text){
  var key=String(storage.apiKey||'').trim();
  if(!key)throw new Error('Add your OpenAI API key in HumanizeGPT settings');
  var limit=Math.max(100,Math.min(4000,Number(storage.maxCharacters)||2000));
  text=String(text||'').slice(0,limit);
  var instructions='Rewrite the user text so it sounds genuinely human. Tone: '+String(storage.tone||'Natural and casual')+'. '+
    (storage.preserveMeaning!==false?'Preserve the exact meaning, facts, names, links, and intent. ':'')+
    'Return only the rewritten message with no quotation marks, labels, commentary, or markdown wrapper.';
  var response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',
    headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({model:String(storage.model||'gpt-4o-mini'),instructions:instructions,input:text})
  });
  var bodyText=await response.text();
  var json={};
  try{json=JSON.parse(bodyText);}catch(e){}
  if(!response.ok){
    var detail=json&&json.error&&json.error.message;
    throw new Error(detail||('OpenAI request failed ('+response.status+')'));
  }
  var result=outputText(json);
  if(!result)throw new Error('OpenAI returned no rewritten text');
  return result.slice(0,limit);
}

function patchSend(){
  var sender=findByProps('sendMessage','editMessage');
  if(!sender||typeof sender.sendMessage!=='function'||!patcher.instead){status='Send hook missing';return false;}
  var unpatch=patcher.instead('sendMessage',sender,function(args,original){
    if(bypass)return original.apply(sender,args);
    var text=extractText(args&&args[1]);
    var input=commandText(text);
    if(input===null)return original.apply(sender,args);
    if(!input){toast('Add text after /humanize');return Promise.resolve();}
    var channelId=args&&args[0];
    var originalMessage=args&&args[1];
    toast('Humanizing message…');
    return humanize(input).then(function(result){
      var nextArgs=(args||[]).slice();
      nextArgs[1]=withText(originalMessage,result);
      bypass=true;
      try{
        var sent=original.apply(sender,nextArgs);
        toast('Humanized message sent');
        return sent;
      }finally{bypass=false;}
    }).catch(function(error){
      toast('Humanize failed: '+String(error&&error.message||error));
      try{console.log('[HumanizeGPT] channel',channelId,'error',error);}catch(_){}
    });
  });
  if(typeof unpatch==='function')unpatches.push(unpatch);
  status='Ready';
  return true;
}

function Settings(){
  if(!React||!RN)return null;
  var View=RN.View,Text=RN.Text,TextInput=RN.TextInput,Switch=RN.Switch,ScrollView=RN.ScrollView||RN.View;
  var Pressable=RN.Pressable||RN.TouchableOpacity;
  var s=React.useState(0),tick=s[0],setTick=s[1];
  var k=React.useState(String(storage.apiKey||'')),key=k[0],setKey=k[1];
  function bump(){setTick(tick+1);}
  function label(value){return React.createElement(Text,{style:{color:'white',fontWeight:'700',marginTop:16,marginBottom:6}},value);}
  function field(value,onChange,props){return React.createElement(TextInput,Object.assign({value:value,onChangeText:onChange,placeholderTextColor:'#777',style:{borderWidth:1,borderColor:'#555',borderRadius:10,padding:11,color:'white'}},props||{}));}
  return React.createElement(ScrollView,{style:{padding:16}},
    React.createElement(Text,{style:{color:'white',fontWeight:'900',fontSize:24}},'HumanizeGPT'),
    React.createElement(Text,{style:{color:status==='Ready'?'#6fdc8c':'#ffb86b',marginTop:8}},'Status: '+status),
    React.createElement(Text,{style:{color:'#aaa',marginTop:8}},'Send /humanize followed by your text. Only the rewritten result is posted.'),
    label('OpenAI API key'),
    field(key,setKey,{secureTextEntry:true,autoCapitalize:'none',autoCorrect:false,placeholder:'sk-…'}),
    React.createElement(Pressable,{onPress:function(){storage.apiKey=String(key||'').trim();toast('API key saved locally');bump();},style:{backgroundColor:'#5865F2',borderRadius:10,padding:13,marginTop:9}},React.createElement(Text,{style:{color:'white',fontWeight:'800',textAlign:'center'}},'Save API Key')),
    label('Model'),
    field(String(storage.model||''),function(v){storage.model=v;bump();},{autoCapitalize:'none',autoCorrect:false}),
    label('Tone'),
    field(String(storage.tone||''),function(v){storage.tone=v;bump();},{placeholder:'Natural and casual'}),
    label('Maximum characters'),
    field(String(storage.maxCharacters||2000),function(v){var n=Number(v);if(Number.isFinite(n))storage.maxCharacters=n;bump();},{keyboardType:'number-pad'}),
    React.createElement(View,{style:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:18}},
      React.createElement(Text,{style:{color:'white',flex:1,marginRight:12}},'Preserve exact meaning and facts'),
      React.createElement(Switch,{value:storage.preserveMeaning!==false,onValueChange:function(v){storage.preserveMeaning=v;bump();}})),
    React.createElement(Text,{style:{color:'#777',marginTop:20,marginBottom:30}},'Your API key stays in local Kettu plugin storage. Message text is sent to OpenAI only when you use /humanize, /humanise, or /hgpt.')
  );
}

function onLoad(){patchSend();toast(status==='Ready'?'HumanizeGPT ready — use /humanize':'HumanizeGPT: send hook missing');}
function onUnload(){while(unpatches.length){try{unpatches.pop()();}catch(e){}}status='Stopped';}

return{onLoad:onLoad,onUnload:onUnload,settings:Settings};
})()
