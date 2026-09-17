// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// server/index.mjs — 실제 Claude 연동용 백엔드 프록시.
//
// 브라우저는 절대 API 키를 보지 않습니다. 키는 이 서버의 환경변수(ANTHROPIC_API_KEY)에만 존재합니다.
// 프론트(ai/ai.js)는 이 서버의 POST /api/ai 로만 통신합니다.
//
// 실행:
//   cd server && npm install
//   ANTHROPIC_API_KEY=sk-ant-... node index.mjs
//
// CI 에서는 install/실행/API 호출을 하지 않습니다 (문법 검사만).

import http from "node:http";
import Anthropic from "@anthropic-ai/sdk";

const PORT = process.env.PORT || 8787;
const MODEL = "claude-opus-5";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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

  try {
    const body = await readBody(req);
    const { task, payload } = JSON.parse(body || "{}");

    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    });

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(task, payload) }],
    });

    stream.on("text", (text) => res.write(text));
    stream.on("error", (err) => {
      console.error("stream error:", err);
      if (!res.writableEnded) res.end();
    });
    await stream.finalMessage();
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
