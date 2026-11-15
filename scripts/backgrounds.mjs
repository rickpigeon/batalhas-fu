/**
 * Batalhas FU: battle backgrounds drawn by the module (SVG, rasterised once and uploaded).
 *
 *   fieldSVG(opts)  side view: sky, far scenery, ground, details, foreground frame, time of day, mana motes
 *   tableSVG(opts)  top view: a table with a play mat, card slots, a box of mana crystals, a deck, dice,
 *                   a candle and objects of the biome
 *
 * opts = { biome, time, table, mana, seed, slots: { party: [...], foes: [...] } } in scene pixels.
 */
import { BIOMES, ELEMENTS, SCENE_H, SCENE_W, mix, rng, shade } from "./constants.mjs";

const W = SCENE_W, H = SCENE_H;
const f = n => +Number(n).toFixed(1);
const pt = (x, y) => `${f(x)},${f(y)}`;
const rgbF = hex => {
  const n = parseInt(String(hex).slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map(v => +v.toFixed(4));
};

/* ---------------------------------------------------------------------------------------------- */
/* Shared pieces                                                                                    */
/* ---------------------------------------------------------------------------------------------- */

function noiseFilter(id, hex, freq, octaves, seed, ka, kb, type = "fractalNoise") {
  const [r, g, b] = rgbF(hex);
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">`
    + `<feTurbulence type="${type}" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}"/>`
    + `<feColorMatrix type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  ${ka} 0 0 0 ${kb}"/></filter>`;
}

/** An irregular closed blob around (cx, cy). */
function blob(cx, cy, rx, ry, r, k = 0.25, n = 9) {
  const pts = [];
  for ( let i = 0; i < n; i++ ) {
    const a = (i / n) * Math.PI * 2;
    const j = 1 - k / 2 + r() * k;
    pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]);
  }
  let d = `M${pt((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2)}`;
  for ( let i = 0; i < n; i++ ) {
    const p = pts[i], q = pts[(i + 1) % n];
    d += ` Q${pt(p[0], p[1])} ${pt((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)}`;
  }
  return `${d} Z`;
}

/** A ridge line across the width (mountains, hills, dunes): returns a closed path down to `bottom`. */
function ridge(baseY, amp, r, { peaks = 7, sharp = false, bottom = H } = {}) {
  const step = W / peaks;
  let d = `M-20,${f(bottom)} L-20,${f(baseY - r() * amp * 0.5)}`;
  let x = -20;
  for ( let i = 0; i <= peaks; i++ ) {
    const nx = Math.min(W + 20, -20 + (i + 1) * step);
    const peakX = x + step * (0.3 + r() * 0.4);
    const peakY = baseY - amp * (0.45 + r() * 0.55);
    const valleyY = baseY - amp * r() * 0.35;
    if ( sharp ) d += ` L${pt(peakX, peakY)} L${pt(nx, valleyY)}`;
    else d += ` Q${pt(peakX, peakY)} ${pt(nx, valleyY)}`;
    x = nx;
  }
  return `${d} L${f(W + 20)},${f(bottom)} Z`;
}

/** Snow caps for a sharp ridge: small triangles near the highest points. */
function snowCaps(baseY, amp, r, peaks) {
  const step = W / peaks;
  let out = "";
  r(); /* same draws as ridge(): the start height */
  let x = -20;
  for ( let i = 0; i <= peaks; i++ ) {
    const nx = -20 + (i + 1) * step;
    const peakX = x + step * (0.3 + r() * 0.4);
    const peakY = baseY - amp * (0.45 + r() * 0.55);
    r();
    const s = amp * 0.22;
    out += `<path d="M${pt(peakX, peakY)} L${pt(peakX + s * 0.9, peakY + s)} L${pt(peakX + s * 0.3, peakY + s * 0.8)} L${pt(peakX, peakY + s * 1.05)} L${pt(peakX - s * 0.4, peakY + s * 0.8)} L${pt(peakX - s * 0.9, peakY + s)} Z"/>`;
    x = nx;
  }
  return out;
}

