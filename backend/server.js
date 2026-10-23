'use strict';

const http = require('node:http');
const PORT = Number(process.env.PORT || 3000);
const SEASON = String(process.env.LIDOM_SEASON || '2026');
const MLB_API = 'https://statsapi.mlb.com/api/v1';
const LIDOM_LEAGUE_ID = '131';
const LIDOM_SPORT_ID = '17';
const CACHE_MS = 5 * 60 * 1000;
let cached = null;
let cachedAt = 0;

const TEAM_NAMES = {
  'tigres del licey': 'Tigres del Licey',
  'toros': 'Toros del Este',
  'toros del este': 'Toros del Este',
  'aguilas': 'Águilas Cibaeñas',
  'águilas': 'Águilas Cibaeñas',
  'aguilas cibaeñas': 'Águilas Cibaeñas',
  'águilas cibaeñas': 'Águilas Cibaeñas',
  'leones': 'Leones del Escogido',
  'leones del escogido': 'Leones del Escogido',
  'gigantes': 'Gigantes del Cibao',
  'gigantes del cibao': 'Gigantes del Cibao',
  'estrellas': 'Estrellas Orientales',
  'estrellas orientales': 'Estrellas Orientales'
};

function canonicalTeam(name = '') {
  const key = String(name).trim().toLocaleLowerCase('es');
  return TEAM_NAMES[key] || name;
}

async function getJson(path) {
  const response = await fetch(`${MLB_API}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'CherchaAzul/1.0' },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Proveedor respondió HTTP ${response.status} en ${path}`);
  return response.json();
}

function statsRows(data, teamFilter, group) {
  const splits = data?.stats?.flatMap(section => section.splits || []) || [];
  return splits
    .filter(x => x.league?.name === 'LIDOM' && x.team?.name && x.player?.fullName)
    .filter(x => !teamFilter || /tigres del licey/i.test(x.team.name))
    .map(x => {
      const s = x.stat || {};
      if (group === 'hitting') return {
        name: x.player.fullName,
        team: canonicalTeam(x.team.name),
        games: s.gamesPlayed ?? null,
        hits: s.hits ?? null,
        hr: s.homeRuns ?? null,
        rbi: s.rbi ?? null,
        avg: s.avg ?? null,
        ops: s.ops ?? null,
        atBats: s.atBats ?? null,
        runs: s.runs ?? null,
        doubles: s.doubles ?? null,
        triples: s.triples ?? null,
        stolenBases: s.stolenBases ?? null
      };
      return {
        name: x.player.fullName,
        team: canonicalTeam(x.team.name),
        games: s.gamesPitched ?? s.gamesPlayed ?? null,
        wins: s.wins ?? null,
        losses: s.losses ?? null,
        ip: s.inningsPitched ?? null,
        strikeouts: s.strikeOuts ?? null,
        walks: s.baseOnBalls ?? null,
        era: s.era ?? null,
        whip: s.whip ?? null,
        saves: s.saves ?? null
      };
    });
}

async function buildStats() {
  const seasonQuery = `season=${encodeURIComponent(SEASON)}&sportIds=${LIDOM_SPORT_ID}&playerPool=ALL`;
  const [standingsData, scheduleData, hittingData, pitchingData] = await Promise.all([
    getJson(`/standings?leagueId=${LIDOM_LEAGUE_ID}&season=${SEASON}&standingsTypes=regularSeason`),
    getJson(`/schedule?sportId=${LIDOM_SPORT_ID}&leagueId=${LIDOM_LEAGUE_ID}&season=${SEASON}&gameTypes=R`),
    getJson(`/stats?stats=season&group=hitting&${seasonQuery}`),
    getJson(`/stats?stats=season&group=pitching&${seasonQuery}`)
  ]);

  const allTeams = (standingsData.records || []).flatMap(group => group.teamRecords || []).map(t => ({
    team: canonicalTeam(t.team?.name || 'Equipo'),
    wins: t.wins ?? null,
    losses: t.losses ?? null,
    pct: t.winningPercentage ?? null,
    streak: t.streak?.streakCode || '—',
    gamesBack: t.gamesBack ?? null
  }));

  const games = (scheduleData.dates || []).flatMap(d => (d.games || []).map(g => ({
    date: d.date,
    dateLabel: new Date(`${d.date}T12:00:00`).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' }),
    home: canonicalTeam(g.teams?.home?.team?.name || ''),
    away: canonicalTeam(g.teams?.away?.team?.name || ''),
    status: g.status?.detailedState || g.status?.abstractGameState || 'Por confirmar',
    homeScore: g.teams?.home?.score ?? null,
    awayScore: g.teams?.away?.score ?? null,
    gameDate: g.gameDate || null
  })));
  const today = new Date().toISOString().slice(0, 10);
  const liceyGames = games.filter(g => /Tigres del Licey/i.test(g.home) || /Tigres del Licey/i.test(g.away));
  const nextGame = liceyGames.filter(g => g.date >= today && !/final|completed/i.test(g.status)).sort((a,b) => a.date.localeCompare(b.date))[0];
  const lastGame = liceyGames.filter(g => /final|completed/i.test(g.status)).sort((a,b) => b.date.localeCompare(a.date))[0];
  const liceyRecord = allTeams.find(t => /Tigres del Licey/i.test(t.team));

  return {
    source: 'MLB Stats API · registros identificados como LIDOM',
    season: SEASON,
    updatedAt: new Date().toISOString(),
    note: 'Fuente no oficial de LIDOM. Contrasta los datos con la liga; los campos no disponibles se muestran como —.',
    record: liceyRecord ? { wins: liceyRecord.wins, losses: liceyRecord.losses } : null,
    nextGame: nextGame ? { home: nextGame.home, away: nextGame.away, dateLabel: `${nextGame.dateLabel} · ${nextGame.status}` } : null,
    lastResult: lastGame ? { score: `${lastGame.away} ${lastGame.awayScore ?? '—'} - ${lastGame.homeScore ?? '—'} ${lastGame.home}` } : null,
    standings: allTeams,
    roster: {
      hitters: statsRows(hittingData, true, 'hitting'),
      pitchers: statsRows(pitchingData, true, 'pitching')
    },
    schedule: games
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (url.pathname === '/health') {
    res.writeHead(200); return res.end(JSON.stringify({ ok: true, service: 'chercha-azul-api', season: SEASON }));
  }
  if (url.pathname !== '/api/stats' && url.pathname !== '/api/lidom') {
    res.writeHead(404); return res.end(JSON.stringify({ error: 'Ruta no encontrada', available: ['/health', '/api/stats'] }));
  }
  try {
    if (cached && Date.now() - cachedAt < CACHE_MS) {
      res.writeHead(200, { 'Cache-Control': 'public, max-age=60' }); return res.end(JSON.stringify(cached));
    }
    const data = await buildStats();
    cached = data; cachedAt = Date.now();
    res.writeHead(200, { 'Cache-Control': 'public, max-age=60' });
    return res.end(JSON.stringify(data));
  } catch (error) {
    console.error(error);
    res.writeHead(502);
    return res.end(JSON.stringify({ error: 'No se pudieron consultar los datos de LIDOM', detail: error.message }));
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Chercha Azul API escuchando en puerto ${PORT}; temporada ${SEASON}`));
