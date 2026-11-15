/**
 * Batalhas FU: constants and small helpers. Labels are Portuguese (no lang files).
 */
export const MODULE_ID = "batalhas-fu";
export const MODULE_TITLE = "Batalhas FU";
export const PATH = `modules/${MODULE_ID}`;
export const SOCKET = `module.${MODULE_ID}`;
export const SYSTEM_ID = "projectfu";

/** Battle scene size (pixels) and grid (one token square). */
export const SCENE_W = 2400;
export const SCENE_H = 1350;
export const GRID = 120;

/** Factions as the Fabula Ultima system names them (FUCombatant#faction). */
export const FRIENDLY = "friendly";
export const HOSTILE = "hostile";

/**
 * Damage types of the system (FU.damageTypes) with the module colours. Same palette as the Atlas de Cartas
 * and the Mapa-mundi-FU "mana latente", plus physical and untyped.
 */
export const ELEMENTS = {
  physical: { label: "Físico", color: "#f1ede4", glow: "#ffffff", icon: "fa-solid fa-hand-fist" },
  air: { label: "Ar", color: "#9be7c4", glow: "#d9fff0", icon: "fa-solid fa-wind" },
  bolt: { label: "Raio", color: "#ffe34d", glow: "#fff7c2", icon: "fa-solid fa-bolt" },
  dark: { label: "Trevas", color: "#a77bff", glow: "#5b2bbf", icon: "fa-solid fa-moon" },
  earth: { label: "Terra", color: "#d3a356", glow: "#f2d29b", icon: "fa-solid fa-mountain" },
  fire: { label: "Fogo", color: "#ff7a2f", glow: "#ffd08a", icon: "fa-solid fa-fire" },
  ice: { label: "Gelo", color: "#8fe3ff", glow: "#e6f9ff", icon: "fa-solid fa-snowflake" },
  light: { label: "Luz", color: "#fff1a8", glow: "#ffffff", icon: "fa-solid fa-sun" },
  poison: { label: "Veneno", color: "#d670a0", glow: "#f6b8d6", icon: "fa-solid fa-skull-crossbones" },
  untyped: { label: "Sem tipo", color: "#e8e8f0", glow: "#ffffff", icon: "fa-solid fa-star" }
};
export const MANA_ELEMENTS = ["air", "bolt", "dark", "earth", "fire", "ice", "light", "poison"];

export function elementOf(type) {
  return ELEMENTS[type] ? type : "physical";
}

export const BIOMES = {
  planicie: { label: "Planície", icon: "fa-solid fa-wheat-awn", ambient: "polen" },
  floresta: { label: "Floresta", icon: "fa-solid fa-tree", ambient: "folhas" },
  deserto: { label: "Deserto", icon: "fa-solid fa-sun-plant-wilt", ambient: "areia" },
  neve: { label: "Montanha nevada", icon: "fa-solid fa-snowflake", ambient: "neve" },
  vulcao: { label: "Vulcão", icon: "fa-solid fa-volcano", ambient: "brasas" },
  litoral: { label: "Litoral", icon: "fa-solid fa-water", ambient: "brisa" },
  caverna: { label: "Caverna", icon: "fa-solid fa-dungeon", ambient: "poeira" },
  pantano: { label: "Pântano", icon: "fa-solid fa-frog", ambient: "vagalumes" },
  ruinas: { label: "Ruínas", icon: "fa-solid fa-landmark", ambient: "poeira" }
};

export const LAYOUTS = {
  campo: { label: "Campo de batalha", hint: "Visão lateral: o grupo em fileira de um lado, os inimigos do outro." },
  mesa: { label: "Mesa de cartas", hint: "Vista de cima: o grupo em cartas embaixo, os inimigos em cima, numa mesa decorada." }
};

export const TIMES = {
  dia: "Dia",
  entardecer: "Entardecer",
  noite: "Noite"
};

export const TABLES = {
  escura: "Madeira escura",
  clara: "Madeira clara",
  pedra: "Mesa de pedra"
};

export const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export const num = (value, fallback, min = -Infinity, max = Infinity) => {
  const n = Number(value);
  return Number.isFinite(n) ? clamp(n, min, max) : fallback;
};

export const str = (value, fallback = "", max = 4000) => (typeof value === "string" ? value.slice(0, max) : fallback);

export const bool = (value, fallback = false) => (typeof value === "boolean" ? value : fallback);

export const pick = (value, table, fallback) => (Object.prototype.hasOwnProperty.call(table, value) ? value : fallback);

const HEX = /^#[0-9a-f]{6}$/i;
export const color = (value, fallback = null) => {
  if ( typeof value !== "string" ) return fallback;
  const v = value.trim();
  return HEX.test(v) ? v.toLowerCase() : fallback;
};

export function hexToRgb(hex) {
  const n = parseInt(color(hex, "#000000").slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r, g, b) {
  return `#${((1 << 24) | (clamp(Math.round(r), 0, 255) << 16) | (clamp(Math.round(g), 0, 255) << 8)
    | clamp(Math.round(b), 0, 255)).toString(16).slice(1)}`;
}

/** Mix a hex colour with black (t < 0) or white (t > 0). */
export function shade(hex, t) {
  const [r, g, b] = hexToRgb(hex);
  const target = t < 0 ? 0 : 255;
  const k = Math.abs(t);
  return rgbToHex(r + (target - r) * k, g + (target - g) * k, b + (target - b) * k);
}

export function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

export function hexToNumber(hex) {
  return parseInt(color(hex, "#ffffff").slice(1), 16);
}

/** Deterministic random numbers (mulberry32). */
export function rng(seed) {
  let a = (Number(seed) || 1) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(value) {
  const s = JSON.stringify(value);
  let h = 2166136261;
  for ( let i = 0; i < s.length; i++ ) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function uid(prefix = "b") {
  const r = globalThis.foundry?.utils?.randomID?.(10) ?? Math.random().toString(36).slice(2, 12);
  return `${prefix}${r}`;
}

export function slug(text, fallback = "x") {
  const s = String(text ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || fallback;
}

export const isGM = () => Boolean(globalThis.game?.user?.isGM);

/** True on exactly one client: the active GM (falls back to any GM). */
export function isActiveGM() {
  const u = globalThis.game?.user;
  if ( !u?.isGM ) return false;
  const active = game.users?.activeGM;
  return !active || active.id === u.id;
}

export const wait = ms => new Promise(r => setTimeout(r, ms));
