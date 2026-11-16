/**
 * Batalhas FU: the opening of a battle, on every client (DOM, above the canvas).
 *
 *   cartas      a deck is shuffled, one card is dealt onto each combatant and flips (v1)
 *   versus      the foes and the party slide in from the sides, a big "VS" slams in the middle
 *   laminas     two swords fly in and clash: flash, sparks, the screen shakes
 *   portal      a magic circle of the battle's mana opens and swallows the screen
 *   cortinas    theatre curtains with the title on a plaque, then they open
 *   relampago   darkness, a lightning strike, the battlefield in the afterglow
 *   estilhacos  the veil with the title cracks and shatters into flying shards
 *
 * Started by the scene flags `intro` (server time) and `introKind`: every client that shows the battle
 * scene within 30 s plays it once, so players who load the scene a bit later still see it.
 * Every opening lasts at most ~4.4 s (the GM starts the combat after 4.6 s).
 */
import { BIOMES, ELEMENTS, FRIENDLY, INTROS, MODULE_ID, escapeHTML, wait } from "./constants.mjs";
import { battleFlags } from "./store.mjs";
import { factionOfToken, portraitOf } from "./fu-data.mjs";
import { canSeeHud, flagOf, layer, overlay, tokenRect } from "./overlay.mjs";
import { climateOf } from "./climate.mjs";

const BACKS = {
  planicie: ["#2f5a2c", "#d9c27a"], floresta: ["#1e4a2e", "#c9d98a"], deserto: ["#7a3f1c", "#f2cf7a"],
  neve: ["#2c4a73", "#e6f2ff"], vulcao: ["#4a1210", "#ff9a4a"], litoral: ["#15506a", "#f2deaa"],
  caverna: ["#26253a", "#a9b4ff"], pantano: ["#33401f", "#c9c27a"], ruinas: ["#3f3352", "#e0c88a"]
};

/** The openings that can be drawn ("sorteada" picks one of these). */
export const INTRO_KINDS = Object.keys(INTROS).filter(k => k !== "sorteada");
export const pickIntro = style => (INTRO_KINDS.includes(style) ? style : INTRO_KINDS[Math.floor(Math.random() * INTRO_KINDS.length)]);

let playing = false;
const played = new Set();

/** Called when the scene changes or its intro flag changes. */
export function maybePlayIntro(scene) {
  const at = Number(flagOf(scene, "intro") ?? 0);
  if ( !at || played.has(`${scene.id}|${at}`) ) return;
  const now = Number(game.time?.serverTime ?? Date.now());
  if ( Math.abs(now - at) > 30000 ) return;
  if ( canvas?.scene?.id !== scene.id || !canvas.ready ) return;
  played.add(`${scene.id}|${at}`);
  playIntro(scene, flagOf(scene, "introKind")).catch(err => console.warn(`${MODULE_ID} | intro`, err));
}

/* ---------------------------------------------------------------------------------------------- */
/* Helpers                                                                                          */
/* ---------------------------------------------------------------------------------------------- */

function div(cls, html = "", style = "") {
  const d = document.createElement("div");
  d.className = cls;
  if ( html ) d.innerHTML = html;
  if ( style ) d.style.cssText = style;
  return d;
}

const run = (node, frames, opts) => node.animate(frames, { fill: "both", ...opts }).finished.catch(() => null);

function shake(node, strength = 14, duration = 420) {
  const k = strength;
  return run(node, [
    { transform: "translate(0,0)" }, { transform: `translate(${-k}px, ${k * 0.6}px)` }, { transform: `translate(${k * 0.8}px, ${-k * 0.5}px)` },
    { transform: `translate(${-k * 0.5}px, ${-k * 0.4}px)` }, { transform: `translate(${k * 0.3}px, ${k * 0.3}px)` }, { transform: "translate(0,0)" }
  ], { duration, easing: "linear", fill: "none" });
}

