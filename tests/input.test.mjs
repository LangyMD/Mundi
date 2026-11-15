// What a written line means for the game (sim/intent.ts), Expand (sim/expand.ts) and the line that says the player's
// character is one of the people (sim/prompt.ts). Run: node tests/input.test.mjs [repo root]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stage, browser, seed, world } from './env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ?? path.join(here, '..');
const ext = stage(root, 'input');
const meta = {}; browser(meta);
const D = (p) => import(`${ext}/dist/${p}`);
const store = await D('core/store.js'); const W = await D('core/world.js');
const I = await D('sim/intent.js'); const X = await D('sim/expand.js'); const P = await D('sim/prompt.js');
const So = await D('sim/social.js'); const L = await D('sim/living.js'); const Pe = await D('sim/people.js');
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('  FAIL', m); } };

/* ---------- actions written in your own words ---------- */
const house = world(ext, 'house');
const A = house.actions.map(a => ({ id: a.id, label: a.label }));
const act = (t) => I.findAction(t, A, ['Mia Chen'])?.id ?? null;
const does = { shower: ['I take a quick shower', '*takes a shower*', 'I shower.', '*showers*', 'I took a long hot shower'], 'x-coffee': ['I make coffee and sit down.', 'I start making coffee'],
    snack: ['"Morning." I grab a snack from the counter.'], 'x-tv': ['I watch TV for a while'], 'x-run': ['I go for a run'], 'x-teeth': ['I brush my teeth'], cook: ['I cook at home.'],
    'x-porch': ['*sits on the porch*'], 'x-plants': ['I water the plants'], 'x-games': ['I played video games'], 'x-swim': ['I swim in the pool'] };
for (const [id, lines] of Object.entries(does)) for (const t of lines) ok(act(t) === id, `"${t}" starts ${id} (got ${act(t)})`);
const not = ['Did you take a shower?', 'I should take a shower later', '"I am going to take a shower"', 'You take a shower', 'Mia takes a shower', "I don't want to cook", 'I might watch TV',
    'I love coffee', 'I think about making coffee', 'She showers', 'I tell her about the shower', 'We could watch TV', '[Story direction: I take a shower]', 'I already took a shower',
    'Shall we eat a meal?', 'I look at the TV', 'I will take a shower', "I'll make coffee", 'If I take a shower I will be late', 'I want to go for a run', 'Nice day.', ''];
for (const t of not) ok(act(t) === null, `"${t}" starts nothing (got ${act(t)})`);
ok(I.findAction('I take a shower', A)?.sure === true && I.findAction('I shower', A)?.sure === false, 'the label\'s own words are a sure match; the short form is not');
ok(I.findAction('I take a shower', []) === null, 'nothing to do here, nothing found');
ok(I.findAction('I take a shower', [{ id: 'x', label: 'Read in bed' }]) === null, 'only what can be done here is found');
ok(I.stem('running') === 'run' && I.stem('takes') === 'take' && I.stem('took') === 'take' && I.stem('watches') === 'watch' && I.stem('tidied') === 'tidy', 'word endings come off');
ok(I.outsideQuotes('I nod. "I take a shower" I leave.').includes('I take a shower') === false, 'what is said out loud is not doing');

/* ---------- asking something of someone ---------- */
const req = (t) => I.findRequest(t, ['Mia Chen', 'Tom Reed']);
ok(req('Could you lend me some money?')?.size === 'big', 'money is a lot to ask');
ok(req('Mia, come with me.')?.size === 'medium' && req('Mia, come with me.').target === 'Mia', 'come with me is a favor, and names who');
ok(req('Please pass the salt')?.size === 'small' && req('Please pass the salt').order === false, 'a small thing');
ok(req('I need you to quit your job. Now!')?.order === true && req('I need you to quit your job. Now!').size === 'big', 'an order');
ok(req('Nice weather today.') === null && req('What did you do today?') === null && req('I like your hat') === null, 'ordinary talk is not a request');
ok(req('[Story direction: could you make it rain]') === null, 'a story direction is not a request');

