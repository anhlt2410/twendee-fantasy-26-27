// Telegram Bot API helpers — SERVER ONLY (uses TELEGRAM_BOT_TOKEN).
// Thin wrappers over the HTTP API + update parsing / @mention detection.

const API = "https://api.telegram.org/bot";

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN missing");
  return t;
}

async function call(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${API}${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[telegram] ${method} → ${res.status} ${text}`);
  }
  return res.json().catch(() => null);
}

// Telegram caps messages at 4096 chars; keep margin + no parse_mode so the LLM's
// free-form text (which may contain stray * _ [ ]) never trips entity parsing.
export function sendMessage(chatId: number, text: string, replyTo?: number) {
  return call("sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 4000),
    reply_to_message_id: replyTo,
    allow_sending_without_reply: true,
  });
}

export function sendChatAction(chatId: number, action = "typing") {
  return call("sendChatAction", { chat_id: chatId, action });
}

// Point Telegram at our webhook (one-time setup).
export function setWebhook(url: string) {
  return call("setWebhook", {
    url,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
}

// ─────────────────────────── update shapes (subset) ───────────────────────────
type Entity = { type: string; offset: number; length: number };
export type TgMessage = {
  message_id: number;
  text?: string;
  chat: { id: number; type?: string };
  from?: { first_name?: string; username?: string };
  entities?: Entity[];
  reply_to_message?: { from?: { username?: string } };
  // Present when the user manually quoted a snippet while replying.
  quote?: { text?: string };
  // Present when the message is forwarded from elsewhere.
  forward_origin?: unknown;
  forward_date?: number;
};
export type TgUpdate = { update_id: number; message?: TgMessage };

// Should the bot answer this message?
//  - Private chat (DM): always — there's no one else to tag.
//  - Group/supergroup: only when DIRECTLY addressed —
//      (a) a PLAIN reply to one of the bot's messages (no quoted snippet), or
//      (b) an @BotUsername tag the user typed themselves.
//    Ignored: forwarded messages, replies that quote a snippet, and quotes of
//    someone else's message — even if the bot's name appears inside them. Quoted
//    text lives in `quote`, not `text`, and forwarded text is guarded out, so a
//    @mention only counts when it's in the user's own typed `text`.
export function isAddressedToBot(msg: TgMessage): boolean {
  if (msg.chat.type === "private") return true;

  // Forwarded content → never auto-answer (its text/mentions aren't the sender's).
  if (msg.forward_origin || msg.forward_date) return false;

  const uname = (process.env.TELEGRAM_BOT_USERNAME ?? "").replace(/^@/, "").toLowerCase();
  if (!uname) return false;

  // (a) plain reply to the bot — but NOT a reply that quotes a snippet.
  if (!msg.quote && msg.reply_to_message?.from?.username?.toLowerCase() === uname) {
    return true;
  }

  // (b) @tag the user typed in their own text (quoted text is in `quote`, not here).
  const text = (msg.text ?? "").toLowerCase();
  if (text.includes(`@${uname}`)) return true; // covers mention + /cmd@bot
  return false;
}

// Strip every @mention so the model sees only the question.
export function extractQuestion(msg: TgMessage): string {
  return (msg.text ?? "").replace(/@\w+/g, "").replace(/\s+/g, " ").trim();
}
