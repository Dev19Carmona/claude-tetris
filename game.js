'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// HOLE marca el agujero central de la tuerca: ocupa espacio (colisiona,
// se funde con el tablero) pero no es un bloque de color pintable.
const HOLE = -1;
const NUT = 8;

// Power-ups: tipos de pieza 9-13. Nunca se fusionan en el tablero (ver
// lockPiece); en su lugar disparan un efecto y la pieza "desaparece".
const BOMB = 9;
const RAY = 10;
const DYE = 11;
const GRAVITY = 12;
const FREEZE = 13;
const NORMAL_PIECES = 8; // 1..8 son piezas normales; randomPiece() no debe pasar de aquí

// WILD marca un bloque convertido en comodín por el Tinte: colisiona y
// cuenta como celda llena (igual que HOLE) pero se borra al limpiar una
// línea, en vez de fundirse permanentemente.
const WILD = -2;

const POWERUP_EVERY = 10; // cada cuántas líneas aparece un power-up en NEXT
const FREEZE_MS = 5000;

const POWERUP_TYPES = [BOMB, RAY, DYE, GRAVITY, FREEZE];

const POWERUP_INFO = {
  [BOMB]: { icon: '💣', name: 'Bomba', desc: 'destruye un área 3×3' },
  [RAY]: { icon: '⚡', name: 'Rayo', desc: 'limpia fila/columna (rota con ↑)' },
  [DYE]: { icon: '🎨', name: 'Tinte', desc: 'convierte un color en comodines' },
  [GRAVITY]: { icon: '⬇️', name: 'Gravedad', desc: 'compacta los huecos' },
  [FREEZE]: { icon: '❄️', name: 'Congelar', desc: 'pausa la caída 5s' },
};

// Puntos por celda afectada (o por uso, en Gravedad/Congelar), × level.
const POWERUP_SCORES = { cell: 20, wild: 15, gravity: 100, freeze: 50 };

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#9fa8da', // J - pale indigo
  '#ffb74d', // L - orange
  '#90a4ae', // Tuerca - gris metálico
  '#ff5252', // Bomba - rojo intenso
  '#ffee58', // Rayo - amarillo eléctrico
  '#f06292', // Tinte - rosa
  '#78909c', // Gravedad - gris azulado
  '#4fc3f7', // Congelar - celeste hielo
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[NUT,NUT,NUT],[NUT,HOLE,NUT],[NUT,NUT,NUT]], // Tuerca (3x3 con agujero)
  [[BOMB]],                                    // Bomba (1x1)
  [[RAY,RAY],[0,0]],                          // Rayo (2 celdas; rotar cambia fila<->columna)
  [[DYE]],                                     // Tinte (1x1)
  [[GRAVITY]],                                 // Gravedad (1x1)
  [[FREEZE]],                                  // Congelar (1x1)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const THEME_STORAGE_KEY = 'tetris-theme';
const CANVAS_THEME_COLORS = {
  dark: { grid: '#22222e', highlight: 'rgba(255,255,255,0.12)', hole: '#1a1a25', holeEdge: 'rgba(0,0,0,0.5)', wild: '#ffd700' },
  light: { grid: '#dde0f0', highlight: 'rgba(255,255,255,0.35)', hole: '#ffffff', holeEdge: 'rgba(30,34,60,0.25)', wild: '#e6b800' },
};

