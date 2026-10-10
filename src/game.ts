export const FIELD_W = 1280;
export const FIELD_H = 720;
export const FIELD_CX = 640;
export const FIELD_CY = 360;
export const BALL_R = 11;
export const SERVE_SPEED = 520;
export const SPEED_MULT = 1.04;
export const SPEED_CAP = 980;
export const MAX_SUBSTEP = 4;
export const PADDLE_W = 16;
export const PADDLE_H = 110;
export const PADDLE_HALF = 55;
export const PADDLE_MIN_CY = 55;
export const PADDLE_MAX_CY = 665;
export const PADDLE_SPEED = 720;
export const MAX_BOUNCE_ANGLE = (55 * Math.PI) / 180;
export const SPIN_FROM_PADDLE = 0.85;
export const SPIN_CLAMP = 900;
export const SPIN_HALFLIFE = 0.8;
export const HOLD_TIME = 1;
export const SERVE_ANGLE = (12 * Math.PI) / 180;
export const TRAIL_TIME = 0.13;
export const WIN_SCORE = 11;
export const WIN_LEAD = 2;
export const OBSTACLE_CENTERS = [
  { cx: 490, cy: 220 },
  { cx: 790, cy: 500 },
] as const;
export const OBSTACLE_W = 20;
export const OBSTACLE_H = 140;
export const NET_X = 640;

export type Side = "left" | "right";
export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";
export type Mode = "solo" | "versus";
export type Action =
  | "p1-up"
  | "p1-down"
  | "p2-up"
  | "p2-down"
  | "confirm"
  | "back"
  | "pause"
  | "mute";

export interface InputFrame {
  held: Partial<Record<Action, boolean>>;
  pressed: Partial<Record<Action, boolean>>;
  pointer?: {
    x: number;
    y: number;
    down: boolean;
    pressed: boolean;
    released: boolean;
  };
  touch?: {
    x: number;
    y: number;
    down: boolean;
    pressed: boolean;
    released: boolean;
  };
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  held: boolean;
  holdTimer: number;
  serveSign: 1 | -1;
  trail: { x: number; y: number; t: number }[];
}
export interface Paddle {
  cy: number;
  vy: number;
  driven: boolean;
  drivenVy: number;
}
export interface GameState {
  screen: Screen;
  mode: Mode;
  menuIndex: number;
  titleIndex: number;
  resumeScreen: "countdown" | "playing";
  score: { p1: number; p2: number };
  winner: Side | null;
  receiver: Side;
  paddles: { left: Paddle; right: Paddle };
  ai: { tracking: boolean; movement: boolean };
  ball: Ball | null;
  obstacles: { index: number; cx: number; cy: number }[];
  simTime: number;
  muted: boolean;
}

const emptyHeld = (): Record<Action, boolean> => ({
  "p1-up": false,
  "p1-down": false,
  "p2-up": false,
  "p2-down": false,
  confirm: false,
  back: false,
  pause: false,
  mute: false,
});
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const randomSign = (): 1 | -1 => (Math.random() < 0.5 ? -1 : 1);

export function newBall(): Ball {
  return {
    x: FIELD_CX,
    y: FIELD_CY,
    vx: 0,
    vy: 0,
    spin: 0,
    held: true,
    holdTimer: HOLD_TIME,
    serveSign: randomSign(),
    trail: [],
  };
}
export function initialState(muted = false): GameState {
  return {
    screen: "title",
    mode: "solo",
    menuIndex: 0,
    titleIndex: 0,
    resumeScreen: "playing",
    score: { p1: 0, p2: 0 },
    winner: null,
    receiver: "left",
    paddles: {
      left: { cy: FIELD_CY, vy: 0, driven: false, drivenVy: 0 },
      right: { cy: FIELD_CY, vy: 0, driven: false, drivenVy: 0 },
    },
    ai: { tracking: true, movement: true },
    ball: newBall(),
    obstacles: OBSTACLE_CENTERS.map((p, index) => ({ index, ...p })),
    simTime: 0,
    muted,
  };
}

