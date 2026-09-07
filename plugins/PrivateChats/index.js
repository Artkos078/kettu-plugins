/**
 * PrivateChats for Kettu / Vendetta-style mobile clients
 * v0.2.0
 *
 * In-app setup:
 * - Protect the currently open server
 * - Protect the currently open DM
 * - Remove protected items from settings
 * - Show/hide and change passcode
 * - Manual Show Private / Hide Private controls
 * - Hidden items never auto-unlock
 */

const V = globalThis.vendetta ?? globalThis.revenge ?? globalThis.bunny ?? {};
const metro = V.metro ?? {};
const patcher = V.patcher ?? {};
const ui = V.ui ?? {};
const storage = V.storage ?? {};
const logger = V.logger ?? console;

const findByProps = metro.findByProps ?? (() => null);
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

function uniqStrings(arr) {
  return [...new Set((arr ?? []).map(String).filter(Boolean))];
}

function save() {
  try {
    state.hiddenGuildIds = uniqStrings(state.hiddenGuildIds);
    state.hiddenChannelIds = uniqStrings(state.hiddenChannelIds);
    storage.privateChats = {
      passcode: String(state.passcode || "2580"),
      hiddenGuildIds: state.hiddenGuildIds,
      hiddenChannelIds: state.hiddenChannelIds,
      hideMedia: !!state.hideMedia
    };
  } catch (e) {
    logger?.error?.("[PrivateChats] Failed to save settings", e);
  }
}

