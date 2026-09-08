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
  if (!storageRoot.dmExporter) storageRoot.dmExporter = {};
  var storage = storageRoot.dmExporter;
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

  async function fetchAllMessages(channelId, maxMessages, onProgress) {
    var messages = [];
    var seen = {};
    var before = null;
    var page = 0;
    maxMessages = Math.max(100, Math.min(100000, Number(maxMessages) || 100000));

    while (!cancelRequested && messages.length < maxMessages) {
      var batch = await requestMessagePage(channelId, before);
      if (!batch.length) break;
      for (var i = 0; i < batch.length && messages.length < maxMessages; i++) {
        var message = batch[i];
        var id = String(message && message.id || "");
        if (id && !seen[id]) {
          seen[id] = true;
          messages.push(message);
        }
      }
      page++;
      if (onProgress) onProgress(messages.length, page);
      var oldest = batch[batch.length - 1];
      var nextBefore = String(oldest && oldest.id || "");
      if (!nextBefore || nextBefore === before || batch.length < 100) break;
      before = nextBefore;
      await wait(350);
    }

    messages.sort(function (a, b) {
      var at = Date.parse(a && a.timestamp || "") || 0;
      var bt = Date.parse(b && b.timestamp || "") || 0;
      if (at !== bt) return at - bt;
      var ai = String(a && a.id || "0"), bi = String(b && b.id || "0");
      if (ai.length !== bi.length) return ai.length - bi.length;
      return ai < bi ? -1 : ai > bi ? 1 : 0;
    });
    return messages;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeUrl(value) {
    value = String(value || "");
    return /^https?:\/\//i.test(value) ? value : "";
  }

  function attachmentLinks(message) {
    var html = [];
    asArray(message && message.attachments).forEach(function (a) {
      var url = safeUrl(a && (a.url || a.proxy_url));
      if (!url) return;
      html.push('<a class="attachment" href="' + escapeHtml(url) + '">' + escapeHtml(a.filename || a.name || "Attachment") + "</a>");
    });
    asArray(message && message.embeds).forEach(function (embed) {
      var url = safeUrl(embed && embed.url);
      if (url) html.push('<a class="attachment embed" href="' + escapeHtml(url) + '">' + escapeHtml(embed.title || "Embed") + "</a>");
    });
    return html.join("");
  }

  function messageAuthor(message) {
    return displayUser(message && message.author);
  }

  function buildHtml(channel, messages, exportedAt) {
    var title = "DM with " + channelLabel(channel);
    var rows = messages.map(function (message) {
      var time = message.timestamp ? new Date(message.timestamp).toLocaleString() : "Unknown time";
      var content = escapeHtml(message.content || "").replace(/\n/g, "<br>");
      var edited = message.edited_timestamp ? '<span class="edited">edited</span>' : "";
      var reply = message.referenced_message ? '<div class="reply">Replying to ' + escapeHtml(messageAuthor(message.referenced_message)) + ": " + escapeHtml(message.referenced_message.content || "").slice(0, 300) + "</div>" : "";
      return '<article class="message"><header><strong>' + escapeHtml(messageAuthor(message)) + '</strong><time>' + escapeHtml(time) + "</time>" + edited + '</header>' + reply + '<div class="content">' + content + "</div>" + attachmentLinks(message) + "</article>";
    }).join("\n");

    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escapeHtml(title) + '</title><style>body{margin:0;background:#111214;color:#e7e9ea;font:15px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:900px;margin:auto;padding:20px}h1{font-size:24px;margin:0 0 4px}.meta{color:#9da3ae;margin-bottom:20px}.message{padding:12px 14px;border-bottom:1px solid #2b2d31;background:#1e1f22}.message:first-of-type{border-radius:10px 10px 0 0}.message:last-child{border-radius:0 0 10px 10px}header{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}time,.edited{color:#949ba4;font-size:12px}.content{white-space:normal;overflow-wrap:anywhere;margin-top:5px}.reply{border-left:3px solid #5865f2;color:#b5bac1;padding-left:8px;margin:6px 0;font-size:13px}.attachment{display:block;color:#7da9ff;margin-top:7px;overflow-wrap:anywhere}.embed{color:#c9a7ff}@media print{body{background:white;color:black}.message{background:white;border-color:#ddd}}</style></head><body><main class="wrap"><h1>' + escapeHtml(title) + '</h1><div class="meta">Exported ' + escapeHtml(new Date(exportedAt).toLocaleString()) + " · " + messages.length + " messages · attachment files are linked, not downloaded</div>" + rows + "</main></body></html>";
  }

  function buildJson(channel, messages, exportedAt) {
    return JSON.stringify({
      exportVersion: 1,
      exportedAt: exportedAt,
      channel: {
        id: String(channel.id || ""),
        name: channelLabel(channel),
        type: channel.type,
        recipients: asArray(channel.rawRecipients || channel.recipients).map(function (r) {
          var user = typeof r === "object" ? r : getUser(r);
          return user ? { id: String(user.id || ""), username: user.username || null, globalName: user.global_name || user.globalName || null } : { id: String(r || "") };
        })
      },
      messageCount: messages.length,
      messages: messages
    }, null, 2);
  }

  function safeFilePart(value) {
    return String(value || "dm").replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "dm";
  }

  function getFileManager() {
    var nativeModules = RN.NativeModules || {};
    var manager = nativeModules.NativeFileModule || nativeModules.RTNFileManager || nativeModules.DCDFileManager;
    if (!manager) manager = findByProps("writeFile", "readFile", "fileExists");
    if (!manager || typeof manager.writeFile !== "function") throw new Error("Kettu's native file-saving module was not found.");
    return manager;
  }

  async function shareSavedFile(path, fileName) {
    lastExportPath = path;
    var url = String(path || "");
    if (url && url.indexOf("file://") !== 0) url = "file://" + url;
    if (RN.Share && typeof RN.Share.share === "function") {
      await RN.Share.share({ url: url, title: fileName });
      return true;
    }
    var ShareModule = findByProps("share", "sharedAction") || findByProps("share");
    if (ShareModule && typeof ShareModule.share === "function") {
      await ShareModule.share({ url: url, title: fileName });
      return true;
    }
    try {
      if (RN.Clipboard && typeof RN.Clipboard.setString === "function") RN.Clipboard.setString(String(path));
    } catch (e) {}
    throw new Error("File saved, but the iOS share sheet was unavailable. Path copied when possible: " + String(path));
  }

  async function exportCurrentDM(format, onProgress) {
    cancelRequested = false;
    var channelId = getCurrentChannelId();
    if (!channelId) throw new Error("Open the personal DM you want to export first.");
    var channel = getChannel(channelId);
    if (!isPersonalDM(channel)) throw new Error("The current channel is not a personal or group DM. Open a DM and try again.");

    var max = Math.max(100, Math.min(100000, Number(storage.maxMessages) || 100000));
    var messages = await fetchAllMessages(channelId, max, onProgress);
    if (!messages.length) throw new Error("No messages were available to export from this DM.");

    var exportedAt = new Date().toISOString();
    var ext = format === "json" ? "json" : "html";
    var data = format === "json" ? buildJson(channel, messages, exportedAt) : buildHtml(channel, messages, exportedAt);
    var stamp = exportedAt.replace(/[:.]/g, "-");
    var fileName = "DM-" + safeFilePart(channelLabel(channel)) + "-" + stamp + "." + ext;
    var path = await getFileManager().writeFile("documents", "KettuExports/" + fileName, data, "utf8");
    await shareSavedFile(path, fileName);
    return { fileName: fileName, path: path, messageCount: messages.length, stopped: cancelRequested };
  }

  function Settings() {
    if (!React || !RN || !RN.View || !RN.Text) return null;
    var View = RN.View, Text = RN.Text, Pressable = RN.Pressable || RN.TouchableOpacity, ScrollView = RN.ScrollView || RN.View, TextInput = RN.TextInput, ActivityIndicator = RN.ActivityIndicator;
    var runningState = React.useState(false), running = runningState[0], setRunning = runningState[1];
    var progressState = React.useState("Open a personal DM, then choose an export format."), progress = progressState[0], setProgress = progressState[1];
    var countState = React.useState(0), count = countState[0], setCount = countState[1];
    var tickState = React.useState(0), tick = tickState[0], setTick = tickState[1];
    var channel = getChannel(getCurrentChannelId());
    var currentLabel = isPersonalDM(channel) ? channelLabel(channel) : "No personal DM selected";

    function bump() { setTick(tick + 1); }

    async function run(format) {
      if (running) return;
      setRunning(true);
      setCount(0);
      setProgress("Loading DM history...");
      try {
        var result = await exportCurrentDM(format, function (loaded, page) {
          setCount(loaded);
          setProgress("Loaded " + loaded + " messages from " + page + " page" + (page === 1 ? "" : "s") + "...");
        });
        setProgress((result.stopped ? "Stopped early. " : "") + "Exported " + result.messageCount + " messages to " + result.fileName + ".");
        toast("DM export ready");
      } catch (e) {
        setProgress(e && e.message ? e.message : String(e));
      }
      setRunning(false);
    }

    function limitButton(label, value) {
      var active = Number(storage.maxMessages) === value;
      return React.createElement(Pressable, {
        disabled: running,
        onPress: function () { storage.maxMessages = value; bump(); },
        style: { paddingVertical: 9, paddingHorizontal: 11, marginRight: 7, marginTop: 7, borderRadius: 8, backgroundColor: active ? "#5865f2" : "#2b2b2b" }
      }, React.createElement(Text, { style: { color: "white", fontWeight: active ? "800" : "500" } }, label));
    }

    return React.createElement(ScrollView, { style: { padding: 16 } },
      React.createElement(Text, { style: { color: "white", fontSize: 24, fontWeight: "900" } }, "DM Exporter 1.0.0"),
      React.createElement(View, { style: { marginTop: 12, padding: 12, borderRadius: 9, backgroundColor: "#202024", borderWidth: 1, borderColor: "#333" } },
        React.createElement(Text, { style: { color: "white", fontWeight: "800" } }, "Current DM"),
        React.createElement(Text, { style: { color: isPersonalDM(channel) ? "#6fdc8c" : "#ffb86b", marginTop: 5 } }, currentLabel),
        React.createElement(Text, { style: { color: "#999", fontSize: 12, marginTop: 7, lineHeight: 17 } }, "Uses your current signed-in session. It never asks for or stores a Discord token.")
      ),
      React.createElement(Text, { style: { color: "#bbb", fontWeight: "700", marginTop: 16 } }, "Maximum messages"),
      React.createElement(View, { style: { flexDirection: "row", flexWrap: "wrap" } },
        limitButton("1,000", 1000),
        limitButton("5,000", 5000),
        limitButton("10,000", 10000),
        limitButton("All available", 100000)
      ),
      React.createElement(Text, { style: { color: "#777", fontSize: 12, marginTop: 7 } }, "All available stops at 100,000 messages for device stability. Discord may stop earlier."),
      React.createElement(Pressable, {
        disabled: running,
        onPress: function () { run("html"); },
        style: { marginTop: 16, padding: 13, borderRadius: 8, backgroundColor: running ? "#444" : "#5865f2", alignItems: "center" }
      }, React.createElement(Text, { style: { color: "white", fontWeight: "800" } }, "Export Readable HTML")),
      React.createElement(Pressable, {
        disabled: running,
        onPress: function () { run("json"); },
        style: { marginTop: 10, padding: 13, borderRadius: 8, backgroundColor: running ? "#444" : "#3a3d45", alignItems: "center" }
      }, React.createElement(Text, { style: { color: "white", fontWeight: "800" } }, "Export Full JSON")),
      running ? React.createElement(Pressable, {
        onPress: function () { cancelRequested = true; setProgress("Stopping after the current page..."); },
        style: { marginTop: 10, padding: 12, borderRadius: 8, backgroundColor: "#5c2b2b", alignItems: "center" }
      }, React.createElement(Text, { style: { color: "white", fontWeight: "800" } }, "Stop Export")) : null,
      running && ActivityIndicator ? React.createElement(ActivityIndicator, { style: { marginTop: 14 } }) : null,
      React.createElement(Text, { style: { color: progress.indexOf("Exported") !== -1 ? "#6fdc8c" : "#ffb86b", marginTop: 14, lineHeight: 19 } }, progress),
      count ? React.createElement(Text, { style: { color: "#777", marginTop: 5 } }, "Messages loaded: " + count) : null,
      React.createElement(Text, { style: { color: "#777", fontSize: 12, lineHeight: 17, marginTop: 16, paddingBottom: 30 } }, "Exports are written inside Kettu Documents/KettuExports and opened in the iOS share sheet. Attachments remain secure Discord links; their binary files are not downloaded.")
    );
  }

  function onLoad() {}
  function onUnload() { cancelRequested = true; }

  return {
    onLoad: onLoad,
    onUnload: onUnload,
    start: onLoad,
    stop: onUnload,
    settings: Settings,
    SettingsComponent: Settings
  };
})()