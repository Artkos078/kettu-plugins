| **Exact Timestamps v2** | Makes inline Discord timestamp pills precise to the second with Smart, exact, relative, local, and UTC formats. | 2.0.0 | `https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/plugins/ExactTimestamps-v2` |n="center">

# Kettu Plugins

Custom plugins and quality-of-life tweaks for Kettu on iOS.

**Simple installs · Kettu-focused · No external build step required for active plugins**

</div>

---

## About

This repository contains custom Kettu plugins for Discord on iOS. Active installable plugins are hosted directly from the `main` branch so Kettu can fetch each plugin's `manifest.json` and JavaScript entry file from the same folder.

This is a personal/community plugin repository and is not an official Kettu project.

## Recommended plugins

| Plugin | What it does | Version | Install URL |
| --- | --- | ---: | --- |
| **Kettu Media Gestures** | Adds double-tap rewind/forward inside Kettu's normal Discord media viewer. Does not use the native iOS player. | 3.2.0 | `https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/media/` |
| **PrivateChats** | Locally hide and lock selected DMs and servers with passcode protection and auto-lock behavior. | 0.9.3 | `https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/plugins/PrivateChats-v9/` |
| **HumanizeGPT** | Rewrites `/humanize` messages with OpenAI and sends the natural version to the current chat. | 1.0.0 | `https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/HumanizeGPT/` |
| **Exact Timestamps** | Makes inline Discord timestamps precise to the second and supports exact/relative local or UTC message-time formats. | 1.1.0 | `https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/plugins/ExactTimestamps-v1/` |

## Installing a plugin

1. Open Kettu.
2. Open the Plugins section.
3. Choose **Install a plugin**.
4. Paste the plugin's **folder URL** from the table above.
5. Keep the trailing `/` at the end of the URL.
6. Install the plugin, then reload Kettu if the plugin does not activate immediately.

### Important URL format

Kettu expects a source folder, not a direct link to `manifest.json`.

Correct:

```text
https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/media/
```

Do not use:

```text
https://github.com/Artkos078/kettu-plugins/tree/main/media
https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/media/manifest.json
```

## Plugin structure

A normal install folder contains at least:

```text
plugin-folder/
├── manifest.json
└── index.js
```

Some plugins may use another JavaScript entry file such as `loader.js`; the manifest's `main` field determines which file Kettu loads.

## Media Gestures

`media/` is the current media plugin and the recommended option for video controls.

Features:

- Uses Kettu/Discord's built-in media viewer.
- No native iOS video-player handoff.
- Double-tap left to rewind.
- Double-tap right to skip forward.
- Configurable skip amount and double-tap window.
- Gesture hit areas are restricted to the middle portion of the viewer so Discord controls remain accessible.

Install:

```text
https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/media/
```

## HumanizeGPT

HumanizeGPT intercepts `/humanize`, `/humanise`, or `/hgpt` messages, asks OpenAI to rewrite the supplied text, and posts only the rewritten result. Add an OpenAI API key in the plugin settings; the key remains in Kettu's local plugin storage.

Install:

```text
https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/HumanizeGPT/
```

## PrivateChats

PrivateChats is intended for local privacy inside Kettu. Current features include protected DMs/servers, passcode locking, auto-lock behavior, route blocking, and context-menu protection.

Protection is implemented inside the modified client. It should not be treated as encryption of Discord data or as a replacement for device-level security.

## Troubleshooting

### `Failed to fetch manifest`

Check that:

- the URL ends with `/`;
- the URL points to a folder containing `manifest.json`;
- you are using `raw.githubusercontent.com`, not a normal GitHub `tree` page;
- the repository and folder are public and spelled exactly as shown.

### `Failed to fetch JS`

The manifest loaded, but Kettu could not retrieve the JavaScript file named by the manifest's `main` field. Confirm that the file exists in the same folder and that capitalization matches exactly.

### Plugin installs but changes do not appear

Disable and re-enable the plugin or reload Kettu. If an updated plugin is still cached, remove it and install it again from the same source URL.

## Repository layout

```text
kettu-plugins/
├── HumanizeGPT/              # OpenAI-powered message rewriting
├── media/                    # Current media gestures plugin
├── plugins/
│   ├── ExactTimestamps-v2/    # Precise inline timestamps
│   ├── PrivateChats-v9/
│   ├── NativeVideoPlayer-v2/ # Older/experimental media implementation
│   └── VideoSkipGestures-v3/ # Older media gesture implementation
└── README.md
```

## Legacy / experimental folders

`NativeVideoPlayer-v2` and `VideoSkipGestures-v3` are retained for reference and testing. For normal use, install the current `media/` plugin instead.

## Updating

Installed plugins use files from the `main` branch. When a plugin is changed, its manifest version/hash should also be updated so Kettu can recognize the new revision.

---

Maintained in `Artkos078/kettu-plugins` for Kettu on iOS.
