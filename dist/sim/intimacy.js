// The intimacy need (optional, off unless a game turns it on): closeness with someone, from a hug to making love.
// The engine offers what is possible with who is here (how close you are decides), decides whether they want it
// (their own numbers: romance, bond, what they think of you; never just because you asked), applies the result, and
// tells the AI what happened. No AI call: the AI only narrates the answer the engine gave.
// Never with a child or a blood relative (family.ts), beyond a hug. Making love needs privacy; and by default the AI
// is told to cut away rather than describe it (This world → World → Needs).
import { nowAbs, cfg } from '../core/store.js';
import { activeStatuses, isScenario, systemOn } from '../core/world.js';
import { presentAt } from './people.js';
import { bondOf, isPartner, bump } from './social.js';
import { romOf, romValue, addRomance } from './romance.js';
import { approvalOf, approve } from './living.js';
import { romanceBlocked } from './family.js';
import { isWorking } from './plans.js';
import { onAction } from './hooks.js';
import { note } from './facts.js';
import { playerHomeId } from './places.js';
export const CLOSE = {
    hug: { label: n => `Hug ${n}`, icon: '🤗', minutes: 2, effects: { intimacy: 8, mood: 2 }, need: 25, bond: 30, yes: { bond: 1 }, no: {}, family: true },
    cuddle: { label: n => `Cuddle with ${n}`, icon: '💞', minutes: 30, effects: { intimacy: 20, mood: 5 }, need: 45, romance: 25, yes: { bond: 1, romance: 1 }, no: { romance: -1 } },
    kiss: { label: n => `Kiss ${n}`, icon: '💋', minutes: 2, effects: { intimacy: 15, mood: 4 }, need: 50, romance: 40, yes: { romance: 2 }, no: { romance: -3, approval: -2 } },
    love: { label: n => `Make love with ${n}`, icon: '💗', minutes: 60, effects: { intimacy: 60, mood: 10, energy: -10, hygiene: -15 }, need: 65, romance: 60, yes: { bond: 2, romance: 3 }, no: { romance: -4, approval: -3 }, private: true },
};
const SOLO = { id: 'close:solo', name: 'Time alone', label: 'Take some private time for yourself', icon: '🌙', cost: 0, minutes: 20, effects: { intimacy: 30 } };
const ORDER = ['hug', 'cuddle', 'kiss', 'love'];
export const intimacyOn = (g, w) => activeStatuses(w, g).some(s => s.id === 'intimacy');
export const isClose = (a) => a.id.startsWith('close:');
const parse = (id) => { const m = /^close:(hug|cuddle|kiss|love|solo)(?::(.+))?$/.exec(id); return m ? { kind: m[1], avatar: m[2] ?? '' } : null; };
const closeState = (g) => (g.close ??= { no: {} });
// somewhere private: a home (or a room of the house), with nobody else around
const atHome = (g, w) => isScenario(w) || g.player.loc === playerHomeId || g.player.loc.startsWith('home:');
const score = (g, avatar) => romValue(g, avatar) * 0.6 + bondOf(g, avatar) * 0.4 + approvalOf(g, avatar) * 0.2 + (isPartner(g, avatar) ? 15 : 0);
/** Can this be offered with this person at all (how close you are; family only for a hug; privacy)? */
export function closePossible(g, w, r, kind, alone) {
    const d = CLOSE[kind];
    if (!r.met)
        return false;
    if (!d.family && (romanceBlocked(g, r.avatar) || !systemOn(w, 'romance')))
        return false;
    if (d.private && !(alone && atHome(g, w)))
        return false;
    if (closeState(g).no[`${kind}:${r.avatar}`] === g.day)
        return false; // turned down today: not again today
    const partner = romOf(g, r.avatar).status !== 'none';
    return partner || (d.bond !== undefined && bondOf(g, r.avatar) >= d.bond) || (d.romance !== undefined && romValue(g, r.avatar) >= d.romance);
}
/** What can be done to be close, here and now (empty when this game has no intimacy need). */
export function closeActions(g, w) {
    if (!intimacyOn(g, w))
        return [];
    const here = presentAt(g, w, g.player.loc);
    const out = [];
    // the three people you are closest to, so the list stays short in a crowd
    const near = here.filter(r => r.met).sort((a, b) => score(g, b.avatar) - score(g, a.avatar)).slice(0, 3);
    for (const r of near)
        for (const k of ORDER)
            if (closePossible(g, w, r, k, here.length === 1)) {
                const d = CLOSE[k];
                const first = r.name.split(/\s+/)[0];
                out.push({ id: `close:${k}:${r.avatar}`, name: d.label(first), label: d.label(first), icon: d.icon, cost: 0, minutes: d.minutes, effects: { ...d.effects } });
            }
    if (!here.length && atHome(g, w))
        out.push({ ...SOLO, effects: { ...SOLO.effects } });
    return out;
}
// The same person, act and day give the same answer when it could go either way.
function coin(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
} return ((h >>> 0) % 1000) / 1000; }
/** Decides whether they welcome it, and applies what a refusal costs. Null for an action that is not one of these.
 *  When welcomed, the action then runs as any other (its time and effects), and `onAction` below does the rest. */
