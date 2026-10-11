// Web search for the bot's `web_search` tool — SERVER ONLY.
// Uses Tavily (LLM-friendly, free tier). If TAVILY_API_KEY is unset the bot
// degrades gracefully: it just answers from its own knowledge instead.

type TavilyResult = { title: string; content: string; url: string };
type TavilyResponse = { answer?: string; results?: TavilyResult[] };

export async function webSearch(query: string): Promise<string> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    return "Không có công cụ search (chưa cấu hình). Trả lời theo hiểu biết sẵn có, và nói rõ là không chắc về thông tin mới nhất.";
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: 5,
        search_depth: "basic",
        include_answer: true,
      }),
      cache: "no-store",
    });
    if (!res.ok) return `Search lỗi ${res.status}. Trả lời theo hiểu biết sẵn có.`;

    const d = (await res.json()) as TavilyResponse;
    const parts: string[] = [];
    if (d.answer) parts.push(`Tóm tắt: ${d.answer}`);
    for (const r of d.results ?? []) {
      parts.push(`- ${r.title}: ${r.content} (${r.url})`);
    }
    return parts.join("\n").slice(0, 4000) || "Không tìm thấy kết quả.";
  } catch (e) {
    return `Search lỗi: ${e instanceof Error ? e.message : String(e)}`;
  }
}
