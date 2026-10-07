// Enterprise workspace: a private knowledge base of one organisation (#/workspace). Entries are readable by the members of the organisation only;
// the database enforces that (see "ENTERPRISE SECURITY MODEL" in supabase/schema.sql). Views read through NR.DB and write through NR.api.org*.
(function () {
  'use strict';
  const NR = window.NR, DB = NR.DB, Auth = window.NR_AUTH, { $, $$, esc, fmtDate } = NR, F = NR.f, SVG = NR.SVG;
  const LOCK = NR.ICON.lock.replace('width="22" height="22"', 'width="18" height="18"');
  const snip = (t, n = 230) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const when = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  const ACTIONS = { 'org.create': 'created the organisation', 'entry.create': 'created entry', 'entry.update': 'changed entry', 'entry.archive': 'archived entry', 'entry.restore': 'restored entry', 'entry.delete': 'deleted entry',
    'entry.release': 'marked as released', 'member.invite': 'invited', 'member.add': 'added', 'member.join': 'joined', 'member.role': 'changed the role of', 'member.remove': 'removed', 'invite.revoke': 'withdrew the invitation of' };

  // ---------- who is looking at which organisation ----------
  function noWorkspace() {
    NR.setTitle('Workspace');
    NR.setMain(`<div class="wrap page" style="max-width:760px"><div class="eyebrow">Enterprise workspace</div><h1>You are not a member of a workspace</h1>
      <p class="muted">A workspace is the private knowledge base of one organisation. Members are invited by the administrators of their organisation and sign in with the e-mail address that was invited.</p>
      <div class="btnrow"><a class="btn" href="#/enterprise">About Enterprise</a>${NR.backend === 'local' ? '<button class="btn secondary" id="ws-demo" type="button">Sign in as demo workspace member</button>' : ''}</div></div>`);
    const b = $('#ws-demo');
    if (b) b.onclick = async () => { Auth.signInDemoMember(); await NR.refreshOrgs(); NR.renderNav(); NR.dispatch(); };
  }
  async function context() {
    const u = NR.requireAuth(location.hash); if (!u) return null;
    await NR.refreshOrgs();
    if (!NR.orgs.length) { noWorkspace(); return null; }
    let want = NR.query().get('org'); try { want = want || sessionStorage.getItem('ofd.org'); } catch (e) {}
    const org = NR.orgs.find(o => o.id === want) || NR.orgs[0];
    try { sessionStorage.setItem('ofd.org', org.id); } catch (e) {}
    return { u, org, orgs: NR.orgs, admin: org.role === 'admin' };
  }
  const isMe = (m, u) => m.id === u.id || (!!u.email && !!m.email && m.email.toLowerCase() === u.email.toLowerCase());
  // the author of an entry: by account on the server, by e-mail address in the demo
  const authorOf = (e, u) => (e.authorId ? e.authorId === u.id : !!e.authorKey && e.authorKey === String(u.email || '').toLowerCase());

  function shell(ctx, active, inner) {
    const tabs = [['', 'Entries', '#/workspace'], ['members', 'Members', '#/workspace/members']].concat(ctx.admin ? [['log', 'Activity', '#/workspace/log']] : []);
    return `<div class="wrap page">
      <div class="ws-head"><div><div class="eyebrow">Enterprise workspace</div><h1>${esc(ctx.org.name)}</h1></div>
        <div class="ws-actions">${ctx.orgs.length > 1 ? `<label class="sr" for="ws-org">Organisation</label><select id="ws-org">${ctx.orgs.map(o => `<option value="${esc(o.id)}" ${o.id === ctx.org.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>` : ''}<a class="btn" href="#/workspace/new">New entry</a></div></div>
      <div class="conf-banner" role="note">${LOCK}<span><strong>Confidential.</strong> Only members of ${esc(ctx.org.name)} can see this. Nothing here appears in the public archive, the API or any export unless you release it.</span></div>
      ${NR.backend === 'local' ? '<div class="demo-box"><strong>Prototype:</strong> a fictional organisation with invented entries; everything is stored in your browser only.</div>' : ''}
      <nav class="tabs" aria-label="Workspace sections">${tabs.map(([k, l, h]) => `<a href="${h}" class="${k === active ? 'active' : ''}">${l}</a>`).join('')}</nav>
      ${inner}</div>`;
  }
  const bindShell = ctx => { const s = $('#ws-org'); if (s) s.onchange = () => { try { sessionStorage.setItem('ofd.org', s.value); } catch (e) {} location.hash = '#/workspace?org=' + encodeURIComponent(s.value); }; };

  // ---------- list and dead-end check ----------
  const entryCard = e => {
    const n = NR.totalN(e);
    return `<article class="rcard${e.archived ? ' archived' : ''}">
      <div class="meta"><span class="chip chip-conf">${LOCK}Confidential</span><span class="tag">${esc(NR.CATEGORIES[e.failureCategory] || e.failureCategory)}</span><span class="tag">${esc(e.reactionClass)}</span>${e.project ? `<span class="tag">${esc(e.project)}</span>` : ''}${e.archived ? '<span class="chip">archived</span>' : ''}${e.releasedReportId ? `<a class="chip chip-ok" href="#/report/${esc(e.releasedReportId)}">${SVG.check}released as ${esc(e.releasedReportId)}</a>` : ''}</div>
      <h3><a href="#/workspace/entry/${esc(e.id)}">${esc(e.title)}</a></h3>
      <p class="abs">${esc(snip(e.outcome))}</p>
      <div class="meta"><span>${esc(e.authorName)}</span><span>·</span><span>${fmtDate(e.createdAt)}</span><span>·</span><span class="mono">${esc(e.id)}</span>${n ? `<span>·</span><span>${n} experiments</span>` : ''}</div></article>`;
  };
  const hayE = e => NR.norm([e.title, e.project, e.goal, e.approach, e.outcome, e.learnings, e.recommendation, e.reactionClass, e.subfield, (e.tags || []).join(' '), NR.CATEGORIES[e.failureCategory], e.authorName, e.id, (e.series || []).map(s => s.label + ' ' + s.catalyst).join(' ')].join(' '));
  const hayR = r => NR.norm([r.title, r.abstract, r.id, r.system, r.reactionClass, r.subfield, (r.keywords || []).join(' '), (r.series || []).map(s => s.label + ' ' + s.catalyst).join(' ')].join(' '));

  async function listPage(ctx) {
    const [entries, reports, meta] = await Promise.all([DB.entries.forOrg(ctx.org.id), DB.reports.list(), NR.loadMeta()]);
    const pub = reports.filter(NR.isPublic), authors = [...new Set(entries.map(e => e.authorName))].sort();
    const st = { q: NR.query().get('q') || '', cat: '', reaction: '', author: '', show: 'active' };
    NR.setMain(shell(ctx, '', `
      <form class="deadend" id="ws-check" role="search"><label for="ws-q">Dead-end check <span class="muted">— in your workspace and in the public archive</span></label>
        <div class="de-row"><input type="search" id="ws-q" placeholder="Reaction, catalyst, substrate, project…" autocomplete="off" value="${esc(st.q)}"></div></form>
      <div class="ws-filters">
        <div><label for="ws-cat">Failure category</label><select id="ws-cat"><option value="">All</option>${Object.entries(NR.CATEGORIES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
        <div><label for="ws-reaction">Reaction class</label><select id="ws-reaction"><option value="">All</option>${NR.REACTIONS.map(v => `<option>${esc(v)}</option>`).join('')}</select></div>
        <div><label for="ws-author">Author</label><select id="ws-author"><option value="">Everyone</option>${authors.map(a => `<option>${esc(a)}</option>`).join('')}</select></div>
        <div><label for="ws-show">Show</label><select id="ws-show"><option value="active">Active entries</option><option value="archived">Archived</option><option value="all">All</option></select></div>
      </div>
      <p class="muted small" id="ws-count" aria-live="polite"></p>
      <div id="ws-results" class="rlist"></div>
      <div id="ws-public"></div>`));
    bindShell(ctx);
    const update = () => {
      const toks = NR.norm(st.q).split(/\s+/).filter(Boolean);
      const rows = entries.filter(e => (st.show === 'all' || (st.show === 'archived') === !!e.archived) && (!st.cat || e.failureCategory === st.cat) && (!st.reaction || e.reactionClass === st.reaction)
        && (!st.author || e.authorName === st.author) && toks.every(t => hayE(e).includes(t)));
      const archived = entries.filter(e => e.archived).length;
      $('#ws-count').textContent = `${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}${st.show === 'active' && archived ? ` · ${archived} archived` : ''}`;
      $('#ws-results').innerHTML = rows.length ? rows.map(entryCard).join('') : `<div class="empty"><strong>${st.q.trim() ? 'Nothing in your workspace for this.' : entries.length ? 'No entries match these filters.' : 'No entries yet.'}</strong>
        ${entries.length ? '' : '<p class="muted">Capture the first failed attempt: it takes a few minutes and nobody has to repeat it.</p>'}<div class="de-actions"><a class="btn" href="#/workspace/new">New entry</a></div></div>`;
      const hits = toks.length ? pub.filter(r => toks.every(t => hayR(r).includes(t))) : [];
      $('#ws-public').innerHTML = toks.length ? `<h2 style="margin-top:28px">In the public archive <span class="muted small">· ${hits.length} report${hits.length === 1 ? '' : 's'}</span></h2>
        ${hits.length ? `<div class="rlist">${hits.slice(0, 3).map(r => NR.reportCard(r, meta)).join('')}</div>${hits.length > 3 ? `<p><a href="#/archive?q=${encodeURIComponent(st.q)}">See all ${hits.length} in the archive →</a></p>` : ''}` : '<p class="muted">Nothing public on this either. That does not prove it works.</p>'}` : '';
    };
    $('#ws-check').onsubmit = e => e.preventDefault();
    $('#ws-q').oninput = e => { st.q = e.target.value; update(); };
    [['cat', 'cat'], ['reaction', 'reaction'], ['author', 'author'], ['show', 'show']].forEach(([id, k]) => { $('#ws-' + id).onchange = e => { st[k] = e.target.value; update(); }; });
    update();
  }

  // ---------- entry form ----------
  function formPage(ctx, entry) {
    const e = entry || {}, edit = !!entry;
    NR.setTitle(edit ? 'Edit entry' : 'New entry');
    let exps = (e.experiments || []).slice(), series = (e.series || []).slice(), info = null;
    NR.setMain(shell(ctx, '', `<h2>${edit ? 'Edit entry' : 'New entry'}</h2>
      <form class="card" id="ef" novalidate>
        ${F.text('Title', 'title', { value: e.title, hint: 'What was tried and that it did not work, e.g. “… gives only hydrodehalogenation”.' })}
        <div class="grid c2">${F.text('Project or target (optional)', 'project', { value: e.project, ph: 'e.g. internal programme code' })}${F.text('Tags (comma-separated)', 'tags', { value: (e.tags || []).join(', '), ph: 'suzuki, scale-up' })}</div>
        <div class="grid c2">${F.select('Reaction class', 'reactionClass', NR.REACTIONS, { value: e.reactionClass })}${F.select('Subfield', 'subfield', NR.SUBFIELDS, { value: e.subfield })}</div>
        ${F.area('Goal', 'goal', { value: e.goal, rows: 3, hint: 'What were you trying to achieve, and why did it look plausible?' })}
        ${F.area('What was done', 'approach', { value: e.approach, rows: 5, hint: 'Conditions, reagents, scale, number of runs.' })}
        ${F.area('What happened', 'outcome', { value: e.outcome, rows: 4, hint: 'The key numbers, and what you saw instead of the expected result.' })}
        ${F.select('Failure category', 'failureCategory', Object.entries(NR.CATEGORIES), { value: e.failureCategory })}
        ${F.area('Why it failed and what we learned', 'learnings', { value: e.learnings, rows: 4 })}
        ${F.area('Recommendation for colleagues (optional)', 'recommendation', { value: e.recommendation, rows: 3, hint: 'For example: “Do not retry with Pd, try SNAr first.”' })}
        <div class="grid c2">${F.select('What the results measure', 'metric', NR.METRICS, { value: e.metric || 'Yield (%)' })}${F.text('Success threshold in % (optional)', 'threshold', { value: e.threshold == null ? '' : e.threshold, type: 'number', attrs: 'step="any"' })}</div>
        ${F.area('Links (optional, one per line)', 'links', { value: (e.links || []).join('\n'), rows: 2, hint: 'ELN entry, internal wiki page, literature.' })}
        <div class="field"><span class="label">Experiment table (optional)</span>
          <p class="hint">A CSV file with one row per experiment gives you the overview plot and structured data. <a href="#" id="csv-template">Download the template</a>.</p>
          <input type="file" id="csv-file" accept=".csv,.tsv,.txt,text/csv"><p class="small muted" id="csv-info"></p><p class="err" data-err="csv"></p></div>
        <p class="err" id="ws-err"></p>
        <div class="btnrow"><button class="btn" type="submit">${edit ? 'Save changes' : 'Save entry'}</button><a class="btn ghost" href="${edit ? '#/workspace/entry/' + esc(e.id) : '#/workspace'}">Cancel</a></div>
      </form>`));
    bindShell(ctx);
    const f = $('#ef'), showInfo = () => { $('#csv-info').innerHTML = exps.length ? `${exps.length} experiment${exps.length === 1 ? '' : 's'} in ${series.length} series. <button class="linklike" type="button" id="csv-clear">Remove</button>${info && info.warnings.length ? '<br>' + info.warnings.map(esc).join('<br>') : ''}` : 'No experiment table attached.'; const c = $('#csv-clear'); if (c) c.onclick = () => { exps = []; series = []; info = null; showInfo(); }; };
    showInfo();
    $('#csv-template').onclick = ev => { ev.preventDefault(); NR.exp.download('open-file-drawer-experiments-template.csv', NR.csv.template(), 'text/csv;charset=utf-8'); };
    $('#csv-file').onchange = async () => {
      const file = $('#csv-file').files[0]; if (!file) return;
      try {
        if (file.size > 3 * 1024 * 1024) throw new Error('The file is larger than 3 MB.');
        const res = NR.csv.importText(await file.text());
        if (res.experiments.length > 2000) throw new Error('More than 2,000 rows: please split the entry.');
        exps = res.experiments; series = res.series; info = res.info; $('[data-err=csv]').textContent = ''; showInfo();
      } catch (err) { $('[data-err=csv]').textContent = err.message; }
    };
    f.onsubmit = async ev => {
      ev.preventDefault();
      const v = n => f.elements[n].value.trim();
      const payload = { title: v('title'), project: v('project'), tags: v('tags').split(',').map(s => s.trim()).filter(Boolean), reactionClass: v('reactionClass'), subfield: v('subfield'), goal: v('goal'), approach: v('approach'),
        outcome: v('outcome'), failureCategory: v('failureCategory'), learnings: v('learnings'), recommendation: v('recommendation'), metric: v('metric'), threshold: v('threshold') === '' ? null : +v('threshold'),
        links: v('links').split('\n').map(s => s.trim()).filter(Boolean), series, experiments: exps };
      if (!NR.showErrors(f, NR.validateEntry(payload))) return;
      const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
      try {
        let id = e.id;
        if (edit) await NR.api.orgUpdateEntry(e.id, payload); else id = await NR.api.orgCreateEntry(ctx.org.id, payload);
        NR.toast(edit ? 'Entry saved' : 'Entry added'); location.hash = '#/workspace/entry/' + id;
      } catch (err) { btn.disabled = false; $('#ws-err').textContent = err.message; NR.toast(err.message); }
    };
  }

  // ---------- one entry ----------
  async function detailPage(ctx, e) {
    const canChange = ctx.admin || authorOf(e, ctx.u);
    const log = ctx.admin ? (await DB.audit.forOrg(ctx.org.id)).filter(a => a.target === e.id) : [];
    const paras = t => NR.paras(t) || '<p class="muted">—</p>';
    const rows = (e.series || []).map(s => `<tr${s.isControl ? ' class="row-control"' : ''}><td>${esc(s.label)}${s.isControl ? ' <span class="tag">control</span>' : ''}</td><td class="num">${esc(s.n)}</td><td>${esc(s.catalyst)}</td><td>${esc(s.solvent)}</td><td class="num">${esc(s.temp)}</td><td class="num">${esc(s.time)}</td><td class="num">${NR.isNum(s.best) ? esc(NR.pct(s.best)) : '—'}</td><td>${esc(s.outcome)}</td></tr>`).join('');
    NR.setTitle(e.title);
    NR.setMain(shell(ctx, '', `
      <p class="small"><a href="#/workspace">← All entries</a></p>
      <div class="meta"><span class="chip chip-conf">${LOCK}Confidential</span><span class="tag">${esc(NR.CATEGORIES[e.failureCategory] || e.failureCategory)}</span><span class="tag">${esc(e.reactionClass)}</span><span class="tag">${esc(e.subfield)}</span>${e.project ? `<span class="tag">${esc(e.project)}</span>` : ''}${e.archived ? '<span class="chip">archived</span>' : ''}${e.releasedReportId ? `<a class="chip chip-ok" href="#/report/${esc(e.releasedReportId)}">${SVG.check}released as ${esc(e.releasedReportId)}</a>` : ''}</div>
      <h2 style="font-size:1.8rem;margin-top:10px">${esc(e.title)}</h2>
      <p class="muted small">${esc(e.authorName)} · added ${fmtDate(e.createdAt)}${e.updatedAt && e.updatedAt !== e.createdAt ? ` · changed ${fmtDate(e.updatedAt)}` : ''} · <span class="mono">${esc(e.id)}</span></p>
      ${canChange ? `<div class="btnrow" style="margin:6px 0 18px"><a class="btn secondary sm" href="#/workspace/edit/${esc(e.id)}">Edit</a><button class="btn secondary sm" id="ws-archive" type="button">${e.archived ? 'Restore' : 'Archive'}</button>${ctx.admin ? '<button class="btn ghost sm" id="ws-delete" type="button">Delete</button>' : ''}</div>` : ''}
      <div class="prose entry">
        <h3>Goal</h3>${paras(e.goal)}<h3>What was done</h3>${paras(e.approach)}<h3>What happened</h3>${paras(e.outcome)}
        <h3>Why it failed and what we learned</h3>${paras(e.learnings)}
        ${e.recommendation ? `<h3>Recommendation</h3>${paras(e.recommendation)}` : ''}
      </div>
      ${(e.tags || []).length ? `<p class="chips">${e.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</p>` : ''}
      ${(e.links || []).length ? `<h3>Links</h3><ul>${e.links.map(l => `<li>${NR.safeUrl(l) ? `<a href="${esc(NR.safeUrl(l))}" rel="noopener" target="_blank">${esc(l)}</a>` : esc(l)}</li>`).join('')}</ul>` : ''}
      ${(e.series || []).length || (e.experiments || []).length ? `<h3>Experiments</h3>${NR.plot({ ...e, metric: e.metric || 'Result (%)' })}<div class="table-wrap"><table><thead><tr><th>Series</th><th class="num">n</th><th>Catalyst / reagents</th><th>Solvent</th><th class="num">T (°C)</th><th class="num">t (h)</th><th class="num">Best (%)</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table></div>
        ${(e.experiments || []).length ? '<div class="btnrow" style="margin-top:10px"><button class="btn secondary sm" id="ws-csv" type="button">Download experiments (CSV)</button></div>' : ''}` : ''}
      ${canChange && !e.releasedReportId ? `<section class="release card"><h3>Make it public?</h3><p class="muted" style="margin:0 0 10px">This entry stays confidential unless you decide otherwise. If your organisation agrees to share it, you can start a public report from it: the text is copied into a draft, you remove everything confidential, and nothing is published until you submit it with the usual confirmations.</p><button class="btn secondary" id="ws-release" type="button">Prepare a public report</button></section>` : ''}
      ${ctx.admin && log.length ? `<h3 style="margin-top:24px">History of this entry</h3><ul class="plainlist small">${log.map(a => `<li><span class="muted">${esc(when(a.at))}</span> · ${esc(a.actorName)} ${esc(ACTIONS[a.action] || a.action)}</li>`).join('')}</ul>` : ''}`));
    bindShell(ctx);
    const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
    on('#ws-archive', async () => { try { await NR.api.orgSetArchived(e.id, !e.archived); NR.toast(e.archived ? 'Entry restored' : 'Entry archived'); NR.dispatch(); } catch (err) { NR.toast(err.message); } });
    on('#ws-delete', async () => { if (!confirm('Delete this entry for good? This cannot be undone. (Archiving keeps it.)')) return; try { await NR.api.orgDeleteEntry(e.id); NR.toast('Entry deleted'); location.hash = '#/workspace'; } catch (err) { NR.toast(err.message); } });
    on('#ws-csv', () => NR.exp.download(`${e.id}-experiments.csv`, NR.exp.csv(e), 'text/csv;charset=utf-8'));
    on('#ws-release', () => { if (confirm('Start a public report from this entry?\n\nThe text is copied into a draft. Nothing is published until you complete it and submit it, and the report must not contain anything confidential.')) NR.startReportFromEntry(e, ctx.org.name); });
  }

  // ---------- members ----------
  async function membersPage(ctx) {
    NR.setTitle('Members');
    const [members, invites] = await Promise.all([DB.orgs.members(ctx.org.id), ctx.admin ? DB.orgs.invites(ctx.org.id) : []]);
    const admins = members.filter(m => m.role === 'admin').length;
    NR.setMain(shell(ctx, 'members', `
      <h2>Members <span class="muted small">· ${members.length}</span></h2>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Name</th><th>E-mail</th><th>Role</th><th>Since</th><th></th></tr></thead><tbody>
        ${members.map(m => { const me = isMe(m, ctx.u), last = m.role === 'admin' && admins <= 1; return `<tr><td><strong>${esc(m.name || '—')}</strong>${me ? ' <span class="tag">you</span>' : ''}</td><td class="small">${esc(m.email)}</td>
          <td>${ctx.admin ? `<select data-role="${esc(m.id)}" aria-label="Role of ${esc(m.name || m.email)}" ${last ? 'disabled title="An organisation needs at least one administrator."' : ''}><option value="admin" ${m.role === 'admin' ? 'selected' : ''}>Administrator</option><option value="member" ${m.role === 'member' ? 'selected' : ''}>Member</option></select>` : (m.role === 'admin' ? 'Administrator' : 'Member')}</td>
          <td class="small nowrap">${fmtDate(m.addedAt)}</td>
          <td>${(ctx.admin && !me && !last) || (me && !last) ? `<button class="btn ghost sm" data-remove="${esc(m.id)}">${me ? 'Leave' : 'Remove'}</button>` : ''}</td></tr>`; }).join('')}
      </tbody></table></div>
      ${ctx.admin ? `
      <h2 style="margin-top:28px">Invitations <span class="muted small">· ${invites.length}</span></h2>
      ${invites.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>E-mail</th><th>Role</th><th>Invited</th><th></th></tr></thead><tbody>${invites.map(i => `<tr><td>${esc(i.email)}</td><td>${i.role === 'admin' ? 'Administrator' : 'Member'}</td><td class="small nowrap">${fmtDate(i.invitedAt)}</td><td><button class="btn ghost sm" data-revoke="${esc(i.email)}">Withdraw</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No open invitations.</p>'}
      <form class="card" id="mf" novalidate style="margin-top:18px"><h3>Add a person</h3>
        <div class="grid c2">${F.text('Work e-mail', 'email', { type: 'email' })}<div class="field"><label for="f-role">Role</label><select id="f-role" name="role"><option value="member">Member</option><option value="admin">Administrator</option></select></div></div>
        <p class="muted small">${NR.backend === 'local' ? 'Prototype: no e-mail is sent. ' : ''}The person signs in with a one-time code sent to this address and joins automatically; the address does not have to be a university address. Nobody outside the organisation can read your entries.</p>
        <button class="btn" type="submit">Add</button></form>` : '<p class="muted small" style="margin-top:18px">Administrators add and remove people.</p>'}`));
    bindShell(ctx);
    const act = async (fn, msg) => { try { await fn(); NR.toast(msg); await NR.refreshOrgs(); NR.dispatch(); } catch (err) { NR.toast(err.message); NR.dispatch(); } };
    $$('[data-role]').forEach(s => { s.onchange = () => act(() => NR.api.orgSetMemberRole(ctx.org.id, s.dataset.role, s.value), 'Role changed'); });
    $$('[data-remove]').forEach(b => { b.onclick = async () => {
      const m = members.find(x => String(x.id) === b.dataset.remove), self = m && isMe(m, ctx.u);
      if (!confirm(self ? 'Leave this workspace? You lose access to its entries.' : `Remove ${m ? m.name || m.email : 'this person'} from the workspace?`)) return;
      try { await NR.api.orgRemoveMember(ctx.org.id, b.dataset.remove); NR.toast(self ? 'You left the workspace' : 'Member removed'); await NR.refreshOrgs(); if (self) { NR.renderNav(); location.hash = '#/'; } else NR.dispatch(); } catch (err) { NR.toast(err.message); }
    }; });
    $$('[data-revoke]').forEach(b => { b.onclick = () => act(() => NR.api.orgRevokeInvite(ctx.org.id, b.dataset.revoke), 'Invitation withdrawn'); });
    const mf = $('#mf');
    if (mf) mf.onsubmit = async ev => {
      ev.preventDefault();
      const email = mf.elements.email.value.trim(), role = mf.elements.role.value;
      if (!NR.showErrors(mf, /^\S+@\S+\.\S+$/.test(email) ? {} : { email: 'Please enter a valid e-mail address.' })) return;
      try { const r = await NR.api.orgAddMember(ctx.org.id, email, role); NR.toast(r && r.status === 'member' ? 'Added to the workspace' : 'Invitation recorded'); NR.dispatch(); } catch (err) { NR.toast(err.message); }
    };
  }

  // ---------- activity log (administrators) ----------
  async function logPage(ctx) {
    NR.setTitle('Activity');
    if (!ctx.admin) return NR.setMain(shell(ctx, 'log', '<p class="muted">The activity log is for administrators.</p>'));
    const log = (await DB.audit.forOrg(ctx.org.id)).slice(0, 200);
    const what = a => {
      const t = String(a.target || ''), isEntry = /^E-\d+$/.test(t);
      return `${esc(ACTIONS[a.action] || a.action)} ${isEntry && !/delete/.test(a.action) ? `<a class="mono" href="#/workspace/entry/${esc(t)}">${esc(t)}</a>` : `<span class="mono">${esc(t)}</span>`}${a.detail && isEntry ? ` <span class="muted">· ${esc(snip(a.detail, 90))}</span>` : a.detail && !isEntry ? ` <span class="muted">· ${esc(snip(a.detail, 60))}</span>` : ''}`;
    };
    NR.setMain(shell(ctx, 'log', `<h2>Activity <span class="muted small">· changes only; reading is not logged</span></h2>
      ${log.length ? `<div class="table-wrap"><table class="tbl compact"><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead><tbody>${log.map(a => `<tr><td class="small nowrap">${esc(when(a.at))}</td><td>${esc(a.actorName)}</td><td class="small">${what(a)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Nothing yet.</div>'}`));
    bindShell(ctx);
  }

  // ---------- routes ----------
  NR.route(/^#\/workspace(?:\/(new|members|log))?(?:\?.*)?$/, async sub => {
    NR.setTitle('Workspace');
    const ctx = await context(); if (!ctx) return;
    if (sub === 'new') return formPage(ctx, null);
    if (sub === 'members') return membersPage(ctx);
    if (sub === 'log') return logPage(ctx);
    return listPage(ctx);
  });
  NR.route(/^#\/workspace\/(entry|edit)\/([^/?]+)(?:\?.*)?$/, async (kind, id) => {
    NR.setTitle('Workspace');
    const u = NR.requireAuth(location.hash); if (!u) return;
    await NR.refreshOrgs();
    if (!NR.orgs.length) return noWorkspace();
    const e = await DB.entries.get(decodeURIComponent(id)), org = e && NR.orgs.find(o => o.id === e.orgId);
    if (!e || !org) { NR.setTitle('Entry not found'); return NR.setMain('<div class="wrap page"><h1>Entry not found</h1><p class="muted">It may not exist, or it belongs to an organisation you are not a member of.</p><p><a href="#/workspace">Back to the workspace</a></p></div>'); }
    try { sessionStorage.setItem('ofd.org', org.id); } catch (err) {}
    const ctx = { u, org, orgs: NR.orgs, admin: org.role === 'admin' };
    if (kind === 'edit') {
      if (!ctx.admin && !authorOf(e, u)) return NR.setMain(shell(ctx, '', '<p class="muted">Only the author or an administrator can change this entry.</p>'));
      return formPage(ctx, e);
    }
    return detailPage(ctx, e);
  });
})();
