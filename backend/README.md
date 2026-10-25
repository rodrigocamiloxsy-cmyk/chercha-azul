# Backend de Chercha Azul (Render)

Backend Node.js sin dependencias externas. Consulta MLB Stats API y filtra los registros de estadísticas individuales cuya liga aparece como `LIDOM` y cuyo equipo es Tigres del Licey.

## Ejecutar localmente

Requiere Node.js 20 o superior.

```bash
npm start
```

Abre `http://localhost:3000/health` y luego `http://localhost:3000/api/stats`.

## Publicar en Render

1. Sube este proyecto a un repositorio de GitHub.
2. En Render elige **New + → Web Service** y conecta ese repositorio.
3. Si el repositorio contiene toda la web, configura **Root Directory** como `backend`.
4. Build Command: `npm install`.
5. Start Command: `npm start`.
6. Opcionalmente configura `LIDOM_SEASON=2026`. Render proporciona `PORT` automáticamente.
7. Tras desplegar, prueba `/health` y `/api/stats` en la URL que te asigne Render.
8. Copia la URL pública del endpoint `/api/stats` a `statsApiUrl` en `config.js` de la web.

## Endpoints

- `GET /health`: estado del servicio.
- `GET /api/stats`: récord, próximos y últimos partidos, posiciones y estadísticas individuales de bateadores y lanzadores del Licey.

Los resultados se guardan en caché cinco minutos para reducir solicitudes. La fuente es una API no oficial; compara los datos con LIDOM. Los datos de abridor probable no se rellenan porque todavía no hemos confirmado una fuente fiable para ese campo.

## Matchup Lab

- `GET /api/players?league=lidom|mlb&season=AAAA`: plantilla completa. Une las plantillas de cada equipo (`/teams/{id}/roster`) con los jugadores que tienen estadísticas (`/stats`, paginado de 1000 en 1000). Caché 6 h.
- `GET /api/player/{id}?league=&season=`: bio, estadísticas de bateo y pitcheo y splits `vl`/`vr` (`stats=statSplits&sitCodes=vl,vr`). Caché 10 min.
- `GET /api/matchup?batter={id}&pitcher={id}`: `stats=vsPlayer&opposingPlayerId=`. Devuelve totales y por temporada, no fecha ni resultado de cada turno. Caché 30 min.

Si la fuente no tiene un dato, el backend devuelve `null` y la web muestra «Sin datos» o «Sin enfrentamientos registrados». No se inventan estadísticas.

## Líderes del equipo

`GET /api/stats?season=AAAA` acepta una temporada (por defecto `LIDOM_SEASON`) y guarda una caché de 5 minutos por temporada. Las filas de `roster.hitters` y `roster.pitchers` incluyen `id`, `pos` y, en bateadores, `obp`, `slg` y `plateAppearances`.
