/**
 * LifeQuest ロジック回帰テスト (S6-2)
 *
 * 目的: DOM 非依存のコアロジック（永続化 / EXP・レベル / ストリーク・習慣 /
 *       融合レシピ）を Node で素早く検証する。
 *
 * 実行: node lifequest-logic-tests.js
 *
 * 注意: これは lifequest.html 内ロジックの「ミラー実装」テストです。HTML強化
 *       フェーズの軽量ガードとして用い、React 化の段階で本物の単体テスト
 *       （Vitest 等）へ移行します（設計書 6.2 / ストーリー S6-2 参照）。
 *       ロジックを lifequest.html で変更したら、このファイルも更新すること。
 */
"use strict";

let pass = 0, fail = 0;
const A = (cond, msg) => {
  if (cond) { pass++; console.log("  ok  " + msg); }
  else { fail++; console.error("  FAIL " + msg); }
};
const section = name => console.log("\n[" + name + "]");

/* ============ 1. 永続化 (S1-1 / S1-2) ============ */
section("persistence");
{
  const store = {};
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => store[k] = String(v),
    removeItem: k => delete store[k]
  };
  const STORAGE_KEY = "lifequest:v1", STATE_VERSION = 1;
  const clone = o => JSON.parse(JSON.stringify(o));
  const DEFAULT_QUESTS = [
    { id: "q1", title: "a", exp: 30, boss: false, habit: true },
    { id: "q3", title: "b", exp: 200, boss: true, skill: "フロント", habit: false }
  ];
  let QUESTS = clone(DEFAULT_QUESTS);
  let LV = 7, EXP = 0, totalExpEarned = 0;
  const skills = [], fusedIds = [];
  let streak = 0, lastCompletionDate = null, lastSeenDate = null, _suspendSave = false;

  const serialize = () => ({
    version: STATE_VERSION, LV, EXP, totalExpEarned, fusedIds: fusedIds.slice(),
    streak, lastCompletionDate, lastSeenDate, skills: skills.slice(),
    quests: QUESTS.map(q => ({ id: q.id, title: q.title, exp: q.exp, boss: !!q.boss, skill: q.skill, habit: !!q.habit, done: !!q.done }))
  });
  const saveState = () => { if (_suspendSave) return; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize())); } catch (e) {} };
  const loadState = () => {
    let raw; try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    if (!raw) return null;
    try { const s = JSON.parse(raw); if (!s || typeof s !== "object") return null; if (s.version !== STATE_VERSION) return null; if (!Array.isArray(s.quests)) return null; return s; }
    catch (e) { return null; }
  };

  A(loadState() === null, "missing storage -> null");
  QUESTS[0].done = true; EXP = 230; totalExpEarned = 230; skills.push("フロント");
  saveState();
  LV = 7; EXP = 0; totalExpEarned = 0; skills.length = 0; QUESTS = clone(DEFAULT_QUESTS);
  const s = loadState();
  A(s !== null && s.EXP === 230, "saved EXP loads");
  A(s.skills.length === 1 && s.quests[0].done === true, "skills/quest-done persisted");
  store[STORAGE_KEY] = "{bad json"; A(loadState() === null, "corrupt json -> null (fallback)");
  store[STORAGE_KEY] = JSON.stringify({ version: 99, quests: [] }); A(loadState() === null, "version mismatch -> null");
}

/* ============ 2. EXP / レベル (S4-1) ============ */
section("exp / level");
{
  const EXP_CONFIG = { base: 500, perLevel: 0 };
  const expForLevel = lv => Math.max(1, EXP_CONFIG.base + EXP_CONFIG.perLevel * (lv - 1));
  let LV = 7, EXP = 0, total = 0;
  const gain = a => { EXP += a; total += a; while (EXP >= expForLevel(LV)) { EXP -= expForLevel(LV); LV += 1; } };
  A(expForLevel(1) === 500, "flat curve = 500");
  gain(200); A(LV === 7 && EXP === 200, "partial exp, no levelup");
  gain(400); A(LV === 8 && EXP === 100, "single levelup with carryover");
  gain(1000); A(LV === 10 && EXP === 100, "multi-levelup in one gain");
  EXP_CONFIG.perLevel = 100; A(expForLevel(3) === 700, "rising curve configurable");
}

