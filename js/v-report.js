// Report page.
(function () {
  'use strict';
  const NR = window.NR, DB = NR.DB, { $, $$, esc, fmtDate, paras, SVG, STATUS, CATEGORIES } = NR;
  const TYPE = {
    confirm: ['Independent confirmation', 'chip-ok'],
    contradict: ['Contradicting result', 'chip-warn'],
    question: ['Question', ''],
    comment: ['Comment', '']
  };

  NR.route(/^#\/report\/([^?]+)(?:\?.*)?$/, id => show(decodeURIComponent(id)));

  const authorHtml = a => {
    const name = a.orcid ? `<a href="#/author/${esc(a.orcid)}">${esc(a.name)}</a> <a class="small" href="https://orcid.org/${esc(a.orcid)}" rel="noopener" title="ORCID ${esc(a.orcid)}">[iD]</a>` : esc(a.name);
    return name + (a.role === 'pi' ? ' <span class="muted small">(group leader)</span>' : '');
  };

  async function show(id) {
    const u = NR.me(), staff = NR.isStaff(u);
    let r = await DB.reports.get(id);
    if (!r || (r.visibility === 'pending' && !(NR.isOwner(r, u) || staff))) {
      NR.setTitle('Report not found');
      return NR.setMain('<div class="wrap page"><h1>Report not found</h1><p class="muted">It may not exist, or it is still awaiting co-author confirmation.</p><p><a href="#/archive">Back to archive</a></p></div>');
    }
    // ?v=N shows an earlier version (content only; status, review and confirmation are those of the report as a whole)
    const curVersion = r.version, vq = +NR.query().get('v') || 0;
    let viewing = 0;
    if (vq && vq !== curVersion) {
      const vd = await NR.api.getVersion(id, vq).catch(() => null);
      if (vd) { viewing = vq; const picked = {}; NR.CONTENT_KEYS.forEach(k => { if (k in vd) picked[k] = vd[k]; }); r = { ...r, ...picked }; }
    }
    const [allNotes, protocol, all] = await Promise.all([DB.notes.list(), r.protocolId ? DB.protocols.get(r.protocolId) : null, DB.reports.list()]);
    const notes = allNotes.filter(n => n.reportId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const pending = r.visibility === 'pending';
    const isOwner = NR.isOwner(r, u);
    const year = new Date(r.createdAt).getFullYear();
    const cite = `${r.authors.map(a => a.name).join(', ')} (${year}). ${r.title}. Open File Drawer, ${r.id}, v${r.version}. [${STATUS[r.status].long}]`;
    const conf = notes.filter(n => n.type === 'confirm').length;
    NR.setTitle(r.title);
    if (!pending && !viewing) NR.setJsonLd(NR.jsonLd(r));
    const [staffPanel, authorPanel, versions] = await Promise.all([
      staff && !pending && !viewing ? NR.reviewStaffPanel('report', r) : '',
      isOwner && !pending && !viewing ? NR.reviewAuthorPanel('report', r) : '',
      pending ? [] : NR.api.listVersions(id).catch(() => [])
    ]);
    const canRevise = isOwner && !pending && !viewing && r.status !== 'peer' && r.reviewState !== 'in_review';
    const versionBanner = viewing ? `<div class="notice pre"><p><strong>You are reading version ${esc(viewing)} of ${esc(curVersion)}</strong>${r.versionCreatedAt ? ` (${esc(fmtDate(r.versionCreatedAt))})` : ''}. <a href="#/report/${esc(id)}">Go to the current version →</a></p></div>` : '';

    const icon = k => SVG[k].replace('<svg', '<svg width="20" height="20"');
    const notices = {
      preprint: `<div class="notice pre">${icon('preprint')}<p><strong>Preprint — not peer reviewed.</strong> This report was published by a verified author and has not been independently checked. Treat the conclusions as the authors' own.${r.reviewRequested ? ' Peer review has been requested.' : ''}</p></div>`,
      review: `<div class="notice rev">${icon('review')}<p>${r.reviewState === 'revision' ? '<strong>Revision requested.</strong> After the review round, the editors asked the authors to revise this report.' : '<strong>In peer review.</strong> An editor and independent reviewers are evaluating this report. Content may change.'}</p></div>`,
      peer: `<div class="notice peer">${icon('peer')}<p><strong>Peer reviewed.</strong> ${r.review ? `Accepted ${esc(fmtDate(r.review.date))} — handling editor ${esc(r.review.editor)}, ${esc(r.review.reviewers)} independent reviewers. ${esc(r.review.note || '')}` : ''}</p></div>`
    };

    const confirmedBy = r.confirmation && r.confirmation.completedAt ? r.confirmation.required.map(x => `${esc(x.name)}${x.role === 'pi' ? ' (group leader)' : ''}`).join(', ') : '';
    const pendingPanel = pending ? `
      <div class="notice pre">${icon('preprint')}<p><strong>Awaiting co-author confirmation.</strong> This report is not public yet. It goes live as soon as the people below confirm authorship and agree to publication.</p></div>
      <div class="card" style="margin-bottom:16px"><div class="table-wrap"><table style="min-width:520px"><thead><tr><th>Person</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>
        ${(r.confirmation ? r.confirmation.required : []).map(x => `<tr><td>${esc(x.name)}${x.email ? `<br><span class="muted small">${esc(NR.maskEmail(x.email))}</span>` : ''}</td><td>${x.role === 'pi' ? 'Group leader (PI)' : 'Author'}</td><td>${x.declined ? 'declined' : x.confirmedAt ? `✓ confirmed ${esc(fmtDate(x.confirmedAt))}` : 'pending'}</td><td>${x.confirmedAt || !x.token ? '' : `<button class="btn secondary sm" data-copy-link="${esc(x.token)}">Copy link</button> <a class="btn sm" href="#/confirm/${esc(r.id)}/${esc(x.token)}">Demo: confirm as this person</a>`}</td></tr>`).join('')}
      </tbody></table></div><p class="muted small" style="margin:10px 0 0">${NR.backend === 'local' ? 'On the live site each person receives this link by e-mail.' : 'Each person received a confirmation link by e-mail. Opening it from their inbox verifies the address.'}</p></div>` : '';

    const preregStrip = protocol ? `
      <div class="notice neutral">${SVG.check.replace('<svg', '<svg width="20" height="20"')}<p><strong>Pre-registered.</strong> The plan was registered on ${esc(fmtDate(protocol.createdAt))} — before the experiments${protocol.ipaAt ? `, and accepted in principle after review on ${esc(fmtDate(protocol.ipaAt))}` : ''}. <a href="#/protocol/${esc(protocol.id)}">Read the registered plan (${esc(protocol.id)}) →</a></p></div>` : '';

    let n = 0;
    const sec = (title, body) => `<section><h2>${++n} · ${title}</h2>${body}</section>`;
    const rows = (r.series || []).map(s => `<tr${s.isControl ? ' class="row-control"' : ''}><td>${esc(s.label)}${s.isControl ? ' <span class="tag">control</span>' : ''}</td><td class="num">${esc(s.n)}</td><td>${esc(s.catalyst)}</td><td>${esc(s.solvent)}</td><td class="num">${esc(s.temp)}</td><td class="num">${esc(s.time)}</td><td class="num">${NR.isNum(s.best) ? esc(NR.pct(s.best)) : '—'}</td><td>${esc(s.outcome)}</td></tr>`).join('');
    const body = [
      sec('Research question', `<div class="prose">${paras(r.question)}</div>`),
      sec('Hypothesis and rationale', `<div class="prose">${paras(r.hypothesis)}</div>`),
      sec('System', `<div class="prose">${paras(r.system)}</div><p class="muted small">${NR.totalN(r)} experiments${r.timeSpan ? ' · ' + esc(r.timeSpan) : ''}</p>`),
      sec('Experimental series', `${NR.plot(r)}
        <div class="table-wrap"><table><thead><tr><th>Series</th><th class="num">n</th><th>Catalyst / reagents</th><th>Solvent</th><th class="num">T (°C)</th><th class="num">t (h)</th><th class="num">Best (%)</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table></div>
        <h3 style="margin-top:20px">Controls and replicates</h3><div class="prose">${paras(r.controls)}</div>
        <h3>Analytics</h3><div class="chips">${(r.analytics || []).map(a => `<span class="tag">${esc(a)}</span>`).join('')}</div>`),
      r.deviations ? sec('Deviations from the registered plan', `<div class="prose">${paras(r.deviations)}</div>`) : '',
      sec('Expected vs. observed', `<div class="compare"><div class="card"><h3>Expected</h3><p>${esc(r.expected)}</p></div><div class="card"><h3>Observed</h3><p>${esc(r.observed)}</p></div></div>`),
      sec('Interpretation', `<div class="prose">${paras(r.interpretation)}</div>`),
      sec('Limitations — what cannot be concluded', `<div class="prose">${paras(r.limitations)}</div>`),
      r.versionNote && r.version > 1 ? sec('What changed in this version', `<div class="prose">${paras(r.versionNote)}</div>`) : '',
      sec('Data availability', `
        ${(r.dataLinks || []).length ? `<ul>${r.dataLinks.map(l => `<li>${NR.safeUrl(l) ? `<a href="${esc(NR.safeUrl(l))}" rel="noopener">${esc(l)}</a>` : esc(l)}</li>`).join('')}</ul>` : ''}
        ${(r.files || []).length ? `<ul>${r.files.map(f => `<li class="mono">${esc(f.name)} <span class="muted">(${esc(f.size)})</span></li>`).join('')}</ul>` : ''}
        ${(r.experiments || []).length ? `<p>The full experiment table (${r.experiments.length} rows) can be downloaded as CSV from the sidebar.</p>` : ''}
        ${!(r.dataLinks || []).length && !(r.files || []).length && !(r.experiments || []).length ? '<p class="muted">No raw data attached.</p>' : ''}
        <p class="muted small">Licence: ${esc(r.license)}</p>`)
    ].join('');

    const notesSection = pending ? '' : `<section id="notes"><h2>${++n} · Independent checks and discussion</h2>${notesHtml(r, notes, u)}</section>`;

    const keys = new Set((r.keywords || []).map(k => NR.norm(k)));
    const related = all.filter(x => x.id !== r.id && NR.isPublic(x)).map(x => ({ x, s: (x.reactionClass === r.reactionClass ? 2 : 0) + (x.keywords || []).filter(k => keys.has(NR.norm(k))).length })).filter(o => o.s > 0).sort((a, b) => b.s - a.s).slice(0, 3);

    NR.setMain(`
    <div class="wrap page">
      <p class="small"><a href="#/archive">← Archive</a></p>
      <div class="report-layout">
        <article class="report">
          <div class="chips" style="margin-bottom:12px">${NR.badge(r.status)}${r.protocolId ? `<span class="chip chip-prereg">${SVG.check}Pre-registered</span>` : ''}${conf ? `<span class="chip chip-ok">${SVG.check}${conf} independent confirmation${conf > 1 ? 's' : ''}</span>` : ''}<span class="tag">${esc(r.subfield)}</span><span class="tag">${esc(r.reactionClass || '')}</span><span class="tag">${esc(CATEGORIES[r.failureCategory] || '')}</span>${r.demo ? '<span class="tag">fictional demo data</span>' : ''}</div>
          <h1>${esc(r.title)}</h1>
          <p class="byline"><strong>${r.authors.map(authorHtml).join(', ')}</strong></p>
          <p class="byline small">${[...new Set(r.authors.map(a => a.affiliation).filter(Boolean))].map(a => `<a href="#/institution/${encodeURIComponent(a)}">${esc(a)}</a>`).join(' · ')}</p>
          <p class="byline small">${NR.verifiedMark(r)}${confirmedBy ? ` <span class="verified">${SVG.check} authorship confirmed by ${confirmedBy}</span>` : ''}</p>
          ${pendingPanel}${pending ? '' : notices[r.status]}${preregStrip}${versionBanner}${staffPanel}${authorPanel}
          <section><h2>Abstract</h2><div class="prose">${paras(r.abstract)}</div></section>
          ${NR.tiles(r)}
          ${body}
          ${NR.openReviewSection(r)}
          ${notesSection}
          ${related.length ? `<section><h2>Related reports</h2><ul class="related">${related.map(o => `<li><a href="#/report/${esc(o.x.id)}">${esc(o.x.title)}</a> <span class="muted small">· ${NR.badge(o.x.status)}</span></li>`).join('')}</ul></section>` : ''}
        </article>

        <aside class="aside">
          <div class="panel"><h3>Status</h3>
            <div style="margin-bottom:8px">${pending ? '<span class="chip chip-warn">awaiting confirmation</span>' : NR.badge(r.status)}</div><p class="muted small" style="margin:0">${pending ? 'Not public yet.' : esc(STATUS[r.status].hint)}</p>
          </div>
          <div class="panel"><h3>Details</h3>
            <dl><dt>ID</dt><dd class="mono">${esc(r.id)}</dd><dt>Version</dt><dd>v${esc(r.version)}${r.version === curVersion ? '' : ' of ' + esc(curVersion)}</dd><dt>Published</dt><dd>${fmtDate(r.createdAt)}</dd>${r.version > 1 && r.versionCreatedAt ? `<dt>This version</dt><dd>${fmtDate(r.versionCreatedAt)}</dd>` : ''}<dt>Experiments</dt><dd>${NR.totalN(r)}</dd><dt>DOI</dt><dd class="muted">${r.doi ? `<a href="https://doi.org/${esc(r.doi)}">${esc(r.doi)}</a>` : 'not yet assigned'}</dd></dl>
          </div>
          ${versions.length > 1 ? `<div class="panel"><h3>Versions</h3><ul class="versions">${versions.map(v => `<li class="${v.version === r.version ? 'cur' : ''}"><a href="#/report/${esc(id)}${v.current ? '' : '?v=' + v.version}">v${v.version}${v.current ? ' (current)' : ''}</a> <span class="muted small">${fmtDate(v.createdAt)}</span>${v.note ? `<div class="small muted">${esc(v.note)}</div>` : ''}</li>`).join('')}</ul></div>` : ''}
          <div class="panel"><h3>Cite as</h3><div class="cite">${esc(cite)}</div>
            <div class="btnrow"><button class="btn secondary sm" id="cp-cite">Copy</button><button class="btn secondary sm" id="dl-bib">BibTeX</button><button class="btn secondary sm" id="dl-ris">RIS</button></div></div>
          <div class="panel actions no-print"><h3>Actions</h3><div class="stack">
            <button class="btn secondary sm" id="dl-json">Structured data (JSON)</button>
            <button class="btn secondary sm" id="dl-csv">${(r.experiments || []).length ? 'Experiment table (CSV)' : 'Series table (CSV)'}</button>
            <button class="btn secondary sm" id="share">Download share image</button>
            <button class="btn secondary sm" id="print">Print / save as PDF</button>
            ${pending ? '' : '<button class="btn ghost sm" id="flag">Report a problem</button>'}
            ${canRevise ? `<a class="btn secondary sm" href="#/submit?revise=${esc(r.id)}">${r.reviewState === 'revision' ? 'Submit the requested revision' : 'Correct or update this report'}</a>` : ''}
            ${isOwner && r.status === 'preprint' && !r.reviewRequested && !r.reviewState && !pending && !viewing ? '<button class="btn sm" id="req-review">Request peer review</button>' : ''}
          </div></div>
          ${staff && !viewing ? editorPanel(r) : ''}
        </aside>
      </div>
    </div>`);

    // ----- handlers -----
    const dl = (name, text, mime) => NR.exp.download(name, text, mime);
    $('#dl-json').onclick = () => dl(`${r.id}.json`, NR.exp.json(r), 'application/json');
    $('#dl-csv').onclick = () => dl(`${r.id}-${(r.experiments || []).length ? 'experiments' : 'series'}.csv`, NR.exp.csv(r), 'text/csv;charset=utf-8');
    $('#dl-bib').onclick = () => dl(`${r.id}.bib`, NR.exp.bibtex(r), 'application/x-bibtex');
    $('#dl-ris').onclick = () => dl(`${r.id}.ris`, NR.exp.ris(r), 'application/x-research-info-systems');
    $('#cp-cite').onclick = () => NR.copy(cite);
    $('#print').onclick = () => window.print();
    $('#share').onclick = async () => {
      const blob = await NR.shareCard(r);
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${r.id}-share.png`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      NR.toast('Share image downloaded');
    };
    const flag = $('#flag');
    if (flag) flag.onclick = async () => {
      const reason = prompt("What is the problem with this report? (e.g. not the author's work, confidential data, unsafe content)");
      if (!reason) return;
      if (!u) return NR.requireAuth('#/report/' + r.id);
      try { await NR.api.flagReport(r.id, reason); NR.toast('Thanks — the editors have been notified.'); } catch (err) { NR.toast(err.message); }
    };
    const rq = $('#req-review');
    if (rq) rq.onclick = async () => { try { await NR.api.requestReview(r.id); NR.toast('Peer review requested'); show(r.id); } catch (err) { NR.toast(err.message); } };
    $$('[data-copy-link]').forEach(b => { b.onclick = () => NR.copy(`${location.href.split('#')[0]}#/confirm/${r.id}/${b.dataset.copyLink}`); });
    const ap = $('#ed-apply');
    if (ap) ap.onclick = async () => {
      try { await NR.api.setReportStatus(r.id, $('#ed-status').value, $('#ed-note').value); NR.toast('Status updated'); show(r.id); } catch (err) { NR.toast(err.message); }
    };
    if (staffPanel) NR.bindReviewStaffPanel('report', r);
    bindNotes(r, u);
  }

  function editorPanel(r) {
    return `<details class="panel no-print"><summary><strong>Manual status override</strong></summary>
      <p class="small muted">Sets the label directly and skips the review workflow. Use the editorial panel above for the normal process.</p>
      <label for="ed-status">Set status</label>
      <select id="ed-status">${Object.keys(STATUS).map(s => `<option value="${s}" ${r.status === s ? 'selected' : ''}>${STATUS[s].long}</option>`).join('')}</select>
      <label for="ed-note" style="margin-top:10px">Note</label>
      <textarea id="ed-note" rows="3">${esc(r.review && r.review.note || '')}</textarea>
      <button class="btn sm" id="ed-apply" style="margin-top:10px">Apply</button></details>`;
  }

  // ---------- independent checks & discussion ----------
  function notesHtml(r, notes, u) {
    const c = t => notes.filter(n => n.type === t).length;
    const author = NR.isAuthor(r, u);
    const opts = author ? [['comment', 'Reply / comment']] : [['confirm', 'We repeated it and saw the same (independent confirmation)'], ['contradict', 'We got a different result'], ['question', 'Question'], ['comment', 'Comment']];
    return `
      <p class="muted small">Verified researchers can confirm, contradict or question a report. This is not formal peer review — it is an open, attributed record of what others found.</p>
      <p class="tally"><span class="chip chip-ok">${SVG.check}${c('confirm')} confirmation${c('confirm') === 1 ? '' : 's'}</span> <span class="chip ${c('contradict') ? 'chip-warn' : ''}">${c('contradict')} contradicting</span> <span class="chip">${c('question') + c('comment')} question${c('question') + c('comment') === 1 ? '' : 's'} / comment${c('question') + c('comment') === 1 ? '' : 's'}</span></p>
      <div class="notes">${notes.length ? notes.map(n => `<div class="note"><div class="note-head"><span class="chip ${TYPE[n.type][1]}">${TYPE[n.type][0]}</span><strong>${esc(n.by.name)}</strong>${n.by.orcid ? ` <a class="small" href="https://orcid.org/${esc(n.by.orcid)}" rel="noopener">[iD]</a>` : ''}<span class="muted small">${fmtDate(n.createdAt)}</span></div><p>${esc(n.body)}</p>${n.link ? `<p class="small">${NR.safeUrl(n.link) ? `<a href="${esc(NR.safeUrl(n.link))}" rel="noopener">${esc(n.link)}</a>` : /^NR-\d{4}-\d+$/.test(n.link) ? `<a href="#/report/${esc(n.link)}">${esc(n.link)}</a>` : esc(n.link)}</p>` : ''}</div>`).join('') : '<p class="muted">No notes yet.</p>'}</div>
      ${u ? `<form id="note-form" class="card" novalidate><h3>${author ? 'Reply as an author' : 'Add your result or question'}</h3>
        <div class="field">${opts.map(([v, l], i) => `<label class="check"><input type="radio" name="type" value="${v}" ${i === 0 ? 'checked' : ''}> <span>${l}</span></label>`).join('')}</div>
        <div class="field"><label for="n-body">What did you do and see?</label><textarea id="n-body" rows="4" placeholder="Conditions you repeated, what you observed, and how it differs or agrees."></textarea><p class="err" data-err="body"></p></div>
        <div class="field"><label for="n-link">Link to your data or report (optional)</label><input type="text" id="n-link" placeholder="https://… or NR-2026-0001"></div>
        <button class="btn" type="submit">Post as ${esc(u.name)}</button></form>`
      : '<p><a class="btn secondary" href="#/login" id="note-login">Sign in to add a note</a></p>'}`;
  }
  function bindNotes(r, u) {
    const l = $('#note-login'); if (l) l.onclick = () => { try { sessionStorage.setItem('nr.next', '#/report/' + r.id); } catch (e) {} };
    const form = $('#note-form'); if (!form) return;
    form.onsubmit = async e => {
      e.preventDefault();
      const body = $('#n-body').value.trim();
      if (!NR.showErrors(form, body.length < 20 ? { body: 'Please describe what you did and saw (at least a sentence or two).' } : {})) return;
      try { await NR.api.addNote(r.id, { type: form.querySelector('[name=type]:checked').value, body, link: $('#n-link').value.trim() }); NR.toast('Note posted'); show(r.id); } catch (err) { NR.toast(err.message); }
    };
  }
})();
