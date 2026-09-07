# Plugin Catalog

This folder contains the retained Kettu plugin sources. For normal installs, use the raw GitHub folder URLs below.

| Plugin | Status | Purpose | Install URL |
| --- | --- | --- | --- |
| **PrivateChats v9** | Recommended | Locally hide/lock protected DMs and servers with passcode and auto-lock behavior. | `https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/plugins/PrivateChats-v9/` |
| **Bypass Size Limit v1** | Experimental | Uploads oversized MP4 files as Discord clips using browser-side clip metadata bytes. | `https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/plugins/BypassSizeLimit-v1/` |
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
