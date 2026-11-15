/**
 * Batalhas FU: reading the Fabula Ultima system (projectfu, v4.x for Foundry v13).
 *
 * Actor data: system.resources.hp/mp/ip/fp {value, max}. Crisis = HP at or below half.
 * Combat (FUCombat): getCurrentTurn() -> "friendly"|"hostile" (the faction whose turn it is),
 * combatant -> the combatant acting now (or null), countTurnsLeft() -> {id: n}, startTurn/endTurn(c),
 * combatant.faction / totalTurns / isDefeated. Everything falls back to core Combat when the system differs.
 */
import { FRIENDLY, HOSTILE, MODULE_ID, SYSTEM_ID } from "./constants.mjs";

export const isFU = () => game.system?.id === SYSTEM_ID;

const res = (r, key) => {
  const v = r?.[key];
  if ( !v || typeof v !== "object" ) return null;
  const value = Number(v.value), max = Number(v.max);
  return Number.isFinite(value) ? { value, max: Number.isFinite(max) ? max : value } : null;
};

/** HP/MP/IP of an actor (or a token's bar values when the system is not Fabula Ultima). */
export function statsOf(actor, tokenDoc = null) {
  const r = actor?.system?.resources;
  let hp = res(r, "hp"), mp = res(r, "mp");
  const ip = actor?.type === "character" ? res(r, "ip") : null;
  if ( !hp && tokenDoc?.getBarAttribute ) {
    const b1 = tokenDoc.getBarAttribute("bar1");
    if ( b1?.type === "bar" ) hp = { value: Number(b1.value) || 0, max: Number(b1.max) || 0 };
    const b2 = tokenDoc.getBarAttribute("bar2");
    if ( b2?.type === "bar" ) mp = { value: Number(b2.value) || 0, max: Number(b2.max) || 0 };
  }
  const crisis = Boolean(hp && hp.max > 0 && hp.value > 0 && hp.value <= Math.floor(hp.max / 2));
  const ko = Boolean(hp && hp.max > 0 && hp.value <= 0);
  return { hp, mp, ip, crisis, ko };
}

/** Status effect icons of an actor: [{ id, name, img }]. */
export function statusIcons(actor) {
  const ids = actor?.statuses ? Array.from(actor.statuses) : [];
  const defs = CONFIG.statusEffects ?? [];
  return ids.filter(id => id !== "crisis" && id !== "ko").map(id => {
    const d = defs.find(s => s.id === id);
    return d ? { id, name: game.i18n.localize(d.name ?? d.label ?? id), img: d.img ?? d.icon ?? "" } : null;
  }).filter(s => s?.img);
}

export function portraitOf(actor, tokenDoc) {
  const img = actor?.img;
  if ( img && !String(img).includes("mystery-man") ) return img;
  return tokenDoc?.texture?.src ?? img ?? "icons/svg/mystery-man.svg";
}

/** "friendly" for the party, "hostile" for everybody else (same rule as FUCombatant#faction). */
export function factionOfToken(tokenDoc) {
  const side = tokenDoc?.getFlag?.(MODULE_ID, "side") ?? tokenDoc?.flags?.[MODULE_ID]?.side;
  if ( side === "party" ) return FRIENDLY;
  if ( side === "foes" ) return HOSTILE;
  return tokenDoc?.disposition === (CONST?.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1) ? FRIENDLY : HOSTILE;
}

/* ---------------------------------------------------------------------------------------------- */
/* Combat                                                                                           */
/* ---------------------------------------------------------------------------------------------- */

export function combatOfScene(scene) {
  if ( !scene ) return null;
  const list = game.combats?.contents ?? Array.from(game.combats ?? []);
  return list.find(c => c.scene?.id === scene.id && c.active) ?? list.find(c => c.scene?.id === scene.id) ?? null;
}

/** A plain snapshot of the combat for the HUD. */
export function combatInfo(combat) {
  if ( !combat ) return null;
  const fu = typeof combat.getCurrentTurn === "function";
  const acting = combat.combatant ?? null;
  const turnsLeft = fu && typeof combat.countTurnsLeft === "function" ? combat.countTurnsLeft() : {};
  const list = (combat.combatants?.contents ?? Array.from(combat.combatants ?? [])).map(c => {
    const token = c.token ?? null;
    const actor = c.actor ?? null;
    const total = fu ? Number(c.totalTurns ?? 1) : 1;
    const left = fu ? Number(turnsLeft[c.id] ?? total) : (combat.turns?.indexOf?.(c) >= (combat.turn ?? 0) ? 1 : 0);
    return {
      id: c.id,
      name: c.name ?? actor?.name ?? "?",
      img: portraitOf(actor, token),
      tokenId: c.tokenId ?? token?.id ?? null,
      actor,
      token,
      faction: fu && c.faction ? c.faction : factionOfToken(token),
      defeated: Boolean(c.isDefeated) || statsOf(actor, token).ko,
      hidden: Boolean(c.hidden || token?.hidden),
      total,
      left: Math.max(0, left)
    };
  });
  let faction = fu ? combat.getCurrentTurn() ?? null : null;
  if ( !faction && acting ) faction = list.find(x => x.id === acting.id)?.faction ?? null;
  const outOfTurns = combat.started && list.filter(x => !x.defeated).every(x => x.left <= 0);
  return {
    id: combat.id,
    fu,
    started: Boolean(combat.started),
    round: Number(combat.round ?? 0),
    faction,
    actingId: acting?.id ?? null,
    outOfTurns,
    combatants: list
  };
}

export async function startTurnOf(combat, combatantId) {
  const c = combat?.combatants?.get(combatantId);
  if ( !c ) return;
  if ( typeof combat.startTurn === "function" ) return combat.startTurn(c);
  const idx = combat.turns?.findIndex(t => t.id === combatantId) ?? -1;
  if ( idx >= 0 ) return combat.update({ turn: idx });
}

export async function endTurnOf(combat, combatantId) {
  const c = combat?.combatants?.get(combatantId);
  if ( !c ) return;
  if ( typeof combat.endTurn === "function" ) return combat.endTurn(c);
  return combat.nextTurn();
}
