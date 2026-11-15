/**
 * Batalhas FU: from Fabula Ultima system events to animations.
 *
 * The system dispatches its events on the client that acted (FUHooks, projectfu v4):
 *   projectfu.events.attack / spell / skill / item / gain / crisis / defeat   (Foundry Hooks)
 *   projectfu.events.damage                                                    (the system's AsyncHooks)
 * Each event is turned into a small serialisable message (token UUIDs, element, style...) and handed to the
 * active GM, who plays it (Sequencer and Token Magic write documents and sync to everyone).
 *
 * The active GM also watches the HP/MP of the battle tokens: changes not explained by a damage/gain event
 * (edits on the sheet, other modules) still pop a number, and crisis/KO/revival toggle the token effects.
 */
import { MODULE_ID, SOCKET, isActiveGM } from "./constants.mjs";
import { isBattleScene, setting } from "./store.mjs";
import { playEvent, React } from "./fx.mjs";
import { statsOf } from "./fu-data.mjs";
import { flagOf } from "./overlay.mjs";

const H = {
  attack: "projectfu.events.attack",
  spell: "projectfu.events.spell",
  skill: "projectfu.events.skill",
  item: "projectfu.events.item",
  gain: "projectfu.events.gain",
  crisis: "projectfu.events.crisis",
  defeat: "projectfu.events.defeat",
  damage: "projectfu.events.damage"
};

const uuidOf = t => t?.document?.uuid ?? t?.uuid ?? null;

function allowedHere(uuid) {
  if ( setting("animarFora", false) ) return true;
  if ( isBattleScene(canvas?.scene) ) return true;
  const sceneId = String(uuid ?? "").split(".")[1];
  return Boolean(sceneId && isBattleScene(game.scenes?.get(sceneId)));
}

/** Hand an event to the active GM (or play it here when this is the active GM). */
export function sendEvent(e) {
  const probe = e.source ?? e.targets?.[0];
  if ( !probe || !allowedHere(probe) ) return;
  markCovered(e);
  if ( isActiveGM() ) {
    playEvent(e).catch(err => console.warn(`${MODULE_ID} | animação`, err));
    return;
  }
  try {
    game.socket.emit(SOCKET, { scope: "gm", event: e });
  } catch ( err ) {
    console.warn(`${MODULE_ID} | socket`, err);
  }
}

function styleOf(item) {
  const type = item?.type;
  if ( type === "spell" ) return "spell";
  const range = item?.system?.type?.value;
  return range === "ranged" ? "ranged" : "melee";
}

function spellElement(spell) {
  const t = spell?.rollInfo?.damage?.type?.value ?? spell?.damage?.type?.value;
  return typeof t === "string" ? t : "light";
}

const safe = fn => (...args) => {
  try {
    fn(...args);
  } catch ( err ) {
    console.warn(`${MODULE_ID} | evento do sistema`, err);
  }
};

export function listenSystem() {
  Hooks.on(H.attack, safe(ev => sendEvent({
    kind: "attack", style: styleOf(ev._item), element: ev.type ?? "physical",
    source: uuidOf(ev.token), targets: (ev.targets ?? []).map(t => uuidOf(t.token)).filter(Boolean),
    crit: Boolean(ev.check?.critical), fumble: Boolean(ev.check?.fumble), item: ev.item?.name ?? ""
  })));
  Hooks.on(H.spell, safe(ev => sendEvent({
    kind: "spell", element: spellElement(ev.spell), source: uuidOf(ev.token),
    targets: (ev.targets ?? []).map(t => uuidOf(t.token)).filter(Boolean), item: ev.item?.name ?? ""
  })));
  Hooks.on(H.skill, safe(ev => sendEvent({
    kind: "skill", element: "untyped", source: uuidOf(ev.token), targets: (ev.targets ?? []).map(t => uuidOf(t.token)).filter(Boolean)
  })));
  Hooks.on(H.item, safe(ev => {
    const src = uuidOf(ev.token);
    const targets = (ev.targets ?? []).map(t => uuidOf(t.token)).filter(Boolean);
    sendEvent({ kind: "item", source: src, targets: targets.length ? targets : [src].filter(Boolean) });
  }));
  Hooks.on(H.gain, safe(ev => {
    const t = uuidOf(ev.token);
    if ( t && Number(ev.amount) > 0 ) sendEvent({ kind: "gain", source: t, targets: [t], resource: ev.resource, amount: ev.amount });
  }));
  Hooks.on(H.crisis, safe(ev => {
    const t = uuidOf(ev.token);
    if ( t ) sendEvent({ kind: "crisis", source: t, targets: [t] });
  }));
  Hooks.on(H.defeat, safe(ev => {
    const t = uuidOf(ev.token);
    if ( t ) sendEvent({ kind: "defeat", source: t, targets: [t] });
  }));
  hookDamage();
}

