/**
 * Batalhas FU: battle cards for the table layout. Each combatant's token becomes a card (frame + portrait
 * + name), generated once and reused (file name = hash of what is on it). A token that already shows a
 * card made by the Cartas-editor module is used as it is.
 */
import { MODULE_ID, hash, slug } from "./constants.mjs";
import { canvasToBlob, listFolder, loadImage, rootFolder, uploadBlob } from "./files.mjs";

const CW = 400, CH = 600;
const STYLE = {
  party: { a: "#1d2f5c", b: "#0b1430", edge: "#f2c45a", glow: "#7fd8ff", gem: "#5fb8ff" },
  foes: { a: "#5a1420", b: "#1a0508", edge: "#d9a050", glow: "#ff6b6b", gem: "#ff4a5a" }
};

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

async function drawCard(name, src, side) {
  const S = STYLE[side] ?? STYLE.foes;
  const c = document.createElement("canvas");
  c.width = CW;
  c.height = CH;
  const ctx = c.getContext("2d");
  /* body */
  const g = ctx.createLinearGradient(0, 0, 0, CH);
  g.addColorStop(0, S.a);
  g.addColorStop(1, S.b);
  roundRect(ctx, 4, 4, CW - 8, CH - 8, 28);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = S.edge;
  ctx.stroke();
  roundRect(ctx, 16, 16, CW - 32, CH - 32, 20);
  ctx.lineWidth = 2;
  ctx.strokeStyle = S.edge;
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.globalAlpha = 1;
  /* portrait window */
  const wx = 34, wy = 34, ww = CW - 68, wh = 400;
  ctx.save();
  roundRect(ctx, wx, wy, ww, wh, 16);
  ctx.clip();
  const bg = ctx.createRadialGradient(CW / 2, wy + wh * 0.45, 10, CW / 2, wy + wh * 0.45, wh * 0.75);
  bg.addColorStop(0, "#4a4458");
  bg.addColorStop(1, "#16131c");
  ctx.fillStyle = bg;
  ctx.fillRect(wx, wy, ww, wh);
  try {
    const img = await loadImage(src);
    const k = Math.max(ww / img.naturalWidth, wh / img.naturalHeight);
    const iw = img.naturalWidth * k, ih = img.naturalHeight * k;
    ctx.drawImage(img, wx + (ww - iw) / 2, wy + (wh - ih) * 0.3, iw, ih);
  } catch ( err ) {
    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.beginPath();
    ctx.arc(CW / 2, wy + 160, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(wx + 40, wy + wh);
    ctx.bezierCurveTo(wx + 50, wy + 260, CW - wx - 50, wy + 260, CW - wx - 40, wy + wh);
    ctx.fill();
  }
  const shade = ctx.createLinearGradient(0, wy + wh - 90, 0, wy + wh);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,.45)");
  ctx.fillStyle = shade;
  ctx.fillRect(wx, wy, ww, wh);
  ctx.restore();
  roundRect(ctx, wx, wy, ww, wh, 16);
  ctx.lineWidth = 5;
  ctx.strokeStyle = S.edge;
  ctx.stroke();
  /* top gem */
  ctx.save();
  ctx.translate(CW / 2, wy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = S.gem;
  ctx.strokeStyle = S.edge;
  ctx.lineWidth = 4;
  ctx.fillRect(-14, -14, 28, 28);
  ctx.strokeRect(-14, -14, 28, 28);
  ctx.restore();
  /* name */
  const ny = wy + wh + 20, nh = CH - ny - 34;
  roundRect(ctx, 30, ny, CW - 60, nh, 14);
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.fill();
  ctx.strokeStyle = S.edge;
  ctx.lineWidth = 2;
  ctx.stroke();
  let size = 40;
  ctx.font = `700 ${size}px "Modesto Condensed", "Signika", serif`;
  while ( ctx.measureText(name).width > CW - 90 && size > 18 ) {
    size -= 2;
    ctx.font = `700 ${size}px "Modesto Condensed", "Signika", serif`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(0,0,0,.7)";
  ctx.strokeText(name, CW / 2, ny + nh / 2 + 2);
  ctx.fillStyle = "#fff6dc";
  ctx.fillText(name, CW / 2, ny + nh / 2 + 2);
  /* corner diamonds */
  ctx.fillStyle = S.edge;
  for ( const [x, y] of [[26, 26], [CW - 26, 26], [26, CH - 26], [CW - 26, CH - 26]] ) {
    ctx.beginPath();
    ctx.moveTo(x, y - 9);
    ctx.lineTo(x + 9, y);
    ctx.lineTo(x, y + 9);
    ctx.lineTo(x - 9, y);
    ctx.closePath();
    ctx.fill();
  }
  return c;
}

let listing = null;

/**
 * Card image for a combatant (path), or the token's own image when it is already a card.
 * @param {string} name
 * @param {string} src portrait
 * @param {"party"|"foes"} side
 */
export async function battleCard(name, src, side) {
  if ( isCardImage(src) ) return src;
  const dir = `${rootFolder()}/cartas`;
  const file = `${slug(name, "carta")}-${hash([src, name, side, "v1"])}.webp`;
  listing ??= await listFolder(dir);
  if ( listing.has(file) ) return `${dir}/${file}`;
  if ( document.fonts?.load ) await document.fonts.load('700 40px "Modesto Condensed"').catch(() => null);
  const canvas = await drawCard(name, src, side);
  const blob = await canvasToBlob(canvas, "image/webp", 0.9);
  const path = await uploadBlob(blob, dir, file);
  listing.add(file);
  return path;
}

export function forgetCardListing() {
  listing = null;
}

export const CARD_RATIO = CH / CW;
export { MODULE_ID };
