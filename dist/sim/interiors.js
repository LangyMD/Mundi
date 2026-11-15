// Rooms inside a place. A building (a café, a school) or a home can have an interior: rooms on one or more floors.
// Where you are stays the building or the home (`player.loc`), so travel, plans, jobs and opening hours work as
// before; `player.room` says which room of it you are in, and only narrows the scene: who is with you, what you can
// do, the picture and the place the AI is told.
//  - A public building: `interior` on the place; each room is an ordinary place of the world file with `in`.
//  - A home: a plan in `homes.plans`, named for an address by `homes.zones[].interiors` (or `interior` on the kind
//    of home); its rooms are the plan's `templates`, and exist once per home (`home:<owner>/<room>`).
import { nowAbs } from '../core/store.js';
import { systemOn } from '../core/world.js';
import { presentAt, routineStep } from './people.js';
import { placeOf, isHome, playerHomeId } from './places.js';
import { isWith, bondOf, isPartner } from './social.js';
/** Close enough to walk into someone's own room. */
export const ROOM_BOND = 60;
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
} return h >>> 0; };
const pub = (w, id) => w.places.find(p => p.id === id);
/* ---------- public buildings ---------- */
export const interiorOf = (w, building) => { const i = pub(w, building)?.interior; return i && Array.isArray(i.rooms) && i.rooms.length ? i : null; };
export const isRoom = (w, id) => !!pub(w, id)?.in;
// The building a place id belongs to (itself, when it is not a room).
export const buildingOf = (w, id) => pub(w, id)?.in ?? id;
export const roomsOf = (w, building) => { const i = interiorOf(w, building); return i ? i.rooms.map(r => pub(w, r.id)).filter((p) => !!p && p.in === building) : []; };
export const accessOf = (w, room) => (pub(w, room)?.access ?? 'public');
const sameHome = (a, b) => a.zone === b.zone && a.x === b.x && a.y === b.y && (a.unit ?? 0) === (b.unit ?? 0);
// Whose home a home id is: the player's, or a resident's (someone who lives with another is at that one's home).
function homeRef(g, loc) {
    if (loc === playerHomeId)
        return g.player.home;
    const r = g.cast[loc.slice(5)];
    if (!r)
        return null;
    const w2 = r.homeWith;
    if (w2 === '__you')
        return g.player.home;
    if (w2 && w2 !== r.avatar && g.cast[w2])
        return g.cast[w2].home;
    return r.home;
}
// The plan of a home: the one its address names, else the one of its kind of home.
function homePlan(w, h) {
    const homes = w.homes, zone = homes.zones.find((z) => z.id === h.zone);
    if (!zone)
        return null;
    const spot = (zone.spots ?? []).findIndex((s) => s[0] === h.x && s[1] === h.y);
    const named = zone.interiors?.[String(spot)] ?? zone.interiors?.[String(Math.max(0, spot))];
    const plan = (named && homes.plans?.[named]) || homes.kinds?.[h.kind ?? zone.kind]?.interior;
    return plan && Array.isArray(plan.rooms) && plan.rooms.length && Array.isArray(plan.templates) ? plan : null;
}
// Who lives in a home (you included, as '__you'), in the order the world has them.
export function household(g, loc) {
    const h = homeRef(g, loc);
    if (!h)
        return [];
    const out = Object.values(g.cast).filter(r => {
        const w2 = r.homeWith;
        if (w2 === '__you')
            return sameHome(h, g.player.home);
        return sameHome(h, w2 && g.cast[w2] ? g.cast[w2].home : r.home);
    }).map(r => r.avatar);
    return sameHome(h, g.player.home) ? ['__you', ...out] : out;
}
// Whose bedroom each bedroom is. A room a character names in the world file is theirs; the rest of the household
// take the bedrooms that are left, in order (a room for a couple holds two).
export function bedrooms(g, w, loc) {
    const sp = spotAt(g, w, loc);
    const out = {};
    if (!sp?.home)
        return out;
    const beds = sp.rooms.filter(r => (r.tags ?? []).includes('bed') && !r.guest);
    const members = household(g, loc), left = [];
    for (const m of members) {
        const want = m === '__you' ? '' : String(w.cast.examples.find(e => e.name === g.cast[m]?.name)?.room ?? '');
        if (want && beds.some(b => b.id === want))
            (out[want] ??= []).push(m);
        else
            left.push(m);
    }
    for (const b of beds) {
        const room = b.owner === 'couple' ? 2 : 1;
        while ((out[b.id]?.length ?? 0) < room && left.length)
            (out[b.id] ??= []).push(left.shift());
    }
    return out;
}
export const bedroomOf = (g, w, loc, who) => Object.entries(bedrooms(g, w, loc)).find(([, l]) => l.includes(who))?.[0] ?? '';
/* ---------- the rooms of where you are ---------- */
export function spotAt(g, w, loc) {
    if (isHome(loc)) {
        const h = homeRef(g, loc);
        const plan = h && homePlan(w, h);
        if (!h || !plan)
            return null;
        const unit = h.unit ?? 0, base = placeOf(g, w, loc);
        // (a flat of a duplex: its own rooms and the shared ones)
        const mine = plan.templates.filter(t => t.unit === undefined || t.unit === unit);
        const rooms = mine.map(t => ({ ...t, id: String(t.id), name: String(t.name ?? t.id), map: base?.map ?? '', x: base?.x ?? 0, y: base?.y ?? 0, tags: t.tags ?? [], home: true }));
        const boxes = plan.rooms.filter(r => rooms.some(p => p.id === r.id));
        if (!rooms.length || !boxes.length)
            return null;
        const entry = rooms.some(r => r.id === plan.entry) ? plan.entry : (rooms.find(r => (r.tags ?? []).includes('living')) ?? rooms[0]).id;
        return { loc, home: true, entry, floors: plan.floors.filter(f => boxes.some(b => b.floor === f.id)), boxes, rooms };
    }
    const i = interiorOf(w, loc);
    if (!i)
        return null;
    const rooms = roomsOf(w, loc);
    if (!rooms.length)
        return null;
    return { loc, home: false, entry: rooms.some(r => r.id === i.entry) ? i.entry : rooms[0].id, floors: i.floors, boxes: i.rooms.filter(r => rooms.some(p => p.id === r.id)), rooms };
}
// The room you are in ('' when the place has no rooms). A room that is not of this place counts as the entry.
export function roomNow(g, w) {
    const sp = spotAt(g, w, g.player.loc);
    if (!sp)
        return '';
    const r = g.player.room;
    return r && sp.rooms.some(p => p.id === r) ? r : sp.entry;
}
// Arriving somewhere with rooms puts you in its entry; leaving forgets the room.
export function settleRoom(g, w) {
    const r = roomNow(g, w);
    if (r)
        g.player.room = r;
    else
        delete g.player.room;
}
const worksHere = (g, w, r, building, at) => {
    const job = systemOn(w, 'jobs') ? w.occupations.find(o => o.id === r.occupation) : null;
    return job && job.place === building && routineStep(r, at)[1] === 'work' ? job : null;
};
const NIGHT_FROM = 22 * 60, NIGHT_TO = 6 * 60 + 30;
const COMMON = ['living', 'kitchen', 'dining', 'garden', 'office', 'gym', 'pool'];
// Which room of a place someone is in.
//  - The people who came with you are in your room.
//  - A building: staff are in the room their job names (else the entry); visitors are in one of the public rooms, the
//    same one for a whole stretch of their day (mostly the entry).
//  - A home: at night the people who live there are in their bedrooms; by day in the rooms a household shares (the
//    same one for a stretch of the day). Visitors are in the living room.
export function roomOfPerson(g, w, r, loc, at = nowAbs(g)) {
    const sp = spotAt(g, w, loc);
    if (!sp)
        return '';
    if (loc === g.player.loc && isWith(g, r.avatar))
        return roomNow(g, w);
    const [start] = routineStep(r, at), day = Math.floor(at / 1440), min = at % 1440;
    const h = hash(`${r.avatar}|${loc}|${day}|${start}`);
    if (sp.home) {
        const lives = household(g, loc).includes(r.avatar);
        const shared = sp.rooms.filter(p => p.access !== 'private' && p.access !== 'locked' && (p.tags ?? []).some(t => COMMON.includes(t)));
        const living = (shared.find(p => (p.tags ?? []).includes('living')) ?? sp.rooms.find(p => p.id === sp.entry)).id;
        if (!lives)
            return living;
        const bed = bedroomOf(g, w, loc, r.avatar);
        if (bed && (min >= NIGHT_FROM || min < NIGHT_TO))
            return bed;
        // their own home has its private rooms open to them (a study, their own bath are not where they spend the day)
        if (!shared.length)
            return bed || living;
        if (h % 5 < 2)
            return living;
        if (bed && h % 7 === 0)
            return bed;
        return shared[(h >>> 3) % shared.length].id;
    }
    const job = worksHere(g, w, r, loc, at);
    if (job) {
        const room = job.room;
        return room && sp.rooms.some(p => p.id === room) ? room : sp.entry;
    }
    const open = sp.rooms.filter(p => (p.access ?? 'public') === 'public');
    if (!open.length)
        return sp.entry;
    if (h % 5 < 2 && open.some(p => p.id === sp.entry))
        return sp.entry;
    return open[(h >>> 3) % open.length].id;
}
// Who is in the scene with you: the people of this place, in your room when it has rooms.
export function hereWith(g, w) {
    const all = presentAt(g, w, g.player.loc), room = roomNow(g, w);
    return room ? all.filter(r => roomOfPerson(g, w, r, g.player.loc) === room) : all;
}
// The others in the building, with the room each is in.
export function elsewhere(g, w) {
    const room = roomNow(g, w);
    if (!room)
        return [];
    return presentAt(g, w, g.player.loc).map(r => ({ r, room: roomOfPerson(g, w, r, g.player.loc) })).filter(x => x.room !== room);
}
// The place of the scene: the room you are in (named "Building › Room"), or the place itself.
export function scenePlace(g, w) {
    const here = placeOf(g, w, g.player.loc), room = roomNow(g, w);
    if (!here || !room)
        return here;
    const sp = spotAt(g, w, g.player.loc);
    const p = sp.home ? sp.rooms.find(r => r.id === room) : placeOf(g, w, room);
    if (!p)
        return here;
    // (a home room keeps the home's owner, not the bedroom's "one" / "couple")
    return { ...p, id: sp.home ? `${here.id}/${p.id}` : p.id, name: `${here.name} › ${p.name}`, bg: p.bg ?? here.bg, building: here.id, ...(sp.home ? { home: true, owner: here.owner } : {}) };
}
// May you go into this room?
//  - A building: staff rooms are for those who work there; private and locked ones are shut.
//  - A home: your own home is open to you, and so is a home where you live with someone. Someone's bedroom is theirs:
//    you walk in when you are together or close. In someone else's home the private rooms are shut, unless you are
//    together with someone who lives there.
export function canEnter(g, w, room, loc = g.player.loc) {
    const sp = spotAt(g, w, loc), p = sp?.rooms.find(r => r.id === room);
    if (!sp || !p)
        return { ok: false, text: '' };
    const a = p.access ?? 'public';
    if (a === 'locked')
        return { ok: false, text: `${p.name} is locked.` };
    if (sp.home) {
        const members = household(g, loc), mine = members.includes('__you');
        const owners = (bedrooms(g, w, loc)[room] ?? []).filter(o => o !== '__you');
        const close = (o) => isPartner(g, o) || bondOf(g, o) >= ROOM_BOND;
        if ((bedrooms(g, w, loc)[room] ?? []).includes('__you'))
            return { ok: true, text: '' };
        if (owners.length)
            return owners.some(close) ? { ok: true, text: '' } : { ok: false, text: `${p.name}: that is ${g.cast[owners[0]]?.name ?? 'someone'}'s room.` };
        if (mine || a === 'public')
            return { ok: true, text: '' };
        return members.some(m => m !== '__you' && isPartner(g, m)) ? { ok: true, text: '' } : { ok: false, text: `${p.name} is private.` };
    }
    if (a === 'public')
        return { ok: true, text: '' };
    const job = g.player.job ? w.occupations.find(o => o.id === g.player.job.id) : null;
    if (a === 'staff')
        return job?.place === loc ? { ok: true, text: '' } : { ok: false, text: `${p.name}: staff only.` };
    return { ok: false, text: `${p.name} is private.` };
}
// Walks to another room of where you are (no time passes). Returns why not, or ''.
export function enterRoom(g, w, room) {
    const sp = spotAt(g, w, g.player.loc);
    if (!sp?.rooms.some(r => r.id === room))
        return 'That room is not in this building.';
    const c = canEnter(g, w, room);
    if (!c.ok)
        return c.text;
    g.player.room = room;
    return '';
}
// For the AI: who else is in the building, and where.
export function elsewhereLine(g, w) {
    const list = elsewhere(g, w).filter(x => x.r.met);
    if (!list.length)
        return '';
    const sp = spotAt(g, w, g.player.loc);
    const name = (id) => sp?.rooms.find(r => r.id === id)?.name ?? id;
    return `Elsewhere in the ${sp?.home ? 'house' : 'building'}, not in this scene: ${list.slice(0, 8).map(x => `${x.r.name} (${name(x.room).toLowerCase()})`).join(', ')}.`;
}
// Does an action that names the rooms it needs (`rooms`: room tags) fit this room?
export const fitsRoom = (rooms, roomTags) => !rooms?.length || rooms.some(t => roomTags.includes(t));
