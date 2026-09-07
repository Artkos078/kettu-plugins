# PrivateChats for Kettu

Experimental Vendetta-style Kettu plugin.

## What it does
- Hides selected server/guild IDs while locked.
- Hides selected DM/channel IDs while locked.
- Selected items reappear only after you press **Show Private** and enter the passcode.
- Press **Hide Private** to conceal them again.
- It never auto-unlocks.
- Attempts to hide attachments/embeds in explicitly hidden DM/channel IDs while locked.

## Install
Use the hosted plugin folder or place this folder in your Kettu-compatible Plugins directory:

PrivateChats/
  manifest.json
  index.js

## Setup
1. Turn on Discord Developer Mode.
2. Copy IDs for servers and DM/channel IDs you want private.
3. Paste them in plugin settings.
4. Set a passcode and Save.
5. Keep the plugin locked.

Default passcode: `2580` — change it immediately.

## Important
This is a privacy UI lock, not encryption. Someone who can modify/read your Kettu plugin files may bypass it.
