<!--
SPDX-License-Identifier: Apache-2.0
Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
-->
# 에스프레시모 AI 프록시 (server/)

프론트엔드는 **API 키를 절대 볼 수 없습니다.** 실제 Claude 연동은 이 백엔드 프록시를 통해서만 이뤄집니다.

## 동작

- `POST /api/ai` — body: `{ "task": "barista|explain|pairing|digest", "payload": { ... } }`
- 내부에서 `@anthropic-ai/sdk` 의 `client.messages.stream({ model, max_tokens, system, messages })` 호출
- 응답은 텍스트 스트림(chunked)으로 반환 → 프론트 `ai/ai.js` 가 `onToken` 으로 수신
- CORS 허용 (데모 편의)

## 비용 합리적 설계

- **모델(비용 우선 기본값):** `AI_MODEL` (기본 `claude-haiku-4-5`). 품질이 더 필요하면
  `claude-sonnet-5` 또는 `claude-opus-5` 로 상향.
- **Prompt caching:** 안정적 시스템 프롬프트를 `cache_control:{type:'ephemeral'}` 블록으로 전송 →
  반복 호출 시 캐시 적중으로 입력 토큰 비용 절감.
- **Thinking/effort:** `claude-haiku*` 모델은 adaptive thinking / effort 를 **보내지 않습니다**(400 방지).
  그 외 모델만 `thinking:{type:'adaptive'}` + `output_config:{effort: AI_EFFORT||'low'}` 사용.
- **출력 상한:** `AI_MAX_TOKENS` (기본 700).
- **가드레일:** IP당 분당 `AI_RATE_LIMIT`(기본 20) + 월 예산 `AI_MONTHLY_TOKEN_CAP`(기본 2,000,000).
  초과 시 `429 {fallback:true}` → 프론트가 자동으로 Mock 폴백(무인).

## 실행 (로컬)

```bash
cd server
cp .env.example .env      # 그리고 .env 에 실제 키 입력
npm install
npm start                 # http://localhost:8787/api/ai
```

그 다음 `../ai/config.js` 의 `AI_ENDPOINT` 를 프록시 URL 로 설정하면 프론트가 목업 대신 실제 Claude 를 사용합니다.

## 무인 배포 — Cloudflare Workers (`worker.js`)

관리할 서버 없이 무료 티어에서 실 Claude 프록시를 돌립니다. `index.mjs` 와 동일한
태스크 라우팅 + 모델/캐싱/thinking 규칙으로 Anthropic REST 를 직접 호출합니다.

```bash
npm i -g wrangler
cd server
wrangler secret put ANTHROPIC_API_KEY   # 키는 secret 으로만
wrangler deploy                          # → https://espressimo-ai.<계정>.workers.dev/api/ai
```

배포 후 `../ai/config.js` 의 `AI_ENDPOINT` 를 그 Worker URL 로 설정하면 됩니다.
튜닝 값(`AI_MODEL` 등)은 `wrangler.toml` 의 `[vars]` 에 있습니다.

## 보안 원칙

- **API 키(`ANTHROPIC_API_KEY`)는 서버 환경변수/Worker secret 에만** 존재합니다.
  브라우저 코드·저장소·`config.js`·`wrangler.toml` 에 절대 넣지 마세요.
- `.env` 는 커밋하지 마세요 (`.gitignore` 에 포함).
- 실서비스에서는 CORS 화이트리스트·레이트리밋·인증을 추가하세요.

> 이 데모의 기본 모드는 **Mock** 입니다. server/ 는 선택 사항이며, 실제 키가 있을 때만 필요합니다.
> Not an official Anthropic product.