function roundTree(x, y, s, c, r) {
  const trunk = `<rect x="${f(x - s * 0.07)}" y="${f(y - s * 0.5)}" width="${f(s * 0.14)}" height="${f(s * 0.5)}" fill="${shade(c, -0.4)}"/>`;
  const crown = `<path d="${blob(x, y - s * 0.85, s * 0.48, s * 0.5, r, 0.3, 8)}" fill="${c}"/>`
    + `<path d="${blob(x - s * 0.12, y - s * 0.98, s * 0.26, s * 0.22, r, 0.3, 7)}" fill="${shade(c, 0.12)}" opacity=".8"/>`;
  return trunk + crown;
}
function pineTree(x, y, s, c, snow = false) {
  let g = `<rect x="${f(x - s * 0.05)}" y="${f(y - s * 0.25)}" width="${f(s * 0.1)}" height="${f(s * 0.25)}" fill="${shade(c, -0.4)}"/>`;
  for ( let i = 0; i < 3; i++ ) {
    const ty = y - s * (0.2 + i * 0.32), w = s * (0.42 - i * 0.1);
    g += `<path d="M${pt(x - w, ty)} L${pt(x, ty - s * 0.5)} L${pt(x + w, ty)} Z" fill="${c}"/>`;
    if ( snow ) g += `<path d="M${pt(x - w * 0.5, ty - s * 0.24)} L${pt(x, ty - s * 0.5)} L${pt(x + w * 0.5, ty - s * 0.24)} Q${pt(x, ty - s * 0.18)} ${pt(x - w * 0.5, ty - s * 0.24)} Z" fill="#f4f8ff" opacity=".9"/>`;
  }
  return g;
}
function palmTree(x, y, s, c, lean = 1) {
  const tx = x + lean * s * 0.25, ty = y - s;
  let g = `<path d="M${pt(x - s * 0.04, y)} Q${pt(x + lean * s * 0.05, y - s * 0.5)} ${pt(tx, ty)} L${pt(tx + s * 0.05, ty + 4)} Q${pt(x + lean * s * 0.1, y - s * 0.5)} ${pt(x + s * 0.05, y)} Z" fill="${shade(c, -0.3)}"/>`;
  for ( const a of [-160, -120, -70, -30, 10, 50] ) {
    const rad = (a * Math.PI) / 180;
    const ex = tx + Math.cos(rad) * s * 0.45, ey = ty + Math.sin(rad) * s * 0.3 + s * 0.12;
    g += `<path d="M${pt(tx, ty)} Q${pt((tx + ex) / 2, ty - s * 0.12)} ${pt(ex, ey)} Q${pt((tx + ex) / 2, ty - s * 0.02)} ${pt(tx, ty)} Z" fill="${c}"/>`;
  }
  return g;
}
function deadTree(x, y, s, c) {
  return `<path d="M${pt(x - s * 0.05, y)} L${pt(x - s * 0.03, y - s * 0.6)} L${pt(x - s * 0.25, y - s * 0.9)} L${pt(x - s * 0.02, y - s * 0.68)} L${pt(x, y - s)} L${pt(x + s * 0.03, y - s * 0.7)} L${pt(x + s * 0.28, y - s * 0.85)} L${pt(x + s * 0.04, y - s * 0.55)} L${pt(x + s * 0.06, y)} Z" fill="${c}"/>`;
}
function column(x, y, s, c, broken = false, r) {
  const h = broken ? s * (0.45 + r() * 0.35) : s;
  let g = `<rect x="${f(x - s * 0.09)}" y="${f(y - h)}" width="${f(s * 0.18)}" height="${f(h)}" fill="${c}"/>`;
  g += `<rect x="${f(x - s * 0.13)}" y="${f(y - s * 0.05)}" width="${f(s * 0.26)}" height="${f(s * 0.05)}" fill="${shade(c, -0.1)}"/>`;
  if ( !broken ) g += `<rect x="${f(x - s * 0.13)}" y="${f(y - h - s * 0.04)}" width="${f(s * 0.26)}" height="${f(s * 0.05)}" fill="${shade(c, -0.1)}"/>`;
  else g += `<path d="M${pt(x - s * 0.09, y - h)} L${pt(x - s * 0.02, y - h - s * 0.06)} L${pt(x + s * 0.03, y - h + s * 0.02)} L${pt(x + s * 0.09, y - h - s * 0.04)} L${pt(x + s * 0.09, y - h)} Z" fill="${c}"/>`;
  for ( let i = 1; i < 4; i++ ) g += `<path d="M${pt(x - s * 0.09 + i * s * 0.045, y - h + s * 0.03)} V${f(y - s * 0.06)}" stroke="${shade(c, -0.18)}" stroke-width="${f(s * 0.008 + 0.6)}"/>`;
  return g;
}
function rock(x, y, s, c, r) {
  return `<path d="${blob(x, y - s * 0.35, s * 0.6, s * 0.4, r, 0.35, 7)}" fill="${c}"/>`
    + `<path d="${blob(x - s * 0.15, y - s * 0.5, s * 0.28, s * 0.14, r, 0.3, 6)}" fill="${shade(c, 0.18)}" opacity=".7"/>`;
}
function crystal(x, y, s, c) {
  const g = `<path d="M${pt(x, y - s)} L${pt(x + s * 0.18, y - s * 0.75)} L${pt(x + s * 0.14, y)} L${pt(x - s * 0.14, y)} L${pt(x - s * 0.18, y - s * 0.75)} Z" fill="${c}" opacity=".92"/>`;
  return g + `<path d="M${pt(x, y - s)} L${pt(x + s * 0.18, y - s * 0.75)} L${pt(x + s * 0.05, y - s * 0.1)} Z" fill="#ffffff" opacity=".35"/>`;
}
function tuft(x, y, s, c) {
  return `<path d="M${pt(x - s * 0.3, y)} Q${pt(x - s * 0.35, y - s * 0.5)} ${pt(x - s * 0.55, y - s * 0.8)} Q${pt(x - s * 0.15, y - s * 0.5)} ${pt(x - s * 0.05, y)}`
    + ` M${pt(x - s * 0.08, y)} Q${pt(x, y - s * 0.7)} ${pt(x + s * 0.05, y - s)} Q${pt(x + s * 0.12, y - s * 0.6)} ${pt(x + s * 0.12, y)}`
    + ` M${pt(x + s * 0.1, y)} Q${pt(x + s * 0.35, y - s * 0.45)} ${pt(x + s * 0.6, y - s * 0.7)} Q${pt(x + s * 0.3, y - s * 0.3)} ${pt(x + s * 0.32, y)} Z" fill="${c}"/>`;
}
function flower(x, y, s, c) {
  let g = "";
  for ( let i = 0; i < 5; i++ ) {
    const a = (i / 5) * Math.PI * 2;
    g += `<circle cx="${f(x + Math.cos(a) * s * 0.35)}" cy="${f(y + Math.sin(a) * s * 0.35)}" r="${f(s * 0.3)}" fill="${c}"/>`;
  }
  return g + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.22)}" fill="#ffe27a"/>`;
}
function mushroom(x, y, s) {
  return `<rect x="${f(x - s * 0.1)}" y="${f(y - s * 0.5)}" width="${f(s * 0.2)}" height="${f(s * 0.5)}" rx="${f(s * 0.06)}" fill="#efe3c8"/>`
    + `<path d="M${pt(x - s * 0.45, y - s * 0.45)} Q${pt(x, y - s * 1.05)} ${pt(x + s * 0.45, y - s * 0.45)} Z" fill="#c8323c"/>`
    + `<circle cx="${f(x - s * 0.12)}" cy="${f(y - s * 0.66)}" r="${f(s * 0.07)}" fill="#fff"/><circle cx="${f(x + s * 0.15)}" cy="${f(y - s * 0.58)}" r="${f(s * 0.05)}" fill="#fff"/>`;
}
function shell(x, y, s, c, rot) {
  let g = `<g transform="translate(${pt(x, y)}) rotate(${f(rot)})"><path d="M0,${f(s * 0.3)} L${f(-s * 0.5)},${f(-s * 0.25)} Q0,${f(-s * 0.7)} ${f(s * 0.5)},${f(-s * 0.25)} Z" fill="${c}"/>`;
  for ( const k of [-0.3, -0.1, 0.1, 0.3] ) g += `<path d="M0,${f(s * 0.3)} L${f(s * k * 1.2)},${f(-s * 0.45)}" stroke="${shade(c, -0.25)}" stroke-width="${f(s * 0.04 + 0.5)}"/>`;
  return `${g}</g>`;
}
function starfish(x, y, s, c, rot) {
  let d = "";
  for ( let i = 0; i < 10; i++ ) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? s * 0.22 : s * 0.55;
    d += `${i ? "L" : "M"}${pt(Math.cos(a) * rr, Math.sin(a) * rr)} `;
  }
  return `<path d="${d}Z" transform="translate(${pt(x, y)}) rotate(${f(rot)})" fill="${c}" stroke="${shade(c, -0.3)}" stroke-width="1.5" stroke-linejoin="round"/>`;
}
function reeds(x, y, s, c) {
  let g = "";
  for ( const k of [-0.25, -0.08, 0.1, 0.24] ) {
    const tx = x + k * s * 0.8, h = s * (0.7 + Math.abs(k));
    g += `<path d="M${pt(x + k * s * 0.3, y)} Q${pt(x + k * s * 0.5, y - h * 0.6)} ${pt(tx, y - h)}" stroke="${c}" stroke-width="${f(s * 0.04 + 1)}" fill="none" stroke-linecap="round"/>`;
    if ( k > 0 ) g += `<rect x="${f(tx - s * 0.04)}" y="${f(y - h - s * 0.05)}" width="${f(s * 0.08)}" height="${f(s * 0.22)}" rx="${f(s * 0.04)}" fill="#6b4a2a"/>`;
  }
  return g;
}
function fern(x, y, s, c, flip = 1) {
  let g = `<path d="M${pt(x, y)} Q${pt(x + flip * s * 0.3, y - s * 0.7)} ${pt(x + flip * s * 0.9, y - s * 0.9)}" stroke="${c}" stroke-width="${f(s * 0.03 + 1)}" fill="none"/>`;
  for ( let i = 1; i < 9; i++ ) {
    const t = i / 9;
    const px = x + flip * s * (0.3 * 2 * t * (1 - t) + 0.9 * t * t), py = y - s * (0.7 * 2 * t * (1 - t) + 0.9 * t * t);
    const L = s * 0.25 * (1 - t * 0.6);
    g += `<path d="M${pt(px, py)} Q${pt(px + flip * L * 0.2, py - L * 0.9)} ${pt(px + flip * L * 0.6, py - L * 0.7)} Q${pt(px + flip * L * 0.3, py - L * 0.4)} ${pt(px, py)} Z" fill="${c}"/>`;
    g += `<path d="M${pt(px, py)} Q${pt(px + flip * L * 0.8, py + L * 0.1)} ${pt(px + flip * L, py - L * 0.2)} Q${pt(px + flip * L * 0.5, py - L * 0.25)} ${pt(px, py)} Z" fill="${shade(c, -0.12)}"/>`;
  }
  return g;
}

/** Glowing mana motes and a faint ley line, coloured by the element. */
function manaLayer(mana, r, area, strength = 1) {
  const el = ELEMENTS[mana];
  if ( !el ) return { defs: "", body: "" };
  const defs = `<filter id="bfMana" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>`
    + `<radialGradient id="bfManaGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${el.color}" stop-opacity="${f(0.45 * strength)}"/><stop offset="1" stop-color="${el.color}" stop-opacity="0"/></radialGradient>`;
  let body = `<ellipse cx="${f(W / 2)}" cy="${f(area.cy)}" rx="${f(W * 0.48)}" ry="${f(area.ry)}" fill="url(#bfManaGlow)"/>`;
  let motes = "";
  for ( let i = 0; i < Math.round(70 * strength); i++ ) {
    const x = r() * W, y = area.y0 + r() * (area.y1 - area.y0), rad = 2 + r() * 5;
    motes += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rad * 2.2)}" fill="${el.color}" opacity="${f(0.25 + r() * 0.3)}" filter="url(#bfMana)"/>`
      + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rad * 0.5)}" fill="${el.glow}" opacity=".9"/>`;
  }
  body += motes;
  return { defs, body };
}

/* ---------------------------------------------------------------------------------------------- */
/* Field (side view)                                                                                */
/* ---------------------------------------------------------------------------------------------- */

const SKIES = {
  dia: { top: "#4f9fe6", hor: "#d5ecf6" },
  entardecer: { top: "#3b3f8f", hor: "#ffb36b" },
  noite: { top: "#070b26", hor: "#283863" }
};

