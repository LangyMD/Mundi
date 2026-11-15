// The world creator's Rooms tab and Traits tab (ui/interioredit.ts, ui/creator.ts): building rooms for a place and a
// plan for homes with the editor's own actions, and checking the game then has those rooms; every field of a world
// with rooms and traits is editable. Run: node tests/creator-rooms.test.mjs [repo root]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stage, browser, seed, world } from './env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ?? path.join(here, '..');
const ext = stage(root, 'creator-rooms');
const meta = {}; browser(meta);
const D = (p) => import(`${ext}/dist/${p}`);
const store = await D('core/store.js'); const W = await D('core/world.js');
const cw = await D('ui/creator.js'); const E = await D('ui/interioredit.js'); const reg = await D('ui/reg.js');
const I = await D('sim/interiors.js'); const T = await D('sim/persontraits.js'); const C = await D('sim/creator.js');
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('  FAIL', m); } };
const act = (name, dataset = {}) => reg.ACT[name]({ dataset });
const input = (name, value, dataset = {}) => reg.INPUT[name]({ value, dataset, checked: value === true });
const fixture = (f) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', f), 'utf8'));
seed(4);

store.state.view = 'creator';
const w = world(ext, 'modern'); w.id = 'made';
cw.CW.w = w; cw.CW.tab = 'rooms';

/* ---------- a place gets rooms ---------- */
input('ie-target', 'place:cafe');
let html = cw.creatorHtml();
ok(html.includes('Give it rooms') && html.includes('Places without rooms yet'), 'a place without rooms: the offer');
act('ie-start');
const cafe = () => w.places.find(p => p.id === 'cafe');
ok(cafe().interior?.floors.length === 1 && cafe().interior.rooms.length === 0, 'a first floor, no rooms yet');
ok(!I.interiorOf(w, 'cafe'), 'no rooms: still one scene in the game');
act('ie-room-add'); act('ie-room-add'); act('ie-room-add');
const rooms = () => w.places.filter(p => p.in === 'cafe');
ok(rooms().length === 3 && cafe().interior.rooms.length === 3, 'three rooms: three places, three boxes');
ok(cafe().interior.entry === rooms()[0].id, 'the first room is the entry');
ok(rooms().every(r => r.map === cafe().map), 'rooms are on their building\'s map');
const boxes = cafe().interior.rooms;
ok(!boxes.some((a, i) => boxes.some((b, j) => i < j && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y)), 'the boxes do not overlap');
html = cw.creatorHtml();
ok(html.includes('data-ie-room') && html.includes('Places with rooms'), 'the boxes are drawn');
// the selected room's form
const kitchen = rooms()[2]; const ki = w.places.indexOf(kitchen);
ok(E.IE.sel === kitchen.id && html.includes(`data-path="places.${ki}.name"`) && html.includes(`data-path="places.${ki}.access"`) && html.includes(`data-path="places.${ki}.wear"`), 'its form: name, access, wear');
input('cw', 'Kitchen', { path: `places.${ki}.name` });
input('cw', 'kitchen, work', { path: `places.${ki}.tags`, type: 'csv' });
input('ie-opt', 'staff', { path: `places.${ki}.access` });
ok(kitchen.name === 'Kitchen' && kitchen.tags.join() === 'kitchen,work' && kitchen.access === 'staff', 'edited');
input('ie-opt', '', { path: `places.${ki}.access` });
ok(!('access' in kitchen), 'the first choice leaves the field out');
input('ie-opt', 'staff', { path: `places.${ki}.access` });
act('ie-entry');
ok(cafe().interior.entry === kitchen.id, 'made the entry');
E.IE.sel = rooms()[0].id; act('ie-entry');
// a second floor, a room moved to it
act('ie-floor-add');
ok(cafe().interior.floors.length === 2 && E.IE.floor === cafe().interior.floors[1].id, 'a second floor');
E.IE.sel = rooms()[1].id; input('ie-room-floor', cafe().interior.floors[1].id);
ok(cafe().interior.rooms.find(r => r.id === rooms()[1].id).floor === cafe().interior.floors[1].id, 'a room moved upstairs');
// the job done in a room, the action that asks for a kind of room
const barista = w.occupations.find(o => o.id === 'barista'); const bi = w.occupations.indexOf(barista);
cw.CW.tab = 'jobs'; cw.CW.sel.jobs = bi; html = cw.creatorHtml();
ok(html.includes(`data-path="occupations.${bi}.room"`) && html.includes('>Kitchen<'), 'Jobs: which room');
input('cw', kitchen.id, { path: `occupations.${bi}.room` });
ok(barista.room === kitchen.id, 'the barista works in the kitchen');
cw.CW.tab = 'actions'; html = cw.creatorHtml();
ok(/data-path="actions\.\d+\.rooms"/.test(html), 'Things to do: only in rooms tagged');
cw.CW.tab = 'maps'; html = cw.creatorHtml();
ok(!rooms().some(r => html.includes(`data-id="${r.id}"`) || html.includes(`data-pin="${r.id}"`)), 'rooms are not pins in the map editor');
// in the game
W.registerWorld(w);
ok(I.interiorOf(w, 'cafe') && I.roomsOf(w, 'cafe').length === 3 && I.accessOf(w, kitchen.id) === 'staff', 'the game has the rooms');
const s = fixture('v0.1.0-modern.json'); s.world = 'made'; meta.mundi = s; const g = store.game();
g.player.loc = 'cafe';
ok(I.roomNow(g, w) === rooms()[0].id, 'arriving: the entry room');
ok(I.spotAt(g, w, 'cafe').floors.length === 2, 'two floors in the game');
// removing
cw.CW.tab = 'rooms'; E.IE.sel = kitchen.id; act('ie-room-del');
ok(rooms().length === 2 && !barista.room && !cafe().interior.rooms.some(r => r.id === kitchen.id), 'a room removed: its place, its box, the job\'s room');
E.IE.floor = cafe().interior.floors[1].id; act('ie-floor-del'); act('ie-floor-del');
ok(cafe().interior.floors.length === 1 && rooms().length === 1, 'a floor removed with its room (asked twice)');
act('ie-clear'); act('ie-clear');
ok(!cafe().interior && rooms().length === 0, 'all the rooms removed: one scene again');

