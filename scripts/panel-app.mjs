/**
 * Batalhas FU: the GM panel (ApplicationV2 without templates, shell built once).
 *
 *   Nova batalha   layout, biome, time of day / table, mana, variation, token size, party, foes, options
 *   Batalha atual  replay the opening, manual banners, reinforcements, end the battle
 *   Fundos         custom background image per layout and biome (or the generated one)
 *   Efeitos        try every animation on the selected/targeted tokens, see which modules are active
 */
import {
  BIOMES, ELEMENTS, LAYOUTS, MANA_ELEMENTS, MODULE_ID, MODULE_TITLE, TABLES, TIMES, escapeHTML, isGM
} from "./constants.mjs";
import {
  customBackground, getBattle, isBattleScene, loadLastSetup, normalizeSetup, saveLastSetup, setCustomBackground, setting
} from "./store.mjs";
import { backgroundSVG } from "./backgrounds.mjs";
import { tableCardSize, tableSlots } from "./layout.mjs";
import { addToBattle, endBattle, replayIntro, startBattle } from "./battle.mjs";
import { backends, playEvent } from "./fx.mjs";
import { browse } from "./files.mjs";
import { HUD } from "./hud.mjs";
import { SOCKET } from "./constants.mjs";
import { guard, reportError } from "./errors.mjs";
import { favorites, libraryFolder, loadLibrary, toggleFavorite } from "./library.mjs";
import { describe, getLog, logEvent, onLog } from "./log.mjs";
import { damageHookActive } from "./fu-bridge.mjs";
import { TurnControlApp } from "./turn-app.mjs";

const { ApplicationV2 } = foundry.applications.api;
const APP_ID = `${MODULE_ID}-painel`;
const DEFAULT_IMG = "icons/svg/mystery-man.svg";

