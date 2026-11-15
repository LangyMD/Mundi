// Rooms inside a place (sim/interiors.ts), in the scene: the rooms you can walk to listed with the things to do, and
// the floor plan of the building (each room a box you can click, with who is in it).
import { esc, game, notify, saveGame, state, toast } from '../core/store.js';
import { getWorld, worldFile } from '../core/world.js';
import { ACT } from './reg.js';
import { icon } from './icons.js';
import { thumb } from '../st/bridge.js';
import { syncScene } from '../sim/game.js';
import { presentAt } from '../sim/people.js';
import { placeOf } from '../sim/places.js';
import { pictureAt } from '../sim/daynight.js';
import { spotAt, roomNow, roomOfPerson, canEnter, enterRoom, bedrooms } from '../sim/interiors.js';
const RM = { plan: false, floor: '' };
const lock = (g, w, p) => (canEnter(g, w, p.id).ok ? '' : p.access === 'staff' ? 'Staff only' : p.access === 'locked' ? 'Locked' : 'Private');
// whose bedroom it is, in a home ("Mia's")
const whose = (g, w, id) => { const o = bedrooms(g, w, g.player.loc)[id] ?? []; return o.length ? o.map(a => (a === '__you' ? 'Yours' : `${g.cast[a]?.name ?? ''}'s`)).join(' & ') : ''; };
const whoIn = (g, w) => { const by = {}; for (const r of presentAt(g, w, g.player.loc))
    (by[roomOfPerson(g, w, r, g.player.loc)] ??= []).push(r); return by; };
// Rows for the "Things to do" column: the other rooms of this building.
export function roomRows(g, w) {
    const rooms = spotAt(g, w, g.player.loc)?.rooms ?? [];
    if (rooms.length < 2)
        return [];
    const now = roomNow(g, w), by = whoIn(g, w);
    return [`<button class="mh-act mh-glass is-rooms" data-act="rm-plan"><i>${icon('map')}</i><b>Floor plan</b><small>${esc(rooms.find(r => r.id === now)?.name ?? '')}</small></button>`,
        ...rooms.filter(r => r.id !== now).map(r => {
            const l = lock(g, w, r), n = (by[r.id] ?? []).length;
            return `<button class="mh-act mh-glass is-room" data-act="rm-go" data-id="${esc(r.id)}" ${l ? 'aria-disabled="true"' : ''}><i>${l ? icon('lock') : '🚪'}</i><b data-notr>${esc(r.name)}</b><small>${esc(l || (n ? `${n} ${n === 1 ? 'person' : 'people'} there` : whose(g, w, r.id) || 'Go there'))}</small></button>`;
        })];
}
// The floor plan, over the scene.
export function roomsPlanHtml() {
    const g = game();
    const w = g && getWorld(g.world);
    if (!g || !w || !RM.plan || state.view !== 'scene')
        return '';
    const it = spotAt(g, w, g.player.loc);
    if (!it)
        return '';
    const here = placeOf(g, w, g.player.loc), now = roomNow(g, w), by = whoIn(g, w);
    const floorId = it.floors.some(f => f.id === RM.floor) ? RM.floor : it.boxes.find(r => r.id === now)?.floor ?? it.floors[0]?.id ?? '';
    const floor = it.floors.find(f => f.id === floorId);
    const img = floor ? pictureAt(w, g.minutes, floor.image, floor.images) : '';
    const boxes = it.boxes.filter(r => r.floor === floorId).map(r => {
        const p = it.rooms.find(x => x.id === r.id);
        if (!p)
            return '';
        const l = lock(g, w, p), people = by[r.id] ?? [];
        return `<button class="mu-room-box ${r.id === now ? 'is-here' : ''} ${l ? 'is-shut' : ''}" style="left:${r.x}%;top:${r.y}%;width:${r.w}%;height:${r.h}%" data-act="rm-go" data-id="${esc(r.id)}" ${l || r.id === now ? 'aria-disabled="true"' : ''} title="${esc(l || p.desc || '')}">
            <b data-notr>${esc(p.name)}</b>${l || whose(g, w, r.id) ? `<small>${esc(l || whose(g, w, r.id))}</small>` : ''}<span>${r.id === now ? '<em>You</em>' : ''}${people.slice(0, 4).map(x => x.met ? `<img src="${esc(thumb(x.avatar))}" alt="${esc(x.name)}" title="${esc(x.name)}">` : '<i title="Someone you have not met">?</i>').join('')}${people.length > 4 ? `<em>+${people.length - 4}</em>` : ''}</span></button>`;
    }).join('');
    return `<div class="mu-recap-veil" data-act="rm-plan"><section class="mu-recap mh-glass mu-rooms" role="dialog" aria-label="Floor plan" data-act="rm-keep">
        <header><small>Floor plan</small><h3 data-notr>${esc(here?.name ?? '')}</h3></header>
        ${it.floors.length > 1 ? `<nav class="mu-sec-tabs">${it.floors.map(f => `<button class="${f.id === floorId ? 'is-on' : ''}" data-act="rm-floor" data-id="${esc(f.id)}" data-notr>${esc(f.name)}</button>`).join('')}</nav>` : ''}
        <div class="mu-room-plan" style="aspect-ratio:${Number(floor?.ratio) > 0 ? Number(floor.ratio) : 1.6};${img ? `background-image:url('${worldFile(w, img)}')` : ''}">${boxes}</div>
        <button class="mu-ghost" data-act="rm-plan">Close</button></section></div>`;
}
Object.assign(ACT, {
    'rm-plan': (el, e) => { if (el.classList.contains('mu-recap-veil') && e?.target?.closest?.('.mu-rooms'))
        return; RM.plan = !RM.plan; RM.floor = ''; notify(); },
    'rm-keep': () => { },
    'rm-floor': (el, e) => { e?.stopPropagation?.(); RM.floor = el.dataset.id ?? ''; notify(); },
    'rm-go': async (el, e) => {
        e?.stopPropagation?.();
        const g = game();
        const w = g && getWorld(g.world);
        if (!g || !w)
            return;
        if (state.generating) {
            toast('Wait until they finish speaking.', 'info');
            return;
        }
        const why = enterRoom(g, w, el.dataset.id);
        if (why) {
            toast(why, 'info');
            return;
        }
        RM.plan = false;
        saveGame();
        await syncScene();
        notify();
    },
});
