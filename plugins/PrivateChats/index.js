/**
 * PrivateChats for Kettu / Vendetta-style mobile clients
 * Experimental compatibility layer.
 *
 * Features:
 * - Hide selected guild/server IDs while locked
 * - Hide selected DM/channel IDs while locked
 * - Manual unlock with passcode
 * - Manual relock; never auto-unlocks
 * - Settings screen buttons
 * - Attempts to suppress media attachment/embed arrays in locked private channels
 *
 * Security note:
 * This is a privacy UI lock, not cryptographic protection. A person with
 * filesystem/plugin access may be able to inspect or modify the plugin.
 */

const V = globalThis.vendetta ?? globalThis.revenge ?? globalThis.bunny ?? {};
const metro = V.metro ?? {};
const patcher = V.patcher ?? {};
const ui = V.ui ?? {};
const storage = V.storage ?? {};
const logger = V.logger ?? console;

const findByProps = metro.findByProps ?? (() => null);
const findByName = metro.findByName ?? (() => null);
const React = metro.common?.React ?? findByProps("createElement", "useState");
const RN = metro.common?.ReactNative ?? findByProps("View", "Text", "TextInput", "Pressable");

const unpatches = [];
let runtimeUnlocked = false;

const defaults = {
  passcode: "2580",
  hiddenGuildIds: [],
  hiddenChannelIds: [],
  hideMedia: true
};

const state = Object.assign({}, defaults, storage.privateChats ?? {});
function save() {
  try {
    storage.privateChats = {
      passcode: String(state.passcode || ""),
      hiddenGuildIds: [...new Set(state.hiddenGuildIds.map(String))],
      hiddenChannelIds: [...new Set(state.hiddenChannelIds.map(String))],
      hideMedia: !!state.hideMedia
    };
  } catch (e) {
    logger?.error?.("[PrivateChats] Failed to save settings", e);
  }
}

function ids(text) {
  return String(text ?? "")
    .split(/[\s,;]+/)
    .map(x => x.trim())
    .filter(Boolean);
}

function isLockedGuild(id) {
  return !runtimeUnlocked && state.hiddenGuildIds.includes(String(id));
}
function isLockedChannel(id) {
  return !runtimeUnlocked && state.hiddenChannelIds.includes(String(id));
}

function filterArray(arr, hidden) {
  if (!Array.isArray(arr)) return arr;
  return arr.filter(item => {
    const id = typeof item === "string" ? item : item?.id ?? item?.channelId ?? item?.guildId;
    return id == null || !hidden.includes(String(id));
  });
}

function filterObject(obj, hidden) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const id = v?.id ?? v?.channelId ?? k;
    if (!hidden.includes(String(id))) out[k] = v;
  }
  return out;
}

function after(obj, method, fn) {
  if (!obj || typeof obj[method] !== "function") return;
  try {
    const u = patcher.after?.(method, obj, (_args, ret) => fn(ret));
    if (typeof u === "function") unpatches.push(u);
  } catch (e) {
    logger?.warn?.(`[PrivateChats] Could not patch ${method}`, e);
  }
}

function patchStores() {
  const GuildStore =
    findByProps("getGuilds", "getGuild") ||
    findByProps("getGuild", "getGuildCount");

  if (GuildStore) {
    after(GuildStore, "getGuilds", ret => {
      if (runtimeUnlocked) return ret;
      return Array.isArray(ret)
        ? filterArray(ret, state.hiddenGuildIds)
        : filterObject(ret, state.hiddenGuildIds);
    });
    after(GuildStore, "getGuildsArray", ret =>
      runtimeUnlocked ? ret : filterArray(ret, state.hiddenGuildIds)
    );
  }

  const PrivateSortStore =
    findByProps("getPrivateChannelIds") ||
    findByProps("getSortedPrivateChannels") ||
    findByProps("getPrivateChannelIds", "getFavoriteChannelIds");

  if (PrivateSortStore) {
    after(PrivateSortStore, "getPrivateChannelIds", ret =>
      runtimeUnlocked ? ret : filterArray(ret, state.hiddenChannelIds)
    );
    after(PrivateSortStore, "getSortedPrivateChannels", ret =>
      runtimeUnlocked ? ret : filterArray(ret, state.hiddenChannelIds)
    );
  }

  const ChannelStore =
    findByProps("getChannel", "getDMFromUserId") ||
    findByProps("getChannel", "getMutableGuildChannelsForGuild");

  if (ChannelStore) {
    after(ChannelStore, "getMutableGuildChannelsForGuild", ret => {
      if (runtimeUnlocked) return ret;
      return ret;
    });
  }

  if (state.hideMedia) {
    const MessageStore =
      findByProps("getMessage", "getMessages") ||
      findByProps("getMessages", "getMessage");

    if (MessageStore) {
      after(MessageStore, "getMessage", ret => {
        if (runtimeUnlocked || !ret || !isLockedChannel(ret.channel_id ?? ret.channelId)) return ret;
        return {...ret, attachments: [], embeds: [], stickers: []};
      });
    }
  }
}

