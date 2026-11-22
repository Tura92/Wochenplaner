// Speicher-Schicht. Die App spricht nur mit diesem Interface:
//   getPeople(), getCategories(), saveCategory(c), deleteCategory(id),
//   getBlocks(fromDate, toDate), saveBlock(b), saveBlocks(list), deleteBlock(id), onChange(cb)
// LocalStore speichert im Browser. Ein SupabaseStore mit demselben Interface folgt.

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

const DEFAULT_PEOPLE = [
  { id: "daniel", name: "Daniel" },
  { id: "emily", name: "Emily" },
];

const DEFAULT_CATEGORIES = [
  { id: uid(), name: "Arbeit", color: "#5b8def", sort: 1 },
  { id: uid(), name: "Betreuung Emilia", color: "#d9677b", sort: 2 },
  { id: uid(), name: "Freizeit", color: "#5fae7a", sort: 3 },
  { id: uid(), name: "Lernen (Führerschein/Arbeit)", color: "#e8a33d", sort: 4 },
];

class LocalStore {
  constructor(key = "wochenplaner") {
    this.key = key;
    this.listeners = [];
    let data = null;
    try { data = JSON.parse(localStorage.getItem(key)); } catch (_) {}
    this.data = data || { people: DEFAULT_PEOPLE, categories: DEFAULT_CATEGORIES, blocks: [] };
    this.persist();
    // Änderungen aus einem anderen Tab übernehmen
    window.addEventListener("storage", (e) => {
      if (e.key !== this.key) return;
      try { this.data = JSON.parse(e.newValue); this.emit(); } catch (_) {}
    });
  }
  get mode() { return "lokal"; }
  persist() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (_) {} }
  emit() { this.listeners.forEach((cb) => cb()); }
  onChange(cb) { this.listeners.push(cb); }

  async getPeople() { return this.data.people.map((p) => ({ ...p })); }
  async savePerson(p) {
    const i = this.data.people.findIndex((x) => x.id === p.id);
    if (i >= 0) this.data.people[i] = { ...p };
    this.persist(); this.emit();
  }
  async getCategories() { return [...this.data.categories].sort((a, b) => a.sort - b.sort); }
  async saveCategory(c) {
    if (!c.id) c = { ...c, id: uid(), sort: Math.max(0, ...this.data.categories.map((x) => x.sort)) + 1 };
    const i = this.data.categories.findIndex((x) => x.id === c.id);
    if (i >= 0) this.data.categories[i] = { ...c }; else this.data.categories.push({ ...c });
    this.persist(); this.emit();
    return c;
  }
  async deleteCategory(id) {
    this.data.categories = this.data.categories.filter((c) => c.id !== id);
    this.data.blocks = this.data.blocks.filter((b) => b.category_id !== id);
    this.persist(); this.emit();
  }
  async getBlocks(from, to) {
    return this.data.blocks.filter((b) => b.date >= from && b.date <= to).map((b) => ({ ...b }));
  }
  async saveBlock(b) {
    if (!b.id) b = { ...b, id: uid() };
    const i = this.data.blocks.findIndex((x) => x.id === b.id);
    if (i >= 0) this.data.blocks[i] = { ...b }; else this.data.blocks.push({ ...b });
    this.persist(); this.emit();
    return b;
  }
  async saveBlocks(list) {
    for (const b of list) this.data.blocks.push({ ...b, id: uid() });
    this.persist(); this.emit();
  }
  async deleteBlock(id) {
    this.data.blocks = this.data.blocks.filter((b) => b.id !== id);
    this.persist(); this.emit();
  }
}

// ---------- Supabase (geteilte Daten, Login per E-Mail-Link) ----------
const BLOCK_COLS = ["id", "person_id", "category_id", "date", "start_min", "end_min", "note"];
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

class SupabaseStore {
  constructor(url, key) {
    this.sb = window.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    this.listeners = [];
    this.userEmail = null;
    this.myPersonId = null;
    this.channel = null;
  }
  get mode() { return "supabase"; }
  onChange(cb) { this.listeners.push(cb); }
  emit() { clearTimeout(this._t); this._t = setTimeout(() => this.listeners.forEach((cb) => cb()), 150); }
  check({ data, error }) { if (error) throw new Error(error.message); return data; }

  // true = angemeldet
  async init() {
    const { data } = await this.sb.auth.getSession();
    const session = data.session;
    if (!session) return false;
    this.userEmail = session.user.email;
    const { data: me } = await this.sb.from("members").select("person_id").ilike("email", this.userEmail).maybeSingle();
    this.myPersonId = me ? me.person_id : null;
    this.isMember = !!me;
    if (!this.channel) {
      this.channel = this.sb.channel("wochenplaner")
        .on("postgres_changes", { event: "*", schema: "public", table: "blocks" }, () => this.emit())
        .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => this.emit())
        .on("postgres_changes", { event: "*", schema: "public", table: "people" }, () => this.emit())
        .subscribe();
      // Beim Zurückkehren in die App neu laden (Handy war im Hintergrund)
      document.addEventListener("visibilitychange", () => { if (!document.hidden) this.emit(); });
    }
    return true;
  }
  async sendLink(email) {
    const redirect = location.origin + location.pathname;
    this.check(await this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect, shouldCreateUser: true } }));
  }
  onAuth(cb) { this.sb.auth.onAuthStateChange((ev) => cb(ev)); }
  async signOut() { await this.sb.auth.signOut(); location.reload(); }

  async getPeople() { return this.check(await this.sb.from("people").select("*").order("sort")); }
  async savePerson(p) { this.check(await this.sb.from("people").update({ name: p.name }).eq("id", p.id)); }
  async getCategories() { return this.check(await this.sb.from("categories").select("*").order("sort")); }
  async saveCategory(c) {
    const row = pick(c, ["id", "name", "color", "sort"]);
    if (!row.id) {
      const cats = await this.getCategories();
      row.sort = Math.max(0, ...cats.map((x) => x.sort)) + 1;
      return this.check(await this.sb.from("categories").insert(row).select().single());
    }
    return this.check(await this.sb.from("categories").update(row).eq("id", row.id).select().single());
  }
  async deleteCategory(id) { this.check(await this.sb.from("categories").delete().eq("id", id)); }
  async getBlocks(from, to) {
    return this.check(await this.sb.from("blocks").select("*").gte("date", from).lte("date", to).order("start_min"));
  }
  async saveBlock(b) {
    const row = { ...pick(b, BLOCK_COLS), updated_at: new Date().toISOString() };
    if (!row.id) { delete row.id; return this.check(await this.sb.from("blocks").insert(row).select().single()); }
    return this.check(await this.sb.from("blocks").update(row).eq("id", row.id).select().single());
  }
  async saveBlocks(list) {
    const rows = list.map((b) => { const r = pick(b, BLOCK_COLS); delete r.id; return r; });
    this.check(await this.sb.from("blocks").insert(rows));
  }
  async deleteBlock(id) { this.check(await this.sb.from("blocks").delete().eq("id", id)); }
}

window.createStore = function () {
  const cfg = window.WP_CONFIG || {};
  if (cfg.supabaseUrl && cfg.supabaseKey && window.supabase) return new SupabaseStore(cfg.supabaseUrl, cfg.supabaseKey);
  return new LocalStore();
};
