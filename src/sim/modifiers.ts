// Who you are changes how your needs and relationships move: an outgoing person misses company sooner, a calm one
// keeps their mood longer, a good cook gets more out of a home meal. A table of plain rules (a trait, a habit that
// became a trait, or a hobby level → × how fast something drops, × what fills it); the world can bring its own
// (`modifiers`), otherwise this one applies. No AI involved: the engine multiplies, the AI only sees the numbers.
import type { Save } from '../core/store.js';
import { activeStatuses, systemOn, type WorldDef, type ModifierDef } from '../core/world.js';
import { levelOf } from './hobbies.js';
import { gainedNames } from './needtraits.js';

export const DEFAULT_MODIFIERS: ModifierDef[] = [
    // company and friendships
    { trait: 'Outgoing', target: 'social', decay: 1.25 }, { trait: 'Outgoing', target: 'bond', gain: 1.2 },
    { trait: 'Shy', target: 'social', decay: 0.75 }, { trait: 'Shy', target: 'bond', gain: 0.85 },
    { trait: 'Charming', target: 'bond', gain: 1.25 },
    { trait: 'Kind', target: 'bond', gain: 1.15 }, { trait: 'Kind', target: 'bond', decay: 0.75 },
    { trait: 'Sarcastic', target: 'bond', gain: 0.9 },
    { trait: 'Nightlife', target: 'social', gain: 1.2 },
    { trait: 'Romantic', target: 'romance', gain: 1.25 }, { trait: 'Romantic', target: 'intimacy', decay: 1.25 }, { trait: 'Romantic', target: 'intimacy', gain: 1.2 },
    { trait: 'Shy', target: 'intimacy', decay: 0.8 }, { trait: 'Serious', target: 'intimacy', decay: 0.85 },
    // traits gained in a game (sim/persontraits.ts): company and closeness
    { trait: 'Social butterfly', target: 'social', decay: 1.25 }, { trait: 'Social butterfly', target: 'social', gain: 1.2 }, { trait: 'Social butterfly', target: 'bond', gain: 1.1 },
    { trait: 'Loner', target: 'social', decay: 0.7 }, { trait: 'Loner', target: 'bond', gain: 0.9 },
    { trait: 'Homebody', target: 'social', decay: 0.85 }, { trait: 'Party animal', target: 'social', gain: 1.15 },
    { trait: 'Affectionate', target: 'intimacy', decay: 1.2 }, { trait: 'Affectionate', target: 'intimacy', gain: 1.2 }, { trait: 'Affectionate', target: 'romance', gain: 1.1 },
    { trait: 'Reserved', target: 'intimacy', decay: 0.75 }, { trait: 'Reserved', target: 'intimacy', gain: 0.9 },
    { trait: 'Glowing', target: 'mood', decay: 0.8 }, { trait: 'Glowing', target: 'intimacy', decay: 0.8 },
    { trait: 'Heartbroken', target: 'mood', decay: 1.2 }, { trait: 'Heartbroken', target: 'intimacy', gain: 0.8 },
    // mood
    { trait: 'Cheerful', target: 'mood', decay: 0.75 }, { trait: 'Calm', target: 'mood', decay: 0.85 }, { trait: 'Devout', target: 'mood', decay: 0.9 },
    { trait: 'Hot-headed', target: 'mood', decay: 1.25 }, { trait: 'Heavy drinker', target: 'mood', decay: 1.1 },
    // body
    { trait: 'Athletic', target: 'energy', decay: 0.85 }, { trait: 'Strong', target: 'energy', decay: 0.9 }, { trait: 'Quick', target: 'energy', decay: 0.9 },
    { trait: 'Lazy', target: 'energy', decay: 1.15 },
    { trait: 'Coffee addict', target: 'energy', decay: 1.1 }, { trait: 'Coffee addict', target: 'energy', gain: 1.25, actions: ['coffee', 'x-coffee'] },
    { trait: 'Tidy', target: 'hygiene', decay: 0.8 },
    { trait: 'Good cook', target: 'hunger', gain: 1.25, actions: ['cook'] },
    // what you love doing lifts your mood more
    { trait: 'Books', target: 'mood', gain: 1.5, actions: ['x-readbook', 'x-read', 'read'] }, { trait: 'Reading', target: 'mood', gain: 1.5, actions: ['x-readbook', 'x-read', 'read'] },
    { trait: 'Movies', target: 'mood', gain: 1.5, actions: ['cinema', 'x-tv'] }, { trait: 'Games', target: 'mood', gain: 1.5, actions: ['x-games'] },
    { trait: 'Sports', target: 'mood', gain: 1.5, actions: ['x-workout', 'x-run', 'x-treadmill', 'x-swim'] },
    { trait: 'Music', target: 'mood', gain: 1.5, actions: ['x-guitar', 'busk', 'lute'] }, { trait: 'Art', target: 'mood', gain: 1.5, actions: ['x-paint'] },
    { trait: 'Nature', target: 'mood', gain: 1.5, actions: ['relax', 'walk', 'x-plants', 'herbs'] }, { trait: 'Fashion', target: 'mood', gain: 1.5, actions: ['x-browse'] },
    { trait: 'Nightlife', target: 'mood', gain: 1.5, actions: ['x-drinks', 'out-night'] },
    // practice pays off
    { hobby: 'fitness', level: 4, target: 'energy', decay: 0.9 }, { hobby: 'fitness', level: 8, target: 'energy', decay: 0.9 },
    { hobby: 'cooking', level: 4, target: 'hunger', gain: 1.15, actions: ['cook'] }, { hobby: 'cooking', level: 8, target: 'hunger', gain: 1.15, actions: ['cook'] },
];