/** The damage event goes through the system's own AsyncHooks registry (same module instance). */
async function hookDamage() {
  try {
    const url = new URL("systems/projectfu/module/helpers/async-hooks.mjs", document.baseURI).href;
    const { AsyncHooks } = await import(url);
    AsyncHooks?.on?.(H.damage, ev => {
      try {
        const t = uuidOf(ev.token);
        if ( t && Number(ev.amount) > 0 ) {
          sendEvent({
            kind: "damage", source: uuidOf(ev.source?.token) ?? t, targets: [t], amount: ev.amount,
            element: ev.type ?? "physical", affinity: ev.affinity ?? "none"
          });
        }
      } catch ( err ) {
        console.warn(`${MODULE_ID} | dano`, err);
      }
    });
    damageHooked = true;
  } catch ( err ) {
    damageHooked = false;
    console.info(`${MODULE_ID} | evento de dano do sistema indisponível; os números de dano vêm das mudanças de PV.`);
  }
}
let damageHooked = false;

/* ---------------------------------------------------------------------------------------------- */
/* HP/MP watcher (active GM)                                                                        */
/* ---------------------------------------------------------------------------------------------- */

const covered = new Map(); /* token uuid -> time of the last damage/gain event */

/** Damage/gain events already animate their numbers: the HP watcher skips those tokens for a moment. */
export function markCovered(e) {
  if ( e?.kind !== "damage" && e?.kind !== "gain" ) return;
  for ( const t of e.targets ?? [] ) covered.set(t, Date.now());
}
const seen = new Map(); /* token id -> { hp, mp, crisis, ko } */

export function primeWatcher() {
  seen.clear();
  if ( !canvas?.ready || !isBattleScene(canvas.scene) ) return;
  for ( const t of canvas.tokens.placeables ) {
    if ( !flagOf(t.document, "side") ) continue;
    const s = statsOf(t.actor, t.document);
    seen.set(t.id, { hp: s.hp?.value, mp: s.mp?.value, crisis: s.crisis, ko: s.ko });
  }
}

let timer = null;
export function watchStats() {
  if ( !isActiveGM() || !canvas?.ready || !isBattleScene(canvas.scene) ) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    for ( const t of canvas.tokens.placeables ) {
      if ( !flagOf(t.document, "side") ) continue;
      const s = statsOf(t.actor, t.document);
      const before = seen.get(t.id);
      seen.set(t.id, { hp: s.hp?.value, mp: s.mp?.value, crisis: s.crisis, ko: s.ko });
      if ( !before ) continue;
      const uuid = t.document.uuid;
      if ( before.crisis !== s.crisis ) React.crisis(t, s.crisis);
      if ( before.ko !== s.ko ) React.ko(t, s.ko);
      const recent = Date.now() - (covered.get(uuid) ?? 0) < 1500;
      if ( recent ) continue;
      const dh = (s.hp?.value ?? 0) - (before.hp ?? 0);
      const dm = (s.mp?.value ?? 0) - (before.mp ?? 0);
      if ( before.hp != null && dh < 0 ) playEvent({ kind: "damage", source: uuid, targets: [uuid], amount: -dh, element: "physical", affinity: "none" });
      else if ( dh > 0 ) playEvent({ kind: "gain", source: uuid, targets: [uuid], resource: "hp", amount: dh });
      else if ( dm > 0 ) playEvent({ kind: "gain", source: uuid, targets: [uuid], resource: "mp", amount: dm });
    }
  }, 700);
}