const FIELD = {
  planicie: { far: "#86a9c6", mid: "#4c8644", g1: "#9cc762", g2: "#4f8a3a", det: "#3d7a2e", hor: 0.36 },
  floresta: { far: "#58806e", mid: "#22503a", g1: "#6b9a4c", g2: "#2c5528", det: "#2a5a2a", hor: 0.4 },
  deserto: { far: "#d9a66b", mid: "#b7713f", g1: "#f2d394", g2: "#d39a58", det: "#b47a43", hor: 0.37, sky: { dia: { top: "#5aa0e0", hor: "#f7dfb0" } } },
  neve: { far: "#b8c8e6", mid: "#3f5f73", g1: "#f6f9ff", g2: "#c6d6ee", det: "#9fb4d6", hor: 0.38, sky: { dia: { top: "#7fb2e8", hor: "#eef5ff" } } },
  vulcao: { far: "#3b1a1a", mid: "#231010", g1: "#5a3d36", g2: "#211412", det: "#ff6a1f", hor: 0.38, sky: { dia: { top: "#3a1414", hor: "#d9572b" }, entardecer: { top: "#2a0c10", hor: "#ff6a2a" }, noite: { top: "#0e0508", hor: "#7a1f14" } } },
  litoral: { far: "#3d8fc6", mid: "#2c6f9e", g1: "#f4e2ae", g2: "#dcc083", det: "#c9a46a", hor: 0.35 },
  caverna: { far: "#2d2935", mid: "#1a1820", g1: "#5e5866", g2: "#29262f", det: "#3b3742", hor: 0.32 },
  pantano: { far: "#55654e", mid: "#2c3828", g1: "#6c7440", g2: "#363e22", det: "#2c3a1e", hor: 0.38, sky: { dia: { top: "#7f9a86", hor: "#d4dcb8" } } },
  ruinas: { far: "#9aa3b6", mid: "#828799", g1: "#c2b9a0", g2: "#857d69", det: "#6b6555", hor: 0.37 }
};

