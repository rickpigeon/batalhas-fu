/**
 * Batalhas FU: battle animations.
 *
 * A recipe is a list of steps { img, at: "source"|"target", anim, size, tint, dur, delay, below, to }.
 * The same recipe is played by Sequencer (canvas, synced by Sequencer to every client) or, without it,
 * by the DOM layer of every client (broadcast through the module socket). Token reactions (hit flash,
 * turn glow, crisis, KO) use Token Magic FX when it is active.
 *
 * Only the active GM runs this file's playback: players' system events are relayed to the GM first.
 */
import { ELEMENTS, FRIENDLY, MODULE_ID, PATH, SOCKET, elementOf, hexToNumber, isActiveGM } from "./constants.mjs";
import { setting } from "./store.mjs";
import { playDomFx } from "./fx-dom.mjs";

export const FX_IMG = name => `${PATH}/assets/fx/${name}.webp`;

const hasSequencer = () => Boolean(game.modules.get("sequencer")?.active && globalThis.Sequence);
const hasTMFX = () => Boolean(game.modules.get("tokenmagic")?.active && globalThis.TokenMagic);
const hasJB2A = () => Boolean(setting("usarJB2A", true) && (game.modules.get("JB2A_DnD5e")?.active || game.modules.get("jb2a_patreon")?.active));

/* ---------------------------------------------------------------------------------------------- */
/* Recipes                                                                                          */
/* ---------------------------------------------------------------------------------------------- */

/** The impact image of each element. */
const IMPACT = {
  physical: "impact", air: "swirl", bolt: "impact", dark: "void", earth: "rocks",
  fire: "flame", ice: "shards", light: "rays", poison: "bubbles", untyped: "spark"
};

/** Optional JB2A database paths (only used when present in the Sequencer database). */
const JB2A = {
  melee: "jb2a.melee_generic.slash.01.orange",
  ranged: "jb2a.arrow.physical.white",
  fire: "jb2a.fire_bolt.orange",
  ice: "jb2a.ray_of_frost.blue",
  bolt: "jb2a.chain_lightning.primary.blue",
  heal: "jb2a.healing_generic.200px.green"
};

function jb2a(key) {
  if ( !hasJB2A() || !hasSequencer() ) return null;
  const path = JB2A[key];
  try {
    return path && globalThis.Sequencer?.Database?.entryExists?.(path) ? path : null;
  } catch ( err ) {
    return null;
  }
}

/**
 * @param {object} e  { kind, style, element, crit, fumble, resource, affinity }
 * @returns {object[]} steps
 */
