// Join forms: pilot groups and reviewers / founding editors (the contact forms of the products are in v-products.js). All submissions become leads (see desk).
(function () {
  'use strict';
  const NR = window.NR, { $, esc, SVG } = NR, F = NR.f;
  const EMAIL = /^\S+@\S+\.\S+$/;

  // Shared form handler: validates required fields, sends a lead through NR.api, replaces the form with a thank-you note.
  // A hidden "website" field is a honeypot for bots (the server silently drops submissions that fill it in).
  function wire(form, type, required, extra = () => ({})) {
    form.insertAdjacentHTML('beforeend', '<div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>');
    form.onsubmit = async e => {
      e.preventDefault();
      const v = n => (form.elements[n] ? form.elements[n].value.trim() : ''), errs = {};
      required.forEach(k => { if (!v(k)) errs[k] = 'Required'; });
      if (v('email') && !EMAIL.test(v('email'))) errs.email = 'Please enter a valid e-mail address.';
      if (!form.elements.consent.checked) errs.consent = 'Please agree so we can contact you.';
      if (!NR.showErrors(form, errs)) return;
      const payload = { name: v('name'), email: v('email'), institution: v('institution'), message: v('message'), consent: true, website: v('website'), ...extra(v, form) };
      try { await NR.api.submitLead(type, payload); } catch (err) { return NR.toast(err.message); }
      form.outerHTML = `<div class="notice peer" id="thanks">${SVG.peer.replace('<svg', '<svg width="20" height="20"')}<p><strong>Thank you, ${esc(payload.name.split(' ')[0])}.</strong> We will get back to you by e-mail.${NR.backend === 'local' ? ' <span class="muted">(Prototype: your entry is stored only in this browser, not sent anywhere.)</span>' : ''}</p></div>`;
    };
  }
  NR.joinForm = { wire, consent: label => consent(label) };
  const consent = label => F.check(label || 'I agree that Open File Drawer may contact me about this request and store these details for that purpose. I can withdraw at any time.', 'consent');

  // ---------- pilot ----------
  NR.route(/^#\/pilot$/, () => {
    NR.setTitle('Pilot programme');
    NR.setMain(`<div class="wrap page" style="max-width:860px">
      <div class="eyebrow">For research groups</div>
      <h1>Turn a closed project into a citable report</h1>
      <p class="lead muted" style="font-size:1.15rem">We are looking for a small number of groups with a completed, well-designed project that did not give the expected result. During the pilot we do the heavy lifting with you — and it is free.</p>
      <div class="cards3" style="margin:28px 0">
        <div class="card"><h3>What we do</h3><p class="muted">Turn your spreadsheet / ELN export into a structured report with an overview graphic, together with you. Our aim: less than an hour of your own time once the data are in a table.</p></div>
        <div class="card"><h3>What you get</h3><p class="muted">A citable, labelled preprint with a stable ID, optional peer review, and a visible output for a project that would otherwise stay in a drawer.</p></div>
        <div class="card"><h3>What we ask</h3><p class="muted">A finished project, your group leader's approval to publish, and honest feedback on what was hard.</p></div>
      </div>
      <h2>Apply</h2>
      <form class="card" id="pf" novalidate>
        <div class="grid c2">${F.text('Name', 'name')}${F.text('E-mail (institutional)', 'email', { type: 'email' })}</div>
        <div class="grid c2">${F.text('Institution', 'institution')}${F.select('Your role', 'role', ['PhD student', 'Postdoc', 'Group leader (PI)', 'Other'])}</div>
        <div class="grid c2">${F.select('Field', 'field', NR.SUBFIELDS)}${F.select('Approximate number of experiments', 'experiments', ['< 50', '50–200', '200–1000', '> 1000'])}</div>
        ${F.select('Approval to publish', 'approval', ['I am the group leader', 'Yes, my group leader agrees', 'I will ask my group leader', 'Not sure'], { hint: 'Data belong to the group and institution. We only publish with the group leader’s approval.' })}
        ${F.area('Which project did not work — and what did you try?', 'message', { rows: 5, hint: 'A few sentences: question, approach, why you think it failed. No confidential details needed yet.' })}
        ${consent()}
        <button class="btn" type="submit">Apply for the pilot</button>
      </form></div>`);
    wire($('#pf'), 'pilot', ['name', 'email', 'institution', 'role', 'field', 'experiments', 'approval', 'message'], v => ({ role: v('role'), field: v('field'), experiments: v('experiments'), approval: v('approval') }));
  });

  // ---------- reviewers & board ----------
  const AREAS = [['Organic synthesis & catalysis', 2], ['Photochemistry & electrochemistry', 1], ['Inorganic, organometallic & materials', 1], ['Analytical chemistry & data', 1], ['Computational + experimental chemistry', 1], ['Research integrity & open science', 1]];
  NR.route(/^#\/(?:reviewers|board)$/, () => {
    NR.setTitle('Editorial board & reviewers');
    NR.setMain(`<div class="wrap page" style="max-width:900px">
      <div class="eyebrow">Editorial board &amp; reviewers</div>
      <h1>Scientific quality needs scientific leadership</h1>
      <p class="lead muted" style="font-size:1.15rem">The team behind Open File Drawer builds the platform. <strong>Editors and reviewers make every scientific decision</strong> — what counts as sound design, and what earns the “peer reviewed” label. We are assembling the founding editorial board now.</p>
      <h2 style="margin-top:32px">Founding editorial board — seats open</h2>
      <div class="seats">${AREAS.map(([a, n]) => `<div class="seat"><strong>${esc(a)}</strong><span class="muted small">${n} seat${n > 1 ? 's' : ''} open</span></div>`).join('')}</div>
      <p class="muted small">No names are listed yet. We will only publish names of people who have agreed.</p>
      <h2 style="margin-top:32px">How review works</h2>
      <ol><li>An editor checks scope and basic soundness.</li><li>Two independent reviewers use a short checklist: plausible hypothesis, sound set-up, systematic variation, controls, analytical evidence, honest interpretation and limits.</li><li>Authors revise; the editor decides. Review reports may be published (open review) with the reviewers' consent.</li></ol>
      <p class="muted">Conflicts of interest are declared and checked. Reviewers are credited publicly if they wish; ORCID review credit is planned.</p>
      <h2 style="margin-top:32px">Volunteer or nominate</h2>
      <form class="card" id="rf" novalidate>
        <div class="grid c2">${F.text('Name', 'name')}${F.text('E-mail', 'email', { type: 'email' })}</div>
        <div class="grid c2">${F.text('Institution', 'institution')}${F.text('ORCID iD (optional)', 'orcid', { ph: '0000-0000-0000-0000' })}</div>
        <div class="grid c2">${F.select('Interested in', 'role', ['Reviewer', 'Editor', 'Both'])}${F.select('Main area', 'field', AREAS.map(a => a[0]))}</div>
        ${F.select('Capacity', 'capacity', ['1–2 reviews per year', '3–6 reviews per year', 'More than 6 per year'], { hint: 'Pilot phase: few reports, carefully chosen.' })}
        ${F.area('Anything we should know?', 'message', { rows: 3, hint: 'Expertise, conflicts of interest, or someone you want to nominate.' })}
        ${consent()}
        <button class="btn" type="submit">Send</button>
      </form></div>`);
    wire($('#rf'), 'reviewer', ['name', 'email', 'institution', 'role', 'field', 'capacity'], v => ({ role: v('role'), field: v('field'), orcid: v('orcid'), capacity: v('capacity') }));
  });

  // ---------- organisations: now part of the Products page (the general contact form lives there) ----------
  NR.route(/^#\/organisations$/, () => { history.replaceState(null, '', '#/products'); NR.dispatch(); });
})();
