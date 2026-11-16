/**
 * Batalhas FU: weather and mana drawn over a battle scene, on every client.
 *
 * One <canvas> carries the particles (rain, snow, sand, leaves, embers, motes, birds, meteors...), and a
 * few CSS layers carry what is better as a wash (tint, vignette, fog banks, ground mist, aurora, light
 * rays, mana glow, haze and the lightning flash). It lives in the overlay's "ambient" layer, below the
 * plates and the turn bar, and only runs while a battle scene is shown.
 */
import { ELEMENTS, hexToRgb } from "./constants.mjs";
import { TINTS } from "./climate.mjs";

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = list => list[Math.floor(Math.random() * list.length)];
const rgba = (hex, a) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

/* ---------------------------------------------------------------------------------------------- */
/* Sprites                                                                                          */
/* ---------------------------------------------------------------------------------------------- */

const sprites = new Map();
/** A soft round glow of a colour (white core), cached. */
function glow(hex, size = 32, core = true) {
  const key = `${hex}|${size}|${core}`;
  if ( sprites.has(key) ) return sprites.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  if ( core ) g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(core ? 0.22 : 0, rgba(hex, core ? 0.9 : 0.8));
  g.addColorStop(1, rgba(hex, 0));
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  sprites.set(key, c);
  return c;
}

/* ---------------------------------------------------------------------------------------------- */
/* Particle kinds                                                                                   */
/* Each kind: n (count at intensity 1), make(p, s, first), step(p, dt, s) -> false to respawn,        */
/* draw(ctx, list, s). `s` = { w, h, t, wind, k, opt }.                                              */
/* ---------------------------------------------------------------------------------------------- */

function fallingStreaks({ n, spd, len, width, color, alpha, slant = 1 }) {
  return {
    n,
    make(p, s, first) {
      p.x = rand(-s.w * 0.25, s.w * 1.25);
      p.y = first ? rand(-s.h, s.h) : rand(-s.h * 0.3, -10);
      p.v = rand(spd[0], spd[1]);
      p.l = rand(len[0], len[1]);
    },
    step(p, dt, s) {
      p.vx = (s.wind * 420 + 50) * slant;
      p.x += p.vx * dt;
      p.y += p.v * dt;
      return p.y < s.h + p.l;
    },
    draw(ctx, list) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      for ( const p of list ) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - (p.vx / p.v) * p.l, p.y - p.l);
      }
      ctx.stroke();
    }
  };
}

function flakes({ n, spd, r, color, alpha, sway = 30, drift = 60, glowy = false }) {
  return {
    n,
    make(p, s, first) {
      p.x = rand(-20, s.w + 20);
      p.y = first ? rand(-s.h, s.h) : rand(-30, -5);
      p.v = rand(spd[0], spd[1]);
      p.r = rand(r[0], r[1]);
      p.ph = rand(0, TAU);
      p.f = rand(0.6, 1.6);
    },
    step(p, dt, s) {
      p.y += p.v * dt;
      p.x += (s.wind * drift + Math.sin(s.t * p.f + p.ph) * sway) * dt;
      if ( p.x > s.w + 30 ) p.x = -30;
      else if ( p.x < -30 ) p.x = s.w + 30;
      return p.y < s.h + 10;
    },
    draw(ctx, list) {
      ctx.globalAlpha = alpha;
      if ( glowy ) {
        const img = glow(color, 32, true);
        for ( const p of list ) ctx.drawImage(img, p.x - p.r * 2.5, p.y - p.r * 2.5, p.r * 5, p.r * 5);
        return;
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      for ( const p of list ) {
        ctx.moveTo(p.x + p.r, p.y);
        ctx.arc(p.x, p.y, p.r, 0, TAU);
      }
      ctx.fill();
    }
  };
}

function horizontal({ n, spd, len, width, color, alpha }) {
  return {
    n,
    make(p, s, first) {
      const dir = s.wind < 0 ? -1 : 1;
      p.l = rand(len[0], len[1]);
      p.x = first ? rand(0, s.w) : dir > 0 ? -p.l - rand(0, 200) : s.w + p.l + rand(0, 200);
      p.y = rand(0, s.h);
      p.v = rand(spd[0], spd[1]) * (0.55 + Math.abs(s.wind) * 0.8) * dir;
      p.vy = rand(-15, 35);
    },
    step(p, dt, s) {
      p.x += p.v * dt;
      p.y += p.vy * dt;
      return p.v > 0 ? p.x < s.w + p.l + 10 : p.x > -p.l - 10;
    },
    draw(ctx, list) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      for ( const p of list ) {
        const d = Math.sign(p.v) || 1;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - d * p.l, p.y - (p.vy / Math.abs(p.v)) * p.l);
      }
      ctx.stroke();
    }
  };
}

