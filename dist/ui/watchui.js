// The clothes check at work (sim/watch.ts has the words): after the characters have answered, asks the AI whether
// someone changed what they wear in the lines just written, and updates the game's record. Off unless turned on in
// Settings › AI context › AI calls.
import { state, notify, game, saveGame, toast, UI } from '../core/store.js';
import { getWorld } from '../core/world.js';
import { hereWith } from '../sim/interiors.js';
import { chat, personaName, quiet, outfitOf } from '../st/bridge.js';
import { CATEGORIES, PLAYER, lookOf, lookWords, setStoryLook } from '../sim/looks.js';
import { watchLevel, mentionsClothes, watchPrompt, readWatch, WATCH_SYSTEM } from '../sim/watch.js';
import { refreshPrompt } from '../sim/prompt.js';
export const clothesWatch = () => watchLevel(UI().watchClothes);
// The world's own kinds of outfit (a place's `wear` that is not one of the usual ones).
export const worldCategories = (w) => [...new Set((w.places ?? []).map(p => String(p?.wear ?? '').trim().toLowerCase()).filter(c => c && !['outdoors', 'indoors'].includes(c) && !CATEGORIES.includes(c)))];
let busy = false, seen = '';
// Looks at the lines since your last message. Returns how many people changed.
export async function watchClothes() {
    const level = clothesWatch();
    const g = game();
    const w = g && getWorld(g.world);
    if (level === 'off' || !g || !w || busy || state.generating)
        return 0;
    const all = chat();
    const told = (m) => m && !m.is_system && String(m.mes ?? '').trim();
    let end = all.length - 1;
    while (end >= 0 && !told(all[end]))
        end--;
    if (end < 0 || all[end].is_user)
        return 0; // nobody answered yet
    let from = end;
    while (from > 0 && !all[from].is_user && end - from < 3)
        from--;
    const part = all.slice(from, end + 1).filter(told);
    const sig = `${end}|${all[end].swipe_id ?? 0}|${String(all[end].mes).length}`;
    if (sig === seen)
        return 0;
    seen = sig;
    const me = personaName();
    if (level === 'hint' && !mentionsClothes(part.map(m => m.mes).join('\n')))
        return 0;
    // (someone in a costume put on the old way, SillyTavern's own, is left to it)
    const present = hereWith(g, w).filter(r => !outfitOf(r.avatar));
    const who = [...present.map(r => ({ id: r.avatar, name: r.name, wearing: lookWords(r.avatar, lookOf(g, r.avatar)) })), { id: PLAYER, name: me, wearing: lookWords(PLAYER, lookOf(g, PLAYER)) }];
    const lines = part.map(m => `${m.is_user ? me : m.name}: ${String(m.mes ?? '').replace(/\s+/g, ' ').slice(0, 700)}`).join('\n');
    const extra = worldCategories(w), loc = g.player.loc;
    busy = true;
    try {
        const out = await quiet(watchPrompt(who, lines, extra), 160, WATCH_SYSTEM);
        if (game() !== g || g.player.loc !== loc)
            return 0; // you moved on meanwhile
        const current = {};
        for (const p of who)
            current[p.id] = lookOf(g, p.id);
        const changes = readWatch(out, who, current, extra);
        for (const c of changes) {
            setStoryLook(g, c.id, c.category, c.layer, loc);
            toast(`${who.find(p => p.id === c.id).name}: now in ${lookWords(c.id, lookOf(g, c.id))} (from the story).`, 'info');
        }
        if (changes.length) {
            refreshPrompt();
            saveGame();
            notify();
        }
        return changes.length;
    }
    catch (e) {
        console.warn('[Mundi] clothes check', e);
        return 0;
    }
    finally {
        busy = false;
    }
}
