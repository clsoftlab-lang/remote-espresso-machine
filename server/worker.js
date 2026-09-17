// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// server/worker.js — Cloudflare Workers 변형 (무인·무서버 배포용).
//
// 무료 티어에서 관리할 서버 없이 실 Claude 를 붙입니다.
//   wrangler secret put ANTHROPIC_API_KEY   # 키는 Worker secret 에만 존재
//   wrangler deploy
//
// index.mjs 와 동일한 태스크 라우팅 + 모델/캐싱/thinking 규칙을 사용하며,
// Anthropic REST(POST /v1/messages) 를 직접 호출해 assistant 텍스트를 반환합니다(비스트림).
// 실패/초과 시 429 {fallback:true} → 프론트(ai/ai.js)가 Mock 으로 폴백(무인).

const SYSTEM_PROMPT = [
  "당신은 IoT 에스프레소 머신 '에스프레시모'의 AI 바리스타입니다.",
  "한국어로, 간결하고 실용적으로 답하세요.",
  "원두·농도·샷수·물량·온도·우유 파라미터를 근거로 추천/설명/페어링을 제공합니다.",
  "이것은 설계 개념 데모이며 실제 하드웨어 제품이 아님을 전제로 합니다.",
].join(" ");

function buildUserMessage(task, payload) {
  return [
    `요청 종류: ${task}`,
    `데이터(JSON): ${JSON.stringify(payload)}`,
    "위 데이터를 바탕으로 한국어로 답하세요.",
  ].join("\n");
}

// index.mjs 와 동일한 모델/캐싱/thinking 규칙.
function buildRequestBody(env, task, payload) {
  const MODEL = env.AI_MODEL || "claude-haiku-4-5";
  const body = {
    model: MODEL,
    max_tokens: Number(env.AI_MAX_TOKENS) || 700,
    // prompt caching: 안정적 시스템 프롬프트를 ephemeral 블록으로 → 반복 호출 시 캐시 적중.
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: buildUserMessage(task, payload) }],
  };
  // Haiku 4.5 는 adaptive thinking / effort 미지원(400 방지). 그 외 모델만 사용.
  if (!MODEL.startsWith("claude-haiku")) {
    body.thinking = { type: "adaptive" };
    body.output_config = { effort: env.AI_EFFORT || "low" };
  }
  return body;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// 인메모리 IP 레이트리밋 + 월 토큰 예산(isolate 범위 — 데모용 가드레일).
const hits = new Map();
let budgetMonth = new Date().getUTCMonth();
let tokensUsed = 0;

function rateLimited(env, ip) {
  const limit = Number(env.AI_RATE_LIMIT) || 20;
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => t > now - 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > limit;
}
function budgetExceeded(env) {
  const cap = Number(env.AI_MONTHLY_TOKEN_CAP) || 2_000_000;
  const m = new Date().getUTCMonth();
  if (m !== budgetMonth) { budgetMonth = m; tokensUsed = 0; }
  return tokensUsed >= cap;
}
function addUsage(u) {
  if (!u) return;
  tokensUsed +=
    (u.input_tokens || 0) +
    (u.output_tokens || 0) +
    (u.cache_creation_input_tokens || 0) +
    (u.cache_read_input_tokens || 0);
}

function fallback(reason) {
  return new Response(JSON.stringify({ fallback: true, reason }), {
    status: 429,
    headers: { "content-type": "application/json", ...CORS },
  });
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    if (req.method !== "POST" || !url.pathname.startsWith("/api/ai")) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "content-type": "application/json", ...CORS },
      });
    }

    const ip = req.headers.get("cf-connecting-ip") || "unknown";
    if (rateLimited(env, ip)) return fallback("rate_limited");
    if (budgetExceeded(env)) return fallback("monthly_token_cap");

    let task, payload;
    try {
      ({ task, payload } = await req.json());
    } catch {
      return fallback("bad_request");
    }

    let upstream;
    try {
      upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(buildRequestBody(env, task, payload)),
      });
    } catch {
      return fallback("upstream_error");
    }
    if (!upstream.ok) return fallback(`upstream_${upstream.status}`);

    const data = await upstream.json();
    addUsage(data && data.usage);
    const text = (data.content || [])
      .filter((b) => b && b.type === "text")
      .map((b) => b.text)
      .join("");

    return new Response(text, {
      headers: { "content-type": "text/plain; charset=utf-8", ...CORS },
    });
  },
};
