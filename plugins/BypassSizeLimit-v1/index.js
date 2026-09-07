(function () {
  "use strict";

  var V = (typeof vendetta !== "undefined" && vendetta) || globalThis.vendetta || {};
  var metro = V.metro || {};
  var common = metro.common || {};
  var React = common.React;
  var RN = common.ReactNative;
  var ui = V.ui || {};
  var storage = (V.plugin && V.plugin.storage) || {};

  var CloudUpload = null;
  var originalCompress = null;
  var loaded = false;
  var stats = storage.bypassSizeLimitStats || {
    uploaderPatched: false,
    handled: 0,
    sent: 0,
    copied: 0,
    last: "Not loaded"
  };
  storage.bypassSizeLimitStats = stats;

  var TEN_MB = 10 * 1024 * 1024;
  var CATBOX_LIMIT = 200 * 1024 * 1024;
  var LITTERBOX_LIMIT = 1024 * 1024 * 1024;

  function toast(msg) {
    stats.last = String(msg);
    try {
      if (ui.toasts && ui.toasts.showToast) ui.toasts.showToast(String(msg));
    } catch (e) {}
    try {
      console.log("[Bypass Size Limit]", msg);
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

  function getSize(file) {
    return Number(file && (
      file.preCompressionSize ||
      file.size ||
      file.filesize ||
      file.fileSize ||
      (file.file && file.file.size)
    )) || 0;
  }

  function getFilename(file) {
    return String(
      (file && (file.filename || file.name)) ||
      (file && file.file && (file.file.filename || file.file.name)) ||
      "upload"
    );
  }

  function getMime(file) {
    return String(
      (file && (file.mimeType || file.type || file.contentType)) ||
      (file && file.file && (file.file.mimeType || file.file.type)) ||
      "application/octet-stream"
    );
  }

  function getUri(file) {
    return file && (
      (file.item && file.item.originalUri) ||
      file.uri ||
      file.fileUri ||
      file.path ||
      file.sourceURL ||
      (file.file && (file.file.uri || file.file.fileUri || file.file.path || file.file.sourceURL))
    );
  }

  function formatBytes(size) {
    if (!size) return "unknown size";
    var units = ["B", "KB", "MB", "GB"];
    var value = size;
    var index = 0;
    while (value >= 1024 && index < units.length - 1) {
      value = value / 1024;
      index += 1;
    }
    return value.toFixed(index ? 1 : 0) + " " + units[index];
  }

  async function uploadForm(url, formData) {
    var response = await fetch(url, { method: "POST", body: formData });
    var text = await response.text();
    if (!text || text.indexOf("https://") !== 0) {
      throw new Error(text || "empty upload response");
    }
    return text.trim();
  }

  async function uploadToCatbox(uri, filename, mime) {
    var formData = new FormData();
    formData.append("reqtype", "fileupload");
    if (storage.userhash && String(storage.userhash).trim()) {
      formData.append("userhash", String(storage.userhash).trim());
    }
    formData.append("fileToUpload", { uri: uri, name: filename, type: mime });
    return uploadForm("https://catbox.moe/user/api.php", formData);
  }

  async function uploadToLitterbox(uri, filename, mime) {
    var formData = new FormData();
    formData.append("reqtype", "fileupload");
    formData.append("time", "1h");
    formData.append("fileToUpload", { uri: uri, name: filename, type: mime });
    return uploadForm("https://litterbox.catbox.moe/resources/internals/api.php", formData);
  }

  async function sendMessage(channelId, content) {
    var MessageSender = findByProps("sendMessage");
    if (!MessageSender || typeof MessageSender.sendMessage !== "function") return false;
    await MessageSender.sendMessage(channelId, { content: content });
    stats.sent += 1;
    return true;
  }

  function copy(content) {
    try {
      if (RN && RN.Clipboard && RN.Clipboard.setString) {
        RN.Clipboard.setString(content);
        stats.copied += 1;
        return true;
      }
    } catch (e) {}
    return false;
  }

  function getChannelId(file) {
    if (file && file.channelId) return file.channelId;
    var ChannelStore = findByProps("getChannelId");
    try {
      return ChannelStore && ChannelStore.getChannelId && ChannelStore.getChannelId();
    } catch (e) {}
    return null;
  }

  function cancelUpload(file) {
    try {
      if (file && typeof file.setStatus === "function") file.setStatus("CANCELED");
    } catch (e) {}
  }

  async function handleLargeUpload(file) {
    var size = getSize(file);
    var filename = getFilename(file);
    var mime = getMime(file);
    var uri = getUri(file);

    if (size <= TEN_MB) return false;
    if (!uri) {
      toast("No local file URI found");
      return false;
    }
    if (size > LITTERBOX_LIMIT) {
      toast("File too large for fallback host");
      return true;
    }

    stats.handled += 1;
    var host = size > CATBOX_LIMIT ? "Litterbox" : "Catbox";
    toast("Uploading " + formatBytes(size) + " to " + host);

    try {
      var link = size > CATBOX_LIMIT
        ? await uploadToLitterbox(uri, filename, mime)
        : await uploadToCatbox(uri, filename, mime);

      cancelUpload(file);

      var content = "[" + filename.replace(/\]/g, "") + "](" + link + ")";
      var channelId = getChannelId(file);
      var sent = channelId ? await sendMessage(channelId, content) : false;
      if (sent) {
        toast("Large file link sent");
      } else if (copy(content)) {
        toast("Large file link copied");
      } else {
        toast("Uploaded: " + link);
      }
    } catch (e) {
      toast("Upload failed: " + (e && e.message ? e.message : e));
    }

    return true;
  }

  function patchUploader() {
    var cloudUploadModule = findByProps("CloudUpload");
    CloudUpload = cloudUploadModule && cloudUploadModule.CloudUpload;

    if (!CloudUpload || !CloudUpload.prototype || typeof CloudUpload.prototype.reactNativeCompressAndExtractData !== "function") {
      return false;
    }

    originalCompress = CloudUpload.prototype.reactNativeCompressAndExtractData;
    CloudUpload.prototype.reactNativeCompressAndExtractData = async function () {
      var handled = await handleLargeUpload(this);
      if (handled) return null;
      return originalCompress.apply(this, arguments);
    };

    stats.uploaderPatched = true;
    return true;
  }

  function unpatchUploader() {
    if (CloudUpload && CloudUpload.prototype && originalCompress) {
      CloudUpload.prototype.reactNativeCompressAndExtractData = originalCompress;
    }
    CloudUpload = null;
    originalCompress = null;
    loaded = false;
    stats.uploaderPatched = false;
  }

  function Settings() {
    if (!React || !RN) return null;
    var View = RN.View;
    var Text = RN.Text;
    return React.createElement(View, { style: { padding: 16 } },
      React.createElement(Text, { style: { color: "white", fontSize: 22, fontWeight: "800" } }, "Bypass Size Limit"),
      React.createElement(Text, { style: { color: "#aaa", marginTop: 8 } }, "Large files are uploaded to Catbox or Litterbox, then a link is sent in the current chat."),
      React.createElement(Text, { style: { color: stats.uploaderPatched ? "#6fdc8c" : "#ffb86b", marginTop: 14 } }, "Mobile upload hook: " + (stats.uploaderPatched ? "active" : "inactive")),
      React.createElement(Text, { style: { color: "#ccc", marginTop: 8 } }, "Large uploads handled: " + stats.handled),
      React.createElement(Text, { style: { color: "#ccc", marginTop: 4 } }, "Links sent: " + stats.sent),
      React.createElement(Text, { style: { color: "#ccc", marginTop: 4 } }, "Links copied: " + stats.copied),
      React.createElement(Text, { style: { color: "#888", marginTop: 12 } }, "Last: " + stats.last)
    );
  }

  function onLoad() {
    if (loaded) return;
    loaded = true;
    if (patchUploader()) toast("Bypass Size Limit loaded");
    else toast("Bypass Size Limit failed: CloudUpload not found");
  }

  function onUnload() {
    unpatchUploader();
    toast("Bypass Size Limit unloaded");
  }

  return {
    onLoad: onLoad,
    onUnload: onUnload,
    start: onLoad,
    stop: onUnload,
    settings: Settings
  };
})()
