/**
 * Batalhas FU: setting up and tearing down a battle (GM only).
 *
 * start: background (custom image or generated + uploaded once) -> new scene flagged as a battle ->
 *        tokens copied from the source tokens/actors, placed in rows (field) or as cards (table) ->
 *        a Combat with every token -> intro flag -> scene activated -> combat started (system dialog).
 * end:   unlinked tokens give their HP/MP/effects back to the tokens they came from, the combat is
 *        deleted, the previous scene is activated again and the battle scene is optionally deleted.
 */
import {
  BIOMES, GRID, MODULE_ID, MODULE_TITLE, SCENE_H, SCENE_W, hash, isGM, wait
} from "./constants.mjs";
import { fieldSlots, tableCardSize, tableSlots } from "./layout.mjs";
import { backgroundSVG } from "./backgrounds.mjs";
import { battleCard, isCardImage } from "./cards.mjs";
import { canvasToBlob, listFolder, rootFolder, svgToCanvas, uploadBlob } from "./files.mjs";
import {
  cachedBackground, customBackground, getBattle, normalizeSetup, rememberBackground, setBattle
} from "./store.mjs";
import { hideTurnMarker } from "./fx.mjs";
import { fittedBackground } from "./library.mjs";

const SceneCls = () => foundry.documents?.Scene?.implementation ?? CONFIG.Scene.documentClass;
const CombatCls = () => foundry.documents?.Combat?.implementation ?? CONFIG.Combat.documentClass;
const FolderCls = () => foundry.documents?.Folder?.implementation ?? CONFIG.Folder.documentClass;
const DISP = () => CONST?.TOKEN_DISPOSITIONS ?? { FRIENDLY: 1, HOSTILE: -1 };

/* ---------------------------------------------------------------------------------------------- */
/* Combatant references                                                                             */
/* ---------------------------------------------------------------------------------------------- */

/**
 * A reference is { kind: "token", uuid } (a token of another scene, keeps its HP) or
 * { kind: "actor", id } (a fresh token from the actor's prototype).
 * @returns {Promise<{actor, data, source}|null>}
 */
async function resolveRef(ref) {
  if ( ref?.kind === "token" ) {
    const doc = await fromUuid(ref.uuid);
    if ( !doc?.actor ) return null;
    const data = doc.toObject();
    return { actor: doc.actor, data, source: doc.uuid };
  }
  const actor = game.actors?.get(ref?.id);
  if ( !actor ) return null;
  const td = await actor.getTokenDocument({});
  return { actor, data: td.toObject(), source: null };
}

/* ---------------------------------------------------------------------------------------------- */
/* Background                                                                                       */
/* ---------------------------------------------------------------------------------------------- */

export async function backgroundFor(setup, slots, onStatus = () => null) {
  /* an image picked from the library for this battle, then the biome's own image, then the generated one */
  if ( setup.bgMode === "biblioteca" && setup.bgLib ) return fittedBackground(setup.bgLib, setup.bgFocus, setup, onStatus);
  const custom = customBackground(setup.layout, setup.biome);
  if ( custom ) return fittedBackground(custom, setup.bgFocus, setup, onStatus);
  const visual = setup.layout === "mesa"
    ? { l: "mesa", b: setup.biome, t: setup.table, m: setup.mana, s: setup.seed, slots, v: 1 }
    : { l: "campo", b: setup.biome, t: setup.time, m: setup.mana, s: setup.seed, v: 1 };
  const key = hash(visual);
  const dir = `${rootFolder()}/fundos`;
  const name = `${setup.layout}-${setup.biome}-${key}.webp`;
  const cached = cachedBackground(key);
  if ( cached && (await listFolder(dir)).has(name) ) return cached;
  onStatus("Pintando o fundo…");
  const svg = backgroundSVG({ ...setup, slots }, 1);
  const canvasEl = await svgToCanvas(svg, SCENE_W, SCENE_H);
  const blob = await canvasToBlob(canvasEl, "image/webp", 0.88);
  onStatus("Enviando o fundo…");
  const path = await uploadBlob(blob, dir, name);
  await rememberBackground(key, path);
  return path;
}