/** Floating motes (dust, pollen, fireflies, spores, sparkles, mana). */
function motes({ n, color, r, alpha = 1, blink = 0, rise = [0, 0], area = [0, 1], star = false, square = false }) {
  return {
    n,
    make(p, s, first) {
      p.x = rand(0, s.w);
      p.y = first ? rand(s.h * area[0], s.h * area[1]) : rise[1] < 0 ? s.h * area[1] + rand(0, 30) : rand(s.h * area[0], s.h * area[1]);
      p.vx = rand(-12, 12);
      p.vy = rand(rise[0], rise[1]) || rand(-8, 8);
      p.r = rand(r[0], r[1]);
      p.ph = rand(0, TAU);
      p.b = rand(1.2, 3);
      p.c = Array.isArray(color) ? pick(color) : color;
    },
    step(p, dt, s) {
      p.vx += rand(-30, 30) * dt;
      p.vx = Math.max(-25, Math.min(25, p.vx));
      p.x += (p.vx + s.wind * 30) * dt;
      p.y += p.vy * dt;
      if ( p.x > s.w + 20 ) p.x = -20;
      else if ( p.x < -20 ) p.x = s.w + 20;
      if ( rise[1] < 0 ) return p.y > s.h * area[0] - 20;
      if ( p.y < s.h * area[0] - 20 || p.y > s.h * area[1] + 20 ) p.vy = -p.vy;
      return true;
    },
    draw(ctx, list, s) {
      for ( const p of list ) {
        let a = alpha;
        if ( blink ) a *= Math.max(0, 1 - blink + blink * (0.5 + 0.5 * Math.sin(s.t * p.b + p.ph)));
        if ( rise[1] < 0 ) a *= Math.min(1, Math.max(0, (p.y - s.h * area[0]) / (s.h * 0.25)));
        if ( a <= 0.01 ) continue;
        ctx.globalAlpha = a;
        if ( star ) {
          const l = p.r * (1.6 + Math.sin(s.t * p.b + p.ph));
          ctx.strokeStyle = p.c;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(p.x - l, p.y);
          ctx.lineTo(p.x + l, p.y);
          ctx.moveTo(p.x, p.y - l);
          ctx.lineTo(p.x, p.y + l);
          ctx.stroke();
          ctx.drawImage(glow(p.c, 32), p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        }
        else if ( square ) {
          ctx.fillStyle = p.c;
          ctx.fillRect(p.x, p.y, p.r, p.r);
        }
        else ctx.drawImage(glow(p.c, 32), p.x - p.r * 2, p.y - p.r * 2, p.r * 4, p.r * 4);
      }
    }
  };
}

/** Falling flat shapes that flutter (leaves, petals, feathers). */
function flutter({ n, colors, size, spd, kind }) {
  return {
    n,
    make(p, s, first) {
      p.x = rand(-20, s.w + 20);
      p.y = first ? rand(-s.h, s.h) : rand(-40, -10);
      p.v = rand(spd[0], spd[1]);
      p.s = rand(size[0], size[1]);
      p.rot = rand(0, TAU);
      p.spin = rand(-2, 2);
      p.ph = rand(0, TAU);
      p.c = pick(colors);
    },
    step(p, dt, s) {
      p.y += p.v * dt;
      p.x += (s.wind * 80 + Math.sin(s.t * 1.3 + p.ph) * 45) * dt;
      p.rot += p.spin * dt;
      if ( p.x > s.w + 40 ) p.x = -40;
      else if ( p.x < -40 ) p.x = s.w + 40;
      return p.y < s.h + 30;
    },
    draw(ctx, list, s) {
      ctx.globalAlpha = 0.92;
      for ( const p of list ) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.sin(s.t * 2 + p.ph)));
        ctx.fillStyle = p.c;
        ctx.beginPath();
        if ( kind === "pena" ) {
          ctx.moveTo(0, -p.s);
          ctx.quadraticCurveTo(p.s * 0.45, 0, 0, p.s);
          ctx.quadraticCurveTo(-p.s * 0.45, 0, 0, -p.s);
          ctx.fill();
          ctx.strokeStyle = "rgba(160,160,170,.8)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, -p.s);
          ctx.lineTo(0, p.s * 1.25);
          ctx.stroke();
        }
        else if ( kind === "folha" ) {
          ctx.moveTo(0, -p.s);
          ctx.quadraticCurveTo(p.s * 0.7, 0, 0, p.s);
          ctx.quadraticCurveTo(-p.s * 0.7, 0, 0, -p.s);
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,.25)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, -p.s);
          ctx.lineTo(0, p.s);
          ctx.stroke();
        }
        else {
          ctx.ellipse(0, 0, p.s, p.s * 0.62, 0, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  };
}

