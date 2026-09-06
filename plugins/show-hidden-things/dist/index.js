({__plugin:null,__load(){if(this.__plugin)return this.__plugin;this.__plugin=(function () {
'use strict';
var SETTINGS_SPACING = {
    outer: 16,
    section: 24,
    card: 16,
    rowGap: 10,
    touchTarget: 48
};
function getSettingsColors() {
    var _ref;
    var _metro_common_Theme;
    var colors = (_ref = (_metro_common_Theme = window.unbound.metro.common.Theme) === null || _metro_common_Theme === void 0 ? void 0 : _metro_common_Theme.colors) !== null && _ref !== void 0 ? _ref : {};
    var color = function color(key, fallback) {
        return typeof colors[key] === 'string' ? colors[key] : fallback;
    };
    return {
        page: color('BACKGROUND_MOBILE_PRIMARY', color('BACKGROUND_PRIMARY', '#111214')),
        surface: color('BACKGROUND_SECONDARY', '#1e1f22'),
        input: color('BACKGROUND_TERTIARY', '#111214'),
        border: color('BACKGROUND_MODIFIER_ACCENT', '#4e5058'),
        text: color('TEXT_NORMAL', '#f2f3f5'),
        muted: color('TEXT_MUTED', '#b5bac1'),
        accent: color('BRAND_500', '#5865f2'),
        danger: color('RED_400', '#ed4245')
    };
}
function SettingsScrollView(param) {
    var children = param.children;
    var ReactNative = window.unbound.metro.common.ReactNative;
    var colors = getSettingsColors();
    return /*#__PURE__*/ React.createElement(ReactNative.ScrollView, {
        contentContainerStyle: {
            backgroundColor: colors.page,
            gap: SETTINGS_SPACING.section,
            padding: SETTINGS_SPACING.outer,
            paddingBottom: 32
        },
        keyboardShouldPersistTaps: "handled"
    }, children);
}
function SettingsSection(param) {
    var title = param.title, children = param.children;
    var ReactNative = window.unbound.metro.common.ReactNative;
    var colors = getSettingsColors();
    return /*#__PURE__*/ React.createElement(ReactNative.View, {
        style: {
            gap: SETTINGS_SPACING.rowGap
        }
    }, /*#__PURE__*/ React.createElement(ReactNative.Text, {
        style: {
            color: colors.muted,
            fontSize: 13,
            fontWeight: '800',
            letterSpacing: 0.5,
            paddingHorizontal: 4,
            textTransform: 'uppercase'
        }
    }, title), /*#__PURE__*/ React.createElement(ReactNative.View, {
        style: {
            gap: SETTINGS_SPACING.rowGap
        }
    }, children));
}
function SettingsCard(param) {
    var children = param.children;
    var ReactNative = window.unbound.metro.common.ReactNative;
    var colors = getSettingsColors();
    return /*#__PURE__*/ React.createElement(ReactNative.View, {
        style: {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: 14,
            borderWidth: 1,
            padding: SETTINGS_SPACING.card
        }
    }, children);
}
function SettingsSwitchRow(param) {
    var label = param.label, description = param.description, value = param.value, onValueChange = param.onValueChange;
    var ReactNative = window.unbound.metro.common.ReactNative;
    var colors = getSettingsColors();
    return /*#__PURE__*/ React.createElement(SettingsCard, null, /*#__PURE__*/ React.createElement(ReactNative.View, {
        style: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 12,
            minHeight: SETTINGS_SPACING.touchTarget
        }
    }, /*#__PURE__*/ React.createElement(ReactNative.View, {
        style: {
            flex: 1,
            gap: 4
        }
    }, /*#__PURE__*/ React.createElement(ReactNative.Text, {
        style: {
            color: colors.text,
            fontSize: 16,
            fontWeight: '700'
        }
    }, label), description ? /*#__PURE__*/ React.createElement(ReactNative.Text, {
        style: {
            color: colors.muted,
            fontSize: 14,
            lineHeight: 19
        }
    }, description) : null), /*#__PURE__*/ React.createElement(ReactNative.Switch, {
        onValueChange: onValueChange,
        value: value
    })));
}function _instanceof(left, right) {
    "@swc/helpers - instanceof";
    if (right != null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left);
    } else return left instanceof right;
}
var STORE = window.unbound.storage.getStore('unbound.show-hidden-things');
var unpatches = [];
function enabled(setting) {
    return STORE.get(setting, true);
}
function applyTimeoutIcon(row, message, members, channels) {
    var _message_channel_id, _ref, _message_guild_id, _ref1, _ref2;
    var _channels_getChannel, _channels_getChannel1, _message_author, _members_getMember, _members_getMember1;
    if (!enabled('showTimeouts') || !row || !message) return;
    var channelId = (_message_channel_id = message.channel_id) !== null && _message_channel_id !== void 0 ? _message_channel_id : message.channelId;
    var guildId = (_ref = (_message_guild_id = message.guild_id) !== null && _message_guild_id !== void 0 ? _message_guild_id : message.guildId) !== null && _ref !== void 0 ? _ref : channels === null || channels === void 0 ? void 0 : (_channels_getChannel1 = channels.getChannel) === null || _channels_getChannel1 === void 0 ? void 0 : (_channels_getChannel = _channels_getChannel1.call(channels, channelId)) === null || _channels_getChannel === void 0 ? void 0 : _channels_getChannel.guild_id;
    var userId = (_ref1 = (_ref2 = (_message_author = message.author) === null || _message_author === void 0 ? void 0 : _message_author.id) !== null && _ref2 !== void 0 ? _ref2 : message.authorId) !== null && _ref1 !== void 0 ? _ref1 : row.authorId;
    if (!guildId || !userId) return;
    var value = members === null || members === void 0 ? void 0 : (_members_getMember1 = members.getMember) === null || _members_getMember1 === void 0 ? void 0 : (_members_getMember = _members_getMember1.call(members, guildId, userId)) === null || _members_getMember === void 0 ? void 0 : _members_getMember.communicationDisabledUntil;
    if (!value) return;
    var deadline = _instanceof(value, Date) ? value.getTime() : new Date(String(value)).getTime();
    if (Number.isFinite(deadline) && deadline > Date.now()) row.communicationDisabled = true;
}
function SettingsPanel() {
    var state = STORE.useSettingsStore();
    return /*#__PURE__*/ React.createElement(SettingsScrollView, null, /*#__PURE__*/ React.createElement(SettingsSection, {
        title: "Visibility"
    }, /*#__PURE__*/ React.createElement(SettingsSwitchRow, {
        label: "Show Timeout Icons",
        description: "Show member timeout icons in chat",
        value: state.get('showTimeouts', true),
        onValueChange: function onValueChange(value) {
            return state.set('showTimeouts', value);
        }
    }), /*#__PURE__*/ React.createElement(SettingsSwitchRow, {
        label: "Show Paused Invites",
        description: "Show paused-invite notices in server views",
        value: state.get('showInvitesPaused', true),
        onValueChange: function onValueChange(value) {
            return state.set('showInvitesPaused', value);
        }
    })));
}
var index = {
    start: function start() {
        var members = window.unbound.metro.findStore('GuildMember');
        var channels = window.unbound.metro.findByProps('getChannel');
        var rows = window.unbound.metro.findByProps('generateMessageRowData');
        var invites = window.unbound.metro.findByProps('useInvitesDisabledPermission');
        if (members && channels && typeof (rows === null || rows === void 0 ? void 0 : rows.generateMessageRowData) === 'function') {
            unpatches.push(window.unbound.patcher.after(rows, 'generateMessageRowData', function(ctx) {
                try {
                    var _ctx_result, _ctx_args_;
                    applyTimeoutIcon((_ctx_result = ctx.result) === null || _ctx_result === void 0 ? void 0 : _ctx_result.message, (_ctx_args_ = ctx.args[0]) === null || _ctx_args_ === void 0 ? void 0 : _ctx_args_.message, members, channels);
                } catch (unused) {}
            }));
        }
        if (typeof (invites === null || invites === void 0 ? void 0 : invites.useInvitesDisabledPermission) === 'function') {
            unpatches.push(window.unbound.patcher.after(invites, 'useInvitesDisabledPermission', function(ctx) {
                if (enabled('showInvitesPaused')) ctx.result = true;
            }));
        }
    },
    stop: function stop() {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = unpatches[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var unpatch = _step.value;
                unpatch();
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally{
            try {
                if (!_iteratorNormalCompletion && _iterator.return != null) {
                    _iterator.return();
                }
            } finally{
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
        unpatches = [];
    },
    getSettingsPanel: function getSettingsPanel() {
        return /*#__PURE__*/ React.createElement(SettingsPanel, null);
    }
};
return index;
})();return this.__plugin;},start(){const plugin=this.__load();if(plugin&&typeof plugin.start==='function')return plugin.start();},stop(){const plugin=this.__load();if(plugin&&typeof plugin.stop==='function')return plugin.stop();},getSettingsPanel(){const plugin=this.__load();return plugin?.getSettingsPanel?.();}})