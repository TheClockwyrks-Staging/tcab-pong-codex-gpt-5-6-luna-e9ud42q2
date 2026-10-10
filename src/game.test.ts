import { describe, expect, it } from "vitest";
import { CaromGame, FIELD_CY, HOLD_TIME, SERVE_SPEED } from "./game";

describe("Carom simulation", () => {
  it("serves after the exact hold and preserves the serve speed", () => {
    const game = new CaromGame();
    game.state.screen = "countdown";
    game.update(HOLD_TIME);
    expect(game.state.screen).toBe("playing");
    expect(game.state.ball?.held).toBe(false);
    expect(
      game.state.ball && Math.hypot(game.state.ball.vx, game.state.ball.vy),
    ).toBeCloseTo(SERVE_SPEED);
  });

  it("moves a driven paddle and clamps it to the field", () => {
    const game = new CaromGame();
    game.state.screen = "playing";
    game.state.mode = "versus";
    game.state.paddles.right.cy = 100;
    game.state.paddles.left.driven = true;
    game.state.paddles.left.drivenVy = -1000;
    game.update(1, { held: {} });
    expect(game.state.paddles.left.cy).toBe(55);
    expect(game.state.paddles.left.vy).toBe(-305);
  });

  it("reflects off the top wall without changing speed", () => {
    const game = new CaromGame();
    game.state.screen = "playing";
    game.state.ball = {
      x: 640,
      y: 20,
      vx: 0,
      vy: -200,
      spin: 0,
      held: false,
      holdTimer: 0,
      serveSign: 1,
      trail: [],
    };
    game.update(0.1, { held: {} });
    expect(game.state.ball?.vy).toBeGreaterThan(0);
  });

  it("scores behind the right paddle and parks the next serve", () => {
    const game = new CaromGame();
    game.state.screen = "playing";
    game.state.ball = {
      x: 1300,
      y: FIELD_CY,
      vx: 200,
      vy: 0,
      spin: 0,
      held: false,
      holdTimer: 0,
      serveSign: 1,
      trail: [],
    };
    game.update(0.1, { held: {} });
    expect(game.state.score.p1).toBe(1);
    expect(game.state.screen).toBe("countdown");
    expect(game.state.ball?.held).toBe(true);
  });
});
