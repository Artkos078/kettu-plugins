# Plugin Catalog

This folder contains the retained Kettu plugin sources. For normal installs, use the raw GitHub folder URLs below.

| Plugin | Status | Purpose | Install URL |
| --- | --- | --- | --- |
| **PrivateChats v9** | Recommended | Locally hide/lock protected DMs and servers with passcode and auto-lock behavior. | `https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/plugins/PrivateChats-v9/` |
| **Channel Media Gallery v1** | Experimental | Shows the latest images/videos from the current channel in a 20-30 item gallery. | `https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/plugins/ChannelMediaGallery-v1/` |
| **Bypass Size Limit v1** | Experimental | Uploads large mobile files to Catbox or Litterbox and sends the link in the current chat or DM. | `https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/plugins/BypassSizeLimit-v1/` |
| **NativeVideoPlayer v2** | Legacy / experimental | Older video-opening implementation retained for testing/reference. | `https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/plugins/NativeVideoPlayer-v2/` |
| **VideoSkipGestures v3** | Legacy / experimental | Older media gesture implementation retained for reference. | `https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/plugins/VideoSkipGestures-v3/` |

## Current media plugin

The active media plugin is stored at the repository root under `media/`, not in this folder.

Install it with:

```text
https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/media/
```

It uses Kettu/Discord's built-in media viewer and adds double-tap rewind/forward without handing videos to the native iOS player.

## Install format

Paste the **folder URL** into Kettu. Keep the trailing `/` and do not append `manifest.json`.

A typical plugin directory contains:

```text
manifest.json
index.js
```

The `main` property in `manifest.json` determines which JavaScript file Kettu loads, so some plugins may use a different entry filename.

See the repository root README for full installation and troubleshooting information.
