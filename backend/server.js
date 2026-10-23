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
  'tigres': 'Tigres del Licey',
  'licey': 'Tigres del Licey',
  'aguilas cibaenas': 'Águilas Cibaeñas',
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

const STATUS_ES = { 'Scheduled':'Programado','Final':'Final','Postponed':'Pospuesto','In Progress':'En juego','Live':'En juego','Suspended':'Suspendido','Cancelled':'Cancelado','Pre-Game':'Por comenzar','Warmup':'Por comenzar' };
const esStatus = s => STATUS_ES[s] || s;

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
  const seasonQuery = `season=${encodeURIComponent(SEASON)}&sportIds=${LIDOM_SPORT_ID}&playerPool=ALL&limit=2000`;
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
    dateLabel: new Date(`${d.date}T12:00:00Z`).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
    home: canonicalTeam(g.teams?.home?.team?.name || ''),
    away: canonicalTeam(g.teams?.away?.team?.name || ''),
    status: g.status?.detailedState || g.status?.abstractGameState || 'Por confirmar',
    homeScore: g.teams?.home?.score ?? null,
    awayScore: g.teams?.away?.score ?? null,
    gameDate: g.gameDate || null
  })));
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santo_Domingo' });
  const nowMs = Date.now();
  const liceyGames = games.filter(g => /Tigres del Licey/i.test(g.home) || /Tigres del Licey/i.test(g.away));
  const nextGame = liceyGames.filter(g => !/final|completed|postponed/i.test(g.status) && (!g.gameDate || new Date(g.gameDate).getTime() > nowMs - 4*3600e3)).sort((a,b) => String(a.gameDate||a.date).localeCompare(String(b.gameDate||b.date)))[0];
  const lastGame = liceyGames.filter(g => /final|completed/i.test(g.status)).sort((a,b) => b.date.localeCompare(a.date))[0];
  const liceyRecord = allTeams.find(t => /Tigres del Licey/i.test(t.team));

  return {
    source: 'MLB Stats API · registros identificados como LIDOM',
    season: SEASON,
    updatedAt: new Date().toISOString(),
    note: 'Fuente no oficial de LIDOM. Contrasta los datos con la liga; los campos no disponibles se muestran como —.',
    record: liceyRecord ? { wins: liceyRecord.wins, losses: liceyRecord.losses } : null,
    nextGame: nextGame ? { home: nextGame.home, away: nextGame.away, dateLabel: `${nextGame.dateLabel} · ${esStatus(nextGame.status)}` } : null,
    lastResult: lastGame ? { score: `${lastGame.away} ${lastGame.awayScore ?? '—'} - ${lastGame.homeScore ?? '—'} ${lastGame.home}` } : null,
    standings: allTeams,
    roster: {
      hitters: statsRows(hittingData, true, 'hitting'),
      pitchers: statsRows(pitchingData, true, 'pitching')
    },
    schedule: games
  };
}


