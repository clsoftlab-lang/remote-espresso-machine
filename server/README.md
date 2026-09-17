<!--
SPDX-License-Identifier: Apache-2.0
Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
-->
# 에스프레시모 AI 프록시 (server/)

프론트엔드는 **API 키를 절대 볼 수 없습니다.** 실제 Claude 연동은 이 백엔드 프록시를 통해서만 이뤄집니다.

## 동작

- `POST /api/ai` — body: `{ "task": "barista|explain|pairing", "payload": { ... } }`
- 내부에서 `@anthropic-ai/sdk` 의 `client.messages.stream({ model: "claude-opus-5", max_tokens: 2048, thinking: { type: "adaptive" }, system, messages })` 호출
- 응답은 텍스트 스트림(chunked)으로 반환 → 프론트 `ai/ai.js` 가 `onToken` 으로 수신
- CORS 허용 (데모 편의)

## 실행 (로컬)

```bash
cd server
cp .env.example .env      # 그리고 .env 에 실제 키 입력
npm install
npm start                 # http://localhost:8787/api/ai
```

그 다음 `../ai/config.js` 의 `AI_ENDPOINT` 를 프록시 URL 로 설정하면 프론트가 목업 대신 실제 Claude 를 사용합니다.

## 보안 원칙

- **API 키(`ANTHROPIC_API_KEY`)는 서버 환경변수에만** 존재합니다. 브라우저 코드·저장소·`config.js` 에 절대 넣지 마세요.
- `.env` 는 커밋하지 마세요 (`.gitignore` 에 포함).
- 실서비스에서는 CORS 화이트리스트·레이트리밋·인증을 추가하세요.

> 이 데모의 기본 모드는 **Mock** 입니다. server/ 는 선택 사항이며, 실제 키가 있을 때만 필요합니다.
> Not an official Anthropic product.
