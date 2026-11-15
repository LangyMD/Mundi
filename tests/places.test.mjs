// What a game changed about the world's places (sim/placestate.ts): closing, hiding, renaming, describing; who goes
// there; the map; what the AI is told. Run: node tests/places.test.mjs [repo root]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stage, browser, seed, world } from './env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ?? path.join(here, '..');
const ext = stage(root, 'places');
const meta = {}; browser(meta);
const D = (p) => import(`${ext}/dist/${p}`);
const store = await D('core/store.js'); const W = await D('core/world.js');
const DN = await D('sim/daynight.js'); const Pl = await D('sim/places.js'); const PS = await D('sim/placestate.js');
const people = await D('sim/people.js'); const P = await D('sim/prompt.js'); const needs = await D('sim/needs.js');
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('  FAIL', m); } };
const fixture = (f) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', f), 'utf8'));
const open = (s) => { for (const k of Object.keys(meta)) delete meta[k]; meta.mundi = s; return store.game(); };
seed(9);
const w = world(ext, 'modern'); W.registerWorld(w);
const before = JSON.stringify(w.places);
const g = open(fixture('v0.1.0-modern.json'));
const noon = 12 * 60; g.minutes = noon;
const mall = w.places.find(p => p.id === 'mall');

/* ---------- nothing changed ---------- */
ok(PS.stateOf(g, 'mall') === null && !PS.isShut(g, 'mall'), 'a fresh game: nothing changed');
ok(Pl.placeOf(g, w, 'mall') === mall, 'the place is the world\'s own');
ok(DN.openNow(g, w, 'mall'), 'the mall is open at noon');
ok(PS.changeLines(g, 'mall', id => id).length === 0, 'nothing to tell the AI');

/* ---------- closing ---------- */
PS.closePlace(g, 'mall', mall.name, 'a  fire', 3);
ok(!DN.openNow(g, w, 'mall') && PS.closedWhy(g, 'mall') === 'a fire', 'closed, with its reason');
ok(PS.stateOf(g, 'mall').closed.until === store.nowAbs(g) + 3 * 1440, 'for three days');
g.player.loc = 'mall';
ok(needs.actionsHere(g, w).every(a => a.anywhere), 'nothing to do in a closed place but what can be done anywhere');
ok(/\(closed: a fire; nobody is working here\)/.test(P.sceneText()), 'the AI is told it is closed, and why');
ok(/Changed lately here: .*closed \(a fire\) for 3 days\./.test(P.sceneText()), 'and that it changed lately');
g.player.loc = 'park';
ok(/Closed in town right now: .*\(a fire, 3 more days\)/.test(P.sceneText()), 'elsewhere: the AI knows what is closed in town');
{
    // everyone whose day would take them to the mall is at home instead
    let there = 0, checked = 0;
    for (const r of Object.values(g.cast)) for (let h = 8; h < 22; h++) { checked++; if (people.routineAt(g, w, r, g.day * 1440 + h * 60) === 'mall') there++; }
    ok(checked > 0 && there === 0, `nobody's routine takes them to a closed place (${checked} checked)`);
}
g.day += 2; ok(!DN.openNow(g, w, 'mall'), 'still closed two days later');
g.day += 1; ok(DN.openNow(g, w, 'mall') && PS.stateOf(g, 'mall') === null, 'open again by itself, and the record is gone');
PS.closePlace(g, 'mall', mall.name, '', 0);
g.day += 40; ok(!DN.openNow(g, w, 'mall') && PS.closedWhy(g, 'mall') === 'closed', 'closed with no end stays closed');
PS.reopenPlace(g, 'mall', mall.name);
ok(DN.openNow(g, w, 'mall') && PS.stateOf(g, 'mall') === null, 'reopened by hand');
ok(PS.worldLog(g).at(-1).text === `${mall.name} reopened.`, 'the log says so');

/* ---------- off the map ---------- */
g.player.loc = 'park';
ok(Pl.pins(g, w).some(p => p.id === 'mall'), 'on the map');
PS.hidePlace(g, 'mall', mall.name, true);
ok(!Pl.pins(g, w).some(p => p.id === 'mall') && PS.isHidden(g, 'mall') && !DN.openNow(g, w, 'mall'), 'hidden: off the map, and shut');
g.player.loc = 'mall'; ok(Pl.pins(g, w).some(p => p.id === 'mall'), 'unless you are standing in it');
g.player.loc = 'park';
const n = PS.worldLog(g).length; PS.hidePlace(g, 'mall', mall.name, true); ok(PS.worldLog(g).length === n, 'hiding twice logs once');
PS.hidePlace(g, 'mall', mall.name, false);
ok(Pl.pins(g, w).some(p => p.id === 'mall') && PS.stateOf(g, 'mall') === null, 'back on the map');

/* ---------- a new name, a new look ---------- */
PS.describePlace(g, 'mall', mall.name, { name: '  Grand   Arcade ' });
ok(Pl.placeOf(g, w, 'mall').name === 'Grand Arcade' && Pl.pins(g, w).find(p => p.id === 'mall').name === 'Grand Arcade', 'renamed, on the map too');
PS.describePlace(g, 'mall', mall.name, { descAdd: 'The east wing is boarded up.' });
ok(Pl.placeOf(g, w, 'mall').desc === `${mall.desc} The east wing is boarded up.`, 'the description gets its addition');
g.player.loc = 'mall';
ok(/Place: Grand Arcade — .*The east wing is boarded up\./.test(P.sceneText()), 'the AI sees the place as it is now');
PS.describePlace(g, 'mall', mall.name, { desc: 'A gutted shell.' });
ok(Pl.placeOf(g, w, 'mall').desc === 'A gutted shell. The east wing is boarded up.', 'a description of its own replaces the world\'s');
const m = PS.worldLog(g).length; PS.describePlace(g, 'mall', mall.name, { name: 'Grand Arcade' }); ok(PS.worldLog(g).length === m, 'the same name again changes nothing');
PS.describePlace(g, 'mall', mall.name, { name: mall.name });
ok(Pl.placeOf(g, w, 'mall').name === mall.name, 'the world\'s own name gives it back');
PS.resetPlace(g, 'mall', mall.name);
ok(Pl.placeOf(g, w, 'mall') === mall && PS.stateOf(g, 'mall') === null, 'back to how the world has it');

/* ---------- the world file is never touched; the log stays small ---------- */
ok(JSON.stringify(w.places) === before, 'the world itself did not change');
for (let i = 0; i < 100; i++) PS.closePlace(g, 'park', 'Park', `r${i}`, 1);
ok(PS.worldLog(g).length === 60, 'the log keeps the last 60 changes');
ok(Pl.placeOf(g, w, 'home:player')?.name === 'My home', 'homes are untouched');

console.log(fails ? `${fails} FAILED, ${passes} passed` : `${passes} checks passed`);
process.exit(fails ? 1 : 0);
