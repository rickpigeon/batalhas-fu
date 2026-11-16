/**
 * Batalhas FU: entry point.
 *
 * The GM opens the panel (Token controls button, settings menu, keybinding or
 * `game.modules.get("batalhas-fu").api.open()`), picks layout, biome and combatants, and starts a battle.
 * Players never get controls: they only see the battle (scene, tokens, turn bar, banners, animations),
 * and the GM can hide the animated parts from them in the settings.
 */
import { MODULE_ID, MODULE_TITLE, SOCKET, isActiveGM, isGM } from "./constants.mjs";
import { battleFlags, getBattle, isBattleScene, registerSettings, setting } from "./store.mjs";
import { HUD } from "./hud.mjs";
import { maybePlayIntro, playIntro } from "./intro.mjs";
import { applyReactions, backends, hideTurnMarker, playEvent, setTurnMarker } from "./fx.mjs";
import { playDomFx } from "./fx-dom.mjs";
import { listenSystem, markCovered, primeWatcher, watchStats } from "./fu-bridge.mjs";
import { combatInfo, combatOfScene } from "./fu-data.mjs";
import { BattlePanel, PanelLauncher } from "./panel-app.mjs";
import { TurnControlApp, autoOpenTurns } from "./turn-app.mjs";
import { describe, logEvent, receiveLog } from "./log.mjs";
import { addToBattle, endBattle, repaintBackground, replayIntro, setCardDisplay, setClimate, startBattle } from "./battle.mjs";
import { ClimateApp } from "./climate-app.mjs";
import { reportError, watchUncaught } from "./errors.mjs";

Hooks.once("init", () => {
  watchUncaught();
  registerSettings();
  game.settings.registerMenu(MODULE_ID, "painel", {
    name: "Painel de batalhas",
    label: "Abrir o Batalhas FU",
    hint: "Monte batalhas com fundo por bioma, tokens em fileira ou cartas na mesa, abertura animada e efeitos.",
    icon: "fa-solid fa-swords",
    type: PanelLauncher,
    restricted: true
  });
  game.keybindings.register(MODULE_ID, "painel", {
    name: `Abrir o ${MODULE_TITLE}`,
    editable: [],
    restricted: true,
    onDown: () => {
      if ( !isGM() ) return false;
      BattlePanel.open();
      return true;
    }
  });
});

Hooks.once("ready", () => {
  listenSystem();
  game.socket?.on(SOCKET, msg => {
    try {
      if ( !msg ) return;
      if ( msg.scope === "gm" ) {
        if ( !isActiveGM() ) return;
        markCovered(msg.event);
        applyReactions(msg.event);
        return;
      }
      if ( msg.scope === "log" ) {
        if ( game.user.isGM ) receiveLog(msg.entry);
        return;
      }
      if ( msg.scope === "dom" ) return playDomFx(msg);
      if ( msg.scope === "banner" ) return HUD.banner(msg.kind, msg.title, msg.sub ?? "");
    } catch ( err ) {
      reportError(err, "socket");
    }
  });
  const module = game.modules.get(MODULE_ID);
  if ( module ) {
    module.api = {
      /** Open the GM panel (tab: "nova" | "atual" | "fundos" | "efeitos"). */
      open: tab => BattlePanel.open(tab),
      /** Open the GM turn window. */
      turns: () => TurnControlApp.open(),
      /** Start a battle from a macro: { setup, party: refs, foes: refs }; refs = {kind:"actor",id} | {kind:"token",uuid}. */
      start: opts => startBattle(opts),
      /** Add combatants to the running battle. */
      add: (refs, side = "foes") => addToBattle(refs, side),
      /** End the running battle: { giveBack, back, deleteScene }. */
      end: opts => endBattle(opts),
      /** Replay the opening for everybody (kind: "cartas" | "versus" | "laminas" | "portal" | "cortinas" | "relampago" | "estilhacos" | "sorteada"). */
      intro: kind => replayIntro(kind),
      /** Play an animation (GM): { kind, source, targets, element, style, ... }. */
      play: event => playEvent(event),
      /** Open the GM weather window. */
      climaJanela: () => ClimateApp.open(),
      /** Weather and mana of the running battle: { mana: ["fire"], layers: ["chuva"], tint: "noite", intensity: 1, wind: 0 }. */
      clima: climate => setClimate(climate),
      /** Counters on the table cards: { counters: "cantos" | "faixa", cardInfo: { name, hp, mp, ip, status } }. */
      cartas: opts => setCardDisplay(opts),
      /** Paint the battle background again with another mana ("" = none). */
      repintar: mana => repaintBackground(mana),
      /** The running battle (copy) and which effect modules are active. */
      state: () => getBattle(),
      backends: () => backends()
    };
  }
  if ( isGM() && getBattle().active && !game.scenes.get(getBattle().sceneId) ) {
    ui.notifications.warn(`${MODULE_TITLE}: a cena da batalha em andamento foi apagada. Abra o painel e encerre a batalha.`);
  }
});

/* ---------------------------------------------------------------------------------------------- */
/* Scene and canvas                                                                                 */
/* ---------------------------------------------------------------------------------------------- */

