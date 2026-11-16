/**
 * Batalhas FU: the battle HUD of every client, shown while the viewed scene is a battle scene.
 *
 *   turn bar (top)   party portraits · round diamond (points to the side whose turn it is) · foe portraits
 *   plates           name, HP and MP under each token (field) or HP/MP badges on each card (table)
 *   side glow        a breathing light on the side whose turn it is
 *   banners          "Vez do grupo", "Vez dos inimigos", round, acting combatant, victory
 *   ambient          biome particles (+ mana motes)
 *   party panel      bottom panel with the party's HP/MP/IP (field layout, can be folded)
 *
 * The GM uses the bar to start the combat, start/end turns and go to the next round (system API).
 */
import { BIOMES, FRIENDLY, HOSTILE, MODULE_ID, MODULE_TITLE, escapeHTML } from "./constants.mjs";
import { battleFlags, setting } from "./store.mjs";
import { combatInfo, combatOfScene, endTurnOf, portraitOf, startTurnOf, statsOf, statusIcons } from "./fu-data.mjs";
import { canSeeHud, flagOf, layer, overlay, tokenRect, zoom } from "./overlay.mjs";
import { guard, reportError } from "./errors.mjs";
import { backends } from "./fx.mjs";
import { climateOf } from "./climate.mjs";
import { Weather } from "./weather.mjs";

/** Card display options of a battle (older battles: badges in the corners, everything on). */
function cardOptions(flags) {
  const i = flags?.cardInfo ?? {};
  const on = v => v !== false;
  return {
    mode: flags?.cardMode === "token" ? "token" : "gerada",
    pos: flags?.counters === "faixa" ? "faixa" : "cantos",
    info: { name: on(i.name), hp: on(i.hp), mp: on(i.mp), ip: on(i.ip), status: on(i.status) }
  };
}
const reducedMotion = () => Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

const PANEL_KEY = `${MODULE_ID}.painel`;
const pct = (v, m) => (m > 0 ? Math.max(0, Math.min(100, (v / m) * 100)) : 0);

