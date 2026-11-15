// What everyone wears (sim/looks.ts): the folders, what the game puts on by itself, hand-set looks, and the line for
// the AI. Run: node tests/looks.test.mjs [repo root]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stage, browser } from './env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ?? path.join(here, '..');
const ext = stage(root, 'looks');
const meta = {}; browser(meta);
const L = await import(`${ext}/dist/sim/looks.js`);
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)}`);

/* ---------- folders ---------- */
ok(L.CATEGORIES.length === 9 && L.LAYERS.length === 4, 'nine categories, four layers');
eq(L.folderOf({ category: 'everyday', layer: 'normal' }), 'everyday', 'normal');
eq(L.folderOf({ category: 'formal', layer: 'outer' }), 'formal-outer', 'outer');
eq(L.folderOf({ category: 'swimwear', layer: 'outer' }), 'swimwear', 'no outer for swimwear');
eq(L.folderOf({ category: 'party', layer: 'underwear' }), 'underwear', 'underwear is one folder');
eq(L.folderOf({ category: 'party', layer: 'naked' }), 'naked', 'naked is one folder');
eq(L.folderChain({ category: 'career', layer: 'outer' }), ['career-outer', 'career', 'everyday'], 'chain outer');
eq(L.folderChain({ category: 'everyday', layer: 'normal' }), ['everyday'], 'chain everyday');
eq(L.folderChain({ category: 'party', layer: 'naked' }), ['naked', 'underwear', 'party', 'everyday'], 'chain naked');
eq(L.folderChain({ category: 'armor', layer: 'normal' }), ['armor', 'everyday'], 'a world category');

/* ---------- repair ---------- */
eq(L.fixLook(undefined), { category: 'everyday', layer: 'normal', since: 0, why: '' }, 'default look');
eq(L.fixLook({ category: 'Swim Wear!', layer: 'outer' }).layer, 'normal', 'outer dropped where there is none');
eq(L.fixLook({ category: 'formal', layer: 'bogus', lock: 1 }), { category: 'formal', layer: 'normal', since: 0, why: '', lock: true }, 'bad layer, lock kept');

/* ---------- what the moment asks ---------- */
const c = (o) => ({ ownHome: false, night: false, working: false, place: 'Café Aurora', tags: ['work', 'food'], home: false, season: 'spring', rain: false, sunny: true, ...o });
const want = (o) => { const w = L.wantLook(c(o)); return `${w.category}/${w.layer}`; };
eq(want({}), 'everyday/normal', 'a café');
eq(want({ working: true }), 'career/normal', 'on shift');
eq(want({ ownHome: true, home: true, night: true }), 'sleepwear/normal', 'home at night');
eq(want({ ownHome: true, home: true, asleep: true }), 'sleepwear/normal', 'asleep');
eq(want({ home: true, night: true }), 'everyday/normal', 'someone else\'s home at night');
eq(want({ place: 'Palm Beach', tags: ['leisure'] }), 'swimwear/normal', 'the beach');
eq(want({ place: 'Palm Beach', tags: ['leisure'], season: 'winter' }), 'cold-weather/outer', 'the beach in winter');
eq(want({ place: 'Palm Beach', tags: ['leisure'], working: true }), 'swimwear/normal', 'the beach wins over work');
eq(want({ place: 'Iron Gym', tags: ['sport'] }), 'athletic/normal', 'the gym');
eq(want({ place: 'Iron Gym', tags: ['sport'], working: true }), 'career/normal', 'working at the gym');
eq(want({ place: 'Stadium', tags: ['leisure', 'sport', 'work'] }), 'everyday/normal', 'a stadium is not a gym');
eq(want({ place: 'City Park', tags: ['leisure'] }), 'everyday/normal', 'the park in spring');
eq(want({ place: 'City Park', tags: ['leisure'], season: 'winter' }), 'cold-weather/outer', 'the park in winter');
eq(want({ place: 'City Park', tags: ['leisure'], rain: true, sunny: false }), 'everyday/outer', 'the park in the rain');
eq(want({ place: 'City Park', tags: ['leisure'], season: 'summer' }), 'hot-weather/normal', 'the park in summer');
eq(want({ place: 'City Park', tags: ['leisure'], season: 'summer', sunny: false }), 'everyday/normal', 'a cloudy summer day');
eq(want({ place: 'Mall', tags: ['shop', 'leisure'], season: 'winter' }), 'everyday/normal', 'indoors in winter');
eq(want({ place: 'Spa', tags: ['service'], wear: 'swimwear' }), 'swimwear/normal', 'the world file decides');
eq(want({ place: 'Barracks', tags: ['work'], wear: 'armor' }), 'armor/normal', 'a world category');
eq(want({ place: 'Hall', tags: ['leisure'], wear: 'indoors', season: 'winter' }), 'everyday/normal', 'told indoors');
eq(L.placeWear({ place: 'Poolside Bar', tags: ['food'], home: false }), 'indoors', 'a word inside another does not count');
eq(L.placeWear({ place: 'The Pool', tags: ['leisure'], home: false }), 'swim', 'the pool');

/* ---------- the record ---------- */
const g = { day: 3, minutes: 600, world: 'modern' };
ok(L.setLook(g, 'mia.png', 'formal', 'outer', 'a date') === true, 'set: changed');
ok(L.setLook(g, 'mia.png', 'formal', 'outer', 'again') === false, 'same look: not changed');
eq(L.lookOf(g, 'mia.png').why, 'a date', 'why kept from the first time');
ok(L.lookOf(g, 'mia.png').since > 0, 'since is set');
eq(L.lookOf(g, 'nobody.png').category, 'everyday', 'unknown person: everyday');
let changed = L.autoDress(g, ['mia.png', L.PLAYER], () => c({ working: true }));
eq(changed, ['mia.png', L.PLAYER], 'auto: both changed');
eq(L.lookOf(g, 'mia.png').category, 'career', 'auto: work clothes');
L.setLook(g, 'mia.png', 'party', 'normal', 'you chose it', true);
changed = L.autoDress(g, ['mia.png', L.PLAYER], () => c({}));
eq(changed, [L.PLAYER], 'a look set by hand is left alone');
eq(L.lookOf(g, 'mia.png').category, 'party', 'still the party outfit');
L.unlockLook(g, 'mia.png');
eq(L.autoDress(g, ['mia.png'], () => c({})), ['mia.png'], 'given back to the game: changes again');
eq(L.autoDress(g, ['mia.png'], () => null), [], 'no facts: left as they are');
L.setLook(g, 'mia.png', 'everyday', 'normal', '', true);
ok(L.looks(g)['mia.png'].lock === true, 'the same look by hand still locks it');

/* ---------- for the AI ---------- */
const mia = { avatar: 'mia.png', name: 'Mia Chen' }, leo = { avatar: 'leo.png', name: 'Leo' };
const g2 = { day: 1, minutes: 0, world: 'modern' };
eq(L.looksLines(g2, [mia, leo]), [], 'nothing known: no line');
L.setLook(g2, 'mia.png', 'everyday', 'normal', '');
eq(L.looksLines(g2, [mia]), [], 'plain everyday clothes: no line');
L.setLook(g2, 'mia.png', 'swimwear', 'normal', 'at the beach'); L.setLook(g2, L.PLAYER, 'everyday', 'outer', 'the rain');
let line = L.looksLines(g2, [mia, leo], 'Aiden')[0];
ok(line.includes('Mia Chen: swimwear') && line.includes('Aiden: everyday clothes with a coat or jacket on top') && !line.includes('Leo'), `line: ${line}`);
L.WARDROBE['mia.png'] = { swimwear: 'red  one-piece', everyday: 'jeans and a white tee', 'formal-outer': 'black blazer over a slip dress', formal: 'slip dress' };
ok(L.looksLines(g2, [mia])[0].includes('Mia Chen: swimwear (red one-piece)'), 'the wardrobe\'s words are used');
L.setLook(g2, 'mia.png', 'everyday', 'normal', '');
ok(L.looksLines(g2, [mia])[0].includes('everyday clothes (jeans and a white tee)'), 'everyday is told when its words are known');
L.setLook(g2, 'mia.png', 'formal', 'outer', '');
ok(L.lookWords('mia.png', L.lookOf(g2, 'mia.png')).includes('black blazer over a slip dress'), 'outer has its own words');
L.setLook(g2, 'mia.png', 'party', 'underwear', '');
eq(L.lookWords('mia.png', L.lookOf(g2, 'mia.png')), 'only underwear', 'underwear');
L.setLook(g2, 'mia.png', 'party', 'naked', '');
eq(L.lookWords('mia.png', L.lookOf(g2, 'mia.png')), 'nothing', 'naked');
delete L.WARDROBE['mia.png'];

/* ---------- the prompt block ---------- */
const P = await import(`${ext}/dist/sim/prompt.js`);
ok(P.BLOCKS.some(b => b.id === 'looks' && b.cut), 'a looks block that can be cut');

console.log(fails ? `${fails} FAILED, ${passes} passed` : `${passes} checks passed`);
process.exit(fails ? 1 : 0);
