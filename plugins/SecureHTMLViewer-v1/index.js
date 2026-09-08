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
  function findModule(predicate) {
    try { if (typeof metro.find === "function") return metro.find(predicate); } catch (e) {}
    try { if (typeof V.find === "function") return V.find(predicate); } catch (e2) {}
    return null;
  }

  var React = common.React || findByProps("createElement", "useState") || globalThis.React;
  var RN = common.ReactNative || findByProps("View", "Text", "Pressable") || {};
  var ui = V.ui || {};
  var toastApi = ui.toasts || {};
  var storageRoot = (V.plugin && V.plugin.storage) || V.storage || {};
  if (!storageRoot.secureHtmlViewer) storageRoot.secureHtmlViewer = {};
  var storage = storageRoot.secureHtmlViewer;
  if (!storage.theme) storage.theme = "dark";
  if (!storage.fontSize) storage.fontSize = 16;
  if (!storage.lineHeight) storage.lineHeight = 1.6;
  if (!storage.pageWidth) storage.pageWidth = 820;
  if (storage.allowRemoteImages == null) storage.allowRemoteImages = false;

  var current = { name: "", raw: "", clean: "", title: "", blocked: 0 };

  function toast(message) {
    try {
      if (toastApi && typeof toastApi.showToast === "function") toastApi.showToast(String(message));
      else if (ui && typeof ui.showToast === "function") ui.showToast(String(message));
    } catch (e) {}
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function getPicker() {
    var picker = findByProps("pickSingle", "isCancel");
    if (!picker || typeof picker.pickSingle !== "function") throw new Error("Kettu's document picker was not found.");
    return picker;
  }

  function getFileManager() {
    var nativeModules = RN.NativeModules || {};
    var manager = nativeModules.RTNFileManager || nativeModules.DCDFileManager || nativeModules.NativeFileModule;
    if (!manager) manager = findByProps("writeFile", "readFile", "fileExists");
    if (!manager || typeof manager.readFile !== "function") throw new Error("Kettu's native file reader was not found.");
    return manager;
  }

  function getWebView() {
    var mod = findModule(function (x) { return !!(x && x.WebView && !x.default); }) || findByProps("WebView");
    return mod && (mod.WebView || mod.default) || null;
  }

  function stripDangerousBlocks(html) {
    var blocked = 0;
    var dangerous = ["script", "iframe", "object", "embed", "applet", "style", "template", "noscript", "svg", "math", "form"];
    dangerous.forEach(function (tag) {
      var paired = new RegExp("<" + tag + "\\b[^>]*>[\\s\\S]*?<\\/" + tag + "\\s*>", "gi");
      html = html.replace(paired, function () { blocked++; return ""; });
      var single = new RegExp("<" + tag + "\\b[^>]*\\/?>", "gi");
      html = html.replace(single, function () { blocked++; return ""; });
    });
    html = html.replace(/<!--([\s\S]*?)-->/g, "");
    html = html.replace(/<!doctype[^>]*>/gi, "");
    return { html: html, blocked: blocked };
  }

  function sanitizeHtml(source, allowImages) {
    source = String(source || "").replace(/^\uFEFF/, "");
    var titleMatch = source.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
    var title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim().slice(0, 160) : "Local HTML";
    var stripped = stripDangerousBlocks(source);
    var allowed = {
      html:1, head:1, body:1, main:1, article:1, section:1, header:1, footer:1, nav:1,
      h1:1, h2:1, h3:1, h4:1, h5:1, h6:1, p:1, div:1, span:1, br:1, hr:1,
      strong:1, b:1, em:1, i:1, u:1, s:1, mark:1, small:1, sub:1, sup:1,
      blockquote:1, pre:1, code:1, kbd:1, ul:1, ol:1, li:1, dl:1, dt:1, dd:1,
      table:1, thead:1, tbody:1, tfoot:1, tr:1, th:1, td:1, caption:1, details:1, summary:1,
      a:1, img:1, figure:1, figcaption:1, title:1
    };
    var blocked = stripped.blocked;
    var clean = stripped.html.replace(/<\/?([a-zA-Z][\w:-]*)([^>]*)>/g, function (whole, rawTag, attrs) {
      var tag = String(rawTag).toLowerCase();
      var closing = /^<\//.test(whole);
      if (!allowed[tag]) { blocked++; return ""; }
      if (tag === "html" || tag === "head" || tag === "body" || tag === "title") return "";
      if (closing) return "</" + tag + ">";
      if (tag === "br" || tag === "hr") return "<" + tag + ">";
      if (tag === "a") {
        var href = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
        var url = href && (href[1] || href[2] || href[3]) || "";
        if (/^(https?:|mailto:)/i.test(url)) return '<a href="' + escapeHtml(url) + '" rel="noreferrer">';
        return "<a>";
      }
      if (tag === "img") {
        var srcMatch = attrs.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
        var altMatch = attrs.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
        var src = srcMatch && (srcMatch[1] || srcMatch[2] || srcMatch[3]) || "";
        var alt = altMatch && (altMatch[1] || altMatch[2] || altMatch[3]) || "Image blocked";
        if (allowImages && /^https:\/\//i.test(src)) return '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '">';
        blocked++;
        return '<span class="blocked-image">[Image hidden: ' + escapeHtml(alt) + "]</span>";
      }
      return "<" + tag + ">";
    });
    return { html: clean, title: title || "Local HTML", blocked: blocked };
  }

  function buildDocument() {
    var dark = storage.theme !== "light";
    var bg = dark ? "#111214" : "#f5f6f8";
    var card = dark ? "#1e1f22" : "#ffffff";
    var text = dark ? "#e8eaed" : "#202124";
    var muted = dark ? "#a6abb4" : "#5f6368";
    var border = dark ? "#35373c" : "#dadce0";
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escapeHtml(current.title || current.name || "Local HTML") + '</title><style>' +
      ':root{color-scheme:' + (dark ? "dark" : "light") + '}*{box-sizing:border-box}body{margin:0;background:' + bg + ';color:' + text + ';font:' + Number(storage.fontSize) + 'px/' + Number(storage.lineHeight) + ' -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow-wrap:anywhere}.page{max-width:' + Number(storage.pageWidth) + 'px;margin:0 auto;padding:22px}.document{background:' + card + ';border:1px solid ' + border + ';border-radius:12px;padding:clamp(18px,4vw,42px);box-shadow:0 3px 18px rgba(0,0,0,.12)}h1,h2,h3,h4,h5,h6{line-height:1.2;margin:1.2em 0 .45em}p,ul,ol,blockquote,pre,table{margin:.8em 0}a{color:#6e9cff;text-decoration:underline}img{display:block;max-width:100%;height:auto;margin:1em auto;border-radius:8px}.blocked-image{display:inline-block;color:' + muted + ';border:1px dashed ' + border + ';padding:6px 9px;border-radius:6px}blockquote{border-left:4px solid #5865f2;padding-left:1em;color:' + muted + '}pre,code,kbd{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}pre{white-space:pre-wrap;background:' + bg + ';padding:12px;border-radius:8px;overflow:auto}code{background:' + bg + ';padding:.1em .3em;border-radius:4px}table{width:100%;border-collapse:collapse;display:block;overflow:auto}th,td{border:1px solid ' + border + ';padding:7px 9px;text-align:left}hr{border:0;border-top:1px solid ' + border + '}</style></head><body><main class="page"><article class="document">' + current.clean + '</article></main></body></html>';
  }

  function plainText(html) {
    return String(html || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p\s*>/gi, "\n").replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
      .replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n/g, "\n\n").trim();
  }

  function countMatches(text, query) {
    query = String(query || "").trim().toLowerCase();
    if (!query) return 0;
    var hay = String(text || "").toLowerCase(), count = 0, at = 0;
    while ((at = hay.indexOf(query, at)) !== -1) { count++; at += Math.max(1, query.length); if (count >= 9999) break; }
    return count;
  }

  async function pickHtml() {
    var picker = getPicker(), result;
    try {
      result = await picker.pickSingle({ type: ["text/html", "public.html"], copyTo: "cachesDirectory" });
    } catch (e) {
      if (picker.isCancel && picker.isCancel(e)) return null;
      result = await picker.pickSingle({ copyTo: "cachesDirectory" });
    }
    var name = String(result && result.name || "document.html");
    if (!/\.html?$/i.test(name) && String(result && result.type || "").toLowerCase().indexOf("html") === -1) throw new Error("Choose an .html or .htm file.");
    if (Number(result && result.size || 0) > 5 * 1024 * 1024) throw new Error("This file is over the 5 MB safety limit.");
    var uri = result && (result.fileCopyUri || result.uri);
    if (!uri) throw new Error("The picker did not return a readable file path.");
    var raw = await getFileManager().readFile(uri, "utf8");
    if (String(raw).length > 5 * 1024 * 1024) throw new Error("This file is over the 5 MB safety limit.");
    var sanitized = sanitizeHtml(raw, storage.allowRemoteImages === true);
    current = { name: name, raw: String(raw), clean: sanitized.html, title: sanitized.title, blocked: sanitized.blocked };
    return current;
  }

  async function saveFormatted() {
    if (!current.clean) throw new Error("Open an HTML file first.");
    var manager = getFileManager();
    if (typeof manager.writeFile !== "function") throw new Error("Kettu's file writer was not found.");
    var safeName = String(current.name || "document.html").replace(/\.html?$/i, "").replace(/[^\w.-]+/g, "_").slice(0, 70) || "document";
    var fileName = safeName + "-safe-formatted.html";
    var path = await manager.writeFile("documents", "KettuExports/" + fileName, buildDocument(), "utf8");
    var url = String(path || "");
    if (url && url.indexOf("file://") !== 0) url = "file://" + url;
    if (RN.Share && typeof RN.Share.share === "function") await RN.Share.share({ url: url, title: fileName });
    return fileName;
  }

  function Settings() {
    if (!React || !RN.View || !RN.Text) return null;
    var View = RN.View, Text = RN.Text, Pressable = RN.Pressable || RN.TouchableOpacity, ScrollView = RN.ScrollView || RN.View, TextInput = RN.TextInput;
    var tickState = React.useState(0), tick = tickState[0], setTick = tickState[1];
    var statusState = React.useState("Choose a local .html or .htm file."), status = statusState[0], setStatus = statusState[1];
    var searchState = React.useState(""), search = searchState[0], setSearch = searchState[1];
    var busyState = React.useState(false), busy = busyState[0], setBusy = busyState[1];
    var WebView = getWebView();
    function bump() { setTick(tick + 1); }
    function choice(label, active, action) {
      return React.createElement(Pressable, { onPress: action, style: { paddingVertical: 9, paddingHorizontal: 11, marginRight: 7, marginTop: 7, borderRadius: 8, backgroundColor: active ? "#5865f2" : "#2b2b2b" } }, React.createElement(Text, { style: { color: "white", fontWeight: active ? "800" : "500" } }, label));
    }
    async function openFile() {
      if (busy) return;
      setBusy(true); setStatus("Opening and sanitizing...");
      try {
        var result = await pickHtml();
        if (result) { setStatus("Opened " + result.name + ". Blocked or stripped " + result.blocked + " unsafe/unsupported item(s)."); setSearch(""); bump(); toast("Safe HTML preview ready"); }
        else setStatus("File selection cancelled.");
      } catch (e) { setStatus(e && e.message ? e.message : String(e)); }
      setBusy(false);
    }
    var matches = countMatches(plainText(current.clean), search);
    var preview = buildDocument();
    return React.createElement(ScrollView, { style: { padding: 16 }, keyboardShouldPersistTaps: "handled" },
      React.createElement(Text, { style: { color: "white", fontSize: 24, fontWeight: "900" } }, "Secure HTML Viewer 1.0.0"),
      React.createElement(Text, { style: { color: "#aaa", marginTop: 7, lineHeight: 18 } }, "Opens local HTML only. Scripts, forms, embedded frames, page styles, dangerous attributes, and automatic navigation are blocked."),
      React.createElement(Pressable, { disabled: busy, onPress: openFile, style: { marginTop: 15, padding: 13, borderRadius: 8, backgroundColor: busy ? "#444" : "#5865f2", alignItems: "center" } }, React.createElement(Text, { style: { color: "white", fontWeight: "800" } }, busy ? "Opening..." : "Choose HTML from Files")),
      React.createElement(Text, { style: { color: status.indexOf("Opened ") === 0 ? "#6fdc8c" : "#ffb86b", marginTop: 11, lineHeight: 18 } }, status),
      React.createElement(Text, { style: { color: "#bbb", fontWeight: "700", marginTop: 16 } }, "Theme"),
      React.createElement(View, { style: { flexDirection: "row", flexWrap: "wrap" } },
        choice("Dark", storage.theme === "dark", function () { storage.theme = "dark"; bump(); }),
        choice("Light", storage.theme === "light", function () { storage.theme = "light"; bump(); })
      ),
      React.createElement(Text, { style: { color: "#bbb", fontWeight: "700", marginTop: 11 } }, "Text size"),
      React.createElement(View, { style: { flexDirection: "row", flexWrap: "wrap" } },
        choice("Small", Number(storage.fontSize) === 14, function () { storage.fontSize = 14; bump(); }),
        choice("Normal", Number(storage.fontSize) === 16, function () { storage.fontSize = 16; bump(); }),
        choice("Large", Number(storage.fontSize) === 19, function () { storage.fontSize = 19; bump(); }),
        choice("XL", Number(storage.fontSize) === 23, function () { storage.fontSize = 23; bump(); })
      ),
      React.createElement(Text, { style: { color: "#bbb", fontWeight: "700", marginTop: 11 } }, "Spacing and width"),
      React.createElement(View, { style: { flexDirection: "row", flexWrap: "wrap" } },
        choice("Compact", Number(storage.lineHeight) === 1.35, function () { storage.lineHeight = 1.35; bump(); }),
        choice("Comfortable", Number(storage.lineHeight) === 1.6, function () { storage.lineHeight = 1.6; bump(); }),
        choice("Relaxed", Number(storage.lineHeight) === 1.9, function () { storage.lineHeight = 1.9; bump(); }),
        choice("Narrow", Number(storage.pageWidth) === 680, function () { storage.pageWidth = 680; bump(); }),
        choice("Wide", Number(storage.pageWidth) === 1100, function () { storage.pageWidth = 1100; bump(); })
      ),
      choice("Remote HTTPS images: " + (storage.allowRemoteImages ? "ON" : "OFF"), storage.allowRemoteImages === true, function () {
        storage.allowRemoteImages = !storage.allowRemoteImages;
        if (current.raw) { var next = sanitizeHtml(current.raw, storage.allowRemoteImages); current.clean = next.html; current.blocked = next.blocked; setStatus("Re-sanitized " + current.name + ". Blocked or stripped " + next.blocked + " item(s)."); }
        bump();
      }),
      React.createElement(Text, { style: { color: "#777", fontSize: 12, marginTop: 6 } }, "Images are off by default because loading them reveals your IP address to their host."),
      current.clean && TextInput ? React.createElement(TextInput, { placeholder: "Find text in document", placeholderTextColor: "#777", value: search, onChangeText: setSearch, style: { color: "white", borderColor: "#444", borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 14 } }) : null,
      search ? React.createElement(Text, { style: { color: "#aaa", marginTop: 6 } }, matches + " match" + (matches === 1 ? "" : "es")) : null,
      current.clean ? React.createElement(Pressable, { onPress: function () { saveFormatted().then(function (name) { setStatus("Saved " + name + "."); toast("Formatted HTML saved"); }).catch(function (e) { setStatus(e.message || String(e)); }); }, style: { marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: "#323238", alignItems: "center" } }, React.createElement(Text, { style: { color: "white", fontWeight: "700" } }, "Save & Share Safe Formatted Copy")) : null,
      current.clean && WebView ? React.createElement(View, { style: { height: 540, marginTop: 14, marginBottom: 30, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: "#444" } }, React.createElement(WebView, {
        key: current.name + "|" + storage.theme + "|" + storage.fontSize + "|" + storage.lineHeight + "|" + storage.pageWidth + "|" + storage.allowRemoteImages + "|" + tick,
        source: { html: preview, baseUrl: "about:blank" }, javaScriptEnabled: false, domStorageEnabled: false, sharedCookiesEnabled: false, thirdPartyCookiesEnabled: false,
        allowFileAccess: false, allowUniversalAccessFromFileURLs: false, originWhitelist: ["about:blank"], mixedContentMode: "never",
        onShouldStartLoadWithRequest: function (request) { var url = String(request && request.url || ""); return url === "about:blank" || url.indexOf("about:blank") === 0; },
        setSupportMultipleWindows: false
      })) : null,
      current.clean && !WebView ? React.createElement(View, { style: { marginTop: 14, marginBottom: 30, padding: 14, borderRadius: 9, backgroundColor: "#202024" } },
        React.createElement(Text, { style: { color: "#ffb86b", marginBottom: 9 } }, "WebView is unavailable on this build. Showing safe plain text."),
        React.createElement(Text, { selectable: true, style: { color: "white", fontSize: Number(storage.fontSize), lineHeight: Number(storage.fontSize) * Number(storage.lineHeight) } }, plainText(current.clean))
      ) : null
    );
  }

  function onLoad() {}
  function onUnload() { current = { name: "", raw: "", clean: "", title: "", blocked: 0 }; }
  return { onLoad: onLoad, onUnload: onUnload, start: onLoad, stop: onUnload, settings: Settings, SettingsComponent: Settings };
})()
