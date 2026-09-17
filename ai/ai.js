// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// ai/ai.js — 통합 AI 진입점.
//
//   askAI(task, payload, { onToken } = {})
//
// AI_ENDPOINT 가 비어 있으면 결정론적 한국어 MockProvider 로 응답합니다 (데모 모드).
// 값이 있으면 server/ 프록시로 POST 하고 스트림을 onToken 으로 흘려보냅니다.
// 실제 API 키는 절대 여기서 다루지 않습니다 — 키는 server/ 뒤에만 존재합니다.

import { AI_ENDPOINT } from "./config.js";
import { planBrew, STRENGTH_LABEL, formatSeconds } from "../brew.js";

/** 지원하는 태스크 목록. */
export const AI_TASKS = Object.freeze(["barista", "explain", "pairing", "digest"]);

/**
 * @param {"barista"|"explain"|"pairing"|"digest"} task
 * @param {object} payload
 * @param {{onToken?:(chunk:string)=>void}} [opts]
 * @returns {Promise<{task:string,text:string,mock:boolean}>}
 */
export async function askAI(task, payload = {}, { onToken } = {}) {
  if (!AI_ENDPOINT) return streamMock(task, payload, onToken);
  try {
    return await callProxy(task, payload, onToken);
  } catch (err) {
    // 무인(autonomous): 프록시 실패 / 429 {fallback:true} / 네트워크 오류 → Mock 폴백.
    // 앱은 절대 멈추지 않습니다.
    if (typeof console !== "undefined" && console.warn) {
      console.warn("AI 프록시 폴백 → Mock:", err && err.message ? err.message : err);
    }
    return streamMock(task, payload, onToken);
  }
}

/** 결정론적 Mock 을 onToken 으로 스트리밍(흉내)하고 결과를 반환. */
function streamMock(task, payload, onToken) {
  const text = mockProvider(task, payload);
  if (typeof onToken === "function") {
    // 결정론적 청크(공백 단위)로 스트리밍 흉내 — 최종 text 는 항상 동일.
    for (const chunk of text.split(/(\s+)/)) if (chunk) onToken(chunk);
  }
  return { task, text, mock: true };
}

/* -------------------------------------------------------------------------- */
/* 실제 프록시 호출 (server/index.mjs / worker.js 와 연동)                       */
/* -------------------------------------------------------------------------- */
async function callProxy(task, payload, onToken) {
  const res = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, payload }),
  });
  // 비정상 응답(429 {fallback:true} 포함)은 예외로 던져 askAI 에서 Mock 폴백.
  if (!res.ok) throw new Error(`AI 프록시 오류: ${res.status}`);

  let text = "";
  if (res.body && typeof res.body.getReader === "function") {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      text += chunk;
      if (typeof onToken === "function") onToken(chunk);
    }
  } else {
    text = await res.text();
    if (typeof onToken === "function") onToken(text);
  }
  return { task, text, mock: false };
}

/* -------------------------------------------------------------------------- */
/* 결정론적 MockProvider — brew.js 계산과 payload 데이터를 재사용               */
/* -------------------------------------------------------------------------- */

function beanName(payload, id) {
  const b = (payload.beans || []).find((x) => x.id === id);
  return b ? b.name : id || "원두";
}

/** 취향 → 추천 농도/샷/원두 규칙 (결정론적). */
function recommendFromPrefs(payload) {
  const p = payload.prefs || {};
  const beans = payload.beans || [];
  // 산미 선호 → 약배전 + 연하게, 쓴맛/진함 선호 → 강배전 + 진하게
  const wantsAcidity = (p.taste || "").includes("산미") || p.acidity >= 4;
  const wantsStrong = (p.taste || "").includes("진") || p.body >= 4;
  const wantsMilk = (p.milk === true) || (p.taste || "").includes("우유");

  let strength = "medium";
  if (wantsStrong) strength = "strong";
  else if (wantsAcidity) strength = "light";

  // 원두 선택: 선호에 맞는 첫 원두 (결정론적, 목록 순서 유지)
  let bean = beans[0];
  for (const b of beans) {
    if (wantsAcidity && b.acidity >= 4) { bean = b; break; }
    if (wantsStrong && b.bitterness >= 4) { bean = b; break; }
  }
  const shots = wantsStrong ? 2 : 1;
  const volume = wantsMilk ? 40 : (wantsAcidity ? 160 : 30);
  const milk = wantsMilk ? "steamed" : "none";
  return { bean, strength, shots, volume, temp: 92, milk };
}

