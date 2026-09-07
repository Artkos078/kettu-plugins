(function () {
  "use strict";

  var V = (typeof vendetta !== "undefined" && vendetta) || globalThis.vendetta || {};
  var metro = V.metro || {};
  var common = metro.common || {};
  var React = common.React;
  var RN = common.ReactNative;
  var ui = V.ui || {};
  var toastApi = (ui && ui.toasts) || {};
  var storage = (V.plugin && V.plugin.storage) || {};
  var timer = null;

  if (storage.maxMedia == null) storage.maxMedia = 30;
  if (storage.fetchLimit == null) storage.fetchLimit = 80;
  if (storage.lastChannelId == null) storage.lastChannelId = null;

  var status = {
    http: false,
    cache: false,
    last: "Not loaded"
  };

  function toast(message) {
    status.last = String(message);
    try {
      if (toastApi.showToast) toastApi.showToast(String(message));
    } catch (e) {}
    try {
      console.log("[Channel Media Gallery]", message);
    } catch (e) {}
  }

  function findByProps() {
    try {
      if (typeof metro.findByProps === "function") {
        return metro.findByProps.apply(metro, arguments);
      }
    } catch (e) {}

    try {
      if (typeof V.findByProps === "function") {
        return V.findByProps.apply(V, arguments);
      }
    } catch (e) {}

    return null;
  }

  function asArray(collection) {
    var out = [];
    if (!collection) return out;

    if (Array.isArray(collection)) return collection.slice();

    try {
      if (Array.isArray(collection._array)) return collection._array.slice();
    } catch (e) {}

    try {
      if (typeof collection.toArray === "function") return collection.toArray();
    } catch (e) {}

    try {
      if (typeof collection.valueSeq === "function") return collection.valueSeq().toArray();
    } catch (e) {}

    try {
      if (typeof collection.forEach === "function") {
        collection.forEach(function (value) {
          if (value) out.push(value);
        });
        if (out.length) return out;
      }
    } catch (e) {}

    try {
      Object.keys(collection).forEach(function (key) {
        var value = collection[key];
        if (value && typeof value === "object" && value.id) out.push(value);
      });
    } catch (e) {}

    return out;
  }

  function compareMessageIds(a, b) {
    a = String((a && a.id) || "0");
    b = String((b && b.id) || "0");
    if (a.length !== b.length) return b.length - a.length;
    return b > a ? 1 : b < a ? -1 : 0;
  }

  function getCurrentChannelId() {
    var candidates = [
      ["getChannelId"],
      ["getLastSelectedChannelId"],
      ["getCurrentlySelectedChannelId"],
      ["getChannelId", "getVoiceChannelId"]
    ];

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

  function isMediaUrl(url) {
    return /\.(png|jpe?g|gif|webp|bmp|heic|heif|mp4|mov|webm|m4v)(\?|#|$)/i.test(String(url || ""));
  }

  function mediaTypeFrom(value) {
    value = String(value || "").toLowerCase();
    if (value.indexOf("image/") === 0 || /\.(png|jpe?g|gif|webp|bmp|heic|heif)(\?|#|$)/i.test(value)) return "image";
    if (value.indexOf("video/") === 0 || /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(value)) return "video";
    return "file";
  }

  function pushMedia(items, seen, message, raw) {
    if (!raw) return;
    var url = raw.url || raw.proxy_url || raw.proxyURL;
    if (!url || seen[url]) return;

    var name = raw.filename || raw.name || raw.title || "media";
    var contentType = raw.content_type || raw.contentType || raw.type || name || url;
    var type = mediaTypeFrom(contentType || url);
    if (type === "file" && !isMediaUrl(url)) return;

    seen[url] = true;
    items.push({
      url: String(url),
      proxyUrl: String(raw.proxy_url || raw.proxyURL || url),
      type: type,
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

      asArray(message.attachments).forEach(function (attachment) {
        if (items.length < max) pushMedia(items, seen, message, attachment);
      });

      asArray(message.embeds).forEach(function (embed) {
        if (items.length >= max || !embed) return;
        pushMedia(items, seen, message, embed.image);
        pushMedia(items, seen, message, embed.thumbnail);
        pushMedia(items, seen, message, embed.video);
        if (embed.url && isMediaUrl(embed.url)) {
          pushMedia(items, seen, message, { url: embed.url, title: embed.title || "embed media" });
        }
      });
    });
    return items;
  }

  function getCachedMessages(channelId) {
    var MessageStore = findByProps("getMessages", "getMessage") || findByProps("getMessages");
    if (!MessageStore || typeof MessageStore.getMessages !== "function") return [];

    try {
      var messages = asArray(MessageStore.getMessages(channelId));
      if (messages.length) status.cache = true;
      return messages;
    } catch (e) {
      return [];
    }
  }

  async function getRemoteMessages(channelId, limit) {
    var HTTP = findByProps("get", "post", "put", "del") || findByProps("get", "post", "patch", "del");
    if (!HTTP || typeof HTTP.get !== "function") return [];

    var paths = [
      "/channels/" + channelId + "/messages",
      "/api/v9/channels/" + channelId + "/messages"
    ];

    for (var i = 0; i < paths.length; i++) {
      try {
        var response = await HTTP.get({ url: paths[i], query: { limit: limit } });
        var body = response && (response.body || response.text || response.data || response);
        var messages = asArray(body && body.messages ? body.messages : body);
        if (messages.length) {
          status.http = true;
          return messages;
        }
      } catch (e) {}

      try {
        var response2 = await HTTP.get({ url: paths[i] + "?limit=" + encodeURIComponent(limit) });
        var body2 = response2 && (response2.body || response2.text || response2.data || response2);
        var messages2 = asArray(body2 && body2.messages ? body2.messages : body2);
        if (messages2.length) {
          status.http = true;
          return messages2;
        }
      } catch (e2) {}
    }

    return [];
  }

  async function loadMedia() {
    var channelId = rememberCurrentChannel();
    var max = Math.max(1, Math.min(60, Number(storage.maxMedia) || 30));
    var limit = Math.max(max, Math.min(100, Number(storage.fetchLimit) || 80));

    if (!channelId) throw new Error("Open a channel first, then open this plugin settings page.");

    var remote = await getRemoteMessages(channelId, limit);
    var cached = getCachedMessages(channelId);
    var combined = remote.concat(cached);
    var media = collectMedia(combined, max);

    if (!media.length) {
      throw new Error(remote.length || cached.length ? "No recent media found in this channel." : "No messages found. Scroll the channel a bit, then reload.");
    }

    return { channelId: channelId, media: media, source: remote.length ? "recent history" : "loaded cache" };
  }

  function openUrl(url) {
    try {
      if (RN && RN.Linking && RN.Linking.openURL) {
        RN.Linking.openURL(url);
        return;
      }
    } catch (e) {}
    toast("Could not open URL");
  }

  function copyUrl(url) {
    try {
      if (RN && RN.Clipboard && RN.Clipboard.setString) {
        RN.Clipboard.setString(url);
        toast("Media URL copied");
        return;
      }
    } catch (e) {}
    toast("Clipboard unavailable");
  }

  function Settings() {
    if (!React || !RN) return null;

    var View = RN.View;
    var Text = RN.Text;
    var Image = RN.Image;
    var Pressable = RN.Pressable || RN.TouchableOpacity;
    var ScrollView = RN.ScrollView || RN.View;
    var TextInput = RN.TextInput;
    var ActivityIndicator = RN.ActivityIndicator;

    var state = React.useState([]);
    var items = state[0];
    var setItems = state[1];
    var loadingState = React.useState(false);
    var loading = loadingState[0];
    var setLoading = loadingState[1];
    var msgState = React.useState(status.last);
    var message = msgState[0];
    var setMessage = msgState[1];
    var tickState = React.useState(0);
    var tick = tickState[0];
    var setTick = tickState[1];

    function bump() {
      setTick(tick + 1);
    }

    async function runLoad() {
      setLoading(true);
      setMessage("Loading media...");
      try {
        var result = await loadMedia();
        setItems(result.media);
        setMessage("Loaded " + result.media.length + " media from " + result.source + ". Channel: " + result.channelId);
      } catch (e) {
        setItems([]);
        setMessage(e && e.message ? e.message : String(e));
      }
      setLoading(false);
    }

    function numberBox(label, key) {
      return React.createElement(View, { style: { flex: 1, marginRight: 8 } },
        React.createElement(Text, { style: { color: "#bbb", marginBottom: 6, fontSize: 12 } }, label),
        React.createElement(TextInput, {
          keyboardType: "number-pad",
          value: String(storage[key]),
          onChangeText: function (value) {
            var next = Number(value);
            if (Number.isFinite(next)) storage[key] = next;
            bump();
          },
          style: { color: "white", borderColor: "#444", borderWidth: 1, borderRadius: 8, padding: 10 }
        })
      );
    }

    function tile(item, index) {
      var isImage = item.type === "image";
      return React.createElement(View, { key: item.url + index, style: { width: "33.333%", padding: 4 } },
        React.createElement(Pressable, {
          onPress: function () { openUrl(item.url); },
          onLongPress: function () { copyUrl(item.url); },
          style: { backgroundColor: "#222", borderRadius: 8, overflow: "hidden", minHeight: 112 }
        },
          isImage
            ? React.createElement(Image, { source: { uri: item.proxyUrl || item.url }, resizeMode: "cover", style: { width: "100%", height: 112, backgroundColor: "#111" } })
            : React.createElement(View, { style: { height: 112, alignItems: "center", justifyContent: "center", backgroundColor: "#181818" } },
                React.createElement(Text, { style: { color: "white", fontWeight: "900" } }, item.type.toUpperCase()),
                React.createElement(Text, { numberOfLines: 1, style: { color: "#aaa", marginTop: 6, paddingHorizontal: 6, fontSize: 11 } }, item.name)
              )
        )
      );
    }

    return React.createElement(ScrollView, { style: { padding: 16 } },
      React.createElement(Text, { style: { color: "white", fontSize: 24, fontWeight: "900" } }, "Channel Media Gallery"),
      React.createElement(Text, { style: { color: "#aaa", marginTop: 8 } }, "Loads recent images/videos from the channel you were just viewing. Tap media to open it. Long-press to copy its URL."),
      React.createElement(Text, { style: { color: "#777", marginTop: 10 } }, "Last channel: " + (storage.lastChannelId || "none yet")),
      React.createElement(View, { style: { flexDirection: "row", marginTop: 16 } },
        numberBox("Gallery count", "maxMedia"),
        numberBox("Messages scanned", "fetchLimit")
      ),
      React.createElement(Pressable, {
        disabled: loading,
        onPress: runLoad,
        style: { marginTop: 16, padding: 13, borderRadius: 8, backgroundColor: loading ? "#444" : "#5865f2", alignItems: "center" }
      }, React.createElement(Text, { style: { color: "white", fontWeight: "800" } }, loading ? "Loading..." : "Load Current Channel Media")),
      loading && ActivityIndicator ? React.createElement(ActivityIndicator, { style: { marginTop: 14 } }) : null,
      React.createElement(Text, { style: { color: message.indexOf("Loaded") === 0 ? "#6fdc8c" : "#ffb86b", marginTop: 12 } }, message),
      React.createElement(Text, { style: { color: "#777", marginTop: 6, fontSize: 12 } }, "HTTP: " + (status.http ? "OK" : "not used") + " | Cache: " + (status.cache ? "OK" : "not used")),
      React.createElement(View, { style: { flexDirection: "row", flexWrap: "wrap", marginTop: 12, marginHorizontal: -4, paddingBottom: 30 } }, items.map(tile))
    );
  }

  function onLoad() {
    rememberCurrentChannel();
    if (timer) clearInterval(timer);
    timer = setInterval(rememberCurrentChannel, 1500);
    toast("Channel Media Gallery loaded");
  }

  function onUnload() {
    if (timer) clearInterval(timer);
    timer = null;
    toast("Channel Media Gallery unloaded");
  }

  return {
    onLoad: onLoad,
    onUnload: onUnload,
    start: onLoad,
    stop: onUnload,
    settings: Settings
  };
})()