export function recipeFor(e) {
  const el = elementOf(e.element);
  const color = ELEMENTS[el].color;
  const steps = [];
  switch ( e.kind ) {
    case "attack": {
      if ( e.style === "spell" ) {
        steps.push({ img: "circle", at: "source", anim: "spin", size: 1.9, tint: color, dur: 1500, delay: 0, below: true });
        steps.push({ img: "orb", at: "source", anim: "fly", to: "target", size: 0.7, tint: color, dur: 600, delay: 650 });
        if ( el === "bolt" ) steps.push({ img: "bolt", at: "source", anim: "beam", to: "target", tint: color, dur: 520, delay: 650 });
        steps.push({ img: IMPACT[el], at: "target", anim: el === "light" || el === "dark" ? "spin" : "burst", size: 1.6, tint: color, dur: 900, delay: 1150 });
        steps.push({ img: "spark", at: "target", anim: "burst", size: 1.1, tint: ELEMENTS[el].glow, dur: 500, delay: 1200 });
      }
      else if ( e.style === "ranged" ) {
        steps.push({ img: "arrow", at: "source", anim: "fly", to: "target", size: 0.9, dur: 520, delay: 0, jb2a: "ranged" });
        steps.push({ img: IMPACT[el], at: "target", anim: "burst", size: 1.2, tint: color, dur: 600, delay: 480 });
      }
      else {
        steps.push({ img: el === "physical" ? "slash" : "claw", at: "target", anim: "slash", size: 1.5, tint: el === "physical" ? "#ffffff" : color, dur: 520, delay: 0, jb2a: "melee" });
        steps.push({ img: IMPACT[el], at: "target", anim: "burst", size: 1.3, tint: color, dur: 600, delay: 180 });
      }
      if ( e.crit ) steps.push({ img: "rays", at: "target", anim: "burst", size: 2.4, tint: "#ffe9a8", dur: 900, delay: 300 });
      break;
    }
    case "spell":
      steps.push({ img: "circle", at: "source", anim: "spin", size: 1.8, tint: color, dur: 1300, delay: 0, below: true });
      steps.push({ img: "spark", at: "target", anim: "rise", size: 1.2, tint: color, dur: 1000, delay: 500 });
      steps.push({ img: "ring", at: "target", anim: "pulse", size: 1.8, tint: color, dur: 800, delay: 600 });
      break;
    case "skill":
      steps.push({ img: "ring", at: "source", anim: "pulse", size: 2, tint: color, dur: 800, delay: 0 });
      steps.push({ img: "spark", at: "source", anim: "burst", size: 1.2, tint: "#ffffff", dur: 600, delay: 150 });
      break;
    case "item":
      steps.push({ img: "heal", at: "target", anim: "rise", size: 1.3, tint: "#9ff2c0", dur: 1100, delay: 0, jb2a: "heal" });
      steps.push({ img: "spark", at: "target", anim: "burst", size: 1, tint: "#ffffff", dur: 600, delay: 300 });
      break;
    case "gain": {
      const c = e.resource === "mp" ? "#7fb8ff" : e.resource === "ip" ? "#ffd27a" : "#7dff9e";
      steps.push({ img: "heal", at: "target", anim: "rise", size: 1.4, tint: c, dur: 1200, delay: 0, jb2a: e.resource === "hp" ? "heal" : null });
      steps.push({ img: "ring", at: "target", anim: "pulse", size: 1.6, tint: c, dur: 700, delay: 100 });
      break;
    }
    case "defeat":
      steps.push({ img: "skull", at: "target", anim: "hover", size: 0.8, dur: 1600, delay: 100 });
      steps.push({ img: "void", at: "target", anim: "spin", size: 1.6, tint: "#30242e", dur: 1200, delay: 0, below: true });
      break;
    case "crisis":
      steps.push({ img: "ring", at: "target", anim: "pulse", size: 1.8, tint: "#ff3b3b", dur: 900, delay: 0 });
      break;
    case "guard":
      steps.push({ img: "shield", at: "target", anim: "hover", size: 1.2, tint: "#9fd0ff", dur: 1200, delay: 0 });
      break;
    default:
      break;
  }
  return steps;
}

/* ---------------------------------------------------------------------------------------------- */
/* Sequencer renderer                                                                               */
/* ---------------------------------------------------------------------------------------------- */

function placeable(uuidOrId) {
  if ( !uuidOrId ) return null;
  const id = String(uuidOrId).split(".").pop();
  return canvas?.tokens?.get(id) ?? null;
}

function sequencerPlay(steps, source, targets) {
  const seq = new Sequence({ moduleName: MODULE_ID, softFail: true });
  for ( const s of steps ) {
    const list = s.at === "target" && !s.to ? targets : [source];
    for ( const at of list ) {
      if ( !at ) continue;
      const tos = s.to === "target" ? targets : [null];
      for ( const to of tos ) {
        if ( s.to && !to ) continue;
        const file = (s.jb2a && jb2a(s.jb2a)) || FX_IMG(s.img);
        const fx = seq.effect().file(file).delay(s.delay ?? 0);
        if ( s.tint && !file.startsWith("jb2a.") ) fx.tint(s.tint);
        switch ( s.anim ) {
          case "fly":
            fx.atLocation(at).moveTowards(to, { ease: "easeInOutQuad" }).scaleToObject(s.size ?? 0.8).duration(s.dur);
            break;
          case "beam":
            fx.atLocation(at).stretchTo(to).fadeIn(80).fadeOut(220).duration(s.dur);
            break;
          case "spin":
            fx.atLocation(at).scaleToObject(s.size).rotateIn(-120, 500, { ease: "easeOutCubic" }).scaleIn(0, 450, { ease: "easeOutBack" })
              .loopProperty("sprite", "rotation", { from: 0, to: 360, duration: 3600 }).fadeIn(150).fadeOut(400).duration(s.dur);
            break;
          case "slash":
            fx.atLocation(at).scaleToObject(s.size).rotateIn(-70, 220, { ease: "easeOutQuad" }).scaleIn(0.55, 200, { ease: "easeOutCubic" })
              .fadeOut(260).duration(s.dur);
            break;
          case "rise":
            fx.atLocation(at).scaleToObject(s.size).fadeIn(200).fadeOut(450)
              .animateProperty("sprite", "position.y", { from: 0, to: -0.6, duration: s.dur, gridUnits: true }).duration(s.dur);
            break;
          case "pulse":
            fx.atLocation(at).scaleToObject(s.size).scaleIn(0.2, Math.round(s.dur * 0.8), { ease: "easeOutCubic" }).fadeOut(Math.round(s.dur * 0.6)).duration(s.dur);
            break;
          case "hover":
            fx.atLocation(at).scaleToObject(s.size).fadeIn(250).fadeOut(500)
              .animateProperty("sprite", "position.y", { from: 0, to: -0.35, duration: s.dur, gridUnits: true }).duration(s.dur);
            break;
          case "burst":
          default:
            fx.atLocation(at).scaleToObject(s.size).scaleIn(0.3, 240, { ease: "easeOutBack" }).fadeOut(300).duration(s.dur);
            break;
        }
        if ( s.below ) fx.belowTokens();
      }
    }
  }
  return seq.play();
}

