// Clothes at work (sim/looks.ts has the rules): the facts of the moment for each person, the pictures of the look
// someone wears now, and the words for each look read from the card generator's `outfits.json`.
import { game, notify, nowAbs } from '../core/store.js';
import { hereWith, scenePlace } from '../sim/interiors.js';
import { getWorld } from '../core/world.js';
import { activeTraits, pickSets, guessSets, setFolder, setTraits, traitDef } from '../sim/persontraits.js';
import { fetchSprites, outfitOf, baseSpriteFolder } from '../st/bridge.js';
import { placeOf, playerHomeId, isHome } from '../sim/places.js';
import { routineStep } from '../sim/people.js';
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
    const loc = g.player.loc, here = scenePlace(g, w) ?? placeOf(g, w, loc), present = hereWith(g, w); // (the room, and who is in it)
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
    }, loc);
}
/* ---------- pictures ---------- */
const cache = new Map(); // "avatar|folder" → its pictures ([]: none)
export const forgetLookSprites = (avatar) => { for (const k of [...cache.keys()])
    if (k.startsWith(`${avatar}|`))
        cache.delete(k); delete WARDROBE[avatar]; delete SETS[avatar]; asked.delete(avatar); };
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
        await loadWardrobe(avatar);
        const look = lookOf(g, avatar), chain = folderChain(look);
        // a set of pictures for who they are lately (a trait, or several together) comes first; an outfit the set
        // does not have falls back to their usual pictures
        const w = getWorld(g.world), active = activeTraits(g, avatar);
        if (active.length) {
            const known = SETS[avatar];
            const order = pickSets(known?.sets ?? guessSets(active), active, known?.priority ?? [], (w?.traitPriority ?? []), id => traitDef(g, w, id).kind === 'state');
            for (const s of order) {
                const l = await folder(avatar, setFolder(s.id, chain[0]));
                if (l.length)
                    return l;
            }
        }
        for (const f of chain) {
            const l = await folder(avatar, f);
            if (l.length)
                return l;
        }
    }
    return fetchSprites(avatar);
}
/* ---------- the words for each look ---------- */
const asked = new Map();
// A character's own picture sets, from `outfits.json`: { sets: [{ id, traits }], priority: [trait ids] }.
const SETS = {};
export function readSets(json) {
    const list = Array.isArray(json?.sets) ? json.sets : [];
    const sets = list.map((e) => { const id = String(e?.id ?? '').trim().toLowerCase(); const traits = Array.isArray(e?.traits) && e.traits.length ? e.traits.map((t) => String(t).toLowerCase()) : setTraits(id); return { id, traits }; }).filter((s) => s.id && s.traits.length);
    return { sets, priority: Array.isArray(json?.priority) ? json.priority.map((t) => String(t).toLowerCase()) : [] };
}
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
export function loadWardrobe(avatar) {
    if (!asked.has(avatar))
        asked.set(avatar, (async () => {
            try {
                const r = await fetch(`/characters/${encodeURIComponent(baseSpriteFolder(avatar))}/outfits.json`);
                if (!r.ok)
                    return;
                const json = await r.json();
                const sets = readSets(json);
                if (sets.sets.length)
                    SETS[avatar] = sets;
                const w = readWardrobe(json);
                if (Object.keys(w).length) {
                    WARDROBE[avatar] = w;
                    const { refreshPrompt } = await import('../sim/prompt.js');
                    refreshPrompt();
                    notify();
                }
            }
            catch { /* no file: the look is told in general words */ }
        })());
    return asked.get(avatar);
}
