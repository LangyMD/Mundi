// The clothes check (sim/watch.ts) and clothes changed in the story (sim/looks.ts): when it is worth asking, the
// question, reading the answer, and how long a story change is kept. Run: node tests/watch.test.mjs [repo root]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stage, browser } from './env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ?? path.join(here, '..');
const ext = stage(root, 'watch');
const meta = {}; browser(meta);
const W = await import(`${ext}/dist/sim/watch.js`);
const L = await import(`${ext}/dist/sim/looks.js`);
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)}`);

/* ---------- the setting ---------- */
eq([W.watchLevel(undefined), W.watchLevel('hint'), W.watchLevel('always'), W.watchLevel('x')], ['off', 'hint', 'always', 'off'], 'levels');

/* ---------- worth asking? ---------- */
for (const t of ['She slips into her swimsuit.', 'He takes off his jacket.', 'Mia got changed upstairs.', 'She pulls on a hoodie', 'He is wearing a tuxedo now', 'She unbuttons her blouse', 'wrapped in a towel'])
    ok(W.mentionsClothes(t), `mentions clothes: ${t}`);
for (const t of ['She laughs and pours the coffee.', 'They address the crowd.', 'He changes the subject.', 'She puts the cup on the table and strips the bed? no: makes it.'.replace('strips the bed? no: ', ''), 'A coating of dust.'])
    ok(!W.mentionsClothes(t), `no clothes: ${t}`);

/* ---------- the question ---------- */
const who = [{ id: 'mia.png', name: 'Mia Chen', wearing: 'everyday clothes' }, { id: 'leo.png', name: 'Leo', wearing: 'work clothes' }, { id: L.PLAYER, name: 'Aiden', wearing: 'everyday clothes' }];
const p = W.watchPrompt(who, 'Aiden: Shall we swim?\nMia Chen: She changes into her swimsuit.', ['armor']);
ok(p.includes('- Mia Chen: everyday clothes') && p.includes('- Aiden: everyday clothes'), 'who wears what');
ok(p.includes('Mia Chen: She changes into her swimsuit.'), 'the lines');
ok(p.includes('swimwear') && p.includes('armor') && p.includes('career (work)') && p.includes('naked (nothing on)'), 'the kinds and layers');
ok(p.includes('{"changes":[]}') && /not plans/.test(p), 'no change, and not plans');
ok(/JSON only/.test(W.WATCH_SYSTEM), 'system: JSON only');

/* ---------- the answer ---------- */
const cur = { 'mia.png': { category: 'everyday', layer: 'normal' }, 'leo.png': { category: 'career', layer: 'normal' }, [L.PLAYER]: { category: 'everyday', layer: 'normal' } };
const read = (o, extra) => W.readWatch(o, who, cur, extra);
eq(read('{"changes":[{"name":"Mia Chen","category":"swimwear","layer":"normal"}]}'), [{ id: 'mia.png', category: 'swimwear', layer: 'normal' }], 'a plain answer');
eq(read('Sure! ```json\n{"changes":[{"name":"mia","category":"Swimwear"}]}\n```'), [{ id: 'mia.png', category: 'swimwear', layer: 'normal' }], 'fenced, first name, no layer');
eq(read('[{"name":"Aiden","layer":"underwear"}]'), [{ id: L.PLAYER, category: 'everyday', layer: 'underwear' }], 'a bare list, you, only the layer');
eq(read('{"changes":[{"name":"Leo","category":"same","layer":"outer"}]}'), [{ id: 'leo.png', category: 'career', layer: 'outer' }], 'unknown kind keeps the current one');
eq(read('{"changes":[{"name":"Leo","category":"hot weather","layer":"normal"}]}'), [{ id: 'leo.png', category: 'hot-weather', layer: 'normal' }], 'a kind written with a space');
eq(read('{"changes":[{"name":"Leo","category":"armor"}]}', ['armor']), [{ id: 'leo.png', category: 'armor', layer: 'normal' }], 'the world\'s own kind');
eq(read('{"changes":[{"name":"Leo","category":"armor"}]}'), [], 'a kind nobody knows: dropped');
eq(read('{"changes":[{"name":"Zoe","category":"swimwear","layer":"normal"}]}'), [], 'someone not in the scene');
eq(read('{"changes":[{"name":"Mia Chen","category":"everyday","layer":"normal"}]}'), [], 'what they already wear is no change');
eq(read('{"changes":[]}'), [], 'nobody changed');
eq(read('Nobody changed their clothes.'), [], 'no JSON');
eq(read('{"changes":[{"name":"Mia","layer":"naked"},{"name":"Mia Chen","layer":"outer"}]}'), [{ id: 'mia.png', category: 'everyday', layer: 'naked' }], 'one change per person');
eq(read('{"changes": [{"name": "Mia", "category": "swimwear"'), [], 'cut off: nothing');

/* ---------- changed in the story ---------- */
const g = { day: 3, minutes: 600, world: 'modern' };
const c = (o) => ({ ownHome: false, night: false, working: false, place: 'Café Aurora', tags: ['work', 'food'], home: false, season: 'spring', rain: false, sunny: true, ...o });
L.autoDress(g, ['mia.png'], () => c({}), 'cafe');
ok(L.setStoryLook(g, 'mia.png', 'swimwear', 'normal', 'cafe') === true, 'story: changed');
const sl = L.looks(g)['mia.png'];
ok(sl.lock && sl.story && sl.at === 'cafe' && sl.why === 'in the story', 'story: locked, here');
eq(L.fixLook(JSON.parse(JSON.stringify(sl))).story, true, 'story: kept in the save');
eq(L.autoDress(g, ['mia.png'], () => c({}), 'cafe'), [], 'kept while you stay');
g.minutes += 60;
eq(L.autoDress(g, ['mia.png'], () => c({}), 'cafe'), [], 'still kept an hour later');
eq(L.autoDress(g, ['mia.png'], () => c({}), 'park'), ['mia.png'], 'somewhere else: the game dresses them again');
ok(!L.looks(g)['mia.png'].lock && !L.looks(g)['mia.png'].story, 'the lock is gone');
L.setStoryLook(g, 'mia.png', 'swimwear', 'normal', 'cafe');
g.day += 1;
eq(L.autoDress(g, ['mia.png'], () => c({}), 'cafe'), ['mia.png'], 'a day later, same place: given back');
L.setStoryLook(g, 'mia.png', 'party', 'normal', 'cafe');
L.setLook(g, 'mia.png', 'party', 'normal', 'you chose it', true);
ok(L.looks(g)['mia.png'].lock === true && !L.looks(g)['mia.png'].story, 'chosen by hand after the story: yours now');
eq(L.autoDress(g, ['mia.png'], () => c({}), 'park'), [], 'and it stays when you go elsewhere');
L.setStoryLook(g, 'leo.png', 'everyday', 'normal', 'cafe');
ok(L.looks(g)['leo.png'].story === true, 'story: the same look is still held');
L.setLook(g, 'leo.png', 'formal', 'normal', 'you chose it', true);
ok(!L.looks(g)['leo.png'].story && L.looks(g)['leo.png'].lock, 'another look by hand: not the story\'s');
L.unlockLook(g, 'leo.png');
ok(!L.looks(g)['leo.png'].lock, 'given back');

console.log(`${passes} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