function refreshUI() {
  const stores = [
    findByProps("getGuilds", "getGuild"),
    findByProps("getPrivateChannelIds"),
    findByProps("getSortedPrivateChannels")
  ].filter(Boolean);

  for (const s of stores) {
    try { s.emitChange?.(); } catch {}
  }

  try {
    ui.toasts?.showToast?.(runtimeUnlocked ? "Private chats shown" : "Private chats hidden");
  } catch {}
}

function unlock(passcode) {
  if (String(passcode) !== String(state.passcode)) return false;
  runtimeUnlocked = true;
  refreshUI();
  return true;
}

function lock() {
  runtimeUnlocked = false;
  refreshUI();
}

function Settings() {
  if (!React || !RN) return null;
  const {View, Text, TextInput, Pressable, Switch, ScrollView} = RN;
  const [code, setCode] = React.useState("");
  const [guilds, setGuilds] = React.useState(state.hiddenGuildIds.join(", "));
  const [channels, setChannels] = React.useState(state.hiddenChannelIds.join(", "));
  const [newPass, setNewPass] = React.useState(state.passcode);
  const [media, setMedia] = React.useState(state.hideMedia);
  const [msg, setMsg] = React.useState(runtimeUnlocked ? "UNLOCKED" : "LOCKED");

  const button = (label, onPress) =>
    React.createElement(Pressable, {
      onPress,
      style: {
        paddingVertical: 13, paddingHorizontal: 14, borderRadius: 10,
        backgroundColor: "#5865F2", marginVertical: 5
      }
    }, React.createElement(Text, {style:{color:"white",fontWeight:"700",textAlign:"center"}}, label));

  const input = (value, onChangeText, placeholder, secure=false, keyboardType="default") =>
    React.createElement(TextInput, {
      value, onChangeText, placeholder, secureTextEntry: secure, keyboardType,
      autoCapitalize: "none",
      style: {
        borderWidth: 1, borderColor: "#555", borderRadius: 9,
        paddingHorizontal: 12, paddingVertical: 10, marginVertical: 5,
        color: "white"
      }
    });

  return React.createElement(ScrollView, {style:{padding:16}},
    React.createElement(Text, {style:{fontSize:22,fontWeight:"800",color:"white",marginBottom:8}},
      "Private Chats"),
    React.createElement(Text, {style:{color:"#aaa",marginBottom:12}},
      "State: " + msg + ". Hidden items only reappear after you press Show Private and enter the passcode."),

    React.createElement(Text, {style:{fontWeight:"700",color:"white",marginTop:8}}, "Unlock"),
    input(code, setCode, "Passcode", true, "number-pad"),
    button("Show Private", () => {
      if (unlock(code)) { setCode(""); setMsg("UNLOCKED"); }
      else setMsg("Wrong passcode");
    }),
    button("Hide Private", () => { lock(); setMsg("LOCKED"); }),

    React.createElement(Text, {style:{fontWeight:"700",color:"white",marginTop:16}}, "Hidden server IDs"),
    input(guilds, setGuilds, "123..., 456..."),
    React.createElement(Text, {style:{fontWeight:"700",color:"white",marginTop:12}}, "Hidden DM/channel IDs"),
    input(channels, setChannels, "123..., 456..."),

    React.createElement(View, {style:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:12}},
      React.createElement(Text, {style:{color:"white"}}, "Hide media while locked"),
      React.createElement(Switch, {value:media,onValueChange:setMedia})
    ),

    React.createElement(Text, {style:{fontWeight:"700",color:"white",marginTop:16}}, "Change passcode"),
    input(newPass, setNewPass, "New passcode", true, "number-pad"),

    button("Save settings", () => {
      state.hiddenGuildIds = ids(guilds);
      state.hiddenChannelIds = ids(channels);
      state.passcode = String(newPass || state.passcode);
      state.hideMedia = !!media;
      save();
      lock();
      setMsg("LOCKED • saved");
    }),

    React.createElement(Text, {style:{color:"#888",marginTop:16,lineHeight:18}},
      "Tip: enable Discord Developer Mode, then copy a server/channel ID and paste it above. This plugin is a local privacy layer, not strong encryption.")
  );
}

function start() {
  runtimeUnlocked = false;
  save();
  patchStores();
  logger?.log?.("[PrivateChats] started; locked by default");
  try { ui.toasts?.showToast?.("PrivateChats loaded • LOCKED"); } catch {}
}

function stop() {
  runtimeUnlocked = false;
  while (unpatches.length) {
    try { unpatches.pop()?.(); } catch {}
  }
  logger?.log?.("[PrivateChats] stopped");
}

module.exports = {
  onLoad: start,
  onUnload: stop,
  start,
  stop,
  settings: Settings,
  SettingsComponent: Settings
};
