/**
 * Batalhas FU: the weather and mana of a battle scene (data only; the drawing is in weather.mjs).
 *
 * Stored in the scene flag `clima` and shown on every client:
 *   { mana: ["fire", ...], layers: ["chuva", ...], tint: "noite", intensity: 1, wind: 0 }
 * A battle without the flag (made by v1.1 or older) uses its biome's particles and its setup mana.
 */
import { BIOMES, MANA_ELEMENTS, num } from "./constants.mjs";

export const MAX_LAYERS = 6;
export const MAX_MANA = 4;

/** Weather layers, grouped for the GM window. */
export const WEATHER = {
  chuva: { label: "Chuva", icon: "fa-solid fa-cloud-rain", group: "agua" },
  garoa: { label: "Garoa", icon: "fa-solid fa-umbrella", group: "agua" },
  tempestade: { label: "Tempestade", icon: "fa-solid fa-cloud-bolt", group: "agua" },
  relampagos: { label: "Relâmpagos", icon: "fa-solid fa-bolt-lightning", group: "agua" },
  granizo: { label: "Granizo", icon: "fa-solid fa-cloud-meatball", group: "agua" },
  goteiras: { label: "Goteiras", icon: "fa-solid fa-droplet", group: "agua" },
  bolhas: { label: "Bolhas", icon: "fa-solid fa-circle-dot", group: "agua" },
  neve: { label: "Neve", icon: "fa-solid fa-snowflake", group: "frio" },
  nevasca: { label: "Nevasca", icon: "fa-solid fa-icicles", group: "frio" },
  areia: { label: "Tempestade de areia", icon: "fa-solid fa-wind", group: "vento" },
  vento: { label: "Ventania", icon: "fa-solid fa-wind", group: "vento" },
  feno: { label: "Feno rolando", icon: "fa-solid fa-circle-notch", group: "vento" },
  poeira: { label: "Poeira", icon: "fa-solid fa-smog", group: "vento" },
  cinzas: { label: "Cinzas", icon: "fa-solid fa-fire-flame-simple", group: "fogo" },
  brasas: { label: "Brasas", icon: "fa-solid fa-fire", group: "fogo" },
  meteoros: { label: "Chuva de meteoros", icon: "fa-solid fa-meteor", group: "fogo" },
  folhas: { label: "Folhas", icon: "fa-solid fa-leaf", group: "natureza" },
  petalas: { label: "Pétalas", icon: "fa-solid fa-spa", group: "natureza" },
  polen: { label: "Pólen", icon: "fa-solid fa-seedling", group: "natureza" },
  sementes: { label: "Dentes-de-leão", icon: "fa-solid fa-feather", group: "natureza" },
  vagalumes: { label: "Vaga-lumes", icon: "fa-solid fa-bug", group: "natureza" },
  esporos: { label: "Esporos", icon: "fa-solid fa-disease", group: "natureza" },
  passaros: { label: "Pássaros", icon: "fa-solid fa-dove", group: "natureza" },
  morcegos: { label: "Morcegos", icon: "fa-solid fa-ghost", group: "natureza" },
  neblina: { label: "Neblina", icon: "fa-solid fa-smog", group: "ceu" },
  bruma: { label: "Bruma no chão", icon: "fa-solid fa-water", group: "ceu" },
  estrelas: { label: "Estrelas", icon: "fa-solid fa-star", group: "ceu" },
  cadentes: { label: "Estrelas cadentes", icon: "fa-solid fa-star-half-stroke", group: "ceu" },
  aurora: { label: "Aurora", icon: "fa-solid fa-rainbow", group: "ceu" },
  raios: { label: "Raios de luz", icon: "fa-solid fa-sun", group: "ceu" },
  faiscas: { label: "Brilhos mágicos", icon: "fa-solid fa-wand-sparkles", group: "magia" },
  penas: { label: "Penas", icon: "fa-solid fa-feather-pointed", group: "magia" }
};

export const WEATHER_GROUPS = {
  agua: "Chuva e água",
  frio: "Frio",
  vento: "Vento e areia",
  fogo: "Fogo e cinzas",
  natureza: "Natureza",
  ceu: "Céu e luz",
  magia: "Magia"
};

/** A colour wash over the whole scene. */
export const TINTS = {
  "": { label: "Nenhum" },
  noite: { label: "Noite", color: "rgba(14, 26, 70, .45)" },
  entardecer: { label: "Entardecer", color: "rgba(255, 128, 60, .2)" },
  alvorada: { label: "Alvorada", color: "rgba(255, 190, 215, .16)" },
  tempestade: { label: "Céu de tempestade", color: "rgba(30, 38, 56, .38)" },
  sombrio: { label: "Sombrio", color: "rgba(0, 0, 0, .3)", vignette: "rgba(0, 0, 0, .75)" },
  sangue: { label: "Lua de sangue", color: "rgba(130, 0, 20, .26)", vignette: "rgba(60, 0, 8, .55)" },
  espectral: { label: "Espectral", color: "rgba(60, 255, 170, .12)", vignette: "rgba(0, 40, 30, .5)" },
  sepia: { label: "Sépia", color: "rgba(150, 105, 50, .22)" },
  dourado: { label: "Luz dourada", color: "rgba(255, 205, 110, .16)" },
  gelido: { label: "Gélido", color: "rgba(170, 220, 255, .18)", vignette: "rgba(220, 245, 255, .45)" }
};