seed(4);
const w = world(ext, 'modern'); W.registerWorld(w);
meta.mundi = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'v0.1.0-modern.json'), 'utf8'));
const g = store.game();
const all = Object.values(g.cast);
const r = all[0], other = all[1];
ok(I.requestTarget([r, other], { size: 'small', order: false, target: other.name.split(' ')[0] })?.avatar === other.avatar, 'the one named is the one asked');
ok(I.requestTarget([r, other], { size: 'small', order: false, target: '' }, r.avatar)?.avatar === r.avatar, 'or the one you talk with alone');
ok(I.requestTarget([r], { size: 'small', order: false, target: '' })?.avatar === r.avatar && I.requestTarget([r, other], { size: 'small', order: false, target: '' }) === null, 'or the only one here; with several and no name, nobody');
// willingness follows the game's numbers (set the clock to a free hour so work and sleep stay out of it)
r.met = true; r.routine = { weekday: [[0, 'leisure']], weekend: [[0, 'leisure']] }; g.minutes = 15 * 60;
const big = { size: 'big', order: false, target: '' }, small = { size: 'small', order: false, target: '' };
So.social(g).bond[r.avatar] = 0; (g.living ??= {}).approval = { ...(g.living.approval ?? {}), [r.avatar]: 0 };
ok(I.willingness(g, w, r, big).lean === 'no', 'a stranger refuses a big thing');
ok(I.willingness(g, w, r, small).lean !== 'no', 'but not a small one');
So.social(g).bond[r.avatar] = 90;
ok(I.willingness(g, w, r, big).lean === 'yes', 'a close friend gladly helps');
ok(I.willingness(g, w, r, { ...big, order: true }).score < I.willingness(g, w, r, big).score, 'an order goes down worse than asking');
So.social(g).bond[r.avatar] = 50; g.living.approval[r.avatar] = -60;
ok(I.willingness(g, w, r, big).lean === 'no' && I.willingness(g, w, r, big).why.some(x => x.includes('disapproves')), 'disapproval counts against');
g.living.approval[r.avatar] = 0; r.met = false;
ok(I.willingness(g, w, r, big).why.some(x => x.includes('only just met')), 'someone you just met is warier');
r.met = true; So.social(g).bond[r.avatar] = 0;
const line = I.willingLine(g, w, r, big);
ok(line.startsWith('[{{user}} is asking') && line.includes(r.name) && line.includes('would most likely refuse') && line.includes('do not make') && line.endsWith(']'), 'the AI is told where they stand and what is likely');
ok(I.willingLine(g, w, r, { ...big, order: true }).includes('is telling'), 'an order is named as one');
void L; void Pe;

/* ---------- who came and went ---------- */
ok(I.cameAndWent(['Mia'], ['Mia']) === '', 'nobody moved: nothing to say');
ok(I.cameAndWent([], ['Mia']).includes('Mia came in and is here now'), 'someone came in');
ok(I.cameAndWent(['Mia', 'Tom'], []).includes('Mia and Tom left and are no longer here'), 'people left');
const both = I.cameAndWent(['Tom'], ['Mia', 'Ana']);
ok(both.includes('Mia and Ana came in and are here now') && both.includes('And Tom left'), 'both at once');

/* ---------- Expand ---------- */
const ask = { me: 'Aiden', about: 'A quiet barista.', scene: 'Place: Café', recent: 'Mia: Hi!', seed: 'shrug, say fine', mode: 'free', style: 'Writing style (tone: warm).', people: ['Mia Chen'] };
const pr = X.expandPrompt(ask);
ok(pr.includes('"shrug, say fine"') && pr.includes('About Aiden: A quiet barista.') && pr.includes('Mia: Hi!') && pr.includes('Writing style (tone: warm).') && pr.includes('add no new decision') && pr.includes('Mia Chen'), 'the request holds the note, who you are, the scene, the style and the limits');
ok(X.expandPrompt({ ...ask, about: '', recent: '', style: '', people: [] }).includes('anyone else'), 'and works with nothing but the note');
ok(X.expandPrompt({ ...ask, mode: 'say' }).includes('is speaking') && X.expandPrompt({ ...ask, mode: 'do' }).includes('is acting'), 'how you meant it shapes the request');
ok(X.cleanExpansion('Aiden: I shrug. "Fine."', 'Aiden', ['Mia Chen']) === 'I shrug. "Fine."', 'the speaker label comes off');
ok(X.cleanExpansion('I shrug. "Fine."\nMia: "Great!"', 'Aiden', ['Mia Chen']) === 'I shrug. "Fine."', 'nothing by anyone else is kept');
ok(X.cleanExpansion('Mia: "Hello"', 'Aiden', ['Mia Chen']) === '', 'a line that is only someone else\'s is no answer');
ok(X.cleanExpansion('Here is the line: I nod.', 'Aiden', []) === 'I nod.', 'a lead-in comes off');
ok(X.cleanExpansion('I smile at Mia: she looks tired. "Rough day?"', 'Aiden', ['Mia Chen']).startsWith('I smile at Mia'), 'a name inside your own sentence is not another speaker');
ok(X.cleanExpansion(`${'I walk on. '.repeat(100)}`, 'Aiden', []).length <= 700, 'and it is never too long');
ok(X.cleanExpansion('', 'Aiden', []) === '', 'an empty answer stays empty');

/* ---------- one of the people, not their author ---------- */
const pc = P.promptCfg();
const someone = Pe.presentAt(g, w, g.player.loc).length > 0;
if (!someone) { const s = So.social(g); s.with.push({ avatar: r.avatar, until: g.day * 1440 + g.minutes + 600 }); }
ok(Pe.presentAt(g, w, g.player.loc).length > 0, '(someone is here for the test)');
const txt = P.sceneText();
ok(txt.includes(P.AGENCY) && txt.indexOf(P.AGENCY) < txt.indexOf(P.DEFAULT_RULES) && txt.indexOf(P.AGENCY) > txt.indexOf('[World state'), 'sent with the rules when someone is here');
pc.agency = false;
ok(!P.sceneText().includes(P.AGENCY), 'and can be turned off');
pc.agency = true; So.social(g).with = [];
const alone = Object.values(g.cast).every(c => Pe.whereNow(g, w, c) !== g.player.loc);
ok(!alone || !P.sceneText().includes(P.AGENCY), 'alone, there is nobody to say it about');

console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
