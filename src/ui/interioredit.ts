// The world creator's Rooms tab (sim/interiors.ts has the rules): the rooms inside a place of the map, or a plan of
// rooms for homes. Pick what to edit at the top; add floors (each with an optional picture of the plan); add rooms
// and drag their boxes where they are on the floor (drag the corner to resize). A room of a building is a place of
// its own (name, description, tags, who may go in); a room of a home plan is the same for every home that uses the
// plan, with bedrooms handed out to the household.
import { notify, esc, toast, ROOT_ID } from '../core/store.js';
import { safeUrl } from '../core/safe.js';
import { worldFile, type WorldDef, type Place, type HomePlan } from '../core/world.js';
import { uploadWorldPicture, imageRatio, newId } from '../sim/creator.js';
import { pickFile } from './cropper.js';
import { CATEGORIES, categoryName } from '../sim/looks.js';
import { icon } from './icons.js';
import { ACT, INPUT } from './reg.js';
import { CW, W, txt, area, num, chk, getPath, setPath } from './creator.js';

export const IE = { target: '', floor: '', sel: '' };
type Box = { id: string; floor: string; x: number; y: number; w: number; h: number };
type Floor = { id: string; name: string; image?: string; images?: Record<string, string>; ratio?: number };
type Inside = { entry: string; floors: Floor[]; rooms: Box[]; templates?: HomePlan['templates']; name?: string };
/** What is being edited: `path` is where its rooms live in the world file ('' until it has any). */
interface Target { key: string; label: string; path: string; home: boolean; it: Inside | null; building?: Place }

export const WEAR: [string, string][] = [['', 'Guessed from the tags and the name'], ['indoors', 'Indoors: everyday clothes'], ['outdoors', 'Outdoors: by the weather'], ...CATEGORIES.filter(c => c !== 'everyday').map(c => [c, categoryName(c)] as [string, string])];
const plans = (w: WorldDef) => ((w.homes as any).plans ?? {}) as Record<string, HomePlan>;
const kindPlan = (k: any): HomePlan | null => (k?.interior && typeof k.interior === 'object' ? k.interior : null);

export function targets(w: WorldDef): Target[] {
    const out: Target[] = [];
    w.places.forEach((p, i) => { if (!(p as any).in && !p.link) out.push({ key: `place:${p.id}`, label: p.name, path: `places.${i}.interior`, home: false, it: (p.interior as Inside | undefined) ?? null, building: p }); });
    for (const [id, pl] of Object.entries(plans(w))) out.push({ key: `plan:${id}`, label: pl.name || id, path: `homes.plans.${id}`, home: true, it: pl as Inside });
    for (const [id, k] of Object.entries(w.homes.kinds)) { const pl = kindPlan(k); if (pl) out.push({ key: `kind:${id}`, label: `${k.name} (its own rooms)`, path: `homes.kinds.${id}.interior`, home: true, it: pl as Inside }); }
    return out;
}
function current(w: WorldDef): Target | null {
    const all = targets(w);
    const t = all.find(x => x.key === IE.target) ?? all.find(x => x.it) ?? all[0] ?? null;
    IE.target = t?.key ?? '';
    return t;
}
// The rooms of the target as the editor lists them: a building's rooms are places (`in`), a plan's are its templates.
interface RoomRow { id: string; name: string; path: string; bedroom: boolean }
function roomRows(w: WorldDef, t: Target): RoomRow[] {
    if (t.home) return (t.it?.templates ?? []).map((r, i) => ({ id: r.id, name: r.name, path: `${t.path}.templates.${i}`, bedroom: !!r.owner || !!r.guest }));
    return w.places.map((p, i) => ({ p, i })).filter(x => (x.p as any).in === t.building!.id).map(x => ({ id: x.p.id, name: x.p.name, path: `places.${x.i}`, bedroom: false }));
}
const opt = (label: string, p: string, opts: [string, string][], hint = '') => `<label class="mu-field"><span>${label}</span><select data-input="ie-opt" data-path="${esc(p)}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(getPath(p) ?? '') === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>${hint ? `<small class="mu-muted">${hint}</small>` : ''}</label>`;
const tagsField = (p: string) => `<label class="mu-field"><span>Kinds of room (tags, comma separated)</span><input data-input="cw" data-type="csv" data-path="${esc(p)}.tags" data-focus="${esc(p)}.tags" value="${esc((getPath(`${p}.tags`) ?? []).join(', '))}" placeholder="bath, kitchen, bedroom…"><small class="mu-muted">A thing to do can ask for a kind of room (Things to do › Only in rooms tagged).</small></label>`;

