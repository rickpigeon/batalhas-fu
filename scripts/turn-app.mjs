/**
 * Batalhas FU: the GM's turn window ("Turnos da batalha"), a normal Foundry window that can be moved and
 * resized. It drives the system's combat (FUCombat): start/end a combatant's turn, "end and pass" (ends the
 * turn and starts the first available combatant of the side whose turn it is), next round, and a manual
 * switch of the side whose turn it is (FUCombat#setCurrentTurn) for when the table needs it.
 */
import { FRIENDLY, HOSTILE, MODULE_ID, MODULE_TITLE, escapeHTML, isGM, wait } from "./constants.mjs";
import { battleFlags, setting } from "./store.mjs";
import { combatInfo, combatOfScene, endTurnOf, startTurnOf, statsOf } from "./fu-data.mjs";
import { HUD } from "./hud.mjs";
import { SOCKET } from "./constants.mjs";
import { guard, reportError } from "./errors.mjs";

const { ApplicationV2 } = foundry.applications.api;
const APP_ID = `${MODULE_ID}-turnos`;
const pct = (v, m) => (m > 0 ? Math.max(0, Math.min(100, (v / m) * 100)) : 0);

export class TurnControlApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: APP_ID,
    classes: ["batalhas-fu", "bfu-turns"],
    window: { title: "Turnos da batalha", icon: "fa-solid fa-hourglass-half", resizable: true },
    position: { width: 380, height: 600 }
  };

  static get instance() {
    return foundry.applications.instances.get(APP_ID) ?? null;
  }

  static open() {
    if ( !isGM() ) return null;
    let app = TurnControlApp.instance;
    if ( app ) {
      if ( app.minimized ) app.maximize?.();
      app.bringToFront?.();
      return app;
    }
    const width = 380, height = Math.min(640, window.innerHeight - 120);
    const left = Math.max(10, window.innerWidth - width - 320), top = Math.min(170, Math.max(10, window.innerHeight - height - 20));
    app = new TurnControlApp({ position: { width, height, left, top } });
    app.render({ force: true });
    return app;
  }

  static refresh() {
    const app = TurnControlApp.instance;
    if ( !app?.root ) return;
    clearTimeout(app.timer);
    app.timer = setTimeout(() => app.renderBody(), 90);
  }

  async _renderHTML() {
    if ( !this.root ) {
      this.root = document.createElement("div");
      this.root.className = "bfu-t-root";
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
      this.root.addEventListener("click", guard(ev => this.onClick(ev), "turnos"));
    }
    this.renderBody();
  }

  combat() {
    return combatOfScene(canvas?.scene);
  }

  renderBody() {
    try {
      const scene = canvas?.scene;
      const combat = this.combat();
      const info = combatInfo(combat);
      if ( !battleFlags(scene) && !combat ) {
        this.root.innerHTML = `<div class="bfu-t-empty"><i class="fa-solid fa-dove"></i><p>A cena que você está vendo não tem batalha nem combate.</p></div>`;
        return;
      }
      if ( !info ) {
        this.root.innerHTML = `<div class="bfu-t-empty"><i class="fa-solid fa-hourglass"></i><p>Sem combate nesta cena.</p></div>`;
        return;
      }
      const side = info.faction;
      const sideLabel = !info.started ? "Combate não começou" : side === FRIENDLY ? "Vez do grupo" : side === HOSTILE ? "Vez dos inimigos" : "—";
      const acting = info.actingId ? info.combatants.find(c => c.id === info.actingId) : null;
      const row = c => {
        const st = statsOf(c.actor, c.token);
        const canStart = info.started && !info.actingId && c.left > 0 && !c.defeated;
        const isActing = c.id === info.actingId;
        const cls = ["bfu-t-row", isActing ? "acting" : "", c.defeated ? "defeated" : "", info.started && c.left <= 0 && !c.defeated ? "done" : "",
          st.crisis ? "crisis" : "", c.hidden ? "hidden" : "", canStart && c.faction === side ? "suggested" : ""].filter(Boolean).join(" ");
        const action = isActing
          ? `<button type="button" class="bfu-t-act end" data-t="end" title="Encerrar o turno"><i class="fa-solid fa-stop"></i></button>`
          : canStart ? `<button type="button" class="bfu-t-act" data-t="start" data-cid="${c.id}" title="Começar o turno"><i class="fa-solid fa-play"></i></button>` : "";
        const pips = info.started ? `<span class="bfu-t-pips">${"<i></i>".repeat(Math.max(0, c.left))}${"<i class=\"off\"></i>".repeat(Math.max(0, c.total - c.left))}</span>` : "";
        return `<div class="${cls}" data-cid="${c.id}">`
          + `<img src="${escapeHTML(c.img)}" alt="" data-t="pan" data-cid="${c.id}" title="Mostrar no mapa">`
          + `<div class="bfu-t-info"><div class="bfu-t-name"><span data-t="pan" data-cid="${c.id}">${escapeHTML(c.name)}</span>${c.hidden ? ` <i class="fa-solid fa-eye-slash" title="Oculto"></i>` : ""}${pips}</div>`
          + (st.hp ? `<div class="bfu-t-bar hp"><i style="width:${pct(st.hp.value, st.hp.max)}%"></i><b>PV ${st.hp.value}/${st.hp.max}</b></div>` : "")
          + (st.mp ? `<div class="bfu-t-bar mp"><i style="width:${pct(st.mp.value, st.mp.max)}%"></i><b>PM ${st.mp.value}/${st.mp.max}</b></div>` : "")
          + `</div>${action}</div>`;
      };
      const list = faction => info.combatants.filter(c => c.faction === faction).map(row).join("") || `<p class="bfu-t-none">Ninguém</p>`;
      let buttons = "";
      if ( !info.started ) buttons += `<button type="button" class="bfu-t-main" data-t="startCombat"><i class="fa-solid fa-play"></i> Começar o combate</button>`;
      else if ( acting ) {
        buttons += `<button type="button" data-t="end"><i class="fa-solid fa-stop"></i> Encerrar turno</button>`;
        buttons += `<button type="button" class="bfu-t-main" data-t="endPass" title="Encerra o turno de ${escapeHTML(acting.name)} e já começa o próximo do lado da vez"><i class="fa-solid fa-forward-step"></i> Encerrar e passar</button>`;
      }
      else if ( info.outOfTurns ) buttons += `<button type="button" class="bfu-t-main" data-t="round"><i class="fa-solid fa-forward"></i> Próxima rodada</button>`;
      else buttons += `<button type="button" class="bfu-t-main" data-t="next" title="Começa o turno do primeiro disponível do lado da vez"><i class="fa-solid fa-play"></i> Começar o próximo</button>`;
      if ( info.started && !info.outOfTurns ) buttons += `<button type="button" data-t="round" title="Pular para a próxima rodada"><i class="fa-solid fa-forward"></i></button>`;
      this.root.innerHTML = `
        <header class="bfu-t-head">
          <div class="bfu-t-round"><small>Rodada</small><b>${info.started ? info.round : 0}</b></div>
          <div class="bfu-t-side ${side === FRIENDLY ? "party" : side === HOSTILE ? "foes" : ""}">${sideLabel}${acting ? `<small>agindo: ${escapeHTML(acting.name)}</small>` : ""}</div>
          ${info.started && info.fu ? `<button type="button" class="bfu-t-swap" data-t="swap" title="Trocar o lado da vez (correção manual)"><i class="fa-solid fa-right-left"></i></button>` : ""}
        </header>
        <div class="bfu-t-cols">
          <section class="bfu-t-list party${side === FRIENDLY ? " now" : ""}"><h4><i class="fa-solid fa-shield-halved"></i> Grupo</h4>${list(FRIENDLY)}</section>
          <section class="bfu-t-list foes${side === HOSTILE ? " now" : ""}"><h4><i class="fa-solid fa-skull"></i> Inimigos</h4>${list(HOSTILE)}</section>
        </div>
        <footer class="bfu-t-foot">
          <div class="bfu-t-btns">${buttons}</div>
          <div class="bfu-t-btns small">
            <button type="button" data-t="bannerParty">Faixa: grupo</button>
            <button type="button" data-t="bannerFoes">Faixa: inimigos</button>
            <button type="button" data-t="climate" title="Clima e mana da batalha"><i class="fa-solid fa-cloud-sun-rain"></i> Clima</button>
            <button type="button" data-t="panel" title="Painel do Batalhas FU"><i class="fa-solid fa-gear"></i></button>
          </div>
        </footer>`;
    } catch ( err ) {
      reportError(err, "janela de turnos");
    }
  }

  async onClick(ev) {
    const el = ev.target.closest("[data-t]");
    if ( !el ) return;
    const combat = this.combat();
    const info = combatInfo(combat);
    const t = el.dataset.t;
    if ( t === "panel" ) return (await import("./panel-app.mjs")).BattlePanel.open("atual");
    if ( t === "climate" ) return (await import("./climate-app.mjs")).ClimateApp.open();
    if ( t === "bannerParty" || t === "bannerFoes" ) {
      const kind = t === "bannerParty" ? "party" : "foes";
      const title = kind === "party" ? "Vez do grupo" : "Vez dos inimigos";
      game.socket?.emit(SOCKET, { scope: "banner", kind, title });
      return HUD.banner(kind, title);
    }
    if ( !combat || !info ) return;
    if ( t === "pan" ) {
      const c = info.combatants.find(x => x.id === el.dataset.cid);
      const tok = c?.tokenId ? canvas.tokens?.get(c.tokenId) : null;
      if ( tok ) return canvas.animatePan({ x: tok.center.x, y: tok.center.y, duration: 400 });
      return;
    }
    if ( t === "startCombat" ) return combat.startCombat();
    if ( t === "start" ) return startTurnOf(combat, el.dataset.cid);
    if ( t === "end" && info.actingId ) return endTurnOf(combat, info.actingId);
    if ( t === "round" ) return combat.nextRound();
    if ( t === "next" ) return this.startNext(combat);
    if ( t === "endPass" && info.actingId ) {
      await endTurnOf(combat, info.actingId);
      await wait(250);
      return this.startNext(combat);
    }
    if ( t === "swap" && typeof combat.setCurrentTurn === "function" ) {
      const other = info.faction === FRIENDLY ? HOSTILE : FRIENDLY;
      await combat.setCurrentTurn(other);
      ui.notifications.info(`${MODULE_TITLE}: agora é a ${other === FRIENDLY ? "vez do grupo" : "vez dos inimigos"}.`);
    }
  }

  /** Start the first available combatant of the side whose turn it is (top to bottom on the map). */
  async startNext(combat) {
    const info = combatInfo(combat);
    if ( !info?.started || info.actingId ) return;
    const free = side => info.combatants
      .filter(c => c.faction === side && c.left > 0 && !c.defeated)
      .sort((a, b) => (a.token?.y ?? 0) - (b.token?.y ?? 0) || (a.token?.x ?? 0) - (b.token?.x ?? 0));
    const side = info.faction ?? FRIENDLY;
    const next = free(side)[0] ?? free(side === FRIENDLY ? HOSTILE : FRIENDLY)[0];
    if ( !next ) {
      ui.notifications.info(`${MODULE_TITLE}: ninguém tem turno sobrando nesta rodada. Use "Próxima rodada".`);
      return;
    }
    return startTurnOf(combat, next.id);
  }

  async _onClose(options) {
    await super._onClose?.(options);
    clearTimeout(this.timer);
  }
}

export const autoOpenTurns = () => isGM() && setting("turnosAuto", true);