function thumb(setup, w = 300) {
  const size = tableCardSize(4, 3);
  const slots = setup.layout === "mesa" ? { party: tableSlots(4, "party", size), foes: tableSlots(3, "foes", size) } : null;
  const svg = backgroundSVG({ ...setup, slots }, w / 2400);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function dragData(event) {
  try {
    const TE = foundry.applications?.ux?.TextEditor?.implementation;
    if ( TE?.getDragEventData ) return TE.getDragEventData(event);
  } catch ( err ) { /* fall back */ }
  try {
    return JSON.parse(event.dataTransfer?.getData("text/plain") || "null");
  } catch ( err ) {
    return null;
  }
}

export class BattlePanel extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: APP_ID,
    classes: ["batalhas-fu", "bfu-app"],
    window: { title: MODULE_TITLE, icon: "fa-solid fa-swords", resizable: true },
    position: { width: 1000, height: 760 }
  };

  static get instance() {
    return foundry.applications.instances.get(APP_ID) ?? null;
  }

  static open(tab = null) {
    if ( !isGM() ) {
      ui.notifications.warn(`${MODULE_TITLE}: só o mestre usa o painel de batalhas.`);
      return null;
    }
    let app = BattlePanel.instance;
    if ( !app ) {
      const width = Math.min(1040, window.innerWidth - 60), height = Math.min(800, window.innerHeight - 40);
      app = new BattlePanel({ position: { width, height, left: (window.innerWidth - width) / 2, top: Math.max(10, (window.innerHeight - height) / 2) } });
      app.pendingTab = tab;
      app.render({ force: true });
    }
    else {
      app.bringToFront?.();
      if ( tab ) app.setTab(tab);
    }
    return app;
  }

  static refresh() {
    const app = BattlePanel.instance;
    if ( app?.root ) app.renderAll();
  }

  constructor(options = {}) {
    super(options);
    this.draft = loadLastSetup();
    this.party = null; /* [{ key, ref, name, img, on }] built on first render */
    this.foes = []; /* [{ key, ref, name, img, qty }] */
    this.tab = "nova";
    this.bgLayout = "campo";
    this.busy = false;
  }

  async _renderHTML() {
    this.root ??= this.buildShell();
    return this.root;
  }

  _replaceHTML(result, content) {
    if ( result.parentElement !== content ) content.replaceChildren(result);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if ( this.bound ) return;
    this.bound = true;
    try {
      this.root.addEventListener("click", guard(ev => this.onClick(ev), "painel"));
      this.root.addEventListener("change", guard(ev => this.onChange(ev), "painel"));
      this.root.addEventListener("input", ev => {
        if ( ev.target.matches("input[type=range]") ) this.onChange(ev);
      });
      const drop = this.root.querySelector(".bfu-foes");
      drop.addEventListener("dragover", ev => ev.preventDefault());
      drop.addEventListener("drop", guard(ev => this.onDropFoe(ev), "soltar ator"));
      this.buildParty();
      this.setTab(this.pendingTab ?? (getBattle().active ? "atual" : "nova"));
      this.renderAll();
    } catch ( err ) {
      reportError(err, "abrir o painel");
    }
  }

  buildShell() {
    const root = document.createElement("div");
    root.className = "bfu-root";
    root.innerHTML = `
      <nav class="bfu-tabs">
        <button type="button" data-tab="nova"><i class="fa-solid fa-swords"></i> Nova batalha</button>
        <button type="button" data-tab="atual"><i class="fa-solid fa-flag"></i> Batalha atual</button>
        <button type="button" data-tab="fundos"><i class="fa-solid fa-image"></i> Fundos</button>
        <button type="button" data-tab="efeitos"><i class="fa-solid fa-wand-sparkles"></i> Efeitos</button>
      </nav>
      <section class="bfu-pane" data-pane="nova"></section>
      <section class="bfu-pane" data-pane="atual" hidden></section>
      <section class="bfu-pane" data-pane="fundos" hidden></section>
      <section class="bfu-pane" data-pane="efeitos" hidden></section>
      <footer class="bfu-status"></footer>`;
    root.querySelector('[data-pane="nova"]').innerHTML = `
      <div class="bfu-cols">
        <div class="bfu-col">
          <h3>Layout</h3><div class="bfu-layouts"></div>
          <h3>Bioma</h3><div class="bfu-biomes"></div>
          <div class="bfu-opts"></div>
        </div>
        <div class="bfu-col">
          <div class="bfu-preview"><img alt=""></div>
          <div class="bfu-two">
            <div><h3>Grupo</h3><div class="bfu-party"></div></div>
            <div><h3>Inimigos</h3><div class="bfu-foes"></div>
              <div class="bfu-btnrow">
                <button type="button" data-act="foesSelected" title="Tokens selecionados na cena atual"><i class="fa-solid fa-object-group"></i> Seleção</button>
                <button type="button" data-act="foesHostile" title="Todos os tokens hostis da cena atual"><i class="fa-solid fa-skull"></i> Hostis da cena</button>
                <button type="button" data-act="foesCombat" title="Os inimigos do combate da cena atual"><i class="fa-solid fa-swords"></i> Do combate</button>
              </div>
              <p class="bfu-hint">Arraste atores (NPCs) da barra lateral para cá. Tokens trazidos da cena mantêm os PV atuais.</p>
            </div>
          </div>
          <div class="bfu-checks"></div>
          <button type="button" class="bfu-primary bfu-start" data-act="start"><i class="fa-solid fa-play"></i> Começar batalha</button>
        </div>
      </div>`;
    return root;
  }

  setTab(tab) {
    this.tab = tab;
    for ( const b of this.root.querySelectorAll(".bfu-tabs [data-tab]") ) b.classList.toggle("active", b.dataset.tab === tab);
    for ( const p of this.root.querySelectorAll(".bfu-pane") ) p.hidden = p.dataset.pane !== tab;
    this.renderAll();
  }

  status(text) {
    const el = this.root?.querySelector(".bfu-status");
    if ( el ) el.innerHTML = text ? `<i class="fa-solid fa-spinner fa-spin"></i> ${escapeHTML(text)}` : "";
  }

  renderAll() {
    if ( this.tab === "nova" ) this.renderNew();
    if ( this.tab === "atual" ) this.renderCurrent();
    if ( this.tab === "fundos" ) this.renderBackgrounds();
    if ( this.tab === "efeitos" ) this.renderEffects();
  }

  /* ------------------------------------------------------------------------------------------ */
  /* Nova batalha                                                                                 */
  /* ------------------------------------------------------------------------------------------ */

  buildParty() {
    const actors = game.actors?.contents ?? Array.from(game.actors ?? []);
    const chars = actors.filter(a => a.type === "character");
    this.party = chars.map(a => ({ key: `a.${a.id}`, ref: { kind: "actor", id: a.id }, name: a.name, img: a.img || DEFAULT_IMG, on: Boolean(a.hasPlayerOwner) }));
    if ( this.party.length && !this.party.some(p => p.on) ) this.party.forEach(p => (p.on = true));
  }

  renderNew() {
    const d = this.draft;
    const pane = this.root.querySelector('[data-pane="nova"]');
    pane.querySelector(".bfu-layouts").innerHTML = Object.entries(LAYOUTS).map(([k, v]) => `<button type="button" class="bfu-layout${d.layout === k ? " active" : ""}" data-layout="${k}"><b>${v.label}</b><small>${v.hint}</small></button>`).join("");
    pane.querySelector(".bfu-biomes").innerHTML = Object.entries(BIOMES).map(([k, v]) => `<button type="button" class="bfu-biome${d.biome === k ? " active" : ""}" data-biome="${k}"><i class="${v.icon}"></i><span>${v.label}</span>${customBackground(d.layout, k) ? `<em title="Fundo próprio">★</em>` : ""}</button>`).join("");
    const manaOpts = [["", "Nenhuma"], ...MANA_ELEMENTS.map(k => [k, ELEMENTS[k].label])].map(([k, l]) => `<option value="${k}"${d.mana === k ? " selected" : ""}>${l}</option>`).join("");
    const variant = d.layout === "mesa"
      ? `<label>Mesa <select name="table">${Object.entries(TABLES).map(([k, l]) => `<option value="${k}"${d.table === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>`
      : `<label>Hora <select name="time">${Object.entries(TIMES).map(([k, l]) => `<option value="${k}"${d.time === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>`;
    const lib = d.bgMode === "biblioteca";
    const custom = customBackground(d.layout, d.biome);
    const libItem = this.libItems?.find(x => x.src === d.bgLib);
    const libBlock = lib
      ? `<div class="bfu-libsel">${d.bgLib ? `<img src="${escapeHTML(libItem?.thumb ?? d.bgLib)}" alt="">` : `<span class="bfu-libsel-empty"><i class="fa-solid fa-images"></i></span>`}
          <div><b>${d.bgLib ? escapeHTML(libItem?.name ?? decodeURIComponent(d.bgLib.split("/").pop())) : "Nenhuma imagem escolhida"}</b>
          <button type="button" data-act="openLib"><i class="fa-solid fa-images"></i> Escolher na biblioteca…</button></div></div>`
      : "";
    const focus = (lib && d.bgLib) || (!lib && custom)
      ? `<label>Altura do recorte <span class="bfu-inline"><input type="range" name="bgFocus" min="0" max="1" step="0.01" value="${d.bgFocus}"><output>${Math.round(d.bgFocus * 100)}%</output></span></label>`
      : "";
    pane.querySelector(".bfu-opts").innerHTML = `
      <div class="bfu-bgmode"><span>Fundo</span><div class="bfu-seg">
        <button type="button" data-bgmode="gerado" class="${lib ? "" : "active"}">${custom ? "Do bioma ★" : "Gerado"}</button>
        <button type="button" data-bgmode="biblioteca" class="${lib ? "active" : ""}">Biblioteca</button></div></div>
      ${libBlock}${focus}${variant}
      <label>Mana no ar <select name="mana">${manaOpts}</select></label>
      <label>Variação <span class="bfu-inline"><input type="number" name="seed" min="1" max="99999" value="${d.seed}"><button type="button" data-act="dice" title="Sortear"><i class="fa-solid fa-dice"></i></button></span></label>
      ${d.layout === "campo" ? `<label>Tamanho dos tokens <span class="bfu-inline"><input type="range" name="tokenScale" min="0.8" max="2.6" step="0.1" value="${d.tokenScale}"><output>${d.tokenScale.toFixed(1)}×</output></span></label>
      <label class="bfu-check"><input type="checkbox" name="mirrorParty"${d.mirrorParty ? " checked" : ""}> Espelhar o grupo</label>
      <label class="bfu-check"><input type="checkbox" name="mirrorFoes"${d.mirrorFoes ? " checked" : ""}> Espelhar os inimigos</label>` : ""}
      ${custom && !lib ? `<p class="bfu-hint">★ Este bioma usa um fundo próprio (aba Fundos).</p>` : ""}`;
    this.renderPreview();
    pane.querySelector(".bfu-party").innerHTML = (this.party ?? []).map(p => `<label class="bfu-who${p.on ? " on" : ""}"><input type="checkbox" data-party="${p.key}"${p.on ? " checked" : ""}><img src="${escapeHTML(p.img)}" alt=""><span>${escapeHTML(p.name)}</span></label>`).join("")
      || `<p class="bfu-hint">Nenhum personagem de jogador no mundo.</p>`;
    pane.querySelector(".bfu-foes").innerHTML = this.foes.map(f => `<div class="bfu-who on"><img src="${escapeHTML(f.img)}" alt=""><span>${escapeHTML(f.name)}${f.ref.kind === "token" ? ` <small title="Token da cena (mantém os PV)">token</small>` : ""}</span>`
      + `${f.ref.kind === "actor" ? `<input type="number" min="1" max="12" value="${f.qty}" data-qty="${f.key}" title="Quantidade">` : ""}<button type="button" class="bfu-x" data-del="${f.key}" title="Tirar"><i class="fa-solid fa-xmark"></i></button></div>`).join("")
      || `<p class="bfu-drop">Solte NPCs aqui</p>`;
    pane.querySelector(".bfu-checks").innerHTML = `
      <label class="bfu-check"><input type="checkbox" name="intro"${d.intro ? " checked" : ""}> Abertura com cartas embaralhadas</label>
      <label class="bfu-check"><input type="checkbox" name="activate"${d.activate ? " checked" : ""}> Levar todos para a batalha</label>
      <label class="bfu-check"><input type="checkbox" name="startCombat"${d.startCombat ? " checked" : ""}> Começar o combate em seguida (o sistema pergunta quem age primeiro)</label>`;
    const start = pane.querySelector(".bfu-start");
    start.disabled = getBattle().active || this.busy;
    start.title = getBattle().active ? "Encerre a batalha atual antes" : "";
  }

  renderPreview() {
    const box = this.root.querySelector(".bfu-preview");
    const img = box.querySelector("img");
    const d = this.draft;
    const custom = customBackground(d.layout, d.biome);
    const photo = d.bgMode === "biblioteca" ? d.bgLib : custom;
    clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => {
      if ( photo ) {
        img.hidden = true;
        box.style.backgroundImage = `url("${photo.replace(/"/g, "%22")}")`;
        box.style.backgroundPosition = `50% ${Math.round(d.bgFocus * 100)}%`;
      }
      else {
        box.style.backgroundImage = "";
        img.hidden = false;
        img.src = d.bgMode === "biblioteca" ? "" : thumb(d, 520);
      }
    }, 60);
  }

  /* ------------------------------------------------------------------------------------------ */
  /* Background library (gallery inside the panel)                                                */
  /* ------------------------------------------------------------------------------------------ */

  async openLibrary(target) {
    this.libTarget = target;
    this.libFav = this.libFav ?? false;
    this.libQuery = "";
    let modal = this.root.querySelector(".bfu-libmodal");
    if ( !modal ) {
      modal = document.createElement("div");
      modal.className = "bfu-libmodal";
      this.root.append(modal);
      modal.addEventListener("input", ev => {
        if ( !ev.target.matches(".bfu-libsearch") ) return;
        this.libQuery = ev.target.value.trim();
        this.renderLibraryGrid();
      });
    }
    modal.hidden = false;
    modal.innerHTML = `<div class="bfu-libbox"><header><b><i class="fa-solid fa-images"></i> Biblioteca de fundos</b>
        <input type="search" class="bfu-libsearch" placeholder="Número…">
        <button type="button" data-libfav class="${this.libFav ? "active" : ""}"><i class="fa-solid fa-star"></i> Favoritos</button>
        <button type="button" data-libclose title="Fechar"><i class="fa-solid fa-xmark"></i></button></header>
        <div class="bfu-libgrid"><p class="bfu-hint"><i class="fa-solid fa-spinner fa-spin"></i> Carregando…</p></div></div>`;
    this.libItems = await loadLibrary(true);
    this.renderLibraryGrid();
  }

  renderLibraryGrid() {
    const grid = this.root.querySelector(".bfu-libgrid");
    if ( !grid ) return;
    const items = this.libItems ?? [];
    if ( !items.length ) {
      grid.innerHTML = `<div class="bfu-libempty"><i class="fa-solid fa-folder-open"></i><p>Nenhuma imagem em <code>${escapeHTML(libraryFolder())}</code>.</p>
        <p class="bfu-hint">Copie a pasta <b>batalhas-fu-fundos</b> para a pasta Data do Foundry (ou mude o caminho em Configurações › Batalhas FU › Pasta da biblioteca de fundos).</p></div>`;
      return;
    }
    const fav = favorites();
    const q = this.libQuery;
    const list = items.filter(x => (!this.libFav || fav.has(x.src)) && (!q || String(x.n).includes(q) || x.name.toLowerCase().includes(q.toLowerCase())));
    const current = this.libTarget?.type === "setup" ? this.draft.bgLib : customBackground(this.libTarget?.layout, this.libTarget?.biome);
    grid.innerHTML = list.map(x => `<div class="bfu-libitem${x.src === current ? " active" : ""}" data-lib="${escapeHTML(x.src)}" title="${escapeHTML(x.name)}">`
      + `<img loading="lazy" src="${escapeHTML(x.thumb)}" alt=""><span>${x.n}</span>`
      + `<button type="button" class="bfu-star${fav.has(x.src) ? " on" : ""}" data-fav="${escapeHTML(x.src)}" title="Favorito"><i class="fa-solid fa-star"></i></button></div>`).join("")
      || `<p class="bfu-hint">Nada encontrado.</p>`;
  }

  async pickLibrary(src) {
    const target = this.libTarget;
    this.root.querySelector(".bfu-libmodal").hidden = true;
    if ( target?.type === "biome" ) {
      await setCustomBackground(target.layout, target.biome, src);
      return this.renderBackgrounds();
    }
    this.draft = normalizeSetup({ ...this.draft, bgMode: "biblioteca", bgLib: src });
    saveLastSetup(this.draft);
    this.renderNew();
  }

  onChange(ev) {
    const el = ev.target;
    if ( el.dataset.party ) {
      const p = this.party.find(x => x.key === el.dataset.party);
      if ( p ) p.on = el.checked;
      el.closest(".bfu-who")?.classList.toggle("on", el.checked);
      return;
    }
    if ( el.dataset.qty ) {
      const f = this.foes.find(x => x.key === el.dataset.qty);
      if ( f ) f.qty = Math.max(1, Math.min(12, Number(el.value) || 1));
      return;
    }
    if ( el.dataset.bg ) return;
    if ( this.tab !== "nova" || !el.name ) return;
    const d = { ...this.draft };
    d[el.name] = el.type === "checkbox" ? el.checked : el.type === "number" || el.type === "range" ? Number(el.value) : el.value;
    this.draft = normalizeSetup(d);
    saveLastSetup(this.draft);
    if ( el.name === "bgFocus" ) {
      el.nextElementSibling.textContent = `${Math.round(this.draft.bgFocus * 100)}%`;
      this.root.querySelector(".bfu-preview").style.backgroundPosition = `50% ${Math.round(this.draft.bgFocus * 100)}%`;
      return;
    }
    if ( el.type === "range" ) {
      el.nextElementSibling.textContent = `${this.draft.tokenScale.toFixed(1)}×`;
      return;
    }
    if ( ["time", "table", "mana", "seed"].includes(el.name) ) this.renderPreview();
  }

  addFoe(ref, name, img) {
    const key = ref.kind === "token" ? `t.${ref.uuid}` : `a.${ref.id}`;
    const existing = this.foes.find(f => f.key === key);
    if ( existing ) {
      if ( ref.kind === "actor" ) existing.qty = Math.min(12, existing.qty + 1);
      return;
    }
    this.foes.push({ key, ref, name, img: img || DEFAULT_IMG, qty: 1 });
  }

  async onDropFoe(ev) {
    ev.preventDefault();
    const data = dragData(ev);
    if ( !data ) return;
    const doc = data.uuid ? await fromUuid(data.uuid) : null;
    if ( doc?.documentName === "Actor" ) this.addFoe({ kind: "actor", id: doc.id }, doc.name, doc.img);
    else if ( doc?.documentName === "Token" ) this.addFoe({ kind: "token", uuid: doc.uuid }, doc.name, doc.texture?.src);
    else return ui.notifications.warn(`${MODULE_TITLE}: solte um ator ou um token.`);
    this.renderNew();
  }

  foesFrom(tokens) {
    for ( const t of tokens ) this.addFoe({ kind: "token", uuid: t.document.uuid }, t.document.name, t.document.texture?.src);
    this.renderNew();
  }

  /* ------------------------------------------------------------------------------------------ */
  /* Clicks                                                                                       */
  /* ------------------------------------------------------------------------------------------ */

  async onClick(ev) {
    const t = ev.target.closest("[data-tab],[data-layout],[data-biome],[data-act],[data-del],[data-bg-pick],[data-bg-clear],[data-bg-layout],[data-fx],[data-bgmode],[data-lib],[data-fav],[data-libfav],[data-libclose],[data-bg-lib]");
    if ( !t ) return;
    if ( t.dataset.fav ) {
      ev.stopPropagation();
      await toggleFavorite(t.dataset.fav);
      return this.renderLibraryGrid();
    }
    if ( t.hasAttribute("data-libfav") ) {
      this.libFav = !this.libFav;
      t.classList.toggle("active", this.libFav);
      return this.renderLibraryGrid();
    }
    if ( t.hasAttribute("data-libclose") ) {
      this.root.querySelector(".bfu-libmodal").hidden = true;
      return;
    }
    if ( t.dataset.lib ) return this.pickLibrary(t.dataset.lib);
    if ( t.dataset.bgLib ) {
      const [layout, biome] = t.dataset.bgLib.split("|");
      return this.openLibrary({ type: "biome", layout, biome });
    }
    if ( t.dataset.bgmode ) {
      this.draft = normalizeSetup({ ...this.draft, bgMode: t.dataset.bgmode });
      saveLastSetup(this.draft);
      this.renderNew();
      if ( t.dataset.bgmode === "biblioteca" && !this.draft.bgLib ) return this.openLibrary({ type: "setup" });
      return;
    }
    if ( t.dataset.tab ) return this.setTab(t.dataset.tab);
    if ( t.dataset.layout ) {
      this.draft = normalizeSetup({ ...this.draft, layout: t.dataset.layout });
      saveLastSetup(this.draft);
      return this.renderNew();
    }
    if ( t.dataset.biome ) {
      this.draft = normalizeSetup({ ...this.draft, biome: t.dataset.biome });
      saveLastSetup(this.draft);
      return this.renderNew();
    }
    if ( t.dataset.del ) {
      this.foes = this.foes.filter(f => f.key !== t.dataset.del);
      return this.renderNew();
    }
    if ( t.dataset.bgLayout ) {
      this.bgLayout = t.dataset.bgLayout;
      return this.renderBackgrounds();
    }
    if ( t.dataset.bgPick ) {
      const [layout, biome] = t.dataset.bgPick.split("|");
      return browse({ type: "image", current: customBackground(layout, biome), callback: async path => {
        await setCustomBackground(layout, biome, path);
        this.renderBackgrounds();
      } });
    }
    if ( t.dataset.bgClear ) {
      const [layout, biome] = t.dataset.bgClear.split("|");
      await setCustomBackground(layout, biome, "");
      return this.renderBackgrounds();
    }
    if ( t.dataset.fx ) return this.testEffect(t.dataset.fx);
    const act = t.dataset.act;
    const sceneTokens = () => Array.from(canvas?.tokens?.placeables ?? []);
    switch ( act ) {
      case "dice":
        this.draft = normalizeSetup({ ...this.draft, seed: Math.floor(Math.random() * 99998) + 1 });
        saveLastSetup(this.draft);
        return this.renderNew();
      case "foesSelected": {
        const sel = Array.from(canvas?.tokens?.controlled ?? []);
        if ( !sel.length ) return ui.notifications.info(`${MODULE_TITLE}: selecione tokens na cena primeiro.`);
        return this.foesFrom(sel);
      }
      case "foesHostile": {
        const hostile = sceneTokens().filter(x => x.document.disposition === (CONST?.TOKEN_DISPOSITIONS?.HOSTILE ?? -1));
        if ( !hostile.length ) return ui.notifications.info(`${MODULE_TITLE}: não há tokens hostis nesta cena.`);
        return this.foesFrom(hostile);
      }
      case "foesCombat": {
        const combat = game.combats?.contents?.find(c => c.scene?.id === canvas?.scene?.id);
        const list = (combat?.combatants?.contents ?? []).map(c => c.token?.object).filter(o => o && o.document.disposition !== (CONST?.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1));
        if ( !list.length ) return ui.notifications.info(`${MODULE_TITLE}: não há inimigos no combate desta cena.`);
        return this.foesFrom(list);
      }
      case "start":
        return this.start();
      case "replay":
        await replayIntro();
        return ui.notifications.info(`${MODULE_TITLE}: abertura enviada para todos.`);
      case "bannerParty":
      case "bannerFoes":
      case "bannerRound": {
        const kind = act === "bannerParty" ? "party" : act === "bannerFoes" ? "foes" : "round";
        const title = kind === "party" ? "Vez do grupo" : kind === "foes" ? "Vez dos inimigos" : `Rodada ${game.combats.get(getBattle().combatId)?.round ?? ""}`;
        game.socket?.emit(SOCKET, { scope: "banner", kind, title });
        return HUD.banner(kind, title);
      }
      case "reinforceParty":
      case "reinforceFoes": {
        const sel = Array.from(canvas?.tokens?.controlled ?? []).filter(x => !x.document.getFlag(MODULE_ID, "side"));
        const refs = sel.map(x => ({ kind: "token", uuid: x.document.uuid }));
        if ( !refs.length ) return ui.notifications.info(`${MODULE_TITLE}: selecione, numa outra cena, os tokens que vão entrar (ou arraste atores para a lista de inimigos e use "Reforços da lista").`);
        await addToBattle(refs, act === "reinforceParty" ? "party" : "foes");
        return ui.notifications.info(`${MODULE_TITLE}: ${refs.length} reforço(s) entraram na batalha.`);
      }
      case "reinforceList": {
        const refs = this.foes.flatMap(f => (f.ref.kind === "actor" ? Array(f.qty).fill(f.ref) : [f.ref]));
        if ( !refs.length ) return ui.notifications.info(`${MODULE_TITLE}: a lista de inimigos (aba Nova batalha) está vazia.`);
        await addToBattle(refs, "foes");
        this.foes = [];
        return ui.notifications.info(`${MODULE_TITLE}: ${refs.length} inimigo(s) entraram na batalha.`);
      }
      case "end":
        return this.end();
      case "goto": {
        const scene = game.scenes.get(getBattle().sceneId);
        return scene?.view();
      }
      case "turns":
        return TurnControlApp.open();
      case "openLib":
        return this.openLibrary({ type: "setup" });
      case "clearLog":
        return this.renderEffects();
      default:
    }
  }

  async start() {
    if ( this.busy ) return;
    const party = (this.party ?? []).filter(p => p.on).map(p => p.ref);
    const foes = this.foes.flatMap(f => (f.ref.kind === "actor" ? Array(f.qty).fill(f.ref) : [f.ref]));
    if ( !party.length && !foes.length ) return ui.notifications.warn(`${MODULE_TITLE}: escolha o grupo e os inimigos.`);
    this.busy = true;
    this.renderNew();
    try {
      await startBattle({ setup: this.draft, party, foes, onStatus: text => this.status(text), onActivate: () => this.minimize?.() });
      this.foes = [];
      this.setTab("atual");
    } finally {
      this.busy = false;
      this.status("");
      this.renderAll();
    }
  }

  /* ------------------------------------------------------------------------------------------ */
  /* Batalha atual                                                                                */
  /* ------------------------------------------------------------------------------------------ */

  renderCurrent() {
    const pane = this.root.querySelector('[data-pane="atual"]');
    const b = getBattle();
    const scene = b.active ? game.scenes.get(b.sceneId) : null;
    if ( !b.active || !scene ) {
      pane.innerHTML = `<div class="bfu-empty"><i class="fa-solid fa-dove"></i><p>Nenhuma batalha em andamento.</p><button type="button" data-tab="nova">Montar uma batalha</button></div>`;
      return;
    }
    const combat = game.combats.get(b.combatId);
    const tokens = scene.tokens.contents ?? Array.from(scene.tokens);
    const count = side => tokens.filter(t => t.getFlag(MODULE_ID, "side") === side).length;
    pane.innerHTML = `
      <div class="bfu-current">
        <img class="bfu-current-bg" src="${escapeHTML(scene.background?.src ?? "")}" alt="">
        <div class="bfu-current-info">
          <h3>${escapeHTML(scene.name)}</h3>
          <p>${LAYOUTS[b.setup.layout]?.label} · ${BIOMES[b.setup.biome]?.label} · ${count("party")} no grupo, ${count("foes")} inimigo(s)</p>
          <p>${combat ? (combat.started ? `Combate na rodada ${combat.round}.` : "Combate pronto, ainda não começou.") : "Sem combate (foi apagado)."}</p>
          <div class="bfu-btnrow">
            <button type="button" data-act="goto"><i class="fa-solid fa-eye"></i> Ver a cena</button>
            <button type="button" data-act="replay"><i class="fa-solid fa-clone"></i> Rejogar abertura</button>
            <button type="button" data-act="turns"><i class="fa-solid fa-hourglass-half"></i> Janela de turnos</button>
          </div>
          <h4>Faixas manuais</h4>
          <div class="bfu-btnrow">
            <button type="button" data-act="bannerParty">Vez do grupo</button>
            <button type="button" data-act="bannerFoes">Vez dos inimigos</button>
            <button type="button" data-act="bannerRound">Rodada</button>
          </div>
          <h4>Reforços</h4>
          <div class="bfu-btnrow">
            <button type="button" data-act="reinforceFoes" title="Tokens selecionados (de outra cena) entram como inimigos"><i class="fa-solid fa-skull"></i> Seleção → inimigos</button>
            <button type="button" data-act="reinforceParty" title="Tokens selecionados (de outra cena) entram no grupo"><i class="fa-solid fa-user-plus"></i> Seleção → grupo</button>
            <button type="button" data-act="reinforceList" title="Os NPCs da lista de inimigos da aba Nova batalha"><i class="fa-solid fa-list"></i> Reforços da lista</button>
          </div>
        </div>
      </div>
      <fieldset class="bfu-end">
        <legend>Encerrar a batalha</legend>
        <label class="bfu-check"><input type="checkbox" name="giveBack" checked> Devolver PV, PM e efeitos aos tokens de origem (NPCs não vinculados)</label>
        <label class="bfu-check"><input type="checkbox" name="back" checked> Voltar todos para a cena anterior</label>
        <label class="bfu-check"><input type="checkbox" name="deleteScene"> Apagar a cena da batalha</label>
        <button type="button" class="bfu-danger" data-act="end"><i class="fa-solid fa-flag-checkered"></i> Encerrar batalha</button>
      </fieldset>`;
  }

  async end() {
    if ( this.busy ) return;
    const pane = this.root.querySelector('[data-pane="atual"]');
    const opt = name => Boolean(pane.querySelector(`input[name="${name}"]`)?.checked);
    this.busy = true;
    try {
      const res = await endBattle({ giveBack: opt("giveBack"), back: opt("back"), deleteScene: opt("deleteScene"), onStatus: text => this.status(text) });
      ui.notifications.info(`${MODULE_TITLE}: batalha encerrada${res.returned ? ` (${res.returned} token(s) atualizados na cena de origem)` : ""}.`);
    } finally {
      this.busy = false;
      this.status("");
      this.setTab("nova");
    }
  }

  /* ------------------------------------------------------------------------------------------ */
  /* Fundos                                                                                       */
  /* ------------------------------------------------------------------------------------------ */

  renderBackgrounds() {
    const pane = this.root.querySelector('[data-pane="fundos"]');
    const layout = this.bgLayout;
    const base = { ...this.draft, layout };
    pane.innerHTML = `<div class="bfu-btnrow">${Object.entries(LAYOUTS).map(([k, v]) => `<button type="button" data-bg-layout="${k}" class="${k === layout ? "active" : ""}">${v.label}</button>`).join("")}</div>
      <p class="bfu-hint">Cada bioma usa o fundo gerado pelo módulo (com a hora, a mesa, a mana e a variação escolhidas) ou uma imagem sua. Imagens próprias ficam esticadas na cena de ${2400} × ${1350} px.</p>
      <div class="bfu-bggrid">${Object.entries(BIOMES).map(([k, v]) => {
        const custom = customBackground(layout, k);
        return `<div class="bfu-bg"><img src="${escapeHTML(custom || thumb({ ...base, biome: k }, 280))}" alt=""><div class="bfu-bg-bar"><b>${v.label}</b>${custom ? "<em>imagem própria</em>" : "<em>gerado</em>"}</div>`
          + `<div class="bfu-btnrow"><button type="button" data-bg-lib="${layout}|${k}"><i class="fa-solid fa-images"></i> Da biblioteca</button><button type="button" data-bg-pick="${layout}|${k}" title="Escolher qualquer imagem do servidor"><i class="fa-solid fa-folder-open"></i></button>${custom ? `<button type="button" data-bg-clear="${layout}|${k}"><i class="fa-solid fa-rotate-left"></i> Usar o gerado</button>` : ""}</div></div>`;
      }).join("")}</div>`;
  }

  /* ------------------------------------------------------------------------------------------ */
  /* Efeitos                                                                                      */
  /* ------------------------------------------------------------------------------------------ */

  renderEffects() {
    const pane = this.root.querySelector('[data-pane="efeitos"]');
    const b = backends();
    const yes = ok => (ok ? `<b class="bfu-ok"><i class="fa-solid fa-check"></i> ativo</b>` : `<b class="bfu-no"><i class="fa-solid fa-xmark"></i> não</b>`);
    const el = this.fxElement ?? "fire";
    pane.innerHTML = `
      <div class="bfu-mods">
        <span>Sequencer ${yes(b.sequencer)}</span><span>Token Magic FX ${yes(b.tokenmagic)}</span><span>JB2A ${yes(b.jb2a)}</span>
      </div>
      <div class="bfu-mods"><span>Evento de dano do sistema ${damageHookActive() ? yes(true) : `<b class="bfu-no">indisponível</b> (números vêm das mudanças de PV)`}</span>
        <span>Cena vista ${isBattleScene(canvas?.scene) ? yes(true) : `<b class="bfu-no">não é de batalha</b>`}</span>
        <span>Animar fora das batalhas ${setting("animarFora", true) ? yes(true) : `<b class="bfu-no">desligado</b>`}</span></div>
      <p class="bfu-hint">Sem o Sequencer, as animações são desenhadas pelo próprio módulo por cima do mapa. Sem o Token Magic, os tokens não ganham brilho de turno, crise e nocaute.</p>
      <p class="bfu-hint">Teste: selecione o token que age (fonte) e mire (T) os alvos. Sem alvo, o efeito cai na própria fonte.</p>
      <label>Elemento <select data-fx-el>${Object.entries(ELEMENTS).map(([k, v]) => `<option value="${k}"${k === el ? " selected" : ""}>${v.label}</option>`).join("")}</select></label>
      <div class="bfu-fxgrid">
        <button type="button" data-fx="melee"><i class="fa-solid fa-khanda"></i> Ataque corpo a corpo</button>
        <button type="button" data-fx="ranged"><i class="fa-solid fa-bow-arrow"></i> Ataque à distância</button>
        <button type="button" data-fx="spell"><i class="fa-solid fa-hat-wizard"></i> Magia ofensiva</button>
        <button type="button" data-fx="crit"><i class="fa-solid fa-burst"></i> Crítico</button>
        <button type="button" data-fx="support"><i class="fa-solid fa-hand-sparkles"></i> Magia de suporte</button>
        <button type="button" data-fx="skill"><i class="fa-solid fa-star"></i> Habilidade</button>
        <button type="button" data-fx="item"><i class="fa-solid fa-flask"></i> Item</button>
        <button type="button" data-fx="damage"><i class="fa-solid fa-heart-crack"></i> Dano (número)</button>
        <button type="button" data-fx="weak"><i class="fa-solid fa-bolt"></i> Dano em fraqueza</button>
        <button type="button" data-fx="heal"><i class="fa-solid fa-heart"></i> Cura</button>
        <button type="button" data-fx="crisis"><i class="fa-solid fa-fire"></i> Crise</button>
        <button type="button" data-fx="defeat"><i class="fa-solid fa-skull"></i> Derrota</button>
      </div>`;
    pane.querySelector("[data-fx-el]").addEventListener("change", ev => (this.fxElement = ev.target.value));
    const logBox = document.createElement("div");
    logBox.className = "bfu-log";
    pane.append(logBox);
    const draw = () => {
      const rows = getLog().map(e => `<div class="bfu-log-row${e.kind === "erro" ? " err" : e.kind === "ignorado" ? " skip" : ""}"><time>${new Date(e.at).toLocaleTimeString()}</time>`
        + `<span>${escapeHTML(e.text ?? "")}</span><em>${escapeHTML([e.how, e.user].filter(Boolean).join(" · "))}</em></div>`).join("");
      logBox.innerHTML = `<h4>Registro dos últimos eventos</h4>${rows || `<p class="bfu-hint">Nada ainda. Role um ataque ou use os botões acima.</p>`}`;
    };
    draw();
    this.offLog?.();
    this.offLog = onLog(() => {
      if ( this.tab === "efeitos" && logBox.isConnected ) draw();
    });
  }

  async testEffect(kind) {
    const source = canvas?.tokens?.controlled?.[0];
    if ( !source ) return ui.notifications.info(`${MODULE_TITLE}: selecione um token como fonte.`);
    const targets = Array.from(game.user.targets ?? []).map(t => t.document.uuid);
    const s = source.document.uuid;
    const t = targets.length ? targets : [s];
    const element = this.fxElement ?? "fire";
    const map = {
      melee: { kind: "attack", style: "melee", element: "physical" },
      ranged: { kind: "attack", style: "ranged", element: "physical" },
      spell: { kind: "attack", style: "spell", element },
      crit: { kind: "attack", style: "melee", element, crit: true },
      support: { kind: "spell", element },
      skill: { kind: "skill", element },
      item: { kind: "item" },
      damage: { kind: "damage", amount: 12, element },
      weak: { kind: "damage", amount: 24, element, affinity: "vulnerability" },
      heal: { kind: "gain", resource: "hp", amount: 15 },
      crisis: { kind: "crisis" },
      defeat: { kind: "defeat" }
    };
    const e = { ...map[kind], source: s, targets: t };
    const how = await playEvent(e);
    logEvent({ kind: e.kind, text: `${describe(e)} (teste)`, how });
  }
}

BattlePanel.prototype._onClose = async function(options) {
  this.offLog?.();
  return ApplicationV2.prototype._onClose.call(this, options);
};

/** Settings-menu entry: opens the panel. */
export class PanelLauncher extends ApplicationV2 {
  async render() {
    BattlePanel.open();
    return this;
  }
}