// --- Skins visuales -------------------------------------------------------
// Cada skin define su propia paleta (`colors`, mismos índices que COLORS:
// 0 vacío, 1-7 piezas normales, 8 tuerca, 9-13 power-ups) y una función
// `paintCell(context, x, y, size, color)` que pinta el relleno de UNA celda
// (sin tocar el icono de power-up, el agujero de la tuerca ni la estrella
// del comodín: eso lo sigue resolviendo `drawBlock`/`drawHole`/`drawWild`,
// que llaman a `paintCell` para el fondo y luego dibujan encima lo que
// corresponda). Así se evita duplicar la lógica de power-ups/wild/hole en
// cada skin: solo cambia el "cómo se pinta un cuadrado", no el "qué se pinta
// encima".
//
// `canvasBg`: si no es null, se usa como fondo forzado del canvas (se pinta
// por encima del fondo CSS del tema), ignorando el tema claro/oscuro. Lo usa
// `neon` para garantizar un fondo negro pase lo que pase.
// `gridColor`: si no es null, sustituye a `canvasTheme.grid` para las líneas
// de la rejilla. El resto de colores de UI (paneles, overlay, etc.) siguen
// controlados por el tema claro/oscuro vía CSS, no por la skin.
const SKIN_STORAGE_KEY = 'tetris-skin';

// Rectángulo con esquinas redondeadas; usa `context.roundRect` cuando está
// disponible y cae a un trazado manual con `arcTo` si no (navegadores viejos).
function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, w, h, r);
    return;
  }
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKINS = {
  retro: {
    label: 'Retro',
    // El aspecto original del juego: colores planos + highlight superior.
    colors: COLORS,
    canvasBg: null,
    gridColor: null,
    paintCell(context, x, y, size, color) {
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = canvasTheme.highlight;
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    },
  },
  neon: {
    label: 'Neón',
    // Paleta saturada/eléctrica; reutiliza colores parecidos para los
    // power-ups (no aporta nada distinguirlos más: siguen teniendo su icono
    // propio encima) pero con más brillo para que casen con el resto.
    colors: [
      null,
      '#00e5ff', '#fff176', '#e040fb', '#69f0ae', '#ff1744',
      '#7c4dff', '#ff9100', '#b0bec5',
      '#ff1744', '#ffea00', '#ff4081', '#40c4ff', '#18ffff',
    ],
    canvasBg: '#000000', // fondo negro forzado, sin importar el tema claro/oscuro
    gridColor: 'rgba(0, 229, 255, 0.15)',
    paintCell(context, x, y, size, color) {
      context.save();
      context.shadowBlur = size * 0.6;
      context.shadowColor = color;
      context.fillStyle = color;
      context.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
      // restore() limpia shadowBlur/shadowColor: no contamina el resto del render
      context.restore();
      context.fillStyle = 'rgba(255,255,255,0.25)';
      context.fillRect(x * size + 2, y * size + 2, size - 4, 3);
    },
  },
  pastel: {
    label: 'Pastel',
    // Misma cantidad de tonos que COLORS pero desaturados/claros.
    colors: [
      null,
      '#a8e6ef', '#fff2b2', '#dcb8e8', '#c3ecc6', '#f7b8b8',
      '#c9cdf0', '#ffd6a8', '#cfd8dc',
      '#ffb3b3', '#fff59d', '#f8bbd0', '#b0c4c9', '#b3e5fc',
    ],
    canvasBg: null,
    gridColor: null,
    paintCell(context, x, y, size, color) {
      const r = Math.max(3, size * 0.22);
      roundedRectPath(context, x * size + 2, y * size + 2, size - 4, size - 4, r);
      context.fillStyle = color;
      context.fill();
      roundedRectPath(context, x * size + 2, y * size + 2, size - 4, (size - 4) * 0.4, r);
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fill();
    },
  },
  pixel: {
    label: 'Pixel',
    colors: COLORS,
    canvasBg: null,
    gridColor: null,
    paintCell(context, x, y, size, color) {
      const px = x * size + 1, py = y * size + 1, s = size - 2;
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      // Textura 4×4: subcuadrados con ligera variación de tono, tipo sprite 8-bits.
      const cells = 4;
      const cellSize = s / cells;
      for (let r = 0; r < cells; r++) {
        for (let c = 0; c < cells; c++) {
          const dark = (r + c) % 2 === 0;
          context.fillStyle = dark ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.10)';
          context.fillRect(px + c * cellSize, py + r * cellSize, cellSize, cellSize);
        }
      }
      context.fillStyle = canvasTheme.highlight;
      context.fillRect(px, py, s, 3);
    },
  },
};

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const skinSelectEl = document.getElementById('skin-select');
const powerupCountdownEl = document.getElementById('powerup-countdown');
const powerupHintEl = document.getElementById('powerup-hint');
const powerupStatusEl = document.getElementById('powerup-status');
const powerupLegendEl = document.getElementById('powerup-legend');
const helpToggleBtn = document.getElementById('help-toggle');
const helpCloseBtn = document.getElementById('help-close');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let powerupPending, nextPowerupAt, lastPowerup, freezeUntil, freezeRemaining, effects;
let canvasTheme = CANVAS_THEME_COLORS.dark;
let currentSkin = 'retro';
let helpOpen = false, helpPaused = false;

