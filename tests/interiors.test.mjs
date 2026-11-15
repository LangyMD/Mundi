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

/* ---------- homes with rooms ---------- */
{
    const w2 = world(ext, 'modern'); w2.id = 'homerooms';
    const s2 = fixture('v0.1.0-modern.json'); s2.world = 'homerooms';
    const T = (id, name, tags, extra = {}) => ({ id, name, tags, desc: `the ${name.toLowerCase()}.`, ...extra });
    const plan = { entry: 'living', floors: [{ id: 'g', name: 'Ground floor' }, { id: 'u', name: 'Upstairs' }],
        rooms: ['living', 'kitchen', 'bathroom', 'bed1', 'bed2', 'guest', 'study'].map((id, i) => ({ id, floor: i < 3 ? 'g' : 'u', x: (i % 4) * 25, y: 0, w: 25, h: 100 })),
        templates: [T('living', 'Living room', ['living', 'leisure'], { bg: 'bg/living.jpg' }), T('kitchen', 'Kitchen', ['kitchen', 'food']), T('bathroom', 'Bathroom', ['bath']),
            T('bed1', 'Front bedroom', ['bed'], { access: 'private', owner: 'couple' }), T('bed2', 'Back bedroom', ['bed'], { access: 'private', owner: 'one' }),
            T('guest', 'Guest room', ['bed'], { guest: true }), T('study', 'Study', ['office'], { access: 'private', wear: 'formal' })] };
    w2.homes.plans = { p1: plan };
    // every address uses the plan
    for (const z of w2.homes.zones) z.interiors = Object.fromEntries(z.spots.map((_, i) => [String(i), 'p1']));
    w2.actions.find(a => a.id === 'shower').rooms = ['bath']; w2.actions.find(a => a.id === 'cook').rooms = ['kitchen'];
    W.registerWorld(w2);
    const g2 = open(s2);
    g2.minutes = 14 * 60;
    const acts2 = () => needs.actionsHere(g2, w2).map(a => a.id);

    // your own home
    g2.player.loc = 'home:player'; delete g2.player.room;
    const sp = I.spotAt(g2, w2, 'home:player');
    ok(sp && sp.home && sp.rooms.length === 7 && sp.floors.length === 2, 'your home has its rooms and floors');
    ok(I.roomNow(g2, w2) === 'living', 'you come in at the entry');
    ok(I.household(g2, 'home:player')[0] === '__you', 'you live there');
    ok(I.bedroomOf(g2, w2, 'home:player', '__you') === 'bed1', 'the first bedroom is yours');
    ok(!I.bedrooms(g2, w2, 'home:player').guest, 'nobody takes the guest room');
    const sc = I.scenePlace(g2, w2);
    ok(sc.name === 'My home › Living room' && sc.id === 'home:player/living' && sc.home && sc.building === 'home:player' && sc.bg === 'bg/living.jpg', 'the scene is the room of your home');
    ok(g2.player.loc === 'home:player', 'and you are still "at home"');
    ok(!acts2().includes('shower') && !acts2().includes('cook'), 'the living room: no shower, no cooking');
    ok(I.enterRoom(g2, w2, 'bathroom') === '' && acts2().includes('shower') && !acts2().includes('cook'), 'the bathroom: a shower');
    ok(I.enterRoom(g2, w2, 'kitchen') === '' && acts2().includes('cook'), 'the kitchen: cooking');
    ok(I.enterRoom(g2, w2, 'study') === '' && I.enterRoom(g2, w2, 'bed1') === '' && I.enterRoom(g2, w2, 'bed2') === '', 'your own home is open to you');
    ok(I.scenePlace(g2, w2).wear === undefined && (I.enterRoom(g2, w2, 'study'), I.scenePlace(g2, w2).wear === 'formal'), 'a room can say what is worn there');
    ok(/Place: My home › Study — the study\./.test(P.sceneText()), 'the AI is told the room');

    // someone else's home
    const host = Object.values(g2.cast).find(r => !r.homeWith && I.household(g2, `home:${r.avatar}`).length === 1 && !So.isPartner(g2, r.avatar));
    const loc = `home:${host.avatar}`;
    g2.player.loc = loc; delete g2.player.room; So.social(g2).bond[host.avatar] = 10;
    ok(I.roomNow(g2, w2) === 'living' && I.bedroomOf(g2, w2, loc, host.avatar) === 'bed1', 'their home: the entry, and their bedroom');
    ok(/that is .*'s room/.test(I.enterRoom(g2, w2, 'bed1')), 'their bedroom is theirs');
    ok(/private/.test(I.enterRoom(g2, w2, 'study')) && /private/.test(I.enterRoom(g2, w2, 'bed2')), 'private rooms are shut to a visitor');
    ok(I.enterRoom(g2, w2, 'kitchen') === '' && I.enterRoom(g2, w2, 'guest') === '', 'the shared rooms and the guest room are open');
    So.social(g2).bond[host.avatar] = I.ROOM_BOND;
    ok(I.enterRoom(g2, w2, 'bed1') === '', 'close enough: you may walk into their room');
    ok(/private/.test(I.enterRoom(g2, w2, 'study')), 'but not the rest of the private rooms');
    So.social(g2).partner.push(host.avatar);
    ok(I.enterRoom(g2, w2, 'study') === '', 'together: their home is open to you');
    So.social(g2).partner.length = 0;
    // where they are, at home
    const nightAt = g2.day * 1440 + 23 * 60, dayAt = g2.day * 1440 + 15 * 60;
    ok(I.roomOfPerson(g2, w2, host, loc, nightAt) === 'bed1', 'at night they are in their bedroom');
    const seen = new Set(); for (let d = 0; d < 20; d++) seen.add(I.roomOfPerson(g2, w2, host, loc, dayAt + d * 1440));
    ok(![...seen].some(id => ['bathroom', 'guest', 'study', 'bed2'].includes(id)) && seen.has('living'), `by day in the rooms a household shares (${[...seen].join(', ')})`);
    const visitor = Object.values(g2.cast).find(r => r.avatar !== host.avatar && !I.household(g2, loc).includes(r.avatar));
    ok(I.roomOfPerson(g2, w2, visitor, loc, nightAt) === 'living', 'a visitor is in the living room');

    // a duplex: each flat has its own rooms and the shared ones
    plan.templates.find(t => t.id === 'bed2').unit = 1; plan.templates.find(t => t.id === 'kitchen').unit = 0;
    host.home.unit = 1;
    const flat = I.spotAt(g2, w2, loc).rooms.map(r => r.id);
    ok(flat.includes('bed2') && !flat.includes('kitchen') && flat.includes('living'), 'the upstairs flat: its own rooms and the shared ones');
    delete host.home.unit;

    // a home with no plan: one scene, as before
    for (const z of w2.homes.zones) delete z.interiors;
    ok(I.spotAt(g2, w2, loc) === null && I.roomNow(g2, w2) === '' && I.scenePlace(g2, w2).id === loc, 'a home without a plan is one scene, as before');
    g2.player.loc = 'home:player';
    ok(acts2().includes('shower') && acts2().includes('cook'), 'and everything can be done there');
}

/* ---------- the floor plan button, and no row per room in the things to do ---------- */
{
    const RU = await D('ui/roomsui.js');
    const g3 = open(fixture('v0.1.0-modern.json')); g3.world = 'rooms'; g3.player.loc = 'cafe'; I.settleRoom(g3, w);
    let rows = RU.roomRows(g3, w);
    ok(rows.length === 0, `no rows for the rooms (${rows.length})`);
    const btn = RU.roomsButton(g3, w);
    ok(btn.includes('data-act="rm-plan"') && btn.includes('mh-mapbtn') && btn.includes('Counter') && btn.includes('4 rooms'), 'the floor plan is a button beside the map');
    const keep = cafe.interior.rooms; cafe.interior.rooms = keep.map(r => (r.id === 'cafe_restroom' ? { ...r, floor: 'nowhere' } : r));
    rows = RU.roomRows(g3, w);
    ok(rows.length === 1 && rows[0].includes('data-id="cafe_restroom"'), 'a room drawn on no floor keeps a row');
    cafe.interior.rooms = keep;
    g3.player.loc = 'park'; ok(RU.roomRows(g3, w).length === 0 && RU.roomsButton(g3, w) === '', 'a place without rooms: nothing');
}

console.log(fails ? `${fails} FAILED, ${passes} passed` : `${passes} checks passed`);
process.exit(fails ? 1 : 0);
