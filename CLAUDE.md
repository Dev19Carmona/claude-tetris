# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Classic Tetris implemented in vanilla JavaScript with HTML5 Canvas. No dependencies, no build step, no package.json. The README (in Spanish) is the canonical project doc — keep it in sync with any behavioral changes.

## Running the game

There is nothing to install or build. Open `index.html` directly, or serve it with any static server:

```bash
python3 -m http.server 8000
# or
npx serve .
```

There is no test suite, linter, or build/watch process in this repo — verify changes by opening the game in a browser and playing it.

## Architecture

Three files, all logic lives in `game.js`:

- `index.html` — DOM structure: main `<canvas id="board">` (300×600, i.e. `COLS×BLOCK` × `ROWS×BLOCK`), a `<canvas id="next-canvas">` preview, HUD elements (`score`/`lines`/`level`), and a shared overlay used for both PAUSE and GAME OVER.
- `style.css` — dark/retro arcade visual theme only.
- `game.js` — all game state and logic, in one file, no modules.

### Core model

- The board is a `ROWS × COLS` matrix where each cell is `0` (empty) or an index 1–7 into `COLORS`/`PIECES` identifying which piece color occupies it.
- Pieces are defined as square matrices in `PIECES` (index 0 is unused/null so piece type doubles as color/array index).
- Rotation (`rotateCW`) is a transpose + row-reverse of the shape matrix — there is no per-piece rotation state table (unlike SRS-style Tetris implementations).
- `tryRotate` implements simple wall kicks by attempting horizontal offsets `[0, -1, 1, -2, 2]` after rotating, applying the first that doesn't collide.
- `collide(shape, ox, oy)` is the single collision check used everywhere: movement, rotation, ghost piece, and spawn validity all call it.

### Game loop

`loop(ts)`, driven by `requestAnimationFrame`, accumulates elapsed time (`dropAccum`) against `dropInterval` and advances the piece one row (or locks it via `lockPiece`) when the threshold is passed. `dropInterval` shrinks as `level` increases: `max(100, 1000 - (level - 1) * 90)` ms. Pausing (`togglePause`) cancels/restarts the animation frame rather than gating logic inside `loop`.

### Piece lifecycle

`spawn()` promotes `next` to `current` and generates a new `next` via `randomPiece()`. If the newly spawned piece immediately collides, `endGame()` fires. `lockPiece()` merges the current piece into `board`, clears completed lines, and spawns the next piece — this is the single funnel for "piece has landed" whether reached via gravity, soft drop, or hard drop.

### Scoring

`LINE_SCORES = [0, 100, 300, 500, 800]` indexed by number of lines cleared at once, multiplied by current `level`. Hard drop adds 2 points per row dropped; soft drop adds 1 point per row. Level increases every 10 cleared lines (`Math.floor(lines / 10) + 1`), which also updates `dropInterval`.

### Rendering

`draw()` clears and redraws the whole board every frame (grid, locked blocks, ghost piece at `globalAlpha = 0.2` via `ghostY()`, then the current piece). There's no dirty-rect optimization — keep this in mind if changing render-heavy behavior. `drawNext()` renders the preview canvas separately, centering the shape in a 4×4 cell.

## Tunable constants (top of `game.js`)

`COLS`, `ROWS`, `BLOCK` (cell pixel size), `COLORS`, `LINE_SCORES`, initial `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, the `#board` canvas `width`/`height` in `index.html` must be updated to match (`COLS × BLOCK`, `ROWS × BLOCK`).
