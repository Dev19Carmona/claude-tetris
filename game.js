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
const RECORDS_STORAGE_KEY = 'tetris-records';
const MAX_RECORDS = 5;
const PLAYER_NAME_MAX_LEN = 12;
const CANVAS_THEME_COLORS = {
  dark: { grid: '#22222e', highlight: 'rgba(255,255,255,0.12)', hole: '#1a1a25', holeEdge: 'rgba(0,0,0,0.5)', wild: '#ffd700' },
  light: { grid: '#dde0f0', highlight: 'rgba(255,255,255,0.35)', hole: '#ffffff', holeEdge: 'rgba(30,34,60,0.25)', wild: '#e6b800' },
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
const gameoverBox = document.getElementById('gameover-box');
const pauseMenu = document.getElementById('pause-menu');
const pauseMenuMain = document.getElementById('pause-menu-main');
const pauseMenuControls = document.getElementById('pause-menu-controls');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const pauseControlsBtn = document.getElementById('pause-controls-btn');
const pauseControlsBackBtn = document.getElementById('pause-controls-back-btn');
const startLevelSelect = document.getElementById('start-level-select');
const themeToggleBtn = document.getElementById('theme-toggle');
const powerupCountdownEl = document.getElementById('powerup-countdown');
const powerupHintEl = document.getElementById('powerup-hint');
const powerupStatusEl = document.getElementById('powerup-status');
const powerupLegendEl = document.getElementById('powerup-legend');
const helpToggleBtn = document.getElementById('help-toggle');
const helpCloseBtn = document.getElementById('help-close');

const recordsListEl = document.getElementById('records-list');
const bestComboEl = document.getElementById('best-combo-label');
const maxLinesEl = document.getElementById('max-lines-label');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const overlayRecordsSection = document.getElementById('overlay-records');
const overlayRecordsListEl = document.getElementById('overlay-records-list');
const overlayBestComboEl = document.getElementById('overlay-best-combo');
const overlayMaxLinesEl = document.getElementById('overlay-max-lines');
const nameForm = document.getElementById('highscore-form');
const nameInput = document.getElementById('player-name-input');
const saveScoreBtn = document.getElementById('save-score-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let powerupPending, nextPowerupAt, lastPowerup, freezeUntil, freezeRemaining, effects;
let combo, maxCombo, pendingScoreEntry;
let canvasTheme = CANVAS_THEME_COLORS.dark;
let helpOpen = false, helpPaused = false;
const MAX_START_LEVEL = 10;
let startLevel = 1;

function renderStartLevelOptions() {
  startLevelSelect.innerHTML = Array.from({ length: MAX_START_LEVEL }, (_, i) => i + 1)
    .map(n => `<option value="${n}">${n}</option>`)
    .join('');
  startLevelSelect.value = String(startLevel);
}

// --- Tabla de records (localStorage) --------------------------------------

function loadRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECORDS_STORAGE_KEY));
    return {
      scores: Array.isArray(parsed?.scores) ? parsed.scores : [],
      bestCombo: Number(parsed?.bestCombo) || 0,
      maxLines: Number(parsed?.maxLines) || 0,
    };
  } catch {
    return { scores: [], bestCombo: 0, maxLines: 0 };
  }
}

function saveRecords(records) {
  localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));
}

function addRecordEntry(records, name, scoreValue, linesValue, levelValue) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: (name || 'Jugador').slice(0, PLAYER_NAME_MAX_LEN),
    score: scoreValue,
    lines: linesValue,
    level: levelValue,
  };
  records.scores.push(entry);
  records.scores.sort((a, b) => b.score - a.score);
  records.scores = records.scores.slice(0, MAX_RECORDS);
  saveRecords(records);
  return entry;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderRecordsList(listEl, records, highlightId) {
  if (!records.scores.length) {
    listEl.innerHTML = '<li class="records-empty">Sin récords aún</li>';
    return;
  }
  listEl.innerHTML = records.scores
    .map((entry, i) => `
      <li class="${entry.id === highlightId ? 'is-highlight' : ''}">
        <span class="rank">${i + 1}</span>
        <span class="rname">${escapeHtml(entry.name)}</span>
        <span class="rscore">${entry.score.toLocaleString()}</span>
      </li>
    `)
    .join('');
}

function renderRecordsStats(comboEl, linesEl, records) {
  comboEl.textContent = `Mejor combo: ${records.bestCombo}`;
  linesEl.textContent = `Máx. líneas: ${records.maxLines}`;
}

function refreshRecordsUI(records, highlightId) {
  renderRecordsList(recordsListEl, records, highlightId);
  renderRecordsStats(bestComboEl, maxLinesEl, records);
  renderRecordsList(overlayRecordsListEl, records, highlightId);
  renderRecordsStats(overlayBestComboEl, overlayMaxLinesEl, records);
}

function submitScore() {
  if (!pendingScoreEntry) return;
  const name = nameInput.value.trim();
  const records = loadRecords();
  const entry = addRecordEntry(records, name, pendingScoreEntry.score, pendingScoreEntry.lines, pendingScoreEntry.level);
  const madeTop = records.scores.some(e => e.id === entry.id);
  pendingScoreEntry = null;
  nameForm.classList.add('hidden');
  refreshRecordsUI(records, madeTop ? entry.id : null);
}

