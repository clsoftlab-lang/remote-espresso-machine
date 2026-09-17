// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// app.js — 시뮬레이터 오케스트레이터. brew.js(순수계산) · store.js(저장) · ai/ai.js(AI) 를 조합.

import {
  planBrew, STRENGTH_LABEL, formatSeconds, totalBrewSeconds,
} from "./brew.js";
import { load, save, resetAll } from "./store.js";
import { askAI } from "./ai/ai.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  beans: [],
  recipes: [],
  specs: null,
  parts: null,
  current: load("current", { bean: "", strength: "medium", shots: 2, volume: 40, temp: 92, milk: "none" }),
  saved: load("recipes", []),
  favorites: load("favorites", []),
  schedules: load("schedules", []),
  device: load("device", { beans: 78, water: 62, shotsSinceClean: 9 }),
  brewing: false,
  lastRecommend: null,
};

/* ------------------------------- 부트스트랩 ------------------------------- */
init().catch((err) => {
  console.error(err);
  const s = $("#status");
  if (s) s.textContent = "데이터 로드 실패 (로컬 서버에서 실행하세요)";
});

async function init() {
  const [beans, recipes, specs, parts] = await Promise.all([
    fetchJSON("data/beans.json"),
    fetchJSON("data/recipes.json"),
    fetchJSON("data/specs.json"),
    fetchJSON("data/parts.json"),
  ]);
  state.beans = beans.beans;
  state.recipes = recipes.recipes;
  state.specs = specs;
  state.parts = parts;
  if (!state.current.bean) state.current.bean = state.beans[0].id;

  setupTheme();
  setupTabs();
  populateBeans();
  bindRemote();
  bindBrew();
  bindRecipes();
  bindSchedule();
  bindAI();
  renderSpecs();
  renderBOM();
  bindReset();

  syncRemoteUI();
  renderPlan();
  renderRecipes();
  renderSchedules();
  renderDevice();
  tickSchedules();
  setInterval(tickSchedules, 30000);
}

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`fetch ${path} → ${res.status}`);
  return res.json();
}

/* --------------------------------- 테마 --------------------------------- */
function setupTheme() {
  const saved = load("theme", null);
  if (saved) document.documentElement.setAttribute("data-theme", saved);
  updateThemeIcon();
  $("#theme-toggle").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : cur === "light" ? "dark" : preferDark() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    save("theme", next);
    updateThemeIcon();
  });
}
const preferDark = () => window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
function updateThemeIcon() {
  const t = document.documentElement.getAttribute("data-theme");
  const dark = t ? t === "dark" : preferDark();
  $("#theme-toggle").textContent = dark ? "☀️" : "🌙";
}

/* --------------------------------- 탭 ---------------------------------- */
function setupTabs() {
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      $$("main .panel").forEach((p) => {
        if (p.id === "origin") return;
        p.classList.toggle("is-active", p.id === tab.dataset.target);
      });
    });
  });
}

/* ------------------------------- 리모컨 -------------------------------- */
function populateBeans() {
  const sel = $("#opt-bean");
  const aiSel = $("#ai-bean");
  sel.innerHTML = "";
  aiSel.innerHTML = "";
  state.beans.forEach((b) => {
    sel.appendChild(new Option(`${b.name} (${b.roastLabel})`, b.id));
    aiSel.appendChild(new Option(b.name, b.id));
  });
}

function bindRemote() {
  $("#opt-bean").addEventListener("change", (e) => { state.current.bean = e.target.value; persistCurrent(); renderPlan(); });
  $("#opt-shots").addEventListener("input", (e) => { state.current.shots = +e.target.value; $("#val-shots").textContent = e.target.value; persistCurrent(); renderPlan(); });
  $("#opt-volume").addEventListener("input", (e) => { state.current.volume = +e.target.value; $("#val-volume").textContent = e.target.value; persistCurrent(); renderPlan(); });
  $("#opt-temp").addEventListener("input", (e) => { state.current.temp = +e.target.value; $("#val-temp").textContent = e.target.value; persistCurrent(); renderPlan(); });
  bindSegmented("#opt-strength", (v) => { state.current.strength = v; persistCurrent(); renderPlan(); });
  bindSegmented("#opt-milk", (v) => { state.current.milk = v; persistCurrent(); renderPlan(); });
}

