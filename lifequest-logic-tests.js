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

/* ============ 4b. クリスタル経済 (E7 / S7-1) ============ */
section("crystal economy");
{
  const CRYSTAL_CONFIG = { normal: 5, boss: 30, fusion: 50, levelUp: 20, streakDailyMult: 2 };
  let crystals = 0;
  const gainCrystals = a => { if (a) crystals += a; };

  // simulate completing a normal quest (also first achievement day -> streak bonus)
  let streak = 1; // after registerCompletion on a fresh day
  gainCrystals(streak * CRYSTAL_CONFIG.streakDailyMult); // streak daily bonus
  gainCrystals(CRYSTAL_CONFIG.normal);                   // per-task
  A(crystals === 2 + 5, "daily quest: streak bonus(2) + normal(5) = 7");

  // boss quest on the same day (no new streak bonus)
  gainCrystals(CRYSTAL_CONFIG.boss);
  A(crystals === 7 + 30, "boss quest adds 30 -> 37");

  // a level-up during exp gain
  gainCrystals(CRYSTAL_CONFIG.levelUp);
  A(crystals === 37 + 20, "level-up adds 20 -> 57");

  // a fusion
  gainCrystals(CRYSTAL_CONFIG.fusion);
  A(crystals === 57 + 50, "fusion adds 50 -> 107");

  // zero / falsy guard
  gainCrystals(0); gainCrystals(undefined);
  A(crystals === 107, "no-op on 0/undefined");

  // persistence round-trip (apply default)
  const apply = s => Number.isFinite(s.crystals) ? s.crystals : 0;
  A(apply({ crystals: 107 }) === 107, "crystals persisted");
  A(apply({}) === 0, "missing crystals -> 0 (legacy save)");
}

/* ============ 4c. ガチャ (E8 / S8-1) ============ */
section("gacha");
{
  const DEFS = [
    { id: "a5", rarity: 5 }, { id: "b5", rarity: 5 },
    { id: "a4", rarity: 4 }, { id: "b4", rarity: 4 },
    { id: "a3", rarity: 3 }, { id: "b3", rarity: 3 }, { id: "c3", rarity: 3 },
  ];
  const CFG = { rates: { 5: 3, 4: 22, 3: 75 }, pity5: 100, tenGuaranteeRarity: 4 };
  const byR = r => DEFS.filter(d => d.rarity === r);
  let pity5 = 0;
  const owned = {};
  const rollRarity = () => { const r = Math.random() * 100; if (r < CFG.rates[5]) return 5; if (r < CFG.rates[5] + CFG.rates[4]) return 4; return 3; };
  const pick = r => byR(r)[Math.floor(Math.random() * byR(r).length)];
  function pullOne() { let rar; if (pity5 + 1 >= CFG.pity5) rar = 5; else rar = rollRarity(); if (rar === 5) pity5 = 0; else pity5 += 1; return pick(rar); }
  function pullMany(n) { const res = []; for (let i = 0; i < n; i++) res.push(pullOne()); if (n >= 10 && !res.some(d => d.rarity >= CFG.tenGuaranteeRarity)) { const i = res.map(d => d.rarity).lastIndexOf(3); if (i >= 0) res[i] = pick(CFG.tenGuaranteeRarity); } return res; }
  function grant(defs) { return defs.map(d => { const isNew = !owned[d.id]; owned[d.id] = (owned[d.id] || 0) + 1; return { def: d, isNew }; }); }

  // rates: over many pulls, every result is a valid rarity and pulls a valid def
  let ok = true; for (let i = 0; i < 2000; i++) { const d = pullOne(); if (![3, 4, 5].includes(d.rarity) || !DEFS.find(x => x.id === d.id)) ok = false; }
  A(ok, "every pull returns a valid def of rarity 3/4/5");

  // pity: 99 non-5 pulls then the 100th is forced ★5
  pity5 = 0;
  let lastNon5 = null;
  // force a worst case by setting pity5 to 99 directly and pulling
  pity5 = 99;
  const forced = pullOne();
  A(forced.rarity === 5, "hard pity forces ★5 at the cap");
  A(pity5 === 0, "pity counter resets after ★5");

  // 10-pull guarantee: run several 10-pulls, each must contain >=1 of rarity>=4
  let allGuaranteed = true;
  for (let t = 0; t < 200; t++) { pity5 = 0; const r = pullMany(10); if (!r.some(d => d.rarity >= 4)) allGuaranteed = false; }
  A(allGuaranteed, "10-pull always yields at least one ★4+");

  // dupes + isNew
  const g1 = grant([DEFS[0]]); A(g1[0].isNew === true && owned.a5 === 1, "first copy is NEW, count 1");
  const g2 = grant([DEFS[0]]); A(g2[0].isNew === false && owned.a5 === 2, "dupe not NEW, count 2");

  // persistence round-trip of owned map
  const applyOwned = s => { const o = {}; if (s.owned) Object.keys(s.owned).forEach(k => { const n = Number(s.owned[k]); if (n > 0) o[k] = n; }); return o; };
  A(JSON.stringify(applyOwned({ owned: { a5: 2, a3: 1 } })) === JSON.stringify({ a5: 2, a3: 1 }), "owned map persists");
  A(Object.keys(applyOwned({})).length === 0, "missing owned -> empty (legacy save)");
}