function toast(text) {
  try { ui.toasts?.showToast?.(text); } catch {}
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
    const id = v?.id ?? v?.channelId ?? v?.guildId ?? k;
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

function getStores() {
  const GuildStore =
    findByProps("getGuilds", "getGuild") ||
    findByProps("getGuild", "getGuildCount");

  const ChannelStore =
    findByProps("getChannel", "getDMFromUserId") ||
    findByProps("getChannel", "getMutableGuildChannelsForGuild");

  const PrivateSortStore =
    findByProps("getPrivateChannelIds") ||
    findByProps("getSortedPrivateChannels") ||
    findByProps("getPrivateChannelIds", "getFavoriteChannelIds");

  const SelectedChannelStore =
    findByProps("getChannelId", "getVoiceChannelId") ||
    findByProps("getLastSelectedChannelId") ||
    findByProps("getChannelId");

  const SelectedGuildStore =
    findByProps("getGuildId", "getLastSelectedGuildId") ||
    findByProps("getGuildId");

  const MessageStore =
    findByProps("getMessage", "getMessages") ||
    findByProps("getMessages", "getMessage");

  return { GuildStore, ChannelStore, PrivateSortStore, SelectedChannelStore, SelectedGuildStore, MessageStore };
}

function currentContext() {
  const {GuildStore, ChannelStore, SelectedChannelStore, SelectedGuildStore} = getStores();

  let channelId = null;
  let guildId = null;

  try {
    channelId = SelectedChannelStore?.getChannelId?.() ??
      SelectedChannelStore?.getLastSelectedChannelId?.() ?? null;
  } catch {}

  try {
    guildId = SelectedGuildStore?.getGuildId?.() ??
      SelectedGuildStore?.getLastSelectedGuildId?.() ?? null;
  } catch {}

  let channel = null;
  try { if (channelId) channel = ChannelStore?.getChannel?.(channelId) ?? null; } catch {}

  if (!guildId) guildId = channel?.guild_id ?? channel?.guildId ?? null;

  let guild = null;
  try { if (guildId) guild = GuildStore?.getGuild?.(guildId) ?? null; } catch {}

  return {
    channelId: channelId ? String(channelId) : null,
    guildId: guildId ? String(guildId) : null,
    channel,
    guild
  };
}

function displayGuild(id) {
  const {GuildStore} = getStores();
  try {
    const g = GuildStore?.getGuild?.(id);
    return g?.name || `Server ${id}`;
  } catch {
    return `Server ${id}`;
  }
}

function displayChannel(id) {
  const {ChannelStore} = getStores();
  try {
    const c = ChannelStore?.getChannel?.(id);
    if (c?.name) return c.name;
    const recipients = c?.recipients;
    if (Array.isArray(recipients) && recipients.length) return `DM ${id}`;
    return `DM ${id}`;
  } catch {
    return `DM ${id}`;
  }
}

function addCurrentServer() {
  const ctx = currentContext();
  if (!ctx.guildId) {
    toast("Open a server first");
    return false;
  }
  if (!state.hiddenGuildIds.includes(ctx.guildId)) state.hiddenGuildIds.push(ctx.guildId);
  save();
  runtimeUnlocked = false;
  refreshUI();
  toast(`Protected ${ctx.guild?.name || "current server"}`);
  return true;
}

function addCurrentDM() {
  const ctx = currentContext();
  if (!ctx.channelId) {
    toast("Open a DM first");
    return false;
  }
  if (ctx.guildId) {
    toast("This is a server channel. Open a DM first");
    return false;
  }
  if (!state.hiddenChannelIds.includes(ctx.channelId)) state.hiddenChannelIds.push(ctx.channelId);
  save();
  runtimeUnlocked = false;
  refreshUI();
  toast("Protected current DM");
  return true;
}

function removeGuild(id) {
  state.hiddenGuildIds = state.hiddenGuildIds.filter(x => String(x) !== String(id));
  save();
  refreshUI();
}

function removeChannel(id) {
  state.hiddenChannelIds = state.hiddenChannelIds.filter(x => String(x) !== String(id));
  save();
  refreshUI();
}

function patchStores() {
  const {GuildStore, PrivateSortStore, MessageStore} = getStores();

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

  if (PrivateSortStore) {
    after(PrivateSortStore, "getPrivateChannelIds", ret =>
      runtimeUnlocked ? ret : filterArray(ret, state.hiddenChannelIds)
    );
    after(PrivateSortStore, "getSortedPrivateChannels", ret =>
      runtimeUnlocked ? ret : filterArray(ret, state.hiddenChannelIds)
    );
  }

  if (MessageStore) {
    after(MessageStore, "getMessage", ret => {
      if (!state.hideMedia || runtimeUnlocked || !ret) return ret;
      const cid = ret.channel_id ?? ret.channelId;
      if (!isLockedChannel(cid)) return ret;
      return {...ret, attachments: [], embeds: [], stickers: [], stickerItems: []};
    });
  }
}

function refreshUI() {
  const {GuildStore, PrivateSortStore} = getStores();
  for (const s of [GuildStore, PrivateSortStore].filter(Boolean)) {
    try { s.emitChange?.(); } catch {}
  }
}

function unlock(passcode) {
  if (String(passcode) !== String(state.passcode)) return false;
  runtimeUnlocked = true;
  refreshUI();
  toast("Private chats shown");
  return true;
}

function lock() {
  runtimeUnlocked = false;
  refreshUI();
  toast("Private chats hidden");
}

function Settings() {
  if (!React || !RN) return null;
  const {View, Text, TextInput, Pressable, Switch, ScrollView} = RN;

  const [code, setCode] = React.useState("");
  const [newPass, setNewPass] = React.useState(String(state.passcode));
  const [showPass, setShowPass] = React.useState(false);
  const [media, setMedia] = React.useState(!!state.hideMedia);
  const [msg, setMsg] = React.useState(runtimeUnlocked ? "UNLOCKED" : "LOCKED");
  const [, rerender] = React.useState(0);

  const bump = () => rerender(x => x + 1);

  const button = (label, onPress, secondary=false) =>
    React.createElement(Pressable, {
      onPress,
      style: {
        paddingVertical: 13,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: secondary ? "#3f4147" : "#5865F2",
        marginVertical: 5
      }
    }, React.createElement(Text, {
      style:{color:"white",fontWeight:"700",textAlign:"center"}
    }, label));

  const removeRow = (label, onRemove) =>
    React.createElement(View, {
      style:{
        flexDirection:"row", alignItems:"center", justifyContent:"space-between",
        borderWidth:1, borderColor:"#444", borderRadius:10,
        paddingHorizontal:12, paddingVertical:10, marginVertical:4
      }
    },
      React.createElement(Text, {style:{color:"white",flex:1,marginRight:8}}, label),
      React.createElement(Pressable, {onPress:onRemove},
        React.createElement(Text, {style:{color:"#ff6b6b",fontWeight:"700"}}, "Remove"))
    );

  return React.createElement(ScrollView, {style:{padding:16}},
    React.createElement(Text, {style:{fontSize:22,fontWeight:"800",color:"white",marginBottom:6}}, "Private Chats"),
    React.createElement(Text, {style:{color:"#aaa",marginBottom:12}}, `State: ${msg}`),

    React.createElement(Text, {style:{fontWeight:"700",color:"white",marginTop:8}}, "Lock / unlock"),
    React.createElement(TextInput, {
      value: code,
      onChangeText: setCode,
      placeholder: "Passcode",
      secureTextEntry: true,
      keyboardType: "number-pad",
      style:{borderWidth:1,borderColor:"#555",borderRadius:9,paddingHorizontal:12,paddingVertical:10,marginVertical:5,color:"white"}
    }),
    button("Show Private", () => {
      if (unlock(code)) {
        setCode("");
        setMsg("UNLOCKED");
      } else {
        setMsg("Wrong passcode");
      }
    }),
    button("Hide Private", () => {
      lock();
      setMsg("LOCKED");
    }, true),

    React.createElement(Text, {style:{fontWeight:"700",color:"white",marginTop:18}}, "Protect what is open now"),
    button("Protect Current Server", () => { if (addCurrentServer()) bump(); }),
    button("Protect Current DM", () => { if (addCurrentDM()) bump(); }),

    React.createElement(Text, {style:{fontWeight:"700",color:"white",marginTop:18}}, "Protected servers"),
    state.hiddenGuildIds.length
      ? state.hiddenGuildIds.map(id => removeRow(displayGuild(id), () => { removeGuild(id); bump(); }))
      : React.createElement(Text, {style:{color:"#888",marginVertical:8}}, "None"),

    React.createElement(Text, {style:{fontWeight:"700",color:"white",marginTop:18}}, "Protected DMs"),
    state.hiddenChannelIds.length
      ? state.hiddenChannelIds.map(id => removeRow(displayChannel(id), () => { removeChannel(id); bump(); }))
      : React.createElement(Text, {style:{color:"#888",marginVertical:8}}, "None"),

    React.createElement(Text, {style:{fontWeight:"700",color:"white",marginTop:18}}, "Passcode"),
    React.createElement(TextInput, {
      value: newPass,
      onChangeText: setNewPass,
      placeholder: "Passcode",
      secureTextEntry: !showPass,
      keyboardType: "number-pad",
      style:{borderWidth:1,borderColor:"#555",borderRadius:9,paddingHorizontal:12,paddingVertical:10,marginVertical:5,color:"white"}
    }),
    button(showPass ? "Hide Passcode" : "Show Passcode", () => setShowPass(x => !x), true),
    button("Save Passcode", () => {
      const p = String(newPass || "").trim();
      if (!p) {
        toast("Passcode cannot be empty");
        return;
      }
      state.passcode = p;
      save();
      lock();
      setMsg("LOCKED • passcode saved");
      toast("Passcode saved");
    }),

    React.createElement(View, {style:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:18}},
      React.createElement(Text, {style:{color:"white",flex:1}}, "Hide media in protected DMs while locked"),
      React.createElement(Switch, {
        value: media,
        onValueChange: value => {
          setMedia(value);
          state.hideMedia = !!value;
          save();
        }
      })
    ),

    React.createElement(Text, {style:{color:"#888",marginTop:18,lineHeight:18}},
      "Open a server or DM first, then return here and tap Protect Current Server or Protect Current DM. No ID copying is required. This is a local privacy layer, not encryption.")
  );
}

function start() {
  runtimeUnlocked = false;
  save();
  patchStores();
  logger?.log?.("[PrivateChats] v0.2.0 started; locked by default");
  toast("PrivateChats loaded • LOCKED");
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