function renderPowerupLegend() {
  powerupLegendEl.innerHTML = POWERUP_TYPES
    .map(type => {
      const info = POWERUP_INFO[type];
      return `<li data-type="${type}"><span class="icon">${info.icon}</span><span>${info.name} — ${info.desc}</span></li>`;
    })
    .join('');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  canvasTheme = CANVAS_THEME_COLORS[theme] || CANVAS_THEME_COLORS.dark;
  const isLight = theme === 'light';
  themeToggleBtn.textContent = isLight ? '☀️' : '🌙';
  const label = isLight ? 'Tema claro' : 'Tema oscuro';
  themeToggleBtn.title = label;
  themeToggleBtn.setAttribute('aria-label', label);
  themeToggleBtn.setAttribute('aria-pressed', String(isLight));
}

function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  localStorage.setItem(THEME_STORAGE_KEY, next);
  applyTheme(next);
  if (current) draw();
}

// Aplica una skin ya validada (cae a 'retro' si el valor no existe, p.ej.
// datos corruptos en localStorage) y sincroniza el <select>.
// Usa hasOwnProperty en vez de `SKINS[skin]` a secas: SKINS es un objeto
// literal y por tanto hereda de Object.prototype, así que un valor como
// 'toString' o 'constructor' (localStorage manipulado a mano, o una clave
// corrupta) resolvería a una función heredada (truthy) en vez de caer a
// 'retro', rompiendo drawBlock/drawHole/drawWild al no tener `.colors`/`.paintCell`.
function applySkin(skin) {
  currentSkin = Object.prototype.hasOwnProperty.call(SKINS, skin) ? skin : 'retro';
  if (skinSelectEl) skinSelectEl.value = currentSkin;
}

function loadStoredSkin() {
  try {
    return localStorage.getItem(SKIN_STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

// Cambia de skin EN CALIENTE: actualiza el estado y vuelve a pintar tanto el
// tablero como la vista previa, sin recargar la página.
function changeSkin(skin) {
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, skin);
  } catch (e) {
    // localStorage no disponible (modo privado, cuota, etc.): la skin sigue
    // aplicándose para esta sesión, solo no persiste.
  }
  applySkin(skin);
  if (current) draw();
  if (next) drawNext();
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  if (powerupPending) {
    powerupPending = false;
    return makePowerupPiece();
  }
  const type = Math.floor(Math.random() * NORMAL_PIECES) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function makePowerupPiece() {
  const choices = POWERUP_TYPES.filter(t => t !== lastPowerup);
  const type = choices[Math.floor(Math.random() * choices.length)];
  lastPowerup = type;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    clearWilds();
    if (lines >= nextPowerupAt) {
      powerupPending = true;
      nextPowerupAt = Math.floor(lines / POWERUP_EVERY) * POWERUP_EVERY + POWERUP_EVERY;
    }
    updateHUD();
  }
}

// Borra todos los comodines del Tinte (WILD) cuando se completa una línea
// real. Es el "combo diferido": el Tinte no destruye nada por sí solo.
function clearWilds() {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] === WILD) board[r][c] = 0;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  if (gameOver) return;
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (gameOver) return;
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (gameOver) return;
  const effect = POWERUP_EFFECTS[current.type];
  if (effect) {
    // Los power-ups no se fusionan con el tablero: disparan su efecto y
    // desaparecen. clearLines() se llama igualmente porque Gravedad/Rayo
    // pueden dejar filas completas.
    effect(current);
  } else {
    merge();
  }
  clearLines();
  spawn();
}

