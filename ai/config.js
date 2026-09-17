// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// ai/config.js — AI 백엔드 엔드포인트 설정.
//
// 비어 있으면(기본값) 브라우저는 결정론적 MockProvider 로 동작합니다 (데모 모드).
// 실제 Claude 연동 시: server/ 프록시를 띄우고 그 URL 을 아래에 넣으세요.
//   예) export const AI_ENDPOINT = "https://your-proxy.example.com/api/ai";
//
// ⚠️ 절대 API 키를 이 파일이나 브라우저 코드에 두지 마세요. 키는 server/ 뒤에만 둡니다.
export const AI_ENDPOINT = "";
