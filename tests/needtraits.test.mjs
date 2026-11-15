// Traits and the Social and Intimacy needs (sim/needtraits.ts): gained traits change your needs, the people's own
// needs, and how they take to being close. Run: node tests/needtraits.test.mjs [repo root]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stage, browser, seed, world } from './env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ?? path.join(here, '..');
const ext = stage(root, 'needtraits');
const meta = {}; browser(meta);
const D = (p) => import(`${ext}/dist/${p}`);
const store = await D('core/store.js'); const W = await D('core/world.js');
const T = await D('sim/persontraits.js'); const N = await D('sim/needtraits.js'); const mods = await D('sim/modifiers.js');
const close = await D('sim/intimacy.js'); const soc = await D('sim/social.js'); const rom = await D('sim/romance.js'); const living = await D('sim/living.js');
const needs = await D('sim/needs.js'); const npc = await D('sim/npcneeds.js');
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('  FAIL', m); } };
const fixture = (f) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', f), 'utf8'));
const open = (s) => { for (const k of Object.keys(meta)) delete meta[k]; meta.mundi = s; return store.game(); };
seed(7);
const modern = world(ext, 'modern'); W.registerWorld(modern);
const g = open(fixture('v0.1.0-modern.json'));
const [a, b] = Object.keys(g.cast); const A = g.cast[a], B = g.cast[b]; A.met = B.met = true;
g.player.traits = {}; g.cfg = { ...(g.cfg ?? {}), optNeeds: ['social', 'intimacy'] };

/* ---------- the traits exist ---------- */
const ids = T.DEFAULT_TRAITS.map(t => t.id);
for (const id of ['social-butterfly', 'loner', 'affectionate', 'reserved', 'glowing']) ok(ids.includes(id), `a usual trait: ${id}`);
ok(T.traitDef(g, modern, 'glowing').kind === 'state' && T.traitDef(g, modern, 'affectionate').kind === 'lasting', 'glowing passes, affectionate lasts');
ok(T.traitsFor(T.DEFAULT_TRAITS, 'Hug Mia').join() === 'affectionate' && T.traitsFor(T.DEFAULT_TRAITS, 'Make love with Mia').join() === 'affectionate', 'being close leads to affectionate');
ok(T.traitsFor(T.DEFAULT_TRAITS, 'Have a coffee').includes('social-butterfly'), 'a coffee together leads to social butterfly');
ok(!T.traitsFor(T.DEFAULT_TRAITS, 'Read a book').some(x => ['social-butterfly', 'affectionate', 'loner', 'reserved'].includes(x)), 'reading leads to none of them');

/* ---------- you: gained traits change your needs ---------- */
ok(mods.decayMult(g, modern, 'social') === 1 && mods.gainMult(g, modern, 'intimacy') === 1, 'no traits: nothing changes');
T.addTrait(g, modern, T.PLAYER, 'social-butterfly');
ok(N.gainedNames(g, modern).join() === 'social butterfly', 'the names the table looks up');
ok(mods.decayMult(g, modern, 'social') === 1.25 && mods.gainMult(g, modern, 'social') === 1.2 && mods.gainMult(g, modern, 'bond') === 1.1, 'social butterfly: company is missed sooner and means more');
ok(mods.modifierLines(g, modern).some(l => /Social butterfly: social drops 25% faster/.test(l)), `you are told (${mods.modifierLines(g, modern).join(' | ')})`);
T.removeTrait(g, T.PLAYER, 'social-butterfly'); T.addTrait(g, modern, T.PLAYER, 'loner');
ok(mods.decayMult(g, modern, 'social') === 0.7, 'loner: company is missed later');
T.removeTrait(g, T.PLAYER, 'loner'); T.addTrait(g, modern, T.PLAYER, 'affectionate');
ok(mods.decayMult(g, modern, 'intimacy') === 1.2 && mods.gainMult(g, modern, 'intimacy') === 1.2 && mods.gainMult(g, modern, 'romance') === 1.1, 'affectionate: closeness is missed sooner and means more');
T.removeTrait(g, T.PLAYER, 'affectionate'); T.addTrait(g, modern, T.PLAYER, 'reserved');
ok(mods.decayMult(g, modern, 'intimacy') === 0.75, 'reserved: closeness is missed later');
T.removeTrait(g, T.PLAYER, 'reserved');
// with a chosen trait of the same kind, the two multiply (within the limits)
g.player.traits = { personality: ['Outgoing'] }; T.addTrait(g, modern, T.PLAYER, 'social-butterfly');
ok(Math.abs(mods.decayMult(g, modern, 'social') - 1.25 * 1.25) < 1e-9, 'a chosen trait and a gained one add up');
g.player.traits = {}; T.removeTrait(g, T.PLAYER, 'social-butterfly');
// a gained trait with the name of a chosen one counts the same
T.addTrait(g, modern, T.PLAYER, 'athletic');
ok(mods.decayMult(g, modern, 'energy') === 0.85, 'gained athletic: like the athletic you can choose');
T.removeTrait(g, T.PLAYER, 'athletic');
// a job is not one of these
g.player.job = { id: 'barista', rank: 0, shifts: 0 };
ok(!N.gainedNames(g, modern).length, 'a job is not in the table');
g.player.job = null;