/* ---------------------------------------------------------------------------------------------- */
/* Token Magic FX reactions                                                                         */
/* ---------------------------------------------------------------------------------------------- */

const glow = (id, color, strength, loopMs, loops, autoDestroy) => ({
  filterType: "glow", filterId: id, outerStrength: strength, innerStrength: 1, color: hexToNumber(color),
  quality: 0.5, padding: 12, autoDestroy,
  animated: { outerStrength: { active: true, loopDuration: loopMs, animType: "syncCosOscillation", val1: strength, val2: 0.5, ...(loops ? { loops } : {}) } }
});

async function tmfx(token, params) {
  if ( !hasTMFX() || !token ) return;
  try {
    await TokenMagic.addUpdateFilters(token, Array.isArray(params) ? params : [params]);
  } catch ( err ) {
    console.warn(`${MODULE_ID} | Token Magic`, err);
  }
}
async function tmfxRemove(token, id) {
  if ( !hasTMFX() || !token ) return;
  try {
    if ( TokenMagic.hasFilterId?.(token, id) ) await TokenMagic.deleteFilters(token, id);
  } catch ( err ) {
    console.warn(`${MODULE_ID} | Token Magic`, err);
  }
}

export const React = {
  hit: (token, element) => tmfx(token, glow("bfuHit", element ? ELEMENTS[elementOf(element)].color : "#ff3b3b", 7, 260, 2, true)),
  heal: (token, color = "#7dff9e") => tmfx(token, glow("bfuHeal", color, 6, 500, 2, true)),
  crisis: (token, on) => (on ? tmfx(token, glow("bfuCrisis", "#ff2a2a", 4, 1400, 0, false)) : tmfxRemove(token, "bfuCrisis")),
  ko: (token, on) => (on
    ? tmfx(token, { filterType: "adjustment", filterId: "bfuKO", saturation: 0, brightness: 0.55, contrast: 1, gamma: 1, red: 1, green: 1, blue: 1, alpha: 0.85, animated: {} })
    : tmfxRemove(token, "bfuKO")),
  turn: (token, faction, on) => {
    if ( !on ) return tmfxRemove(token, "bfuTurn");
    const c1 = faction === FRIENDLY ? "#ffd36b" : "#ff5a5a";
    const c2 = faction === FRIENDLY ? "#7fd8ff" : "#ff9a3a";
    const params = glow("bfuTurn", c1, 5, 1600, 0, false);
    params.animated = {
      outerStrength: { active: true, loopDuration: 1600, animType: "syncCosOscillation", val1: 6, val2: 2 },
      color: { active: true, loopDuration: 3200, animType: "colorOscillation", val1: hexToNumber(c1), val2: hexToNumber(c2) }
    };
    return tmfx(token, params);
  }
};

/* ---------------------------------------------------------------------------------------------- */
/* Turn marker (persistent ring under the acting token)                                             */
/* ---------------------------------------------------------------------------------------------- */

