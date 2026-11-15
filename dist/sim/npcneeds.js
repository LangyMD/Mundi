// The people of the world have needs too: hunger, energy, company, fun and hygiene, moved hour by hour by what their
// day already has them doing (asleep, at work, at home, out). Nothing is random and no AI is asked: the same save and
// the same hours give the same people. They look after themselves (a meal when hungry, a shower at home, a nap), so
// what is left is the texture of a day: tired after a shift, hungry before lunch, bored at home, lonely after days in.
// The AI is told how the people in the scene are doing, in a few words; and the engine uses it (someone exhausted is
// less willing). Where they go is still their routine (the free-time "mind" comes on top of this).
import { nowAbs } from '../core/store.js';
import { systemOn } from '../core/world.js';
import { onHour } from './hooks.js';
import { routineStep, whereNow } from './people.js';
export const NPC_NEEDS = ['hunger', 'energy', 'social', 'fun', 'hygiene'];
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
} return h >>> 0; };
const lim = (v) => Math.max(0, Math.min(100, Math.round(v * 10) / 10));
export const npcOn = (w) => !!w && systemOn(w, 'npclife');
// People differ: each one's needs move a little faster or slower (×0.8 … ×1.2), the same for life.
export const temper = (avatar, need) => 0.8 + (hash(`${avatar}|${need}`) % 41) / 100;
// What an hour does, by what they are doing (per hour; + fills, − costs).
const HOUR = {
    sleep: { hunger: -2, energy: 11, social: -1, fun: 0, hygiene: -1 },
    work: { hunger: -5, energy: -6, social: 0, fun: -4, hygiene: -3 },
    home: { hunger: -5, energy: -3.5, social: -5, fun: -2, hygiene: -3 },
    out: { hunger: -5, energy: -5, social: 5, fun: 12, hygiene: -3 },
};
function doingAt(w, r, hour) {
    const at = hour * 60;
    const h = hour % 24;
    const t = routineStep(r, at)[1];
    if (t === 'home')
        return h < 7 || h >= 23 ? 'sleep' : 'home';
    if (t === 'work')
        return w.occupations.some(o => o.id === r.occupation) ? 'work' : 'out';
    return h >= 1 && h < 6 ? 'sleep' : 'out'; // (nobody is out all night, every night)
}
// Someone met for the first time starts mid-life: how a person usually is at that hour, with their own variety.
function fresh(r, hour) {
    const h = hour % 24;
    const v = (k, lo, hi) => lo + (hash(`${r.avatar}|start|${k}`) % (hi - lo + 1));
    return { n: { hunger: v('hunger', 45, 85), energy: lim(h < 7 ? 60 + h * 5 : 100 - (h - 7) * 4 + v('energy', -8, 8)), social: v('social', 45, 80), fun: v('fun', 40, 80), hygiene: v('hygiene', 55, 95) }, last: hour };
}
function oneHour(w, r, s, hour, withPlayer) {
    const d = doingAt(w, r, hour);
    const n = s.n;
    const shared = !!r.homeWith; // lives with someone: home is not lonely
    for (const k of NPC_NEEDS) {
        let v = HOUR[d][k];
        if (k === 'social' && d === 'home' && shared)
            v = 1;
        if (k === 'social' && withPlayer && d !== 'sleep')
            v = Math.max(v, 0) + 8;
        n[k] = lim(n[k] + (v < 0 ? v * temper(r.avatar, k) : v));
    }
    if (d === 'work') {
        s.did = ['work', hour];
        if (n.hunger < 30)
            n.hunger = lim(n.hunger + 50);
        else if (n.energy < 12)
            n.energy = lim(n.energy + 12);
        return;
    } // (lunch on the job says nothing about their day)
    if (d === 'sleep')
        return;
    // looking after themselves: one thing an hour, the most pressing first
    if (n.hunger < 35) {
        n.hunger = lim(n.hunger + 60);
        s.did = ['ate', hour];
    }
    else if (d === 'home' && n.energy < 25) {
        n.energy = lim(n.energy + 22);
        s.did = ['nap', hour];
    }
    else if (d === 'home' && (n.hygiene < 40 || (n.hygiene < 75 && hour % 24 >= 6 && hour % 24 < 10))) {
        n.hygiene = 100;
        s.did = ['wash', hour];
    } // (and the morning wash)
    else if (d === 'home' && n.fun < 40)
        n.fun = lim(n.fun + 14); // TV, a book, a game
    else if (d === 'out' && n.hygiene < 15)
        n.hygiene = lim(n.hygiene + 60); // (a wash wherever they are)
}
const store = (g) => (g.npc ??= {});
const hourNow = (g) => Math.floor(nowAbs(g) / 60);
/** A person's needs, brought up to this hour (after a long absence, only the last two days are lived through). */
export function npcOf(g, w, r) {
    const now = hourNow(g);
    const all = store(g);
    let s = all[r.avatar];
    if (!s || !s.n)
        s = all[r.avatar] = fresh(r, now);
    if (s.last > now)
        s.last = now; // (a restored older save)
    if (now - s.last > 48)
        s.last = now - 48;
    if (now > s.last) {
        const here = whereNow(g, w, r) === g.player.loc; // the player's company counts for the hour it is given
        for (let h = s.last + 1; h <= now; h++)
            oneHour(w, r, s, h, h === now && here);
    }
    s.last = now;
    return s;
}
onHour.push((g, w) => { if (npcOn(w))
    for (const r of Object.values(g.cast))
        npcOf(g, w, r); return []; });
