// Server-only AI provider adapter. Never expose provider keys to client components.
const PROVIDERS = {
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    keyName: "GEMINI_API_KEY",
    modelName: "GEMINI_MODEL",
    defaultModel: "gemini-2.5-flash",
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    keyName: "OPENAI_API_KEY",
    modelName: "OPENAI_MODEL",
    defaultModel: "gpt-4o-mini",
  },
};

export function providerAvailable(provider) {
  const config = PROVIDERS[provider];
  return Boolean(config && process.env[config.keyName]);
}

export async function requestEditorialAI({ provider = "gemini", system, user, maxTokens = 1200 }) {
  const config = PROVIDERS[provider];
  if (!config) {
    const error = new Error("지원하지 않는 AI 제공업체입니다.");
    error.status = 400;
    throw error;
  }
  const key = process.env[config.keyName];
  if (!key) {
    const error = new Error(provider === "gemini"
      ? "GEMINI_API_KEY가 설정되지 않았습니다."
      : "OPENAI_API_KEY가 설정되지 않았습니다.");
    error.status = 503;
    throw error;
  }
  const response = await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env[config.modelName] || config.defaultModel,
      response_format: { type: "json_object" },
      max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    // Do not forward provider error bodies, which may contain sensitive details.
    const error = new Error("AI 제공업체 요청에 실패했습니다. API 키, 모델명, 사용량 및 결제 설정을 확인해 주세요.");
    error.status = 502;
    throw error;
  }
  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (typeof raw !== "string") throw new Error("AI 응답 형식이 올바르지 않습니다.");
  return JSON.parse(raw);
}
