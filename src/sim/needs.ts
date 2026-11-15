// Statuses (life, energy, hunger…) and the actions that change them. Everything comes from the world's data:
// which statuses exist, how fast they drop, what happens at zero and what each action costs and gives.
import { eventActions } from './cityevents.js';
import { roomNow, fitsRoom, scenePlace } from './interiors.js';
import { onAction, decayMods } from './hooks.js';
import { nowAbs, cfg, type Save } from '../core/store.js';
import { billNews, cutReason, priceOf } from './bills.js';
import { priceHere } from './worldstate.js';
import { openNow } from './daynight.js';
import { sheetOf, isRpg, changeHp, hpMax } from './rpg.js';
import { activeStatuses, systemOn, type WorldDef, type ActionDef, type StatusDef, isScenario } from '../core/world.js';
import { presentAt } from './people.js';
import { approve } from './living.js';
import { note } from './facts.js';
import { placeOf, playerHomeId } from './places.js';
import { book } from './ledger.js';
import { extraActions, isBlocked, brokenThings, hasItem } from './life.js';
import { decayMult, gainMult } from './modifiers.js';
import { closeActions } from './intimacy.js';

const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Math.round(v)));
export const statusDef = (w: WorldDef, id: string) => w.statuses.find(s => s.id === id);
// One currency per world: "$120", "40 g", "300 Berries". (Coins of several metals were dropped: an old world that still
// lists `tiers` just shows its smallest coin, which is what amounts were always counted in.)
export function money(w: WorldDef, v: number): string {
    const n = Math.round(v).toLocaleString('en-US'), sym = w.currency.symbol ?? '';
    return w.currency.after ? `${n}${sym ? ` ${sym}` : ''}` : `${sym}${n}`;
}
// How cheap this world's economy is: the usual pay of a first job, for prices the engine sets itself (a party…).
export const usualPay = (w: WorldDef) => { const p = w.occupations.map(o => o.ranks?.[0]?.pay ?? 0).filter(x => x > 0).sort((a, b) => a - b); return p.length ? p[Math.floor(p.length / 2)] : 16; };

export function addStatus(g: Save, w: WorldDef, id: string, delta: number) {
    const d = statusDef(w, id);
    if (!d) return;
    // in the RPG, "life" is your hit points (the need shows the share left): a change goes to the hit points
    if ((id === 'life' || id === 'health') && sheetOf(g) && isRpg(w)) { changeHp(g, w, (delta / d.max) * hpMax(w, sheetOf(g)!)); return; }
    g.player.stats[id] = clamp((g.player.stats[id] ?? d.start) + delta, d.max);
}

// What fills a need (a meal, a chat) counts for more or less with who you are (sim/modifiers.ts); what costs it stays
// as it is. A need that is not in play in this game is left alone. `action`: the action it comes from.
export function fill(g: Save, w: WorldDef, id: string, amount: number, action?: string) {
    if (statusDef(w, id)?.optional && !activeStatuses(w, g).some(s => s.id === id)) return;
    addStatus(g, w, id, amount > 0 ? amount * gainMult(g, w, id, action) : amount);
}
// Company: talking to someone, a text, running into a friend. Fills the social need when this game has it.
export function socialContact(g: Save, w: WorldDef | null | undefined, amount: number) {
    if (w && amount > 0 && activeStatuses(w, g).some(s => s.id === 'social')) fill(g, w, 'social', amount);
}

// How many whole periods of `every` minutes passed since the rule last ran (and moves its mark forward).
function periods(g: Save, key: string, every: number): number {
    const now = nowAbs(g);
    const last = g.tick[key] ?? now;
    if (g.tick[key] === undefined) { g.tick[key] = now; return 0; }
    const n = Math.floor((now - last) / every);
    if (n > 0) g.tick[key] = last + n * every;
    return n;
}

