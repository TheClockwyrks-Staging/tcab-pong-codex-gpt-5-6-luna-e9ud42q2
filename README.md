# Carom

Carom is a browser-native top-down paddle duel. Return the ball across a dark
field, use paddle motion to bend its flight, and bank shots around the two gold
obstacles. Solo pits player one against an adaptive AI; Versus lets two local
players share the keyboard. The first player to 11 points with a two-point lead
wins.

## Install and run

```bash
npm ci
npm run dev
```

Open the local Vite URL shown in the terminal. To produce the static site:

```bash
npm run build
```

The finished site is written to `dist/` and can be served from any static web
server.

## Controls

- Player one: `W` / `S`
- Player two: `Arrow Up` / `Arrow Down`
- Menus: `Arrow Up` / `Arrow Down`, `Enter` or `Space`
- Pause or resume: `P` (or `Escape` during a match)
- Mute: `M`
- Diagnostics overlay: backtick (`)

Carom also exposes the documented `window.__carom` automation surface for
deterministic simulation and browser-driven testing.