const KINDS = {
  chuva: fallingStreaks({ n: 220, spd: [900, 1300], len: [16, 30], width: 1.2, color: "#b4c8e6", alpha: 0.5 }),
  garoa: fallingStreaks({ n: 130, spd: [600, 820], len: [8, 14], width: 1, color: "#c8d6ea", alpha: 0.35 }),
  tempestade: fallingStreaks({ n: 420, spd: [1300, 1750], len: [26, 42], width: 1.4, color: "#a9bcda", alpha: 0.55, slant: 1.4 }),
  granizo: {
    n: 150,
    make(p, s, first) {
      p.x = rand(-s.w * 0.2, s.w * 1.2);
      p.y = first ? rand(-s.h, s.h) : rand(-60, -5);
      p.v = rand(850, 1150);
      p.r = rand(1.4, 2.6);
    },
    step(p, dt, s) {
      p.x += (s.wind * 300 + 30) * dt;
      p.y += p.v * dt;
      return p.y < s.h + 5;
    },
    draw(ctx, list) {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#f2f8ff";
      ctx.beginPath();
      for ( const p of list ) {
        ctx.moveTo(p.x + p.r, p.y);
        ctx.arc(p.x, p.y, p.r, 0, TAU);
      }
      ctx.fill();
    }
  },
  neve: flakes({ n: 170, spd: [40, 95], r: [1.3, 3.4], color: "#ffffff", alpha: 0.85 }),
  nevasca: flakes({ n: 420, spd: [240, 420], r: [1, 3], color: "#f4f8ff", alpha: 0.85, sway: 60, drift: 380 }),
  cinzas: flakes({ n: 130, spd: [25, 60], r: [1.4, 3], color: "#8f8a86", alpha: 0.75, sway: 40 }),
  areia: horizontal({ n: 260, spd: [700, 1100], len: [18, 60], width: 1.6, color: "#e2b36e", alpha: 0.5 }),
  vento: horizontal({ n: 28, spd: [900, 1400], len: [120, 260], width: 1.5, color: "#ffffff", alpha: 0.22 }),
  poeira: motes({ n: 90, color: "#fff2d6", r: [0.8, 1.8], alpha: 0.45, square: true }),
  polen: motes({ n: 70, color: ["#ffe57a", "#fff2a0"], r: [1.2, 2.4], alpha: 0.8, blink: 0.3 }),
  esporos: motes({ n: 60, color: ["#7affd1", "#b6ff7a"], r: [1.4, 2.8], alpha: 0.75, blink: 0.5, rise: [-25, -10], area: [0.05, 1] }),
  vagalumes: motes({ n: 40, color: ["#eaff7a", "#c8ff6a"], r: [1.8, 3.2], alpha: 1, blink: 0.95, area: [0.3, 1] }),
  faiscas: motes({ n: 60, color: ["#fff6c8", "#ffffff", "#ffe08a"], r: [1.6, 3.4], alpha: 0.95, blink: 0.9, star: true }),
  brasas: motes({ n: 90, color: ["#ffb347", "#ff7a2a", "#ffd27a"], r: [1.2, 2.6], alpha: 1, blink: 0.3, rise: [-120, -40], area: [0.1, 1] }),
  folhas: flutter({ n: 40, colors: ["#5d8f3a", "#8aa83a", "#c98a2f", "#a8632a", "#d9a640"], size: [6, 10], spd: [40, 90], kind: "folha" }),
  petalas: flutter({ n: 60, colors: ["#ffc6dc", "#ffd9e8", "#fff0f6", "#ffb3cf"], size: [3.5, 6], spd: [30, 70], kind: "petala" }),
  penas: flutter({ n: 26, colors: ["#ffffff", "#f4f0ff"], size: [8, 14], spd: [22, 45], kind: "pena" }),
  sementes: {
    n: 30,
    make(p, s, first) {
      p.x = first ? rand(0, s.w) : -20;
      p.y = rand(s.h * 0.1, s.h * 0.95);
      p.vx = rand(25, 70);
      p.vy = rand(-12, 6);
      p.s = rand(5, 9);
      p.ph = rand(0, TAU);
    },
    step(p, dt, s) {
      p.x += (p.vx + s.wind * 60) * dt;
      p.y += (p.vy + Math.sin(s.t + p.ph) * 10) * dt;
      return p.x < s.w + 30 && p.x > -40;
    },
    draw(ctx, list) {
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for ( const p of list ) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y + p.s * 1.4);
        for ( let i = 0; i < 7; i++ ) {
          const a = -Math.PI / 2 + (i - 3) * 0.35;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + Math.cos(a) * p.s, p.y + Math.sin(a) * p.s);
        }
      }
      ctx.stroke();
    }
  },
  bolhas: bubbles(["#cdeeff"], 50),
  estrelas: {
    n: 160,
    make(p, s) {
      p.x = rand(0, s.w);
      p.y = rand(0, s.h * 0.62);
      p.r = rand(0.6, 1.8);
      p.ph = rand(0, TAU);
      p.b = rand(0.8, 2.4);
    },
    step: () => true,
    draw(ctx, list, s) {
      ctx.fillStyle = "#ffffff";
      for ( const p of list ) {
        ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(s.t * p.b + p.ph));
        ctx.fillRect(p.x, p.y, p.r, p.r);
      }
    }
  },
  goteiras: {
    n: 18,
    make(p, s, first) {
      p.x = rand(0, s.w);
      p.y = first ? rand(-s.h * 0.5, s.h * 0.5) : rand(-120, -5);
      p.v = 0;
      p.g = rand(s.h * 0.8, s.h * 0.97);
      p.sp = 0;
    },
    step(p, dt) {
      if ( p.sp ) {
        p.sp += dt;
        return p.sp < 0.45;
      }
      p.v += 1100 * dt;
      p.y += p.v * dt;
      if ( p.y >= p.g ) p.sp = 0.001;
      return true;
    },
    draw(ctx, list) {
      for ( const p of list ) {
        if ( p.sp ) {
          ctx.globalAlpha = 0.6 * (1 - p.sp / 0.45);
          ctx.strokeStyle = "#cfe6ff";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(p.x, p.g, 4 + p.sp * 40, 1.5 + p.sp * 8, 0, 0, TAU);
          ctx.stroke();
          continue;
        }
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = "#d8ecff";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 1.6, 3.6, 0, 0, TAU);
        ctx.fill();
      }
    }
  },
  passaros: fliers({ every: [3, 7], flock: [3, 7], size: [6, 10], speed: [110, 190], color: "rgba(25,25,35,.8)", flap: [6, 9], band: [0.05, 0.4] }),
  morcegos: fliers({ every: [1.5, 4], flock: [4, 9], size: [5, 8], speed: [160, 260], color: "rgba(10,6,16,.9)", flap: [12, 16], band: [0.05, 0.7], erratic: true }),
  cadentes: streakers({ every: [0.8, 3], speed: [900, 1300], tail: [120, 220], head: "#ffffff", tailColor: "#bfe0ff", size: 8 }),
  meteoros: streakers({ every: [1.5, 4], speed: [450, 750], tail: [260, 420], head: "#ffd27a", tailColor: "#ff7a2a", size: 26 })
};

