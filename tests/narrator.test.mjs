// The narrator (sim/narrate.ts): the ready-made line, the request to the AI, cleaning its answer, and the rule the
// characters get. Run: node tests/narrator.test.mjs [repo root]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stage, browser } from './env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ?? path.join(here, '..');
const ext = stage(root, 'narrator');
const meta = {}; browser(meta);
const N = await import(`${ext}/dist/sim/narrate.js`);
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('  FAIL', m); } };

const base = { me: 'Aiden', place: 'Café Aurora', desc: 'A small corner café.', time: 'Tuesday, 18:40 (evening)', weather: 'rain', crowd: 'busy', people: ['Mia Chen'] };

/* ---------- levels ---------- */
ok(N.narrLevel(undefined, 'ai') === 'ai' && N.narrLevel('engine', 'ai') === 'engine' && N.narrLevel('off', 'ai') === 'off', 'levels read');
ok(N.narrLevel('reply', 'off') === 'off' && N.narrLevel(3, 'engine') === 'engine', 'unknown level falls back');

/* ---------- the plain line ---------- */
let t = N.engineLine({ ...base, kind: 'arrive' });
ok(t === 'You arrive at Café Aurora. It is busy. Mia Chen is here.', `arrive line: ${t}`);
t = N.engineLine({ ...base, kind: 'arrive', people: [], crowd: 'a few people' });
ok(/A few people are around\. Nobody you know is here\.$/.test(t), `arrive, nobody you know: ${t}`);
t = N.engineLine({ ...base, kind: 'arrive', closed: true, people: ['Mia Chen', 'Leo', 'Ana'] });
ok(/closed at this hour/.test(t) && /Mia Chen, Leo and Ana are here\./.test(t), `closed, three people: ${t}`);
t = N.engineLine({ ...base, kind: 'arrive', crowd: '' });
ok(t === 'You arrive at Café Aurora. Mia Chen is here.', `home has no crowd: ${t}`);
t = N.engineLine({ ...base, kind: 'action', action: 'Take a shower', minutes: 20, people: [] });
ok(t === 'You take a shower (20 minutes).', `action alone: ${t}`);
t = N.engineLine({ ...base, kind: 'action', action: 'Watch a film', minutes: 120, people: ['Leo', 'Mia Chen'], came: ['Mia Chen'] });
ok(/\(2 hours\)/.test(t) && /Meanwhile Mia Chen came in\./.test(t) && /Leo is still here\./.test(t), `someone came in: ${t}`);
t = N.engineLine({ ...base, kind: 'action', action: 'Cook', minutes: 90, people: [], left: ['Mia Chen'], crowd: '' });
ok(/1 h 30 min/.test(t) && /Mia Chen left meanwhile\./.test(t) && /You are alone now\./.test(t), `someone left: ${t}`);
t = N.engineLine({ ...base, kind: 'action', action: 'Go fishing', minutes: 60, result: 'Success. The fish bites.', people: [] });
ok(/\(1 hour\)\. Success\. The fish bites\.$/.test(t), `result kept: ${t}`);

/* ---------- a busy place with nobody you know in it is not empty ---------- */
t = N.engineLine({ ...base, kind: 'arrive', people: [], crowd: 'busy' });
ok(t === 'You arrive at Café Aurora. It is busy. Nobody you know is here.', `busy, nobody known: ${t}`);
t = N.engineLine({ ...base, kind: 'arrive', people: [], crowd: 'empty' });
ok(/It is empty\. Nobody else is here\.$/.test(t), `empty: ${t}`);
t = N.engineLine({ ...base, kind: 'arrive', people: [], crowd: 'busy', closed: true });
ok(/Nobody else is here\.$/.test(t), `closed: ${t}`);
t = N.engineLine({ ...base, kind: 'action', action: 'Have a coffee', minutes: 20, people: [], left: ['Mia Chen'], crowd: 'busy' });
ok(/Nobody you know is here now\.$/.test(t) && !/alone/.test(t), `left in a busy place: ${t}`);
{
    const busy = N.narratePrompt({ ...base, kind: 'arrive', people: [], crowd: 'busy' });
    ok(!/is alone here|nobody else is around/.test(busy), 'busy: the AI is not told the place is empty');
    ok(/is not alone: the place is busy with strangers/.test(busy) && /as background/.test(busy), 'busy: strangers are the background');
    ok(/never named, never speaking to Aiden/.test(busy), 'busy: they are not named and do not speak');
    const packed = N.narratePrompt({ ...base, kind: 'arrive', crowd: 'packed' });
    ok(/Here now with Aiden: Mia Chen\. Around them, the place is packed with strangers/.test(packed) && !/Nobody else\./.test(packed), 'someone you know, in a crowd');
    const empty = N.narratePrompt({ ...base, kind: 'arrive', people: [], crowd: 'empty' });
    ok(/Aiden is alone here\./.test(empty) && /nobody else is around/.test(empty), 'an empty place is still empty');
    const home = N.narratePrompt({ ...base, kind: 'arrive', people: [], crowd: '' });
    ok(/Aiden is alone here\./.test(home), 'at home with nobody: alone');
    const act = N.narratePrompt({ ...base, kind: 'action', action: 'Have a coffee', minutes: 20, people: [], crowd: 'a few people' });
    ok(/the strangers around stay in the background/.test(act) && !/ends up alone/.test(act), 'an action in a place with people around');
}

