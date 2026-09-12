# Kettu Poll Command

Adds `/poll` to every Discord chat supported by Kettu: servers, DMs, and group DMs.

## Usage

`/poll question: Best time? choices: Morning, Afternoon, Evening`

The `choices` field accepts 2–10 comma-separated choices. If omitted, the poll uses `Yes` and `No`. The plugin sends the poll and adds clickable letter reactions automatically.

## Install

Host this folder and add the folder URL to Kettu. Kettu fetches `manifest.json` and then `index.js`; use the folder URL rather than the direct manifest URL.

After installing or updating, enable the plugin and fully restart Discord once so the slash-command list is rebuilt.
