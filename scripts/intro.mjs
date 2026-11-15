/**
 * Batalhas FU: the opening of a battle, on every client (DOM, above the canvas).
 *
 *  1. a veil covers the battlefield;
 *  2. a deck of face-down cards is shuffled twice (riffle) in the middle of the screen;
 *  3. one card per combatant is dealt, face down, onto that combatant's token;
 *  4. the cards flip, one after the other, showing the portraits;
 *  5. the veil and the cards fade into the real tokens underneath.
 *
 * Started by the scene flag `intro` (server time): every client that shows the battle scene within 30 s
 * plays it once, so players who load the scene a bit later still see it.
 */
import { BIOMES, FRIENDLY, MODULE_ID, escapeHTML, wait } from "./constants.mjs";
import { battleFlags } from "./store.mjs";
import { factionOfToken, portraitOf } from "./fu-data.mjs";
import { canSeeHud, flagOf, layer, overlay, tokenRect } from "./overlay.mjs";

const BACKS = {
  planicie: ["#2f5a2c", "#d9c27a"], floresta: ["#1e4a2e", "#c9d98a"], deserto: ["#7a3f1c", "#f2cf7a"],
  neve: ["#2c4a73", "#e6f2ff"], vulcao: ["#4a1210", "#ff9a4a"], litoral: ["#15506a", "#f2deaa"],
  caverna: ["#26253a", "#a9b4ff"], pantano: ["#33401f", "#c9c27a"], ruinas: ["#3f3352", "#e0c88a"]
};

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
  playIntro(scene).catch(err => console.warn(`${MODULE_ID} | intro`, err));
}

function cardBack(colors) {
  return `<div class="bfu-cb" style="--b1:${colors[0]};--b2:${colors[1]}"><i class="bfu-cb-diamond"></i><i class="bfu-cb-star"></i></div>`;
}

export async function playIntro(scene) {
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
    const colors = BACKS[flags.biome] ?? BACKS.planicie;
    const vw = window.innerWidth, vh = window.innerHeight;
    const ch = Math.min(vh * 0.26, 240), cw = ch * 0.68;
    const cx = vw / 2, cy = vh / 2;

    const veil = document.createElement("div");
    veil.className = "bfu-veil";
    veil.innerHTML = `<div class="bfu-veil-title"><b>${escapeHTML(BIOMES[flags.biome]?.label ?? "Batalha")}</b><small>Embaralhando o destino…</small></div>`;
    box.append(veil);
    veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, fill: "both" });

    const n = Math.max(tokens.length, 7);
    const cards = [];
    for ( let i = 0; i < n; i++ ) {
      const t = tokens[i] ?? null;
      const el = document.createElement("div");
      el.className = "bfu-icard";
      el.style.width = `${cw}px`;
      el.style.height = `${ch}px`;
      el.style.left = `${cx - cw / 2}px`;
      el.style.top = `${cy - ch / 2}px`;
      el.style.zIndex = String(10 + i);
      const face = t ? (() => {
        const party = factionOfToken(t.document) === FRIENDLY;
        return `<div class="bfu-cf ${party ? "party" : "foes"}"><img src="${escapeHTML(portraitOf(t.actor, t.document))}" alt=""><span>${escapeHTML(t.document.name)}</span></div>`;
      })() : "";
      el.innerHTML = `<div class="bfu-icard-inner">${cardBack(colors)}${face}</div>`;
      box.append(el);
      cards.push({ el, inner: el.firstElementChild, token: t, i });
    }

    /* 2. two riffle shuffles */
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

    /* 3. deal the cards onto the tokens, face down (the title leaves first) */
    veil.querySelector(".bfu-veil-title")?.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(-20px)" }], { duration: 300, fill: "both" });
    const dealt = cards.filter(c => c.token);
    const extra = cards.filter(c => !c.token);
    for ( const c of extra ) {
      c.el.animate([{ opacity: 1 }, { opacity: 0, transform: `translate(0, ${-vh * 0.1}px) scale(.8)` }], { duration: 300, fill: "both" });
    }
    const deals = dealt.map((c, k) => {
      const r = tokenRect(c.token);
      if ( !r ) return Promise.resolve();
      const h = Math.max(r.h, r.w * 1.3), w = h * 0.68;
      c.target = { x: r.cx - w / 2, y: r.cy - h / 2, w, h };
      const dx = c.target.x - (cx - cw / 2), dy = c.target.y - (cy - ch / 2);
      const sx = w / cw, sy = h / ch;
      c.el.style.transformOrigin = "0 0";
      return c.el.animate([
        { transform: `translate(0,0) scale(1) rotate(0deg)` },
        { offset: 0.6, transform: `translate(${dx * 0.7}px, ${dy * 0.7 - 40}px) scale(${(1 + sx) / 2}, ${(1 + sy) / 2}) rotate(${k % 2 ? 8 : -8}deg)` },
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotate(0deg)` }
      ], { duration: 520, delay: k * 110, easing: "cubic-bezier(.3,.7,.2,1)", fill: "both" }).finished.catch(() => null);
    });
    await Promise.all(deals);
    await wait(150);

    /* 4. flip, one after the other */
    const flips = dealt.map((c, k) => c.inner.animate([
      { transform: "rotateY(0deg)" },
      { offset: 0.5, transform: "rotateY(90deg) scale(1.08)" },
      { transform: "rotateY(180deg) scale(1)" }
    ], { duration: 560, delay: k * 120, easing: "ease-in-out", fill: "both" }).finished.catch(() => null));
    await Promise.all(flips);
    await wait(500);

    /* 5. dissolve into the battlefield */
    veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, fill: "both" });
    await Promise.all(dealt.map((c, k) => c.el.animate([
      { opacity: 1, filter: "brightness(1)" },
      { offset: 0.35, opacity: 1, filter: "brightness(1.8)" },
      { opacity: 0, filter: "brightness(2.2)" }
    ], { duration: 650, delay: k * 40, fill: "both" }).finished.catch(() => null)));
  } finally {
    box.replaceChildren();
    playing = false;
  }
}
