// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// server/index.mjs — 실제 Claude 연동용 백엔드 프록시 (비용 합리적·무인 지향).
//
// 브라우저는 절대 API 키를 보지 않습니다. 키는 이 서버의 환경변수(ANTHROPIC_API_KEY)에만 존재합니다.
// 프론트(ai/ai.js)는 이 서버의 POST /api/ai 로만 통신합니다.
//
// 비용 절감 설계:
//   - 기본 모델은 비용 우선(claude-haiku-4-5). AI_MODEL 로 상향 가능(claude-sonnet-5 / claude-opus-5).
//   - 안정적 시스템 프롬프트를 prompt caching(ephemeral) 블록으로 전송 → 반복 호출 시 캐시 적중, 비용 절감.
//   - 태스크별 modest max_tokens(기본 ~700).
//   - IP당 분당 레이트리밋 + 월 토큰 예산 상한. 초과 시 429 {fallback:true} → 프론트는 Mock 으로 폴백(무인).
//
// 실행:
//   cd server && npm install
//   ANTHROPIC_API_KEY=sk-ant-... node index.mjs
//
// CI 에서는 install/실행/API 호출을 하지 않습니다 (문법 검사만).

import http from "node:http";
import Anthropic from "@anthropic-ai/sdk";

const PORT = process.env.PORT || 8787;

// 비용 우선 기본 모델. 품질이 더 필요하면 AI_MODEL 로 상향(claude-sonnet-5 / claude-opus-5).
const MODEL = process.env.AI_MODEL || "claude-haiku-4-5";
const MAX_TOKENS = Number(process.env.AI_MAX_TOKENS) || 700; // 태스크별 modest 출력 상한
const EFFORT = process.env.AI_EFFORT || "low"; // 비-haiku 모델의 추론 강도
const RATE_LIMIT_PER_MIN = Number(process.env.AI_RATE_LIMIT) || 20; // IP당 분당 요청 상한
const MONTHLY_TOKEN_CAP = Number(process.env.AI_MONTHLY_TOKEN_CAP) || 2_000_000; // 월 토큰 예산

// Haiku 4.5 는 adaptive thinking / effort 를 받지 않음(400 방지). 그 외 모델만 thinking+effort 사용.
const IS_HAIKU = MODEL.startsWith("claude-haiku");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 안정적(=캐시 가능)인 태스크 공통 시스템 프롬프트.
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

// Anthropic 요청 파라미터. system 은 prompt caching(ephemeral) 블록 배열로 전송.
function buildRequestParams(task, payload) {
  const params = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: buildUserMessage(task, payload) }],
  };
  if (!IS_HAIKU) {
    // 상위 모델에서만 적응형 사고 + 낮은 effort(비용 절감).
    params.thinking = { type: "adaptive" };
    params.output_config = { effort: EFFORT };
  }
  return params;
}

/* ---------------------------- 비용 가드레일 ---------------------------- */
// 단순 인메모리 IP 레이트리밋(분당). 데모용 — 실서비스는 외부 스토어 권장.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowStart = now - 60_000;
  const arr = (hits.get(ip) || []).filter((t) => t > windowStart);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE_LIMIT_PER_MIN;
}

// 월 토큰 예산(인메모리). 월이 바뀌면 리셋. stream 최종 usage 로 누적.
let budgetMonth = new Date().getUTCMonth();
let tokensUsed = 0;
function budgetExceeded() {
  const m = new Date().getUTCMonth();
  if (m !== budgetMonth) { budgetMonth = m; tokensUsed = 0; }
  return tokensUsed >= MONTHLY_TOKEN_CAP;
}
function addUsage(usage) {
  if (!usage) return;
  tokensUsed +=
    (usage.input_tokens || 0) +
    (usage.output_tokens || 0) +
    (usage.cache_creation_input_tokens || 0) +
    (usage.cache_read_input_tokens || 0);
}

function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : "unknown";
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// 429 + {fallback:true} → 프론트가 Mock 으로 폴백(무인).
function sendFallback(res, reason) {
  res.writeHead(429, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ fallback: true, reason }));
}

const server = http.createServer(async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== "POST" || !req.url.startsWith("/api/ai")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  // 가드레일: 레이트리밋 / 월 토큰 예산 초과 → 폴백.
  if (rateLimited(clientIp(req))) { sendFallback(res, "rate_limited"); return; }
  if (budgetExceeded()) { sendFallback(res, "monthly_token_cap"); return; }

  try {
    const body = await readBody(req);
    const { task, payload } = JSON.parse(body || "{}");

    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    });

    const stream = client.messages.stream(buildRequestParams(task, payload));

    stream.on("text", (text) => res.write(text));
    stream.on("error", (err) => {
      console.error("stream error:", err);
      if (!res.writableEnded) res.end();
    });
    const final = await stream.finalMessage();
    addUsage(final && final.usage); // 최종 message usage 로 월 예산 누적
    res.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err && err.message ? err.message : err) }));
    } else if (!res.writableEnded) {
      res.end();
    }
  }
});

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

server.listen(PORT, () => {
  console.log(`에스프레시모 AI 프록시 실행 중: http://localhost:${PORT}/api/ai (model=${MODEL})`);
});
