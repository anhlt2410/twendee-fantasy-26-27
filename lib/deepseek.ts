// DeepSeek chat completion — SERVER ONLY. OpenAI-compatible endpoint.
// Docs: https://api.deepseek.com (model `deepseek-chat`).

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

const URL = "https://api.deepseek.com/chat/completions";

export async function deepseekChat(messages: ChatMsg[]): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY missing");

  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      temperature: 1.1, // playful/varied — this is a troll bot, not a tax form
      max_tokens: 700,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DeepSeek ${res.status}: ${text}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}