export function fieldSVG({ biome = "planicie", time = "dia", mana = "", seed = 1, slots = null } = {}) {
  const P = FIELD[biome] ?? FIELD.planicie;
  const r = rng(seed * 7919 + biome.length * 31);
  const sky = P.sky?.[time] ?? SKIES[time] ?? SKIES.dia;
  const hy = H * P.hor;
  let defs = "";
  let body = "";

  /* sky */
  defs += `<linearGradient id="bfSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky.top}"/><stop offset="1" stop-color="${sky.hor}"/></linearGradient>`;
  body += `<rect x="0" y="0" width="${W}" height="${f(hy + 40)}" fill="url(#bfSky)"/>`;
  if ( biome !== "caverna" ) {
    if ( time === "noite" ) {
      for ( let i = 0; i < 160; i++ ) body += `<circle cx="${f(r() * W)}" cy="${f(r() * hy * 0.9)}" r="${f(0.6 + r() * r() * 2.4)}" fill="#fff" opacity="${f(0.4 + r() * 0.6)}"/>`;
      defs += `<radialGradient id="bfMoon" cx="50%" cy="50%" r="50%"><stop offset=".55" stop-color="#f4f1dc"/><stop offset=".6" stop-color="#f4f1dc" stop-opacity=".25"/><stop offset="1" stop-color="#f4f1dc" stop-opacity="0"/></radialGradient>`;
      body += `<circle cx="${f(W * 0.8)}" cy="${f(hy * 0.32)}" r="110" fill="url(#bfMoon)"/>`;
    }
    else if ( biome !== "vulcao" ) {
      const sunY = time === "entardecer" ? hy * 0.86 : hy * 0.25;
      const sunC = time === "entardecer" ? "#ffd27a" : "#fff7d6";
      defs += `<radialGradient id="bfSun" cx="50%" cy="50%" r="50%"><stop offset=".18" stop-color="${sunC}"/><stop offset=".3" stop-color="${sunC}" stop-opacity=".5"/><stop offset="1" stop-color="${sunC}" stop-opacity="0"/></radialGradient>`;
      body += `<circle cx="${f(W * 0.78)}" cy="${f(sunY)}" r="${time === "entardecer" ? 330 : 260}" fill="url(#bfSun)"/>`;
      defs += `<filter id="bfCloud" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>`;
      const cc = time === "entardecer" ? "#ffcfa8" : biome === "vulcao" ? "#4a2a2a" : "#ffffff";
      for ( let i = 0; i < 6; i++ ) {
        const cx = r() * W, cy = hy * (0.12 + r() * 0.45), s = 90 + r() * 140;
        body += `<g filter="url(#bfCloud)" opacity="${f(0.45 + r() * 0.3)}" fill="${cc}"><ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(s * 1.6)}" ry="${f(s * 0.35)}"/><ellipse cx="${f(cx + s * 0.4)}" cy="${f(cy - s * 0.22)}" rx="${f(s * 0.8)}" ry="${f(s * 0.35)}"/></g>`;
      }
    }
  }

  /* far and mid scenery */
  const haze = sky.hor;
  const far = mix(P.far, haze, 0.35), mid = mix(P.mid, haze, 0.15);
  switch ( biome ) {
    case "planicie":
      body += `<path d="${ridge(hy - 10, 170, r, { peaks: 6, sharp: true })}" fill="${far}"/>`;
      body += `<path d="${ridge(hy + 20, 70, r, { peaks: 9 })}" fill="${mix(mid, haze, 0.25)}"/>`;
      for ( let x = -30; x < W + 40; x += 34 + r() * 50 ) body += roundTree(x, hy + 30 + r() * 12, 60 + r() * 40, mid, r);
      break;
    case "floresta":
      body += `<path d="${ridge(hy - 30, 120, r, { peaks: 8 })}" fill="${far}"/>`;
      for ( let x = -40; x < W + 60; x += 30 + r() * 40 ) body += r() < 0.5 ? pineTree(x, hy + 40 + r() * 10, 150 + r() * 120, shade(mid, 0.12)) : roundTree(x, hy + 40 + r() * 10, 140 + r() * 90, shade(mid, 0.08), r);
      for ( let x = -40; x < W + 60; x += 40 + r() * 60 ) body += roundTree(x, hy + 70 + r() * 12, 120 + r() * 70, mid, r);
      break;
    case "deserto":
      body += `<path d="M-20,${f(hy + 20)} L${f(W * 0.12)},${f(hy - 140)} L${f(W * 0.2)},${f(hy - 140)} L${f(W * 0.24)},${f(hy + 20)} Z M${f(W * 0.62)},${f(hy + 20)} L${f(W * 0.66)},${f(hy - 90)} L${f(W * 0.75)},${f(hy - 95)} L${f(W * 0.79)},${f(hy + 20)} Z" fill="${far}"/>`;
      body += `<path d="${ridge(hy + 30, 60, r, { peaks: 5 })}" fill="${mix(P.g2, haze, 0.3)}"/>`;
      break;
    case "neve": {
      const ms = seed * 131 + 7;
      body += `<path d="${ridge(hy - 20, 330, rng(ms), { peaks: 6, sharp: true })}" fill="${far}"/>`;
      body += `<g fill="#f7fbff" opacity=".95">${snowCaps(hy - 20, 330, rng(ms), 6)}</g>`;
      for ( let x = -40; x < W + 60; x += 26 + r() * 40 ) body += pineTree(x, hy + 40 + r() * 14, 120 + r() * 90, mid, true);
      break;
    }
    case "vulcao":
      defs += `<radialGradient id="bfLavaGlow" cx="50%" cy="0%" r="60%"><stop offset="0" stop-color="#ff7a2a" stop-opacity=".9"/><stop offset="1" stop-color="#ff7a2a" stop-opacity="0"/></radialGradient>`;
      body += `<path d="M${f(W * 0.3)},${f(hy + 30)} L${f(W * 0.45)},${f(hy - 330)} L${f(W * 0.52)},${f(hy - 320)} L${f(W * 0.7)},${f(hy + 30)} Z" fill="${far}"/>`;
      body += `<ellipse cx="${f(W * 0.485)}" cy="${f(hy - 330)}" rx="160" ry="120" fill="url(#bfLavaGlow)"/>`;
      body += `<path d="M${f(W * 0.47)},${f(hy - 322)} Q${f(W * 0.48)},${f(hy - 220)} ${f(W * 0.455)},${f(hy - 120)} Q${f(W * 0.47)},${f(hy - 200)} ${f(W * 0.49)},${f(hy - 324)} Z" fill="#ff6a1f" opacity=".85"/>`;
      body += `<path d="${ridge(hy + 30, 110, r, { peaks: 8, sharp: true })}" fill="${mid}"/>`;
      break;
    case "litoral": {
      defs += `<linearGradient id="bfSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(P.far, haze, 0.3)}"/><stop offset="1" stop-color="${shade(P.mid, -0.1)}"/></linearGradient>`;
      body += `<rect x="0" y="${f(hy - 30)}" width="${W}" height="${f(H * 0.28)}" fill="url(#bfSea)"/>`;
      for ( let i = 0; i < 40; i++ ) {
        const y = hy - 20 + r() * H * 0.22, x = r() * W, w = 30 + r() * 90;
        body += `<path d="M${pt(x, y)} q${f(w / 2)},-6 ${f(w)},0" stroke="#ffffff" stroke-opacity="${f(0.25 + r() * 0.4)}" stroke-width="2.4" fill="none"/>`;
      }
      body += `<path d="${ridge(hy - 30, 80, r, { peaks: 3 })}" fill="${far}" opacity=".55" transform="translate(0,-10) scale(1,0.6) translate(0,${f(hy * 0.6)})"/>`;
      break;
    }
    case "caverna":
      body += `<rect x="0" y="0" width="${W}" height="${f(hy + 40)}" fill="${P.mid}"/>`;
      body += `<path d="${ridge(hy + 50, 260, r, { peaks: 9, sharp: false })}" fill="${P.far}"/>`;
      for ( let x = 0; x < W; x += 50 + r() * 90 ) {
        const L = 60 + r() * 220, w = 20 + r() * 35;
        body += `<path d="M${pt(x - w, -5)} L${pt(x, L)} L${pt(x + w, -5)} Z" fill="${shade(P.mid, 0.06 + r() * 0.08)}"/>`;
      }
      break;
    case "pantano":
      body += `<path d="${ridge(hy - 10, 90, r, { peaks: 7 })}" fill="${far}"/>`;
      for ( let x = -20; x < W + 40; x += 80 + r() * 130 ) body += deadTree(x, hy + 40 + r() * 20, 160 + r() * 130, mid);
      for ( let x = -40; x < W + 60; x += 40 + r() * 60 ) body += roundTree(x, hy + 55, 90 + r() * 60, shade(mid, 0.1), r);
      break;
    case "ruinas":
      body += `<path d="${ridge(hy - 10, 150, r, { peaks: 5, sharp: true })}" fill="${mix(P.far, haze, 0.3)}"/>`;
      body += `<path d="M${f(W * 0.08)},${f(hy + 30)} V${f(hy - 170)} Q${f(W * 0.14)},${f(hy - 260)} ${f(W * 0.2)},${f(hy - 170)} V${f(hy + 30)} H${f(W * 0.18)} V${f(hy - 160)} Q${f(W * 0.14)},${f(hy - 225)} ${f(W * 0.1)},${f(hy - 160)} V${f(hy + 30)} Z" fill="${far}"/>`;
      for ( let x = W * 0.3; x < W; x += 110 + r() * 160 ) body += column(x, hy + 35, 180 + r() * 120, mix(P.mid, haze, 0.25), r() < 0.55, r);
      break;
    default:
      break;
  }

  /* ground */
  const gy = hy + 30;
  defs += `<linearGradient id="bfGround" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(P.g1, haze, 0.25)}"/><stop offset=".45" stop-color="${P.g1}"/><stop offset="1" stop-color="${P.g2}"/></linearGradient>`;
  defs += noiseFilter("bfGroundTex", shade(P.g2, -0.25), "0.006 0.02", 4, seed, 2.4, -1.05);
  defs += noiseFilter("bfGroundFine", shade(P.g1, 0.3), "0.08 0.25", 2, seed + 4, 2.2, -1.1);
  if ( biome === "litoral" ) {
    const shore = `M-20,${f(gy + 120)} Q${f(W * 0.3)},${f(gy + 60)} ${f(W * 0.55)},${f(gy + 140)} T${f(W + 20)},${f(gy + 90)} L${f(W + 20)},${H} L-20,${H} Z`;
    body += `<path d="${shore}" fill="url(#bfGround)"/>`;
    body += `<path d="M-20,${f(gy + 120)} Q${f(W * 0.3)},${f(gy + 60)} ${f(W * 0.55)},${f(gy + 140)} T${f(W + 20)},${f(gy + 90)}" stroke="#ffffff" stroke-width="10" stroke-opacity=".7" fill="none"/>`;
    body += `<rect x="0" y="${f(gy)}" width="${W}" height="${f(H - gy)}" fill="#000" filter="url(#bfGroundTex)" opacity=".35" clip-path="url(#bfShoreClip)"/>`;
    defs += `<clipPath id="bfShoreClip"><path d="${shore}"/></clipPath>`;
  }
  else {
    body += `<rect x="0" y="${f(gy)}" width="${W}" height="${f(H - gy)}" fill="url(#bfGround)"/>`;
    body += `<rect x="0" y="${f(gy)}" width="${W}" height="${f(H - gy)}" fill="#000" filter="url(#bfGroundTex)" opacity=".38"/>`;
    body += `<rect x="0" y="${f(gy)}" width="${W}" height="${f(H - gy)}" fill="#000" filter="url(#bfGroundFine)" opacity=".25"/>`;
  }

  /* ground specials */
  const depth = y => (y - gy) / (H - gy); /* 0 at the horizon, 1 at the bottom */
  const scatter = (count, draw) => {
    for ( let i = 0; i < count; i++ ) {
      const t = Math.pow(r(), 0.75);
      const y = gy + 20 + t * (H - gy - 10);
      const s = 0.35 + depth(y) * 1.1;
      draw(r() * W, y, s);
    }
  };
  switch ( biome ) {
    case "planicie":
      body += `<path d="M${f(W * 0.46)},${f(gy)} Q${f(W * 0.5)},${f(gy + 300)} ${f(W * 0.38)},${H} L${f(W * 0.62)},${H} Q${f(W * 0.56)},${f(gy + 300)} ${f(W * 0.52)},${f(gy)} Z" fill="#c9a86b" opacity=".55"/>`;
      scatter(260, (x, y, s) => (body += tuft(x, y, 22 * s, r() < 0.5 ? P.det : shade(P.det, 0.2))));
      scatter(70, (x, y, s) => (body += flower(x, y, 6 * s, ["#ffffff", "#ffd1e8", "#fff27a", "#c9a8ff"][Math.floor(r() * 4)])));
      break;
    case "floresta":
      defs += `<linearGradient id="bfRay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe0" stop-opacity=".4"/><stop offset="1" stop-color="#fffbe0" stop-opacity="0"/></linearGradient>`;
      scatter(200, (x, y, s) => (body += tuft(x, y, 20 * s, shade(P.det, r() * 0.25))));
      scatter(26, (x, y, s) => (body += mushroom(x, y, 22 * s)));
      for ( let i = 0; i < 6; i++ ) {
        const x = W * (0.1 + r() * 0.8), w = 50 + r() * 80;
        body += `<path d="M${pt(x, 0)} L${pt(x + w, 0)} L${pt(x + w * 3.5, H)} L${pt(x + w * 1.4, H)} Z" fill="url(#bfRay)" opacity="${f(0.35 + r() * 0.35)}"/>`;
      }
      break;
    case "deserto":
      scatter(120, (x, y, s) => (body += `<path d="M${pt(x - 40 * s, y)} q${f(40 * s)},${f(-10 * s)} ${f(80 * s)},0" stroke="${shade(P.g2, -0.1)}" stroke-width="${f(2 * s + 0.6)}" fill="none" opacity=".6"/>`));
      scatter(18, (x, y, s) => (body += rock(x, y, 26 * s, shade(P.det, -0.15), r)));
      break;
    case "neve":
      scatter(60, (x, y, s) => (body += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(60 * s)}" ry="${f(10 * s)}" fill="#ffffff" opacity=".8"/><ellipse cx="${f(x + 8 * s)}" cy="${f(y + 6 * s)}" rx="${f(56 * s)}" ry="${f(6 * s)}" fill="${P.det}" opacity=".35"/>`));
      scatter(14, (x, y, s) => (body += crystal(x, y, 34 * s, "#bfe8ff")));
      break;
    case "vulcao": {
      defs += `<filter id="bfLava" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>`;
      let cracks = "";
      for ( let i = 0; i < 26; i++ ) {
        let x = r() * W, y = gy + 40 + r() * (H - gy - 40);
        const s = 0.4 + depth(y);
        let d = `M${pt(x, y)}`;
        for ( let k = 0; k < 6; k++ ) {
          x += (r() - 0.5) * 120 * s;
          y += (r() - 0.3) * 30 * s;
          d += ` L${pt(x, y)}`;
        }
        cracks += `<path d="${d}" stroke-width="${f(3 + 5 * s)}"/>`;
      }
      body += `<g stroke="#ff6a1f" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#bfLava)" opacity=".9">${cracks}</g>`;
      body += `<g stroke="#ffd36b" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".8" transform="scale(1)">${cracks.replace(/stroke-width="([\d.]+)"/g, (m, w) => `stroke-width="${f(Number(w) * 0.35)}"`)}</g>`;
      scatter(24, (x, y, s) => (body += rock(x, y, 30 * s, "#1a0f0d", r)));
      break;
    }
    case "litoral":
      scatter(26, (x, y, s) => (y > gy + 140 ? (body += shell(x, y, 16 * s, ["#f7d8c8", "#ffe9d2", "#e9b8a0"][Math.floor(r() * 3)], r() * 360)) : null));
      scatter(10, (x, y, s) => (y > gy + 160 ? (body += starfish(x, y, 20 * s, "#ff9a6b", r() * 360)) : null));
      break;
    case "caverna": {
      const cc = ELEMENTS[mana]?.color ?? "#7fd8ff";
      defs += `<filter id="bfGlow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="9"/></filter>`;
      scatter(30, (x, y, s) => (body += rock(x, y, 34 * s, shade(P.g2, -0.2), r)));
      for ( let i = 0; i < 12; i++ ) {
        const x = r() < 0.5 ? r() * W * 0.18 : W * (0.82 + r() * 0.18), y = gy + 60 + r() * (H - gy - 100), s = 0.6 + depth(y);
        body += `<ellipse cx="${f(x)}" cy="${f(y - 30 * s)}" rx="${f(50 * s)}" ry="${f(50 * s)}" fill="${cc}" opacity=".35" filter="url(#bfGlow)"/>`;
        body += crystal(x - 14 * s, y, 60 * s, cc) + crystal(x + 10 * s, y + 4, 42 * s, shade(cc, -0.15));
      }
      break;
    }
    case "pantano":
      scatter(26, (x, y, s) => (body += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(120 * s)}" ry="${f(22 * s)}" fill="#2a3420" opacity=".75"/><ellipse cx="${f(x - 20 * s)}" cy="${f(y - 4 * s)}" rx="${f(60 * s)}" ry="${f(6 * s)}" fill="#9fb08a" opacity=".25"/>`));
      scatter(40, (x, y, s) => (body += reeds(x, y, 50 * s, "#4d5a2e")));
      scatter(16, (x, y, s) => (body += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(18 * s)}" ry="${f(7 * s)}" fill="#5e8a3a"/>`));
      break;
    case "ruinas": {
      let tiles = "";
      for ( let i = -12; i <= 12; i++ ) tiles += `<path d="M${pt(W / 2 + i * 40, gy)} L${pt(W / 2 + i * 260, H)}"/>`;
      for ( let k = 1; k < 9; k++ ) {
        const y = gy + (H - gy) * Math.pow(k / 9, 1.6);
        tiles += `<path d="M0,${f(y)} H${W}"/>`;
      }
      body += `<g stroke="${shade(P.g2, -0.25)}" stroke-width="2.5" opacity=".45">${tiles}</g>`;
      scatter(22, (x, y, s) => (body += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(50 * s)}" ry="${f(14 * s)}" fill="#6f7f45" opacity=".45"/>`));
      scatter(16, (x, y, s) => (body += rock(x, y, 22 * s, shade(P.mid, 0.1), r)));
      break;
    }
    default:
      break;
  }

  /* foreground frame */
  const fg = shade(P.g2, -0.45);
  switch ( biome ) {
    case "floresta":
      body += `<path d="M-10,0 H120 Q90,${f(H * 0.4)} 140,${H} H-10 Z M${f(W + 10)},0 H${f(W - 110)} Q${f(W - 80)},${f(H * 0.5)} ${f(W - 150)},${H} H${f(W + 10)} Z" fill="#1b2a14"/>`;
      body += fern(60, H, 240, "#20401c", 1) + fern(W - 60, H, 260, "#20401c", -1);
      for ( let i = 0; i < 6; i++ ) body += `<path d="${blob(r() * W, -30, 180 + r() * 140, 90, r, 0.4, 9)}" fill="#1e3a1c" opacity=".92"/>`;
      break;
    case "planicie":
      for ( let i = 0; i < 14; i++ ) body += tuft(r() < 0.5 ? r() * 260 : W - r() * 260, H + 5, 90 + r() * 70, fg);
      break;
    case "deserto":
      body += rock(80, H + 40, 260, shade(P.det, -0.35), r) + rock(W - 60, H + 60, 300, shade(P.det, -0.4), r);
      body += `<path d="M${f(W - 210)},${H} V${f(H - 260)} Q${f(W - 210)},${f(H - 300)} ${f(W - 180)},${f(H - 300)} Q${f(W - 150)},${f(H - 300)} ${f(W - 150)},${f(H - 260)} V${H} Z M${f(W - 210)},${f(H - 160)} H${f(W - 250)} V${f(H - 220)}" fill="#3d6b3a" stroke="#3d6b3a" stroke-width="26" stroke-linecap="round"/>`;
      break;
    case "neve":
      body += pineTree(90, H + 60, 520, "#284757", true) + pineTree(W - 70, H + 80, 560, "#284757", true);
      body += `<path d="${blob(W * 0.15, H + 30, 420, 90, r, 0.2, 9)}" fill="#ffffff"/><path d="${blob(W * 0.85, H + 40, 420, 90, r, 0.2, 9)}" fill="#ffffff"/>`;
      break;
    case "vulcao":
      body += `<path d="M-10,${H} L-10,${f(H * 0.35)} L70,${f(H * 0.5)} L40,${f(H * 0.7)} L150,${H} Z M${f(W + 10)},${H} L${f(W + 10)},${f(H * 0.4)} L${f(W - 90)},${f(H * 0.58)} L${f(W - 50)},${f(H * 0.75)} L${f(W - 170)},${H} Z" fill="#120a09"/>`;
      break;
    case "litoral":
      body += palmTree(W - 120, H + 30, 640, "#2f5d2a", -1) + palmTree(120, H + 40, 560, "#2f5d2a", 1);
      body += rock(W * 0.45, H + 50, 200, "#4a4440", r);
      break;
    case "caverna":
      body += `<path d="M-10,0 L-10,${H} L120,${H} Q60,${f(H * 0.5)} 160,0 Z M${f(W + 10)},0 L${f(W + 10)},${H} L${f(W - 130)},${H} Q${f(W - 60)},${f(H * 0.45)} ${f(W - 170)},0 Z" fill="#0f0e13"/>`;
      for ( let i = 0; i < 6; i++ ) {
        const x = r() < 0.5 ? r() * 300 : W - r() * 300, s = 120 + r() * 120;
        body += `<path d="M${pt(x - s * 0.3, H + 5)} L${pt(x, H - s)} L${pt(x + s * 0.3, H + 5)} Z" fill="#17151c"/>`;
      }
      break;
    case "pantano":
      body += deadTree(120, H + 20, 700, "#151a10") + reeds(W - 160, H + 5, 260, "#232a14") + reeds(260, H + 5, 200, "#232a14");
      break;
    case "ruinas":
      body += column(110, H + 30, 760, "#5d5a52", true, r) + column(W - 120, H + 30, 820, "#5d5a52", false, r);
      body += rock(W * 0.5, H + 60, 220, "#6b6658", r);
      break;
    default:
      break;
  }

  /* atmosphere */
  if ( biome === "pantano" ) {
    defs += `<linearGradient id="bfFog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9d4b0" stop-opacity="0"/><stop offset=".5" stop-color="#c9d4b0" stop-opacity=".35"/><stop offset="1" stop-color="#c9d4b0" stop-opacity="0"/></linearGradient>`;
    body += `<rect x="0" y="${f(gy - 120)}" width="${W}" height="380" fill="url(#bfFog)"/>`;
  }
  if ( time === "entardecer" ) body += `<rect width="${W}" height="${H}" fill="#ff9a5a" opacity=".16" style="mix-blend-mode:multiply"/>`;
  if ( time === "noite" && biome !== "caverna" ) body += `<rect width="${W}" height="${H}" fill="#1a2350" opacity=".5"/>`;
  if ( biome === "caverna" ) body += `<rect width="${W}" height="${H}" fill="#0a0912" opacity="${time === "noite" ? 0.35 : 0.15}"/>`;

  const m = manaLayer(mana, r, { y0: gy, y1: H, cy: gy + (H - gy) * 0.55, ry: (H - gy) * 0.5 });
  defs += m.defs;
  body += m.body;

  defs += `<radialGradient id="bfVig" cx="50%" cy="55%" r="75%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>`;
  body += `<rect width="${W}" height="${H}" fill="url(#bfVig)"/>`;
  void slots;
  return wrap(defs, body);
}

/* ---------------------------------------------------------------------------------------------- */
/* Table (top view)                                                                                 */
/* ---------------------------------------------------------------------------------------------- */

const MATS = {
  planicie: { mat: "#3f6b3a", edge: "#c9a24a", emblem: "wheat" },
  floresta: { mat: "#24502f", edge: "#b9a36a", emblem: "leaf" },
  deserto: { mat: "#9a5a2c", edge: "#f0c070", emblem: "sun" },
  neve: { mat: "#3f5f86", edge: "#dfeaff", emblem: "snow" },
  vulcao: { mat: "#5a1a14", edge: "#ff8a3a", emblem: "flame" },
  litoral: { mat: "#1f5f73", edge: "#f2deaa", emblem: "wave" },
  caverna: { mat: "#2e2d3a", edge: "#9aa0c0", emblem: "crystal" },
  pantano: { mat: "#3c4426", edge: "#b7b07a", emblem: "lily" },
  ruinas: { mat: "#4a3f5c", edge: "#d6c08a", emblem: "column" }
};

const WOODS = {
  escura: { a: "#4a2c17", b: "#2a170a" },
  clara: { a: "#ad7a45", b: "#7a4f28" },
  pedra: { a: "#77726c", b: "#3f3c39" }
};

function emblem(kind, cx, cy, s, c) {
  switch ( kind ) {
    case "leaf": return `<path d="M${pt(cx, cy + s)} Q${pt(cx - s, cy)} ${pt(cx, cy - s)} Q${pt(cx + s, cy)} ${pt(cx, cy + s)} Z M${pt(cx, cy + s)} L${pt(cx, cy - s * 0.8)}" fill="none" stroke="${c}" stroke-width="${f(s * 0.06)}"/>`;
    case "sun": {
      let g = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(s * 0.4)}" fill="none" stroke="${c}" stroke-width="${f(s * 0.06)}"/>`;
      for ( let i = 0; i < 12; i++ ) {
        const a = (i / 12) * Math.PI * 2;
        g += `<path d="M${pt(cx + Math.cos(a) * s * 0.55, cy + Math.sin(a) * s * 0.55)} L${pt(cx + Math.cos(a) * s * 0.95, cy + Math.sin(a) * s * 0.95)}" stroke="${c}" stroke-width="${f(s * 0.05)}"/>`;
      }
      return g;
    }
    case "snow": {
      let g = "";
      for ( let i = 0; i < 6; i++ ) {
        const a = (i / 6) * Math.PI * 2;
        const ex = cx + Math.cos(a) * s, ey = cy + Math.sin(a) * s;
        g += `<path d="M${pt(cx, cy)} L${pt(ex, ey)} M${pt(cx + Math.cos(a) * s * 0.6 + Math.cos(a + 0.8) * s * 0.25, cy + Math.sin(a) * s * 0.6 + Math.sin(a + 0.8) * s * 0.25)} L${pt(cx + Math.cos(a) * s * 0.6, cy + Math.sin(a) * s * 0.6)} L${pt(cx + Math.cos(a) * s * 0.6 + Math.cos(a - 0.8) * s * 0.25, cy + Math.sin(a) * s * 0.6 + Math.sin(a - 0.8) * s * 0.25)}" stroke="${c}" stroke-width="${f(s * 0.05)}" fill="none"/>`;
      }
      return g;
    }
    case "flame": return `<path d="M${pt(cx, cy + s)} Q${pt(cx - s * 0.8, cy + s * 0.3)} ${pt(cx - s * 0.2, cy - s * 0.4)} Q${pt(cx - s * 0.1, cy)} ${pt(cx + s * 0.05, cy - s)} Q${pt(cx + s * 0.9, cy + s * 0.1)} ${pt(cx, cy + s)} Z" fill="none" stroke="${c}" stroke-width="${f(s * 0.06)}"/>`;
    case "wave": return `<path d="M${pt(cx - s, cy)} q${f(s * 0.25)},${f(-s * 0.5)} ${f(s * 0.5)},0 t${f(s * 0.5)},0 t${f(s * 0.5)},0 t${f(s * 0.5)},0 M${pt(cx - s, cy + s * 0.4)} q${f(s * 0.25)},${f(-s * 0.5)} ${f(s * 0.5)},0 t${f(s * 0.5)},0 t${f(s * 0.5)},0 t${f(s * 0.5)},0" fill="none" stroke="${c}" stroke-width="${f(s * 0.06)}"/>`;
    case "crystal": return `<path d="M${pt(cx, cy - s)} L${pt(cx + s * 0.4, cy - s * 0.4)} L${pt(cx + s * 0.3, cy + s)} L${pt(cx - s * 0.3, cy + s)} L${pt(cx - s * 0.4, cy - s * 0.4)} Z M${pt(cx, cy - s)} L${pt(cx, cy + s)}" fill="none" stroke="${c}" stroke-width="${f(s * 0.05)}"/>`;
    case "lily": return `<path d="M${pt(cx, cy)} m${f(-s)},0 a${f(s)},${f(s * 0.7)} 0 1 0 ${f(s * 2)},0 a${f(s)},${f(s * 0.7)} 0 1 0 ${f(-s * 2)},0 M${pt(cx, cy)} L${pt(cx + s * 0.9, cy - s * 0.3)}" fill="none" stroke="${c}" stroke-width="${f(s * 0.06)}"/>`;
    case "column": return `<path d="M${pt(cx - s * 0.6, cy - s)} H${f(cx + s * 0.6)} M${pt(cx - s * 0.6, cy + s)} H${f(cx + s * 0.6)} M${pt(cx - s * 0.35, cy - s)} V${f(cy + s)} M${pt(cx, cy - s)} V${f(cy + s)} M${pt(cx + s * 0.35, cy - s)} V${f(cy + s)}" stroke="${c}" stroke-width="${f(s * 0.06)}"/>`;
    case "wheat":
    default: {
      let g = `<path d="M${pt(cx, cy + s)} L${pt(cx, cy - s)}" stroke="${c}" stroke-width="${f(s * 0.05)}"/>`;
      for ( let i = 0; i < 5; i++ ) {
        const y = cy - s * 0.8 + i * s * 0.32;
        g += `<path d="M${pt(cx, y + s * 0.15)} q${f(-s * 0.3)},${f(-s * 0.1)} ${f(-s * 0.3)},${f(-s * 0.35)} q${f(s * 0.25)},${f(s * 0.05)} ${f(s * 0.3)},${f(s * 0.35)} Z M${pt(cx, y + s * 0.15)} q${f(s * 0.3)},${f(-s * 0.1)} ${f(s * 0.3)},${f(-s * 0.35)} q${f(-s * 0.25)},${f(s * 0.05)} ${f(-s * 0.3)},${f(s * 0.35)} Z" fill="${c}"/>`;
      }
      return g;
    }
  }
}

function cardBack(x, y, w, h, rot, c1, c2) {
  return `<g transform="translate(${pt(x, y)}) rotate(${f(rot)})">`
    + `<rect x="${f(-w / 2 + 4)}" y="${f(-h / 2 + 6)}" width="${f(w)}" height="${f(h)}" rx="${f(w * 0.07)}" fill="#000" opacity=".35"/>`
    + `<rect x="${f(-w / 2)}" y="${f(-h / 2)}" width="${f(w)}" height="${f(h)}" rx="${f(w * 0.07)}" fill="${c1}" stroke="#e9d9a8" stroke-width="3"/>`
    + `<rect x="${f(-w / 2 + 10)}" y="${f(-h / 2 + 10)}" width="${f(w - 20)}" height="${f(h - 20)}" rx="${f(w * 0.05)}" fill="none" stroke="${c2}" stroke-width="2"/>`
    + `<path d="M0,${f(-h * 0.3)} L${f(w * 0.25)},0 L0,${f(h * 0.3)} L${f(-w * 0.25)},0 Z" fill="none" stroke="${c2}" stroke-width="2.5"/>`
    + `<circle r="${f(w * 0.08)}" fill="${c2}"/></g>`;
}

function die(x, y, s, rot, c, n) {
  let d = "";
  for ( let i = 0; i < 6; i++ ) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    d += `${i ? "L" : "M"}${pt(Math.cos(a) * s, Math.sin(a) * s)}`;
  }
  return `<g transform="translate(${pt(x, y)}) rotate(${f(rot)})"><ellipse cx="6" cy="${f(s * 0.9)}" rx="${f(s * 0.95)}" ry="${f(s * 0.3)}" fill="#000" opacity=".3"/>`
    + `<path d="${d} Z" fill="${c}" stroke="${shade(c, -0.4)}" stroke-width="2"/>`
    + `<path d="M0,${f(-s)} L${f(s * 0.866)},${f(s * 0.5)} L${f(-s * 0.866)},${f(s * 0.5)} Z" fill="${shade(c, 0.15)}" stroke="${shade(c, -0.4)}" stroke-width="1.5"/>`
    + `<text x="0" y="${f(s * 0.22)}" font-size="${f(s * 0.62)}" font-family="Georgia, serif" font-weight="700" text-anchor="middle" fill="${shade(c, -0.6)}">${n}</text></g>`;
}

function candle(x, y, s) {
  return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(s * 1.6)}" ry="${f(s * 1.6)}" fill="url(#bfCandleGlow)"/>`
    + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.55)}" fill="#c9b48a" stroke="#6b5a3a" stroke-width="3"/>`
    + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.36)}" fill="#f4ead2"/>`
    + `<path d="M${pt(x, y - s * 0.32)} q${f(s * 0.12)},${f(s * 0.18)} 0,${f(s * 0.3)} q${f(-s * 0.12)},${f(-s * 0.12)} 0,${f(-s * 0.3)} Z" fill="#ffcf5a"/>`;
}