function bubbles(colors, n) {
  return {
    n,
    make(p, s, first) {
      p.x = rand(0, s.w);
      p.y = first ? rand(0, s.h) : s.h + rand(5, 40);
      p.v = rand(30, 80);
      p.r = rand(2.5, 8);
      p.ph = rand(0, TAU);
      p.c = pick(colors);
    },
    step(p, dt, s) {
      p.y -= p.v * dt;
      p.x += Math.sin(s.t * 2 + p.ph) * 18 * dt;
      return p.y > -20;
    },
    draw(ctx, list) {
      ctx.lineWidth = 1.2;
      for ( const p of list ) {
        ctx.globalAlpha = 0.65;
        ctx.strokeStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(p.x - p.r * 0.45, p.y - p.r * 0.5, 1.6, 1.6);
      }
    }
  };
}

/** Occasional groups that cross the screen (birds, bats). */
function fliers({ every, flock, size, speed, color, flap, band, erratic = false }) {
  return {
    n: 0,
    spawner: true,
    spawn(s, list) {
      const dir = s.wind < -0.2 ? -1 : s.wind > 0.2 ? 1 : Math.random() < 0.5 ? -1 : 1;
      const count = Math.round(rand(flock[0], flock[1]));
      const y0 = rand(s.h * band[0], s.h * band[1]);
      const v = rand(speed[0], speed[1]) * dir;
      for ( let i = 0; i < count; i++ ) {
        const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
        list.push({
          x: (dir > 0 ? -40 : s.w + 40) - dir * row * 26 * (erratic ? rand(0.5, 2) : 1),
          y: y0 + (erratic ? rand(-60, 60) : side * row * 14),
          v, s: rand(size[0], size[1]), f: rand(flap[0], flap[1]), ph: rand(0, TAU), wob: erratic ? rand(20, 60) : 4
        });
      }
    },
    every,
    step(p, dt, s) {
      p.x += p.v * dt;
      p.y += Math.sin(s.t * 3 + p.ph) * p.wob * dt;
      return p.v > 0 ? p.x < s.w + 80 : p.x > -80;
    },
    draw(ctx, list, s) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for ( const p of list ) {
        const k = Math.sin(s.t * p.f + p.ph);
        ctx.moveTo(p.x - p.s, p.y - k * p.s * 0.6);
        ctx.quadraticCurveTo(p.x - p.s * 0.45, p.y - p.s * 0.2 - k * p.s * 0.3, p.x, p.y);
        ctx.quadraticCurveTo(p.x + p.s * 0.45, p.y - p.s * 0.2 - k * p.s * 0.3, p.x + p.s, p.y - k * p.s * 0.6);
      }
      ctx.stroke();
    }
  };
}