export const HUD = {
  scene: null,
  flags: null,
  info: null,
  last: null,
  raf: 0,
  plates: new Map(),
  ambientKey: "",
  bannerChain: Promise.resolve(),
  barBound: false,

  /* ------------------------------------------------------------------------------------------ */
  /* Lifecycle                                                                                    */
  /* ------------------------------------------------------------------------------------------ */

  refresh() {
    try {
      const scene = canvas?.ready ? canvas.scene : null;
      const flags = battleFlags(scene);
      if ( !flags ) return this.teardown();
      if ( !canSeeHud() ) return this.weatherOnly(scene, flags);
      this.ambientOnly = false;
      const root = overlay();
      root.hidden = false;
      root.dataset.layout = flags.layout ?? "campo";
      root.style.setProperty("--bfu-s", String(Math.max(0.7, Math.min(1.4, Number(setting("hudEscala", 1)) || 1))));
      root.classList.toggle("no-plates", !setting("plaquinhas", true));
      this.scene = scene;
      this.flags = flags;
      this.info = combatInfo(combatOfScene(scene));
      if ( !this.last || this.last.id !== this.info?.id ) this.announce();
      this.renderBar();
      this.renderPlates();
      this.renderPanel();
      this.renderSide();
      this.ensureAmbient();
      this.startLoop();
    } catch ( err ) {
      reportError(err, "HUD");
    }
  },

  /** The animated HUD is hidden from this player, but the weather is part of the scene: keep it. */
  weatherOnly(scene, flags) {
    if ( !this.ambientOnly || this.scene?.id !== scene.id ) this.teardown();
    this.ambientOnly = true;
    this.scene = scene;
    this.flags = flags;
    overlay().hidden = false;
    this.ensureAmbient();
  },

  teardown() {
    this.ambientOnly = false;
    Weather.stop();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const root = document.getElementById("bfu-overlay");
    if ( root ) {
      for ( const name of ["side", "ambient", "plates", "fx", "ui"] ) root.querySelector(`.bfu-${name}`)?.replaceChildren();
      root.hidden = true;
    }
    this.plates.clear();
    this.ambientKey = "";
    this.scene = null;
    this.flags = null;
    this.info = null;
    this.barBound = false;
  },

  startLoop() {
    if ( this.raf ) return;
    let last = "";
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      if ( !canvas?.ready || !this.scene ) return;
      const st = canvas.stage?.worldTransform;
      const sig = st ? `${st.a.toFixed(4)}|${st.tx.toFixed(1)}|${st.ty.toFixed(1)}` : "";
      this.positionPlates(sig !== last);
      last = sig;
    };
    this.raf = requestAnimationFrame(tick);
  },

  /* ------------------------------------------------------------------------------------------ */
  /* Turn bar                                                                                     */
  /* ------------------------------------------------------------------------------------------ */

  renderBar() {
    const ui = layer("ui");
    let bar = ui.querySelector(".bfu-bar");
    if ( !bar ) {
      bar = document.createElement("div");
      bar.className = "bfu-bar";
      ui.append(bar);
      bar.addEventListener("click", guard(ev => this.onBarClick(ev), "barra de turnos"));
    }
    const info = this.info;
    const gm = game.user.isGM;
    if ( !info ) {
      bar.dataset.faction = "";
      bar.innerHTML = `<div class="bfu-core"><div class="bfu-diamond"><span class="bfu-round-label">Batalha</span><span class="bfu-round">—</span></div>`
        + `<div class="bfu-turnlabel">${gm ? "Sem combate nesta cena" : "Preparando…"}</div></div>`;
      return;
    }
    const visible = info.combatants.filter(c => gm || !c.hidden);
    const team = faction => visible.filter(c => c.faction === faction).map(c => {
      const st = statsOf(c.actor, c.token);
      const cls = ["bfu-pt", c.id === info.actingId ? "acting" : "", c.defeated ? "defeated" : "", !c.defeated && c.left <= 0 && info.started ? "done" : "",
        st.crisis ? "crisis" : "", c.hidden ? "hidden" : ""].filter(Boolean).join(" ");
      const pips = info.started && c.total > 1 || (info.fu && info.started) ? `<span class="bfu-pips">${"<i></i>".repeat(Math.max(0, c.left))}${"<i class=\"off\"></i>".repeat(Math.max(0, c.total - c.left))}</span>` : "";
      return `<button type="button" class="${cls}" data-cid="${c.id}" title="${escapeHTML(c.name)}"${gm ? "" : " tabindex=\"-1\""}>`
        + `<span class="bfu-pt-frame"><img src="${escapeHTML(c.img)}" alt=""></span>${pips}</button>`;
    }).join("");
    const faction = info.faction;
    const label = !info.started ? (gm ? "Combate pronto" : "A batalha vai começar")
      : info.actingId ? `Vez de ${escapeHTML(info.combatants.find(c => c.id === info.actingId)?.name ?? "")}`
        : faction === FRIENDLY ? "Vez do grupo" : faction === HOSTILE ? "Vez dos inimigos" : "";
    let buttons = "";
    if ( gm ) {
      if ( !info.started ) buttons = `<button type="button" class="bfu-btn" data-bfu="start"><i class="fa-solid fa-play"></i> Começar</button>`;
      else if ( info.actingId ) buttons = `<button type="button" class="bfu-btn" data-bfu="end"><i class="fa-solid fa-flag-checkered"></i> Encerrar turno</button>`;
      else if ( info.outOfTurns ) buttons = `<button type="button" class="bfu-btn" data-bfu="round"><i class="fa-solid fa-forward"></i> Próxima rodada</button>`;
    }
    const layout = this.flags?.layout ?? "campo";
    bar.dataset.faction = info.started ? faction ?? "" : "";
    bar.dataset.layout = layout;
    /* field: party on the right, foes on the left (as on the battlefield); table: foes on the left too */
    bar.innerHTML = `<div class="bfu-team foes">${team(HOSTILE)}</div>`
      + `<div class="bfu-core"><div class="bfu-diamond"><span class="bfu-round-label">Rodada</span><span class="bfu-round">${info.started ? info.round : 0}</span><i class="bfu-arrow"></i></div>`
      + `<div class="bfu-turnlabel">${label}</div>${buttons ? `<div class="bfu-btns">${buttons}</div>` : ""}</div>`
      + `<div class="bfu-team party">${team(FRIENDLY)}</div>`;
    bar.classList.toggle("is-gm", gm);
    const count = visible.length;
    bar.style.setProperty("--pt", `${Math.max(26, Math.min(46, 46 - Math.max(0, count - 6) * 3))}px`);
  },

  async onBarClick(ev) {
    if ( !game.user.isGM ) return;
    const combat = combatOfScene(this.scene);
    if ( !combat ) return;
    const btn = ev.target.closest("[data-bfu]");
    if ( btn ) {
      if ( btn.dataset.bfu === "start" ) return combat.startCombat();
      if ( btn.dataset.bfu === "end" && this.info?.actingId ) return endTurnOf(combat, this.info.actingId);
      if ( btn.dataset.bfu === "round" ) return combat.nextRound();
      return;
    }
    const pt = ev.target.closest(".bfu-pt");
    if ( !pt ) return;
    const id = pt.dataset.cid;
    const info = this.info;
    if ( !info?.started ) return ui.notifications.info(`${MODULE_TITLE}: comece o combate primeiro (botão Começar).`);
    if ( info.actingId === id ) return endTurnOf(combat, id);
    if ( info.actingId ) return ui.notifications.warn(`${MODULE_TITLE}: encerre o turno de quem está agindo primeiro.`);
    const c = info.combatants.find(x => x.id === id);
    if ( !c || c.left <= 0 ) return ui.notifications.warn(`${MODULE_TITLE}: ${c?.name ?? "esse combatente"} não tem mais turnos nesta rodada.`);
    if ( info.faction && c.faction !== info.faction ) ui.notifications.info(`${MODULE_TITLE}: é a vez do outro lado, mas o turno foi iniciado mesmo assim.`);
    return startTurnOf(combat, id);
  },

  /* ------------------------------------------------------------------------------------------ */
  /* Plates under the tokens / badges on the cards                                                */
  /* ------------------------------------------------------------------------------------------ */

  battleTokens() {
    const scene = this.scene;
    if ( !scene || !canvas?.tokens ) return [];
    const ids = new Set((this.info?.combatants ?? []).map(c => c.tokenId).filter(Boolean));
    return canvas.tokens.placeables.filter(t => ids.has(t.id) || flagOf(t.document, "side"));
  },

  renderPlates() {
    const box = layer("plates");
    if ( !setting("plaquinhas", true) ) {
      for ( const p of this.plates.values() ) p.remove();
      this.plates.clear();
      return;
    }
    const layout = this.flags?.layout ?? "campo";
    const gm = game.user.isGM;
    const showFoeHP = gm || setting("pvInimigos", false);
    const seen = new Set();
    const tight = layout === "mesa" ? this.tightCards() : new Set();
    for ( const t of this.battleTokens() ) {
      const doc = t.document;
      if ( doc.hidden && !gm ) continue;
      seen.add(t.id);
      const actor = t.actor;
      const st = statsOf(actor, doc);
      const comb = this.info?.combatants.find(c => c.tokenId === t.id);
      const faction = comb?.faction ?? (flagOf(doc, "side") === "party" ? FRIENDLY : HOSTILE);
      const party = faction === FRIENDLY;
      const showHP = party || showFoeHP;
      const icons = statusIcons(actor).slice(0, 6).map(s => `<img src="${escapeHTML(s.img)}" title="${escapeHTML(s.name)}" alt="">`).join("");
      const pips = comb && this.info?.started ? `<span class="bfu-pips">${"<i></i>".repeat(Math.max(0, comb.left))}${"<i class=\"off\"></i>".repeat(Math.max(0, comb.total - comb.left))}</span>` : "";
      let html;
      if ( layout === "mesa" ) html = this.cardPlate({ doc, actor, st, party, showHP, icons, pips });
      else {
        const hpBar = st.hp && showHP ? `<div class="bfu-meter thin hp" title="PV ${st.hp.value}/${st.hp.max}"><i style="width:${pct(st.hp.value, st.hp.max)}%"></i></div>` : "";
        const mpBar = party && st.mp ? `<div class="bfu-meter thin mp" title="PM ${st.mp.value}/${st.mp.max}"><i style="width:${pct(st.mp.value, st.mp.max)}%"></i></div>` : "";
        html = `<div class="bfu-name">${escapeHTML(doc.name ?? actor?.name ?? "")}${st.crisis ? ` <i class="fa-solid fa-heart-crack" title="Em crise"></i>` : ""}</div>${hpBar}${mpBar}`
          + `<div class="bfu-row">${icons ? `<div class="bfu-icons">${icons}</div>` : ""}${pips}</div>`;
      }
      let plate = this.plates.get(t.id);
      if ( !plate?.isConnected ) {
        plate = document.createElement("div");
        box.append(plate);
        this.plates.set(t.id, plate);
      }
      const co = layout === "mesa" ? cardOptions(this.flags) : null;
      plate.className = `bfu-plate ${layout === "mesa" ? `card ${co.pos} ${co.mode}${tight.has(t.id) ? " tight" : ""}` : "field"} ${party ? "party" : "foes"}${st.crisis ? " crisis" : ""}${st.ko ? " ko" : ""}${comb && comb.id === this.info?.actingId ? " acting" : ""}${doc.hidden ? " hidden" : ""}`;
      if ( plate.dataset.html !== html ) {
        plate.innerHTML = html;
        plate.dataset.html = html;
      }
    }
    for ( const [id, plate] of this.plates ) {
      if ( seen.has(id) ) continue;
      plate.remove();
      this.plates.delete(id);
    }
    this.positionPlates(true);
  },

  /**
   * Cards with another card right under them (columns, two rows): their strip and name go inside the
   * card instead of below it, so they do not cover the neighbour.
   */
  tightCards() {
    const gs = canvas?.grid?.size ?? 100;
    const boxes = this.battleTokens().map(t => {
      const d = t.document;
      return { id: t.id, x: Number(d.x), y: Number(d.y), w: Number(d.width) * gs, h: Number(d.height) * gs };
    });
    const out = new Set();
    for ( const a of boxes ) {
      for ( const b of boxes ) {
        if ( a === b ) continue;
        const overlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const gap = b.y - (a.y + a.h);
        if ( overlap > a.w * 0.4 && gap > -a.h * 0.3 && gap < a.w * 0.45 ) {
          out.add(a.id);
          break;
        }
      }
    }
    return out;
  },

  /**
   * Counters on a table card: HP, MP and IP (Inventory Points, characters only), the name, statuses and
   * the turns left. "cantos": round badges on the corners (HP bottom-left, MP bottom-right, IP top-right);
   * "faixa": a strip under the card with the name and HP/MP/IP chips. A generated card already shows the
   * name, so in the corners the name is drawn only when the token is shown whole.
   */
  cardPlate({ doc, actor, st, party, showHP, icons, pips }) {
    const { mode, pos, info } = cardOptions(this.flags);
    const name = escapeHTML(doc.name ?? actor?.name ?? "");
    const hpText = st.hp ? (showHP ? st.hp.value : st.crisis ? "!" : "?") : "";
    const hpFull = st.hp ? (showHP ? `${st.hp.value}<small>/${st.hp.max}</small>` : st.crisis ? "crise" : "?") : "";
    const hp = info.hp && st.hp;
    const mp = info.mp && party && st.mp;
    const ip = info.ip && st.ip;
    const statusRow = info.status && icons ? `<div class="bfu-icons">${icons}</div>` : "";
    if ( pos === "faixa" ) {
      const chips = (hp ? `<span class="bfu-chip hp${st.crisis ? " crisis" : ""}" title="Pontos de Vida"><i class="fa-solid fa-heart"></i>${hpFull}</span>` : "")
        + (mp ? `<span class="bfu-chip mp" title="Pontos de Mente"><i class="fa-solid fa-brain"></i>${st.mp.value}<small>/${st.mp.max}</small></span>` : "")
        + (ip ? `<span class="bfu-chip ip" title="Pontos de Inventário"><i class="fa-solid fa-flask"></i>${st.ip.value}<small>/${st.ip.max}</small></span>` : "");
      return `${statusRow}<div class="bfu-strip">${info.name ? `<div class="bfu-cname">${name}${st.crisis ? ` <i class="fa-solid fa-heart-crack"></i>` : ""}</div>` : ""}`
        + `${chips ? `<div class="bfu-chips">${chips}</div>` : ""}${pips}</div>`;
    }
    const showName = info.name && mode === "token";
    return (hp ? `<span class="bfu-badge hp${st.crisis ? " crisis" : ""}" title="PV">${hpText}</span>` : "")
      + (mp ? `<span class="bfu-badge mp" title="PM">${st.mp.value}</span>` : "")
      + (ip ? `<span class="bfu-badge ip" title="Pontos de Inventário (PI)">${st.ip.value}</span>` : "")
      + (showName ? `<div class="bfu-cname ribbon">${name}</div>` : "")
      + statusRow + (pips ? `<div class="bfu-cpips${showName ? " low" : ""}">${pips}</div>` : "");
  },

  positionPlates() {
    const layout = this.flags?.layout ?? "campo";
    const s = Math.max(0.7, Math.min(1.4, Number(setting("hudEscala", 1)) || 1));
    const z = Math.max(0.55, Math.min(1.35, zoom())) * s;
    this.positionSpot(layout);
    for ( const [id, plate] of this.plates ) {
      const r = tokenRect(id);
      if ( !r ) {
        plate.style.display = "none";
        continue;
      }
      plate.style.display = "";
      if ( layout === "mesa" ) {
        plate.style.left = `${r.x}px`;
        plate.style.top = `${r.y}px`;
        plate.style.width = `${r.w}px`;
        plate.style.height = `${r.h}px`;
        plate.style.fontSize = `${Math.max(10, r.w * 0.11)}px`;
        const rot = Number(canvas.tokens?.get(id)?.document?.rotation) || 0;
        plate.style.transform = rot ? `rotate(${rot}deg)` : "";
      }
      else {
        /* beside the token, on the outer side (party to the right, foes to the left) */
        const party = plate.classList.contains("party");
        plate.style.left = `${party ? r.x + r.w + 6 : r.x - 6}px`;
        plate.style.top = `${r.y + r.h * 0.55}px`;
        plate.style.transform = `translate(${party ? "0" : "-100%"}, -50%) scale(${z.toFixed(3)})`;
        plate.style.transformOrigin = party ? "0 50%" : "100% 50%";
      }
    }
  },

  /** Without Sequencer, a glowing ring at the feet of the acting token (the canvas ring needs Sequencer). */
  positionSpot(layout) {
    const box = layer("plates");
    let spot = box.querySelector(".bfu-spot");
    const acting = this.info?.actingId ? this.info.combatants.find(c => c.id === this.info.actingId) : null;
    const r = acting?.tokenId && !backends().sequencer ? tokenRect(acting.tokenId) : null;
    if ( !r || (acting.hidden && !game.user.isGM) ) {
      spot?.remove();
      return;
    }
    if ( !spot ) {
      spot = document.createElement("div");
      spot.className = "bfu-spot";
      box.prepend(spot);
    }
    spot.dataset.faction = acting.faction;
    const w = layout === "mesa" ? r.w * 1.25 : r.w * 1.15, h = layout === "mesa" ? r.h * 1.12 : r.w * 0.34;
    spot.classList.toggle("card", layout === "mesa");
    spot.style.left = `${r.cx - w / 2}px`;
    spot.style.top = `${layout === "mesa" ? r.cy - h / 2 : r.y + r.h * 0.9 - h / 2}px`;
    spot.style.width = `${w}px`;
    spot.style.height = `${h}px`;
  },

  /* ------------------------------------------------------------------------------------------ */
  /* Party panel (field)                                                                          */
  /* ------------------------------------------------------------------------------------------ */

  panelOpen() {
    try {
      return localStorage.getItem(PANEL_KEY) !== "0";
    } catch ( err ) {
      return true;
    }
  },

  renderPanel() {
    const ui = layer("ui");
    let panel = ui.querySelector(".bfu-panel");
    if ( (this.flags?.layout ?? "campo") !== "campo" ) {
      panel?.remove();
      return;
    }
    if ( !panel ) {
      panel = document.createElement("div");
      panel.className = "bfu-panel";
      ui.append(panel);
      panel.addEventListener("click", ev => {
        if ( !ev.target.closest(".bfu-panel-toggle") ) return;
        try {
          localStorage.setItem(PANEL_KEY, this.panelOpen() ? "0" : "1");
        } catch ( err ) { /* ignore */ }
        this.renderPanel();
      });
    }
    const open = this.panelOpen();
    panel.classList.toggle("closed", !open);
    const members = this.battleTokens().filter(t => {
      const comb = this.info?.combatants.find(c => c.tokenId === t.id);
      return (comb?.faction ?? (flagOf(t.document, "side") === "party" ? FRIENDLY : HOSTILE)) === FRIENDLY;
    });
    const rows = members.map(t => {
      const st = statsOf(t.actor, t.document);
      const comb = this.info?.combatants.find(c => c.tokenId === t.id);
      const pips = comb && this.info?.started ? `<span class="bfu-pips">${"<i></i>".repeat(Math.max(0, comb.left))}</span>` : "";
      return `<div class="bfu-member${comb?.id === this.info?.actingId ? " acting" : ""}${st.crisis ? " crisis" : ""}${st.ko ? " ko" : ""}">`
        + `<img src="${escapeHTML(portraitOf(t.actor, t.document))}" alt=""><div class="bfu-member-body">`
        + `<div class="bfu-member-head"><b>${escapeHTML(t.document.name)}</b>${st.ip ? `<span class="bfu-ip" title="Pontos de Inventário">PI ${st.ip.value}/${st.ip.max}</span>` : ""}</div>`
        + (st.hp ? `<div class="bfu-meter hp"><span>PV</span><i style="width:${pct(st.hp.value, st.hp.max)}%"></i><b>${st.hp.value}<small>/${st.hp.max}</small></b></div>` : "")
        + (st.mp ? `<div class="bfu-meter mp"><span>PM</span><i style="width:${pct(st.mp.value, st.mp.max)}%"></i><b>${st.mp.value}<small>/${st.mp.max}</small></b></div>` : "")
        + `</div>${pips}</div>`;
    }).join("");
    panel.innerHTML = `<button type="button" class="bfu-panel-toggle" title="${open ? "Recolher" : "Mostrar"} o painel do grupo"><i class="fa-solid fa-chevron-${open ? "down" : "up"}"></i></button>`
      + `<div class="bfu-panel-body">${rows}</div>`;
  },

  /* ------------------------------------------------------------------------------------------ */
  /* Side glow                                                                                    */
  /* ------------------------------------------------------------------------------------------ */

  renderSide() {
    const el = layer("side");
    const info = this.info;
    const layout = this.flags?.layout ?? "campo";
    let side = "";
    if ( info?.started && info.faction ) {
      if ( layout === "mesa" && this.flags?.arrangement !== "colunas" ) side = info.faction === FRIENDLY ? "bottom" : "top";
      else side = info.faction === FRIENDLY ? "right" : "left";
    }
    el.dataset.side = side;
    el.dataset.faction = info?.faction ?? "";
  },

  /* ------------------------------------------------------------------------------------------ */
  /* Ambient particles                                                                            */
  /* ------------------------------------------------------------------------------------------ */

  /** Weather and mana of the scene (flag "clima"), redrawn only when something changed. */
  ensureAmbient() {
    if ( !this.scene ) return;
    const climate = climateOf(this.scene, this.flags);
    const motion = Boolean(setting("ambiente", true)) && !reducedMotion();
    const key = `${JSON.stringify(climate)}|${motion}`;
    if ( key === this.ambientKey ) return;
    this.ambientKey = key;
    Weather.apply(layer("ambient"), climate, { motion });
  },

  /* ------------------------------------------------------------------------------------------ */
  /* Banners                                                                                      */
  /* ------------------------------------------------------------------------------------------ */

  /**
   * @param {"party"|"foes"|"round"|"acting"|"victory"|"start"} kind
   */
  banner(kind, title, sub = "", img = "") {
    if ( !canSeeHud() || !document.getElementById("bfu-overlay") ) return;
    if ( kind === "acting" ) return this.pill(title, sub, img);
    this.bannerChain = this.bannerChain.then(() => new Promise(resolve => {
      const ui = layer("ui");
      const el = document.createElement("div");
      el.className = `bfu-banner ${kind}`;
      el.innerHTML = `<div class="bfu-banner-band">${img ? `<img src="${escapeHTML(img)}" alt="">` : ""}<div class="bfu-banner-text"><b>${escapeHTML(title)}</b>${sub ? `<small>${escapeHTML(sub)}</small>` : ""}</div></div>`;
      ui.append(el);
      const flash = document.createElement("div");
      flash.className = `bfu-flash ${kind}`;
      ui.append(flash);
      const fromRight = kind === "party" || (kind === "acting" && this.flags?.layout !== "mesa");
      const dx = fromRight ? 110 : -110;
      const short = kind === "acting";
      const total = short ? 1300 : 1900;
      el.animate([
        { transform: `translate(${dx}vw, -50%) skewX(-12deg)`, opacity: 1 },
        { offset: 0.16, transform: "translate(0, -50%) skewX(-12deg)", opacity: 1 },
        { offset: 0.78, transform: `translate(${-dx * 0.04}vw, -50%) skewX(-12deg)`, opacity: 1 },
        { transform: `translate(${-dx}vw, -50%) skewX(-12deg)`, opacity: 1 }
      ], { duration: total, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" }).finished.finally(() => el.remove());
      flash.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], { duration: short ? 700 : 1100, easing: "ease-out", fill: "both" })
        .finished.finally(() => flash.remove());
      setTimeout(resolve, short ? 650 : 1000);
    })).catch(() => null);
  },

  /** Small notice under the turn bar for the combatant who starts acting. */
  pill(title, sub, img) {
    const ui = layer("ui");
    ui.querySelector(".bfu-pill")?.remove();
    const el = document.createElement("div");
    el.className = "bfu-pill";
    el.innerHTML = `${img ? `<img src="${escapeHTML(img)}" alt="">` : ""}<b>${escapeHTML(title)}</b>${sub ? `<small>${escapeHTML(sub)}</small>` : ""}`;
    ui.append(el);
    el.animate([
      { opacity: 0, transform: "translate(-50%, -12px) scale(var(--bfu-s, 1))" },
      { offset: 0.12, opacity: 1, transform: "translate(-50%, 0) scale(var(--bfu-s, 1))" },
      { offset: 0.85, opacity: 1, transform: "translate(-50%, 0) scale(var(--bfu-s, 1))" },
      { opacity: 0, transform: "translate(-50%, -8px) scale(var(--bfu-s, 1))" }
    ], { duration: 2600, easing: "ease-out", fill: "both" }).finished.finally(() => el.remove());
  },

  /** Compare the combat with the last snapshot and announce what changed (every client). */
  announce() {
    const info = this.info;
    if ( !info ) {
      this.last = null;
      return;
    }
    const last = this.last?.id === info.id ? this.last : null;
    this.last = { id: info.id, started: info.started, round: info.round, faction: info.faction, actingId: info.actingId, won: false };
    if ( !last ) return;
    const foes = info.combatants.filter(c => c.faction === HOSTILE);
    const won = info.started && foes.length > 0 && foes.every(c => c.defeated);
    this.last.won = won;
    if ( won && !last.won ) {
      this.banner("victory", "Vitória!", "Todos os inimigos foram derrotados");
      return;
    }
    if ( !info.started ) return;
    if ( !last.started ) this.banner("start", "Que comece a batalha!", BIOMES[this.flags?.biome]?.label ?? "");
    else if ( info.round > last.round ) this.banner("round", `Rodada ${info.round}`);
    if ( info.faction && info.faction !== last.faction && !info.actingId ) {
      this.banner(info.faction === FRIENDLY ? "party" : "foes", info.faction === FRIENDLY ? "Vez do grupo" : "Vez dos inimigos");
    }
    if ( info.actingId && info.actingId !== last.actingId ) {
      const c = info.combatants.find(x => x.id === info.actingId);
      if ( c && (!c.hidden || game.user.isGM) ) this.banner("acting", c.name, c.faction === FRIENDLY ? "está agindo" : "vai agir", c.img);
    }
  },

  /**
   * A combat or its combatants changed. The system writes several updates in a row for one turn change
   * (turns taken, acting combatant, side, turn number), so the HUD waits for them to settle and then
   * draws and announces only the final state.
   */
  onCombat(combat) {
    if ( !this.scene || this.ambientOnly || (combat && combat.scene && combat.scene.id !== this.scene.id) ) return;
    clearTimeout(this.combatTimer);
    this.combatTimer = setTimeout(() => {
      try {
        this.info = combatInfo(combatOfScene(this.scene));
        this.announce();
        this.renderBar();
        this.renderPlates();
        this.renderPanel();
        this.renderSide();
      } catch ( err ) {
        reportError(err, "HUD");
      }
    }, 140);
  },

  /** An actor or token changed (HP, MP, statuses...). */
  onStats() {
    if ( !this.scene || this.ambientOnly ) return;
    clearTimeout(this.statsTimer);
    this.statsTimer = setTimeout(() => {
      this.info = combatInfo(combatOfScene(this.scene));
      this.renderBar();
      this.renderPlates();
      this.renderPanel();
    }, 60);
  }
};
