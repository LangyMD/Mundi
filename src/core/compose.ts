// How a line you write becomes the line that is sent. Pure text, no interface: the scene's message box uses it.
// The modes: Say (your words, in quotes), Do (an action, in asterisks), Story (a direction for the story),
// See (look at something), and Free (sent exactly as you wrote it: mix speech and action as you like).
export type InputMode = 'say' | 'do' | 'story' | 'see' | 'free';
// The message box (Settings › Game): 'buttons' the four buttons, as always; 'both' the buttons plus Free (chosen
// when a scene opens); 'free' no buttons at all, everything is free text.
export type InputStyle = 'buttons' | 'both' | 'free';
export const inputStyleOf = (v: unknown): InputStyle => (v === 'both' || v === 'free' ? v : 'buttons');
// The modes a message box shows (none: free text only).
export const modesFor = (style: InputStyle): InputMode[] => (style === 'free' ? [] : style === 'both' ? ['free', 'say', 'do', 'story', 'see'] : ['say', 'do', 'story', 'see']);
// The mode in use: without buttons it is always Free; one the box does not show falls back to its first.
export function modeFor(style: InputStyle, picked: InputMode | ''): InputMode {
    const list = modesFor(style);
    if (!list.length) return 'free';
    return picked && list.includes(picked) ? picked : list[0];
}

const story = (t: string) => `[Story direction: ${t}]`;
const see = (t: string) => `*looks at ${t.replace(/^(at|the)\s+/i, (m) => m.toLowerCase() === 'at ' ? '' : m)}* [Describe what {{user}} sees.]`;
// Free text keeps two shortcuts, so Story and See are never lost with the buttons hidden:
// a line that starts with ">" is a story direction, one that starts with "?" is a look.
export function shape(mode: InputMode, text: string): string {
    const t = text.trim();
    if (!t) return '';
    switch (mode) {
        case 'do': return /^\*.*\*$/s.test(t) ? t : `*${t.replace(/^\*|\*$/g, '')}*`;
        case 'story': return story(t);
        case 'see': return see(t);
        case 'free': {
            const rest = t.slice(1).trim();
            if (t[0] === '>' && rest) return story(rest);
            if (t[0] === '?' && rest) return see(rest);
            return t;
        }
        default: return /^["“*]/.test(t) ? t : `"${t}"`;
    }
}