export async function showTurnMarker(tokenId, faction) {
  hideTurnMarker();
  const token = placeable(tokenId);
  if ( !token ) return;
  const color = faction === FRIENDLY ? "#ffd36b" : "#ff6b6b";
  if ( hasSequencer() ) {
    try {
      await new Sequence({ moduleName: MODULE_ID, softFail: true }).effect().file(FX_IMG("turn")).name("bfu-turn").attachTo(token, { bindAlpha: false })
        .scaleToObject(1.7).tint(color).belowTokens().persist().fadeIn(300).fadeOut(300).scaleIn(0.4, 500, { ease: "easeOutBack" })
        .loopProperty("sprite", "rotation", { from: 0, to: 360, duration: 9000 })
        .loopProperty("sprite", "alpha", { values: [0.75, 1], duration: 900, pingPong: true })
        .play();
    } catch ( err ) {
      console.warn(`${MODULE_ID} | Sequencer`, err);
    }
  }
  await React.turn(token, faction, true);
  marked = tokenId;
}

let marked = null;
export async function hideTurnMarker() {
  if ( hasSequencer() ) {
    try {
      await globalThis.Sequencer?.EffectManager?.endEffects?.({ name: "bfu-turn" });
    } catch ( err ) { /* nothing to end */ }
  }
  if ( marked ) await React.turn(placeable(marked), null, false);
  marked = null;
}

/* ---------------------------------------------------------------------------------------------- */
/* Entry point (active GM)                                                                          */
/* ---------------------------------------------------------------------------------------------- */

/**
 * Play an event: { kind, source (token uuid), targets [token uuids], element, style, crit, ... }.
 * Text pop-ups (damage numbers, affinity words) always go through the DOM layer of every client.
 */
export async function playEvent(e) {
  if ( !isActiveGM() ) return;
  const allowed = setting("animacoes", true);
  const source = placeable(e.source);
  const targets = (e.targets ?? []).map(placeable).filter(Boolean);
  if ( !targets.length && source ) targets.push(source);

  /* reactions and pop-ups */
  if ( e.kind === "damage" ) {
    for ( const t of targets ) React.hit(t, e.element);
    broadcastDom({ type: "pop", targets: targets.map(t => t.id), text: String(e.amount ?? ""), element: e.element, affinity: e.affinity, crit: e.crit });
    if ( allowed && hasSequencer() && setting("tremor", true) && (e.crit || e.affinity === "vulnerability") ) {
      try {
        new Sequence({ moduleName: MODULE_ID, softFail: true }).canvasPan().shake({ duration: 380, strength: 12, rotation: false }).play();
      } catch ( err ) { /* old Sequencer */ }
    }
    else if ( e.crit || e.affinity === "vulnerability" ) broadcastDom({ type: "shake" });
    return;
  }
  if ( e.kind === "gain" ) {
    for ( const t of targets ) React.heal(t, e.resource === "mp" ? "#7fb8ff" : "#7dff9e");
    broadcastDom({ type: "pop", targets: targets.map(t => t.id), text: `+${e.amount ?? ""}`, resource: e.resource });
  }
  if ( e.kind === "crisis" ) for ( const t of targets ) React.crisis(t, true);
  if ( e.kind === "defeat" ) for ( const t of targets ) React.ko(t, true);
  if ( e.kind === "attack" && e.fumble ) broadcastDom({ type: "pop", targets: [source?.id].filter(Boolean), text: "Falha!", resource: "fumble" });

  if ( !allowed ) return;
  const steps = recipeFor(e);
  if ( !steps.length ) return;
  if ( hasSequencer() && source ) {
    try {
      await sequencerPlay(steps, source, targets);
      return;
    } catch ( err ) {
      console.warn(`${MODULE_ID} | Sequencer falhou; usando a animação própria`, err);
    }
  }
  broadcastDom({ type: "fx", steps, source: source?.id ?? null, targets: targets.map(t => t.id) });
}

/** Send a DOM effect to every client (and play it here). */
export function broadcastDom(msg) {
  try {
    game.socket?.emit(SOCKET, { ...msg, scope: "dom", sceneId: canvas?.scene?.id ?? null });
  } catch ( err ) { /* offline */ }
  playDomFx(msg);
}

export const backends = () => ({ sequencer: hasSequencer(), tokenmagic: hasTMFX(), jb2a: hasJB2A() });
