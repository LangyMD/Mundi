// The message box's modes (core/compose.ts) and the writing style (sim/style.ts).
// Run: node tests/style.test.mjs [repo root]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stage, browser, seed, world } from './env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ?? path.join(here, '..');
const ext = stage(root, 'style');
const meta = {}; browser(meta);
const sent = {};
globalThis.__ctx.setExtensionPrompt = (key, text, position, depth) => { sent[key] = { text, position, depth }; };
const D = (p) => import(`${ext}/dist/${p}`);
const store = await D('core/store.js'); const W = await D('core/world.js'); const C = await D('core/compose.js');
const S = await D('sim/style.js'); const P = await D('sim/prompt.js');
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('  FAIL', m); } };

/* ---------- the message box ---------- */
ok(C.shape('say', 'hello') === '"hello"', 'Say puts your words in quotes');
ok(C.shape('say', '*waves*') === '*waves*', 'Say leaves an action as it is');
ok(C.shape('do', 'sit down') === '*sit down*', 'Do puts it in asterisks');
ok(C.shape('story', 'it starts to rain') === '[Story direction: it starts to rain]', 'Story is a direction');
ok(C.shape('see', 'at the painting') === '*looks at the painting* [Describe what {{user}} sees.]', 'See looks at it');
ok(C.shape('free', 'I shrug. "Fine."') === 'I shrug. "Fine."', 'Free text is sent exactly as written');
ok(C.shape('free', 'hello there') === 'hello there', 'Free text adds no quotes');
ok(C.shape('free', '> it starts to rain') === C.shape('story', 'it starts to rain'), '> is a story direction in free text');
ok(C.shape('free', '?the painting') === C.shape('see', 'the painting'), '? is a look in free text');
ok(C.shape('free', '?') === '?' && C.shape('free', '>') === '>', 'a lone > or ? is just text');
ok(C.shape('free', '   ') === '' && C.shape('say', '') === '', 'nothing written, nothing sent');
ok(C.inputStyleOf(undefined) === 'buttons' && C.inputStyleOf('nonsense') === 'buttons', 'the buttons are the default');
ok(C.modesFor('buttons').join() === 'say,do,story,see', 'buttons: the four modes, as before');
ok(C.modesFor('both')[0] === 'free' && C.modesFor('both').length === 5, 'both: Free comes first');
ok(C.modesFor('free').length === 0, 'free text only: no buttons');
ok(C.modeFor('buttons', '') === 'say', 'buttons start on Say');
ok(C.modeFor('both', '') === 'free' && C.modeFor('both', 'do') === 'do', 'both starts on Free and keeps your pick');
ok(C.modeFor('free', 'do') === 'free', 'without buttons everything is free text');
ok(C.modeFor('buttons', 'free') === 'say', 'a mode the box does not show falls back to its first');

