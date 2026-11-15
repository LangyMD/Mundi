// Photos: the pictures of this game (those in the chat, and those posted on Chirp), sorted by who is in them. Who is
// in a picture is a guess from who sent it; you can correct it by hand, and that is kept in the save.
import type { Save } from '../core/store.js';

/** Your own character, as someone in a picture. */
export const ME = '__player';
export interface Shot { url: string; caption: string; at: number; who: string[]; source: 'chat' | 'chirp'; guessed: boolean; look?: string }
export interface RawShot { url: string; caption: string; at: number; by: string; mine?: boolean; source: 'chat' | 'chirp'; look?: string }

// By hand: the people in a picture (url → avatars; an empty list means "nobody I know").
export const photoTags = (g: Save): Record<string, string[]> => (((g as any).photoTags ??= {}) as Record<string, string[]>);

// `raw`: the pictures as found (by: the sender's name or avatar). `avatarOf`: a name or avatar → the avatar of one of
// the world's people ('' when it is nobody known). Newest first; the same picture twice counts once.
export function shots(raw: RawShot[], avatarOf: (by: string) => string, tags: Record<string, string[]>): Shot[] {
    const seen = new Set<string>(); const out: Shot[] = [];
    for (const r of raw) {
        if (!r.url || seen.has(r.url)) continue; seen.add(r.url);
        const tagged = tags[r.url];
        const who = Array.isArray(tagged) ? tagged.filter(Boolean) : r.mine ? [ME] : [avatarOf(r.by)].filter(Boolean);
        out.push({ url: r.url, caption: r.caption, at: r.at, who, source: r.source, guessed: !Array.isArray(tagged), ...(r.look ? { look: r.look } : {}) });
    }
    return out.sort((a, b) => b.at - a.at);
}
// Who has pictures, and how many (most first). '' gathers the pictures with nobody in them.
export function albums(list: Shot[]): { who: string; n: number; cover: string }[] {
    const by = new Map<string, { who: string; n: number; cover: string }>();
    for (const s of list) for (const w of (s.who.length ? s.who : [''])) {
        const a = by.get(w) ?? { who: w, n: 0, cover: s.url };
        a.n++; by.set(w, a);
    }
    return [...by.values()].sort((a, b) => (a.who === '' ? 1 : b.who === '' ? -1 : b.n - a.n));
}
export const shotsOf = (list: Shot[], who: string) => list.filter(s => (who === '' ? !s.who.length : s.who.includes(who)));
// Adds or removes someone from a picture (the guess becomes your own list from then on).
export function toggleTag(g: Save, s: Shot, who: string) {
    const cur = new Set(s.who);
    if (cur.has(who)) cur.delete(who); else cur.add(who);
    photoTags(g)[s.url] = [...cur];
}
export function clearTag(g: Save, url: string) { delete photoTags(g)[url]; }
