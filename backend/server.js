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

// ---- Matchup Lab: plantillas, fichas, splits y enfrentamientos (MLB Stats API) ----
const LEAGUES = { lidom: { sportId: '17', leagueId: '131' }, mlb: { sportId: '1', leagueId: null } };
const memo = new Map();
async function memoized(key, ttl, fn) {
  const h = memo.get(key);
  if (h && Date.now() - h.t < ttl) return h.v;
  try { const v = await fn(); memo.set(key, { t: Date.now(), v }); if (memo.size > 400) memo.delete(memo.keys().next().value); return v; }
  catch (e) { if (h) return { ...h.v, stale: true }; throw e; }
}
const pickStats = (o, map) => Object.fromEntries(map.map(([to, from]) => [to, o?.[from] ?? null]));
const HIT = [['avg','avg'],['obp','obp'],['slg','slg'],['ops','ops'],['ab','atBats'],['h','hits'],['hr','homeRuns'],['rbi','rbi'],['r','runs'],['bb','baseOnBalls'],['so','strikeOuts'],['sb','stolenBases'],['pa','plateAppearances'],['g','gamesPlayed']];
const PIT = [['era','era'],['whip','whip'],['w','wins'],['l','losses'],['ip','inningsPitched'],['so','strikeOuts'],['bb','baseOnBalls'],['h','hits'],['hr','homeRuns'],['sv','saves'],['g','gamesPitched']];
const firstStat = d => { for (const b of d?.stats || []) { const s = (b.splits || [])[0]; if (s?.stat && Object.keys(s.stat).length) return s.stat; } return null; };
const validSeason = v => { const n = Number(v); return Number.isInteger(n) && n >= 1990 && n <= new Date().getFullYear() + 1 ? String(n) : SEASON; };

