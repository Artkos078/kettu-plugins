# Bypass Size Limit for Kettu

Mobile Discord uploads are handled before normal `fetch`/XHR calls, so this plugin uses the Kettu/Revenge mobile pattern instead: it patches Discord's `CloudUpload` object, uploads large files to Catbox or Litterbox, cancels the failing Discord upload, and sends a link in the current chat.

## Install

Use this plugin URL in Kettu:

```text
https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/plugins/BypassSizeLimit-v1/
```

Restart Discord/Kettu after updating the plugin.

## Behavior

- Files up to 10 MB upload normally through Discord.
- Files from 10 MB to 200 MB upload to Catbox.
- Files from 200 MB to 1 GB upload to Litterbox for 1 hour.
- The plugin sends the resulting link in the current channel or DM. If sending fails, it copies the link.

## Status

Open the plugin settings page and check `Mobile upload hook`. It should say `active`. If it says `inactive`, Kettu could not find Discord's mobile upload module on that build.
