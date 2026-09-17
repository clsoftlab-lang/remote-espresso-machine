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

세 가지 AI 기능, 데모에서는 모두 **결정론적 Mock** 으로 동작:

1. **AI 바리스타 챗봇** — 취향 입력 → 레시피 추천(리모컨에 바로 적용).
2. **레시피 설명 / 보정** — 현재 레시피 분석·보정 팁.
3. **원두 페어링 추천** — 원두별 디저트 페어링.

**실제 Claude 활성화** (선택):

1. [`server/`](server/README.md) 프록시를 **`ANTHROPIC_API_KEY`** (모델 **`claude-opus-5`**) 로 실행.
2. [`ai/config.js`](ai/config.js) 의 `AI_ENDPOINT` 를 프록시 URL 로 설정.

이후 브라우저는 Mock 대신 프록시에서 스트리밍을 받습니다. **API 키는 서버에만** 존재하며 브라우저/저장소에는
두지 않습니다. `check.mjs` 는 실제 키(`sk-ant-…`) 나 비어있지 않은 `AI_ENDPOINT` 를 발견하면 실패합니다.

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