async function leaguePlayers(league, season) {
  const L = LEAGUES[league];
  const teams = ((await getJson(`/teams?sportId=${L.sportId}&season=${season}`)).teams || []).filter(t => !L.leagueId || !t.league?.id || String(t.league.id) === L.leagueId);
  const byId = new Map(); const sources = { roster: 0, stats: 0 };
  const rosters = await Promise.all(teams.map(t => getJson(`/teams/${t.id}/roster?rosterType=fullSeason&season=${season}`).then(r => [t, r.roster || []]).catch(() => [t, []])));
  for (const [t, list] of rosters) for (const r of list) if (r.person?.id && !byId.has(r.person.id)) { byId.set(r.person.id, { id: r.person.id, name: r.person.fullName, team: canonicalTeam(t.name), pos: r.position?.abbreviation || null, type: r.position?.type || null }); sources.roster++; }
  if (league === 'lidom') for (const group of ['hitting', 'pitching']) {   // completa con jugadores que tengan estadísticas (paginado)
    for (let off = 0; off < 5000; off += 1000) {
      const data = await getJson(`/stats?stats=season&group=${group}&season=${season}&sportIds=${L.sportId}&playerPool=ALL&limit=1000&offset=${off}`).catch(() => null);
      const all = (data?.stats || []).flatMap(b => b.splits || []);
      for (const x of all) if (x.league?.name === 'LIDOM' && x.player?.id && !byId.has(x.player.id)) { byId.set(x.player.id, { id: x.player.id, name: x.player.fullName, team: canonicalTeam(x.team?.name || ''), pos: x.position?.abbreviation || null, type: group === 'pitching' ? 'Pitcher' : 'Hitter' }); sources.stats++; }
      if (all.length < 1000) break;
    }
  }
  const players = [...byId.values()].filter(p => p.name).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return { league, season, count: players.length, sources, teams: teams.length, players };
}
async function buildPlayer(id, league, season) {
  const L = LEAGUES[league], q = `season=${season}&sportId=${L.sportId}`, errors = [];
  const safe = p => p.catch(e => { errors.push(e.message); return null; });
  const [bio, hit, pit, spl] = await Promise.all([
    safe(getJson(`/people/${id}?hydrate=currentTeam`)),
    safe(getJson(`/people/${id}/stats?stats=season&group=hitting&${q}`)),
    safe(getJson(`/people/${id}/stats?stats=season&group=pitching&${q}`)),
    safe(getJson(`/people/${id}/stats?stats=statSplits&group=hitting&sitCodes=vl,vr&${q}`))
  ]);
  const person = bio?.people?.[0] || null;
  const h = firstStat(hit), p = firstStat(pit);
  const hitting = h && (Number(h.atBats || 0) + Number(h.plateAppearances || 0) > 0) ? pickStats(h, HIT) : null;
  const pitching = p && Number(p.gamesPitched || 0) > 0 ? pickStats(p, PIT) : null;
  const splits = {};
  for (const b of spl?.stats || []) for (const s of b.splits || []) { const c = s.split?.code; if ((c === 'vl' || c === 'vr') && s.stat) splits[c] = pickStats(s.stat, HIT); }
  return { id: Number(id), league, season, name: person?.fullName || null, team: person?.currentTeam?.name ? canonicalTeam(person.currentTeam.name) : null,
    pos: person?.primaryPosition?.abbreviation || null, bats: person?.batSide?.code || null, throws: person?.pitchHand?.code || null,
    hitting, pitching, splits: Object.keys(splits).length ? splits : null, errors };
}
async function buildMatchup(batter, pitcher) {
  const data = await getJson(`/people/${batter}/stats?stats=vsPlayer&group=hitting&opposingPlayerId=${pitcher}`);
  const name = b => String(b.type?.displayName || '');
  const blocks = data.stats || [];
  const total = firstStat({ stats: blocks.filter(b => /total/i.test(name(b))) });
  const bySeason = (blocks.find(b => name(b) === 'vsPlayer')?.splits || []).filter(s => s.stat).map(s => ({ season: s.season || null, team: s.team?.name || null, ...pickStats(s.stat, HIT) }));
  const found = !!total && Number(total.atBats || 0) + Number(total.plateAppearances || 0) > 0;
  return { batter: Number(batter), pitcher: Number(pitcher), found, total: found ? pickStats(total, HIT) : null, bySeason: found ? bySeason : [], encounters: [],
    note: 'La fuente entrega totales y por temporada; no incluye fecha ni resultado de cada turno.' };
}
async function handleLab(url, res) {
  const league = LEAGUES[url.searchParams.get('league')] ? url.searchParams.get('league') : 'lidom';
  const season = validSeason(url.searchParams.get('season'));
  try {
    let data;
    if (url.pathname === '/api/players') data = await memoized(`pl:${league}:${season}`, 6 * 3600e3, () => leaguePlayers(league, season));
    else if (url.pathname === '/api/matchup') {
      const b = url.searchParams.get('batter'), p = url.searchParams.get('pitcher');
      if (!/^\d+$/.test(b || '') || !/^\d+$/.test(p || '')) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Parámetros batter y pitcher inválidos' })); }
      data = await memoized(`mu:${b}:${p}`, 30 * 60e3, () => buildMatchup(b, p));
    } else { const id = url.pathname.split('/').pop(); data = await memoized(`p:${id}:${league}:${season}`, 10 * 60e3, () => buildPlayer(id, league, season)); }
    res.writeHead(200, { 'Cache-Control': 'public, max-age=120' }); return res.end(JSON.stringify(data));
  } catch (error) {
    console.error(error); res.writeHead(502); return res.end(JSON.stringify({ error: 'No se pudo consultar la fuente de estadísticas', detail: error.message }));
  }
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
  if (url.pathname === '/api/players' || url.pathname === '/api/matchup' || /^\/api\/player\/\d+$/.test(url.pathname)) return handleLab(url, res);
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
    res.writeHead(404); return res.end(JSON.stringify({ error: 'Ruta no encontrada', available: ['/health', '/api/stats', '/api/news', '/api/rotation', '/api/players', '/api/player/:id', '/api/matchup'] }));
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
