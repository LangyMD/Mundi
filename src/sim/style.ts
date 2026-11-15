// Writing style and tone: how the story is told in this game (point of view, length, pace, tone, style tags, how
// people speak, how present the narrator is). Off by default: then nothing is sent and your preset decides.
// On: the choices become one short instruction, sent late in the prompt with every reply (and, in short, with the
// narrator's own calls). The instruction can also be a text of your own, or one the AI wrote from your choices.
import { cfg, settings, type Save } from '../core/store.js';

export type Pov = '' | 'second' | 'third' | 'first';
export type Length = '' | 'short' | 'medium' | 'long';
export type Pace = '' | 'slow' | 'steady' | 'brisk';
export type Narrator = '' | 'invisible' | 'light' | 'heavy';
export interface Style {
    on: boolean; pov: Pov; length: Length; pace: Pace; narrator: Narrator;
    /** the mood over the whole story ("warm", "bleak, absurd") */ tone: string;
    /** style tags picked from the list or written by you */ tags: string[];
    /** how the people of the world sound when they speak */ npcSpeech: string;
    /** anything else, in your words */ notes: string;
    /** the instruction as one text (yours, or written by the AI from the choices); used when `useRule` is on */ rule: string; useRule: boolean;
    /** where it goes: 'late' just before the newest message (holds best), 'top' with the scene block */ where: 'late' | 'top';
}
export const DEFAULT_STYLE: Style = { on: false, pov: '', length: '', pace: '', narrator: '', tone: '', tags: [], npcSpeech: '', notes: '', rule: '', useRule: false, where: 'late' };
const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T => (list.includes(v as T) ? (v as T) : list[0]);
// A style read from a save or a preset: every field of the right kind, nothing else.
export function fixStyle(x: any): Style {
    const s = x && typeof x === 'object' ? x : {};
    return {
        on: s.on === true, pov: oneOf(s.pov, ['', 'second', 'third', 'first'] as const), length: oneOf(s.length, ['', 'short', 'medium', 'long'] as const),
        pace: oneOf(s.pace, ['', 'slow', 'steady', 'brisk'] as const), narrator: oneOf(s.narrator, ['', 'invisible', 'light', 'heavy'] as const),
        tone: clean(s.tone, 120), tags: (Array.isArray(s.tags) ? s.tags : []).map((t: unknown) => clean(t, MAX_TAG)).filter(Boolean).slice(0, 12),
        npcSpeech: clean(s.npcSpeech, 120), notes: String(s.notes ?? '').trim().slice(0, 1200), rule: String(s.rule ?? '').trim().slice(0, 2000), useRule: s.useRule === true,
        where: oneOf(s.where, ['late', 'top'] as const),
    };
}
// This game's style (kept in the save, so each game has its own).
export function styleOf(g: Save | null | undefined): Style {
    if (!g) return { ...DEFAULT_STYLE };
    const c = cfg(g) as any;
    // repaired in place: whoever holds this game's style keeps holding the same one
    if (!c.style || typeof c.style !== 'object') c.style = {};
    return Object.assign(c.style, fixStyle(c.style)) as Style;
}

/* ---------- the choices ---------- */

export const POVS: [Pov, string, string][] = [
    ['', 'As the preset has it', ''],
    ['second', 'Second person', 'The narration addresses {{user}} as "you".'],
    ['third', 'Third person', 'The narration is in the third person and calls {{user}} by name.'],
    ['first', 'First person, by who speaks', 'Whoever speaks tells their own part in the first person ("I") and calls {{user}} by name.'],
];
export const LENGTHS: [Length, string, string][] = [
    ['', 'As the preset has it', ''],
    ['short', 'Short', 'Keep each reply short: one or two brief paragraphs, under about 120 words.'],
    ['medium', 'Medium', 'Each reply is two or three paragraphs, about 150 to 250 words.'],
    ['long', 'Long', 'Each reply is three to five paragraphs, about 300 to 450 words.'],
];
export const PACES: [Pace, string, string][] = [
    ['', 'As the preset has it', ''],
    ['slow', 'Slow burn', 'Pace: slow. Stay in the moment, let small things take their time, and do not rush toward events.'],
    ['steady', 'Steady', 'Pace: steady. Each reply moves the moment forward one clear step.'],
    ['brisk', 'Brisk', 'Pace: brisk. Get to the point, cut what does not matter, and keep things moving.'],
];
export const NARRATORS: [Narrator, string, string][] = [
    ['', 'As the preset has it', ''],
    ['invisible', 'Invisible', 'The narration only reports what happens: no attitude, no commentary.'],
    ['light', 'Light', 'The narration may show a little attitude, at most one touch per reply.'],
    ['heavy', 'Heavy', 'The narration has a voice and opinions of its own throughout; that voice never leaks into what characters say.'],
];
export const TONES = ['lighthearted', 'warm', 'playful', 'wistful', 'melancholy', 'tense', 'bleak', 'absurd', 'dreamlike', 'clinical'];
export const SPEECH = ['modern casual', 'victorian formal', '1920s slang', 'rural drawl', 'military clipped', 'archaic high fantasy'];
export const STYLE_TAGS: { name: string; tags: string[] }[] = [
    { name: 'Genre', tags: ['Slice-of-life', 'Romantic', 'Comedy', 'Drama', 'Mystery', 'Thriller', 'Horror', 'Adventure', 'Fantasy', 'Noir'] },
    { name: 'Prose', tags: ['Plain and direct', 'Sensory detail', 'Lyrical', 'Minimalist', 'Cinematic', 'Dialogue-heavy', 'Introspective', 'Banter', 'Understated', 'Show, don\'t tell'] },
];
export const MAX_TAG = 60;
// Tags you wrote yourself: kept for all your games, so one written here can be picked in the next.
export const ownTags = (): string[] => { const s = settings() as any; return (s.styleTags = (Array.isArray(s.styleTags) ? s.styleTags : []).map((t: unknown) => clean(t, MAX_TAG)).filter(Boolean)); };
export const isBuiltInTag = (t: string) => STYLE_TAGS.some(c => c.tags.some(x => x.toLowerCase() === t.toLowerCase()));
export function addOwnTag(name: string): string {
    const n = clean(name, MAX_TAG).replace(/[[\]{}<>]/g, '');
    if (!n) return '';
    const built = STYLE_TAGS.flatMap(c => c.tags).find(x => x.toLowerCase() === n.toLowerCase());
    if (built) return built;
    const list = ownTags(); const had = list.find(x => x.toLowerCase() === n.toLowerCase());
    if (had) return had;
    list.push(n); return n;
}
export function removeOwnTag(name: string) { const s = settings() as any; s.styleTags = ownTags().filter(t => t !== name); }
export function toggleTag(s: Style, tag: string) {
    const i = s.tags.findIndex(t => t.toLowerCase() === tag.toLowerCase());
    if (i >= 0) s.tags.splice(i, 1); else if (s.tags.length < 12) s.tags.push(tag);
}

