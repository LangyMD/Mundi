// This world › AI context › Writing style: how the story of this game is told. Off, nothing is sent and the preset
// decides. The choices (or one text of your own) become a short instruction sent with every reply (sim/style.ts).
import { esc, notify, saveGame, saveSettings, game, toast, busy } from '../core/store.js';
import { quiet } from '../st/bridge.js';
import { refreshPrompt, estTokens } from '../sim/prompt.js';
import { styleOf, styleText, styleLines, compilePrompt, cleanRule, toggleTag, addOwnTag, removeOwnTag, ownTags, isBuiltInTag, stylePresets, savePreset, deletePreset, usePreset, POVS, LENGTHS, PACES, NARRATORS, TONES, SPEECH, STYLE_TAGS, MAX_TAG, } from '../sim/style.js';
import { icon } from './icons.js';
import { ACT, INPUT } from './reg.js';
const S = { tag: '', name: '', preset: '' };
const changed = () => { saveGame(); refreshPrompt(); };
const select = (label, key, list, cur) => `<label class="mu-field"><span>${label}</span><select data-input="sty-sel" data-key="${esc(key)}">${list.map(([v, l]) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
const chip = (act, v, on, extra = '') => `<button class="mu-chip ${on ? 'is-on' : ''}" data-act="${act}" data-v="${esc(v)}" data-notr>${esc(v)}${extra}</button>`;
export function styleHtml() {
    const g = game();
    if (!g)
        return '';
    const s = styleOf(g);
    const head = `<h4>Writing style</h4>
        <label class="mu-check"><input type="checkbox" data-input="sty-bool" data-key="on" ${s.on ? 'checked' : ''}><span>Set the writing style for this game<small>Off: Mundi sends nothing about style, and your preset decides how the story is written. On: the choices below are sent with every reply, on top of the preset.</small></span></label>`;
    if (!s.on)
        return `<section class="mu-wc-sec mu-aic mu-style">${head}</section>`;
    const presets = stylePresets();
    const has = (t) => s.tags.some(x => x.toLowerCase() === t.toLowerCase());
    const mine = [...new Set([...ownTags(), ...s.tags.filter(t => !isBuiltInTag(t))])];
    const tones = s.tone.toLowerCase().split(/\s*,\s*/).filter(Boolean);
    const sent = styleText(s);
    const lines = styleLines(s);
    return `<section class="mu-wc-sec mu-aic mu-style">${head}
        <div class="mu-style-presets">
            ${presets.length ? `<select data-input="sty-preset" aria-label="Saved styles"><option value="">Saved styles…</option>${presets.map(p => `<option value="${esc(p.id)}" ${S.preset === p.id ? 'selected' : ''} data-notr>${esc(p.name)}</option>`).join('')}</select>
                <button class="mu-ghost" data-act="sty-use" ${S.preset ? '' : 'aria-disabled="true"'}>Use it here</button><button class="mu-ghost mu-ibtn" data-act="sty-del" title="Delete this saved style" ${S.preset ? '' : 'aria-disabled="true"'}>${icon('x')}</button>` : ''}
            <input type="text" maxlength="60" placeholder="Name this style to keep it…" value="${esc(S.name)}" data-input="sty-name" data-focus="sty-name"><button class="mu-ghost" data-act="sty-save">Save for all my games</button>
        </div>
        <div class="mu-row2">${select('Point of view', 'pov', POVS, s.pov)}${select('Length of replies', 'length', LENGTHS, s.length)}</div>
        <div class="mu-row2">${select('Pace', 'pace', PACES, s.pace)}${select('Narrator\'s presence', 'narrator', NARRATORS, s.narrator)}</div>
        <label class="mu-field"><span>Tone</span><input type="text" maxlength="120" placeholder="The mood over the whole story: warm, bleak, absurd…" value="${esc(s.tone)}" data-input="sty-text" data-key="tone" data-focus="sty-tone"></label>
        <div class="mu-chips">${TONES.map(t => chip('sty-tone', t, tones.includes(t))).join('')}</div>
        <div class="mu-field"><span>Style tags · ${s.tags.length}/12</span>
            ${STYLE_TAGS.map(c => `<small class="mu-muted">${esc(c.name)}</small><div class="mu-chips">${c.tags.map(t => chip('sty-tag', t, has(t))).join('')}</div>`).join('')}
            <small class="mu-muted">My tags</small><div class="mu-chips">${mine.map(t => `${chip('sty-tag', t, has(t))}<button class="mu-ghost mu-ibtn mu-style-x" data-act="sty-tag-del" data-v="${esc(t)}" title="Delete this tag">${icon('x')}</button>`).join('')}
                <input type="text" maxlength="${MAX_TAG}" placeholder="A tag of your own…" value="${esc(S.tag)}" data-input="sty-newtag" data-focus="sty-newtag"><button class="mu-ghost" data-act="sty-tag-add">Add</button></div></div>
        <label class="mu-field"><span>How people speak</span><input type="text" maxlength="120" list="mu-style-speech" placeholder="Empty: as each character's card has it" value="${esc(s.npcSpeech)}" data-input="sty-text" data-key="npcSpeech" data-focus="sty-speech"></label>
        <datalist id="mu-style-speech">${SPEECH.map(x => `<option value="${esc(x)}"></option>`).join('')}</datalist>
        <label class="mu-field"><span>Notes</span><textarea class="mu-aic-text" rows="3" maxlength="1200" placeholder="Anything else, in your words. For example: dry humor in the narration; never end a reply with a question." data-input="sty-text" data-key="notes" data-focus="sty-notes">${esc(s.notes)}</textarea></label>
        <label class="mu-check"><input type="checkbox" data-input="sty-bool" data-key="useRule" ${s.useRule ? 'checked' : ''}><span>Send one text instead of the choices<small>Write the instruction yourself, or let the AI write it from the choices above (one call). The choices stay, so you can write it again after changing them.</small></span></label>
        ${s.useRule ? `<textarea class="mu-aic-text" rows="5" maxlength="2000" placeholder="The writing instruction, as it is sent." data-input="sty-text" data-key="rule" data-focus="sty-rule">${esc(s.rule)}</textarea>
            <button class="mu-ghost" data-act="sty-compile" ${lines.length ? '' : 'aria-disabled="true" title="Choose something above first"'}>${icon('sparkles')}<span>Write it from my choices</span></button>` : ''}
        ${select('Where it goes', 'where', [['late', 'Just before the newest message (holds best)', ''], ['top', 'With Mundi\'s scene block, near the top', '']], s.where)}
        <small class="mu-muted">Sent now${sent ? ` (≈ ${estTokens(sent)} tokens)` : ''}:</small>
        <div class="mu-lib-text is-code" data-notr>${sent ? esc(sent) : 'Nothing yet: choose something above.'}</div>
    </section>`;
}
Object.assign(INPUT, {
    'sty-bool': (el) => { const g = game(); if (!g)
        return; styleOf(g)[el.dataset.key] = el.checked; changed(); notify(); },
    'sty-sel': (el) => { const g = game(); if (!g)
        return; styleOf(g)[el.dataset.key] = el.value; changed(); notify(); },
    // typing: saved and sent right away; the screen catches up on the next redraw
    'sty-text': (el) => { const g = game(); if (!g)
        return; styleOf(g)[el.dataset.key] = el.value; changed(); },
    'sty-newtag': (el) => { S.tag = el.value; },
    'sty-name': (el) => { S.name = el.value; },
    'sty-preset': (el) => { S.preset = el.value; notify(); },
});
Object.assign(ACT, {
    'sty-tone': (el) => {
        const g = game();
        if (!g)
            return;
        const s = styleOf(g);
        const v = el.dataset.v;
        const list = s.tone.split(/\s*,\s*/).filter(Boolean);
        const i = list.findIndex(t => t.toLowerCase() === v);
        if (i >= 0)
            list.splice(i, 1);
        else
            list.push(v);
        s.tone = list.join(', ').slice(0, 120);
        changed();
        notify();
    },
    'sty-tag': (el) => { const g = game(); if (!g)
        return; toggleTag(styleOf(g), el.dataset.v); changed(); notify(); },
    'sty-tag-add': () => {
        const g = game();
        if (!g)
            return;
        const t = addOwnTag(S.tag);
        if (!t)
            return;
        const s = styleOf(g);
        if (!s.tags.some(x => x.toLowerCase() === t.toLowerCase()))
            toggleTag(s, t);
        S.tag = '';
        saveSettings();
        changed();
        notify();
    },
    'sty-tag-del': (el) => {
        const g = game();
        if (!g)
            return;
        const t = el.dataset.v;
        const s = styleOf(g);
        removeOwnTag(t);
        s.tags = s.tags.filter(x => x !== t);
        saveSettings();
        changed();
        notify();
    },
    'sty-save': () => {
        const g = game();
        if (!g)
            return;
        const p = savePreset(S.name, styleOf(g));
        if (!p) {
            toast('Give the style a name first.', 'info');
            return;
        }
        S.name = '';
        S.preset = p.id;
        saveSettings();
        toast(`"${p.name}" is saved for all your games.`, 'success');
        notify();
    },
    'sty-use': () => {
        const g = game();
        if (!g || !S.preset)
            return;
        if (usePreset(g, S.preset)) {
            changed();
            toast('This game now uses that style.', 'success');
        }
        notify();
    },
    'sty-del': () => { if (!S.preset)
        return; deletePreset(S.preset); S.preset = ''; saveSettings(); notify(); },
    'sty-compile': async () => {
        const g = game();
        if (!g)
            return;
        const s = styleOf(g);
        if (!styleLines(s).length)
            return;
        try {
            const out = cleanRule(await busy('Writing the style…', () => quiet(compilePrompt(s), 260, 'You turn a list of writing preferences into compact instructions. You reply with the instructions only.')));
            if (!out) {
                toast('No answer (is the AI connected?).', 'warn');
                return;
            }
            const now = styleOf(g);
            now.rule = out;
            now.useRule = true;
            changed();
        }
        catch (e) {
            toast(String(e?.message ?? e), 'error');
        }
        notify();
    },
});
