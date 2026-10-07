// Wanted board: "has anyone tried …?" requests (demand) linked to reports (supply).
(function () {
  'use strict';
  const NR = window.NR, DB = NR.DB, Auth = window.NR_AUTH, { $, $$, esc, fmtDate, SVG } = NR;
  const state = { q: '', sort: 'top', status: 'all' };

  NR.route(/^#\/wanted(?:\?.*)?$/, async () => {
    NR.setTitle('Wanted');
    Object.assign(state, { q: '', sort: 'top', status: 'all' });
    const u = NR.me(), key = u && Auth.idOf(u);
    const newTitle = NR.query().get('new');
    let [items, reports, protos] = await Promise.all([DB.wanted.list(), DB.reports.list(), DB.protocols.list()]);
    const repById = Object.fromEntries(reports.filter(NR.isPublic).map(r => [r.id, r]));
    const protoById = Object.fromEntries(protos.map(p => [p.id, p]));
    const mineReports = u ? reports.filter(r => NR.isOwner(r, u) && NR.isPublic(r)) : [];
    const mineProtos = u ? protos.filter(p => NR.isOwner(p, u)) : [];

    NR.setMain(`
    <div class="wrap page">
      <h1>Wanted</h1>
      <p class="muted" style="max-width:720px">What do chemists need to know doesn't work? Ask a question, add “me too”, or share what you have. Requests with many “me too” show where documented null results are most valuable.</p>
      <details class="card newreq" ${newTitle ? 'open' : ''}><summary><strong>Ask the community</strong> — “Has anyone tried …?”</summary>
        <form id="wf" novalidate style="margin-top:14px">
          ${NR.f.text('Your question', 'title', { value: newTitle || '', hint: 'One specific question — reaction, catalyst, substrate class.', ph: 'Has anyone made … work with …?' })}
          ${NR.f.area('Details (optional)', 'details', { rows: 3, hint: 'What are you planning? What have you already looked at?' })}
          ${NR.f.select('Reaction class', 'reactionClass', NR.REACTIONS)}
          <button class="btn" type="submit">${u ? 'Post request' : 'Sign in to post'}</button>
        </form>
      </details>
      <div class="grid c3" style="max-width:720px;margin:20px 0">
        <div><label for="wq" class="sr">Search</label><input type="search" id="wq" placeholder="Search requests…" value="${esc(state.q)}"></div>
        <div><label for="ws" class="sr">Sort</label><select id="ws"><option value="top" ${state.sort === 'top' ? 'selected' : ''}>Most wanted</option><option value="new" ${state.sort === 'new' ? 'selected' : ''}>Newest</option></select></div>
        <div><label for="wst" class="sr">Status</label><select id="wst"><option value="all">All</option><option value="open" ${state.status === 'open' ? 'selected' : ''}>Open</option><option value="answered" ${state.status === 'answered' ? 'selected' : ''}>Answered</option></select></div>
      </div>
      <div id="wlist" class="rlist"></div>
    </div>`);

    const card = w => {
      const on = NR.meTooMine(w, key);
      const linked = (w.responses || []).map(x => x.kind === 'protocol' ? ['protocol', protoById[x.id], x] : ['report', repById[x.id], x]).filter(([, o]) => o);
      const linkedIds = new Set((w.responses || []).map(x => x.id));
      const canLink = [...mineReports.map(r => ({ kind: 'report', id: r.id, title: r.title })), ...mineProtos.map(p => ({ kind: 'protocol', id: p.id, title: p.title }))].filter(o => !linkedIds.has(o.id));
      return `<article class="wcard" data-id="${esc(w.id)}">
        <button class="metoo ${on ? 'on' : ''}" data-metoo="${esc(w.id)}" aria-pressed="${on ? 'true' : 'false'}" title="I would also like to know this"><b>${NR.meTooCount(w)}</b><span>me too</span></button>
        <div class="wbody">
          <div class="chips"><span class="tag">${esc(w.reactionClass)}</span>${w.status === 'answered' ? `<span class="chip chip-ok">${SVG.check}answered</span>` : '<span class="chip">open</span>'}${w.demo ? '<span class="tag">demo</span>' : ''}</div>
          <h3>${esc(w.title)}</h3>
          ${w.details ? `<p class="muted">${esc(w.details)}</p>` : ''}
          ${linked.length ? `<ul class="related">${linked.map(([k, o]) => `<li>${k === 'report' ? 'Report' : 'Plan'}: <a href="#/${k === 'report' ? 'report' : 'protocol'}/${esc(o.id)}">${esc(o.title)}</a></li>`).join('')}</ul>` : ''}
          <div class="meta"><span>Asked by ${esc(w.by.name)}</span><span>·</span><span>${fmtDate(w.createdAt)}</span><span>·</span><button class="linklike small" data-have="${esc(w.id)}">I have data on this</button></div>
          <div class="have" data-panel="${esc(w.id)}" hidden>
            ${!u ? '<p class="small">Please <a href="#/login" data-login>sign in</a> to share.</p>' : `
            ${canLink.length ? `<div class="field"><label>Link something you already published</label><div class="btnrow"><select data-link-sel="${esc(w.id)}">${canLink.map(o => `<option value="${o.kind}:${esc(o.id)}">${esc(o.id)} — ${esc(o.title.slice(0, 70))}${o.title.length > 70 ? '…' : ''}</option>`).join('')}</select><button class="btn secondary sm" data-link="${esc(w.id)}">Link</button></div></div>` : ''}
            <a class="btn sm" href="#/submit?wanted=${esc(w.id)}">Write a new report for this</a>`}
          </div>
        </div></article>`;
    };
    const update = () => {
      const toks = NR.norm(state.q).split(/\s+/).filter(Boolean);
      const rows = items.filter(w => w.status !== 'withdrawn' && (state.status === 'all' || w.status === state.status) && toks.every(t => NR.norm(w.title + ' ' + w.details + ' ' + w.reactionClass).includes(t)))
        .sort((a, b) => state.sort === 'new' ? b.createdAt.localeCompare(a.createdAt) : NR.meTooCount(b) - NR.meTooCount(a));
      $('#wlist').innerHTML = rows.length ? rows.map(card).join('') : '<div class="empty">No requests match.</div>';
      bindCards();
    };
    const bindCards = () => {
      $$('[data-metoo]').forEach(b => b.onclick = async () => {
        if (!NR.requireAuth('#/wanted')) return;
        try { await NR.api.toggleMeToo(b.dataset.metoo); items = await DB.wanted.list(); update(); } catch (err) { NR.toast(err.message); }
      });
      $$('[data-have]').forEach(b => b.onclick = () => { const p = $(`[data-panel="${b.dataset.have}"]`); p.hidden = !p.hidden; });
      $$('[data-login]').forEach(a => a.onclick = () => { try { sessionStorage.setItem('nr.next', '#/wanted'); } catch (e) {} });
      $$('[data-link]').forEach(b => b.onclick = async () => {
        const wid = b.dataset.link, [kind, id] = $(`[data-link-sel="${wid}"]`).value.split(':');
        try { await NR.api.linkWantedResponse(wid, kind, id); NR.toast('Linked — thank you!'); items = await DB.wanted.list(); update(); } catch (err) { NR.toast(err.message); }
      });
    };
    $('#wq').oninput = e => { state.q = e.target.value; update(); };
    $('#ws').onchange = e => { state.sort = e.target.value; update(); };
    $('#wst').onchange = e => { state.status = e.target.value; update(); };
    const wf = $('#wf');
    wf.onsubmit = async e => {
      e.preventDefault();
      if (!NR.requireAuth('#/wanted?new=' + encodeURIComponent(wf.elements.title.value))) return;
      const v = n => wf.elements[n].value.trim(), errs = {};
      if (v('title').length < 15) errs.title = 'Please ask a specific question (at least a short sentence).';
      if (!v('reactionClass')) errs.reactionClass = 'Please choose a reaction class';
      if (!NR.showErrors(wf, errs)) return;
      try { await NR.api.createWanted({ title: v('title'), details: v('details'), reactionClass: v('reactionClass') }); NR.toast('Request posted'); NR.dispatch(); } catch (err) { NR.toast(err.message); }
    };
    update();
  });
})();