/* ---------- the people: gained traits count like the ones of their card ---------- */
ok(!N.gainedNpcTraits(g, a).length, 'nothing gained: nothing added');
T.addTrait(g, modern, a, 'social-butterfly'); T.addTrait(g, modern, a, 'party-animal'); T.addTrait(g, modern, a, 'glowing');
ok(N.gainedNpcTraits(g, a).sort().join() === 'outgoing,party', `a social butterfly who parties (${N.gainedNpcTraits(g, a).join()})`);
T.addTrait(g, modern, b, 'loner');
ok(N.gainedNpcTraits(g, b).join() === 'shy', 'a loner');
if (npc.npcOn(modern) || true) {
    // the same hours at home: the social butterfly ends up lonelier than the loner (their own tempers aside)
    const w2 = structuredClone(modern); w2.id = 'npc'; (w2.features ??= {}).systems = { ...(w2.features.systems ?? {}), npclife: true }; W.registerWorld(w2);
    const run = (trait) => {
        const g2 = open(fixture('v0.1.0-modern.json')); g2.world = 'npc'; const r = g2.cast[a];
        if (trait) T.addTrait(g2, w2, a, trait);
        if (!npc.npcOn(w2)) return null;
        const s = npc.npcOf(g2, w2, r); s.n.social = 80; s.last = Math.floor((g2.day * 1440 + g2.minutes) / 60);
        r.routine = { weekday: [[0, 'home']], weekend: [[0, 'home']] };
        g2.day += 1; g2.minutes = 12 * 60;
        return npc.npcOf(g2, w2, r).n.social;
    };
    const plain = run(''), butterfly = run('social-butterfly'), loner = run('loner');
    if (plain === null) ok(true, '(the people\'s needs are off in this build: skipped)');
    else ok(butterfly < plain && plain < loner, `a day at home: butterfly ${butterfly} < ${plain} < loner ${loner}`);
}
open(Object.assign(meta.mundi, {}));   // (back to the first save)
meta.mundi = g; store.game();