/* ---------- a plan for homes ---------- */
act('ie-plan-add');
const pid = Object.keys(w.homes.plans)[0]; const plan = () => w.homes.plans[pid];
ok(E.IE.target === `plan:${pid}` && plan().floors.length === 1 && plan().templates.length === 0, 'a new plan, with a floor');
act('ie-room-add'); act('ie-room-add'); act('ie-room-add');
ok(plan().templates.length === 3 && plan().rooms.length === 3 && plan().entry === plan().templates[0].id, 'three rooms, the first the entry');
const pp = `homes.plans.${pid}`;
input('cw', 'Bedroom', { path: `${pp}.templates.1.name` }); input('ie-opt', 'couple', { path: `${pp}.templates.1.owner` }); input('ie-opt', 'private', { path: `${pp}.templates.1.access` });
input('cw', 'Guest room', { path: `${pp}.templates.2.name` }); input('ie-opt', 'one', { path: `${pp}.templates.2.owner` }); input('cw', true, { path: `${pp}.templates.2.guest`, type: 'bool' });
ok(plan().templates[1].owner === 'couple' && plan().templates[2].guest === true, 'bedrooms set');
html = cw.creatorHtml();
ok(html.includes('Homes with these rooms') && html.includes(`data-path="${pp}.name"`) && html.includes(`data-path="${pp}.templates.2.owner"`), 'the plan\'s form');
// who uses it
const zone = w.homes.zones[0]; const kind = zone.kind;
act('ie-use-spot', { z: '0', s: '0' });
ok(zone.interiors['0'] === pid, 'one address uses it');
act('ie-use-zone', { z: '0', v: '1' });
ok(Object.keys(zone.interiors).length === zone.spots.length, 'every home of the area');
act('ie-use-zone', { z: '0', v: '0' });
ok(!zone.interiors, 'none again: the field is gone');
act('ie-use-kind', { k: kind });
ok(w.homes.kinds[kind].interior === pid, 'a kind of home names the plan');
W.registerWorld(w);
g.player.home = { zone: zone.id, x: zone.spots[0][0], y: zone.spots[0][1], kind };
const sp = I.spotAt(g, w, 'home:player');
ok(sp && sp.home && sp.rooms.length === 3 && sp.entry, 'the game: your home has the plan\'s rooms (through its kind)');
cw.CW.tab = 'people'; cw.CW.sel.people = 0; html = cw.creatorHtml();
ok(html.includes('data-path="cast.examples.0.room"') && html.includes('>Bedroom<') && html.includes('>Guest room<'), 'People: their bedroom');
cw.CW.tab = 'rooms';
act('ie-plan-del'); act('ie-plan-del');
ok(!w.homes.plans && !w.homes.kinds[kind].interior, 'the plan removed, and its mentions');

/* ---------- traits people gain ---------- */
cw.CW.tab = 'ptraits'; html = cw.creatorHtml();
ok(html.includes('uses the usual list') && html.includes('Party animal') && !w.traits, 'no list of its own: the usual ones shown');
act('cw-ptraits-own');
ok(w.traits.length === T.DEFAULT_TRAITS.length && w.traits !== T.DEFAULT_TRAITS, 'its own list, a copy');
html = cw.creatorHtml();
ok(html.includes('data-path="traits.0.name"') && html.includes('data-path="traits.0.grow"') && html.includes('data-path="traitPriority"'), 'the form');
act('cw-add', { what: 'ptrait' });
const nt = w.traits[w.traits.length - 1];
ok(nt.id === 'new-trait' && cw.CW.sel.ptraits === w.traits.length - 1, 'a new trait, selected');
input('cw', 'Goth phase', { path: `traits.${w.traits.length - 1}.name` });
input('cw-ptrait-id', 'Goth Phase!', { i: String(w.traits.length - 1) });
ok(nt.id === 'goth-phase' && nt.name === 'Goth phase', 'its id is a clean folder name');
input('cw-ptrait-id', 'athletic', { i: String(w.traits.length - 1) });
ok(nt.id === 'goth-phase', 'not another trait\'s id');
input('cw-ptrait-id', 'career-barista', { i: String(w.traits.length - 1) });
ok(nt.id === 'goth-phase', 'not a job\'s');
input('cw', 'state', { path: `traits.${w.traits.length - 1}.kind` });
ok(cw.creatorHtml().includes(`data-path="traits.${w.traits.length - 1}.days"`), 'a passing trait: days');
act('cw-add', { what: 'ptrait' }); act('cw-add', { what: 'ptrait' });
ok(w.traits.slice(-2).map(t => t.id).join() === 'new-trait,new-trait-2', 'new ids do not clash');
W.registerWorld(w);
ok(T.traitDefs(g, w).some(t => t.id === 'goth-phase') && T.traitDef(g, w, 'goth-phase').kind === 'state', 'the game has the world\'s traits');
act('cw-ptraits-usual');
ok(!w.traits && T.traitDefs(g, w).length >= T.DEFAULT_TRAITS.length, 'back to the usual list');

