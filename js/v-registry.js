// Registry: register a plan before the experiments (time-stamped + fingerprinted), review in principle, link the outcome report.
(function () {
  'use strict';
  const NR = window.NR, DB = NR.DB, { $, $$, esc, fmtDate, paras, SVG } = NR;
  const PS = NR.PSTATUS;

  // ---------- list ----------
  const state = { q: '', status: 'all' };
  NR.route(/^#\/registry(?:\?.*)?$/, async () => {
    NR.setTitle('Registry');
    Object.assign(state, { q: '', status: 'all' });
    const all = (await DB.protocols.list()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    NR.setMain(`
    <div class="wrap page">
      <h1>Registry</h1>
      <p class="muted" style="max-width:720px">Register your plan <em>before</em> you run the experiments. The plan is time-stamped and fingerprinted, can be reviewed in principle, and the outcome report is published whatever the result — with a “pre-registered” mark and any deviations documented.</p>
      <div class="steps">
        <div class="step"><span class="num">1</span><h3>Register the plan</h3><p class="muted">Question, hypothesis, design, controls and what counts as success. Public and tamper-evident.</p></div>
        <div class="step"><span class="num">2</span><h3>Optional: plan review</h3><p class="muted">Editors check that the design is sound. If accepted in principle, the report will be published whatever the outcome.</p></div>
        <div class="step"><span class="num">3</span><h3>Run it, then report</h3><p class="muted">Write the outcome report in one click — the plan pre-fills the form. Deviations are shown openly.</p></div>
      </div>
      <div class="section-head" style="margin-top:32px"><h2>Registered plans</h2><a class="btn" href="#/register">Register a plan</a></div>
      <div class="grid c2" style="max-width:560px;margin-bottom:16px"><div><label for="rq" class="sr">Search</label><input type="search" id="rq" placeholder="Search plans…" value="${esc(state.q)}"></div>
        <div><label for="rs" class="sr">Status</label><select id="rs"><option value="all">All statuses</option>${Object.entries(PS).map(([k, v]) => `<option value="${k}" ${state.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div></div>
      <div id="plist" class="rlist"></div>
    </div>`);
    const update = () => {
      const toks = NR.norm(state.q).split(/\s+/).filter(Boolean);
      const rows = all.filter(p => (state.status === 'all' || p.status === state.status) && toks.every(t => NR.norm([p.title, p.question, p.system, p.reactionClass, p.authors.map(a => a.name).join(' ')].join(' ')).includes(t)));
      $('#plist').innerHTML = rows.length ? rows.map(NR.protocolCard).join('') : '<div class="empty">No registered plans match.</div>';
    };
    $('#rq').oninput = e => { state.q = e.target.value; update(); };
    $('#rs').onchange = e => { state.status = e.target.value; update(); };
    update();
  });

  // ---------- detail ----------
  NR.route(/^#\/protocol\/([^?]+)(?:\?.*)?$/, async rawId => {
    const id = decodeURIComponent(rawId), u = NR.me(), staff = NR.isStaff(u);
    const p = await DB.protocols.get(id);
    if (!p) { NR.setTitle('Plan not found'); return NR.setMain('<div class="wrap page"><h1>Plan not found</h1><p><a href="#/registry">Back to registry</a></p></div>'); }
    NR.setTitle(p.title);
    const owner = NR.isOwner(p, u);
    const fpOk = NR.fingerprint(p) === p.fingerprint;
    const report = p.reportId ? await DB.reports.get(p.reportId) : null;
    const reportPublic = report && NR.isPublic(report);
    const steps = [
      ['Registered', p.createdAt, true],
      ['Plan reviewed (in principle accepted)', p.ipaAt, !!p.ipaAt],
      ['Outcome report published', report && reportPublic ? report.createdAt : null, !!(report && reportPublic)]
    ];
    const [staffPanel, authorPanel] = await Promise.all([staff ? NR.reviewStaffPanel('protocol', p) : '', owner ? NR.reviewAuthorPanel('protocol', p) : '']);
    let n = 0;
    const sec = (t, b) => `<section><h2>${++n} · ${t}</h2>${b}</section>`;
    NR.setMain(`
    <div class="wrap page">
      <p class="small"><a href="#/registry">← Registry</a></p>
      <div class="report-layout">
        <article class="report">
          <div class="chips" style="margin-bottom:12px">${NR.pBadge(p.status)}<span class="tag">${esc(p.subfield)}</span><span class="tag">${esc(p.reactionClass)}</span>${p.demo ? '<span class="tag">fictional demo data</span>' : ''}</div>
          <h1>${esc(p.title)}</h1>
          <p class="byline"><strong>${p.authors.map(a => esc(a.name) + (a.role === 'pi' ? ' <span class="muted small">(group leader)</span>' : '')).join(', ')}</strong></p>
          <p class="byline small">${[...new Set(p.authors.map(a => a.affiliation).filter(Boolean))].map(esc).join(' · ')}</p>
          <p class="byline small">${NR.verifiedMark(p)}</p>
          <ol class="lifecycle" aria-label="Lifecycle">${steps.map(([l, d, ok]) => `<li class="${ok ? 'done' : ''}"><span class="lc-dot"></span><span>${l}</span><small>${d ? fmtDate(d) : 'pending'}</small></li>`).join('')}</ol>
          ${report && reportPublic ? `<div class="notice peer">${SVG.peer.replace('<svg', '<svg width="20" height="20"')}<p><strong>Outcome report published:</strong> <a href="#/report/${esc(report.id)}">${esc(report.title)}</a></p></div>` : ''}
          ${staffPanel}${authorPanel}
          ${sec('Research question', `<div class="prose">${paras(p.question)}</div>`)}
          ${sec('Hypothesis and rationale', `<div class="prose">${paras(p.hypothesis)}</div>`)}
          ${sec('System', `<div class="prose">${paras(p.system)}</div>`)}
          ${sec('Planned design', `<div class="prose">${paras(p.design)}</div>`)}
          ${sec('Controls', `<div class="prose">${paras(p.controls)}</div><h3>Planned analytics</h3><div class="chips">${p.analytics.map(a => `<span class="tag">${esc(a)}</span>`).join('')}</div>`)}
          ${sec('What counts as success — and when to stop', `<div class="compare"><div class="card"><h3>Success criterion</h3><p>${esc(p.successCriterion)}</p>${NR.isNum(p.threshold) ? `<p class="muted small">Threshold: ${esc(p.metric || 'result')} ≥ ${NR.pct(p.threshold)}%</p>` : ''}</div><div class="card"><h3>Stopping rule</h3><p>${esc(p.stopping)}</p><p class="muted small">Planned end: ${esc(NR.fmtMonth(p.plannedEnd))}</p></div></div>`)}
          ${sec('Amendments', (p.amendments || []).length ? `<ul class="amend">${p.amendments.map(a => `<li><strong>${fmtDate(a.at)}</strong> — ${esc(a.text)}</li>`).join('')}</ul>` : '<p class="muted">None. Changes after registration are added here, openly, instead of overwriting the plan.</p>')}
          ${owner && p.status !== 'withdrawn' ? `<form id="amend-form" class="card no-print" novalidate><h3>Add an amendment</h3><div class="field"><textarea id="am-text" rows="3" placeholder="What changed and why? (the original plan stays unchanged)"></textarea><p class="err" data-err="text"></p></div><button class="btn secondary sm" type="submit">Add amendment</button></form>` : ''}
        </article>
        <aside class="aside">
          <div class="panel"><h3>Status</h3><div style="margin-bottom:8px">${NR.pBadge(p.status)}</div><p class="muted small" style="margin:0">${esc(PS[p.status].hint)}</p></div>
          <div class="panel"><h3>Tamper-evident fingerprint</h3>
            <p class="small muted">SHA-256 of the registered plan, authors and registration time. If anyone edits the plan afterwards, the fingerprint no longer matches.</p>
            <div class="cite fp" id="fp">${esc(p.fingerprint)}</div>
            <p class="small" id="fp-state">${fpOk ? `<span class="verified">${SVG.check} content matches the fingerprint</span>` : '<span class="chip chip-warn">content does NOT match the fingerprint</span>'}</p>
            <div class="btnrow"><button class="btn secondary sm" id="fp-copy">Copy</button><button class="btn secondary sm" id="fp-verify">Re-verify</button></div></div>
          <div class="panel"><h3>Details</h3><dl><dt>ID</dt><dd class="mono">${esc(p.id)}</dd><dt>Registered</dt><dd>${fmtDate(p.createdAt)}</dd><dt>Planned end</dt><dd>${esc(NR.fmtMonth(p.plannedEnd))}</dd><dt>Outcome</dt><dd>${report && reportPublic ? `<a href="#/report/${esc(report.id)}">${esc(report.id)}</a>` : 'not yet'}</dd></dl></div>
          ${owner && ['registered', 'ipa'].includes(p.status) ? `<div class="panel no-print"><h3>Next steps</h3><div class="stack">
            <a class="btn sm" href="#/submit?protocol=${esc(p.id)}">Write the outcome report</a>
            ${p.status === 'registered' && !p.reviewRequested && !p.reviewState ? '<button class="btn secondary sm" id="req-plan-review">Request plan review</button>' : ''}
            ${p.reviewRequested && p.status === 'registered' ? '<p class="muted small" style="margin:0">Plan review requested.</p>' : ''}
            <button class="btn ghost sm" id="withdraw">Withdraw registration</button></div></div>` : ''}
          ${staff ? `<details class="panel no-print"><summary><strong>Manual status override</strong></summary><p class="small muted">Sets the status directly and skips the plan-review workflow. Use the editorial panel in the article for the normal process.</p><label for="ps-status">Set status</label><select id="ps-status">${Object.entries(PS).map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select><button class="btn sm" id="ps-apply" style="margin-top:10px">Apply</button></details>` : ''}
        </aside>
      </div>
    </div>`);

    if (staffPanel) NR.bindReviewStaffPanel('protocol', p);
    $('#fp-copy').onclick = () => NR.copy(p.fingerprint);
    $('#fp-verify').onclick = () => {
      const ok = NR.fingerprint(p) === p.fingerprint;
      $('#fp-state').innerHTML = ok ? `<span class="verified">${SVG.check} recomputed in your browser — content matches</span>` : '<span class="chip chip-warn">recomputed — content does NOT match</span>';
    };
    const act = async fn => { try { await fn(); NR.dispatch(); } catch (err) { NR.toast(err.message); } };
    const rq = $('#req-plan-review'); if (rq) rq.onclick = () => act(async () => { await NR.api.requestPlanReview(p.id); NR.toast('Plan review requested'); });
    const wd = $('#withdraw'); if (wd) wd.onclick = () => { if (confirm('Withdraw this registration? It stays visible, marked as withdrawn.')) act(() => NR.api.withdrawProtocol(p.id)); };
    const af = $('#amend-form');
    if (af) af.onsubmit = async e => {
      e.preventDefault();
      const text = $('#am-text').value.trim();
      if (!NR.showErrors(af, text.length < 10 ? { text: 'Please describe the change.' } : {})) return;
      act(async () => { await NR.api.addAmendment(p.id, text); NR.toast('Amendment added'); });
    };
    const ap = $('#ps-apply');
    if (ap) ap.onclick = () => act(async () => { await NR.api.setProtocolStatus(p.id, $('#ps-status').value); NR.toast('Status updated'); });
  });

  // ---------- register form ----------
  let authors = null;
  NR.route(/^#\/register$/, async () => {
    const u = NR.requireAuth('#/register'); if (!u) return;
    NR.setTitle('Register a plan');
    if (NR.isStaff(u)) return NR.setMain('<div class="wrap page"><h1>Register a plan</h1><p>The demo staff account cannot register plans. <a href="#/login">Sign in as an author</a>.</p></div>');
    authors = [{ name: u.name, affiliation: '', orcid: u.orcid || '', email: '', role: '' }];
    const F = NR.f;
    NR.setMain(`<div class="wrap page"><div class="wizard">
      <h1>Register a plan</h1>
      <p class="muted">Registration is public immediately and cannot be edited afterwards — changes are added as amendments. Keep it short and concrete: reviewers and readers should be able to tell later whether you did what you said.</p>
      <form id="reg" novalidate>
        ${F.text('Working title', 'title', { hint: 'What are you going to try?' })}
        <div class="grid c2">${F.select('Subfield', 'subfield', NR.SUBFIELDS)}${F.select('Reaction class', 'reactionClass', NR.REACTIONS)}</div>
        <div class="field"><span class="label">Authors</span><div id="authors-mount"></div><p class="err" data-err="authors"></p></div>
        ${F.area('Research question', 'question', { rows: 3 })}
        ${F.area('Hypothesis and rationale', 'hypothesis', { rows: 5, hint: 'Why should this work? Cite the precedent or mechanism that motivates it.' })}
        ${F.area('Reaction / system', 'system', { rows: 3, hint: 'Substrates, catalysts, reagents, key conditions.' })}
        ${F.area('Planned design', 'design', { rows: 5, hint: 'Which series will you run, how many experiments, what will you vary?' })}
        ${F.area('Controls', 'controls', { rows: 3, hint: 'Positive and negative controls that show the system works.' })}
        <div class="field"><span class="label">Planned analytics</span><div class="chips">${NR.ANALYTICS.map(a => `<label class="check" style="margin:0 12px 6px 0"><input type="checkbox" name="an" value="${esc(a)}"> ${esc(a)}</label>`).join('')}</div><p class="err" data-err="analytics"></p></div>
        <div class="grid c2">${F.select('Result metric', 'metric', NR.METRICS)}${F.text('Success threshold (%)', 'threshold', { type: 'number', attrs: 'min="0" max="100" step="any"', hint: 'Optional but recommended.' })}</div>
        ${F.text('What counts as success?', 'successCriterion', { hint: 'e.g. “≥ 30% GC yield in at least one condition (mean of duplicates)”.' })}
        ${F.area('Stopping rule', 'stopping', { rows: 2, hint: 'When will you stop? e.g. “after three series without a result above 10%”.' })}
        ${F.text('Planned end', 'plannedEnd', { type: 'month' })}
        ${F.check('I am an author of this plan, my group leader agrees to its registration, and it contains no confidential or third-party data.', 'ok')}
        <div class="wiz-nav"><a class="btn secondary" href="#/registry">Cancel</a><button class="btn" type="submit">Register plan</button></div>
      </form></div></div>`);
    NR.authorsEditor($('#authors-mount'), authors, { withEmail: false });
    const form = $('#reg');
    form.onsubmit = async e => {
      e.preventDefault();
      const v = n => form.elements[n].value.trim();
      const an = $$('[name=an]:checked', form).map(x => x.value);
      const errs = {};
      ['title', 'subfield', 'reactionClass', 'question', 'hypothesis', 'system', 'design', 'controls', 'metric', 'successCriterion', 'stopping', 'plannedEnd'].forEach(k => { if (!v(k)) errs[k] = 'Required'; });
      if (!authors.every(a => a.name.trim() && a.affiliation.trim())) errs.authors = 'Every author needs a name and an affiliation.';
      if (!an.length) errs.analytics = 'Select at least one analytical method.';
      if (!form.elements.ok.checked) errs.ok = 'Please confirm.';
      if (!NR.showErrors(form, errs)) return;
      const plan = {
        title: v('title'), subfield: v('subfield'), reactionClass: v('reactionClass'),
        authors: authors.map(a => ({ name: a.name.trim(), affiliation: a.affiliation.trim(), orcid: (a.orcid || '').trim(), role: a.role || '' })),
        question: v('question'), hypothesis: v('hypothesis'), system: v('system'), design: v('design'), controls: v('controls'), analytics: an,
        metric: v('metric'), threshold: v('threshold') === '' ? null : +v('threshold'), successCriterion: v('successCriterion'), stopping: v('stopping'), plannedEnd: v('plannedEnd')
      };
      try { const saved = await NR.api.registerProtocol(plan); NR.toast('Plan registered'); location.hash = `#/protocol/${saved.id}`; } catch (err) { NR.toast(err.message); }
    };
  });
})();
