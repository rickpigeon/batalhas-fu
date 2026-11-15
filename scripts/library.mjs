/**
 * Batalhas FU: the background library, a folder of extra images on the Foundry server
 * (setting "pastaFundos", default batalhas-fu-fundos). It is NOT shipped with the module: the GM copies
 * the folder into the Foundry Data folder. With an indice.json (made by the module's tools) the gallery
 * shows small thumbnails; without it, the images of the folder are listed through the file picker.
 *
 * Any image background (library or custom) is fitted to the 16:9 battle scene: scaled to cover, cropped
 * at the chosen height ("focus"), with the time-of-day tint, mana motes and a vignette on top, then
 * uploaded once to worlds/<world>/batalhas-fu/fundos.
 */
import { MODULE_ID, SCENE_H, SCENE_W, hash } from "./constants.mjs";
import { cachedBackground, rememberBackground, setting } from "./store.mjs";
import { canvasToBlob, filePickerClass, listFolder, loadImage, rootFolder, uploadBlob } from "./files.mjs";
import { overlaySVG } from "./backgrounds.mjs";

export function libraryFolder() {
  const v = String(setting("pastaFundos", "batalhas-fu-fundos") ?? "").trim().replace(/^\/+|\/+$/g, "");
  return v || "batalhas-fu-fundos";
}

let cache = null;

/** [{ n, src, thumb, name, w, h }] (cached per folder). */
export async function loadLibrary(force = false) {
  const folder = libraryFolder();
  if ( cache && cache.folder === folder && !force ) return cache.items;
  let items = [];
  try {
    const url = new URL(`${folder}/indice.json`, document.baseURI).href;
    const res = await fetch(url, { cache: "no-cache" });
    if ( res.ok ) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.items ?? [];
      items = list.map((x, i) => ({
        n: Number(x.n ?? i + 1),
        src: `${folder}/${x.file}`,
        thumb: x.thumb ? `${folder}/${x.thumb}` : `${folder}/${x.file}`,
        name: String(x.name ?? `Fundo ${x.n ?? i + 1}`),
        w: Number(x.w) || 0,
        h: Number(x.h) || 0
      }));
    }
  } catch ( err ) { /* no index: browse below */ }
  if ( !items.length ) {
    const FP = filePickerClass();
    for ( const dir of [folder, `${folder}/fundos`] ) {
      try {
        const res = await FP.browse("data", dir);
        for ( const f of res?.files ?? [] ) {
          if ( !/\.(jpe?g|png|webp|avif)$/i.test(f) ) continue;
          items.push({ n: items.length + 1, src: f, thumb: f, name: decodeURIComponent(String(f).split("/").pop()), w: 0, h: 0 });
        }
      } catch ( err ) { /* folder missing */ }
    }
  }
  cache = { folder, items };
  return items;
}

export function favorites() {
  const v = setting("favFundos", []);
  return new Set(Array.isArray(v) ? v : []);
}

export async function toggleFavorite(src) {
  const fav = favorites();
  if ( fav.has(src) ) fav.delete(src);
  else fav.add(src);
  await game.settings.set(MODULE_ID, "favFundos", [...fav]);
  return fav.has(src);
}

/**
 * The battle background made from an image: cover-fit into 2400 x 1350, cropped at `focus`
 * (0 = top/left, 1 = bottom/right), overlay on top. Returns the uploaded path (cached).
 */
export async function fittedBackground(src, focus = 0.6, setup = {}, onStatus = () => null) {
  const f = Math.max(0, Math.min(1, Number(focus) || 0));
  const key = hash({ src, f: Math.round(f * 100), time: setup.time, mana: setup.mana, seed: setup.seed, v: 1 });
  const dir = `${rootFolder()}/fundos`;
  const name = `img-${key}.webp`;
  const cached = cachedBackground(key);
  if ( cached && (await listFolder(dir)).has(name) ) return cached;
  onStatus("Ajustando a imagem de fundo…");
  const img = await loadImage(src);
  const c = document.createElement("canvas");
  c.width = SCENE_W;
  c.height = SCENE_H;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const k = Math.max(SCENE_W / img.naturalWidth, SCENE_H / img.naturalHeight);
  const w = img.naturalWidth * k, h = img.naturalHeight * k;
  ctx.drawImage(img, (SCENE_W - w) * (w > SCENE_W ? f : 0.5), (SCENE_H - h) * (h > SCENE_H ? f : 0.5), w, h);
  const over = await new Promise((resolve, reject) => {
    const o = new Image();
    o.onload = () => resolve(o);
    o.onerror = () => reject(new Error("camada de mana"));
    o.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(overlaySVG({ time: setup.time, mana: setup.mana, seed: setup.seed }))}`;
  }).catch(() => null);
  if ( over ) ctx.drawImage(over, 0, 0, SCENE_W, SCENE_H);
  const blob = await canvasToBlob(c, "image/webp", 0.88);
  onStatus("Enviando o fundo…");
  const path = await uploadBlob(blob, dir, name);
  await rememberBackground(key, path);
  return path;
}