/* ---------- in words ---------- */
/** What stands out about how they are, most pressing first (empty: nothing to say). */
export function npcFeels(g, w, r) {
    if (!npcOn(w))
        return [];
    const s = npcOf(g, w, r);
    const n = s.n;
    const out = [];
    if (n.energy < 12)
        out.push([n.energy, 'exhausted']);
    else if (n.energy < 30)
        out.push([n.energy, 'tired']);
    if (n.hunger < 25)
        out.push([n.hunger, 'hungry']);
    if (n.social < 20)
        out.push([n.social, 'lonely, glad of company']);
    if (n.fun < 20)
        out.push([n.fun, 'bored']);
    if (n.hygiene < 20)
        out.push([n.hygiene, 'in need of a wash']);
    const words = out.sort((a, b) => a[0] - b[0]).slice(0, 2).map(x => x[1]);
    if (!words.length && NPC_NEEDS.every(k => n[k] >= 60))
        words.push('rested and in good spirits');
    return words;
}
/** A little context for their day, when it is fresh (a shift that just ended, a nap). */
export function npcDay(g, w, r) {
    if (!npcOn(w))
        return '';
    const s = npcOf(g, w, r);
    const now = hourNow(g);
    if (!s.did || now - s.did[1] > 2)
        return '';
    const working = doingAt(w, r, now) === 'work';
    return s.did[0] === 'work' ? (working ? 'in the middle of a work day' : 'just off work') : s.did[0] === 'nap' ? 'just up from a nap' : ''; // (a meal or a wash is not news)
}
// For the AI: how the people in the scene are doing. Background, not something to announce.
export function npcLine(g, w, here) {
    if (!npcOn(w))
        return '';
    const parts = here.map(r => { const bits = [npcDay(g, w, r), ...npcFeels(g, w, r)].filter(Boolean); return bits.length ? `${r.name}: ${bits.join(', ')}` : ''; }).filter(Boolean);
    return parts.length ? `How the people here are doing — ${parts.join('; ')}. Background only: let it color how they act and what they want; they do not announce it.` : '';
}
/** How much less (or more) willing they are right now, and why (for the engine's own decisions). */
export function npcWilling(g, w, r) {
    if (!npcOn(w))
        return { delta: 0, why: '' };
    const n = npcOf(g, w, r).n;
    if (n.energy < 12)
        return { delta: -15, why: `${r.name} is exhausted` };
    if (n.energy < 30)
        return { delta: -8, why: `${r.name} is tired` };
    if (n.hunger < 25)
        return { delta: -5, why: `${r.name} is hungry` };
    if (n.social < 20)
        return { delta: 8, why: `${r.name} has been lonely and is glad of company` };
    return { delta: 0, why: '' };
}
