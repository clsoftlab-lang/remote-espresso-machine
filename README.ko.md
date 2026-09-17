<!--
SPDX-License-Identifier: Apache-2.0
Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
-->
# ☕ 에스프레시모 (Espressimo) — 원격 에스프레소 머신 시뮬레이터

**우리집 바리스타** — 폰으로 조작하는 IoT 에스프레소 머신. 원두·농도·샷수·물량·온도·우유를 고르고
**추출** 을 누르면, 애니메이션 머신이 커피를 내려줍니다.

> 🇺🇸 English: **[README.md](README.md)**

> **DEMO 모드 — 개념 경계.** 실제 하드웨어 제품이 아닌 **설계 개념 시뮬레이터 + 스펙/BOM 문서** 입니다.
> 모든 기기 상태·추출은 목업이며, AI 응답은 기본적으로 **결정론적 Mock** 입니다.
> **Not an official Anthropic product.**

## 🔴 라이브 데모

**https://clsoftlab-lang.github.io/remote-espresso-machine/**

## ✨ 기능

- **모바일 리모컨 시뮬레이터** — 폰 형태 UI: 원두·농도·샷수·물량·온도·우유 → 추출 탭.
- **머신 애니메이션** — 인라인 SVG 컵 채움·커피 스트림·스팀·진행바 + 실시간 상태(예열 → 추출 → 완료).
- **레시피 저장 / 즐겨찾기** — 현재 설정을 레시피로 저장, ★ 즐겨찾기, 원터치 불러오기.
- **예약 추출** — 시각(한 번/평일/매일)을 예약 (브라우저 내 목업 타이머).
- **기기 상태 (mock)** — 원두량·물탱크·청소 알림. 추출 시 소비되고, 리필/리셋 버튼 제공.
- **설계 / 스펙 / BOM** — 보일러·펌프·그라인더·Wi-Fi 모듈 + 개략 BOM(단가 **검증되지 않은 참고치**).
- 모바일 우선·반응형·**라이트/다크**·한국어 UI·인라인 SVG·`localStorage` 저장(초기화 지원).

## 🤖 AI 기능 (API 연동)

네 가지 AI 기능, 데모에서는 모두 **결정론적 Mock** 으로 동작(오프라인):

1. **AI 바리스타 챗봇** — 취향 입력 → 레시피 추천(리모컨에 바로 적용).
2. **레시피 설명 / 보정** — 현재 레시피 분석·보정 팁.
3. **원두 페어링 추천** — 원두별 디저트 페어링.
4. **오늘의 추천 레시피 (시간대/취향 기반)** — 페이지 로드 시 자동 생성되는 무인 다이제스트. 현재 시간대에
   맞는 레시피를 brew 엔진 + 레시피 + `askAI` 로 골라 원터치 적용을 제안합니다. 오프라인 Mock 으로도 동작.

**실제 Claude 활성화** (선택):

1. [`server/`](server/README.md) 프록시를 **`ANTHROPIC_API_KEY`** (비용 우선 기본 모델
   **`claude-haiku-4-5`**, `AI_MODEL` 로 상향) 로 실행.
2. [`ai/config.js`](ai/config.js) 의 `AI_ENDPOINT` 를 프록시 URL 로 설정.

이후 브라우저는 Mock 대신 프록시에서 스트리밍을 받습니다. **API 키는 서버에만** 존재하며 브라우저/저장소에는
두지 않습니다. `check.mjs` 는 실제 키(`sk-ant-…`) 나 비어있지 않은 `AI_ENDPOINT` 를 발견하면 실패합니다.

## ⚙️ 고도화 — 무인·저비용 실 AI 연동

- **비용 우선 기본 모델:** `claude-haiku-4-5` (**$1 / $5 per MTok** 입력/출력) + **prompt caching**(ephemeral
  시스템 블록) + 태스크별 출력 상한(기본 700 tok) + **월 토큰 예산**(`AI_MONTHLY_TOKEN_CAP`, 기본 2,000,000).
  품질이 더 필요하면 `AI_MODEL=claude-sonnet-5` / `claude-opus-5` 로 상향.
- **대략 비용(1,000건):** 요청당 ≈ 입력 400 tok(대부분 캐시 적중) + 출력 300 tok 가정 시 Haiku 기준
  **대략 $1 미만 / 1,000건** 수준 — 캐시·상한 효과로 더 낮아질 수 있습니다(참고치).
- **무인·무서버 배포:** [`server/worker.js`](server/worker.js) + [`server/wrangler.toml`](server/wrangler.toml)
  → Cloudflare Workers **무료 티어**에 `wrangler secret put ANTHROPIC_API_KEY && wrangler deploy` 한 번이면 끝.
- **자동 Mock 폴백(무인):** 프록시 실패 / `429 {fallback:true}` / 네트워크 오류 시 `ai/ai.js` 가 자동으로
  결정론적 Mock 으로 폴백해 **앱이 절대 멈추지 않습니다** (스트리밍은 `onToken` 유지).
- **API keys are server-side only — never in the browser or repo.**

## 🚀 로컬 실행

빌드 단계 없음. 정적 서버로 폴더를 제공하세요:

```bash
python -m http.server 9022
# http://localhost:9022/ 접속
```

검증 실행(JSON 파싱, `ai/`+`server/` 포함 전체 JS `node --check`, brew 단위 테스트, AI 목업 결정론, 보안):

```bash
node check.mjs
```

## 🎓 아이디어 출처

이 아이디어는 **이일국 박사(Dr. Lee Il-guk)** 의 **용인대학교(Yongin University)** 창업 수업에서 나온
한 수강생의 돋보이는 발상에서 영감을 받았습니다. 감사의 마음을 전합니다. 본 구현물은 그 발상을
**클린룸(clean-room)** 방식으로 새로 만든 독립 데모이며, 원문 문장·개인정보·상표를 포함하지 않습니다.

## 👥 기여자

이일국 박사(Dr. Lee Il-guk), LWJ, LMJ, Claude

## 📜 라이선스

- 코드: **Apache-2.0** ([`LICENSE`](LICENSE))
- 문서·그래픽: **CC BY 4.0**
- © 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)

**Not an official Anthropic product.**
