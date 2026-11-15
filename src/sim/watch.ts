// The clothes check: an optional AI call after a reply, asking only whether someone changed what they wear in the
// lines just written ("she slips into her swimsuit"), so the game's record (and the pictures) follow the story.
// This file builds the question, decides whether the lines are worth asking about, and reads the answer;
// ui/watchui.ts makes the call.
import { CATEGORIES, LAYERS, categoryName, type Layer } from './looks.js';

export type WatchLevel = 'off' | 'hint' | 'always';
export const watchLevel = (v: unknown): WatchLevel => (v === 'hint' || v === 'always' ? v : 'off');

// Words that make a line worth asking about (the 'hint' level calls the AI only then).
const CLOTHES = /\b(wear(?:s|ing)?|wore|worn|dress(?:ed|es|ing)?|undress\w*|strip(?:s|ped|ping)?|naked|nude|clothes|clothing|outfit|shirt|t-?shirt|blouse|skirt|trousers|pants|jeans|shorts|leggings|jacket|coat|hoodie|sweater|jumper|cardigan|robe|bathrobe|towel|pyjamas|pajamas|nightgown|nightdress|swimsuit|bikini|trunks|underwear|bra|panties|boxers|lingerie|uniform|apron|gown|tuxedo|sportswear|gym clothes|put(?:s|ting)? on|pull(?:s|ed|ing)? on|take(?:s|n)? off|took off|taking off|pull(?:s|ed|ing)? off|slip(?:s|ped|ping)? (?:into|out of|off|on)|chang(?:e|es|ed|ing) (?:into|out of|clothes)|get(?:s|ting)? (?:dressed|changed|undressed)|got (?:dressed|changed|undressed)|unbutton\w*|unzip\w*|shrug(?:s|ged)? (?:off|out of|into))\b/i;
export const mentionsClothes = (text: string) => CLOTHES.test(String(text ?? ''));

export interface WatchWho { id: string; name: string; wearing: string }
export const WATCH_SYSTEM = 'You check a passage of a story for one thing: whether someone changed what they are wearing. You answer with JSON only and never continue the story.';
// `who`: the people in the scene (you included) with what the game thinks each wears; `lines`: the last lines, the
// newest last ("Name: text"); `extra`: the world's own kinds of outfit, beyond the usual ones.
export function watchPrompt(who: WatchWho[], lines: string, extra: string[] = []): string {
    const cats = [...new Set([...CATEGORIES, ...extra])];
    return [
        `People in the scene, and what each is wearing right now:\n${who.map(p => `- ${p.name}: ${p.wearing}`).join('\n')}`,
        `The latest lines of the story:\n${lines}`,
        `Did any of the people listed change what they are wearing in these lines (put something on, take something off, change into something)? Count only what clearly happens in the text: not plans, wishes, memories or what someone merely talks about, and not a change the list above already shows.`,
        `Answer with JSON only, nothing else: {"changes":[{"name":"<a name from the list>","category":"<kind of outfit>","layer":"<layer>"}]}\n` +
        `category, one of: ${cats.map(c => `${c}${categoryName(c).toLowerCase() !== c ? ` (${categoryName(c).toLowerCase()})` : ''}`).join(', ')}. Keep the current one when only the layer changed.\n` +
        `layer, one of: outer (a coat or jacket on top), normal (the outfit itself), underwear (down to underwear), naked (nothing on).\n` +
        `Nobody changed: {"changes":[]}`,
    ].join('\n\n');
}

export interface WatchChange { id: string; category: string; layer: Layer }
const firstName = (s: string) => String(s ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
// The AI's answer as changes to apply. Unknown names, unknown kinds and layers are dropped; so is "no change".
// `current`: what each wears now (to keep the category when the answer gives none, and to drop what is no change).
export function readWatch(out: string, who: WatchWho[], current: Record<string, { category: string; layer: Layer }>, extra: string[] = []): WatchChange[] {
    const text = String(out ?? '').replace(/```[a-z]*|```/gi, '');
    const a = text.indexOf('{'), b = text.lastIndexOf('}'), la = text.indexOf('['), lb = text.lastIndexOf(']');
    const tryJson = (from: number, to: number) => { try { return from >= 0 && to > from ? JSON.parse(text.slice(from, to + 1)) : null; } catch { return null; } };
    // (a bare list comes before any object; otherwise the object, which holds the list)
    const json: any = la >= 0 && la < a ? tryJson(la, lb) ?? tryJson(a, b) : tryJson(a, b) ?? tryJson(la, lb);
    const list: any[] = Array.isArray(json) ? json : Array.isArray(json?.changes) ? json.changes : [];
    const cats = new Set<string>([...CATEGORIES, ...extra]);
    const done = new Set<string>(), res: WatchChange[] = [];
    for (const e of list) {
        const n = String(e?.name ?? '').trim().toLowerCase(); if (!n) continue;
        const p = who.find(x => x.name.toLowerCase() === n) ?? who.find(x => firstName(x.name) === firstName(n));
        if (!p || done.has(p.id)) continue;
        const cur = current[p.id] ?? { category: 'everyday', layer: 'normal' as Layer };
        const layer = String(e?.layer ?? '').trim().toLowerCase(), cat = String(e?.category ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-');
        const next = { id: p.id, category: cats.has(cat) ? cat : cur.category, layer: ((LAYERS as readonly string[]).includes(layer) ? layer : cats.has(cat) ? 'normal' : cur.layer) as Layer };
        if (!cats.has(cat) && !(LAYERS as readonly string[]).includes(layer)) continue;   // nothing usable said
        if (next.category === cur.category && next.layer === cur.layer) continue;
        done.add(p.id); res.push(next);
    }
    return res;
}
