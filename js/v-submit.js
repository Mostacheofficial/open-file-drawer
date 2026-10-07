// Submission wizard (with CSV import and co-author confirmation) and the confirmation page.
(function () {
  'use strict';
  const NR = window.NR, DB = NR.DB, Auth = window.NR_AUTH, { $, $$, esc } = NR;
  const DRAFT_KEY = 'ofd.draft.v2';
  const STEPS = ['Overview', 'Hypothesis', 'Experiments', 'Outcome', 'Data & rights', 'Review'];
  const wc = s => (String(s).trim().match(/\S+/g) || []).length;
  const blankRow = () => ({ label: '', n: '', catalyst: '', solvent: '', temp: '', time: '', best: '', outcome: '', isControl: false });
  let draft = null;

  function newDraft() {
    const u = NR.me() || {};
    return {
      step: 0, title: '', abstract: '', subfield: '', reactionClass: '', keywords: '',
      authors: [{ name: u.name || '', affiliation: '', orcid: u.orcid || '', email: '', role: '' }],
      protocolId: '', wantedId: '', question: '', hypothesis: '', system: '', timeSpan: '',
      metric: 'Yield (%)', threshold: '', series: [blankRow()], experiments: [], importInfo: null, controls: '', analytics: [],
      expected: '', observed: '', failureCategory: '', interpretation: '', limitations: '', deviations: '',
      dataLinks: '', files: [], license: 'CC BY 4.0', ownership: false, noConfidential: false, safety: false
    };
  }
  const REV_KEY = 'ofd.draft.revise.v2';

  // Starts a public report from a confidential workspace entry: its text fields are copied into a new draft. Nothing is published until the author
  // completes and submits it; the last step asks them to confirm that nothing confidential remains.
  NR.startReportFromEntry = (e, orgName) => {
    const old = NR.lsGet(DRAFT_KEY, null);
    if (old && (old.title || old.abstract) && !confirm('Replace your current draft with a new one made from this entry?')) return false;
    const d = newDraft();
    Object.assign(d, {
      title: e.title, subfield: e.subfield, reactionClass: e.reactionClass, keywords: (e.tags || []).join(', '), question: e.goal, system: e.approach, observed: e.outcome,
      failureCategory: e.failureCategory, interpretation: e.learnings, metric: e.metric || d.metric, threshold: e.threshold == null ? '' : e.threshold,
      series: (e.series && e.series.length) ? e.series.map(x => ({ label: x.label, n: x.n, catalyst: x.catalyst || '', solvent: x.solvent || '', temp: x.temp || '', time: x.time || '', best: NR.isNum(x.best) ? x.best : '', outcome: x.outcome, isControl: !!x.isControl })) : [blankRow()],
      experiments: e.experiments || [], fromEntry: e.id, fromOrg: orgName || ''
    });
    NR.lsSet(DRAFT_KEY, d); draft = null; location.hash = '#/submit';
    return true;
  };
  const persist = () => NR.lsSet(draft && draft.revisionOf ? REV_KEY : DRAFT_KEY, draft);

  // ---------- who has to confirm? ----------
  function confirmers(d) {
    const mode = NR.cfg.coauthorConfirmation || 'off';
    if (mode === 'off' || d.revisionOf) return [];                       // a revision does not ask for confirmations again
    return d.authors.slice(1).filter(a => a.name.trim() && (mode === 'all' || a.role === 'pi'));
  }

  NR.route(/^#\/submit(?:\?.*)?$/, async () => {
    const u = NR.requireAuth('#/submit'); if (!u) return;
    NR.setTitle('Submit a report');
    if (NR.isStaff(u)) return NR.setMain('<div class="wrap page"><h1>Submit a report</h1><p>The demo staff account cannot publish reports. <a href="#/login">Sign in as an author</a>.</p></div>');
    const q = NR.query(), pid = q.get('protocol'), wid = q.get('wanted'), rev = q.get('revise');
    if (rev) {
      history.replaceState(null, '', '#/submit');
      const r = await DB.reports.get(rev);
      if (!r || !NR.isOwner(r, u)) return NR.setMain('<div class="wrap page"><h1>Revise a report</h1><p class="muted">Only the submitter can revise a report.</p><p><a href="#/">Home</a></p></div>');
      if (r.status === 'peer' || r.reviewState === 'in_review' || !NR.isPublic(r)) return NR.setMain(`<div class="wrap page"><h1>Revise a report</h1><p class="muted">${r.status === 'peer' ? 'A peer-reviewed report cannot be changed by its authors. Please contact the editors.' : r.reviewState === 'in_review' ? 'The report is under review right now. You can submit a revision when the editor asks for one.' : 'The report must be public before it can be revised.'}</p><p><a href="#/report/${esc(r.id)}">Back to the report</a></p></div>`);
      NR.setTitle('Revise a report');
      const saved = NR.lsGet(REV_KEY, null);
      draft = saved && saved.revisionOf === r.id && saved.baseVersion === r.version ? saved : draftFromReport(r);
      persist(); return draw();
    }
    draft = NR.lsGet(DRAFT_KEY, null);
    if (pid || wid) {
      history.replaceState(null, '', '#/submit');
      const same = draft && (pid ? draft.protocolId === pid : true) && (wid ? draft.wantedId === wid : true);
      if (!same) {
        if (draft && (draft.title || draft.abstract) && !confirm('Replace your current draft with a new one?')) { /* keep old draft */ }
        else draft = await draftFrom(pid, wid, u);
      }
    }
    if (!draft || !Array.isArray(draft.authors)) draft = newDraft();
    persist();
    draw();
  });

  // a revision starts from the published version
  function draftFromReport(r) {
    const d = newDraft();
    Object.assign(d, {
      revisionOf: r.id, baseVersion: r.version, changeNote: '', protocolId: r.protocolId || '',
      title: r.title, abstract: r.abstract, subfield: r.subfield, reactionClass: r.reactionClass || '', keywords: (r.keywords || []).join(', '),
      authors: r.authors.map(a => ({ name: a.name, affiliation: a.affiliation || '', orcid: a.orcid || '', email: '', role: a.role || '' })),
      question: r.question, hypothesis: r.hypothesis, system: r.system, timeSpan: r.timeSpan || '', metric: r.metric || 'Yield (%)', threshold: r.threshold == null ? '' : r.threshold,
      series: r.series.map(x => ({ label: x.label, n: x.n, catalyst: x.catalyst || '', solvent: x.solvent || '', temp: x.temp || '', time: x.time || '', best: NR.isNum(x.best) ? x.best : '', outcome: x.outcome, isControl: !!x.isControl })),
      experiments: r.experiments || [], controls: r.controls, analytics: [...(r.analytics || [])], expected: r.expected, observed: r.observed, failureCategory: r.failureCategory,
      interpretation: r.interpretation, limitations: r.limitations, deviations: r.deviations || '', dataLinks: (r.dataLinks || []).join('\n'), files: r.files || [], license: r.license
    });
    return d;
  }

  async function draftFrom(pid, wid, u) {
    const d = newDraft();
    if (pid) {
      const p = await DB.protocols.get(pid);
      if (p && NR.isOwner(p, u)) {
        Object.assign(d, { protocolId: p.id, subfield: p.subfield, reactionClass: p.reactionClass, question: p.question, hypothesis: p.hypothesis, system: p.system, controls: p.controls, analytics: [...p.analytics],
          metric: p.metric || d.metric, threshold: p.threshold == null ? '' : p.threshold, expected: p.successCriterion || '' });
        d.authors = p.authors.map((a, i) => ({ name: a.name, affiliation: a.affiliation || '', orcid: a.orcid || '', email: '', role: a.role || '' }));
        d.authors[0] = { ...d.authors[0], name: u.name, orcid: u.orcid || d.authors[0].orcid };
      } else NR.toast('That plan is not yours — starting a blank draft.');
    }
    if (wid) {
      const w = await DB.wanted.get(wid);
      if (w) { d.wantedId = w.id; if (!d.reactionClass) d.reactionClass = w.reactionClass; }
    }
    return d;
  }

  // ---------- step markup ----------
  const fText = (label, key, o = {}) => `<div class="field"><label for="${key}">${label}</label>${o.hint ? `<p class="hint">${o.hint}</p>` : ''}<input type="${o.type || 'text'}" id="${key}" data-k="${key}" value="${esc(draft[key])}" placeholder="${esc(o.ph || '')}" ${o.attrs || ''}><p class="err" data-err="${key}"></p></div>`;
  const fArea = (label, key, o = {}) => `<div class="field"><label for="${key}">${label}</label>${o.hint ? `<p class="hint">${o.hint}</p>` : ''}<textarea id="${key}" data-k="${key}" rows="${o.rows || 4}" placeholder="${esc(o.ph || '')}">${esc(draft[key])}</textarea><p class="err" data-err="${key}"></p></div>`;
  const fSelect = (label, key, options, o = {}) => `<div class="field"><label for="${key}">${label}</label>${o.hint ? `<p class="hint">${o.hint}</p>` : ''}<select id="${key}" data-k="${key}"><option value="">Select…</option>${options.map(x => { const [v, l] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}" ${draft[key] === v ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select><p class="err" data-err="${key}"></p></div>`;

  function banners() {
    let h = '';
    if (draft.revisionOf) h += `<div class="notice pre"><p><strong>Revising ${esc(draft.revisionOf)}</strong> (version ${esc(draft.baseVersion)} → ${esc(draft.baseVersion + 1)}). The earlier version stays visible. Change what is needed, then describe the changes in the last step.</p></div>`;
    if (draft.protocolId && !draft.revisionOf) h += `<div class="notice neutral"><p><strong>Outcome report for registered plan ${esc(draft.protocolId)}.</strong> Question, hypothesis, controls and success criterion were copied from the plan. Report any deviations in the Outcome step.</p></div>`;
    if (draft.fromEntry) h += `<div class="notice pre"><p><strong>Started from a confidential entry (${esc(draft.fromEntry)}${draft.fromOrg ? ', ' + esc(draft.fromOrg) : ''}).</strong> Only the text fields were copied. Before you publish, check every sentence, every number and every name: nothing confidential may remain, and your organisation must agree to publish. The last step asks you to confirm this.</p></div>`;
    if (draft.wantedId) h += `<div class="notice neutral"><p><strong>Answering a community request (${esc(draft.wantedId)}).</strong> Your report will be linked to it once it is public.</p></div>`;
    return h;
  }

  function stepHtml(i) {
    if (i === 0) return `${banners()}
      <h2>Overview</h2>
      ${fText('Title', 'title', { hint: 'State what was tried <em>and</em> that it did not work, e.g. “… no conversion across 48 conditions”.' })}
      ${fArea('Abstract', 'abstract', { rows: 6, hint: '150–250 words: question, approach, scale of the work, outcome, most likely explanation.' })}
      <p class="small muted" id="abs-count" style="margin-top:-12px"></p>
      <div class="grid c2">
        ${fSelect('Subfield', 'subfield', NR.SUBFIELDS)}
        ${fSelect('Reaction class', 'reactionClass', NR.REACTIONS, { hint: 'Used for search and for linking similar reports.' })}
      </div>
      ${fText('Keywords', 'keywords', { hint: 'Comma-separated.', ph: 'photoredox, nickel, scope' })}
      <div class="field"><span class="label">Authors</span>
        <p class="hint">${NR.cfg.coauthorConfirmation === 'off' ? 'List everyone who contributed.' : (NR.cfg.coauthorConfirmation === 'all' ? 'Every co-author needs an e-mail address: the report goes public once all of them confirm.' : 'List your group leader (PI) with an e-mail address: the report goes public once they confirm. If you are the group leader, mark yourself as such.')}</p>
        <div id="authors-mount"></div><p class="err" data-err="authors"></p></div>`;
    if (i === 1) return `
      <h2>Hypothesis and system</h2>
      ${fArea('Research question', 'question', { rows: 3, hint: 'What did you set out to find out?' })}
      ${fArea('Hypothesis and rationale', 'hypothesis', { rows: 5, hint: 'Why was this plausible? Cite the precedent or mechanism that motivated it. Reviewers and readers use this to judge whether the attempt was reasonable.' })}
      ${fArea('Reaction / system studied', 'system', { rows: 4, hint: 'Substrates, catalysts, reagents, key conditions. SMILES or names are both fine.' })}
      ${fText('Time span', 'timeSpan', { ph: 'Mar 2024 – Jan 2025' })}`;
    if (i === 2) {
      const info = draft.importInfo;
      const total = draft.series.reduce((a, s) => a + (+s.n || 0), 0);
      return `
      <h2>Experimental series</h2>
      <div class="import">
        <h3>Save time: import your experiment table</h3>
        <p class="muted small">Upload a CSV from your ELN or spreadsheet (one row per experiment). We group the rows into series and draw the overview. Works with comma or semicolon separated files, also from German Excel.</p>
        <div class="btnrow"><button type="button" class="btn secondary sm" id="csv-template">Download CSV template</button>
          <label class="btn sm" for="csv-file" style="margin:0">Choose CSV file…</label><input type="file" id="csv-file" accept=".csv,text/csv,text/plain" hidden></div>
        ${info ? `<div class="import-ok"><strong>Imported ${info.count} experiments in ${info.seriesCount} series.</strong>
          <span class="muted small"> Columns: ${Object.entries(info.mapping).map(([k, v]) => `${esc(k)} ← “${esc(v)}”`).join(', ')}.</span>
          ${(info.warnings || []).map(w => `<p class="small warn">⚠ ${esc(w)}</p>`).join('')}
          <button type="button" class="linklike small" id="csv-clear">Remove imported experiments</button></div>` : ''}
        <p class="err" data-err="csv"></p>
      </div>
      <div class="grid c2">
        ${fSelect('Result metric', 'metric', NR.METRICS, { hint: 'The same metric for all series, so the overview is comparable.' })}
        ${fText('Success threshold (%)', 'threshold', { type: 'number', hint: 'What would have counted as success? Shown as a line in the overview.', attrs: 'min="0" max="100" step="any"' })}
      </div>
      <div class="field"><span class="label">Series</span><p class="hint">Group the work into systematic series (e.g. “ligand screen, 24 reactions”). Include your positive-control series.</p>
      ${draft.series.map((s, i) => `<div class="rowcard"><div class="rc-head"><span>Series ${i + 1}</span>${draft.series.length > 1 ? `<button type="button" class="btn ghost sm" data-del-series="${i}">Remove</button>` : ''}</div>
        <div class="grid series"><div><label>What was varied</label><input type="text" data-series="${i}" data-f="label" value="${esc(s.label)}" placeholder="Ligand screen"></div><div><label>Experiments</label><input type="number" min="1" data-series="${i}" data-f="n" value="${esc(s.n)}"></div></div>
        <div class="grid series2" style="margin-top:10px"><div><label>Catalyst / reagents</label><input type="text" data-series="${i}" data-f="catalyst" value="${esc(s.catalyst)}"></div><div><label>Solvent</label><input type="text" data-series="${i}" data-f="solvent" value="${esc(s.solvent)}"></div><div><label>T (°C)</label><input type="text" data-series="${i}" data-f="temp" value="${esc(s.temp)}"></div><div><label>t (h)</label><input type="text" data-series="${i}" data-f="time" value="${esc(s.time)}"></div></div>
        <div class="grid series3" style="margin-top:10px"><div><label>Best result (%)</label><input type="number" step="any" min="0" max="100" data-series="${i}" data-f="best" value="${esc(s.best)}"></div><div><label>Result in words</label><input type="text" data-series="${i}" data-f="outcome" value="${esc(s.outcome)}" placeholder="e.g. ≤ 3% product; starting material recovered"></div></div>
        <label class="check" style="margin:10px 0 0"><input type="checkbox" data-series="${i}" data-f="isControl" ${s.isControl ? 'checked' : ''}> <span>This is a <strong>positive control</strong> series (shows the system can work)</span></label></div>`).join('')}
      <button type="button" class="btn secondary sm" id="add-series">+ Add series</button> <span class="muted small">Total: <strong id="series-total">${total}</strong> experiments</span><p class="err" data-err="series"></p></div>
      ${fArea('Controls and replicates', 'controls', { rows: 4, hint: 'Positive control (shows the system works), negative controls, how many replicates.' })}
      <div class="field"><span class="label">Analytical evidence</span><p class="hint">Which methods support the outcome?</p><div class="chips">${NR.ANALYTICS.map(a => `<label class="check" style="margin:0 12px 6px 0"><input type="checkbox" data-analytics="${esc(a)}" ${draft.analytics.includes(a) ? 'checked' : ''}> ${esc(a)}</label>`).join('')}</div><p class="err" data-err="analytics"></p></div>`;
    }
    if (i === 3) return `
      <h2>Outcome</h2>
      <div class="grid c2">${fArea('Expected result', 'expected', { rows: 3, hint: 'What counted as success?' })}${fArea('Observed result', 'observed', { rows: 3, hint: 'What actually happened, quantitatively.' })}</div>
      ${fSelect('Failure category', 'failureCategory', Object.entries(NR.CATEGORIES))}
      ${fArea('Interpretation', 'interpretation', { rows: 5, hint: 'Why might it have failed? Distinguish what the data show from what you suspect.' })}
      ${fArea('Limitations', 'limitations', { rows: 4, hint: 'What can NOT be concluded? What was not tested?' })}
      ${draft.protocolId ? fArea('Deviations from the registered plan', 'deviations', { rows: 4, hint: 'Everything you did differently from the registered plan, and why. Write “none” if you followed it exactly.' }) : ''}`;
    if (i === 4) return `
      <h2>Data and rights</h2>
      ${fArea('Links to raw data', 'dataLinks', { rows: 3, hint: 'One per line — Zenodo, institutional repository, ELN export, etc. Strongly encouraged.' })}
      ${NR.backend === 'local'
        ? `<div class="field"><label for="files">Or attach files</label><p class="hint">Prototype: only file names are recorded.</p><input type="file" id="files" multiple>${draft.files.length ? `<p class="small muted">${draft.files.map(f => esc(f.name)).join(', ')}</p>` : ''}</div>`
        : '<p class="hint">Please link a repository (e.g. Zenodo or your institution\'s). File upload is not available yet.</p>'}
      ${fSelect('Licence', 'license', NR.LICENSES)}
      <div class="field"><span class="label">Declarations</span>
        <label class="check"><input type="checkbox" data-k="ownership" ${draft.ownership ? 'checked' : ''}> <span>I am an author of this work, and all co-authors agree to its publication under the chosen licence.</span></label>
        <label class="check"><input type="checkbox" data-k="noConfidential" ${draft.noConfidential ? 'checked' : ''}> <span>It contains no confidential, third-party or industry-restricted data, and my institution permits publication.</span></label>
        <label class="check"><input type="checkbox" data-k="safety" ${draft.safety ? 'checked' : ''}> <span>It contains no instructions for making toxic agents, explosives or controlled substances.</span></label>
        <p class="err" data-err="declarations"></p></div>`;
    const d = draft, need = confirmers(d);
    return `<h2>${d.revisionOf ? 'Describe the changes and publish' : 'Review and publish'}</h2>
      ${d.revisionOf ? `<div class="notice pre"><p><strong>This publishes version ${esc(d.baseVersion + 1)} of ${esc(d.revisionOf)}.</strong> Version ${esc(d.baseVersion)} stays visible. If the editors asked for the revision, the next review round starts automatically.</p></div>
        ${fArea('What changed in this version?', 'changeNote', { rows: 4, hint: 'Shown on the report and in the version list. Mention which reviewer or reader comments you addressed.' })}` : need.length
        ? `<div class="notice pre"><p><strong>Co-author confirmation comes first.</strong> We will ask ${need.map(a => `<strong>${esc(a.name)}</strong>${a.role === 'pi' ? ' (group leader)' : ''}`).join(', ')} to confirm authorship. The report becomes public as a preprint — not peer reviewed — once they have.</p></div>`
        : (d.revisionOf ? '' : '<div class="notice pre"><p><strong>This will publish immediately as a preprint — not peer reviewed.</strong> You can request peer review afterwards from the report page.</p></div>')}
      <div class="card summary"><dl>
        <dt>Title</dt><dd>${esc(d.title)}</dd><dt>Authors</dt><dd>${d.authors.map(a => esc(a.name)).join(', ')}</dd><dt>Subfield</dt><dd>${esc(d.subfield)} · ${esc(d.reactionClass)}</dd>
        <dt>Experiments</dt><dd>${d.series.reduce((a, s) => a + (+s.n || 0), 0)} in ${d.series.length} series${d.experiments.length ? ` (experiment table with ${d.experiments.length} rows attached)` : ''}</dd><dt>Analytics</dt><dd>${d.analytics.map(esc).join(', ')}</dd>
        <dt>Failure category</dt><dd>${esc(NR.CATEGORIES[d.failureCategory])}</dd><dt>Licence</dt><dd>${esc(d.license)}</dd>${d.protocolId ? `<dt>Registered plan</dt><dd>${esc(d.protocolId)}</dd>` : ''}</dl></div>`;
  }

  // ---------- validation ----------
  function validate(i) {
    // minimum lengths mirror the database function submit_report (supabase/schema.sql), so errors show up on the right step, not at the end
    const d = draft, errs = {}, need = (k, msg = 'Required', min = 1) => {
      const v = String(d[k]).trim();
      if (!v) errs[k] = msg; else if (v.length < min) errs[k] = `Please write a little more (at least ${min} characters).`;
    };
    if (i === 0) {
      need('title', 'Required', 10); need('abstract'); need('subfield', 'Please choose a subfield'); need('reactionClass', 'Please choose a reaction class');
      if (d.abstract.trim() && wc(d.abstract) < 40) errs.abstract = 'Please write a fuller abstract (at least ~40 words).';
      if (!d.authors.every(a => a.name.trim() && a.affiliation.trim())) errs.authors = 'Every author needs a name and an affiliation.';
      else if (!d.revisionOf) {
        const mode = NR.cfg.coauthorConfirmation || 'off', need2 = confirmers(d);
        if (mode === 'pi' && d.authors[0].role !== 'pi' && !need2.length) errs.authors = 'Please add your group leader (PI) as an author with the role “Group leader (PI)” — or mark yourself as group leader.';
        else if (need2.some(a => !/^\S+@\S+\.\S+$/.test(a.email || ''))) errs.authors = 'Co-authors who must confirm need a valid e-mail address.';
      }
    }
    if (i === 1) { need('question', 'Required', 10); need('hypothesis', 'Required', 20); need('system', 'Required', 5); }
    if (i === 2) {
      if (!d.series.every(s => s.label.trim() && +s.n > 0 && s.outcome.trim())) errs.series = 'Each series needs a description, a number of experiments and a result in words.';
      need('controls', 'Please describe your controls', 10); if (!d.analytics.length) errs.analytics = 'Select at least one analytical method.';
    }
    if (i === 3) { need('expected', 'Required', 3); need('observed', 'Required', 3); need('failureCategory', 'Please choose a category'); need('interpretation', 'Required', 10); need('limitations', 'Please state the limits of the conclusions', 10); if (d.protocolId) need('deviations', 'Write “none” if there were no deviations'); }
    if (i === 4 && !(d.ownership && d.noConfidential && d.safety)) errs.declarations = 'All three declarations are required.';
    if (i === 5 && d.revisionOf) need('changeNote', 'Please say what changed', 10);
    return errs;
  }

  // ---------- drawing & binding ----------
  function draw() {
    const i = draft.step, need = confirmers(draft);
    NR.setMain(`<div class="wrap page"><div class="wizard">
      <h1>${draft.revisionOf ? 'Revise a report' : 'Submit a report'}</h1>
      <p class="muted">Signed in as <strong>${esc(NR.me().name)}</strong> · progress is saved in this browser. ${draft.protocolId || draft.revisionOf ? '' : 'Planning an experiment instead? <a href="#/register" data-feature="registry">Register it first →</a>'}</p>
      <div class="stepper" role="list">${STEPS.map((s, k) => `<button type="button" role="listitem" data-goto="${k}" class="${k === i ? 'active' : k < i ? 'done' : ''}"><b>${k + 1}</b>${s}</button>`).join('')}</div>
      <form id="wiz" novalidate>${stepHtml(i)}
        ${i === STEPS.length - 1 ? '<p class="err" id="publish-err" role="alert"></p>' : ''}
        <div class="wiz-nav"><button type="button" class="btn secondary" id="back" ${i === 0 ? 'disabled' : ''}>Back</button>
          ${i < STEPS.length - 1 ? '<button type="submit" class="btn">Continue</button>' : `<button type="submit" class="btn">${draft.revisionOf ? 'Publish version ' + (draft.baseVersion + 1) : need.length ? 'Send confirmation requests' : 'Publish as preprint'}</button>`}</div>
      </form></div></div>`);
    bind();
    NR.applyFeatures();
  }

  function bind() {
    const rerender = () => { persist(); const y = scrollY; draw(); scrollTo(0, y); };
    $$('[data-k]').forEach(el => {
      const ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(ev, () => { draft[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; persist(); if (el.id === 'abstract') countAbs(); });
    });
    const countAbs = () => { const c = $('#abs-count'); if (c) c.textContent = `${wc(draft.abstract)} words`; };
    countAbs();
    const mount = $('#authors-mount');
    if (mount) NR.authorsEditor(mount, draft.authors, { onChange: persist });
    $$('[data-series]').forEach(el => {
      const f = el.dataset.f, i = +el.dataset.series;
      el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
        draft.series[i][f] = el.type === 'checkbox' ? el.checked : el.value; persist();
        const t = $('#series-total'); if (t) t.textContent = draft.series.reduce((a, s) => a + (+s.n || 0), 0);
      });
    });
    $$('[data-analytics]').forEach(el => el.addEventListener('change', () => {
      const a = el.dataset.analytics; draft.analytics = el.checked ? [...new Set([...draft.analytics, a])] : draft.analytics.filter(x => x !== a); persist();
    }));
    const on = (sel, fn) => { const el = $(sel); if (el) el.onclick = fn; };
    on('#add-series', () => { draft.series.push(blankRow()); rerender(); });
    $$('[data-del-series]').forEach(b => b.onclick = () => { draft.series.splice(+b.dataset.delSeries, 1); rerender(); });
    on('#csv-template', () => NR.exp.download('open-file-drawer-experiments-template.csv', NR.csv.template(), 'text/csv;charset=utf-8'));
    on('#csv-clear', () => { draft.experiments = []; draft.importInfo = null; rerender(); });
    const csv = $('#csv-file');
    if (csv) csv.onchange = async () => {
      const file = csv.files[0]; if (!file) return;
      try {
        if (file.size > 5 * 1024 * 1024) throw new Error('File is larger than 5 MB.');
        const res = NR.csv.importText(await file.text());
        if (res.experiments.length > 5000) throw new Error('More than 5,000 rows — please split the project into sub-projects.');
        if (draft.series.some(s => s.label.trim() || s.outcome.trim()) && !confirm('Replace your current series with the imported ones?')) return;
        draft.series = res.series.map(s => ({ ...s, best: s.best == null ? '' : s.best }));
        draft.experiments = res.experiments; draft.importInfo = res.info;
        persist(); draw(); NR.toast(`Imported ${res.info.count} experiments`);
      } catch (e) { const el = $('[data-err=csv]'); if (el) el.textContent = e.message; }
    };
    const f = $('#files'); if (f) f.onchange = () => { draft.files = [...f.files].map(x => ({ name: x.name, size: x.size / 1024 < 1024 ? Math.round(x.size / 1024) + ' kB' : (x.size / 1048576).toFixed(1) + ' MB' })); rerender(); };
    on('#back', () => { draft.step--; persist(); draw(); scrollTo(0, 0); });
    $$('[data-goto]').forEach(b => b.onclick = () => {
      const t = +b.dataset.goto;
      for (let k = 0; k < Math.min(t, draft.step + 1); k++) { const e = validate(k); if (Object.keys(e).length) { draft.step = k; persist(); draw(); NR.showErrors($('#wiz'), e); return; } }
      draft.step = t; persist(); draw(); scrollTo(0, 0);
    });
    $('#wiz').onsubmit = async e => {
      e.preventDefault();
      const errs = validate(draft.step);
      if (!NR.showErrors($('#wiz'), errs)) return;
      if (draft.step < STEPS.length - 1) { draft.step++; persist(); draw(); scrollTo(0, 0); return; }
      await publish();
    };
  }

  async function publish() {
    const d = draft, need = confirmers(d);
    const payload = {
      title: d.title.trim(), abstract: d.abstract.trim(), subfield: d.subfield, reactionClass: d.reactionClass,
      keywords: d.keywords.split(',').map(s => s.trim()).filter(Boolean),
      authors: d.authors.map(a => ({ name: a.name.trim(), affiliation: a.affiliation.trim(), orcid: (a.orcid || '').trim(), role: a.role || '' })),
      protocolId: d.protocolId || undefined, wantedId: d.wantedId || undefined,
      question: d.question.trim(), hypothesis: d.hypothesis.trim(), system: d.system.trim(), timeSpan: d.timeSpan.trim(),
      metric: d.metric, threshold: d.threshold === '' ? null : +d.threshold,
      series: d.series.map(s => ({ label: s.label.trim(), n: +s.n, catalyst: s.catalyst.trim(), solvent: s.solvent.trim(), temp: String(s.temp).trim(), time: String(s.time).trim(), best: s.best === '' || s.best == null ? null : +s.best, outcome: s.outcome.trim(), isControl: !!s.isControl })),
      experiments: d.experiments, controls: d.controls.trim(), analytics: d.analytics,
      expected: d.expected.trim(), observed: d.observed.trim(), failureCategory: d.failureCategory, interpretation: d.interpretation.trim(), limitations: d.limitations.trim(),
      deviations: d.protocolId ? d.deviations.trim() : undefined,
      dataLinks: d.dataLinks.split('\n').map(s => s.trim()).filter(Boolean), files: NR.backend === 'local' ? d.files : [], license: d.license,
      declarations: { ownership: !!d.ownership, noConfidential: !!d.noConfidential, safety: !!d.safety },
      confirmers: need.map(a => ({ name: a.name.trim(), email: (a.email || '').trim(), role: a.role || 'author' }))
    };
    const btn = $('#wiz .wiz-nav .btn:last-child'); if (btn) btn.disabled = true;
    try {
      if (d.revisionOf) {
        const res = await NR.api.submitRevision(d.revisionOf, payload, d.changeNote);
        NR.lsDel(REV_KEY); const id = d.revisionOf; draft = null;
        NR.toast(`Version ${res.version} published` + (res.reviewRestarted ? ' — the review continues with a new round' : ''));
        location.hash = `#/report/${id}`; return;
      }
      const res = await NR.api.submitReport(payload);
      if (d.fromEntry && NR.api.orgMarkReleased) { try { await NR.api.orgMarkReleased(d.fromEntry, res.id); } catch (e) { console.warn('Could not mark the entry as released', e); } }
      NR.lsDel(DRAFT_KEY); draft = null;
      NR.toast(res.visibility === 'public' ? 'Published as preprint' : 'Confirmation requests sent');
      location.hash = `#/report/${res.id}`;
    } catch (err) {
      if (btn) btn.disabled = false;
      const box = $('#publish-err'); if (box) { box.textContent = err.message; box.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      NR.toast(err.message);
    }
  }

  // ---------- co-author confirmation page ----------
  NR.route(/^#\/confirm\/([^/]+)\/([^/?]+)$/, async (rawId, token) => {
    NR.setTitle('Confirm authorship');
    const id = decodeURIComponent(rawId);
    let ctx = null;
    try { ctx = await NR.api.getConfirmationContext(id, token); } catch (e) { console.error(e); }
    if (!ctx) return NR.setMain('<div class="wrap page"><h1>Invalid link</h1><p class="muted">This confirmation link is not valid or has expired.</p><p><a href="#/">Home</a></p></div>');
    const done = !!ctx.confirmedAt, declined = !!ctx.declined;
    NR.setMain(`<div class="wrap page" style="max-width:760px">
      <h1>Confirm authorship</h1>
      ${NR.backend === 'local'
        ? '<div class="demo-box"><strong>Prototype:</strong> on the live site this link arrives by e-mail, which is what verifies that it is really you. Here, the link alone works.</div>'
        : '<p class="muted small">Opening this link from your e-mail inbox verifies your address. Nothing is published unless you confirm.</p>'}
      <div class="card">
        <p class="muted small" style="margin-bottom:6px">${esc(ctx.submitter)} has listed you, <strong>${esc(ctx.name)}</strong>${ctx.role === 'pi' ? ' as group leader (PI)' : ' as an author'}, on this report:</p>
        <h2 style="margin-bottom:.3em">${esc(ctx.title)}</h2>
        <p class="muted small">${(ctx.authors || []).map(esc).join(', ')} · ${esc(ctx.nExperiments)} experiments · licence ${esc(ctx.license)}</p>
        <div class="prose" style="font-family:var(--serif)">${NR.paras(ctx.abstract)}</div>
        ${declined ? '<div class="notice pre"><p><strong>You declined this report.</strong> The submitter and the editors have been told.</p></div>'
          : done ? `<div class="notice peer"><p><strong>You confirmed this on ${esc(NR.fmtDate(ctx.confirmedAt))}.</strong> ${ctx.public ? 'The report is public.' : 'It becomes public once all required confirmations are in.'}</p></div>` : `
        <form id="cf" novalidate>
          <label class="check"><input type="checkbox" name="ok"> <span>I am <strong>${esc(ctx.name)}</strong>, I have read this report, I agree to its publication as a <strong>preprint (not peer reviewed)</strong> under ${esc(ctx.license)}, and I confirm that the data may be published by my group and institution.</span></label>
          <p class="err" data-err="ok"></p>
          <div class="btnrow"><button class="btn" type="submit">Confirm authorship</button><button class="btn ghost" type="button" id="decline">This is not right</button></div>
        </form>`}
      </div></div>`);
    const form = $('#cf'); if (!form) return;
    form.onsubmit = async e => {
      e.preventDefault();
      if (!NR.showErrors(form, form.ok.checked ? {} : { ok: 'Please tick the box to confirm.' })) return;
      try {
        const res = await NR.api.confirmAuthorship(id, token);
        NR.toast(res.public ? 'Confirmed — the report is now public' : 'Confirmed — waiting for the others');
        NR.dispatch();
      } catch (err) { NR.toast(err.message); }
    };
    $('#decline').onclick = async () => {
      const reason = prompt('What is wrong? The submitter and the editors will be told.');
      if (!reason) return;
      try { await NR.api.declineAuthorship(id, token, reason); NR.toast('Thanks — the editors have been notified.'); NR.dispatch(); } catch (err) { NR.toast(err.message); }
    };
  });
})();
