// What everyone is wearing, kept in the save: a category (everyday, formal, sleepwear…) and a layer (outerwear on
// top, the outfit itself, underwear, nothing). The game changes it by itself the way The Sims does (sleepwear at home
// at night, the work outfit on shift, swimwear at the beach, a coat outdoors in winter), you can set it by hand (and
// then it stays until you give it back to the game), and the AI is told. The pictures follow it: each look is a
// folder of the character's Expressions folder, `<category>`, `<category>-outer`, `underwear` or `naked`.
import { state, nowAbs, type Save, type Resident } from '../core/store.js';

export const CATEGORIES = ['everyday', 'formal', 'athletic', 'sleepwear', 'party', 'swimwear', 'hot-weather', 'cold-weather', 'career'] as const;
export const LAYERS = ['outer', 'normal', 'underwear', 'naked'] as const;
export type Category = typeof CATEGORIES[number];
export type Layer = typeof LAYERS[number];
/** `since`: absolute minutes; `why`: what put it on, in a few words; `lock`: set by hand, the game leaves it alone */
export interface Look { category: string; layer: Layer; since: number; why: string; lock?: boolean }
/** The key of your own character in the looks record. */
export const PLAYER = '__player';
// the categories an outer layer exists for (a coat over a swimsuit is not a look)
const OUTER = new Set(['everyday', 'formal', 'party', 'cold-weather', 'career']);

export const CATEGORY_NAME: Record<string, string> = { everyday: 'Everyday', formal: 'Formal', athletic: 'Athletic', sleepwear: 'Sleepwear', party: 'Party', swimwear: 'Swimwear', 'hot-weather': 'Hot weather', 'cold-weather': 'Cold weather', career: 'Work' };
export const LAYER_NAME: Record<Layer, string> = { outer: 'With outerwear', normal: 'The outfit', underwear: 'Underwear', naked: 'Nothing' };
export const categoryName = (c: string) => CATEGORY_NAME[c] ?? c.charAt(0).toUpperCase() + c.slice(1).replace(/[-_]+/g, ' ');

const isLayer = (v: unknown): v is Layer => (LAYERS as readonly string[]).includes(String(v));
const cleanCategory = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'everyday';
export function fixLook(v: any): Look {
    const category = cleanCategory(v?.category);
    let layer: Layer = isLayer(v?.layer) ? v.layer : 'normal';
    if (layer === 'outer' && !OUTER.has(category)) layer = 'normal';
    return { category, layer, since: Number(v?.since) || 0, why: String(v?.why ?? '').slice(0, 80), ...(v?.lock ? { lock: true } : {}) };
}
export const looks = (g: Save): Record<string, Look> => (((g as any).looks ??= {}) as Record<string, Look>);
export const lookOf = (g: Save, who: string): Look => fixLook(looks(g)[who]);

// The folder of a look, and where to look next when the character has no pictures for it.
export function folderOf(l: { category: string; layer: Layer }): string {
    return l.layer === 'naked' ? 'naked' : l.layer === 'underwear' ? 'underwear' : l.layer === 'outer' && OUTER.has(l.category) ? `${l.category}-outer` : l.category;
}
export function folderChain(l: { category: string; layer: Layer }): string[] {
    const out = [folderOf(l)];
    if (l.layer === 'naked') out.push('underwear');
    out.push(l.category, 'everyday');
    return out.filter((f, i) => out.indexOf(f) === i);
}

/* ---------- what the game puts on by itself ---------- */

export interface DressCtx {
    ownHome: boolean;           // at their own home
    night: boolean;             // the hours people sleep
    asleep?: boolean;
    working: boolean;           // on their shift, at their workplace
    place: string;              // the place's name
    tags: string[];             // its tags
    home: boolean;              // someone's home (indoors)
    wear?: string;              // the place's own rule in the world file (a category), when it has one
    season: string;             // spring, summer, autumn, winter
    rain: boolean;
    sunny: boolean;
}
const INDOOR_TAGS = ['food', 'shop', 'service', 'work', 'study', 'sport', 'health'];
// What kind of place it is, for clothes. The world file can say (`wear` on the place); otherwise the tags and the name.
export function placeWear(c: Pick<DressCtx, 'place' | 'tags' | 'home' | 'wear'>): 'swim' | 'sport' | 'outdoors' | 'indoors' | string {
    if (c.wear) return c.wear === 'swimwear' ? 'swim' : c.wear === 'athletic' ? 'sport' : c.wear;
    if (c.home) return 'indoors';
    const name = c.place.toLowerCase();
    if (/\b(beach|pool|water ?park|lido|hot springs?|onsen)\b/.test(name)) return 'swim';
    if (/\b(gym|fitness|dojo|sports? (hall|centre|center|club))\b/.test(name)) return 'sport';
    if (c.tags.includes('leisure') && !c.tags.some(t => INDOOR_TAGS.includes(t))) return 'outdoors';
    return 'indoors';
}
export function wantLook(c: DressCtx): { category: string; layer: Layer; why: string } {
    if (c.ownHome && (c.asleep || c.night)) return { category: 'sleepwear', layer: 'normal', why: c.asleep ? 'asleep' : 'at home at night' };
    const kind = placeWear(c);
    if (kind === 'swim') return c.season === 'winter' ? { category: 'cold-weather', layer: 'outer', why: 'the cold' } : { category: 'swimwear', layer: 'normal', why: `at ${c.place}` };
    if (c.working) return { category: 'career', layer: 'normal', why: 'at work' };
    if (kind === 'sport') return { category: 'athletic', layer: 'normal', why: `at ${c.place}` };
    if (kind === 'outdoors') {
        if (c.season === 'winter') return { category: 'cold-weather', layer: 'outer', why: 'the cold' };
        if (c.rain) return { category: 'everyday', layer: 'outer', why: 'the rain' };
        if (c.season === 'summer' && c.sunny) return { category: 'hot-weather', layer: 'normal', why: 'the heat' };
        return { category: 'everyday', layer: 'normal', why: '' };
    }
    if (kind !== 'indoors') return { category: cleanCategory(kind), layer: 'normal', why: `at ${c.place}` };   // the world's own category
    return { category: 'everyday', layer: 'normal', why: '' };
}

