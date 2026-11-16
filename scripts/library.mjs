/**
 * Batalhas FU: the background library, a folder of extra images on the Foundry server
 * (setting "pastaFundos", default batalhas-fu-fundos). It is NOT shipped with the module: the GM copies
 * the folder into the Foundry Data folder. With an indice.json (made by the module's tools) the gallery
 * shows small thumbnails; without it, the images of the folder are listed through the file picker.
 *
 * Images copied later into <folder>/fundos (or <folder>/novos) show up too, marked as new.
 * Tags: the GM tags images for the quick search. They are kept in the world (setting tagsFundos) and in
 * <folder>/tags.json, so every world of this Foundry sees them; the newer of the two wins.
 *
 * Any image background (library or custom) is fitted to the 16:9 battle scene: scaled to cover, cropped
 * at the chosen height ("focus"), with the time-of-day tint, mana motes and a vignette on top, then
 * uploaded once to worlds/<world>/batalhas-fu/fundos.
 */
import { MODULE_ID, SCENE_H, SCENE_W, hash, isGM } from "./constants.mjs";
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
  const FP = filePickerClass();
  if ( items.length ) {
    /* images copied into the folder after the index was made */
    const known = new Set(items.map(x => x.src));
    let n = Math.max(0, ...items.map(x => x.n));
    for ( const dir of [`${folder}/fundos`, `${folder}/novos`] ) {
      try {
        const res = await FP.browse("data", dir);
        for ( const f of res?.files ?? [] ) {
          if ( !/\.(jpe?g|png|webp|avif)$/i.test(f) || known.has(f) || known.has(safeDecode(f)) ) continue;
          items.push({ n: ++n, src: f, thumb: f, name: safeDecode(String(f).split("/").pop()), w: 0, h: 0, novo: true });
          known.add(f);
        }
      } catch ( err ) { /* folder missing */ }
    }
  }
  if ( !items.length ) {
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
  if ( isGM() ) await importTagFile(folder);
  return items;
}

function safeDecode(v) {
  try {
    return decodeURIComponent(v);
  } catch ( err ) {
    return v;
  }
}

/* ---------------------------------------------------------------------------------------------- */
/* Tags                                                                                             */
/* ---------------------------------------------------------------------------------------------- */

const MAX_TAGS = 20;
/** A tag as stored: lower case, single spaces, at most 30 characters. */
export const normTag = t => String(t ?? "").trim().toLowerCase().replace(/[\s,;]+/g, " ").slice(0, 30).trim();
/** For searching: no accents. */
export const foldText = t => String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Key of an image in the tag map: its path inside the library folder. */
function keyOf(src) {
  const folder = libraryFolder();
  const s = safeDecode(String(src ?? ""));
  return s.startsWith(`${folder}/`) ? s.slice(folder.length + 1) : s;
}

export function tagState() {
  const v = setting("tagsFundos", { at: 0, map: {} }) ?? {};
  return { at: Number(v.at) || 0, map: v.map && typeof v.map === "object" ? v.map : {} };
}

export function tagsOf(src) {
  const list = tagState().map[keyOf(src)];
  return Array.isArray(list) ? list : [];
}

/** Every tag in use with how many images have it, most used first. */
export function allTags() {
  const count = new Map();
  for ( const list of Object.values(tagState().map) ) for ( const t of Array.isArray(list) ? list : [] ) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Change the tags of some images: fn(current tags) -> new tags. */
export async function editTags(srcs, fn) {
  const st = tagState();
  const map = { ...st.map };
  for ( const src of srcs ) {
    const k = keyOf(src);
    const next = [...new Set(fn(Array.isArray(map[k]) ? map[k] : []).map(normTag).filter(Boolean))].slice(0, MAX_TAGS);
    if ( next.length ) map[k] = next;
    else delete map[k];
  }
  const value = { at: Date.now(), map };
  await game.settings.set(MODULE_ID, "tagsFundos", value);
  scheduleExport(value);
  return value;
}

/** "floresta, noite chuvosa" -> ["floresta", "noite chuvosa"] */
export const splitTags = text => String(text ?? "").split(/[,;]+/).map(normTag).filter(Boolean);
export const addTags = (srcs, tags) => editTags(srcs, cur => [...cur, ...tags]);
export const removeTag = (srcs, tag) => editTags(srcs, cur => cur.filter(t => t !== normTag(tag)));

let exportTimer = null;
function scheduleExport(value) {
  clearTimeout(exportTimer);
  exportTimer = setTimeout(() => exportTags(value).catch(err => console.warn(`${MODULE_ID} | tags.json`, err)), 1500);
}

/** Write <folder>/tags.json (shared by every world). */
export async function exportTags(value = tagState()) {
  const blob = new Blob([JSON.stringify({ version: 1, at: value.at, map: value.map })], { type: "application/json" });
  await uploadBlob(blob, libraryFolder(), "tags.json");
}

/** Take the tags of <folder>/tags.json when they are newer than this world's. */
async function importTagFile(folder) {
  try {
    const res = await fetch(new URL(`${folder}/tags.json`, document.baseURI).href, { cache: "no-cache" });
    if ( !res.ok ) return;
    const data = await res.json();
    const at = Number(data?.at) || 0;
    if ( at > tagState().at && data.map && typeof data.map === "object" ) await game.settings.set(MODULE_ID, "tagsFundos", { at, map: data.map });
  } catch ( err ) { /* no file yet */ }
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

/** Draw an image covering w x h, cropped at `focus` (0 = top/left, 1 = bottom/right). */
export function drawCover(ctx, img, focus, w, h) {
  const f = Math.max(0, Math.min(1, Number(focus) || 0));
  const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const iw = img.naturalWidth * k, ih = img.naturalHeight * k;
  ctx.drawImage(img, (w - iw) * (iw > w ? f : 0.5), (h - ih) * (ih > h ? f : 0.5), iw, ih);
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