function manaBox(x, y, w, h, el, r) {
  const c = ELEMENTS[el]?.color ?? "#ffe8f0";
  let g = `<g transform="translate(${pt(x, y)}) rotate(-4)">`
    + `<rect x="8" y="12" width="${f(w)}" height="${f(h)}" rx="10" fill="#000" opacity=".4"/>`
    + `<rect width="${f(w)}" height="${f(h)}" rx="10" fill="#5a2a14" stroke="#2a1206" stroke-width="4"/>`
    + `<rect x="16" y="16" width="${f(w - 32)}" height="${f(h - 32)}" rx="6" fill="#6b0f1c"/>`
    + `<rect x="16" y="16" width="${f(w - 32)}" height="${f(h - 32)}" rx="6" fill="url(#bfVelvet)"/>`;
  for ( let i = 0; i < 7; i++ ) {
    const cx = 34 + r() * (w - 68), cy = 34 + r() * (h - 68), s = 26 + r() * 16;
    g += `<g transform="translate(${pt(cx, cy)}) rotate(${f(r() * 360)})"><ellipse cx="0" cy="0" rx="${f(s * 0.9)}" ry="${f(s * 0.9)}" fill="${c}" opacity=".25" filter="url(#bfSoft)"/>`
      + `<path d="M0,${f(-s * 0.7)} L${f(s * 0.6)},${f(-s * 0.2)} L${f(s * 0.45)},${f(s * 0.6)} L${f(-s * 0.45)},${f(s * 0.6)} L${f(-s * 0.6)},${f(-s * 0.2)} Z" fill="${c}" opacity=".88" stroke="${shade(c, -0.35)}" stroke-width="2"/>`
      + `<path d="M0,${f(-s * 0.7)} L${f(s * 0.6)},${f(-s * 0.2)} L0,${f(s * 0.05)} Z" fill="#fff" opacity=".45"/></g>`;
  }
  return `${g}</g>`;
}

