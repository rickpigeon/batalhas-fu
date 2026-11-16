/**
 * Batalhas FU: battle cards for the table layout. Each combatant's token becomes a card, generated once
 * and reused (file name = hash of what is on it). A token that already shows a card made by the
 * Cartas-editor module is used as it is.
 *
 *   style   colours and ornaments (classica, bioma, pergaminho, obsidiana, realeza, tecno, natureza, arcana)
 *   design  where things go: moldura (framed portrait + name plate), arte (full art + name ribbon),
 *           medalhao (round portrait), arco (arched window, like a tarot card)
 */
import { MODULE_ID, hash, shade, slug } from "./constants.mjs";
import { canvasToBlob, listFolder, loadImage, rootFolder, uploadBlob } from "./files.mjs";

const CW = 400, CH = 600;
const FONT = '"Modesto Condensed", "Signika", serif';

const BIOME_TONES = {
  planicie: ["#3f6b3a", "#c9a24a"], floresta: ["#24502f", "#b9a36a"], deserto: ["#9a5a2c", "#f0c070"],
  neve: ["#3f5f86", "#dfeaff"], vulcao: ["#5a1a14", "#ff8a3a"], litoral: ["#1f5f73", "#f2deaa"],
  caverna: ["#2e2d3a", "#9aa0c0"], pantano: ["#3c4426", "#b7b07a"], ruinas: ["#4a3f5c", "#d6c08a"]
};

/** Palette of a style for one side. */
function palette(style, side, biome) {
  const party = side === "party";
  const gem = (p, f) => (party ? p : f);
  switch ( style ) {
    case "bioma": {
      const [mat, edge] = BIOME_TONES[biome] ?? BIOME_TONES.planicie;
      return { a: shade(mat, 0.08), b: shade(mat, -0.55), edge, gem: gem("#5fb8ff", "#ff4a5a"), text: "#fff6dc", plate: "rgba(0,0,0,.38)", window: ["#4a4458", "#16131c"], orn: "diamond" };
    }
    case "pergaminho":
      return { a: "#efe0bb", b: "#c7a971", edge: "#6b4a24", gem: gem("#3a6ea8", "#a83a3a"), text: "#3a2410", stroke: "rgba(255,240,210,.7)", plate: "rgba(255,248,230,.45)", window: ["#d9c49a", "#8a6a3e"], orn: "scroll", grain: "#8a6a3e" };
    case "obsidiana":
      return { a: "#24202c", b: "#050407", edge: "#c9c2d9", gem: gem("#8fd0ff", "#c66bff"), text: "#f1ecff", plate: "rgba(255,255,255,.06)", window: ["#3a3446", "#0c0a10"], orn: "rivet", glow: gem("#6fb6ff", "#b25cff") };
    case "realeza":
      return { a: "#f6f1e4", b: "#d8ccb0", edge: "#c39a3c", gem: gem("#2f5fb0", "#9a1f2f"), text: "#3a2a10", stroke: "rgba(255,255,255,.75)", plate: "rgba(195,154,60,.18)", window: ["#efe6d0", "#9c8a66"], orn: "fleur" };
    case "tecno":
      return { a: "#1f2d36", b: "#0a1014", edge: "#4fe0ff", gem: gem("#4fe0ff", "#ff5a7a"), text: "#dff8ff", plate: "rgba(79,224,255,.1)", window: ["#2a3c48", "#081014"], orn: "circuit", glow: gem("#4fe0ff", "#ff5a7a") };
    case "natureza":
      return { a: "#35552a", b: "#122010", edge: "#d2bd6e", gem: gem("#7fd06a", "#e0843a"), text: "#fbf3d0", plate: "rgba(0,0,0,.32)", window: ["#4a5a3a", "#14200f"], orn: "leaf" };
    case "arcana":
      return { a: "#252764", b: "#0a0a22", edge: "#b4bcff", gem: gem("#8fe3ff", "#ff7ad9"), text: "#eef0ff", plate: "rgba(180,188,255,.1)", window: ["#34356e", "#0c0c26"], orn: "rune", glow: gem("#7f9cff", "#ff6ad0") };
    case "classica":
    default:
      return party
        ? { a: "#1d2f5c", b: "#0b1430", edge: "#f2c45a", gem: "#5fb8ff", text: "#fff6dc", plate: "rgba(0,0,0,.35)", window: ["#4a4458", "#16131c"], orn: "diamond" }
        : { a: "#5a1420", b: "#1a0508", edge: "#d9a050", gem: "#ff4a5a", text: "#fff6dc", plate: "rgba(0,0,0,.35)", window: ["#4a4458", "#16131c"], orn: "diamond" };
  }
}