function mockProvider(task, payload) {
  switch (task) {
    case "barista": {
      const rec = recommendFromPrefs(payload);
      const bn = rec.bean ? rec.bean.name : "콜롬비아 수프리모";
      const plan = planBrew(rec);
      return [
        "☕ AI 바리스타 추천 (데모 · Mock)",
        "",
        `취향을 반영해 "${bn}" 원두를 골랐어요.`,
        `- 농도: ${STRENGTH_LABEL[rec.strength]} · 샷: ${rec.shots} · 물량: ${rec.volume}ml · 온도: ${rec.temp}°C`,
        `- 우유: ${rec.milk === "none" ? "없음" : "스팀밀크"}`,
        `- 예상 도징: ${plan.dose}g · 브루비율 1:${plan.ratio} (${plan.ratioClass.label})`,
        `- 예상 총 소요: ${formatSeconds(plan.timing.total)}`,
        "",
        "‘레시피에 적용’을 누르면 시뮬레이터에 그대로 세팅됩니다.",
      ].join("\n");
    }
    case "explain": {
      const r = payload.recipe || {};
      const plan = planBrew(r);
      const bn = beanName(payload, r.bean);
      const advice =
        plan.ratio <= 1.6
          ? "매우 응축된 리스트레토예요. 신맛이 강하면 물량을 5ml 늘려보세요."
          : plan.ratio >= 3.0
          ? "룽고~아메리카노 영역입니다. 더 진하게는 샷을 늘리거나 물량을 줄이세요."
          : "표준 에스프레소 비율입니다. 균형이 좋아요.";
      return [
        "📖 레시피 설명 & 보정 (데모 · Mock)",
        "",
        `"${r.name || "선택한 레시피"}" — ${bn}`,
        `- 도징 ${plan.dose}g, 물량 ${r.volume}ml → 브루비율 1:${plan.ratio} (${plan.ratioClass.label})`,
        `- 농도 ${STRENGTH_LABEL[r.strength] || "-"}, 온도 ${r.temp}°C`,
        `- 예상 추출 ${formatSeconds(plan.timing.extraction)} / 총 ${formatSeconds(plan.timing.total)}`,
        "",
        `보정 팁: ${advice}`,
      ].join("\n");
    }
    case "pairing": {
      const bn = beanName(payload, payload.beanId);
      const bean = (payload.beans || []).find((x) => x.id === payload.beanId);
      const pairs = bean && bean.pairing ? bean.pairing : ["다크 초콜릿", "버터 스콘"];
      const notes = bean && bean.notes ? bean.notes.join(", ") : "균형 잡힌 풍미";
      return [
        "🍽️ 원두 페어링 추천 (데모 · Mock)",
        "",
        `"${bn}" 의 풍미 노트: ${notes}`,
        `추천 디저트: ${pairs.join(" · ")}`,
        "",
        "산미가 강한 원두는 상큼한 과일 디저트, 쓴맛이 강한 원두는 진한 초콜릿과 잘 어울려요.",
      ].join("\n");
    }
    case "digest": {
      // 오늘의 추천 레시피 (시간대/취향 기반) — 무인 온로드 다이제스트.
      const r = payload.recipe || {};
      const band = payload.band || "오늘";
      const plan = planBrew(r);
      const bn = beanName(payload, r.bean);
      return [
        "✨ 오늘의 추천 레시피 (데모 · Mock)",
        "",
        `${band} 시간대엔 "${r.name || "추천 레시피"}" 한 잔 어때요?`,
        `- 원두 ${bn} · 농도 ${STRENGTH_LABEL[r.strength] || "-"} · ${r.shots}샷 · ${r.volume}ml · ${r.temp}°C`,
        `- 브루비율 1:${plan.ratio} (${plan.ratioClass.label}) · 예상 총 ${formatSeconds(plan.timing.total)}`,
        "",
        "‘레시피에 적용’을 누르면 리모컨에 그대로 세팅됩니다.",
      ].join("\n");
    }
    default:
      return "지원하지 않는 요청입니다. (barista / explain / pairing / digest)";
  }
}
