const list = (a) => a.length <= 1 ? (a[0] ?? '') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
const are = (a) => (a.length > 1 ? 'are' : 'is');
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const span = (m) => !m ? '' : m < 60 ? `${m} minutes` : m % 60 === 0 ? `${m / 60} hour${m === 60 ? '' : 's'}` : `${Math.floor(m / 60)} h ${m % 60} min`;
export function narrLevel(v, fallback) {
    return v === 'off' || v === 'engine' || v === 'ai' ? v : fallback;
}
// The line without the AI: plain facts, in the second person. Also what is posted when the AI gives nothing.
export function engineLine(f) {
    const who = f.people.length ? `${list(f.people)} ${are(f.people)} here.` : 'Nobody else is here.';
    if (f.kind === 'arrive') {
        const busy = f.closed ? 'It is closed at this hour.' : f.crowd && f.crowd !== 'a few people' ? `It is ${f.crowd}.` : f.crowd ? 'A few people are around.' : '';
        return [`You arrive at ${f.place}.`, busy, who].filter(Boolean).join(' ');
    }
    const came = f.came ?? [], left = f.left ?? [];
    const others = f.people.filter(n => !came.includes(n));
    return [
        `You ${lower(f.action ?? 'do it')}${f.minutes ? ` (${span(f.minutes)})` : ''}.`,
        f.result ?? '',
        came.length ? `Meanwhile ${list(came)} came in.` : '',
        left.length ? `${list(left)} left${came.length ? '' : ' meanwhile'}.` : '',
        (came.length || left.length) && others.length ? `${list(others)} ${are(others)} still here.` : '',
        (came.length || left.length) && !f.people.length ? 'You are alone now.' : '',
    ].filter(Boolean).join(' ');
}
export const NARRATE_SYSTEM = 'You are the narrator of a life simulation. You describe the place and the moment in a few sentences. You never write what anyone says, and you never decide anything for the player\'s character.';
// The request to the AI. `recent`: the last lines of the chat ("Name: line"), `style`: the game's writing style in a
// sentence ('' when off), `lang`: the language note ('' for English).
export function narratePrompt(f, recent = '', style = '', lang = '') {
    const came = f.came ?? [], left = f.left ?? [];
    const facts = [
        `Place: ${f.place}${f.desc ? ` — ${f.desc.replace(/\s+/g, ' ').slice(0, 400)}` : ''}${f.closed ? ' (closed at this hour)' : ''}`,
        `Time: ${f.time}.${f.weather ? ` Weather: ${f.weather}.` : ''}${f.crowd ? ` How busy: ${f.crowd}.` : ''}`,
        f.people.length ? `Here now with ${f.me}: ${list(f.people)}. Nobody else.` : `${f.me} is alone here.`,
        ...(f.why ?? []),
    ];
    let task;
    if (f.kind === 'arrive') {
        task = `${f.me} has just arrived at ${f.place}. Narrate the arrival in 2 to 3 sentences, in the second person ("you"): what the place is like at this hour` +
            `${f.people.length ? `, and that ${list(f.people)} ${are(f.people)} here, each only glimpsed in passing (where they are, what they seem busy with)` : ', and that nobody else is around'}.`;
    }
    else {
        facts.push(`What ${f.me} just did: ${lower(f.action ?? '')}${f.minutes ? `, for ${span(f.minutes)}` : ''}.${f.result ? ` How it went (already decided, do not change it): ${f.result}` : ''}`);
        if (came.length)
            facts.push(`While it lasted, ${list(came)} came in and ${are(came)} here now.`);
        if (left.length)
            facts.push(`While it lasted, ${list(left)} left and ${are(left)} no longer here.`);
        task = `Narrate how it goes in 2 to 4 sentences, in the second person ("you"), ending in the present moment.` +
            (came.length ? ` The narration must show ${list(came)} arriving partway through, seen from ${f.me}'s side.` : '') +
            (left.length ? ` It must show ${list(left)} leaving partway through.` : '') +
            (!f.people.length ? ` ${f.me} ends up alone: nobody appears.` : '');
    }
    const rules = `Use only the facts above: invent no other person, event or object that matters. Do not write anyone's spoken words, and do not write what ${f.me} says, decides or does next. ` +
        `${f.people.length ? `${list(f.people)} may be seen or heard, but they do not speak or address ${f.me} yet: they answer for themselves afterwards. ` : ''}` +
        `Plain prose, no title, no list.${style ? ` ${style}` : ''}${lang ? ` ${lang}` : ''}`;
    return [facts.join('\n'), recent ? `The last lines of the story:\n${recent}` : '', task, rules].filter(Boolean).join('\n\n');
}
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// The AI's answer as a narrator's line: no label, nothing a named person "says" as a script line, not too long.
// '' when nothing usable is left (the ready-made line is used instead).
export function cleanNarration(out, me, people, max = 700) {
    let t = String(out ?? '').replace(/\r/g, '').replace(/^```[a-z]*\n?|```$/g, '').trim();
    t = t.replace(/^\s*(?:\*\*)?(?:narrator|narration)(?:\*\*)?\s*:\s*/i, '').replace(/^(?:here(?:'s| is)[^:\n]{0,60})\s*:\s*/i, '');
    // a script line ("Mia: Hi!") means the model started the conversation itself: the narration stops there
    const names = [me, ...people].map(n => n.split(/\s+/)[0]).filter(Boolean).map(escRe);
    if (names.length) {
        const m = t.search(new RegExp(`(?:^|\\n)\\s*(?:\\*\\*)?(?:${names.join('|')})[^\\n:]{0,30}(?:\\*\\*)?\\s*:`, 'i'));
        if (m === 0)
            return '';
        if (m > 0)
            t = t.slice(0, m);
    }
    t = t.replace(/^\*+|\*+$/g, '').replace(/\n{2,}/g, '\n').trim();
    if (t.length > max) {
        const cut = t.slice(0, max);
        const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf('.\n'));
        t = end > max * 0.4 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '');
    }
    return /[\p{L}\p{N}]/u.test(t) ? t : '';
}
// For the characters (the scene rules): the narrator's lines are not theirs to repeat.
export const NARRATOR_RULE = 'Lines from the narrator describe the place and what just happened. The characters do not repeat or redo them: they pick up from there, speaking and acting only as themselves.';
