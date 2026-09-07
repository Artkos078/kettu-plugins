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
  var RN = common.ReactNative || findByProps("View", "Text", "TextInput", "Pressable") || {};
  var ui = V.ui || {};
  var toastApi = ui.toasts || {};
  var memoryStorage = {};
  function objectLike(value) { return value && (typeof value === "object" || typeof value === "function"); }
  function getStorageRoot() {
    var root = null;
    try { if (V.plugin && objectLike(V.plugin.storage)) root = V.plugin.storage; } catch (e) {}
    try { if (!objectLike(root) && objectLike(V.storage)) root = V.storage; } catch (e2) {}
    return objectLike(root) ? root : memoryStorage;
  }
  function getPluginStorage() {
    var root = getStorageRoot();
    try {
      if (!objectLike(root.channelMediaGallery)) root.channelMediaGallery = {};
      if (objectLike(root.channelMediaGallery)) return root.channelMediaGallery;
    } catch (e) {}
    return memoryStorage;
  }
  var storage = getPluginStorage();
  var timer = null;
  var fetchedChannels = {};
  var remoteChannels = {};

  if (storage.maxMedia == null) storage.maxMedia = 200;
  if (storage.fetchLimit == null) storage.fetchLimit = 500;
  if (storage.filterMode == null) storage.filterMode = "all";
  if (storage.lastChannelId == null) storage.lastChannelId = null;
  if (storage.selectedChannelId == null) storage.selectedChannelId = null;
  if (storage.selectedGuildId == null) storage.selectedGuildId = null;
  if (storage.forceLoadChannels == null) storage.forceLoadChannels = false;
  if (!Array.isArray(storage.savedMedia)) storage.savedMedia = [];

  var status = { http: false, cache: !!storage.savedAt, last: "Not loaded" };

  function toast(message) {
    status.last = String(message);
    try { if (toastApi.showToast) toastApi.showToast(String(message)); else if (ui.showToast) ui.showToast(String(message)); } catch (e) {}
    try { console.log("[Channel Media Gallery]", message); } catch (e) {}
  }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
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
    if (remoteChannels[String(channelId)]) return remoteChannels[String(channelId)];
    var ChannelStore = findByProps("getChannel", "getDMFromUserId") || findByProps("getChannel");
    try { if (ChannelStore && typeof ChannelStore.getChannel === "function") return ChannelStore.getChannel(String(channelId)); } catch (e) {}
    return null;
  }

  function getChannelStore() {
    return findByProps("getChannel", "getChannels") || findByProps("getChannel", "getMutableGuildChannelsForGuild") || findByProps("getChannel");
  }

  function getGuildStore() {
    return findByProps("getGuild", "getGuilds") || findByProps("getGuilds") || findByProps("getGuild");
  }

  function readGuildName(guild) {
    if (!guild) return "";
    return String(guild.name || guild.rawName || guild.id || "");
  }

  function getCurrentGuildId() {
    var channel = getChannel(storage.selectedChannelId) || getChannel(storage.lastChannelId || getCurrentChannelId());
    return channel ? String(channel.guild_id || channel.guildId || "") : "";
  }

  function getGuild(guildId) {
    if (!guildId) return null;
    var GuildStore = getGuildStore();
    try { if (GuildStore && typeof GuildStore.getGuild === "function") return GuildStore.getGuild(String(guildId)); } catch (e) {}
    try {
      if (GuildStore && typeof GuildStore.getGuilds === "function") {
        var guilds = GuildStore.getGuilds();
        return guilds && (guilds[String(guildId)] || guilds[guildId]) || null;
      }
    } catch (e2) {}
    return null;
  }

  function selectedGuildId() {
    var saved = storage.selectedGuildId || storage.savedGuildId;
    if (saved && getGuild(saved)) return String(saved);
    var current = getCurrentGuildId();
    if (current) return current;
    return saved ? String(saved) : "";
  }

  function getGuildRows(search) {
    var rows = [];
    var seen = {};
    var query = String(search || "").trim().toLowerCase();
    function add(guild, source) {
      if (!guild || !guild.id || seen[guild.id]) return;
      var name = readGuildName(guild);
      if (query && String(guild.id).indexOf(query) === -1 && name.toLowerCase().indexOf(query) === -1) return;
      seen[guild.id] = true;
      rows.push({ id: String(guild.id), name: name || String(guild.id), source: source || "server" });
    }
    add(getGuild(storage.selectedGuildId), "selected");
    add(getGuild(storage.savedGuildId), "saved");
    add(getGuild(getCurrentGuildId()), "current");
    var GuildStore = getGuildStore();
    try {
      if (GuildStore && typeof GuildStore.getGuilds === "function") {
        var guilds = GuildStore.getGuilds();
        asArray(guilds).forEach(function (guild) { add(guild, "server"); });
        if (guilds && typeof guilds === "object") Object.keys(guilds).forEach(function (key) { add(guilds[key], "server"); });
      }
    } catch (e) {}
    rows.sort(function (a, b) {
      if (a.id === storage.selectedGuildId) return -1;
      if (b.id === storage.selectedGuildId) return 1;
      return a.name.localeCompare(b.name);
    });
    return rows.slice(0, 80);
  }

  function collectChannelObjects(value, out, seen) {
    if (!value || typeof value !== "object") return out;
    seen = seen || [];
    if (seen.indexOf(value) !== -1) return out;
    seen.push(value);
    if (value.id) { out.push(value); return out; }
    Object.keys(value).forEach(function (key) { collectChannelObjects(value[key], out, seen); });
    return out;
  }

  function getGuildChannels(guildId) {
    var out = [];
    collectChannelObjects(remoteChannels, out);
    var ChannelStore = getChannelStore();
    try {
      if (guildId && ChannelStore && typeof ChannelStore.getMutableGuildChannelsForGuild === "function") collectChannelObjects(ChannelStore.getMutableGuildChannelsForGuild(String(guildId)), out);
    } catch (e) {}
    try {
      if (ChannelStore && typeof ChannelStore.getChannels === "function") {
        var all = ChannelStore.getChannels();
        collectChannelObjects(all, out);
        if (all && typeof all === "object") Object.keys(all).forEach(function (key) { collectChannelObjects(all[key], out); });
      }
    } catch (e2) {}
    if (!guildId) return out;
    return out.filter(function (channel) { return String(channel.guild_id || channel.guildId || "") === String(guildId); });
  }

  function channelHasLoadedMessages(channelId) {
    if (!channelId) return false;
    if (fetchedChannels[String(channelId)]) return true;
    var MessageStore = findByProps("getMessages", "getMessage") || findByProps("getMessages");
    if (!MessageStore || typeof MessageStore.getMessages !== "function") return false;
    try { return asArray(MessageStore.getMessages(String(channelId))).length > 0; } catch (e) { return false; }
  }

  function isLoadedSelectableChannel(channel, source) {
    if (!isTextChannel(channel)) return false;
    var id = String(channel.id || "");
    if (!id) return false;
    if (storage.forceLoadChannels) return true;
    if (source === "current") return true;
    if ((source === "selected" || source === "saved") && getChannel(id)) return true;
    return channelHasLoadedMessages(id);
  }

  function getChannelRows(search) {
    var rows = [];
    var seen = {};
    var query = String(search || "").trim().toLowerCase();
    var forcedGuildId = storage.forceLoadChannels ? selectedGuildId() : "";
    function add(channel, source) {
      if (!isLoadedSelectableChannel(channel, source) || seen[channel.id]) return;
      var guildId = String(channel.guild_id || channel.guildId || "");
      if (forcedGuildId && guildId && guildId !== forcedGuildId) return;
      var name = readChannelName(channel);
      if (query && String(channel.id).indexOf(query) === -1 && name.toLowerCase().indexOf(query) === -1) return;
      seen[channel.id] = true;
      rows.push({
        id: String(channel.id),
        name: name || String(channel.id),
        guildId: guildId,
        guildName: readGuildName(getGuild(guildId)),
        source: channelHasLoadedMessages(channel.id) ? "loaded" : "fetch on scan"
      });
    }
    add(getChannel(storage.selectedChannelId), "selected");
    add(getChannel(storage.savedChannelId), "saved");
    add(getChannel(storage.lastChannelId || getCurrentChannelId()), "current");
    var guildId = forcedGuildId || getCurrentGuildId();
    getGuildChannels(guildId).forEach(function (channel) { add(channel, "loaded"); });
    if (!storage.forceLoadChannels && !guildId) getGuildChannels("").forEach(function (channel) { add(channel, "loaded"); });
    rows.sort(function (a, b) {
      if (a.id === storage.selectedChannelId) return -1;
      if (b.id === storage.selectedChannelId) return 1;
      return a.name.localeCompare(b.name);
    });
    return rows.slice(0, 100);
  }

  function isMediaUrl(url) { return /\.(png|jpe?g|gif|webp|bmp|heic|heif|mp4|mov|webm|m4v)(\?|#|$)/i.test(String(url || "")); }
  function mediaTypeFrom(value) {
    value = String(value || "").toLowerCase();
    if (value.indexOf("image/") === 0 || /\.(png|jpe?g|gif|webp|bmp|heic|heif)(\?|#|$)/i.test(value)) return "image";
    if (value.indexOf("video/") === 0 || /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(value)) return "video";
    return "embed";
  }

  function isGif(item) {
    return !!item.isGif || /(?:image\/gif|\.gif(?:\?|#|$))/i.test(String(item.url || "") + " " + String(item.name || ""));
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
      isGif: raw.isGif === true || /image\/gif/i.test(contentType) || /\.gif(\?|#|$)/i.test(url) || /\.gif$/i.test(name),
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
        if (embed.video) pushMedia(items, seen, message, Object.assign({}, embed.video, { content_type: "video/*", thumbnailUrl: posterUrl, isGif: embed.type === "gifv" }), "embed");
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

  function getHTTP() {
    var candidates = [common.API, common.HTTP, findByProps("get", "post", "put", "del"), findByProps("get", "post", "patch", "del"), findByProps("HTTP")];
    for (var i = 0; i < candidates.length; i++) {
      var api = candidates[i];
      if (api && api.HTTP) api = api.HTTP;
      if (api && typeof api.get === "function") return api;
    }
    throw new Error("Discord HTTP API unavailable on this build. Saved gallery kept.");
  }

  async function requestList(url, query) {
    try {
      var response = await getHTTP().get({ url: url, query: query || {} });
      var body = response && (response.body != null ? response.body : response.data != null ? response.data : response.text != null ? response.text : response);
      if (typeof body === "string") body = JSON.parse(body);
      if (response && (response.status >= 400 || response.ok === false)) throw new Error("HTTP " + response.status + ": " + (body && body.message || "Request rejected"));
      var list = Array.isArray(body) ? body : body && (body.messages || body.channels);
      if (!Array.isArray(list)) throw new Error(body && body.message || "Unexpected Discord response");
      status.http = true;
      return list;
    } catch (e) {
      throw new Error("Could not fetch " + url + ": " + (e && e.message || String(e)) + ". Saved gallery kept.");
    }
  }

  async function forceLoadGuild(guildId) {
    if (!guildId) throw new Error("Choose a server first.");
    var channels = await requestList("/guilds/" + guildId + "/channels");
    Object.keys(remoteChannels).forEach(function (id) { if (String(remoteChannels[id].guild_id) === String(guildId)) delete remoteChannels[id]; });
    channels.forEach(function (channel) { remoteChannels[String(channel.id)] = Object.assign({}, channel, { guild_id: String(guildId) }); });
    return channels.length;
  }

  async function getRemoteMessages(channelId, totalLimit) {
    var all = [];
    var before = null;
      for (var i = 0; i < 8 && all.length < totalLimit; i++) {
        var query = { limit: Math.min(100, totalLimit - all.length) };
        if (before) query.before = before;
        var batch = await requestList("/channels/" + channelId + "/messages", query);
        if (!batch.length) break;
        all = all.concat(batch);
        before = String((batch[batch.length - 1] && batch[batch.length - 1].id) || "");
        if (!before || batch.length < 100) break;
      }
    if (all.length) status.http = true;
    return all;
  }

  function filtered(items) {
    var mode = storage.filterMode || "all";
    return asArray(items).filter(function (item) {
      if (mode === "all") return true;
      if (mode === "gif") return isGif(item);
      if (mode === "image") return item.type === "image";
      if (mode === "video") return item.type === "video";
      if (mode === "embed") return item.origin === "embed" || item.type === "embed";
      return true;
    });
  }

  async function loadMedia(channelId, force) {
    if (force && !channelId && !storage.selectedChannelId) throw new Error("Choose a channel in the selected server first.");
    channelId = channelId || storage.selectedChannelId || rememberCurrentChannel();
    var max = Math.max(1, Math.min(500, Number(storage.maxMedia) || 200));
    var limit = Math.max(max, Math.min(800, Number(storage.fetchLimit) || 500));
    if (!channelId) throw new Error("Pick a loaded channel, or open the channel in Discord once so the plugin can see it.");
    status.http = false; status.cache = !!storage.savedAt;
    var remote = await getRemoteMessages(channelId, limit);
    fetchedChannels[String(channelId)] = true;
    var media = collectMedia(remote, max);
    storage.savedMedia = media;
    storage.savedChannelId = channelId;
    var savedChannel = getChannel(channelId);
    if (savedChannel && (savedChannel.guild_id || savedChannel.guildId)) storage.savedGuildId = String(savedChannel.guild_id || savedChannel.guildId);
    storage.savedAt = new Date().toISOString();
    status.cache = true;
    return { channelId: channelId, media: media, source: "fresh history" };
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
    if (isGif(item) && item.type === "image") add(item.url);
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
      isGif(item) ? React.createElement(RN.Text, { style: { position: "absolute", right: 5, top: 5, color: "white", backgroundColor: "#0009", padding: 3, fontSize: 10 } }, "GIF") : null,
      item.origin === "embed" ? React.createElement(RN.Text, { style: { position: "absolute", left: 5, top: 5, color: "white", backgroundColor: "#0009", padding: 3, fontSize: 10 } }, "EMBED") : null
    );
  }

  function Settings() {
    if (!React || !RN || !RN.View || !RN.Text) return null;
    var View = RN.View, Text = RN.Text, Image = RN.Image, Pressable = RN.Pressable || RN.TouchableOpacity, ScrollView = RN.ScrollView || RN.View, TextInput = RN.TextInput, ActivityIndicator = RN.ActivityIndicator;
    var state = React.useState(filtered(storage.savedMedia));
    var items = state[0], setItems = state[1];
    var hiddenState = React.useState(false), hidden = hiddenState[0], setHidden = hiddenState[1];
    var loadingState = React.useState(false), loading = loadingState[0], setLoading = loadingState[1];
    var msgState = React.useState(storage.savedMedia.length ? "Showing saved gallery. Run again to refresh." : status.last), message = msgState[0], setMessage = msgState[1];
    var guildSearchState = React.useState(""), guildSearch = guildSearchState[0], setGuildSearch = guildSearchState[1];
    var guildsState = React.useState(getGuildRows("")), guilds = guildsState[0], setGuilds = guildsState[1];
    var guildPickerState = React.useState(false), guildPickerOpen = guildPickerState[0], setGuildPickerOpen = guildPickerState[1];
    var channelSearchState = React.useState(""), channelSearch = channelSearchState[0], setChannelSearch = channelSearchState[1];
    var channelsState = React.useState(getChannelRows("")), channels = channelsState[0], setChannels = channelsState[1];
    var pickerState = React.useState(false), pickerOpen = pickerState[0], setPickerOpen = pickerState[1];
    var selectedGuild = selectedGuildId();
    var selectedGuildName = readGuildName(getGuild(selectedGuild)) || selectedGuild || "Choose a server";
    var selectedId = storage.selectedChannelId || (storage.forceLoadChannels ? null : storage.lastChannelId);
    var selectedChannel = getChannel(selectedId);
    var selectedName = readChannelName(selectedChannel) || selectedId || "Choose a channel";
    var tickState = React.useState(0), tick = tickState[0], setTick = tickState[1];
    function bump() { setTick(tick + 1); setItems(hidden ? [] : filtered(storage.savedMedia)); setGuilds(getGuildRows(guildSearch)); setChannels(getChannelRows(channelSearch)); }
    async function refreshGuild() {
      setLoading(true);
      try { var count = await forceLoadGuild(selectedGuildId()); setChannels(getChannelRows(channelSearch)); setPickerOpen(true); setMessage("Loaded " + count + " channels from server."); }
      catch (e) { setMessage(e.message || String(e)); }
      setLoading(false);
    }
    function chooseGuild(id) { storage.selectedGuildId = String(id); storage.selectedChannelId = null; setGuildPickerOpen(false); setChannelSearch(""); setChannels(getChannelRows("")); bump(); setMessage("Selected server: " + (readGuildName(getGuild(id)) || String(id))); }
    function chooseChannel(id) { storage.selectedChannelId = String(id); storage.lastChannelId = String(id); var channel = getChannel(id); if (channel && (channel.guild_id || channel.guildId)) storage.selectedGuildId = String(channel.guild_id || channel.guildId); setPickerOpen(false); bump(); setMessage("Selected channel: " + String(id)); }
    async function runLoad() {
      setLoading(true); setMessage("Scanning channel media...");
      try {
        var result = await loadMedia(storage.selectedChannelId, storage.forceLoadChannels);
        setHidden(false);
        setGuilds(getGuildRows(guildSearch)); setChannels(getChannelRows(channelSearch)); setItems(filtered(result.media)); setMessage("Saved " + result.media.length + " media to cache from " + result.source + ". Channel: " + result.channelId);
      }
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
    function guildRow(guild) {
      var active = storage.selectedGuildId === guild.id || (!storage.selectedGuildId && selectedGuildId() === guild.id);
      return React.createElement(Pressable, { key: guild.id, onPress: function () { chooseGuild(guild.id); }, style: { paddingVertical: 10, paddingHorizontal: 12, marginTop: 6, borderRadius: 8, borderWidth: 1, borderColor: active ? "#5865f2" : "#333", backgroundColor: active ? "#263168" : "#202020" } },
        React.createElement(Text, { numberOfLines: 1, style: { color: "white", fontWeight: active ? "900" : "700" } }, guild.name),
        React.createElement(Text, { numberOfLines: 1, style: { color: "#999", marginTop: 3, fontSize: 11 } }, guild.source + " | " + guild.id)
      );
    }
    function channelRow(channel) {
      var active = storage.selectedChannelId === channel.id || (!storage.selectedChannelId && storage.lastChannelId === channel.id);
      return React.createElement(Pressable, { key: channel.id, onPress: function () { chooseChannel(channel.id); }, style: { paddingVertical: 10, paddingHorizontal: 12, marginTop: 6, borderRadius: 8, borderWidth: 1, borderColor: active ? "#5865f2" : "#333", backgroundColor: active ? "#263168" : "#202020" } },
        React.createElement(Text, { numberOfLines: 1, style: { color: "white", fontWeight: active ? "900" : "700" } }, "#" + channel.name),
        React.createElement(Text, { numberOfLines: 1, style: { color: "#999", marginTop: 3, fontSize: 11 } }, channel.source + (channel.guildName ? " | " + channel.guildName : "") + " | " + channel.id)
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
      React.createElement(Text, { style: { color: "white", fontSize: 24, fontWeight: "900" } }, "Channel Media Gallery 1.1.28"),
      React.createElement(Pressable, { accessibilityRole: "button", onPress: function () { setMessage("Hi!"); toast("Hi!"); }, style: { padding: 12, marginTop: 10, backgroundColor: "#323238", borderRadius: 8 } }, React.createElement(Text, { style: { color: "white" } }, "Hi")),
      storage.forceLoadChannels ? React.createElement(Pressable, { disabled: loading, onPress: refreshGuild, style: { padding: 12, marginTop: 12, backgroundColor: "#323238", borderRadius: 8 } }, React.createElement(Text, { style: { color: "white" } }, "Force Load Server Channels")) : null,
      React.createElement(Text, { style: { color: "#aaa", marginTop: 8 } }, "Pick a loaded channel, or enable Force load to pick a server and fetch one channel without opening it. Saved media stays cached until a successful run replaces it."),
      React.createElement(Text, { style: { color: "#777", marginTop: 10 } }, "Saved: " + storage.savedMedia.length + " | Showing: " + items.length + " | Server: " + (storage.selectedGuildId || storage.savedGuildId || getCurrentGuildId() || "none") + " | Channel: " + (storage.selectedChannelId || storage.savedChannelId || storage.lastChannelId || "none")),
      storage.forceLoadChannels ? React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: "Choose server", accessibilityState: { expanded: guildPickerOpen }, onPress: function () { setGuilds(getGuildRows(guildSearch)); setGuildPickerOpen(!guildPickerOpen); }, style: { marginTop: 14, padding: 12, borderWidth: 1, borderColor: "#555", borderRadius: 8, backgroundColor: "#202020" } }, React.createElement(Text, { numberOfLines: 1, style: { color: "white", fontWeight: "700" } }, (guildPickerOpen ? "▴ Server: " : "▾ Server: ") + selectedGuildName)) : null,
      storage.forceLoadChannels && guildPickerOpen ? React.createElement(View, { style: { padding: 8, borderWidth: 1, borderColor: "#444", borderRadius: 8, marginTop: 4 } },
        TextInput ? React.createElement(TextInput, { placeholder: "Search servers", placeholderTextColor: "#777", value: guildSearch, onChangeText: function (value) { setGuildSearch(value); setGuilds(getGuildRows(value)); }, style: { color: "white", borderColor: "#444", borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 6 } }) : null,
        React.createElement(ScrollView, { nestedScrollEnabled: true, keyboardShouldPersistTaps: "handled", style: { maxHeight: 220, marginTop: 2 } },
          guilds.map(guildRow),
          !guilds.length ? React.createElement(Text, { style: { color: "#aaa", marginTop: 10, lineHeight: 18 } }, "No servers found. Open any channel in the server once so Discord adds the server to local state, then Force Load can scan its channels.") : null
        )
      ) : null,
      React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: "Choose channel", accessibilityState: { expanded: pickerOpen }, onPress: function () { setChannels(getChannelRows(channelSearch)); setPickerOpen(!pickerOpen); }, style: { marginTop: 14, padding: 12, borderWidth: 1, borderColor: "#555", borderRadius: 8, backgroundColor: "#202020" } }, React.createElement(Text, { numberOfLines: 1, style: { color: "white", fontWeight: "700" } }, (pickerOpen ? "▴ Channel: " : "▾ Channel: ") + selectedName)),
      pickerOpen ? React.createElement(View, { style: { padding: 8, borderWidth: 1, borderColor: "#444", borderRadius: 8, marginTop: 4 } },
      React.createElement(Pressable, { accessibilityRole: "switch", accessibilityState: { checked: storage.forceLoadChannels }, onPress: function () { storage.forceLoadChannels = !storage.forceLoadChannels; bump(); }, style: { padding: 10, marginTop: 8, borderRadius: 8, backgroundColor: storage.forceLoadChannels ? "#5865f2" : "#2b2b2b" } }, React.createElement(Text, { style: { color: "white" } }, "Force load channels: " + (storage.forceLoadChannels ? "ON" : "OFF"))),
      React.createElement(Text, { style: { color: "#aaa", marginTop: 6 } }, storage.forceLoadChannels ? "Choose a server, choose a channel, then run the scan to fetch and save media to cache." : "Only loaded channels are listed. Enable Force load to choose a server and fetch another channel."),
      TextInput ? React.createElement(TextInput, { placeholder: storage.forceLoadChannels ? "Search channels in selected server" : "Search loaded channels", placeholderTextColor: "#777", value: channelSearch, onChangeText: function (value) { setChannelSearch(value); setChannels(getChannelRows(value)); }, style: { color: "white", borderColor: "#444", borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 14 } }) : null,
      React.createElement(ScrollView, { nestedScrollEnabled: true, keyboardShouldPersistTaps: "handled", style: { maxHeight: 280, marginTop: 2 } },
        channels.map(channelRow),
        !channels.length ? React.createElement(Text, { style: { color: "#aaa", marginTop: 10, lineHeight: 18 } }, storage.forceLoadChannels ? "No channels match in this server. Pick another server, clear search, or open the server once so Discord exposes its channel list." : "No channels match. Enable Force load to choose a server and include channels without loaded messages.") : null
      ),
      ) : null,
      React.createElement(View, { style: { flexDirection: "row", marginTop: 16 } }, numberBox("Max media", "maxMedia"), numberBox("Messages scanned", "fetchLimit")),
      React.createElement(View, { style: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 } }, filterButton("All", "all"), filterButton("Pics", "image"), filterButton("Videos", "video"), filterButton("GIFs", "gif"), filterButton("Embeds", "embed")),
      React.createElement(Pressable, { disabled: loading, onPress: runLoad, style: { marginTop: 16, padding: 13, borderRadius: 8, backgroundColor: loading ? "#444" : "#5865f2", alignItems: "center" } }, React.createElement(Text, { style: { color: "white", fontWeight: "800" } }, loading ? "Scanning..." : storage.forceLoadChannels ? "Force Load Selected Channel Media" : "Run Selected Channel Media Scan")),
      loading && ActivityIndicator ? React.createElement(ActivityIndicator, { style: { marginTop: 14 } }) : null,
      React.createElement(Pressable, { disabled: loading, onPress: function () { setHidden(true); setItems([]); setMessage("Pictures cleared from this window. Saved cache unchanged."); }, style: { padding: 12, marginTop: 10, backgroundColor: "#323238", borderRadius: 8 } }, React.createElement(Text, { style: { color: "white" } }, "Clear Pictures")),
      React.createElement(Text, { style: { color: message.indexOf("Saved") === 0 || message.indexOf("Showing") === 0 ? "#6fdc8c" : "#ffb86b", marginTop: 12 } }, message),
      React.createElement(Text, { style: { color: "#777", marginTop: 6, fontSize: 12 } }, "HTTP: " + (status.http ? "OK" : "not used") + " | Cache: " + (status.cache ? "OK" : "not used")),
      React.createElement(View, { style: { flexDirection: "row", flexWrap: "wrap", marginTop: 12, marginHorizontal: -4, paddingBottom: 30 } }, items.map(tile))
    );
  }

  function onLoad() {
    if (timer) clearInterval(timer);
    timer = setInterval(rememberCurrentChannel, 1500);
    toast("Channel Media Gallery loading after restart...");
    delay(5000).then(function () { rememberCurrentChannel(); toast("Channel Media Gallery loaded"); }).catch(function () { toast("Channel Media Gallery loaded"); });
  }
  function onUnload() { if (timer) clearInterval(timer); timer = null; toast("Channel Media Gallery unloaded"); }
  var plugin = { onLoad: onLoad, onUnload: onUnload, start: onLoad, stop: onUnload, settings: Settings }; return { default: plugin, __esModule: true, onLoad: onLoad, onUnload: onUnload, start: onLoad, stop: onUnload, settings: Settings, Settings: Settings, SettingsComponent: Settings, getSettingsPanel: Settings };
})()
