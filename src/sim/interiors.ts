// Rooms inside a place. A building (a café, a school) can have an interior: rooms on one or more floors. Where you
// are stays the building (`player.loc`), so travel, plans, jobs and opening hours work as before; `player.room`
// says which room of it you are in, and only narrows the scene: who is with you, what you can do, the picture and
// the place the AI is told. A room is an ordinary place of the world file with `in: <building id>`.
import { nowAbs, type Save, type Resident } from '../core/store.js';
import { systemOn, type WorldDef, type Place } from '../core/world.js';
import { presentAt, routineStep } from './people.js';
import { placeOf } from './places.js';
import { isWith } from './social.js';

export interface InteriorFloor { id: string; name: string; image?: string; images?: Record<string, string>; ratio?: number; kind?: 'plan' | 'area' }
export interface InteriorRoom { id: string; floor: string; x: number; y: number; w: number; h: number }
export interface Interior { entry: string; floors: InteriorFloor[]; rooms: InteriorRoom[] }
export type Access = 'public' | 'staff' | 'private' | 'locked';

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const pub = (w: WorldDef, id: string) => w.places.find(p => p.id === id) as (Place & { in?: string; access?: Access; interior?: Interior }) | undefined;

export const interiorOf = (w: WorldDef, building: string): Interior | null => { const i = pub(w, building)?.interior; return i && Array.isArray(i.rooms) && i.rooms.length ? i : null; };
export const isRoom = (w: WorldDef, id: string) => !!pub(w, id)?.in;
// The building a place id belongs to (itself, when it is not a room).
export const buildingOf = (w: WorldDef, id: string) => pub(w, id)?.in ?? id;
export const roomsOf = (w: WorldDef, building: string): Place[] => { const i = interiorOf(w, building); return i ? i.rooms.map(r => pub(w, r.id)).filter((p): p is Place => !!p && (p as any).in === building) : []; };
export const accessOf = (w: WorldDef, room: string): Access => (pub(w, room)?.access ?? 'public');
const entryOf = (w: WorldDef, building: string) => { const i = interiorOf(w, building); if (!i) return ''; return roomsOf(w, building).some(r => r.id === i.entry) ? i.entry : roomsOf(w, building)[0]?.id ?? ''; };

// The room you are in ('' when the place has no rooms). A room that is not of this building counts as the entry.
export function roomNow(g: Save, w: WorldDef): string {
    const i = interiorOf(w, g.player.loc); if (!i) return '';
    const r = (g.player as any).room as string | undefined;
    return r && roomsOf(w, g.player.loc).some(p => p.id === r) ? r : entryOf(w, g.player.loc);
}
// Arriving at a building puts you in its entry; leaving forgets the room.
export function settleRoom(g: Save, w: WorldDef) {
    const r = roomNow(g, w);
    if (r) (g.player as any).room = r; else delete (g.player as any).room;
}

const worksHere = (g: Save, w: WorldDef, r: Resident, building: string, at: number) => {
    const job = systemOn(w, 'jobs') ? w.occupations.find(o => o.id === r.occupation) : null;
    return job && job.place === building && routineStep(r, at)[1] === 'work' ? job : null;
};
// Which room of a building someone is in. Staff are in the room their job names (else the entry); the people who
// came with you are in your room; everyone else is in one of the public rooms, the same one for a whole stretch of
// their day (mostly the entry, where a visitor would be).
export function roomOfPerson(g: Save, w: WorldDef, r: Resident, building: string, at = nowAbs(g)): string {
    const i = interiorOf(w, building); if (!i) return '';
    const entry = entryOf(w, building), rooms = roomsOf(w, building);
    if (building === g.player.loc && isWith(g, r.avatar)) return roomNow(g, w);
    const job = worksHere(g, w, r, building, at);
    if (job) { const room = (job as any).room as string | undefined; return room && rooms.some(p => p.id === room) ? room : entry; }
    const open = rooms.filter(p => accessOf(w, p.id) === 'public');
    if (!open.length) return entry;
    const [start] = routineStep(r, at), day = Math.floor(at / 1440);
    const h = hash(`${r.avatar}|${building}|${day}|${start}`);
    if (h % 5 < 2 && open.some(p => p.id === entry)) return entry;
    return open[(h >>> 3) % open.length].id;
}
// Who is in the scene with you: the people of this place, in your room when it has rooms.
export function hereWith(g: Save, w: WorldDef): Resident[] {
    const all = presentAt(g, w, g.player.loc), room = roomNow(g, w);
    return room ? all.filter(r => roomOfPerson(g, w, r, g.player.loc) === room) : all;
}
// The others in the building, with the room each is in.
export function elsewhere(g: Save, w: WorldDef): { r: Resident; room: string }[] {
    const room = roomNow(g, w); if (!room) return [];
    return presentAt(g, w, g.player.loc).map(r => ({ r, room: roomOfPerson(g, w, r, g.player.loc) })).filter(x => x.room !== room);
}

// The place of the scene: the room you are in (named "Building › Room"), or the place itself.
export function scenePlace(g: Save, w: WorldDef): (Place & { home?: boolean; owner?: string; building?: string }) | null {
    const here = placeOf(g, w, g.player.loc), room = roomNow(g, w);
    if (!here || !room) return here;
    const p = placeOf(g, w, room); if (!p) return here;
    return { ...p, name: `${here.name} › ${p.name}`, bg: p.bg ?? here.bg, building: here.id };
}

// May you go into this room? Staff rooms are for those who work in the building; private and locked ones are shut.
export function canEnter(g: Save, w: WorldDef, room: string): { ok: boolean; text: string } {
    const p = pub(w, room); if (!p?.in) return { ok: false, text: '' };
    const a = accessOf(w, room);
    if (a === 'public') return { ok: true, text: '' };
    const job = g.player.job ? w.occupations.find(o => o.id === g.player.job!.id) : null;
    if (a === 'staff') return job?.place === p.in ? { ok: true, text: '' } : { ok: false, text: `${p.name}: staff only.` };
    return { ok: false, text: a === 'locked' ? `${p.name} is locked.` : `${p.name} is private.` };
}
// Walks to another room of the building you are in (no time passes). Returns why not, or ''.
export function enterRoom(g: Save, w: WorldDef, room: string): string {
    if (pub(w, room)?.in !== g.player.loc) return 'That room is not in this building.';
    const c = canEnter(g, w, room); if (!c.ok) return c.text;
    (g.player as any).room = room;
    return '';
}

// For the AI: who else is in the building, and where.
export function elsewhereLine(g: Save, w: WorldDef): string {
    const list = elsewhere(g, w).filter(x => x.r.met); if (!list.length) return '';
    const name = (id: string) => pub(w, id)?.name ?? id;
    return `Elsewhere in the building, not in this scene: ${list.slice(0, 8).map(x => `${x.r.name} (${name(x.room).toLowerCase()})`).join(', ')}.`;
}
// Does an action that names the rooms it needs (`rooms`: room tags) fit this room?
export const fitsRoom = (rooms: string[] | undefined, roomTags: string[]) => !rooms?.length || rooms.some(t => roomTags.includes(t));
