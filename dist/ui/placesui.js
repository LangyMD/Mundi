// This world → Places: what this game changed about the world's places (sim/placestate.ts). Close one for a while
// with a reason, take it off the map, rename it, or add to how it looks. The world file is not touched.
import { esc, game, notify, saveGame, toast } from '../core/store.js';
import { getWorld } from '../core/world.js';
import { ACT, INPUT } from './reg.js';
import { refreshPrompt } from '../sim/prompt.js';
import { syncScene } from '../sim/game.js';
import { weekday, hm } from '../sim/time.js';
import { stateOf, closePlace, reopenPlace, hidePlace, describePlace, resetPlace, worldLog } from '../sim/placestate.js';
import { nowAbs } from '../core/store.js';
const PL = { id: '', q: '', why: '', days: '0', name: '', add: '' };
const open = (g, w, id) => { const p = w.places.find(x => x.id === id); const s = stateOf(g, id); Object.assign(PL, { id, why: s?.closed?.why ?? '', days: '0', name: s?.name ?? p?.name ?? '', add: s?.descAdd ?? '' }); };
export function tabPlaces(g, w) {
    const q = PL.q.trim().toLowerCase();
    const list = w.places.filter(p => !p.link && (!q || p.name.toLowerCase().includes(q) || (stateOf(g, p.id)?.name ?? '').toLowerCase().includes(q)));
    const log = worldLog(g).slice(-8).reverse();
    const row = (p) => {
        const s = stateOf(g, p.id), on = PL.id === p.id;
        const left = s?.closed?.until ? ` · ${Math.max(1, Math.ceil((s.closed.until - nowAbs(g)) / 1440))}d left` : '';
        const marks = [s?.closed ? `Closed${s.closed.why ? `: ${s.closed.why}` : ''}${left}` : '', s?.hidden ? 'Off the map' : '', s?.name ? `Was: ${p.name}` : '', s?.descAdd ? 'Looks different' : ''].filter(Boolean);
        return `<div class="mu-place ${on ? 'is-open' : ''} ${s ? 'is-changed' : ''}"><button class="mu-place-head" data-act="pl-open" data-id="${esc(p.id)}"><b data-notr>${esc(s?.name ?? p.name)}</b><small>${esc(marks.join(' · ') || 'As the world has it')}</small></button>
            ${on ? `<div class="mu-place-body">
                <label class="mu-field"><span>Name</span><input type="text" maxlength="60" value="${esc(PL.name)}" data-input="pl-text" data-key="name" data-focus="pl-name"></label>
                <label class="mu-field"><span>Added to its description</span><textarea rows="2" maxlength="300" placeholder="What is different about it now: the front window is boarded up; a new mural covers the wall." data-input="pl-text" data-key="add" data-focus="pl-add">${esc(PL.add)}</textarea></label>
                <div class="mu-row"><button class="mu-ghost" data-act="pl-save">Save name and description</button></div>
                <label class="mu-field"><span>${s?.closed ? 'Closed. Reason' : 'Close it. Reason'}</span><input type="text" maxlength="120" placeholder="repairs, a fire, sold…" value="${esc(PL.why)}" data-input="pl-text" data-key="why" data-focus="pl-why"></label>
                <div class="mu-row"><select data-input="pl-text" data-key="days">${[['0', 'Until I reopen it'], ['1', 'For a day'], ['3', 'For 3 days'], ['7', 'For a week'], ['30', 'For a month']].map(([v, l]) => `<option value="${v}" ${PL.days === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
                    <button class="mu-ghost" data-act="pl-close">${s?.closed ? 'Change' : 'Close it'}</button>${s?.closed ? '<button class="mu-ghost" data-act="pl-reopen">Reopen</button>' : ''}</div>
                <label class="mu-check"><input type="checkbox" data-input="pl-hide" ${s?.hidden ? 'checked' : ''}><span>Off the map<small>Gone for this game: nobody goes there and it is not on the map.</small></span></label>
                ${s ? '<div class="mu-row"><button class="mu-ghost" data-act="pl-reset">Back to how the world has it</button></div>' : ''}</div>` : ''}</div>`;
    };
    return `<section class="mu-wc-sec mu-places"><h4>Places</h4>
        <p class="mu-muted">What this game changed about the world's places. People stop going to a place that is closed or off the map, and the AI is told what changed. The world itself stays as it is, so a new game starts fresh.</p>
        <input type="search" placeholder="Search places" value="${esc(PL.q)}" data-input="pl-q" data-focus="pl-q">
        <div class="mu-place-list">${list.map(row).join('') || '<p class="mu-muted">No place by that name.</p>'}</div>
        ${log.length ? `<h4>Lately</h4><ul class="mu-place-log">${log.map(c => `<li><small>${esc(weekday(c.day).slice(0, 3))}, day ${c.day}, ${esc(hm(c.minutes))}</small> <span data-notr>${esc(c.text)}</span></li>`).join('')}</ul>` : ''}</section>`;
}
const ctx = () => { const g = game(); const w = g && getWorld(g.world); const p = w?.places.find(x => x.id === PL.id); return g && w && p ? { g, w, p } : null; };
const done = async () => { saveGame(); await syncScene(); refreshPrompt(); notify(); };
Object.assign(INPUT, {
    'pl-q': (el) => { PL.q = el.value; notify(); },
    'pl-text': (el) => { PL[el.dataset.key] = el.value; },
    'pl-hide': async (el) => {
        const c = ctx();
        if (!c)
            return;
        if (el.checked && c.g.player.loc === c.p.id) {
            toast('You are there right now: leave first.', 'info');
            notify();
            return;
        }
        hidePlace(c.g, c.p.id, c.p.name, el.checked);
        await done();
    },
});
Object.assign(ACT, {
    'pl-open': (el) => { const g = game(); const w = g && getWorld(g.world); if (!g || !w)
        return; if (PL.id === el.dataset.id)
        PL.id = '';
    else
        open(g, w, el.dataset.id); notify(); },
    'pl-save': async () => { const c = ctx(); if (!c)
        return; describePlace(c.g, c.p.id, c.p.name, { name: PL.name }); describePlace(c.g, c.p.id, c.p.name, { descAdd: PL.add }); toast('Saved.', 'success'); await done(); },
    'pl-close': async () => { const c = ctx(); if (!c)
        return; closePlace(c.g, c.p.id, stateOf(c.g, c.p.id)?.name ?? c.p.name, PL.why, Number(PL.days) || 0); toast(`${c.p.name} is closed.`, 'success'); await done(); },
    'pl-reopen': async () => { const c = ctx(); if (!c)
        return; reopenPlace(c.g, c.p.id, stateOf(c.g, c.p.id)?.name ?? c.p.name); PL.why = ''; await done(); },
    'pl-reset': async () => { const c = ctx(); if (!c)
        return; resetPlace(c.g, c.p.id, c.p.name); open(c.g, c.w, c.p.id); await done(); },
});
