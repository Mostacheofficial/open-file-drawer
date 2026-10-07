// Local demo data layer (localStorage). The UI talks to window.NR_DB for reads and to NR.api for writes.
// With backend "supabase", js/backend-supabase.js replaces NR_DB with a read-only mapping of the database tables.
//
// Collections: reports, protocols, wanted, notes, leads. Each one exposes
//   list(), get(id), create(obj), update(id, patch), remove(id)
// plus DB.init() (seeds demo data once), DB.reset() (local demo only) and DB.flags.list().
(function () {
  'use strict';
  const cfg = window.NR_CONFIG;
  const year = () => new Date().getFullYear();
  const pad = (n, w = 4) => String(n).padStart(w, '0');

  // id format, id pattern and whether the table has a real `status` column
  const SPEC = {
    reports:   { make: n => `NR-${year()}-${pad(n)}`,   re: /^NR-(\d{4})-(\d+)$/,   status: true },
    protocols: { make: n => `NR-P-${year()}-${pad(n)}`, re: /^NR-P-(\d{4})-(\d+)$/, status: true },
    wanted:    { make: n => `W-${pad(n)}`,              re: /^W-(\d+)$/ },
    notes:     { make: n => `N-${pad(n)}`,              re: /^N-(\d+)$/ },
    leads:     { make: n => `L-${pad(n)}`,              re: /^L-(\d+)$/ },
    orgs:      { make: n => `O-${pad(n)}`,              re: /^O-(\d+)$/ },       // Enterprise: organisations (members and invitations live inside the row)
    entries:   { make: n => `E-${pad(n)}`,              re: /^E-(\d+)$/ },       // Enterprise: confidential entries
    audit:     { make: n => `A-${pad(n, 5)}`,           re: /^A-(\d+)$/ }        // Enterprise: change log
  };
  const NAMES = Object.keys(SPEC);

  function nextNum(name, rows) {
    const y = String(year());
    let max = 0;
    rows.forEach(r => {
      const m = String(r.id).match(SPEC[name].re);
      if (!m) return;
      const yearPart = m.length === 3 ? m[1] : y;
      const num = +m[m.length - 1];
      if (yearPart === y && num > max) max = num;
    });
    return max + 1;
  }

  // ---------- local (localStorage) ----------
  const SEEDED = 'ofd.seeded.v2';
  const CANON = 'ofd.canon';

  function localCollection(name) {
    const key = `ofd.${name}.v2`;
    const read = () => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch (e) { return []; } };
    const write = rows => {
      try { localStorage.setItem(key, JSON.stringify(rows)); }
      catch (e) { throw new Error('Browser storage is full — try a smaller experiment table or reset the demo data.'); }
    };
    return {
      async list() { return read(); },
      async get(id) { return read().find(r => r.id === id) || null; },
      async create(obj) {
        const rows = read();
        const row = { ...obj, id: SPEC[name].make(nextNum(name, rows)) };
        rows.push(row);
        write(rows);
        return row;
      },
      async update(id, patch) {
        const rows = read();
        const i = rows.findIndex(r => r.id === id);
        if (i < 0) throw new Error('Not found: ' + id);
        rows[i] = { ...rows[i], ...patch, updatedAt: new Date().toISOString() };
        write(rows);
        return rows[i];
      },
      async remove(id) { write(read().filter(r => r.id !== id)); },
      _replaceAll: write
    };
  }

  function seedLocal(db) {
    const seed = window.NR_SEED;
    NAMES.forEach(n => {
      const rows = (seed[n] || []).map(r => ({ ...r }));
      if (n === 'protocols') rows.forEach(p => { p.fingerprint = window.NR.fingerprint(p); });
      db[n]._replaceAll(rows);
    });
    localStorage.setItem(SEEDED, '1'); localStorage.setItem(CANON, 'v2');
  }

  function makeLocal() {
    const db = { backendName: 'local' };
    NAMES.forEach(n => { db[n] = localCollection(n); });
    // flags are kept inside each report in the local demo; expose them like the server table
    db.flags = { async list() { const out = []; (await db.reports.list()).forEach(r => (r.flags || []).forEach((f, i) => out.push({ id: `${r.id}:${i}`, reportId: r.id, reason: f.reason, by: f.by, at: f.at }))); return out; } };
    // Browsers that stored demo data before the canonical fingerprint format changed get their fingerprints recomputed once.
    db.init = async () => {
      if (!localStorage.getItem(SEEDED)) return seedLocal(db);
      // collections that were added in later versions (organisations, entries, audit): seed just those, never touch existing data
      NAMES.forEach(n => { if (localStorage.getItem(`ofd.${n}.v2`) == null) db[n]._replaceAll(((window.NR_SEED || {})[n] || []).map(r => JSON.parse(JSON.stringify(r)))); });
      if (localStorage.getItem(CANON) !== 'v2') {
        const rows = await db.protocols.list();
        rows.forEach(p => { p.fingerprint = window.NR.fingerprint(p); });
        db.protocols._replaceAll(rows); localStorage.setItem(CANON, 'v2');
      }
    };
    db.reset = async () => { seedLocal(db); };

    // The Data product as the demo sees it: the same two flat tables the database serves as api_reports / api_experiments
    // (rows are built by NR.dataRows in tools.js), filtered like PostgREST would: [[column, operator, value], ...], order [column, 'asc'|'desc'].
    db.dataApi = {
      async query(view, { filters = [], order = null, limit = 50, offset = 0 } = {}) {
        const reports = (await db.reports.list()).filter(r => r.visibility !== 'pending');
        let rows = view === 'api_reports' ? window.NR.dataRows.reports(reports) : window.NR.dataRows.experiments(reports);
        filters.forEach(([col, op, val]) => { rows = rows.filter(r => window.NR.dataRows.test(r[col], op, val)); });
        if (order) { const [c, dir] = order; rows = [...rows].sort((a, b) => { const x = a[c], y = b[c]; if (x == null) return y == null ? 0 : 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : 0) * (dir === 'desc' ? -1 : 1); }); }
        return rows.slice(offset, offset + limit);
      },
      async count(view) { return (await db.dataApi.query(view, { limit: 1e9 })).length; }
    };

    // Enterprise: the organisations the signed-in person belongs to (membership is by verified e-mail address, like on the server)
    const myEmail = () => { const u = window.NR_AUTH.current(); return u && u.method === 'email' && u.email ? String(u.email).toLowerCase() : null; };
    db.orgs.mine = async () => { const e = myEmail(); return e ? (await db.orgs.list()).filter(o => (o.members || []).some(m => m.email === e)).map(o => ({ id: o.id, name: o.name, role: o.members.find(m => m.email === e).role })) : []; };
    db.orgs.overview = async () => (await db.orgs.list()).map(o => ({ id: o.id, name: o.name, createdAt: o.createdAt, demo: !!o.demo, members: (o.members || []).length, admins: (o.members || []).filter(m => m.role === 'admin').length, invites: (o.invites || []).length }));
    db.orgs.members = async orgId => ((await db.orgs.get(orgId)) || { members: [] }).members.map(m => ({ id: m.email, name: m.name, email: m.email, role: m.role, addedAt: m.addedAt }));
    db.orgs.invites = async orgId => ((await db.orgs.get(orgId)) || { invites: [] }).invites || [];
    db.entries.forOrg = async orgId => (await db.entries.list()).filter(x => x.orgId === orgId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    db.audit.forOrg = async orgId => (await db.audit.list()).filter(x => x.orgId === orgId).sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
    return db;
  }

  // With backend "supabase", js/backend-supabase.js replaces window.NR_DB (and NR_AUTH) after this file has loaded.
  window.NR_DB = makeLocal();
})();