/* ============ 4d. メインキャラ & スキル→技 (E10) ============ */
section("main character & skill->tech");
{
  const MC = { hpBase: 500, hpPerLv: 120, atkBase: 80, atkPerLv: 14, spd: 100 };
  const stats = lv => ({ level: lv, hp: MC.hpBase + lv * MC.hpPerLv, atk: MC.atkBase + lv * MC.atkPerLv, spd: MC.spd });
  A(stats(7).hp === 1340 && stats(7).atk === 178 && stats(7).spd === 100, "LV7 stats derived");
  A(stats(8).hp === stats(7).hp + 120, "stats scale with level");

  const SKILL_BATTLE = { "フロントエンド構築": { power: 120, cooldown: 2, element: "風", effect: "x" } };
  const FUSED_BATTLE = { "フルスタック開発者": { power: 320, cooldown: 4, element: "光", effect: "y" } };
  let fusedIds = ["フルスタック開発者"];
  const skillTech = name => {
    if (fusedIds.includes(name)) { const b = FUSED_BATTLE[name] || { power: 300, cooldown: 4, element: "光", effect: "必殺" }; return Object.assign({ name, kind: "fused" }, b); }
    const b = SKILL_BATTLE[name] || { power: 100, cooldown: 2, element: "無", effect: "基本" }; return Object.assign({ name, kind: "unique" }, b);
  };
  A(skillTech("フロントエンド構築").kind === "unique" && skillTech("フロントエンド構築").power === 120, "known unique -> tech");
  A(skillTech("フルスタック開発者").kind === "fused" && skillTech("フルスタック開発者").power === 320, "fused -> ultimate tech");
  A(skillTech("謎スキル").power === 100 && skillTech("謎スキル").element === "無", "unknown skill -> fallback tech");

  // equip cap
  const MAX = 4; let equipped = [];
  const toggleEquip = name => { const i = equipped.indexOf(name); if (i >= 0) equipped.splice(i, 1); else { if (equipped.length >= MAX) return false; equipped.push(name); } return true; };
  ["a", "b", "c", "d"].forEach(toggleEquip);
  A(equipped.length === 4, "can equip up to 4");
  A(toggleEquip("e") === false && equipped.length === 4, "5th equip rejected");
  toggleEquip("a"); A(equipped.length === 3 && !equipped.includes("a"), "unequip frees a slot");

  // load validation: drop equipped not owned, cap at MAX
  const validate = (saved, ownedNames) => { const out = []; saved.forEach(x => { if (ownedNames.includes(x) && !out.includes(x) && out.length < MAX) out.push(x); }); return out; };
  A(JSON.stringify(validate(["x", "y", "z"], ["x", "z"])) === JSON.stringify(["x", "z"]), "drops unowned equipped on load");
  A(validate(["a", "a", "a", "a", "a", "a"], ["a"]).length === 1, "dedupe + cap on load");
}

