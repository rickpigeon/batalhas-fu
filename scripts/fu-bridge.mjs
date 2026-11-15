/**
 * Batalhas FU: from Fabula Ultima system events to animations.
 *
 * The system dispatches its events on the client that acted (FUHooks, projectfu v4):
 *   projectfu.events.attack / spell / skill / item / gain / crisis / defeat   (Foundry Hooks)
 *   projectfu.events.damage                                                    (the system's AsyncHooks)
 * crisis fires when entering AND leaving crisis; defeat fires on KO AND on coming back from KO, so both
 * read the HP to know which one happened.
 *
 * Routing: the client where the event happened plays the visuals (Sequencer syncs them, the DOM version is
 * broadcast); the active GM writes the token reactions (Token Magic). The GM's HP watcher covers changes
 * without a system event (edits on the sheet, other modules).
 */
import { MODULE_ID, SOCKET, isActiveGM } from "./constants.mjs";
import { isBattleScene, setting } from "./store.mjs";
import { React, applyReactions, playVisuals } from "./fx.mjs";
import { statsOf } from "./fu-data.mjs";
import { flagOf } from "./overlay.mjs";
import { describe, logEvent } from "./log.mjs";

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
  if ( setting("animarFora", true) ) return true;
  if ( isBattleScene(canvas?.scene) ) return true;
  const sceneId = String(uuid ?? "").split(".")[1];
  return Boolean(sceneId && isBattleScene(game.scenes?.get(sceneId)));
}

/** Route an event: visuals here, reactions by the active GM. */
export function sendEvent(e) {
  const probe = e.source ?? e.targets?.[0];
  if ( !probe ) return;
  if ( !allowedHere(probe) ) {
    logEvent({ kind: "ignorado", text: `${describe(e)} (fora de uma cena de batalha)` });
    return;
  }
  markCovered(e);
  playVisuals(e)
    .then(how => logEvent({ kind: e.kind, text: describe(e), how }, { relay: true }))
    .catch(err => logEvent({ kind: "erro", text: `${describe(e)}: ${err.message}` }, { relay: true }));
  if ( isActiveGM() ) applyReactions(e);
  else {
    try {
      game.socket.emit(SOCKET, { scope: "gm", event: e });
    } catch ( err ) {
      console.warn(`${MODULE_ID} | socket`, err);
    }
  }
}

function styleOf(item) {
  if ( item?.type === "spell" ) return "spell";
  return item?.system?.type?.value === "ranged" ? "ranged" : "melee";
}

function spellElement(spell) {
  const t = spell?.rollInfo?.damage?.type?.value ?? spell?.damage?.type?.value;
  return typeof t === "string" ? t : "light";
}

const safe = (name, fn) => (...args) => {
  try {
    fn(...args);
  } catch ( err ) {
    console.warn(`${MODULE_ID} | evento do sistema ${name}`, err);
    logEvent({ kind: "erro", text: `evento ${name}: ${err.message}` });
  }
};

const targetsOf = ev => (ev.targets ?? []).map(t => uuidOf(t.token)).filter(Boolean);

export function listenSystem() {
  Hooks.on(H.attack, safe("attack", ev => sendEvent({
    kind: "attack", style: styleOf(ev._item), element: ev.type ?? "physical",
    source: uuidOf(ev.token), targets: targetsOf(ev),
    crit: Boolean(ev.check?.critical), fumble: Boolean(ev.check?.fumble), item: ev.item?.name ?? ""
  })));
  Hooks.on(H.spell, safe("spell", ev => sendEvent({
    kind: "spell", element: spellElement(ev.spell), source: uuidOf(ev.token), targets: targetsOf(ev), item: ev.item?.name ?? ""
  })));
  Hooks.on(H.skill, safe("skill", ev => sendEvent({
    kind: "skill", element: "untyped", source: uuidOf(ev.token), targets: targetsOf(ev)
  })));
  Hooks.on(H.item, safe("item", ev => {
    const src = uuidOf(ev.token);
    const targets = targetsOf(ev);
    sendEvent({ kind: "item", source: src, targets: targets.length ? targets : [src].filter(Boolean) });
  }));
  Hooks.on(H.gain, safe("gain", ev => {
    const t = uuidOf(ev.token);
    if ( t && Number(ev.amount) > 0 ) sendEvent({ kind: "gain", source: t, targets: [t], resource: ev.resource, amount: ev.amount });
  }));
  Hooks.on(H.crisis, safe("crisis", ev => {
    const t = uuidOf(ev.token);
    if ( !t ) return;
    const hp = ev.actor?.system?.resources?.hp;
    const inCrisis = hp?.inCrisis ?? statsOf(ev.actor).crisis;
    if ( inCrisis ) sendEvent({ kind: "crisis", source: t, targets: [t] });
    else if ( isActiveGM() ) React.crisis(t, false);
  }));
  Hooks.on(H.defeat, safe("defeat", ev => {
    const t = uuidOf(ev.token);
    if ( !t ) return;
    const hp = Number(ev.actor?.system?.resources?.hp?.value ?? 0);
    if ( hp <= 0 ) sendEvent({ kind: "defeat", source: t, targets: [t] });
    else if ( isActiveGM() ) React.ko(t, false);
  }));
  hookDamage();
}

/** The damage event goes through the system's own AsyncHooks registry (same module instance). */
async function hookDamage() {
  try {
    const url = new URL("systems/projectfu/module/helpers/async-hooks.mjs", document.baseURI).href;
    const { AsyncHooks } = await import(url);
    if ( typeof AsyncHooks?.on !== "function" ) throw new Error("AsyncHooks sem on()");
    AsyncHooks.on(H.damage, ev => {
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
    console.info(`${MODULE_ID} | evento de dano do sistema indisponível; os números de dano vêm das mudanças de PV.`, err);
  }
}
let damageHooked = false;
export const damageHookActive = () => damageHooked;

/* ---------------------------------------------------------------------------------------------- */
/* HP/MP watcher (active GM)                                                                        */
/* ---------------------------------------------------------------------------------------------- */

const covered = new Map(); /* token uuid -> time of the last damage/gain event */
const seen = new Map(); /* token id -> { hp, mp, crisis, ko } */

/** Damage/gain events already animate their numbers: the HP watcher skips those tokens for a moment. */
export function markCovered(e) {
  if ( e?.kind !== "damage" && e?.kind !== "gain" ) return;
  for ( const t of e.targets ?? [] ) covered.set(t, Date.now());
}

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
      if ( before.crisis !== s.crisis ) React.crisis(uuid, s.crisis);
      if ( before.ko !== s.ko ) React.ko(uuid, s.ko);
      if ( Date.now() - (covered.get(uuid) ?? 0) < 1500 ) continue;
      const dh = (s.hp?.value ?? 0) - (before.hp ?? 0);
      const dm = (s.mp?.value ?? 0) - (before.mp ?? 0);
      if ( before.hp != null && dh < 0 ) sendEvent({ kind: "damage", source: uuid, targets: [uuid], amount: -dh, element: "physical", affinity: "none" });
      else if ( dh > 0 ) sendEvent({ kind: "gain", source: uuid, targets: [uuid], resource: "hp", amount: dh });
      else if ( dm > 0 ) sendEvent({ kind: "gain", source: uuid, targets: [uuid], resource: "mp", amount: dm });
    }
  }, 700);
}
