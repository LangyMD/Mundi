// Someone's traits on their page in People (sim/persontraits.ts): what they are lately, how far along the ones you
// are bringing out by doing things together, and adding or removing one by hand.
import { esc, game, notify, saveGame, toast, type Save } from '../core/store.js';
import { getWorld, type WorldDef } from '../core/world.js';
import { ACT, INPUT } from './reg.js';
import { icon } from './icons.js';
import { refreshPrompt } from '../sim/prompt.js';
import { traitDefs, traitDef, keptTraits, activeTraits, isCareer, addTrait, removeTrait, makeTrait, progressOf, NEED, type HasTrait } from '../sim/persontraits.js';
import { nowAbs } from '../core/store.js';

const TR = { pick: '', name: '' };
const days = (g: Save, t: HasTrait) => (t.until ? ` · ${Math.max(1, Math.ceil((t.until - nowAbs(g)) / 1440))}d` : '');

export function personTraitsHtml(g: Save, w: WorldDef, who: string): string {
    const kept = keptTraits(g, who), jobs = activeTraits(g, who).filter(isCareer);
    const defs = traitDefs(g, w), free = defs.filter(d => !kept.some(t => t.id === d.id));
    const growing = defs.filter(d => d.kind === 'lasting' && !kept.some(t => t.id === d.id) && progressOf(g, who, d.id) > 0);
    return `<section class="mu-ptraits"><small class="mu-muted">Lately</small>
        <div class="mu-chips">${kept.map(t => { const d = traitDef(g, w, t.id); return `<span class="mu-chip is-on" title="${esc([d.desc, t.note, t.source === 'together' ? 'from what you do together' : ''].filter(Boolean).join(' · '))}">${esc(d.name)}${esc(days(g, t))}<button class="mu-ghost mu-ibtn" data-act="ptr-del" data-who="${esc(who)}" data-v="${esc(t.id)}" title="Remove">${icon('x')}</button></span>`; }).join('')}
            ${jobs.map(id => `<span class="mu-chip" title="From their job">${esc(traitDef(g, w, id).name)}</span>`).join('')}
            ${!kept.length && !jobs.length ? '<small class="mu-muted">Nothing in particular.</small>' : ''}</div>
        ${growing.length ? `<small class="mu-muted">Coming, from what you do together: ${growing.map(d => `${esc(d.name.toLowerCase())} ${progressOf(g, who, d.id)}/${d.need ?? NEED}`).join(', ')}</small>` : ''}
        <div class="mu-row"><select data-input="ptr-pick"><option value="">Add a trait…</option>${free.map(d => `<option value="${esc(d.id)}" ${TR.pick === d.id ? 'selected' : ''}>${esc(d.name)}${d.kind === 'state' ? ` (${d.days ?? 5} days)` : ''}</option>`).join('')}<option value="__new" ${TR.pick === '__new' ? 'selected' : ''}>One of my own…</option></select>
            ${TR.pick === '__new' ? `<input type="text" maxlength="40" placeholder="Its name" value="${esc(TR.name)}" data-input="ptr-name" data-focus="ptr-name">` : ''}
            <button class="mu-ghost" data-act="ptr-add" data-who="${esc(who)}" ${TR.pick ? '' : 'aria-disabled="true"'}>Add</button></div></section>`;
}

Object.assign(INPUT, {
    'ptr-pick': (el) => { TR.pick = el.value; notify(); },
    'ptr-name': (el) => { TR.name = el.value; },
});
Object.assign(ACT, {
    'ptr-add': (el) => {
        const g = game(); const w = g && getWorld(g.world); if (!g || !w || !TR.pick) return;
        const id = TR.pick === '__new' ? makeTrait(g, w, TR.name) : TR.pick;
        if (!id) { toast('Write a name for the trait.', 'info'); return; }
        addTrait(g, w, el.dataset.who!, id, { source: 'hand' });
        TR.pick = ''; TR.name = ''; refreshPrompt(); saveGame(); notify();
    },
    'ptr-del': (el) => { const g = game(); if (!g) return; removeTrait(g, el.dataset.who!, el.dataset.v!); refreshPrompt(); saveGame(); notify(); },
});
