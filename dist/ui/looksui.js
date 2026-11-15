// Clothes at work (sim/looks.ts has the rules): the facts of the moment for each person, the pictures of the look
// someone wears now, and the words for each look read from the card generator's `outfits.json`.
import { game, notify, nowAbs } from '../core/store.js';
import { fetchSprites, outfitOf, baseSpriteFolder } from '../st/bridge.js';
import { placeOf, playerHomeId, isHome } from '../sim/places.js';
import { presentAt, routineStep } from '../sim/people.js';
import { seasonOf } from '../sim/time.js';
import { weatherHere } from '../sim/worldstate.js';
import { dressAt } from '../sim/dress.js';
import { autoDress, lookOf, looks, folderChain, PLAYER, WARDROBE } from '../sim/looks.js';
const NIGHT_FROM = 22 * 60, NIGHT_TO = 6 * 60;
// Everyone in the scene (and you) wears what the moment asks, unless set by hand. A room with a dress code of its
// own (Home) keeps that instead.
export function dressScene(g, w) {
    if (dressAt(g, g.player.loc))
        return [];
    const loc = g.player.loc, here = placeOf(g, w, loc), present = presentAt(g, w, loc);
    const wx = weatherHere(g, w);
    const name = String(wx.name ?? '').toLowerCase();
    const base = {
        night: g.minutes >= NIGHT_FROM || g.minutes < NIGHT_TO, place: here?.name ?? '', tags: here?.tags ?? [], home: isHome(loc) || !!here?.home,
        wear: here?.wear, season: seasonOf(g).id, rain: !!wx.rain, sunny: /sunny|fair|clear/.test(name),
    };
    const by = new Map(present.map(r => [r.avatar, r]));
    return autoDress(g, [...by.keys(), PLAYER], (id) => {
        if (id === PLAYER)
            return { ...base, ownHome: loc === playerHomeId, asleep: !!g.asleep, working: false };
        const r = by.get(id);
        const own = loc === `home:${r.avatar}`;
        return { ...base, ownHome: own, working: !own && !base.home && !!r.occupation && routineStep(r, nowAbs(g))[1] === 'work' };
    });
}
/* ---------- pictures ---------- */
const cache = new Map(); // "avatar|folder" → its pictures ([]: none)
export const forgetLookSprites = (avatar) => { for (const k of [...cache.keys()])
    if (k.startsWith(`${avatar}|`))
        cache.delete(k); delete WARDROBE[avatar]; asked.delete(avatar); };
async function folder(avatar, f) {
    const k = `${avatar}|${f}`;
    if (!cache.has(k))
        cache.set(k, await fetchSprites(avatar, f));
    return cache.get(k);
}
// The pictures of what someone wears now: the look's folder, else the nearest one they have, else their usual
// pictures. An outfit put on the old way (SillyTavern's costume, or a room's dress code) is kept as it is.
export async function lookSprites(avatar) {
    const g = game();
    if (g && looks(g)[avatar] && !outfitOf(avatar) && !avatar.startsWith('__tut:')) {
        void loadWardrobe(avatar);
        for (const f of folderChain(lookOf(g, avatar))) {
            const l = await folder(avatar, f);
            if (l.length)
                return l;
        }
    }
    return fetchSprites(avatar);
}
/* ---------- the words for each look ---------- */
const asked = new Set();
// `outfits.json` beside the pictures: { outfits: [{ folder, category, layer, desc }] } (or the list alone).
export function readWardrobe(json) {
    const list = Array.isArray(json) ? json : Array.isArray(json?.outfits) ? json.outfits : [];
    const out = {};
    for (const e of list) {
        const f = String(e?.folder ?? '').trim().toLowerCase(), d = String(e?.desc ?? '').replace(/\s+/g, ' ').trim();
        if (f && d && !f.includes('--') && !/[\\/]/.test(f))
            out[f] = d.slice(0, 300); // (trait sets, `<set>--<folder>`, come later)
    }
    return out;
}
export async function loadWardrobe(avatar) {
    if (asked.has(avatar))
        return;
    asked.add(avatar);
    try {
        const r = await fetch(`/characters/${encodeURIComponent(baseSpriteFolder(avatar))}/outfits.json`);
        if (!r.ok)
            return;
        const w = readWardrobe(await r.json());
        if (Object.keys(w).length) {
            WARDROBE[avatar] = w;
            const { refreshPrompt } = await import('../sim/prompt.js');
            refreshPrompt();
            notify();
        }
    }
    catch { /* no file: the look is told in general words */ }
}