export function tableSVG({ biome = "planicie", table = "escura", mana = "", seed = 1, slots = { party: [], foes: [] } } = {}) {
  const M = MATS[biome] ?? MATS.planicie;
  const WD = WOODS[table] ?? WOODS.escura;
  const r = rng(seed * 104729 + biome.length * 17);
  let defs = "";
  let body = "";

  /* table */
  if ( table === "pedra" ) {
    defs += `<filter id="bfStone" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="5" seed="${seed}" result="t"/>`
      + `<feDiffuseLighting in="t" surfaceScale="3" lighting-color="#ffffff" result="l"><feDistantLight azimuth="235" elevation="48"/></feDiffuseLighting>`
      + `<feComposite in="l" in2="SourceGraphic" operator="arithmetic" k1="1.3" k2="0" k3="0" k4="-0.05"/></filter>`;
    body += `<rect width="${W}" height="${H}" fill="${WD.a}" filter="url(#bfStone)"/>`;
  }
  else {
    defs += noiseFilter("bfGrain", WD.b, "0.002 0.09", 3, seed, 3, -1.25);
    body += `<rect width="${W}" height="${H}" fill="${WD.a}"/><rect width="${W}" height="${H}" fill="#000" filter="url(#bfGrain)" opacity=".85"/>`;
    for ( let y = 150; y < H; y += 150 + r() * 40 ) body += `<path d="M0,${f(y)} H${W}" stroke="${shade(WD.b, -0.3)}" stroke-width="4" opacity=".7"/><path d="M0,${f(y + 3)} H${W}" stroke="${shade(WD.a, 0.25)}" stroke-width="1.5" opacity=".35"/>`;
  }
  defs += `<radialGradient id="bfLamp" cx="50%" cy="48%" r="70%"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".22"/><stop offset=".55" stop-color="#ffd9a0" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>`;

  /* play mat */
  const mx = W * 0.13, my = H * 0.05, mw = W * 0.74, mh = H * 0.9;
  defs += `<radialGradient id="bfMat" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="${shade(M.mat, 0.12)}"/><stop offset="1" stop-color="${shade(M.mat, -0.35)}"/></radialGradient>`;
  defs += noiseFilter("bfFelt", shade(M.mat, -0.5), "0.6", 2, seed + 2, 2, -0.9);
  body += `<rect x="${f(mx + 10)}" y="${f(my + 16)}" width="${f(mw)}" height="${f(mh)}" rx="38" fill="#000" opacity=".45"/>`;
  body += `<rect x="${f(mx)}" y="${f(my)}" width="${f(mw)}" height="${f(mh)}" rx="38" fill="url(#bfMat)"/>`;
  body += `<rect x="${f(mx)}" y="${f(my)}" width="${f(mw)}" height="${f(mh)}" rx="38" fill="#000" filter="url(#bfFelt)" opacity=".16"/>`;
  body += `<rect x="${f(mx + 18)}" y="${f(my + 18)}" width="${f(mw - 36)}" height="${f(mh - 36)}" rx="26" fill="none" stroke="${M.edge}" stroke-width="3" stroke-dasharray="14 9" opacity=".75"/>`;
  body += `<rect x="${f(mx + 34)}" y="${f(my + 34)}" width="${f(mw - 68)}" height="${f(mh - 68)}" rx="20" fill="none" stroke="${M.edge}" stroke-width="1.5" opacity=".35"/>`;
  body += `<g opacity=".14">${emblem(M.emblem, W / 2, H / 2, 150, M.edge)}</g>`;
  /* battle line */
  body += `<path d="M${f(mx + 80)},${f(H / 2)} H${f(W / 2 - 70)} M${f(W / 2 + 70)},${f(H / 2)} H${f(mx + mw - 80)}" stroke="${M.edge}" stroke-width="2.5" opacity=".55"/>`;
  body += `<path d="M${f(W / 2)},${f(H / 2 - 34)} L${f(W / 2 + 34)},${f(H / 2)} L${f(W / 2)},${f(H / 2 + 34)} L${f(W / 2 - 34)},${f(H / 2)} Z" fill="none" stroke="${M.edge}" stroke-width="3" opacity=".7"/>`;
  /* card slots */
  for ( const [side, list] of [["foes", slots.foes ?? []], ["party", slots.party ?? []]] ) {
    for ( const s of list ) {
      body += `<rect x="${f(s.x - s.w / 2 - 10)}" y="${f(s.y - s.h / 2 - 10)}" width="${f(s.w + 20)}" height="${f(s.h + 20)}" rx="16" fill="${side === "foes" ? "#3a0a10" : "#0a1a3a"}" fill-opacity=".25" stroke="${M.edge}" stroke-width="2.5" stroke-dasharray="10 7" opacity=".85"/>`;
    }
  }

  /* props */
  defs += `<radialGradient id="bfCandleGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffcf6b" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf6b" stop-opacity="0"/></radialGradient>`;
  defs += `<radialGradient id="bfVelvet" cx="40%" cy="35%" r="80%"><stop offset="0" stop-color="#b0263a" stop-opacity=".7"/><stop offset="1" stop-color="#3a0510" stop-opacity=".8"/></radialGradient>`;
  defs += `<filter id="bfSoft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>`;
  body += manaBox(36, 60, 230, 200, mana, r);
  for ( let i = 0; i < 5; i++ ) body += cardBack(W - 150 + i * 3, 230 - i * 4, 150, 220, -8 + i * 2, "#3a1a4a", "#d9c27a");
  body += cardBack(W - 170, 520, 150, 220, 14, "#3a1a4a", "#d9c27a");
  body += die(W - 120, H - 300, 46, r() * 60, "#e8e2d4", 3 + Math.floor(r() * 8)) + die(W - 200, H - 210, 40, r() * 60, "#b02a3a", 3 + Math.floor(r() * 6));
  body += candle(150, H - 170, 70) + candle(W - 140, H - 90, 55);

  const deco = BIOME_PROPS[biome];
  if ( deco ) body += deco(r);

  const m = manaLayer(mana, r, { y0: my, y1: my + mh, cy: H / 2, ry: mh * 0.5 }, 0.4);
  defs += m.defs;
  body += m.body;
  body += `<rect width="${W}" height="${H}" fill="url(#bfLamp)"/>`;
  return wrap(defs, body);
}

