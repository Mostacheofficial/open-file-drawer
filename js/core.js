// Core: helpers, constants, shared components, router. Every view file registers itself with NR.route().
(function () {
  'use strict';
  const NR = (window.NR = window.NR || {});
  const Auth = window.NR_AUTH;
  const cfg = (NR.cfg = window.NR_CONFIG);
  NR.DB = window.NR_DB;

  // ---------- tiny helpers ----------
  const $ = (NR.$ = (s, r = document) => r.querySelector(s));
  NR.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (NR.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  NR.fmtDate = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
  NR.fmtMonth = ym => { const m = String(ym || '').match(/^(\d{4})-(\d{2})$/); return m ? new Date(+m[1], +m[2] - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : ''; };
  NR.paras = t => String(t || '').split(/\n+/).map(s => s.trim()).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('');
  NR.lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  NR.lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  NR.lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };
  NR.safeUrl = u => (/^https?:\/\/[^\s]+$/i.test(String(u || '').trim()) ? String(u).trim() : null);
  NR.isNum = x => typeof x === 'number' && Number.isFinite(x);
  NR.pct = x => String(Math.round(x * 10) / 10);
  NR.token = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
  NR.query = () => new URLSearchParams(location.hash.split('?')[1] || '');
  // Citable address of a report: the configured official site on the live site (so exports stay valid whatever address the page was opened at), the current address in the demo.
  NR.siteBase = () => {
    if (NR.backend === 'supabase' && cfg.siteUrl) {
      try {
        const u = new URL(cfg.siteUrl); u.hash = ''; u.search = '';
        if (!u.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(u.pathname)) u.pathname += '/';
        return u.toString();
      } catch (e) { /* not a valid URL: fall back to the current address */ }
    }
    return location.href.split('#')[0];
  };
  NR.reportUrl = id => NR.siteBase() + '#/report/' + id;
  NR.maskEmail = e => String(e || '').replace(/^(.).*(@.*)$/, '$1•••$2');
  // lower-case, strip accents, map sub/superscripts and dashes so "Pd(OAc)2" finds "Pd(OAc)₂" and "C-H" finds "C–H"
  NR.norm = s => String(s == null ? '' : s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[‐-―−]/g, '-');

  NR.setTitle = t => { document.title = t ? `${t} — Open File Drawer` : "Open File Drawer — Chemistry reports on what didn't work"; };
  NR.setMain = html => { $('#main').innerHTML = html; };
  NR.toast = msg => {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(NR.toast._t); NR.toast._t = setTimeout(() => { t.hidden = true; }, 3400);
  };
  NR.setJsonLd = obj => {
    let el = document.getElementById('jsonld');
    if (!obj) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('script'); el.id = 'jsonld'; el.type = 'application/ld+json'; document.head.appendChild(el); }
    el.textContent = JSON.stringify(obj).replace(/</g, '\\u003c');
  };
  NR.copy = async text => {
    try { await navigator.clipboard.writeText(text); NR.toast('Copied to clipboard'); }
    catch (e) { window.prompt('Copy this text:', text); }
  };

  // ---------- SHA-256 (sync, so it also works on file:// and for seeding) ----------
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  NR.sha256 = msg => {
    const bytes = new TextEncoder().encode(msg), l = bytes.length, bits = l * 8;
    const total = (((l + 9 + 63) >> 6) << 6), buf = new Uint8Array(total);
    buf.set(bytes); buf[l] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 8, Math.floor(bits / 0x100000000)); dv.setUint32(total - 4, bits >>> 0);
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], w = new Uint32Array(64);
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15], b = w[i - 2];
        const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
        const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    return H.map(x => x.toString(16).padStart(8, '0')).join('');
  };
  // The fingerprint covers exactly the registered plan (not status, amendments or links) plus author names and registration time.
  // Canonical string v2 — the database builds the very same string (private.protocol_canon in supabase/schema.sql),
  // so a plan registered on the server can be verified here and vice versa. Fields are separated by U+001E, list items by U+001F.
  NR.canon = p => ['v2', new Date(p.createdAt).toISOString(), p.title, p.subfield, p.reactionClass, p.question, p.hypothesis, p.system, p.design, p.controls,
    (p.analytics || []).join('\u001f'), p.metric || '', p.threshold == null ? '' : String(p.threshold), p.successCriterion || '', p.stopping || '', p.plannedEnd || '',
    (p.authors || []).map(a => a.name).join('\u001f')].map(x => (x == null ? '' : String(x))).join('\u001e');
  NR.fingerprint = p => NR.sha256(NR.canon(p));

  // ---------- constants ----------
  const ring = '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2"/>';
  const svg = inner => `<svg viewBox="0 0 16 16" aria-hidden="true">${inner}</svg>`;
  const SVG = (NR.SVG = {
    preprint: svg(ring),
    review: svg(ring + '<path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor"/>'),
    peer: svg('<circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M4.8 8.2 7 10.4l4.2-4.6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
    check: svg('<path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
    reg: svg(ring + '<circle cx="8" cy="8" r="2" fill="currentColor"/>'),
    ipa: svg(ring + '<path d="M5.2 8.2 7.3 10.3l3.6-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>')
  });
  SVG.done = SVG.peer;
  NR.STATUS = {
    preprint: { label: 'Preprint', long: 'Preprint — not peer reviewed', hint: 'Published by a verified author. Not independently reviewed.' },
    review: { label: 'In review', long: 'In peer review', hint: 'An editor and two independent reviewers are evaluating this report.' },
    peer: { label: 'Peer reviewed', long: 'Peer reviewed', hint: 'Accepted after review by an editor and two independent reviewers.' }
  };
  NR.PSTATUS = {
    registered: { label: 'Registered', cls: 'reg', icon: 'reg', hint: 'The plan is registered and time-stamped. It has not been reviewed.' },
    ipa: { label: 'Plan reviewed', cls: 'ipa', icon: 'ipa', hint: 'Reviewed and accepted in principle: if the plan is followed, the outcome report will be published whatever the result.' },
    completed: { label: 'Completed', cls: 'done', icon: 'done', hint: 'An outcome report has been published.' },
    withdrawn: { label: 'Withdrawn', cls: 'reg', icon: 'reg', hint: 'The authors withdrew this registration.' }
  };
  NR.CATEGORIES = {
    'no-reactivity': 'No reactivity / no conversion',
    'unexpected-product': 'Unexpected product or selectivity',
    'decomposition': 'Decomposition of substrate or product',
    'catalyst-deactivation': 'Catalyst or reagent deactivation',
    'low-yield': 'Yield or selectivity below useful threshold',
    'irreproducible': 'Not reproducible',
    'scale-up': 'Fails on scale-up / in flow',
    'analytical': 'Analytically inconclusive'
  };
  NR.SUBFIELDS = ['Organic synthesis', 'Catalysis', 'Photochemistry', 'Electrochemistry', 'Inorganic / organometallic', 'Materials / MOFs', 'Polymer chemistry', 'Analytical chemistry', 'Chemical biology', 'Computational + experimental', 'Other'];
  NR.REACTIONS = ['C–H functionalisation', 'Cross-coupling', 'Amination / C–N coupling', 'Photoredox / photochemistry', 'Electrosynthesis', 'Asymmetric organocatalysis', 'Cycloaddition / pericyclic', 'Oxidation / reduction', 'Biocatalysis', 'Materials / MOF synthesis', 'Polymerisation', 'Other'];
  NR.ANALYTICS = ['NMR', 'HRMS', 'LC-MS', 'GC-MS', 'HPLC', 'UV/Vis', 'IR', 'XRD / PXRD', 'Elemental analysis', 'Other'];
  NR.LICENSES = ['CC BY 4.0', 'CC BY-SA 4.0', 'CC0 1.0'];
  NR.LICENSE_URL = { 'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/', 'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/', 'CC0 1.0': 'https://creativecommons.org/publicdomain/zero/1.0/' };
  NR.METRICS = ['Yield (%)', 'Conversion (%)', 'Enantiomeric excess (% ee)', 'Selectivity (%)', 'Other (%)'];
  // Review criteria and recommendations — the keys must match private.review_criteria / private.review_recs in supabase/schema.sql
  NR.REVIEW = {
    report: {
      criteria: [
        ['hypothesis', 'The hypothesis was plausible and well motivated', 'Is there a sound reason (precedent, mechanism) why this should have worked?'],
        ['design', 'The experimental set-up was sound', 'No obviously unsuitable catalyst, wavelength, temperature or other condition.'],
        ['variation', 'Conditions were varied systematically', 'The series cover the relevant variables rather than a handful of ad-hoc runs.'],
        ['controls', 'Controls show that the system can work', 'Positive controls work as expected; negative controls behave as they should.'],
        ['analytics', 'The analytical evidence supports the stated outcome', 'Methods are appropriate and the data shown are sufficient for the claim.'],
        ['interpretation', 'Interpretation and stated limits are honest', 'Conclusions do not go beyond the data; what was not tested is said.']
      ],
      recs: [['accept', 'Accept as it is'], ['minor', 'Accept after minor revision'], ['major', 'Major revision needed'], ['reject', 'Do not accept']]
    },
    protocol: {
      criteria: [
        ['question', 'The research question is clear and worth asking', 'Would the answer — also a negative one — be useful to others?'],
        ['hypothesis', 'The hypothesis is plausible and well motivated', 'Precedent or mechanism is given.'],
        ['design', 'The design is sound and varies the right things', 'Series and numbers of experiments are adequate for the question.'],
        ['controls', 'Positive and negative controls are adequate', 'They will show whether the system works.'],
        ['success', 'Success criterion and stopping rule are clear and testable', 'Someone else could later tell whether the plan was followed.'],
        ['analytics', 'The planned analytical methods are suitable', 'They can actually distinguish the possible outcomes.']
      ],
      recs: [['accept', 'Accept in principle'], ['revise', 'Needs changes first'], ['reject', 'Do not accept']]
    }
  };
  // the fields that belong to one version of a report (everything else — status, review state, confirmation — is about the report as a whole)
  NR.CONTENT_KEYS = ['title', 'abstract', 'subfield', 'reactionClass', 'keywords', 'authors', 'question', 'hypothesis', 'system', 'timeSpan', 'metric', 'threshold', 'series', 'experiments',
    'controls', 'analytics', 'expected', 'observed', 'failureCategory', 'interpretation', 'limitations', 'deviations', 'dataLinks', 'license', 'nExperiments', 'files', 'version', 'versionNote', 'versionCreatedAt'];
  // Rules for a workspace entry. The database enforces the same in private.build_entry (supabase/schema.sql); this gives readable messages while typing.
  NR.validateEntry = p => {
    const e = {}, txt = (k, min, max) => { const n = String(p[k] == null ? '' : p[k]).trim().length; if (n < min) e[k] = min <= 1 ? 'Required' : `Please write at least ${min} characters.`; else if (n > max) e[k] = `At most ${max} characters.`; };
    txt('title', 5, 300); txt('subfield', 2, 100); txt('reactionClass', 2, 100); txt('goal', 3, 3000); txt('approach', 3, 6000); txt('outcome', 3, 6000); txt('learnings', 3, 6000);
    if (!Object.keys(NR.CATEGORIES).includes(p.failureCategory)) e.failureCategory = 'Please choose a failure category.';
    if (String(p.project || '').length > 200) e.project = 'At most 200 characters.';
    if (String(p.recommendation || '').length > 3000) e.recommendation = 'At most 3000 characters.';
    if ((p.tags || []).length > 20 || (p.tags || []).some(x => String(x).length > 40)) e.tags = 'At most 20 tags of up to 40 characters each.';
    if ((p.links || []).length > 10 || (p.links || []).some(x => !/^https?:\/\/\S+$/i.test(x) || String(x).length > 500)) e.links = 'Up to 10 web addresses, each starting with http:// or https://.';
    return e;
  };
  NR.RATINGS = [['yes', 'Yes'], ['partly', 'Partly'], ['no', 'No']];
  NR.OPEN_REVIEW = [['none', 'Keep my review confidential (editors and authors only)'], ['anonymous', 'Publish my review anonymously if the report is accepted'], ['signed', 'Publish my review with my name if the report is accepted']];

  // ---------- model helpers ----------
  NR.backend = NR.DB.backendName;                       // 'local' (demo, browser only) | 'supabase'
  NR.me = () => Auth.current();
  NR.isStaff = u => !!u && (u.role === 'editor' || u.role === 'admin');
  NR.isPublic = r => r.visibility !== 'pending';
  // Server data carries submitterId (auth user id); the local demo identifies people by ORCID / e-mail.
  NR.isOwner = (item, u) => {
    if (!u || !item) return false;
    if (item.submitterId) return item.submitterId === u.id;
    return !!(item.submitter && Auth.idOf(u) && Auth.idOf(u) === (item.submitter.orcid || item.submitter.email));
  };
  NR.isAuthor = (item, u) => NR.isOwner(item, u) || !!(u && u.orcid && (item.authors || []).some(a => a.orcid && a.orcid === u.orcid));
  NR.requireAuth = next => {
    const u = NR.me();
    if (u && (u.name || NR.backend === 'local')) return u;
    try { sessionStorage.setItem('nr.next', next || location.hash); } catch (e) {}
    location.hash = u ? '#/me' : '#/login';              // signed in but no name yet -> complete the profile first
    return null;
  };
  NR.meTooCount = w => (w.meTooCount != null ? w.meTooCount : (w.meToo || []).length);
  NR.meTooMine = (w, key) => (w.meTooByMe != null ? w.meTooByMe : !!key && (w.meToo || []).includes(key));
  NR.wantedMine = (w, u) => !!u && (w.mine != null ? w.mine : !!w.by && Auth.idOf(u) === (w.by.orcid || w.by.email));
  NR.totalN = r => (r.series || []).reduce((a, s) => a + (+s.n || 0), 0);
  NR.bestTest = r => { const v = (r.series || []).filter(s => !s.isControl && NR.isNum(s.best)).map(s => s.best); return v.length ? Math.max(...v) : null; };
  NR.bestControl = r => { const v = (r.series || []).filter(s => s.isControl && NR.isNum(s.best)).map(s => s.best); return v.length ? Math.max(...v) : null; };
  NR.loadMeta = async () => {
    const notes = {};
    (await NR.DB.notes.list()).forEach(n => { (notes[n.reportId] = notes[n.reportId] || []).push(n); });
    return { notes };
  };
  // ---------- shared components ----------
  const badge = (NR.badge = s => `<span class="badge badge-${s}" title="${esc(NR.STATUS[s].hint)}">${SVG[s]}<span>${NR.STATUS[s].label}</span></span>`);
  NR.pBadge = s => { const p = NR.PSTATUS[s]; return `<span class="badge badge-${p.cls}" title="${esc(p.hint)}">${SVG[p.icon]}<span>${p.label}</span></span>`; };
  NR.minibar = (best, thr) => {
    const w = Math.max(0, Math.min(100, best));
    return `<span class="minibar" title="Best result in the test series: ${NR.pct(best)}%${thr ? ` (success threshold ${NR.pct(thr)}%)` : ''}"><span class="mb-track"><i style="width:${w}%"></i>${thr ? `<b style="left:${Math.min(100, thr)}%"></b>` : ''}</span><span class="mb-txt">best ${NR.pct(best)}%${thr ? ` <span class="muted">· target ≥ ${NR.pct(thr)}%</span>` : ''}</span></span>`;
  };
  NR.reportCard = (r, meta = {}) => {
    const notes = (meta.notes && meta.notes[r.id]) || [];
    const conf = notes.filter(n => n.type === 'confirm').length, contra = notes.filter(n => n.type === 'contradict').length;
    const best = NR.bestTest(r);
    const chips = [badge(r.status)];
    if (r.protocolId) chips.push(`<span class="chip chip-prereg" title="The plan was registered before the experiments">${SVG.check}Pre-registered</span>`);
    if (conf) chips.push(`<span class="chip chip-ok" title="Independent groups reported the same result">${SVG.check}${conf} independent confirmation${conf > 1 ? 's' : ''}</span>`);
    if (contra) chips.push(`<span class="chip chip-warn" title="A verified researcher reported a different result">${contra} contradicting result${contra > 1 ? 's' : ''}</span>`);
    chips.push(`<span class="tag">${esc(r.subfield)}</span>`);
    if (r.visibility === 'pending') chips.push('<span class="chip chip-warn">awaiting co-author confirmation</span>');
    return `<article class="rcard">
      <div class="meta">${chips.join('')}</div>
      <h3><a href="#/report/${esc(r.id)}">${esc(r.title)}</a></h3>
      <p class="abs">${esc(r.abstract)}</p>
      ${best != null ? `<div>${NR.minibar(best, r.threshold)}</div>` : ''}
      <div class="meta"><span>${r.authors.map(a => esc(a.name)).join(', ')}</span><span>·</span><span>${NR.fmtDate(r.createdAt)}</span><span>·</span><span class="mono">${esc(r.id)}</span><span>·</span><span>${NR.totalN(r)} experiments</span></div>
    </article>`;
  };
  NR.protocolCard = p => `<article class="rcard">
      <div class="meta">${NR.pBadge(p.status)}<span class="tag">${esc(p.subfield)}</span><span class="tag">${esc(p.reactionClass)}</span></div>
      <h3><a href="#/protocol/${esc(p.id)}">${esc(p.title)}</a></h3>
      <p class="abs">${esc(p.question)}</p>
      <div class="meta"><span>${p.authors.map(a => esc(a.name)).join(', ')}</span><span>·</span><span>registered ${NR.fmtDate(p.createdAt)}</span><span>·</span><span>planned end ${esc(NR.fmtMonth(p.plannedEnd))}</span><span>·</span><span class="mono">${esc(p.id)}</span>${p.reportId ? `<span>·</span><a href="#/report/${esc(p.reportId)}">outcome report →</a>` : ''}</div>
    </article>`;
  NR.verifiedMark = r => r.submitter ? `<span class="verified" title="Submitter identity verified via ${r.submitter.method === 'orcid' ? 'ORCID' : 'institutional e-mail'}">${SVG.check} verified ${r.submitter.method === 'orcid' ? 'ORCID' : 'institution'}</span>` : '';

  // ---------- form helpers ----------
  const attr = o => (o.attrs || '');
  NR.f = {
    text: (label, name, o = {}) => `<div class="field"><label for="f-${name}">${label}</label>${o.hint ? `<p class="hint">${o.hint}</p>` : ''}<input type="${o.type || 'text'}" id="f-${name}" name="${name}" value="${esc(o.value == null ? '' : o.value)}" placeholder="${esc(o.ph || '')}" ${attr(o)}><p class="err" data-err="${name}"></p></div>`,
    area: (label, name, o = {}) => `<div class="field"><label for="f-${name}">${label}</label>${o.hint ? `<p class="hint">${o.hint}</p>` : ''}<textarea id="f-${name}" name="${name}" rows="${o.rows || 4}" placeholder="${esc(o.ph || '')}">${esc(o.value || '')}</textarea><p class="err" data-err="${name}"></p></div>`,
    select: (label, name, options, o = {}) => `<div class="field"><label for="f-${name}">${label}</label>${o.hint ? `<p class="hint">${o.hint}</p>` : ''}<select id="f-${name}" name="${name}"><option value="">${esc(o.placeholder || 'Select…')}</option>${options.map(x => { const [v, l] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}" ${o.value === v ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select><p class="err" data-err="${name}"></p></div>`,
    check: (html, name, o = {}) => `<div class="field" style="margin-bottom:8px"><label class="check"><input type="checkbox" name="${name}" ${o.checked ? 'checked' : ''}> <span>${html}</span></label><p class="err" data-err="${name}"></p></div>`
  };
  NR.showErrors = (root, errs) => {
    NR.$$('[data-err]', root).forEach(e => { e.textContent = errs[e.dataset.err] || ''; });
    const first = NR.$$('.err', root).find(e => e.textContent);
    if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return !first;
  };

  // Self-contained authors editor: renders into `el` and mutates the `authors` array in place.
  NR.authorsEditor = (el, authors, opts = {}) => {
    const { withEmail = true, onChange = () => {} } = opts;
    const render = () => {
      el.innerHTML = authors.map((a, i) => `
        <div class="rowcard"><div class="rc-head"><span>Author ${i + 1}${i === 0 ? ' (you, submitting)' : ''}</span>${i > 0 ? `<button type="button" class="btn ghost sm" data-del="${i}">Remove</button>` : ''}</div>
          <div class="grid c3">
            <div><label>Name</label><input type="text" data-i="${i}" data-f="name" value="${esc(a.name)}" autocomplete="off"></div>
            <div><label>Affiliation</label><input type="text" data-i="${i}" data-f="affiliation" value="${esc(a.affiliation)}"></div>
            <div><label>ORCID (optional)</label><input type="text" data-i="${i}" data-f="orcid" value="${esc(a.orcid)}" placeholder="0000-0000-0000-0000"></div>
          </div>
          <div class="grid c2" style="margin-top:10px">
            ${withEmail && i > 0 ? `<div><label>E-mail</label><input type="email" data-i="${i}" data-f="email" value="${esc(a.email || '')}" placeholder="name@university.edu"><p class="hint" style="margin:4px 0 0">Used only to send the confirmation request. Never shown publicly.</p></div>` : '<div></div>'}
            <div><label>Role</label><select data-i="${i}" data-f="role"><option value="" ${!a.role ? 'selected' : ''}>Author</option><option value="pi" ${a.role === 'pi' ? 'selected' : ''}>Group leader (PI)</option></select></div>
          </div>
        </div>`).join('') + '<button type="button" class="btn secondary sm" data-add>+ Add author</button>';
      NR.$$('[data-f]', el).forEach(inp => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => { authors[+inp.dataset.i][inp.dataset.f] = inp.value; onChange(); }));
      NR.$$('[data-del]', el).forEach(b => { b.onclick = () => { authors.splice(+b.dataset.del, 1); onChange(); render(); }; });
      NR.$('[data-add]', el).onclick = () => { authors.push({ name: '', affiliation: '', orcid: '', email: '', role: '' }); onChange(); render(); };
    };
    render();
  };

  // ---------- the signed-in person's organisations (Enterprise workspaces) ----------
  NR.orgs = [];                                                // [{ id, name, role }]
  let orgsFor;
  NR.refreshOrgs = async () => {
    const u = NR.me();
    orgsFor = u ? Auth.idOf(u) : null;
    NR.orgs = [];
    if (!u || !(u.name || NR.backend === 'local')) return;
    try { if (NR.api && NR.api.claimOrgInvites) await NR.api.claimOrgInvites(); NR.orgs = await NR.DB.orgs.mine(); } catch (e) { console.error(e); }
  };
  NR.ensureOrgs = async () => { const u = NR.me(); if ((u ? Auth.idOf(u) : null) !== orgsFor) await NR.refreshOrgs(); };

  // ---------- nav & router ----------
  NR.renderNav = () => {
    const u = NR.me(), f = cfg.features || {};
    const items = [['archive', 'Archive', '#/archive'], f.registry !== false && ['registry', 'Registry', '#/registry'], f.wanted !== false && ['wanted', 'Wanted', '#/wanted'], ['submit', 'Submit', '#/submit'], f.products !== false && ['products', 'Products', '#/products'], ['about', 'About', '#/about']].filter(Boolean);
    const seg = (location.hash.split('/')[1] || '').split('?')[0];
    const active = { report: 'archive', protocol: 'registry', register: 'registry', confirm: 'submit', authors: 'about', policies: 'about', board: 'about', data: 'products', enterprise: 'products', organisations: 'products' }[seg] || seg;
    $('#nav').innerHTML = items.map(([k, l, h]) => `<a href="${h}" class="${k === active ? 'active' : ''}">${l}</a>`).join('');
    $('#nav-auth').innerHTML = u
      ? `${NR.isStaff(u) ? '<a class="small" href="#/desk">Desk</a>' : ''}${NR.orgs.length && f.products !== false ? '<a class="small" href="#/workspace">Workspace</a>' : ''}<a href="#/me" class="small">${u.method === 'orcid' ? '<span class="orcid-dot" title="ORCID">iD</span> ' : ''}${esc(u.name)}${NR.isStaff(u) ? ' <span class="tag">staff</span>' : ''}</a><button class="btn ghost sm" id="signout">Sign out</button>`
      : '<a class="btn secondary sm" href="#/login">Sign in</a>';
    const out = $('#signout');
    if (out) out.onclick = async () => { await Auth.signOut(); NR.toast('Signed out'); location.hash = '#/'; NR.renderNav(); };
    NR.applyFeatures();
  };
  // hides elements marked data-feature="registry|wanted|products" when that feature is switched off in config.js
  NR.applyFeatures = () => {
    const f = cfg.features || {};
    NR.$$('[data-feature]').forEach(el => { el.hidden = f[el.dataset.feature] === false; });
  };

  NR.routes = [];
  NR.route = (re, fn) => NR.routes.push([re, fn]);
  NR.dispatch = async () => {
    const hash = location.hash || '#/';
    NR.setJsonLd(null);
    NR.ensureOrgs().then(() => NR.renderNav()).catch(e => console.error(e));         // not awaited: the page must not wait for the menu (the workspace asks for its organisations itself)
    for (const [re, fn] of NR.routes) {
      const m = hash.match(re);
      if (!m) continue;
      try { await fn(...m.slice(1)); }
      catch (e) { NR.setTitle('Error'); NR.setMain(`<div class="wrap page"><h1>Something went wrong</h1><p class="muted">${esc(e.message)}</p></div>`); console.error(e); }
      NR.renderNav(); scrollTo(0, 0); $('#main').focus({ preventScroll: true });
      return;
    }
    NR.setTitle('Page not found');
    NR.setMain('<div class="wrap page"><h1>Page not found</h1><p><a href="#/">Home</a></p></div>');
    NR.renderNav();
  };

  NR.start = async () => {
    const b = $('#proto-banner'), remote = NR.backend === 'supabase';
    b.hidden = false;
    b.textContent = remote ? 'Pilot · live data' : 'Prototype · sample reports are fictional · data is stored only in this browser';
    NR.api = remote ? NR.apiRemote : NR.apiLocal;           // all writes go through NR.api
    try {
      await NR.DB.init();
      if (Auth.init) await Auth.init();                      // remote: restore the session (and finish an ORCID redirect)
      if (NR.api.init) await NR.api.init();                  // remote: read server settings
    } catch (e) { console.error(e); NR.toast('Could not reach the server: ' + e.message); }
    const rs = $('#reset-demo');
    if (remote) rs.hidden = true;
    else rs.onclick = async () => {
      if (!confirm('Reset all demo data in this browser? Your own reports, plans and requests will be removed.')) return;
      try { await NR.DB.reset(); NR.lsDel('ofd.draft.v2'); NR.toast('Demo data reset'); NR.dispatch(); } catch (e) { NR.toast(e.message); }
    };
    // coming back from the ORCID redirect: continue where the visitor was
    try {
      if (remote && sessionStorage.getItem('nr.oauth') && NR.me()) {
        const next = sessionStorage.getItem('nr.next') || '#/';
        sessionStorage.removeItem('nr.oauth'); sessionStorage.removeItem('nr.next');
        history.replaceState(null, '', location.pathname + location.search + (next.startsWith('#') ? next : '#/'));
      }
    } catch (e) {}
    window.addEventListener('hashchange', NR.dispatch);
    NR.dispatch();
  };
})();