/** Occasional streaks with a tail (shooting stars, meteors). */
function streakers({ every, speed, tail, head, tailColor, size }) {
  return {
    n: 0,
    spawner: true,
    every,
    spawn(s, list) {
      const dir = s.wind < 0 ? 1 : -1;
      const a = rand(0.35, 0.7);
      const v = rand(speed[0], speed[1]);
      list.push({ x: dir < 0 ? rand(s.w * 0.4, s.w * 1.1) : rand(-s.w * 0.1, s.w * 0.6), y: rand(-40, s.h * 0.2), vx: Math.cos(a) * v * dir, vy: Math.sin(a) * v, l: rand(tail[0], tail[1]), life: 0, max: rand(0.9, 1.6) });
    },
    step(p, dt) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life += dt;
      return p.life < p.max;
    },
    draw(ctx, list) {
      for ( const p of list ) {
        const fade = Math.min(1, (p.max - p.life) / 0.35, p.life / 0.12);
        const sp = Math.hypot(p.vx, p.vy);
        const tx = p.x - (p.vx / sp) * p.l, ty = p.y - (p.vy / sp) * p.l;
        const g = ctx.createLinearGradient(p.x, p.y, tx, ty);
        g.addColorStop(0, rgba(tailColor, 0.9));
        g.addColorStop(1, rgba(tailColor, 0));
        ctx.globalAlpha = fade;
        ctx.strokeStyle = g;
        ctx.lineWidth = size > 12 ? 5 : 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.drawImage(glow(head, 64), p.x - size / 2, p.y - size / 2, size, size);
      }
    }
  };
}

/* ---------------------------------------------------------------------------------------------- */
/* Mana                                                                                             */
/* ---------------------------------------------------------------------------------------------- */

function manaKinds(el) {
  const c = ELEMENTS[el]?.color ?? "#ffffff";
  const out = [motes({ n: 26, color: [c, ELEMENTS[el]?.glow ?? "#ffffff"], r: [1.6, 3.2], alpha: 0.95, blink: 0.4, rise: [-45, -15], area: [0.25, 1] })];
  switch ( el ) {
    case "fire": out.push(motes({ n: 50, color: ["#ffb347", "#ff6a2a"], r: [1.2, 2.4], alpha: 1, blink: 0.4, rise: [-130, -50], area: [0.3, 1] })); break;
    case "ice": out.push(motes({ n: 34, color: ["#e6f9ff", "#9fe8ff"], r: [1.6, 3], alpha: 0.95, blink: 0.9, star: true })); break;
    case "bolt": out.push(sparks(c)); break;
    case "dark": out.push(wisps(["#2a0d3a", "#140821", "#3b1250"], 12)); break;
    case "light": out.push(motes({ n: 40, color: ["#fff6c8", "#ffe7a0"], r: [1.6, 3.2], alpha: 0.95, blink: 0.9, star: true })); break;
    case "earth": out.push(pebbles(["#8a6a3a", "#a5814a", "#6b5232"])); break;
    case "air": out.push(swirls("#d9fff0")); break;
    case "poison": out.push(bubbles(["#e58ac0", "#b36ad6", "#9cd66a"], 30)); break;
    default:
  }
  return out;
}

