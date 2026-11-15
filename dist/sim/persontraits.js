// Traits for the people of the world (and you): who someone is lately. Lasting ones (party animal, athletic) and
// states with an end date (hurt, sick). A job counts as a trait by itself (`career-<occupation id>`). You change
// someone's traits by what you do together, often; by hand; or through the game's own events. The AI is told, and a
// character's pictures can have their own sets for a trait or a combination (ui/looksui.ts).
import { state, nowAbs } from '../core/store.js';
/** Your own character's key (the same as in sim/looks.ts). */
export const PLAYER = '__player';
// The traits every world has unless its file lists its own (`traits`).
export const DEFAULT_TRAITS = [
    { id: 'party-animal', name: 'Party animal', desc: 'goes out most nights and loves a crowd', kind: 'lasting', grow: ['drink', 'bar', 'club', 'party', 'dance', 'night out'] },
    { id: 'athletic', name: 'Athletic', desc: 'trains often and it shows', kind: 'lasting', grow: ['work out', 'workout', 'gym', 'run', 'swim', 'treadmill', 'train', 'sport'] },
    { id: 'bookworm', name: 'Bookworm', desc: 'always has a book going', kind: 'lasting', grow: ['read', 'library', 'study', 'book'] },
    { id: 'foodie', name: 'Foodie', desc: 'cares a great deal about food', kind: 'lasting', grow: ['cook', 'restaurant', 'meal', 'bake', 'dinner'] },
    { id: 'homebody', name: 'Homebody', desc: 'happiest at home', kind: 'lasting', grow: ['watch tv', 'film', 'movie', 'video game', 'board game'] },
    { id: 'outdoorsy', name: 'Outdoorsy', desc: 'would rather be outside', kind: 'lasting', grow: ['hike', 'fish', 'camp', 'walk', 'garden'] },
    // company and closeness (sim/needtraits.ts: they change the Social and Intimacy needs, and how people take to being close)
    { id: 'social-butterfly', name: 'Social butterfly', desc: 'thrives on company and wilts without it', kind: 'lasting', grow: ['coffee', 'chat', 'hang out', 'catch up', 'gossip'] },
    { id: 'loner', name: 'Loner', desc: 'needs little company and tires of a crowd', kind: 'lasting' },
    { id: 'affectionate', name: 'Affectionate', desc: 'warm and physically close with the people they love', kind: 'lasting', grow: ['hug', 'cuddle', 'kiss', 'make love'] },
    { id: 'reserved', name: 'Reserved', desc: 'keeps people at arm\'s length and is slow to accept touch', kind: 'lasting' },
    { id: 'glowing', name: 'Glowing', desc: 'happy and at ease after time with someone dear', kind: 'state', days: 1 },
    { id: 'hurt', name: 'Hurt', desc: 'injured and moving carefully', kind: 'state', days: 5 },
    { id: 'sick', name: 'Sick', desc: 'unwell, low on energy', kind: 'state', days: 3 },
    { id: 'heartbroken', name: 'Heartbroken', desc: 'grieving a relationship', kind: 'state', days: 7 },
    { id: 'exhausted', name: 'Exhausted', desc: 'worn out', kind: 'state', days: 2 },
    { id: 'pregnant', name: 'Pregnant', desc: 'expecting a child', kind: 'state', days: 270 },
];
const slug = (s) => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
export const traitId = slug;
export const careerTrait = (occupation) => `career-${slug(occupation)}`;
export const isCareer = (id) => id.startsWith('career-');
// The traits of this game: the world's own list (or the usual one), plus the ones you made up in this save.
const own = (g) => ((g.cfg ??= {}).traits ??= []);
export function traitDefs(g, w) {
    const base = w?.traits?.length ? w.traits : DEFAULT_TRAITS;
    const out = [...base];
    for (const t of own(g))
        if (!out.some(x => x.id === t.id))
            out.push(t);
    return out;
}
export function traitDef(g, w, id) {
    const d = traitDefs(g, w).find(t => t.id === id);
    if (d)
        return d;
    if (isCareer(id)) {
        const o = w?.occupations?.find(x => careerTrait(x.id) === id);
        return { id, name: o?.name ?? id.slice(7), kind: 'lasting' };
    }
    return { id, name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '), kind: 'lasting' };
}
// A trait of your own for this save ("Goth phase"). Returns its id ('' when the name is empty).
export function makeTrait(g, w, name, kind = 'lasting') {
    const id = slug(name);
    if (!id || isCareer(id))
        return '';
    if (!traitDefs(g, w).some(t => t.id === id))
        own(g).push({ id, name: name.trim().slice(0, 40), kind, ...(kind === 'state' ? { days: 5 } : {}) });
    return id;
}
/* ---------- who has what ---------- */
const rec = (g) => (g.traitsOf ??= {});
const changed = (who) => { if (who !== PLAYER)
    delete state.sprites[who]; };
// The traits kept in the save for someone, without the ones that ran out.
export function keptTraits(g, who) {
    const now = nowAbs(g), all = rec(g)[who] ?? [];
    const live = all.filter(t => !t.until || t.until > now);
    if (live.length !== all.length) {
        rec(g)[who] = live;
        changed(who);
    }
    return live;
}
const occupationOf = (g, who) => (who === PLAYER ? g.player.job?.id ?? '' : g.cast[who]?.occupation ?? '');
// Everything someone is right now: what the save keeps, and their job.
export function activeTraits(g, who) {
    const out = keptTraits(g, who).map(t => t.id);
    const job = occupationOf(g, who);
    if (job)
        out.push(careerTrait(job));
    return [...new Set(out)];
}
export const hasTrait = (g, who, id) => activeTraits(g, who).includes(id);
// Gives someone a trait. A state gets an end date (`days`, or the trait's own). Having it already renews a state.
export function addTrait(g, w, who, id, o = {}) {
    if (!id || isCareer(id))
        return false;
    const d = traitDef(g, w, id), now = nowAbs(g);
    const days = o.days ?? (d.kind === 'state' ? d.days ?? 5 : 0);
    const list = (rec(g)[who] ??= []), cur = list.find(t => t.id === id);
    const until = days > 0 ? now + days * 1440 : undefined;
    if (cur) {
        if (until)
            cur.until = Math.max(cur.until ?? 0, until);
        if (o.note)
            cur.note = o.note;
        return false;
    }
    list.push({ id, since: now, ...(until ? { until } : {}), source: o.source ?? 'hand', ...(o.note ? { note: o.note.slice(0, 80) } : {}) });
    changed(who);
    return true;
}
export function removeTrait(g, who, id) {
    const list = rec(g)[who] ?? [], next = list.filter(t => t.id !== id);
    if (next.length === list.length)
        return false;
    rec(g)[who] = next;
    delete prog(g)[who]?.[id];
    changed(who);
    return true;
}
/* ---------- doing things together ---------- */
export const NEED = 5, FADE_DAYS = 14;
const prog = (g) => (g.traitProg ??= {});
export const progressOf = (g, who, id) => prog(g)[who]?.[id]?.n ?? 0;
const wordIn = (label, word) => new RegExp(`(^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(label);
// The traits a thing to do leads to, by its name.
export const traitsFor = (defs, label) => defs.filter(t => t.kind === 'lasting' && (t.grow ?? []).some(x => wordIn(label, x))).map(t => t.id);
// You did something with these people there: each time counts toward the trait it leads to, once a day per trait.
// Returns what to tell the player ("Mia is becoming a party animal").
export function togetherDid(g, w, label, withWho) {
    const defs = traitDefs(g, w), ids = traitsFor(defs, label), out = [];
    for (const id of ids)
        for (const r of withWho) {
            const p = ((prog(g)[r.avatar] ??= {})[id] ??= { n: 0, last: -1 });
            if (p.last === g.day)
                continue;
            p.last = g.day;
            const d = defs.find(t => t.id === id), need = d.need ?? NEED;
            if (hasTrait(g, r.avatar, id)) {
                p.n = Math.min(need, p.n + 1);
                continue;
            }
            p.n++;
            if (p.n >= need) {
                addTrait(g, w, r.avatar, id, { source: 'together' });
                out.push(`${r.name} has become: ${d.name.toLowerCase()} (from all the times with you).`);
            }
            else if (p.n === Math.ceil(need / 2))
                out.push(`${r.name} is getting a taste for it (${p.n}/${need} toward ${d.name.toLowerCase()}).`);
        }
    return out;
}
// Once a day: what you stopped doing together fades, and a trait that came from it goes when it has faded out.
export function fadeTraits(g, w) {
    const t = (g.tick ??= {});
    if (t.traitFade === g.day)
        return [];
    t.traitFade = g.day;
    const out = [];
    for (const [who, byId] of Object.entries(prog(g)))
        for (const [id, p] of Object.entries(byId)) {
            if (g.day - p.last < FADE_DAYS || p.n <= 0)
                continue;
            p.n--;
            p.last = g.day - FADE_DAYS + 3; // then one step every three days
            if (p.n === 0 && keptTraits(g, who).some(x => x.id === id && x.source === 'together')) {
                removeTrait(g, who, id);
                out.push(`${g.cast[who]?.name ?? 'Someone'} is no longer ${traitDef(g, w, id).name.toLowerCase()}.`);
            }
        }
    return out;
}
/* ---------- for the AI ---------- */
const left = (g, t) => { if (!t.until)
    return ''; const d = Math.ceil((t.until - nowAbs(g)) / 1440); return d <= 1 ? 'until tomorrow' : `${d} more days`; };
export function traitWords(g, w, who) {
    return keptTraits(g, who).map(t => {
        const d = traitDef(g, w, t.id), extra = [t.note, left(g, t)].filter(Boolean).join(', ');
        return `${d.name.toLowerCase()}${d.desc ? ` (${d.desc}${extra ? `; ${extra}` : ''})` : extra ? ` (${extra})` : ''}`;
    }).join('; ');
}
export function traitLines(g, w, present, me = '{{user}}') {
    const parts = present.map(r => { const t = traitWords(g, w, r.avatar); return t ? `${r.name} lately: ${t}.` : ''; }).filter(Boolean);
    const mine = traitWords(g, w, PLAYER);
    if (mine)
        parts.push(`${me} lately: ${mine}.`);
    return parts;
}
export const setId = (traits) => [...new Set(traits.map(slug).filter(Boolean))].sort().join('.');
export const setTraits = (id) => id.split('.').filter(Boolean);
// The sets that apply to someone, best first: every trait of the set is theirs; the set covering the most traits
// wins; ties go by the character's own order, then the world's (`traitPriority`), then states before the rest.
export function pickSets(sets, active, own = [], world = [], isState = () => false) {
    const has = new Set(active);
    const rank = (s) => {
        const at = (list) => { const i = s.traits.map(t => list.indexOf(t)).filter(i => i >= 0); return i.length ? Math.min(...i) : 1e6; };
        return [-s.traits.length, at(own), at(world), s.traits.some(isState) ? 0 : 1, s.id];
    };
    return sets.filter(s => s.traits.length && s.traits.every(t => has.has(t)))
        .sort((a, b) => { const x = rank(a), y = rank(b); for (let i = 0; i < 4; i++)
        if (x[i] !== y[i])
            return x[i] - y[i]; return x[4] < y[4] ? -1 : 1; });
}
// With no `outfits.json` to list a character's sets: the ones worth looking for (each trait alone, and all together).
export function guessSets(active) {
    const out = active.map(t => ({ id: setId([t]), traits: [t] }));
    if (active.length > 1)
        out.push({ id: setId(active), traits: [...active] });
    return out;
}
export const setFolder = (set, folder) => `${set}--${folder}`;
