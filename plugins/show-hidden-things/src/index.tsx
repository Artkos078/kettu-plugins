import { metro, patcher, storage } from '@unbound-app/api';

import { SettingsScrollView, SettingsSection, SettingsSwitchRow } from '../../../shared/settings-ui';

const STORE = storage.getStore('unbound.show-hidden-things');

let unpatches: Array<() => void> = [];

function enabled(setting: string): boolean {
	return STORE.get(setting, true);
}

function applyTimeoutIcon(row: any, message: any, members: any, channels: any): void {
	if (!enabled('showTimeouts') || !row || !message) return;
	const channelId = message.channel_id ?? message.channelId;
	const guildId = message.guild_id ?? message.guildId ?? channels?.getChannel?.(channelId)?.guild_id;
	const userId = message.author?.id ?? message.authorId ?? row.authorId;
	if (!guildId || !userId) return;

	const value = members?.getMember?.(guildId, userId)?.communicationDisabledUntil;
	if (!value) return;

	const deadline = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
	if (Number.isFinite(deadline) && deadline > Date.now()) row.communicationDisabled = true;
}

function SettingsPanel() {
	const state = STORE.useSettingsStore();
	return (
		<SettingsScrollView>
			<SettingsSection title="Visibility">
				<SettingsSwitchRow
					label="Show Timeout Icons"
					description="Show member timeout icons in chat"
					value={state.get('showTimeouts', true)}
					onValueChange={(value: boolean) => state.set('showTimeouts', value)}
				/>
				<SettingsSwitchRow
					label="Show Paused Invites"
					description="Show paused-invite notices in server views"
					value={state.get('showInvitesPaused', true)}
					onValueChange={(value: boolean) => state.set('showInvitesPaused', value)}
				/>
			</SettingsSection>
		</SettingsScrollView>
	);
}

export default {
    start() {
        console.log("[Show Hidden Things] loaded");
    },

	stop() {
		for (const unpatch of unpatches) unpatch();
		unpatches = [];
	},
	getSettingsPanel: () => null,
};
