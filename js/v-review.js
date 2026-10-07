// Peer review and plan review: the reviewer page (e-mailed link), the editor's panel, the authors' panel, open reviews.
// Used on the report page and the plan page. All data goes through NR.api (see api-local.js / backend-supabase.js).
(function () {
  'use strict';
  const NR = window.NR, { $, $$, esc, fmtDate, SVG } = NR;
  const typeName = t => (t === 'protocol' ? 'plan' : 'report');
  const critLabel = (type, k) => ((NR.REVIEW[type].criteria.find(c => c[0] === k) || [])[1] || k);
  const recLabel = (type, k) => ((NR.REVIEW[type].recs.find(r => r[0] === k) || [])[1] || k);
  const ratingChip = v => `<span class="chip ${v === 'yes' ? 'chip-ok' : v === 'no' ? 'chip-warn' : ''}">${{ yes: 'Yes', partly: 'Partly', no: 'No' }[v] || esc(v)}</span>`;
  const STATUS_CHIP = { invited: ['invited', ''], accepted: ['accepted', 'chip-prereg'], submitted: ['review received', 'chip-ok'], declined: ['declined', 'chip-warn'], cancelled: ['cancelled', ''], closed: ['closed', ''] };
  const statusChip = s => `<span class="chip ${STATUS_CHIP[s][1]}">${STATUS_CHIP[s][0]}</span>`;
  const DECISION = { accept: 'accepted', revise: 'revision requested', reject: 'not accepted' };
  const ratingsTable = (type, ratings) => `<ul class="ratings">${NR.REVIEW[type].criteria.map(c => `<li><span>${esc(c[1])}</span>${ratingChip((ratings || {})[c[0]])}</li>`).join('')}</ul>`;

  // one review as shown to authors / publicly (label, recommendation, ratings, comments)
  const reviewCard = (type, r) => `<div class="rvcard"><div class="rv-head"><strong>${esc(r.label)}</strong><span class="chip">${esc(recLabel(type, r.recommendation))}</span></div>${ratingsTable(type, r.ratings)}<p style="white-space:pre-wrap">${esc(r.comments)}</p></div>`;

  // ---------- public open reviews (accepted reports whose reviewers agreed to publication) ----------
  NR.openReviewSection = r => {
    const list = r.review && r.review.reports;
    if (!list || !list.length) return '';
    return `<section><h2>Open peer review</h2><p class="muted small">These reviews are published with the reviewers' consent. Accepted ${esc(fmtDate(r.review.date))} by ${esc(r.review.editor)}.</p>${list.map(x => reviewCard('report', x)).join('')}</section>`;
  };

  // ---------- the authors' panel ----------
  NR.reviewAuthorPanel = async (type, s) => {
    let progress = null, decisions = [];
    try { [progress, decisions] = await Promise.all([NR.api.getReviewProgress(type, s.id), NR.api.getDecisions(type, s.id)]); } catch (e) { return ''; }
    if (!progress || (!progress.state && !decisions.length)) return '';
    const last = decisions[decisions.length - 1];
    let head = '';
    if (progress.state === 'in_review') head = `<p><strong>Under review</strong> — round ${esc(progress.round)}: ${esc(progress.invited)} reviewer${progress.invited === 1 ? '' : 's'} invited, ${esc(progress.submitted)} report${progress.submitted === 1 ? '' : 's'} received. The editors will decide once the reports are in.</p>`;
    else if (progress.state === 'revision') head = `<p><strong>The editors ask for a revision.</strong> Please read the letter and the reviewers' comments below, then submit a revised version. The review restarts when you do.</p>`;
    else if (progress.state === 'declined') head = '<p><strong>The plan was not accepted in principle.</strong> You can register an improved plan.</p>';
    else if (last) head = `<p><strong>Review concluded:</strong> ${esc(DECISION[last.decision])}.</p>`;
    const canRevise = type === 'report' && progress.state === 'revision';
    return `<section class="card review-box no-print" id="review-author"><h3>${type === 'report' ? 'Peer review' : 'Plan review'}</h3>${head}
      ${canRevise ? `<p><a class="btn" href="#/submit?revise=${esc(s.id)}">Submit the revised version</a></p>` : ''}
      ${decisions.slice().reverse().map(d => `<details ${d === last ? 'open' : ''}><summary>Decision, round ${esc(d.round)}: <strong>${esc(DECISION[d.decision])}</strong> <span class="muted small">· ${esc(d.decidedBy || '')} · ${fmtDate(d.decidedAt)}</span></summary>
        <p style="white-space:pre-wrap">${esc(d.letter)}</p>${(d.reviews || []).map(r => reviewCard(type, r)).join('') || '<p class="muted small">No reviews were released.</p>'}</details>`).join('')}</section>`;
  };

  // ---------- the editor's panel ----------
  NR.reviewStaffPanel = async (type, s) => {
    let ov;
    try { ov = await NR.api.getReviewOverview(type, s.id); } catch (e) { return `<section class="card review-box no-print"><p class="err">${esc(e.message)}</p></section>`; }
    const cur = ov.assignments.filter(a => a.round === ov.round), submitted = cur.filter(a => a.status === 'submitted');
    const eligible = type === 'report' ? (NR.isPublic(s) && s.status === 'preprint') : s.status === 'registered';
    const local = NR.backend === 'local';
    let body = '';
    if (!ov.state) {
      body = eligible ? `<p class="muted">No review under way.${s.reviewRequested ? ' <strong>The authors have asked for one.</strong>' : ''}</p><button class="btn" id="rv-start">Start ${type === 'protocol' ? 'plan ' : 'peer '}review</button>`
        : `<p class="muted">No review under way.</p>`;
    } else if (ov.state === 'declined') {
      body = '<p class="muted">The plan was declined. The authors can register an improved plan; this one cannot be reviewed again.</p>';
    } else {
      if (ov.state === 'revision') body += '<p class="muted"><strong>Waiting for the authors’ revision.</strong> When they submit it, the next round starts automatically.</p>';
      if (ov.state === 'in_review') {
        body += `<h4>Reviewers — round ${esc(ov.round)}</h4>
          ${cur.length ? `<div class="table-wrap"><table class="tbl compact"><thead><tr><th>Reviewer</th><th>Status</th></tr></thead><tbody>${cur.map(a => `<tr><td>${esc(a.name)}<br><span class="muted small">${esc(a.email)}</span>${a.declineReason ? `<br><span class="small">“${esc(a.declineReason)}”</span>` : ''}
            <div class="btnrow" style="margin-top:8px">${a.status === 'invited' || a.status === 'accepted' ? `<button class="btn ghost sm" data-cancel="${esc(a.id)}">Cancel</button>` : ''}${local && a.token && a.status !== 'cancelled' ? `<button class="btn secondary sm" data-copy="${esc(a.token)}">Copy link</button><a class="btn sm" href="#/review/${esc(a.token)}">Open as reviewer</a>` : ''}</div></td><td>${statusChip(a.status)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Nobody invited yet.</p>'}
          <form id="rv-invite" class="grid c3" style="margin-top:12px;align-items:end" novalidate>
            <div><label for="rv-name">Name</label><input type="text" id="rv-name" autocomplete="off"></div><div><label for="rv-email">E-mail</label><input type="email" id="rv-email" autocomplete="off"></div>
            <div><button class="btn secondary" type="submit">Invite reviewer</button></div><p class="err" id="rv-err" style="grid-column:1/-1"></p></form>
          ${ov.assignments.some(a => a.round < ov.round) ? '<p><button class="btn ghost sm" id="rv-reinvite">Re-invite the reviewers of the previous round</button></p>' : ''}
          <h4>Reviews received (${submitted.length} of ${cur.filter(a => a.status !== 'declined').length})</h4>
          ${submitted.map(a => `<div class="rvcard"><div class="rv-head"><strong>${esc(a.name)}</strong><span class="chip">${esc(recLabel(type, a.review.recommendation))}</span><label class="check" style="margin:0 0 0 auto"><input type="checkbox" data-release="${esc(a.id)}" checked> release to authors</label></div>
              ${ratingsTable(type, a.review.ratings)}<p style="white-space:pre-wrap"><strong>To the authors:</strong> ${esc(a.review.commentsAuthors)}</p>
              ${a.review.commentsEditor ? `<p class="confidential" style="white-space:pre-wrap"><strong>Confidential, to the editor:</strong> ${esc(a.review.commentsEditor)}</p>` : ''}
              <p class="muted small" style="margin:0">Open review: ${esc({ none: 'keep confidential', anonymous: 'publish anonymously', signed: 'publish with name' }[a.review.openReview] || '')}</p></div>`).join('') || '<p class="muted">No review has been submitted yet.</p>'}
          <h4>Decision</h4>
          <form id="rv-decide" novalidate>
            <div class="field"><label for="rv-dec">Decision</label><select id="rv-dec"><option value="">Select…</option>
              <option value="accept">${type === 'protocol' ? 'Accept in principle' : 'Accept — mark as peer reviewed'}</option>${type === 'report' ? '<option value="revise">Request a revision</option>' : ''}<option value="reject">${type === 'protocol' ? 'Decline the plan' : 'Do not accept (the preprint stays online)'}</option></select>
              <p class="hint">Accepting needs ${esc(ov.minReviews)} submitted review${ov.minReviews === 1 ? '' : 's'}; you have ${submitted.length}.</p></div>
            <div class="field"><label for="rv-letter">Letter to the authors</label><textarea id="rv-letter" rows="5" placeholder="Summarise the decision and what the authors should do next."></textarea></div>
            <p class="err" id="rv-derr"></p><button class="btn" type="submit" ${submitted.length ? '' : 'disabled'}>Send decision</button></form>`;
      }
    }
    const history = ov.decisions.length ? `<h4>History</h4><ul class="related">${ov.decisions.map(d => `<li>Round ${esc(d.round)}: <strong>${esc(DECISION[d.decision])}</strong> — ${esc(d.decidedBy || '')}, ${fmtDate(d.decidedAt)}</li>`).join('')}</ul>` : '';
    return `<section class="card review-box no-print" id="review-staff"><div class="section-head"><h3>Editorial · ${type === 'protocol' ? 'plan review' : 'peer review'}</h3>${ov.state ? `<span class="chip chip-prereg">round ${esc(ov.round)} · ${esc({ in_review: 'in review', revision: 'awaiting revision', declined: 'declined' }[ov.state])}</span>` : ''}</div>${body}${history}</section>`;
  };

  NR.bindReviewStaffPanel = (type, s) => {
    const act = async (fn, msg) => { try { await fn(); if (msg) NR.toast(msg); NR.dispatch(); } catch (e) { NR.toast(e.message); } };
    const st = $('#rv-start'); if (st) st.onclick = () => act(() => NR.api.startReview(type, s.id), 'Review started');
    $$('[data-cancel]').forEach(b => { b.onclick = () => act(() => NR.api.cancelAssignment(b.dataset.cancel), 'Invitation cancelled'); });
    $$('[data-copy]').forEach(b => { b.onclick = () => NR.copy(`${location.href.split('#')[0]}#/review/${b.dataset.copy}`); });
    const re = $('#rv-reinvite'); if (re) re.onclick = () => act(async () => { const n = await NR.api.reinviteReviewers(type, s.id); NR.toast(`${n} reviewer${n === 1 ? '' : 's'} re-invited`); });
    const inv = $('#rv-invite');
    if (inv) inv.onsubmit = async e => {
      e.preventDefault();
      try { await NR.api.inviteReviewer(type, s.id, { name: $('#rv-name').value, email: $('#rv-email').value }); NR.toast('Invitation sent'); NR.dispatch(); } catch (err) { $('#rv-err').textContent = err.message; }
    };
    const dec = $('#rv-decide');
    if (dec) dec.onsubmit = async e => {
      e.preventDefault();
      const decision = $('#rv-dec').value, err = $('#rv-derr');
      if (!decision) return void (err.textContent = 'Please choose a decision.');
      if (!confirm(`Send this decision to the authors (${DECISION[decision]})? This cannot be undone.`)) return;
      const release = $$('[data-release]:checked').map(c => c.dataset.release);
      try { await NR.api.decide(type, s.id, { decision, letter: $('#rv-letter').value, release }); NR.toast('Decision sent'); NR.dispatch(); } catch (e2) { err.textContent = e2.message; }
    };
  };

  // ---------- the reviewer page (personal link from the invitation e-mail) ----------
  NR.route(/^#\/review\/([^/?]+)$/, async token => {
    NR.setTitle('Review');
    let ctx = null;
    try { ctx = await NR.api.getReviewContext(token); } catch (e) { console.error(e); }
    if (!ctx) return NR.setMain('<div class="wrap page"><h1>Invalid link</h1><p class="muted">This review link is not valid.</p><p><a href="#/">Home</a></p></div>');
    const type = ctx.subjectType, sub = ctx.subject, crit = NR.REVIEW[type];
    const link = `#/${type === 'protocol' ? 'protocol' : 'report'}/${esc(ctx.subjectId)}`;
    const summary = `<div class="card"><p class="muted small" style="margin-bottom:6px">${esc(sub.subfield || '')} · ${(sub.authors || []).map(esc).join(', ')}${sub.nExperiments ? ` · ${esc(sub.nExperiments)} experiments` : ''}</p>
      <div class="prose" style="font-family:var(--serif)">${NR.paras(sub.abstract)}${type === 'protocol' ? `<p><strong>Hypothesis.</strong> ${esc(sub.hypothesis)}</p><p><strong>Design.</strong> ${esc(sub.design)}</p>` : ''}</div>
      <p><a class="btn secondary" href="${link}" target="_blank" rel="noopener">Read the full ${typeName(type)} ↗</a></p></div>`;
    let body = '';
    if (ctx.state === 'invited') {
      body = `<div class="card"><h2>Will you review this ${typeName(type)}?</h2>
        <p>Open File Drawer publishes complete projects whose hypothesis was not confirmed. Reviewers check whether the project was well designed and honestly reported — <em>not</em> whether the result was positive. The review is a short checklist plus comments, usually about an hour.</p>
        <p class="muted small">You do not need an account. Please decline if you have a conflict of interest (collaboration or shared institution in the last three years, a personal relationship, a competing project).</p>
        <div class="btnrow"><button class="btn" id="rv-yes">Accept — I will review it</button><button class="btn ghost" id="rv-no">Decline</button></div>
        <div id="rv-why" hidden style="margin-top:12px"><label for="rv-reason">Reason (optional, visible to the editors)</label><textarea id="rv-reason" rows="2"></textarea><button class="btn secondary sm" id="rv-no2" style="margin-top:8px">Confirm decline</button></div></div>`;
    } else if (ctx.state === 'accepted') {
      body = `<form class="card" id="rv-form" novalidate><h2>Your review</h2>
        <label class="check"><input type="checkbox" name="coi"> <span>I have no conflict of interest with the authors or this work.</span></label><p class="err" data-err="coi"></p>
        <div class="field"><span class="label">Checklist</span>${crit.criteria.map(([k, label, hint]) => `<div class="crit"><div><strong>${esc(label)}</strong><div class="hint" style="margin:0">${esc(hint)}</div></div>
          <div class="rate">${NR.RATINGS.map(([v, l]) => `<label class="check" style="margin:0"><input type="radio" name="r-${k}" value="${v}"> <span>${l}</span></label>`).join('')}</div></div>`).join('')}<p class="err" data-err="ratings"></p></div>
        <div class="field"><label for="rv-rec">Recommendation</label><select id="rv-rec" name="rec"><option value="">Select…</option>${crit.recs.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select><p class="err" data-err="rec"></p></div>
        <div class="field"><label for="rv-ca">Comments to the authors</label><p class="hint">Specific and constructive: what is convincing, what is missing, what should change.</p><textarea id="rv-ca" name="ca" rows="7"></textarea><p class="err" data-err="ca"></p></div>
        <div class="field"><label for="rv-ce">Confidential comments to the editor (optional)</label><textarea id="rv-ce" name="ce" rows="3"></textarea></div>
        <div class="field"><span class="label">Open review</span>${NR.OPEN_REVIEW.map(([v, l], i) => `<label class="check"><input type="radio" name="open" value="${v}" ${i === 0 ? 'checked' : ''}> <span>${esc(l)}</span></label>`).join('')}</div>
        <p class="err" id="rv-ferr"></p><button class="btn" type="submit">Submit review</button></form>`;
    } else if (ctx.state === 'submitted') {
      body = `<div class="notice peer"><p><strong>Thank you — your review was submitted.</strong> The editors will take it from here.</p></div>
        ${ctx.review ? `<div class="card"><h3>Your review</h3>${ratingsTable(type, ctx.review.ratings)}<p><strong>Recommendation:</strong> ${esc(recLabel(type, ctx.review.recommendation))}</p><p style="white-space:pre-wrap">${esc(ctx.review.commentsAuthors)}</p></div>` : ''}`;
    } else if (ctx.state === 'declined') body = '<div class="notice neutral"><p>You declined this invitation. Thank you for letting us know.</p></div>';
    else if (ctx.state === 'cancelled') body = '<div class="notice neutral"><p>This invitation was withdrawn by the editors.</p></div>';
    else body = '<div class="notice neutral"><p>This review round is closed. Thank you for your interest.</p></div>';

    NR.setMain(`<div class="wrap page" style="max-width:820px">
      <div class="eyebrow">${type === 'protocol' ? 'Plan review' : 'Peer review'} · round ${esc(ctx.round)}</div>
      <h1>${esc(sub.title)}</h1><p class="muted">Hello ${esc(ctx.reviewerName.split(' ')[0])} — thank you for helping with quality control.</p>
      ${NR.backend === 'local' ? '<div class="demo-box"><strong>Prototype:</strong> reviewers normally arrive through the personal link in the invitation e-mail.</div>' : ''}
      ${summary}${body}</div>`);

    const act = fn => async () => { try { await fn(); NR.dispatch(); } catch (e) { NR.toast(e.message); } };
    const yes = $('#rv-yes'); if (yes) yes.onclick = act(() => NR.api.respondToInvitation(token, true));
    const no = $('#rv-no'); if (no) no.onclick = () => { $('#rv-why').hidden = false; no.hidden = true; };
    const no2 = $('#rv-no2'); if (no2) no2.onclick = act(() => NR.api.respondToInvitation(token, false, $('#rv-reason').value));
    const form = $('#rv-form');
    if (form) form.onsubmit = async e => {
      e.preventDefault();
      const ratings = {}; crit.criteria.forEach(([k]) => { const c = form.querySelector(`[name="r-${k}"]:checked`); if (c) ratings[k] = c.value; });
      const errs = {};
      if (!form.coi.checked) errs.coi = 'Please confirm — or decline the invitation if you cannot.';
      if (Object.keys(ratings).length < crit.criteria.length) errs.ratings = 'Please rate every point of the checklist.';
      if (!form.rec.value) errs.rec = 'Please choose a recommendation.';
      if (form.ca.value.trim().length < 20) errs.ca = 'Please write comments for the authors (at least a few sentences).';
      if (!NR.showErrors(form, errs)) return;
      try { await NR.api.submitReview(token, { coi: true, ratings, recommendation: form.rec.value, commentsAuthors: form.ca.value.trim(), commentsEditor: form.ce.value.trim(), openReview: form.querySelector('[name=open]:checked').value }); NR.toast('Review submitted'); NR.dispatch(); }
      catch (err) { $('#rv-ferr').textContent = err.message; }
    };
  });
})();
