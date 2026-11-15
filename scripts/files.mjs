/**
 * Batalhas FU: files. Generated backgrounds and battle cards go to worlds/<world>/batalhas-fu
 * through FilePicker.upload ("data" source).
 */
import { MODULE_ID, MODULE_TITLE } from "./constants.mjs";

const SOURCE = "data";

export function filePickerClass() {
  return foundry.applications?.apps?.FilePicker?.implementation
    ?? foundry.applications?.apps?.FilePicker
    ?? globalThis.FilePicker
    ?? null;
}

/** worlds/<world>/batalhas-fu */
export function rootFolder() {
  return `worlds/${game.world?.id ?? "mundo"}/${MODULE_ID}`;
}

const ready = new Set();

/** Make sure every level of `dir` exists (browse first, create when missing). */
export async function ensureDir(dir) {
  const FP = filePickerClass();
  if ( !FP ) throw new Error("o seletor de arquivos do Foundry não está disponível");
  let path = "";
  for ( const part of dir.split("/").filter(Boolean) ) {
    path = path ? `${path}/${part}` : part;
    if ( ready.has(path) ) continue;
    let exists = false;
    try {
      await FP.browse(SOURCE, path);
      exists = true;
    } catch ( err ) {
      exists = false;
    }
    if ( !exists ) {
      try {
        await FP.createDirectory(SOURCE, path, {});
      } catch ( err ) {
        console.warn(`${MODULE_TITLE} | createDirectory ${path}`, err);
      }
    }
    ready.add(path);
  }
}

/** Names of the files already in a folder (empty set when it does not exist). */
export async function listFolder(dir) {
  const FP = filePickerClass();
  try {
    const res = await FP.browse(SOURCE, dir);
    return new Set((res?.files ?? []).map(p => decodeURIComponent(String(p).split("/").pop())));
  } catch ( err ) {
    return new Set();
  }
}

/** Upload a Blob as `name` into `dir`; returns the stored path. */
export async function uploadBlob(blob, dir, name) {
  const FP = filePickerClass();
  if ( !FP?.upload ) throw new Error("o envio de arquivos do Foundry não está disponível");
  await ensureDir(dir);
  const file = new File([blob], name, { type: blob.type || "application/octet-stream" });
  const result = await FP.upload(SOURCE, dir, file, {}, { notify: false });
  if ( result === false || result?.status === "error" ) throw new Error(result?.message ?? "o servidor recusou o arquivo");
  return result?.path ?? `${dir}/${name}`;
}

/** Open Foundry's file picker (type "image" or "folder"). */
export function browse({ type = "image", current = "", callback }) {
  const FP = filePickerClass();
  if ( !FP ) {
    ui.notifications.warn(`${MODULE_TITLE}: o seletor de arquivos não está disponível.`);
    return null;
  }
  const picker = new FP({ type, current, callback });
  if ( typeof picker.browse === "function" ) {
    Promise.resolve(picker.browse()).catch(err => {
      console.warn(`${MODULE_TITLE} | FilePicker.browse`, err);
      picker.render({ force: true });
    });
  }
  else picker.render({ force: true });
  return picker;
}

/** Rasterise an SVG string into a canvas (w x h). */
export async function svgToCanvas(svg, w, h) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("o navegador não desenhou o fundo (SVG)"));
    i.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d").drawImage(img, 0, 0, w, h);
  return c;
}

export function canvasToBlob(canvas, type = "image/webp", quality = 0.9) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error("o navegador não gerou a imagem"))), type, quality);
    } catch ( err ) {
      reject(err);
    }
  });
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if ( /^https?:\/\//i.test(src) && !src.startsWith(window.location.origin) ) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`não consegui abrir a imagem "${src}"`));
    img.src = src;
  });
}
