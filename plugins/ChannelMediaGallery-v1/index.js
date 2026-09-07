(function () {
  "use strict";

  var V = globalThis.vendetta || globalThis.revenge || globalThis.bunny || {};
  var metro = V.metro || {};
  var common = metro.common || {};
  function findByProps() {
    try { if (typeof metro.findByProps === "function") return metro.findByProps.apply(metro, arguments); } catch (e) {}
    try { if (typeof V.findByProps === "function") return V.findByProps.apply(V, arguments); } catch (e) {}
    return null;
  }
  var React = common.React || findByProps("createElement", "useState") || globalThis.React;
  var RN = common.ReactNative || findByProps("View", "Text", "TextInput", "Pressable") || {};
  var ui = V.ui || {};
  var toastApi = ui.toasts || {};
  var storageRoot = (V.plugin && V.plugin.storage) || V.storage || {};
  var storage = storageRoot.channelMediaGallery || (storageRoot.channelMediaGallery = {});
  var timer = null;

  if (storage.maxMedia == null) storage.maxMedia = 200;
  if (storage.fetchLimit == null) storage.fetchLimit = 500;
  if (storage.filterMode == null) storage.filterMode = "all";
  if (storage.lastChannelId == null) storage.lastChannelId = null;
  if (!Array.isArray(storage.savedMedia)) storage.savedMedia = [];

  var status = { http: false, cache: false, last: "Not loaded" };

  function toast(message) {
    status.last = String(message);
    try { if (toastApi.showToast) toastApi.showToast(String(message)); else if (ui.showToast) ui.showToast(String(message)); } catch (e) {}
    try { console.log("[Channel Media Gallery]", message); } catch (e) {}
  }

  function asArray(collection) {
    var out = [];
    if (!collection) return out;
    if (Array.isArray(collection)) return collection.slice();
    try { if (Array.isArray(collection._array)) return collection._array.slice(); } catch (e) {}
    try { if (typeof collection.toArray === "function") return collection.toArray(); } catch (e) {}
    try { if (typeof collection.valueSeq === "function") return collection.valueSeq().toArray(); } catch (e) {}
    try { if (typeof collection.forEach === "function") { collection.forEach(function (value) { if (value) out.push(value); }); if (out.length) return out; } } catch (e) {}
    try { Object.keys(collection).forEach(function (key) { var value = collection[key]; if (value && typeof value === "object" && value.id) out.push(value); }); } catch (e) {}
    return out;
  }

  function compareMessageIds(a, b) {
    a = String((a && a.id) || "0");
    b = String((b && b.id) || "0");
    if (a.length !== b.length) return b.length - a.length;
    return b > a ? 1 : b < a ? -1 : 0;
  }

  function getCurrentChannelId() {
    var candidates = [["getChannelId"], ["getLastSelectedChannelId"], ["getCurrentlySelectedChannelId"], ["getChannelId", "getVoiceChannelId"]];
    for (var i = 0; i < candidates.length; i++) {
      try {
        var mod = findByProps.apply(null, candidates[i]);
        if (!mod) continue;
        var keys = ["getChannelId", "getLastSelectedChannelId", "getCurrentlySelectedChannelId"];
        for (var j = 0; j < keys.length; j++) {
          if (typeof mod[keys[j]] === "function") {
            var id = mod[keys[j]]();
            if (id) return String(id);
          }
        }
      } catch (e) {}
    }
    return storage.lastChannelId || null;
  }

  function rememberCurrentChannel() {
    var id = getCurrentChannelId();
    if (id) storage.lastChannelId = id;
    return id;
  }

  function isMediaUrl(url) { return /\.(png|jpe?g|gif|webp|bmp|heic|heif|mp4|mov|webm|m4v)(\?|#|$)/i.test(String(url || "")); }
  function mediaTypeFrom(value) {
    value = String(value || "").toLowerCase();
    if (value.indexOf("image/") === 0 || /\.(png|jpe?g|gif|webp|bmp|heic|heif)(\?|#|$)/i.test(value)) return "image";
    if (value.indexOf("video/") === 0 || /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(value)) return "video";
    return "embed";
  }

  function pushMedia(items, seen, message, raw, origin) {
    if (!raw) return;
    var url = raw.url || raw.proxy_url || raw.proxyURL;
    if (!url || seen[url]) return;
    var name = raw.filename || raw.name || raw.title || origin || "media";
    var contentType = raw.content_type || raw.contentType || raw.type || name || url;
    var type = mediaTypeFrom(contentType);
    if (type === "embed") type = mediaTypeFrom(url);
    if (origin === "embed" && type !== "image" && type !== "video") type = "embed";
    if (type === "embed" && origin !== "embed" && !isMediaUrl(url)) return;
    seen[url] = true;
    items.push({
      url: String(url),
      proxyUrl: String(raw.proxy_url || raw.proxyURL || url),
      width: Number(raw.width) || 0,
      height: Number(raw.height) || 0,
      type: type,
      origin: origin || (type === "embed" ? "embed" : "attachment"),
      name: String(name),
      messageId: String((message && message.id) || ""),
      author: String((message && message.author && (message.author.username || message.author.globalName)) || ""),
      timestamp: String((message && (message.timestamp || message.createdAt)) || "")
    });
  }

  function collectMedia(messages, max) {
    var items = [];
    var seen = {};
    asArray(messages).sort(compareMessageIds).forEach(function (message) {
      if (!message || items.length >= max) return;
      asArray(message.attachments).forEach(function (attachment) { if (items.length < max) pushMedia(items, seen, message, attachment, "attachment"); });
      asArray(message.embeds).forEach(function (embed) {
        if (items.length >= max || !embed) return;
        if (embed.image) pushMedia(items, seen, message, Object.assign({}, embed.image, { content_type: "image/*" }), "embed");
        if (embed.thumbnail) pushMedia(items, seen, message, Object.assign({}, embed.thumbnail, { content_type: "image/*" }), "embed");
        if (embed.video) pushMedia(items, seen, message, Object.assign({}, embed.video, { content_type: "video/*" }), "embed");
        if (embed.url) pushMedia(items, seen, message, { url: embed.url, title: embed.title || "embed" }, "embed");
      });
    });
    return items;
  }

  function getCachedMessages(channelId) {
    var MessageStore = findByProps("getMessages", "getMessage") || findByProps("getMessages");
    if (!MessageStore || typeof MessageStore.getMessages !== "function") return [];
    try { var messages = asArray(MessageStore.getMessages(channelId)); if (messages.length) status.cache = true; return messages; } catch (e) { return []; }
  }

  async function httpGetMessages(HTTP, url, limit, before) {
    var query = { limit: limit };
    if (before) query.before = before;
    try {
      var response = await HTTP.get({ url: url, query: query });
      var body = response && (response.body || response.text || response.data || response);
      return asArray(body && body.messages ? body.messages : body);
    } catch (e) {}
    try {
      var full = url + "?limit=" + encodeURIComponent(limit) + (before ? "&before=" + encodeURIComponent(before) : "");
      var response2 = await HTTP.get({ url: full });
      var body2 = response2 && (response2.body || response2.text || response2.data || response2);
      return asArray(body2 && body2.messages ? body2.messages : body2);
    } catch (e2) {}
    return [];
  }

  async function getRemoteMessages(channelId, totalLimit) {
    var HTTP = findByProps("get", "post", "put", "del") || findByProps("get", "post", "patch", "del");
    if (!HTTP || typeof HTTP.get !== "function") return [];
    var all = [];
    var before = null;
    var paths = ["/channels/" + channelId + "/messages", "/api/v9/channels/" + channelId + "/messages"];
    for (var p = 0; p < paths.length && all.length === 0; p++) {
      before = null;
      for (var i = 0; i < 8 && all.length < totalLimit; i++) {
        var batch = await httpGetMessages(HTTP, paths[p], Math.min(100, totalLimit - all.length), before);
        if (!batch.length) break;
        all = all.concat(batch);
        before = String((batch[batch.length - 1] && batch[batch.length - 1].id) || "");
        if (!before || batch.length < 100) break;
      }
    }
    if (all.length) status.http = true;
    return all;
  }

  function filtered(items) {
    var mode = storage.filterMode || "all";
    return asArray(items).filter(function (item) {
      if (mode === "all") return true;
      if (mode === "image") return item.type === "image";
      if (mode === "video") return item.type === "video";
      if (mode === "embed") return item.origin === "embed" || item.type === "embed";
      return true;
    });
  }

  async function loadMedia() {
    var channelId = rememberCurrentChannel();
    var max = Math.max(1, Math.min(500, Number(storage.maxMedia) || 200));
    var limit = Math.max(max, Math.min(800, Number(storage.fetchLimit) || 500));
    if (!channelId) throw new Error("Open a channel first, then open this plugin settings page.");
    var remote = await getRemoteMessages(channelId, limit);
    var cached = getCachedMessages(channelId);
    var media = collectMedia(remote.concat(cached), max);
    if (!media.length) throw new Error(remote.length || cached.length ? "No media found in scanned messages." : "No messages found. Scroll the channel a bit, then reload.");
    storage.savedMedia = media;
    storage.savedChannelId = channelId;
    storage.savedAt = new Date().toISOString();
    return { channelId: channelId, media: media, source: remote.length ? "recent history" : "loaded cache" };
  }

  function copyUrl(url) { try { if (RN.Clipboard && RN.Clipboard.setString) { RN.Clipboard.setString(url); toast("Media URL copied"); return; } } catch (e) {} toast("Clipboard unavailable"); }

  async function openNativeMedia(item) {
    var viewer = findByProps("openMediaModal");
    if (!viewer || typeof viewer.openMediaModal !== "function") {
      throw new Error("Discord's native media viewer is unavailable on this build.");
    }
    var type = item.type === "embed" ? mediaTypeFrom(item.url) : item.type;
    if (type !== "image" && type !== "video") {
      throw new Error("This embed is a webpage, not playable media. Open its image or video tile.");
    }
    var screen = RN.Dimensions ? RN.Dimensions.get("window") : { width: 320, height: 640 };
    var width = Number(item.width) || screen.width;
    var height = Number(item.height) || screen.height;
    if (type === "image" && (!item.width || !item.height) && RN.Image && RN.Image.getSize) {
      var size = await new Promise(function (resolve) {
        var timeout = setTimeout(function () { resolve(null); }, 3000);
        RN.Image.getSize(item.proxyUrl || item.url, function (w, h) {
          clearTimeout(timeout); resolve([w, h]);
        }, function () { clearTimeout(timeout); resolve(null); });
      });
      if (size) { width = size[0]; height = size[1]; }
    }
    var source = { sourceURI: item.url, width: width, height: height };
    if (type === "video") source.videoURI = item.url;
    else source.uri = item.proxyUrl || item.url;
    // Older clients use originLayout; newer clients accept originViewOrOriginLayout.
    var origin = { x: screen.width / 2 - 56, y: screen.height / 2 - 56, width: 112, height: 112, resizeMode: "fill" };
    await viewer.openMediaModal({
      initialSources: [source],
      initialIndex: 0,
      channelId: storage.savedChannelId || undefined,
      originLayout: origin,
      originViewOrOriginLayout: origin
    });
  }

  function Settings() {
    if (!React || !RN || !RN.View || !RN.Text) return null;
    var View = RN.View, Text = RN.Text, Image = RN.Image, Pressable = RN.Pressable || RN.TouchableOpacity, ScrollView = RN.ScrollView || RN.View, TextInput = RN.TextInput, ActivityIndicator = RN.ActivityIndicator;
    var state = React.useState(filtered(storage.savedMedia));
    var items = state[0], setItems = state[1];
    var loadingState = React.useState(false), loading = loadingState[0], setLoading = loadingState[1];
    var msgState = React.useState(storage.savedMedia.length ? "Showing saved gallery. Run again to refresh." : status.last), message = msgState[0], setMessage = msgState[1];
    var tickState = React.useState(0), tick = tickState[0], setTick = tickState[1];
    function bump() { setTick(tick + 1); setItems(filtered(storage.savedMedia)); }
    async function runLoad() {
      setLoading(true); setMessage("Scanning channel media...");
      try { var result = await loadMedia(); setItems(filtered(result.media)); setMessage("Saved " + result.media.length + " media from " + result.source + ". Channel: " + result.channelId); }
      catch (e) { setMessage(e && e.message ? e.message : String(e)); }
      setLoading(false);
    }
    function numberBox(label, key) {
      return React.createElement(View, { style: { flex: 1, marginRight: 8 } },
        React.createElement(Text, { style: { color: "#bbb", marginBottom: 6, fontSize: 12 } }, label),
        TextInput ? React.createElement(TextInput, { keyboardType: "number-pad", value: String(storage[key]), onChangeText: function (value) { var next = Number(value); if (Number.isFinite(next)) storage[key] = next; bump(); }, style: { color: "white", borderColor: "#444", borderWidth: 1, borderRadius: 8, padding: 10 } }) : React.createElement(Text, { style: { color: "white" } }, String(storage[key]))
      );
    }
    function filterButton(label, mode) {
      var active = storage.filterMode === mode;
      return React.createElement(Pressable, { onPress: function () { storage.filterMode = mode; bump(); }, style: { paddingVertical: 9, paddingHorizontal: 11, marginRight: 6, marginTop: 8, borderRadius: 8, backgroundColor: active ? "#5865f2" : "#2b2b2b" } }, React.createElement(Text, { style: { color: "white", fontWeight: active ? "800" : "500" } }, label));
    }
    function tile(item, index) {
      var isImage = item.type === "image";
      return React.createElement(View, { key: item.url + index, style: { width: "33.333%", padding: 4 } },
        React.createElement(Pressable, { onPress: function () { openNativeMedia(item).catch(function (e) { var error = e && e.message ? e.message : String(e); setMessage(error); toast(error); }); }, onLongPress: function () { copyUrl(item.url); }, style: { backgroundColor: "#222", borderRadius: 8, overflow: "hidden", minHeight: 112 } },
          isImage && Image ? React.createElement(Image, { source: { uri: item.proxyUrl || item.url }, resizeMode: "cover", style: { width: "100%", height: 112, backgroundColor: "#111" } }) : React.createElement(View, { style: { height: 112, alignItems: "center", justifyContent: "center", backgroundColor: "#181818" } }, React.createElement(Text, { style: { color: "white", fontWeight: "900" } }, item.type.toUpperCase()), React.createElement(Text, { numberOfLines: 1, style: { color: "#aaa", marginTop: 6, paddingHorizontal: 6, fontSize: 11 } }, item.name))
        )
      );
    }
    return React.createElement(ScrollView, { style: { padding: 16 } },
      React.createElement(Text, { style: { color: "white", fontSize: 24, fontWeight: "900" } }, "Channel Media Gallery"),
      React.createElement(Text, { style: { color: "#aaa", marginTop: 8 } }, "Saved gallery stays here until you run it again. Tap media for an in-app preview. Long-press copies URL."),
      React.createElement(Text, { style: { color: "#777", marginTop: 10 } }, "Saved: " + storage.savedMedia.length + " | Showing: " + items.length + " | Channel: " + (storage.savedChannelId || storage.lastChannelId || "none")),
      React.createElement(View, { style: { flexDirection: "row", marginTop: 16 } }, numberBox("Max media", "maxMedia"), numberBox("Messages scanned", "fetchLimit")),
      React.createElement(View, { style: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 } }, filterButton("All", "all"), filterButton("Pics", "image"), filterButton("Videos", "video"), filterButton("Embeds", "embed")),
      React.createElement(Pressable, { disabled: loading, onPress: runLoad, style: { marginTop: 16, padding: 13, borderRadius: 8, backgroundColor: loading ? "#444" : "#5865f2", alignItems: "center" } }, React.createElement(Text, { style: { color: "white", fontWeight: "800" } }, loading ? "Scanning..." : "Run Current Channel Media Scan")),
      loading && ActivityIndicator ? React.createElement(ActivityIndicator, { style: { marginTop: 14 } }) : null,
      React.createElement(Text, { style: { color: message.indexOf("Saved") === 0 || message.indexOf("Showing") === 0 ? "#6fdc8c" : "#ffb86b", marginTop: 12 } }, message),
      React.createElement(Text, { style: { color: "#777", marginTop: 6, fontSize: 12 } }, "HTTP: " + (status.http ? "OK" : "not used") + " | Cache: " + (status.cache ? "OK" : "not used")),
      React.createElement(View, { style: { flexDirection: "row", flexWrap: "wrap", marginTop: 12, marginHorizontal: -4, paddingBottom: 30 } }, items.map(tile))
    );
  }

  function onLoad() { rememberCurrentChannel(); if (timer) clearInterval(timer); timer = setInterval(rememberCurrentChannel, 1500); toast("Channel Media Gallery loaded"); }
  function onUnload() { if (timer) clearInterval(timer); timer = null; toast("Channel Media Gallery unloaded"); }
  return { onLoad: onLoad, onUnload: onUnload, start: onLoad, stop: onUnload, settings: Settings };
})()