function picker(w: WorldDef, t: Target | null): string {
    const all = targets(w);
    const group = (label: string, list: Target[]) => (list.length ? `<optgroup label="${esc(label)}">${list.map(x => `<option value="${esc(x.key)}" ${x.key === t?.key ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</optgroup>` : '');
    return `<div class="mu-ie-pick"><label class="mu-field"><span>Rooms of</span><select data-input="ie-target">
        ${group('Homes', all.filter(x => x.home))}${group('Places with rooms', all.filter(x => !x.home && x.it))}${group('Places without rooms yet', all.filter(x => !x.home && !x.it))}</select></label>
        <button class="mu-ghost" data-act="ie-plan-add">${icon('plus')}<span>New plan for homes</span></button></div>`;
}

// Which homes use a plan: kinds of home, and addresses one by one.
function usedBy(w: WorldDef, id: string): string {
    const kinds = Object.entries(w.homes.kinds);
    return `<section class="mu-pe-card"><h4>Homes with these rooms</h4>
        ${kinds.length ? `<small class="mu-muted">Every home of this kind:</small><div class="mu-chips">${kinds.map(([k, d]) => `<button class="mu-chip ${(d as any).interior === id ? 'is-on' : ''}" data-act="ie-use-kind" data-k="${esc(k)}" ${kindPlan(d) ? 'aria-disabled="true" title="This kind has rooms of its own"' : ''}>${esc(d.name)}</button>`).join('')}</div>` : ''}
        ${w.homes.zones.map((z, zi) => { const ins = ((z as any).interiors ?? {}) as Record<string, string>;
            return `<small class="mu-muted" data-notr>${esc(z.name)}, home by home:</small><div class="mu-chips">${z.spots.map((_s, si) => `<button class="mu-chip ${ins[String(si)] === id ? 'is-on' : ''}" data-act="ie-use-spot" data-z="${zi}" data-s="${si}" title="${ins[String(si)] && ins[String(si)] !== id ? esc(`Now: ${plans(w)[ins[String(si)]]?.name ?? ins[String(si)]}`) : ''}">${si + 1}</button>`).join('')}
                ${z.spots.length > 1 ? `<button class="mu-chip" data-act="ie-use-zone" data-z="${zi}" data-v="1">All</button><button class="mu-chip" data-act="ie-use-zone" data-z="${zi}" data-v="0">None</button>` : ''}</div>`; }).join('')}
        <small class="mu-muted">An address with a plan of its own uses it; otherwise the plan of its kind of home; otherwise the home has no rooms.</small></section>`;
}

export function interiorEditorHtml(w: WorldDef): string {
    const t = current(w);
    if (!t) return `<div class="mu-pe is-empty"><div class="mu-pe-intro"><h3>Rooms</h3><p class="mu-muted">Add a place on the map first (Maps &amp; places), or start a plan of rooms for homes.</p><button class="mu-primary" data-act="ie-plan-add">${icon('plus')}<span>New plan for homes</span></button></div></div>`;
    const it = t.it;
    if (!it || !it.floors?.length) return `<div class="mu-pe-wrap">${picker(w, t)}<div class="mu-pe is-empty"><div class="mu-pe-intro"><h3 data-notr>${esc(t.label)}</h3>
        <p class="mu-muted">${t.home ? 'This plan has no floors yet.' : 'This place is one scene: everyone who is there is together. With rooms, you arrive in its entry, walk between its rooms, and the scene holds only the people in your room.'}</p>
        <button class="mu-primary" data-act="ie-start">${icon('plus')}<span>${t.home ? 'Add the first floor' : 'Give it rooms'}</span></button></div></div></div>`;
    const floor = it.floors.find(f => f.id === IE.floor) ?? it.floors[0]; IE.floor = floor.id;
    const fi = it.floors.indexOf(floor);
    const rows = roomRows(w, t);
    const boxOf = (id: string) => it.rooms.find(r => r.id === id && it.floors.some(f => f.id === r.floor));
    const sel = rows.find(r => r.id === IE.sel) ?? null; if (!sel) IE.sel = '';
    const selBox = sel ? boxOf(sel.id) : null;
    const boxes = it.rooms.filter(r => r.floor === floor.id && rows.some(x => x.id === r.id)).map(r => { const row = rows.find(x => x.id === r.id)!;
        return `<div class="mu-pe-room ${IE.sel === r.id ? 'is-sel' : ''} ${row.bedroom ? 'is-bed' : ''}" data-ie-room="${esc(r.id)}" style="left:${r.x}%;top:${r.y}%;width:${r.w}%;height:${r.h}%"><b data-notr>${it.entry === r.id ? '🚪 ' : ''}${esc(row.name)}</b><i class="mu-pe-handle" data-ie-handle></i></div>`; }).join('');
    const list = rows.map(r => { const at = boxOf(r.id); const f = at ? it.floors.find(x => x.id === at.floor) : null;
        return `<button class="mu-pe-item ${IE.sel === r.id ? 'is-on' : ''} ${at ? '' : 'is-lost'}" data-act="ie-pick" data-id="${esc(r.id)}" title="${at ? `On ${esc(f!.name)}` : 'Not on a floor: click to put it on this one.'}">${at ? '<i class="mu-pe-dot"></i>' : '<b class="mu-plan-bang">!</b>'}<span data-notr>${it.entry === r.id ? '🚪 ' : ''}${esc(r.name)}</span>${at && f!.id !== floor.id ? `<small data-notr>${esc(f!.name)}</small>` : ''}</button>`; }).join('');
    const p = sel?.path ?? '';
    const bg = sel ? String(getPath(`${p}.bg`) ?? '') : '';
    const form = !sel ? '' : `<section class="mu-pe-card is-sel"><h4 data-notr>${esc(sel.name)}</h4>
        ${txt('Name', `${p}.name`)}${area('Description (the AI is told)', `${p}.desc`, 2)}${tagsField(p)}
        ${opt('Who may go in', `${p}.access`, t.home ? [['', 'Anyone in the home'], ['private', 'The household (and whoever is close to them)'], ['locked', 'Nobody: it is locked']] : [['', 'Anyone'], ['staff', 'The people who work here (and you, if you do)'], ['private', 'Nobody but whose room it is'], ['locked', 'Nobody: it is locked']])}
        ${t.home ? `${opt('A bedroom', `${p}.owner`, [['', 'No'], ['one', 'One person\'s'], ['couple', 'A couple\'s (holds two)']], 'Bedrooms are handed out to the people who live in the home. Theirs opens to you when you are close.')}
            ${chk('A guest room', `${p}.guest`, 'Nobody of the household takes it.')}${num('The flat it belongs to (a duplex: 1 or 2; empty: shared)', `${p}.unit`, 1)}` : ''}
        ${opt('What people wear in it', `${p}.wear`, WEAR)}
        ${selBox ? `<label class="mu-field"><span>Floor</span><select data-input="ie-room-floor">${it.floors.map(f => `<option value="${esc(f.id)}" ${f.id === selBox.floor ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>` : ''}
        <div class="mu-row"><button class="mu-ghost" data-act="ie-room-bg">${icon('image')}<span>${bg ? 'Change its picture' : 'Its picture (the scene)'}</span></button>${bg ? `<div class="mu-cw-cover is-mini" style="background-image:url('${safeUrl(worldFile(w, bg))}')"></div><button class="mu-ghost mu-ibtn" data-act="ie-room-bg-clear" title="No picture of its own">${icon('x')}</button>` : ''}</div>
        <div class="mu-row"><button class="${it.entry === sel.id ? 'is-on' : 'mu-ghost'}" data-act="ie-entry">🚪<span>${it.entry === sel.id ? 'You come in here' : 'Make it the entry'}</span></button><button class="mu-danger mu-right" data-act="ie-room-del">${icon('trash')}<span>Remove room</span></button></div>
        <small class="mu-muted">Drag the box to move it, its corner to resize it.</small></section>`;
    return `<div class="mu-pe-wrap">${picker(w, t)}<div class="mu-pe">
        <div class="mu-pe-top"><nav class="mu-pe-floors">${it.floors.map(f => `<button class="${f.id === floor.id ? 'is-on' : ''}" data-act="ie-floor" data-id="${esc(f.id)}" data-notr>${esc(f.name)}</button>`).join('')}<button class="mu-ghost" data-act="ie-floor-add" title="Add a floor">${icon('plus')}<span>Floor</span></button></nav>
            ${it.entry && rows.some(r => r.id === it.entry) ? '' : '<small class="mu-plan-bang" style="width:auto;padding:0 8px">No entry room yet: pick a room and make it the entry.</small>'}</div>
        <div class="mu-pe-main">
            <div class="mu-pe-stage"><div class="mu-pe-plan ${floor.image ? 'has-pic' : ''}" data-ie-plan style="--r:${floor.ratio ?? 1.6};${floor.image ? `background-image:url('${safeUrl(worldFile(w, floor.image))}')` : ''}">${boxes}${boxes ? '' : '<p class="mu-pe-hint">Add a room on the right: it appears here as a box.</p>'}</div></div>
            <aside class="mu-pe-side">
                ${t.home && t.key.startsWith('plan:') ? `<section class="mu-pe-card"><h4>This plan</h4>${txt('Name', `${t.path}.name`)}<button class="mu-danger" data-act="ie-plan-del">${icon('trash')}<span>Remove the plan</span></button></section>` : ''}
                ${form}
                <section class="mu-pe-card"><h4>Rooms</h4><div class="mu-pe-list">${list || '<small class="mu-muted">No rooms yet.</small>'}</div>
                    <button class="mu-primary" data-act="ie-room-add">${icon('plus')}<span>Add a room</span></button></section>
                <section class="mu-pe-card"><h4>This floor</h4>
                    ${txt('Name', `${t.path}.floors.${fi}.name`)}
                    <div class="mu-row"><button class="mu-ghost" data-act="ie-floor-pic">${icon('image')}<span>${floor.image ? 'Change the plan picture' : 'Picture of the plan (optional)'}</span></button>${floor.image ? `<button class="mu-ghost mu-ibtn" data-act="ie-floor-pic-clear" title="No picture (a blueprint)">${icon('x')}</button>` : ''}</div>
                    <div class="mu-row">${fi > 0 ? `<button class="mu-ghost mu-ibtn" data-act="ie-floor-move" data-d="-1" title="Earlier in the list">${icon('back')}</button>` : ''}${fi < it.floors.length - 1 ? `<button class="mu-ghost mu-ibtn" data-act="ie-floor-move" data-d="1" title="Later in the list" style="transform:scaleX(-1)">${icon('back')}</button>` : ''}
                        <button class="mu-danger mu-right" data-act="ie-floor-del">${icon('trash')}<span>Remove floor</span></button></div></section>
                ${t.key.startsWith('plan:') ? usedBy(w, t.key.slice(5)) : ''}
                ${!t.home ? `<section class="mu-pe-card"><button class="mu-danger" data-act="ie-clear">${icon('trash')}<span>Remove all the rooms of this place</span></button></section>` : ''}
            </aside></div></div></div>`;
}

/* ---------- changing the data ---------- */

// The target's rooms, made when missing (a building's `interior`, a new plan).
function inside(w: WorldDef, t: Target): Inside {
    if (t.it) return t.it;
    const it: Inside = { entry: '', floors: [], rooms: [] };
    setPath(t.path, it);
    return getPath(t.path) as Inside;
}
function freeSpot(it: Inside, floor: string): { x: number; y: number } {
    const on = it.rooms.filter(r => r.floor === floor);
    for (let y = 4; y <= 76; y += 24) for (let x = 3; x <= 75; x += 24) if (!on.some(r => x < r.x + r.w && x + 22 > r.x && y < r.y + r.h && y + 20 > r.y)) return { x, y };
    return { x: 39, y: 40 };
}
const dirty = () => { CW.dirty = true; notify(); };
// Removes a room everywhere it is named: its box, its place or template, the entry, jobs done in it.
function dropRoom(w: WorldDef, t: Target, id: string) {
    const it = t.it; if (!it) return;
    it.rooms = it.rooms.filter(r => r.id !== id);
    if (t.home) it.templates = (it.templates ?? []).filter(r => r.id !== id);
    else { w.places = w.places.filter(p => p.id !== id); for (const o of w.occupations as any[]) if (o.room === id) delete o.room; }
    if (it.entry === id) it.entry = roomRows(w, t).find(r => r.id !== id)?.id ?? '';
}
// Removes a plan of homes, and every home's mention of it.
function dropPlan(w: WorldDef, id: string) {
    delete plans(w)[id];
    if (!Object.keys(plans(w)).length) delete (w.homes as any).plans;
    for (const k of Object.values(w.homes.kinds) as any[]) if (k.interior === id) delete k.interior;
    for (const z of w.homes.zones as any[]) { for (const [s, v] of Object.entries(z.interiors ?? {})) if (v === id) delete z.interiors[s]; if (z.interiors && !Object.keys(z.interiors).length) delete z.interiors; }
}

const snap = (v: number) => Math.round(v * 2) / 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
let drag: { id: string; el: HTMLElement; plan: HTMLElement; resize: boolean; sx: number; sy: number; r: Box; moved: boolean } | null = null;
const boxNow = (id: string) => { const t = CW.w ? current(CW.w) : null; return t?.it?.rooms.find(x => x.id === id) ?? null; };
document.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement;
    const box = t.closest?.<HTMLElement>(`#${ROOT_ID} [data-ie-room]`); if (!box || !CW.w) return;
    const planEl = box.closest<HTMLElement>('[data-ie-plan]'); const r = boxNow(box.dataset.ieRoom!); if (!planEl || !r) return;
    drag = { id: r.id, el: box, plan: planEl, resize: !!t.closest('[data-ie-handle]'), sx: e.clientX, sy: e.clientY, r: { ...r }, moved: false };
    box.setPointerCapture?.(e.pointerId); e.preventDefault();
});
document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 3) return;
    drag.moved = true;
    const b = drag.plan.getBoundingClientRect();
    const dx = ((e.clientX - drag.sx) / b.width) * 100, dy = ((e.clientY - drag.sy) / b.height) * 100;
    const r = drag.r;
    if (drag.resize) { drag.el.style.width = `${clamp(snap(r.w + dx), 5, 100 - r.x)}%`; drag.el.style.height = `${clamp(snap(r.h + dy), 5, 100 - r.y)}%`; }
    else { drag.el.style.left = `${clamp(snap(r.x + dx), 0, 100 - r.w)}%`; drag.el.style.top = `${clamp(snap(r.y + dy), 0, 100 - r.h)}%`; }
});
document.addEventListener('pointerup', () => {
    if (!drag) return;
    const d = drag; drag = null;
    const r = boxNow(d.id); if (!r) return;
    if (d.moved) { r.x = parseFloat(d.el.style.left); r.y = parseFloat(d.el.style.top); r.w = parseFloat(d.el.style.width); r.h = parseFloat(d.el.style.height); CW.dirty = true; }
    IE.sel = d.id; notify();
});
document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.matches?.(`#${ROOT_ID} [data-ie-plan]`) && IE.sel) { IE.sel = ''; notify(); }
});

