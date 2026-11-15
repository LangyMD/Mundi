// The narrator at work (sim/narrate.ts has the words): gathers what the game knows about this moment, asks the AI
// (or uses the ready-made line), and posts the result in the chat as the narrator's line.
import { state, notify, game, toast, UI, type Save } from '../core/store.js';
import { getWorld, systemOn, type WorldDef } from '../core/world.js';
import { aiLangNote } from '../core/i18n.js';
import { chat, narratorLine, personaName, quiet } from '../st/bridge.js';
import { placeOf } from '../sim/places.js';
import { presentAt } from '../sim/people.js';
import { weekday, hm, period } from '../sim/time.js';
import { weatherHere, crowdLevel, crowdWord } from '../sim/worldstate.js';
import { whyHereLines } from '../sim/daylife.js';
import { openNow } from '../sim/daynight.js';
import { styleOf, styleNote } from '../sim/style.js';
import { engineLine, narratePrompt, cleanNarration, narrLevel, NARRATE_SYSTEM, type NarrFacts, type NarrLevel } from '../sim/narrate.js';

// Arrivals: the AI by default. Things you do: the narrator too, unless the old setting had narration off.
export const arriveLevel = (): NarrLevel => narrLevel((UI() as any).narrArrive, 'ai');
export type ActionVoice = NarrLevel | 'reply';
export function actionVoice(): ActionVoice {
    const v = (UI() as any).narrAction;
    if (v === 'reply') return 'reply';
    return narrLevel(v, UI().narrateActions === false ? 'off' : 'ai');
}

function factsNow(g: Save, w: WorldDef, extra: Partial<NarrFacts> & { kind: NarrFacts['kind'] }): NarrFacts {
    const here = placeOf(g, w, g.player.loc);
    const present = presentAt(g, w, g.player.loc);
    const home = !!here?.home;
    return {
        me: personaName(),
        place: here?.name ?? 'somewhere',
        desc: here?.desc ?? '',
        time: `${weekday(g.day)}, ${hm(g.minutes)} (${period(w, g.minutes).name.toLowerCase()})`,
        weather: weatherHere(g, w).name.toLowerCase(),
        crowd: home ? '' : crowdWord(crowdLevel(g, w, g.player.loc)),
        closed: !!here && !home && systemOn(w, 'living') && !openNow(g, w, here.id),
        people: present.map(r => r.name),
        why: whyHereLines(g, w, present),
        ...extra,
    };
}

// Posts one narrator line for this moment. Returns the text posted ('' when nothing was).
export async function narrate(level: NarrLevel, extra: Partial<NarrFacts> & { kind: NarrFacts['kind'] }): Promise<string> {
    const g = game(); const w = g && getWorld(g.world);
    if (!g || !w || level === 'off' || state.view !== 'scene' || state.generating) return '';
    const f = factsNow(g, w, extra);
    let text = '';
    if (level === 'ai') {
        state.generating = true; notify();
        try {
            const me = f.me;
            const recent = chat().slice(-6).filter((m: any) => !m.is_system || m.extra?.mundi_narrator)
                .map((m: any) => `${m.is_user ? me : m.extra?.mundi_narrator ? 'Narrator' : m.name}: ${String(m.mes ?? '').replace(/\s+/g, ' ').slice(0, 240)}`).join('\n');
            // arriving opens a new scene: what was said in the last one is not this place's story
            const out = await quiet(narratePrompt(f, f.kind === 'arrive' ? '' : recent, styleNote(styleOf(g)), aiLangNote()), 260, NARRATE_SYSTEM);
            text = cleanNarration(out, me, f.people);
        } catch (e: any) { console.warn('[Mundi] narrator', e); toast('The narrator got no answer from the AI: a plain line is used.', 'info'); }
        state.generating = false;
    }
    if (!text) text = engineLine(f);
    try { await narratorLine(text); } catch (e) { console.warn('[Mundi] narrator line', e); text = ''; }
    notify();
    return text;
}
