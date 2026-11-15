// The Photos app on the phone: the pictures of this game by person (sim/photos.ts). Tap a person, then a picture;
// on a picture you can say who is in it.
import { esc, game, notify, saveGame } from '../core/store.js';
import { fmtDate } from '../core/fmt.js';
import { chat, thumb, personaName, personaThumb } from '../st/bridge.js';
import { residents } from '../sim/people.js';
import { feed } from '../sim/feed.js';
import { photosOf } from './gallery.js';
import { icon } from './icons.js';
import { ACT } from './reg.js';
import { shots, albums, shotsOf, toggleTag, clearTag, photoTags, ME } from '../sim/photos.js';
export const PH = { who: null, url: '', tagging: false };
function all(g) {
    const raw = [];
    chat().forEach((m, i) => {
        const at = Date.parse(String(m?.send_date ?? '')) || i;
        for (const p of photosOf(m, at))
            raw.push({ url: p.url, caption: p.caption, at: p.at, by: p.who, mine: !!m.is_user, source: 'chat', look: m?.extra?.mundi_look });
    });
    // Chirp keeps the game's clock, the chat the real one: posts are placed by when the game saw them, after the chat
    const base = raw.reduce((n, r) => Math.max(n, r.at), 0);
    feed(g).posts.forEach((p, i) => { if (p.image)
        raw.push({ url: p.image, caption: p.text.slice(0, 140), at: base + i + 1, by: p.by, mine: p.by === 'me' || p.by === ME, source: 'chirp' }); });
    const cast = residents(g);
    const avatarOf = (by) => (g.cast[by] ? by : cast.find(r => r.name === by)?.avatar ?? '');
    return shots(raw, avatarOf, photoTags(g));
}
export const photoCount = (g, who) => shotsOf(all(g), who).length;
const nameOf = (g, who) => (who === ME ? personaName() : who === '' ? 'Other pictures' : g.cast[who]?.name ?? 'Someone');
const picOf = (who) => (who === ME ? personaThumb() : thumb(who));
export function photosApp(g, _w, head) {
    const list = all(g);
    if (PH.who === null) {
        const al = albums(list);
        return `${head('Photos', false)}<div class="mu-ph-body mu-photos">${al.length ? `<div class="mu-photo-people">${al.map(a => `<button data-act="pho-who" data-who="${esc(a.who)}">
            <img src="${esc(a.cover)}" alt="" loading="lazy"><span><b data-notr>${esc(nameOf(g, a.who))}</b><small>${a.n} ${a.n === 1 ? 'picture' : 'pictures'}</small></span></button>`).join('')}</div>`
            : '<p class="mu-muted mu-pad">No pictures yet. Pictures made in the chat or posted on Chirp show up here, by person.</p>'}</div>`;
    }
    const mine = shotsOf(list, PH.who);
    const open = mine.find(s => s.url === PH.url);
    if (open) {
        const people = [ME, ...residents(g).filter(r => r.met || open.who.includes(r.avatar)).map(r => r.avatar)];
        return `${head(esc(nameOf(g, PH.who)), true)}<div class="mu-ph-body mu-photos"><figure class="mu-photo-one"><a href="${esc(open.url)}" target="_blank" rel="noopener"><img src="${esc(open.url)}" alt=""></a>
            <figcaption>${open.caption ? `<span data-notr>${esc(open.caption)}</span>` : ''}<small>${open.source === 'chirp' ? 'Posted on Chirp' : open.at > 1e9 ? esc(fmtDate(open.at)) : 'From the chat'}${open.look ? ` · wearing: ${esc(open.look)}` : ''}</small></figcaption></figure>
            <div class="mu-photo-tags"><small class="mu-muted">${open.guessed ? 'In this picture (a guess from who sent it):' : 'In this picture:'}</small>
                <div class="mu-chips">${(PH.tagging ? people : open.who).map(w => `<button class="mu-chip ${open.who.includes(w) ? 'is-on' : ''}" data-act="pho-tag" data-who="${esc(w)}" data-notr ${PH.tagging ? '' : 'aria-disabled="true"'}><img src="${esc(picOf(w))}" alt="">${esc(nameOf(g, w))}</button>`).join('') || '<small class="mu-muted">Nobody you know.</small>'}</div>
                <div class="mu-row"><button class="mu-ghost" data-act="pho-tagging">${PH.tagging ? 'Done' : 'Change who is in it'}</button>${!open.guessed ? '<button class="mu-ghost" data-act="pho-untag">Back to the guess</button>' : ''}</div></div></div>`;
    }
    return `${head(esc(nameOf(g, PH.who)), true)}<div class="mu-ph-body mu-photos">${mine.length ? `<div class="mu-photo-grid">${mine.map(s => `<button data-act="pho-open" data-url="${esc(s.url)}" title="${esc(s.caption)}"><img src="${esc(s.url)}" alt="" loading="lazy">${s.source === 'chirp' ? `<i>${icon('at')}</i>` : ''}</button>`).join('')}</div>`
        : '<p class="mu-muted mu-pad">No pictures here any more.</p>'}</div>`;
}
Object.assign(ACT, {
    'pho-who': (el) => { PH.who = el.dataset.who ?? ''; PH.url = ''; PH.tagging = false; notify(); },
    'pho-back': () => { if (PH.url) {
        PH.url = '';
        PH.tagging = false;
    }
    else
        PH.who = null; notify(); },
    'pho-open': (el) => { PH.url = el.dataset.url ?? ''; PH.tagging = false; notify(); },
    'pho-tagging': () => { PH.tagging = !PH.tagging; notify(); },
    'pho-tag': (el) => {
        const g = game();
        if (!g || !PH.tagging)
            return;
        const s = all(g).find(x => x.url === PH.url);
        if (!s)
            return;
        toggleTag(g, s, el.dataset.who ?? '');
        saveGame();
        notify();
    },
    'pho-untag': () => { const g = game(); if (!g)
        return; clearTag(g, PH.url); saveGame(); notify(); },
});
