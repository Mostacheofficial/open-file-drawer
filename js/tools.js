// Tools: CSV import, "all experiments at a glance" plot, exports (BibTeX / RIS / CSV / JSON), share card, JSON-LD.
(function () {
  'use strict';
  const NR = window.NR, esc = NR.esc, isNum = NR.isNum, pct = NR.pct;

  // =============== CSV import ===============
  const TEMPLATE = [
    'experiment_id,series,is_positive_control,catalyst,solvent,temp_c,time_h,result_pct,notes',
    'E001,Ligand screen,no,Pd(OAc)2 / L1,HFIP,100,24,2,no conversion of ArBr',
    'E002,Ligand screen,no,Pd(OAc)2 / L2,HFIP,100,24,0,',
    'E003,Positive control (pivalamide),yes,Pd(OAc)2 / L1,HFIP,100,24,71,matches literature'
  ].join('\n') + '\n';

  // header synonyms (compared after lower-casing and removing everything except a–z and 0–9)
  const SYN = {
    id: ['experimentid', 'expid', 'id', 'entry', 'nr', 'no', 'experiment'],
    series: ['series', 'group', 'screen', 'set', 'batch', 'block', 'campaign', 'variation'],
    control: ['ispositivecontrol', 'positivecontrol', 'iscontrol', 'control', 'pos', 'ctrl'],
    catalyst: ['catalyst', 'catalystreagents', 'catalystreagent', 'reagents', 'reagent', 'ligand', 'catalystligand', 'conditions'],
    solvent: ['solvent', 'solvents'],
    temp: ['tempc', 'temp', 'temperature', 'temperaturec', 'tc'],
    time: ['timeh', 'time', 'duration', 'durationh', 'th', 'reactiontime'],
    result: ['resultpct', 'result', 'yield', 'yieldpct', 'conversion', 'conv', 'conversionpct', 'eepct', 'ee', 'selectivity'],
    notes: ['notes', 'note', 'comment', 'comments', 'remarks']
  };
  const TRUE = ['1', 'true', 'yes', 'y', 'x', 'ja', 'j', 'pos', 'positive', 'control'];

  function parse(text) {
    text = String(text).replace(/^﻿/, '');
    const first = text.split(/\r?\n/, 1)[0];
    const delim = [',', ';', '\t'].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = [];
    let row = [], cur = '', q = false;
    const endRow = () => { row.push(cur); cur = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = []; };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === delim) { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; endRow(); }
      else cur += c;
    }
    if (cur !== '' || row.length) endRow();
    return { delim, rows };
  }

  function toNum(v, decimalComma) {
    let s = String(v == null ? '' : v).trim().toLowerCase();
    if (!s) return null;
    if (/^(n\.?\s?d\.?|none|no product|trace|tr\.?|-|—)$/.test(s)) return 0;
    s = s.replace(/[%\s≈~<>]/g, '');
    if (decimalComma || /^\d+,\d+$/.test(s)) s = s.replace(',', '.');
    const x = parseFloat(s);
    return Number.isFinite(x) ? x : null;
  }
  const fmt = x => String(Math.round(x * 10) / 10);
  function rangeOf(vals) {
    const raw = [...new Set(vals.map(v => String(v).trim()).filter(Boolean))];
    if (raw.length && raw.every(v => /^-?\d+([.,]\d+)?$/.test(v))) {
      const nums = raw.map(v => parseFloat(v.replace(',', '.')));
      const lo = Math.min(...nums), hi = Math.max(...nums);
      return lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`;
    }
    return raw.slice(0, 3).join(', ') + (raw.length > 3 ? ' …' : '');
  }
  function listOf(vals, max = 3) {
    const u = [...new Set(vals.map(v => String(v).trim()).filter(Boolean))];
    return u.length <= max ? u.join(' / ') : u.slice(0, 2).join(' / ') + ` + ${u.length - 2} more`;
  }
  function median(a) { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

  // Turns CSV text into { series[], experiments[], info{} } or throws an Error with a readable message.
  function importText(text) {
    const { delim, rows } = parse(text);
    if (rows.length < 2) throw new Error('The file needs a header row and at least one experiment.');
    const header = rows[0].map(h => String(h).toLowerCase().replace(/[^a-z0-9]/g, ''));
    const col = {}, mapping = {};
    Object.entries(SYN).forEach(([key, names]) => {
      for (const n of names) { const i = header.indexOf(n); if (i >= 0 && !Object.values(col).includes(i)) { col[key] = i; mapping[key] = rows[0][i].trim(); break; } }
    });
    if (col.result == null) throw new Error('Could not find a result column. Name it e.g. "result_pct", "yield" or "conversion".');
    const decimalComma = delim === ';';
    const warnings = [];
    let skipped = 0;
    const exps = [];
    rows.slice(1).forEach((r, k) => {
      const get = key => (col[key] != null && r[col[key]] != null ? String(r[col[key]]).trim() : '');
      const resultRaw = get('result');
      const result = toNum(resultRaw, decimalComma);
      if (resultRaw !== '' && result == null) skipped++;
      exps.push({
        id: get('id') || 'E' + String(k + 1).padStart(3, '0'),
        series: get('series') || 'All experiments',
        catalyst: get('catalyst'), solvent: get('solvent'), temp: get('temp'), time: get('time'),
        result: result == null ? null : result,
        control: TRUE.includes(get('control').toLowerCase()),
        notes: get('notes')
      });
    });
    if (col.series == null) warnings.push('No "series" column found — all experiments were put into one series.');
    if (skipped) warnings.push(`${skipped} result value${skipped > 1 ? 's' : ''} could not be read as a number and ${skipped > 1 ? 'were' : 'was'} left empty.`);

    const groups = new Map();
    exps.forEach(e => { if (!groups.has(e.series)) groups.set(e.series, []); groups.get(e.series).push(e); });
    const series = [...groups.entries()].map(([label, g]) => {
      const nums = g.map(e => e.result).filter(isNum);
      const isControl = g.filter(e => e.control).length > g.length / 2;
      return {
        label, n: g.length,
        catalyst: listOf(g.map(e => e.catalyst)), solvent: listOf(g.map(e => e.solvent)),
        temp: rangeOf(g.map(e => e.temp)), time: rangeOf(g.map(e => e.time)),
        best: nums.length ? Math.round(Math.max(...nums) * 10) / 10 : null,
        outcome: nums.length ? `best ${fmt(Math.max(...nums))}%, median ${fmt(median(nums))}% (${nums.length} value${nums.length > 1 ? 's' : ''})` : 'no numeric results',
        isControl
      };
    });
    return { series, experiments: exps, info: { count: exps.length, seriesCount: series.length, mapping, warnings, delimiter: delim === '\t' ? 'tab' : delim } };
  }
  NR.csv = { parse, importText, template: () => TEMPLATE };

  // =============== downloads & exports ===============
  const download = (name, text, mime) => {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const csvq = v => { const s = v == null ? '' : String(v); return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const bibEsc = s => String(s || '').replace(/([&%$#_])/g, '\\$1');

  // The public view of a report: no flags, e-mails, tokens or internal fields.
  const publicView = r => {
    const { flags, demo, confirmation, wantedId, reviewRequested, submitter, ...rest } = r;
    const conf = confirmation && confirmation.completedAt ? { confirmedBy: confirmation.required.map(x => ({ name: x.name, role: x.role, at: x.confirmedAt })) } : undefined;
    return { schema: 'open-file-drawer-report/0.2', ...rest, ...(conf ? { authorshipConfirmation: conf } : {}), submitter: submitter ? { name: submitter.name, orcid: submitter.orcid || '', method: submitter.method } : undefined };
  };
  NR.exp = {
    download,
    json: r => JSON.stringify(publicView(r), null, 2),
    bibtex: r => {
      const key = 'ofd' + r.id.replace(/[^A-Za-z0-9]/g, '');
      return `@misc{${key},\n  author = {${bibEsc(r.authors.map(a => a.name).join(' and '))}},\n  title = {{${bibEsc(r.title)}}},\n  year = {${new Date(r.createdAt).getFullYear()}},\n  publisher = {Open File Drawer},\n  number = {${r.id}},\n  note = {${NR.STATUS[r.status].long}; version ${r.version}},\n  url = {${NR.reportUrl(r.id)}}\n}\n`;
    },
    ris: r => {
      const d = new Date(r.createdAt), p2 = n => String(n).padStart(2, '0');
      const lines = [r.status === 'peer' ? 'TY  - JOUR' : 'TY  - UNPB', ...r.authors.map(a => 'AU  - ' + a.name), 'TI  - ' + r.title, 'PY  - ' + d.getFullYear(), `DA  - ${d.getFullYear()}/${p2(d.getMonth() + 1)}/${p2(d.getDate())}`,
        'AB  - ' + r.abstract.replace(/\s+/g, ' '), ...(r.keywords || []).map(k => 'KW  - ' + k), 'ID  - ' + r.id, 'PB  - Open File Drawer', 'UR  - ' + NR.reportUrl(r.id), 'N1  - ' + NR.STATUS[r.status].long, 'ER  - '];
      return lines.join('\r\n') + '\r\n';
    },
    csv: r => {
      if ((r.experiments || []).length) {
        return ['experiment_id,series,is_positive_control,catalyst,solvent,temp_c,time_h,result_pct,notes']
          .concat(r.experiments.map(e => [e.id, e.series, e.control ? 'yes' : 'no', e.catalyst, e.solvent, e.temp, e.time, e.result == null ? '' : e.result, e.notes].map(csvq).join(','))).join('\n') + '\n';
      }
      return ['series,n,catalyst,solvent,temp_c,time_h,best_result_pct,is_positive_control,result_text']
        .concat((r.series || []).map(s => [s.label, s.n, s.catalyst, s.solvent, s.temp, s.time, s.best == null ? '' : s.best, s.isControl ? 'yes' : 'no', s.outcome].map(csvq).join(','))).join('\n') + '\n';
    },
    leadsCsv: leads => ['id,created,type,stage,name,email,institution,role,field,intent,budget,message,notes']
      .concat(leads.map(l => [l.id, l.createdAt, l.type, l.stage, l.name, l.email, l.institution, l.role, l.field, l.intent || '', l.budget || '', l.message || '', l.notes || ''].map(csvq).join(','))).join('\n') + '\n'
  };
  NR.publicView = publicView;

  NR.jsonLd = r => ({
    '@context': 'https://schema.org', '@type': 'ScholarlyArticle',
    headline: r.title, abstract: r.abstract, identifier: r.id, url: NR.reportUrl(r.id), datePublished: r.createdAt, keywords: (r.keywords || []).join(', '),
    creativeWorkStatus: NR.STATUS[r.status].long, isAccessibleForFree: true, license: NR.LICENSE_URL[r.license] || undefined,
    publisher: { '@type': 'Organization', name: 'Open File Drawer' },
    author: r.authors.map(a => ({ '@type': 'Person', name: a.name, affiliation: a.affiliation ? { '@type': 'Organization', name: a.affiliation } : undefined, identifier: a.orcid ? 'https://orcid.org/' + a.orcid : undefined }))
  });

  // =============== Data product: the public record as flat tables ===============
  // The same two tables the database serves as the views api_reports (one row per report) and api_experiments (one row per experiment),
  // see supabase/schema.sql. The demo builds them here from the local reports; the live site queries the views (NR.DB.dataApi.query).
  const lenient = v => (typeof v === 'number' && Number.isFinite(v) ? v : (typeof v === 'string' && /^\s*-?\d+([.,]\d+)?\s*$/.test(v) ? parseFloat(v.replace(',', '.')) : null));   // like private.num()
  const bestOf = (series, control) => { const v = (series || []).filter(s => !!s.isControl === control).map(s => lenient(s.best)).filter(x => x != null); return v.length ? Math.max(...v) : null; };
  NR.dataRows = {
    REPORT_COLUMNS: ['report_id', 'title', 'abstract', 'review_status', 'preregistered', 'version', 'subfield', 'reaction_class', 'failure_category', 'metric', 'success_threshold', 'best_test_result', 'best_control_result', 'n_experiments', 'license', 'keywords', 'authors', 'data_links', 'created_at', 'version_created_at'],
    EXPERIMENT_COLUMNS: ['report_id', 'row_no', 'experiment_id', 'series', 'is_positive_control', 'catalyst', 'solvent', 'temp_c', 'time_h', 'result_pct', 'notes', 'reaction_class', 'subfield', 'failure_category', 'review_status', 'preregistered', 'license', 'metric', 'success_threshold', 'version', 'created_at'],
    reports: list => list.map(r => ({
      report_id: r.id, title: r.title, abstract: r.abstract, review_status: r.status, preregistered: !!r.protocolId, version: r.version, subfield: r.subfield, reaction_class: r.reactionClass, failure_category: r.failureCategory,
      metric: r.metric || null, success_threshold: lenient(r.threshold), best_test_result: bestOf(r.series, false), best_control_result: bestOf(r.series, true), n_experiments: lenient(r.nExperiments != null ? r.nExperiments : NR.totalN(r)),
      license: r.license, keywords: r.keywords || [], authors: (r.authors || []).map(a => ({ name: a.name, affiliation: a.affiliation, orcid: a.orcid || null })), data_links: r.dataLinks || [], created_at: r.createdAt, version_created_at: r.versionCreatedAt || r.createdAt
    })),
    experiments: list => list.flatMap(r => (r.experiments || []).map((e, i) => ({
      report_id: r.id, row_no: i + 1, experiment_id: e.id == null ? null : String(e.id), series: e.series == null ? null : String(e.series), is_positive_control: e.control === true || e.control === 'true',
      catalyst: e.catalyst == null ? null : String(e.catalyst), solvent: e.solvent == null ? null : String(e.solvent), temp_c: lenient(e.temp), time_h: lenient(e.time), result_pct: lenient(e.result), notes: e.notes == null ? null : String(e.notes),
      reaction_class: r.reactionClass, subfield: r.subfield, failure_category: r.failureCategory, review_status: r.status, preregistered: !!r.protocolId, license: r.license, metric: r.metric || null,
      success_threshold: lenient(r.threshold), version: r.version, created_at: r.createdAt
    }))),
    // PostgREST-style comparison of one cell with a filter value typed into a form (strings): eq neq lt lte gt gte ilike
    test(cell, op, f) {
      if (cell == null) return false;
      if (op === 'ilike') { const re = new RegExp('^' + String(f).replace(/[.+^${}()|[\]\\?]/g, '\\$&').replace(/[%*]/g, '.*') + '$', 'i'); return re.test(typeof cell === 'object' ? JSON.stringify(cell) : String(cell)); }
      let a = cell, b = f;
      if (typeof cell === 'number') b = Number(String(f).replace(',', '.')); else if (typeof cell === 'boolean') b = String(f) === 'true'; else { a = String(cell); b = String(f); }
      return { eq: a === b, neq: a !== b, lt: a < b, lte: a <= b, gt: a > b, gte: a >= b }[op] === true;
    }
  };
  // rows -> CSV / JSON Lines (nested values such as authors become JSON text in a CSV cell)
  NR.exp.rowsCsv = (rows, cols) => [cols.join(',')].concat(rows.map(r => cols.map(c => csvq(r[c] != null && typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c])).join(','))).join('\n') + '\n';
  NR.exp.jsonl = rows => rows.map(r => JSON.stringify(r)).join('\n') + '\n';

  // =============== "all experiments at a glance" plot ===============
  const W = 400, P = 8, H = 30;
  const X = v => (P + Math.max(0, Math.min(100, v)) / 100 * (W - 2 * P));
  NR.plot = r => {
    const series = r.series || [];
    const by = {};
    (r.experiments || []).forEach(e => { if (isNum(e.result)) (by[e.series] = by[e.series] || []).push(e); });
    if (!series.some(s => isNum(s.best)) && !Object.keys(by).length) return '';
    const hasDots = Object.keys(by).length > 0;
    const thr = isNum(r.threshold) ? r.threshold : null;
    const rows = series.map(s => {
      const pts = by[s.label] || [];
      let shapes = '';
      if (pts.length) {
        shapes = pts.map((e, i) => {
          const y = 15 + (((i * 0.6180339887) % 1) - 0.5) * 16, x = X(e.result);
          return s.isControl
            ? `<path class="dc" d="M${x.toFixed(1)} ${(y - 4).toFixed(1)}l4 4-4 4-4-4z"/>`
            : `<circle class="dt" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3"/>`;
        }).join('');
      } else if (isNum(s.best)) {
        shapes = `<rect class="bar${s.isControl ? ' bc' : ''}" x="${P}" y="12" width="${Math.max(2, X(s.best) - P).toFixed(1)}" height="6" rx="3"/>`;
      }
      const grid = [25, 50, 75].map(v => `<line class="grid" x1="${X(v)}" x2="${X(v)}" y1="4" y2="${H - 4}"/>`).join('');
      const tl = thr != null ? `<line class="thr" x1="${X(thr)}" x2="${X(thr)}" y1="1" y2="${H - 1}"/>` : '';
      const meta = `${esc(s.n)} exp.${s.isControl ? ' · positive control' : ''} · ${isNum(s.best) ? 'best ' + pct(s.best) + '%' : 'no numeric result'}`;
      return `<div class="strip-row${s.isControl ? ' is-control' : ''}">
        <div class="strip-label"><span class="sl-name">${esc(s.label)}</span><span class="sl-meta">${meta}</span></div>
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(s.label)}: ${esc(meta)}"><rect class="track" x="${P}" y="11" width="${W - 2 * P}" height="8" rx="4"/>${grid}${tl}${shapes}</svg>
      </div>`;
    }).join('');
    const ticks = [0, 25, 50, 75, 100].map(v => `<span style="left:${(X(v) / W * 100).toFixed(2)}%">${v}</span>`).join('');
    const hasCtrl = series.some(s => s.isControl);
    return `<figure class="strip">
      <div class="strip-title">${esc(r.metric || 'Result (%)')}</div>
      ${rows}
      <div class="strip-row axis-row"><div></div><div class="strip-axis" aria-hidden="true">${ticks}</div></div>
      <div class="legend">
        <span><svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><circle class="dt" cx="5" cy="5" r="3"/></svg> ${hasDots ? 'one experiment' : 'best result of the series'}</span>
        ${hasCtrl ? '<span><svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path class="dc" d="M5 1l4 4-4 4-4-4z"/></svg> positive-control experiment</span>' : ''}
        ${thr != null ? `<span><svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><line class="thr" x1="5" x2="5" y1="0" y2="10"/></svg> success threshold ${pct(thr)}% (set by the authors)</span>` : ''}
      </div>
      <figcaption>${hasDots ? 'Each dot is one experiment.' : 'Experiment-level data were not provided; bars show the best result per series.'} Positive controls show that the chemistry <em>can</em> work in the authors' hands.</figcaption>
    </figure>`;
  };
  NR.tiles = r => {
    const total = NR.totalN(r), bt = NR.bestTest(r), bc = NR.bestControl(r), an = r.analytics || [];
    const t = [[String(total), 'experiments', `${(r.series || []).length} series${r.timeSpan ? ' · ' + esc(r.timeSpan) : ''}`]];
    if (bt != null) t.push([pct(bt) + '%', 'best test result', r.threshold ? `target ≥ ${pct(r.threshold)}%` : 'no threshold given']);
    if (bc != null) t.push([pct(bc) + '%', 'positive control', 'the system can work']);
    t.push([String(an.length), 'analytical methods', esc(an.slice(0, 3).join(', '))]);
    return `<div class="tiles">${t.map(([b, l, s]) => `<div class="tile"><b>${b}</b><span>${l}</span><small>${s}</small></div>`).join('')}</div>`;
  };

  // =============== share card (PNG) ===============
  NR.shareCard = r => new Promise(resolve => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 630;
    const g = c.getContext('2d'), serif = "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif", sans = 'system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif';
    g.fillStyle = '#1f4e5f'; g.fillRect(0, 0, 1200, 630);
    // the logo (a document in a drawer) uses the geometry of the header mark: 32 × 32 units, scaled by k and moved to (ox, oy)
    const mark = (ox, oy, k, stroke, lw, panel) => {
      const X = v => ox + k * v, Y = v => oy + k * v;
      g.strokeStyle = stroke; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(X(10.5), Y(19)); g.lineTo(X(10.5), Y(8)); g.arcTo(X(10.5), Y(6.5), X(12), Y(6.5), 1.5 * k); g.lineTo(X(17.8), Y(6.5)); g.lineTo(X(21.5), Y(10.2)); g.lineTo(X(21.5), Y(19)); g.stroke();
      g.beginPath(); g.moveTo(X(17.8), Y(6.5)); g.lineTo(X(17.8), Y(10.2)); g.lineTo(X(21.5), Y(10.2)); g.stroke();
      g.fillStyle = panel; g.beginPath(); g.roundRect(X(6.5), Y(17.5), 19 * k, 8.5 * k, 2 * k); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(X(13.5), Y(22)); g.lineTo(X(18.5), Y(22)); g.stroke();
    };
    mark(872, -38, 9, 'rgba(255,255,255,.08)', 24, '#1f4e5f');
    // brand
    g.fillStyle = '#fff'; g.beginPath(); g.roundRect(60, 52, 48, 48, 11); g.fill();
    mark(60, 52, 1.5, '#1f4e5f', 3.3, '#fff');
    g.fillStyle = '#fff'; g.font = `700 32px ${serif}`; g.textBaseline = 'middle'; g.fillText('Open File Drawer', 124, 78);
    // status pill
    const pill = { preprint: ['#fff3d9', '#7a4800'], review: ['#e5effa', '#17487a'], peer: ['#e2f3e7', '#145a37'] }[r.status];
    const label = NR.STATUS[r.status].long + (r.protocolId ? ' · pre-registered' : '');
    g.font = `700 22px ${sans}`; const pw = g.measureText(label).width + 40;
    g.fillStyle = pill[0]; g.beginPath(); g.roundRect(60, 128, pw, 42, 21); g.fill();
    g.fillStyle = pill[1]; g.fillText(label, 80, 150);
    // title
    g.fillStyle = '#fff'; g.font = `700 48px ${serif}`; g.textBaseline = 'alphabetic';
    const words = r.title.split(/\s+/); let line = '', y = 250, lines = 0;
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (g.measureText(test).width > 1080 && line) {
        lines++;
        if (lines === 4) { line = line.replace(/[\s.,;:]+$/, '') + ' …'; break; }
        g.fillText(line, 60, y); y += 58; line = words[i];
      } else line = test;
    }
    g.fillText(line, 60, y);
    // stats
    const bt = NR.bestTest(r), bc = NR.bestControl(r);
    const stats = [[String(NR.totalN(r)), 'experiments']];
    if (bt != null) stats.push([pct(bt) + '%', 'best test result' + (r.threshold ? ` (target ≥ ${pct(r.threshold)}%)` : '')]);
    if (bc != null) stats.push([pct(bc) + '%', 'positive control']);
    let x = 60;
    stats.forEach(([n, l]) => {
      g.fillStyle = '#fff'; g.font = `700 54px ${serif}`; g.fillText(n, x, 520);
      g.fillStyle = 'rgba(255,255,255,.78)'; g.font = `400 21px ${sans}`; g.fillText(l, x, 552);
      x += Math.max(g.measureText(n).width + 90, g.measureText(l).width + 60);
    });
    g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `400 22px ${sans}`;
    const first = r.authors[0].name + (r.authors.length > 1 ? ' et al.' : '');
    g.fillText(`${first} · ${r.id} · ${NR.fmtDate(r.createdAt)}`, 60, 604);
    c.toBlob(resolve, 'image/png');
  });
})();
