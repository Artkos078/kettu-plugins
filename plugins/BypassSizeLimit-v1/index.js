(() => {
  "use strict";

  const PLUGIN_ID = "kettu.bypass-size-limit";
  const PLUGIN_NAME = "Bypass Size Limit";
  const LARGE_MP4_BYTES = 25 * 1024 * 1024;
  const DEFAULT_APPLICATION_ID = "1301689862256066560";
  const DISCORD_API = "https://discord.com/api/v9";

  const CLIP_MAGIC_BYTES = new Uint8Array([
    0, 0, 0, 89, 109, 101, 116, 97, 0, 0, 0, 0, 0, 0, 0, 33, 104, 100, 108, 114,
    0, 0, 0, 0, 0, 0, 0, 0, 109, 100, 105, 114, 97, 112, 112, 108, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 44, 105, 108, 115, 116, 0, 0, 0, 36, 169, 116,
    111, 111, 0, 0, 0, 28, 100, 97, 116, 97, 0, 0, 0, 1, 0, 0, 0, 0, 76,
    97, 118, 102, 54, 49, 46, 51, 46, 49, 48, 51, 0, 0, 46, 46, 117, 117,
    105, 100, 161, 200, 82, 153, 51, 70, 77, 184, 136, 240, 131, 245, 122,
    117, 165, 239
  ]);

  let started = false;
  let dropHandler = null;
  let pasteHandler = null;
  let webpackRequire = null;
  const moduleCache = new Map();

  function log(...args) {
    console.log(`[${PLUGIN_NAME}]`, ...args);
  }

  function warn(...args) {
    console.warn(`[${PLUGIN_NAME}]`, ...args);
  }

  function getWebpackRequire() {
    if (webpackRequire) return webpackRequire;

    try {
      const chunkName = "webpackChunkdiscord_app";
      window[chunkName] = window[chunkName] || [];
      window[chunkName].push([
        [Math.random()],
        {},
        req => {
          webpackRequire = req;
        }
      ]);
      window[chunkName].pop();
    } catch (err) {
      warn("Could not capture webpack require.", err);
    }

    return webpackRequire;
  }

  function findModule(predicate, cacheKey) {
    if (cacheKey && moduleCache.has(cacheKey)) return moduleCache.get(cacheKey);

    const req = getWebpackRequire();
    const cache = req && req.c;
    if (!cache) return null;

    for (const id in cache) {
      const exports = cache[id] && cache[id].exports;
      const candidates = [exports, exports && exports.default].filter(Boolean);

      for (const candidate of candidates) {
        try {
          if (predicate(candidate)) {
            if (cacheKey) moduleCache.set(cacheKey, candidate);
            return candidate;
          }
        } catch {}
      }
    }

    return null;
  }

  function findByProps(...props) {
    return findModule(mod => props.every(prop => mod && prop in mod), props.join(":"));
  }

  function showToast(message, type) {
    const toastModule = findModule(
      mod => mod && (typeof mod.showToast === "function" || (mod.Toasts && typeof mod.Toasts.show === "function")),
      "toast"
    );

    try {
      if (toastModule && typeof toastModule.showToast === "function") {
        const toastTypes = toastModule.Toasts && toastModule.Toasts.Type;
        const toastType = type === "success"
          ? (toastTypes && toastTypes.SUCCESS) || "success"
          : type === "failure"
            ? (toastTypes && toastTypes.FAILURE) || "failure"
            : (toastTypes && toastTypes.MESSAGE) || "message";
        toastModule.showToast(message, toastType);
        return;
      }

      if (toastModule && toastModule.Toasts && toastModule.Toasts.show && toastModule.Toasts.create) {
        toastModule.Toasts.show(toastModule.Toasts.create(message, type || "message"));
        return;
      }
    } catch (err) {
      warn("Toast failed.", err);
    }

    log(message);
  }

  function getSelectedChannelId() {
    const store = findByProps("getCurrentlySelectedChannelId");
    return store && store.getCurrentlySelectedChannelId && store.getCurrentlySelectedChannelId();
  }

  function getCurrentUser() {
    const store = findByProps("getCurrentUser");
    return store && store.getCurrentUser && store.getCurrentUser();
  }

  function getToken() {
    const tokenStore = findByProps("getToken");
    const token = tokenStore && tokenStore.getToken && tokenStore.getToken();
    if (!token) throw new Error("Could not read Discord token from client stores.");
    return token;
  }

  async function apiRequest(method, path, body) {
    const res = await fetch(`${DISCORD_API}${path}`, {
      method,
      headers: {
        Authorization: getToken(),
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Discord API ${res.status}: ${text.slice(0, 160) || res.statusText}`);
    }

    return res.json();
  }

  async function readDetectableApps() {
    const cacheKey = `${PLUGIN_ID}.detectable.v1`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.savedAt < 7 * 24 * 60 * 60 * 1000 && Array.isArray(parsed.apps)) {
          return parsed.apps;
        }
      } catch {}
    }

    const res = await fetch(`${DISCORD_API}/applications/detectable`);
    if (!res.ok) throw new Error(`Detectable app lookup failed: ${res.status}`);

    const apps = await res.json();
    localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), apps }));
    return apps;
  }

  async function findApplicationId(fileName) {
    const baseName = fileName.split("_")[0].replace(/\s+/g, "");
    if (!baseName || baseName.length < 3) return DEFAULT_APPLICATION_ID;

    try {
      const apps = await readDetectableApps();
      const lowerInput = baseName.toLowerCase();
      const cleanInput = lowerInput.replace(/[^a-z0-9]/g, "");

      const match = apps.find(app => Array.isArray(app.executables) && app.executables.some(exe => {
        if (!exe || exe.os !== "win32" || !exe.name) return false;
        const rawName = exe.name.split("/").pop().toLowerCase();
        const cleanName = rawName.replace(/\.exe$/i, "").replace(/[^a-z0-9]/g, "");
        return rawName === lowerInput || rawName === `${lowerInput}.exe` ||
          (cleanName.length >= 3 && (cleanInput.startsWith(cleanName) || cleanName.startsWith(cleanInput)));
      }));

      return (match && match.id) || DEFAULT_APPLICATION_ID;
    } catch (err) {
      warn("Using default clip application id.", err);
      return DEFAULT_APPLICATION_ID;
    }
  }

  async function appendClipBytes(file) {
    const source = new Uint8Array(await file.arrayBuffer());
    const output = new Uint8Array(source.byteLength + CLIP_MAGIC_BYTES.byteLength);
    output.set(source, 0);
    output.set(CLIP_MAGIC_BYTES, source.byteLength);
    return output;
  }

  async function uploadAsClip(file, channelId) {
    if (!channelId) {
      showToast("No channel detected.", "failure");
      return;
    }

    const fileName = file.name || "clip.mp4";
    const title = fileName.replace(/\.[^.]+$/, "");
    const currentUser = getCurrentUser();
    const createdAt = new Date().toISOString();

    showToast(`[1/5] Preparing ${fileName}`, "message");
    log("Processing", fileName);

    const [taggedBuffer, applicationId] = await Promise.all([
      appendClipBytes(file),
      findApplicationId(fileName)
    ]);

    showToast("[2/5] Requesting upload slot", "message");
    const attachmentData = await apiRequest("POST", `/channels/${channelId}/attachments`, {
      files: [{
        filename: fileName,
        file_size: taggedBuffer.byteLength,
        id: "0",
        is_clip: true,
        is_spoiler: false,
        is_remix: false,
        is_thumbnail: false,
        clip_created_at: createdAt,
        clip_participant_ids: currentUser && currentUser.id ? [currentUser.id] : [],
        title,
        application_id: applicationId
      }]
    });

    const attachment = attachmentData && attachmentData.attachments && attachmentData.attachments[0];
    if (!attachment || !attachment.upload_url || !attachment.upload_filename) {
      throw new Error("Discord did not return an upload slot.");
    }

    showToast("[3/5] Uploading file", "message");
    const uploadRes = await fetch(attachment.upload_url, {
      method: "PUT",
      body: taggedBuffer
    });

    if (!uploadRes.ok) {
      throw new Error(`Cloud upload failed: ${uploadRes.status}`);
    }

    showToast("[4/5] Sending clip message", "message");
    await apiRequest("POST", `/channels/${channelId}/messages`, {
      content: "",
      attachments: [{
        id: "0",
        filesize: taggedBuffer.byteLength,
        filename: fileName,
        uploaded_filename: attachment.upload_filename,
        is_clip: true,
        is_spoiler: false,
        is_remix: false,
        is_thumbnail: false,
        clip_created_at: createdAt,
        clip_participant_ids: currentUser && currentUser.id ? [currentUser.id] : [],
        title,
        application_id: applicationId
      }]
    });

    showToast(`[5/5] Uploaded ${fileName}`, "success");
    log("Upload complete.");
  }

  function collectLargeMp4s(fileList) {
    return Array.from(fileList || []).filter(file => {
      const isMp4 = /\.mp4$/i.test(file.name || "") || file.type === "video/mp4";
      return isMp4 && file.size > LARGE_MP4_BYTES;
    });
  }

  function handleFiles(fileList) {
    const files = collectLargeMp4s(fileList);
    if (!files.length) return false;

    const channelId = getSelectedChannelId();
    for (const file of files) {
      uploadAsClip(file, channelId).catch(err => {
        warn("Upload failed.", err);
        showToast(`Upload failed: ${err.message || "Unknown error"}`, "failure");
      });
    }

    return true;
  }

  const plugin = {
    id: PLUGIN_ID,
    name: PLUGIN_NAME,
    description: "Uploads oversized MP4 files as Discord clips.",
    version: "1.0.1",
    authors: [{ name: "Roo", id: "0" }],

    start() {
      if (started) return;
      started = true;

      dropHandler = event => {
        if (handleFiles(event.dataTransfer && event.dataTransfer.files)) {
          event.preventDefault();
          event.stopPropagation();
        }
      };

      pasteHandler = event => {
        if (handleFiles(event.clipboardData && event.clipboardData.files)) {
          event.preventDefault();
          event.stopPropagation();
        }
      };

      window.addEventListener("drop", dropHandler, true);
      window.addEventListener("paste", pasteHandler, true);
      log("Started. Drop or paste an MP4 over 25 MB in a Discord channel.");
    },

    stop() {
      if (!started) return;
      started = false;

      if (dropHandler) window.removeEventListener("drop", dropHandler, true);
      if (pasteHandler) window.removeEventListener("paste", pasteHandler, true);
      dropHandler = null;
      pasteHandler = null;
      log("Stopped.");
    }
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = plugin;
  }

  window.KettuBypassSizeLimit = plugin;
  window.KettuPlugins = window.KettuPlugins || {};
  window.KettuPlugins[PLUGIN_ID] = plugin;

  const autoLoaders = [
    window.Kettu && window.Kettu.plugins,
    window.Unbound && window.Unbound.plugins,
    window.KettuPluginsRegistry,
    window.UnboundPluginsRegistry
  ].filter(Boolean);

  for (const loader of autoLoaders) {
    try {
      if (typeof loader.register === "function") loader.register(plugin);
      else if (typeof loader.add === "function") loader.add(plugin);
    } catch (err) {
      warn("Plugin registry registration failed.", err);
    }
  }
})();