// Runs after every slice of time: decay, damage at zero, passing out, rent.
export function applyTimedRules(g: Save, w: WorldDef): string[] {
    const out: string[] = [];
    g.tick ??= {};   // (a Home game that never had needs on)
    for (const s of activeStatuses(w, g)) {
        if (s.decay) {
            const n = periods(g, `decay:${s.id}`, s.decay.everyMinutes);
            // (walking the map costs no energy)
            if (n > 0 && !(s.decay.awakeOnly && g.asleep) && !(s.id === 'energy' && (g as any).traveling)) {
                // whole points only; what is left over (a trait that slows a need by a tenth) is carried to the next time
                const drop = s.decay.amount * n * (cfg(g).decay ?? 1) * decayMods.reduce((m, f) => m * f(g, w, s.id), 1) * decayMult(g, w, s.id) + (g.tick[`carry:${s.id}`] ?? 0);
                const whole = Math.floor(drop + 1e-9), rest = Math.round((drop - whole) * 1000) / 1000;
                if (rest > 0) g.tick[`carry:${s.id}`] = rest; else delete g.tick[`carry:${s.id}`];
                if (whole) addStatus(g, w, s.id, -whole);
            }
        }
        const v = g.player.stats[s.id] ?? s.start;
        // (Home: an empty need only shows, and the AI is told; nobody faints)
        if (v > 0 || !s.zero || isScenario(w)) { delete g.tick[`zero:${s.id}`]; delete g.tick[`crisis0:${s.id}`]; continue; }
        out.push(...crisisCheck(g, w, s));
        if (s.zero.drain) {
            const n = periods(g, `drain:${s.id}`, s.zero.drain.everyMinutes);
            if (n > 0) addStatus(g, w, s.zero.drain.status, -s.zero.drain.amount * n);
        }
        if ((s.zero.place || s.zero.text) && g.tick[`zero:${s.id}`] === undefined) {
            g.tick[`zero:${s.id}`] = nowAbs(g);
            const cost = s.zero.cost ?? 0;
            if (cost) g.player.money = Math.max(0, g.player.money - cost);
            if (s.zero.place) g.player.loc = s.zero.place === 'home' ? playerHomeId : s.zero.place;
            if (s.zero.restore) addStatus(g, w, s.id, s.zero.restore);
            if (s.zero.text) out.push(s.zero.text.replace('{cost}', money(w, cost)));
        }
    }
    // the bills of your home (rent, water, power): due each week, paid in the Homes app, cut off after a week
    out.push(...billNews(g, w));
    return out;
}

// A need left at zero long enough becomes a crisis, once per time it hits zero: you faint, people see it, it costs.
// The people who saw it remember it (and may gossip); for a few hours the AI knows it just happened.
function crisisCheck(g: Save, w: WorldDef, s: StatusDef): string[] {
    const c = s.zero?.crisis;
    if (!c) return [];
    const now = nowAbs(g);
    const start = (g.tick[`crisis0:${s.id}`] ??= now);
    if (now - start < (c.after ?? 0) || g.tick[`crisisDone:${s.id}`] === start || g.tick[`crisisDay:${s.id}`] === g.day) return [];   // once a time, and once a day
    const where = g.player.loc;
    const placeName = placeOf(g, w, where)?.name ?? 'home';
    const saw = presentAt(g, w, where).filter(r => r.met);
    if (c.shame && !saw.length) return [];   // a crisis about what people think (the smell) needs someone to see it
    g.tick[`crisisDone:${s.id}`] = start; g.tick[`crisisDay:${s.id}`] = g.day;
    const cost = priceOf(g, c.cost ?? 0);
    if (cost) { g.player.money = Math.max(0, g.player.money - cost); book(g, s.name, -cost); }
    if (c.restore) addStatus(g, w, s.id, c.restore);
    if (c.mood && s.id !== 'mood') addStatus(g, w, 'mood', c.mood);
    for (const r of saw) if (c.shame) approve(g, r.avatar, -c.shame);
    if (c.seen) note(g, c.seen, [placeName], saw.map(r => r.avatar), where, 'crisis');
    if (c.place) g.player.loc = c.place === 'home' ? playerHomeId : c.place;
    (g as any).lastCrisis = { need: s.id, at: now, text: (c.seen ?? '').replace('{u}', '{{user}}').replace('{0}', placeName) };
    return c.text ? [c.text.replace('{cost}', money(w, cost)).replace('{place}', placeName)] : [];
}
// For the AI, for a few hours after a crisis: what just happened.
export function crisisLine(g: Save): string {
    const c = (g as any).lastCrisis;
    return c && c.text && nowAbs(g) - c.at < 180 ? `Just now: ${c.text} {{user}} is still shaken.` : '';
}