/* ---------- being close ---------- */
T.removeTrait(g, a, 'social-butterfly'); T.removeTrait(g, a, 'party-animal'); T.removeTrait(g, a, 'glowing'); T.removeTrait(g, b, 'loner');
ok(N.closeLean(g, modern, a, 'kiss').delta === 0, 'no traits: no lean');
T.addTrait(g, modern, a, 'affectionate');
ok(N.closeLean(g, modern, a, 'kiss').delta === 10, 'affectionate: more ready');
T.addTrait(g, modern, a, 'heartbroken');
const hb = N.closeLean(g, modern, a, 'kiss');
ok(hb.delta === -5 && hb.why === 'heartbroken', 'heartbroken weighs more, and is the reason');
T.removeTrait(g, a, 'affectionate'); T.removeTrait(g, a, 'heartbroken'); T.addTrait(g, modern, a, 'sick');
ok(N.closeLean(g, modern, a, 'hug').delta === 0 && N.closeLean(g, modern, a, 'kiss').delta === -12, 'sick: a hug is fine, a kiss is not');
T.removeTrait(g, a, 'sick');
ok(N.closeWith(`close:kiss:${a}`) === a && N.closeWith('close:solo') === '' && N.closeWith('coffee') === '', 'who a close action is with');
// the engine's answer moves with it: a kiss that could go either way
const S = soc.social(g); S.partner = []; g.romance = {};
const set = (av, bond, r, status = 'none') => { S.bond[av] = bond; rom.romOf(g, av).value = r; rom.romOf(g, av).status = status; };
g.player.loc = 'home:player'; S.with = [{ avatar: a, until: 1e12 }];
// score = romance × 0.6 + bond × 0.4 + approval × 0.2; a kiss needs 50 (never below 40, sure from 60)
const rested = () => { if (npc.npcOn(modern)) { const st = npc.npcOf(g, modern, A); for (const k of npc.NPC_NEEDS) st.n[k] = 90; st.mood = []; } };   // (so that being tired is not what decides)
rested(); living.approve(g, a, -living.approvalOf(g, a)); set(a, 50, 50);   // 50: could go either way
T.addTrait(g, modern, a, 'reserved');   // 40 − … : now below "never"? 50 − 10 = 40: on the edge, so make it clear
set(a, 45, 45);                          // 45 − 10 = 35: never
let out = close.closeOutcome(g, modern, { id: `close:kiss:${a}` });
ok(!out.ok && /reserved lately/.test(out.hint), `reserved, and not that close: turned down, with the reason (${out.hint.slice(0, 120)})`);
close.closeOutcome; g.close = { no: {} };
T.removeTrait(g, a, 'reserved'); T.addTrait(g, modern, a, 'affectionate'); living.approve(g, a, -living.approvalOf(g, a)); set(a, 50, 50); rested();   // 50 + 10 = 60: sure
out = close.closeOutcome(g, modern, { id: `close:kiss:${a}` });
ok(out.ok && /wanted it too/.test(out.hint), `affectionate: the same closeness is welcomed (${out.hint})`);
// welcomed: both glow; a hug does not do it
T.removeTrait(g, a, 'affectionate');
const fire = (id) => { const act = needs.actionsHere(g, modern).find(x => x.id === id); if (act) needs.applyAction(g, modern, act); return !!act; };
set(a, 80, 80, 'dating'); g.player.stats.intimacy = 20;
ok(fire(`close:hug:${a}`) && !T.hasTrait(g, a, 'glowing') && !T.hasTrait(g, T.PLAYER, 'glowing'), 'a hug: no glow');
ok(fire(`close:kiss:${a}`) && T.hasTrait(g, a, 'glowing') && T.hasTrait(g, T.PLAYER, 'glowing'), 'a kiss: both are glowing');
ok(mods.decayMult(g, modern, 'mood') === 0.8, 'glowing: your mood holds longer');
const until = T.keptTraits(g, a).find(t => t.id === 'glowing').until;
ok(until - (g.day * 1440 + g.minutes) === 1440, 'until tomorrow');
g.day += 2; ok(!T.hasTrait(g, a, 'glowing') && !T.hasTrait(g, T.PLAYER, 'glowing'), 'and then it is gone');
// a breakup: they are heartbroken for a week
ok(/broke up/.test(rom.endRelationship(g, a, A.name)) && T.hasTrait(g, a, 'heartbroken'), 'a breakup leaves them heartbroken');
ok(N.closeLean(g, modern, a, 'hug').delta === -15, 'and not in the mood to be close');
g.day += 8; ok(!T.hasTrait(g, a, 'heartbroken'), 'for a week');

console.log(`${passes} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
