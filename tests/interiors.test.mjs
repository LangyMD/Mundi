// Rooms inside a place (sim/interiors.ts): the room you are in, who is in which room, what you can do there, access,
// the map and what the AI is told. Run: node tests/interiors.test.mjs [repo root]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stage, browser, seed, world } from './env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ?? path.join(here, '..');
const ext = stage(root, 'interiors');
const meta = {}; browser(meta);
const D = (p) => import(`${ext}/dist/${p}`);
const store = await D('core/store.js'); const W = await D('core/world.js');
const I = await D('sim/interiors.js'); const Pl = await D('sim/places.js'); const people = await D('sim/people.js');
const P = await D('sim/prompt.js'); const needs = await D('sim/needs.js'); const So = await D('sim/social.js');
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('  FAIL', m); } };
const fixture = (f) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', f), 'utf8'));
const open = (s) => { for (const k of Object.keys(meta)) delete meta[k]; meta.mundi = s; return store.game(); };
seed(9);

// the modern world, with rooms in the café: the counter (entry), a kitchen for staff, a restroom, a locked office
const w = world(ext, 'modern'); w.id = 'rooms';
const cafe = w.places.find(p => p.id === 'cafe');
const room = (id, name, tags, extra = {}) => ({ id, name, map: cafe.map, in: 'cafe', x: 50, y: 50, tags, desc: `the ${name.toLowerCase()}.`, ...extra });
w.places.push(room('cafe_counter', 'Counter', ['food', 'leisure']), room('cafe_kitchen', 'Kitchen', ['kitchen', 'work'], { access: 'staff' }),
    room('cafe_restroom', 'Restroom', ['bath']), room('cafe_office', 'Office', ['work'], { access: 'locked' }));
cafe.interior = { entry: 'cafe_counter', floors: [{ id: 'g', name: 'Ground floor', ratio: 1.8 }], rooms: ['cafe_counter', 'cafe_kitchen', 'cafe_restroom', 'cafe_office'].map((id, i) => ({ id, floor: 'g', x: i * 25, y: 0, w: 25, h: 100 })) };
w.actions.push({ id: 't-wash', name: 'Wash', label: 'Wash your hands', cost: 0, minutes: 5, anywhere: true, rooms: ['bath'], effects: { hygiene: 5 } });
w.actions.push({ id: 't-kitchen', name: 'Help', label: 'Help in the kitchen', cost: 0, minutes: 30, place: 'cafe_kitchen', effects: {} });
w.occupations.find(o => o.id === 'barista').room = 'cafe_kitchen';
W.registerWorld(w);
const s = fixture('v0.1.0-modern.json'); s.world = 'rooms';
const g = open(s);
g.minutes = 10 * 60; while (g.day % 7 === 6 || g.day % 7 === 0) g.day++;   // a working day, mid-morning

/* ---------- the shape ---------- */
ok(I.interiorOf(w, 'cafe') && !I.interiorOf(w, 'mall'), 'the café has rooms, the mall does not');
ok(I.roomsOf(w, 'cafe').length === 4 && I.isRoom(w, 'cafe_kitchen') && !I.isRoom(w, 'cafe'), 'four rooms');
ok(I.buildingOf(w, 'cafe_kitchen') === 'cafe' && I.buildingOf(w, 'mall') === 'mall', 'the building of a room');
g.player.loc = 'park';
ok(!Pl.pins(g, w).some(p => p.in) && Pl.pins(g, w).some(p => p.id === 'cafe'), 'rooms are not on the map, the building is');
ok(I.roomNow(g, w) === '' && I.scenePlace(g, w).id === 'park', 'a place without rooms: no room');
const parkPeople = people.presentAt(g, w, 'park').map(r => r.avatar).join();
ok(I.hereWith(g, w).map(r => r.avatar).join() === parkPeople, 'and everyone there is in the scene, as before');

/* ---------- where you are ---------- */
g.player.loc = 'cafe';
ok(I.roomNow(g, w) === 'cafe_counter', 'arriving: the entry');
g.player.room = 'somewhere_else'; ok(I.roomNow(g, w) === 'cafe_counter', 'a room of another place counts as the entry');
I.settleRoom(g, w); ok(g.player.room === 'cafe_counter', 'settled');
ok(I.scenePlace(g, w).name === `${cafe.name} › Counter` && I.scenePlace(g, w).building === 'cafe', 'the scene is the room, named with its building');
ok(g.player.loc === 'cafe', 'where you are stays the building');

