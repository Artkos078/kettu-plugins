# HumanizeGPT for Kettu

Type `/humanize` followed by text in any Discord chat, then press Send. The plugin prevents the command from being posted, asks OpenAI to rewrite it naturally, and posts only the rewritten result.

## Setup

1. Install `https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/HumanizeGPT/` in Kettu.
2. Open HumanizeGPT settings.
3. Paste an OpenAI API key and save it.
4. Send `/humanize your text here` in a Discord channel or DM.

The API key is kept in Kettu's local plugin storage and is not included in this repository. A ChatGPT Plus subscription does not itself provide API credits.

## Commands

- `/humanize your text` — rewrite and send.
- `/humanise your text` — alternate spelling.
- `/hgpt your text` — short alias.

Messages without one of these prefixes are not changed.