function sparks(color) {
  return {
    n: 0,
    spawner: true,
    every: [0.08, 0.3],
    spawn(s, list) {
      const x = rand(0, s.w), y = rand(s.h * 0.45, s.h);
      const pts = [[x, y]];
      const arc = Math.random() < 0.18;
      const steps = arc ? 9 : 3;
      const tx = x + rand(-1, 1) * (arc ? 260 : 40), ty = y + rand(-1, 1) * (arc ? 120 : 30);
      for ( let i = 1; i <= steps; i++ ) pts.push([x + ((tx - x) * i) / steps + rand(-12, 12), y + ((ty - y) * i) / steps + rand(-12, 12)]);
      list.push({ pts, life: 0, max: arc ? 0.22 : 0.12, w: arc ? 2.2 : 1.4 });
    },
    step(p, dt) {
      p.life += dt;
      return p.life < p.max;
    },
    draw(ctx, list) {
      for ( const p of list ) {
        ctx.globalAlpha = 1 - p.life / p.max;
        ctx.strokeStyle = color;
        ctx.lineWidth = p.w;
        ctx.beginPath();
        p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
    }
  };
}

function wisps(colors, n) {
  return {
    n,
    make(p, s) {
      p.x = rand(-100, s.w + 100);
      p.y = rand(s.h * 0.3, s.h * 1.05);
      p.vx = rand(-25, 25);
      p.r = rand(90, 200);
      p.ph = rand(0, TAU);
      p.c = pick(colors);
    },
    step(p, dt, s) {
      p.x += (p.vx + s.wind * 20) * dt;
      p.y += Math.sin(s.t * 0.4 + p.ph) * 8 * dt;
      if ( p.x > s.w + 220 ) p.x = -220;
      else if ( p.x < -220 ) p.x = s.w + 220;
      return true;
    },
    draw(ctx, list, s) {
      for ( const p of list ) {
        ctx.globalAlpha = 0.28 + 0.12 * Math.sin(s.t * 0.7 + p.ph);
        ctx.drawImage(glow(p.c, 64, false), p.x - p.r, p.y - p.r * 0.6, p.r * 2, p.r * 1.2);
      }
    }
  };
}

function pebbles(colors) {
  return {
    n: 22,
    make(p, s, first) {
      p.x = rand(0, s.w);
      p.y = first ? rand(s.h * 0.4, s.h) : s.h + rand(5, 30);
      p.v = rand(15, 40);
      p.s = rand(2.5, 6);
      p.rot = rand(0, TAU);
      p.spin = rand(-1, 1);
      p.c = pick(colors);
    },
    step(p, dt) {
      p.y -= p.v * dt;
      p.rot += p.spin * dt;
      return p.y > 0;
    },
    draw(ctx, list, s) {
      for ( const p of list ) {
        ctx.globalAlpha = Math.min(1, p.y / (s.h * 0.35));
        ctx.fillStyle = p.c;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.moveTo(-p.s, -p.s * 0.4);
        ctx.lineTo(-p.s * 0.2, -p.s);
        ctx.lineTo(p.s, -p.s * 0.3);
        ctx.lineTo(p.s * 0.6, p.s * 0.8);
        ctx.lineTo(-p.s * 0.7, p.s * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  };
}

function swirls(color) {
  return {
    n: 12,
    make(p, s) {
      p.x = rand(0, s.w);
      p.y = rand(s.h * 0.2, s.h);
      p.r = rand(20, 60);
      p.a = rand(0, TAU);
      p.sp = rand(1.5, 3) * (Math.random() < 0.5 ? -1 : 1);
      p.vx = rand(40, 90);
    },
    step(p, dt, s) {
      p.a += p.sp * dt;
      p.x += (p.vx * (s.wind < 0 ? -1 : 1)) * dt;
      if ( p.x > s.w + 80 ) p.x = -80;
      else if ( p.x < -80 ) p.x = s.w + 80;
      return true;
    },
    draw(ctx, list) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      for ( const p of list ) {
        ctx.moveTo(p.x + Math.cos(p.a) * p.r, p.y + Math.sin(p.a) * p.r);
        ctx.arc(p.x, p.y, p.r, p.a, p.a + 1.3);
        ctx.moveTo(p.x + Math.cos(p.a + Math.PI) * p.r * 0.6, p.y + Math.sin(p.a + Math.PI) * p.r * 0.6);
        ctx.arc(p.x, p.y, p.r * 0.6, p.a + Math.PI, p.a + Math.PI + 1);
      }
      ctx.stroke();
    }
  };
}

/* ---------------------------------------------------------------------------------------------- */
/* Lightning                                                                                        */
/* ---------------------------------------------------------------------------------------------- */

function boltPath(s) {
  const pts = [[rand(s.w * 0.1, s.w * 0.9), -10]];
  const end = rand(s.h * 0.35, s.h * 0.75);
  while ( pts.at(-1)[1] < end ) {
    const [x, y] = pts.at(-1);
    pts.push([x + rand(-45, 45), y + rand(25, 60)]);
  }
  const branch = [];
  const from = pts[Math.floor(pts.length / 2)];
  let b = [...from];
  branch.push([...b]);
  for ( let i = 0; i < 4; i++ ) {
    b = [b[0] + rand(15, 50) * (Math.random() < 0.5 ? -1 : 1), b[1] + rand(20, 45)];
    branch.push(b);
  }
  return { pts, branch, life: 0, max: 0.32 };
}

/* ---------------------------------------------------------------------------------------------- */
/* Engine                                                                                           */
/* ---------------------------------------------------------------------------------------------- */

export const Weather = {
  box: null,
  canvas: null,
  ctx: null,
  pools: [],
  bolts: [],
  raf: 0,
  last: 0,
  t: 0,
  s: null,
  climate: null,
  flashEl: null,

  /**
   * Show a climate in `box` (the overlay's ambient layer).
   * @param {HTMLElement} box
   * @param {object} climate normalized ({ mana, layers, tint, intensity, wind })
   * @param {{motion?: boolean}} [opts] motion false = only the still washes (tint, glow), no particles
   */
  apply(box, climate, { motion = true } = {}) {
    this.stop();
    this.box = box;
    this.climate = climate;
    box.replaceChildren();
    box.dataset.kind = "";
    const k = climate.intensity;
    const add = (cls, style = "") => {
      const el = document.createElement("div");
      el.className = `bfu-wx ${cls}`;
      if ( style ) el.style.cssText = style;
      box.append(el);
      return el;
    };
    /* washes */
    const tint = TINTS[climate.tint];
    if ( tint?.color ) add("bfu-wx-tint", `background:${tint.color}`);
    if ( tint?.vignette ) add("bfu-wx-vignette", `--v:${tint.vignette}`);
    const layers = new Set(climate.layers);
    const hazes = [];
    if ( layers.has("nevasca") ) hazes.push("rgba(235, 243, 255, .22)");
    if ( layers.has("areia") ) hazes.push("rgba(205, 150, 80, .2)");
    if ( layers.has("tempestade") ) hazes.push("rgba(40, 50, 70, .18)");
    if ( climate.mana.includes("poison") ) hazes.push("rgba(150, 80, 170, .1)");
    for ( const c of hazes ) add("bfu-wx-haze", `background:${c};opacity:${Math.min(1, 0.6 + k * 0.3)}`);
    if ( climate.mana.includes("dark") ) add("bfu-wx-vignette", "--v:rgba(20, 0, 30, .6)");
    if ( climate.mana.includes("ice") ) add("bfu-wx-vignette frost", "--v:rgba(200, 240, 255, .5)");
    /* mana glow on the ground, one spot per element */
    climate.mana.forEach((el, i, all) => {
      const c = ELEMENTS[el]?.color ?? "#ffffff";
      const x = all.length === 1 ? 50 : 15 + (70 * i) / (all.length - 1);
      add("bfu-wx-glow", `--c:${rgba(c, Math.min(0.6, 0.28 * k + 0.08))};--gx:${x}%`);
    });
    if ( layers.has("neblina") ) for ( let i = 0; i < 3; i++ ) add(`bfu-wx-fog f${i}`, `opacity:${Math.min(0.85, 0.35 + 0.25 * k)}`);
    if ( layers.has("bruma") ) add("bfu-wx-mist", `opacity:${Math.min(0.9, 0.45 + 0.25 * k)}`);
    if ( layers.has("aurora") ) add("bfu-wx-aurora", `opacity:${Math.min(0.9, 0.4 + 0.25 * k)}`);
    if ( layers.has("raios") || climate.mana.includes("light") ) add("bfu-wx-rays", `opacity:${Math.min(0.9, 0.35 + 0.25 * k)}`);
    this.flashEl = layers.has("tempestade") || layers.has("relampagos") ? add("bfu-wx-flash") : null;
    box.classList.toggle("still", !motion);
    if ( !motion ) return;

    /* particles */
    const kinds = [];
    for ( const key of climate.layers ) if ( KINDS[key] ) kinds.push(KINDS[key]);
    for ( const el of climate.mana ) kinds.push(...manaKinds(el));
    const storm = layers.has("tempestade") ? "tempestade" : layers.has("relampagos") ? "relampagos" : "";
    if ( !kinds.length && !storm ) return;
    const c = document.createElement("canvas");
    c.className = "bfu-wx-canvas";
    box.append(c);
    this.canvas = c;
    this.ctx = c.getContext("2d");
    this.resize();
    this.s = { w: this.w, h: this.h, t: 0, wind: climate.wind, k, storm, nextBolt: rand(1.5, 4) };
    this.pools = kinds.map(kind => {
      const list = [];
      const n = Math.round(kind.n * k);
      for ( let i = 0; i < n; i++ ) {
        const p = {};
        kind.make(p, this.s, true);
        list.push(p);
      }
      return { kind, list, next: kind.spawner ? rand(0.2, 1.2) : 0 };
    });
    this.bolts = [];
    this.onResize = () => this.resize();
    window.addEventListener("resize", this.onResize);
    this.last = performance.now();
    const tick = now => {
      this.raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(tick);
  },

  resize() {
    if ( !this.canvas ) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if ( this.s ) {
      this.s.w = this.w;
      this.s.h = this.h;
    }
  },

  frame(dt) {
    const s = this.s;
    const ctx = this.ctx;
    if ( !s || !ctx ) return;
    s.t += dt;
    ctx.clearRect(0, 0, s.w, s.h);
    for ( const pool of this.pools ) {
      const { kind, list } = pool;
      if ( kind.spawner ) {
        pool.next -= dt;
        if ( pool.next <= 0 && list.length < 60 ) {
          kind.spawn(s, list);
          pool.next = rand(kind.every[0], kind.every[1]) / Math.max(0.4, s.k);
        }
        for ( let i = list.length - 1; i >= 0; i-- ) if ( !kind.step(list[i], dt, s) ) list.splice(i, 1);
      }
      else {
        for ( const p of list ) if ( !kind.step(p, dt, s) ) kind.make(p, s, false);
      }
      ctx.save();
      kind.draw(ctx, list, s);
      ctx.restore();
    }
    if ( s.storm ) this.lightning(dt);
  },

  lightning(dt) {
    const s = this.s;
    const ctx = this.ctx;
    s.nextBolt -= dt;
    if ( s.nextBolt <= 0 ) {
      s.nextBolt = (s.storm === "tempestade" ? rand(3, 8) : rand(4, 11)) / Math.max(0.5, s.k);
      const visible = s.storm === "tempestade" || Math.random() < 0.7;
      if ( visible ) this.bolts.push(boltPath(s));
      this.flash(visible ? 0.55 : 0.3);
    }
    for ( let i = this.bolts.length - 1; i >= 0; i-- ) {
      const b = this.bolts[i];
      b.life += dt;
      if ( b.life > b.max ) {
        this.bolts.splice(i, 1);
        continue;
      }
      const a = 1 - b.life / b.max;
      ctx.save();
      for ( const [w, al] of [[9, 0.18], [3.2, 0.9]] ) {
        ctx.globalAlpha = al * a;
        ctx.strokeStyle = w > 4 ? "#bcd4ff" : "#ffffff";
        ctx.lineWidth = w;
        ctx.lineJoin = "round";
        ctx.beginPath();
        b.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        ctx.lineWidth = w * 0.5;
        ctx.beginPath();
        b.branch.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      ctx.restore();
    }
  },

  flash(strength = 0.5) {
    const el = this.flashEl;
    if ( !el?.animate ) return;
    el.animate([{ opacity: 0 }, { opacity: strength, offset: 0.08 }, { opacity: strength * 0.2, offset: 0.25 }, { opacity: strength * 0.7, offset: 0.35 }, { opacity: 0 }], { duration: 650, easing: "ease-out" });
  },

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if ( this.onResize ) window.removeEventListener("resize", this.onResize);
    this.onResize = null;
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
    this.pools = [];
    this.bolts = [];
    this.s = null;
    this.flashEl = null;
  }
};
