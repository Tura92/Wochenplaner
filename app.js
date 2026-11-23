(() => {
  "use strict";

  // ---------- Hilfsfunktionen ----------
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const mondayOf = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const isoWeek = (d) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 864e5 + 1) / 7); };
  const hhmm = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const toMin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
  const hours = (min) => { const h = Math.round((min / 60) * 100) / 100; return h.toLocaleString("de-DE", { maximumFractionDigits: 2 }) + " h"; };
  const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const WD_LONG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
  const MONTH_LONG = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const MONTH = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  const SNAP = 15;
  const COLORS = ["#5b8def", "#d9677b", "#5fae7a", "#e8a33d", "#9b6bd6", "#3fb0b8", "#e0703f", "#c25bb0", "#7a8a3a", "#5c6b7a", "#b5893b", "#2f5d50"];
  const hourPx = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hour")) || 52;

  // ---------- Zustand ----------
  const store = window.createStore();
  const today = new Date();
  const state = {
    weekStart: mondayOf(today),
    dayIdx: (today.getDay() + 6) % 7,
    mode: "day",
    view: "plan",
    people: [],
    categories: [],
    blocks: [],
    events: [],
    showPast: false,
  };
  const catById = (id) => state.categories.find((c) => c.id === id) || { name: "?", color: "#888" };
  const weekDates = () => [...Array(7)].map((_, i) => ymd(addDays(state.weekStart, i)));
  const selDate = () => ymd(addDays(state.weekStart, state.dayIdx));

  async function load() {
    const dates = weekDates();
    const [people, categories, blocks, events] = await Promise.all([store.getPeople(), store.getCategories(), store.getBlocks(dates[0], dates[6]), store.getEvents()]);
    state.people = people; state.categories = categories; state.blocks = blocks;
    state.events = sortEvents(events);
    render();
  }

  // ---------- Termine: Hilfen ----------
  const sortEvents = (list) => list.sort((a, b) => a.date.localeCompare(b.date) || (a.start_min ?? -1) - (b.start_min ?? -1) || a.title.localeCompare(b.title));
  const eventsOn = (d) => state.events.filter((e) => e.date === d);
  const personName = (id) => (id ? state.people.find((p) => p.id === id)?.name || "?" : "Beide");
  const eventTime = (e) => e.start_min == null ? "ganztägig" : hhmm(e.start_min) + (e.end_min != null ? "–" + (e.end_min === 1440 ? "24:00" : hhmm(e.end_min)) : " Uhr");
  function relDays(d) {
    const n = Math.round((parseYmd(d) - parseYmd(ymd(new Date()))) / 864e5);
    if (n === 0) return "heute"; if (n === 1) return "morgen"; if (n === -1) return "gestern";
    return n > 0 ? `in ${n} Tagen` : `vor ${-n} Tagen`;
  }
  function eventChip(e) {
    const b = el("button", "ev-chip"); b.type = "button";
    b.append(el("span", "star", "★"), el("b", null, e.title), el("span", "meta", `${eventTime(e)} · ${personName(e.person_id)}`));
    b.onclick = () => openEvent(e);
    return b;
  }

  // ---------- Rendering ----------
  function render() {
    renderHeader();
    if (state.view === "plan") {
      renderChips();
      renderDayEvents();
      if (state.mode === "day") { renderPeopleHead(); renderTimeline(); } else renderWeekGrid();
    }
    if (state.view === "events") renderEvents();
    if (state.view === "sum") renderSums();
    if (state.view === "cat") renderCats();
  }

  function renderHeader() {
    const s = state.weekStart, e = addDays(s, 6);
    const range = s.getMonth() === e.getMonth() ? `${s.getDate()}.–${e.getDate()}. ${MONTH[e.getMonth()]}` : `${s.getDate()}. ${MONTH[s.getMonth()]} – ${e.getDate()}. ${MONTH[e.getMonth()]}`;
    const lbl = $("#weekLabel");
    lbl.innerHTML = "";
    lbl.append(`KW ${isoWeek(s)}`, el("small", null, range));
  }

  function renderChips() {
    const box = $("#dayChips"); box.innerHTML = "";
    box.hidden = state.mode !== "day";
    const tYmd = ymd(new Date());
    weekDates().forEach((d, i) => {
      const b = el("button", "day-chip");
      if (i === state.dayIdx) b.classList.add("active");
      if (d === tYmd) b.classList.add("today");
      b.append(WD[i], el("b", null, String(parseYmd(d).getDate())));
      const dots = el("span", "dots");
      [...new Set(state.blocks.filter((x) => x.date === d).map((x) => x.category_id))].slice(0, 4)
        .forEach((cid) => { const i2 = el("i"); i2.style.background = catById(cid).color; dots.append(i2); });
      b.append(dots);
      if (eventsOn(d).length) { b.classList.add("has-event"); b.append(el("span", "ev-mark", "★")); }
      b.onclick = () => { state.dayIdx = i; render(); };
      box.append(b);
    });
  }

  function renderDayEvents() {
    const box = $("#dayEvents"); box.innerHTML = "";
    const list = state.mode === "day" ? eventsOn(selDate()) : [];
    box.hidden = !list.length;
    list.forEach((e) => box.append(eventChip(e)));
  }

  function renderEvents() {
    const box = $("#eventsContent"); box.innerHTML = "";
    const t = ymd(new Date());
    const upcoming = state.events.filter((e) => e.date >= t);
    const past = state.events.filter((e) => e.date < t).reverse();
    box.append(el("h2", null, "Anstehende Termine"));
    if (!upcoming.length) box.append(el("p", "sum-empty card", "Keine anstehenden Termine. Mit + einen wichtigen Termin eintragen."));
    let month = "";
    upcoming.forEach((e) => {
      const d = parseYmd(e.date); const m = `${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`;
      if (m !== month) { month = m; box.append(el("h3", "ev-month", m)); }
      box.append(eventRow(e));
    });
    if (past.length) {
      const tg = el("button", "text-btn ev-past-toggle", state.showPast ? "Vergangene ausblenden" : `Vergangene anzeigen (${past.length})`);
      tg.onclick = () => { state.showPast = !state.showPast; renderEvents(); };
      box.append(tg);
      if (state.showPast) past.forEach((e) => box.append(eventRow(e, true)));
    }
  }
  function eventRow(e, isPast = false) {
    const d = parseYmd(e.date);
    const b = el("button", "ev-row" + (isPast ? " past" : "")); b.type = "button";
    const dt = el("div", "ev-date"); dt.append(el("small", null, WD[(d.getDay() + 6) % 7]), el("b", null, String(d.getDate())), el("small", null, MONTH[d.getMonth()]));
    const body = el("div", "ev-body");
    body.append(el("b", null, e.title), el("span", "meta", `${eventTime(e)} · ${personName(e.person_id)}`));
    if (e.note) body.append(el("span", "note", e.note));
    b.append(dt, body, el("em", "ev-rel", relDays(e.date)));
    b.onclick = () => openEvent(e);
    return b;
  }

  function renderPeopleHead() {
    const box = $("#peopleHead"); box.innerHTML = ""; box.hidden = false;
    box.append(el("div"));
    const d = selDate();
    state.people.forEach((p) => {
      const mins = state.blocks.filter((b) => b.person_id === p.id && b.date === d).reduce((a, b) => a + b.end_min - b.start_min, 0);
      const c = el("div", null, p.name); c.append(el("span", "sum", mins ? hours(mins) + " geplant" : "frei"));
      box.append(c);
    });
  }

  // Überlappende Blöcke nebeneinander anordnen
  function layoutLanes(list) {
    list.sort((a, b) => a.start_min - b.start_min || b.end_min - a.end_min);
    let group = [], groupEnd = -1;
    const flush = () => { const n = Math.max(...group.map((g) => g._lane)) + 1; group.forEach((g) => (g._lanes = n)); group = []; };
    for (const b of list) {
      if (b.start_min >= groupEnd && group.length) flush();
      const used = group.filter((g) => g.end_min > b.start_min).map((g) => g._lane);
      let lane = 0; while (used.includes(lane)) lane++;
      b._lane = lane; group.push(b); groupEnd = Math.max(groupEnd, b.end_min);
    }
    if (group.length) flush();
    return list;
  }

  function placeBlock(node, b) {
    const H = hourPx();
    node.style.top = (b.start_min / 60) * H + "px";
    node.style.height = Math.max(((b.end_min - b.start_min) / 60) * H - 2, 14) + "px";
    const w = 100 / (b._lanes || 1);
    node.style.left = `calc(${w * (b._lane || 0)}% + 3px)`;
    node.style.right = "auto";
    node.style.width = `calc(${w}% - 6px)`;
  }

  function blockNode(b) {
    const c = catById(b.category_id);
    const n = el("div", "block");
    n.style.background = c.color;
    n.dataset.id = b.id;
    n.append(el("span", "t", b.note ? `${c.name} · ${b.note}` : c.name));
    n.append(el("span", "s", `${hhmm(b.start_min)}–${b.end_min === 1440 ? "24:00" : hhmm(b.end_min)}`));
    n.append(el("span", "handle"));
    placeBlock(n, b);
    return n;
  }

  let didInitialScroll = false;
  function renderTimeline() {
    $("#timelineWrap").hidden = false; $("#weekGridWrap").hidden = true;
    const tl = $("#timeline"); tl.innerHTML = "";
    const H = hourPx();
    const g = el("div", "hours");
    for (let h = 1; h < 24; h++) { const s = el("span", null, pad(h) + ":00"); s.style.top = h * H + "px"; g.append(s); }
    tl.append(g);
    const d = selDate();
    state.people.forEach((p, pi) => {
      const col = el("div", "col"); col.dataset.person = p.id; col.dataset.idx = pi;
      eventsOn(d).filter((e) => e.start_min != null && (!e.person_id || e.person_id === p.id)).forEach((e) => {
        const band = el("div", "ev-band"); const end = e.end_min ?? e.start_min + 30;
        band.style.top = (e.start_min / 60) * H + "px"; band.style.height = Math.max(((end - e.start_min) / 60) * H, 16) + "px";
        band.append(el("span", null, "★ " + e.title)); col.append(band);
      });
      layoutLanes(state.blocks.filter((b) => b.person_id === p.id && b.date === d)).forEach((b) => col.append(blockNode(b)));
      col.addEventListener("click", (e) => {
        if (e.target !== col) return;
        const y = e.offsetY; let start = Math.floor((y / H) * 2) * 30; start = Math.min(start, 1380);
        openBlock({ person_id: p.id, date: d, start_min: start, end_min: Math.min(start + 60, 1440), category_id: state.categories[0]?.id });
      });
      tl.append(col);
    });
    if (d === ymd(new Date())) {
      const now = new Date(); const nl = el("div", "now-line");
      nl.style.top = ((now.getHours() * 60 + now.getMinutes()) / 60) * H + "px";
      nl.style.gridColumn = "2 / 4"; nl.style.position = "absolute"; nl.style.left = "var(--gutter)";
      tl.append(nl);
    }
    if (!didInitialScroll) {
      didInitialScroll = true;
      const first = [...state.blocks.filter((b) => b.date === d), ...eventsOn(d).filter((e) => e.start_min != null)].reduce((m, b) => Math.min(m, b.start_min), 7 * 60);
      $("#timelineWrap").scrollTop = Math.max(0, (first / 60 - 0.5) * H);
    }
  }

  function renderWeekGrid() {
    $("#timelineWrap").hidden = true; $("#peopleHead").hidden = true; $("#weekGridWrap").hidden = false;
    const grid = $("#weekGrid"); grid.innerHTML = "";
    const RH = 22;
    grid.append(el("div", "wg-headcell"));
    const tYmd = ymd(new Date());
    weekDates().forEach((d, i) => {
      const hc = el("div", "wg-headcell"); hc.append(WD[i], el("b", null, String(parseYmd(d).getDate())));
      if (d === tYmd) hc.querySelector("b").style.color = "var(--accent)";
      const evs = eventsOn(d);
      const st = el("button", "wg-ev", evs.length ? "★" + (evs.length > 1 ? evs.length : "") : ""); st.type = "button";
      if (evs.length) { st.title = evs.map((e) => e.title).join(", "); st.onclick = () => { state.dayIdx = i; setMode("day"); }; } else st.classList.add("empty");
      hc.append(st);
      const pp = el("span", "pp"); state.people.forEach((p) => pp.append(el("span", null, p.name[0]))); hc.append(pp);
      grid.append(hc);
    });
    const hcol = el("div", "wg-hours");
    for (let h = 2; h < 24; h += 2) { const s = el("span", null, pad(h)); s.style.top = h * RH + "px"; hcol.append(s); }
    grid.append(hcol);
    weekDates().forEach((d, i) => {
      const day = el("div", "wg-day");
      state.people.forEach((p) => {
        const lane = el("div", "wg-lane");
        state.blocks.filter((b) => b.person_id === p.id && b.date === d).forEach((b) => {
          const r = el("i"); r.style.background = catById(b.category_id).color;
          r.style.top = (b.start_min / 60) * RH + "px"; r.style.height = Math.max(((b.end_min - b.start_min) / 60) * RH - 1, 3) + "px";
          r.title = `${p.name}: ${catById(b.category_id).name} ${hhmm(b.start_min)}–${hhmm(b.end_min)}`;
          lane.append(r);
        });
        day.append(lane);
      });
      day.onclick = () => { state.dayIdx = i; setMode("day"); };
      grid.append(day);
    });
    const leg = el("div", "week-legend"); leg.style.gridColumn = "1 / -1";
    state.categories.forEach((c) => { const s = el("span"); const i = el("i"); i.style.background = c.color; s.append(i, c.name); leg.append(s); });
    grid.append(leg);
    if (!didInitialScroll) { didInitialScroll = true; }
    $("#weekGridWrap").scrollTop = 6 * RH;
  }

  function renderSums() {
    const box = $("#sumContent"); box.innerHTML = "";
    box.append(el("h2", null, `Stunden pro Woche · KW ${isoWeek(state.weekStart)}`));
    const totals = {};
    state.people.forEach((p) => { totals[p.id] = {}; state.categories.forEach((c) => (totals[p.id][c.id] = 0)); });
    state.blocks.forEach((b) => { if (totals[b.person_id]) totals[b.person_id][b.category_id] = (totals[b.person_id][b.category_id] || 0) + b.end_min - b.start_min; });
    const maxMin = Math.max(60, ...Object.values(totals).flatMap((t) => Object.values(t)));
    state.people.forEach((p) => {
      const card = el("div", "card");
      const sum = Object.values(totals[p.id]).reduce((a, b) => a + b, 0);
      const head = el("div", "card-head"); head.append(el("h3", null, p.name));
      const tot = el("span", "total", hours(sum).replace(" h", "")); tot.append(el("small", null, " h gesamt")); head.append(tot);
      card.append(head);
      if (!sum) card.append(el("p", "sum-empty", "In dieser Woche noch nichts eingetragen."));
      state.categories.forEach((c) => {
        const m = totals[p.id][c.id] || 0; if (!m) return;
        const row = el("div", "sum-row");
        const name = el("div", "name"); const sw = el("i"); sw.style.background = c.color; name.append(sw, el("span", null, c.name));
        row.append(name, el("div", "val", hours(m)));
        const bar = el("div", "bar"); const fill = el("i"); fill.style.width = (m / maxMin) * 100 + "%"; fill.style.background = c.color; bar.append(fill); row.append(bar);
        card.append(row);
      });
      box.append(card);
    });
    // Vergleichstabelle
    box.append(el("h2", null, "Vergleich"));
    const card = el("div", "card"); const t = el("table", "compare");
    const hr = el("tr"); hr.append(el("th", null, "Kategorie")); state.people.forEach((p) => hr.append(el("th", null, p.name))); t.append(hr);
    state.categories.forEach((c) => {
      const tr = el("tr"); tr.append(el("td", null, c.name));
      state.people.forEach((p) => tr.append(el("td", null, hours(totals[p.id][c.id] || 0))));
      t.append(tr);
    });
    const tr = el("tr"); tr.append(el("td", null, "Gesamt"));
    state.people.forEach((p) => tr.append(el("td", null, hours(Object.values(totals[p.id]).reduce((a, b) => a + b, 0)))));
    t.append(tr); card.append(t); box.append(card);
  }

  function renderCats() {
    const ul = $("#catList"); ul.innerHTML = "";
    const counts = {}; state.blocks.forEach((b) => (counts[b.category_id] = (counts[b.category_id] || 0) + b.end_min - b.start_min));
    state.categories.forEach((c) => {
      const li = el("li"); const b = el("button"); const i = el("i"); i.style.background = c.color;
      b.append(i, el("span", null, c.name), el("em", null, counts[c.id] ? hours(counts[c.id]) + " diese Woche" : "›"));
      b.onclick = () => openCat(c); li.append(b); ul.append(li);
    });
    $("#storeHint").textContent = store.mode === "lokal"
      ? "Hinweis: Die Daten werden gerade nur auf diesem Gerät gespeichert."
      : `Angemeldet als ${store.userEmail || ""}. Änderungen sind sofort bei euch beiden sichtbar.`;
    if (store.signOut) {
      let btn = $("#signOutBtn");
      if (!btn) { btn = el("button", "text-btn", "Abmelden"); btn.id = "signOutBtn"; btn.onclick = () => store.signOut(); $("#view-cat").append(btn); }
    }
  }

  // ---------- Ziehen und Größe ändern ----------
  let drag = null;
  const timeline = $("#timeline");
  timeline.addEventListener("pointerdown", (e) => {
    const node = e.target.closest(".block"); if (!node) return;
    const b = state.blocks.find((x) => x.id === node.dataset.id); if (!b) return;
    const resize = e.target.classList.contains("handle");
    drag = { node, b, resize, x0: e.clientX, y0: e.clientY, active: resize, moved: false, pointerId: e.pointerId,
      start: b.start_min, end: b.end_min, person: b.person_id, timer: null };
    if (resize) beginDrag();
    else if (e.pointerType === "mouse") { /* Maus: Ziehen startet bei Bewegung */ }
    else drag.timer = setTimeout(beginDrag, 280);
  });
  function beginDrag() {
    if (!drag) return;
    drag.active = true;
    drag.node.classList.add("dragging");
    try { drag.node.setPointerCapture(drag.pointerId); } catch (_) {}
    if (navigator.vibrate) navigator.vibrate(8);
  }
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.active) {
      if (Math.hypot(dx, dy) > 8) {
        if (e.pointerType === "mouse") beginDrag(); else { clearTimeout(drag.timer); drag = null; return; }
      } else return;
    }
    drag.moved = drag.moved || Math.hypot(dx, dy) > 3;
    const H = hourPx();
    const dMin = Math.round(((dy / H) * 60) / SNAP) * SNAP;
    const len = drag.b.end_min - drag.b.start_min;
    if (drag.resize) {
      drag.start = drag.b.start_min;
      drag.end = Math.min(1440, Math.max(drag.b.start_min + SNAP, drag.b.end_min + dMin));
    } else {
      drag.start = Math.min(1440 - len, Math.max(0, drag.b.start_min + dMin));
      drag.end = drag.start + len;
      const cols = [...timeline.querySelectorAll(".col")];
      const hit = cols.find((c) => { const r = c.getBoundingClientRect(); return e.clientX >= r.left && e.clientX < r.right; });
      if (hit) drag.person = hit.dataset.person;
      const homeCol = cols.find((c) => c.dataset.person === drag.b.person_id);
      const targetCol = cols.find((c) => c.dataset.person === drag.person);
      drag.node.style.transform = `translateX(${targetCol.getBoundingClientRect().left - homeCol.getBoundingClientRect().left}px)`;
    }
    placeBlock(drag.node, { ...drag.b, start_min: drag.start, end_min: drag.end, _lane: 0, _lanes: 1 });
    drag.node.querySelector(".s").textContent = `${hhmm(drag.start)}–${drag.end === 1440 ? "24:00" : hhmm(drag.end)}`;
  });
  // Seitenscrollen verhindern, solange ein Block gezogen wird
  window.addEventListener("touchmove", (e) => { if (drag && drag.active) e.preventDefault(); }, { passive: false });
  window.addEventListener("pointerup", async () => {
    if (!drag) return;
    const d = drag; drag = null; clearTimeout(d.timer);
    if (!d.active || !d.moved) { d.node.classList.remove("dragging"); if (!d.resize) openBlock(d.b); return; }
    const changed = d.start !== d.b.start_min || d.end !== d.b.end_min || d.person !== d.b.person_id;
    if (!changed) { render(); return; }
    const nb = { ...d.b, start_min: d.start, end_min: d.end, person_id: d.person };
    delete nb._lane; delete nb._lanes;
    await save(() => store.saveBlock(nb), "Verschoben");
  });
  window.addEventListener("pointercancel", () => { if (drag) { clearTimeout(drag.timer); drag = null; render(); } });
  timeline.addEventListener("contextmenu", (e) => { if (e.target.closest(".block")) e.preventDefault(); });

  // ---------- Dialog Zeitblock ----------
  const bd = $("#blockDialog");
  let editing = null;
  function openBlock(b) {
    editing = { ...b };
    delete editing._lane; delete editing._lanes;
    $("#blockTitle").textContent = b.id ? "Zeitblock bearbeiten" : "Neuer Zeitblock";
    $("#deleteBlockBtn").hidden = !b.id;
    const pp = $("#personPick"); pp.innerHTML = "";
    state.people.forEach((p) => {
      const btn = el("button", p.id === editing.person_id ? "active" : "", p.name); btn.type = "button";
      btn.onclick = () => { editing.person_id = p.id; [...pp.children].forEach((x) => x.classList.toggle("active", x === btn)); };
      pp.append(btn);
    });
    const cp = $("#catPick"); cp.innerHTML = "";
    state.categories.forEach((c) => {
      const btn = el("button", c.id === editing.category_id ? "active" : ""); btn.type = "button";
      const dot = el("i"); dot.style.background = c.color; btn.append(dot, c.name);
      btn.onclick = () => { editing.category_id = c.id; [...cp.children].forEach((x) => x.classList.toggle("active", x === btn)); };
      cp.append(btn);
    });
    const add = el("button", null, "+ Neu"); add.type = "button"; add.onclick = () => { bd.close(); openCat({}, true); }; cp.append(add);
    $("#fDate").value = editing.date;
    $("#fStart").value = hhmm(editing.start_min);
    $("#fEnd").value = editing.end_min === 1440 ? "00:00" : hhmm(editing.end_min);
    $("#fNote").value = editing.note || "";
    $("#blockError").textContent = "";
    bd.showModal();
  }
  $("#blockForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const start = toMin($("#fStart").value); let end = toMin($("#fEnd").value);
    if (end === 0) end = 1440;
    const err = $("#blockError");
    if (!editing.category_id) return (err.textContent = "Bitte eine Kategorie wählen.");
    if (end <= start) return (err.textContent = "Das Ende muss nach dem Beginn liegen. Bis Mitternacht: 00:00 als Ende.");
    if (!$("#fDate").value) return (err.textContent = "Bitte einen Tag wählen.");
    const b = { ...editing, date: $("#fDate").value, start_min: start, end_min: end, note: $("#fNote").value.trim() };
    bd.close();
    await save(() => store.saveBlock(b), "Gespeichert");
    // Bei Datum in anderer Woche dorthin springen
    const d = parseYmd(b.date);
    if (ymd(mondayOf(d)) !== ymd(state.weekStart)) { state.weekStart = mondayOf(d); state.dayIdx = (d.getDay() + 6) % 7; await load(); }
  });
  $("#cancelBlockBtn").onclick = () => bd.close();
  $("#deleteBlockBtn").onclick = async () => { const id = editing.id; bd.close(); await save(() => store.deleteBlock(id), "Gelöscht"); };

  // ---------- Dialog Termin ----------
  const ed = $("#eventDialog");
  let editingEvent = null;
  function syncAllDay() { $("#eTimes").hidden = $("#eAllDay").checked; }
  function openEvent(ev) {
    editingEvent = { ...ev };
    $("#eventTitle").textContent = ev.id ? "Termin bearbeiten" : "Neuer Termin";
    $("#deleteEventBtn").hidden = !ev.id; $("#showEventBtn").hidden = !ev.id;
    const pp = $("#eventPersonPick"); pp.innerHTML = "";
    [{ id: null, name: "Beide" }, ...state.people].forEach((p) => {
      const btn = el("button", (editingEvent.person_id ?? null) === p.id ? "active" : "", p.name); btn.type = "button";
      btn.onclick = () => { editingEvent.person_id = p.id; [...pp.children].forEach((x) => x.classList.toggle("active", x === btn)); };
      pp.append(btn);
    });
    $("#eTitle").value = ev.title || "";
    $("#eDate").value = ev.date;
    $("#eAllDay").checked = ev.start_min == null;
    $("#eStart").value = ev.start_min != null ? hhmm(ev.start_min) : "";
    $("#eEnd").value = ev.end_min != null ? (ev.end_min === 1440 ? "00:00" : hhmm(ev.end_min)) : "";
    $("#eNote").value = ev.note || "";
    $("#eventError").textContent = "";
    syncAllDay();
    ed.showModal();
  }
  $("#eAllDay").onchange = () => { syncAllDay(); if (!$("#eAllDay").checked && !$("#eStart").value) $("#eStart").value = "09:00"; };
  $("#eventForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#eventError");
    const title = $("#eTitle").value.trim();
    if (!title) return (err.textContent = "Bitte eintragen, was ansteht.");
    if (!$("#eDate").value) return (err.textContent = "Bitte einen Tag wählen.");
    let start = null, end = null;
    if (!$("#eAllDay").checked) {
      if (!$("#eStart").value) return (err.textContent = "Bitte eine Uhrzeit angeben oder „Ganztägig“ wählen.");
      start = toMin($("#eStart").value);
      if ($("#eEnd").value) { end = toMin($("#eEnd").value); if (end === 0) end = 1440; if (end <= start) return (err.textContent = "Das Ende muss nach dem Beginn liegen."); }
    }
    const ev = { ...editingEvent, title, date: $("#eDate").value, start_min: start, end_min: end, note: $("#eNote").value.trim(), person_id: editingEvent.person_id ?? null };
    ed.close();
    await save(() => store.saveEvent(ev), "Termin gespeichert");
  });
  $("#cancelEventBtn").onclick = () => ed.close();
  $("#deleteEventBtn").onclick = async () => {
    const ev = editingEvent; ed.close();
    if (await confirmBox(`Termin „${ev.title}“ löschen?`, "Löschen")) await save(() => store.deleteEvent(ev.id), "Termin gelöscht");
  };
  $("#showEventBtn").onclick = () => { ed.close(); showInPlan(editingEvent.date); };
  async function showInPlan(date) {
    const d = parseYmd(date);
    state.weekStart = mondayOf(d); state.dayIdx = (d.getDay() + 6) % 7; state.mode = "day";
    document.querySelectorAll(".segmented[role=tablist] button").forEach((b) => b.classList.toggle("active", b.dataset.mode === "day"));
    switchView("plan"); didInitialScroll = false; await load();
  }

  // ---------- Dialog Kategorie / Person ----------
  const cd = $("#catDialog");
  let editingCat = null, catMode = "cat", reopenBlock = false;
  function openCat(c, fromBlock = false) {
    catMode = "cat"; reopenBlock = fromBlock;
    editingCat = { color: COLORS[state.categories.length % COLORS.length], ...c };
    $("#catTitle").textContent = c.id ? "Kategorie bearbeiten" : "Neue Kategorie";
    $("#cName").value = editingCat.name || "";
    $("#deleteCatBtn").hidden = !c.id;
    $("#swatches").hidden = false; $("#swatches").previousElementSibling.hidden = false;
    renderSwatches();
    $("#catError").textContent = "";
    cd.showModal();
  }
  function renderSwatches() {
    const sw = $("#swatches"); sw.innerHTML = "";
    COLORS.forEach((col) => {
      const b = el("button", col === editingCat.color ? "active" : ""); b.type = "button"; b.style.background = col; b.setAttribute("aria-label", col);
      b.onclick = () => { editingCat.color = col; renderSwatches(); };
      sw.append(b);
    });
  }
  $("#catForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#cName").value.trim();
    if (!name) return ($("#catError").textContent = "Bitte einen Namen eingeben.");
    cd.close();
    if (catMode === "person") return save(() => store.savePerson({ ...editingCat, name }), "Gespeichert");
    let saved;
    await save(async () => { saved = await store.saveCategory({ ...editingCat, name }); }, "Gespeichert");
    if (reopenBlock && editing && saved) { editing.category_id = saved.id; openBlock(editing); }
  });
  $("#cancelCatBtn").onclick = () => { cd.close(); if (reopenBlock && editing) openBlock(editing); };
  $("#deleteCatBtn").onclick = async () => {
    const c = editingCat; cd.close();
    const ok = await confirmBox(`Kategorie „${c.name}“ löschen? Alle Zeitblöcke dieser Kategorie (auch in anderen Wochen) werden mit gelöscht.`, "Löschen");
    if (ok) await save(() => store.deleteCategory(c.id), "Kategorie gelöscht");
  };

  // ---------- Bestätigung und Meldungen ----------
  function confirmBox(text, yes = "OK") {
    const dlg = $("#confirmDialog"); $("#confirmText").textContent = text; $("#confirmYes").textContent = yes;
    dlg.returnValue = "";
    dlg.showModal();
    return new Promise((res) => dlg.addEventListener("close", () => res(dlg.returnValue === "yes"), { once: true }));
  }
  let toastT;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 1800); }
  async function save(fn, okMsg) {
    try { await fn(); await load(); if (okMsg) toast(okMsg); }
    catch (err) { console.error(err); toast("Speichern fehlgeschlagen: " + (err.message || err)); await load(); }
  }

  // ---------- Navigation ----------
  $("#prevWeek").onclick = () => { state.weekStart = addDays(state.weekStart, -7); load(); };
  $("#nextWeek").onclick = () => { state.weekStart = addDays(state.weekStart, 7); load(); };
  $("#weekLabel").onclick = () => { const t = new Date(); state.weekStart = mondayOf(t); state.dayIdx = (t.getDay() + 6) % 7; didInitialScroll = false; load(); };
  function setMode(m) {
    state.mode = m;
    document.querySelectorAll(".segmented[role=tablist] button").forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
    didInitialScroll = false; render();
  }
  document.querySelectorAll(".segmented[role=tablist] button").forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  function switchView(v) {
    state.view = v;
    document.querySelectorAll(".tabbar button").forEach((x) => x.classList.toggle("active", x.dataset.view === v));
    document.querySelectorAll(".view").forEach((s) => (s.hidden = s.id !== "view-" + v));
    render();
  }
  document.querySelectorAll(".tabbar button").forEach((b) => (b.onclick = () => switchView(b.dataset.view)));
  $("#addEventBtn").onclick = () => {
    const d = state.view === "plan" ? selDate() : ymd(new Date());
    openEvent({ title: "", date: d, start_min: 9 * 60, end_min: null, person_id: null, note: "" });
  };
  $("#addBtn").onclick = () => {
    const now = new Date(); const d = selDate();
    const start = d === ymd(now) ? Math.min(Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30, 1380) : 8 * 60;
    openBlock({ person_id: store.myPersonId || state.people[0]?.id, date: d, start_min: start, end_min: Math.min(start + 60, 1440), category_id: state.categories[0]?.id });
  };
  $("#addCatBtn").onclick = () => openCat({});
  $("#copyWeekBtn").onclick = async () => {
    const prevFrom = ymd(addDays(state.weekStart, -7)), prevTo = ymd(addDays(state.weekStart, -1));
    const prev = await store.getBlocks(prevFrom, prevTo);
    if (!prev.length) return toast("Die Vorwoche ist leer.");
    const ok = await confirmBox(`${prev.length} Einträge aus der Vorwoche in diese Woche übernehmen? Bestehende Einträge bleiben erhalten.`, "Übernehmen");
    if (!ok) return;
    const copies = prev.map(({ id, updated_at, created_at, ...b }) => ({ ...b, date: ymd(addDays(parseYmd(b.date), 7)) }));
    await save(() => store.saveBlocks(copies), `${copies.length} Einträge übernommen`);
  };

  store.onChange(() => { if (!drag) load(); });
  // ---------- Start / Anmeldung ----------
  function showLogin(text) {
    $("#login").hidden = false;
    if (text) $("#loginText").textContent = text;
  }
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#loginBtn"), msg = $("#loginMsg");
    btn.disabled = true; msg.textContent = "Sende Link …";
    try { await store.sendLink($("#loginEmail").value.trim()); msg.textContent = "Link ist unterwegs. Öffne die E-Mail auf diesem Gerät und tippe auf den Link."; }
    catch (err) { msg.textContent = "Das hat nicht geklappt: " + err.message; }
    btn.disabled = false;
  });
  async function start() {
    if (store.init) {
      const ok = await store.init();
      if (!ok) return showLogin();
      if (!store.isMember) return showLogin(`Die Adresse ${store.userEmail} ist nicht für diesen Plan freigeschaltet. Bitte mit der freigeschalteten E-Mail anmelden.`);
    }
    $("#login").hidden = true;
    await load();
  }
  if (store.onAuth) store.onAuth((ev) => { if (ev === "SIGNED_IN" && !$("#login").hidden) start(); });
  start();

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