async function battleFolder() {
  const folders = game.folders?.contents ?? Array.from(game.folders ?? []);
  let f = folders.find(x => x.type === "Scene" && x.name === MODULE_TITLE && !x._source?.folder);
  if ( !f ) f = await FolderCls().create({ name: MODULE_TITLE, type: "Scene", folder: null, color: "#7a2a12" });
  return f?.id ?? null;
}

/* ---------------------------------------------------------------------------------------------- */
/* Token data                                                                                       */
/* ---------------------------------------------------------------------------------------------- */

function placeOnField(entries, side, setup) {
  const slots = fieldSlots(entries.length, side);
  return entries.map((e, i) => {
    const s = slots[i];
    const w = Math.max(0.5, (Number(e.data.width) || 1) * setup.tokenScale);
    const h = Math.max(0.5, (Number(e.data.height) || 1) * setup.tokenScale);
    const mirror = side === "party" ? setup.mirrorParty : setup.mirrorFoes;
    const sx = Math.abs(Number(e.data.texture?.scaleX) || 1);
    return { ...e, x: s.x - (w * GRID) / 2, y: s.y - (h * GRID) / 2, w, h, sort: 100 + Math.round(s.y), texture: { scaleX: mirror ? -sx : sx } };
  });
}

async function placeOnTable(entries, side, size, onStatus) {
  const slots = tableSlots(entries.length, side, size);
  const out = [];
  for ( let i = 0; i < entries.length; i++ ) {
    const e = entries[i];
    const s = slots[i];
    const src = e.data.texture?.src ?? e.actor.img;
    let card = src;
    if ( !isCardImage(src) ) {
      onStatus(`Fazendo a carta de ${e.data.name}…`);
      const portrait = e.actor.img && !String(e.actor.img).includes("mystery-man") ? e.actor.img : src;
      card = await battleCard(e.data.name ?? e.actor.name, portrait, side);
    }
    out.push({ ...e, x: s.x - s.w / 2, y: s.y - s.h / 2, w: size.w, h: size.h, sort: 100 + i, texture: { src: card, scaleX: 1, scaleY: 1, fit: "fill" }, card: true });
  }
  return out;
}

function tokenData(p, side) {
  const d = foundry.utils.deepClone(p.data);
  delete d._id;
  const disp = DISP();
  d.x = Math.round(p.x);
  d.y = Math.round(p.y);
  d.width = p.w;
  d.height = p.h;
  d.elevation = 0;
  d.rotation = 0;
  d.lockRotation = true;
  d.sort = p.sort;
  d.disposition = side === "party" ? disp.FRIENDLY : disp.HOSTILE;
  d.texture = { ...(d.texture ?? {}), ...p.texture };
  if ( p.card && d.ring ) d.ring = { ...d.ring, enabled: false };
  d.flags = { ...(d.flags ?? {}), [MODULE_ID]: { side, source: p.source ?? null } };
  return d;
}

/* ---------------------------------------------------------------------------------------------- */
/* Start                                                                                            */
/* ---------------------------------------------------------------------------------------------- */

/**
 * @param {object} opts  setup, party: refs[], foes: refs[], onStatus(text), onActivate() (just before the scene opens)
 * @returns {Promise<Scene>}
 */
