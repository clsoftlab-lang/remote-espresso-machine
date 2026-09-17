<!--
SPDX-License-Identifier: Apache-2.0
Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
-->
# ☕ 에스프레시모 (Espressimo) — Remote Espresso Machine Simulator

**우리집 바리스타** — an IoT espresso machine you control from your phone. Pick your beans, strength, shots,
volume, temperature and milk, tap **추출 (Brew)**, and watch an animated machine brew your cup.

> 🇰🇷 한국어 문서: **[README.ko.md](README.ko.md)**

> **DEMO MODE — concept boundaries.** This is a **design-concept interactive simulator + spec/BOM doc**,
> **not** a real hardware product. All device states and brewing are mocked. AI replies are a
> **deterministic Mock** by default. **Not an official Anthropic product.**

## 🔴 Live demo

**https://clsoftlab-lang.github.io/remote-espresso-machine/**

## ✨ Features

- **모바일 리모컨 시뮬레이터** — a phone-style UI: beans / strength / shots / volume / temp / milk → tap Brew.
- **Animated machine** — inline-SVG cup fill, coffee stream, steam, progress bar, and live status (예열 → 추출 → 완료).
- **레시피 저장 / 즐겨찾기** — save the current settings as a recipe; star favorites; one-tap load back to the remote.
- **예약 추출 (Schedule)** — schedule a brew time (once / weekday / daily) as a browser-side mock timer.
- **기기 상태 (mock)** — bean level, water tank, cleaning reminder; consumed on each brew, refill/reset button.
- **설계 / 스펙 / BOM** — boiler, pump, grinder, Wi-Fi module and a rough BOM (prices **reference not verified**).
- Mobile-first, responsive, **light + dark**, Korean UI, inline-SVG art only, `localStorage` persistence (with reset).

## 🤖 AI 기능 (API 연동)

Four AI features, all working via the **deterministic Mock** in the demo (offline):

1. **AI 바리스타 챗봇** — recommends a recipe from your taste preferences (and applies it to the remote).
2. **레시피 설명 / 보정** — explains and tweaks your current recipe.
3. **원두 페어링 추천** — suggests dessert pairings per bean.
4. **오늘의 추천 레시피 (시간대/취향 기반)** — an on-load, self-running digest that picks a recipe for the
   current time of day (via the brew engine + recipes + `askAI`) and offers a one-tap apply. Works offline via the Mock.

**Enable real Claude** (optional):

1. Run the backend proxy in [`server/`](server/README.md) with **`ANTHROPIC_API_KEY`**
   (cost-first default model **`claude-haiku-4-5`**, raise via `AI_MODEL`).
2. Set `AI_ENDPOINT` in [`ai/config.js`](ai/config.js) to your proxy URL.

The browser then streams from your proxy instead of the Mock. **API keys live server-side only** — never in the
browser or the repo. `check.mjs` fails the build if it detects a real key (`sk-ant-…`) or a non-empty `AI_ENDPOINT`.

## ⚙️ 고도화 — 무인·저비용 실 AI 연동

- **비용 우선 기본 모델:** `claude-haiku-4-5` (**$1 / $5 per MTok** in/out) + **prompt caching**(ephemeral
  시스템 블록) + 태스크별 출력 상한(기본 700 tok) + **월 토큰 예산**(`AI_MONTHLY_TOKEN_CAP`, 기본 2,000,000).
  품질이 더 필요하면 `AI_MODEL=claude-sonnet-5` / `claude-opus-5` 로 상향.
- **대략 비용(1,000 requests):** 요청당 ≈ 입력 400 tok(대부분 캐시 적중) + 출력 300 tok 가정 시
  Haiku 기준 **대략 $1 미만 / 1,000건** 수준 — 캐시·상한 효과로 더 낮아질 수 있습니다(참고치).
- **무인·무서버 배포:** [`server/worker.js`](server/worker.js) + [`server/wrangler.toml`](server/wrangler.toml)
  → Cloudflare Workers **무료 티어**에 `wrangler secret put ANTHROPIC_API_KEY && wrangler deploy` 한 번이면
  관리할 서버가 없습니다.
- **자동 Mock 폴백(무인):** 프록시 실패 / `429 {fallback:true}`(레이트리밋·예산 초과) / 네트워크 오류 시
  `ai/ai.js` 가 자동으로 결정론적 Mock 으로 폴백해 **앱이 절대 멈추지 않습니다** (스트리밍은 `onToken` 유지).
- **API keys are server-side only — never in the browser or repo.**

## 🚀 Run locally

No build step. Serve the folder statically:

```bash
python -m http.server 9022
# open http://localhost:9022/
```

Run the checks (JSON parse, `node --check` all JS incl. `ai/` + `server/`, brew unit tests, AI-mock determinism, security):

```bash
node check.mjs
```

## 📁 Structure

```
index.html          # root page (relative paths only)
styles.css          # light/dark, mobile-first
app.js              # orchestrator
brew.js             # PURE time/ratio/dose math (unit-tested)
store.js            # localStorage (try/catch + reset)
data/*.json         # recipes / beans / specs / parts
ai/config.js        # AI_ENDPOINT = ""  (empty ⇒ Mock)
ai/ai.js            # askAI(task, payload, {onToken}) — Mock or proxy
server/             # optional Claude proxy — index.mjs (Node) + worker.js (Cloudflare Workers), key server-side
check.mjs           # CI verifier
.github/workflows/  # CI (no npm install / no API calls)
```

## 🎓 아이디어 출처 / Idea origin

이 아이디어는 **이일국 박사(Dr. Lee Il-guk)** 의 **용인대학교(Yongin University)** 창업 수업에서 나온
한 수강생의 돋보이는 발상에서 영감을 받았습니다. 감사의 마음을 전합니다. 본 구현물은 그 발상을
**클린룸(clean-room)** 방식으로 새로 만든 독립 데모이며, 원문 문장·개인정보·상표를 포함하지 않습니다.

Inspired by a standout student idea from Dr. Lee Il-guk's entrepreneurship class at **Yongin University**,
with gratitude. This is an independent, **clean-room** build — no copied sentences, no personal data, no trademarks.

## 👥 Contributors

Dr. Lee Il-guk (이일국), LWJ, LMJ, Claude

## 📜 License

- Code: **Apache-2.0** (see [`LICENSE`](LICENSE))
- Docs & graphics: **CC BY 4.0**
- © 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)

**Not an official Anthropic product.**
