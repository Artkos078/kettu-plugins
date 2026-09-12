// Chat Poll v1 for Kettu
// Usage: /poll Question | Option 1 | Option 2 | Option 3
// Sends a normal Discord chat message and automatically reacts with an emoji for each option.

(function () {
  const PLUGIN = "Chat Poll v1";
  const EMOJIS = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
  let unpatch = null;

  function findByProps(...props) {
    try {
      const metro = globalThis.modules || globalThis.__vendetta?.metro || globalThis.vendetta?.metro;
      if (metro?.findByProps) return metro.findByProps(...props);
    } catch (_) {}
    try {
      const req = globalThis.__r;
      if (typeof req === "function" && req.getModules) {
        const mods = req.getModules();
        for (const k in mods) {
          try {
            const m = req(k)?.exports;
            const candidates = [m, m?.default];
            for (const c of candidates) if (c && props.every(p => p in c)) return c;
          } catch (_) {}
        }
      }
    } catch (_) {}
    return null;
  }

  function toast(msg) {
    try {
      const t = findByProps("showToast");
      if (t?.showToast) return t.showToast(msg);
    } catch (_) {}
    console.log(`[${PLUGIN}] ${msg}`);
  }

  function getChannelId(args) {
    return args?.channelId || args?.channel_id || args?.channel?.id ||
      findByProps("getLastSelectedChannelId")?.getLastSelectedChannelId?.();
  }

  async function addReaction(channelId, messageId, emoji) {
    const reactions = findByProps("addReaction");
    if (reactions?.addReaction) {
      try { return await reactions.addReaction(channelId, messageId, {name: emoji}); } catch (_) {}
      try { return await reactions.addReaction(channelId, messageId, emoji); } catch (_) {}
    }
    const api = findByProps("post", "get", "put");
    if (api?.put) {
      const enc = encodeURIComponent(emoji);
      try { return await api.put({url:`/channels/${channelId}/messages/${messageId}/reactions/${enc}/@me`}); } catch (_) {}
    }
  }

  function parsePoll(text) {
    const raw = String(text || "").trim();
    if (!/^\/poll(?:\s|$)/i.test(raw)) return null;
    const body = raw.replace(/^\/poll\s*/i, "");
    const parts = body.split("|").map(x => x.trim()).filter(Boolean);
    if (parts.length < 3) return {error:"Use: /poll Question | Option 1 | Option 2"};
    const question = parts.shift();
    const options = parts.slice(0, 10);
    return {question, options};
  }

  function formatPoll(p) {
    const rows = p.options.map((x,i) => `${EMOJIS[i]}  ${x}`);
    return `📊 **${p.question}**\n\n${rows.join("\n")}\n\n*React below to vote.*`;
  }

  function install() {
    const sender = findByProps("sendMessage", "editMessage") || findByProps("sendMessage");
    if (!sender?.sendMessage) {
      toast("Chat Poll: sendMessage module not found");
      return;
    }

    const original = sender.sendMessage;
    let bypass = false;

    sender.sendMessage = async function (...args) {
      if (bypass) return original.apply(this, args);
      const payloadIndex = args.findIndex(a => a && typeof a === "object" && typeof a.content === "string");
      if (payloadIndex < 0) return original.apply(this, args);
      const payload = args[payloadIndex];
      const poll = parsePoll(payload.content);
      if (!poll) return original.apply(this, args);
      if (poll.error) { toast(poll.error); return; }

      const channelId = getChannelId(args[0]) || (typeof args[0] === "string" ? args[0] : null);
      const nextPayload = {...payload, content: formatPoll(poll)};
      const nextArgs = args.slice();
      nextArgs[payloadIndex] = nextPayload;

      bypass = true;
      try {
        const result = await original.apply(this, nextArgs);
        const msg = result?.message || result?.body || result;
        const messageId = msg?.id || msg?.message?.id;
        const cid = channelId || msg?.channel_id;
        if (cid && messageId) {
          for (let i=0;i<poll.options.length;i++) {
            try { await addReaction(cid, messageId, EMOJIS[i]); } catch (_) {}
          }
        } else {
          toast("Poll sent. Couldn't auto-add reactions on this Kettu build.");
        }
        return result;
      } finally { bypass = false; }
    };

    unpatch = () => { sender.sendMessage = original; };
    toast("Chat Poll loaded — /poll Question | Yes | No");
  }

  module.exports = {
    onLoad: install,
    onUnload: () => { try { unpatch?.(); } catch (_) {} unpatch = null; },
    start: install,
    stop: () => { try { unpatch?.(); } catch (_) {} unpatch = null; }
  };
})();
