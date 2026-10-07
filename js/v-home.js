// Home + archive (including the "dead-end check" search).
(function () {
  'use strict';
  const NR = window.NR, DB = NR.DB, { $, $$, esc } = NR;

  // ---------- home ----------
  NR.route(/^#?\/?$/, async () => {
    NR.setTitle('');
    const [reps, protos, wanted, meta] = await Promise.all([DB.reports.list(), DB.protocols.list(), DB.wanted.list(), NR.loadMeta()]);
    const pub = reps.filter(NR.isPublic).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const exps = pub.reduce((a, r) => a + NR.totalN(r), 0);
    const peer = pub.filter(r => r.status === 'peer').length;
    const prereg = pub.filter(r => r.protocolId).length;
    const f = NR.cfg.features || {};
    const topWanted = wanted.filter(w => w.status !== 'withdrawn').sort((a, b) => NR.meTooCount(b) - NR.meTooCount(a)).slice(0, 3);
    const openProtos = protos.filter(p => p.status !== 'withdrawn').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 2);

    NR.setMain(`
    <div class="wrap">
      <section class="hero">
        <div class="eyebrow">Chemistry · Null results · Open archive</div>
        <h1>Well-designed chemistry that didn't work is still science.</h1>
        <p class="lead">Open File Drawer is an open archive for complete research projects whose hypothesis was not confirmed — documented with controls, analytics and data, so other groups don't spend months repeating them.</p>
        <form class="deadend" id="check" role="search">
          <label for="check-q">Dead-end check <span class="muted">— has someone already tried it?</span></label>
          <div class="de-row"><input type="search" id="check-q" placeholder="e.g. C–H arylation of aliphatic amines, Zr MOF, photoredox alkynylation" autocomplete="off"><button class="btn" type="submit">Check</button></div>
          <div class="chip-links"><span class="muted small">Try:</span>
            ${['C–H activation', 'photoredox', 'cross-coupling', 'MOF', 'organocatalysis'].map(t => `<a href="#/archive?q=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}
          </div>
        </form>
        <div class="actions">
          <a class="btn" href="#/submit">Submit a report</a>
          <a class="btn secondary" href="#/archive">Browse the archive</a>
        </div>
      </section>

      <section class="foreword" aria-labelledby="fw-title">
        <h2 class="eyebrow fw-title" id="fw-title">Foreword</h2>
        <div>
          <p>In 1979 the psychologist Robert Rosenthal named the <em>file drawer problem</em>: studies that find nothing stay in the drawer, so the published record shows mostly what worked.</p>
          <p>Chemistry has its drawers too — reactions that gave nothing, routes that ended in a dead end, catalysts that never turned over. Few are written up. The next group repeats them, and models learn from a record skewed toward success.</p>
          <p>Open File Drawer opens them. Every report is a complete project — design, controls, data — with a verified author and a label that says how far it has been reviewed. Free to read, searchable, citable.</p>
          <p class="refs">Sources: Rosenthal (1979), <i>Psychological Bulletin</i> 86, 638–641, <a href="https://doi.org/10.1037/0033-2909.86.3.638" target="_blank" rel="noopener">doi:10.1037/0033-2909.86.3.638</a>. Strieth-Kalthoff et al. (2022), <i>Angew. Chem. Int. Ed.</i> 61, e202204647, <a href="https://doi.org/10.1002/anie.202204647" target="_blank" rel="noopener">doi:10.1002/anie.202204647</a>.</p>
        </div>
      </section>

      <div class="stats" aria-label="Archive statistics">
        <div class="stat"><b>${pub.length}</b><span>reports</span></div>
        <div class="stat"><b>${exps.toLocaleString('en-GB')}</b><span>documented experiments</span></div>
        <div class="stat"><b>${peer}</b><span>peer reviewed</span></div>
        <div class="stat"><b>${prereg}</b><span>pre-registered</span></div>
      </div>

      <section class="section">
        <div class="section-head"><h2>From a closed project to a citable report</h2><a href="#/authors">Author guide →</a></div>
        <div class="steps">
          <div class="step"><span class="num">1</span><h3>Bring your data</h3><p class="muted">Upload the experiment table from your ELN or spreadsheet. We group it into series and draw the overview for you.</p></div>
          <div class="step"><span class="num">2</span><h3>Your group leader confirms</h3><p class="muted">Identity via ORCID or university e-mail. The report goes live only after the group leader agrees — no scooping, no surprises.</p></div>
          <div class="step"><span class="num">3</span><h3>Get a citable report</h3><p class="muted">Published as a clearly labelled preprint with a stable ID and BibTeX/RIS. Request peer review whenever you are ready.</p></div>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>Every report carries its review status</h2><a href="#/about">How labels work →</a></div>
        <div class="cards3">
          <div class="card"><div style="margin-bottom:10px">${NR.badge('preprint')}</div><h3>Open to verified authors</h3><p class="muted">Anyone with a verified ORCID iD or academic e-mail can publish a structured report. It is clearly marked as not peer reviewed.</p></div>
          <div class="card"><div style="margin-bottom:10px">${NR.badge('review')}</div><h3>Editor + two reviewers</h3><p class="muted">Authors can request review. An editor assigns two independent reviewers; the report is visibly “in review” meanwhile.</p></div>
          <div class="card"><div style="margin-bottom:10px">${NR.badge('peer')}</div><h3>Accepted after review</h3><p class="muted">Reports that pass get the peer-reviewed label and, in the journal phase, a DOI and long-term archiving.</p></div>
        </div>
        <p class="muted small" style="margin-top:14px">Beyond the formal labels, verified researchers can <strong>confirm or contradict</strong> any report — independent confirmations are shown on the report card.</p>
      </section>

      <section class="section">
        <div class="section-head"><h2>Latest reports</h2><a href="#/archive">All reports →</a></div>
        <div class="rlist">${pub.slice(0, 4).map(r => NR.reportCard(r, meta)).join('')}</div>
      </section>

      <div class="split section">
        <section data-feature="registry">
          <div class="section-head"><h2>Plan it before you run it</h2><a href="#/registry">Registry →</a></div>
          <p class="muted">Register a time-stamped, fingerprinted plan <em>before</em> the experiments. Get it reviewed in principle, and the outcome report is published whatever the result — marked as pre-registered.</p>
          <div class="rlist">${openProtos.map(NR.protocolCard).join('')}</div>
        </section>
        <section data-feature="wanted">
          <div class="section-head"><h2>Most wanted null results</h2><a href="#/wanted">Wanted →</a></div>
          <p class="muted">What do chemists need to know doesn't work? Add “me too” or share what you have.</p>
          <div class="rlist">${topWanted.map(w => `<article class="rcard"><div class="meta"><span class="tag">${esc(w.reactionClass)}</span>${w.status === 'answered' ? '<span class="chip chip-ok">' + NR.SVG.check + 'answered</span>' : ''}<span class="muted">${NR.meTooCount(w)} × me too</span></div><h3><a href="#/wanted">${esc(w.title)}</a></h3></article>`).join('')}</div>
        </section>
      </div>

      <section class="section" data-feature="products">
        <div class="section-head"><h2>Three ways to use Open File Drawer</h2><a href="#/products">All products →</a></div>
        <div class="cards3">
          <div class="card"><div class="pcard-top">${NR.ICON.book}</div><h3>Research</h3><p class="muted">Free and open. Publish a complete project and find out what others have already tried.</p><a href="#/archive">Open the archive →</a></div>
          <div class="card"><div class="pcard-top">${NR.ICON.table}</div><h3>Data</h3><p class="muted">The public record as structured tables and an API, for scientific AI, pharma and research tools.</p><a href="#/data">Explore the data →</a></div>
          <div class="card"><div class="pcard-top">${NR.ICON.lock}</div><h3>Enterprise</h3><p class="muted">A private knowledge base for R&amp;D organisations, including their confidential failed attempts.</p><a href="#/enterprise">See Enterprise →</a></div>
        </div>
      </section>

      <section class="section band">
        <div><h2>Help build it</h2><p class="muted" style="margin:0">We are in the pilot phase and looking for research groups, reviewers and partners.</p></div>
        <div class="band-actions">
          <a class="btn" href="#/pilot">Join the pilot (research groups)</a>
          <a class="btn secondary" href="#/reviewers">Become a reviewer or editor</a>
          <a class="btn secondary" href="#/products" data-feature="products">Products</a>
        </div>
      </section>
    </div>`);
    NR.applyFeatures && NR.applyFeatures();
    $('#check').onsubmit = e => {
      e.preventDefault();
      const q = $('#check-q').value.trim();
      location.hash = '#/archive' + (q ? '?q=' + encodeURIComponent(q) : '');
    };
  });

  // ---------- archive ----------
  // The filter state lives in the URL (so Back works and filtered views can be shared); it is rebuilt on every visit.
  const ALL = ['preprint', 'review', 'peer'];
  const state = {};
  const readState = () => {
    const p = NR.query();
    const st = (p.get('status') || '').split(',').filter(s => ALL.includes(s));
    Object.assign(state, {
      q: p.get('q') || '', status: new Set(st.length ? st : ALL), cat: p.get('cat') || '', sub: p.get('sub') || '', reaction: p.get('reaction') || '',
      sort: ['new', 'old', 'exp'].includes(p.get('sort')) ? p.get('sort') : 'new', prereg: p.get('prereg') === '1', confirmed: p.get('confirmed') === '1'
    });
  };
  const writeUrl = () => {
    const p = new URLSearchParams();
    if (state.q.trim()) p.set('q', state.q);
    if (state.status.size !== ALL.length) p.set('status', [...state.status].join(','));
    ['cat', 'sub', 'reaction'].forEach(k => { if (state[k]) p.set(k, state[k]); });
    if (state.sort !== 'new') p.set('sort', state.sort);
    if (state.prereg) p.set('prereg', '1');
    if (state.confirmed) p.set('confirmed', '1');
    history.replaceState(null, '', '#/archive' + (p.toString() ? '?' + p : ''));
  };

  NR.route(/^#\/archive(?:\?.*)?$/, async () => {
    NR.setTitle('Archive');
    readState();
    const [all, meta] = await Promise.all([DB.reports.list().then(l => l.filter(NR.isPublic)), NR.loadMeta()]);
    const count = s => all.filter(r => r.status === s).length;
    NR.setMain(`
    <div class="wrap page">
      <h1>Archive</h1>
      <p class="muted">Browse everything — each report is labelled so you always know what has been reviewed.</p>
      <div class="archive">
        <aside class="filters" aria-label="Filters">
          <div><label for="q">Dead-end check</label><input type="search" id="q" placeholder="Reaction, catalyst, substrate, keyword…" value="${esc(state.q)}"></div>
          <fieldset><legend>Review status</legend>
            ${['peer', 'review', 'preprint'].map(s => `<label class="check"><input type="checkbox" data-status="${s}" ${state.status.has(s) ? 'checked' : ''}> ${NR.badge(s)} <span class="count-chip">${count(s)}</span></label>`).join('')}
          </fieldset>
          <fieldset><legend>Signals</legend>
            <label class="check"><input type="checkbox" id="f-prereg" ${state.prereg ? 'checked' : ''}> Pre-registered only</label>
            <label class="check"><input type="checkbox" id="f-conf" ${state.confirmed ? 'checked' : ''}> Independently confirmed</label>
          </fieldset>
          <div><label for="reaction">Reaction class</label><select id="reaction"><option value="">All</option>${NR.REACTIONS.map(v => `<option ${state.reaction === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
          <div><label for="cat">Failure category</label><select id="cat"><option value="">All</option>${Object.entries(NR.CATEGORIES).map(([k, v]) => `<option value="${k}" ${state.cat === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
          <div><label for="sub">Subfield</label><select id="sub"><option value="">All</option>${NR.SUBFIELDS.map(v => `<option ${state.sub === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
          <div><label for="sort">Sort by</label><select id="sort"><option value="new" ${state.sort === 'new' ? 'selected' : ''}>Newest first</option><option value="old" ${state.sort === 'old' ? 'selected' : ''}>Oldest first</option><option value="exp" ${state.sort === 'exp' ? 'selected' : ''}>Most experiments</option></select></div>
        </aside>
        <section aria-live="polite"><p class="muted small" id="rcount"></p><div id="results" class="rlist"></div></section>
      </div>
    </div>`);

    const haystack = r => NR.norm([r.title, r.abstract, r.id, r.system, r.reactionClass, r.subfield, (r.keywords || []).join(' '), r.authors.map(a => a.name).join(' '), (r.series || []).map(s => s.label + ' ' + s.catalyst).join(' ')].join(' '));
    const score = (r, toks) => toks.reduce((a, t) => a + (NR.norm(r.title).includes(t) ? 3 : 0) + (NR.norm((r.keywords || []).join(' ')).includes(t) ? 2 : 0), 0);
    const update = () => {
      const toks = NR.norm(state.q).split(/\s+/).filter(Boolean);
      const conf = r => ((meta.notes[r.id] || []).filter(n => n.type === 'confirm').length > 0);
      const rows = all.filter(r => state.status.has(r.status)
        && (!state.cat || r.failureCategory === state.cat) && (!state.sub || r.subfield === state.sub) && (!state.reaction || r.reactionClass === state.reaction)
        && (!state.prereg || r.protocolId) && (!state.confirmed || conf(r))
        && toks.every(t => haystack(r).includes(t)));
      rows.sort((a, b) => {
        if (toks.length && state.sort === 'new') { const d = score(b, toks) - score(a, toks); if (d) return d; }
        return state.sort === 'old' ? a.createdAt.localeCompare(b.createdAt) : state.sort === 'exp' ? NR.totalN(b) - NR.totalN(a) : b.createdAt.localeCompare(a.createdAt);
      });
      $('#rcount').textContent = `${rows.length} report${rows.length === 1 ? '' : 's'}`;
      const q = state.q.trim();
      $('#results').innerHTML = rows.length ? rows.map(r => NR.reportCard(r, meta)).join('') : `
        <div class="empty"><strong>${q ? 'Nothing documented for this yet.' : 'No reports match these filters.'}</strong>
          ${q ? `<p class="muted">That doesn't prove it works — only that nobody has shared a null result on it here. You can:</p>
          <div class="de-actions">
            <a class="btn" href="#/wanted?new=${encodeURIComponent(q)}" data-feature="wanted">Ask the community what is known</a>
            <a class="btn secondary" href="#/register" data-feature="registry">Register your plan first</a>
            <a class="btn secondary" href="#/submit">Share your own result</a></div>` : ''}
        </div>`;
      NR.applyFeatures && NR.applyFeatures();
    };
    const change = fn => e => { fn(e); writeUrl(); update(); };
    $('#q').oninput = change(e => { state.q = e.target.value; });
    $$('[data-status]').forEach(cb => cb.onchange = change(() => { cb.checked ? state.status.add(cb.dataset.status) : state.status.delete(cb.dataset.status); }));
    $('#f-prereg').onchange = change(e => { state.prereg = e.target.checked; });
    $('#f-conf').onchange = change(e => { state.confirmed = e.target.checked; });
    $('#reaction').onchange = change(e => { state.reaction = e.target.value; });
    $('#cat').onchange = change(e => { state.cat = e.target.value; });
    $('#sub').onchange = change(e => { state.sub = e.target.value; });
    $('#sort').onchange = change(e => { state.sort = e.target.value; });
    update();
  });
})();
