/**
 * Batalhas FU: the effect images (SVG sources). tools/gerar-fx.html rasterises them into assets/fx/*.webp.
 * They are drawn in white/light grey so Sequencer's .tint() (and the DOM fallback) can colour them by element.
 * Not shipped in the module zip; the .webp files are.
 */
const S = 512;
const f = n => +Number(n).toFixed(1);
const svg = (body, w = S, h = S, defs = "") => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>`
  + `<filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>`
  + `<filter id="g2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>`
  + `<filter id="g1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>${defs}</defs>${body}</svg>`;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Crescent with pointed tips: an arc of radius R from angle a0 to a1, closed by a flatter arc of radius R2. */
function crescent(cx, cy, R, R2, a0, a1) {
  const x0 = cx + Math.cos(a0) * R, y0 = cy + Math.sin(a0) * R, x1 = cx + Math.cos(a1) * R, y1 = cy + Math.sin(a1) * R;
  return `M${f(x0)},${f(y0)} A${R},${R} 0 0 1 ${f(x1)},${f(y1)} A${R2},${R2} 0 0 0 ${f(x0)},${f(y0)} Z`;
}

function star(cx, cy, n, R, r, rot = 0) {
  let d = "";
  for ( let i = 0; i < n * 2; i++ ) {
    const a = rot + (i / (n * 2)) * Math.PI * 2;
    const rr = i % 2 ? r : R;
    d += `${i ? "L" : "M"}${f(cx + Math.cos(a) * rr)},${f(cy + Math.sin(a) * rr)} `;
  }
  return `${d}Z`;
}

