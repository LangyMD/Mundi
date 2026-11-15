// Photos by person (sim/photos.ts). Run: node tests/photos.test.mjs [repo root]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stage, browser } from './env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ?? path.join(here, '..');
const ext = stage(root, 'photos');
const meta = {}; browser(meta);
const Ph = await import(`${ext}/dist/sim/photos.js`);
const W = await import(`${ext}/dist/core/world.js`);
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)}`);

const cast = { 'mia.png': 'Mia Chen', 'leo.png': 'Leo' };
const avatarOf = (by) => (cast[by] ? by : Object.keys(cast).find(a => cast[a] === by) ?? '');
const raw = [
    { url: '/a.png', caption: 'at the café', at: 10, by: 'Mia Chen', source: 'chat' },
    { url: '/b.png', caption: '', at: 30, by: 'Leo', source: 'chat' },
    { url: '/c.png', caption: 'selfie', at: 20, by: 'Aiden', mine: true, source: 'chat' },
    { url: '/a.png', caption: 'again', at: 40, by: 'Leo', source: 'chat' },
    { url: '/d.png', caption: 'post', at: 50, by: 'mia.png', source: 'chirp' },
    { url: '/e.png', caption: '', at: 5, by: 'Narrator', source: 'chat' },
    { url: '', caption: '', at: 60, by: 'Leo', source: 'chat' },
];
const g = {};
let list = Ph.shots(raw, avatarOf, Ph.photoTags(g));
eq(list.map(s => s.url), ['/d.png', '/b.png', '/c.png', '/a.png', '/e.png'], 'newest first, once each, empty dropped');
eq(list.find(s => s.url === '/a.png').who, ['mia.png'], 'the sender by name');
eq(list.find(s => s.url === '/d.png').who, ['mia.png'], 'a Chirp post by avatar');
eq(list.find(s => s.url === '/c.png').who, [Ph.ME], 'your own picture');
eq(list.find(s => s.url === '/e.png').who, [], 'nobody known');
ok(list.every(s => s.guessed), 'all guessed at first');

let al = Ph.albums(list);
eq(al.map(a => [a.who, a.n]), [['mia.png', 2], ['leo.png', 1], [Ph.ME, 1], ['', 1]], 'albums: most first, the rest last');
eq(al[0].cover, '/d.png', 'the cover is the newest');
eq(Ph.shotsOf(list, 'mia.png').map(s => s.url), ['/d.png', '/a.png'], 'one person\'s pictures');
eq(Ph.shotsOf(list, '').map(s => s.url), ['/e.png'], 'the pictures of nobody');

Ph.toggleTag(g, list.find(s => s.url === '/b.png'), 'mia.png');
list = Ph.shots(raw, avatarOf, Ph.photoTags(g));
eq(list.find(s => s.url === '/b.png').who, ['leo.png', 'mia.png'], 'someone added by hand');
ok(list.find(s => s.url === '/b.png').guessed === false, 'no longer a guess');
Ph.toggleTag(g, list.find(s => s.url === '/b.png'), 'leo.png');
list = Ph.shots(raw, avatarOf, Ph.photoTags(g));
eq(list.find(s => s.url === '/b.png').who, ['mia.png'], 'someone removed by hand');
eq(Ph.albums(list).map(a => [a.who, a.n]), [['mia.png', 3], [Ph.ME, 1], ['', 1]], 'albums follow the tags');
Ph.toggleTag(g, list.find(s => s.url === '/b.png'), 'mia.png');
list = Ph.shots(raw, avatarOf, Ph.photoTags(g));
eq(list.find(s => s.url === '/b.png').who, [], 'everyone removed: nobody, and it stays so');
ok(Ph.shotsOf(list, '').some(s => s.url === '/b.png'), 'it moves to the other pictures');
Ph.clearTag(g, '/b.png');
list = Ph.shots(raw, avatarOf, Ph.photoTags(g));
eq(list.find(s => s.url === '/b.png').who, ['leo.png'], 'back to the guess');
eq(Ph.shots([{ url: '/x.png', caption: '', at: 1, by: 'Mia Chen', source: 'chat', look: 'swimwear' }], avatarOf, {})[0].look, 'swimwear', 'what they wore is kept');

ok(W.DEFAULT_APPS.some(a => a.id === 'photos' && a.on), 'a Photos app on the phone');

console.log(fails ? `${fails} FAILED, ${passes} passed` : `${passes} checks passed`);
process.exit(fails ? 1 : 0);