/* ---------- presets (for all your games) ---------- */

export interface StylePreset { id: string; name: string; style: Style }
export const stylePresets = (): StylePreset[] => { const s = settings() as any; return (s.stylePresets = Array.isArray(s.stylePresets) ? s.stylePresets : []); };
export function savePreset(name: string, style: Style): StylePreset | null {
    const n = clean(name, 60); if (!n) return null;
    const list = stylePresets(); const copy = fixStyle(JSON.parse(JSON.stringify(style)));
    const had = list.find(p => p.name.toLowerCase() === n.toLowerCase());
    if (had) { had.style = copy; return had; }
    const p = { id: `sp${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, name: n, style: copy };
    list.push(p); return p;
}
export function deletePreset(id: string) { const s = settings() as any; s.stylePresets = stylePresets().filter(p => p.id !== id); }
// A preset put on this game (whether the style is on stays as it is here).
export function usePreset(g: Save, id: string): boolean {
    const p = stylePresets().find(x => x.id === id); if (!p) return false;
    const on = styleOf(g).on;
    (cfg(g) as any).style = { ...fixStyle(JSON.parse(JSON.stringify(p.style))), on };
    return true;
}

/* ---------- what is sent ---------- */

const pick = <T extends string>(list: [T, string, string][], v: T) => list.find(x => x[0] === v)?.[2] ?? '';
// The choices as plain lines (what the instruction is built from, and what the AI is given to write one).
export function styleLines(s: Style): string[] {
    return [
        pick(POVS, s.pov), pick(LENGTHS, s.length), pick(PACES, s.pace),
        s.tone ? `Tone over the whole story: ${s.tone}.` : '',
        s.tags.length ? `Style: ${s.tags.join(', ')}.` : '',
        pick(NARRATORS, s.narrator),
        s.npcSpeech ? `How people speak: ${s.npcSpeech}.` : '',
        s.notes,
    ].filter(Boolean);
}
// The instruction sent with every reply ('' when the style is off or says nothing).
export function styleText(s: Style): string {
    if (!s.on) return '';
    const body = s.useRule && s.rule.trim() ? s.rule.trim() : styleLines(s).join('\n');
    return body ? `[Writing style — keep to it in every reply]\n${body}` : '';
}
// One sentence of it for Mundi's own short calls (the narrator's lines): tone, tags and point of view only.
export function styleNote(s: Style): string {
    if (!s.on) return '';
    const bits = [s.tone ? `tone: ${s.tone}` : '', s.tags.length ? `style: ${s.tags.join(', ')}` : '', s.narrator === 'invisible' ? 'no commentary' : s.narrator === 'heavy' ? 'a narrator with a voice of its own' : ''].filter(Boolean);
    return bits.length ? `Writing style (${bits.join('; ')}).` : '';
}
// What the AI is asked, to turn the choices into one compact instruction.
export function compilePrompt(s: Style): string {
    return `These are a player's preferences for how a role-play story is written:\n${styleLines(s).map(l => `- ${l}`).join('\n')}\n\nWrite them as one compact set of writing instructions for the storyteller: plain imperative sentences, under 110 words, nothing left out and nothing added. Keep "{{user}}" exactly as written. Reply with the instructions only: no title, no list numbers, no comment.`;
}
export const cleanRule = (out: string) => String(out ?? '').replace(/^\s*(?:\*\*)?(?:writing (?:style|instructions|rule)s?)\s*:?\s*(?:\*\*)?\s*:?\s*/i, '').replace(/^["“]+|["”]+$/g, '').trim().slice(0, 2000);