const asked = new Map<string, number>();
function confirmTwice(key: string, msg: string) {
    const t = asked.get(key) ?? 0;
    if (Date.now() - t < 5000) { asked.delete(key); return true; }
    asked.set(key, Date.now()); toast(msg, 'warn'); return false;
}

Object.assign(INPUT, {
    'ie-target': (el) => { IE.target = el.value; IE.floor = ''; IE.sel = ''; notify(); },
    // a choice where the first option means "not set": the field is left out of the world file
    'ie-opt': (el) => { setPath(el.dataset.path!, el.value === '' ? undefined : el.value); notify(); },
    'ie-room-floor': (el) => { const r = boxNow(IE.sel); if (!r) return; r.floor = el.value; IE.floor = el.value; dirty(); },
});
Object.assign(ACT, {
    'ie-start': () => { const w = W(); const t = current(w); if (!t) return; const it = inside(w, t); const f = { id: newId('floor'), name: 'Ground floor' }; it.floors.push(f); IE.floor = f.id; dirty(); },
    'ie-plan-add': () => {
        const w = W(); const id = newId('plan');
        (((w.homes as any).plans ??= {}) as Record<string, HomePlan>)[id] = { name: `Home plan ${Object.keys(plans(w)).length + 1}`, entry: '', floors: [{ id: newId('floor'), name: 'Ground floor' }], rooms: [], templates: [] };
        IE.target = `plan:${id}`; IE.floor = ''; IE.sel = ''; dirty();
    },
    'ie-plan-del': () => {
        const w = W(); const t = current(w); if (!t?.key.startsWith('plan:')) return;
        if (!confirmTwice(`ie-plan-${t.key}`, `Click again to remove "${t.label}". The homes that use it will have no rooms.`)) return;
        dropPlan(w, t.key.slice(5)); IE.target = ''; IE.floor = ''; IE.sel = ''; dirty();
    },
    'ie-clear': () => {
        const w = W(); const t = current(w); if (!t?.building || !t.it) return;
        if (!confirmTwice(`ie-clear-${t.key}`, `Click again to remove every room of ${t.label}. It becomes one scene again.`)) return;
        for (const r of roomRows(w, t)) dropRoom(w, t, r.id);
        delete (w.places.find(p => p.id === t.building!.id) as any)?.interior;
        IE.floor = ''; IE.sel = ''; dirty();
    },
    'ie-floor': (el) => { IE.floor = el.dataset.id!; notify(); },
    'ie-floor-add': () => { const w = W(); const t = current(w); if (!t) return; const it = inside(w, t); const f = { id: newId('floor'), name: `Floor ${it.floors.length + 1}` }; it.floors.push(f); IE.floor = f.id; dirty(); },
    'ie-floor-del': () => {
        const w = W(); const t = current(w); const it = t?.it; const f = it?.floors.find(x => x.id === IE.floor); if (!t || !it || !f) return;
        const on = it.rooms.filter(r => r.floor === f.id);
        if (on.length && !confirmTwice(`ie-fdel-${f.id}`, `${on.length} rooms are on ${f.name}. Click again to remove the floor and its rooms.`)) return;
        for (const r of on) dropRoom(w, t, r.id);
        it.floors = it.floors.filter(x => x.id !== f.id); IE.floor = it.floors[0]?.id ?? ''; IE.sel = ''; dirty();
    },
    'ie-floor-move': (el) => { const it = current(W())?.it; if (!it) return; const i = it.floors.findIndex(x => x.id === IE.floor), j = i + Number(el.dataset.d); if (i < 0 || j < 0 || j >= it.floors.length) return; [it.floors[i], it.floors[j]] = [it.floors[j], it.floors[i]]; dirty(); },
    'ie-floor-pic': async () => {
        const w = W(); const f = current(w)?.it?.floors.find(x => x.id === IE.floor); if (!f) return;
        const file = await pickFile('image/*'); if (!file) return;
        try { f.image = await uploadWorldPicture(w, file, `rooms-${f.id}`); f.ratio = await imageRatio(f.image); CW.dirty = true; } catch (e: any) { toast(String(e?.message ?? e), 'error'); }
        notify();
    },
    'ie-floor-pic-clear': () => { const f = current(W())?.it?.floors.find(x => x.id === IE.floor); if (!f) return; delete f.image; delete f.ratio; delete f.images; dirty(); },
    'ie-room-add': () => {
        const w = W(); const t = current(w); if (!t) return; const it = inside(w, t); if (!it.floors.length) return;
        const floor = it.floors.find(f => f.id === IE.floor)?.id ?? it.floors[0].id;
        const id = newId('room'), n = roomRows(w, t).length + 1;
        if (t.home) (it.templates ??= []).push({ id, name: n === 1 ? 'Living room' : `Room ${n}` });
        else { const b = t.building!; w.places.push({ id, name: n === 1 ? 'Entrance' : `Room ${n}`, map: b.map, x: b.x, y: b.y, in: b.id, desc: '', tags: [] } as Place); }
        it.rooms.push({ id, floor, ...freeSpot(it, floor), w: 22, h: 20 });
        if (!it.entry) it.entry = id;
        IE.sel = id; dirty();
    },
    'ie-room-del': () => { const w = W(); const t = current(w); if (!t || !IE.sel) return; dropRoom(w, t, IE.sel); IE.sel = ''; dirty(); },
    'ie-pick': (el) => {
        const it = current(W())?.it; if (!it) return; const id = el.dataset.id!;
        const at = it.rooms.find(r => r.id === id && it.floors.some(f => f.id === r.floor));
        if (at) { IE.floor = at.floor; IE.sel = id; notify(); return; }
        it.rooms = it.rooms.filter(r => r.id !== id);
        it.rooms.push({ id, floor: IE.floor, ...freeSpot(it, IE.floor), w: 22, h: 20 });
        IE.sel = id; dirty();
    },
    'ie-entry': () => { const it = current(W())?.it; if (!it || !IE.sel) return; it.entry = IE.sel; dirty(); },
    'ie-room-bg': async () => {
        const w = W(); const t = current(w); const row = t && roomRows(w, t).find(r => r.id === IE.sel); if (!row) return;
        const file = await pickFile('image/*'); if (!file) return;
        try { setPath(`${row.path}.bg`, await uploadWorldPicture(w, file, `room-${row.id}`)); } catch (e: any) { toast(String(e?.message ?? e), 'error'); }
        notify();
    },
    'ie-room-bg-clear': () => { const w = W(); const t = current(w); const row = t && roomRows(w, t).find(r => r.id === IE.sel); if (!row) return; setPath(`${row.path}.bg`, undefined); setPath(`${row.path}.bgs`, undefined); notify(); },
    'ie-use-kind': (el) => { const w = W(); const t = current(w); const k = w.homes.kinds[el.dataset.k!] as any; if (!t?.key.startsWith('plan:') || !k || kindPlan(k)) return; const id = t.key.slice(5); if (k.interior === id) delete k.interior; else k.interior = id; dirty(); },
    'ie-use-spot': (el) => {
        const w = W(); const t = current(w); const z = w.homes.zones[Number(el.dataset.z)] as any; if (!t?.key.startsWith('plan:') || !z) return;
        const id = t.key.slice(5), s = String(el.dataset.s); const ins = (z.interiors ??= {}) as Record<string, string>;
        if (ins[s] === id) delete ins[s]; else ins[s] = id;
        if (!Object.keys(ins).length) delete z.interiors;
        dirty();
    },
    'ie-use-zone': (el) => {
        const w = W(); const t = current(w); const z = w.homes.zones[Number(el.dataset.z)] as any; if (!t?.key.startsWith('plan:') || !z) return;
        const id = t.key.slice(5); const ins = (z.interiors ??= {}) as Record<string, string>;
        z.spots.forEach((_s: unknown, i: number) => { if (el.dataset.v === '1') ins[String(i)] = id; else if (ins[String(i)] === id) delete ins[String(i)]; });
        if (!Object.keys(ins).length) delete z.interiors;
        dirty();
    },
});