export const isCardImage = src => /\/cartas-editor\//.test(String(src ?? ""));

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Arched window: a rectangle with a half circle on top. */
function arch(ctx, x, y, w, h) {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, 0);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

/** Draw the portrait covering the current clip path's box (x, y, w, h). */
async function portrait(ctx, src, x, y, w, h, P, focusY = 0.3) {
  const bg = ctx.createRadialGradient(x + w / 2, y + h * 0.45, 10, x + w / 2, y + h * 0.45, Math.max(w, h) * 0.75);
  bg.addColorStop(0, P.window[0]);
  bg.addColorStop(1, P.window[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  try {
    const img = await loadImage(src);
    const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const iw = img.naturalWidth * k, ih = img.naturalHeight * k;
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) * focusY, iw, ih);
  } catch ( err ) {
    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.4, Math.min(w, h) * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w * 0.15, y + h);
    ctx.bezierCurveTo(x + w * 0.2, y + h * 0.62, x + w * 0.8, y + h * 0.62, x + w * 0.85, y + h);
    ctx.fill();
  }
}

function body(ctx, P) {
  const g = ctx.createLinearGradient(0, 0, 0, CH);
  g.addColorStop(0, P.a);
  g.addColorStop(1, P.b);
  roundRect(ctx, 4, 4, CW - 8, CH - 8, 28);
  ctx.fillStyle = g;
  ctx.fill();
  if ( P.grain ) {
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = P.grain;
    for ( let i = 0; i < 420; i++ ) ctx.fillRect((i * 97.13) % CW, (i * 53.71) % CH, 2 + (i % 3), 1 + (i % 2));
    ctx.restore();
  }
  if ( P.glow ) {
    ctx.save();
    ctx.clip();
    const r = ctx.createRadialGradient(CW / 2, CH * 0.42, 20, CW / 2, CH * 0.42, CH * 0.6);
    r.addColorStop(0, `${P.glow}55`);
    r.addColorStop(1, `${P.glow}00`);
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, CW, CH);
    ctx.restore();
  }
  roundRect(ctx, 4, 4, CW - 8, CH - 8, 28);
  ctx.lineWidth = 8;
  ctx.strokeStyle = P.edge;
  ctx.stroke();
  roundRect(ctx, 16, 16, CW - 32, CH - 32, 20);
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function gem(ctx, P, x, y, s = 14) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = P.gem;
  ctx.strokeStyle = P.edge;
  ctx.lineWidth = 4;
  ctx.fillRect(-s, -s, s * 2, s * 2);
  ctx.strokeRect(-s, -s, s * 2, s * 2);
  ctx.fillStyle = "rgba(255,255,255,.45)";
  ctx.fillRect(-s + 4, -s + 4, s * 0.7, s * 0.7);
  ctx.restore();
}

