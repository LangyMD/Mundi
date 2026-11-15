import { onAction } from './hooks.js';
import { PLAYER, activeTraits, addTrait, traitDef, isCareer } from './persontraits.js';
/** The names of the traits you have gained (lowercase), as the modifiers table knows them. */
export function gainedNames(g, w) {
    return activeTraits(g, PLAYER).filter(id => !isCareer(id)).map(id => traitDef(g, w, id).name.toLowerCase());
}
// A gained trait as the people's own needs know it (the same words as the traits read from a card).
const AS_NPC = { 'social-butterfly': 'outgoing', loner: 'shy', 'party-animal': 'party', athletic: 'athletic', bookworm: 'bookish', foodie: 'foodie', homebody: 'homebody', outdoorsy: 'outdoorsy' };
/** What someone's gained traits add to the traits read from their card. */
export const gainedNpcTraits = (g, avatar) => [...new Set(activeTraits(g, avatar).map(id => AS_NPC[id]).filter(Boolean))];
// How a trait leans someone toward or away from being close (added to how sure of you they are).
const LEAN = { affectionate: 10, glowing: 5, reserved: -10, heartbroken: -15 };
// Unwell or worn out: not for more than a hug.
const NOT_NOW = { sick: -12, hurt: -8, exhausted: -10 };
/** `kind`: hug, cuddle, kiss, love. Returns the change and, when it holds them back, why. */
export function closeLean(g, w, avatar, kind) {
    let delta = 0, worst = 0, why = '';
    for (const id of activeTraits(g, avatar)) {
        const v = (LEAN[id] ?? 0) + (kind === 'hug' ? 0 : NOT_NOW[id] ?? 0);
        delta += v;
        if (v < worst) {
            worst = v;
            why = traitDef(g, w, id).name.toLowerCase();
        }
    }
    return { delta: Math.max(-25, Math.min(15, delta)), why };
}
const closeOf = (id) => { const m = /^close:(hug|cuddle|kiss|love):(.+)$/.exec(id); return m ? { kind: m[1], avatar: m[2] } : null; };
/** The person a "being close" action is with ('' for any other action). */
export const closeWith = (id) => closeOf(id)?.avatar ?? '';
// Welcomed, and more than a hug: both of you are glowing until tomorrow.
onAction.push((g, w, a) => {
    const c = closeOf(a.id);
    if (!c || c.kind === 'hug' || !g.cast[c.avatar])
        return;
    addTrait(g, w, c.avatar, 'glowing', { source: 'event', days: 1 });
    addTrait(g, w, PLAYER, 'glowing', { source: 'event', days: 1 });
});