/* ---------- the request ---------- */
let p = N.narratePrompt({ ...base, kind: 'arrive', why: ['Mia Chen is on her shift.'] }, '', 'Keep it bleak.', '');
ok(p.includes('Place: Café Aurora — A small corner café.') && p.includes('How busy: busy') && p.includes('Weather: rain'), 'arrive: place facts');
ok(p.includes('Mia Chen is on her shift.') && p.includes('has just arrived at Café Aurora'), 'arrive: why and task');
ok(/do not speak or address Aiden yet/.test(p) && p.includes('Keep it bleak.'), 'arrive: nobody speaks, style kept');
ok(!p.includes('The last lines of the story'), 'arrive: no old lines');
p = N.narratePrompt({ ...base, kind: 'arrive', people: [], crowd: '' });
ok(p.includes('Aiden is alone here.') && p.includes('nobody else is around'), 'arrive alone');
p = N.narratePrompt({ ...base, kind: 'action', action: 'Watch a film', minutes: 120, came: ['Mia Chen'], left: ['Leo'], result: 'Success. Good film.' }, 'Aiden: hm', '', 'Write in English.');
ok(p.includes('What Aiden just did: watch a film, for 2 hours.') && p.includes('already decided, do not change it): Success. Good film.'), 'action: what and result');
ok(p.includes('While it lasted, Mia Chen came in') && p.includes('must show Mia Chen arriving partway through'), 'action: arrival must be shown');
ok(p.includes('Leo left and is no longer here') && p.includes('must show Leo leaving'), 'action: departure must be shown');
ok(p.includes('The last lines of the story:\nAiden: hm') && p.trim().endsWith('Write in English.'), 'action: recent lines and language');
p = N.narratePrompt({ ...base, kind: 'action', action: 'Take a shower', minutes: 20, people: [], crowd: '' });
ok(p.includes('ends up alone: nobody appears') && !p.includes('While it lasted'), 'action alone');
ok(/never write what anyone says/.test(N.NARRATE_SYSTEM), 'system line');

/* ---------- cleaning ---------- */
const c = (s, max) => N.cleanNarration(s, 'Aiden', ['Mia Chen'], max);
ok(c('Narrator: The café hums.') === 'The café hums.', 'label dropped');
ok(c('**Narration:** Rain on the glass.') === 'Rain on the glass.', 'bold label dropped');
ok(c('The café hums.\nMia: Hi there!') === 'The café hums.', 'stops where someone speaks');
ok(c('Mia: Hi there!') === '', 'only a script line: nothing');
ok(c('Aiden: I sit down.') === '', 'the player speaking: nothing');
ok(c('You nod at Mia: she is busy.') === 'You nod at Mia: she is busy.', 'a name mid-sentence is fine');
ok(c('*Steam fills the room.*') === 'Steam fills the room.', 'asterisks off');
ok(c('<think>') !== undefined && c('   ') === '' && c('***') === '', 'empty stays empty');
const long = 'One sentence here. '.repeat(60);
ok(c(long, 200).length <= 200 && c(long, 200).endsWith('.'), 'cut at a sentence');
ok(c('First.\n\n\nSecond.') === 'First.\nSecond.', 'blank lines folded');

/* ---------- the characters' rule ---------- */
const store = await import(`${ext}/dist/core/store.js`);
ok(/narrator/.test(N.NARRATOR_RULE) && /only as themselves/.test(N.NARRATOR_RULE), 'rule text');
ok(typeof store.UI === 'function', 'store loads');

console.log(fails ? `${fails} FAILED, ${passes} passed` : `${passes} checks passed`);
process.exit(fails ? 1 : 0);
