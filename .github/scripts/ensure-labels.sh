#!/usr/bin/env bash
# Crea o actualiza el set de etiquetas de triage usado por el workflow
# "Claude Issue Triage" (.github/workflows/claude-issue-triage.yml).
#
# Idempotente: usa `gh label create --force`, que crea la etiqueta si no
# existe o actualiza color/descripción si ya existe. Se puede ejecutar en
# cada run sin efectos secundarios.
#
# Requiere: gh CLI autenticado (variable de entorno GH_TOKEN) con permiso
# `issues: write` sobre el repo.

set -euo pipefail

ensure_label() {
  local name="$1" color="$2" description="$3"
  gh label create "$name" --color "$color" --description "$description" --force
}

# --- Tipo -------------------------------------------------------------
ensure_label "tipo:bug"         "d73a4a" "Comportamiento incorrecto del juego"
ensure_label "tipo:feature"     "a2eeef" "Nueva funcionalidad o mejora"
ensure_label "tipo:pregunta"    "d876e3" "Duda o solicitud de información"
ensure_label "tipo:docs"        "0075ca" "Cambios en README u otra documentación"
ensure_label "tipo:refactor"    "fbca04" "Reestructuración de código sin cambiar comportamiento"
ensure_label "tipo:rendimiento" "c2e0c6" "Problema o mejora de rendimiento"

# --- Área ---------------------------------------------------------------
ensure_label "area:gameplay"    "1d76db" "Colisión, rotación, gravedad, lockPiece, spawn"
ensure_label "area:render"      "2188ff" "draw, drawNext, ghost piece, canvas"
ensure_label "area:ui"          "54aeff" "index.html, style.css, HUD, overlay"
ensure_label "area:controles"   "79c0ff" "Listeners de teclado / input"
ensure_label "area:puntuacion"  "a5d6ff" "LINE_SCORES, nivel, dropInterval"
ensure_label "area:proyecto"    "c8e1ff" "README, workflows, configuración del repo"

# --- Prioridad ------------------------------------------------------------
ensure_label "prio:P0" "b60205" "Crítico: bloquea el juego o rompe la partida"
ensure_label "prio:P1" "d93f0b" "Alta: afecta a la experiencia de forma notable"
ensure_label "prio:P2" "fbca04" "Media: molesto pero no bloqueante"
ensure_label "prio:P3" "0e8a16" "Baja: cosmético o mejora menor"

# --- Tamaño estimado --------------------------------------------------
ensure_label "size:S" "ededed" "Cambio pequeño, pocas líneas"
ensure_label "size:M" "bfd4f2" "Cambio moderado, uno o pocos archivos"
ensure_label "size:L" "5319e7" "Cambio grande o que toca varias áreas"

# --- Estado -----------------------------------------------------------
ensure_label "estado:necesita-info" "e4e669" "Falta información para reproducir o entender el issue"
ensure_label "estado:duplicado"     "cfd3d7" "Duplica un issue ya existente"

# --- Control del propio workflow --------------------------------------
ensure_label "skip-triage" "ffffff" "Evita que el triage automático de Claude procese este issue"
