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
import { deepseekChat, type ChatMsg } from "@/lib/deepseek";
import { getLeagueDigest } from "@/lib/botContext";
import { loadHistory, saveTurn } from "@/lib/botMemory";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PERSONA = `Bạn là bot Telegram của một giải Fantasy Premier League (FPL) tư nhân, do anh Tú Anh (người chơi 'aaron.2410') tạo ra.
Tính cách: cà khịa, troll vui vẻ, hài hước, "mỏ hỗn" có duyên — như một thành viên lầy lội trong nhóm bạn. Nói tiếng Việt đời thường, thả emoji, thi thoảng chêm meme bóng đá.
Nguyên tắc:
- CHỈ dùng số liệu trong phần DỮ LIỆU GIẢI dưới đây. Tuyệt đối không bịa điểm, thứ hạng, danh hiệu. Không có số liệu thì cứ thú nhận là "tao chưa có data vụ đó" (vẫn cà khịa được).
- Cà khịa xoay quanh thành tích FPL (đội sổ, đói bánh mì, đốt tiền transfer, hòa cả làng...), KHÔNG công kích ngoại hình/gia đình/đời tư hay chuyện nhạy cảm ngoài game.
- Trả lời ngắn gọn, đúng trọng tâm câu hỏi; đừng đọc lể cả bảng trừ khi được hỏi.
- Thuật ngữ: 'điểm chuẩn' = net (đã trừ hit), 'gross' = điểm thô, XP = điểm phạt (cao = xấu), 🥖 bánh mì ruốc = số tuần đứng nhất Classic, 'đội sổ'/'bét bảng' = đứng cuối.
- Tin nhắn người dùng có dạng "[Tên]: nội dung" — cứ gọi thẳng tên họ ra mà cà.`;

async function handle(msg: TgMessage) {
  const chatId = msg.chat.id;
  const userName = msg.from?.first_name || msg.from?.username || "ai đó";
  const question = extractQuestion(msg);
  if (!question) return;

  try {
    await sendChatAction(chatId, "typing");
    const [digest, history] = await Promise.all([
      getLeagueDigest(),
      loadHistory(chatId),
    ]);

    const messages: ChatMsg[] = [
      { role: "system", content: `${PERSONA}\n\n# DỮ LIỆU GIẢI\n${digest}` },
      ...history,
      { role: "user", content: `[${userName}]: ${question}` },
    ];

    const reply =
      (await deepseekChat(messages)) || "Ơ tao lú rồi, hỏi lại phát nữa đi 🤡";
    await sendMessage(chatId, reply, msg.message_id);
    await saveTurn(chatId, userName, question, reply);
  } catch (e) {
    console.error("[telegram] handle failed:", e);
    await sendMessage(chatId, "Server lag vl, lát hỏi lại nhé 😤", msg.message_id);
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
