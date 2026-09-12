(() => {
  "use strict";

  const { findByProps, findByStoreName } = vendetta.metro;
  const messageActions = findByProps("sendMessage", "editMessage") || findByProps("sendMessage");
  const reactionActions = findByProps("addReaction", "removeReaction") || findByProps("addReaction");
  const messageStore = findByStoreName?.("MessageStore");

  const LETTERS = ["🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮", "🇯"];
  let unregisterCommand;

  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  function optionValue(options, index) {
    return options?.[index]?.value == null ? "" : String(options[index].value).trim();
  }

  function parseChoices(raw) {
    const choices = (raw || "Yes, No")
      .split(/[,\n|]/)
      .map((choice) => choice.trim())
      .filter(Boolean)
      .slice(0, LETTERS.length);

    return choices.length >= 2 ? choices : ["Yes", "No"];
  }

  function messageArray(collection) {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection._array)) return collection._array;
    if (typeof collection.toArray === "function") return collection.toArray();
    if (typeof collection.values === "function") return Array.from(collection.values());
    return [];
  }

  async function resolveMessageId(channelId, nonce, content, response) {
    const immediate = response?.id || response?.message?.id || response?.body?.id || response?.body?.message?.id;
    if (immediate) return immediate;

    for (let attempt = 0; attempt < 8; attempt++) {
      await wait(250);
      const messages = messageArray(messageStore?.getMessages?.(channelId));
      const match = [...messages].reverse().find(
        (message) => String(message?.nonce || "") === String(nonce) || message?.content === content,
      );
      if (match?.id) return match.id;
    }

    return null;
  }

  async function addReaction(channelId, messageId, emoji) {
    if (!reactionActions?.addReaction) throw new Error("Discord reaction actions were not found");
    try {
      await reactionActions.addReaction(channelId, messageId, { name: emoji });
    } catch (_) {
      await reactionActions.addReaction(channelId, messageId, emoji);
    }
  }

  const pollCommand = {
    name: "poll",
    displayName: "poll",
    description: "Create a reaction poll in this chat",
    displayDescription: "Create a reaction poll in this chat",
    options: [
      {
        name: "question",
        displayName: "question",
        description: "The question to ask",
        displayDescription: "The question to ask",
        type: 3,
        required: true,
      },
      {
        name: "choices",
        displayName: "choices",
        description: "Comma-separated choices (default: Yes, No; maximum: 10)",
        displayDescription: "Comma-separated choices (default: Yes, No; maximum: 10)",
        type: 3,
        required: false,
      },
    ],

    async execute(options, context) {
      const channelId = context?.channel?.id;
      const question = optionValue(options, 0);
      const choices = parseChoices(optionValue(options, 1));

      if (!channelId) return { content: "Poll failed: this chat has no channel ID." };
      if (!question) return { content: "Poll failed: enter a question." };
      if (!messageActions?.sendMessage) return { content: "Poll failed: Kettu could not find Discord's message sender." };

      const lines = choices.map((choice, index) => `${LETTERS[index]}  ${choice}`);
      const content = [`📊 **${question.replace(/\*\*/g, "")}**`, "", ...lines, "", "React below to vote."].join("\n");
      const nonce = (BigInt(Date.now() - 1420070400000) << 22n).toString();

      const response = await messageActions.sendMessage(channelId, { content }, undefined, { nonce });
      const messageId = await resolveMessageId(channelId, nonce, content, response);

      if (!messageId) {
        vendetta.logger?.warn?.("Poll was sent, but its message ID could not be resolved for reactions.");
        return;
      }

      for (let index = 0; index < choices.length; index++) {
        try {
          await addReaction(channelId, messageId, LETTERS[index]);
        } catch (error) {
          vendetta.logger?.error?.("Failed to add poll reaction", error);
          break;
        }
      }
    },
  };

  return {
    onLoad() {
      unregisterCommand = vendetta.commands.registerCommand(pollCommand);
    },
    onUnload() {
      unregisterCommand?.();
      unregisterCommand = undefined;
    },
  };
})()
