// Staff desk (demo): validation board for the 30-day go/no-go test, lead pipeline, moderation, review queue.
// In production this must be protected by server-side roles — the demo only checks the local session.
(function () {
  'use strict';
  const NR = window.NR, DB = NR.DB, { $, $$, esc, fmtDate } = NR;
  const STAGES = {
    pilot: ['New', 'Contacted', 'Data received', 'Permission signed', 'Report ready', 'Published'],
    reviewer: ['New', 'Contacted', 'Accepted'],
    org: ['New', 'Contacted', 'Interested', 'Committed'],
    data: ['New', 'Contacted', 'Use case clear', 'Trial access', 'Committed'],
    enterprise: ['New', 'Contacted', 'Demo', 'Pilot workspace', 'Committed']
  };
  const TYPE_LABEL = { pilot: 'Research group', reviewer: 'Reviewer / editor', org: 'Institution / industry', data: 'Data request', enterprise: 'Enterprise request' };
  const TABS = [['validation', 'Validation'], ['pipeline', 'Pipeline'], ['organisations', 'Organisations'], ['moderation', 'Moderation'], ['reviews', 'Review queue']];

  NR.route(/^#\/desk(?:\?.*)?$/, async () => {
    NR.setTitle('Staff desk');
    const u = NR.me();
    if (!NR.isStaff(u)) return NR.setMain('<div class="wrap page"><h1>Staff desk</h1><p class="muted">This area is for editors and the founding team. <a href="#/login">Sign in as demo staff</a> to look around.</p></div>');
    const tab = NR.query().get('tab') || 'validation';
    const [leads, reports, protos, wanted, notes, flags] = await Promise.all([DB.leads.list(), DB.reports.list(), DB.protocols.list(), DB.wanted.list(), DB.notes.list(), DB.flags.list()]);
    reports.forEach(r => { r.flags = flags.filter(f => f.reportId === r.id); });
    const body = { validation, pipeline, organisations, moderation, reviews }[tab] || validation;
    NR.setMain(`<div class="wrap page"><h1>Staff desk</h1>
      ${NR.backend === 'local' ? '<div class="notice neutral"><p>Demo area. Entries marked <span class="tag">demo</span> are fictional. On the live site this is protected by server-side roles, and the lead data (names, e-mails) lives in a private table.</p></div>' : ''}
      <nav class="tabs" aria-label="Desk sections">${TABS.map(([k, l]) => `<a href="#/desk?tab=${k}" class="${k === tab ? 'active' : ''}">${l}</a>`).join('')}</nav>
      <div id="tab">${await body({ leads, reports, protos, wanted, notes })}</div></div>`);
    bindPipeline(leads); bindOrgs();
  });

  const stageIdx = l => STAGES[l.type].indexOf(l.stage);

  function validation({ leads, reports, protos, wanted, notes }) {
    const v = NR.cfg.validation, t = v.targets;
    const day = Math.max(1, Math.floor((Date.now() - new Date(v.start).getTime()) / 86400000) + 1);
    const pilot = leads.filter(l => l.type === 'pilot'), org = leads.filter(l => ['org', 'data', 'enterprise'].includes(l.type));      // everyone who could pay: institutions, Data and Enterprise requests
    const kpis = [
      ['Real datasets received', pilot.filter(l => stageIdx(l) >= 2).length, t.datasets, 'Pilot groups at “Data received” or later'],
      ['Permissions to use the data', pilot.filter(l => stageIdx(l) >= 3).length, t.permissions, 'Group leader approval at “Permission signed” or later'],
      ['Publishable reports', pilot.filter(l => stageIdx(l) >= 4).length, t.reports, 'At “Report ready” or later'],
      ['Payment commitments', org.filter(l => l.stage === 'Committed').length, t.commitments, 'Institution, Data or Enterprise requests at “Committed” (letter of intent / payment promise)']
    ];
    const met = kpis.filter(k => k[1] >= k[2]).length;
    const funnel = STAGES.pilot.map(s => [s, pilot.filter(l => l.stage === s).length]);
    const maxF = Math.max(1, ...funnel.map(f => f[1]));
    const pub = reports.filter(NR.isPublic);
    return `
      <div class="daybar"><strong>Day ${Math.min(day, v.days)} of ${v.days}</strong> <span class="muted">· started ${esc(fmtDate(v.start))}${day > v.days ? ' · test window over' : ''} · ${met} of 4 targets met</span></div>
      <div class="kpis">${kpis.map(([l, n, tg, h]) => `<div class="kpi ${n >= tg ? 'ok' : ''}"><span class="muted small">${l}</span><b>${n}<small> / ${tg}</small></b><div class="progress"><i style="width:${Math.min(100, n / tg * 100)}%"></i></div><span class="muted small">${h}</span></div>`).join('')}</div>
      <p class="muted small">Targets and start date are set in <span class="mono">js/config.js</span>. The numbers are computed from the pipeline stages — move leads along on the Pipeline tab.</p>
      <div class="split" style="margin-top:28px">
        <section><h2>Pilot funnel</h2>${funnel.map(([s, n]) => `<div class="fun"><span>${esc(s)}</span><div class="progress"><i style="width:${n / maxF * 100}%"></i></div><b>${n}</b></div>`).join('')}</section>
        <section><h2>Platform</h2><dl class="plain">
          <dt>Public reports</dt><dd>${pub.length}</dd><dt>Awaiting co-author confirmation</dt><dd>${reports.filter(r => r.visibility === 'pending').length}</dd>
          <dt>Registered plans</dt><dd>${protos.length}</dd><dt>Open wanted requests</dt><dd>${wanted.filter(w => w.status === 'open').length}</dd>
          <dt>Independent confirmations</dt><dd>${notes.filter(n => n.type === 'confirm').length}</dd><dt>Open flags</dt><dd>${reports.reduce((a, r) => a + (r.flags || []).length, 0)}</dd></dl></section>
      </div>`;
  }

  function pipeline({ leads }) {
    const rows = [...leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return `<div class="section-head"><h2>Pipeline <span class="muted">(${rows.length})</span></h2><button class="btn secondary sm" id="leads-csv">Export CSV</button></div>
      <div class="table-wrap"><table class="tbl" style="min-width:860px"><thead><tr><th>Date</th><th>Type</th><th>Who</th><th>Message</th><th>Stage</th><th>Internal notes</th></tr></thead><tbody>
      ${rows.map(l => `<tr data-lead="${esc(l.id)}"><td class="nowrap">${fmtDate(l.createdAt)}<br><span class="mono muted small">${esc(l.id)}</span></td><td>${TYPE_LABEL[l.type]}${l.demo ? ' <span class="tag">demo</span>' : ''}</td>
        <td><strong>${esc(l.name)}</strong><br><span class="muted small">${esc(l.institution)}${l.role ? ' · ' + esc(l.role) : ''}</span><br><span class="muted small">${esc(l.email)}</span></td>
        <td class="small">${esc(l.message || '').slice(0, 160)}${(l.message || '').length > 160 ? '…' : ''}${l.intent ? `<br><span class="chip">${esc(l.intent)}</span>` : ''}${l.budget ? ` <span class="chip">${esc(l.budget)}</span>` : ''}${[l.useCase, l.volume, l.teamSize, l.needs].filter(Boolean).map(x => ` <span class="chip">${esc(x)}</span>`).join('')}${l.approval ? `<br><span class="muted">Approval: ${esc(l.approval)}</span>` : ''}</td>
        <td><select data-stage>${STAGES[l.type].map(s => `<option ${l.stage === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
        <td><textarea rows="2" data-notes placeholder="Notes…">${esc(l.notes || '')}</textarea></td></tr>`).join('')}
      </tbody></table></div>`;
  }
  function bindPipeline(leads) {
    $$('[data-lead]').forEach(tr => {
      const id = tr.dataset.lead;
      $('[data-stage]', tr).onchange = async e => { try { await NR.api.updateLead(id, { stage: e.target.value }); NR.toast('Stage updated'); } catch (err) { NR.toast(err.message); } };
      $('[data-notes]', tr).onchange = async e => { try { await NR.api.updateLead(id, { notes: e.target.value }); NR.toast('Notes saved'); } catch (err) { NR.toast(err.message); } };
    });
    const csv = $('#leads-csv'); if (csv) csv.onclick = () => NR.exp.download('open-file-drawer-leads.csv', NR.exp.leadsCsv(leads), 'text/csv;charset=utf-8');
    $$('[data-resolve]').forEach(b => { b.onclick = async () => { try { await NR.api.resolveFlags(b.dataset.resolve); NR.toast('Flags resolved'); NR.dispatch(); } catch (err) { NR.toast(err.message); } }; });
  }

  // Enterprise workspaces: staff create an organisation and invite its FIRST administrator, nothing more (the database refuses the rest)
  async function organisations() {
    const orgs = await DB.orgs.overview();
    const open = await Promise.all(orgs.map(async o => (o.admins ? [] : DB.orgs.invites(o.id))));
    return `<div class="section-head"><h2>Organisations <span class="muted">(${orgs.length})</span></h2></div>
      <p class="muted small" style="max-width:760px">Enterprise workspaces. Staff create an organisation and invite its <strong>first administrator</strong>; after that the organisation manages its own members. Staff accounts cannot read workspace entries or the activity log.</p>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Organisation</th><th class="num">Members</th><th class="num">Admins</th><th class="num">Open invitations</th><th>First administrator</th></tr></thead><tbody>
      ${orgs.length ? orgs.map((o, i) => `<tr><td><strong>${esc(o.name)}</strong>${o.demo ? ' <span class="tag">demo</span>' : ''}<br><span class="mono muted small">${esc(o.id)} · created ${fmtDate(o.createdAt)}</span></td><td class="num">${o.members}</td><td class="num">${o.admins}</td><td class="num">${o.invites}</td>
        <td>${o.admins ? '<span class="muted small">has an administrator</span>' : `${open[i].map(x => `<div class="small">${esc(x.email)} <button class="btn ghost sm" data-revoke="${esc(o.id)}|${esc(x.email)}">Withdraw</button></div>`).join('')}<form class="inline-form" data-first-admin="${esc(o.id)}"><input type="email" placeholder="e-mail address" aria-label="E-mail of the first administrator of ${esc(o.name)}" required><button class="btn secondary sm" type="submit">Invite</button></form>`}</td></tr>`).join('') : '<tr><td colspan="5"><div class="empty">No organisations yet.</div></td></tr>'}
      </tbody></table></div>
      <form class="card" id="org-new" style="margin-top:20px" novalidate><h3>Create an organisation</h3><div class="field" style="max-width:420px"><label for="org-name">Name</label><input type="text" id="org-name"><p class="err" id="org-err"></p></div><button class="btn" type="submit">Create</button></form>`;
  }
  function bindOrgs() {
    const f = $('#org-new'); if (!f) return;
    f.onsubmit = async e => { e.preventDefault(); try { await NR.api.staffCreateOrg($('#org-name').value.trim()); NR.toast('Organisation created'); NR.dispatch(); } catch (err) { $('#org-err').textContent = err.message; } };
    $$('[data-first-admin]').forEach(form => { form.onsubmit = async e => { e.preventDefault(); try { const r = await NR.api.staffAddOrgMember(form.dataset.firstAdmin, form.elements[0].value.trim()); NR.toast(r && r.status === 'member' ? 'Added as administrator' : 'Invitation recorded'); NR.dispatch(); } catch (err) { NR.toast(err.message); } }; });
    $$('[data-revoke]').forEach(b => { b.onclick = async () => { const [org, email] = b.dataset.revoke.split('|'); try { await NR.api.staffRevokeOrgInvite(org, email); NR.toast('Invitation withdrawn'); NR.dispatch(); } catch (err) { NR.toast(err.message); } }; });
  }

  function moderation({ reports }) {
    const flagged = reports.filter(r => (r.flags || []).length), pending = reports.filter(r => r.visibility === 'pending');
    return `<h2>Flagged reports</h2>${flagged.length ? flagged.map(r => `<div class="card" style="margin-bottom:12px"><a href="#/report/${esc(r.id)}"><strong>${esc(r.id)}</strong> — ${esc(r.title)}</a>${r.flags.map(f => `<p class="small" style="margin:8px 0 0">⚑ ${esc(f.reason)} <span class="muted">— ${esc(f.by)}, ${fmtDate(f.at)}</span></p>`).join('')}<button class="btn secondary sm" data-resolve="${esc(r.id)}" style="margin-top:10px">Mark flags as resolved</button></div>`).join('') : '<div class="empty">No open flags.</div>'}
      <h2 style="margin-top:28px">Waiting for co-author confirmation</h2>${pending.length ? pending.map(r => `<div class="card" style="margin-bottom:12px"><a href="#/report/${esc(r.id)}"><strong>${esc(r.id)}</strong> — ${esc(r.title)}</a><p class="small muted" style="margin:6px 0 0">Requested ${fmtDate(r.confirmation.requestedAt)} · ${r.confirmation.required.filter(x => x.confirmedAt).length} of ${r.confirmation.required.length} confirmed</p></div>`).join('') : '<div class="empty">Nothing waiting.</div>'}`;
  }

  async function reviews({ reports, protos }) {
    const items = [...reports.filter(NR.isPublic).map(r => ({ type: 'report', s: r })), ...protos.map(p => ({ type: 'protocol', s: p }))];
    const requested = items.filter(x => x.s.reviewRequested && !x.s.reviewState);
    const running = items.filter(x => x.s.reviewState === 'in_review' || x.s.reviewState === 'revision');
    const infos = await Promise.all(running.map(x => NR.api.getReviewOverview(x.type, x.s.id).catch(() => null)));
    const link = x => `#/${x.type === 'protocol' ? 'protocol' : 'report'}/${esc(x.s.id)}`;
    const card = (x, extra) => `<div class="card" style="margin-bottom:12px"><a href="${link(x)}"><strong>${esc(x.s.id)}</strong> — ${esc(x.s.title)}</a>${extra || ''}</div>`;
    const runCards = running.map((x, i) => {
      const ov = infos[i];
      if (!ov) return card(x);
      const cur = ov.assignments.filter(a => a.round === ov.round && a.status !== 'cancelled'), done = cur.filter(a => a.status === 'submitted').length;
      const ready = ov.state === 'in_review' && done >= ov.minReviews;
      return card(x, `<p class="small muted" style="margin:6px 0 0">${x.type === 'protocol' ? 'Plan review' : 'Peer review'} · round ${esc(ov.round)} · ${ov.state === 'revision' ? 'waiting for the authors’ revision' : `${done} of ${cur.length} reviews in`} ${ready ? '<span class="chip chip-ok">ready for a decision</span>' : ''}${ov.state === 'in_review' && !cur.length ? ' <span class="chip chip-warn">no reviewers invited yet</span>' : ''}</p>`);
    });
    const list = (arr, fn) => arr.length ? arr.map(fn).join('') : '<div class="empty">None.</div>';
    return `<h2>Review requested</h2>${list(requested, x => card(x, `<p class="small muted" style="margin:6px 0 0">${x.type === 'protocol' ? 'Plan review' : 'Peer review'} requested by the authors — open it to start the review.</p>`))}
      <h2 style="margin-top:28px">Under way</h2>${list(runCards, c => c)}
      <p class="muted small" style="margin-top:20px">Open an item to invite reviewers, read the reviews and send the decision.</p>`;
  }
})();
