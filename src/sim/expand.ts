// "Expand": a few words of yours ("shrug, say fine") written out as your character's full line, by the AI.
// What you meant stays exactly; nothing is decided for you and nobody else reacts. This file only builds the
// request and cleans the answer; the scene's message box makes the call and shows you the result first.
export interface ExpandAsk {
    me: string;                 // your character's name
    about: string;              // your persona's description ('' when there is none)
    scene: string;              // where and when, and who is here (a few lines)
    recent: string;             // the last lines of the conversation, as "Name: line"
    seed: string;               // what you wrote
    mode: string;               // how you meant it: say, do, free
    style: string;              // the game's writing style, in a sentence ('' when off)
    people: string[];           // who else is here
}
export const EXPAND_SYSTEM = 'You write one character\'s own line in a role-play, from the player\'s short note. You never write for anyone else.';
export function expandPrompt(o: ExpandAsk): string {
    const how = o.mode === 'say' ? `${o.me} is speaking: write mostly what ${o.me} says, in double quotes, with at most a brief gesture.`
        : o.mode === 'do' ? `${o.me} is acting: write what ${o.me} does, as narration in asterisks-free prose; add spoken words only if the note has them.`
            : `Write what ${o.me} does as plain narration and what ${o.me} says in double quotes.`;
    return [
        o.about ? `About ${o.me}: ${o.about.replace(/\s+/g, ' ').slice(0, 700)}` : '',
        o.scene ? `The scene:\n${o.scene}` : '',
        o.recent ? `The conversation so far:\n${o.recent}` : '',
        `The player's note for ${o.me}'s next line: "${o.seed.replace(/\s+/g, ' ').slice(0, 600)}"`,
        `Write ${o.me}'s next line from that note, in the first person ("I"), in 1 to 3 sentences. ${how}`,
        `Keep exactly what the note means: add no new decision, promise, plan or fact, and do not make ${o.me} do more than the note says. ` +
        `Do not write what ${o.people.length ? o.people.join(', ') : 'anyone else'} says, does, thinks or feels, and do not describe how the moment turns out. ` +
        `Match how ${o.me} has been speaking so far.${o.style ? ` ${o.style}` : ''} Reply with the line only.`,
    ].filter(Boolean).join('\n\n');
}
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// The AI's answer as a line you can send: no speaker label, nothing from another speaker, not too long.
export function cleanExpansion(out: string, me: string, people: string[], max = 700): string {
    let t = String(out ?? '').replace(/\r/g, '').replace(/^```[a-z]*\n?|```$/g, '').trim();
    // the line only: a label ("Aiden:") or a lead-in ("Here is the line:") in front is dropped
    t = t.replace(new RegExp(`^\\s*(?:\\*\\*)?${escRe(me)}(?:\\*\\*)?\\s*:\\s*`, 'i'), '').replace(/^(?:here(?:'s| is)[^:\n]{0,60}|line|output)\s*:\s*/i, '');
    // stop where someone else starts to speak (a line that opens with their name and a colon)
    const others = people.map(n => n.split(/\s+/)[0]).filter(Boolean).map(escRe);
    if (others.length) {
        const m = t.search(new RegExp(`(?:^|\\n)\\s*(?:\\*\\*)?(?:${others.join('|')})[^\\n:]{0,30}(?:\\*\\*)?\\s*:`, 'i'));
        if (m > 0) t = t.slice(0, m); else if (m === 0) return '';
    }
    t = t.replace(/\n{2,}/g, '\n').trim();
    if (t.length > max) { const cut = t.slice(0, max); const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf('." '), cut.lastIndexOf('" ')); t = end > max * 0.4 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, ''); }
    // a whole line wrapped in one pair of quotes by the model, around narration too, loses the pair
    if (/^"[^"]*"$/.test(t) === false && /^["“].*["”]$/s.test(t) && (t.match(/["“”]/g) ?? []).length === 2 && /\*/.test(t)) t = t.slice(1, -1).trim();
    return t;
}
