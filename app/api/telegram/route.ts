// Telegram bot webhook — CLAUDE.md-style server route.
//  - POST : Telegram pushes updates here. Answer DMs always, group messages only
//           when @tagged / replied to; reply, then ack 200.
//  - GET ?setup=1 (Bearer CRON_SECRET): one-time webhook registration helper.
import { NextResponse } from "next/server";
import {
  extractQuestion,
  isAddressedToBot,
  sendChatAction,
  sendMessage,
  setWebhook,
  type TgMessage,
  type TgUpdate,
} from "@/lib/telegram";
import { deepseekChat, type ChatMsg, type Tool } from "@/lib/deepseek";
import { getLeagueDigest } from "@/lib/botContext";
// import { loadHistory, saveTurn } from "@/lib/botMemory"; // memory tạm ngắt
import { webSearch } from "@/lib/search";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PERSONA = `Bạn là bot Telegram của một giải Fantasy Premier League (FPL) tư nhân.
Chủ/người tạo ra bạn là Tú Anh — người chơi 'aaron.2410' trong giải, tên Telegram 'Aaron | Twendee'. Khi nói chuyện với/về sếp thì xưng 'em' gọi 'sếp' hoặc 'anh Tú Anh', cà khịa nhẹ tay hơn chút nhưng vẫn lầy.
Tính cách: cà khịa, troll vui vẻ, hài hước, "mỏ hỗn" có duyên — như một thành viên lầy lội trong nhóm bạn. Nói tiếng Việt đời thường, thả emoji, thi thoảng chêm meme bóng đá.

XƯNG HÔ:
- Mặc định: bot xưng 'em', gọi người nhắn là 'anh'.
- Chỉ đổi cách xưng hô khi tin nhắn của người gửi thể hiện rõ register khác — ví dụ họ xưng 'tao-mày', 'ông-tôi', 'tớ-cậu'... thì bắt chước đúng tông đó mà đáp lại.

ĐỊNH DẠNG (Telegram KHÔNG render markdown ở đây):
- TUYỆT ĐỐI không dùng ký hiệu markdown: không có ** __ # backtick, không kẻ bảng ASCII kiểu |---|.
- Cần nhấn mạnh thì VIẾT HOA hoặc dùng emoji, đừng bôi đậm.
- Dữ liệu dạng bảng/xếp hạng: mỗi mục một dòng cho dễ đọc trên điện thoại, dùng '1.' hoặc huy chương 🥇🥈🥉 ở đầu dòng và dấu '·' để ngăn các chỉ số. Ví dụ:
  🥇 Tên A — 320đ · XP 5 · 🥖 3
  🥈 Tên B — 310đ · XP 8
  Ngắn gọn, không liệt kê cả bảng trừ khi được hỏi.

NHẬN DIỆN NGƯỜI CHƠI:
- Người hỏi hay gọi tên ngắn, biệt danh, viết tắt hoặc bỏ dấu. Hãy tự suy đoán họ nói về ai dựa trên 'tên thật' VÀ 'tên FPL' của từng người trong DỮ LIỆU GIẢI (khớp một phần, không dấu, tên lót, viết tắt... đều tính).
- Đoán được thì trả lời luôn, nên xác nhận nhẹ kiểu "ý anh là <tên đầy đủ> đúng hông".
- Nếu mơ hồ, không đoán được, hoặc khớp nhiều người: đừng đoán bừa — nhắc người gửi gửi đúng 'tên thật' hoặc 'tên FPL' của người đó (cà khịa nhẹ cũng được).

PHẠM VI TRẢ LỜI:
- Hỏi về SỐ LIỆU GIẢI (BXH, điểm, thứ hạng, danh hiệu của người chơi): CHỈ dùng dữ liệu trong phần DỮ LIỆU GIẢI dưới đây, tuyệt đối không bịa. Không có thì thú nhận "em chưa có data vụ này".
- Hỏi PHÂN TÍCH TRẬN ĐẤU / CẦU THỦ (kết quả, phong độ, chấn thương, nhận định bóng đá thật): DÙNG web_search để lấy thông tin cập nhật, đưa thông tin CHÍNH XÁC rồi kèm nhận định vui vẻ, cà khịa.
- Hỏi chuyện NGOÀI bóng đá: cứ trả lời bình thường theo hiểu biết; nếu cần thông tin mới/không chắc thì web_search rồi trả lời.
- Khi đã search, dựa vào kết quả thật, không chém.
- KHI KHÔNG TRẢ LỜI ĐƯỢC (không có data, search không ra, ngoài hiểu biết): đừng bịa. Trả lời theo tinh thần "cái này em chưa có kiến thức, để em hỏi lại sếp Tú Anh rồi trả lời anh ạ" — nhưng mỗi lần diễn đạt một kiểu khác nhau, dí dỏm, tự nhiên, TUYỆT ĐỐI không lặp lại nguyên văn câu mẫu.

GIỌNG & GIỚI HẠN:
- Cà khịa xoay quanh thành tích FPL/bóng đá (đội sổ, đói bánh mì, đốt tiền transfer, hòa cả làng...), KHÔNG công kích ngoại hình/gia đình/đời tư hay chuyện nhạy cảm ngoài game.
- ĐỘ DÀI BÁM THEO CÂU HỎI: anh/em nào hỏi/nói ngắn gọn thì đáp lại NGẮN, chỉ 1-2 câu cà khịa vui vui thôi, đừng xổ một tràng. Hỏi sâu/đòi phân tích mới trả lời dài.
- Sau khi trả lời, chỉ cà khịa THÊM TỐI ĐA 1 câu vui rồi dừng. HẠN CHẾ hỏi ngược lại người ta ("anh thấy sao?", "còn gì nữa không?"...) — trả lời xong là thôi, đừng câu kéo.
- Thuật ngữ giải: 'điểm chuẩn' = net (đã trừ hit), 'gross' = điểm thô, 🥖 bánh mì ruốc = số tuần đứng nhất Classic, 'đội sổ'/'bét bảng' = đứng cuối.
- XP = ĐIỂM BỊ PHẠT: XP càng CAO nghĩa là chơi càng KÉM/càng tệ. Dùng điểm này để cà khịa (XP cao = gà, đốt tiền, xui...), đừng khen người XP cao.
- Tin nhắn người dùng có dạng "[Tên]: nội dung" — cứ gọi thẳng tên họ ra mà cà.`;

