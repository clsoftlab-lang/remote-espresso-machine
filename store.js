// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// store.js — localStorage 래퍼. 모든 접근은 try/catch 로 보호되며 실패해도 앱이 동작합니다.

const NS = "espressimo:v1:";

/** 안전 읽기. 실패 시 fallback 반환. */
export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(NS + key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** 안전 쓰기. 실패해도 예외를 던지지 않음. */
export function save(key, value) {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** 이 앱이 저장한 모든 키 초기화. */
export function resetAll() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(NS)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    return true;
  } catch {
    return false;
  }
}