Hooks.on("canvasReady", () => {
  HUD.teardown();
  HUD.last = null;
  HUD.refresh();
  if ( canvas.scene && isBattleScene(canvas.scene) ) {
    maybePlayIntro(canvas.scene);
    if ( isActiveGM() ) {
      primeWatcher();
      markActing();
    }
    if ( autoOpenTurns() && combatOfScene(canvas.scene) ) TurnControlApp.open();
  }
  TurnControlApp.refresh();
});

Hooks.on("updateScene", (scene, changed) => {
  if ( scene.id !== canvas?.scene?.id ) return;
  const flags = changed?.flags?.[MODULE_ID];
  if ( !flags ) return;
  if ( "intro" in flags ) maybePlayIntro(scene);
  if ( "battle" in flags ) HUD.refresh();
  if ( "clima" in flags ) {
    HUD.ensureAmbient();
    ClimateApp.refresh();
  }
});

/* ---------------------------------------------------------------------------------------------- */
/* Combat                                                                                           */
/* ---------------------------------------------------------------------------------------------- */

let lastActing = null;
let actingTimer = null;
/** Turn marker on the acting token (active GM), after the system's burst of updates settles. */
function markActing() {
  if ( !isActiveGM() ) return;
  clearTimeout(actingTimer);
  actingTimer = setTimeout(() => {
    if ( !isBattleScene(canvas?.scene) && !setting("animarFora", true) ) return;
    const info = combatInfo(combatOfScene(canvas?.scene));
    const acting = info?.actingId ? info.combatants.find(c => c.id === info.actingId) : null;
    const key = acting ? `${acting.id}|${acting.tokenId}` : null;
    if ( key === lastActing ) return;
    lastActing = key;
    setTurnMarker(acting?.tokenId ?? null, acting?.faction);
    if ( acting ) logEvent({ kind: "turno", text: `${acting.name} começou o turno` });
  }, 180);
}

function onCombat(doc) {
  const combat = doc?.documentName === "Combatant" ? doc.parent : doc;
  try {
    HUD.onCombat(combat);
    markActing();
    TurnControlApp.refresh();
  } catch ( err ) {
    reportError(err, "combate");
  }
}
for ( const hook of ["createCombat", "updateCombat", "createCombatant", "updateCombatant", "deleteCombatant"] ) Hooks.on(hook, onCombat);
Hooks.on("deleteCombat", combat => {
  if ( combat?.scene?.id === canvas?.scene?.id ) {
    HUD.refresh();
    TurnControlApp.refresh();
    if ( isActiveGM() ) {
      lastActing = null;
      hideTurnMarker();
    }
  }
});

/* ---------------------------------------------------------------------------------------------- */
/* Stats (HP, MP, statuses)                                                                         */
/* ---------------------------------------------------------------------------------------------- */

function onStats() {
  TurnControlApp.refresh();
  if ( !isBattleScene(canvas?.scene) ) return;
  HUD.onStats();
  watchStats();
}
for ( const hook of ["updateActor", "updateToken", "createToken", "deleteToken", "createActiveEffect", "deleteActiveEffect", "updateActiveEffect"] ) Hooks.on(hook, onStats);
Hooks.on("refreshToken", () => null);

/* Settings changed (from another GM tab or Configure Settings). */
function onSetting(s) {
  const key = String(s?.key ?? "");
  if ( !key.startsWith(`${MODULE_ID}.`) ) return;
  const name = key.slice(MODULE_ID.length + 1);
  if ( ["hudJogadores", "pvInimigos", "ambiente"].includes(name) ) {
    HUD.ambientKey = "";
    HUD.refresh();
  }
  if ( name === "batalha" ) BattlePanel.refresh();
}
Hooks.on("updateSetting", onSetting);
Hooks.on("createSetting", onSetting);
Hooks.on("clientSettingChanged", key => {
  if ( [`${MODULE_ID}.ambiente`, `${MODULE_ID}.hudEscala`, `${MODULE_ID}.plaquinhas`].includes(key) ) {
    HUD.ambientKey = "";
    HUD.refresh();
  }
});

/* ---------------------------------------------------------------------------------------------- */
/* GM entry points                                                                                  */
/* ---------------------------------------------------------------------------------------------- */

Hooks.on("getSceneControlButtons", controls => {
  if ( !isGM() ) return;
  const tokens = controls?.tokens;
  if ( !tokens?.tools ) return;
  tokens.tools.batalhasFU = {
    name: "batalhasFU",
    title: MODULE_TITLE,
    icon: "fa-solid fa-swords",
    order: Object.keys(tokens.tools).length,
    button: true,
    visible: true,
    onChange: () => BattlePanel.open()
  };
  tokens.tools.batalhasFUClima = {
    name: "batalhasFUClima",
    title: "Clima e mana da batalha",
    icon: "fa-solid fa-cloud-sun-rain",
    order: Object.keys(tokens.tools).length,
    button: true,
    visible: true,
    onChange: () => ClimateApp.open()
  };
  tokens.tools.batalhasFUTurnos = {
    name: "batalhasFUTurnos",
    title: "Turnos da batalha",
    icon: "fa-solid fa-hourglass-half",
    order: Object.keys(tokens.tools).length,
    button: true,
    visible: true,
    onChange: () => TurnControlApp.open()
  };
});

/* exported for the harness / debugging */
export { HUD, playIntro, battleFlags, setting };
