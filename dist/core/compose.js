export const inputStyleOf = (v) => (v === 'both' || v === 'free' ? v : 'buttons');
// The modes a message box shows (none: free text only).
export const modesFor = (style) => (style === 'free' ? [] : style === 'both' ? ['free', 'say', 'do', 'story', 'see'] : ['say', 'do', 'story', 'see']);
// The mode in use: without buttons it is always Free; one the box does not show falls back to its first.
export function modeFor(style, picked) {
    const list = modesFor(style);
    if (!list.length)
        return 'free';
    return picked && list.includes(picked) ? picked : list[0];
}
const story = (t) => `[Story direction: ${t}]`;
const see = (t) => `*looks at ${t.replace(/^(at|the)\s+/i, (m) => m.toLowerCase() === 'at ' ? '' : m)}* [Describe what {{user}} sees.]`;
// Free text keeps two shortcuts, so Story and See are never lost with the buttons hidden:
// a line that starts with ">" is a story direction, one that starts with "?" is a look.
export function shape(mode, text) {
    const t = text.trim();
    if (!t)
        return '';
    switch (mode) {
        case 'do': return /^\*.*\*$/s.test(t) ? t : `*${t.replace(/^\*|\*$/g, '')}*`;
        case 'story': return story(t);
        case 'see': return see(t);
        case 'free': {
            const rest = t.slice(1).trim();
            if (t[0] === '>' && rest)
                return story(rest);
            if (t[0] === '?' && rest)
                return see(rest);
            return t;
        }
        default: return /^["“*]/.test(t) ? t : `"${t}"`;
    }
}