// Sets what someone wears. Returns true when it changed (their pictures are then loaded again).
export function setLook(g: Save, who: string, category: string, layer: Layer, why: string, lock = false): boolean {
    const cur = looks(g)[who] ? lookOf(g, who) : null;
    const next = fixLook({ category, layer, since: nowAbs(g), why, lock });
    if (cur && cur.category === next.category && cur.layer === next.layer) {
        if (!!cur.lock !== !!next.lock) looks(g)[who] = { ...cur, ...(lock ? { lock: true } : { lock: undefined }) } as Look;
        return false;
    }
    looks(g)[who] = next;
    if (who !== PLAYER) delete (state.sprites as any)[who];
    return true;
}
// Gives someone's clothes back to the game ("as the moment asks").
export function unlockLook(g: Save, who: string) { const l = looks(g)[who]; if (l) delete l.lock; }

// The game's own changes, for the given people (and you): everyone not set by hand wears what the moment asks.
// `ctxOf` builds the facts for one of them (null: leave them as they are). Returns who changed.
export function autoDress(g: Save, who: string[], ctxOf: (who: string) => DressCtx | null): string[] {
    const changed: string[] = [];
    for (const id of who) {
        if (looks(g)[id]?.lock) continue;
        const c = ctxOf(id); if (!c) continue;
        const want = wantLook(c);
        if (setLook(g, id, want.category, want.layer, want.why)) changed.push(id);
    }
    return changed;
}

/* ---------- for the AI ---------- */

// The words for each look of a character ("navy blazer, white blouse"), by folder: read from the `outfits.json` the
// card generator writes beside the pictures (ui/looksui.ts loads it).
export const WARDROBE: Record<string, Record<string, string>> = {};
export const wardrobeDesc = (who: string, l: { category: string; layer: Layer }) => { const w = WARDROBE[who]; return w ? (w[folderOf(l)] ?? (l.layer === 'outer' ? w[l.category] : '') ?? '') : ''; };
const WORDS: Record<Layer, (c: string) => string> = {
    outer: c => `${categoryName(c).toLowerCase()} clothes with a coat or jacket on top`,
    normal: c => c === 'career' ? 'work clothes' : c === 'everyday' ? 'everyday clothes' : `${categoryName(c).toLowerCase()} clothes`,
    underwear: () => 'only underwear',
    naked: () => 'nothing',
};
export function lookWords(who: string, l: Look): string {
    const d = wardrobeDesc(who, l).replace(/\s+/g, ' ').trim().slice(0, 160);
    const base = l.category === 'swimwear' && l.layer === 'normal' ? 'swimwear' : l.category === 'sleepwear' && l.layer === 'normal' ? 'sleepwear' : WORDS[l.layer](l.category);
    return d ? `${base} (${d})` : base;
}
// One line for the people here and you. Plain everyday clothes with nothing known about them are not worth a line.
export function looksLines(g: Save, present: Resident[], me = '{{user}}'): string[] {
    const rec = looks(g);
    const said = (id: string) => { const l = rec[id] ? lookOf(g, id) : null; return l && (l.category !== 'everyday' || l.layer !== 'normal' || wardrobeDesc(id, l)) ? l : null; };
    const parts = present.map(r => { const l = said(r.avatar); return l ? `${r.name}: ${lookWords(r.avatar, l)}` : ''; }).filter(Boolean);
    const mine = said(PLAYER); if (mine) parts.push(`${me}: ${lookWords(PLAYER, mine)}`);
    return parts.length ? [`What people are wearing right now (keep to it; clothes change only when someone changes them in the story): ${parts.join('; ')}.`] : [];
}
