import {
  CaromGame,
  FIELD_H,
  FIELD_W,
  NET_X,
  OBSTACLE_H,
  OBSTACLE_W,
  PADDLE_H,
  PADDLE_W,
  BALL_R,
  type Action,
  type Screen,
  type Side,
  type Mode,
} from "./game";

const stage = document.querySelector<HTMLCanvasElement>("#stage")!;
if (!stage) throw new Error("Carom canvas is missing");
const context = stage.getContext("2d");
if (!context) throw new Error("Carom needs a 2D stage");
const ctx = context;

const keys: Record<Action, boolean> = {
  "p1-up": false,
  "p1-down": false,
  "p2-up": false,
  "p2-down": false,
  confirm: false,
  back: false,
  pause: false,
  mute: false,
};
const codeMap: Record<string, Action> = {
  KeyW: "p1-up",
  KeyS: "p1-down",
  ArrowUp: "p2-up",
  ArrowDown: "p2-down",
  Enter: "confirm",
  Space: "confirm",
  Escape: "back",
  KeyP: "pause",
  KeyM: "mute",
};
const justPressed = new Set<Action>();
const pointer = { x: 0, y: 0, down: false, pressed: false, released: false };
let touch = { x: 0, y: 0, down: false, pressed: false, released: false };
let autoStep = true;
let debug = false;
let audio: AudioContext | undefined;

function armAudio() {
  if (!audio) audio = new AudioContext();
  if (audio.state === "suspended") void audio.resume();
}
function cue(name: "paddle-hit" | "wall-bounce" | "obstacle-bounce" | "score") {
  if (game.state.muted || !audio) return;
  const frequencies = {
    "paddle-hit": 220,
    "wall-bounce": 150,
    "obstacle-bounce": 310,
    score: 520,
  };
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = frequencies[name];
  osc.type = name === "score" ? "triangle" : "sine";
  gain.gain.setValueAtTime(0.045, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.09);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + 0.1);
}
const game = new CaromGame(false, cue);

function fit() {
  const dpr = window.devicePixelRatio || 1;
  stage.width = Math.max(1, Math.floor(innerWidth * dpr));
  stage.height = Math.max(1, Math.floor(innerHeight * dpr));
}
function logicalPoint(e: PointerEvent | Touch) {
  const scale = Math.min(innerWidth / FIELD_W, innerHeight / FIELD_H);
  return {
    x: (e.clientX - (innerWidth - FIELD_W * scale) / 2) / scale,
    y: (e.clientY - (innerHeight - FIELD_H * scale) / 2) / scale,
  };
}
function setPointer(e: PointerEvent, phase: "move" | "down" | "up") {
  const p = logicalPoint(e);
  pointer.x = p.x;
  pointer.y = p.y;
  pointer.down = phase !== "up";
  pointer.pressed = phase === "down";
  pointer.released = phase === "up";
  if (phase === "down") armAudio();
}
window.addEventListener("resize", fit);
fit();
window.addEventListener("keydown", (e) => {
  const action = codeMap[e.code];
  if (action) {
    if (!keys[action]) justPressed.add(action);
    keys[action] = true;
    e.preventDefault();
    armAudio();
  }
  if (e.code === "Backquote") debug = !debug;
});
window.addEventListener("keyup", (e) => {
  const action = codeMap[e.code];
  if (action) keys[action] = false;
});
stage.addEventListener("pointermove", (e) => setPointer(e, "move"));
stage.addEventListener("pointerdown", (e) => setPointer(e, "down"));
stage.addEventListener("pointerup", (e) => setPointer(e, "up"));
stage.addEventListener("pointerleave", () => {
  pointer.down = false;
});
stage.addEventListener(
  "touchstart",
  (e) => {
    const p = logicalPoint(e.touches[0]);
    touch = { ...p, down: true, pressed: true, released: false };
    armAudio();
  },
  { passive: true },
);
stage.addEventListener(
  "touchmove",
  (e) => {
    const p = logicalPoint(e.touches[0]);
    touch = { ...p, down: true, pressed: false, released: false };
  },
  { passive: true },
);
stage.addEventListener(
  "touchend",
  (e) => {
    const p = e.changedTouches[0] ? logicalPoint(e.changedTouches[0]) : touch;
    touch = { ...p, down: false, pressed: false, released: true };
  },
  { passive: true },
);

