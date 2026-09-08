(function () {
  "use strict";

  var V = (typeof vendetta !== "undefined" && vendetta) || globalThis.vendetta || globalThis.revenge || globalThis.bunny || {};
  var metro = V.metro || {};
  var common = metro.common || {};
  function findByProps() {
    try { if (typeof metro.findByProps === "function") return metro.findByProps.apply(metro, arguments); } catch (e) {}
    try { if (typeof V.findByProps === "function") return V.findByProps.apply(V, arguments); } catch (e) {}
    return null;
  }

  var React = common.React || findByProps("createElement", "useState") || globalThis.React;
  var RN = common.ReactNative || findByProps("View", "Text", "Pressable") || {};
  var ui = V.ui || {};
  var toastApi = ui.toasts || {};
  var storageRoot = (V.plugin && V.plugin.storage) || V.storage || {};
  if (!storageRoot.dmPacker) storageRoot.dmPacker = {};
  var storage = storageRoot.dmPacker;
  if (storage.maxMessages == null) storage.maxMessages = 100000;
  if (storage.format == null) storage.format = "html";

  var cancelRequested = false;
  var lastExportPath = null;

  function toast(message) {
    try {
      if (toastApi && typeof toastApi.showToast === "function") toastApi.showToast(String(message));
      else if (ui && typeof ui.showToast === "function") ui.showToast(String(message));
    } catch (e) {}
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function asArray(value) {
    var out = [];
    if (!value) return out;
    if (Array.isArray(value)) return value.slice();
    try { if (Array.isArray(value._array)) return value._array.slice(); } catch (e) {}
    try { if (typeof value.toArray === "function") return value.toArray(); } catch (e2) {}
    try { if (typeof value.valueSeq === "function") return value.valueSeq().toArray(); } catch (e3) {}
    try { if (typeof value.forEach === "function") { value.forEach(function (item) { if (item) out.push(item); }); if (out.length) return out; } } catch (e4) {}
    try { Object.keys(value).forEach(function (key) { if (value[key]) out.push(value[key]); }); } catch (e5) {}
    return out;
  }

  function getCurrentChannelId() {
    var candidates = [
      findByProps("getChannelId"),
      findByProps("getLastSelectedChannelId"),
      findByProps("getCurrentlySelectedChannelId"),
      findByProps("getChannelId", "getVoiceChannelId")
    ];
    var methods = ["getChannelId", "getLastSelectedChannelId", "getCurrentlySelectedChannelId"];
    for (var i = 0; i < candidates.length; i++) {
      for (var j = 0; candidates[i] && j < methods.length; j++) {
        try {
          if (typeof candidates[i][methods[j]] === "function") {
            var id = candidates[i][methods[j]]();
            if (id) return String(id);
          }
        } catch (e) {}
      }
    }
    return null;
  }

  function getChannel(channelId) {
    var store = findByProps("getChannel", "getDMFromUserId") || findByProps("getChannel");
    try { return store && typeof store.getChannel === "function" ? store.getChannel(String(channelId)) : null; } catch (e) { return null; }
  }

  function isPersonalDM(channel) {
    if (!channel) return false;
    if (channel.guild_id || channel.guildId) return false;
    var type = channel.type;
    return type == null || type === 1 || type === 3 || type === "DM" || type === "GROUP_DM";
  }

  function getUser(userId) {
    var store = findByProps("getUser", "getCurrentUser") || findByProps("getUser");
    try { return store && typeof store.getUser === "function" ? store.getUser(String(userId)) : null; } catch (e) { return null; }
  }

  function displayUser(user) {
    if (!user) return "Unknown user";
    var base = user.global_name || user.globalName || user.username || user.name || user.id || "Unknown user";
    if (user.discriminator && user.discriminator !== "0" && user.username) base = user.username + "#" + user.discriminator;
    return String(base);
  }

  function channelLabel(channel) {
    if (!channel) return "Unknown DM";
    if (channel.name) return String(channel.name);
    var names = [];
    asArray(channel.rawRecipients || channel.recipients).forEach(function (recipient) {
      var user = typeof recipient === "object" ? recipient : getUser(recipient);
      var name = displayUser(user);
      if (name && names.indexOf(name) === -1) names.push(name);
    });
    return names.length ? names.join(", ") : "DM " + String(channel.id || "");
  }

  function getHTTP() {
    var candidates = [
      common.API,
      common.HTTP,
      findByProps("getAPIBaseURL", "get"),
      findByProps("get", "post", "put", "del"),
      findByProps("get", "post", "patch", "del")
    ];
    for (var i = 0; i < candidates.length; i++) {
      var api = candidates[i];
      if (api && api.HTTP) api = api.HTTP;
      if (api && typeof api.get === "function") return api;
    }
    throw new Error("Discord HTTP API is unavailable on this Kettu build.");
  }

  function responseBody(response) {
    var body = response && (response.body != null ? response.body : response.data != null ? response.data : response.text != null ? response.text : response);
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (e) {}
    }
    return body;
  }

  async function requestMessagePage(channelId, before) {
    var query = { limit: 100 };
    if (before) query.before = before;
    var response = await getHTTP().get({ url: "/channels/" + channelId + "/messages", query: query });
    var body = responseBody(response);
    if (response && response.status === 429) {
      var retry = Math.max(500, Math.ceil(Number(body && body.retry_after || 1) * 1000));
      await wait(retry);
      response = await getHTTP().get({ url: "/channels/" + channelId + "/messages", query: query });
      body = responseBody(response);
    }
    if (response && (response.status >= 400 || response.ok === false)) {
      throw new Error("Discord returned HTTP " + response.status + (body && body.message ? ": " + body.message : ""));
    }
    var list = Array.isArray(body) ? body : body && body.messages;
    if (!Array.isArray(list)) throw new Error(body && body.message || "Discord returned an unexpected message response.");
    return list;
  }


  var busy=false, stopped=false, MAX=16*1024*1024;
  if(!Array.isArray(storage.archives))storage.archives=[];
  function fm(){var n=RN.NativeModules||{},m=n.RTNFileManager||n.DCDFileManager||n.NativeFileModule;if(!m||!m.readFile||!m.writeFile)throw Error("Native file reader/writer unavailable");return m;}
  function utf(s){var x=unescape(encodeURIComponent(s)),a=new Uint8Array(x.length);for(var i=0;i<x.length;i++)a[i]=x.charCodeAt(i);return a;}
  var abc="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  function b64(a){var chunks=[];for(var p=0;p<a.length;p+=12288){var s="";for(var i=p;i<Math.min(p+12288,a.length);i+=3){var v=(a[i]<<16)|((a[i+1]||0)<<8)|(a[i+2]||0);s+=abc[v>>>18]+abc[(v>>>12)&63]+(i+1<a.length?abc[(v>>>6)&63]:"=")+(i+2<a.length?abc[v&63]:"=");}chunks.push(s);}return chunks.join("");}
  function un64(s){s=String(s).replace(/\s/g,"");if(s.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(s))throw Error("Invalid base64");var a=new Uint8Array(s.length/4*3-(s.endsWith("==")?2:s.endsWith("=")?1:0)),p=0;for(var i=0;i<s.length;i+=4){var n=(abc.indexOf(s[i])<<18)|(abc.indexOf(s[i+1])<<12)|((abc.indexOf(s[i+2])&63)<<6)|(abc.indexOf(s[i+3])&63);if(p<a.length)a[p++]=n>>>16;if(p<a.length)a[p++]=n>>>8;if(p<a.length)a[p++]=n;}return a;}
  function crc(a){var c=0xffffffff;for(var i=0;i<a.length;i++){c^=a[i];for(var j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
  function concat(xs){var a=new Uint8Array(xs.reduce(function(n,x){return n+x.length;},0)),p=0;xs.forEach(function(x){a.set(x,p);p+=x.length;});return a;}
  function zip(entries){
    var local=[],central=[],offset=0;
    entries.forEach(function(e){var name=utf(e.name),data=e.data,c=crc(data),h=new Uint8Array(30+name.length),d=new DataView(h.buffer);
      d.setUint32(0,0x04034b50,true);d.setUint16(4,20,true);d.setUint16(6,2048,true);d.setUint32(14,c,true);d.setUint32(18,data.length,true);d.setUint32(22,data.length,true);d.setUint16(26,name.length,true);h.set(name,30);
      var ch=new Uint8Array(46+name.length),v=new DataView(ch.buffer);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,2048,true);v.setUint32(16,c,true);v.setUint32(20,data.length,true);v.setUint32(24,data.length,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true);ch.set(name,46);
      local.push(h,data);central.push(ch);offset+=h.length+data.length;});
    var cd=concat(central),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,cd.length,true);v.setUint32(16,offset,true);return concat(local.concat([cd,end]));
  }
  function unzip(a){
    if(a.length>25*1024*1024)throw Error("ZIP exceeds 25 MiB");var d=new DataView(a.buffer,a.byteOffset,a.byteLength),p=0,out=[],seen=new Set(),total=0;
    while(p+4<=a.length&&d.getUint32(p,true)===0x04034b50){
      if(p+30>a.length)throw Error("Truncated ZIP");var flags=d.getUint16(p+6,true),method=d.getUint16(p+8,true),c=d.getUint32(p+14,true),size=d.getUint32(p+18,true),raw=d.getUint32(p+22,true),nl=d.getUint16(p+26,true),el=d.getUint16(p+28,true),start=p+30+nl+el;
      if(flags&9||method!==0||size!==raw)throw Error("Only unencrypted STORE ZIPs made by this plugin are supported");
      if(start+size>a.length||!nl||out.length>=4096)throw Error("Invalid ZIP bounds");
      var name="";for(var i=p+30;i<p+30+nl;i++)name+=String.fromCharCode(a[i]);
      if(!/^[A-Za-z0-9_./-]+$/.test(name)||name.startsWith("/")||name.split("/").some(function(s){return !s||s==="."||s==="..";})||seen.has(name))throw Error("Unsafe or duplicate ZIP path");
      seen.add(name);total+=size;if(total>24*1024*1024)throw Error("Extraction size limit");
      var data=a.subarray(start,start+size);if(crc(data)!==c)throw Error("Corrupt ZIP entry");out.push({name:name,data:data});p=start+size;
    }
    if(!out.length||p+4>a.length||d.getUint32(p,true)!==0x02014b50)throw Error("Unsupported or incomplete ZIP");return out;
  }
  function safe(s){return String(s||"file").replace(/[^A-Za-z0-9_.-]/g,"_").replace(/^\.+/,"_").slice(0,100)||"file";}
  function uid(){return Date.now()+"-"+Math.random().toString(36).slice(2,8);}
  async function share(path){if(!RN.Share||!RN.Share.share)throw Error("Share sheet unavailable. Saved: "+path);await RN.Share.share({url:path.startsWith("file://")?path:"file://"+path});}
  async function download(u,size){
    if(!/^https:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/attachments\//i.test(u))throw Error("Not a Discord attachment URL");
    if(!Number.isFinite(size)||size<0||size>MAX)throw Error("Unknown size or over 16 MiB");
    return new Promise(function(resolve,reject){var x=new XMLHttpRequest();x.open("GET",u);x.responseType="arraybuffer";x.timeout=60000;x.onprogress=function(e){if(e.loaded>MAX||stopped)x.abort();};
      x.onerror=function(){reject(Error("Download failed"));};x.ontimeout=function(){reject(Error("Download timed out"));};x.onabort=function(){reject(Error("Stopped or size limit"));};
      x.onload=function(){if(x.status<200||x.status>=300)return reject(Error("HTTP "+x.status));var a=new Uint8Array(x.response);if(a.length>MAX)return reject(Error("Over 16 MiB"));resolve(a);};x.send();});
  }
  async function pack(id,progress){
    fm();var run=uid(),part=0,entries=[],bytes=0,files=0,pages=0,before=null,seen=new Set(),links=new Set(),issues=[],scanError=null;
    async function flush(){if(!entries.length)return;var path=await fm().writeFile("documents","KettuPacks/"+run+"/part-"+(++part)+".zip",b64(zip(entries)),"base64");if(!path)throw Error("Writer returned no path");storage.archives=storage.archives.concat([{path:String(path),name:run+" part "+part}]);entries=[];bytes=0;}
    async function add(name,data){if(bytes+data.length>24*1024*1024||entries.length>=1000)await flush();entries.push({name:name,data:data});bytes+=data.length;}
    try{
      while(!stopped){
        var batch=await requestMessagePage(id,before);if(!batch.length)break;pages++;
        for(var m of batch){if(stopped)break;
          (String(m.content||"").match(/https?:\/\/[^\s<>"\u0060]+/gi)||[]).forEach(function(u){links.add(u);});
          asArray(m.embeds).forEach(function(e){if(/^https?:\/\//i.test(e.url||""))links.add(e.url);});
          for(var a of asArray(m.attachments)){if(stopped)break;var u=String(a.url||""),key=String(a.id||u);if(!u||seen.has(key))continue;seen.add(key);
            progress("Page "+pages+"; packed "+files+"; downloading "+safe(a.filename));
            var data;try{data=await download(u,Number(a.size));}catch(e){if(!stopped)issues.push({file:safe(a.filename),url:u,reason:e.message});continue;}
            if(stopped)break;await add("files/"+safe(key)+"-"+safe(a.filename),data);files++;
          }
        }
        var next=String(batch[batch.length-1].id||"");batch=null;if(!next||next===before)throw Error("History cursor stalled");before=next;
        if(links.size>50000||seen.size>50000)throw Error("50,000-item safety limit");await wait(400);
      }
    }catch(e){scanError=e.message;}
    var all=Array.from(links);for(var i=0;i<all.length;i+=1000)await add("links-"+(i/1000+1)+".txt",utf(all.slice(i,i+1000).join("\n")));
    await add("report.json",utf(JSON.stringify({files:files,skipped:issues.length,cancelled:stopped,scanError:scanError,issues:issues},null,2)));await flush();
    return "Saved "+part+" ZIP part(s), "+files+" files, "+links.size+" URLs; "+issues.length+" skipped."+(stopped||scanError?" INCOMPLETE: "+(scanError||"cancelled"):"")+" Check report.json.";
  }
  async function unpack(path,progress){
    if(!/^(file:\/\/\/|\/)/.test(path))throw Error("Enter a local absolute path, not a web URL");
    var encoded=await fm().readFile(path,"base64");if(encoded.length>36*1024*1024)throw Error("ZIP too large");
    var list=unzip(un64(encoded)),folder="KettuUnpacked/"+uid(),saved=[];
    for(var e of list){if(stopped)break;progress("Unpacking "+e.name);var p=await fm().writeFile("documents",folder+"/"+e.name,b64(e.data),"base64");saved.push({name:e.name,path:String(p)});}return saved;
  }
  function Settings(){
    var h=React.createElement,S=React.useState,msg=S("Open a DM, then confirm below."),status=msg[0],setStatus=msg[1],tick=S(0),bump=function(){tick[1](function(n){return n+1;});};
    var ps=S(""),path=ps[0],setPath=ps[1],output=S([]),rows=output[0],setRows=output[1];
    var id=getCurrentChannelId(),channel=getChannel(id),valid=channel&&(channel.type===1||channel.type===3)&&!channel.guild_id;
    function button(label,action,disabled){return h(RN.Pressable||RN.TouchableOpacity,{disabled:disabled,onPress:action,style:{backgroundColor:disabled?"#444":"#384590",padding:12,borderRadius:8,marginTop:8}},h(RN.Text,{style:{color:"white"}},label));}
    async function run(fn){if(busy)return;busy=true;stopped=false;bump();try{await fn();}catch(e){setStatus(e.message||String(e));}finally{busy=false;bump();}}
    function doUnpack(p){run(async function(){setRows([]);var result=await unpack(p,setStatus);setRows(result);setStatus("Extracted "+result.length+" files. Tap to share/open."+ (stopped?" Cancelled early.":""));});}
    return h(RN.ScrollView,{style:{padding:16},keyboardShouldPersistTaps:"handled"},
      h(RN.Text,{style:{color:"white",fontSize:24,fontWeight:"800"}},"DM File Packer 1.0.0"),
      h(RN.Text,{style:{color:"#ccc",marginVertical:10}},"Target: "+(valid?channelLabel(channel):"No DM selected")+"\nScans history temporarily for attachments and URLs. No message text is saved. Shared URLs are not visited. ZIPs are NOT encrypted.\n16 MiB per attachment; 24 MiB per ZIP part. Oversized/unavailable files are listed in report.json. No video recompression."),
      button("Pack this DM",function(){RN.Alert.alert("Pack "+channelLabel(channel)+"?","Download attachments and save shared URLs from accessible history?",[{text:"Cancel",style:"cancel"},{text:"Pack",onPress:function(){run(async function(){setStatus(await pack(id,setStatus));});}}]);},busy||!valid),
      busy?button("Stop after current operation",function(){stopped=true;setStatus("Stopping; saving completed items…");}):null,
      h(RN.Text,{style:{color:"#ffcf88",marginTop:12}},status),
      h(RN.Text,{style:{color:"white",fontSize:19,marginTop:20}},"Saved ZIP parts"),
      ...storage.archives.map(function(a){return h(RN.View,{key:a.path},h(RN.Text,{selectable:true,style:{color:"#bbb",marginTop:8}},a.name),button("Share ZIP",function(){run(function(){return share(a.path);});},busy),button("Unpack ZIP",function(){doUnpack(a.path);},busy));}),
      h(RN.Text,{style:{color:"#ccc",marginTop:20}},"Or paste the local path of a ZIP made by this plugin. No Files picker needed. Compressed third-party ZIPs are not supported."),
      h(RN.TextInput,{value:path,onChangeText:setPath,autoCorrect:false,autoCapitalize:"none",placeholder:"/…/part-1.zip",placeholderTextColor:"#999",style:{color:"white",padding:10,borderWidth:1,borderColor:"#555"}}),
      button("Unpack local path",function(){doUnpack(path.trim());},busy||!path.trim()),
      ...rows.map(function(r){return button("Share "+r.name,function(){run(function(){return share(r.path);});},busy);}),
      h(RN.View,{style:{height:40}}));
  }
  return {settings:Settings,SettingsComponent:Settings,onLoad:function(){},onUnload:function(){stopped=true;}};
})()