export const FX = {
  /* a crescent blade arc with speed lines */
  slash: () => svg(
    `<path d="${crescent(236, 256, 220, 290, -1.2, 1.2)}" fill="#ffffff" filter="url(#g)" opacity=".8"/>`
    + `<path d="${crescent(236, 256, 220, 290, -1.2, 1.2)}" fill="#ffffff"/>`
    + `<path d="${crescent(236, 256, 200, 330, -1.0, 1.0)}" fill="#ffffff" opacity=".55"/>`
    + [0.6, 0.2, -0.25, -0.65].map((a, i) => `<path d="M${f(256 + Math.cos(a) * 170)},${f(256 + Math.sin(a) * 170)} L${f(256 + Math.cos(a + 0.18) * 120 - 40)},${f(256 + Math.sin(a + 0.18) * 120)}" stroke="#ffffff" stroke-width="${4 - i * 0.5}" stroke-linecap="round" opacity=".7"/>`).join("")
  ),
  /* three claw scratches */
  claw: () => svg([-70, 0, 70].map(o => `<path d="M${f(150 + o)},${f(90)} Q${f(250 + o * 0.6)},${f(240)} ${f(330 + o)},${f(430)} Q${f(260 + o * 0.6)},${f(250)} ${f(150 + o)},${f(90)} Z" fill="#ffffff" stroke="#ffffff" stroke-width="10" stroke-linejoin="round"/>`).join("")
    .replace(/^/, [-70, 0, 70].map(o => `<path d="M${f(150 + o)},${f(90)} Q${f(250 + o * 0.6)},${f(240)} ${f(330 + o)},${f(430)}" stroke="#ffffff" stroke-width="34" stroke-linecap="round" fill="none" filter="url(#g)" opacity=".7"/>`).join(""))),
  /* starburst impact */
  impact: () => {
    const r = rng(11);
    let sparks = "";
    for ( let i = 0; i < 18; i++ ) {
      const a = r() * Math.PI * 2, d1 = 120 + r() * 60, d2 = d1 + 30 + r() * 60;
      sparks += `<path d="M${f(256 + Math.cos(a) * d1)},${f(256 + Math.sin(a) * d1)} L${f(256 + Math.cos(a) * d2)},${f(256 + Math.sin(a) * d2)}" stroke="#ffffff" stroke-width="${f(3 + r() * 5)}" stroke-linecap="round"/>`;
    }
    return svg(`<circle cx="256" cy="256" r="150" fill="#ffffff" filter="url(#g2)" opacity=".75"/>`
      + `<path d="${star(256, 256, 12, 200, 70, 0.1)}" fill="#ffffff" filter="url(#g1)"/>`
      + `<path d="${star(256, 256, 8, 130, 50, 0.4)}" fill="#ffffff"/>`
      + `<circle cx="256" cy="256" r="58" fill="#ffffff"/>` + sparks);
  },
  /* glowing ring (shockwave, guard) */
  ring: () => svg(`<circle cx="256" cy="256" r="200" fill="none" stroke="#ffffff" stroke-width="40" filter="url(#g)" opacity=".7"/>`
    + `<circle cx="256" cy="256" r="200" fill="none" stroke="#ffffff" stroke-width="12"/>`
    + `<circle cx="256" cy="256" r="176" fill="none" stroke="#ffffff" stroke-width="3" opacity=".6"/>`),
  /* magic circle with runes */
  circle: () => {
    let g = `<circle cx="256" cy="256" r="236" fill="none" stroke="#ffffff" stroke-width="22" filter="url(#g)" opacity=".55"/>`
      + `<circle cx="256" cy="256" r="236" fill="none" stroke="#ffffff" stroke-width="7"/>`
      + `<circle cx="256" cy="256" r="196" fill="none" stroke="#ffffff" stroke-width="4"/>`
      + `<circle cx="256" cy="256" r="120" fill="none" stroke="#ffffff" stroke-width="5"/>`
      + `<path d="${star(256, 256, 6, 196, 196 * 0.5, -Math.PI / 2)}" fill="none" stroke="#ffffff" stroke-width="4" opacity=".9"/>`;
    const tri = a => [0, 1, 2].map(k => `${f(256 + Math.cos(a + (k * 2 * Math.PI) / 3) * 120)},${f(256 + Math.sin(a + (k * 2 * Math.PI) / 3) * 120)}`).join(" L");
    g += `<path d="M${tri(-Math.PI / 2)} Z M${tri(Math.PI / 2)} Z" fill="none" stroke="#ffffff" stroke-width="4"/>`;
    for ( let i = 0; i < 24; i++ ) {
      const a = (i / 24) * Math.PI * 2, x = 256 + Math.cos(a) * 216, y = 256 + Math.sin(a) * 216;
      const k = i % 4;
      const glyph = ["M-7,-8 L-7,8 M-7,-3 L6,-8 M-7,3 L6,-2", "M-6,8 L-6,-8 L6,-2 L6,8", "M0,-9 L0,9 M-7,-7 L0,0 L7,-7", "M-7,-8 L7,8 M7,-8 L-7,8"][k];
      g += `<path d="${glyph}" transform="translate(${f(x)},${f(y)}) rotate(${f((a * 180) / Math.PI + 90)})" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    }
    for ( let i = 0; i < 6; i++ ) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      g += `<circle cx="${f(256 + Math.cos(a) * 196)}" cy="${f(256 + Math.sin(a) * 196)}" r="12" fill="#ffffff"/>`;
    }
    return svg(g);
  },
  /* glowing orb */
  orb: () => svg(`<circle cx="256" cy="256" r="150" fill="url(#ro)"/><circle cx="256" cy="256" r="70" fill="#ffffff"/><circle cx="226" cy="224" r="22" fill="#ffffff" opacity=".9"/>`, S, S,
    `<radialGradient id="ro" cx="50%" cy="50%" r="50%"><stop offset=".35" stop-color="#ffffff"/><stop offset=".6" stop-color="#ffffff" stop-opacity=".45"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>`),
  /* four-point sparkle */
  spark: () => svg(`<path d="${star(256, 256, 4, 240, 34, -Math.PI / 2)}" fill="#ffffff" filter="url(#g)" opacity=".8"/>`
    + `<path d="${star(256, 256, 4, 230, 26, -Math.PI / 2)}" fill="#ffffff"/>`
    + `<path d="${star(256, 256, 4, 120, 18, -Math.PI / 4)}" fill="#ffffff" opacity=".75"/>`
    + `<circle cx="256" cy="256" r="40" fill="#ffffff"/>`),
  /* ice shards cluster */
  shards: () => {
    let g = `<circle cx="256" cy="300" r="140" fill="#ffffff" filter="url(#g2)" opacity=".45"/>`;
    const spikes = [[-50, 200, 46], [-25, 260, 52], [0, 300, 58], [25, 250, 50], [55, 190, 42], [-75, 140, 34], [80, 150, 34]];
    for ( const [deg, L, w] of spikes ) {
      const a = ((deg - 90) * Math.PI) / 180, bx = 256, by = 400;
      const tx = bx + Math.cos(a) * L, ty = by + Math.sin(a) * L;
      const nx = -Math.sin(a) * w / 2, ny = Math.cos(a) * w / 2;
      g += `<path d="M${f(bx + nx)},${f(by + ny)} L${f(bx + Math.cos(a) * L * 0.8 + nx * 0.8)},${f(by + Math.sin(a) * L * 0.8 + ny * 0.8)} L${f(tx)},${f(ty)} L${f(bx + Math.cos(a) * L * 0.8 - nx * 0.8)},${f(by + Math.sin(a) * L * 0.8 - ny * 0.8)} L${f(bx - nx)},${f(by - ny)} Z" fill="#ffffff" fill-opacity=".85" stroke="#ffffff" stroke-width="3"/>`;
      g += `<path d="M${f(bx)},${f(by)} L${f(tx)},${f(ty)}" stroke="#d9e6ee" stroke-width="3" opacity=".9"/>`;
    }
    return svg(g);
  },
  /* flame burst */
  flame: () => {
    const tongue = (x, h, w, o) => `<path d="M${f(x - w)},420 Q${f(x - w * 1.1)},${f(420 - h * 0.5)} ${f(x - w * 0.2)},${f(420 - h * 0.75)} Q${f(x - w * 0.1)},${f(420 - h * 0.5)} ${f(x + w * 0.1)},${f(420 - h)} Q${f(x + w * 1.2)},${f(420 - h * 0.45)} ${f(x + w)},420 Z" fill="#ffffff" opacity="${o}"/>`;
    return svg(`<ellipse cx="256" cy="360" rx="190" ry="120" fill="#ffffff" filter="url(#g2)" opacity=".55"/>`
      + tongue(256, 360, 120, 0.95) + tongue(170, 250, 80, 0.85) + tongue(345, 270, 85, 0.85) + tongue(110, 160, 55, 0.7) + tongue(405, 170, 55, 0.7)
      + `<ellipse cx="256" cy="400" rx="150" ry="40" fill="#ffffff"/>`);
  },
  /* lightning bolt, horizontal, for stretchTo */
  bolt: () => {
    const r = rng(5);
    const W = 1024, H = 256;
    let pts = [[0, 128]];
    for ( let x = 60; x < W; x += 50 + r() * 40 ) pts.push([x, 128 + (r() - 0.5) * 120]);
    pts.push([W, 128]);
    const d = `M${pts.map(p => `${f(p[0])},${f(p[1])}`).join(" L")}`;
    let br = "";
    for ( let i = 2; i < pts.length - 2; i += 3 ) {
      const [x, y] = pts[i];
      br += `<path d="M${f(x)},${f(y)} L${f(x + 40 + r() * 40)},${f(y + (r() - 0.5) * 120)} L${f(x + 70 + r() * 40)},${f(y + (r() - 0.5) * 140)}" stroke="#ffffff" stroke-width="4" fill="none" opacity=".8"/>`;
    }
    return svg(`<path d="${d}" stroke="#ffffff" stroke-width="34" fill="none" filter="url(#g)" opacity=".75" stroke-linejoin="round"/>`
      + `<path d="${d}" stroke="#ffffff" stroke-width="12" fill="none" stroke-linejoin="round"/>` + br, W, H);
  },
  /* straight beam, horizontal, for stretchTo */
  beam: () => svg(`<rect x="0" y="88" width="1024" height="80" rx="40" fill="#ffffff" filter="url(#g)" opacity=".7"/>`
    + `<rect x="0" y="110" width="1024" height="36" rx="18" fill="#ffffff"/>`, 1024, 256),
  /* wind swirl */
  swirl: () => {
    let g = "";
    for ( let k = 0; k < 3; k++ ) {
      let d = "";
      const off = (k * 2 * Math.PI) / 3;
      for ( let i = 0; i <= 60; i++ ) {
        const t = i / 60, a = off + t * Math.PI * 3.2, rr = 30 + t * 200;
        d += `${i ? "L" : "M"}${f(256 + Math.cos(a) * rr)},${f(256 + Math.sin(a) * rr * 0.75)} `;
      }
      g += `<path d="${d}" stroke="#ffffff" stroke-width="22" fill="none" filter="url(#g)" opacity=".5" stroke-linecap="round"/><path d="${d}" stroke="#ffffff" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    }
    return svg(g);
  },
  /* rock fragments */
  rocks: () => {
    const r = rng(3);
    let g = `<ellipse cx="256" cy="380" rx="200" ry="60" fill="#ffffff" filter="url(#g2)" opacity=".35"/>`;
    for ( let i = 0; i < 9; i++ ) {
      const cx = 110 + r() * 290, cy = 180 + r() * 220, s = 26 + r() * 50;
      let d = "";
      for ( let k = 0; k < 6; k++ ) {
        const a = (k / 6) * Math.PI * 2 + r() * 0.4, rr = s * (0.7 + r() * 0.5);
        d += `${k ? "L" : "M"}${f(cx + Math.cos(a) * rr)},${f(cy + Math.sin(a) * rr)} `;
      }
      g += `<path d="${d}Z" fill="#e4e0da" stroke="#9a948c" stroke-width="4" stroke-linejoin="round"/><path d="M${f(cx - s * 0.4)},${f(cy - s * 0.2)} L${f(cx + s * 0.1)},${f(cy - s * 0.5)}" stroke="#ffffff" stroke-width="4" opacity=".8"/>`;
    }
    return svg(g);
  },
  /* light rays burst */
  rays: () => {
    let g = `<circle cx="256" cy="256" r="120" fill="#ffffff" filter="url(#g2)" opacity=".8"/>`;
    for ( let i = 0; i < 16; i++ ) {
      const a = (i / 16) * Math.PI * 2, w = i % 2 ? 0.06 : 0.1, L = i % 2 ? 190 : 250;
      g += `<path d="M256,256 L${f(256 + Math.cos(a - w) * L)},${f(256 + Math.sin(a - w) * L)} L${f(256 + Math.cos(a + w) * L)},${f(256 + Math.sin(a + w) * L)} Z" fill="url(#rr)"/>`;
    }
    return svg(g + `<circle cx="256" cy="256" r="60" fill="#ffffff"/>`, S, S,
      `<radialGradient id="rr" cx="256" cy="256" r="250" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>`);
  },
  /* dark vortex: light arms around a dark core */
  void: () => {
    let g = `<circle cx="256" cy="256" r="200" fill="#ffffff" filter="url(#g2)" opacity=".35"/>`;
    for ( let k = 0; k < 5; k++ ) {
      let d = "";
      const off = (k * 2 * Math.PI) / 5;
      for ( let i = 0; i <= 40; i++ ) {
        const t = i / 40, a = off + t * Math.PI * 1.6, rr = 220 - t * 160;
        d += `${i ? "L" : "M"}${f(256 + Math.cos(a) * rr)},${f(256 + Math.sin(a) * rr)} `;
      }
      g += `<path d="${d}" stroke="#ffffff" stroke-width="16" fill="none" stroke-linecap="round" opacity=".85"/>`;
    }
    return svg(g + `<circle cx="256" cy="256" r="74" fill="#000000" opacity=".85" filter="url(#g1)"/>`);
  },
  /* poison bubbles */
  bubbles: () => {
    const r = rng(9);
    let g = "";
    for ( let i = 0; i < 16; i++ ) {
      const cx = 100 + r() * 312, cy = 120 + r() * 300, rr = 14 + r() * 40;
      g += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rr)}" fill="#ffffff" fill-opacity=".25" stroke="#ffffff" stroke-width="5"/><circle cx="${f(cx - rr * 0.35)}" cy="${f(cy - rr * 0.35)}" r="${f(rr * 0.2)}" fill="#ffffff"/>`;
    }
    return svg(`<ellipse cx="256" cy="300" rx="190" ry="150" fill="#ffffff" filter="url(#g2)" opacity=".3"/>${g}`);
  },
  /* arrow pointing right (projectile; Sequencer rotates it towards the target) */
  arrow: () => svg(`<rect x="60" y="250" width="330" height="12" rx="6" fill="#8a5a2b"/>`
    + `<path d="M390,232 L460,256 L390,280 Z" fill="#d9dde3" stroke="#6b7078" stroke-width="3"/>`
    + `<path d="M60,256 L20,226 L90,226 L120,256 L90,286 L20,286 Z" fill="#f2f0ea" stroke="#9a948c" stroke-width="3"/>`
    + `<rect x="0" y="246" width="400" height="20" fill="#ffffff" filter="url(#g)" opacity=".25"/>`),
  /* healing: plus signs and sparkles rising */
  heal: () => {
    const r = rng(21);
    let g = `<ellipse cx="256" cy="330" rx="180" ry="140" fill="#ffffff" filter="url(#g2)" opacity=".35"/>`;
    for ( let i = 0; i < 9; i++ ) {
      const x = 100 + r() * 312, y = 90 + r() * 330, s = 16 + r() * 26;
      g += i % 3 === 0
        ? `<path d="${star(x, y, 4, s * 1.3, s * 0.25, -Math.PI / 2)}" fill="#ffffff"/>`
        : `<path d="M${f(x - s * 0.3)},${f(y - s)} H${f(x + s * 0.3)} V${f(y - s * 0.3)} H${f(x + s)} V${f(y + s * 0.3)} H${f(x + s * 0.3)} V${f(y + s)} H${f(x - s * 0.3)} V${f(y + s * 0.3)} H${f(x - s)} V${f(y - s * 0.3)} H${f(x - s * 0.3)} Z" fill="#ffffff" opacity=".95"/>`;
    }
    return svg(g);
  },
  /* guard shield */
  shield: () => svg(`<path d="M256,40 L440,110 V250 Q440,400 256,480 Q72,400 72,250 V110 Z" fill="#ffffff" fill-opacity=".12" stroke="#ffffff" stroke-width="30" filter="url(#g)" opacity=".7"/>`
    + `<path d="M256,40 L440,110 V250 Q440,400 256,480 Q72,400 72,250 V110 Z" fill="#ffffff" fill-opacity=".18" stroke="#ffffff" stroke-width="12"/>`
    + `<path d="M256,110 L380,155 V250 Q380,350 256,410 Q132,350 132,250 V155 Z" fill="none" stroke="#ffffff" stroke-width="5" opacity=".7"/>`),
  /* KO skull */
  skull: () => svg(`<path d="M256,70 C150,70 90,145 90,235 C90,300 125,335 160,355 V420 H352 V355 C387,335 422,300 422,235 C422,145 362,70 256,70 Z" fill="#f2efe8" stroke="#ffffff" stroke-width="10"/>`
    + `<ellipse cx="190" cy="250" rx="45" ry="52" fill="#1a1418"/><ellipse cx="322" cy="250" rx="45" ry="52" fill="#1a1418"/>`
    + `<path d="M256,300 L232,345 H280 Z" fill="#1a1418"/><path d="M200,420 V385 M235,420 V385 M277,420 V385 M312,420 V385" stroke="#1a1418" stroke-width="10"/>`),
  /* turn marker: ornate ring for the acting combatant */
  turn: () => {
    let g = `<ellipse cx="256" cy="256" rx="230" ry="230" fill="none" stroke="#ffffff" stroke-width="26" filter="url(#g)" opacity=".55"/>`
      + `<circle cx="256" cy="256" r="230" fill="none" stroke="#ffffff" stroke-width="8"/>`
      + `<circle cx="256" cy="256" r="206" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="18 12"/>`;
    for ( let i = 0; i < 4; i++ ) {
      const a = (i / 4) * Math.PI * 2;
      const x = 256 + Math.cos(a) * 230, y = 256 + Math.sin(a) * 230;
      g += `<path d="${star(x, y, 4, 34, 9, a)}" fill="#ffffff"/>`;
    }
    return svg(g);
  }
};

export const FX_NAMES = Object.keys(FX);
