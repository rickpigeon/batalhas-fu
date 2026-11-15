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
import { backends, hideTurnMarker, playEvent, showTurnMarker } from "./fx.mjs";
import { playDomFx } from "./fx-dom.mjs";
import { listenSystem, markCovered, primeWatcher, watchStats } from "./fu-bridge.mjs";
import { combatInfo, combatOfScene } from "./fu-data.mjs";
import { BattlePanel, PanelLauncher } from "./panel-app.mjs";
import { addToBattle, endBattle, replayIntro, startBattle } from "./battle.mjs";
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
        playEvent(msg.event);
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
      /** Start a battle from a macro: { setup, party: refs, foes: refs }; refs = {kind:"actor",id} | {kind:"token",uuid}. */
      start: opts => startBattle(opts),
      /** Add combatants to the running battle. */
      add: (refs, side = "foes") => addToBattle(refs, side),
      /** End the running battle: { giveBack, back, deleteScene }. */
      end: opts => endBattle(opts),
      /** Replay the card opening for everybody. */
      intro: () => replayIntro(),
      /** Play an animation (GM): { kind, source, targets, element, style, ... }. */
      play: event => playEvent(event),
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
  }
});

Hooks.on("updateScene", (scene, changed) => {
  if ( scene.id !== canvas?.scene?.id ) return;
  const flags = changed?.flags?.[MODULE_ID];
  if ( !flags ) return;
  if ( "intro" in flags ) maybePlayIntro(scene);
  if ( "battle" in flags ) HUD.refresh();
});

/* ---------------------------------------------------------------------------------------------- */
/* Combat                                                                                           */
/* ---------------------------------------------------------------------------------------------- */

let lastActing = null;
function markActing() {
  if ( !isActiveGM() || !isBattleScene(canvas?.scene) ) return;
  const info = combatInfo(combatOfScene(canvas.scene));
  const acting = info?.actingId ? info.combatants.find(c => c.id === info.actingId) : null;
  const key = acting ? `${acting.id}|${acting.tokenId}` : null;
  if ( key === lastActing ) return;
  lastActing = key;
  if ( acting?.tokenId ) showTurnMarker(acting.tokenId, acting.faction);
  else hideTurnMarker();
}

function onCombat(doc) {
  const combat = doc?.documentName === "Combatant" ? doc.parent : doc;
  try {
    HUD.onCombat(combat);
    markActing();
  } catch ( err ) {
    reportError(err, "combate");
  }
}
for ( const hook of ["createCombat", "updateCombat", "createCombatant", "updateCombatant", "deleteCombatant"] ) Hooks.on(hook, onCombat);
Hooks.on("deleteCombat", combat => {
  if ( combat?.scene?.id === canvas?.scene?.id ) {
    HUD.refresh();
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
  if ( key === `${MODULE_ID}.ambiente` ) {
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
});

/* exported for the harness / debugging */
export { HUD, playIntro, battleFlags, setting };