function flash(box, color = "#ffffff", peak = 0.9, duration = 420) {
  const f = div("bfu-i-flash", "", `background:${color}`);
  box.append(f);
  return run(f, [{ opacity: 0 }, { opacity: peak, offset: 0.12 }, { opacity: 0 }], { duration, easing: "ease-out" }).then(() => f.remove());
}

function sparks(box, x, y, color = "#ffe08a", n = 26) {
  const all = [];
  for ( let i = 0; i < n; i++ ) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.3, d = 120 + Math.random() * 260;
    const s = div("bfu-i-spark", "", `left:${x}px;top:${y}px;--c:${color}`);
    box.append(s);
    all.push(run(s, [
      { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.2)`, opacity: 0 }
    ], { duration: 500 + Math.random() * 400, easing: "cubic-bezier(.1,.7,.3,1)" }).then(() => s.remove()));
  }
  return Promise.all(all);
}

/** What every opening needs: title, sides, a colour. */
function context(scene, tokens) {
  const flags = battleFlags(scene) ?? {};
  const biome = BIOMES[flags.biome]?.label ?? "Batalha";
  const mana = climateOf(scene, flags).mana[0] ?? flags.mana;
  const back = BACKS[flags.biome] ?? BACKS.planicie;
  const accent = ELEMENTS[mana]?.color ?? back[1];
  const who = t => ({ token: t, name: t.document.name, img: portraitOf(t.actor, t.document) });
  const party = tokens.filter(t => factionOfToken(t.document) === FRIENDLY).map(who);
  const foes = tokens.filter(t => factionOfToken(t.document) !== FRIENDLY).map(who);
  return { flags, biome, accent, back, party, foes, tokens };
}

function titleHTML(c, sub = "A batalha vai começar") {
  return `<div class="bfu-i-title"><b>${escapeHTML(c.biome)}</b><small>${escapeHTML(sub)}</small></div>`;
}

/* ---------------------------------------------------------------------------------------------- */
/* Entry                                                                                            */
/* ---------------------------------------------------------------------------------------------- */

export async function playIntro(scene, kind = "cartas") {
  if ( playing || !canSeeHud() ) return;
  const flags = battleFlags(scene);
  if ( !flags ) return;
  playing = true;
  const box = layer("intro");
  overlay().hidden = false;
  box.replaceChildren();
  try {
    const gm = game.user.isGM;
    const tokens = canvas.tokens.placeables.filter(t => flagOf(t.document, "side") && (gm || !t.document.hidden));
    const c = context(scene, tokens);
    const fn = { versus, laminas, portal, cortinas, relampago, estilhacos }[kind] ?? cartas;
    await fn(box, c);
  } finally {
    box.replaceChildren();
    playing = false;
  }
}

/* ---------------------------------------------------------------------------------------------- */
/* Cartas embaralhadas                                                                              */
/* ---------------------------------------------------------------------------------------------- */

function cardBack(colors) {
  return `<div class="bfu-cb" style="--b1:${colors[0]};--b2:${colors[1]}"><i class="bfu-cb-diamond"></i><i class="bfu-cb-star"></i></div>`;
}

async function cartas(box, c) {
  const { tokens } = c;
  const colors = c.back;
  const vw = window.innerWidth, vh = window.innerHeight;
  const ch = Math.min(vh * 0.26, 240), cw = ch * 0.68;
  const cx = vw / 2, cy = vh / 2;

  const veil = div("bfu-veil", `<div class="bfu-veil-title"><b>${escapeHTML(c.biome)}</b><small>Embaralhando o destino…</small></div>`);
  box.append(veil);
  veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, fill: "both" });

  const n = Math.max(tokens.length, 7);
  const cards = [];
  for ( let i = 0; i < n; i++ ) {
    const t = tokens[i] ?? null;
    const el = div("bfu-icard", "", `width:${cw}px;height:${ch}px;left:${cx - cw / 2}px;top:${cy - ch / 2}px;z-index:${10 + i}`);
    const face = t ? (() => {
      const party = factionOfToken(t.document) === FRIENDLY;
      return `<div class="bfu-cf ${party ? "party" : "foes"}"><img src="${escapeHTML(portraitOf(t.actor, t.document))}" alt=""><span>${escapeHTML(t.document.name)}</span></div>`;
    })() : "";
    el.innerHTML = `<div class="bfu-icard-inner">${cardBack(colors)}${face}</div>`;
    box.append(el);
    cards.push({ el, inner: el.firstElementChild, token: t, i });
  }

  /* two riffle shuffles */
  const riffle = async (dur, spread) => {
    const anims = cards.map(({ el, i }) => {
      const left = i % 2 === 0;
      const off = (left ? -1 : 1) * cw * spread;
      const lift = -12 - (i % 5) * 3;
      return el.animate([
        { transform: "translate(0,0) rotate(0deg)" },
        { offset: 0.4, transform: `translate(${off}px, ${(i % 4) * -2}px) rotate(${left ? -8 : 8}deg)` },
        { offset: 0.55 + (i / n) * 0.3, transform: `translate(${off * 0.25}px, ${lift}px) rotate(${left ? -3 : 3}deg)` },
        { transform: `translate(${(i % 3 - 1) * 1.5}px, ${-i * 0.6}px) rotate(${(i % 3 - 1) * 1.2}deg)` }
      ], { duration: dur, easing: "cubic-bezier(.45,0,.3,1)", fill: "both" });
    });
    await Promise.all(anims.map(a => a.finished.catch(() => null)));
  };
  await wait(300);
  await riffle(780, 0.75);
  await riffle(620, 0.6);

  /* deal the cards onto the tokens, face down (the title leaves first) */
  veil.querySelector(".bfu-veil-title")?.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(-20px)" }], { duration: 300, fill: "both" });
  const dealt = cards.filter(k => k.token);
  for ( const k of cards.filter(x => !x.token) ) {
    k.el.animate([{ opacity: 1 }, { opacity: 0, transform: `translate(0, ${-vh * 0.1}px) scale(.8)` }], { duration: 300, fill: "both" });
  }
  await Promise.all(dealt.map((k, j) => {
    const r = tokenRect(k.token);
    if ( !r ) return Promise.resolve();
    const h = Math.max(r.h, r.w * 1.3), w = h * 0.68;
    const target = { x: r.cx - w / 2, y: r.cy - h / 2 };
    const dx = target.x - (cx - cw / 2), dy = target.y - (cy - ch / 2);
    const sx = w / cw, sy = h / ch;
    k.el.style.transformOrigin = "0 0";
    return run(k.el, [
      { transform: "translate(0,0) scale(1) rotate(0deg)" },
      { offset: 0.6, transform: `translate(${dx * 0.7}px, ${dy * 0.7 - 40}px) scale(${(1 + sx) / 2}, ${(1 + sy) / 2}) rotate(${j % 2 ? 8 : -8}deg)` },
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotate(0deg)` }
    ], { duration: 520, delay: j * 110, easing: "cubic-bezier(.3,.7,.2,1)" });
  }));
  await wait(150);

  /* flip, one after the other */
  await Promise.all(dealt.map((k, j) => run(k.inner, [
    { transform: "rotateY(0deg)" },
    { offset: 0.5, transform: "rotateY(90deg) scale(1.08)" },
    { transform: "rotateY(180deg) scale(1)" }
  ], { duration: 560, delay: j * 120, easing: "ease-in-out" })));
  await wait(500);

  /* dissolve into the battlefield */
  veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, fill: "both" });
  await Promise.all(dealt.map((k, j) => run(k.el, [
    { opacity: 1, filter: "brightness(1)" },
    { offset: 0.35, opacity: 1, filter: "brightness(1.8)" },
    { opacity: 0, filter: "brightness(2.2)" }
  ], { duration: 650, delay: j * 40 })));
}

