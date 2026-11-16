/**
 * Batalhas FU: settings and the state of the current battle.
 *
 * World (only the GM writes): batalha (the running battle), fundos (custom backgrounds per layout/biome),
 * cacheFundos (generated backgrounds already uploaded), plus the options shown in Configure Settings.
 * Client: ambiente (biome particles on this screen).
 */
import {
  ARRANGEMENTS, BIOMES, CARD_DESIGNS, CARD_MODES, CARD_STYLES, COUNTER_POS, INTROS, LAYOUTS, MATS, MODULE_ID, TABLES, TIMES, bool, num, pick, str
} from "./constants.mjs";
import { WEATHER } from "./climate.mjs";

export function registerSettings() {
  const hidden = (key, def) => game.settings.register(MODULE_ID, key, { scope: "world", config: false, type: Object, default: def });
  hidden("batalha", { active: false });
  hidden("fundos", { campo: {}, mesa: {} });
  hidden("cacheFundos", {});
  game.settings.register(MODULE_ID, "favFundos", { scope: "world", config: false, type: Array, default: [] });
  /* tags of the library images: { at: time of the last change, map: { "fundos/bfu-001.jpg": ["floresta", ...] } } */
  hidden("tagsFundos", { at: 0, map: {} });

  game.settings.register(MODULE_ID, "hudJogadores", {
    name: "Jogadores veem a batalha animada",
    hint: "A barra de turnos, as faixas de turno, a abertura com cartas e os números de dano aparecem para os jogadores. Desligado, só o mestre vê esses elementos (a cena, os tokens e o clima continuam visíveis).",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "animacoes", {
    name: "Animar ataques, magias, dano e cura",
    hint: "Usa o Sequencer e o Token Magic FX quando estão ativos; sem eles, o módulo desenha as animações por conta própria.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "animarFora", {
    name: "Animar também fora das batalhas",
    hint: "Liga as animações de ataque e magia em qualquer cena, não só nas cenas criadas pelo Batalhas FU.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "usarJB2A", {
    name: "Usar efeitos do JB2A quando houver",
    hint: "Se o módulo JB2A (grátis ou Patreon) estiver ativo, alguns golpes e magias usam os vídeos dele no lugar das imagens do Batalhas FU.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "tremor", {
    name: "Tremer a tela em golpes fortes",
    hint: "Golpes críticos e golpes em fraquezas sacodem a câmera de todos (precisa do Sequencer).",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "pvInimigos", {
    name: "Jogadores veem os PV dos inimigos",
    hint: "Desligado, os jogadores veem só o nome e se o inimigo está em crise.",
    scope: "world", config: true, type: Boolean, default: false
  });
  game.settings.register(MODULE_ID, "pastaFundos", {
    name: "Pasta da biblioteca de fundos",
    hint: "Pasta (dentro dos dados do Foundry) com as imagens de fundo extras e o indice.json. Padrão: batalhas-fu-fundos.",
    scope: "world", config: true, type: String, default: "batalhas-fu-fundos"
  });
  game.settings.register(MODULE_ID, "hudEscala", {
    name: "Tamanho do HUD da batalha (nesta tela)",
    hint: "Aumenta ou diminui a barra de turnos, as plaquinhas, o painel do grupo e as faixas.",
    scope: "client", config: true, type: Number, default: 1, range: { min: 0.7, max: 1.4, step: 0.05 }
  });
  game.settings.register(MODULE_ID, "plaquinhas", {
    name: "Plaquinhas com nome e PV nos tokens (nesta tela)",
    scope: "client", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "turnosAuto", {
    name: "Abrir a janela de turnos ao entrar numa batalha (mestre)",
    hint: "A janela Turnos da batalha concentra os controles do mestre e pode ser movida e redimensionada.",
    scope: "client", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "ambiente", {
    name: "Clima e partículas (nesta tela)",
    hint: "Chuva, neve, folhas, brasas, mana no ar, pássaros... Desligado, ficam só os tons de cor da cena. Desligue se o computador ficar lento.",
    scope: "client", config: true, type: Boolean, default: true
  });
}

export function setting(key, fallback = null) {
  try {
    return game.settings.get(MODULE_ID, key);
  } catch ( err ) {
    return fallback;
  }
}

/* ---------------------------------------------------------------------------------------------- */
/* Setup of a battle (what the GM picks in the panel)                                               */
/* ---------------------------------------------------------------------------------------------- */

export const DEFAULT_SETUP = {
  layout: "campo",
  biome: "planicie",
  time: "dia",
  table: "escura",
  mana: "",
  seed: 1,
  tokenScale: 1.4,
  mirrorParty: false,
  mirrorFoes: false,
  intro: true,
  introStyle: "cartas",
  activate: true,
  startCombat: true,
  bgMode: "gerado",
  bgLib: "",
  bgFocus: 0.6,
  mat: "bioma",
  arrangement: "linha",
  cardMode: "gerada",
  cardStyle: "classica",
  cardDesign: "moldura",
  counters: "cantos",
  cardInfo: { name: true, hp: true, mp: true, ip: true, status: true },
  weather: "",
  tableLib: "",
  tableFocus: 0.5,
  props: true
};

/** Which counters and labels go on the table cards. */
export function normalizeCardInfo(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  return { name: bool(o.name, true), hp: bool(o.hp, true), mp: bool(o.mp, true), ip: bool(o.ip, true), status: bool(o.status, true) };
}

export function normalizeSetup(raw = {}) {
  const o = raw && typeof raw === "object" ? raw : {};
  return {
    layout: pick(o.layout, LAYOUTS, DEFAULT_SETUP.layout),
    biome: pick(o.biome, BIOMES, DEFAULT_SETUP.biome),
    time: pick(o.time, TIMES, DEFAULT_SETUP.time),
    table: pick(o.table, TABLES, DEFAULT_SETUP.table),
    mana: typeof o.mana === "string" && /^[a-z]{0,12}$/.test(o.mana) ? o.mana : "",
    seed: Math.round(num(o.seed, 1, 1, 99999)),
    tokenScale: num(o.tokenScale, DEFAULT_SETUP.tokenScale, 0.6, 3),
    mirrorParty: bool(o.mirrorParty, false),
    mirrorFoes: bool(o.mirrorFoes, false),
    intro: bool(o.intro, true),
    introStyle: pick(o.introStyle, INTROS, DEFAULT_SETUP.introStyle),
    activate: bool(o.activate, true),
    startCombat: bool(o.startCombat, true),
    bgMode: o.bgMode === "biblioteca" ? "biblioteca" : "gerado",
    bgLib: str(o.bgLib, "", 2000),
    bgFocus: num(o.bgFocus, 0.6, 0, 1),
    mat: pick(o.mat, MATS, DEFAULT_SETUP.mat),
    arrangement: pick(o.arrangement, ARRANGEMENTS, DEFAULT_SETUP.arrangement),
    cardMode: pick(o.cardMode, CARD_MODES, DEFAULT_SETUP.cardMode),
    cardStyle: pick(o.cardStyle, CARD_STYLES, DEFAULT_SETUP.cardStyle),
    cardDesign: pick(o.cardDesign, CARD_DESIGNS, DEFAULT_SETUP.cardDesign),
    counters: pick(o.counters, COUNTER_POS, o.cardMode === "token" ? "faixa" : "cantos"),
    cardInfo: normalizeCardInfo(o.cardInfo),
    weather: o.weather === "nenhum" || Object.prototype.hasOwnProperty.call(WEATHER, o.weather) ? o.weather : "",
    tableLib: str(o.tableLib, "", 2000),
    tableFocus: num(o.tableFocus, 0.5, 0, 1),
    props: bool(o.props, true)
  };
}

const LAST_KEY = `${MODULE_ID}.ultimaConfig`;
export function loadLastSetup() {
  try {
    return normalizeSetup(JSON.parse(localStorage.getItem(LAST_KEY) ?? "{}"));
  } catch ( err ) {
    return normalizeSetup({});
  }
}
export function saveLastSetup(setup) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(setup));
  } catch ( err ) { /* convenience only */ }
}

/* ---------------------------------------------------------------------------------------------- */
/* Running battle                                                                                   */
/* ---------------------------------------------------------------------------------------------- */

export function getBattle() {
  const b = setting("batalha", { active: false }) ?? {};
  return {
    active: bool(b.active, false),
    sceneId: str(b.sceneId, "", 40),
    prevSceneId: str(b.prevSceneId, "", 40),
    combatId: str(b.combatId, "", 40),
    setup: normalizeSetup(b.setup),
    sources: b.sources && typeof b.sources === "object" ? b.sources : {},
    slots: b.slots && typeof b.slots === "object" ? b.slots : null,
    startedAt: num(b.startedAt, 0, 0, 1e15)
  };
}

export async function setBattle(state) {
  await game.settings.set(MODULE_ID, "batalha", state ?? { active: false });
}

/** Battle flags stored on a scene made by the module ({ layout, biome, ... }), or null. */
export function battleFlags(scene) {
  return scene?.getFlag?.(MODULE_ID, "battle") ?? scene?.flags?.[MODULE_ID]?.battle ?? null;
}

export function isBattleScene(scene) {
  return Boolean(battleFlags(scene));
}

/* ---------------------------------------------------------------------------------------------- */
/* Backgrounds                                                                                      */
/* ---------------------------------------------------------------------------------------------- */

export function customBackground(layout, biome) {
  const all = setting("fundos", { campo: {}, mesa: {} }) ?? {};
  return str(all?.[layout]?.[biome], "", 2000);
}

export async function setCustomBackground(layout, biome, path) {
  const all = foundry.utils.deepClone(setting("fundos", { campo: {}, mesa: {} }) ?? {});
  all[layout] ??= {};
  if ( path ) all[layout][biome] = path;
  else delete all[layout][biome];
  await game.settings.set(MODULE_ID, "fundos", all);
}

export function cachedBackground(key) {
  return str((setting("cacheFundos", {}) ?? {})[key], "", 2000);
}

export async function rememberBackground(key, path) {
  const all = { ...(setting("cacheFundos", {}) ?? {}) };
  all[key] = path;
  const keys = Object.keys(all);
  while ( keys.length > 120 ) delete all[keys.shift()];
  await game.settings.set(MODULE_ID, "cacheFundos", all);
}
