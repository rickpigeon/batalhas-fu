/**
 * Batalhas FU: the DOM layer above the canvas (one per client). Layers, bottom to top:
 *   ambient (biome particles) · plates (stats under each token) · fx (own animations, damage numbers)
 *   · ui (turn bar, banners) · intro (the opening with cards)
 * Everything has pointer-events: none except the turn bar buttons.
 */
import { MODULE_ID } from "./constants.mjs";
import { setting } from "./store.mjs";

let root = null;

export function overlay() {
  if ( root?.isConnected ) return root;
  root = document.createElement("div");
  root.id = "bfu-overlay";
  root.className = "bfu-overlay";
  root.innerHTML = `<div class="bfu-side"></div><div class="bfu-ambient"></div><div class="bfu-plates"></div><div class="bfu-fx"></div><div class="bfu-ui"></div><div class="bfu-intro"></div>`;
  document.body.append(root);
  return root;
}

export const layer = name => overlay().querySelector(`.bfu-${name}`);

/** Players see the animated HUD only when the GM allows it. */
export function canSeeHud() {
  return Boolean(game.user?.isGM) || Boolean(setting("hudJogadores", true));
}

/** Screen rectangle of a token (client pixels), following its animation; null when not on the canvas. */
export function tokenRect(tokenOrId) {
  const t = typeof tokenOrId === "string" ? canvas?.tokens?.get(tokenOrId) : tokenOrId;
  if ( !t || !canvas?.ready ) return null;
  const x = Number(t.x ?? t.document?.x), y = Number(t.y ?? t.document?.y);
  const gs = canvas.grid?.size ?? 100;
  const w = Number(t.w ?? (t.document?.width ?? 1) * gs), h = Number(t.h ?? (t.document?.height ?? 1) * gs);
  const a = canvas.clientCoordinatesFromCanvas({ x, y });
  const b = canvas.clientCoordinatesFromCanvas({ x: x + w, y: y + h });
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
}

export function zoom() {
  return Number(canvas?.stage?.scale?.x ?? 1) || 1;
}

export const flagOf = (doc, key) => doc?.getFlag?.(MODULE_ID, key) ?? doc?.flags?.[MODULE_ID]?.[key];