function frame(dt: number) {
  const pressed = Object.fromEntries(
    Object.keys(keys).map((k) => [k, justPressed.has(k as Action)]),
  ) as Record<Action, boolean>;
  game.update(dt, {
    held: { ...keys },
    pressed,
    pointer: { ...pointer },
    touch: { ...touch },
  });
  justPressed.clear();
  pointer.pressed = false;
  pointer.released = false;
  touch.pressed = false;
  touch.released = false;
  render();
}
function render() {
  const dpr = window.devicePixelRatio || 1;
  const scale = Math.min(innerWidth / FIELD_W, innerHeight / FIELD_H);
  const ox = (innerWidth - FIELD_W * scale) / 2;
  const oy = (innerHeight - FIELD_H * scale) / 2;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  ctx.clearRect(0, 0, FIELD_W, FIELD_H);
  drawField();
  const s = game.state;
  if (s.screen === "title") drawTitle();
  else if (s.screen === "howto") drawHowTo();
  else {
    drawMatch();
    if (s.screen === "countdown") drawCountdown();
    if (s.screen === "paused") drawPause();
    if (s.screen === "matchover") drawMatchOver();
  }
  if (debug) drawDiagnostics();
}
function drawField() {
  const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
  g.addColorStop(0, "#08121f");
  g.addColorStop(1, "#101c2e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  ctx.strokeStyle = "rgba(130,180,215,.12)";
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, FIELD_W - 48, FIELD_H - 48);
  ctx.setLineDash([12, 18]);
  ctx.strokeStyle = "rgba(125,183,214,.28)";
  ctx.beginPath();
  ctx.moveTo(NET_X, 34);
  ctx.lineTo(NET_X, FIELD_H - 34);
  ctx.stroke();
  ctx.setLineDash([]);
}
function glow(color: string, blur = 16) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
}
function drawMatch() {
  const s = game.state;
  for (const o of s.obstacles) {
    glow("#f2b84b", 12);
    roundRect(
      o.cx - OBSTACLE_W / 2,
      o.cy - OBSTACLE_H / 2,
      OBSTACLE_W,
      OBSTACLE_H,
      10,
    );
    ctx.fill();
  }
  glow("#4ee0c1", 16);
  roundRect(48, s.paddles.left.cy - PADDLE_H / 2, PADDLE_W, PADDLE_H, 8);
  ctx.fill();
  glow("#ff668d", 16);
  roundRect(1216, s.paddles.right.cy - PADDLE_H / 2, PADDLE_W, PADDLE_H, 8);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (s.ball) {
    const b = s.ball;
    for (let i = 0; i < b.trail.length; i++) {
      const t = b.trail[i];
      ctx.globalAlpha = (i / b.trail.length) * 0.35;
      ctx.fillStyle = "#f5f9ff";
      ctx.beginPath();
      ctx.arc(t.x, t.y, BALL_R * (i / b.trail.length) * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    glow("#f5f9ff", 18);
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.fillStyle = "#eaf3ff";
  ctx.textAlign = "center";
  ctx.font = "800 72px system-ui";
  ctx.fillText(String(s.score.p1).padStart(2, "0"), 520, 96);
  ctx.fillText(String(s.score.p2).padStart(2, "0"), 760, 96);
  ctx.font = "700 14px system-ui";
  ctx.fillStyle = "#86a6be";
  ctx.fillText(
    s.mode === "solo" ? "SOLO // RALLY" : "VERSUS // LOCAL DUEL",
    640,
    45,
  );
  ctx.textAlign = "left";
}
function drawTitle() {
  ctx.textAlign = "center";
  ctx.fillStyle = "#eaf3ff";
  ctx.font = "900 104px system-ui";
  ctx.fillText("CAROM", 640, 220);
  ctx.fillStyle = "#62ddc5";
  ctx.font = "700 16px system-ui";
  ctx.fillText("SPIN. BANK. OUTPLAY.", 640, 254);
  menu(["SOLO", "VERSUS", "HOW TO PLAY"]);
  ctx.font = "500 13px system-ui";
  ctx.fillStyle = "#7792a6";
  ctx.fillText("W/S or ↑/↓ to move  ·  P to pause  ·  M to mute", 640, 650);
  ctx.textAlign = "left";
}
function drawHowTo() {
  ctx.textAlign = "center";
  ctx.fillStyle = "#eaf3ff";
  ctx.font = "900 54px system-ui";
  ctx.fillText("HOW TO PLAY", 640, 150);
  ctx.textAlign = "left";
  ctx.fillStyle = "#a9c2d4";
  ctx.font = "500 20px system-ui";
  ctx.fillText(
    "Move your paddle into the ball to return it across the field.",
    250,
    240,
  );
  ctx.fillText(
    "Your paddle motion adds spin: curve rallies around the gold banks.",
    250,
    280,
  );
  ctx.fillText("First to 11, with a two-point lead, wins the duel.", 250, 320);
  ctx.fillStyle = "#62ddc5";
  ctx.font = "700 17px system-ui";
  ctx.fillText("PLAYER ONE", 250, 400);
  ctx.fillStyle = "#eaf3ff";
  ctx.font = "500 18px system-ui";
  ctx.fillText("W / S", 250, 435);
  ctx.fillStyle = "#ff668d";
  ctx.font = "700 17px system-ui";
  ctx.fillText("PLAYER TWO", 700, 400);
  ctx.fillStyle = "#eaf3ff";
  ctx.font = "500 18px system-ui";
  ctx.fillText("↑ / ↓", 700, 435);
  ctx.textAlign = "center";
  menu(["BACK TO TITLE"]);
  ctx.textAlign = "left";
}
function menu(items: string[]) {
  items.forEach((label, i) => {
    const r = game.menuItemRect(i);
    if (!r) return;
    const selected = game.state.menuIndex === i;
    ctx.fillStyle = selected ? "#62ddc5" : "rgba(130,170,195,.16)";
    roundRect(r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.fillStyle = selected ? "#06121c" : "#b8cbd8";
    ctx.font = "800 18px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(label, r.x + r.w / 2, r.y + 31);
  });
}
function drawCountdown() {
  ctx.fillStyle = "rgba(3,10,18,.38)";
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f5f9ff";
  ctx.font = "900 38px system-ui";
  ctx.fillText("GET READY", 640, 280);
  ctx.fillStyle = "#62ddc5";
  ctx.font = "700 17px system-ui";
  ctx.fillText("FIRST SERVE TO PLAYER ONE", 640, 315);
  ctx.textAlign = "left";
}
function drawPause() {
  overlay("PAUSED", ["RESUME", "RESTART", "QUIT TO MENU"]);
}
function drawMatchOver() {
  const s = game.state;
  overlay(s.winner === "left" ? "PLAYER ONE WINS" : "PLAYER TWO WINS", [
    "PLAY AGAIN",
    "MENU",
  ]);
  ctx.textAlign = "center";
  ctx.fillStyle = "#eaf3ff";
  ctx.font = "800 22px system-ui";
  ctx.fillText(`${s.score.p1}  —  ${s.score.p2}`, 640, 280);
  ctx.textAlign = "left";
}
function overlay(title: string, items: string[]) {
  ctx.fillStyle = "rgba(3,10,18,.78)";
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#eaf3ff";
  ctx.font = "900 56px system-ui";
  ctx.fillText(title, 640, 210);
  menu(items);
  ctx.textAlign = "left";
}
function drawDiagnostics() {
  const s = game.snapshot();
  ctx.fillStyle = "rgba(3,8,14,.86)";
  ctx.fillRect(20, 20, 300, 240);
  ctx.fillStyle = "#9fe8d7";
  ctx.font = "12px monospace";
  const b = s.ball;
  const lines = [
    `screen ${s.screen} / ${s.mode}`,
    `score ${s.score.p1} : ${s.score.p2}`,
    `ball ${b ? `${b.x.toFixed(1)},${b.y.toFixed(1)}` : "none"}`,
    `velocity ${b ? `${b.vx.toFixed(1)},${b.vy.toFixed(1)}` : "-"}`,
    `speed ${b?.speed.toFixed(1) ?? "-"} spin ${b?.spin.toFixed(1) ?? "-"}`,
    `left ${s.paddles.left.cy.toFixed(1)} / ${s.paddles.left.vy.toFixed(1)}`,
    `right ${s.paddles.right.cy.toFixed(1)} / ${s.paddles.right.vy.toFixed(1)}`,
  ];
  lines.forEach((line, i) => ctx.fillText(line, 34, 46 + i * 25));
}
function roundRect(x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

let last = performance.now();
function tick(now: number) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (autoStep) frame(dt);
  else render();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

const api = {
  version: 1,
  setAutoStep(enabled: boolean) {
    autoStep = enabled;
    game.autoStep = enabled;
  },
  advance(seconds: number, frames = 1) {
    const n = Math.max(1, Math.floor(frames));
    for (let i = 0; i < n; i++) frame(seconds / n);
  },
  clearWorld: () => game.clearWorld(),
  spawnBall: () => game.spawnBall(),
  spawnObstacle: (index: number) => game.spawnObstacle(index),
  reset: () => game.reset(),
  reconcile: () => game.reconcile(),
  setScreen: (screen: Screen) => {
    game.state.screen = screen;
  },
  setMode: (mode: Mode) => {
    game.state.mode = mode;
  },
  setMenuIndex: (index: number) => {
    game.state.menuIndex = index;
  },
  setTitleIndex: (index: number) => {
    game.state.titleIndex = index;
  },
  setResumeScreen: (screen: "countdown" | "playing") => {
    game.state.resumeScreen = screen;
  },
  setScore: (p1: number, p2: number) => {
    game.state.score = { p1, p2 };
  },
  setWinner: (side: Side | null) => {
    game.state.winner = side;
  },
  setReceiver: (side: Side) => {
    game.state.receiver = side;
  },
  setPaddleCy: (side: Side, cy: number) => {
    game.state.paddles[side].cy = cy;
  },
  setPaddleVy: (side: Side, vy: number) => {
    game.state.paddles[side].drivenVy = vy;
  },
  setPaddleDriven: (side: Side, driven: boolean) => {
    game.state.paddles[side].driven = driven;
  },
  setBallPosition: (x: number, y: number) => {
    if (!game.state.ball) throw new Error("no ball");
    game.state.ball.x = x;
    game.state.ball.y = y;
  },
  setBallVelocity: (vx: number, vy: number) => {
    if (!game.state.ball) throw new Error("no ball");
    game.state.ball.vx = vx;
    game.state.ball.vy = vy;
  },
  setBallSpin: (spin: number) => {
    if (!game.state.ball) throw new Error("no ball");
    game.state.ball.spin = spin;
  },
  setBallHeld: (held: boolean) => {
    if (!game.state.ball) throw new Error("no ball");
    game.state.ball.held = held;
  },
  setBallHoldTimer: (seconds: number) => {
    if (!game.state.ball) throw new Error("no ball");
    game.state.ball.holdTimer = seconds;
  },
  setBallServeSign: (sign: 1 | -1) => {
    if (!game.state.ball || (sign !== 1 && sign !== -1))
      throw new Error("invalid ball");
    game.state.ball.serveSign = sign;
  },
  drawBallServeSign: () => {
    if (!game.state.ball) throw new Error("no ball");
    game.state.ball.serveSign = Math.random() < 0.5 ? -1 : 1;
  },
  setAiTracking: (enabled: boolean) => {
    game.state.ai.tracking = enabled;
  },
  setAiMovement: (enabled: boolean) => {
    game.state.ai.movement = enabled;
  },
  setMuted: (muted: boolean) => {
    game.state.muted = muted;
  },
  snapshot: () => game.snapshot(),
  menuItemRect: (index: number) => game.menuItemRect(index),
};
(window as unknown as { __carom: typeof api }).__carom = api;
render();
