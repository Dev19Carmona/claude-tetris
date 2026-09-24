# Tetris

Implementación del clásico **Tetris** en JavaScript vanilla, usando HTML5 Canvas y CSS. Sin dependencias externas, sin frameworks, sin proceso de build: solo abrir y jugar.

![Tech](https://img.shields.io/badge/HTML5-Canvas-orange)
![Tech](https://img.shields.io/badge/CSS3-blueviolet)
![Tech](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

---

## Tabla de contenidos

- [Tetris](#tetris)
  - [Tabla de contenidos](#tabla-de-contenidos)
  - [Qué hace el proyecto](#qué-hace-el-proyecto)
  - [Cómo ejecutar el juego](#cómo-ejecutar-el-juego)
    - [Opción 1: abrir el archivo directamente](#opción-1-abrir-el-archivo-directamente)
    - [Opción 2: servidor local (recomendado)](#opción-2-servidor-local-recomendado)
  - [Controles](#controles)
  - [Tema claro / oscuro](#tema-claro--oscuro)
  - [Skins visuales](#skins-visuales)
  - [Power-ups](#power-ups)
  - [Cómo funciona](#cómo-funciona)
    - [1. `index.html`](#1-indexhtml)
    - [2. `style.css`](#2-stylecss)
    - [3. `game.js`](#3-gamejs)
    - [Flujo del juego](#flujo-del-juego)
  - [Tecnologías](#tecnologías)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [Personalización](#personalización)
  - [Automatización con Claude Code](#automatización-con-claude-code)
  - [Licencia](#licencia)

---

## Qué hace el proyecto

Es una versión jugable del Tetris clásico con todas las mecánicas que esperarías:

- Tablero de **10 × 20** celdas.
- Las **7 piezas estándar** (I, O, T, S, Z, J, L) con colores diferenciados, más una **pieza de reto: la tuerca** (3 × 3 con un agujero circular en el centro). Su agujero ocupa espacio como un bloque más, pero cuenta como celda llena al comprobar líneas completas, así que una fila con un agujero de tuerca sí se puede eliminar.
- **Rotación** con _wall kicks_ básicos (pequeños desplazamientos para que la pieza pueda rotar pegada a la pared).
- **Soft drop** (bajada acelerada) y **hard drop** (caída instantánea).
- **Pieza fantasma** (_ghost piece_): muestra dónde aterrizará la pieza actual.
- **Vista previa** de la siguiente pieza.
- **Sistema de puntuación** clásico de Tetris (100 / 300 / 500 / 800 multiplicado por nivel).
- **Niveles** que aumentan cada 10 líneas y aceleran la caída.
- **Power-ups aleatorios**: cada 10 líneas cae una pieza especial (Bomba, Rayo, Tinte, Gravedad o Congelar) que dispara un efecto en vez de fijarse en el tablero.
- **Pausa** y **Game Over** con opción de reinicio.

---

## Cómo ejecutar el juego

No hay nada que instalar ni compilar. Tienes dos opciones:

### Opción 1: abrir el archivo directamente

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

### Opción 2: servidor local (recomendado)

Cualquier servidor estático funciona. Algunos ejemplos:

```bash
# Con Python 3
python3 -m http.server 8000

# Con Node.js (npx)
npx serve .

# Con PHP
php -S localhost:8000
```

Después abre `http://localhost:8000` en el navegador.

---

## Controles

| Tecla     | Acción                            |
| --------- | --------------------------------- |
| `←` / `→` | Mover la pieza horizontalmente    |
| `↑` o `X` | Rotar la pieza en sentido horario |
| `↓`       | Soft drop (bajar más rápido)      |
| `Espacio` | Hard drop (caída instantánea)     |
| `P`       | Pausar / reanudar                 |
| `H`       | Abrir / cerrar la ayuda            |
| `Esc`     | Cerrar la ayuda                   |

---

## Tema claro / oscuro

El icono 🌙/☀️ al pie del panel derecho alterna entre modo oscuro (por defecto) y modo claro. La preferencia se guarda en `localStorage` (clave `tetris-theme`), así que se respeta entre sesiones.

- Los colores de la interfaz (fondo, panel, overlay, botones) están definidos como variables CSS en `:root` (`style.css`); el modo claro las sobrescribe con `:root[data-theme="light"]`.
- El tablero (`<canvas id="board">`) se pinta directamente con Canvas 2D, así que las líneas de la cuadrícula y el highlight de los bloques no heredan CSS: `game.js` mantiene su propia tabla `CANVAS_THEME_COLORS` (`dark` / `light`) y la aplica al redibujar cuando cambia el tema. Esa tabla también incluye `hole`/`holeEdge` para el círculo de la tuerca: `hole` replica el `--board-bg` de cada tema (para que el agujero se vea como fondo del tablero) y `holeEdge` es el contorno sutil del círculo.
- Los colores de las piezas (`COLORS`) se mantienen iguales en ambos temas para conservar la identidad visual del Tetris.

---

## Skins visuales

El `<select>` junto al icono de tema (panel derecho) cambia el estilo con el que se pintan los
bloques del tablero, la pieza fantasma y la vista previa. La preferencia se guarda en
`localStorage` (clave `tetris-skin`) y el cambio se aplica **al instante**, sin recargar la
página ni perder la partida en curso.

| Skin       | Aspecto                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------- |
| 🕹️ Retro  | El aspecto original: colores planos y un highlight superior sutil. Es la skin por defecto.   |
| 🌈 Neón    | Paleta saturada sobre **fondo negro forzado** (se mantiene negro incluso en tema claro) y un resplandor (`shadowBlur`/`shadowColor`) alrededor de cada bloque. |
| 🎀 Pastel  | Paleta de tonos suaves con **esquinas redondeadas** en cada bloque.                           |
| 👾 Pixel   | Colores clásicos con una **textura de subcuadrados 4×4** superpuesta, simulando un sprite de 8 bits. |

Notas de diseño:

- Cada skin define su propia paleta de colores (`SKINS.<nombre>.colors`, en `game.js`), con los
  mismos índices que `COLORS` (piezas 1–7, tuerca 8, power-ups 9–13). Retro y Pixel reutilizan
  directamente `COLORS`; Neón y Pastel usan tonos propios también para los power-ups, ya que sus
  iconos (emoji) siguen siendo perfectamente legibles encima de cualquier color de fondo.
- La skin solo decide **cómo se pinta el relleno de una celda** (`paintCell`); el icono de
  power-up, el agujero circular de la tuerca y la estrella del comodín del Tinte los sigue
  dibujando siempre la misma lógica común (`drawBlock`/`drawHole`/`drawWild`), que delega en
  `paintCell` para el fondo. Así ninguna skin duplica esa lógica.
- El tema claro/oscuro (`CANVAS_THEME_COLORS`) y la skin conviven sin pisarse: colores de UI como
  la rejilla o el highlight siguen saliendo del tema salvo que la skin decida sobreescribirlos
  (Neón fuerza su propio fondo y color de rejilla; el resto respeta el tema activo).

---

## Power-ups

Cada **10 líneas** eliminadas (contador `POWERUP_EVERY` en `game.js`) la siguiente pieza especial se
anuncia primero en el panel **NEXT**, para dar tiempo a decidir dónde soltarla. El panel derecho
(sección **POWER-UP**) muestra cuántas líneas faltan para el próximo y, cuando ya está en NEXT, su
icono y nombre; la descripción completa de cada efecto vive siempre visible en la lista **EFECTOS**
del panel izquierdo (o en el modal de ayuda ❓ en ventanas estrechas), donde la fila del power-up en
curso se resalta.

Los power-ups **no se fijan como bloques normales**: al aterrizar disparan su efecto sobre el tablero
y desaparecen. Cualquier vía de caída (gravedad, soft drop o hard drop) los activa igual, porque todas
pasan por el mismo `lockPiece()`.

| Icono | Power-up     | Efecto                                                                                     |
| ----- | ------------ | ------------------------------------------------------------------------------------------- |
| 💣    | **Bomba**    | Destruye el área de 3×3 celdas centrada en el punto donde aterriza.                          |
| ⚡    | **Rayo**     | Limpia una fila o una columna completa. Rota la pieza (`↑`) antes de soltarla para elegir: horizontal limpia la fila donde cae, vertical limpia la columna. |
| 🎨    | **Tinte**    | Convierte todos los bloques del color más frecuente del tablero en **comodines** (parpadean en dorado ★). No borra nada de inmediato: los comodines desaparecen recién cuando completas la **siguiente** línea, sea cual sea. |
| ⬇️    | **Gravedad** | Compacta cada columna hacia abajo, cerrando los huecos que hayan quedado bajo bloques flotantes. |
| ❄️    | **Congelar** | Detiene la caída automática durante 5 segundos; mover, rotar y soltar la pieza actual siguen funcionando con normalidad. |

Notas de diseño:

- Los bloques que destruye un power-up **no cuentan como líneas eliminadas** (no suman a `lines`), así
  que usar uno nunca dispara en cadena la aparición de otro ni sube de nivel por sí solo.
- Bomba, Rayo (en su modo columna) y el borrado de comodines pueden dejar bloques flotando sin soporte
  debajo — es intencional: la Gravedad existe justo para resolver eso.
- Nunca sale el mismo power-up dos veces seguidas.
- Pausar (`P`) con un Congelar activo conserva el tiempo restante; no se "gasta" hielo mientras el
  juego está en pausa.

---

## Cómo funciona

El juego se compone de tres archivos que cooperan:

### 1. `index.html`

Define la estructura visual:

- Un `<canvas id="board">` de **300 × 600** píxeles donde se renderiza el tablero, envuelto en
  `.board-wrap` junto con el overlay de **PAUSA** / **GAME OVER**.
- Un **panel izquierdo** de referencia estática (`EFECTOS` y `CONTROLES`), siempre visible en
  pantallas anchas; en ventanas por debajo de 800px se oculta y se abre como modal con el botón ❓
  (o la tecla `H`), pausando la partida mientras está abierto.
- Un **panel derecho** con el estado vivo de la partida: `SCORE`, `LINES`, `LEVEL`, la vista previa
  `NEXT`, el contador de `POWER-UP` y, al pie, los botones de icono de tema y ayuda.

### 2. `style.css`

Aporta el aspecto visual con estética _retro arcade_: tipografía monoespaciada para los marcadores y _backdrop blur_ en los overlays. Todos los colores están centralizados en variables CSS (`:root`), con una variante `:root[data-theme="light"]` para el modo claro; el modo oscuro es el valor por defecto.

### 3. `game.js`

Contiene toda la lógica del juego. A grandes rasgos:

- **Modelo del tablero**: una matriz `ROWS × COLS` donde cada celda guarda `0` (vacía) o un índice de color (1–8) que identifica la pieza. La tuerca usa además el centinela `HOLE` (`-1`) en su celda central: colisiona como un bloque normal y se funde en el tablero al fijarse (por lo que cuenta como celda llena al limpiar líneas), pero `drawBlock`/`drawHole` la pintan como un círculo en vez de un cuadrado de color.
- **Piezas**: definidas como matrices cuadradas. Para rotar se calcula la transposición + reverso de filas (`rotateCW`).
- **Detección de colisiones** (`collide`): comprueba que ninguna celda de la pieza salga del tablero ni se solape con bloques ya fijados.
- **Wall kicks** (`tryRotate`): si la rotación choca, intenta desplazar la pieza ±1 y ±2 columnas antes de descartar el giro.
- **Game loop** (`loop`): basado en `requestAnimationFrame`, acumula el tiempo transcurrido y baja la pieza una fila cuando se supera `dropInterval`.
- **Limpieza de líneas** (`clearLines`): recorre el tablero de abajo hacia arriba; cada fila completa se elimina y se inserta una vacía en la cima.
- **Puntuación**: usa la tabla clásica `[0, 100, 300, 500, 800]` multiplicada por el nivel actual; el hard drop suma 2 puntos por celda recorrida y el soft drop 1 punto por fila.
- **Nivel y velocidad**: el nivel sube cada 10 líneas; la velocidad de caída se calcula como `max(100, 1000 − (level − 1) × 90)` milisegundos.
- **Ghost piece** (`ghostY`): proyecta la posición final de la pieza actual hacia abajo y la dibuja con `globalAlpha = 0.2`.
- **Power-ups** (tipos 9–13, ver sección [Power-ups](#power-ups)): `lockPiece()` comprueba `POWERUP_EFFECTS[current.type]` antes de decidir entre `merge()` (pieza normal) o ejecutar el efecto correspondiente (`bombEffect`, `rayEffect`, `dyeEffect`, `gravityEffect`, `freezeEffect`). El comodín del Tinte usa el centinela `WILD` (`-2`), igual de "sólido" que `HOLE` para `collide`/`clearLines`, y se limpia en `clearWilds()` tras cada línea real.
- **Skins visuales** (ver sección [Skins visuales](#skins-visuales)): `drawBlock` delega el relleno de cada celda en `SKINS[currentSkin].paintCell`, mientras que `drawHole`/`drawWild` reutilizan ese mismo `paintCell` para su fondo antes de dibujar el agujero o la estrella. `drawGrid`, `draw()` y `drawNext()` consultan `SKINS[currentSkin].gridColor`/`canvasBg` para dejar que una skin (p.ej. Neón) sobreescriba color de rejilla y fondo del canvas por encima del tema claro/oscuro.

### Flujo del juego

```
init()
  ├─ createBoard()                  → matriz vacía
  ├─ next = randomPiece()
  ├─ spawn()                        → mueve next a current y genera nueva next
  └─ requestAnimationFrame(loop)
        ↓
   loop(timestamp)
     ├─ acumula dt
     ├─ si dt ≥ dropInterval → baja la pieza o llama a lockPiece()
     ├─ draw()  (grid + tablero + ghost + pieza actual)
     └─ si el juego sigue activo (no game over, no pausa) → requestAnimationFrame(loop)
        en caso contrario, el bucle no se reprograma y se detiene aquí

   keydown → mover / rotar / soft-drop / hard-drop / pausa
```

Cuando una pieza recién generada ya colisiona al aparecer (`spawn`), se dispara `endGame()` y se muestra el overlay de **Game Over**. `loop()` comprueba `gameOver` (y `paused`) justo después de dibujar y, si está activo, no vuelve a pedir un nuevo frame: el bucle se detiene ahí mismo y el tablero queda congelado en su estado final, sin que sigan cayendo o fijándose piezas detrás del overlay.

---

## Tecnologías

- **HTML5** — marcado y dos elementos `<canvas>` (tablero y vista previa).
- **CSS3** — _flexbox_, variables de color, `backdrop-filter` y `box-shadow`.
- **JavaScript (ES6+) vanilla** — `const`/`let`, _arrow functions_, _spread operator_, `Array.from`, _template literals_…
- **Canvas 2D API** — para todo el renderizado del juego.
- **`requestAnimationFrame`** — para el bucle de juego sincronizado con el navegador.

**Sin dependencias.** No hay `package.json`, ni bundler, ni transpilador.

---

## Estructura del proyecto

```
03-tetris/
├── index.html      # Estructura del DOM y canvas
├── style.css       # Estilos del juego (dark theme)
├── game.js         # Toda la lógica del Tetris (~300 líneas)
└── README.md
```

---

## Personalización

Algunos parámetros fáciles de tunear en `game.js`:

| Constante        | Significado                                    | Por defecto           |
| ---------------- | ----------------------------------------------- | --------------------- |
| `COLS`           | Columnas del tablero                            | `10`                  |
| `ROWS`           | Filas del tablero                               | `20`                  |
| `BLOCK`          | Tamaño en píxeles de cada celda                 | `30`                  |
| `COLORS`         | Paleta de colores por tipo de pieza y power-up  | 13 colores            |
| `LINE_SCORES`    | Puntos por 1, 2, 3 o 4 líneas eliminadas        | `[0,100,300,500,800]` |
| `dropInterval`   | Velocidad inicial de caída en ms                | `1000`                |
| `POWERUP_EVERY`  | Líneas eliminadas entre power-ups               | `10`                  |
| `FREEZE_MS`      | Duración del Congelar en ms                     | `5000`                |
| `POWERUP_SCORES` | Puntos por celda/uso afectado por un power-up   | ver `game.js`         |

> Si cambias `COLS`, `ROWS` o `BLOCK`, recuerda ajustar también `width` y `height` del `<canvas id="board">` en `index.html` para que coincida (`COLS × BLOCK` × `ROWS × BLOCK`).

---

## Automatización con Claude Code

Este repositorio usa [Claude Code Action](https://github.com/anthropics/claude-code-action) en GitHub Actions (`.github/workflows/`):

- **`claude.yml`** — responde cuando se menciona `@claude` en un issue, comentario o revisión de PR.
- **`claude-code-review.yml`** — revisa automáticamente cada pull request abierto o actualizado.
- **`claude-issue-triage.yml`** — al abrir o editar un issue, Claude lo analiza contra el código, aplica etiquetas (`tipo:*`, `area:*`, `prio:*`, `size:*`, `estado:*`, ver `.github/scripts/ensure-labels.sh`) y publica un comentario de diagnóstico en español con la hipótesis técnica y un enfoque propuesto. Se puede excluir un issue puntual con la etiqueta `skip-triage`.

## Licencia

Proyecto de uso libre con fines educativos y de práctica.