// Actions available where the player is (a café sells coffee; at home you can cook).
export function actionsHere(g: Save, w: WorldDef): ActionDef[] {
    const atHome = g.player.loc === playerHomeId;
    // in a building with rooms, the room you are in decides (its tags, and the actions that name a kind of room)
    const room = roomNow(g, w);
    const tags = (room ? scenePlace(g, w) : placeOf(g, w, g.player.loc))?.tags ?? [];
    const on = new Set(activeStatuses(w, g).map(s => s.id));
    // an action only about needs that are not in play (seeing a doctor in Life-Sim) is left out
    // (a scenario keeps them all: in one house, what you do is part of the scene even with needs off)
    const useful = (a: ActionDef) => { const ids = Object.keys(a.effects ?? {}); return !!a.outing || isScenario(w) || !ids.length || ids.some(id => on.has(id)); };
    const broken = brokenThings(g, w).length > 0;
    const closed = !atHome && systemOn(w, 'living') && !openNow(g, w, g.player.loc);   // a closed place: only what can be done anywhere
    // a scenario: the actions chosen for this room when the game started (instead of those its tags bring)
    const chosen: string[] | undefined = isScenario(w) ? roomChosen((g as any).cfg, w, placeOf(g, w, g.player.loc)) : undefined;
    // Home: no money, so nothing to earn or pay, and going out has its own button (Go out)
    const homeMode = isScenario(w);
    const base = w.actions.filter(useful).filter(a => !homeMode || !earns(a)).filter(a => !isBlocked(g, a, w)).filter(a => a.id !== 'fix' || broken)
        .filter(a => homeMode || !a.needsItem || hasItem(g, a.needsItem)).filter(a => chosen || !(a.notTags ?? []).some(t => tags.includes(t))).filter(a => chosen ? (a.anywhere || chosen.includes(a.id)) : (a.home && atHome)
        || (a.place && (a.place === g.player.loc || a.place === room))
        || (!a.home && !a.place && (a.anywhere || (a.tags ?? []).some(t => tags.includes(t))))).filter(a => !closed || a.anywhere).filter(a => !room || fitsRoom(a.rooms, tags));
    // prices after the difficulty; at home, what a cut-off service stops is left out
    // out and about, what you buy costs what it costs in this region now (the living world)
    const here = atHome ? 1 : priceHere(g, w);
    const all = [...base, ...(closed ? [] : extraActions(g, w)), ...eventActions(g, w)].filter(a => !atHome || !cutReason(g, a.id, w));
    // Home: a bathroom or a shower room is not where you grab a snack (what can be done anywhere stays out of it,
    // unless it was chosen for that room)
    const pl = placeOf(g, w, g.player.loc);
    const wet = homeMode && wetRoom(pl);
    if (homeMode) {
        const list = all.filter(a => !earns(a)).filter(a => !wet || !a.anywhere || !!chosen?.includes(a.id));
        const pool = w.actions.filter(useful).filter(a => !earns(a)).filter(a => !isBlocked(g, a, w));
        return [...homeRoomActions(pl, list, pool, chosen, wet).map(a => (a.cost ? { ...a, cost: 0 } : a)), ...closeActions(g, w)];
    }
    // (and, with the intimacy need on, what you can do to be close to who is here)
    return [...all.map(a => (a.cost ? { ...a, cost: a.cost > 0 ? Math.round(priceOf(g, a.cost) * here) : priceOf(g, a.cost) } : a)), ...closeActions(g, w)];
}

