// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// check.mjs — 빌드리스 CI 검증기.
//   1) data/*.json JSON 파싱
//   2) 모든 JS(root + ai/ + server/) `node --check`
//   3) index.html 필수 컨테이너 존재
//   4) brew.js 순수 계산 단위 테스트
//   5) AI 목업 결정론성(동일 입력 → 동일 출력)
//   6) 보안: AI_ENDPOINT 비어있음 + 실제 키 포맷(sk-ant-…20+) 미유출

import { readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
let failures = 0;
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { console.error(`  ✗ ${m}`); failures++; };
function assert(cond, m) { cond ? pass(m) : fail(m); }

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const allFiles = walk(ROOT);
const rel = (p) => relative(ROOT, p).replace(/\\/g, "/");

/* 1) JSON 파싱 -------------------------------------------------------------- */
console.log("\n[1] data/*.json 파싱");
const jsonFiles = allFiles.filter((f) => f.endsWith(".json") && rel(f).startsWith("data/"));
assert(jsonFiles.length >= 4, `데이터 JSON ${jsonFiles.length}개 발견 (>=4)`);
for (const f of jsonFiles) {
  try { JSON.parse(readFileSync(f, "utf8")); pass(`${rel(f)} 파싱 OK`); }
  catch (e) { fail(`${rel(f)} 파싱 실패: ${e.message}`); }
}

/* 2) node --check 모든 JS --------------------------------------------------- */
console.log("\n[2] node --check (root + ai/ + server/)");
const jsFiles = allFiles.filter((f) => /\.(mjs|js)$/.test(f));
let hasAi = false, hasServer = false;
for (const f of jsFiles) {
  const r = rel(f);
  if (r.startsWith("ai/")) hasAi = true;
  if (r.startsWith("server/")) hasServer = true;
  const res = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
  assert(res.status === 0, `node --check ${r}` + (res.status === 0 ? "" : `\n     ${(res.stderr || "").trim()}`));
}
assert(hasAi, "ai/ JS 포함됨");
assert(hasServer, "server/ JS 포함됨");

/* 3) index.html 컨테이너 ---------------------------------------------------- */
console.log("\n[3] index.html 필수 컨테이너");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
for (const id of ["remote", "machine", "status", "recipes", "schedule", "device", "ai", "specs", "bom", "origin", "m-coffee", "progress-bar"]) {
  assert(new RegExp(`id="${id}"`).test(html), `#${id} 존재`);
}
assert(/🎓\s*아이디어 출처/.test(html), "아이디어 출처 섹션 존재");
assert(/Not an official Anthropic product/.test(html), "면책 문구 존재");

/* 4) brew.js 단위 테스트 ---------------------------------------------------- */
console.log("\n[4] brew.js 단위 테스트");
const brew = await import("./brew.js");
{
  const d1 = brew.coffeeDose(2, "medium");
  assert(d1 === 16, `coffeeDose(2,medium)=16 (실제 ${d1})`);
  const d2 = brew.coffeeDose(2, "extra");
  assert(d2 > d1, `강한 농도가 더 많은 원두 (${d2} > ${d1})`);
  const r = brew.brewRatio(16, 32);
  assert(r === 2, `brewRatio(16,32)=2 (실제 ${r})`);
  assert(brew.classifyRatio(1.4).key === "ristretto", "1.4 → 리스트레토");
  assert(brew.classifyRatio(2.0).key === "normale", "2.0 → 노르말레");
  assert(brew.classifyRatio(3.5).key === "lungo", "3.5 → 룽고");
  const t = brew.totalBrewSeconds({ shots: 2, strength: "medium", volume: 40, temp: 92, milk: "steamed" });
  assert(t.total === t.preheat + t.extraction + t.milk, "total = preheat+extraction+milk");
  assert(t.milk === 18, `스팀밀크 18초 (실제 ${t.milk})`);
  assert(brew.formatSeconds(75) === "1분 15초", `formatSeconds(75) (실제 ${brew.formatSeconds(75)})`);
  // 순수성/결정론
  const a = JSON.stringify(brew.planBrew({ shots: 2, strength: "strong", volume: 36, temp: 93, milk: "none" }));
  const b = JSON.stringify(brew.planBrew({ shots: 2, strength: "strong", volume: 36, temp: 93, milk: "none" }));
  assert(a === b, "planBrew 결정론적");
}

/* 5) AI 목업 결정론 --------------------------------------------------------- */
console.log("\n[5] AI 목업 결정론");
const { askAI } = await import("./ai/ai.js");
const beans = JSON.parse(readFileSync(join(ROOT, "data/beans.json"), "utf8")).beans;
for (const task of ["barista", "explain", "pairing"]) {
  const payload =
    task === "barista" ? { prefs: { taste: "산미 있는 가벼운" }, beans }
    : task === "explain" ? { recipe: { name: "테스트", bean: beans[0].id, strength: "medium", shots: 2, volume: 40, temp: 92, milk: "none" }, beans }
    : { beanId: beans[0].id, beans };
  const r1 = await askAI(task, payload);
  const r2 = await askAI(task, payload);
  assert(r1.mock === true, `${task}: mock 모드`);
  assert(r1.text.length > 20, `${task}: 출력 존재`);
  assert(r1.text === r2.text, `${task}: 동일 입력 → 동일 출력(결정론)`);
  // 스트리밍 토큰 합 == 최종 텍스트
  let streamed = "";
  const r3 = await askAI(task, payload, { onToken: (c) => (streamed += c) });
  assert(streamed === r3.text, `${task}: onToken 합 == 최종 텍스트`);
}
// 무인 다이제스트(오늘의 추천) 태스크도 결정론 + 오프라인 Mock 동작 확인.
{
  const recipes = JSON.parse(readFileSync(join(ROOT, "data/recipes.json"), "utf8")).recipes;
  const payload = { band: "아침", recipe: recipes[0], beans };
  const d1 = await askAI("digest", payload);
  const d2 = await askAI("digest", payload);
  assert(d1.mock === true, "digest: mock 모드");
  assert(d1.text.length > 20 && d1.text.includes(recipes[0].name), "digest: 레시피 반영 출력");
  assert(d1.text === d2.text, "digest: 동일 입력 → 동일 출력(결정론)");
}

/* 6) 보안 검사 -------------------------------------------------------------- */
console.log("\n[6] 보안");
const { AI_ENDPOINT } = await import("./ai/config.js");
assert(AI_ENDPOINT === "", "ai/config.js AI_ENDPOINT 비어있음(데모=Mock)");
// 실제 키 포맷만 탐지: sk-ant- + 키문자 20자 이상.
// 리터럴을 쪼개 조립 → 이 파일/README 의 "sk-ant…" 언급이 자기 자신을 오탐하지 않음.
const keyRe = new RegExp('sk-' + 'ant-[A-Za-z0-9_-]{20,}');
let leaked = null;
for (const f of allFiles) {
  if (/\.(png|jpg|jpeg|gif|ico|war|zip)$/.test(f)) continue;
  const txt = readFileSync(f, "utf8");
  if (keyRe.test(txt)) { leaked = rel(f); break; }
}
assert(leaked === null, leaked ? `키 유출 의심: ${leaked}` : "실제 API 키 포맷 미검출");

/* 결과 --------------------------------------------------------------------- */
console.log("\n" + (failures === 0 ? "✅ 모든 검사 통과" : `❌ ${failures}건 실패`));
process.exit(failures === 0 ? 0 : 1);