export function closeOutcome(g, w, a) {
    const p = parse(a.id);
    if (!p)
        return null;
    const fade = cfg(g).fade !== false;
    if (p.kind === 'solo')
        return { ok: true, toast: '', hint: `[{{user}} took some private time alone. ${fade ? 'Do not describe it; pick the story up afterwards.' : 'Narrate it only as far as the tone of this story allows.'}]` };
    const r = g.cast[p.avatar];
    if (!r)
        return null;
    const d = CLOSE[p.kind];
    const s = score(g, r.avatar);
    const l = d.label(r.name);
    const what = l.charAt(0).toLowerCase() + l.slice(1);
    const busy = p.kind !== 'hug' && isWorking(w, r, nowAbs(g));
    const sure = s >= d.need + 10, never = s < d.need - 10 || busy;
    const ok = !never && (sure || coin(`${g.world}|${r.avatar}|${p.kind}|${g.day}`) < (s - (d.need - 10)) / 20);
    if (ok) {
        const how = sure ? `${r.name} wanted it too` : `${r.name} hesitated for a moment, then welcomed it`;
        const tell = p.kind === 'love' ? (fade ? `Do not describe it: say only that it happened, cut away, and pick the story up afterwards.` : `Narrate it as far as the tone of this story allows, with ${r.name} as a willing partner with wishes of their own.`) : `Narrate it in the scene, with ${r.name}'s own reaction.`;
        return { ok, toast: '', hint: `[Just now {{user}} chose to ${what}, and ${how}. ${tell}]` };
    }
    // turned down: it costs a little, they remember being asked, and it is not offered again today
    closeState(g).no[`${p.kind}:${r.avatar}`] = g.day;
    for (const k of Object.keys(closeState(g).no))
        if (closeState(g).no[k] < g.day)
            delete closeState(g).no[k];
    if (d.no.romance)
        addRomance(g, r.avatar, d.no.romance);
    if (d.no.approval)
        approve(g, r.avatar, d.no.approval);
    const why = busy ? `${r.name} is at work` : s < d.need - 10 ? `they are not that close (yet)` : `${r.name} is not in the mood right now`;
    return { ok, toast: `${r.name} turned it down.`, hint: `[Just now {{user}} tried to ${what}. ${r.name} did not want that: ${why}. ${r.name} turns it down, in their own way (gently, awkwardly or firmly, as their personality decides), and does not give in if asked again. Narrate ${r.name}'s reaction.]` };
}
// Welcomed: the two of you grow closer, and it is remembered.
onAction.push((g, _w, a) => {
    const p = parse(a.id);
    if (!p || p.kind === 'solo')
        return;
    const r = g.cast[p.avatar];
    if (!r)
        return;
    const d = CLOSE[p.kind];
    if (d.yes.bond)
        bump(g, r.avatar, d.yes.bond);
    if (d.yes.romance && !romanceBlocked(g, r.avatar))
        addRomance(g, r.avatar, d.yes.romance);
    if (p.kind === 'kiss')
        note(g, '{u} and {0} kissed.', [r.name], [r.avatar], g.player.loc, 'meet'); // (what happens in private is not written down: facts travel as rumors)
});
