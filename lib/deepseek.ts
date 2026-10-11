// DeepSeek chat completion — SERVER ONLY. OpenAI-compatible endpoint, with an
// optional function-calling loop so the bot can pull live info via tools
// (e.g. web search for match/player analysis or off-topic questions).
// Docs: https://api.deepseek.com (model `deepseek-chat`).

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatMsg = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type Opts = {
  tools?: Tool[];
  onTool?: (name: string, args: Record<string, unknown>) => Promise<string>;
  maxRounds?: number;
};

const URL = "https://api.deepseek.com/chat/completions";

async function callApi(messages: ChatMsg[], tools?: Tool[]) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY missing");

  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      temperature: 1.1, // playful/varied — this is a troll bot, not a tax form
      max_tokens: 800,
      ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DeepSeek ${res.status}: ${text}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: ChatMsg }[];
  };
  return data.choices?.[0]?.message ?? null;
}

// Runs the completion. With tools + onTool, loops: let the model call tools,
// feed results back, repeat (up to maxRounds), then return the final text.
export async function deepseekChat(messages: ChatMsg[], opts: Opts = {}): Promise<string> {
  const { tools, onTool, maxRounds = 3 } = opts;
  const msgs = [...messages];

  for (let round = 0; round < maxRounds; round++) {
    const msg = await callApi(msgs, tools);
    if (!msg) return "";

    if (onTool && msg.tool_calls?.length) {
      msgs.push(msg); // assistant turn carrying the tool_calls
      for (const tc of msg.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          /* leave empty */
        }
        let result: string;
        try {
          result = await onTool(tc.function.name, args);
        } catch (e) {
          result = `Tool lỗi: ${e instanceof Error ? e.message : String(e)}`;
        }
        msgs.push({ role: "tool", tool_call_id: tc.id, content: result });
      }
      continue; // ask the model again with the tool results in hand
    }

    return (msg.content ?? "").trim();
  }

  // Ran out of tool rounds — force a final answer with no further tool calls.
  const final = await callApi(msgs, undefined);
  return (final?.content ?? "").trim();
}
