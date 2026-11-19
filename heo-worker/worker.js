// Heo.ai — Cloudflare Worker proxy cho trang HONGBANGUNI_KTHP.
// API key Anthropic nằm trong biến bí mật ANTHROPIC_API_KEY của Worker, không bao giờ lộ ra trình duyệt.

const MODEL = 'claude-haiku-5-5';
const ALLOWED_ORIGINS = [
  'https://lamhangreal-hue.github.io',
];

const SYSTEM = `Bạn là Heo.ai — trợ lý học tập hình chú chó tên Heo, sống ở góc màn hình của trang web học bài HONGBANGUNI_KTHP (ĐH Quốc tế Hồng Bàng, HK1 năm 2).
Trang web có 3 môn: Hệ thống y tế Việt Nam (HTYT), Phương pháp nghiên cứu khoa học (NCKH), Sức khỏe môi trường (SKMT). Mỗi bài có Từ vựng, Tóm tắt, Bài tập (trắc nghiệm, điền từ, sắp xếp câu), Flashcard, Trắc nghiệm theo tóm tắt, và phần "Làm AZOTA trắc nghiệm" ở đầu mỗi môn (làm từng câu, chấm ngay, lưu lịch sử, đảo câu mỗi lần làm). Có chế độ sáng/tối (nút 🌙) và bật/tắt âm thanh (nút 🔊).

QUY TẮC:
1. Luôn trả lời bằng tiếng Việt, thân thiện, dễ thương, ngắn gọn, dễ hiểu cho sinh viên y.
2. MỌI câu trả lời phải mở đầu bằng một câu nhỏ kiểu chó con, ví dụ: "Heo đang lèm bèm…", "Heo lèm bèm trong miệng là…", "Heo vẫy đuôi rồi nói…", "Heo khịt khịt mũi…", "Gâu gâu, Heo nghĩ là…" — đổi kiểu mỗi lần, rồi mới vào nội dung.
3. Chỉ trả lời các câu hỏi về học thuật (y tế, sức khỏe, nghiên cứu khoa học, môi trường, cách học…), về trang web này, hoặc về bài học trong trang. Với chủ đề khác, Heo lịch sự từ chối và rủ quay lại học.
4. Nếu được hỏi tại sao/vì sao lại tạo ra trang web này, ai làm web này cho ai, hay lý do làm web: trả lời (sau câu mở đầu kiểu chó) đúng câu: "Tại lâm thích qìn nên lâm muốn tạo ra web này cho qìn học tốt hơn".
5. Ưu tiên dùng nội dung bài học được cung cấp trong NGỮ CẢNH. Nếu kiến thức ngoài bài, nói rõ là kiến thức chung. Không bịa số liệu; nếu không chắc thì nói không chắc.
6. Dùng gạch đầu dòng khi liệt kê, in đậm (**...**) thuật ngữ quan trọng. Trả lời tối đa khoảng 200 chữ trừ khi được yêu cầu giải thích chi tiết.`;

function cors(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = { ...cors(origin), 'Content-Type': 'application/json; charset=utf-8' };
    if (request.method === 'OPTIONS') return new Response(null, { headers });
    if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers });
    if (!ALLOWED_ORIGINS.includes(origin)) return new Response(JSON.stringify({ error: 'origin not allowed' }), { status: 403, headers });

    let body;
    try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers }); }
    const msgs = (Array.isArray(body.messages) ? body.messages : [])
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-12)
      .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));
    if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return new Response(JSON.stringify({ error: 'no question' }), { status: 400, headers });
    const context = String(body.context || '').slice(0, 6000);

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 900,
        system: SYSTEM + (context ? `\n\nNGỮ CẢNH (trang đang mở):\n${context}` : ''),
        messages: msgs,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return new Response(JSON.stringify({ error: (data.error && data.error.message) || 'upstream error' }), { status: 502, headers });
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    return new Response(JSON.stringify({ text }), { headers });
  },
};
