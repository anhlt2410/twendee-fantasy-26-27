// Per-group chat memory for the Telegram bot (table: bot_memory).
// Scoped by chat_id → each group is an isolated session. Writes go through the
// service-role client (bypasses RLS); never import from client code.

import { supabaseAdmin } from "./supabase";
import type { ChatMsg } from "./deepseek";

// Last `limit` turns for a chat, oldest→newest, shaped for the LLM. User turns
// keep the speaker name so the bot can roast the right person.
export async function loadHistory(chatId: number, limit = 16): Promise<ChatMsg[]> {
  const { data } = await supabaseAdmin()
    .from("bot_memory")
    .select("role, user_name, content")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? [])
    .reverse()
    .map((r) => ({
      role: r.role as "user" | "assistant",
      content:
        r.role === "user" && r.user_name ? `[${r.user_name}]: ${r.content}` : r.content,
    }));
}

export async function saveTurn(
  chatId: number,
  userName: string,
  question: string,
  reply: string,
): Promise<void> {
  await supabaseAdmin()
    .from("bot_memory")
    .insert([
      { chat_id: chatId, role: "user", user_name: userName, content: question },
      { chat_id: chatId, role: "assistant", content: reply },
    ]);
}