/* ---------- access ---------- */
g.player.job = null;
ok(I.enterRoom(g, w, 'cafe_restroom') === '' && I.roomNow(g, w) === 'cafe_restroom', 'a public room: walk in');
ok(/staff only/i.test(I.enterRoom(g, w, 'cafe_kitchen')) && I.roomNow(g, w) === 'cafe_restroom', 'the kitchen is for staff');
ok(/locked/i.test(I.enterRoom(g, w, 'cafe_office')), 'the office is locked');
g.player.job = { id: 'barista', rank: 0, shifts: 0 };
ok(I.enterRoom(g, w, 'cafe_kitchen') === '' && I.roomNow(g, w) === 'cafe_kitchen', 'working there: the kitchen is open to you');
ok(/locked/i.test(I.enterRoom(g, w, 'cafe_office')), 'the office stays locked');
g.player.loc = 'mall'; ok(/not in this building/.test(I.enterRoom(g, w, 'cafe_restroom')), 'not from another place');
ok(I.roomNow(g, w) === '', 'and the mall has no room');
g.player.loc = 'cafe'; g.player.room = 'cafe_counter';

/* ---------- who is where ---------- */
const bianca = Object.values(g.cast).find(r => r.occupation === 'barista');
let at = g.day * 1440 + g.minutes;
while (!(people.routineStep(bianca, at)[1] === 'work')) at += 60;
g.day = Math.floor(at / 1440); g.minutes = at % 1440;
ok(people.whereNow(g, w, bianca) === 'cafe', 'the barista is at the café on her shift');
ok(I.roomOfPerson(g, w, bianca, 'cafe') === 'cafe_kitchen', 'in the room her job names');
ok(!I.hereWith(g, w).some(r => r.avatar === bianca.avatar), 'so she is not in the scene at the counter');
ok(I.elsewhere(g, w).some(x => x.r.avatar === bianca.avatar && x.room === 'cafe_kitchen'), 'she is elsewhere in the building');
bianca.met = true;
ok(/Elsewhere in the building, not in this scene: .*\(kitchen\)/.test(P.sceneText()), 'the AI is told who is elsewhere');
ok(new RegExp(`Place: ${cafe.name} › Counter — the counter\\.`).test(P.sceneText()), 'and which room this is');
I.enterRoom(g, w, 'cafe_kitchen');
ok(I.hereWith(g, w).some(r => r.avatar === bianca.avatar), 'walk into the kitchen: she is in the scene');
ok(/Here with \{\{user\}\}: .*Bianca/.test(P.sceneText()), 'and the AI has her here');
delete w.occupations.find(o => o.id === 'barista').room;
ok(I.roomOfPerson(g, w, bianca, 'cafe') === 'cafe_counter', 'a job with no room: the entry');
{
    // visitors: only ever in public rooms, and in the same one for a whole stretch of their day
    const others = Object.values(g.cast).filter(r => r.occupation !== 'barista');
    const rooms = new Set(); let stable = true;
    for (const r of others) for (let d = 0; d < 6; d++) {
        const t = (g.day + d) * 1440 + 15 * 60, a = I.roomOfPerson(g, w, r, 'cafe', t), b = I.roomOfPerson(g, w, r, 'cafe', t + 20);
        rooms.add(a); if (a !== b && people.routineStep(r, t)[0] === people.routineStep(r, t + 20)[0]) stable = false;
    }
    ok(![...rooms].some(id => I.accessOf(w, id) !== 'public'), `visitors keep to the public rooms (${[...rooms].join(', ')})`);
    ok(rooms.has('cafe_counter') && stable, 'mostly the entry, and they stay put');
}
{
    const friend = Object.values(g.cast).find(r => r.occupation !== 'barista');
    So.social(g).with.push({ avatar: friend.avatar, since: 0 });
    g.player.room = 'cafe_restroom';
    ok(I.roomOfPerson(g, w, friend, 'cafe') === 'cafe_restroom', 'someone who came with you is in your room');
    So.social(g).with.length = 0; g.player.room = 'cafe_counter';
}

/* ---------- what you can do ---------- */
const acts = () => needs.actionsHere(g, w).map(a => a.id);
g.minutes = 12 * 60; g.player.room = 'cafe_counter';
ok(acts().includes('coffee') && !acts().includes('t-wash') && !acts().includes('t-kitchen'), `the counter: coffee, no washing (${acts().join(',')})`);
g.player.room = 'cafe_restroom';
ok(acts().includes('t-wash') && !acts().includes('coffee'), 'the restroom: washing, no coffee');
g.player.room = 'cafe_kitchen';
ok(acts().includes('t-kitchen') && !acts().includes('t-wash'), 'the kitchen: what is done in that room');
g.player.loc = 'mall'; delete g.player.room;
ok(acts().includes('t-wash'), 'a place without rooms: an action that names rooms is offered as before');

console.log(fails ? `${fails} FAILED, ${passes} passed` : `${passes} checks passed`);
process.exit(fails ? 1 : 0);
