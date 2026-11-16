/**
 * Batalhas FU: the GM window "Clima e mana da batalha". Changes the weather layers, the mana in the air,
 * the colour of the scene, the intensity and the wind of the running battle, live for everybody
 * (scene flag `clima`). Ready-made combinations are one click away.
 */
import { ELEMENTS, MANA_ELEMENTS, MODULE_ID, MODULE_TITLE, escapeHTML, isGM } from "./constants.mjs";
import { MAX_LAYERS, MAX_MANA, PRESETS, TINTS, WEATHER, WEATHER_GROUPS, biomeLayer, climateOf, normalizeClimate } from "./climate.mjs";
import { battleFlags } from "./store.mjs";
import { battleScene, repaintBackground, setClimate } from "./battle.mjs";
import { guard, reportError } from "./errors.mjs";

const { ApplicationV2 } = foundry.applications.api;
const APP_ID = `${MODULE_ID}-clima`;

export class ClimateApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: APP_ID,
    classes: ["batalhas-fu", "bfu-app", "bfu-clima"],
    window: { title: "Clima e mana da batalha", icon: "fa-solid fa-cloud-sun-rain", resizable: true },
    position: { width: 560, height: 700 }
  };

  static get instance() {
    return foundry.applications.instances.get(APP_ID) ?? null;
  }

  static open() {
    if ( !isGM() ) return null;
    let app = ClimateApp.instance;
    if ( app ) {
      if ( app.minimized ) app.maximize?.();
      app.bringToFront?.();
      app.renderBody();
      return app;
    }
    const width = Math.min(580, window.innerWidth - 40), height = Math.min(720, window.innerHeight - 60);
    app = new ClimateApp({ position: { width, height, left: Math.max(10, (window.innerWidth - width) / 2 - 200), top: Math.max(10, (window.innerHeight - height) / 2) } });
    app.render({ force: true });
    return app;
  }

  /** The scene's climate changed (here or on another GM's screen). */
  static refresh() {
    const app = ClimateApp.instance;
    if ( !app?.root || app.pending ) return;
    clearTimeout(app.refreshTimer);
    app.refreshTimer = setTimeout(() => app.renderBody(), 80);
  }

  async _renderHTML() {
    if ( !this.root ) {
      this.root = document.createElement("div");
      this.root.className = "bfu-root bfu-clima-root";
    }
    return this.root;
  }

  _replaceHTML(result, content) {
    if ( result.parentElement !== content ) content.replaceChildren(result);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if ( !this.bound ) {
      this.bound = true;
      this.root.addEventListener("click", guard(ev => this.onClick(ev), "clima"));
      this.root.addEventListener("input", guard(ev => this.onInput(ev), "clima"));
    }
    this.renderBody();
  }

  current() {
    const scene = battleScene();
    return scene ? this.pending ?? climateOf(scene, battleFlags(scene)) : null;
  }

  renderBody() {
    try {
      const scene = battleScene();
      if ( !scene ) {
        this.root.innerHTML = `<div class="bfu-empty"><i class="fa-solid fa-cloud-sun"></i><p>Nenhuma batalha em andamento.</p></div>`;
        return;
      }
      const c = this.current();
      const flags = battleFlags(scene) ?? {};
      const painted = flags.mana ?? "";
      const chip = (attr, key, label, on, extra = "", icon = "") => `<button type="button" class="bfu-chipbtn${on ? " active" : ""}" ${attr}="${key}"${extra}>${icon ? `<i class="${icon}"></i>` : ""}${escapeHTML(label)}</button>`;
      const presets = Object.entries(PRESETS).map(([k, p]) => chip("data-preset", k, p.label, false, "", p.icon)).join("");
      const mana = MANA_ELEMENTS.map(k => chip("data-mana", k, ELEMENTS[k].label, c.mana.includes(k), ` style="--el:${ELEMENTS[k].color}"`, ELEMENTS[k].icon)).join("");
      const groups = Object.entries(WEATHER_GROUPS).map(([g, label]) => {
        const items = Object.entries(WEATHER).filter(([, w]) => w.group === g).map(([k, w]) => chip("data-layer", k, w.label, c.layers.includes(k), "", w.icon)).join("");
        return `<div class="bfu-wxgroup"><h5>${label}</h5><div class="bfu-chiprow">${items}</div></div>`;
      }).join("");
      const tints = Object.entries(TINTS).map(([k, t]) => chip("data-tint", k || "nenhum", t.label, c.tint === k, t.color ? ` style="--tint:${t.color}"` : "")).join("");
      const want = c.mana[0] ?? "";
      const repaint = want !== painted
        ? `<div class="bfu-repaint"><p class="bfu-hint">O fundo foi pintado com ${painted ? `a mana de <b>${escapeHTML(ELEMENTS[painted]?.label ?? painted)}</b>` : "<b>nenhuma</b> mana"} no chão. As partículas já mudaram; o brilho pintado só muda se o fundo for repintado.</p>`
          + `<button type="button" data-act="repaint"${this.busy ? " disabled" : ""}><i class="fa-solid fa-paintbrush"></i> Repintar o fundo com ${want ? escapeHTML(ELEMENTS[want].label) : "nenhuma mana"}</button></div>`
        : "";
      this.root.innerHTML = `
        <p class="bfu-hint">Tudo aqui muda na hora para todos que estão vendo a batalha <b>${escapeHTML(scene.name)}</b>.</p>
        <h4>Combinações prontas</h4><div class="bfu-chiprow">${presets}</div>
        <h4>Mana no ar <small>${c.mana.length}/${MAX_MANA}</small></h4><div class="bfu-chiprow mana">${mana}</div>${repaint}
        <h4>Clima <small>${c.layers.length}/${MAX_LAYERS} camadas</small></h4>${groups}
        <h4>Tom da cena</h4><div class="bfu-chiprow">${tints}</div>
        <h4>Ajustes</h4>
        <label>Intensidade <span class="bfu-inline"><input type="range" name="intensity" min="0.25" max="2" step="0.05" value="${c.intensity}"><output>${Math.round(c.intensity * 100)}%</output></span></label>
        <label>Vento <span class="bfu-inline"><input type="range" name="wind" min="-1" max="1" step="0.05" value="${c.wind}"><output>${windLabel(c.wind)}</output></span></label>
        <div class="bfu-btnrow bfu-clima-foot">
          <button type="button" data-act="biome" title="As partículas do bioma desta batalha"><i class="fa-solid fa-rotate-left"></i> Clima do bioma</button>
          <button type="button" data-act="clear"><i class="fa-solid fa-eraser"></i> Limpar tudo</button>
        </div>`;
    } catch ( err ) {
      reportError(err, "janela de clima");
    }
  }

  /** Apply a change: drawn here at once, saved on the scene a moment later (sliders send many). */
  commit(next, delay = 220, render = true) {
    this.pending = normalizeClimate(next);
    if ( render ) this.renderBody();
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      const value = this.pending;
      try {
        await setClimate(value);
      } catch ( err ) {
        reportError(err, "mudar o clima");
      } finally {
        if ( this.pending === value ) this.pending = null;
      }
    }, delay);
  }

  async onClick(ev) {
    const el = ev.target.closest("[data-preset],[data-mana],[data-layer],[data-tint],[data-act]");
    if ( !el ) return;
    const c = this.current();
    if ( !c ) return;
    if ( el.dataset.preset ) {
      const p = PRESETS[el.dataset.preset];
      return this.commit({ intensity: c.intensity, wind: 0, ...p.clima }, 0);
    }
    if ( el.dataset.mana ) {
      const k = el.dataset.mana;
      const has = c.mana.includes(k);
      if ( !has && c.mana.length >= MAX_MANA ) return ui.notifications.warn(`${MODULE_TITLE}: no máximo ${MAX_MANA} manas ao mesmo tempo.`);
      return this.commit({ ...c, mana: has ? c.mana.filter(x => x !== k) : [...c.mana, k] }, 0);
    }
    if ( el.dataset.layer ) {
      const k = el.dataset.layer;
      const has = c.layers.includes(k);
      if ( !has && c.layers.length >= MAX_LAYERS ) return ui.notifications.warn(`${MODULE_TITLE}: no máximo ${MAX_LAYERS} camadas de clima ao mesmo tempo.`);
      return this.commit({ ...c, layers: has ? c.layers.filter(x => x !== k) : [...c.layers, k] }, 0);
    }
    if ( el.dataset.tint ) return this.commit({ ...c, tint: el.dataset.tint === "nenhum" ? "" : el.dataset.tint }, 0);
    switch ( el.dataset.act ) {
      case "biome": {
        const flags = battleFlags(battleScene()) ?? {};
        return this.commit({ mana: flags.mana ? [flags.mana] : [], layers: [biomeLayer(flags.biome)], tint: "", intensity: 1, wind: 0 }, 0);
      }
      case "clear":
        return this.commit({ mana: [], layers: [], tint: "", intensity: c.intensity, wind: c.wind }, 0);
      case "repaint": {
        if ( this.busy ) return;
        this.busy = true;
        this.renderBody();
        try {
          await repaintBackground(c.mana[0] ?? "", text => ui.notifications.info(`${MODULE_TITLE}: ${text}`));
          ui.notifications.info(`${MODULE_TITLE}: fundo repintado.`);
        } finally {
          this.busy = false;
          this.renderBody();
        }
        return;
      }
      default:
    }
  }

  onInput(ev) {
    const el = ev.target;
    if ( el.name !== "intensity" && el.name !== "wind" ) return;
    const c = this.current();
    if ( !c ) return;
    const v = Number(el.value);
    const out = el.nextElementSibling;
    if ( out ) out.textContent = el.name === "wind" ? windLabel(v) : `${Math.round(v * 100)}%`;
    this.pending = normalizeClimate({ ...c, [el.name]: v });
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.commit(this.pending, 0, false), 300);
  }

  async _onClose(options) {
    await super._onClose?.(options);
    clearTimeout(this.saveTimer);
    clearTimeout(this.refreshTimer);
  }
}

function windLabel(w) {
  if ( Math.abs(w) < 0.1 ) return "calmo";
  const strength = Math.abs(w) < 0.45 ? "brisa" : Math.abs(w) < 0.8 ? "vento" : "ventania";
  return `${strength} ${w > 0 ? "→" : "←"}`;
}
