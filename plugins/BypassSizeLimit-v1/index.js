(function () {
  "use strict";

  var V = (typeof vendetta !== "undefined" && vendetta) || globalThis.vendetta || {};
  var metro = V.metro || {};
  var common = metro.common || {};
  var React = common.React;
  var RN = common.ReactNative;
  var ui = V.ui || {};
  var storage = (V.plugin && V.plugin.storage) || {};

  var originalFetch = null;
  var patched = false;
  var uploadByUrl = {};
  var uploadByName = {};
  var stats = storage.bypassSizeLimitStats || {
    patched: false,
    slots: 0,
    bodies: 0,
    messages: 0,
    last: "Not loaded"
  };
  storage.bypassSizeLimitStats = stats;

  var LARGE_MP4_BYTES = 25 * 1024 * 1024;
  var DEFAULT_APPLICATION_ID = "1301689862256066560";
  var ATTACHMENTS_RE = /\/api\/v\d+\/channels\/(\d+)\/attachments(?:\?|$)/;
  var MESSAGES_RE = /\/api\/v\d+\/channels\/(\d+)\/messages(?:\?|$)/;

  var CLIP_MAGIC_BYTES = new Uint8Array([
    0, 0, 0, 89, 109, 101, 116, 97, 0, 0, 0, 0, 0, 0, 0, 33, 104, 100, 108, 114,
    0, 0, 0, 0, 0, 0, 0, 0, 109, 100, 105, 114, 97, 112, 112, 108, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 44, 105, 108, 115, 116, 0, 0, 0, 36, 169, 116,
    111, 111, 0, 0, 0, 28, 100, 97, 116, 97, 0, 0, 0, 1, 0, 0, 0, 0, 76,
    97, 118, 102, 54, 49, 46, 51, 46, 49, 48, 51, 0, 0, 46, 46, 117, 117,
    105, 100, 161, 200, 82, 153, 51, 70, 77, 184, 136, 240, 131, 245, 122,
    117, 165, 239
  ]);

  function toast(msg) {
    stats.last = String(msg);
    try {
      if (ui.toasts && ui.toasts.showToast) ui.toasts.showToast(String(msg));
    } catch (e) {}
    try {
      console.log("[Bypass Size Limit]", msg);
    } catch (e) {}
  }

  function urlOf(input) {
    if (typeof input === "string") return input;
    if (input && typeof input.url === "string") return input.url;
    return "";
  }

  function methodOf(input, init) {
    return String((init && init.method) || (input && input.method) || "GET").toUpperCase();
  }

  function bodyOf(input, init) {
    if (init && Object.prototype.hasOwnProperty.call(init, "body")) return init.body;
    return input && input._bodyInit;
  }

  function cloneInit(input, init, body) {
    var next = Object.assign({}, init || {});
    if (!next.method && input && input.method) next.method = input.method;
    if (!next.headers && input && input.headers) next.headers = input.headers;
    next.body = body;
    return next;
  }

  function isLargeMp4(file) {
    var name = String((file && file.filename) || (file && file.name) || "").toLowerCase();
    var type = String((file && file.content_type) || (file && file.type) || "").toLowerCase();
    var size = Number((file && file.file_size) || (file && file.filesize) || (file && file.size) || 0);
    return size > LARGE_MP4_BYTES && (name.endsWith(".mp4") || type.indexOf("video/mp4") >= 0);
  }

  function parseJsonBody(body) {
    if (typeof body !== "string") return null;
    try {
      return JSON.parse(body);
    } catch (e) {
      return null;
    }
  }

  function tagFile(file) {
    if (!file || !isLargeMp4(file)) return false;
    var filename = String(file.filename || file.name || "clip.mp4");
    var title = filename.replace(/\.[^.]+$/, "");
    file.file_size = Number(file.file_size || file.filesize || file.size || 0) + CLIP_MAGIC_BYTES.byteLength;
    file.is_clip = true;
    file.is_spoiler = !!file.is_spoiler;
    file.is_remix = false;
    file.is_thumbnail = false;
    file.clip_created_at = file.clip_created_at || new Date().toISOString();
    file.clip_participant_ids = Array.isArray(file.clip_participant_ids) ? file.clip_participant_ids : [];
    file.title = file.title || title;
    file.application_id = file.application_id || DEFAULT_APPLICATION_ID;
    uploadByName[filename] = {
      filename: filename,
      title: String(file.title),
      createdAt: String(file.clip_created_at),
      applicationId: String(file.application_id),
      size: Number(file.file_size)
    };
    return true;
  }

  function patchAttachmentSlotBody(body) {
    var json = parseJsonBody(body);
    if (!json || !Array.isArray(json.files)) return body;
    var changed = false;
    json.files.forEach(function (file) {
      if (tagFile(file)) changed = true;
    });
    if (!changed) return body;
    stats.slots += 1;
    toast("clip upload slot patched");
    return JSON.stringify(json);
  }

  function rememberUploadResponse(response) {
    try {
      response.clone().json().then(function (json) {
        var attachments = json && json.attachments;
        if (!Array.isArray(attachments)) return;
        attachments.forEach(function (att) {
          var meta = uploadByName[String(att.filename || "")];
          if (!meta) return;
          if (att.upload_url) uploadByUrl[String(att.upload_url)] = meta;
          if (att.upload_filename) uploadByName[String(att.upload_filename)] = meta;
        });
      }).catch(function () {});
    } catch (e) {}
  }

  async function toUint8Array(body) {
    if (!body) return null;
    if (body instanceof Uint8Array) return body;
    if (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) return new Uint8Array(body);
    if (body && typeof body.arrayBuffer === "function") return new Uint8Array(await body.arrayBuffer());
    return null;
  }

  async function appendMagicBytes(body) {
    var src = await toUint8Array(body);
    if (!src) return body;
    var out = new Uint8Array(src.byteLength + CLIP_MAGIC_BYTES.byteLength);
    out.set(src, 0);
    out.set(CLIP_MAGIC_BYTES, src.byteLength);
    stats.bodies += 1;
    toast("clip bytes added");
    return out;
  }

  function patchMessageBody(body) {
    var json = parseJsonBody(body);
    if (!json || !Array.isArray(json.attachments)) return body;
    var changed = false;
    json.attachments.forEach(function (att) {
      var meta = uploadByName[String(att.uploaded_filename || att.filename || "")] || uploadByName[String(att.filename || "")];
      if (!meta) return;
      att.filesize = meta.size || Number(att.filesize || 0) + CLIP_MAGIC_BYTES.byteLength;
      att.is_clip = true;
      att.is_remix = false;
      att.is_thumbnail = false;
      att.clip_created_at = att.clip_created_at || meta.createdAt || new Date().toISOString();
      att.clip_participant_ids = Array.isArray(att.clip_participant_ids) ? att.clip_participant_ids : [];
      att.title = att.title || meta.title;
      att.application_id = att.application_id || meta.applicationId || DEFAULT_APPLICATION_ID;
      changed = true;
    });
    if (!changed) return body;
    stats.messages += 1;
    toast("message attachment patched");
    return JSON.stringify(json);
  }

  function patchFetch() {
    if (patched || typeof globalThis.fetch !== "function") return false;
    originalFetch = globalThis.fetch;
    globalThis.fetch = async function (input, init) {
      var url = urlOf(input);
      var method = methodOf(input, init);
      var body = bodyOf(input, init);
      var nextInit = init;
      try {
        if (method === "POST" && ATTACHMENTS_RE.test(url)) {
          nextInit = cloneInit(input, init, patchAttachmentSlotBody(body));
          var slotResponse = await originalFetch.call(this, input, nextInit);
          rememberUploadResponse(slotResponse);
          return slotResponse;
        }
        if (method === "PUT" && uploadByUrl[url]) {
          nextInit = cloneInit(input, init, await appendMagicBytes(body));
          return originalFetch.call(this, input, nextInit);
        }
        if (method === "POST" && MESSAGES_RE.test(url)) {
          nextInit = cloneInit(input, init, patchMessageBody(body));
          return originalFetch.call(this, input, nextInit);
        }
      } catch (e) {
        toast("error: " + (e && e.message ? e.message : e));
      }
      return originalFetch.call(this, input, nextInit || init);
    };
    patched = true;
    stats.patched = true;
    return true;
  }

  function unpatchFetch() {
    if (patched && originalFetch) globalThis.fetch = originalFetch;
    patched = false;
    stats.patched = false;
    originalFetch = null;
    uploadByUrl = {};
    uploadByName = {};
  }

  function Settings() {
    if (!React || !RN) return null;
    var View = RN.View;
    var Text = RN.Text;
    return React.createElement(View, { style: { padding: 16 } },
      React.createElement(Text, { style: { color: "white", fontSize: 22, fontWeight: "800" } }, "Bypass Size Limit"),
      React.createElement(Text, { style: { color: "#aaa", marginTop: 8 } }, "Send one large MP4 normally. This patches Discord's upload calls as they happen."),
      React.createElement(Text, { style: { color: stats.patched ? "#6fdc8c" : "#ffb86b", marginTop: 14 } }, "Fetch patch: " + (stats.patched ? "active" : "inactive")),
      React.createElement(Text, { style: { color: "#ccc", marginTop: 8 } }, "Slots patched: " + stats.slots),
      React.createElement(Text, { style: { color: "#ccc", marginTop: 4 } }, "Upload bodies patched: " + stats.bodies),
      React.createElement(Text, { style: { color: "#ccc", marginTop: 4 } }, "Messages patched: " + stats.messages),
      React.createElement(Text, { style: { color: "#888", marginTop: 12 } }, "Last: " + stats.last)
    );
  }

  function onLoad() {
    if (patchFetch()) toast("Bypass Size Limit loaded");
    else toast("Bypass Size Limit failed: fetch unavailable");
  }

  function onUnload() {
    unpatchFetch();
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
