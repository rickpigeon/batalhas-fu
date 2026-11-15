/**
 * Batalhas FU: the module's own animations, drawn in the DOM layer above the canvas of each client.
 * Used when Sequencer is not active, and always for damage numbers, affinity words and the screen shake.
 * The images are the same as Sequencer's (assets/fx); the colour comes from a CSS mask.
 */
import { ELEMENTS, PATH, elementOf } from "./constants.mjs";
import { canSeeHud, layer, tokenRect } from "./overlay.mjs";

const IMG = name => `${PATH}/assets/fx/${name}.webp`;

function sprite(img, tint) {
  const el = document.createElement("div");
  el.className = "bfu-sprite";
  const url = `url("${IMG(img)}")`;
  if ( tint ) {
    const t = document.createElement("div");
    t.className = "bfu-tint";
    t.style.background = tint;
    t.style.maskImage = url;
    t.style.webkitMaskImage = url;
    el.append(t);
  }
  const base = document.createElement("div");
  base.className = tint ? "bfu-shine" : "bfu-plain";
  base.style.backgroundImage = url;
  el.append(base);
  return el;
}

function place(el, cx, cy, w, h) {
  el.style.left = `${cx - w / 2}px`;
  el.style.top = `${cy - h / 2}px`;
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
}

function run(el, frames, opts) {
  layer("fx").append(el);
  const anim = el.animate(frames, { fill: "both", ...opts });
  anim.finished.then(() => el.remove(), () => el.remove());
  return anim;
}

function playStep(s, src, tgt) {
  const at = s.at === "target" ? tgt : src;
  if ( !at ) return;
  const base = Math.max(at.w, at.h);
  const size = base * (s.size ?? 1);
  const el = sprite(s.img, s.tint);
  const delay = s.delay ?? 0, duration = s.dur ?? 600;
  switch ( s.anim ) {
    case "fly": {
      if ( !tgt ) return;
      const d = Math.max(at.w, at.h) * (s.size ?? 0.8);
      place(el, src.cx, src.cy, d, d);
      const ang = (Math.atan2(tgt.cy - src.cy, tgt.cx - src.cx) * 180) / Math.PI;
      run(el, [
        { transform: `translate(0,0) rotate(${ang}deg) scale(.6)`, opacity: 0 },
        { offset: 0.15, opacity: 1 },
        { transform: `translate(${tgt.cx - src.cx}px,${tgt.cy - src.cy}px) rotate(${ang}deg) scale(1)`, opacity: 1 }
      ], { duration, delay, easing: "cubic-bezier(.45,0,.55,1)" });
      return;
    }
    case "beam": {
      if ( !tgt ) return;
      const len = Math.hypot(tgt.cx - src.cx, tgt.cy - src.cy);
      const ang = (Math.atan2(tgt.cy - src.cy, tgt.cx - src.cx) * 180) / Math.PI;
      const h = Math.max(40, base * 0.5);
      el.style.left = `${src.cx}px`;
      el.style.top = `${src.cy - h / 2}px`;
      el.style.width = `${len}px`;
      el.style.height = `${h}px`;
      el.style.transformOrigin = "0 50%";
      el.classList.add("bfu-stretch");
      run(el, [
        { transform: `rotate(${ang}deg) scaleX(0)`, opacity: 1 },
        { offset: 0.3, transform: `rotate(${ang}deg) scaleX(1)`, opacity: 1 },
        { transform: `rotate(${ang}deg) scaleX(1)`, opacity: 0 }
      ], { duration, delay, easing: "ease-out" });
      return;
    }
    case "spin":
      place(el, at.cx, at.cy + (s.below ? at.h * 0.18 : 0), size, size * (s.below ? 0.55 : 1));
      run(el, [
        { transform: "rotate(-120deg) scale(0)", opacity: 0 },
        { offset: 0.3, transform: "rotate(0deg) scale(1)", opacity: 1 },
        { offset: 0.75, transform: "rotate(90deg) scale(1)", opacity: 1 },
        { transform: "rotate(140deg) scale(1.05)", opacity: 0 }
      ], { duration, delay, easing: "ease-out" });
      return;
    case "slash":
      place(el, at.cx, at.cy, size, size);
      run(el, [
        { transform: "rotate(-70deg) scale(.55)", opacity: 0 },
        { offset: 0.35, transform: "rotate(0deg) scale(1)", opacity: 1 },
        { transform: "rotate(10deg) scale(1.05)", opacity: 0 }
      ], { duration, delay, easing: "cubic-bezier(.2,.8,.2,1)" });
      return;
    case "rise":
      place(el, at.cx, at.cy, size, size);
      run(el, [
        { transform: "translateY(0) scale(.8)", opacity: 0 },
        { offset: 0.2, opacity: 1 },
        { transform: `translateY(${-at.h * 0.6}px) scale(1)`, opacity: 0 }
      ], { duration, delay, easing: "ease-out" });
      return;
    case "pulse":
      place(el, at.cx, at.cy, size, size);
      run(el, [
        { transform: "scale(.2)", opacity: 1 },
        { transform: "scale(1)", opacity: 0 }
      ], { duration, delay, easing: "cubic-bezier(.2,.7,.3,1)" });
      return;
    case "hover":
      place(el, at.cx, at.y - size * 0.2, size, size);
      run(el, [
        { transform: "translateY(10px) scale(.8)", opacity: 0 },
        { offset: 0.2, transform: "translateY(0) scale(1)", opacity: 1 },
        { offset: 0.75, opacity: 1 },
        { transform: "translateY(-20px) scale(1)", opacity: 0 }
      ], { duration, delay, easing: "ease-out" });
      return;
    case "burst":
    default:
      place(el, at.cx, at.cy, size, size);
      run(el, [
        { transform: "scale(.3)", opacity: 0 },
        { offset: 0.25, transform: "scale(1.08)", opacity: 1 },
        { offset: 0.6, transform: "scale(1)", opacity: 1 },
        { transform: "scale(1.1)", opacity: 0 }
      ], { duration, delay, easing: "ease-out" });
  }
}

