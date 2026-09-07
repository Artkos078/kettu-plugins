# Bypass Size Limit for Kettu

Converted from the Vencord plugin into a Kettu/Unbound-style plugin folder.

## Install

Put this folder here:

```text
Discord/Unbound/Plugins/KettuBypassSizeLimit/
```

The folder should contain:

```text
manifest.json
index.js
README.md
```

Restart Discord/Kettu after copying it in. Then drag or paste an `.mp4` over 25 MB into a Discord channel.

## What changed

- Removed Vencord imports.
- Removed the Electron/native helper.
- Appends the clip metadata bytes directly in browser JavaScript.
- Adds both drop and paste support.
- Uses Discord's loaded client modules to find the current channel, current user, token, and toast system.
