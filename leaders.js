/* LÍDERES DEL EQUIPO: calcula los líderes con los datos reales de /api/stats (la misma API y caché de la sección Equipo). */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  if (!$("ldBat")) return;
  const api = (window.CHERCHA_CONFIG && window.CHERCHA_CONFIG.statsApiUrl) || "";
  const st = { data: null, cur: null, season: null, qual: true, cache: new Map(), token: 0 };
  const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
  const thirds = v => { const m = String(v ?? "").match(/^(\d+)(?:\.(\d))?$/); return m ? Number(m[1]) * 3 + Number(m[2] || 0) : null; };   // 8.1 → 25 tercios
  const h = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; for (const k of kids) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k))); return e; };
  const isLicey = v => /licey|tigres/i.test(String(v || ""));
  const B = (l, t, f, v, rate) => ({ l, t, f, v, dir: 1, rate, group: "bat" });
  const P = (l, t, f, v, rate, dir) => ({ l, t, f, v, dir: dir || 1, rate, group: "pit" });
  const BAT = [
    B("AVG", "Promedio de bateo", p => num(p.avg), p => p.avg, true), B("OPS", "Embasado + slugging", p => num(p.ops), p => p.ops, true),
    B("OBP", "Porcentaje de embasado", p => num(p.obp), p => p.obp, true), B("SLG", "Slugging", p => num(p.slg), p => p.slg, true),
    B("HR", "Jonrones", p => num(p.hr), p => p.hr), B("RBI", "Carreras impulsadas", p => num(p.rbi), p => p.rbi),
    B("H", "Hits", p => num(p.hits), p => p.hits), B("R", "Carreras anotadas", p => num(p.runs), p => p.runs), B("SB", "Bases robadas", p => num(p.stolenBases), p => p.stolenBases)];
  const PIT = [
    P("ERA", "Efectividad más baja", p => num(p.era), p => p.era, true, -1), P("WHIP", "WHIP más bajo", p => num(p.whip), p => p.whip, true, -1),
    P("SO", "Ponches", p => num(p.strikeouts), p => p.strikeouts), P("W", "Victorias", p => num(p.wins), p => p.wins),
    P("SV", "Salvamentos", p => num(p.saves), p => p.saves), P("IP", "Entradas lanzadas", p => thirds(p.ip), p => p.ip)];
  /* Mínimo de calificación estilo MLB: 3.1 turnos al bate / 1.0 entrada por juego del equipo. No se puede verificar que LIDOM use el mismo criterio. */
  const teamGames = d => { const r = (d.standings || []).find(t => isLicey(t.team)); const g = r ? Number(r.wins) + Number(r.losses) : NaN; return Number.isFinite(g) && g > 0 ? g : null; };
  const qualified = (group, p, g) => { if (group === "bat") { const pa = num(p.plateAppearances); return pa === null ? null : pa >= 3.1 * g; } const t = thirds(p.ip); return t === null ? null : t >= g * 3; };
  function leadersOf(card, list, g) {
    let pool = list.filter(p => card.f(p) !== null);
    if (!pool.length) return { none: "No disponible", why: "La fuente no trae este dato." };
    if (card.rate && st.qual && g !== null) { pool = pool.filter(p => qualified(card.group, p, g) !== false); if (!pool.length) return { none: "Sin calificados", why: "Nadie alcanza el mínimo todavía." }; }
    const vals = pool.map(card.f), best = card.dir > 0 ? Math.max(...vals) : Math.min(...vals);
    if (!card.rate && best === 0) return { none: "Sin registros", why: "Nadie en el equipo tiene este registro." };
    const ties = pool.filter(p => card.f(p) === best);
    return { value: card.v(ties[0]), ties };
  }
  const photo = id => `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_120,q_auto:best/v1/people/${id}/headshot/67/current`;
  function avatar(p) {
    const box = h("span", "ld-av", h("i", "", (p.name || "?").split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase()));
    if (p.id) { const img = document.createElement("img"); img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer"; img.src = photo(p.id); img.addEventListener("error", () => img.remove()); box.append(img); }
    return box;
  }
  function openFicha(p, group) {
    const nav = document.querySelector('a[data-view="numeritos"]'); if (nav) nav.click();
    if (window.MatchupLab) window.MatchupLab.open({ id: p.id, name: p.name, team: p.team, pos: p.pos, type: group === "pit" ? "Pitcher" : "Hitter" }, st.season);
  }
  function row(p, group) {
    const b = h("button", "ld-row", avatar(p), h("span", "ld-name", p.name), h("small", "", p.pos || "—")); b.type = "button";
    if (p.id) b.addEventListener("click", () => openFicha(p, group)); else { b.disabled = true; b.title = "Ficha no disponible: el backend no envía el id del jugador."; }
    return b;
  }
  function cardEl(card, res) {
    const c = h("article", "ld-card" + (res.none ? " is-na" : ""), h("div", "ld-top", h("b", "ld-stat", card.l), h("span", "ld-sub", card.t)));
    if (res.none) { c.append(h("div", "ld-val ld-na", res.none), h("p", "ld-why", res.why)); return c; }
    c.append(h("div", "ld-val", String(res.value)));
    if (res.ties.length > 1) c.append(h("span", "ld-tie", `EMPATE · ${res.ties.length} JUGADORES`));
    const rows = h("div", "ld-rows"); res.ties.slice(0, 4).forEach(p => rows.append(row(p, card.group)));
    if (res.ties.length > 4) rows.append(h("small", "ld-more", `+${res.ties.length - 4} más`));
    c.append(rows); return c;
  }
  function render(d) {
    const hit = (d.roster && d.roster.hitters) || [], pit = (d.roster && d.roster.pitchers) || [], g = teamGames(d);
    $("ldBat").replaceChildren(...BAT.map(c => cardEl(c, leadersOf(c, hit, g))));
    $("ldPit").replaceChildren(...PIT.map(c => cardEl(c, leadersOf(c, pit, g))));
    const q = !st.qual ? "Sin mínimo de calificación: se incluyen todos los jugadores." : g === null ? "No se pudo verificar el mínimo de calificación (faltan los juegos del equipo)."
      : `AVG, OPS, OBP, SLG, ERA y WHIP usan solo jugadores calificados con un mínimo estilo MLB (3.1 turnos al bate o 1.0 entrada por juego del equipo, ${g} juegos). Es un criterio estándar y no se pudo verificar que LIDOM use el mismo.`;
    $("ldFoot").textContent = `Calculado con ${hit.length} bateadores y ${pit.length} lanzadores que devuelve la fuente (MLB Stats API, no oficial) · temporada ${d.season || st.season}. ${q} En caso de empate se muestran todos los jugadores empatados.`;
  }
  const msg = (t, retry) => { for (const id of ["ldBat", "ldPit"]) $(id).replaceChildren(h("p", "empty-row", t)); $("ldFoot").textContent = ""; if (retry) { const b = h("button", "ld-link", "Reintentar"); b.type = "button"; b.addEventListener("click", retry); $("ldBat").firstChild.append(b); } };
  async function fetchSeason(season) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 70000);
    try { const r = await fetch(api + (api.includes("?") ? "&" : "?") + "season=" + encodeURIComponent(season), { signal: ctl.signal, headers: { Accept: "application/json" } }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); } finally { clearTimeout(t); }
  }
  async function show() {
    if (st.season === st.cur && st.data) return render(st.data);
    if (st.cache.has(st.season)) return render(st.cache.get(st.season));
    if (!api) return msg("API no configurada.");
    const tok = ++st.token; msg("Cargando líderes de la temporada " + st.season + "…");
    try { let d; try { d = await fetchSeason(st.season); } catch (e) { d = await fetchSeason(st.season); } if (tok !== st.token) return; st.cache.set(st.season, d); render(d); }
    catch (e) { if (tok === st.token) msg("No se pudieron cargar los líderes (" + e.message + "). ", show); }
  }
  const sel = $("ldSeason"), cy = new Date().getFullYear();
  sel.replaceChildren(...Array.from({ length: 6 }, (_, i) => new Option(String(cy - i), String(cy - i))));
  sel.addEventListener("change", () => { st.season = sel.value; show(); });
  $("ldQual").addEventListener("change", e => { st.qual = e.target.checked; show(); });
  window.ChaLeaders = {
    update(data) { st.data = data; st.cur = String(data.season || cy); if (st.season === null) { st.season = st.cur; sel.value = st.cur; } if (st.season === st.cur) render(data); },   // se llama cada vez que se actualizan las estadísticas
    error(m) { if (!st.data) msg("No se pudieron cargar los líderes (" + m + ").", null); }
  };
})();