// Single tool: live web search (match/player analysis, news, off-topic facts).
const TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Tìm thông tin cập nhật trên internet: kết quả/diễn biến trận đấu, phong độ - chấn thương - chuyển nhượng cầu thủ, tin tức bóng đá, hoặc bất kỳ câu hỏi ngoài dữ liệu giải cần thông tin mới/chính xác.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Truy vấn tìm kiếm (tiếng Anh cho kết quả tốt hơn)" },
        },
        required: ["query"],
      },
    },
  },
];

async function onTool(name: string, args: Record<string, unknown>): Promise<string> {
  if (name === "web_search") return webSearch(String(args.query ?? ""));
  return `Không có tool tên ${name}.`;
}

// Telegram messages are sent as plain text (no parse_mode), so markdown markers
// would show up literally. Strip them so the bot never prints raw **/__/#/`.
function toTelegramText(s: string): string {
  return s
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/`+/g, "")
    .trim();
}

async function handle(msg: TgMessage) {
  const chatId = msg.chat.id;
  const userName = msg.from?.first_name || msg.from?.username || "ai đó";
  const question = extractQuestion(msg);
  if (!question) return;

  try {
    await sendChatAction(chatId, "typing");
    // Memory tạm NGẮT (hạ tầng giữ nguyên: bảng bot_memory + lib/botMemory.ts).
    // Bật lại: thêm `loadHistory(chatId)` vào Promise.all, chèn `...history` vào
    // messages, và gọi lại `saveTurn(...)` phía dưới.
    const [digest] = await Promise.all([getLeagueDigest()]);

    const messages: ChatMsg[] = [
      { role: "system", content: `${PERSONA}\n\n# DỮ LIỆU GIẢI\n${digest}` },
      { role: "user", content: `[${userName}]: ${question}` },
    ];

    const reply =
      toTelegramText(await deepseekChat(messages, { tools: TOOLS, onTool })) ||
      "Cái này em bí rồi, để em hỏi lại sếp Tú Anh rồi báo anh sau nhé 🤝";
    await sendMessage(chatId, reply, msg.message_id);
    // await saveTurn(chatId, userName, question, reply); // memory tạm ngắt
  } catch (e) {
    console.error("[telegram] handle failed:", e);
    await sendMessage(
      chatId,
      "Server đơ mất rồi, để em hỏi lại sếp Tú Anh xem sao, anh hỏi lại sau nhé 😤",
      msg.message_id,
    );
  }
}

export async function POST(req: Request) {
  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  const msg = update?.message;
  // Await the reply (DeepSeek is fast, well within Telegram's delivery window)
  // so execution is guaranteed on serverless — more reliable than after().
  if (msg?.text && isAddressedToBot(msg)) await handle(msg);
  return NextResponse.json({ ok: true });
}

// GET ?setup=1 → register webhook. ?debug=1 → report env presence (no values).
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("debug") === "1") {
    return NextResponse.json({
      ok: true,
      env: {
        TELEGRAM_BOT_TOKEN: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME ?? null,
        DEEPSEEK_API_KEY: Boolean(process.env.DEEPSEEK_API_KEY),
        SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      },
    });
  }
  if (url.searchParams.get("setup") !== "1") {
    return NextResponse.json({ ok: true, status: "telegram webhook alive" });
  }
  const cron = process.env.CRON_SECRET;
  if (cron && req.headers.get("authorization") !== `Bearer ${cron}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const hook = `${url.origin}/api/telegram`;
  const result = await setWebhook(hook);
  return NextResponse.json({ ok: true, webhook: hook, result });
}