export class CaromGame {
  state: GameState;
  autoStep = true;
  private actions = emptyHeld();
  private cue?: (
    name: "paddle-hit" | "wall-bounce" | "obstacle-bounce" | "score",
  ) => void;
  constructor(muted = false, cue?: CaromGame["cue"]) {
    this.state = initialState(muted);
    this.cue = cue;
  }
  setInput(
    held: Partial<Record<Action, boolean>>,
    pointer?: InputFrame["pointer"],
    touch?: InputFrame["touch"],
  ) {
    this.actions = { ...this.actions, ...held };
    this.inputFrame = {
      held: this.actions,
      pressed: emptyHeld(),
      pointer,
      touch,
    };
  }
  private inputFrame: InputFrame = { held: emptyHeld(), pressed: emptyHeld() };
  setCue(cue: CaromGame["cue"]) {
    this.cue = cue;
  }
  snapshot() {
    const s = this.state;
    const b = s.ball;
    return {
      version: 1,
      screen: s.screen,
      mode: s.mode,
      menuIndex: s.menuIndex,
      titleIndex: s.titleIndex,
      resumeScreen: s.resumeScreen,
      score: { ...s.score },
      winner: s.winner,
      muted: s.muted,
      paddles: { left: { ...s.paddles.left }, right: { ...s.paddles.right } },
      ai: { ...s.ai },
      receiver: s.receiver,
      ball: b
        ? {
            ...b,
            trail: b.trail.map((p) => ({ ...p })),
            speed: Math.hypot(b.vx, b.vy),
          }
        : null,
      obstacles: s.obstacles.map((o) => ({ ...o })),
      autoStep: this.autoStep,
      simTime: s.simTime,
    };
  }
  update(dt: number, frame?: Partial<InputFrame>) {
    const input = frame ?? this.inputFrame;
    const held = { ...emptyHeld(), ...input.held };
    const pressed = { ...emptyHeld(), ...input.pressed };
    this.state.simTime += dt;
    if (pressed.mute) this.state.muted = !this.state.muted;
    const screenAtStart = this.state.screen;
    this.handleMenus(held, pressed, input.pointer, input.touch);
    if (
      screenAtStart === "paused" ||
      screenAtStart === "title" ||
      screenAtStart === "howto" ||
      screenAtStart === "matchover"
    )
      return;
    if (
      pressed.pause &&
      (this.state.screen === "playing" || this.state.screen === "countdown")
    ) {
      this.state.resumeScreen = this.state.screen;
      this.state.screen = "paused";
      this.state.menuIndex = 0;
      return;
    }
    this.movePaddles(dt, held);
    if (!this.state.ball) return;
    if (this.state.screen === "countdown") this.updateCountdown(dt);
    else if (this.state.screen === "playing") this.updatePlaying(dt);
  }
  private handleMenus(
    held: Record<Action, boolean>,
    pressed: Record<Action, boolean>,
    pointer?: InputFrame["pointer"],
    touch?: InputFrame["touch"],
  ) {
    const s = this.state;
    const up = pressed["p1-up"] || pressed["p2-up"];
    const down = pressed["p1-down"] || pressed["p2-down"];
    const rect = (i: number) => this.menuItemRect(i);
    const pointerIndex = (p?: {
      x: number;
      y: number;
      down: boolean;
      pressed: boolean;
      released: boolean;
    }) =>
      p
        ? Array.from({ length: this.menuCount() }, (_, i) => i).find((i) => {
            const r = rect(i);
            return (
              r &&
              p.x >= r.x &&
              p.x <= r.x + r.w &&
              p.y >= r.y &&
              p.y <= r.y + r.h
            );
          })
        : undefined;
    if (
      s.screen === "title" ||
      s.screen === "howto" ||
      s.screen === "paused" ||
      s.screen === "matchover"
    ) {
      if (s.screen === "paused" && (pressed.pause || pressed.back)) {
        s.screen = s.resumeScreen;
        return;
      }
      if (s.screen === "howto" && (pressed.confirm || pressed.back)) {
        this.toTitle();
        return;
      }
      if (up)
        s.menuIndex = (s.menuIndex + this.menuCount() - 1) % this.menuCount();
      else if (down) s.menuIndex = (s.menuIndex + 1) % this.menuCount();
      const pi = pointerIndex(pointer);
      const ti = pointerIndex(touch);
      const chosen = ti ?? pi;
      if (chosen !== undefined) s.menuIndex = chosen;
      const confirmPointer = (p?: InputFrame["pointer"]) =>
        p?.released && p.pressed && pointerIndex(p) === s.menuIndex;
      if (
        pressed.confirm ||
        confirmPointer(pointer) ||
        (touch?.released && touch.pressed && ti === s.menuIndex)
      )
        this.confirmMenu();
    }
    void held;
  }
  private menuCount() {
    return this.state.screen === "title"
      ? 3
      : this.state.screen === "howto"
        ? 1
        : this.state.screen === "matchover"
          ? 2
          : 3;
  }
  menuItemRect(index: number) {
    if (
      index < 0 ||
      index >= this.menuCount() ||
      this.state.screen === "countdown" ||
      this.state.screen === "playing"
    )
      return null;
    const count = this.menuCount();
    return { x: 450, y: 390 + index * 62 - (count - 1) * 31, w: 380, h: 48 };
  }
  private confirmMenu() {
    const s = this.state;
    if (s.screen === "title") {
      s.titleIndex = s.menuIndex;
      if (s.menuIndex === 0) this.startMatch("solo");
      else if (s.menuIndex === 1) this.startMatch("versus");
      else s.screen = "howto";
    } else if (s.screen === "paused") {
      if (s.menuIndex === 0) s.screen = s.resumeScreen;
      else if (s.menuIndex === 1) this.startMatch(s.mode);
      else this.toTitle();
    } else if (s.screen === "matchover") {
      if (s.menuIndex === 0) this.startMatch(s.mode);
      else this.toTitle();
    } else if (s.screen === "howto") this.toTitle();
  }
  startMatch(mode: Mode) {
    const keepMute = this.state.muted;
    this.state = initialState(keepMute);
    this.state.mode = mode;
    this.state.screen = "countdown";
    this.state.resumeScreen = "playing";
  }
  toTitle() {
    const keep = {
      muted: this.state.muted,
      auto: this.autoStep,
      titleIndex: this.state.titleIndex,
      simTime: this.state.simTime,
    };
    this.state = initialState(keep.muted);
    this.state.titleIndex = keep.titleIndex;
    this.state.menuIndex = keep.titleIndex;
    this.state.simTime = keep.simTime;
    this.autoStep = keep.auto;
  }
  private movePaddles(dt: number, held: Record<Action, boolean>) {
    const s = this.state;
    this.movePaddle(s.paddles.left, this.leftVy(held), dt);
    if (s.paddles.right.driven)
      this.movePaddle(s.paddles.right, s.paddles.right.drivenVy, dt);
    else if (s.mode === "solo") {
      let target = 360;
      let deadzone = 18;
      if (s.ai.tracking && s.screen === "playing" && s.ball && s.ball.vx > 0) {
        target = s.ball.y - s.ball.vy * 0.12;
        deadzone = 10;
      }
      const diff = target - s.paddles.right.cy;
      const vy =
        s.ai.movement && Math.abs(diff) > deadzone
          ? Math.sign(diff) * Math.min(560, Math.abs(diff) / dt)
          : 0;
      this.movePaddle(s.paddles.right, vy, dt);
    } else this.movePaddle(s.paddles.right, this.rightVy(held), dt);
  }
  private leftVy(h: Record<Action, boolean>) {
    const up =
      this.state.mode === "solo" ? h["p1-up"] || h["p2-up"] : h["p1-up"];
    const down =
      this.state.mode === "solo" ? h["p1-down"] || h["p2-down"] : h["p1-down"];
    return (Number(down) - Number(up)) * PADDLE_SPEED;
  }
  private rightVy(h: Record<Action, boolean>) {
    return (Number(h["p2-down"]) - Number(h["p2-up"])) * PADDLE_SPEED;
  }
  private movePaddle(p: Paddle, vy: number, dt: number) {
    if (p.driven) vy = p.drivenVy;
    p.vy = vy;
    const old = p.cy;
    const next = clamp(old + vy * dt, PADDLE_MIN_CY, PADDLE_MAX_CY);
    p.cy = next;
    if (dt > 0 && next !== old + vy * dt) p.vy = (next - old) / dt;
  }
  private updateCountdown(dt: number) {
    const b = this.state.ball;
    if (!b) return;
    b.holdTimer -= dt;
    b.x = FIELD_CX;
    b.y = FIELD_CY;
    b.trail.push({ x: b.x, y: b.y, t: this.state.simTime });
    this.trimTrail(b);
    if (b.holdTimer <= 0) {
      b.holdTimer = 0;
      b.held = false;
      const dir = this.state.receiver === "left" ? -1 : 1;
      b.vx = dir * SERVE_SPEED * Math.cos(SERVE_ANGLE);
      b.vy = b.serveSign * SERVE_SPEED * Math.sin(SERVE_ANGLE);
      this.state.screen = "playing";
      b.trail = [];
    }
  }
  private updatePlaying(dt: number) {
    const b = this.state.ball;
    if (!b) return;
    const n = Math.max(
      1,
      Math.ceil((Math.hypot(b.vx, b.vy) * dt) / MAX_SUBSTEP),
    );
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.stepBall(b, h);
      if (!this.state.ball) return;
    }
    b.trail.push({ x: b.x, y: b.y, t: this.state.simTime });
    this.trimTrail(b);
    if (b.x - BALL_R > FIELD_W) this.point("left");
    else if (b.x + BALL_R < 0) this.point("right");
  }
  private trimTrail(b: Ball) {
    while (b.trail.length && b.trail[0].t < this.state.simTime - TRAIL_TIME)
      b.trail.shift();
  }
  private stepBall(b: Ball, h: number) {
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const a = (b.spin / speed) * h;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const vx = b.vx * c - b.vy * s;
      b.vy = b.vx * s + b.vy * c;
      b.vx = vx;
    }
    b.spin *= Math.pow(0.5, h / SPIN_HALFLIFE);
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.y - BALL_R < 0 && b.vy < 0) {
      b.y = BALL_R;
      b.vy = -b.vy;
      this.cue?.("wall-bounce");
    } else if (b.y + BALL_R > FIELD_H && b.vy > 0) {
      b.y = FIELD_H - BALL_R;
      b.vy = -b.vy;
      this.cue?.("wall-bounce");
    }
    this.collidePaddle(b, "left");
    this.collidePaddle(b, "right");
    this.collideObstacle(b, 0);
    this.collideObstacle(b, 1);
  }
  private collidePaddle(b: Ball, side: Side) {
    const p = this.state.paddles[side];
    const x0 = side === "left" ? 48 : 1216;
    const x1 = side === "left" ? 64 : 1232;
    this.collideRect(
      b,
      x0,
      x1,
      p.cy - PADDLE_HALF,
      p.cy + PADDLE_HALF,
      (face) => {
        if (face === "left" || face === "right") {
          const offset = clamp((b.y - p.cy) / PADDLE_HALF, -1, 1);
          const theta = offset * MAX_BOUNCE_ANGLE;
          const speed = Math.min(
            Math.hypot(b.vx, b.vy) * SPEED_MULT,
            SPEED_CAP,
          );
          const dir = side === "left" ? 1 : -1;
          b.vx = dir * speed * Math.cos(theta);
          b.vy = speed * Math.sin(theta);
          b.spin = clamp(
            b.spin + p.vy * SPIN_FROM_PADDLE,
            -SPIN_CLAMP,
            SPIN_CLAMP,
          );
          b.x = side === "left" ? x1 + BALL_R : x0 - BALL_R;
          this.cue?.("paddle-hit");
        } else this.cue?.("wall-bounce");
      },
    );
  }
  private collideObstacle(b: Ball, index: number) {
    const o = this.state.obstacles.find((v) => v.index === index);
    if (!o) return;
    this.collideRect(b, o.cx - 10, o.cx + 10, o.cy - 70, o.cy + 70, () =>
      this.cue?.("obstacle-bounce"),
    );
  }
  private collideRect(
    b: Ball,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    hit: (face: "left" | "right" | "top" | "bottom") => void,
  ) {
    const left = b.x - (x0 - BALL_R);
    const right = x1 + BALL_R - b.x;
    const top = b.y - (y0 - BALL_R);
    const bottom = y1 + BALL_R - b.y;
    if (left <= 0 || right <= 0 || top <= 0 || bottom <= 0) return;
    const depths = [left, right, top, bottom];
    const face = (["left", "right", "top", "bottom"] as const)[
      depths.indexOf(Math.min(...depths))
    ];
    if (face === "left") {
      b.x = x0 - BALL_R;
      if (b.vx > 0) b.vx = -b.vx;
    } else if (face === "right") {
      b.x = x1 + BALL_R;
      if (b.vx < 0) b.vx = -b.vx;
    } else if (face === "top") {
      b.y = y0 - BALL_R;
      if (b.vy > 0) b.vy = -b.vy;
    } else {
      b.y = y1 + BALL_R;
      if (b.vy < 0) b.vy = -b.vy;
    }
    hit(face);
  }
  private point(scorer: Side) {
    const s = this.state;
    s.score[scorer === "left" ? "p1" : "p2"]++;
    if (
      (s.score.p1 >= WIN_SCORE && s.score.p1 - s.score.p2 >= WIN_LEAD) ||
      (s.score.p2 >= WIN_SCORE && s.score.p2 - s.score.p1 >= WIN_LEAD)
    ) {
      s.winner = scorer;
      s.screen = "matchover";
      s.menuIndex = 0;
      this.cue?.("score");
      return;
    }
    s.receiver = scorer === "left" ? "right" : "left";
    this.spawnBall();
    s.screen = "countdown";
    this.cue?.("score");
  }
  spawnBall() {
    const b = newBall();
    this.state.ball = b;
  }
  reset() {
    const mute = this.state.muted;
    this.state = initialState(mute);
  }
  reconcile() {}
  clearWorld() {
    this.state.ball = null;
    this.state.obstacles = [];
  }
  spawnObstacle(index: number) {
    if (index !== 0 && index !== 1) throw new Error("invalid obstacle index");
    const p = OBSTACLE_CENTERS[index];
    const found = this.state.obstacles.find((o) => o.index === index);
    if (found) Object.assign(found, p);
    else this.state.obstacles.push({ index, ...p });
    this.state.obstacles.sort((a, b) => a.index - b.index);
  }
}
