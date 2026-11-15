/** Your own character, as someone in a picture. */
export const ME = '__player';
// By hand: the people in a picture (url → avatars; an empty list means "nobody I know").
export const photoTags = (g) => (g.photoTags ??= {});
// `raw`: the pictures as found (by: the sender's name or avatar). `avatarOf`: a name or avatar → the avatar of one of
// the world's people ('' when it is nobody known). Newest first; the same picture twice counts once.
export function shots(raw, avatarOf, tags) {
    const seen = new Set();
    const out = [];
    for (const r of raw) {
        if (!r.url || seen.has(r.url))
            continue;
        seen.add(r.url);
        const tagged = tags[r.url];
        const who = Array.isArray(tagged) ? tagged.filter(Boolean) : r.mine ? [ME] : [avatarOf(r.by)].filter(Boolean);
        out.push({ url: r.url, caption: r.caption, at: r.at, who, source: r.source, guessed: !Array.isArray(tagged), ...(r.look ? { look: r.look } : {}) });
    }
    return out.sort((a, b) => b.at - a.at);
}
// Who has pictures, and how many (most first). '' gathers the pictures with nobody in them.
export function albums(list) {
    const by = new Map();
    for (const s of list)
        for (const w of (s.who.length ? s.who : [''])) {
            const a = by.get(w) ?? { who: w, n: 0, cover: s.url };
            a.n++;
            by.set(w, a);
        }
    return [...by.values()].sort((a, b) => (a.who === '' ? 1 : b.who === '' ? -1 : b.n - a.n));
}
export const shotsOf = (list, who) => list.filter(s => (who === '' ? !s.who.length : s.who.includes(who)));
// Adds or removes someone from a picture (the guess becomes your own list from then on).
export function toggleTag(g, s, who) {
    const cur = new Set(s.who);
    if (cur.has(who))
        cur.delete(who);
    else
        cur.add(who);
    photoTags(g)[s.url] = [...cur];
}
export function clearTag(g, url) { delete photoTags(g)[url]; }