/* ============ 4e. チーム編成 & バトル (E9 / E11) ============ */
section("team & battle");
{
  const DEFS = [{ id: "a", rarity: 5 }, { id: "b", rarity: 4 }, { id: "c", rarity: 3 }, { id: "d", rarity: 3 }];
  const owned = { a: 1, b: 1, c: 2 };
  const SLOTS = 2;

  // team load validation: only owned, no dupes, capped
  const validate = saved => { const t = [null, null]; let slot = 0; saved.forEach(id => { if (slot >= SLOTS) return; if (id && owned[id] && DEFS.find(d => d.id === id) && !t.includes(id)) t[slot++] = id; }); return t; };
  A(JSON.stringify(validate(["a", "b"])) === JSON.stringify(["a", "b"]), "valid team kept");
  A(JSON.stringify(validate(["a", "a"])) === JSON.stringify(["a", null]), "dupe rejected");
  A(JSON.stringify(validate(["z", "c"])) === JSON.stringify(["c", null]), "unowned dropped");
  A(JSON.stringify(validate(["a", "b", "c"])) === JSON.stringify(["a", "b"]), "capped at 2");

  // 図鑑 counts
  const total = DEFS.length, ownedCount = Object.keys(owned).length;
  A(total === 4 && ownedCount === 3, "図鑑: owned 3 / total 4");

  // battle: strong allies beat weak enemies; weak allies lose to strong enemies
  function sim(allies, enemies) {
    allies = allies.map(u => ({ ...u })); enemies = enemies.map(u => ({ ...u }));
    const firstAlive = a => a.find(u => u.hp > 0);
    let rounds = 0;
    while (allies.some(u => u.hp > 0) && enemies.some(u => u.hp > 0) && rounds < 100) {
      rounds++;
      const order = allies.concat(enemies).filter(u => u.hp > 0).sort((x, y) => y.spd - x.spd);
      for (const u of order) { if (u.hp <= 0) continue; const foes = allies.includes(u) ? enemies : allies; const t = firstAlive(foes); if (!t) break; t.hp -= Math.max(1, u.atk); }
    }
    return allies.some(u => u.hp > 0) && !enemies.some(u => u.hp > 0);
  }
  A(sim([{ hp: 2000, atk: 300, spd: 120 }], [{ hp: 300, atk: 20, spd: 50 }]) === true, "strong team wins");
  A(sim([{ hp: 200, atk: 20, spd: 50 }], [{ hp: 2000, atk: 300, spd: 120 }]) === false, "weak team loses");

  // main char effective atk gets a bonus from equipped techs
  const baseAtk = 178;
  const techBonus = Math.round([120, 100].reduce((s, p) => s + p, 0) / 4);
  A(baseAtk + techBonus === 178 + 55, "equipped techs boost main atk");

  // first-clear reward is one-time
  const cleared = {}; let crystals = 0; const reward = 30;
  function clear(id) { if (!cleared[id]) { cleared[id] = true; crystals += reward; return true; } return false; }
  A(clear("s1") === true && crystals === 30, "first clear grants reward");
  A(clear("s1") === false && crystals === 30, "repeat clear grants nothing");
}

/* ============ 4f. バトルPhase2: 属性相性 & CT (E12) ============ */
section("battle phase2 (affinity & CT)");
{
  const ELEM_BEATS = { "火": "風", "風": "土", "土": "水", "水": "火", "光": "闇", "闇": "光" };
  const mult = (a, d) => { if (!a || !d || a === "無" || d === "無") return 1; if (ELEM_BEATS[a] === d) return 1.5; if (ELEM_BEATS[d] === a) return 0.75; return 1; };
  A(mult("火", "風") === 1.5, "火>風 advantage 1.5");
  A(mult("風", "火") === 0.75, "風<火 disadvantage 0.75");
  A(mult("土", "水") === 1.5 && mult("水", "火") === 1.5, "cycle continues");
  A(mult("光", "闇") === 1.5 && mult("闇", "光") === 1.5, "光⇆闇 mutual advantage");
  A(mult("火", "火") === 1 && mult("無", "水") === 1 && mult("火", "無") === 1, "same/neutral = 1.0");

  // CT: skill ready -> used (cd set) -> blocked until cd elapses -> ready again
  const skill = { power: 100, cooldown: 3, cdLeft: 0 };
  const pick = skills => { const r = skills.filter(s => s.cdLeft <= 0).sort((a, b) => b.power - a.power); return r[0] || null; };
  const tickAfterUse = (skills, used) => skills.forEach(s => { if (s === used) s.cdLeft = s.cooldown; else if (s.cdLeft > 0) s.cdLeft--; });
  let used = pick([skill]); A(used === skill, "ready skill is picked");
  tickAfterUse([skill], used);
  A(skill.cdLeft === 3, "cd set after use");
  A(pick([skill]) === null, "skill on cooldown -> basic attack");
  tickAfterUse([skill], null); tickAfterUse([skill], null); tickAfterUse([skill], null);
  A(skill.cdLeft === 0 && pick([skill]) === skill, "skill ready again after CT elapses");

  // damage includes skill power and affinity
  const dmg = (atk, skillPower, m) => Math.round((atk + skillPower) * m);
  A(dmg(100, 100, 1.5) === 300, "skill dmg w/ advantage = (100+100)*1.5");
  A(dmg(100, 0, 0.75) === 75, "basic dmg w/ disadvantage");
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