/* ---------- the writing style ---------- */
seed(3);
const w = world(ext, 'modern'); W.registerWorld(w);
meta.mundi = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'v0.1.0-modern.json'), 'utf8'));
const g = store.game();
const s = S.styleOf(g);
ok(s.on === false && S.styleText(s) === '', 'off by default: nothing is sent');
const before = P.sceneText();
P.refreshPrompt();
ok(sent.mundi_style?.text === '' && sent.mundi_style_top?.text === '', 'an old save sends no style');
s.pov = 'second'; s.length = 'short'; s.tone = 'warm'; s.tags = ['Banter']; s.npcSpeech = 'modern casual'; s.notes = 'Dry humor.';
ok(S.styleText(s) === '', 'choices alone send nothing while the style is off');
s.on = true;
const t = S.styleText(s);
ok(t.startsWith('[Writing style') && t.includes('"you"') && t.includes('under about 120 words') && t.includes('Tone over the whole story: warm.') && t.includes('Style: Banter.') && t.includes('How people speak: modern casual.') && t.includes('Dry humor.'), 'the choices become the instruction');
ok(S.styleOf(g) === s || S.styleOf(g).tone === 'warm', 'the style is kept in the save');
P.refreshPrompt();
ok(sent.mundi_style.text === t && sent.mundi_style.position === 1 && sent.mundi_style.depth === 1, 'sent inside the chat, just before the newest message');
ok(sent.mundi_style_top.text === '', 'and not twice');
ok(P.sceneText() === before, 'the scene block itself is unchanged');
S.styleOf(g).where = 'top'; P.refreshPrompt();
ok(sent.mundi_style.text === '' && sent.mundi_style_top.text === t && sent.mundi_style_top.position === 0, 'or with the scene block, when chosen');
const s2 = S.styleOf(g); s2.where = 'late'; s2.rule = 'Write plainly.'; s2.useRule = true;
ok(S.styleText(s2) === '[Writing style — keep to it in every reply]\nWrite plainly.', 'one text of your own replaces the choices');
s2.rule = '   ';
ok(S.styleText(s2).includes('Tone over the whole story: warm.'), 'an empty text falls back to the choices');
ok(S.styleNote(s2).includes('tone: warm') && S.styleNote(s2).includes('Banter') && !S.styleNote(s2).includes('120 words'), 'the short note for the narrator: tone and tags only');
ok(S.compilePrompt(s2).includes('- Tone over the whole story: warm.') && S.compilePrompt(s2).includes('{{user}}'), 'the AI is given the choices to write the instruction');
ok(S.cleanRule('**Writing instructions:** "Write plainly."') === 'Write plainly.', 'the AI\'s answer is cleaned of its title and quotes');
P.clearPrompt();
ok(sent.mundi_style.text === '' && sent.mundi_style_top.text === '' && sent.mundi_scene.text === '', 'leaving the game clears it');
// what a save holds is cleaned: wrong kinds, too many tags, long texts
const bad = S.fixStyle({ on: 'yes', pov: 'fourth', tags: [1, '', ...Array(20).fill('x'.repeat(200))], tone: 'a'.repeat(500), where: 'middle', rule: 5 });
ok(bad.on === false && bad.pov === '' && bad.where === 'late' && bad.tags.length === 12 && bad.tags[1].length === 60 && bad.tone.length === 120 && bad.rule === '5', 'a damaged style is repaired');
// tags and presets
S.toggleTag(s2, 'banter'); ok(!s2.tags.length, 'a tag is taken off whatever its case');
ok(S.addOwnTag('Lyrical') === 'Lyrical' && !S.ownTags().length, 'a built-in tag is not added as yours');
ok(S.addOwnTag('  dry   wit ') === 'dry wit' && S.addOwnTag('Dry Wit') === 'dry wit' && S.ownTags().length === 1, 'your own tag is kept once');
S.removeOwnTag('dry wit'); ok(!S.ownTags().length, 'and can be deleted');
ok(S.savePreset('  ', s2) === null, 'a preset needs a name');
const p = S.savePreset('Cozy', s2); s2.tone = 'bleak';
ok(S.stylePresets().length === 1 && p.style.tone === 'warm', 'a preset is a copy');
S.savePreset('cozy', s2); ok(S.stylePresets().length === 1 && S.stylePresets()[0].style.tone === 'bleak', 'saving under the same name replaces it');
S.styleOf(g).on = false; S.styleOf(g).tone = '';
ok(S.usePreset(g, p.id) && S.styleOf(g).tone === 'bleak' && S.styleOf(g).on === false, 'using a preset keeps the style on or off as it was here');
S.deletePreset(p.id); ok(!S.stylePresets().length && !S.usePreset(g, p.id), 'a deleted preset is gone');

/* ---------- a question waiting for its answer ---------- */
const R = await D('ui/relui.js');
ok(R.askWaited(5, 4) === true && R.askWaited(4, 4) === false, 'a turn only goes by when the chat got a new line');

console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
