// What a line you wrote means for the game, read by plain rules (no AI):
//  - an ACTION Mundi has a button for ("I take a quick shower" → the Take a shower action here);
//  - a REQUEST to someone ("could you lend me some money?"), and how much it asks of them.
// Only your own doing, now, counts: not a question, not a plan for later, not something said out loud, and not
// something another person does. When in doubt there is no match (a missed match costs nothing; a wrong one would
// move the clock).
import type { Save, Resident } from '../core/store.js';
import type { WorldDef } from '../core/world.js';
import { bondOf, isPartner } from './social.js';
import { approvalOf } from './living.js';
import { friendTier } from './romance.js';
import { isWorking, isSleeping } from './plans.js';
import { nowAbs } from '../core/store.js';

/* ---------- words ---------- */

const IRREGULAR: Record<string, string> = {
    took: 'take', taken: 'take', ate: 'eat', eaten: 'eat', drank: 'drink', drunk: 'drink', made: 'make', went: 'go', gone: 'go', ran: 'run', swam: 'swim',
    had: 'have', has: 'have', did: 'do', does: 'do', done: 'do', sat: 'sit', read: 'read', wrote: 'write', written: 'write', saw: 'see', seen: 'see', got: 'get',
    bought: 'buy', paid: 'pay', slept: 'sleep', brushed: 'brush', washed: 'wash', teeth: 'tooth', groceries: 'grocery', dishes: 'dish',
};
// a word without its ending: takes, taking, cooked → take, cook (rough, but the same on both sides of a match)
export function stem(word: string): string {
    const w = word.toLowerCase();
    if (IRREGULAR[w]) return IRREGULAR[w];
    if (w.length > 5 && w.endsWith('ing')) { const b = w.slice(0, -3); return b.length > 2 && b[b.length - 1] === b[b.length - 2] ? b.slice(0, -1) : b; }   // running → run
    if (w.length > 4 && w.endsWith('ied')) return `${w.slice(0, -3)}y`;
    if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
    if (w.length > 4 && w.endsWith('ed')) { const b = w.slice(0, -2); return b.length > 2 && b[b.length - 1] === b[b.length - 2] ? b.slice(0, -1) : b; }      // grabbed → grab
    if (w.length > 4 && /(ch|sh|ss|x|z)es$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
    return w;
}
// "bake" and "baking" both come out as "bak"/"bake": compare without a final e
const same = (a: string, b: string) => a === b || a.replace(/e$/, '') === b.replace(/e$/, '');
const STOP = new Set(['a', 'an', 'the', 'to', 'at', 'in', 'on', 'of', 'for', 'some', 'something', 'your', 'my', 'up', 'with', 'by', 'and', 'out', 'off', 'into', 'it']);
// verbs that carry little by themselves: "take a shower" is about the shower
const LIGHT = new Set(['take', 'have', 'go', 'do', 'get', 'grab', 'make', 'play', 'watch', 'be']);
const words = (t: string) => (t.toLowerCase().match(/[a-z']+/g) ?? []).map(x => x.replace(/^'+|'+$/g, '')).filter(Boolean);
const keys = (label: string) => words(label.replace(/\([^)]*\)/g, ' ').replace(/:.*/, ' ')).filter(x => !STOP.has(x)).map(stem);

/* ---------- which part of a line is your own doing, now ---------- */

// What is said out loud is talk, not doing: quoted text is taken out.
export const outsideQuotes = (t: string) => t.replace(/"[^"]*"|“[^”]*”|«[^»]*»/g, ' . ');
const clauses = (t: string) => t.replace(/[*_]/g, ' ').split(/[.!?;\n]+|,\s*(?:and|then|but)\s+|\s+(?:and then|then|but)\s+/i).map(x => x.trim()).filter(Boolean);
// later, maybe, should, if… : not now
const HEDGE = /\b(later|tomorrow|tonight|soon|someday|eventually|next (?:time|week)|after (?:work|this|that|dinner|lunch)|should|shouldn't|could|couldn't|would|wouldn't|might|maybe|perhaps|if|whether|wish|need to|needs to|have to|has to|ought|plan to|plans to|planning|thinking (?:about|of)|think about|consider|considering|wonder|wondering|want to|wants to|wanted to|about to|going to|gonna|will|won't|i'll|let's|shall|used to|remember|imagine|dream)\b/i;
const NEGATED = /\b(not|don't|dont|doesn't|didn't|never|no|without|instead of|rather than|can't|cannot|refuse|skip|skipped|stop|stopped|finish|finished|already|just (?:had|took|ate|finished))\b/i;
const OTHERS = /\b(you|he|she|they|we|everyone|someone|somebody|anyone|nobody)\b/i;

export interface ActionLike { id: string; label: string; name?: string; minutes?: number }
export interface ActionHit { id: string; sure: boolean }
// Does this clause say you are doing this action now? `sure`: every key word of its label is there, in order.
function clauseHit(clause: string, a: ActionLike, names: string[]): boolean | null {
    const k = keys(a.label); if (!k.length) return null;
    const ws = words(clause); const st = ws.map(stem);
    // the label's words, in order, close together (up to three other words between two of them)
    let at = -1, first = -1;
    for (const key of k) {
        let hit = -1;
        for (let i = at + 1; i < st.length && (at < 0 || i <= at + 4); i++) if (same(st[i], key)) { hit = i; break; }
        if (hit < 0) { first = -1; break; }
        if (first < 0) first = hit;
        at = hit;
    }
    let sure = first >= 0;
    if (first < 0) {
        // "I shower", "*showers*": the label's own thing used as the verb, when the label's verb is a light one
        if (k.length !== 2 || !LIGHT.has(k[0])) return null;
        const i = st.findIndex(x => same(x, k[1]));
        if (i < 0) return null;
        const before = ws.slice(0, i).filter(x => !['i', 'quickly', 'then', 'just', 'finally', 'slowly', 'quietly'].includes(x));
        if (before.length) return null;                // only as the clause's own verb
        if (ws.length - i > 6) return null;
        first = i; sure = false;
    }
    const lead = ws.slice(0, first).join(' ');
    if (OTHERS.test(lead) || names.some(n => n && new RegExp(`\\b${n.toLowerCase().replace(/[^a-z]/g, '')}\\b`).test(lead))) return null;   // someone else does it
    if (HEDGE.test(clause) || NEGATED.test(lead)) return null;
    return sure;
}
// The action a line starts, among those possible here (null: none, or more than one fits equally well).
export function findAction(text: string, actions: ActionLike[], names: string[] = []): ActionHit | null {
    const body = outsideQuotes(text);
    if (/\?\s*$/.test(body.trim())) return null;
    const hits: ActionHit[] = [];
    for (const c of clauses(body)) {
        if (/\[[^\]]*\]/.test(c)) continue;             // a story direction is not your doing
        for (const a of actions) {
            const r = clauseHit(c, a, names.map(n => n.split(/\s+/)[0]));
            if (r === null) continue;
            const had = hits.find(h => h.id === a.id);
            if (had) had.sure ||= r; else hits.push({ id: a.id, sure: r });
        }
    }
    if (!hits.length) return null;
    // the longest label wins ("make coffee" over "have a coffee" only when it is the one written)
    const sure = hits.filter(h => h.sure);
    const pool = sure.length ? sure : hits;
    if (pool.length === 1) return pool[0];
    const len = (h: ActionHit) => keys(actions.find(a => a.id === h.id)!.label).length;
    const top = Math.max(...pool.map(len)); const best = pool.filter(h => len(h) === top);
    return best.length === 1 ? best[0] : null;
}

/* ---------- asking something of someone ---------- */

export type Ask = 'small' | 'medium' | 'big';
const REQUEST = /\b(can|could|would|will|won't|may|might|mind if|do you mind|would you mind)\s+(you|i|we)\b|\bplease\b|\b(i need you to|i want you to|you have to|you need to|you must|you should|you will|you're going to|do me a favou?r|do it for me|let me|give me|lend me|show me|tell me|come with me|come here|come over|stay with me|help me|follow me|trust me)\b/i;
const BIG = /\b(money|cash|lend|loan|borrow|pay (?:for|my)|rent|quit|resign|move in|marry|lie for|cover for|steal|break the law|secret|password|keys? to|stay the night|sleep (?:with|over)|spend the night|kiss|undress|strip|naked|take (?:off|it off)|get (?:in|into) bed|leave (?:him|her|them)|break up|skip work|call in sick|your (?:car|house|apartment|savings)|forgive)\b/i;
const MEDIUM = /\b(come with me|come over|come home|go out with|follow me|help me|drive me|pick me up|a favou?r|wait for me|stay with me|stay (?:a little|a bit)? ?longer|tell me about|introduce me|cancel|change your plans|do it for me|cook for|a ride|your (?:phone|number)|dance with|sit with)\b/i;
const ORDER = /\b(i need you to|i want you to|you have to|you need to|you must|you will|you're going to|do as i say|now\b[^.?!]*!|that's an order|i order you|i command|obey)\b/i;
export interface RequestHit { size: Ask; order: boolean; target: string /* a first name written in the line, or '' */ }
// Is the line asking (or telling) someone to do something? And how much is it asking.
export function findRequest(text: string, names: string[] = []): RequestHit | null {
    const t = text.replace(/[*_]/g, ' ');
    if (/^\s*\[/.test(t)) return null;                 // a story direction decides by itself
    if (!REQUEST.test(t) && !ORDER.test(t)) return null;
    const low = t.toLowerCase();
    const target = names.map(n => n.split(/\s+/)[0]).find(n => n && new RegExp(`\\b${n.toLowerCase().replace(/[^a-z]/g, '')}\\b`).test(low)) ?? '';
    return { size: BIG.test(t) ? 'big' : MEDIUM.test(t) ? 'medium' : 'small', order: ORDER.test(t), target };
}

/* ---------- how willing they are (the engine's numbers, told to the AI) ---------- */

const NEED: Record<Ask, number> = { small: 5, medium: 30, big: 60 };
export interface Willing { score: number; need: number; lean: 'yes' | 'likely' | 'unsure' | 'no'; why: string[] }
// From what the save knows: the bond, what they think of how you behave, whether you are a couple, and whether
// they are busy. No dice: the same situation gives the same answer.
export function willingness(g: Save, w: WorldDef, r: Resident, ask: RequestHit): Willing {
    const b = bondOf(g, r.avatar), a = approvalOf(g, r.avatar), now = nowAbs(g);
    const why: string[] = [];
    let score = b + a * 0.3;
    if (isPartner(g, r.avatar)) { score += 20; why.push('they are a couple'); }
    if (!r.met) { score -= 15; why.push(`${r.name} has only just met {{user}}`); }
    if (a <= -15) why.push(`${r.name} disapproves of how {{user}} behaves`);
    if (isWorking(w, r, now)) { score -= 15; why.push(`${r.name} is at work right now`); }
    if (isSleeping(r, now)) { score -= 10; why.push('it is very late'); }
    if (ask.order) { score -= 10; why.push('it was put as an order, which people resent'); }
    const need = NEED[ask.size];
    const lean = score >= need + 20 ? 'yes' : score >= need ? 'likely' : score >= need - 15 ? 'unsure' : 'no';
    return { score: Math.round(score), need, lean, why };
}
const LEAN: Record<Willing['lean'], string> = {
    yes: 'would gladly agree',
    likely: 'would probably agree, perhaps with a condition or a little teasing',
    unsure: 'is reluctant: it could go either way, and they may ask why, bargain, or put it off',
    no: 'would most likely refuse, change the subject, or be put off by being asked',
};
const SIZE: Record<Ask, string> = { small: 'a small thing', medium: 'a real favor', big: 'a lot' };
// For the next reply only: where they stand, and what that makes likely. The personality decides within it.
export function willingLine(g: Save, w: WorldDef, r: Resident, ask: RequestHit): string {
    const v = willingness(g, w, r, ask);
    const tier = friendTier(bondOf(g, r.avatar)).name.toLowerCase();
    return `[{{user}} is ${ask.order ? 'telling' : 'asking'} ${r.name} to do something, and it asks ${SIZE[ask.size]} of ${r.name}. Where they stand: ${tier}${v.why.length ? `; ${v.why.join('; ')}` : ''}. Realistically ${r.name} ${LEAN[v.lean]}. ` +
        `${r.name} is their own person, not {{user}}'s to command: let ${r.name}'s personality and mood decide within that, and do not make ${r.name} agree just to please.]`;
}
// Who a request is for: the one named in the line, the one you are talking with alone, or the only one here.
export function requestTarget(present: Resident[], ask: RequestHit, solo = ''): Resident | null {
    if (ask.target) { const n = ask.target.toLowerCase(); const hit = present.find(r => r.name.toLowerCase().split(/\s+/)[0] === n); if (hit) return hit; }
    return present.find(r => r.avatar === solo) ?? (present.length === 1 ? present[0] : null);
}

/* ---------- who came and went while something took time ---------- */

const listed = (n: string[]) => (n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`);
// For the AI, after an action that took a while: who walked in and who left meanwhile ('' when nobody did).
export function cameAndWent(before: string[], after: string[]): string {
    const came = after.filter(n => !before.includes(n)), went = before.filter(n => !after.includes(n));
    if (!came.length && !went.length) return '';
    return [came.length ? `While that was going on, ${listed(came)} came in and ${came.length > 1 ? 'are' : 'is'} here now: the narration shows ${came.length > 1 ? 'them' : 'that'} arriving.` : '',
        went.length ? `${came.length ? 'And ' : 'While that was going on, '}${listed(went)} left and ${went.length > 1 ? 'are' : 'is'} no longer here.` : ''].filter(Boolean).join(' ');
}
