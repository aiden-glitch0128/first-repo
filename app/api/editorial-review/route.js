import { NextResponse } from "next/server";

const SYSTEM = `너는 '끝까지'의 총괄 편집장이다. 목표는 저자가 실제로 책 한 권을 완성하도록 돕는 것이다. 소재 분석은 주제 연결성, 관점 다양성, 집필 가능성, 책 구성 가능성을 균형 있게 검토한다. 소재 개수가 목표 미만이어도 충분하면 갈무리를 제안할 수 있다. 소재를 억지로 하나의 주제로 묶지 말고 판단 근거와 불확실성을 밝힌다. 저자 대신 책을 쓰거나 원고를 임의 수정하지 않는다. 답변은 한국어로 구체적이고 간결하게. 반드시 JSON 객체만 반환: {"summary":"전체 진단","connections":"주제 연결성 및 중심 메시지 후보","diversity":"관점 다양성","gaps":"부족한 소재와 보완 방향","readiness":"지금 갈무리 가능한지 및 이유","nextAction":"다음에 할 한 가지 행동","questions":["저자에게 할 질문 1","질문 2","질문 3"]}.`;

export async function POST(request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "AI 편집장이 아직 연결되지 않았습니다. 서버 환경변수 OPENAI_API_KEY를 설정해 주세요." }, { status: 503 });
  }
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const title = typeof body?.projectTitle === "string" ? body.projectTitle.slice(0, 200) : "내 첫 책";
  const goal = Number.isInteger(body?.materialGoal) ? Math.max(1, Math.min(500, body.materialGoal)) : 40;
  const items = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) return NextResponse.json({ error: "먼저 소재를 하나 이상 등록해 주세요." }, { status: 400 });
  if (items.length > 250) return NextResponse.json({ error: "한 번에 분석할 수 있는 소재는 최대 250개입니다." }, { status: 400 });
  const materials = items.map((i) => ({
    title: String(i?.title || "").slice(0, 160),
    body: String(i?.body || "").slice(0, 1200)
  }));
  const payload = JSON.stringify({ projectTitle: title, materialGoal: goal, materials });
  if (payload.length > 110000) return NextResponse.json({ error: "소재 내용이 너무 길어 분석할 수 없습니다." }, { status: 400 });
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        max_tokens: 1200,
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: payload }]
      }),
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) {
      return NextResponse.json({ error: "AI 분석 요청에 실패했습니다. API 설정과 사용량을 확인해 주세요." }, { status: 502 });
    }
    const data = await response.json();
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content || "{}");
    const keys = ["summary", "connections", "diversity", "gaps", "readiness", "nextAction"];
    if (keys.some((k) => typeof parsed[k] !== "string") || !Array.isArray(parsed.questions)) throw new Error("invalid response");
    return NextResponse.json({ review: Object.fromEntries([...keys.map((k) => [k, parsed[k].slice(0, 3000)]), ["questions", parsed.questions.filter((q) => typeof q === "string").slice(0, 3)]] ) });
  } catch {
    return NextResponse.json({ error: "AI 분석 결과를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