function resetRecords() {
  if (!confirm('¿Seguro que quieres borrar todos los récords?')) return;
  saveRecords({ scores: [], bestCombo: 0, maxLines: 0 });
  refreshRecordsUI(loadRecords(), null);
}

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
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    if (lines >= nextPowerupAt) {
      powerupPending = true;
      nextPowerupAt = Math.floor(lines / POWERUP_EVERY) * POWERUP_EVERY + POWERUP_EVERY;
    }
    updateHUD();
  } else {
    combo = 0;
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
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = canvasTheme.highlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
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
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 200);
  context.globalAlpha = (alpha ?? 1) * pulse;
  context.fillStyle = canvasTheme.wild;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.globalAlpha = alpha ?? 1;
  context.font = `${Math.floor(size * 0.55)}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#fff';
  context.fillText('★', x * size + size / 2, y * size + size / 2 + 1);
  context.globalAlpha = 1;
}

function drawHole(context, x, y, size, alpha) {
  context.globalAlpha = alpha ?? 1;
  // fondo metálico de la tuerca, igual que un bloque normal
  context.fillStyle = COLORS[NUT];
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = canvasTheme.highlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  // agujero circular central
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
  ctx.strokeStyle = canvasTheme.grid;
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

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
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
  pauseMenu.classList.add('hidden');
  gameoverBox.classList.remove('hidden');
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  const records = loadRecords();
  let changed = false;
  if (maxCombo > records.bestCombo) { records.bestCombo = maxCombo; changed = true; }
  if (lines > records.maxLines) { records.maxLines = lines; changed = true; }
  if (changed) saveRecords(records);

  overlayRecordsSection.classList.remove('hidden');
  refreshRecordsUI(records, null);

  if (score > 0) {
    pendingScoreEntry = { score, lines, level };
    nameForm.classList.remove('hidden');
    nameInput.value = '';
    setTimeout(() => nameInput.focus(), 0);
  } else {
    pendingScoreEntry = null;
    nameForm.classList.add('hidden');
  }

  overlay.classList.remove('hidden');
}

// El menú de pausa vive dentro del mismo overlay que GAME OVER, como una
// caja hermana (#pause-menu) que se muestra/oculta en vez de reusar los
// campos de título/score del game over.
function showPauseMainView() {
  pauseMenuControls.classList.add('hidden');
  pauseMenuMain.classList.remove('hidden');
}

function showPauseControlsView() {
  pauseMenuMain.classList.add('hidden');
  pauseMenuControls.classList.remove('hidden');
}

function openPauseMenu() {
  gameoverBox.classList.add('hidden');
  showPauseMainView();
  pauseMenu.classList.remove('hidden');
  overlay.classList.remove('hidden');
}

function closePauseMenu() {
  pauseMenu.classList.add('hidden');
  overlay.classList.add('hidden');
}

function pauseGame(showOverlay = true) {
  if (gameOver || paused) return;
  paused = true;
  freezeRemaining = freezeUntil > performance.now() ? freezeUntil - performance.now() : 0;
  cancelAnimationFrame(animId);
  if (showOverlay) openPauseMenu();
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
  if (hideOverlay) closePauseMenu();
  lastTime = performance.now();
  loop(lastTime);
}

// P / Escape: si el menú está en la sub-vista de controles, primero vuelve
// al menú principal; si ya está en el menú principal, reanuda la partida.
function togglePause() {
  if (gameOver) return;
  if (paused) {
    if (!pauseMenu.classList.contains('hidden') && !pauseMenuControls.classList.contains('hidden')) {
      showPauseMainView();
      return;
    }
    resumeGame();
  } else {
    pauseGame();
  }
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
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  powerupPending = false;
  nextPowerupAt = POWERUP_EVERY;
  lastPowerup = null;
  freezeUntil = 0;
  freezeRemaining = 0;
  effects = [];
  combo = 0;
  maxCombo = 0;
  pendingScoreEntry = null;
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  gameoverBox.classList.remove('hidden');
  overlayRecordsSection.classList.add('hidden');
  nameForm.classList.add('hidden');
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (document.activeElement === nameInput) return;
  if (helpOpen) {
    if (e.code === 'Escape' || e.code === 'KeyH') closeHelp();
    return;
  }
  if (e.code === 'KeyH') { openHelp(); return; }
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
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
resumeBtn.addEventListener('click', () => resumeGame());
pauseRestartBtn.addEventListener('click', () => { closePauseMenu(); init(); });
pauseControlsBtn.addEventListener('click', showPauseControlsView);
pauseControlsBackBtn.addEventListener('click', showPauseMainView);
startLevelSelect.addEventListener('change', () => {
  startLevel = Number(startLevelSelect.value) || 1;
});
saveScoreBtn.addEventListener('click', submitScore);
nameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') submitScore();
});
resetRecordsBtn.addEventListener('click', resetRecords);

applyTheme(localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark');
renderPowerupLegend();
renderStartLevelOptions();
refreshRecordsUI(loadRecords(), null);
init();