// ---- Noticias del sitio oficial (Licey.com, WordPress) ----
const NEWS_BASE = process.env.NEWS_BASE || 'https://www.licey.com';
const NEWS_MS = 15 * 60 * 1000;
let newsCache = null, newsAt = 0;
const ENT = { '&amp;':'&', '&quot;':'"', '&#039;':"'", '&#8216;':'‘', '&#8217;':'’', '&rsquo;':'’', '&#8220;':'“', '&#8221;':'”', '&#8211;':'–', '&#8212;':'—', '&#8230;':'…', '&hellip;':'…', '&nbsp;':' ' };
const plain = h => String(h || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, ' ').replace(/&#?\w+;/g, m => ENT[m] || m).replace(/\s+/g, ' ').trim();
const short = (t, n = 180) => t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;
const officialUrl = u => { try { const x = new URL(u); return x.protocol === 'https:' && /(^|\.)licey\.com$/.test(x.hostname) ? x.href : null; } catch { return null; } };
async function fetchText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'CherchaAzul/1.0 (+https://cherchaazul.netlify.app)', Accept: 'application/json, application/rss+xml, text/xml, */*' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
  return r.text();
}
async function newsFromRest() {
  const posts = JSON.parse(await fetchText(`${NEWS_BASE}/wp-json/wp/v2/posts?per_page=12&_embed=wp:featuredmedia`));
  if (!Array.isArray(posts)) throw new Error('Respuesta REST inesperada');
  return posts.map(p => ({ title: plain(p.title?.rendered), url: officialUrl(p.link), date: p.date_gmt ? p.date_gmt + 'Z' : (p.date || null), excerpt: short(plain(p.excerpt?.rendered)), image: officialUrl(p._embedded?.['wp:featuredmedia']?.[0]?.source_url) }));
}
async function newsFromRss() {
  const xml = await fetchText(`${NEWS_BASE}/feed/`);
  const tag = (b, t) => (b.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1] || '';
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 12).map(m => { const b = m[1]; const img = (b.match(/<media:content[^>]*url="([^"]+)"/) || b.match(/<enclosure[^>]*url="([^"]+)"/) || b.match(/<img[^>]*src="([^"]+)"/) || [])[1];
    return { title: plain(tag(b, 'title')), url: officialUrl(plain(tag(b, 'link'))), date: tag(b, 'pubDate') ? new Date(plain(tag(b, 'pubDate'))).toISOString() : null, excerpt: short(plain(tag(b, 'description'))), image: officialUrl(img) }; });
}
async function buildNews() {
  let items;
  try { items = await newsFromRest(); } catch (e) { console.error('REST falló, probando RSS:', e.message); items = await newsFromRss(); }
  items = items.filter(n => n.title && n.url);
  if (!items.length) throw new Error('Sin noticias en la fuente');
  return { source: 'Licey.com (sitio oficial del Club Atlético Licey)', updatedAt: new Date().toISOString(), items };
}

