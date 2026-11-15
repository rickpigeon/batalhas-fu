/**
 * Batalhas FU: a small event log (last 40), shown in the panel's Effects tab so the GM can see what the
 * system sent and how it was played. Players' entries reach the GM through the socket.
 */
import { ELEMENTS, MODULE_ID, SOCKET } from "./constants.mjs";

const entries = [];
const listeners = new Set();

const KINDS = {
  attack: "Ataque", spell: "Magia", skill: "Habilidade", item: "Item", damage: "Dano", gain: "Recuperação",
  crisis: "Crise", defeat: "Derrota", revive: "Voltou do KO", turno: "Turno", erro: "Erro", ignorado: "Ignorado"
};

function nameOf(ref) {
  if ( !ref ) return "?";
  const doc = String(ref).includes(".") ? globalThis.fromUuidSync?.(ref) : canvas?.tokens?.get(ref)?.document;
  return doc?.name ?? "?";
}

/** One readable line for an event. */
export function describe(e) {
  const kind = KINDS[e.kind] ?? e.kind;
  const el = e.element && ELEMENTS[e.element] ? ` (${ELEMENTS[e.element].label.toLowerCase()})` : "";
  const style = e.style === "ranged" ? " à distância" : e.style === "spell" ? " mágico" : e.style === "melee" ? " corpo a corpo" : "";
  const who = e.source ? nameOf(e.source) : "";
  const to = (e.targets ?? []).map(nameOf).join(", ");
  const amount = e.amount != null ? ` ${e.amount}` : "";
  const extra = [e.crit ? "crítico" : "", e.fumble ? "falha" : "", e.affinity && e.affinity !== "none" ? e.affinity : ""].filter(Boolean).join(", ");
  return `${kind}${style}${el}${amount}: ${who}${to && to !== who ? ` → ${to}` : ""}${extra ? ` [${extra}]` : ""}`;
}

export function logEvent(entry, { relay = false } = {}) {
  const full = { at: Date.now(), user: game.user?.name ?? "", ...entry };
  entries.unshift(full);
  if ( entries.length > 40 ) entries.pop();
  for ( const fn of listeners ) {
    try {
      fn();
    } catch ( err ) { /* a closed panel */ }
  }
  if ( relay && !game.user?.isGM ) {
    try {
      game.socket?.emit(SOCKET, { scope: "log", entry: full });
    } catch ( err ) { /* offline */ }
  }
  if ( entry.kind === "erro" ) console.warn(`${MODULE_ID} | ${entry.text}`);
}

/** An entry that came from a player (socket). */
export function receiveLog(entry) {
  if ( !entry ) return;
  entries.unshift(entry);
  if ( entries.length > 40 ) entries.pop();
  for ( const fn of listeners ) fn();
}

export const getLog = () => entries.slice();

export function onLog(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