function bindSegmented(sel, onPick) {
  $$(sel + " button").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(sel + " button").forEach((b) => b.classList.remove("on"));
      btn.classList.add("on");
      onPick(btn.dataset.val);
    });
  });
}

function syncRemoteUI() {
  const c = state.current;
  $("#opt-bean").value = c.bean;
  $("#opt-shots").value = c.shots; $("#val-shots").textContent = c.shots;
  $("#opt-volume").value = c.volume; $("#val-volume").textContent = c.volume;
  $("#opt-temp").value = c.temp; $("#val-temp").textContent = c.temp;
  setSegmented("#opt-strength", c.strength);
  setSegmented("#opt-milk", c.milk);
}
function setSegmented(sel, val) {
  $$(sel + " button").forEach((b) => b.classList.toggle("on", b.dataset.val === val));
}

function persistCurrent() { save("current", state.current); }

function renderPlan() {
  const p = planBrew(state.current);
  const bean = state.beans.find((b) => b.id === state.current.bean);
  $("#plan-readout").innerHTML = [
    `원두 <b>${bean ? bean.name : "-"}</b> · 농도 <b>${STRENGTH_LABEL[state.current.strength]}</b>`,
    `도징 <b>${p.dose}g</b> · 브루비율 <b>1:${p.ratio}</b> (${p.ratioClass.label})`,
    `예상 소요 <b>${formatSeconds(p.timing.total)}</b> (예열 ${p.timing.preheat}s + 추출 ${p.timing.extraction}s${p.timing.milk ? " + 우유 " + p.timing.milk + "s" : ""})`,
  ].join("<br>");
}

/* ------------------------------- 추출 애니메이션 ------------------------------- */
function bindBrew() {
  $("#btn-brew").addEventListener("click", () => startBrew());
  $("#btn-save-recipe").addEventListener("click", saveCurrentRecipe);
}

function setStatus(text, cls) {
  const el = $("#status");
  el.textContent = text;
  el.className = "status" + (cls ? " " + cls : "");
}
function setLED(cls) { $("#m-led").setAttribute("class", "m-led" + (cls ? " " + cls : "")); }

async function startBrew() {
  if (state.brewing) return;
  if (state.device.water < 5) { setStatus("물탱크를 채워주세요", "heating"); return; }
  if (state.device.beans < 3) { setStatus("원두를 채워주세요", "heating"); return; }
  state.brewing = true;
  $("#btn-brew").disabled = true;

  const t = totalBrewSeconds(state.current);
  const coffeeEl = $("#m-coffee");
  const streamEl = $("#m-stream");
  const steamEl = $("#m-steam");
  const bar = $("#progress-bar span");
  const label = $("#progress-label");

  // 컵 좌표(뷰박스 기준): 빈 컵 바닥 ~224, 가득 ~172
  const CUP_BOTTOM = 232, CUP_TOP = 172;
  const setCoffee = (frac) => {
    const top = CUP_BOTTOM - (CUP_BOTTOM - CUP_TOP) * Math.min(1, Math.max(0, frac));
    coffeeEl.setAttribute("d", `M84 ${CUP_BOTTOM} h52 V${top} h-52 Z`);
  };
  setCoffee(0);
  streamEl.setAttribute("height", "0");

  const start = performance.now();
  const totalMs = Math.max(2500, t.total * 100); // 데모 가속: 1초 ≈ 100ms
  const preheatMs = t.preheat * 100;
  const extractionMs = t.extraction * 100;

  await animate((now) => {
    const elapsed = now - start;
    const pct = Math.min(1, elapsed / totalMs);
    bar.style.width = (pct * 100).toFixed(1) + "%";

    if (elapsed < preheatMs) {
      setStatus("예열 중…", "heating");
      setLED("on");
      label.textContent = `보일러 예열 ${state.current.temp}°C`;
    } else if (elapsed < preheatMs + extractionMs) {
      setStatus("추출 중…", "brewing");
      setLED("brew");
      const ef = (elapsed - preheatMs) / extractionMs;
      streamEl.setAttribute("height", (14 + ef * 8).toFixed(0));
      streamEl.setAttribute("y", "118");
      setCoffee(ef);
      label.textContent = `추출 진행 ${(ef * 100).toFixed(0)}%`;
    } else {
      streamEl.setAttribute("height", "0");
      setCoffee(1);
      if (state.current.milk !== "none") {
        steamEl.classList.add("on"); steamEl.setAttribute("opacity", "1");
        setStatus("우유 스티밍…", "brewing");
        label.textContent = "우유 스티밍";
      }
    }
    return pct >= 1;
  });

  steamEl.classList.remove("on"); steamEl.setAttribute("opacity", "0");
  setStatus("완료! ☕", "done");
  setLED("done");
  label.textContent = "추출 완료 — 맛있게 드세요!";
  bar.style.width = "100%";

  // 기기 상태 소비 (mock)
  state.device.beans = Math.max(0, state.device.beans - Math.round(planBrew(state.current).dose / 2));
  state.device.water = Math.max(0, state.device.water - Math.max(2, Math.round(state.current.volume / 15)));
  state.device.shotsSinceClean += state.current.shots;
  save("device", state.device);
  renderDevice();

  state.brewing = false;
  $("#btn-brew").disabled = false;
}