/** Ready-made combinations (one click in the GM window). */
export const PRESETS = {
  limpo: { label: "Céu limpo", icon: "fa-solid fa-sun", clima: { mana: [], layers: [], tint: "" } },
  chuvoso: { label: "Dia chuvoso", icon: "fa-solid fa-cloud-rain", clima: { mana: [], layers: ["chuva", "neblina"], tint: "tempestade" } },
  tempestadeEletrica: { label: "Tempestade elétrica", icon: "fa-solid fa-cloud-bolt", clima: { mana: ["bolt"], layers: ["tempestade", "vento"], tint: "tempestade", wind: 0.4 } },
  inverno: { label: "Inverno cruel", icon: "fa-solid fa-snowflake", clima: { mana: ["ice"], layers: ["nevasca", "bruma"], tint: "gelido", wind: 0.6 } },
  deserto: { label: "Tormenta no deserto", icon: "fa-solid fa-wind", clima: { mana: [], layers: ["areia", "poeira", "feno"], tint: "entardecer", wind: 0.8 } },
  inferno: { label: "Inferno", icon: "fa-solid fa-fire", clima: { mana: ["fire"], layers: ["brasas", "cinzas", "meteoros"], tint: "sangue" } },
  bosque: { label: "Bosque encantado", icon: "fa-solid fa-tree", clima: { mana: ["light"], layers: ["vagalumes", "petalas", "raios"], tint: "dourado" } },
  pantano: { label: "Pântano venenoso", icon: "fa-solid fa-frog", clima: { mana: ["poison"], layers: ["esporos", "bruma", "neblina"], tint: "espectral" } },
  noite: { label: "Noite estrelada", icon: "fa-solid fa-moon", clima: { mana: [], layers: ["estrelas", "cadentes", "vagalumes"], tint: "noite" } },
  trevas: { label: "Domínio das trevas", icon: "fa-solid fa-skull", clima: { mana: ["dark"], layers: ["morcegos", "neblina"], tint: "sombrio" } },
  celestial: { label: "Juízo celestial", icon: "fa-solid fa-feather", clima: { mana: ["light", "air"], layers: ["penas", "raios", "faiscas"], tint: "alvorada" } },
  abismo: { label: "Fundo do mar", icon: "fa-solid fa-water", clima: { mana: ["ice"], layers: ["bolhas", "raios"], tint: "noite" } }
};

/** Biome particles of v1 → weather layer. */
const BIOME_LAYER = { folhas: "folhas", neve: "neve", brasas: "brasas", areia: "areia", vagalumes: "vagalumes", poeira: "poeira", brisa: "vento", polen: "polen" };

export function biomeLayer(biome) {
  return BIOME_LAYER[BIOMES[biome]?.ambient] ?? "poeira";
}

export function normalizeClimate(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const list = (v, ok, max) => [...new Set((Array.isArray(v) ? v : []).filter(x => ok(x)))].slice(0, max);
  return {
    mana: list(o.mana, x => MANA_ELEMENTS.includes(x), MAX_MANA),
    layers: list(o.layers, x => Object.prototype.hasOwnProperty.call(WEATHER, x), MAX_LAYERS),
    tint: typeof o.tint === "string" && Object.prototype.hasOwnProperty.call(TINTS, o.tint) ? o.tint : "",
    intensity: num(o.intensity, 1, 0.25, 2),
    wind: num(o.wind, 0, -1, 1)
  };
}

/**
 * The climate a battle starts with: the setup's weather choice ("" = the biome's, "nenhum" = none)
 * and the setup mana.
 */
export function startingClimate(setup) {
  const layers = setup.weather === "nenhum" ? [] : setup.weather ? [setup.weather] : [biomeLayer(setup.biome)];
  return normalizeClimate({ mana: setup.mana ? [setup.mana] : [], layers, tint: "", intensity: 1, wind: setup.biome === "deserto" ? 0.6 : 0 });
}

/** The climate shown on a battle scene (flag `clima`, or the v1 behaviour). */
export function climateOf(scene, battleFlags) {
  const raw = scene?.getFlag?.("batalhas-fu", "clima") ?? scene?.flags?.["batalhas-fu"]?.clima;
  if ( raw ) return normalizeClimate(raw);
  const b = battleFlags ?? {};
  return normalizeClimate({ mana: b.mana ? [b.mana] : [], layers: [biomeLayer(b.biome ?? "planicie")] });
}