/** Small objects of each biome, scattered on the wood around the mat (left/right margins and corners). */
const margin = r => (r() < 0.5 ? 20 + r() * 230 : W - 250 + r() * 230);
const BIOME_PROPS = {
  planicie: r => {
    let g = "";
    for ( let i = 0; i < 4; i++ ) g += `<g transform="translate(${pt(margin(r), 380 + r() * 600)}) rotate(${f(r() * 360)})">${emblem("wheat", 0, 0, 60, "#e3c46b")}</g>`;
    for ( let i = 0; i < 6; i++ ) g += `<circle cx="${f(margin(r))}" cy="${f(360 + r() * 650)}" r="18" fill="#e8b84a" stroke="#8a6a1a" stroke-width="3"/>`;
    return g;
  },
  floresta: r => {
    let g = "";
    for ( let i = 0; i < 14; i++ ) {
      const x = r() < 0.6 ? margin(r) : W * (0.15 + r() * 0.7), y = r() < 0.5 ? 30 + r() * 60 : H - 30 - r() * 60;
      g += `<g transform="translate(${pt(x, y)}) rotate(${f(r() * 360)})"><path d="M0,40 Q-34,0 0,-40 Q34,0 0,40 Z" fill="${["#4f8a3a", "#a5732f", "#c9902f", "#6b9a3a"][Math.floor(r() * 4)]}"/><path d="M0,40 L0,-36" stroke="#2a3a18" stroke-width="2"/></g>`;
    }
    g += mushroom(W - 160, H - 420, 70) + mushroom(W - 110, H - 400, 50);
    return g;
  },
  deserto: r => {
    let g = `<path d="${blob(140, H - 420, 120, 60, r, 0.3)}" fill="#e2c084" opacity=".9"/>`;
    for ( let i = 0; i < 40; i++ ) g += `<circle cx="${f(60 + r() * 200)}" cy="${f(H - 480 + r() * 130)}" r="${f(1 + r() * 2)}" fill="#c9a060"/>`;
    g += `<g transform="translate(${W - 160},${H - 440}) rotate(-20)"><ellipse rx="44" ry="36" fill="#efe6d2"/><circle cx="-16" cy="-4" r="9" fill="#2a2016"/><circle cx="14" cy="-4" r="9" fill="#2a2016"/><rect x="-14" y="20" width="28" height="16" rx="4" fill="#efe6d2"/></g>`;
    return g;
  },
  neve: r => {
    let g = "";
    for ( let i = 0; i < 10; i++ ) g += `<g opacity=".8">${emblem("snow", margin(r), 340 + r() * 700, 22 + r() * 18, "#e9f6ff")}</g>`;
    for ( const [cx, cy] of [[0, 0], [W, 0], [0, H], [W, H]] ) g += `<path d="${blob(cx, cy, 190, 150, r, 0.5, 11)}" fill="#eef8ff" opacity=".5"/>`;
    return g;
  },
  vulcao: r => {
    let g = "";
    for ( let i = 0; i < 8; i++ ) g += `<path d="M${pt(margin(r), 380 + r() * 620)} l18,-40 l16,38 l-12,14 Z" fill="#14100f" stroke="#ff6a1f" stroke-width="2" opacity=".9"/>`;
    for ( let i = 0; i < 26; i++ ) g += `<circle cx="${f(margin(r))}" cy="${f(300 + r() * 800)}" r="${f(2 + r() * 3)}" fill="#ff8a3a" opacity="${f(0.5 + r() * 0.5)}"/>`;
    return g;
  },
  litoral: r => {
    let g = "";
    for ( let i = 0; i < 6; i++ ) g += shell(margin(r), 380 + r() * 600, 34, ["#f7d8c8", "#ffe9d2", "#e9b8a0"][i % 3], r() * 360);
    g += starfish(150, H - 430, 44, "#ff9a6b", 20) + starfish(W - 150, H - 470, 38, "#ffb36b", -30);
    g += `<g fill="none" stroke="#c9a46a" stroke-width="9" opacity=".95"><circle cx="150" cy="430" r="46"/><circle cx="150" cy="430" r="30"/><circle cx="150" cy="430" r="14"/></g>`;
    return g;
  },
  caverna: r => {
    let g = `<g transform="translate(${W - 170},${H - 440}) rotate(15)"><ellipse rx="44" ry="38" fill="#e8e0cc"/><circle cx="-15" cy="-4" r="10" fill="#1a1612"/><circle cx="15" cy="-4" r="10" fill="#1a1612"/><rect x="-16" y="22" width="32" height="16" rx="4" fill="#e8e0cc"/></g>`;
    g += `<g transform="translate(140,${H - 440}) rotate(-25)"><circle r="22" fill="none" stroke="#8a8f99" stroke-width="7"/><rect x="18" y="-5" width="70" height="10" fill="#8a8f99"/><rect x="72" y="5" width="8" height="18" fill="#8a8f99"/></g>`;
    for ( let i = 0; i < 6; i++ ) g += `<ellipse cx="${f(120 + i * 22)}" cy="${f(380 + i * 18)}" rx="14" ry="9" fill="none" stroke="#6b707a" stroke-width="5"/>`;
    return g;
  },
  pantano: r => {
    let g = "";
    for ( let i = 0; i < 4; i++ ) g += `<g transform="translate(${pt(margin(r), 380 + r() * 600)})">${emblem("lily", 0, 0, 40, "#5e8a3a").replace('fill="none"', 'fill="#5e8a3a"')}</g>`;
    g += reeds(140, H - 380, 110, "#4d5a2e") + reeds(W - 140, H - 400, 120, "#4d5a2e");
    return g;
  },
  ruinas: r => {
    let g = column(140, H - 380, 170, "#a39a85", true, r);
    for ( let i = 0; i < 6; i++ ) g += `<circle cx="${f(margin(r))}" cy="${f(360 + r() * 650)}" r="17" fill="#d9b44a" stroke="#7a5a1a" stroke-width="3"/>`;
    g += `<g transform="translate(${W - 170},${H - 460}) rotate(-12)"><rect x="-70" y="-40" width="140" height="80" rx="6" fill="#e8dcc0" stroke="#8a7350" stroke-width="3"/><rect x="-80" y="-46" width="14" height="92" rx="7" fill="#c9b48a"/><rect x="66" y="-46" width="14" height="92" rx="7" fill="#c9b48a"/><path d="M-50,-15 H40 M-50,0 H30 M-50,15 H45" stroke="#8a7350" stroke-width="3"/></g>`;
    return g;
  }
};

function wrap(defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${body}</svg>`;
}

/** The background SVG for a battle setup (scale = output pixels per scene pixel). */
export function backgroundSVG(setup, scale = 1) {
  const svg = setup.layout === "mesa" ? tableSVG(setup) : fieldSVG(setup);
  if ( scale === 1 ) return svg;
  return svg.replace(`width="${W}" height="${H}"`, `width="${Math.round(W * scale)}" height="${Math.round(H * scale)}"`);
}

export { BIOMES };