function animate(step) {
  return new Promise((resolve) => {
    function frame(now) {
      const done = step(now);
      if (done) resolve();
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

/* ------------------------------- 레시피 -------------------------------- */
function beanNameById(id) { const b = state.beans.find((x) => x.id === id); return b ? b.name : id; }

function allRecipes() {
  return [...state.recipes.map((r) => ({ ...r, builtin: true })), ...state.saved];
}

function saveCurrentRecipe() {
  const name = prompt("레시피 이름을 입력하세요", `내 레시피 ${state.saved.length + 1}`);
  if (!name) return;
  const rec = {
    id: "user-" + Date.now(),
    name: name.slice(0, 40),
    bean: state.current.bean,
    strength: state.current.strength,
    shots: state.current.shots,
    volume: state.current.volume,
    temp: state.current.temp,
    milk: state.current.milk,
    tags: ["내 레시피"],
    desc: "직접 저장한 레시피",
    builtin: false,
  };
  state.saved.push(rec);
  save("recipes", state.saved);
  renderRecipes();
  setStatus("레시피 저장됨 ⭐", "done");
}

function loadRecipe(r) {
  state.current = { bean: r.bean, strength: r.strength, shots: r.shots, volume: r.volume, temp: r.temp, milk: r.milk };
  persistCurrent();
  syncRemoteUI();
  renderPlan();
  $$(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.target === "sec-remote"));
  $$("main .panel").forEach((p) => { if (p.id !== "origin") p.classList.toggle("is-active", p.id === "sec-remote"); });
  setStatus("레시피 불러옴 — 추출하세요", "");
}

function toggleFav(id) {
  const i = state.favorites.indexOf(id);
  if (i >= 0) state.favorites.splice(i, 1); else state.favorites.push(id);
  save("favorites", state.favorites);
  renderRecipes();
}
function deleteRecipe(id) {
  state.saved = state.saved.filter((r) => r.id !== id);
  save("recipes", state.saved);
  renderRecipes();
}

function bindRecipes() { /* delegation set in renderRecipes */ }

function renderRecipes() {
  const wrap = $("#recipes");
  const list = allRecipes().sort((a, b) => Number(state.favorites.includes(b.id)) - Number(state.favorites.includes(a.id)));
  wrap.innerHTML = "";
  list.forEach((r) => {
    const fav = state.favorites.includes(r.id);
    const p = planBrew(r);
    const card = document.createElement("div");
    card.className = "recipe-card";
    card.innerHTML = `
      <h3>${escapeHTML(r.name)} <button class="fav" title="즐겨찾기" aria-label="즐겨찾기">${fav ? "★" : "☆"}</button></h3>
      <div class="meta">${escapeHTML(beanNameById(r.bean))} · ${STRENGTH_LABEL[r.strength]} · ${r.shots}샷 · ${r.volume}ml · 1:${p.ratio}</div>
      <div class="tags">${(r.tags || []).map((t) => `<span>${escapeHTML(t)}</span>`).join("")}</div>
      <div class="actions">
        <button class="btn primary act-load">불러오기</button>
        ${r.builtin ? "" : '<button class="btn ghost act-del">삭제</button>'}
      </div>`;
    card.querySelector(".fav").addEventListener("click", () => toggleFav(r.id));
    card.querySelector(".act-load").addEventListener("click", () => loadRecipe(r));
    const del = card.querySelector(".act-del");
    if (del) del.addEventListener("click", () => deleteRecipe(r.id));
    wrap.appendChild(card);
  });
}

/* ------------------------------- 예약 --------------------------------- */
function bindSchedule() {
  $("#btn-add-sched").addEventListener("click", () => {
    const time = $("#sched-time").value || "07:30";
    const repeat = $("#sched-repeat").value;
    const bean = state.current.bean;
    state.schedules.push({ id: "s-" + Date.now(), time, repeat, bean, label: `${beanNameById(bean)} · ${STRENGTH_LABEL[state.current.strength]}` });
    save("schedules", state.schedules);
    renderSchedules();
  });
}
function renderSchedules() {
  const ul = $("#schedule");
  ul.innerHTML = "";
  if (!state.schedules.length) { ul.innerHTML = '<li class="muted">예약이 없습니다.</li>'; return; }
  const repeatLabel = { once: "한 번", weekday: "평일", daily: "매일" };
  state.schedules.forEach((s) => {
    const li = document.createElement("li");
    li.innerHTML = `<span><span class="when">${s.time}</span> · ${repeatLabel[s.repeat] || s.repeat} · ${escapeHTML(s.label)}</span>`;
    const del = document.createElement("button");
    del.className = "btn ghost"; del.textContent = "삭제";
    del.addEventListener("click", () => { state.schedules = state.schedules.filter((x) => x.id !== s.id); save("schedules", state.schedules); renderSchedules(); });
    li.appendChild(del);
    ul.appendChild(li);
  });
}
// 목업 스케줄 트리거: 현재 시각과 일치하면 상태 배지로 안내(자동 추출은 사용자 확인 후).
function tickSchedules() {
  const now = new Date();
  const hhmm = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  const due = state.schedules.find((s) => s.time === hhmm);
  if (due && !state.brewing) {
    setStatus(`예약(${due.time}) 도래 — 리모컨에서 추출하세요`, "heating");
  }
}

/* ------------------------------- 기기 상태 ------------------------------- */
function renderDevice() {
  const d = state.device;
  const cleanNeeded = d.shotsSinceClean >= 20;
  const cards = [
    { key: "beans", label: "원두량", val: d.beans, unit: "%", alert: d.beans < 15 },
    { key: "water", label: "물탱크", val: d.water, unit: "%", alert: d.water < 15 },
  ];
  const wrap = $("#device");
  wrap.innerHTML = "";
  cards.forEach((c) => {
    const el = document.createElement("div");
    el.className = "device-card" + (c.alert ? " alert" : "");
    el.innerHTML = `<div>${c.label}</div><div class="lvl">${c.val}${c.unit}</div>
      <div class="bar"><span style="width:${c.val}%"></span></div>
      ${c.alert ? '<div class="muted">⚠️ 곧 채워주세요</div>' : ""}`;
    wrap.appendChild(el);
  });
  const clean = document.createElement("div");
  clean.className = "device-card" + (cleanNeeded ? " alert" : "");
  clean.innerHTML = `<div>청소 알림</div><div class="lvl">${d.shotsSinceClean} / 20샷</div>
    <div class="bar"><span style="width:${Math.min(100, (d.shotsSinceClean / 20) * 100)}%"></span></div>
    ${cleanNeeded ? '<div class="muted">🧼 청소가 필요합니다</div>' : '<div class="muted">양호</div>'}`;
  wrap.appendChild(clean);
}
function bindReset() {
  $("#btn-device-reset").addEventListener("click", () => {
    state.device = { beans: 100, water: 100, shotsSinceClean: 0 };
    save("device", state.device);
    renderDevice();
    setStatus("기기 리필/청소 완료", "done");
  });
  $("#btn-reset-all").addEventListener("click", () => {
    if (!confirm("저장된 레시피·설정·예약·기기상태를 모두 초기화할까요?")) return;
    resetAll();
    location.reload();
  });
}

/* --------------------------------- AI --------------------------------- */
function bindAI() {
  $("#btn-ai-barista").addEventListener("click", async () => {
    const prefs = { taste: $("#ai-prefs").value || "밸런스" };
    const out = $("#ai-out-barista");
    out.textContent = "";
    const { text } = await askAI("barista", { prefs, beans: state.beans }, { onToken: (c) => (out.textContent += c) });
    state.lastRecommend = deriveRecommend(prefs);
    $("#btn-ai-apply").hidden = false;
    if (!out.textContent) out.textContent = text;
  });
  $("#btn-ai-apply").addEventListener("click", () => {
    if (!state.lastRecommend) return;
    state.current = { ...state.current, ...state.lastRecommend };
    persistCurrent(); syncRemoteUI(); renderPlan();
    setStatus("AI 추천 적용됨 — 리모컨 확인", "done");
  });
  $("#btn-ai-explain").addEventListener("click", async () => {
    const out = $("#ai-out-explain");
    out.textContent = "";
    const recipe = { ...state.current, name: "현재 리모컨 설정" };
    const { text } = await askAI("explain", { recipe, beans: state.beans }, { onToken: (c) => (out.textContent += c) });
    if (!out.textContent) out.textContent = text;
  });
  $("#btn-ai-pairing").addEventListener("click", async () => {
    const out = $("#ai-out-pairing");
    out.textContent = "";
    const beanId = $("#ai-bean").value;
    const { text } = await askAI("pairing", { beanId, beans: state.beans }, { onToken: (c) => (out.textContent += c) });
    if (!out.textContent) out.textContent = text;
  });
}
// 챗봇 텍스트와 동일 규칙으로 리모컨 적용값 도출 (ai.js 의 규칙과 정렬).
function deriveRecommend(prefs) {
  const taste = prefs.taste || "";
  const wantsAcidity = taste.includes("산미");
  const wantsStrong = taste.includes("진");
  const wantsMilk = taste.includes("우유");
  let strength = "medium";
  if (wantsStrong) strength = "strong"; else if (wantsAcidity) strength = "light";
  let bean = state.beans[0].id;
  for (const b of state.beans) {
    if (wantsAcidity && b.acidity >= 4) { bean = b.id; break; }
    if (wantsStrong && b.bitterness >= 4) { bean = b.id; break; }
  }
  return { bean, strength, shots: wantsStrong ? 2 : 1, volume: wantsMilk ? 40 : (wantsAcidity ? 160 : 30), temp: 92, milk: wantsMilk ? "steamed" : "none" };
}

/* ------------------------------- 스펙 / BOM ------------------------------- */
function renderSpecs() {
  $("#spec-concept").textContent = `${state.specs.product.tagline} — ${state.specs.product.concept}`;
  const tb = $("#specs tbody");
  tb.innerHTML = state.specs.specs.map((s) =>
    `<tr><td>${escapeHTML(s.group)}</td><td>${escapeHTML(s.item)}</td><td>${escapeHTML(s.value)}</td><td>${escapeHTML(s.note)}</td></tr>`
  ).join("");
}
function renderBOM() {
  $("#bom-disclaimer").textContent = state.parts.disclaimer;
  const tb = $("#bom tbody");
  let total = 0;
  tb.innerHTML = state.parts.parts.map((p) => {
    const sub = p.qty * p.unitPrice; total += sub;
    return `<tr><td>${escapeHTML(p.name)}</td><td>${escapeHTML(p.category)}</td><td>${p.qty}</td><td>${p.unitPrice.toLocaleString("ko-KR")}</td><td>${sub.toLocaleString("ko-KR")}</td></tr>`;
  }).join("");
  $("#bom-total").textContent = total.toLocaleString("ko-KR");
}

/* -------------------------------- 유틸 -------------------------------- */
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
