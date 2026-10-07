// Login and "my account". Local demo: simulated verification. Supabase: real ORCID (OIDC) and e-mail one-time code.
(function () {
  'use strict';
  const NR = window.NR, DB = NR.DB, Auth = window.NR_AUTH, { $, esc } = NR;
  const nextUrl = fallback => { try { return sessionStorage.getItem('nr.next') || fallback; } catch (e) { return fallback; } };
  const clearNext = () => { try { sessionStorage.removeItem('nr.next'); } catch (e) {} };

  NR.route(/^#\/login$/, () => (NR.backend === 'supabase' ? loginRemote() : loginLocal()));

  // ---------- real sign-in (Supabase) ----------
  function loginRemote() {
    NR.setTitle('Sign in');
    if (NR.me()) { location.hash = nextUrl('#/me'); return; }
    NR.setMain(`
    <div class="wrap page" style="max-width:900px">
      <h1>Sign in to publish</h1>
      <p class="muted">Reports, plans and requests can only be posted by verified researchers, so there is always a traceable person behind them. Reading is always open.</p>
      <div class="login">
        <div class="card">
          <h3><span class="orcid-dot">iD</span> ORCID</h3>
          <p class="muted small">Recommended. You sign in on orcid.org; we never see your ORCID password.</p>
          <button class="btn" id="orcid-btn" type="button">Continue with ORCID</button>
          <p class="err" id="o-err"></p>
        </div>
        <form class="card" id="f-mail" novalidate>
          <h3>Institutional e-mail</h3>
          <p class="muted small">We send a 6-digit code to your university or institute address, or to the address your organisation invited to its workspace.</p>
          <div id="mail-step1">
            <div class="field"><label for="m-mail">E-mail</label><input type="email" id="m-mail" placeholder="name@uni-example.de" autocomplete="email"><p class="err" id="m-err"></p></div>
            <div class="field"><label for="m-name">Name (shown on reports)</label><input type="text" id="m-name" autocomplete="name"></div>
            <button class="btn" type="submit">Send code</button>
          </div>
          <div id="mail-step2" hidden>
            <p class="small">We sent a code to <strong id="sent-to"></strong>. It is valid for a short time.</p>
            <div class="field"><label for="m-code">6-digit code</label><input type="text" id="m-code" inputmode="numeric" maxlength="8" autocomplete="one-time-code"><p class="err" id="c-err"></p></div>
            <button class="btn" type="submit">Verify and sign in</button>
          </div>
        </form>
      </div>
    </div>`);
    $('#orcid-btn').onclick = async () => {
      try { sessionStorage.setItem('nr.oauth', '1'); sessionStorage.setItem('nr.next', nextUrl('#/submit')); } catch (e) {}
      const { error } = await Auth.signInWithOrcid();
      if (error) $('#o-err').textContent = error.message;
    };
    let step = 1, email = '';
    $('#f-mail').onsubmit = async e => {
      e.preventDefault();
      const btn = e.submitter || $('#f-mail button[type=submit]:not([hidden])');
      if (step === 1) {
        email = $('#m-mail').value.trim(); const name = $('#m-name').value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) return void ($('#m-err').textContent = 'Please enter a valid e-mail address.');
        if (name.length < 2) return void ($('#m-err').textContent = 'Please enter your name.');
        $('#m-err').textContent = '';
        try { await Auth.startEmail({ email, name }); } catch (err) { return void ($('#m-err').textContent = err.message); }
        $('#sent-to').textContent = email; $('#mail-step1').hidden = true; $('#mail-step2').hidden = false; step = 2;
      } else {
        try { await Auth.confirmEmail(email, $('#m-code').value.trim()); } catch (err) { return void ($('#c-err').textContent = 'That code did not work: ' + err.message); }
        NR.renderNav(); NR.toast('Signed in'); const n = nextUrl('#/me'); clearNext(); location.hash = n;
      }
    };
  }

  // ---------- local demo sign-in ----------
  function loginLocal() {
    NR.setTitle('Sign in');
    const next = nextUrl('#/submit');
    NR.setMain(`
    <div class="wrap page" style="max-width:900px">
      <h1>Sign in to publish</h1>
      <p class="muted">Reports, plans and requests can only be posted by verified researchers, so there is always a traceable person behind them. Reading is always open.</p>
      <div class="demo-box"><strong>Prototype:</strong> nothing is verified here. On the live site ORCID redirects to orcid.org (OAuth) and the e-mail code is actually sent. To try it, any valid-looking ORCID iD works, e.g. <span class="mono">0000-0002-1825-0097</span>.</div>
      <div class="login">
        <form class="card" id="f-orcid" novalidate>
          <h3><span class="orcid-dot">iD</span> ORCID iD</h3>
          <p class="muted small">Recommended. Links your work to your public research record.</p>
          <div class="field"><label for="o-id">ORCID iD</label><input type="text" id="o-id" placeholder="0000-0002-1825-0097" autocomplete="off"><p class="err" id="o-err"></p></div>
          <div class="field"><label for="o-name">Name (shown on reports)</label><input type="text" id="o-name" autocomplete="name"></div>
          <button class="btn" type="submit">Continue with ORCID</button>
        </form>
        <form class="card" id="f-mail" novalidate>
          <h3>Institutional e-mail</h3>
          <p class="muted small">Use your university or research-institute address.</p>
          <div id="mail-step1">
            <div class="field"><label for="m-mail">E-mail</label><input type="email" id="m-mail" placeholder="name@uni-example.de" autocomplete="email"><p class="err" id="m-err"></p></div>
            <div class="field"><label for="m-name">Name (shown on reports)</label><input type="text" id="m-name"></div>
            <button class="btn" type="submit">Send verification code</button>
          </div>
          <div id="mail-step2" hidden>
            <div class="demo-box">Demo: your code is <strong class="mono" id="demo-code"></strong></div>
            <div class="field"><label for="m-code">6-digit code</label><input type="text" id="m-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code"><p class="err" id="c-err"></p></div>
            <button class="btn" type="submit">Verify and sign in</button>
          </div>
        </form>
      </div>
      <p class="small muted" style="margin-top:20px">Trying the editorial side? <button class="linklike" id="demo-editor">Sign in as demo staff (editor &amp; desk)</button><br>Trying a private workspace (Enterprise)? <button class="linklike" id="demo-member">Sign in as demo workspace member</button></p>
    </div>`);
    const done = () => { NR.renderNav(); NR.toast('Signed in'); clearNext(); location.hash = next; };
    $('#f-orcid').onsubmit = e => {
      e.preventDefault();
      const id = $('#o-id').value, name = $('#o-name').value.trim();
      if (!Auth.isValidOrcid(id)) return void ($('#o-err').textContent = 'Not a valid ORCID iD (format 0000-0000-0000-000X, with correct check digit).');
      if (!name) return void ($('#o-err').textContent = 'Please enter your name.');
      Auth.signInOrcid({ orcid: id, name }); done();
    };
    let step = 1;
    $('#f-mail').onsubmit = e => {
      e.preventDefault();
      if (step === 1) {
        const mail = $('#m-mail').value, name = $('#m-name').value.trim();
        if (!Auth.isAcademicEmail(mail) && !Auth.hasInvite(mail)) return void ($('#m-err').textContent = 'This does not look like an institutional address (e.g. .edu, .ac.uk, uni-….de), and no workspace has invited it.');
        if (!name) return void ($('#m-err').textContent = 'Please enter your name.');
        $('#demo-code').textContent = Auth.startEmail({ email: mail, name });
        $('#mail-step1').hidden = true; $('#mail-step2').hidden = false; step = 2;
      } else {
        if (!Auth.confirmEmail($('#m-code').value)) return void ($('#c-err').textContent = 'Code does not match.');
        done();
      }
    };
    $('#demo-editor').onclick = () => { Auth.signInDemoEditor(); NR.renderNav(); NR.toast('Signed in as demo staff'); location.hash = '#/desk'; };
    $('#demo-member').onclick = async () => { Auth.signInDemoMember(); await NR.refreshOrgs(); NR.renderNav(); NR.toast('Signed in as a member of the demo organisation'); clearNext(); location.hash = '#/workspace'; };
  }

  // ---------- my account ----------
  NR.route(/^#\/me$/, async () => {
    const u = NR.me();
    if (!u) { NR.requireAuth('#/me'); return; }
    NR.setTitle('My account');
    if (!u.name) return completeProfile(u);                  // first sign-in with ORCID: ask for the name to show on reports
    const [reports, protocols, wanted] = await Promise.all([DB.reports.list(), DB.protocols.list(), DB.wanted.list()]);
    const mine = reports.filter(r => NR.isOwner(r, u)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const myP = protocols.filter(p => NR.isOwner(p, u)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const myW = wanted.filter(w => NR.wantedMine(w, u));
    const meta = await NR.loadMeta();
    await NR.ensureOrgs();
    NR.setMain(`<div class="wrap page"><h1>My account</h1>
      <p class="muted">${esc(u.name)} · ${u.method === 'orcid' ? (u.orcid ? `ORCID ${esc(u.orcid)}` : 'signed in with ORCID') : esc(u.email)}</p>
      ${NR.orgs.length ? `<div class="notice neutral"><p>You are a member of <strong>${NR.orgs.map(o => esc(o.name)).join(', ')}</strong>. <a href="#/workspace">Open the workspace →</a></p></div>` : ''}
      ${NR.isStaff(u) ? '<div class="notice neutral"><p>You are signed in as staff. The <a href="#/desk">staff desk</a> shows the validation board, pipeline and moderation.</p></div>' : `
      <section class="section"><div class="section-head"><h2>My reports</h2><a class="btn sm" href="#/submit">Submit new</a></div>
        <div class="rlist">${mine.length ? mine.map(r => NR.reportCard(r, meta)).join('') : '<div class="empty">You have not published a report yet.</div>'}</div></section>
      <section class="section" data-feature="registry"><div class="section-head"><h2>My registered plans</h2><a class="btn sm secondary" href="#/register">Register a plan</a></div>
        <div class="rlist">${myP.length ? myP.map(NR.protocolCard).join('') : '<div class="empty">No registered plans yet.</div>'}</div></section>
      <section class="section" data-feature="wanted"><div class="section-head"><h2>My requests</h2><a class="btn sm secondary" href="#/wanted">Open the wanted board</a></div>
        <div class="rlist">${myW.length ? myW.map(w => `<article class="rcard"><div class="meta"><span class="tag">${esc(w.reactionClass)}</span><span class="muted">${NR.meTooCount(w)} × me too</span></div><h3><a href="#/wanted">${esc(w.title)}</a></h3></article>`).join('') : '<div class="empty">You have not asked for anything yet.</div>'}</div></section>`}
    </div>`);
  });

  function completeProfile(u) {
    NR.setMain(`<div class="wrap page" style="max-width:640px"><h1>Welcome</h1>
      <p class="muted">One last step: how should your name appear on reports, plans and notes? ${u.orcid ? `It will be shown next to your ORCID iD <span class="mono">${esc(u.orcid)}</span>.` : ''}</p>
      <form class="card" id="pf" novalidate>
        ${NR.f.text('Your name', 'name', { value: '' })}
        ${NR.f.text('Institution (optional)', 'institution', { value: u.institution || '' })}
        <button class="btn" type="submit">Save and continue</button>
      </form></div>`);
    const form = $('#pf');
    form.onsubmit = async e => {
      e.preventDefault();
      const name = form.elements.name.value.trim();
      if (!NR.showErrors(form, name.length < 2 ? { name: 'Please enter your name.' } : {})) return;
      try {
        await NR.api.updateProfile({ name, institution: form.elements.institution.value.trim() });
        await Auth.refreshProfile();
        NR.renderNav(); const n = nextUrl('#/me'), target = n === '#/me' ? '#/' : n; clearNext(); if (location.hash === target) NR.dispatch(); else location.hash = target;
      } catch (err) { NR.toast(err.message); }
    };
  }
})();
