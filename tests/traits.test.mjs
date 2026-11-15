// Traits for people (sim/persontraits.ts): the record, jobs as traits, doing things together, fading, the AI's line
// and which picture set shows. Run: node tests/traits.test.mjs [repo root]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stage, browser } from './env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ?? path.join(here, '..');
const ext = stage(root, 'traits');
const meta = {}; browser(meta);
const T = await import(`${ext}/dist/sim/persontraits.js`);
const P = await import(`${ext}/dist/sim/prompt.js`);
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)}`);

const mia = { avatar: 'mia.png', name: 'Mia Chen', occupation: 'nurse', met: true }, leo = { avatar: 'leo.png', name: 'Leo', occupation: null, met: true };
const w = { occupations: [{ id: 'nurse', name: 'Nurse' }, { id: 'barista', name: 'Barista' }] };
const mk = () => ({ day: 10, minutes: 600, world: 'modern', cast: { 'mia.png': mia, 'leo.png': leo }, player: { job: { id: 'barista' } } });

/* ---------- the record ---------- */
let g = mk();
eq(T.activeTraits(g, 'mia.png'), ['career-nurse'], 'a job is a trait');
eq(T.activeTraits(g, 'leo.png'), [], 'no job, no trait');
eq(T.activeTraits(g, T.PLAYER), ['career-barista'], 'your job too');
eq(T.traitDef(g, w, 'career-nurse').name, 'Nurse', 'the job\'s name');
ok(T.addTrait(g, w, 'mia.png', 'party-animal') === true && T.addTrait(g, w, 'mia.png', 'party-animal') === false, 'added once');
ok(T.addTrait(g, w, 'mia.png', 'career-nurse') === false, 'a job is not added by hand');
ok(T.addTrait(g, w, 'mia.png', 'hurt', { note: 'sprained wrist' }), 'a state');
eq(T.activeTraits(g, 'mia.png'), ['party-animal', 'hurt', 'career-nurse'], 'all of them');
const hurt = T.keptTraits(g, 'mia.png').find(t => t.id === 'hurt');
ok(hurt.until === 10 * 1440 + 600 + 5 * 1440, 'a state ends by itself (5 days)');
ok(!T.keptTraits(g, 'mia.png').find(t => t.id === 'party-animal').until, 'a lasting trait has no end');
g.day = 14; eq(T.activeTraits(g, 'mia.png').includes('hurt'), true, 'still hurt on day 14');
T.addTrait(g, w, 'mia.png', 'hurt', { days: 3 });
ok(T.keptTraits(g, 'mia.png').find(t => t.id === 'hurt').until === 14 * 1440 + 600 + 3 * 1440, 'hurt again: renewed');
g.day = 18; eq(T.activeTraits(g, 'mia.png'), ['party-animal', 'career-nurse'], 'healed');
ok(T.removeTrait(g, 'mia.png', 'party-animal') && !T.removeTrait(g, 'mia.png', 'party-animal'), 'removed once');
eq(T.makeTrait(g, w, 'Goth phase'), 'goth-phase', 'a trait of your own');
ok(T.traitDefs(g, w).some(t => t.id === 'goth-phase') && T.traitDef(g, w, 'goth-phase').name === 'Goth phase', 'kept for this game');
eq(T.makeTrait(g, w, '  '), '', 'no name, no trait');
eq(T.makeTrait(g, w, 'Career Nurse'), '', 'not a job');
eq(T.traitDefs(g, { ...w, traits: [{ id: 'noble', name: 'Noble', kind: 'lasting' }] }).map(t => t.id), ['noble', 'goth-phase'], 'the world\'s own list replaces the usual one');

/* ---------- doing things together ---------- */
g = mk();
eq(T.traitsFor(T.DEFAULT_TRAITS, 'Work out'), ['athletic'], 'work out');
eq(T.traitsFor(T.DEFAULT_TRAITS, 'Have a drink at the bar'), ['party-animal'], 'a drink');
eq(T.traitsFor(T.DEFAULT_TRAITS, 'Read a book'), ['bookworm'], 'read');
eq(T.traitsFor(T.DEFAULT_TRAITS, 'Take a shower'), [], 'a shower leads nowhere');
eq(T.traitsFor(T.DEFAULT_TRAITS, 'Spread the news'), [], 'a word inside another does not count');
let said = [];
for (let d = 0; d < 5; d++) { g.day = 10 + d; said.push(...T.togetherDid(g, w, 'Work out', [mia])); if (d === 0) said.push(...T.togetherDid(g, w, 'Go for a run', [mia])); }
ok(T.hasTrait(g, 'mia.png', 'athletic'), 'five days together: athletic');
ok(said.length === 2 && /3\/5/.test(said[0]) && /has become: athletic/.test(said[1]), `told halfway and at the end: ${said}`);
eq(T.keptTraits(g, 'mia.png')[0].source, 'together', 'it came from being together');
ok(!T.hasTrait(g, 'leo.png', 'athletic') && T.progressOf(g, 'leo.png', 'athletic') === 0, 'not for someone who was not there');
g.day = 20; eq(T.fadeTraits(g, w), [], 'a week later: nothing fades');
eq(T.fadeTraits(g, w), [], 'only once a day');
let gone = [];
for (let d = 28; d < 60 && !gone.length; d++) { g.day = d; gone = T.fadeTraits(g, w); }
ok(gone.length === 1 && /no longer athletic/.test(gone[0]) && !T.hasTrait(g, 'mia.png', 'athletic'), `stopped: it fades (${g.day})`);
ok(g.day >= 28 + 12, 'not overnight');
g = mk(); T.addTrait(g, w, 'mia.png', 'athletic', { source: 'hand' });
for (let d = 0; d < 3; d++) { g.day = 10 + d; T.togetherDid(g, w, 'Work out', [mia]); }
for (let d = 30; d < 70; d++) { g.day = d; T.fadeTraits(g, w); }
ok(T.hasTrait(g, 'mia.png', 'athletic'), 'a trait set by hand does not fade');

/* ---------- for the AI ---------- */
g = mk(); T.addTrait(g, w, 'mia.png', 'party-animal'); T.addTrait(g, w, 'mia.png', 'hurt', { note: 'sprained wrist', days: 3 }); T.addTrait(g, w, T.PLAYER, 'sick', { days: 1 });
const lines = T.traitLines(g, w, [mia, leo], 'Aiden');
eq(lines.length, 2, 'one line each for those with traits');
ok(lines[0] === 'Mia Chen lately: party animal (goes out most nights and loves a crowd); hurt (injured and moving carefully; sprained wrist, 3 more days).', `Mia: ${lines[0]}`);
ok(lines[1] === 'Aiden lately: sick (unwell, low on energy; until tomorrow).', `you: ${lines[1]}`);
ok(P.BLOCKS.some(b => b.id === 'traits' && b.cut), 'a traits block that can be cut');

/* ---------- picture sets ---------- */
eq(T.setId(['Party Animal', 'hurt']), 'hurt.party-animal', 'set id: sorted, joined by a dot');
eq(T.setTraits('hurt.party-animal'), ['hurt', 'party-animal'], 'and back');
eq(T.setFolder('hurt.party-animal', 'everyday'), 'hurt.party-animal--everyday', 'the folder');
const S = (...ids) => ids.map(id => ({ id, traits: T.setTraits(id) }));
const pick = (sets, active, own, world) => T.pickSets(sets, active, own, world, id => id === 'hurt').map(s => s.id);
eq(pick(S('party-animal', 'hurt', 'hurt.party-animal'), ['party-animal', 'hurt']), ['hurt.party-animal', 'hurt', 'party-animal'], 'the combined set wins; then states');
eq(pick(S('party-animal', 'hurt.party-animal'), ['party-animal']), ['party-animal'], 'a set needs all its traits');
eq(pick(S('party-animal', 'athletic'), ['party-animal', 'athletic'], [], ['athletic', 'party-animal']), ['athletic', 'party-animal'], 'the world\'s order');
eq(pick(S('party-animal', 'athletic'), ['party-animal', 'athletic'], ['party-animal'], ['athletic', 'party-animal']), ['party-animal', 'athletic'], 'the character\'s own order comes first');
eq(pick(S('party-animal', 'athletic'), ['party-animal', 'athletic']), ['athletic', 'party-animal'], 'no order given: by name');
eq(pick(S('career-nurse', 'hurt'), ['career-nurse']), ['career-nurse'], 'a job set');
eq(pick(S('hurt'), []), [], 'no traits, no set');
eq(T.guessSets(['hurt', 'party-animal']).map(s => s.id), ['hurt', 'party-animal', 'hurt.party-animal'], 'without a list: each alone and all together');
eq(T.guessSets(['hurt']).map(s => s.id), ['hurt'], 'one trait: one set');

console.log(fails ? `${fails} FAILED, ${passes} passed` : `${passes} checks passed`);
process.exit(fails ? 1 : 0);