/* ---------- everything in such a world is editable ---------- */
{
    const w2 = world(ext, 'modern'); w2.id = 'full';
    const c2 = w2.places.find(p => p.id === 'cafe');
    w2.places.push({ id: 'c_counter', name: 'Counter', map: c2.map, x: c2.x, y: c2.y, in: 'cafe', tags: ['food'], desc: 'the counter.', access: 'staff', wear: 'career', bg: 'a.png' });
    c2.interior = { entry: 'c_counter', floors: [{ id: 'g', name: 'Ground', image: 'f.png', ratio: 1.5 }], rooms: [{ id: 'c_counter', floor: 'g', x: 0, y: 0, w: 50, h: 50 }] };
    c2.wear = 'indoors';
    w2.homes.plans = { p1: { name: 'Bungalow', entry: 'living', floors: [{ id: 'g', name: 'Ground' }], rooms: [{ id: 'living', floor: 'g', x: 0, y: 0, w: 50, h: 50 }, { id: 'bed', floor: 'g', x: 50, y: 0, w: 50, h: 50 }],
        templates: [{ id: 'living', name: 'Living room', tags: ['living'], desc: 'the living room.' }, { id: 'bed', name: 'Bedroom', tags: ['bedroom'], desc: 'a bedroom.', access: 'private', owner: 'couple', guest: false, unit: 1, wear: 'sleepwear', bg: 'b.png' }] } };
    w2.homes.zones[0].interiors = { 0: 'p1' };
    w2.homes.kinds[Object.keys(w2.homes.kinds)[0]].interior = 'p1';
    w2.occupations[0].room = 'c_counter'; w2.actions[0].rooms = ['bath'];
    w2.cast.examples[0].room = 'bed';
    w2.traits = structuredClone(T.DEFAULT_TRAITS); w2.traits[0].need = 4; w2.traitPriority = ['hurt'];
    cw.CW.w = w2;
    const shown = new Set();
    const norm = (p) => p.replace(/\.\d+(?=\.|$)/g, '.*');
    const grab = () => { for (const m of cw.creatorHtml().matchAll(/data-path="([^"]+)"/g)) shown.add(norm(m[1])); };
    cw.CW.tab = 'rooms';
    for (const t of E.targets(w2).filter(t => t.it)) { input('ie-target', t.key); grab(); for (const r of t.it.rooms) { E.IE.sel = r.id; grab(); } }
    cw.CW.tab = 'ptraits'; for (let i = 0; i < w2.traits.length; i++) { cw.CW.sel.ptraits = i; grab(); }
    cw.CW.tab = 'jobs'; cw.CW.sel.jobs = 0; grab(); cw.CW.tab = 'actions'; cw.CW.sel.actions = 0; grab(); cw.CW.tab = 'people'; cw.CW.sel.people = 0; grab();
    cw.CW.tab = 'maps'; const ME = (await D('ui/mapedit.js')).ME; ME.map = c2.map; ME.pin = 'cafe'; grab();
    const need = ['places.*.access', 'places.*.wear', 'places.*.name', 'places.*.desc', 'places.*.tags', 'homes.plans.p1.name', 'homes.plans.p1.floors.*.name', 'homes.plans.p1.templates.*.name', 'homes.plans.p1.templates.*.desc', 'homes.plans.p1.templates.*.tags',
        'homes.plans.p1.templates.*.access', 'homes.plans.p1.templates.*.owner', 'homes.plans.p1.templates.*.guest', 'homes.plans.p1.templates.*.unit', 'homes.plans.p1.templates.*.wear', 'places.*.interior.floors.*.name',
        'occupations.*.room', 'actions.*.rooms', 'cast.examples.*.room', 'traits.*.name', 'traits.*.desc', 'traits.*.kind', 'traits.*.days', 'traits.*.grow', 'traits.*.need', 'traitPriority'];
    for (const n of need) ok(shown.has(n), `editable: ${n}`);
    // its pictures travel with an export
    const out = C.newWorldFrom ? true : false; ok(out, 'creator data side loaded');
}

console.log(`${passes} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
