import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

// Private single-author MVP. A shared access code is NOT user authentication.
// Requests fail closed until both secrets are configured.
const hits = new Map();
export function authorizeEditor(request) {
  const expected = process.env.EDITOR_ACCESS_TOKEN;
  if (!expected || expected.length < 20) {
    return NextResponse.json({ error: "AI 편집국은 아직 비활성 상태입니다. 20자 이상의 EDITOR_ACCESS_TOKEN을 서버에 설정해 주세요." }, { status: 503 });
  }
  const received = request.headers.get("x-editor-access") || "";
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "편집국 접근 코드가 올바르지 않습니다." }, { status: 401 });
  }
  const now = Date.now();
  const bucket = hits.get(received) || [];
  const recent = bucket.filter((time) => now - time < 3600000);
  if (recent.length >= 12) {
    hits.set(received, recent);
    return NextResponse.json({ error: "한 시간에 AI 요청은 최대 12회까지 가능합니다." }, { status: 429 });
  }
  hits.set(received, [...recent, now]);
  // In-memory throttling is per instance and resets on serverless cold starts.
  if (hits.size > 100) for (const [key, values] of hits) if (!values.some((t) => now - t < 3600000)) hits.delete(key);
  return null;
}