// Home: what earns or costs a trip out is not a thing to do in a room (no money in a Home).
const earns = (a: ActionDef) => a.cost < 0 || ((a.roll as any)?.success?.money ?? 0) > 0 || !!a.outing;
type Room = { id: string; name?: string; tags?: string[] };
const wetRoom = (pl: Room | null | undefined) => !!pl && /bath|shower|wash|toilet|restroom|banheiro|lavabo|chuveiro|ba[nñ]o|aseo|ducha/i.test(`${pl.id} ${pl.name ?? ''}`);
/** Home: the actions that can be chosen for a room (everything but what is possible anywhere, and what earns money). */
export const roomActionChoices = (w: WorldDef): ActionDef[] => w.actions.filter(a => !a.anywhere && !earns(a));
/** Home: what a room offers when nothing was chosen for it: the same list the game shows there (a shower in the
 *  bathrooms, cooking in the kitchen, the TV in the living room…), without what is possible anywhere. */
export function roomDefaults(w: WorldDef, pl: Room | null | undefined): string[] {
    if (!pl) return [];
    const tags = pl.tags ?? [];
    const pool = w.actions.filter(a => !earns(a));
    const list = pool.filter(a => !a.anywhere && !(a.notTags ?? []).some(t => tags.includes(t)))
        .filter(a => (a.place && a.place === pl.id) || (!a.home && !a.place && (a.tags ?? []).some(t => tags.includes(t))));
    return homeRoomActions({ id: pl.id, name: pl.name ?? '', tags }, list, pool, undefined, wetRoom(pl)).filter(a => !a.anywhere).map(a => a.id);
}
/** Home: the list chosen for a room (undefined: none, the room's defaults apply). A list made before the things done
 *  at home (a shower, cooking, the TV…) could be chosen (`roomActsV` below 2) keeps the room's default ones: they
 *  could not be ticked then, so leaving them out was never a choice. */
export function roomChosen(c: { roomActs?: Record<string, string[]>; roomActsV?: number } | null | undefined, w: WorldDef, pl: Room | null | undefined): string[] | undefined {
    const list = pl ? c?.roomActs?.[pl.id] : undefined;
    if (!list || !pl || (c?.roomActsV ?? 0) >= 2) return list;
    const home = new Set(w.actions.filter(a => a.home).map(a => a.id));
    return [...new Set([...list, ...roomDefaults(w, pl).filter(id => home.has(id))])];
}
/** Brings every chosen list to the current form (see `roomChosen`); `rooms`: the rooms of this house. */
export function upgradeRoomActs(c: { roomActs?: Record<string, string[]>; roomActsV?: number }, w: WorldDef, rooms: Room[]) {
    if ((c.roomActsV ?? 0) >= 2) return;
    for (const id of Object.keys(c.roomActs ?? {})) { const pl = rooms.find(r => r.id === id); if (pl) c.roomActs![id] = roomChosen(c, w, pl)!; }
    c.roomActsV = 2;
}

// Water, power… of a kind of home, paid with the rent.
export const billsOf = (w: WorldDef, kind: string) => Object.values(w.homes.kinds[kind]?.bills ?? {}).reduce((a, b) => a + b, 0);

export function canAfford(g: Save, a: ActionDef) { return g.player.money >= a.cost; }

export function applyAction(g: Save, w: WorldDef, a: ActionDef) {
    g.player.money -= a.cost;
    if (a.cost) book(g, a.name, -a.cost);
    for (const [id, v] of Object.entries(a.effects)) fill(g, w, id, v, a.id);
    for (const f of onAction) f(g, w, a);
}

// A short line for the AI about how the player feels (only what stands out).
export function feelings(g: Save, w: WorldDef): string {
    const low = activeStatuses(w, g).filter(s => (g.player.stats[s.id] ?? s.start) <= 25).map(s => `${s.name.toLowerCase()} is low (${g.player.stats[s.id]}/${s.max})`);
    return [low.length ? `How {{user}} feels: ${low.join(', ')}.` : '', crisisLine(g)].filter(Boolean).join('\n');
}

