// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// brew.js — 순수 함수 모듈 (Pure module).
// 추출 시간/비율/도징 계산만 담당합니다. DOM·전역 상태·부수효과 없음.
// This module is intentionally side-effect free so it can be unit-tested by check.mjs.

/** 농도 단계 → 원두량 배율 (Strength → dose multiplier). */
export const STRENGTH_FACTOR = Object.freeze({
  light: 0.85,
  medium: 1.0,
  strong: 1.18,
  extra: 1.35,
});

/** 농도 단계 → 한국어 라벨. */
export const STRENGTH_LABEL = Object.freeze({
  light: "연하게",
  medium: "보통",
  strong: "진하게",
  extra: "아주 진하게",
});

/** 우유 옵션 → 스팀 소요 초 (Milk option → extra steaming seconds). */
export const MILK_SECONDS = Object.freeze({
  none: 0,
  steamed: 18,
  foam: 24,
  cold: 6,
});

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * 샷 수와 농도로부터 원두 도징량(g)을 계산합니다.
 * Base: 1 shot ≈ 8g of ground coffee, scaled by strength.
 * @param {number} shots 1..4
 * @param {keyof STRENGTH_FACTOR} strength
 * @returns {number} grams (0.1g 단위 반올림)
 */
export function coffeeDose(shots, strength = "medium") {
  const s = clamp(Math.round(Number(shots) || 1), 1, 4);
  const factor = STRENGTH_FACTOR[strength] ?? 1.0;
  return round1(s * 8 * factor);
}

/**
 * 추출 비율(물량 ml / 원두 g). 에스프레소 브루 비율.
 * @returns {number} ratio, 0.1 단위
 */
export function brewRatio(doseG, volumeMl) {
  const dose = Number(doseG) || 1;
  const vol = Number(volumeMl) || 0;
  if (dose <= 0) return 0;
  return round1(vol / dose);
}

/**
 * 브루 비율을 전통 분류로 매핑.
 * @param {number} ratio
 * @returns {{key:string,label:string}}
 */
export function classifyRatio(ratio) {
  if (ratio <= 1.6) return { key: "ristretto", label: "리스트레토" };
  if (ratio <= 2.6) return { key: "normale", label: "노르말레" };
  if (ratio <= 4.0) return { key: "lungo", label: "룽고" };
  return { key: "americano", label: "아메리카노" };
}

/**
 * 예열 시간(초). 목표 온도가 높을수록 길어짐. 상온 25°C 기준.
 * @param {number} tempC 88..96
 */
export function preheatSeconds(tempC) {
  const t = clamp(Number(tempC) || 92, 80, 100);
  return Math.round(8 + (t - 25) * 0.9);
}

/**
 * 순수 추출 시간(초). 도징량·물량·농도 기반의 플로우 모델.
 * 진한 원두일수록 저항이 커서 흐름이 느려짐.
 */
export function extractionSeconds({ shots = 1, strength = "medium", volume = 30 } = {}) {
  const dose = coffeeDose(shots, strength);
  const vol = clamp(Number(volume) || 30, 15, 400);
  const resistance = STRENGTH_FACTOR[strength] ?? 1.0;
  // 기본 플로우 ≈ 2.0 ml/s, 저항에 반비례
  const flow = 2.0 / resistance;
  const secs = 6 + vol / flow + dose * 0.15;
  return Math.round(secs);
}

/**
 * 전체 사이클 시간(초) = 예열 + 추출 + 우유 스팀.
 * @returns {{preheat:number,extraction:number,milk:number,total:number}}
 */
export function totalBrewSeconds(opts = {}) {
  const preheat = preheatSeconds(opts.temp);
  const extraction = extractionSeconds(opts);
  const milk = MILK_SECONDS[opts.milk] ?? 0;
  return { preheat, extraction, milk, total: preheat + extraction + milk };
}

/**
 * 초 → "m분 s초" 한국어 포맷.
 */
export function formatSeconds(total) {
  const s = Math.max(0, Math.round(Number(total) || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}분 ${rem}초` : `${rem}초`;
}

/**
 * 하나의 레시피 요약(추출 계획). 시뮬레이터·AI 목업이 공유합니다.
 * @returns {{dose:number,ratio:number,ratioClass:{key,label},timing:object}}
 */
export function planBrew(opts = {}) {
  const dose = coffeeDose(opts.shots, opts.strength);
  const ratio = brewRatio(dose, opts.volume);
  return {
    dose,
    ratio,
    ratioClass: classifyRatio(ratio),
    timing: totalBrewSeconds(opts),
  };
}
