// Your own clothes, by hand (sim/looks.ts): the kind of outfit and the layer, from the game menu. Set by hand it
// stays until you give it back to the game ("As the moment asks"), the same as for a character's picture.
import { esc, game, notify, saveGame, toast, type Save } from '../core/store.js';
import { getWorld } from '../core/world.js';
import { ACT } from './reg.js';
import { icon } from './icons.js';
import { personaName } from '../st/bridge.js';
import { refreshPrompt } from '../sim/prompt.js';
import { CATEGORIES, LAYERS, LAYER_NAME, PLAYER, categoryName, lookOf, looks, lookWords, setLook, unlockLook, type Layer } from '../sim/looks.js';
import { worldCategories } from './watchui.js';

const MC = { open: false };
export const myLookWords = (g: Save) => lookWords(PLAYER, lookOf(g, PLAYER));

export function myClothesHtml(): string {
    const g = game(); const w = g && getWorld(g.world);
    if (!MC.open || !g || !w) return '';
    const cur = lookOf(g, PLAYER), l = looks(g)[PLAYER], locked = !!l?.lock;
    const cats = [...CATEGORIES, ...worldCategories(w)]; if (!cats.includes(cur.category)) cats.push(cur.category);
    const chip = (k: string, v: string, label: string, on: boolean) => `<button class="mu-chip ${on ? 'is-on' : ''}" data-act="mc-set" data-k="${k}" data-v="${esc(v)}">${esc(label)}</button>`;
    return `<div class="mu-dlg-veil" data-act="mc-close"></div><div class="mu-panel mu-scpick mu-glassdlg mu-myclothes" role="dialog"><header><h3>Your clothes</h3><button class="mu-ibtn mu-ghost" data-act="mc-close" aria-label="Close">${icon('x')}</button></header>
        <p class="mu-muted"><span data-notr>${esc(personaName())}</span> is in ${esc(myLookWords(g))}${cur.why ? ` (${esc(cur.why)})` : ''}. ${locked ? (l?.story ? 'Changed in the story: it stays while you are here.' : 'Chosen by you: it stays until you give it back to the game.') : 'The game changes it as the moment asks.'}</p>
        <div><small class="mu-muted">Outfit</small><div class="mu-chips">${cats.map(c => chip('cat', c, categoryName(c), cur.category === c)).join('')}</div></div>
        <div><small class="mu-muted">How much of it</small><div class="mu-chips">${LAYERS.map(x => chip('layer', x, LAYER_NAME[x], cur.layer === x)).join('')}</div></div>
        <div class="mu-row mu-dlg-btns"><button data-act="mc-set" data-k="auto" class="${locked ? '' : 'is-on'}">✨ As the moment asks</button><button class="mu-primary" data-act="mc-close">Done</button></div></div>`;
}

Object.assign(ACT, {
    'mc-open': () => { MC.open = true; notify(); },
    'mc-close': () => { MC.open = false; notify(); },
    'mc-set': (el) => {
        const g = game(); if (!g) return;
        const cur = lookOf(g, PLAYER);
        if (el.dataset.k === 'auto') { unlockLook(g, PLAYER); toast('You dress as the moment asks again.', 'success'); void import('../sim/game.js').then(m => m.syncScene()).then(notify); }
        else {
            const category = el.dataset.k === 'cat' ? el.dataset.v! : cur.category;
            const layer = el.dataset.k === 'layer' ? el.dataset.v as Layer : cur.layer === 'outer' ? 'normal' : cur.layer;
            setLook(g, PLAYER, category, layer, 'you chose it', true);
            if (el.dataset.k === 'layer' && lookOf(g, PLAYER).layer !== layer) toast(`There is no outerwear over ${categoryName(category).toLowerCase()} clothes.`, 'info');
            refreshPrompt();
        }
        saveGame(); notify();
    },
});
