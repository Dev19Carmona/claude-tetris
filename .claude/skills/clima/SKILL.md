---
name: clima
description: Consulta el clima actual y el pronóstico usando wttr.in y Open-Meteo. Sin argumentos detecta la ubicación automáticamente por IP; con un argumento consulta esa ciudad. Úsala cuando el usuario pregunte por el clima, la temperatura, si va a llover, el pronóstico, o invoque /clima.
allowed-tools: Bash
---

# Clima

Consulta el clima actual (y opcionalmente el pronóstico) sin necesidad de API key, usando `curl` contra `wttr.in` y `Open-Meteo`.

## Paso 1 — Resumen rápido (siempre)

Ejecuta primero esto, sin importar si luego se necesita el pronóstico:

- Sin ciudad (detecta ubicación por IP automáticamente):
  ```bash
  curl -s --max-time 10 "https://wttr.in/?format=%l:+%c+%t+(sensación+%f)+viento+%w+humedad+%h&lang=es"
  ```
- Con ciudad (URL-encoded, ej. espacios como `%20` o `+`, tildes codificadas):
  ```bash
  curl -s --max-time 10 "https://wttr.in/<ciudad>?format=%l:+%c+%t+(sensación+%f)+viento+%w+humedad+%h&lang=es"
  ```

Usa siempre `-s` (silencioso) y `--max-time 10` (evita colgarse). Si la respuesta viene vacía, es un error HTML, o el comando falla, no reintentes — pasa directo al Paso 2 usando esa misma ciudad (o sin ciudad, para geolocalizar por IP).

Si el usuario solo pidió el clima actual (sin mencionar pronóstico/próximos días/lluvia futura), este resumen ya es suficiente — repórtalo con el formato del Paso 3 y termina ahí.

## Paso 2 — Datos estructurados (pronóstico, lluvia futura, o si el Paso 1 falló)

1. **Resolver coordenadas:**
   - Si el usuario dio una ciudad:
     ```bash
     curl -s --max-time 10 "https://geocoding-api.open-meteo.com/v1/search?name=<ciudad>&count=1&language=es&format=json"
     ```
     Toma `latitude`, `longitude`, `name`, `country` del primer resultado. Si `results` viene vacío o falta, la ciudad no existe — ver sección de errores.
   - Si no dio ciudad (detección automática):
     ```bash
     curl -s --max-time 10 "https://ipapi.co/json/"
     ```
     Toma `latitude`, `longitude`, `city`, `country_name`. Si esto falla, usa el nombre de ciudad que haya devuelto wttr.in en el Paso 1 y geocodifícalo como arriba.

2. **Consultar el clima:**
   ```bash
   curl -s --max-time 10 "https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3"
   ```

3. **Interpretar el JSON** leyéndolo directamente del output (no uses `jq`, puede no estar instalado en Windows). Traduce cada `weather_code` a español y emoji con la tabla en `references/wmo-codes.md` (cárgala solo en este paso).

## Paso 3 — Formato de respuesta

Responde siempre en español, unidades métricas (°C, km/h, mm), con esta plantilla:

```
📍 <Ciudad>, <País>
🌡️  <temp>°C (sensación <sensación>°C) — <descripción>
💧 Humedad <h>%   🌬️ Viento <v> km/h   ☔ Precipitación <p> mm
```

Si se ejecutó el Paso 2, agrega el bloque de pronóstico:

```

Pronóstico:
  Mañana   <min>–<max>°C  <descripción>  (lluvia <prob>%)
  Pasado   <min>–<max>°C  <descripción>  (lluvia <prob>%)
```

Si solo se ejecutó el Paso 1 (resumen rápido de wttr.in, sin pronóstico), reporta lo disponible con el mismo estilo de plantilla, omitiendo el bloque de pronóstico.

## Errores

Reporta el problema en una sola línea, sin reintentar en bucle:

- **Sin conexión / timeout:** "No pude consultar el clima: sin conexión o la petición tardó demasiado."
- **Ciudad no encontrada:** "No encontré '<ciudad>'. Intenta agregar el país, por ejemplo '<ciudad>, Colombia'."
- **Geolocalización por IP falló y no hay ciudad:** pide al usuario que indique una ciudad explícita.