/* ---------------------------------------------------------------------------------------------- */
/* Versus                                                                                           */
/* ---------------------------------------------------------------------------------------------- */

function lineup(list, max = 8) {
  const shown = list.slice(0, max).map(w => `<div class="bfu-vs-who"><img src="${escapeHTML(w.img)}" alt=""><span>${escapeHTML(w.name)}</span></div>`).join("");
  return shown + (list.length > max ? `<div class="bfu-vs-more">+${list.length - max}</div>` : "");
}

async function versus(box, c) {
  const veil = div("bfu-veil dark");
  box.append(veil);
  run(veil, [{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
  const foes = div("bfu-vs-side foes", `<h3>Inimigos</h3><div class="bfu-vs-row">${lineup(c.foes)}</div>`);
  const party = div("bfu-vs-side party", `<h3>Grupo</h3><div class="bfu-vs-row">${lineup(c.party)}</div>`);
  const mark = div("bfu-vs-mark", "<b>VS</b>");
  const title = div("bfu-vs-title", `<b>${escapeHTML(c.biome)}</b>`);
  box.append(foes, party, mark, title);
  mark.style.opacity = "0";
  title.style.opacity = "0";
  await Promise.all([
    run(foes, [{ transform: "translateX(-110%)" }, { transform: "translateX(0)" }], { duration: 520, easing: "cubic-bezier(.2,.9,.25,1)" }),
    run(party, [{ transform: "translateX(110%)" }, { transform: "translateX(0)" }], { duration: 520, easing: "cubic-bezier(.2,.9,.25,1)" })
  ]);
  flash(box, "#ffffff", 0.7, 380);
  shake(box, 16, 380);
  run(mark, [{ opacity: 0, transform: "translate(-50%, -50%) scale(3.2) rotate(-12deg)" }, { opacity: 1, transform: "translate(-50%, -50%) scale(1) rotate(-6deg)" }], { duration: 260, easing: "cubic-bezier(.5,0,.75,0)" });
  sparks(box, window.innerWidth / 2, window.innerHeight / 2, "#ffe08a", 22);
  await wait(260);
  run(title, [{ opacity: 0, transform: "translate(-50%, 20px)" }, { opacity: 1, transform: "translate(-50%, 0)" }], { duration: 300 });
  run(mark, [{ transform: "translate(-50%, -50%) scale(1) rotate(-6deg)" }, { transform: "translate(-50%, -50%) scale(1.08) rotate(-4deg)" }], { duration: 1300, direction: "alternate", easing: "ease-in-out" });
  await wait(1400);
  await Promise.all([
    run(foes, [{ transform: "translateX(0)" }, { transform: "translateX(-115%)" }], { duration: 450, easing: "cubic-bezier(.6,0,.8,.4)" }),
    run(party, [{ transform: "translateX(0)" }, { transform: "translateX(115%)" }], { duration: 450, easing: "cubic-bezier(.6,0,.8,.4)" }),
    run(mark, [{ opacity: 1, transform: "translate(-50%, -50%) scale(1.08) rotate(-4deg)" }, { opacity: 0, transform: "translate(-50%, -50%) scale(.3) rotate(10deg)" }], { duration: 400 }),
    run(title, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 }),
    run(veil, [{ opacity: 1 }, { opacity: 0 }], { duration: 600, delay: 150 })
  ]);
}

/* ---------------------------------------------------------------------------------------------- */
/* Choque de lâminas                                                                                */
/* ---------------------------------------------------------------------------------------------- */

let swordId = 0;
function swordSVG() {
  const id = `bfuSw${++swordId}`;
  return `<svg class="bfu-sword" viewBox="0 0 60 400" xmlns="http://www.w3.org/2000/svg"><defs>`
    + `<linearGradient id="${id}b" x1="0" x2="1"><stop offset="0" stop-color="#cfd6e0"/><stop offset=".5" stop-color="#ffffff"/><stop offset=".51" stop-color="#a9b3c2"/><stop offset="1" stop-color="#7d8796"/></linearGradient>`
    + `<linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="#8a5a12"/><stop offset=".5" stop-color="#ffd27a"/><stop offset="1" stop-color="#8a5a12"/></linearGradient></defs>`
    + `<path d="M30 0 L40 34 L40 270 L30 286 L20 270 L20 34 Z" fill="url(#${id}b)" stroke="#5a6270" stroke-width="1.5"/>`
    + `<path d="M30 20 L30 270" stroke="#7d8796" stroke-width="1.2" opacity=".6"/>`
    + `<rect x="2" y="282" width="56" height="14" rx="6" fill="url(#${id}g)" stroke="#5a3a08" stroke-width="1.5"/>`
    + `<rect x="23" y="296" width="14" height="70" rx="5" fill="#4a2c17" stroke="#2a170a" stroke-width="1.5"/>`
    + `<path d="M23 306 L37 314 M23 322 L37 330 M23 338 L37 346 M23 354 L37 362" stroke="#2a170a" stroke-width="2"/>`
    + `<circle cx="30" cy="378" r="12" fill="url(#${id}g)" stroke="#5a3a08" stroke-width="1.5"/></svg>`;
}

async function laminas(box, c) {
  const veil = div("bfu-veil dark", "", `--accent:${c.accent}`);
  box.append(veil);
  run(veil, [{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
  const a = div("bfu-i-sword", swordSVG()), b = div("bfu-i-sword", swordSVG());
  const title = div("bfu-i-center", titleHTML(c, "Que comece a batalha!"));
  box.append(a, b, title);
  title.style.opacity = "0";
  await wait(200);
  await Promise.all([
    run(a, [{ transform: "translate(-50%, -50%) translate(-75vw, -55vh) rotate(-150deg)" }, { transform: "translate(-50%, -50%) rotate(-38deg)" }], { duration: 420, easing: "cubic-bezier(.55,0,.9,.45)" }),
    run(b, [{ transform: "translate(-50%, -50%) translate(75vw, -55vh) rotate(150deg)" }, { transform: "translate(-50%, -50%) rotate(38deg)" }], { duration: 420, easing: "cubic-bezier(.55,0,.9,.45)" })
  ]);
  flash(box, "#fff6d8", 0.95, 450);
  shake(box, 18, 450);
  sparks(box, window.innerWidth / 2, window.innerHeight / 2 - window.innerHeight * 0.06, "#ffe08a", 34);
  run(a, [{ transform: "translate(-50%, -50%) rotate(-38deg)" }, { transform: "translate(-50%, -50%) translate(-14px, 6px) rotate(-44deg)" }, { transform: "translate(-50%, -50%) rotate(-40deg)" }], { duration: 350 });
  run(b, [{ transform: "translate(-50%, -50%) rotate(38deg)" }, { transform: "translate(-50%, -50%) translate(14px, 6px) rotate(44deg)" }, { transform: "translate(-50%, -50%) rotate(40deg)" }], { duration: 350 });
  await wait(250);
  run(title, [{ opacity: 0, transform: "translate(-50%, 0) scale(2.4)" }, { opacity: 1, transform: "translate(-50%, 0) scale(1)" }], { duration: 300, easing: "cubic-bezier(.5,0,.75,0)" });
  await wait(1500);
  await Promise.all([
    run(a, [{ opacity: 1, transform: "translate(-50%, -50%) rotate(-40deg)" }, { opacity: 0, transform: "translate(-50%, -50%) translate(-30vw, 10vh) rotate(-70deg)" }], { duration: 500, easing: "ease-in" }),
    run(b, [{ opacity: 1, transform: "translate(-50%, -50%) rotate(40deg)" }, { opacity: 0, transform: "translate(-50%, -50%) translate(30vw, 10vh) rotate(70deg)" }], { duration: 500, easing: "ease-in" }),
    run(title, [{ opacity: 1 }, { opacity: 0 }], { duration: 400 }),
    run(veil, [{ opacity: 1 }, { opacity: 0 }], { duration: 650, delay: 150 })
  ]);
}

/* ---------------------------------------------------------------------------------------------- */
/* Portal de mana                                                                                   */
/* ---------------------------------------------------------------------------------------------- */

function circleSVG(color) {
  let ticks = "";
  for ( let i = 0; i < 48; i++ ) {
    const a = (i / 48) * Math.PI * 2, r1 = 92, r2 = i % 4 ? 96 : 100;
    ticks += `<path d="M${(100 + Math.cos(a) * r1).toFixed(1)} ${(100 + Math.sin(a) * r1).toFixed(1)} L${(100 + Math.cos(a) * r2).toFixed(1)} ${(100 + Math.sin(a) * r2).toFixed(1)}"/>`;
  }
  let runes = "";
  for ( let i = 0; i < 12; i++ ) {
    const a = (i / 12) * Math.PI * 2, x = 100 + Math.cos(a) * 80, y = 100 + Math.sin(a) * 80;
    runes += `<path d="M${(x - 4).toFixed(1)} ${(y - 5).toFixed(1)} L${(x + 4).toFixed(1)} ${y.toFixed(1)} L${(x - 3).toFixed(1)} ${(y + 5).toFixed(1)}"/>`;
  }
  const tri = off => {
    const p = [0, 1, 2].map(k => {
      const a = off + (k / 3) * Math.PI * 2 - Math.PI / 2;
      return `${(100 + Math.cos(a) * 66).toFixed(1)},${(100 + Math.sin(a) * 66).toFixed(1)}`;
    });
    return `<polygon points="${p.join(" ")}"/>`;
  };
  return `<svg class="bfu-portal-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="--c:${color}">`
    + `<g class="spin a" fill="none" stroke="${color}" stroke-width="1.5"><circle cx="100" cy="100" r="98"/><circle cx="100" cy="100" r="90"/>${ticks}</g>`
    + `<g class="spin b" fill="none" stroke="${color}" stroke-width="1.6"><circle cx="100" cy="100" r="72"/>${runes}</g>`
    + `<g class="spin c" fill="none" stroke="${color}" stroke-width="1.4">${tri(0)}${tri(Math.PI)}<circle cx="100" cy="100" r="34"/><circle cx="100" cy="100" r="8" fill="${color}"/></g></svg>`;
}

async function portal(box, c) {
  const veil = div("bfu-veil dark", "", `--accent:${c.accent}`);
  box.append(veil);
  run(veil, [{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
  const ring = div("bfu-portal", circleSVG(c.accent), `--c:${c.accent}`);
  const title = div("bfu-i-center low", titleHTML(c, "O véu da mana se abre"));
  box.append(ring, title);
  title.style.opacity = "0";
  await run(ring, [{ opacity: 0, transform: "translate(-50%, -50%) scale(.05) rotate(-90deg)" }, { opacity: 1, transform: "translate(-50%, -50%) scale(1) rotate(0deg)" }], { duration: 900, easing: "cubic-bezier(.2,.8,.2,1)" });
  run(title, [{ opacity: 0, transform: "translate(-50%, 16px)" }, { opacity: 1, transform: "translate(-50%, 0)" }], { duration: 350 });
  run(ring, [{ filter: "drop-shadow(0 0 6px var(--c)) brightness(1)" }, { filter: "drop-shadow(0 0 26px var(--c)) brightness(1.6)" }], { duration: 600, direction: "alternate", iterations: 3, fill: "none" });
  await wait(1500);
  run(title, [{ opacity: 1 }, { opacity: 0 }], { duration: 250 });
  flash(box, c.accent, 0.65, 700);
  await Promise.all([
    run(ring, [{ opacity: 1, transform: "translate(-50%, -50%) scale(1) rotate(0deg)" }, { opacity: 0, transform: "translate(-50%, -50%) scale(7) rotate(120deg)" }], { duration: 850, easing: "cubic-bezier(.6,0,.9,.6)" }),
    run(veil, [{ opacity: 1 }, { opacity: 0 }], { duration: 800, delay: 150 })
  ]);
}

/* ---------------------------------------------------------------------------------------------- */
/* Cortinas de teatro                                                                               */
/* ---------------------------------------------------------------------------------------------- */

async function cortinas(box, c) {
  const left = div("bfu-curtain left"), right = div("bfu-curtain right");
  const valance = div("bfu-valance");
  const plaque = div("bfu-plaque", `<b>${escapeHTML(c.biome)}</b><small>Esta noite: uma batalha!</small>`);
  box.append(left, right, valance, plaque);
  await Promise.all([left, right, valance, plaque].map(n => run(n, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 })));
  run(plaque, [{ transform: "translate(-50%, -50%) scale(.85)" }, { transform: "translate(-50%, -50%) scale(1)" }], { duration: 500, easing: "cubic-bezier(.2,1.4,.4,1)" });
  await wait(1300);
  await run(plaque, [{ opacity: 1, transform: "translate(-50%, -50%) scale(1)" }, { opacity: 0, transform: "translate(-50%, -60%) scale(.9)" }], { duration: 300 });
  await Promise.all([
    run(left, [{ transform: "translateX(0) scaleX(1)" }, { transform: "translateX(-62%) scaleX(.38)" }], { duration: 1200, easing: "cubic-bezier(.55,0,.25,1)" }),
    run(right, [{ transform: "translateX(0) scaleX(1)" }, { transform: "translateX(62%) scaleX(.38)" }], { duration: 1200, easing: "cubic-bezier(.55,0,.25,1)" }),
    run(valance, [{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }], { duration: 700, delay: 700, easing: "ease-in" })
  ]);
  await Promise.all([left, right].map(n => run(n, [{ opacity: 1 }, { opacity: 0 }], { duration: 350 })));
}

/* ---------------------------------------------------------------------------------------------- */
/* Relâmpago                                                                                        */
/* ---------------------------------------------------------------------------------------------- */

function boltSVG() {
  const w = window.innerWidth, h = window.innerHeight;
  let x = w * (0.35 + Math.random() * 0.3), y = -10;
  const pts = [[x, y]];
  while ( y < h * 0.82 ) {
    x += (Math.random() - 0.5) * w * 0.07;
    y += h * (0.04 + Math.random() * 0.05);
    pts.push([x, y]);
  }
  const main = pts.map(([px, py]) => `${px.toFixed(0)},${py.toFixed(0)}`).join(" ");
  const from = pts[Math.floor(pts.length * 0.45)];
  let bx = from[0], by = from[1];
  const br = [[bx, by]];
  for ( let i = 0; i < 5; i++ ) {
    bx += w * 0.03 * (Math.random() < 0.5 ? -1.4 : 1);
    by += h * 0.05;
    br.push([bx, by]);
  }
  const branch = br.map(([px, py]) => `${px.toFixed(0)},${py.toFixed(0)}`).join(" ");
  return `<svg class="bfu-bolt" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`
    + `<polyline points="${main}" fill="none" stroke="#bcd4ff" stroke-width="16" opacity=".25" stroke-linejoin="round"/>`
    + `<polyline points="${branch}" fill="none" stroke="#bcd4ff" stroke-width="8" opacity=".25"/>`
    + `<polyline points="${main}" fill="none" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"/>`
    + `<polyline points="${branch}" fill="none" stroke="#ffffff" stroke-width="2"/></svg>`;
}

async function relampago(box, c) {
  const veil = div("bfu-veil storm");
  box.append(veil);
  await run(veil, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
  await wait(350);
  const bolt = div("bfu-i-full", boltSVG());
  const title = div("bfu-i-center", titleHTML(c, "O céu anuncia a batalha"));
  box.append(bolt, title);
  flash(box, "#eef4ff", 0.95, 500);
  shake(box, 10, 350);
  run(bolt, [{ opacity: 1 }, { opacity: 0.2, offset: 0.3 }, { opacity: 0.9, offset: 0.4 }, { opacity: 0 }], { duration: 900 });
  run(title, [{ opacity: 0, filter: "brightness(3)" }, { opacity: 1, filter: "brightness(1)" }], { duration: 600 });
  await wait(900);
  const bolt2 = div("bfu-i-full", boltSVG());
  box.append(bolt2);
  flash(box, "#dfe9ff", 0.6, 400);
  run(bolt2, [{ opacity: 0.9 }, { opacity: 0 }], { duration: 500 });
  await wait(800);
  await Promise.all([
    run(title, [{ opacity: 1 }, { opacity: 0 }], { duration: 400 }),
    run(veil, [{ opacity: 1 }, { opacity: 0 }], { duration: 900, delay: 100 })
  ]);
}

/* ---------------------------------------------------------------------------------------------- */
/* Vidro estilhaçado                                                                                */
/* ---------------------------------------------------------------------------------------------- */

async function estilhacos(box, c) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const cx = vw / 2 + (Math.random() - 0.5) * vw * 0.1, cy = vh / 2 + (Math.random() - 0.5) * vh * 0.1;
  const face = `background:radial-gradient(ellipse at 50% 40%, ${c.back[0]}, #07060b 80%)`;
  const inner = `${titleHTML(c, "A realidade se parte")}`;
  const whole = div("bfu-shard whole", `<div class="bfu-i-center">${inner}</div>`, face);
  box.append(whole);
  await run(whole, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
  await wait(700);
  /* cracks */
  const slices = 11, rings = [0, 0.16, 0.38, 1.6];
  const R = Math.hypot(vw, vh);
  const angles = Array.from({ length: slices }, (_, i) => (i / slices) * Math.PI * 2 + (Math.random() - 0.5) * 0.35);
  const pt = (a, k) => [cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k];
  const jit = (p, k) => (k > 0 && k < 1 ? [p[0] + (Math.random() - 0.5) * 30, p[1] + (Math.random() - 0.5) * 30] : p);
  const grid = rings.map((k, r) => angles.map(a => jit(pt(a + (r % 2 ? 0.12 : 0), k), k)));
  let lines = "";
  for ( let i = 0; i < slices; i++ ) lines += `<polyline points="${grid.map(row => row[i].map(v => v.toFixed(0)).join(",")).join(" ")}"/>`;
  for ( let r = 1; r < rings.length - 1; r++ ) lines += `<polygon points="${grid[r].map(p => p.map(v => v.toFixed(0)).join(",")).join(" ")}"/>`;
  const cracks = div("bfu-i-full", `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="rgba(255,255,255,.85)" stroke-width="2">${lines}</g></svg>`);
  box.append(cracks);
  flash(box, "#ffffff", 0.5, 200);
  shake(box, 8, 250);
  await wait(320);
  /* shards fly */
  const shards = [];
  for ( let r = 0; r < rings.length - 1; r++ ) {
    for ( let i = 0; i < slices; i++ ) {
      const j = (i + 1) % slices;
      const poly = r === 0 ? [grid[0][i], grid[1][i], grid[1][j]] : [grid[r][i], grid[r + 1][i], grid[r + 1][j], grid[r][j]];
      const mx = poly.reduce((s, p) => s + p[0], 0) / poly.length, my = poly.reduce((s, p) => s + p[1], 0) / poly.length;
      const s = div("bfu-shard", `<div class="bfu-i-center">${inner}</div>`, `${face};clip-path:polygon(${poly.map(p => `${p[0].toFixed(0)}px ${p[1].toFixed(0)}px`).join(",")});transform-origin:${mx.toFixed(0)}px ${my.toFixed(0)}px`);
      shards.push({ s, dx: mx - cx, dy: my - cy, r });
    }
  }
  box.append(...shards.map(x => x.s));
  whole.remove();
  cracks.remove();
  await Promise.all(shards.map(({ s, dx, dy, r }) => {
    const d = Math.hypot(dx, dy) || 1, push = 0.35 + Math.random() * 0.5;
    return run(s, [
      { transform: "translate(0,0) rotate(0deg) scale(1)", opacity: 1 },
      { transform: `translate(${(dx / d) * vw * push}px, ${(dy / d) * vh * push + vh * 0.25}px) rotate(${(Math.random() - 0.5) * 160}deg) scale(.7)`, opacity: 0 }
    ], { duration: 900 + Math.random() * 300, delay: r * 60 + Math.random() * 80, easing: "cubic-bezier(.4,0,.9,.6)" });
  }));
}

export { INTROS };