// --- Efectos de power-ups -------------------------------------------------
// Cada función recibe la pieza (1x1, salvo el Rayo) ya en su posición final
// y devuelve nada; suman directamente a `score` y registran un flash visual.

function flashCells(cells, color) {
  if (!cells.length) return;
  effects.push({ cells, color, until: performance.now() + 350 });
}

function bombEffect(piece) {
  const cx = piece.x, cy = piece.y;
  const cells = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const r = cy + dy, c = cx + dx;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      if (board[r][c] !== 0) {
        board[r][c] = 0;
        cells.push({ r, c });
      }
    }
  }
  score += cells.length * POWERUP_SCORES.cell * level;
  flashCells(cells, COLORS[BOMB]);
}

function rayIsHorizontal(shape) {
  return shape.some(row => row.filter(v => v === RAY).length >= 2);
}

function rayEffect(piece) {
  const horizontal = rayIsHorizontal(piece.shape);
  const cells = [];
  if (horizontal) {
    let landedRow = -1;
    for (let r = 0; r < piece.shape.length && landedRow < 0; r++)
      for (let c = 0; c < piece.shape[r].length; c++)
        if (piece.shape[r][c] === RAY) { landedRow = piece.y + r; break; }
    if (landedRow >= 0 && landedRow < ROWS) {
      for (let c = 0; c < COLS; c++)
        if (board[landedRow][c] !== 0) cells.push({ r: landedRow, c });
      board.splice(landedRow, 1);
      board.unshift(new Array(COLS).fill(0));
    }
  } else {
    let landedCol = -1;
    for (let r = 0; r < piece.shape.length && landedCol < 0; r++)
      for (let c = 0; c < piece.shape[r].length; c++)
        if (piece.shape[r][c] === RAY) { landedCol = piece.x + c; break; }
    if (landedCol >= 0 && landedCol < COLS) {
      for (let r = 0; r < ROWS; r++) {
        if (board[r][landedCol] !== 0) {
          cells.push({ r, c: landedCol });
          board[r][landedCol] = 0;
        }
      }
    }
  }
  score += cells.length * POWERUP_SCORES.cell * level;
  flashCells(cells, COLORS[RAY]);
}

function dyeEffect() {
  const counts = new Array(NORMAL_PIECES + 1).fill(0);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const v = board[r][c];
      if (v >= 1 && v <= NORMAL_PIECES) counts[v]++;
    }
  let bestColor = 0, bestCount = 0;
  for (let i = 1; i <= NORMAL_PIECES; i++)
    if (counts[i] > bestCount) { bestCount = counts[i]; bestColor = i; }
  if (!bestColor) return; // tablero vacío: nada que teñir

  const cells = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === bestColor) {
        board[r][c] = WILD;
        cells.push({ r, c });
      } else if (bestColor === NUT && board[r][c] === HOLE) {
        // El color mayoritario es la tuerca: su agujero también se tiñe.
        board[r][c] = WILD;
        cells.push({ r, c });
      }
    }
  score += cells.length * POWERUP_SCORES.wild * level;
  flashCells(cells, canvasTheme.wild);
}

function gravityEffect() {
  for (let c = 0; c < COLS; c++) {
    const colVals = [];
    for (let r = 0; r < ROWS; r++)
      if (board[r][c] !== 0) colVals.push(board[r][c]);
    for (let r = 0; r < ROWS; r++) board[r][c] = 0;
    const startRow = ROWS - colVals.length;
    for (let i = 0; i < colVals.length; i++) board[startRow + i][c] = colVals[i];
  }
  score += POWERUP_SCORES.gravity * level;
}