/* ============ 3. ストリーク / 習慣 (S3-1 / S3-2) ============ */
section("streak / habit rollover");
{
  let streak = 0, lastCompletionDate = null, lastSeenDate = null, _today = "2026-06-01";
  let QUESTS = [{ id: "h", habit: true, done: false }, { id: "b", habit: false, done: false }];
  const todayStr = () => _today;
  const dayDiff = (a, b) => { const pa = a.split("-").map(Number), pb = b.split("-").map(Number); return Math.round((new Date(pb[0], pb[1] - 1, pb[2]) - new Date(pa[0], pa[1] - 1, pa[2])) / 86400000); };
  const registerCompletion = () => { const t = todayStr(); if (lastCompletionDate === t) return; if (lastCompletionDate && dayDiff(lastCompletionDate, t) === 1) streak += 1; else streak = 1; lastCompletionDate = t; };
  const rollover = () => { const t = todayStr(); if (lastSeenDate === t) return; QUESTS.forEach(q => { if (q.habit) q.done = false; }); if (!lastCompletionDate || dayDiff(lastCompletionDate, t) >= 2) streak = 0; lastSeenDate = t; };

  rollover(); registerCompletion(); A(streak === 1, "day1 streak=1");
  registerCompletion(); A(streak === 1, "no double-count same day");
  _today = "2026-06-02"; rollover(); A(QUESTS[0].done === false, "habit reset next day");
  registerCompletion(); A(streak === 2, "consecutive day -> 2");
  QUESTS[1].done = true; _today = "2026-06-03"; rollover(); A(QUESTS[1].done === true, "non-habit persists across day");
  _today = "2026-06-05"; rollover(); A(streak === 0, "missed a day -> streak broken");
  registerCompletion(); A(streak === 1, "restart at 1 after gap");
}

/* ============ 4. 融合レシピ (S5-2) ============ */
section("fusion recipes");
{
  const FUSE_RECIPES = [{ id: "fullstack", materials: ["フロント", "バック", "DB"], result: "フルスタック", desc: "d", exp: 500 }];
  let skills = ["フロント", "バック"]; const fusedIds = [];
  const isFused = r => fusedIds.includes(r.result);
  const recipeReady = r => !isFused(r) && r.materials.every(m => skills.includes(m));
  const isConsumed = s => FUSE_RECIPES.some(r => isFused(r) && r.materials.includes(s));
  const getReadyRecipe = () => FUSE_RECIPES.find(recipeReady) || null;

  A(getReadyRecipe() === null, "2/3 materials -> not ready");
  skills.push("DB"); A(getReadyRecipe() !== null, "3/3 -> ready");
  const r = getReadyRecipe(); fusedIds.push(r.result);
  A(getReadyRecipe() === null, "one-time: not ready after fusing");
  A(isConsumed("フロント") && !isConsumed("高速タスク処理"), "consumed flag correct");
  // legacy migration
  const migrate = st => { const ids = []; if (Array.isArray(st.fusedIds)) st.fusedIds.forEach(x => ids.push(x)); else if (st.fused) ids.push(FUSE_RECIPES[0].result); return ids; };
  A(migrate({ fused: true }).length === 1, "legacy fused:true migrates");
}

/* ============ 5. HTMLエスケープ (S6-1) ============ */
section("html escape");
{
  const esc = str => String(str == null ? "" : str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  A(!esc("<img onerror=x>").includes("<"), "angle brackets escaped");
  A(esc("a&b").includes("&amp;"), "ampersand escaped");
  A(esc(null) === "", "null -> empty string");
}

/* ============ summary ============ */
console.log("\n========================================");
console.log(`  ${pass} passed, ${fail} failed`);
console.log("========================================");
process.exit(fail ? 1 : 0);