const LIMIT = (v: number) => Math.max(0.5, Math.min(2, v));
export const modifiersOf = (w: WorldDef): ModifierDef[] => w.modifiers ?? DEFAULT_MODIFIERS;
// every trait the player has: chosen, learned in a course, earned with a goal, grown from a habit
const traitsOf = (g: Save) => new Set(Object.values((g.player?.traits ?? {}) as Record<string, string[]>).flat().map(t => String(t).toLowerCase()));
/** The rules that apply to this player right now. */
export function activeModifiers(g: Save, w: WorldDef): ModifierDef[] {
    const have = traitsOf(g); const hobbies = systemOn(w, 'hobbies');
    for (const n of gainedNames(g, w)) have.add(n);   // (and the ones gained in this game)
    return modifiersOf(w).filter(m => (m.trait || m.hobby) && (!m.trait || have.has(m.trait.toLowerCase())) && (!m.hobby || (hobbies && levelOf(g, m.hobby) >= (m.level ?? 1))));
}
/** × how fast `target` (a need, 'bond') drops by itself. */
export const decayMult = (g: Save, w: WorldDef, target: string) => LIMIT(activeModifiers(g, w).filter(m => m.target === target && m.decay !== undefined).reduce((x, m) => x * m.decay!, 1));
/** × what fills `target` (a need, 'bond', 'romance'); `action`: the action it comes from, when there is one. */
export const gainMult = (g: Save, w: WorldDef, target: string, action?: string) => LIMIT(activeModifiers(g, w)
    .filter(m => m.target === target && m.gain !== undefined && (!m.actions?.length || (!!action && m.actions.includes(action)))).reduce((x, m) => x * m.gain!, 1));

// For the player (This world → Rules / Needs): what their traits are doing, in words. Only what is in play here.
const pct = (x: number) => `${Math.round(Math.abs(x - 1) * 100)}%`;
export function modifierLines(g: Save, w: WorldDef): string[] {
    const st = new Map(activeStatuses(w, g).map(s => [s.id, s.name.toLowerCase()]));
    const actName = (id: string) => w.actions.find(a => a.id === id)?.label.toLowerCase();
    const out: string[] = [];
    for (const m of activeModifiers(g, w)) {
        const what = m.target === 'bond' ? (systemOn(w, 'social') ? 'friendships' : '') : m.target === 'romance' ? (systemOn(w, 'romance') ? 'romance' : '') : st.get(m.target) ?? '';
        if (!what) continue;
        const who = m.trait ?? `${w.hobbies?.find(h => h.id === m.hobby)?.name ?? m.hobby} (level ${m.level ?? 1}+)`;
        const from = (m.actions ?? []).map(actName).filter(Boolean);
        if (m.actions?.length && !from.length) continue;   // none of its actions exist in this world
        const rel = m.target === 'bond' || m.target === 'romance';
        if (m.decay !== undefined && m.decay !== 1) out.push(`${who}: ${what} ${rel ? 'fade' : 'drops'} ${pct(m.decay)} ${m.decay < 1 ? 'slower' : 'faster'}.`);
        if (m.gain !== undefined && m.gain !== 1) out.push(`${who}: ${what} ${rel ? 'grow' : 'fills'} ${pct(m.gain)} ${m.gain > 1 ? 'more' : 'less'}${from.length ? ` from: ${from.join(', ')}` : ''}.`);
    }
    return out;
}