export async function startBattle({ setup: rawSetup, party: partyRefs, foes: foeRefs, onStatus = () => null, onActivate = () => null }) {
  if ( !isGM() ) throw new Error("só o mestre começa batalhas");
  if ( getBattle().active ) throw new Error("já existe uma batalha em andamento; encerre-a antes");
  const setup = normalizeSetup(rawSetup);
  onStatus("Reunindo os combatentes…");
  const party = (await Promise.all((partyRefs ?? []).map(resolveRef))).filter(Boolean);
  const foes = (await Promise.all((foeRefs ?? []).map(resolveRef))).filter(Boolean);
  if ( !party.length && !foes.length ) throw new Error("escolha pelo menos um combatente");

  let placedParty, placedFoes, slots = null;
  if ( setup.layout === "mesa" ) {
    const size = tableCardSize(party.length, foes.length);
    slots = { party: tableSlots(party.length, "party", size), foes: tableSlots(foes.length, "foes", size) };
    placedParty = await placeOnTable(party, "party", size, onStatus);
    placedFoes = await placeOnTable(foes, "foes", size, onStatus);
  }
  else {
    placedParty = placeOnField(party, "party", setup);
    placedFoes = placeOnField(foes, "foes", setup);
  }
  const bg = await backgroundFor(setup, slots, onStatus);

  onStatus("Montando a cena…");
  const prevSceneId = game.scenes?.active?.id ?? canvas?.scene?.id ?? "";
  const scene = await SceneCls().create({
    name: `Batalha: ${BIOMES[setup.biome]?.label ?? "?"}`,
    width: SCENE_W,
    height: SCENE_H,
    padding: 0,
    backgroundColor: "#0b0a10",
    grid: { type: CONST?.GRID_TYPES?.GRIDLESS ?? 0, size: GRID },
    background: { src: bg },
    tokenVision: false,
    fog: { exploration: false },
    environment: { darknessLevel: 0, globalLight: { enabled: true } },
    navigation: false,
    folder: await battleFolder(),
    flags: { [MODULE_ID]: { battle: { layout: setup.layout, biome: setup.biome, time: setup.time, table: setup.table, mana: setup.mana, seed: setup.seed }, intro: 0 } }
  });
  if ( !scene ) throw new Error("o Foundry não criou a cena");

  const data = [...placedParty.map(p => tokenData(p, "party")), ...placedFoes.map(p => tokenData(p, "foes"))];
  const tokens = await scene.createEmbeddedDocuments("Token", data);
  const sources = {};
  tokens.forEach(t => {
    const src = t.getFlag(MODULE_ID, "source");
    if ( src ) sources[t.id] = src;
  });

  onStatus("Preparando o combate…");
  const combat = await CombatCls().create({ scene: scene.id, active: true });
  const created = await combat.createEmbeddedDocuments("Combatant", tokens.map(t => ({ tokenId: t.id, sceneId: scene.id, actorId: t.actorId, hidden: t.hidden })));
  if ( created.length < tokens.length ) {
    ui.notifications.warn(`${MODULE_TITLE}: ${tokens.length - created.length} token(s) não entraram no combate (o sistema só aceita personagens e NPCs).`);
  }

  await setBattle({ active: true, sceneId: scene.id, prevSceneId, combatId: combat.id, setup, sources, startedAt: Date.now() });

  if ( setup.intro ) await scene.setFlag(MODULE_ID, "intro", Number(game.time?.serverTime ?? Date.now()));
  onStatus("Levando todos para a batalha…");
  await onActivate();
  if ( setup.activate ) await scene.activate();
  else await scene.view();

  if ( setup.startCombat ) {
    await wait(setup.intro ? 4600 : 800);
    if ( game.combats.get(combat.id) && !combat.started ) await combat.startCombat();
  }
  return scene;
}

/* ---------------------------------------------------------------------------------------------- */
/* Reinforcements                                                                                   */
/* ---------------------------------------------------------------------------------------------- */