const AFFINITY_WORDS = { vulnerability: "FRAQUEZA!", resistance: "RESISTE", immunity: "IMUNE", absorption: "ABSORVE" };

function pop(msg) {
  for ( const id of msg.targets ?? [] ) {
    const r = tokenRect(id);
    if ( !r ) continue;
    const box = document.createElement("div");
    box.className = "bfu-pop";
    let color = ELEMENTS[elementOf(msg.element)]?.color ?? "#ffffff";
    let cls = "dmg";
    if ( msg.resource === "hp" ) {
      color = "#7dff9e";
      cls = "heal";
    }
    else if ( msg.resource === "mp" ) {
      color = "#8fc4ff";
      cls = "heal";
    }
    else if ( msg.resource === "fumble" ) {
      color = "#c9c2d6";
      cls = "word";
    }
    else if ( msg.affinity === "absorption" ) color = "#7dff9e";
    box.classList.add(cls);
    box.style.setProperty("--c", color);
    const extra = msg.crit ? "CRÍTICO!" : AFFINITY_WORDS[msg.affinity] ?? "";
    box.innerHTML = `${extra ? `<span class="bfu-pop-word">${extra}</span>` : ""}<span class="bfu-pop-num">${String(msg.text ?? "").replace(/[<>&]/g, "")}</span>`;
    const size = Math.max(22, Math.min(64, r.h * 0.42));
    box.style.fontSize = `${size}px`;
    box.style.left = `${r.cx}px`;
    box.style.top = `${r.y + r.h * 0.25}px`;
    run(box, [
      { transform: "translate(-50%, 0) scale(.4)", opacity: 0 },
      { offset: 0.12, transform: "translate(-50%, -30%) scale(1.25)", opacity: 1 },
      { offset: 0.25, transform: "translate(-50%, -45%) scale(1)", opacity: 1 },
      { offset: 0.8, transform: "translate(-50%, -110%) scale(1)", opacity: 1 },
      { transform: "translate(-50%, -140%) scale(.95)", opacity: 0 }
    ], { duration: 1500, easing: "ease-out" });
  }
}

function shake() {
  const board = document.getElementById("board");
  if ( !board?.animate ) return;
  const k = [];
  for ( let i = 0; i < 8; i++ ) k.push({ transform: `translate(${(i % 2 ? -1 : 1) * (8 - i)}px, ${(i % 3 - 1) * (6 - i / 2)}px)` });
  k.push({ transform: "translate(0,0)" });
  board.animate(k, { duration: 380, easing: "linear" });
}

/** Play a DOM effect message: { type: "fx"|"pop"|"shake", ... } on this client. */
export function playDomFx(msg) {
  if ( !msg || !canvas?.ready || !canSeeHud() ) return;
  if ( msg.sceneId && msg.sceneId !== canvas.scene?.id ) return;
  if ( msg.type === "pop" ) return pop(msg);
  if ( msg.type === "shake" ) return shake();
  if ( msg.type === "fx" ) {
    const src = msg.source ? tokenRect(msg.source) : null;
    const targets = (msg.targets ?? []).map(id => tokenRect(id)).filter(Boolean);
    for ( const s of msg.steps ?? [] ) {
      if ( s.at === "target" || s.to === "target" ) {
        for ( const t of targets.length ? targets : [src] ) playStep(s, src ?? t, t);
      }
      else playStep(s, src, targets[0] ?? null);
    }
  }
}
