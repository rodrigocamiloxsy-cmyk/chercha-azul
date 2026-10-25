/* MATCHUP LAB: plantillas completas, buscador, fichas, splits y enfrentamientos (datos de la API de Chercha Azul / MLB Stats API). */
(() => {
  "use strict";
  const root = document.getElementById("matchuplab"); if (!root) return;
  const cfg = window.CHERCHA_CONFIG || {};
  const base = (cfg.matchupApiBase || (cfg.statsApiUrl || "").replace(/\/api\/stats$/, "")).replace(/\/$/, "");
  const $ = id => document.getElementById(id);
  const st = { league: "lidom", season: String(new Date().getFullYear()), players: [], team: "", pos: "", q: "", shown: 60, token: 0, ltoken: 0, started: false, meta: null };
  const cache = new Map();
  const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const dash = v => (v === null || v === undefined || v === "") ? "—" : String(v);
  const h = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; for (const k of kids) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k))); return e; };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const isPitcher = p => p.type === "Pitcher" || /^(P|SP|RP|CL)$/.test(p.pos || "");
  const canHit = p => !isPitcher(p) || p.pos === "TWP" || p.type === "Two-Way Player";
  async function once(path) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 70000);
    try { const r = await fetch(base + path, { signal: ctl.signal, headers: { Accept: "application/json" } }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); } finally { clearTimeout(t); }
  }
  async function api(path) {
    if (cache.has(path)) return cache.get(path);
    if (!base) throw new Error("API no configurada");
    let j; try { j = await once(path); } catch (e) { j = await once(path); }   // reintento: Render gratis puede estar despertando
    cache.set(path, j); return j;
  }
  const photo = id => `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_160,q_auto:best/v1/people/${id}/headshot/67/current`;
  function avatar(p, big) {
    const box = h("div", "ml-avatar" + (big ? " ml-avatar-lg" : ""), h("span", "", (p.name || "?").split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase()));
    const img = document.createElement("img"); img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer"; img.src = photo(p.id);
    img.addEventListener("error", () => img.remove()); box.append(img); return box;
  }
  const tile = (label, value) => h("div", "ml-tile", h("span", "ml-tl", label), h("b", "ml-tv", dash(value)));

  /* ---------- lista y filtros ---------- */
  const matchesPos = p => !st.pos || (st.pos === "P" ? isPitcher(p) : st.pos === "H" ? !isPitcher(p) : p.pos === st.pos);
  function search(q, list) {
    const toks = norm(q).split(/\s+/).filter(Boolean);
    return list.filter(p => { p._n = p._n || norm(`${p.name} ${p.team || ""} ${p.pos || ""}`); return toks.every(t => p._n.includes(t)); });
  }
  const filtered = () => search(st.q, st.players).filter(p => (!st.team || p.team === st.team) && matchesPos(p));
  function renderList() {
    const list = filtered(), box = $("mlList"); box.replaceChildren();
    list.slice(0, st.shown).forEach(p => { const c = h("button", "ml-card", avatar(p), h("span", "ml-cn", p.name), h("small", "", [p.team, p.pos].filter(Boolean).join(" · ") || "—")); c.type = "button"; c.addEventListener("click", () => openPlayer(p)); box.append(c); });
    $("mlMore").hidden = list.length <= st.shown;
    const m = st.meta;
    $("mlStatus").textContent = !st.players.length ? "" : `${list.length} de ${st.players.length} jugadores` + (m ? ` · ${m.sources.roster} desde plantillas, ${m.sources.stats} desde estadísticas · fuente: MLB Stats API (no oficial)` : "");
    if (st.players.length && !list.length) box.append(h("p", "ml-empty", "No hay jugadores que coincidan con la búsqueda y los filtros."));
  }
  async function loadPlayers(keepView) {
    const tok = ++st.ltoken; if (!keepView) showView("list"); st.players = []; st.meta = null; st.team = ""; st.pos = "";
    $("mlList").replaceChildren(); $("mlMore").hidden = true;
    $("mlStatus").textContent = "Cargando plantillas… la primera consulta puede tardar hasta 1 minuto (servidor gratuito).";
    try {
      const d = await api(`/api/players?league=${st.league}&season=${st.season}`);
      if (tok !== st.ltoken) return;
      st.players = d.players || []; st.meta = d;
      const teams = [...new Set(st.players.map(p => p.team).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
      $("mlTeam").replaceChildren(new Option("Todos", ""), ...teams.map(t => new Option(t, t)));
      const pos = [...new Set(st.players.map(p => p.pos).filter(Boolean))].sort();
      $("mlPos").replaceChildren(new Option("Todas", ""), new Option("Lanzadores", "P"), new Option("Bateadores", "H"), ...pos.map(x => new Option(x, x)));
      if (!st.players.length) { $("mlStatus").textContent = `La fuente no devuelve plantilla para ${st.league.toUpperCase()} ${st.season}. Prueba otra temporada o liga.`; return; }
      renderList();
    } catch (e) {
      if (tok !== st.ltoken) return;
      $("mlStatus").textContent = "No se pudo cargar la plantilla (" + e.message + "). ";
      const b = h("button", "ml-link", "Reintentar"); b.type = "button"; b.addEventListener("click", () => { cache.clear(); loadPlayers(); }); $("mlStatus").append(b);
    }
  }
  /* ---------- sugerencias ---------- */
  function suggest(input, box, source, onPick) {
    const run = debounce(() => {
      const q = input.value.trim(); box.replaceChildren();
      if (q.length < 2) { box.hidden = true; return; }
      const res = search(q, source()).slice(0, 8);
      if (!res.length) box.append(h("div", "ml-sug-empty", "Sin coincidencias"));
      res.forEach(p => { const b = h("button", "ml-sug", h("b", "", p.name), h("small", "", [p.team, p.pos].filter(Boolean).join(" · "))); b.type = "button"; b.addEventListener("mousedown", e => { e.preventDefault(); box.hidden = true; onPick(p); }); box.append(b); });
      box.hidden = false;
    }, 220);
    input.addEventListener("input", run);
    input.addEventListener("keydown", e => { if (e.key === "Escape") box.hidden = true; if (e.key === "Enter") { const f = search(input.value.trim(), source())[0]; if (f) { e.preventDefault(); box.hidden = true; onPick(f); } } });
    input.addEventListener("blur", () => setTimeout(() => { box.hidden = true; }, 150));
  }
  /* ---------- ficha ---------- */
  function showView(v) { $("mlListWrap").hidden = v !== "list"; $("mlDetail").hidden = v !== "detail"; }
  const back = () => { const b = h("button", "ml-back", "← Volver a la lista"); b.type = "button"; b.addEventListener("click", () => { st.token++; showView("list"); root.scrollIntoView && root.scrollIntoView({ behavior: "smooth", block: "start" }); }); return b; };
  async function openPlayer(p) {
    const tok = ++st.token, box = $("mlDetail"); showView("detail");
    box.replaceChildren(back(), h("p", "ml-empty", "Cargando ficha de " + p.name + "…")); root.scrollIntoView && root.scrollIntoView({ block: "start" });
    try { const d = await api(`/api/player/${p.id}?league=${st.league}&season=${st.season}`); if (tok === st.token) renderDetail(p, d); }
    catch (e) { if (tok !== st.token) return; const r = h("button", "ml-link", "Reintentar"); r.type = "button"; r.addEventListener("click", () => openPlayer(p)); box.replaceChildren(back(), h("p", "ml-empty", "No se pudo cargar la ficha (" + e.message + "). ", r)); }
  }
  const SC = { avg: .4, obp: .5, slg: .8, ops: 1.2 };
  function splitCard(title, s) {
    return h("div", "ml-split", h("h4", "", title), s ? h("div", "ml-tiles", tile("AVG", s.avg), tile("OBP", s.obp), tile("SLG", s.slg), tile("OPS", s.ops), tile("H", s.h), tile("HR", s.hr), tile("K", s.so), tile("AB", s.ab)) : h("p", "ml-empty", "Sin datos para este grupo."));
  }
  function bars(vl, vr) {
    const wrap = h("div", "ml-bars");
    for (const k of ["avg", "obp", "slg", "ops"]) {
      const a = parseFloat(vl && vl[k]), b = parseFloat(vr && vr[k]), w = v => isNaN(v) ? 0 : Math.max(2, Math.min(100, v / SC[k] * 100));
      const row = h("div", "ml-bar-row", h("span", "ml-bl", k.toUpperCase()));
      const l = h("div", "ml-bar ml-bar-l"), r = h("div", "ml-bar ml-bar-r"); l.style.width = w(a) + "%"; r.style.width = w(b) + "%";
      row.append(h("div", "ml-bar-box", l, h("em", "", dash(vl && vl[k]))), h("div", "ml-bar-box", r, h("em", "", dash(vr && vr[k])))); wrap.append(row);
    }
    wrap.prepend(h("div", "ml-bar-legend", h("span", "", "▬ vs. zurdos"), h("span", "alt", "▬ vs. derechos"))); return wrap;
  }
  function renderDetail(p, d) {
    const box = $("mlDetail"), hit = d.hitting, pit = d.pitching;
    const meta = [d.team || p.team, d.pos || p.pos, d.bats ? "Batea " + d.bats : null, d.throws ? "Lanza " + d.throws : null].filter(Boolean).join(" · ");
    box.replaceChildren(back(), h("div", "ml-head", avatar(p, true), h("div", "", h("h3", "", d.name || p.name), h("p", "", meta || "—"), h("span", "ml-badge", `${st.league.toUpperCase()} · ${d.season} · MLB Stats API (no oficial)`))));
    if (hit) box.append(h("h4", "ml-sec", "BATEO"), h("div", "ml-tiles ml-tiles-big", tile("AVG", hit.avg), tile("OBP", hit.obp), tile("SLG", hit.slg), tile("OPS", hit.ops), tile("AB", hit.ab), tile("H", hit.h), tile("HR", hit.hr), tile("RBI", hit.rbi), tile("R", hit.r), tile("BB", hit.bb), tile("SO", hit.so), tile("SB", hit.sb)));
    if (pit) box.append(h("h4", "ml-sec", "PITCHEO"), h("div", "ml-tiles ml-tiles-big", tile("ERA", pit.era), tile("WHIP", pit.whip), tile("W-L", `${dash(pit.w)}-${dash(pit.l)}`), tile("IP", pit.ip), tile("SO", pit.so), tile("BB", pit.bb), tile("H", pit.h), tile("HR", pit.hr), tile("SV", pit.sv)));
    if (!hit && !pit) box.append(h("p", "ml-empty", `Sin estadísticas disponibles para ${d.season} en ${st.league.toUpperCase()}.`));
    if (canHit(p)) {
      box.append(h("h4", "ml-sec", "RENDIMIENTO VS. ZURDOS Y DERECHOS"));
      if (d.splits) box.append(h("div", "ml-splits", splitCard("VS. ZURDOS", d.splits.vl), splitCard("VS. DERECHOS", d.splits.vr)), bars(d.splits.vl, d.splits.vr));
      else box.append(h("p", "ml-empty", "La fuente no devuelve splits por lateralidad para este jugador, liga o temporada."));
    }
    box.append(matchupPanel(p));
  }
  /* ---------- enfrentamiento directo ---------- */
  function matchupPanel(p) {
    const meHits = canHit(p), wantPitcher = meHits, other = { v: null };
    const out = h("div", "ml-mu-out"), chip = h("span", "ml-chip", "Sin seleccionar");
    const input = h("input", "ml-input"); input.type = "search"; input.placeholder = wantPitcher ? "Buscar pitcher rival…" : "Buscar bateador…"; input.autocomplete = "off";
    const sug = h("div", "ml-suggest"); sug.hidden = true;
    const go = h("button", "ml-go", "Consultar"); go.type = "button";
    suggest(input, sug, () => st.players.filter(x => x.id !== p.id && (wantPitcher ? isPitcher(x) : canHit(x))), x => { other.v = x; chip.textContent = x.name; input.value = ""; });
    go.addEventListener("click", async () => {
      if (!other.v) { out.replaceChildren(h("p", "ml-empty", "Selecciona primero " + (wantPitcher ? "un pitcher." : "un bateador."))); return; }
      const b = wantPitcher ? p : other.v, q = wantPitcher ? other.v : p; out.replaceChildren(h("p", "ml-empty", "Consultando historial…"));
      try {
        const m = await api(`/api/matchup?batter=${b.id}&pitcher=${q.id}&league=${st.league}`), title = h("h4", "ml-sec", `${b.name} vs. ${q.name}`);
        if (!m.found) { out.replaceChildren(title, h("p", "ml-empty", "Sin enfrentamientos registrados")); return; }
        const t = m.total; out.replaceChildren(title, h("div", "ml-tiles ml-tiles-big", tile("AB", t.ab), tile("H", t.h), tile("AVG", t.avg), tile("HR", t.hr), tile("RBI", t.rbi), tile("K", t.so), tile("BB", t.bb)));
        if (m.bySeason && m.bySeason.length) { const tb = h("div", "ml-seasons"); m.bySeason.forEach(s => tb.append(h("div", "ml-srow", h("b", "", dash(s.season)), `AB ${dash(s.ab)} · H ${dash(s.h)} · AVG ${dash(s.avg)} · HR ${dash(s.hr)} · K ${dash(s.so)}`))); out.append(tb); }
        out.append(h("p", "ml-note", m.note || ""));
      } catch (e) { out.replaceChildren(h("p", "ml-empty", "No se pudo consultar el historial (" + e.message + ").")); }
    });
    return h("div", "ml-mu", h("h4", "ml-sec", "ENFRENTAMIENTO DIRECTO: BATEADOR VS. PITCHER"), h("p", "ml-note", "Historial directo contra un pitcher específico. No es lo mismo que las estadísticas generales contra zurdos o derechos."), h("div", "ml-mu-row", h("div", "ml-search ml-search-sm", input, sug), chip, go), out);
  }
  /* abre la ficha de un jugador desde otra sección (p. ej. Líderes del equipo) */
  window.MatchupLab = { open(p, season) {
    st.league = "lidom"; st.started = true; const s = String(season || st.season);
    if (!st.players.length || s !== st.season || $("mlLeague").value !== "lidom") { st.season = s; $("mlSeason").value = s; $("mlLeague").value = "lidom"; loadPlayers(true); }
    openPlayer(p);
  } };
  /* ---------- arranque ---------- */
  const cy = new Date().getFullYear(); $("mlSeason").replaceChildren(...Array.from({ length: 6 }, (_, i) => new Option(String(cy - i), String(cy - i))));
  $("mlSeason").value = st.season;
  $("mlLeague").addEventListener("change", e => { st.league = e.target.value; loadPlayers(); });
  $("mlSeason").addEventListener("change", e => { st.season = e.target.value; loadPlayers(); });
  $("mlTeam").addEventListener("change", e => { st.team = e.target.value; st.shown = 60; renderList(); });
  $("mlPos").addEventListener("change", e => { st.pos = e.target.value; st.shown = 60; renderList(); });
  $("mlMore").addEventListener("click", () => { st.shown += 60; renderList(); });
  $("mlSearch").addEventListener("input", debounce(e => { st.q = e.target.value.trim(); st.shown = 60; if (st.players.length) renderList(); }, 200));
  suggest($("mlSearch"), $("mlSuggest"), () => st.players, p => { $("mlSearch").value = p.name; st.q = ""; openPlayer(p); });
  const start = () => { if (!st.started) { st.started = true; loadPlayers(); } };
  if ("IntersectionObserver" in window) new IntersectionObserver((en, ob) => { if (en.some(x => x.isIntersecting)) { start(); ob.disconnect(); } }).observe(root); else start();
})();