/** Add combatants to the running battle; everybody on that side is regrouped into new slots. */
export async function addToBattle(refs, side) {
  if ( !isGM() ) throw new Error("só o mestre muda a batalha");
  const state = getBattle();
  const scene = game.scenes.get(state.sceneId);
  const combat = game.combats.get(state.combatId);
  if ( !state.active || !scene ) throw new Error("não há batalha em andamento");
  const entries = (await Promise.all(refs.map(resolveRef))).filter(Boolean);
  if ( !entries.length ) return [];
  const existing = scene.tokens.filter(t => t.getFlag(MODULE_ID, "side") === side);
  const setup = state.setup;
  let placed;
  if ( setup.layout === "mesa" ) {
    const other = scene.tokens.filter(t => t.getFlag(MODULE_ID, "side") && t.getFlag(MODULE_ID, "side") !== side).length;
    const total = existing.length + entries.length;
    const size = tableCardSize(side === "party" ? total : other, side === "party" ? other : total);
    const slots = tableSlots(total, side, size);
    await scene.updateEmbeddedDocuments("Token", existing.map((t, i) => ({ _id: t.id, x: slots[i].x - slots[i].w / 2, y: slots[i].y - slots[i].h / 2, width: size.w, height: size.h })));
    placed = (await placeOnTable(entries, side, size, () => null)).map((p, k) => ({ ...p, x: slots[existing.length + k].x - p.w * GRID / 2, y: slots[existing.length + k].y - p.h * GRID / 2 }));
  }
  else {
    const total = existing.length + entries.length;
    const slots = fieldSlots(total, side);
    await scene.updateEmbeddedDocuments("Token", existing.map((t, i) => ({ _id: t.id, x: Math.round(slots[i].x - (t.width * GRID) / 2), y: Math.round(slots[i].y - (t.height * GRID) / 2), sort: 100 + slots[i].y })));
    placed = placeOnField(entries, side, setup).map((p, k) => {
      const s = slots[existing.length + k];
      return { ...p, x: s.x - (p.w * GRID) / 2, y: s.y - (p.h * GRID) / 2, sort: 100 + s.y };
    });
  }
  const tokens = await scene.createEmbeddedDocuments("Token", placed.map(p => tokenData(p, side)));
  if ( combat ) await combat.createEmbeddedDocuments("Combatant", tokens.map(t => ({ tokenId: t.id, sceneId: scene.id, actorId: t.actorId, hidden: t.hidden })));
  const sources = { ...state.sources };
  tokens.forEach(t => {
    const src = t.getFlag(MODULE_ID, "source");
    if ( src ) sources[t.id] = src;
  });
  await setBattle({ ...state, sources });
  return tokens;
}

/* ---------------------------------------------------------------------------------------------- */
/* End                                                                                              */
/* ---------------------------------------------------------------------------------------------- */

/**
 * @param {object} opts  giveBack (HP/MP/effects to the source tokens), back (previous scene),
 *                       deleteScene, onStatus
 */
export async function endBattle({ giveBack = true, back = true, deleteScene = false, onStatus = () => null } = {}) {
  if ( !isGM() ) throw new Error("só o mestre encerra batalhas");
  const state = getBattle();
  const scene = game.scenes.get(state.sceneId);
  let returned = 0;
  if ( scene && giveBack ) {
    onStatus("Devolvendo PV e PM aos tokens de origem…");
    for ( const t of scene.tokens ) {
      const src = state.sources[t.id] ?? t.getFlag(MODULE_ID, "source");
      if ( !src || t.actorLink ) continue;
      const doc = await fromUuid(src);
      if ( !doc || doc.actorLink ) continue;
      const delta = t.delta?.toObject?.() ?? t.toObject().delta;
      if ( !delta ) continue;
      delete delta._id;
      await doc.update({ delta });
      returned++;
    }
  }
  await hideTurnMarker();
  const combat = game.combats.get(state.combatId) ?? (scene ? game.combats.contents.find(c => c.scene?.id === scene.id) : null);
  if ( combat ) {
    onStatus("Encerrando o combate…");
    await combat.delete();
  }
  if ( back && state.prevSceneId && game.scenes.get(state.prevSceneId) && state.prevSceneId !== state.sceneId ) {
    onStatus("Voltando à cena anterior…");
    await game.scenes.get(state.prevSceneId).activate();
  }
  if ( deleteScene && scene ) {
    if ( canvas?.scene?.id === scene.id && !back ) await wait(200);
    await scene.delete();
  }
  await setBattle({ active: false });
  return { returned };
}

/** Replay the opening on every screen showing the battle. */
export async function replayIntro() {
  const state = getBattle();
  const scene = game.scenes.get(state.sceneId) ?? canvas?.scene;
  if ( !scene ) return;
  await scene.setFlag(MODULE_ID, "intro", Number(game.time?.serverTime ?? Date.now()));
}
