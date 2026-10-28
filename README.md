# Roped Together

Made from a plan by Vinny, grade 7.

A pixel-art, two-player, one-Chromebook game about sharing a turn. Two
players sit at the same computer, tied together by a rope. They take
turns stepping toward a flag, one legal step at a time, using only
three buttons: **Left**, **Right**, and **Up**.

## How to play

1. **Join screen.** Each player picks their own character color, then
   press **Start Game**.
2. **Play screen.** You'll see both characters, the rope between
   them, the flag, whose turn it is, and each player's own three
   buttons (Left, Right, Up).
   - A turn is **one legal step**. Then it's the other player's turn.
   - **Up** either climbs onto a block one tile higher, or hops over a
     one-tile gap. Walking down to a lower tile just happens with
     Left or Right — there's no Down button, and you don't need one.
   - The **rope** only stretches so far. If a step would pull it past
     its limit, that step doesn't happen.
   - If you press a button when it **isn't your turn**, your
     character turns to stone for about a second, you'll hear a
     buzz, and a message says "Almost your turn, just wait!" The
     turn does not change.
   - The arrow in the turn indicator always shows whose turn it
     really is.
   - When **both** players reach the flag, you both get a
     congratulations and the next, harder level loads. Harder levels
     have a shorter rope, more gaps, and a faster step animation.
   - There are three built-in levels plus **Hardest Mode**.
   - Beating Hardest Mode unlocks the **Level Maker**.
3. **Level Maker.** Place blocks and gaps, set both players' start
   tiles, set the flag, and set the rope length. Save & Play tries it
   out immediately, saved on this computer.

### Controls

- On-screen buttons: each player has their own Left / Right / Up
  buttons.
- Keyboard: the Arrow Left / Arrow Right / Arrow Up keys move
  whichever player's turn it currently is. Arrow Down does nothing —
  the game never needs it.
- **Start Over** erases the saved game and sends you back to the
  join screen.
- The **zoom buttons** (70, 80, 90, 100, 115, 130%) in the top-right
  corner resize the whole game. Everything fits a 1366x650 window
  with no page scrolling at every zoom level.

### Saved on this computer only

This game has no server, no accounts, and no second computer — it's
strictly hot-seat, play-in-person. Progress is saved only in this
browser's `localStorage`, using four actions from Vinny's plan (see
the `RT` object near the top of `game.js`):

- **look** — check whose turn it is.
- **add** — record a move (and save current progress).
- **change** — set a character's color.
- **take away** — erase the saved game so you can start over.

Beating Hardest Mode and any level you build in the Level Maker are
kept separately, so starting over doesn't take those away.

## Tech notes

- Plain HTML, CSS, and JavaScript. No build step, no dependencies,
  no frameworks.
- All art is drawn with `<canvas>` 2D calls or plain boxes — no image
  files.
- Sounds are short beeps generated with the Web Audio API, and only
  start after the player's first click (nothing plays on page load).
- Written to run on Chrome 96 as well as newer Chrome versions: no
  CSS nesting, no `:has()`, no container-query units, no `dvh`/`svh`/
  `lvh`, and no standalone `translate`/`rotate`/`scale` CSS
  properties (the combined `transform` property is used instead).
- Zoom is implemented by setting a `--z` CSS variable on `<html>` and
  scaling the whole `#app` element from its top-left corner.

## Publish on GitHub Pages

1. Push this repo to GitHub (it's already just `index.html` at the
   repo root, so no build step is needed).
2. In the repo on GitHub, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a
   branch**, pick the `main` branch and the `/ (root)` folder, then
   save.
4. Wait a minute for GitHub to publish, then visit the URL GitHub
   Pages shows on that same settings page (something like
   `https://<your-username>.github.io/roped-together/`).

No server, build step, or extra configuration is required — it's all
relative paths to `index.html`, `style.css`, and `game.js`.
