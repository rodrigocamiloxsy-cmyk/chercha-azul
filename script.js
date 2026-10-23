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
    const valid = ["inicio", "numeritos", "chercha", "calendario", "redes", "ruta"].includes(view) ? view : "inicio";
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
  let rosterMode = "hitters";
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
    const rows = rosterRows[rosterMode].filter(row => clean(row.name,100).toLocaleLowerCase("es").includes(query));
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
    rosterMode = button.dataset.roster; renderRoster();
  }));
  $("rosterSearch").addEventListener("input", renderRoster);
  renderRoster();

  // API adapter contract. Keep blank until a trustworthy source and credentials/schema are known.
  const api = (window.CHERCHA_CONFIG && window.CHERCHA_CONFIG.statsApiUrl) || "";
  const apiStatus = $("apiStatus");
  async function refreshStats() {
    if (!api) {
      apiStatus.textContent = "API no configurada · sin datos en vivo";
      return;
    }
    apiStatus.textContent = "Consultando fuente…";
    try {
      const response = await fetch(api, {headers: {"Accept":"application/json"}});
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      // Expected generic JSON shape. Map your chosen provider's fields here after confirming its schema.
      if (data.record) { $("teamRecord").innerHTML = `${escapeText(data.record.wins ?? "—")}-${escapeText(data.record.losses ?? "—")} <small>G-P</small>`; $("recordNote").textContent = "Récord recibido de la fuente conectada"; }
      if (data.nextGame) { $("nextGame").innerHTML = `${escapeText(data.nextGame.home || "LICEY")} <small>VS</small> ${escapeText(data.nextGame.away || "—")}`; $("nextGameDate").textContent = clean(data.nextGame.dateLabel || "Horario por confirmar",100); }
      if (data.starter) { $("nextStarter").textContent = clean(data.starter.name || "Por confirmar",80); $("starterNote").textContent = clean(data.starter.status || "Abridor reportado por la fuente",100); }
      if (data.lastResult) { $("lastResult").textContent = `${clean(data.lastResult.score || "Resultado recibido",20)}`; }
      if (Array.isArray(data.standings) && data.standings.length) {
        const body = $("standingsBody");
        body.replaceChildren();
        data.standings.forEach(team => {
          const tr = document.createElement("tr");
          [team.team, team.wins, team.losses, team.pct, team.streak].forEach(val => { const td=document.createElement("td"); td.textContent = val == null ? "—" : String(val); tr.appendChild(td); });
          body.appendChild(tr);
        });
      }
      // Estadísticas individuales normalizadas por el backend de Chercha Azul.
      if (data.roster && Array.isArray(data.roster.hitters)) rosterRows.hitters = data.roster.hitters;
      if (data.roster && Array.isArray(data.roster.pitchers)) rosterRows.pitchers = data.roster.pitchers;
      renderRoster();
      apiStatus.textContent = "Datos recibidos · " + (data.season || "temporada por confirmar") + " · " + timeLabel(data.updatedAt || Date.now());
    } catch (err) {
      console.error("No se pudo actualizar la API de estadísticas:", err);
      apiStatus.textContent = "No se pudo consultar la API · revisa URL/CORS/formato";
    }
  }
  $("refreshData").addEventListener("click", refreshStats);
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
