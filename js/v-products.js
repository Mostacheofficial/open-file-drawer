// Products: the overview (#/products), Open File Drawer Data (#/data: record format, API explorer, downloads, access request) and the
// Enterprise page (#/enterprise). The private workspace itself lives in v-workspace.js.
(function () {
  'use strict';
  const NR = window.NR, DB = NR.DB, Auth = window.NR_AUTH, { $, $$, esc } = NR, F = NR.f, SVG = NR.SVG;
  const icon = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    book: icon('<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z"/>'),
    table: icon('<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 10h17M9.5 5v14"/>'),
    lock: icon('<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>')
  };
  NR.ICON = ICON;
  const TYPES = ['University library / research office', 'Pharma / chemical industry', 'CRO', 'AI / software company', 'Funder', 'Other'];

  // ======================================================================================================
  // overview
  // ======================================================================================================
  NR.route(/^#\/products$/, async () => {
    NR.setTitle('Products');
    const live = NR.backend === 'supabase', st = { research: live ? 'Live · pilot' : 'Prototype', data: live ? 'Open tier live · commercial on request' : 'Prototype · open tier', enterprise: live ? 'Pilot workspaces on request' : 'Prototype · pilot workspaces on request' };
    NR.setMain(`<div class="wrap page" style="max-width:1080px">
      <div class="eyebrow">Products</div>
      <h1>One archive, three ways to use it</h1>
      <p class="lead muted" style="font-size:1.15rem;max-width:760px">Research stays free and open. Data and Enterprise are services on top: structured access for machines, and a private place for everything that must not be public.</p>

      <div class="products">
        <article class="pcard">
          <div class="pcard-top">${ICON.book}<span class="pstatus ${live ? 'ok' : ''}">${st.research}</span></div>
          <h2>Open File Drawer <span class="pname">Research</span></h2>
          <p class="muted">The free public platform for negative scientific results. Publish a complete project, get a citable, clearly labelled report, and find out what others have already tried.</p>
          <ul class="ticks"><li>Archive, Registry and Wanted board</li><li>Review status on every report</li><li>Free to read, free to publish</li></ul>
          <div class="btnrow"><a class="btn" href="#/archive">Open the archive</a><a class="btn secondary" href="#/submit">Submit a report</a></div>
        </article>
        <article class="pcard">
          <div class="pcard-top">${ICON.table}<span class="pstatus ${live ? 'ok' : ''}">${st.data}</span></div>
          <h2>Open File Drawer <span class="pname">Data</span></h2>
          <p class="muted">A structured database and API for scientific AI, pharma, chemistry and research tools. Every public report as flat tables, one row per experiment, with conditions, outcome and context.</p>
          <ul class="ticks"><li>Read-only API, CSV and JSON Lines</li><li>Public reports only, licence on every record</li><li>Commercial tier: licensing, support, curated data</li></ul>
          <div class="btnrow"><a class="btn" href="#/data">Explore the data</a></div>
        </article>
        <article class="pcard">
          <div class="pcard-top">${ICON.lock}<span class="pstatus pilot">${st.enterprise}</span></div>
          <h2>Open File Drawer <span class="pname">Enterprise</span></h2>
          <p class="muted">A private knowledge base for R&amp;D organisations, including the failed attempts that are confidential. Searchable by everyone in your organisation, invisible to everyone else.</p>
          <ul class="ticks"><li>Confidential entries, access control, change log</li><li>Internal dead-end check, private and public</li><li>Release to the public archive only when you decide</li></ul>
          <div class="btnrow"><a class="btn" href="#/enterprise">See Enterprise</a></div>
        </article>
      </div>

      <section class="section">
        <h2>How the three fit together</h2>
        <div class="flow" role="img" aria-label="Enterprise entries stay private. Only when an author decides, an entry can become a public report in Research. Data is built from public reports only.">
          <div class="flow-step"><strong>Enterprise</strong><span>private, confidential</span></div>
          <div class="flow-arrow"><span>only if an author submits it</span>→</div>
          <div class="flow-step"><strong>Research</strong><span>public, open, labelled</span></div>
          <div class="flow-arrow"><span>public reports only</span>→</div>
          <div class="flow-step"><strong>Data</strong><span>flat tables and API</span></div>
        </div>
        <p class="muted" style="max-width:760px">Nothing moves between the products by itself. A confidential entry becomes public only when its authors submit it as a report, with the usual declarations. Data is built from public reports only, never from Enterprise workspaces.</p>
      </section>

      <section class="section">
        <h2>Compared</h2>
        <div class="table-wrap"><table class="compare-table">
          <thead><tr><th></th><th>Research</th><th>Data</th><th>Enterprise</th></tr></thead>
          <tbody>
            <tr><th>For</th><td>Researchers, groups, reviewers</td><td>AI and software teams, informatics groups, research tools</td><td>R&amp;D organisations in pharma, chemicals, CROs</td></tr>
            <tr><th>Content</th><td>Public reports of verified authors</td><td>The same public reports, as tables</td><td>Your organisation's own entries</td></tr>
            <tr><th>Who can read it</th><td>Everyone</td><td>Open tier: everyone. Commercial tier: licensed customers</td><td>Members of your organisation only</td></tr>
            <tr><th>How</th><td>Website, exports per report</td><td>REST API, CSV, JSON Lines</td><td>Website; API and integrations planned</td></tr>
            <tr><th>Cost</th><td>Free</td><td>Open tier free, commercial on request</td><td>On request</td></tr>
            <tr><th>Status</th><td>${live ? 'Live (pilot)' : 'Prototype'}</td><td>${live ? 'Open tier live' : 'Prototype'}</td><td>${live ? 'Pilot workspaces' : 'Prototype'}</td></tr>
          </tbody></table></div>
      </section>

      <section class="section">
        <h2>Questions we get</h2>
        <div class="faq">
          <details open><summary>Will my confidential entries ever end up in Research or Data?</summary><p>No. Enterprise entries are readable by the members of your organisation only, and the database enforces it row by row. The public archive, the API and every export are built from public reports. An entry can become a public report only if one of your authors submits it through the normal flow, which asks them to confirm that nothing confidential remains.</p></details>
          <details><summary>Is the science behind a paywall?</summary><p>No. Public reports and their raw data stay open under the licence the authors chose. What Data and Enterprise charge for is service: structured and supported access, integration, and a private place to store what cannot be public.</p></details>
          <details><summary>What can you not do yet?</summary><p>API keys with individual limits, single sign-on, access logs for reading, integrations with electronic lab notebooks and customer-managed encryption are planned, not built. Each product page says what exists today.</p></details>
          <details><summary>And universities, funders and others?</summary><p>Write to us below. Institutional agreements that cover publication fees, and overviews of an institution's output, are being discussed with the first partners.</p></details>
        </div>
      </section>

      <section class="section">
        <h2>Tell us what you would need</h2>
        <form class="card" id="of" novalidate>
          <div class="grid c2">${F.text('Name', 'name')}${F.text('Work e-mail', 'email', { type: 'email' })}</div>
          <div class="grid c2">${F.text('Organisation', 'institution')}${F.select('Type', 'role', TYPES)}</div>
          ${F.select('How far would you go?', 'intent', [['info', 'Keep me informed'], ['pilot', 'I would like to join a pilot'], ['commit', 'We would consider a paid subscription — happy to sign a letter of intent']])}
          ${F.select('Indicative yearly budget (optional)', 'budget', ['< 5k €', '5–15k €', '15–50k €', '> 50k €', 'Don’t know yet'], { hint: 'Only to size the offer — not binding.' })}
          ${F.area('What problem would you want this to solve?', 'message', { rows: 4 })}
          ${NR.joinForm.consent()}
          <button class="btn" type="submit">Send</button>
        </form>
      </section>
    </div>`);
    NR.joinForm.wire($('#of'), 'org', ['name', 'email', 'institution', 'role', 'intent'], v => ({ role: v('role'), intent: v('intent'), budget: v('budget') }));
  });

  // ======================================================================================================
  // Data
  // ======================================================================================================
  const DOCS = {
    api_experiments: [
      ['report_id', 'text', 'ID of the report, e.g. NR-2026-0001'], ['row_no', 'integer', 'position in the report’s experiment table'], ['experiment_id', 'text', 'the authors’ own ID of the experiment'],
      ['series', 'text', 'group of experiments, e.g. a ligand screen'], ['is_positive_control', 'boolean', 'true if the experiment shows that the system can work'], ['catalyst', 'text', 'catalyst or reagents as reported'], ['solvent', 'text', 'solvent as reported'],
      ['temp_c', 'number', 'temperature in °C (empty if the report gives a range or text)'], ['time_h', 'number', 'time in hours (empty if a range or text)'], ['result_pct', 'number', 'result in %, see metric (0 means nothing was found)'], ['notes', 'text', 'free note of the authors'],
      ['reaction_class', 'text', 'reaction class of the report'], ['subfield', 'text', 'subfield of the report'], ['failure_category', 'text', 'why it failed, as classified by the authors'], ['review_status', 'text', 'preprint, review or peer'],
      ['preregistered', 'boolean', 'the plan was registered before the experiments'], ['license', 'text', 'licence chosen by the authors'], ['metric', 'text', 'what result_pct measures'], ['success_threshold', 'number', 'the result the authors defined as success'],
      ['version', 'integer', 'version of the report'], ['created_at', 'timestamp', 'when the report was submitted']
    ],
    api_reports: [
      ['report_id', 'text', 'ID of the report'], ['title', 'text', 'title'], ['abstract', 'text', 'abstract'], ['review_status', 'text', 'preprint, review or peer'], ['preregistered', 'boolean', 'the plan was registered before the experiments'],
      ['version', 'integer', 'current version'], ['subfield', 'text', 'subfield'], ['reaction_class', 'text', 'reaction class'], ['failure_category', 'text', 'why it failed, as classified by the authors'], ['metric', 'text', 'what the results measure'],
      ['success_threshold', 'number', 'the result the authors defined as success'], ['best_test_result', 'number', 'best result in the test series'], ['best_control_result', 'number', 'best result in a positive control'], ['n_experiments', 'integer', 'number of experiments'],
      ['license', 'text', 'licence chosen by the authors'], ['keywords', 'json', 'list of keywords'], ['authors', 'json', 'list of {name, affiliation, orcid}'], ['data_links', 'json', 'links to the raw data'], ['created_at', 'timestamp', 'when it was submitted'], ['version_created_at', 'timestamp', 'when the current version was submitted']
    ]
  };
  const cell = v => (v == null ? '<span class="muted">NULL</span>' : typeof v === 'object' ? esc(JSON.stringify(v).slice(0, 70)) + (JSON.stringify(v).length > 70 ? '…' : '') : typeof v === 'string' && v.length > 70 ? `<span title="${esc(v)}">${esc(v.slice(0, 70))}…</span>` : esc(String(v)));
  const today = () => new Date().toISOString().slice(0, 10);
  // all rows of a view, page by page (the server caps one response, 1000 rows by default)
  async function fetchAll(view, onPage) {
    const out = []; let offset = 0;
    for (;;) {
      const page = await DB.dataApi.query(view, { limit: 1000, offset }); out.push(...page); offset += page.length; if (onPage) onPage(out.length);
      if (page.length < 1000 || out.length >= 200000) return out;
    }
  }

  NR.route(/^#\/data$/, async () => {
    NR.setTitle('Data');
    const reports = (await DB.reports.list()).filter(NR.isPublic);
    let nReports = reports.length, nExp = reports.reduce((a, r) => a + NR.totalN(r), 0);
    try { [nReports, nExp] = await Promise.all([DB.dataApi.count('api_reports'), DB.dataApi.count('api_experiments')]); } catch (e) { console.error(e); }
    let sample = null; try { sample = (await DB.dataApi.query('api_experiments', { limit: 1 }))[0] || null; } catch (e) { console.error(e); }
    const remote = NR.backend === 'supabase', base = (NR.cfg.supabaseUrl || 'https://YOUR-PROJECT.supabase.co').replace(/\/$/, ''), key = remote ? NR.cfg.supabaseAnonKey : 'YOUR_PUBLIC_KEY';
    NR.setMain(`<div class="wrap page" style="max-width:1000px">
      <div class="eyebrow">Open File Drawer Data</div>
      <h1>Negative results as structured data</h1>
      <p class="lead muted" style="font-size:1.15rem;max-width:760px">Every public report becomes rows: one per experiment, with the conditions, the outcome and the context needed to use it. Built for scientific AI, pharma and chemistry informatics, and research tools.</p>
      <div class="stats" aria-label="Size of the open data set"><div class="stat"><b>${nReports}</b><span>public reports</span></div><div class="stat"><b>${nExp.toLocaleString('en-GB')}</b><span>experiments as rows</span></div><div class="stat"><b>2</b><span>tables: reports and experiments</span></div><div class="stat"><b>${[...new Set(reports.map(r => r.license))].length}</b><span>licences, stated on every record</span></div></div>
      ${remote ? '' : '<div class="demo-box"><strong>Prototype:</strong> the explorer below runs in your browser on the fictional demo reports. On the live site the same queries go to the database through its REST API.</div>'}

      <section class="section"><h2>What a record looks like</h2>
        <p class="muted">The experiments table has one row per experiment. Numbers are numbers, empty values are NULL, and every row carries the facts of its report: reaction class, failure category, review status, licence.</p>
        <pre class="code" tabindex="0">${esc(sample ? JSON.stringify(sample, null, 2) : '(no data yet)')}</pre>
        <details class="cols"><summary>All columns</summary>
          ${Object.entries(DOCS).map(([v, rows]) => `<h3 class="mono" style="margin-top:14px">${v}</h3><div class="table-wrap"><table class="tbl compact"><thead><tr><th>Column</th><th>Type</th><th>Meaning</th></tr></thead><tbody>${rows.map(([c, t, d]) => `<tr><td class="mono">${c}</td><td class="muted">${t}</td><td>${esc(d)}</td></tr>`).join('')}</tbody></table></div>`).join('')}
        </details>
      </section>

      <section class="section"><h2>Try the API</h2>
        <p class="muted">Pick a table and some filters, and run the query. The request below is the one your code would send.</p>
        <form class="explorer card" id="xf">
          <div class="grid c3">
            <div class="field"><label for="x-view">Table</label><select id="x-view"><option value="api_experiments">Experiments (one row per experiment)</option><option value="api_reports">Reports (one row per report)</option></select></div>
            <div class="field"><label for="x-reaction">Reaction class</label><select id="x-reaction"><option value="">Any</option>${NR.REACTIONS.map(v => `<option>${esc(v)}</option>`).join('')}</select></div>
            <div class="field"><label for="x-cat">Failure category</label><select id="x-cat"><option value="">Any</option>${Object.entries(NR.CATEGORIES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
          </div>
          <div class="grid c3">
            <div class="field"><label for="x-status">Review status</label><select id="x-status"><option value="">Any</option><option value="preprint">Preprint</option><option value="review">In review</option><option value="peer">Peer reviewed</option></select></div>
            <div class="field" data-only="api_experiments"><label for="x-below">Result below (%)</label><input type="number" id="x-below" step="any" placeholder="e.g. 5"></div>
            <div class="field" data-only="api_experiments"><label for="x-control">Positive controls</label><select id="x-control"><option value="">Include</option><option value="exclude">Exclude</option><option value="only">Only controls</option></select></div>
          </div>
          <div class="grid c3">
            <div class="field"><label for="x-text" id="x-text-l">Catalyst contains</label><input type="search" id="x-text" placeholder="e.g. Pd, Ni, photocatalyst"></div>
            <div class="field"><label for="x-order">Order</label><select id="x-order"></select></div>
            <div class="field"><label for="x-limit">Rows</label><select id="x-limit"><option>10</option><option selected>25</option><option>50</option><option>100</option></select></div>
          </div>
          <button class="btn" type="submit">Run query</button>
        </form>
        <div id="x-out" aria-live="polite"></div>
      </section>

      <section class="section"><h2>Bulk download</h2>
        <p class="muted">The complete public record as flat files. Each row names its licence; the licence of a report applies to its rows, please attribute the authors.</p>
        <div class="btnrow">
          <button class="btn secondary" data-dl="api_experiments:csv">Experiments (CSV)</button><button class="btn secondary" data-dl="api_experiments:jsonl">Experiments (JSON Lines)</button>
          <button class="btn secondary" data-dl="api_reports:csv">Reports (CSV)</button><button class="btn secondary" data-dl="api_reports:jsonl">Reports (JSON Lines)</button>
        </div>
        <p class="muted small" id="dl-info" aria-live="polite"></p>
      </section>

      <section class="section"><h2>Open and commercial</h2>
        <div class="cards3 two">
          <div class="card"><span class="pstatus ${remote ? 'ok' : ''}">${remote ? 'Live' : 'Prototype'}</span><h3 style="margin-top:10px">Open</h3><ul class="ticks"><li>Read-only REST API over HTTPS with filters, sorting and paging</li><li>CSV and JSON Lines downloads of the whole public record</li><li>The same public key the website uses, fair use</li></ul></div>
          <div class="card"><span class="pstatus pilot">On request</span><h3 style="margin-top:10px">Commercial</h3><ul class="ticks"><li>Support, service levels and individual keys with their own limits <span class="muted">(planned)</span></li><li>Versioned snapshots with persistent identifiers <span class="muted">(planned)</span></li><li>Curated and normalised fields, a change feed, custom exports <span class="muted">(planned)</span></li></ul></div>
        </div>
        <p class="muted small" style="margin-top:12px">The science stays open: public reports and their raw data remain under the authors’ licence. The commercial tier is about service and integration, not about locking data.</p>
      </section>

      <section class="section"><h2>Who uses it</h2>
        <div class="cards3">
          <div class="card"><h3>Scientific AI</h3><p class="muted">Models trained on published successes miss half the picture. Negative examples with consistent metadata make reaction-outcome models honest.</p></div>
          <div class="card"><h3>Pharma and chemistry informatics</h3><p class="muted">Check a planned route against what is known to fail, and feed the knowledge into internal tools.</p></div>
          <div class="card"><h3>Research tools</h3><p class="muted">Show a warning in your ELN or search tool when a planned reaction has a documented dead end.</p></div>
        </div>
      </section>

      <section class="section"><h2>Ask for access or a licence</h2>
        <form class="card" id="df" novalidate>
          <div class="grid c2">${F.text('Name', 'name')}${F.text('Work e-mail', 'email', { type: 'email' })}</div>
          <div class="grid c2">${F.text('Organisation', 'institution')}${F.select('What are you building?', 'useCase', ['Model training', 'Reaction prediction', 'ELN or tool integration', 'Benchmarking or due diligence', 'Research', 'Other'])}</div>
          ${F.select('How would you use the data?', 'volume', ['Occasional queries', 'Regular API use', 'Bulk snapshot', 'Bulk snapshot plus updates'])}
          ${F.area('Anything else we should know?', 'message', { rows: 4 })}
          ${NR.joinForm.consent()}
          <button class="btn" type="submit">Send</button>
        </form>
      </section>
    </div>`);

    // ---- the explorer ----
    const ORDERS = { api_experiments: [['', 'Default'], ['result_pct:asc', 'Result, lowest first'], ['result_pct:desc', 'Result, highest first']], api_reports: [['created_at:desc', 'Newest first'], ['n_experiments:desc', 'Most experiments first'], ['best_test_result:asc', 'Lowest best result first']] };
    const syncView = () => {
      const v = $('#x-view').value;
      $$('[data-only]').forEach(el => { el.hidden = el.dataset.only !== v; });
      $('#x-text-l').textContent = v === 'api_experiments' ? 'Catalyst contains' : 'Title contains';
      $('#x-text').placeholder = v === 'api_experiments' ? 'e.g. Pd, Ni, photocatalyst' : 'e.g. amination, MOF';
      $('#x-order').innerHTML = ORDERS[v].map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('');
    };
    const buildQuery = () => {
      const v = $('#x-view').value, filters = [], add = (c, op, val) => { if (val !== '' && val != null) filters.push([c, op, val]); };
      add('reaction_class', 'eq', $('#x-reaction').value); add('failure_category', 'eq', $('#x-cat').value); add('review_status', 'eq', $('#x-status').value);
      const text = $('#x-text').value.trim();
      if (v === 'api_experiments') {
        add('result_pct', 'lt', $('#x-below').value.trim()); const c = $('#x-control').value; if (c === 'only') add('is_positive_control', 'eq', 'true'); if (c === 'exclude') add('is_positive_control', 'eq', 'false');
        if (text) add('catalyst', 'ilike', `*${text}*`);
      } else if (text) add('title', 'ilike', `*${text}*`);
      const o = $('#x-order').value;
      return { view: v, filters, order: o ? o.split(':') : null, limit: +$('#x-limit').value, offset: 0 };
    };
    const restUrl = q => `${base}/rest/v1/${q.view}?select=*${q.filters.map(([c, op, val]) => `&${c}=${op}.${encodeURIComponent(val)}`).join('')}${q.order ? `&order=${q.order[0]}.${q.order[1]}` : ''}&limit=${q.limit}`;
    const run = async () => {
      const q = buildQuery(), out = $('#x-out'), url = restUrl(q), curl = `curl '${url}' \\\n  -H 'apikey: ${key}' \\\n  -H 'Authorization: Bearer ${key}'`;
      out.innerHTML = '<p class="muted">Running…</p>';
      let rows; try { rows = await DB.dataApi.query(q.view, q); } catch (e) { out.innerHTML = `<div class="notice pre"><p>${esc(e.message)}</p></div>`; return; }
      const cols = rows.length ? Object.keys(rows[0]) : DOCS[q.view].map(d => d[0]);
      out.innerHTML = `<h3 style="margin-top:20px">Request</h3><pre class="code" tabindex="0">${esc(curl)}</pre>
        <div class="btnrow" style="margin:6px 0 14px"><button class="btn secondary sm" id="x-copy" type="button">Copy request</button>${rows.length ? '<button class="btn secondary sm" id="x-csv" type="button">Download these rows (CSV)</button><button class="btn secondary sm" id="x-json" type="button">JSON</button>' : ''}</div>
        <h3>Response <span class="muted small">· ${rows.length} row${rows.length === 1 ? '' : 's'}${rows.length === q.limit ? ' (limit reached)' : ''}</span></h3>
        ${rows.length ? `<div class="table-wrap"><table class="tbl compact xtable"><thead><tr>${cols.map(c => `<th class="mono">${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${c === 'report_id' ? `<a href="#/report/${esc(r[c])}">${esc(r[c])}</a>` : cell(r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<div class="empty">No rows match. Try fewer filters.</div>'}`;
      $('#x-copy').onclick = () => NR.copy(curl);
      if (rows.length) {
        $('#x-csv').onclick = () => NR.exp.download(`open-file-drawer-${q.view.replace('api_', '')}-query.csv`, NR.exp.rowsCsv(rows, cols), 'text/csv;charset=utf-8');
        $('#x-json').onclick = () => NR.exp.download(`open-file-drawer-${q.view.replace('api_', '')}-query.json`, JSON.stringify(rows, null, 2), 'application/json');
      }
    };
    $('#x-view').onchange = syncView; syncView();
    $('#xf').onsubmit = e => { e.preventDefault(); run(); };

    // ---- bulk download ----
    $$('[data-dl]').forEach(b => {
      b.onclick = async () => {
        const [view, fmt] = b.dataset.dl.split(':'), info = $('#dl-info'); b.disabled = true; info.textContent = 'Preparing…';
        try {
          const rows = await fetchAll(view, n => { info.textContent = `Preparing… ${n.toLocaleString('en-GB')} rows`; });
          const cols = view === 'api_experiments' ? NR.dataRows.EXPERIMENT_COLUMNS : NR.dataRows.REPORT_COLUMNS, name = `open-file-drawer-${view.replace('api_', '')}-${today()}.${fmt === 'csv' ? 'csv' : 'jsonl'}`;
          NR.exp.download(name, fmt === 'csv' ? NR.exp.rowsCsv(rows, cols) : NR.exp.jsonl(rows), fmt === 'csv' ? 'text/csv;charset=utf-8' : 'application/x-ndjson');
          info.textContent = `${name}: ${rows.length.toLocaleString('en-GB')} rows, snapshot of ${today()}.`;
        } catch (e) { info.textContent = e.message; }
        b.disabled = false;
      };
    });
    NR.joinForm.wire($('#df'), 'data', ['name', 'email', 'institution', 'useCase', 'volume'], v => ({ useCase: v('useCase'), volume: v('volume') }));
  });

  // ======================================================================================================
  // Enterprise
  // ======================================================================================================
  NR.route(/^#\/enterprise$/, () => {
    NR.setTitle('Enterprise');
    const local = NR.backend === 'local';
    NR.setMain(`<div class="wrap page" style="max-width:1000px">
      <div class="eyebrow">Open File Drawer Enterprise</div>
      <h1>Failed experiments, kept — not lost when people leave</h1>
      <p class="lead muted" style="font-size:1.15rem;max-width:760px">A private knowledge base for R&amp;D organisations. Capture the attempts that did not work, including the confidential ones, in a structure your colleagues can search before they repeat them.</p>
      <div class="btnrow" style="margin-bottom:8px"><a class="btn" href="#enterprise-form" id="to-form">Request a pilot workspace</a>${local ? '<button class="btn secondary" id="try-ws" type="button">Try the demo workspace</button>' : '<a class="btn secondary" href="#/workspace">Open your workspace</a>'}</div>

      <section class="section"><h2>How it works</h2>
        <div class="steps">
          <div class="step"><span class="num">1</span><h3>Capture</h3><p class="muted">A short structured form: goal, approach, outcome, why it failed, what to do instead. Add the experiment table from your spreadsheet or ELN export if you have one.</p></div>
          <div class="step"><span class="num">2</span><h3>Search</h3><p class="muted">Before starting a project, run the dead-end check across your private entries and the public archive in one go.</p></div>
          <div class="step"><span class="num">3</span><h3>Decide</h3><p class="muted">Keep an entry private for good, or release it to the public archive as a report. That is your decision, entry by entry.</p></div>
        </div>
      </section>

      <section class="section"><h2>Confidential by design</h2>
        <div class="cards3 two">
          <div class="card"><h3>What the database enforces</h3><ul class="ticks"><li>Entries are readable by the members of your organisation only: not by other organisations, not by visitors, not by Open File Drawer staff accounts.</li><li>Staff set up your organisation and its first administrator. After that you manage your own people.</li><li>Confidential entries never feed the public archive, the API or any export unless you release them.</li><li>Every change is written to a log that your administrators can read.</li></ul></div>
          <div class="card"><h3>What you should know</h3><ul class="ticks warn"><li>The platform operator can technically access the database. There is no customer-managed encryption yet.</li><li>Reading is not logged yet, only changes.</li><li>Members sign in with a one-time code sent to their work e-mail; single sign-on is planned.</li><li>This is a pilot, not a certified product. Talk to us about your security and data processing requirements.</li></ul></div>
        </div>
      </section>

      <section class="section"><h2>What the pilot includes</h2>
        <div class="cards3 two">
          <div class="card"><span class="pstatus ok">Available</span><ul class="ticks" style="margin-top:10px"><li>A private workspace for your organisation, invitation only</li><li>Entries with goal, approach, outcome, failure category, learnings and an optional experiment table</li><li>Internal dead-end check across private entries and the public archive</li><li>Roles: administrators and members</li><li>Release to the public archive through the normal submit flow</li></ul></div>
          <div class="card"><span class="pstatus pilot">Planned</span><ul class="ticks" style="margin-top:10px"><li>Single sign-on (SAML or OIDC)</li><li>Access log for reading, and exports for audits</li><li>Import from electronic lab notebooks, API access to your own workspace</li><li>Dedicated instance, EU-only hosting options, customer-managed keys</li><li>Security documentation and a data processing agreement</li></ul></div>
        </div>
      </section>

      <section class="section" id="enterprise-form"><h2>Request a pilot workspace</h2>
        <form class="card" id="ef" novalidate>
          <div class="grid c2">${F.text('Name', 'name')}${F.text('Work e-mail', 'email', { type: 'email' })}</div>
          <div class="grid c2">${F.text('Organisation', 'institution')}${F.select('Type', 'role', ['Pharma / chemical industry', 'CRO', 'Biotech', 'Research institute', 'Other'])}</div>
          <div class="grid c2">${F.select('Team size', 'teamSize', ['< 20', '20–50', '50–200', '> 200'])}${F.select('Most important for you', 'needs', ['Keeping confidential failures searchable', 'A search before starting work', 'Integration with our ELN', 'Single sign-on', 'Evidence for audits and IP', 'Other'])}</div>
          ${F.area('What would you want to keep from being lost?', 'message', { rows: 4 })}
          ${NR.joinForm.consent()}
          <button class="btn" type="submit">Send</button>
        </form>
      </section>
    </div>`);
    $('#to-form').onclick = e => { e.preventDefault(); $('#enterprise-form').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    const tw = $('#try-ws');
    if (tw) tw.onclick = async () => { Auth.signInDemoMember(); await NR.refreshOrgs(); NR.renderNav(); NR.toast('Signed in as a member of the demo organisation'); location.hash = '#/workspace'; };
    NR.joinForm.wire($('#ef'), 'enterprise', ['name', 'email', 'institution', 'role', 'teamSize', 'needs'], v => ({ role: v('role'), teamSize: v('teamSize'), needs: v('needs') }));
  });
})();
