(function () {
  "use strict";

  var V = (typeof vendetta !== "undefined" && vendetta) || globalThis.vendetta || globalThis.revenge || globalThis.bunny || {};
  var metro = V.metro || {};
  var common = metro.common || {};

  function findByProps() {
    try { if (typeof metro.findByProps === "function") return metro.findByProps.apply(metro, arguments); } catch (e) {}
    try { if (typeof V.findByProps === "function") return V.findByProps.apply(V, arguments); } catch (e2) {}
    return null;
  }

  var React = common.React || findByProps("createElement", "useState") || globalThis.React;
  var RN = common.ReactNative || findByProps("View", "Text", "Pressable") || {};
  var ui = V.ui || {};
  var toastApi = ui.toasts || {};
  var cancelRequested = false;

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
    var output = [];
    if (!value) return output;
    if (Array.isArray(value)) return value.slice();
    try { if (Array.isArray(value._array)) return value._array.slice(); } catch (e) {}
    try { if (typeof value.toArray === "function") return value.toArray(); } catch (e2) {}
    try { if (typeof value.valueSeq === "function") return value.valueSeq().toArray(); } catch (e3) {}
    try { if (typeof value.forEach === "function") value.forEach(function (item) { if (item) output.push(item); }); } catch (e4) {}
    return output;
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

  function isDM(channel) {
    if (!channel || channel.guild_id || channel.guildId) return false;
    var type = channel.type;
    return type == null || type === 1 || type === 3 || type === "DM" || type === "GROUP_DM";
  }

  function getUser(userId) {
    var store = findByProps("getUser", "getCurrentUser") || findByProps("getUser");
    try { return store && typeof store.getUser === "function" ? store.getUser(String(userId)) : null; } catch (e) { return null; }
  }

  function channelLabel(channel) {
    if (!channel) return "No DM selected";
    if (channel.name) return String(channel.name);
    var names = [];
    asArray(channel.rawRecipients || channel.recipients).forEach(function (recipient) {
      var user = typeof recipient === "object" ? recipient : getUser(recipient);
      var name = user && (user.global_name || user.globalName || user.username || user.name);
      if (name && names.indexOf(String(name)) === -1) names.push(String(name));
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

  async function requestPage(channelId, before) {
    var query = { limit: 100 };
    if (before) query.before = before;
    var response = await getHTTP().get({ url: "/channels/" + channelId + "/messages", query: query });
    var body = responseBody(response);
    if (response && response.status === 429) {
      await wait(Math.max(500, Math.ceil(Number(body && body.retry_after || 1) * 1000)));
      response = await getHTTP().get({ url: "/channels/" + channelId + "/messages", query: query });
      body = responseBody(response);
    }
    if (response && (response.status >= 400 || response.ok === false)) {
      throw new Error("Discord returned HTTP " + response.status + (body && body.message ? ": " + body.message : ""));
    }
    var list = Array.isArray(body) ? body : body && body.messages;
    if (!Array.isArray(list)) throw new Error(body && body.message || "Discord returned an unexpected response.");
    return list;
  }

  async function fetchMessages(channelId, onProgress) {
    var messages = [];
    var seen = {};
    var before = null;
    var page = 0;
    while (!cancelRequested && messages.length < 20000) {
      var batch = await requestPage(channelId, before);
      if (!batch.length) break;
      for (var i = 0; i < batch.length && messages.length < 20000; i++) {
        var id = String(batch[i] && batch[i].id || "");
        if (id && !seen[id]) { seen[id] = true; messages.push(batch[i]); }
      }
      page++;
      if (onProgress) onProgress(messages.length, page);
      var oldest = batch[batch.length - 1];
      var next = String(oldest && oldest.id || "");
      if (!next || next === before || batch.length < 100) break;
      before = next;
      await wait(350);
    }
    return messages;
  }

  function flattenMessage(message) {
    var parts = [];
    if (message && message.content) parts.push(message.content);
    asArray(message && message.embeds).forEach(function (embed) {
      if (!embed) return;
      if (embed.title) parts.push(embed.title);
      if (embed.description) parts.push(embed.description);
      if (embed.author && embed.author.name) parts.push(embed.author.name);
      asArray(embed.fields).forEach(function (field) {
        if (field && field.name) parts.push(field.name);
        if (field && field.value) parts.push(field.value);
      });
      if (embed.footer && embed.footer.text) parts.push(embed.footer.text);
    });
    return parts.join("\n")
      .replace(/\*\*/g, "")
      .replace(/__+/g, "")
      .replace(/\u00a0/g, " ");
  }

  function withoutMilliseconds(date) {
    return date.toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  function timestampFromText(text, fallbackTimestamp) {
    var discord = text.match(/<t:(\d{10,13})(?::[tTdDfFR])?>/);
    if (discord) {
      var raw = Number(discord[1]);
      var date = new Date(raw > 99999999999 ? raw : raw * 1000);
      if (!isNaN(date.getTime())) return date;
    }

    var literal = text.match(/\bon\s+(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})\s*(?:UTC|GMT)?\s*([+-]\d{2}:?\d{2}|Z)?/i);
    if (literal) {
      var zone = literal[3] || "Z";
      if (zone !== "Z" && zone.indexOf(":") === -1) zone = zone.slice(0, 3) + ":" + zone.slice(3);
      var parsed = new Date(literal[1] + "T" + literal[2] + zone);
      if (!isNaN(parsed.getTime())) return parsed;
    }

    var fallback = new Date(fallbackTimestamp || "");
    return isNaN(fallback.getTime()) ? null : fallback;
  }

  function uuid() {
    try { if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID(); } catch (e) {}
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (char) {
      var random = Math.floor(Math.random() * 16);
      return (char === "x" ? random : (random & 3) | 8).toString(16);
    });
  }

  function normalizedUnit(unit) {
    var lower = String(unit || "").toLowerCase();
    if (lower === "ml") return "mL";
    if (lower === "mcg" || lower === "µg" || lower === "μg") return "mcg";
    return lower;
  }

  function parseMessage(message) {
    var text = flattenMessage(message);
    var routes = "Intramuscular|Subcutaneous|Sublingual|Intravenous|Transdermal|Intranasal|Vaporized|Insufflated|Injected|Buccal|Smoked|Inhaled|Rectal|Nasal|Oral|Other";
    var pattern = new RegExp("You\\s+dosed\\s+([0-9]+(?:\\.[0-9]+)?)\\s+([A-Za-zµμ]+)\\s+of\\s+([\\s\\S]+?)\\s+(" + routes + ")(?=\\s|$|[.,])", "gi");
    var results = [];
    var match;
    while ((match = pattern.exec(text))) {
      var nextIndex = text.slice(pattern.lastIndex).search(/You\s+dosed\s+/i);
      var end = nextIndex === -1 ? text.length : pattern.lastIndex + nextIndex;
      var segment = text.slice(match.index, end);
      var taken = timestampFromText(segment, message && message.timestamp);
      if (!taken) continue;
      results.push({
        id: uuid(),
        substance: String(match[3]).replace(/\s+/g, " ").trim(),
        amount: Number(match[1]),
        unit: normalizedUnit(match[2]),
        route: String(match[4]).slice(0, 1).toUpperCase() + String(match[4]).slice(1).toLowerCase(),
        takenAt: withoutMilliseconds(taken),
        notes: "",
        source: "TripBot via Kettu",
        createdAt: withoutMilliseconds(new Date())
      });
    }
    return results;
  }

  function extractEntries(messages) {
    var entries = [];
    var seen = {};
    messages.forEach(function (message) {
      parseMessage(message).forEach(function (entry) {
        var key = [entry.substance.toLowerCase(), entry.amount, entry.unit.toLowerCase(), entry.route.toLowerCase(), entry.takenAt].join("|");
        if (!seen[key]) { seen[key] = true; entries.push(entry); }
      });
    });
    entries.sort(function (a, b) { return Date.parse(a.takenAt) - Date.parse(b.takenAt); });
    return entries;
  }

  function getFileManager() {
    var nativeModules = RN.NativeModules || {};
    var manager = nativeModules.NativeFileModule || nativeModules.RTNFileManager || nativeModules.DCDFileManager;
    if (!manager) manager = findByProps("writeFile", "readFile", "fileExists");
    if (!manager || typeof manager.writeFile !== "function") throw new Error("Kettu's file-saving module was not found.");
    return manager;
  }

  async function shareFile(path, fileName) {
    var url = String(path || "");
    if (url && url.indexOf("file://") !== 0) url = "file://" + url;
    if (RN.Share && typeof RN.Share.share === "function") {
      await RN.Share.share({ url: url, title: fileName });
      return;
    }
    var share = findByProps("share", "sharedAction") || findByProps("share");
    if (share && typeof share.share === "function") {
      await share.share({ url: url, title: fileName });
      return;
    }
    throw new Error("The file was saved, but the iOS share sheet was unavailable: " + path);
  }

  function copyText(text) {
    if (RN.Clipboard && typeof RN.Clipboard.setString === "function") { RN.Clipboard.setString(text); return true; }
    var clipboard = findByProps("setString", "getString") || findByProps("setString");
    if (clipboard && typeof clipboard.setString === "function") { clipboard.setString(text); return true; }
    return false;
  }

  function readableText(entries) {
    return entries.map(function (entry) {
      var stamp = entry.takenAt.replace("T", " ").replace("Z", " UTC+00:00");
      return "You dosed " + entry.amount + " " + entry.unit + " of " + entry.substance + " " + entry.route + "\non " + stamp;
    }).join("\n\n");
  }

  async function collect(onProgress) {
    cancelRequested = false;
    var channelId = getCurrentChannelId();
    if (!channelId) throw new Error("Open the TripBot DM first, then return here.");
    var channel = getChannel(channelId);
    if (!isDM(channel)) throw new Error("The selected channel is not a DM. Open the TripBot DM first.");
    var messages = await fetchMessages(channelId, onProgress);
    var entries = extractEntries(messages);
    if (!entries.length) throw new Error("No TripBot ‘You dosed …’ entries were found in " + channelLabel(channel) + ".");
    return { channel: channel, entries: entries, messageCount: messages.length };
  }

  async function exportJSON(onProgress) {
    var result = await collect(onProgress);
    var stamp = new Date().toISOString().replace(/[:.]/g, "-");
    var fileName = "DoseDiary-TripBot-" + stamp + ".json";
    var data = JSON.stringify(result.entries, null, 2);
    var path = await getFileManager().writeFile("documents", "KettuExports/" + fileName, data, "utf8");
    await shareFile(path, fileName);
    return { entries: result.entries.length, messages: result.messageCount, fileName: fileName };
  }

  function Settings() {
    if (!React || !RN || !RN.View || !RN.Text) return null;
    var View = RN.View;
    var Text = RN.Text;
    var Pressable = RN.Pressable || RN.TouchableOpacity;
    var ScrollView = RN.ScrollView || RN.View;
    var ActivityIndicator = RN.ActivityIndicator;
    var runningState = React.useState(false), running = runningState[0], setRunning = runningState[1];
    var statusState = React.useState("Open your TripBot DM before exporting."), status = statusState[0], setStatus = statusState[1];
    var channel = getChannel(getCurrentChannelId());
    var label = isDM(channel) ? channelLabel(channel) : "No DM selected";

    function progress(loaded, page) {
      setStatus("Scanning " + loaded + " messages (page " + page + ")…");
    }

    async function runExport() {
      if (running) return;
      setRunning(true);
      setStatus("Loading the open DM…");
      try {
        var result = await exportJSON(progress);
        setStatus("Found " + result.entries + " dose entr" + (result.entries === 1 ? "y" : "ies") + ". Saved " + result.fileName + ".");
        toast("DoseDiary export ready");
      } catch (error) {
        setStatus(error && error.message ? error.message : String(error));
      }
      setRunning(false);
    }

    async function runCopy() {
      if (running) return;
      setRunning(true);
      setStatus("Loading the open DM…");
      try {
        var result = await collect(progress);
        if (!copyText(readableText(result.entries))) throw new Error("Kettu's clipboard module was not found.");
        setStatus("Copied " + result.entries.length + " formatted dose entr" + (result.entries.length === 1 ? "y" : "ies") + ".");
        toast("Dose entries copied");
      } catch (error) {
        setStatus(error && error.message ? error.message : String(error));
      }
      setRunning(false);
    }

    function button(labelText, action, secondary, allowWhileRunning) {
      return React.createElement(Pressable, {
        disabled: running && !allowWhileRunning,
        onPress: action,
        style: { marginTop: 10, padding: 13, borderRadius: 10, backgroundColor: running && !allowWhileRunning ? "#444" : secondary ? "#3a3d45" : "#5865f2", alignItems: "center" }
      }, React.createElement(Text, { style: { color: "white", fontWeight: "800" } }, labelText));
    }

    return React.createElement(ScrollView, { style: { padding: 16 } },
      React.createElement(Text, { style: { color: "white", fontSize: 23, fontWeight: "900" } }, "TripBot Dose Export"),
      React.createElement(View, { style: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: "#202024", borderWidth: 1, borderColor: "#333" } },
        React.createElement(Text, { style: { color: "white", fontWeight: "800" } }, "Open DM"),
        React.createElement(Text, { style: { color: isDM(channel) ? "#6fdc8c" : "#ffb86b", marginTop: 5 } }, label),
        React.createElement(Text, { style: { color: "#999", fontSize: 12, marginTop: 8, lineHeight: 17 } }, "Only recognized TripBot dose entries are exported. Other messages and attachments are ignored.")
      ),
      button("Export for DoseDiary", runExport, false),
      button("Copy Formatted Text", runCopy, true),
      running ? button("Stop after current page", function () { cancelRequested = true; setStatus("Stopping…"); }, true, true) : null,
      running && ActivityIndicator ? React.createElement(ActivityIndicator, { style: { marginTop: 14 } }) : null,
      React.createElement(Text, { style: { color: status.indexOf("Found") === 0 || status.indexOf("Copied") === 0 ? "#6fdc8c" : "#ffb86b", marginTop: 14, lineHeight: 19 } }, status),
      React.createElement(Text, { style: { color: "#777", fontSize: 12, lineHeight: 17, marginTop: 16, paddingBottom: 30 } }, "The JSON file opens in the iOS share sheet. Save it to Files, then choose it from DoseDiary → Import. No Discord token is requested or stored.")
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
