/**
 * Batalhas FU: where everybody stands. Pure math, shared by the background generator (card slots on the
 * table, clear areas on the field) and by the token placement, so both always line up.
 * All coordinates are scene pixels (SCENE_W x SCENE_H); positions are token centres.
 */
import { GRID, SCENE_H, SCENE_W } from "./constants.mjs";

/**
 * Field (side view): the party in a staggered column on the right, the foes mirrored on the left.
 * @param {number} count
 * @param {"party"|"foes"} side
 * @returns {{x:number,y:number,row:number,col:number}[]}
 */
export function fieldSlots(count, side) {
  const n = Math.max(0, count | 0);
  if ( !n ) return [];
  const rows = Math.min(n, n > 8 ? 5 : 4);
  const cols = Math.ceil(n / rows);
  const top = SCENE_H * 0.37, span = SCENE_H * 0.44;
  const out = [];
  for ( let i = 0; i < n; i++ ) {
    const col = Math.floor(i / rows), row = i % rows;
    const inRow = Math.min(rows, n - col * rows);
    const y = top + ((row + 0.5) * span) / inRow;
    const dx = SCENE_W * (0.115 * col + 0.022 * row);
    const x = side === "party" ? SCENE_W * 0.665 + dx : SCENE_W * 0.335 - dx;
    out.push({ x: Math.round(x), y: Math.round(y), row, col });
  }
  return out;
}

/** Card size (grid units) on the table for the larger of the two rows. */
export function tableCardSize(partyCount, foeCount) {
  const most = Math.max(1, partyCount, foeCount);
  const maxRow = SCENE_W * 0.72; /* the mat is ~74% of the width */
  let w = 1.6;
  const gap = 0.32;
  while ( w > 0.8 && (most * w + (most - 1) * gap) * GRID > maxRow ) w -= 0.05;
  return { w: Math.round(w * 100) / 100, h: Math.round(w * 1.5 * 100) / 100, gap };
}

/**
 * Table (top view): foes in a row on the upper half, the party on the lower half.
 * @returns {{x:number,y:number,w:number,h:number}[]} centre and size in pixels
 */
export function tableSlots(count, side, size) {
  const n = Math.max(0, count | 0);
  if ( !n ) return [];
  const w = size.w * GRID, h = size.h * GRID, gap = size.gap * GRID;
  const total = n * w + (n - 1) * gap;
  const y = side === "party" ? SCENE_H * 0.715 : SCENE_H * 0.29;
  const x0 = (SCENE_W - total) / 2 + w / 2;
  return Array.from({ length: n }, (_, i) => ({ x: Math.round(x0 + i * (w + gap)), y: Math.round(y), w, h }));
}