/** The name, shrunk until it fits `maxW`. */
function nameText(ctx, P, name, cx, cy, maxW, size = 40) {
  ctx.font = `700 ${size}px ${FONT}`;
  while ( ctx.measureText(name).width > maxW && size > 16 ) {
    size -= 2;
    ctx.font = `700 ${size}px ${FONT}`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 5;
  ctx.strokeStyle = P.stroke ?? "rgba(0,0,0,.7)";
  ctx.strokeText(name, cx, cy + 2);
  ctx.fillStyle = P.text;
  ctx.fillText(name, cx, cy + 2);
}

function plate(ctx, P, x, y, w, h) {
  roundRect(ctx, x, y, w, h, 14);
  ctx.fillStyle = P.plate;
  ctx.fill();
  ctx.strokeStyle = P.edge;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** A ribbon (banner with notched ends) across the card. */
function ribbon(ctx, P, cx, cy, w, h) {
  const x0 = cx - w / 2, x1 = cx + w / 2, n = h * 0.45;
  ctx.beginPath();
  ctx.moveTo(x0 - n, cy - h / 2 + 6);
  ctx.lineTo(x0 + 10, cy - h / 2 + 6);
  ctx.lineTo(x0 + 10, cy + h / 2 + 6);
  ctx.lineTo(x0 - n, cy + h / 2 + 6);
  ctx.lineTo(x0 - n * 0.4, cy + 6);
  ctx.closePath();
  ctx.moveTo(x1 + n, cy - h / 2 + 6);
  ctx.lineTo(x1 - 10, cy - h / 2 + 6);
  ctx.lineTo(x1 - 10, cy + h / 2 + 6);
  ctx.lineTo(x1 + n, cy + h / 2 + 6);
  ctx.lineTo(x1 + n * 0.4, cy + 6);
  ctx.closePath();
  ctx.fillStyle = shade(P.edge, -0.45);
  ctx.fill();
  roundRect(ctx, x0, cy - h / 2, w, h, 8);
  const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
  g.addColorStop(0, shade(P.edge, -0.05));
  g.addColorStop(1, shade(P.edge, -0.35));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = shade(P.edge, -0.55);
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** Corner ornaments of each style. */
function corners(ctx, P) {
  const c = P.edge;
  const spots = [[26, 26, 1, 1], [CW - 26, 26, -1, 1], [26, CH - 26, 1, -1], [CW - 26, CH - 26, -1, -1]];
  ctx.save();
  ctx.fillStyle = c;
  ctx.strokeStyle = c;
  for ( const [x, y, sx, sy] of spots ) {
    ctx.beginPath();
    switch ( P.orn ) {
      case "leaf":
        ctx.ellipse(x + sx * 8, y + sy * 8, 15, 6, (sx * sy > 0 ? 1 : -1) * Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = shade(c, -0.5);
        ctx.moveTo(x - sx * 2, y - sy * 2);
        ctx.lineTo(x + sx * 18, y + sy * 18);
        ctx.stroke();
        ctx.strokeStyle = c;
        break;
      case "circuit":
        ctx.lineWidth = 3;
        ctx.moveTo(x - sx * 6, y + sy * 30);
        ctx.lineTo(x - sx * 6, y - sy * 6);
        ctx.lineTo(x + sx * 30, y - sy * 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + sx * 30, y - sy * 6, 4, 0, Math.PI * 2);
        ctx.arc(x - sx * 6, y + sy * 30, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "rune":
        ctx.lineWidth = 2;
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - 6, y);
        ctx.lineTo(x + 6, y);
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x, y + 6);
        ctx.stroke();
        break;
      case "rivet":
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = "rgba(255,255,255,.5)";
        ctx.arc(x - 2, y - 2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c;
        break;
      case "scroll":
        ctx.lineWidth = 2.5;
        ctx.arc(x + sx * 4, y + sy * 4, 9, 0, Math.PI * 1.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + sx * 4, y + sy * 4, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "fleur":
        ctx.moveTo(x, y - 12);
        ctx.quadraticCurveTo(x + 7, y - 2, x, y + 4);
        ctx.quadraticCurveTo(x - 7, y - 2, x, y - 12);
        ctx.moveTo(x - 12, y + 2);
        ctx.quadraticCurveTo(x - 4, y - 2, x, y + 6);
        ctx.quadraticCurveTo(x - 6, y + 8, x - 12, y + 2);
        ctx.moveTo(x + 12, y + 2);
        ctx.quadraticCurveTo(x + 4, y - 2, x, y + 6);
        ctx.quadraticCurveTo(x + 6, y + 8, x + 12, y + 2);
        ctx.fill();
        break;
      case "diamond":
      default:
        ctx.moveTo(x, y - 9);
        ctx.lineTo(x + 9, y);
        ctx.lineTo(x, y + 9);
        ctx.lineTo(x - 9, y);
        ctx.closePath();
        ctx.fill();
    }
  }
  ctx.restore();
}

function shadeBottom(ctx, x, y, w, h, k = 0.45, from = 90) {
  const s = ctx.createLinearGradient(0, y + h - from, 0, y + h);
  s.addColorStop(0, "rgba(0,0,0,0)");
  s.addColorStop(1, `rgba(0,0,0,${k})`);
  ctx.fillStyle = s;
  ctx.fillRect(x, y, w, h);
}

const DESIGNS = {
  /* framed portrait, name plate below (v1 look) */
  async moldura(ctx, P, name, src) {
    body(ctx, P);
    const wx = 34, wy = 34, ww = CW - 68, wh = 400;
    ctx.save();
    roundRect(ctx, wx, wy, ww, wh, 16);
    ctx.clip();
    await portrait(ctx, src, wx, wy, ww, wh, P);
    shadeBottom(ctx, wx, wy, ww, wh);
    ctx.restore();
    roundRect(ctx, wx, wy, ww, wh, 16);
    ctx.lineWidth = 5;
    ctx.strokeStyle = P.edge;
    ctx.stroke();
    gem(ctx, P, CW / 2, wy);
    const ny = wy + wh + 20, nh = CH - ny - 34;
    plate(ctx, P, 30, ny, CW - 60, nh);
    nameText(ctx, P, name, CW / 2, ny + nh / 2, CW - 90);
    corners(ctx, P);
  },
  /* the art fills the card, the name on a ribbon at the bottom */
  async arte(ctx, P, name, src) {
    roundRect(ctx, 4, 4, CW - 8, CH - 8, 28);
    ctx.save();
    ctx.clip();
    await portrait(ctx, src, 4, 4, CW - 8, CH - 8, P, 0.25);
    shadeBottom(ctx, 4, 4, CW - 8, CH - 8, 0.7, 220);
    ctx.restore();
    roundRect(ctx, 4, 4, CW - 8, CH - 8, 28);
    ctx.lineWidth = 9;
    ctx.strokeStyle = P.edge;
    ctx.stroke();
    roundRect(ctx, 16, 16, CW - 32, CH - 32, 20);
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.55;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ribbon(ctx, P, CW / 2, CH - 82, CW - 96, 70);
    nameText(ctx, { ...P, text: "#fffaf0", stroke: "rgba(0,0,0,.75)" }, name, CW / 2, CH - 82, CW - 124, 46);
    gem(ctx, P, CW / 2, 18, 12);
    corners(ctx, P);
  },
  /* a round portrait (medallion) and a big name plate */
  async medalhao(ctx, P, name, src) {
    body(ctx, P);
    const cx = CW / 2, cy = 236, r = 150;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    await portrait(ctx, src, cx - r, cy - r, r * 2, r * 2, P, 0.3);
    ctx.restore();
    for ( const [rr, lw, a] of [[r + 2, 8, 1], [r + 14, 2, 0.6]] ) {
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.lineWidth = lw;
      ctx.strokeStyle = P.edge;
      ctx.globalAlpha = a;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for ( let i = 0; i < 8; i++ ) {
      const a = (i / 8) * Math.PI * 2;
      gem(ctx, P, cx + Math.cos(a) * (r + 14), cy + Math.sin(a) * (r + 14), 5);
    }
    const ny = 420, nh = 110;
    plate(ctx, P, 34, ny, CW - 68, nh);
    ctx.beginPath();
    ctx.moveTo(70, ny + nh - 22);
    ctx.lineTo(CW - 70, ny + nh - 22);
    ctx.strokeStyle = P.edge;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    nameText(ctx, P, name, CW / 2, ny + nh / 2 - 8, CW - 100, 42);
    corners(ctx, P);
  },
  /* an arched window, like a tarot card */
  async arco(ctx, P, name, src) {
    body(ctx, P);
    const wx = 46, wy = 70, ww = CW - 92, wh = 400;
    ctx.save();
    arch(ctx, wx, wy, ww, wh);
    ctx.clip();
    await portrait(ctx, src, wx, wy, ww, wh, P, 0.35);
    shadeBottom(ctx, wx, wy, ww, wh, 0.35, 70);
    ctx.restore();
    arch(ctx, wx, wy, ww, wh);
    ctx.lineWidth = 6;
    ctx.strokeStyle = P.edge;
    ctx.stroke();
    arch(ctx, wx - 12, wy - 12, ww + 24, wh + 18);
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    /* little stars over the arch */
    ctx.fillStyle = P.edge;
    for ( const [x, y, s] of [[CW / 2, 40, 9], [CW / 2 - 60, 50, 5], [CW / 2 + 60, 50, 5]] ) {
      ctx.beginPath();
      for ( let i = 0; i < 8; i++ ) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? s * 0.4 : s;
        ctx[i ? "lineTo" : "moveTo"](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    }
    const ny = wy + wh + 18, nh = CH - ny - 32;
    plate(ctx, P, 40, ny, CW - 80, nh);
    nameText(ctx, P, name, CW / 2, ny + nh / 2, CW - 110, 38);
    corners(ctx, P);
  }
};

async function drawCard(name, src, side, { style = "classica", design = "moldura", biome = "planicie" } = {}) {
  const P = palette(style, side, biome);
  const c = document.createElement("canvas");
  c.width = CW;
  c.height = CH;
  const ctx = c.getContext("2d");
  await (DESIGNS[design] ?? DESIGNS.moldura)(ctx, P, name, src);
  return c;
}

let listing = null;

/**
 * Card image for a combatant (path), or the token's own image when it is already a card.
 * @param {string} name
 * @param {string} src portrait
 * @param {"party"|"foes"} side
 * @param {{style?:string, design?:string, biome?:string}} [look]
 */
export async function battleCard(name, src, side, look = {}) {
  if ( isCardImage(src) ) return src;
  const style = look.style ?? "classica", design = look.design ?? "moldura";
  const dir = `${rootFolder()}/cartas`;
  const parts = [src, name, side, style, design, style === "bioma" ? look.biome ?? "" : "", "v2"];
  /* v1 cards (classic look) keep their file names, so they are reused */
  const file = style === "classica" && design === "moldura" ? `${slug(name, "carta")}-${hash([src, name, side, "v1"])}.webp` : `${slug(name, "carta")}-${hash(parts)}.webp`;
  listing ??= await listFolder(dir);
  if ( listing.has(file) ) return `${dir}/${file}`;
  if ( document.fonts?.load ) await document.fonts.load(`700 40px "Modesto Condensed"`).catch(() => null);
  const canvas = await drawCard(name, src, side, { style, design, biome: look.biome });
  const blob = await canvasToBlob(canvas, "image/webp", 0.9);
  const path = await uploadBlob(blob, dir, file);
  listing.add(file);
  return path;
}

/** A small preview of a card look (data URL), for the panel. */
export async function cardPreview(look, side = "party", src = "icons/svg/mystery-man.svg", name = "Exemplo") {
  const canvas = await drawCard(name, src, side, look);
  const small = document.createElement("canvas");
  small.width = 120;
  small.height = 180;
  small.getContext("2d").drawImage(canvas, 0, 0, 120, 180);
  return small.toDataURL("image/webp", 0.85);
}

export function forgetCardListing() {
  listing = null;
}

export const CARD_RATIO = CH / CW;
export { MODULE_ID };
