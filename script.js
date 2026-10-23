/* Chercha Azul: prototipo de interfaz. Datos reales requieren API configurada. */
(() => {
  const $ = (id) => document.getElementById(id);
  const STORE = { chat: "cherchaAzul.chat.v1", predictions: "cherchaAzul.predictions.v1", notes: "cherchaAzul.notes.v1" };
  const safeRead = (key) => { try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } };
  const safeWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const clean = (value, max=500) => String(value || "").trim().slice(0,max);
  const escapeText = (value) => String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const timeLabel = (stamp) => { try { return new Date(stamp).toLocaleString("es-DO",{dateStyle:"short",timeStyle:"short"}); } catch { return ""; } };

  $("year").textContent = new Date().getFullYear();

  // Navegación por vistas: cada pestaña muestra solo su propio apartado.
  const menu = $("menuToggle"), nav = document.querySelector(".main-nav");
  const pages = [...document.querySelectorAll("[data-page]")];
  const navLinks = [...document.querySelectorAll("[data-view]")];
  function showPage(view, updateHash = true) {
    view = ({equipo:"calendario",posiciones:"calendario",proximos:"calendario",estadisticas:"numeritos",noticias:"noticias",comunidad:"chercha",whatsapp:"chercha"})[view] || view;
    const valid = ["noticias", "inicio", "numeritos", "chercha", "calendario", "redes", "ruta", "historia"].includes(view) ? view : "inicio";
    pages.forEach(page => page.classList.toggle("page-hidden", page.dataset.page !== valid));
    nav.querySelectorAll("a[data-view]").forEach(a => a.classList.toggle("active", a.dataset.view === valid));
    nav.classList.remove("open"); menu.setAttribute("aria-expanded", "false"); menu.textContent = "☰";
    if (updateHash) history.replaceState(null, "", "#" + valid);
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.querySelectorAll("[data-page='" + valid + "'] .reveal").forEach(el => el.classList.add("visible"));
  }
  menu.addEventListener("click", () => { const open = nav.classList.toggle("open"); menu.setAttribute("aria-expanded", String(open)); menu.textContent = open ? "✕" : "☰"; });
  navLinks.forEach(a => a.addEventListener("click", e => {
    const view = a.dataset.view;
    if (!view) return;
    e.preventDefault(); showPage(view);
  }));
  window.addEventListener("hashchange", () => showPage(location.hash.slice(1), false));
  showPage(location.hash.slice(1) || "inicio", false);


  // Historia interactiva: 24 campeonatos nacionales del Licey, en orden cronológico.
  const championships = [
    {year:"1951", rival:"Leones del Escogido", result:"4–1", manager:"Manuel Henríquez", mvp:"Alonzo Perry", story:"El campeonato inaugural del Licey en la etapa moderna de la liga dominicana. Los Tigres se impusieron al Escogido en la Serie Final.", source:"https://hoy.com.do/deportes/paseo-por-las-24-coronas-del-licey_987295.html"},
    {year:"1953", rival:"Águilas Cibaeñas", result:"4–1", manager:"Óscar Rodríguez", mvp:"Guayubín Olivo", story:"La segunda corona azul llegó ante las Águilas. Guayubín Olivo fue reconocido como Jugador Más Valioso de la Serie Final.", source:"https://ensegundos.do/2024/01/30/asi-gano-el-licey-sus-24-coronas-de-campeones/"},
    {year:"1958–59", rival:"Leones del Escogido", result:"5–4", manager:"Joe Schultz", mvp:"Pete Burnside", story:"Una final reñida que terminó con el Licey levantando su tercera corona. Pete Burnside fue el MVP de la Serie Final.", source:"https://hoy.com.do/deportes/paseo-por-las-24-coronas-del-licey_987295.html"},
    {year:"1963–64", rival:"Águilas Cibaeñas", result:"4–3", manager:"Vernon Benson", mvp:"Dato por verificar", story:"Una de las finales más recordadas por la remontada azul: el Licey regresó después de estar abajo 0–3 en la serie semifinal frente al Escogido y luego conquistó el título ante las Águilas.", source:"https://hoy.com.do/deportes/paseo-por-las-24-coronas-del-licey_987295.html"},
    {year:"1969–70", rival:"Dato por verificar", result:"Dato por verificar", manager:"Dato por verificar", mvp:"Dato por verificar", story:"El Licey sumó una nueva corona en la temporada 1969–70. Los detalles de la serie y sus protagonistas quedan pendientes de confirmar en una fuente histórica específica.", source:"https://www.licey.com/campeonatos-club-atletico-licey/"},
    {year:"1970–71", rival:"Dato por verificar", result:"Dato por verificar", manager:"Dato por verificar", mvp:"Dato por verificar", story:"Segundo campeonato consecutivo en las temporadas 1969–70 y 1970–71. Los detalles individuales de esta final se marcarán como pendientes hasta verificarlos.", source:"https://www.licey.com/campeonatos-club-atletico-licey/"},
    {year:"1972–73", rival:"Estrellas Orientales", result:"5–2", manager:"Tom Lasorda", mvp:"Teodoro Martínez", story:"El Licey venció a las Estrellas Orientales para conquistar su séptima corona. Tom Lasorda fue el dirigente y Teodoro Martínez recibió el reconocimiento de MVP.", source:"https://hoy.com.do/deportes/paseo-por-las-24-coronas-del-licey_987295.html"},
    {year:"1973–74", rival:"Águilas Cibaeñas", result:"5–2", manager:"Tom Lasorda", mvp:"Greg Shanahan", story:"Los Tigres repitieron el campeonato en temporadas consecutivas, esta vez ante las Águilas. Greg Shanahan fue elegido MVP de la Serie Final.", source:"https://hoy.com.do/deportes/paseo-por-las-24-coronas-del-licey_987295.html"},
    {year:"1976–77", rival:"Águilas Cibaeñas", result:"5–2", manager:"Buck Rodgers", mvp:"Manuel Mota", story:"El Licey derrotó a las Águilas para lograr su novena corona. Manuel Mota fue nombrado Jugador Más Valioso.", source:"https://hoy.com.do/deportes/paseo-por-las-24-coronas-del-licey_987295.html"},
    {year:"1979–80", rival:"Estrellas Orientales", result:"5–1", manager:"Del Crandall", mvp:"Mickey Hatcher", story:"Los azules superaron a las Estrellas en la final. Mickey Hatcher recibió el premio al jugador más valioso.", source:"https://hoy.com.do/deportes/paseo-por-las-24-coronas-del-licey_987295.html"},
    {year:"1982–83", rival:"Dato por verificar", result:"Dato por verificar", manager:"Dato por verificar", mvp:"Dato por verificar", story:"Comenzó una racha histórica de tres campeonatos consecutivos para el Licey, junto con las temporadas 1983–84 y 1984–85.", source:"https://www.licey.com/wp-content/uploads/2025/01/Guia-de-Medios-Licey-2024-2025.pdf"},
    {year:"1983–84", rival:"Dato por verificar", result:"Dato por verificar", manager:"Dato por verificar", mvp:"Dato por verificar", story:"Segunda corona consecutiva de la racha de tres títulos azules entre 1982–83 y 1984–85. Los datos específicos de la final quedan pendientes de verificación.", source:"https://www.licey.com/wp-content/uploads/2025/01/Guia-de-Medios-Licey-2024-2025.pdf"},
    {year:"1984–85", rival:"Dato por verificar", result:"Dato por verificar", manager:"Dato por verificar", mvp:"Dato por verificar", story:"El tercer campeonato consecutivo completó una de las rachas más destacadas del Licey en LIDOM.", source:"https://www.licey.com/wp-content/uploads/2025/01/Guia-de-Medios-Licey-2024-2025.pdf"},
    {year:"1990–91", rival:"Leones del Escogido", result:"4–1", manager:"John Roseboro", mvp:"Henry Rodríguez", story:"El Licey volvió a coronarse al vencer al Escogido. Henry Rodríguez fue el Jugador Más Valioso de la Serie Final.", source:"https://hoy.com.do/deportes/paseo-por-las-24-coronas-del-licey_987295.html"},
    {year:"1993–94", rival:"Águilas Cibaeñas", result:"4–1", manager:"Casey Parsons", mvp:"Silvestre Campusano", story:"Los Tigres vencieron a las Águilas en cinco partidos para conquistar su decimoquinta corona. Silvestre Campusano fue elegido MVP.", source:"https://hoy.com.do/deportes/paseo-por-las-24-coronas-del-licey_987295.html"},
    {year:"1998–99", rival:"Leones del Escogido", result:"5–4", manager:"Dave Jauss", mvp:"Ronnie Belliard", story:"Una final decidida en nueve juegos ante el Escogido dio al Licey su corona número 16. Ronnie Belliard fue el MVP.", source:"https://hoy.com.do/deportes/paseo-por-las-24-coronas-del-licey_987295.html"},
    {year:"2001–02", rival:"Águilas Cibaeñas", result:"4–3", manager:"Bob Geren", mvp:"D’Angelo Jiménez", story:"El Licey conquistó su corona número 17 al vencer a las Águilas en siete partidos. D’Angelo Jiménez fue reconocido como MVP.", source:"https://hoy.com.do/deportes/paseo-por-las-24-coronas-del-licey_987295.html"},
    {year:"2003–04", rival:"Gigantes del Cibao", result:"4–1", manager:"Manny Acta", mvp:"Henry Rodríguez", story:"El equipo azul derrotó a los Gigantes y sumó su título número 18. Henry Rodríguez obtuvo su segundo reconocimiento de MVP de Serie Final.", source:"https://ensegundos.do/2024/01/30/asi-gano-el-licey-sus-24-coronas-de-campeones/"},
    {year:"2005–06", rival:"Águilas Cibaeñas", result:"5–2", manager:"Rafael Landestoy", mvp:"Anderson Hernández y Erick Aybar", story:"Los Tigres se impusieron a las Águilas. El premio de jugador más valioso fue compartido por Anderson Hernández y Erick Aybar.", source:"https://ensegundos.do/2024/01/30/asi-gano-el-licey-sus-24-coronas-de-campeones/"},
    {year:"2008–09", rival:"Gigantes del Cibao", result:"4–1", manager:"José Offerman", mvp:"Anderson Hernández", story:"El Licey barrió la serie final en cinco partidos para obtener su vigésimo campeonato. Anderson Hernández fue elegido MVP.", source:"https://ensegundos.do/2024/01/30/asi-gano-el-licey-sus-24-coronas-de-campeones/"},
    {year:"2013–14", rival:"Leones del Escogido", result:"5–3", manager:"José Offerman", mvp:"Lew Ford", story:"Los azules derrotaron al Escogido y lograron la corona 21. Lew Ford fue el Jugador Más Valioso de la Serie Final.", source:"https://ensegundos.do/2024/01/30/asi-gano-el-licey-sus-24-coronas-de-campeones/"},
    {year:"2016–17", rival:"Águilas Cibaeñas", result:"5–4", manager:"Audo Vicente", mvp:"Sergio Alcántara", story:"El Licey venció a las Águilas en una final de nueve partidos y alcanzó su corona número 22. Sergio Alcántara fue el MVP.", source:"https://ensegundos.do/2024/01/30/asi-gano-el-licey-sus-24-coronas-de-campeones/"},
    {year:"2022–23", rival:"Estrellas Orientales", result:"4–1", manager:"José Offerman", mvp:"Jorge Alfaro", story:"Tras una espera de varias temporadas, el Licey conquistó su corona 23 al derrotar a las Estrellas en cinco partidos. Jorge Alfaro fue el MVP de la final.", source:"https://ensegundos.do/2024/01/30/asi-gano-el-licey-sus-24-coronas-de-campeones/"},
    {year:"2023–24", rival:"Estrellas Orientales", result:"4–3", manager:"Gilbert Gómez", mvp:"Gustavo Núñez", story:"El Licey conquistó su corona nacional número 24 al vencer 3–2 a las Estrellas Orientales en el séptimo partido de la Serie Final, el 27 de enero de 2024, y logró el bicampeonato. Gustavo Núñez fue elegido MVP de la Serie Final: bateó .370 (10 hits en 27 turnos), anotó cuatro carreras e impulsó cinco.", source:"https://lidom.com/tigres-del-licey/gustavo-nunez-fue-seleccionado-el-jugador-mas-valioso-de-la-serie-final-41108.html"}
  ];
  const historyMap = $("historyMap"), historyDetail = $("historyDetail");
  if (historyMap && historyDetail) {
    const esc = escapeText;
    historyMap.innerHTML = championships.map((c, i) => `<button class="history-marker${i === 0 ? " selected" : ""}" type="button" data-championship="${i}" aria-pressed="${i === 0 ? "true" : "false"}"><span class="history-marker-crown">♛</span><strong>${esc(c.year)}</strong><small>CORONA ${String(i+1).padStart(2,"0")}</small></button>`).join("");
    const renderChampionship = (index) => {
      const c = championships[index];
      historyMap.querySelectorAll(".history-marker").forEach((b) => { const selected = Number(b.dataset.championship) === index; b.classList.toggle("selected", selected); b.setAttribute("aria-pressed", String(selected)); });
      historyDetail.innerHTML = `<div class="history-detail-top"><span class="pill">CORONA #${index+1}</span><span class="history-detail-icon">♛</span></div><div class="eyebrow">CAMPEONATO NACIONAL LIDOM</div><h3>${esc(c.year)}</h3><p class="history-detail-lead">${esc(c.story)}</p><div class="history-facts"><div><span>RIVAL</span><strong>${esc(c.rival)}</strong></div><div><span>RESULTADO DE LA FINAL</span><strong>${esc(c.result)}</strong></div><div><span>MÁNAGER</span><strong>${esc(c.manager)}</strong></div><div><span>MVP DE LA SERIE FINAL</span><strong>${esc(c.mvp)}</strong></div></div><a class="history-source" href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">Consultar fuente histórica ↗</a>`;
    };
    historyMap.addEventListener("click", (event) => { const button = event.target.closest("[data-championship]"); if (button) renderChampionship(Number(button.dataset.championship)); });
    renderChampionship(0);
  }

  // Smooth reveal animation
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if(entry.isIntersecting){entry.target.classList.add("visible");observer.unobserve(entry.target);} }), {threshold:.12});
    revealEls.forEach(el => observer.observe(el));
  } else revealEls.forEach(el => el.classList.add("visible"));

  // WhatsApp group link is configured in config.js.
  const wa = (window.CHERCHA_CONFIG && window.CHERCHA_CONFIG.whatsappUrl) || "";
  if (wa && /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/.test(wa)) {
    $("whatsappLink").href = wa; $("whatsappNote").textContent = "Grupo de WhatsApp de la comunidad Chercha Azul.";
  } else {
    $("whatsappLink").href = "#"; $("whatsappLink").addEventListener("click", e => { e.preventDefault(); $("whatsappNote").textContent = "Pásanos el enlace de invitación del grupo para activar este botón."; });
  }

  // Solo se mantienen pendientes las redes para las que aún no se ha compartido un enlace.
  document.querySelectorAll(".pending-link").forEach(link => link.addEventListener("click", e => {
    e.preventDefault();
    const note = $("socialNote");
    if (note) note.textContent = `El enlace de ${link.dataset.social} está pendiente. Cuando nos lo compartas, lo activaremos.`;
  }));

  // Roster stats panel. Data is supplied by the configured API; no fake roster rows are created.
  let rosterMode = "hitters", sortKey = null, sortDir = -1;
  let rosterRows = { hitters: [], pitchers: [] };
  const rosterMeta = {
    hitters: { title: "Estadísticas de bateadores", description: "Promedio, jonrones, carreras impulsadas y OPS.", columns: ["JUGADOR","J","H","HR","CI","AVG","OPS"], keys: ["name","games","hits","hr","rbi","avg","ops"] },
    pitchers: { title: "Estadísticas de lanzadores", description: "Efectividad, entradas lanzadas, ponches, boletos y WHIP.", columns: ["LANZADOR","J","G","P","IL","K","ERA","WHIP"], keys: ["name","games","wins","losses","ip","strikeouts","era","whip"] }
  };
  const fmt = value => value == null || value === "" ? "—" : String(value);
  function renderRoster() {
    const meta = rosterMeta[rosterMode];
    $("rosterTitle").textContent = meta.title;
    $("rosterDescription").textContent = meta.description;
    $("rosterPanel").setAttribute("aria-labelledby", rosterMode === "hitters" ? "hittersTab" : "pitchersTab");
    $("hittersTab").classList.toggle("active", rosterMode === "hitters");
    $("pitchersTab").classList.toggle("active", rosterMode === "pitchers");
    $("hittersTab").setAttribute("aria-selected", String(rosterMode === "hitters"));
    $("pitchersTab").setAttribute("aria-selected", String(rosterMode === "pitchers"));
    const head = $("rosterTableHead");
    head.innerHTML = "<tr>" + meta.columns.map(c => `<th>${escapeText(c)}</th>`).join("") + "</tr>";
    const query = clean($("rosterSearch").value,80).toLocaleLowerCase("es");
    let rows = rosterRows[rosterMode].filter(row => clean(row.name,100).toLocaleLowerCase("es").includes(query));
    head.querySelectorAll("th").forEach((th, i) => { th.style.cursor = "pointer"; th.title = "Ordenar por esta columna"; th.addEventListener("click", () => { const k = meta.keys[i]; sortDir = (k === "name" || k === "era" || k === "whip") ? 1 : -1; sortKey = k; renderRoster(); }); });
    if (sortKey) rows = rows.slice().sort((a, b) => { if (sortKey === "name") return String(a.name).localeCompare(String(b.name), "es") * sortDir; const f = v => { const n = parseFloat(v); return isNaN(n) ? (sortDir > 0 ? 1e9 : -1e9) : n; }; return (f(a[sortKey]) - f(b[sortKey])) * sortDir; });
    $("rosterCount").textContent = `${rows.length} jugador${rows.length === 1 ? "" : "es"}`;
    const body = $("rosterTableBody");
    body.replaceChildren();
    if (!rows.length) {
      const tr = document.createElement("tr"), td = document.createElement("td");
      td.colSpan = meta.columns.length;
      td.className = "empty-row";
      td.textContent = rosterRows[rosterMode].length ? "No hay jugadores que coincidan con la búsqueda." : "Conecta la API para consultar las estadísticas de esta temporada.";
      tr.appendChild(td); body.appendChild(tr); return;
    }
    rows.forEach(row => {
      const tr = document.createElement("tr");
      meta.keys.forEach((key, index) => {
        const td = document.createElement("td");
        if (index === 0) {
          const pos = row.position ? ` <span class="player-position">${escapeText(row.position)}</span>` : "";
          const initials = clean(row.name,80).split(/\s+/).slice(0,2).map(w=>w[0]||"").join("").toUpperCase();
          td.innerHTML = `<div class="roster-player"><span class="player-initials">${escapeText(initials)}</span><span><span class="player-name">${escapeText(row.name || "Jugador")}</span>${pos}</span></div>`;
        } else td.textContent = fmt(row[key]);
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }
  document.querySelectorAll("[data-roster]").forEach(button => button.addEventListener("click", () => {
    rosterMode = button.dataset.roster; sortKey = null; renderRoster();
  }));
  $("rosterSearch").addEventListener("input", renderRoster);
  renderRoster();

  // API adapter contract. Keep blank until a trustworthy source and credentials/schema are known.
  const api = (window.CHERCHA_CONFIG && window.CHERCHA_CONFIG.statsApiUrl) || "";
  const apiStatus = $("apiStatus");
  const STATUS = {Scheduled:"Programado", Final:"Final", Postponed:"Pospuesto", "In Progress":"En juego", Live:"En juego", Suspended:"Suspendido", Cancelled:"Cancelado", "Pre-Game":"Por comenzar", Warmup:"Por comenzar"};
  const isLicey = v => /licey|tigres/i.test(String(v || ""));
  const dt = iso => { try { return new Date(iso).toLocaleString("es-DO",{timeZone:"America/Santo_Domingo",weekday:"short",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}); } catch { return ""; } };
  function renderSchedule(schedule) {
    const box = $("scheduleList"); if (!box) return;
    const games = schedule.filter(g => isLicey(g.home) || isLicey(g.away));
    const done = games.filter(g => g.status === "Final").slice(-3);
    const next = games.filter(g => g.status !== "Final").slice(0, 12);
    box.replaceChildren();
    if (!games.length) { box.innerHTML = '<p class="empty-row">No hay partidos del Licey en la fuente.</p>'; return; }
    [...done, ...next].forEach(g => {
      const el = document.createElement("div"); el.className = "schedule-item" + (g.status === "Final" ? " is-final" : "");
      const score = g.status === "Final" ? `${g.awayScore} - ${g.homeScore}` : (STATUS[g.status] || g.status || "—");
      const when = document.createElement("span"); when.className = "sch-when"; when.textContent = dt(g.gameDate) || g.dateLabel || "";
      const teams = document.createElement("span"); teams.className = "sch-teams"; teams.textContent = `${g.away} @ ${g.home}`;
      const res = document.createElement("b"); res.className = "sch-score"; res.textContent = score;
      el.append(when, teams, res); box.appendChild(el);
    });
  }
  let bannerTimer;
  function setBanner(g) {
    const b = $("gameBanner"); if (!b) return; clearInterval(bannerTimer);
    if (!g || !g.gameDate) { b.hidden = true; return; }
    const t = new Date(g.gameDate).getTime(), day = d => new Date(d).toLocaleDateString("en-CA", {timeZone:"America/Santo_Domingo"});
    const rival = isLicey(g.home) ? g.away : g.home, today = day(t) === day(Date.now());
    const tick = () => {
      const ms = t - Date.now(); let c;
      if (ms <= 0) c = "¡Está por empezar o ya empezó!";
      else { const h = Math.floor(ms/36e5), m = Math.floor(ms%36e5/6e4), d = Math.floor(h/24); c = d > 0 ? `${d} d ${h%24} h ${m} min` : `${h} h ${m} min ${Math.floor(ms%6e4/1e3)} s`; }
      b.innerHTML = `<b>${today ? "HOY SIIII LICEYSTASSSSSSSSS" : "PRÓXIMO JUEGO"}</b><span>vs ${escapeText(rival)} · ${escapeText(dt(g.gameDate))}</span><span class="gb-count">${escapeText(c)}</span><a href="#ruta" data-view="ruta">Ver transmisión ↗</a>`;
    };
    b.onclick = e => { const a = e.target.closest("a[data-view]"); if (a) { e.preventDefault(); showPage(a.dataset.view); } }; b.hidden = false; tick(); bannerTimer = setInterval(tick, 1000);
  }
  async function getJson(url, ms) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
    try { const r = await fetch(url, {headers:{"Accept":"application/json"}, signal: ctl.signal}); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
    finally { clearTimeout(t); }
  }
  async function refreshStats() {
    if (!api) { apiStatus.textContent = "API no configurada · sin datos en vivo"; return; }
    apiStatus.textContent = "Consultando fuente…";
    const slow = setTimeout(() => { apiStatus.textContent = "Despertando el servidor (Render gratis puede tardar ~1 min)…"; }, 5000);
    try {
      let data;
      try { data = await getJson(api, 70000); } catch (e) { apiStatus.textContent = "Reintentando…"; data = await getJson(api, 70000); }
      const st = Array.isArray(data.standings) ? data.standings : [];
      const me = st.find(t => isLicey(t.team));
      const rec = data.record || (me ? {wins: me.wins, losses: me.losses} : null);
      if (rec) { $("teamRecord").innerHTML = `${escapeText(rec.wins ?? "—")}-${escapeText(rec.losses ?? "—")} <small>G-P</small>`; $("recordNote").textContent = me && me.streak ? `Racha actual: ${me.streak}` : "Récord de la temporada"; }
      const sched = Array.isArray(data.schedule) ? data.schedule : [];
      const nx = sched.find(g => (isLicey(g.home) || isLicey(g.away)) && g.status !== "Final" && g.status !== "Postponed" && new Date(g.gameDate).getTime() > Date.now() - 4*3600e3);
      const ng = nx ? {home: nx.home, away: nx.away, dateLabel: dt(nx.gameDate) + " (hora RD)"} : data.nextGame;
      if (ng) { $("nextGame").innerHTML = `${escapeText(ng.away || "—")} <small>@</small> ${escapeText(ng.home || "LICEY")}`; $("nextGameDate").textContent = clean(ng.dateLabel || "Horario por confirmar",100).replace("Scheduled","Programado"); }
      if (data.starter) { $("nextStarter").textContent = clean(data.starter.name || "Por confirmar",80); $("starterNote").textContent = clean(data.starter.status || "Abridor reportado por la fuente",100); }
      if (data.lastResult) { $("lastResult").textContent = clean(data.lastResult.score || "Resultado recibido",60); $("lastResultNote").textContent = "Último juego finalizado"; }
      if (st.length) {
        const body = $("standingsBody"); body.replaceChildren();
        st.forEach(team => { const tr = document.createElement("tr"); if (isLicey(team.team)) tr.className = "me";
          [team.team, team.wins, team.losses, team.pct, team.streak].forEach(val => { const td=document.createElement("td"); td.textContent = val == null ? "—" : String(val); tr.appendChild(td); }); body.appendChild(tr); });
      }
      renderSchedule(sched); setBanner(nx); nextLicey = nx || null; applyStarter();
      if (data.roster && Array.isArray(data.roster.hitters)) rosterRows.hitters = data.roster.hitters;
      if (data.roster && Array.isArray(data.roster.pitchers)) rosterRows.pitchers = data.roster.pitchers;
      renderRoster();
      apiStatus.textContent = "Datos recibidos · " + (data.season || "temporada por confirmar") + " · " + timeLabel(data.updatedAt || Date.now());
    } catch (err) {
      console.error("No se pudo actualizar la API de estadísticas:", err);
      apiStatus.textContent = "No se pudo consultar la API · pulsa Actualizar datos para reintentar";
    } finally { clearTimeout(slow); }
  }
  let nextLicey = null, rotationGames = [];
  const rotationApi = (window.CHERCHA_CONFIG && window.CHERCHA_CONFIG.rotationApiUrl) || api.replace(/\/api\/stats$/, "/api/rotation");
  const rdDay = d => new Date(d).toLocaleDateString("en-CA", {timeZone:"America/Santo_Domingo"});
  function applyStarter() {
    if (!nextLicey || !nextLicey.gameDate || !rotationGames.length) return;
    const g = rotationGames.find(x => x.date === rdDay(nextLicey.gameDate)); if (!g) return;
    $("nextStarter").textContent = g.pitcher || "Por anunciar";
    $("starterNote").textContent = g.pitcher ? "Anunciado por el Licey (Licey.com)" : "El Licey aún no lo anuncia";
  }
  async function loadRotation() {
    const box = $("rotationList"); if (!box || !rotationApi) return;
    try {
      let data; try { data = await getJson(rotationApi, 70000); } catch (e) { data = await getJson(rotationApi, 70000); }
      const today = rdDay(Date.now());
      rotationGames = (data.games || []).filter(g => g && g.date >= today);
      box.replaceChildren();
      const note = $("rotationNote"), art = data.article;
      if (note && art && art.url && okLicey(art.url)) { note.replaceChildren(); const a = document.createElement("a"); a.href = art.url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = "Ver el anuncio completo en Licey.com ↗"; note.append("Publicada el " + new Date(art.publishedAt).toLocaleDateString("es-DO", {day:"numeric", month:"short", timeZone:"America/Santo_Domingo"}) + " · ", a); }
      if (!rotationGames.length) { box.innerHTML = '<p class="empty-row">El Licey aún no ha publicado la próxima rotación.</p>'; return; }
      rotationGames.forEach(g => {
        const el = document.createElement("div"); el.className = "rot-item" + (g.date === today ? " is-today" : "");
        const day = document.createElement("span"); day.className = "rot-day"; day.textContent = new Date(g.date + "T12:00:00Z").toLocaleDateString("es-DO", {weekday:"short", day:"numeric", month:"short", timeZone:"UTC"}) + (g.date === today ? " · HOY" : "");
        const vs = document.createElement("span"); vs.className = "rot-vs"; vs.textContent = g.opponent ? "vs " + g.opponent : "Rival por confirmar";
        const sm = document.createElement("small"); sm.textContent = [g.time, g.venue].filter(Boolean).join(" · "); vs.appendChild(sm);
        const p = document.createElement("b"); p.className = "rot-pitcher"; p.textContent = g.pitcher || "Por anunciar";
        el.append(day, vs, p); box.appendChild(el);
      });
      applyStarter();
    } catch (err) { console.error("Rotación:", err); box.innerHTML = '<p class="empty-row">No se pudo cargar la rotación. <a href="https://www.licey.com/noticias/" target="_blank" rel="noopener noreferrer">Ver en Licey.com ↗</a></p>'; }
  }
  const newsApi = (window.CHERCHA_CONFIG && window.CHERCHA_CONFIG.newsApiUrl) || api.replace(/\/api\/stats$/, "/api/news");
  const okLicey = u => { try { const x = new URL(u); return x.protocol === "https:" && /(^|\.)licey\.com$/.test(x.hostname); } catch { return false; } };
  async function loadNews() {
    const grid = $("newsGrid"); if (!grid || !newsApi) return;
    try {
      let data; try { data = await getJson(newsApi, 70000); } catch (e) { data = await getJson(newsApi, 70000); }
      const items = (data.items || []).filter(n => n && n.title && okLicey(n.url));
      grid.replaceChildren();
      if (!items.length) { grid.innerHTML = '<p class="empty-row">No hay noticias disponibles ahora.</p>'; return; }
      items.forEach(n => {
        const a = document.createElement("a"); a.className = "news-card"; a.href = n.url; a.target = "_blank"; a.rel = "noopener noreferrer";
        if (n.image && okLicey(n.image)) { const img = document.createElement("img"); img.src = n.image; img.alt = ""; img.loading = "lazy"; a.appendChild(img); }
        const body = document.createElement("div"); body.className = "news-body";
        const t = document.createElement("time"); t.textContent = n.date ? new Date(n.date).toLocaleDateString("es-DO", {day:"numeric", month:"short", year:"numeric", timeZone:"America/Santo_Domingo"}) : "";
        const h = document.createElement("h3"); h.textContent = n.title;
        const p = document.createElement("p"); p.textContent = n.excerpt || "";
        const m = document.createElement("span"); m.className = "news-more"; m.textContent = "Leer en Licey.com ↗";
        body.append(t, h, p, m); a.appendChild(body); grid.appendChild(a);
      });
    } catch (err) { console.error("Noticias:", err); grid.innerHTML = '<p class="empty-row">No se pudieron cargar las noticias. <a href="https://www.licey.com/noticias/" target="_blank" rel="noopener noreferrer">Ver en Licey.com ↗</a></p>'; }
  }
  $("refreshData").addEventListener("click", refreshStats);
  $("refreshData").addEventListener("click", () => { loadNews(); loadRotation(); });
  loadNews(); loadRotation();
  refreshStats();

  // Community demo data is local to this browser. A shared production community needs backend + moderation.
  function renderChat() {
    const messages = safeRead(STORE.chat).slice(-80);
    const box = $("chatMessages");
    box.innerHTML = '<div class="chat-bubble"><span class="chat-author">Moderación · Chercha Azul</span><p>¡Bienvenido al muro azul! Debate con respeto y no compartas información privada.</p><time>Mensaje de bienvenida</time></div>';
    messages.forEach(m => {
      const div = document.createElement("div"); div.className = "chat-bubble";
      div.innerHTML = `<span class="chat-author">${escapeText(m.name)}</span><p>${escapeText(m.message)}</p><time>${escapeText(timeLabel(m.at))}</time>`;
      box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
  }
  function renderPredictions() {
    const items = safeRead(STORE.predictions).slice(-8).reverse();
    const box = $("predictionList");
    if (!items.length) { box.innerHTML = '<div class="empty-community">Todavía no hay predicciones. ¡Sé el primero!</div>'; return; }
    box.innerHTML = items.map(p => `<div class="prediction-item"><span><b>${escapeText(p.name)}</b><small>Licey vs. ${escapeText(p.rival)} · ${escapeText(timeLabel(p.at))}</small></span><b>${escapeText(p.licey)} - ${escapeText(p.rivalRuns)}</b></div>`).join("");
  }
  function renderNotes() {
    const notes = safeRead(STORE.notes).slice(-6).reverse();
    $("sayWall").innerHTML = notes.map(n => `<article class="say-note"><strong>${escapeText(n.name)}</strong><p>${escapeText(n.message)}</p><time>${escapeText(timeLabel(n.at))}</time></article>`).join("");
  }

  $("chatForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = clean($("chatName").value,32), message = clean($("chatMessage").value,400);
    if (!name || !message) return;
    const items = safeRead(STORE.chat); items.push({name,message,at:Date.now()}); safeWrite(STORE.chat,items.slice(-80));
    $("chatMessage").value = ""; renderChat();
  });
  $("predictionForm").addEventListener("submit", e => {
    e.preventDefault();
    const name=clean($("fanName").value,32), rival=clean($("rivalName").value,32);
    const licey=Number($("liceyRuns").value), rivalRuns=Number($("rivalRuns").value);
    if (!name || !rival || !Number.isInteger(licey) || !Number.isInteger(rivalRuns) || licey<0 || rivalRuns<0 || licey>99 || rivalRuns>99) return;
    const items=safeRead(STORE.predictions); items.push({name,rival,licey,rivalRuns,at:Date.now()}); safeWrite(STORE.predictions,items.slice(-100));
    $("predictionForm").reset(); renderPredictions();
  });
  $("sayForm").addEventListener("submit", e => {
    e.preventDefault();
    const name=clean($("sayName").value,32), message=clean($("sayMessage").value,500);
    if (!name || !message) return;
    const items=safeRead(STORE.notes); items.push({name,message,at:Date.now()}); safeWrite(STORE.notes,items.slice(-30));
    $("sayForm").reset(); renderNotes();
  });
  renderChat(); renderPredictions(); renderNotes();
})();