function freezeEffect() {
  freezeUntil = performance.now() + FREEZE_MS;
  score += POWERUP_SCORES.freeze * level;
}

const POWERUP_EFFECTS = {
  [BOMB]: bombEffect,
  [RAY]: rayEffect,
  [DYE]: dyeEffect,
  [GRAVITY]: gravityEffect,
  [FREEZE]: freezeEffect,
};

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
    return;
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  updatePowerupHUD();
}

function updatePowerupHUD() {
  const remaining = Math.max(0, nextPowerupAt - lines);
  powerupCountdownEl.textContent = remaining === 0 ? '¡ya viene!' : `en ${remaining} línea${remaining === 1 ? '' : 's'}`;

  const nextInfo = next && POWERUP_INFO[next.type];
  powerupHintEl.textContent = nextInfo ? `${nextInfo.icon} ${nextInfo.name.toUpperCase()}` : '';

  const nextType = next && POWERUP_INFO[next.type] ? next.type : null;
  for (const li of powerupLegendEl.children) {
    li.classList.toggle('is-next', Number(li.dataset.type) === nextType);
  }

  if (freezeUntil > performance.now()) {
    const secs = Math.ceil((freezeUntil - performance.now()) / 1000);
    powerupStatusEl.textContent = `❄️ CONGELADO ${secs}s`;
  } else {
    powerupStatusEl.textContent = '';
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  if (colorIndex === HOLE) { drawHole(context, x, y, size, alpha); return; }
  if (colorIndex === WILD) { drawWild(context, x, y, size, alpha); return; }
  const skin = SKINS[currentSkin];
  const color = skin.colors[colorIndex] || COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  skin.paintCell(context, x, y, size, color);
  if (colorIndex >= BOMB) drawPowerupIcon(context, x, y, colorIndex, size);
  context.globalAlpha = 1;
}

function drawPowerupIcon(context, x, y, colorIndex, size) {
  const info = POWERUP_INFO[colorIndex];
  if (!info) return;
  context.font = `${Math.floor(size * 0.6)}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#ffffff';
  context.fillText(info.icon, x * size + size / 2, y * size + size / 2 + 1);
}

function drawWild(context, x, y, size, alpha) {
  // Comodín del Tinte: parpadea en dorado y muestra una estrella, para que
  // se distinga a simple vista de un bloque normal del mismo color perdido.
  // El fondo se pinta con el estilo de la skin activa (glow, redondeado,
  // textura...) pero el color dorado siempre viene del tema, no de la skin.
  const skin = SKINS[currentSkin];
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 200);
  context.globalAlpha = (alpha ?? 1) * pulse;
  skin.paintCell(context, x, y, size, canvasTheme.wild);
  context.globalAlpha = alpha ?? 1;
  context.font = `${Math.floor(size * 0.55)}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#fff';
  context.fillText('★', x * size + size / 2, y * size + size / 2 + 1);
  context.globalAlpha = 1;
}

function drawHole(context, x, y, size, alpha) {
  const skin = SKINS[currentSkin];
  context.globalAlpha = alpha ?? 1;
  // fondo metálico de la tuerca, con el estilo de pintado de la skin activa
  skin.paintCell(context, x, y, size, skin.colors[NUT] || COLORS[NUT]);
  // agujero circular central: colores de tema claro/oscuro, no de la skin
  const cx = x * size + size / 2;
  const cy = y * size + size / 2;
  const radius = size * 0.3;
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.fillStyle = canvasTheme.hole;
  context.fill();
  context.strokeStyle = canvasTheme.holeEdge;
  context.lineWidth = 1;
  context.stroke();
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = SKINS[currentSkin].gridColor || canvasTheme.grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

// Algunas skins (p.ej. neon) fuerzan un fondo propio por encima del fondo
// CSS del tema, para que su estética no dependa de si el tema es claro u
// oscuro. Compartida por draw() y drawNext() para no repetir el mismo
// fillRect condicional en cada canvas.
function paintSkinCanvasBg(context, w, h) {
  const bg = SKINS[currentSkin].canvasBg;
  if (!bg) return;
  context.fillStyle = bg;
  context.fillRect(0, 0, w, h);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  paintSkinCanvasBg(ctx, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

  drawEffects();
}

// Flash momentáneo (350ms) sobre las celdas que acaba de afectar un
// power-up (Bomba, Rayo, Tinte). Se pinta encima de todo lo demás.
function drawEffects() {
  const now = performance.now();
  effects = effects.filter(e => e.until > now);
  for (const e of effects) {
    const alpha = Math.max(0, (e.until - now) / 350) * 0.6;
    if (alpha <= 0) continue;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = e.color;
    for (const { r, c } of e.cells) ctx.fillRect(c * BLOCK, r * BLOCK, BLOCK, BLOCK);
  }
  ctx.globalAlpha = 1;
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  paintSkinCanvasBg(nextCtx, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  if (gameOver) return;
  gameOver = true;
  // La parada real del bucle la hace la guarda en loop(); esto es solo
  // una red de seguridad por si endGame() se invoca fuera de un frame.
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function pauseGame(showOverlay = true) {
  if (gameOver || paused) return;
  paused = true;
  freezeRemaining = freezeUntil > performance.now() ? freezeUntil - performance.now() : 0;
  cancelAnimationFrame(animId);
  if (showOverlay) {
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function resumeGame(hideOverlay = true) {
  if (gameOver || !paused) return;
  paused = false;
  // Si había un Congelar activo, se reanuda con el tiempo restante en vez
  // de con el timestamp absoluto (que ya habría "vencido" durante la pausa).
  if (freezeRemaining > 0) {
    freezeUntil = performance.now() + freezeRemaining;
    freezeRemaining = 0;
  }
  if (hideOverlay) overlay.classList.add('hidden');
  lastTime = performance.now();
  loop(lastTime);
}

function togglePause() {
  if (gameOver) return;
  if (paused) resumeGame();
  else pauseGame();
}

function openHelp() {
  if (helpOpen) return;
  helpOpen = true;
  document.body.classList.add('help-open');
  helpToggleBtn.setAttribute('aria-expanded', 'true');
  if (!gameOver && !paused) {
    helpPaused = true;
    pauseGame(false);
  }
}

function closeHelp() {
  if (!helpOpen) return;
  helpOpen = false;
  document.body.classList.remove('help-open');
  helpToggleBtn.setAttribute('aria-expanded', 'false');
  if (helpPaused) {
    helpPaused = false;
    resumeGame(false);
  }
}

function toggleHelp() {
  if (helpOpen) closeHelp();
  else openHelp();
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (ts < freezeUntil) {
    dropAccum = 0; // Congelar: la caída no acumula tiempo
  } else {
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }
  draw();
  updatePowerupHUD();
  if (gameOver || paused) return; // fin del bucle: no se reprograma
  animId = requestAnimationFrame(loop);
}

function init() {
  cancelAnimationFrame(animId);
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  powerupPending = false;
  nextPowerupAt = POWERUP_EVERY;
  lastPowerup = null;
  freezeUntil = 0;
  freezeRemaining = 0;
  effects = [];
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (helpOpen) {
    if (e.code === 'Escape' || e.code === 'KeyH') closeHelp();
    return;
  }
  if (e.code === 'KeyH') { openHelp(); return; }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
themeToggleBtn.addEventListener('click', toggleTheme);
helpToggleBtn.addEventListener('click', toggleHelp);
helpCloseBtn.addEventListener('click', closeHelp);
if (skinSelectEl) {
  skinSelectEl.addEventListener('change', e => {
    changeSkin(e.target.value);
    // Sin esto, el <select> se queda con el foco tras elegir una skin y las
    // flechas del teclado (mover/rotar la pieza) quedarían capturadas por él
    // en vez de llegar al juego.
    skinSelectEl.blur();
  });
}

applyTheme(localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark');
applySkin(loadStoredSkin());
renderPowerupLegend();
init();