// Is there enough energy for this? `drain` is how much each need goes down (positive numbers). Returns the reason
// it cannot be done, or '' when it can. Only energy stops you; the other needs simply drop.
export function tooTired(g: Save, w: WorldDef, drain: Record<string, number>, what: string): string {
    const s = activeStatuses(w, g).find(x => x.id === 'energy');
    const need = s ? drain[s.id] ?? 0 : 0;
    if (!s || need <= 0) return '';
    const have = Math.round(g.player.stats[s.id] ?? s.start);
    return have < need ? `Not enough ${s.name.toLowerCase()} to ${what} (it takes ${Math.round(need)}, you have ${have}). Sleep or rest first.` : '';
}

// Home: what fits each room. Eating and drinking happen in the kitchen (everything) and the dining room (a meal, a
// coffee, a drink, a snack: not cooking); the TV and video games are in the living room; washing up (a shower,
// brushing your teeth…) is in the bathrooms; working out (the treadmill too) is in the gym. What you chose for a room
// in the Home creator stays as you chose it.
const FOODY = (a: ActionDef) => (a.effects?.hunger ?? 0) > 0 || (a.effects?.thirst ?? 0) > 0;
const SCREEN = (a: ActionDef) => /^x-(tv|games)$/.test(a.id) || /\b(tv|video ?games?)\b/i.test(a.label ?? '');
const WASHY = (a: ActionDef) => (a.effects?.hygiene ?? 0) > 0;
// Home: an action made for one room of a Home (the pool, the garage…) also fits the same kind of room in any other
// Home, by its name (a pool you added and called "Piscina" gets swimming and sunbathing too).
const ROOM_KINDS = [/pool|piscina/i, /garage|garagem|garaje/i, /laundry|lavander/i, /front ?yard|porch|varanda|porche|jard[ií]n?|garden|quintal|yard/i, /storage|dep[oó]sito|trastero|despensa|attic|s[oó]t[aã]o/i, /dining|jantar|comedor/i, /gym|academia|gimnasio/i, /kitchen|cozinha|cocina/i, /living|sala de estar|sal[oó]n|lounge/i, /bath|banheiro|ba[nñ]o|shower|chuveiro|lavabo|toilet|washroom/i];
export function placeFits(place: string, room: { id: string; name?: string } | null | undefined): boolean {
    if (!room) return false;
    if (place === room.id) return true;
    const who = `${room.id} ${room.name ?? ''}`;
    return ROOM_KINDS.some(re => re.test(place) && re.test(who));
}
const SPORTY = (a: ActionDef) => (!WASHY(a) && (a.tags ?? []).includes('sport')) || a.id === 'x-treadmill';
const KITCHEN_ONLY = new Set(['cook', 'water', 'x-coffee']);
function homeRoomActions(pl: { id: string; name: string; tags?: string[] } | null | undefined, list: ActionDef[], pool: ActionDef[], chosen: string[] | undefined, wet: boolean): ActionDef[] {
    const who = `${pl?.id ?? ''} ${pl?.name ?? ''}`;
    const food = (pl?.tags ?? []).includes('food');
    const kitchen = /kitchen|cozinha|cocina/i.test(who);
    const living = /living|lounge|family room|tv room|sala de estar|sal[oó]n/i.test(who);
    const gym = /gym|academia|gimnasio/i.test(who);
    const fits = (a: ActionDef) => (SPORTY(a) ? gym : WASHY(a) ? wet : FOODY(a) ? food && (kitchen || !KITCHEN_ONLY.has(a.id)) : SCREEN(a) ? living : true);
    const keep = list.filter(a => !!chosen?.includes(a.id) || fits(a));
    const have = new Set(keep.map(a => a.id));
    const add = chosen ? [] : pool.filter(a => !have.has(a.id) && (FOODY(a) || SCREEN(a) || WASHY(a) || SPORTY(a) || (!!a.place && placeFits(a.place, pl))) && fits(a) && (!!a.place || a.home || a.anywhere || !a.tags?.length || a.tags.some(t => (pl?.tags ?? []).includes(t))) && (!a.place || placeFits(a.place, pl)));
    return [...keep, ...add];
}
