// What changed about the places of the world in this game: a place closed (for a while, with a reason), hidden from
// the map, renamed, or described differently. The world file is never touched; the changes live in the save, and
// everything that shows or describes a place goes through `placeOf()`, which applies them.
import { nowAbs, type Save } from '../core/store.js';
import type { Place } from '../core/world.js';

export interface PlaceState {
    /** closed until then (absolute minutes; none: until you reopen it), and why */ closed?: { until?: number; why: string };
    /** not on the map, and nobody goes there */ hidden?: boolean;
    name?: string;
    /** replaces the world's description */ desc?: string;
    /** added after the description ("The front window is boarded up.") */ descAdd?: string;
}
export interface WorldChange { day: number; minutes: number; place: string; text: string }

export const placeStates = (g: Save): Record<string, PlaceState> => (((g as any).placeState ??= {}) as Record<string, PlaceState>);
export const worldLog = (g: Save): WorldChange[] => (((g as any).worldLog ??= []) as WorldChange[]);
const LOG_MAX = 60;
const empty = (s: PlaceState) => !s.closed && !s.hidden && !s.name && !s.desc && !s.descAdd;

// A place's changes right now (a closing that ran out is gone). null: nothing changed.
export function stateOf(g: Save | null | undefined, id: string): PlaceState | null {
    const all = (g as any)?.placeState as Record<string, PlaceState> | undefined;
    const s = all?.[id]; if (!s) return null;
    if (s.closed?.until && s.closed.until <= nowAbs(g as Save)) { delete s.closed; if (empty(s)) { delete all![id]; return null; } }
    return empty(s) ? null : s;
}
// The place as this game has it.
export function withState<T extends Place>(g: Save | null | undefined, p: T): T {
    const s = stateOf(g, p.id); if (!s || (!s.name && !s.desc && !s.descAdd)) return p;
    const desc = [s.desc ?? p.desc ?? '', s.descAdd ?? ''].filter(Boolean).join(' ');
    return { ...p, ...(s.name ? { name: s.name } : {}), ...(desc ? { desc } : {}) };
}
export const closedWhy = (g: Save, id: string): string | null => stateOf(g, id)?.closed ? stateOf(g, id)!.closed!.why || 'closed' : null;
export const isShut = (g: Save | null | undefined, id: string) => { const s = stateOf(g, id); return !!s && (!!s.closed || !!s.hidden); };
export const isHidden = (g: Save | null | undefined, id: string) => !!stateOf(g, id)?.hidden;

const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
function log(g: Save, place: string, text: string) {
    const l = worldLog(g); l.push({ day: g.day, minutes: g.minutes, place, text });
    if (l.length > LOG_MAX) l.splice(0, l.length - LOG_MAX);
}
const edit = (g: Save, id: string, f: (s: PlaceState) => void) => { const all = placeStates(g); const s = (all[id] ??= {}); f(s); if (empty(s)) delete all[id]; };

// `days` 0: until you reopen it. `name`: the place's name, for the log.
export function closePlace(g: Save, id: string, name: string, why: string, days = 0) {
    const reason = clean(why, 120);
    edit(g, id, s => { s.closed = { why: reason, ...(days > 0 ? { until: nowAbs(g) + Math.round(days * 1440) } : {}) }; });
    log(g, id, `${name} closed${reason ? ` (${reason})` : ''}${days > 0 ? ` for ${days} day${days === 1 ? '' : 's'}` : ''}.`);
}
export function reopenPlace(g: Save, id: string, name: string) {
    if (!stateOf(g, id)?.closed) return;
    edit(g, id, s => { delete s.closed; });
    log(g, id, `${name} reopened.`);
}
export function hidePlace(g: Save, id: string, name: string, hidden: boolean) {
    if (!!stateOf(g, id)?.hidden === hidden) return;
    edit(g, id, s => { if (hidden) s.hidden = true; else delete s.hidden; });
    log(g, id, hidden ? `${name} is gone from the map.` : `${name} is back on the map.`);
}
// Renames or describes a place differently ('' gives the world's own back). `was`: the world's own name.
export function describePlace(g: Save, id: string, was: string, patch: { name?: string; desc?: string; descAdd?: string }) {
    const before = JSON.stringify(stateOf(g, id) ?? {});
    edit(g, id, s => {
        if (patch.name !== undefined) { const n = clean(patch.name, 60); if (n && n !== was) s.name = n; else delete s.name; }
        if (patch.desc !== undefined) { const d = clean(patch.desc, 600); if (d) s.desc = d; else delete s.desc; }
        if (patch.descAdd !== undefined) { const d = clean(patch.descAdd, 300); if (d) s.descAdd = d; else delete s.descAdd; }
    });
    const s = stateOf(g, id) ?? {};
    if (JSON.stringify(s) === before) return;
    if (patch.name !== undefined) log(g, id, s.name ? `${was} is now called ${s.name}.` : `${was} has its old name back.`);
    else if (patch.descAdd !== undefined && s.descAdd) log(g, id, `${s.name ?? was}: ${s.descAdd}`);
    else log(g, id, `${s.name ?? was} looks different now.`);
}
export function resetPlace(g: Save, id: string, name: string) {
    if (!placeStates(g)[id]) return;
    delete placeStates(g)[id]; log(g, id, `${name} is as it was.`);
}

/* ---------- for the AI ---------- */

const until = (g: Save, t?: number) => { if (!t) return ''; const d = Math.ceil((t - nowAbs(g)) / 1440); return d <= 1 ? ', until tomorrow' : `, ${d} more days`; };
// What the people here would know: what changed about this place lately, and which places are closed right now.
// `nameOf`: a place's name as this game has it.
export function changeLines(g: Save, here: string, nameOf: (id: string) => string, days = 14): string[] {
    const out: string[] = [];
    const lately = worldLog(g).filter(c => c.place === here && g.day - c.day <= days).slice(-3).map(c => c.text);
    if (lately.length) out.push(`Changed lately here: ${lately.join(' ')}`);
    const shut = Object.keys(placeStates(g)).filter(id => id !== here && stateOf(g, id)?.closed)
        .map(id => { const c = stateOf(g, id)!.closed!; return `${nameOf(id)}${c.why || c.until ? ` (${[c.why, until(g, c.until).replace(/^, /, '')].filter(Boolean).join(', ')})` : ''}`; });
    if (shut.length) out.push(`Closed in town right now: ${shut.slice(0, 6).join('; ')}.`);
    return out;
}
