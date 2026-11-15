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
import { note } from './facts.js';
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
    sleep: { hunger: -2, energy: 11, social: 0, fun: 0, hygiene: -1 },
    work: { hunger: -5, energy: -6, social: 1, fun: -4, hygiene: -3 },
    home: { hunger: -5, energy: -3.5, social: -4, fun: -2, hygiene: -3 },
    out: { hunger: -5, energy: -5, social: 7, fun: 12, hygiene: -3 },
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
/* ---------- free time: what they feel like decides where they go ---------- */
// An urgent need weighs much more than a mild one (like The Sims' commodities).
const curve = (v) => ((100 - v) / 100) ** 2 * 3 + 0.1;
const WHY = { hunger: 'came for something to eat', energy: 'staying in, worn out', social: 'out to see people', fun: 'out for some fun', hygiene: 'staying in to clean up', none: '' };
/** Where this stretch of free time takes them, chosen once (and kept for about three hours) from how they are now.
 *  `options`: the places open to them; `homeId`: staying in is a choice too ('' when it is not: a Home's rooms).
 *  Null when there is nothing to choose from. */
export function chooseSpot(g, w, r, options, at, stepHour, homeId) {
    const s = npcOf(g, w, r);
    const day = Math.floor(at / 1440), h = Math.floor((at % 1440) / 60);
    const key = `${day}|${stepHour}|${Math.floor(h / 3)}`;
    if (s.act?.key === key && (s.act.place === homeId || options.includes(s.act.place)))
        return s.act.place;
    if (!options.length && !homeId)
        return null;
    const n = s.n;
    const fav = new Set(r.leisure);
    const want = { hunger: curve(n.hunger), energy: curve(n.energy), social: curve(n.social), fun: curve(n.fun), hygiene: curve(n.hygiene) };
    let best = null;
    const offer = (place, parts, taste) => {
        let score = 0, top = 'none', topV = 0.6; // (a reason is only given when a need really pulls)
        for (const [k, weight] of Object.entries(parts)) {
            const v = want[k] * weight;
            score += v;
            if (v > topV) {
                topV = v;
                top = k;
            }
        }
        score *= taste;
        if (!best || score > best.score)
            best = { place, score, why: WHY[top] };
    };
    for (const id of options) {
        const tags = w.places.find(p => p.id === id)?.tags ?? [];
        const parts = { fun: 0.6, social: 0.6 };
        if (tags.includes('food'))
            parts.hunger = 1;
        if (tags.includes('bar'))
            parts.social = 1;
        if (tags.includes('sport')) {
            parts.fun = 0.8;
            if (n.energy < 35)
                parts.fun = 0.2;
        }
        if (tags.includes('leisure') && !tags.includes('food'))
            parts.fun = 1;
        // each person has places they like more (their favorites, and a taste of their own), and the day varies a little
        offer(id, parts, (fav.has(id) ? 1.25 : 1) * (0.8 + (hash(`${r.avatar}|likes|${id}`) % 41) / 100) * (0.9 + (hash(`${r.avatar}|${key}|${id}`) % 21) / 100));
    }
    if (homeId && n.energy < 30)
        offer(homeId, { energy: 0.9, hygiene: 0.4 }, 1); // staying in is for the worn out: the world stays lively
    if (!best)
        return null;
    const pick = best;
    s.act = { key, place: pick.place, why: pick.why };
    return pick.place;
}
// Someone met for the first time starts mid-life: how a person usually is at that hour, with their own variety.
function fresh(r, hour) {
    const h = hour % 24;
    const v = (k, lo, hi) => lo + (hash(`${r.avatar}|start|${k}`) % (hi - lo + 1));
    return { n: { hunger: v('hunger', 45, 85), energy: lim(h < 7 ? 60 + h * 5 : 100 - (h - 7) * 4 + v('energy', -8, 8)), social: v('social', 45, 80), fun: v('fun', 40, 80), hygiene: v('hygiene', 55, 95) }, last: hour };
}
function oneHour(w, r, s, hour, withPlayer) {
    let d = doingAt(w, r, hour);
    const n = s.n;
    const stayedIn = d === 'out' && !!s.act && s.act.place.startsWith('home:'); // free time spent at home, by choice
    if (stayedIn)
        d = 'home';
    const eating = d === 'out' && !!s.act && (w.places.find(p => p.id === s.act.place)?.tags ?? []).includes('food');
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
        s.work = hour;
        if (n.hunger < 30)
            n.hunger = lim(n.hunger + 50);
        else if (n.energy < 12)
            n.energy = lim(n.energy + 12);
        return;
    } // (lunch on the job says nothing about their day)
    if (d === 'sleep')
        return;
    // looking after themselves: one thing an hour, the most pressing first
    if (n.hunger < (eating ? 60 : 35)) {
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
    else if (d === 'home' && n.social < 20)
        n.social = lim(n.social + 15); // a call, a chat over the fence
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
        const from = s.last;
        s.last = now; // (marked first: finding where they are may ask for their needs again)
        const here = whereNow(g, w, r) === g.player.loc; // the player's company counts for the hour it is given
        for (let h = from + 1; h <= now; h++)
            oneHour(w, r, s, h, h === now && here);
    }
    return s;
}
onHour.push((g, w) => { if (npcOn(w)) {
    for (const r of Object.values(g.cast))
        npcOf(g, w, r);
    meetings(g, w);
} return []; });
/* ---------- people meeting each other, and what is on their mind ---------- */
const tied = (g, a, b) => (g.living?.ties ?? []).find(t => (t.a === a && t.b === b) || (t.a === b && t.b === a));
const couple = (g, a, b) => (g.living?.pairs ?? []).some(p => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
// Two people who mean something to each other (family, a couple, friends: a tie that is not sour) and are in the same
// place in their free time spend it together: both get company and a better time, and now and then it is remembered
// as a fact (so it reaches their memories and the rumors), at most once every four days for the same two.
export function meetings(g, w) {
    const now = hourNow(g);
    const at = {};
    for (const r of Object.values(g.cast)) {
        const d = doingAt(w, r, now);
        if (d === 'sleep' || d === 'work')
            continue;
        const loc = whereNow(g, w, r);
        if (loc === 'out')
            continue;
        (at[loc] ??= []).push(r);
    }
    const seen = (g.npcMeet ??= {});
    for (const [loc, list] of Object.entries(at)) {
        if (list.length < 2)
            continue;
        for (let i = 0; i < list.length; i++)
            for (let j = i + 1; j < list.length; j++) {
                const A = list[i], B = list[j];
                const t = tied(g, A.avatar, B.avatar) ?? (couple(g, A.avatar, B.avatar) ? { tone: 'close' } : undefined);
                if (!t || t.tone === 'tense' || t.tone === 'hostile')
                    continue;
                for (const [me, other] of [[A, B], [B, A]]) {
                    const s = npcOf(g, w, me);
                    s.n.social = lim(s.n.social + 5);
                    s.n.fun = lim(s.n.fun + 3);
                    s.saw = [other.name, now];
                }
                const k = pairKey(A.avatar, B.avatar);
                const day = Math.floor(now / 24);
                if (loc.startsWith('home:') || (seen[k] !== undefined && day - seen[k] < 4))
                    continue; // (at home together is everyday life)
                seen[k] = day;
                note(g, '{0} and {1} spent time together at {2}.', [A.name, B.name, w.places.find(p => p.id === loc)?.name ?? 'home'], [A.avatar, B.avatar], loc, 'meet');
            }
    }
}
/** Something that stays on a person's mind for a while (good or bad news of their own life). */
export function moodlet(g, w, avatar, text, hours, good) {
    const r = g.cast[avatar];
    if (!r || !npcOn(w))
        return;
    const s = npcOf(g, w, r);
    const now = hourNow(g);
    s.mood = [...(s.mood ?? []).filter(m => m.until > now && m.text !== text), { text, until: now + hours, good }].slice(-3);
}
const moodNow = (g, s) => (s.mood ?? []).filter(m => m.until > hourNow(g)).at(-1);
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
    const m = moodNow(g, s);
    if (m)
        words.unshift(`${m.good ? 'happy' : 'low'} (${m.text})`);
    else if (!words.length && NPC_NEEDS.every(k => n[k] >= 60))
        words.push('rested and in good spirits');
    return words.slice(0, 2);
}
/** A little context for their day, when it is fresh (a shift that just ended, a nap). */
export function npcDay(g, w, r) {
    if (!npcOn(w))
        return '';
    const s = npcOf(g, w, r);
    const now = hourNow(g);
    const working = doingAt(w, r, now) === 'work';
    // why they are where they are, when they chose it (free time)
    const chose = !working && s.act && s.act.why && s.act.key.startsWith(`${Math.floor(now / 24)}|`) && s.act.key.endsWith(`|${Math.floor((now % 24) / 3)}`) ? s.act.why : '';
    if (s.work !== undefined && now - s.work <= 2)
        return working ? 'in the middle of a work day' : chose ? `just off work, ${chose}` : 'just off work';
    if (chose)
        return chose;
    if (s.saw && now - s.saw[1] <= 3)
        return now - s.saw[1] <= 0 ? `here with ${s.saw[0]}` : `was with ${s.saw[0]} earlier`;
    if (!s.did || now - s.did[1] > 2)
        return '';
    return s.did[0] === 'nap' ? 'just up from a nap' : ''; // (a meal or a wash is not news)
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
    const s = npcOf(g, w, r);
    const n = s.n;
    const m = moodNow(g, s);
    if (m && !m.good)
        return { delta: -8, why: `${r.name} is low (${m.text})` };
    if (n.energy < 12)
        return { delta: -15, why: `${r.name} is exhausted` };
    if (n.energy < 30)
        return { delta: -8, why: `${r.name} is tired` };
    if (n.hunger < 25)
        return { delta: -5, why: `${r.name} is hungry` };
    if (n.social < 20)
        return { delta: 8, why: `${r.name} has been lonely and is glad of company` };
    if (m?.good)
        return { delta: 5, why: `${r.name} is in a happy mood (${m.text})` };
    return { delta: 0, why: '' };
}
