# Exact Timestamps for Kettu

Displays precise Discord message creation times in Kettu.

Version 1.1.0 directly patches Kettu's inline Discord timestamp parser. Smart
mode shows relative timestamp pills down to seconds and absolute pills with
seconds and the UTC offset. Discord inline timestamps only contain whole Unix
seconds, so the plugin does not invent nonexistent milliseconds for them.

Features:

- exact local or UTC timestamps;
- optional seconds and milliseconds;
- 12-hour or 24-hour clock;
- relative, exact, or combined display;
- creation time derived from the Discord snowflake when available;
- edited timestamps handled separately;
- long-press a timestamp to copy its exact time, message ID, or both;
- optional ungrouped messages so every message shows its timestamp.

Install this folder URL in Kettu:

```text
https://raw.githubusercontent.com/Artkos078/kettu-plugins/main/plugins/ExactTimestamps-v1/
```

Keep the trailing slash.
