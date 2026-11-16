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

/* ---------------------------------------------------------------------------------------------- */
/* Table                                                                                            */
/* ---------------------------------------------------------------------------------------------- */

/** The play mat (scene pixels). */
export const MAT = { x: SCENE_W * 0.13, y: SCENE_H * 0.05, w: SCENE_W * 0.74, h: SCENE_H * 0.9 };
const ROW_W = SCENE_W * 0.72;
const HALF_H = SCENE_H / 2 - MAT.y - 40; /* free height of one half of the mat */
const RATIO = 1.5; /* card height / width */
const round2 = n => Math.round(n * 100) / 100;

/** Rows and columns of one side in the "colunas" arrangement. */
function columnGrid(n) {
  const rows = Math.min(n, Math.max(3, Math.ceil(Math.sqrt(n * 1.5))));
  return { rows, cols: Math.ceil(n / rows) };
}

/** Arc geometry of the "leque" arrangement for n cards of width w (grid units). */
function fan(n, w, gap) {
  const step = n > 1 ? Math.min(9, 48 / (n - 1)) * (Math.PI / 180) : 0;
  /* the lower corners of neighbouring cards come closer as they turn: leave room for the counters */
  const spacing = (w + gap) * GRID + (w * RATIO * GRID / 2) * Math.sin(step);
  const R = step ? spacing / step : 0;
  const maxA = step * (n - 1) / 2;
  return { step, R, maxA, width: 2 * R * Math.sin(maxA) + w * GRID * Math.cos(maxA) + w * RATIO * GRID * Math.sin(maxA), lift: R * (1 - Math.cos(maxA)) };
}

/**
 * Card size (grid units) for both sides, so the larger side fits on the mat.
 * @param {number} partyCount
 * @param {number} foeCount
 * @param {string} [arrangement]
 */
export function tableCardSize(partyCount, foeCount, arrangement = "linha") {
  const most = Math.max(1, partyCount, foeCount);
  const gap = 0.32;
  let w = 1.6;
  const fits = () => {
    const h = w * RATIO * GRID;
    switch ( arrangement ) {
      case "leque": {
        const f = fan(most, w, gap);
        return f.width <= ROW_W && h + f.lift <= HALF_H;
      }
      case "escalonado":
        return (most * w + (most - 1) * gap) * GRID <= ROW_W && h * 1.36 <= HALF_H;
      case "grade": {
        const perRow = Math.ceil(most / 2);
        const rows = most > 1 ? 2 : 1;
        return ((perRow + (rows > 1 ? 0.5 : 0)) * w + (perRow - 1) * gap) * GRID <= ROW_W && rows * h + (rows - 1) * gap * GRID <= HALF_H - 50;
      }
      case "colunas": {
        const { rows, cols } = columnGrid(most);
        return (cols * w + (cols - 1) * gap) * GRID <= MAT.w / 2 - 120 && (rows * w * RATIO + (rows - 1) * gap) * GRID <= MAT.h - 80;
      }
      default:
        return (most * w + (most - 1) * gap) * GRID <= ROW_W && h <= HALF_H;
    }
  };
  while ( w > 0.7 && !fits() ) w -= 0.05;
  return { w: round2(w), h: round2(w * RATIO), gap };
}

/**
 * Table (top view): where each card of one side lies.
 * Foes are on the upper half and the party on the lower half (or left/right in "colunas").
 * @param {number} count
 * @param {"party"|"foes"} side
 * @param {{w:number,h:number,gap:number}} size  grid units
 * @param {string} [arrangement]
 * @returns {{x:number,y:number,w:number,h:number,rot:number}[]} centre and size in pixels, rotation in degrees
 */
export function tableSlots(count, side, size, arrangement = "linha") {
  const n = Math.max(0, count | 0);
  if ( !n ) return [];
  const w = size.w * GRID, h = size.h * GRID, gap = size.gap * GRID;
  const party = side === "party";
  const rowY = party ? SCENE_H * 0.715 : SCENE_H * 0.29;
  const row = (k, y, offset = 0) => {
    const total = k * w + (k - 1) * gap;
    const x0 = (SCENE_W - total) / 2 + w / 2 + offset;
    return Array.from({ length: k }, (_, i) => ({ x: x0 + i * (w + gap), y }));
  };
  let pts;
  switch ( arrangement ) {
    case "leque": {
      const f = fan(n, size.w, size.gap);
      /* the party's hand opens upwards (the middle card is the highest); the foes' hand opens downwards */
      const yMid = party ? rowY - f.lift / 2 : rowY + f.lift / 2;
      pts = Array.from({ length: n }, (_, i) => {
        const a = (i - (n - 1) / 2) * f.step;
        const x = SCENE_W / 2 + f.R * Math.sin(a);
        const dy = f.R * (1 - Math.cos(a));
        return { x, y: party ? yMid + dy : yMid - dy, rot: (party ? a : -a) * (180 / Math.PI) };
      });
      break;
    }
    case "escalonado": {
      const amp = h * 0.18;
      pts = row(n, rowY).map((p, i) => ({ ...p, y: p.y + (i % 2 ? amp : -amp) * (party ? 1 : -1) }));
      break;
    }
    case "grade": {
      if ( n < 2 ) {
        pts = row(n, rowY);
        break;
      }
      const back = Math.ceil(n / 2), front = n - back;
      const dy = (h + gap) / 2;
      const mid = party ? (SCENE_H / 2 + MAT.y + MAT.h) / 2 : (MAT.y + SCENE_H / 2) / 2;
      /* the front row is the one nearer the battle line */
      const yBack = party ? mid + dy : mid - dy, yFront = party ? mid - dy : mid + dy;
      pts = [...row(back, yBack), ...row(front, yFront, back === front ? (w + gap) / 2 : 0)];
      break;
    }
    case "colunas": {
      const { rows } = columnGrid(n);
      const colX = c => (party ? SCENE_W / 2 + 90 + w / 2 + c * (w + gap) : SCENE_W / 2 - 90 - w / 2 - c * (w + gap));
      pts = Array.from({ length: n }, (_, i) => {
        const c = Math.floor(i / rows), r = i % rows;
        const inCol = Math.min(rows, n - c * rows);
        const total = inCol * h + (inCol - 1) * gap;
        return { x: colX(c), y: SCENE_H / 2 - total / 2 + h / 2 + r * (h + gap) };
      });
      break;
    }
    default:
      pts = row(n, rowY);
  }
  return pts.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), w, h, rot: Math.round((p.rot ?? 0) * 10) / 10 }));
}