// ---- Rotación abridora (anuncio publicado en Licey.com) ----
const ROT_MS = 15 * 60 * 1000;
let rotCache = null, rotAt = 0;
const WEEK = { domingo:0, lunes:1, martes:2, miercoles:3, jueves:4, viernes:5, sabado:6 };
const noAccent = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const xmlTag = (b, t) => (b.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1] || '';
const NM = "[A-ZÁÉÍÓÚÑ][\\wáéíóúñ'’\\-]+";
const PITCHER_RE = new RegExp(`(?:subirá a la loma|le tocará el turno|lanzará|tomará la pelota|será el abridor|abrirá|será el encargado)[^.]*?\\b(?:diestro|zurdo|derecho|izquierdo|lanzador|pitcher)\\s+(${NM}(?:\\s+(?:(?:de|del|la|los)\\s+)?${NM}){0,3}(?:\\s+Jr\\.)?)`);
function parseRotation(html, publishedIso) {
  const paras = [...String(html).matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => plain(m[1]));
  const base = new Date(new Date(publishedIso).getTime() - 4 * 3600e3); // hora de República Dominicana
  const games = [];
  for (const t of paras) {
    const m = t.match(/^(?:Para\s+)?(?:el\s+|este\s+)(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)(?:\s+(\d{1,2}))?/i);
    if (!m) continue;
    const wd = WEEK[noAccent(m[1])], day = m[2] ? Number(m[2]) : null;
    let date = null;
    for (let i = 0; i < 21 && !date; i++) { const d = new Date(base.getTime() + i * 864e5); if (d.getUTCDay() === wd && (!day || d.getUTCDate() === day)) date = d.toISOString().slice(0, 10); }
    const opp = t.match(/(?:frente a|ante|contra)\s+(?:los|las)\s+(?:visitantes\s+|locales\s+)?(.+?)\s+en\s+el\s+(?:estadio|parque)/i);
    const ven = t.match(/en\s+el\s+((?:estadio|parque)\s+[^(]{3,70}?)\s*\(/i);
    const time = t.match(/\((\d{1,2}:\d{2}\s*[ap]\.?\s?m\.?)\)/i);
    const p = t.match(PITCHER_RE);
    const tbd = /a\s+ser\s+anunciado|por\s+anunciar|sin\s+anunciar/i.test(t);
    if (!date || !(p || tbd)) continue;
    games.push({ date, opponent: opp ? canonicalTeam(opp[1].trim()) : null, venue: ven ? ven[1].charAt(0).toUpperCase() + ven[1].slice(1) : null, time: time ? time[1] : null, pitcher: p ? p[1].trim() : null });
  }
  return games;
}
async function rotationPost() {
  try {
    const posts = JSON.parse(await fetchText(`${NEWS_BASE}/wp-json/wp/v2/posts?search=rotaci%C3%B3n&per_page=5&_fields=title,link,date_gmt,content`));
    const p = Array.isArray(posts) && posts.find(x => /rotaci/i.test(plain(x.title?.rendered)));
    if (p) return { title: plain(p.title.rendered), url: officialUrl(p.link), date: p.date_gmt + 'Z', html: p.content?.rendered || '' };
  } catch (e) { console.error('REST rotación falló, probando RSS:', e.message); }
  const xml = await fetchText(`${NEWS_BASE}/?s=rotaci%C3%B3n&feed=rss2`);
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = plain(xmlTag(m[1], 'title'));
    if (/rotaci/i.test(title)) return { title, url: officialUrl(plain(xmlTag(m[1], 'link'))), date: new Date(plain(xmlTag(m[1], 'pubDate'))).toISOString(), html: (xmlTag(m[1], 'content:encoded') || xmlTag(m[1], 'description')).replace(/<!\[CDATA\[|\]\]>/g, '') };
  }
  throw new Error('No se encontró un anuncio de rotación');
}
async function buildRotation() {
  const post = await rotationPost();
  return { source: 'Licey.com (sitio oficial del Club Atlético Licey)', updatedAt: new Date().toISOString(), article: { title: post.title, url: post.url, publishedAt: post.date }, games: parseRotation(post.html, post.date) };
}
module.exports = { parseRotation };

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
  if (url.pathname === '/api/news') {
    try {
      if (!newsCache || Date.now() - newsAt >= NEWS_MS) { newsCache = await buildNews(); newsAt = Date.now(); }
      res.writeHead(200, { 'Cache-Control': 'public, max-age=300' }); return res.end(JSON.stringify(newsCache));
    } catch (error) {
      console.error(error);
      if (newsCache) { res.writeHead(200, { 'X-Stale': '1' }); return res.end(JSON.stringify({ ...newsCache, stale: true })); }
      res.writeHead(502); return res.end(JSON.stringify({ error: 'No se pudieron consultar las noticias', detail: error.message }));
    }
  }
  if (url.pathname === '/api/rotation') {
    try {
      if (!rotCache || Date.now() - rotAt >= ROT_MS) { rotCache = await buildRotation(); rotAt = Date.now(); }
      res.writeHead(200, { 'Cache-Control': 'public, max-age=300' }); return res.end(JSON.stringify(rotCache));
    } catch (error) {
      console.error(error);
      if (rotCache) { res.writeHead(200, { 'X-Stale': '1' }); return res.end(JSON.stringify({ ...rotCache, stale: true })); }
      res.writeHead(502); return res.end(JSON.stringify({ error: 'No se pudo consultar la rotación', detail: error.message }));
    }
  }
  if (url.pathname !== '/api/stats' && url.pathname !== '/api/lidom') {
    res.writeHead(404); return res.end(JSON.stringify({ error: 'Ruta no encontrada', available: ['/health', '/api/stats', '/api/news', '/api/rotation'] }));
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
    if (cached) { res.writeHead(200, { 'X-Stale': '1' }); return res.end(JSON.stringify({ ...cached, stale: true })); }
    res.writeHead(502);
    return res.end(JSON.stringify({ error: 'No se pudieron consultar los datos de LIDOM', detail: error.message }));
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Chercha Azul API escuchando en puerto ${PORT}; temporada ${SEASON}`));
