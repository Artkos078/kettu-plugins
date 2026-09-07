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
  if (storage.selectedChannelId == null) storage.selectedChannelId = null;
  if (storage.nsfwChannelsOnly == null) storage.nsfwChannelsOnly = false;
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

  function readChannelName(channel) {
    if (!channel) return "";
    return String(channel.name || channel.rawName || channel.topic || channel.id || "");
  }

  function isTextChannel(channel) {
    if (!channel || !channel.id) return false;
    var type = channel.type;
    if (type == null) return true;
    return type === 0 || type === 1 || type === 3 || type === 5 || type === 10 || type === 11 || type === 12 || type === "DM" || type === "GROUP_DM" || type === "GUILD_TEXT" || type === "GUILD_ANNOUNCEMENT" || type === "PUBLIC_THREAD" || type === "PRIVATE_THREAD" || type === "ANNOUNCEMENT_THREAD";
  }

  function getChannel(channelId) {
    if (!channelId) return null;
    var ChannelStore = findByProps("getChannel", "getDMFromUserId") || findByProps("getChannel");
    try { if (ChannelStore && typeof ChannelStore.getChannel === "function") return ChannelStore.getChannel(String(channelId)); } catch (e) {}
    return null;
  }

  function isNsfwChannel(channel) {
    if (!channel) return false;
    if (channel.nsfw === true) return true;
    try { if (typeof channel.isNSFW === "function" && channel.isNSFW()) return true; } catch (e) {}
    var type = channel.type;
    if (type === 10 || type === 11 || type === 12 || type === "PUBLIC_THREAD" || type === "PRIVATE_THREAD" || type === "ANNOUNCEMENT_THREAD") {
      var parent = getChannel(channel.parent_id || channel.parentId);
      if (parent && parent.nsfw === true) return true;
      try { if (parent && typeof parent.isNSFW === "function") return !!parent.isNSFW(); } catch (e2) {}
    }
    return false;
  }

  function channelHasLoadedMessages(channelId) {
    if (!channelId) return false;
    var MessageStore = findByProps("getMessages", "getMessage") || findByProps("getMessages");
    if (!MessageStore || typeof MessageStore.getMessages !== "function") return false;
    try { return asArray(MessageStore.getMessages(String(channelId))).length > 0; } catch (e) { return false; }
  }

  function isLoadedSelectableChannel(channel, source) {
    if (!isTextChannel(channel)) return false;
    var id = String(channel.id || "");
    if (!id) return false;
    if (source === "current") return true;
    if ((source === "selected" || source === "saved") && getChannel(id)) return true;
    return channelHasLoadedMessages(id);
  }

  function getChannelRows(search) {
    var rows = [];
    var seen = {};
    var query = String(search || "").trim().toLowerCase();
    function add(channel, source) {
      if (!isLoadedSelectableChannel(channel, source) || seen[channel.id]) return;
      var nsfw = isNsfwChannel(channel);
      if (storage.nsfwChannelsOnly && !nsfw) return;
      var name = readChannelName(channel);
      if (query && String(channel.id).indexOf(query) === -1 && name.toLowerCase().indexOf(query) === -1) return;
      seen[channel.id] = true;
      rows.push({
        id: String(channel.id),
        name: name || String(channel.id),
        guildId: String(channel.guild_id || channel.guildId || ""),
        nsfw: nsfw,
        source: source || "loaded"
      });
    }
    add(getChannel(storage.selectedChannelId), "selected");
    add(getChannel(storage.savedChannelId), "saved");
    add(getChannel(storage.lastChannelId || getCurrentChannelId()), "current");
    var ChannelStore = findByProps("getChannel", "getChannels") || findByProps("getChannel", "getMutableGuildChannelsForGuild") || findByProps("getChannel");
    try {
      if (ChannelStore && typeof ChannelStore.getChannels === "function") {
        var all = ChannelStore.getChannels();
        asArray(all).forEach(function (channel) { add(channel, "loaded"); });
        if (all && typeof all === "object") Object.keys(all).forEach(function (key) {
          var value = all[key];
          if (value && value.channel) add(value.channel, "loaded");
          else add(value, "loaded");
        });
      }
    } catch (e) {}
    try {
      if (ChannelStore && typeof ChannelStore.getMutableGuildChannelsForGuild === "function") {
        var current = getChannel(storage.lastChannelId || getCurrentChannelId());
        var guildId = current && (current.guild_id || current.guildId);
        var guildChannels = guildId ? ChannelStore.getMutableGuildChannelsForGuild(guildId) : null;
        Object.keys(guildChannels || {}).forEach(function (key) {
          var value = guildChannels[key];
          var channel = value && value.channel ? value.channel : value;
          if (channelHasLoadedMessages(channel && channel.id)) add(channel, "loaded");
        });
      }
    } catch (e2) {}
    rows.sort(function (a, b) {
      if (a.id === storage.selectedChannelId) return -1;
      if (b.id === storage.selectedChannelId) return 1;
      return a.name.localeCompare(b.name);
    });
    return rows.slice(0, 80);
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
      thumbnailUrl: String(raw.thumbnailUrl || raw.thumbnail_url || (raw.thumbnail && (raw.thumbnail.proxy_url || raw.thumbnail.url)) || ""),
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
        var poster = embed.thumbnail || embed.image;
        var posterUrl = poster && (poster.proxy_url || poster.proxyURL || poster.url);
        if (embed.video) pushMedia(items, seen, message, Object.assign({}, embed.video, { content_type: "video/*", thumbnailUrl: posterUrl }), "embed");
        if (embed.url) pushMedia(items, seen, message, { url: embed.url, title: embed.title || "embed", thumbnailUrl: posterUrl }, "embed");
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

  async function loadMedia(channelId) {
    channelId = channelId || storage.selectedChannelId || rememberCurrentChannel();
    var max = Math.max(1, Math.min(500, Number(storage.maxMedia) || 200));
    var limit = Math.max(max, Math.min(800, Number(storage.fetchLimit) || 500));
    if (!channelId) throw new Error("Pick a loaded channel, or open the channel in Discord once so the plugin can see it.");
    if (storage.nsfwChannelsOnly && !isNsfwChannel(getChannel(channelId))) throw new Error("Choose an NSFW channel from the explorer, or switch to All channels.");
    var remote = await getRemoteMessages(channelId, limit);
    var cached = getCachedMessages(channelId);
    var media = collectMedia(remote.concat(cached), max);
    if (!media.length) throw new Error(remote.length || cached.length ? "No media found in scanned messages." : "No messages found. Open or scroll that channel once, then run again.");
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

  function previewUrls(item) {
    var urls = [];
    function add(url) { if (url && urls.indexOf(url) === -1) urls.push(url); }
    add(item.thumbnailUrl);
    var source = item.proxyUrl || item.url || "";
    if (item.type === "video") {
      // Request a still from Discord's media proxy, keeping signed URL parameters.
      source = source.replace(/^https:\/\/cdn\.discordapp\.com\//i, "https://media.discordapp.net/");
      if (/^https:\/\/(media\.discordapp\.net|images-ext-\d+\.discordapp\.net)\//i.test(source)) {
        var parts = source.split("#")[0].split("?");
        var params = (parts[1] || "").split("&").filter(function (p) { return p && !/^(format|width|height)=/i.test(p); });
        add(parts[0] + "?" + params.concat(["format=jpeg", "width=400", "height=300"]).join("&"));
        add(parts[0] + "?" + params.concat(["format=webp", "width=400", "height=300"]).join("&"));
      }
    } else if (item.type === "image") { add(source); add(item.url); }
    return urls;
  }

  function MediaPreview(props) {
    var item = props.item;
    var urls = previewUrls(item);
    var attemptState = React.useState(0), attempt = attemptState[0], setAttempt = attemptState[1];
    var loadedState = React.useState(false), loaded = loadedState[0], setLoaded = loadedState[1];
    var uri = urls[attempt];
    return React.createElement(RN.View, { style: { height: 112, backgroundColor: "#252530", justifyContent: "center", alignItems: "center", overflow: "hidden" } },
      !loaded ? React.createElement(RN.Text, { numberOfLines: 3, style: { color: "#bbb", padding: 8, fontSize: 11, textAlign: "center" } }, uri ? "Loading preview…" : "Preview unavailable\n" + (item.name || "Tap to open")) : null,
      uri && RN.Image ? React.createElement(RN.Image, { key: uri, source: { uri: uri }, resizeMode: "cover", onLoad: function () { setLoaded(true); }, onError: function () { setLoaded(false); setAttempt(attempt + 1); }, style: { position: "absolute", left: 0, top: 0, width: "100%", height: 112 } }) : null,
      item.type === "video" ? React.createElement(RN.Text, { style: { position: "absolute", right: 6, bottom: 6, color: "white", backgroundColor: "#0009", padding: 5, borderRadius: 6, fontSize: 18 } }, "▶") : null,
      item.origin === "embed" ? React.createElement(RN.Text, { style: { position: "absolute", left: 5, top: 5, color: "white", backgroundColor: "#0009", padding: 3, fontSize: 10 } }, "EMBED") : null
    );
  }

  function Settings() {
    if (!React || !RN || !RN.View || !RN.Text) return null;
    var View = RN.View, Text = RN.Text, Image = RN.Image, Pressable = RN.Pressable || RN.TouchableOpacity, ScrollView = RN.ScrollView || RN.View, TextInput = RN.TextInput, ActivityIndicator = RN.ActivityIndicator;
    var state = React.useState(filtered(storage.savedMedia));
    var items = state[0], setItems = state[1];
    var loadingState = React.useState(false), loading = loadingState[0], setLoading = loadingState[1];
    var msgState = React.useState(storage.savedMedia.length ? "Showing saved gallery. Run again to refresh." : status.last), message = msgState[0], setMessage = msgState[1];
    var channelSearchState = React.useState(""), channelSearch = channelSearchState[0], setChannelSearch = channelSearchState[1];
    var channelsState = React.useState(getChannelRows("")), channels = channelsState[0], setChannels = channelsState[1];
    var pickerState = React.useState(false), pickerOpen = pickerState[0], setPickerOpen = pickerState[1];
    var selectedId = storage.selectedChannelId || storage.lastChannelId;
    var selectedName = readChannelName(getChannel(selectedId)) || selectedId || "Choose a channel";
    var tickState = React.useState(0), tick = tickState[0], setTick = tickState[1];
    function bump() { setTick(tick + 1); setItems(filtered(storage.savedMedia)); setChannels(getChannelRows(channelSearch)); }
    function chooseChannel(id) { storage.selectedChannelId = String(id); storage.lastChannelId = String(id); setPickerOpen(false); bump(); setMessage("Selected channel: " + String(id)); }
    async function runLoad() {
      setLoading(true); setMessage("Scanning channel media...");
      try { var result = await loadMedia(storage.selectedChannelId); setItems(filtered(result.media)); setMessage("Saved " + result.media.length + " media from " + result.source + ". Channel: " + result.channelId); }
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
    function channelFilterButton(label, nsfwOnly) {
      var active = storage.nsfwChannelsOnly === nsfwOnly;
      return React.createElement(Pressable, { accessibilityRole: "button", accessibilityState: { selected: active }, onPress: function () { storage.nsfwChannelsOnly = nsfwOnly; bump(); }, style: { paddingVertical: 9, paddingHorizontal: 11, marginRight: 6, marginTop: 8, borderRadius: 8, backgroundColor: active ? "#5865f2" : "#2b2b2b" } }, React.createElement(Text, { style: { color: "white", fontWeight: active ? "800" : "500" } }, label));
    }
    function channelRow(channel) {
      var active = storage.selectedChannelId === channel.id || (!storage.selectedChannelId && storage.lastChannelId === channel.id);
      return React.createElement(Pressable, { key: channel.id, onPress: function () { chooseChannel(channel.id); }, style: { paddingVertical: 10, paddingHorizontal: 12, marginTop: 6, borderRadius: 8, borderWidth: 1, borderColor: active ? "#5865f2" : "#333", backgroundColor: active ? "#263168" : "#202020" } },
        React.createElement(Text, { numberOfLines: 1, style: { color: "white", fontWeight: active ? "900" : "700" } }, (channel.guildId ? "#" : "") + channel.name),
        React.createElement(Text, { numberOfLines: 1, style: { color: "#999", marginTop: 3, fontSize: 11 } }, (channel.nsfw ? "NSFW | " : "") + channel.source + " | " + channel.id)
      );
    }
    function tile(item, index) {
      return React.createElement(View, { key: item.url + index, style: { width: "33.333%", padding: 4 } },
        React.createElement(Pressable, { onPress: function () { openNativeMedia(item).catch(function (e) { var error = e && e.message ? e.message : String(e); setMessage(error); toast(error); }); }, onLongPress: function () { copyUrl(item.url); }, style: { backgroundColor: "#222", borderRadius: 8, overflow: "hidden", minHeight: 112 } },
          React.createElement(MediaPreview, { key: previewUrls(item).join("|"), item: item })
        )
      );
    }
    return React.createElement(ScrollView, { style: { padding: 16 } },
      React.createElement(Text, { style: { color: "white", fontSize: 24, fontWeight: "900" } }, "Channel Media Gallery"),
      React.createElement(Text, { style: { color: "#aaa", marginTop: 8 } }, "Pick a channel Discord has loaded, scan it, then tap media for Discord's normal viewer. Long-press copies URL."),
      React.createElement(Text, { style: { color: "#777", marginTop: 10 } }, "Saved: " + storage.savedMedia.length + " | Showing: " + items.length + " | Selected: " + (storage.selectedChannelId || storage.savedChannelId || storage.lastChannelId || "none")),
      React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: "Choose channel", accessibilityState: { expanded: pickerOpen }, onPress: function () { setChannels(getChannelRows(channelSearch)); setPickerOpen(!pickerOpen); }, style: { marginTop: 14, padding: 12, borderWidth: 1, borderColor: "#555", borderRadius: 8, backgroundColor: "#202020" } }, React.createElement(Text, { numberOfLines: 1, style: { color: "white", fontWeight: "700" } }, (pickerOpen ? "▴ " : "▾ ") + selectedName + (storage.nsfwChannelsOnly ? " · NSFW only" : ""))),
      pickerOpen ? React.createElement(View, { style: { padding: 8, borderWidth: 1, borderColor: "#444", borderRadius: 8, marginTop: 4 } },
      React.createElement(View, { style: { flexDirection: "row", flexWrap: "wrap" } }, channelFilterButton("All channels", false), channelFilterButton("NSFW channels only", true)),
      storage.nsfwChannelsOnly && !channels.length ? React.createElement(Text, { style: { color: "#aaa", marginTop: 8 } }, "No loaded NSFW channels match. Open or scroll an NSFW channel once, then come back and refresh this dropdown.") : null,
      TextInput ? React.createElement(TextInput, { placeholder: "Search loaded channels", placeholderTextColor: "#777", value: channelSearch, onChangeText: function (value) { setChannelSearch(value); setChannels(getChannelRows(value)); }, style: { color: "white", borderColor: "#444", borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 14 } }) : null,
      React.createElement(ScrollView, { nestedScrollEnabled: true, keyboardShouldPersistTaps: "handled", style: { maxHeight: 280, marginTop: 2 } },
        channels.map(channelRow),
        channelSearch && !channels.length ? React.createElement(Text, { style: { color: "#aaa", marginTop: 10, lineHeight: 18 } }, "No loaded channels match. To load one, open that channel in Discord or scroll it once, then return here and reopen the dropdown.") : null
      ),
      ) : null,
      React.createElement(View, { style: { flexDirection: "row", marginTop: 16 } }, numberBox("Max media", "maxMedia"), numberBox("Messages scanned", "fetchLimit")),
      React.createElement(View, { style: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 } }, filterButton("All", "all"), filterButton("Pics", "image"), filterButton("Videos", "video"), filterButton("Embeds", "embed")),
      React.createElement(Pressable, { disabled: loading, onPress: runLoad, style: { marginTop: 16, padding: 13, borderRadius: 8, backgroundColor: loading ? "#444" : "#5865f2", alignItems: "center" } }, React.createElement(Text, { style: { color: "white", fontWeight: "800" } }, loading ? "Scanning..." : "Run Selected Channel Media Scan")),
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
