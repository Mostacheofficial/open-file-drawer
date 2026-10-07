// Content pages: about, author guide, policies, imprint, privacy, and author / institution profiles.
(function () {
  'use strict';
  const NR = window.NR, DB = NR.DB, { $, esc } = NR;
  const draftBanner = '<div class="notice pre"><p><strong>Draft policy.</strong> Proposed by the founding team; to be confirmed with the editorial board before launch.</p></div>';

  // ---------- about ----------
  NR.route(/^#\/about$/, () => {
    NR.setTitle('About');
    NR.setMain(`<div class="wrap page" style="max-width:820px">
      <h1>About Open File Drawer</h1>
      <p class="lead muted" style="font-size:1.15rem">Publication bias hides most failed-but-sound chemistry in lab notebooks and on hard drives. Other groups then repeat the same dead ends. Open File Drawer makes <strong>complete projects</strong> visible, citable and searchable — without pretending that everything on the site has been reviewed.</p>

      <section class="section"><h2>Principles</h2>
        <ul><li><strong>Complete projects, not single failed flasks.</strong> A systematic series with controls and analytics is evidence; one unexplained failed run is not.</li>
          <li><strong>Quality over volume.</strong> “It didn't work” is not enough. “We tested a plausible hypothesis under traceable conditions and show that approach X fails under conditions A–F” is.</li>
          <li><strong>Always say what has been checked.</strong> Every report carries its review status, and verified researchers can confirm or contradict it in the open.</li>
          <li><strong>Credit for early-career researchers.</strong> A citable output for work that would otherwise stay invisible — with the group leader's agreement.</li>
          <li><strong>Open by default.</strong> CC BY unless authors choose otherwise; structured data export on every report.</li></ul></section>

      <section class="section"><h2>Status labels</h2>
        <div class="rlist">
          <div class="card">${NR.badge('preprint')}<p style="margin-top:10px">Published by an identity-verified author after the group leader confirmed. Not independently reviewed. Authors may request review at any time.</p></div>
          <div class="card">${NR.badge('review')}<p style="margin-top:10px">A handling editor has been assigned and two independent reviewers are evaluating the report. The text may change.</p></div>
          <div class="card">${NR.badge('peer')}<p style="margin-top:10px">Accepted after review. In the journal phase these reports receive a DOI and long-term archiving.</p></div>
        </div>
        <p class="muted" style="margin-top:14px">Two further signals sit alongside the labels: <strong>Pre-registered</strong> (the plan was registered before the experiments) and <strong>Independently confirmed</strong> (another verified group reported the same result). Neither replaces peer review.</p></section>

      <section class="section"><h2>What reviewers check</h2>
        <ul><li>The hypothesis was scientifically plausible and well motivated.</li><li>The experimental set-up was sound — no obviously unsuitable catalyst, wavelength or conditions.</li><li>Conditions were varied systematically.</li><li>Positive and negative controls show that the system can work.</li><li>Analytical evidence supports the stated outcome.</li><li>The interpretation and the stated limits are honest.</li></ul>
        <p class="muted">Details: <a href="#/policies">editorial policies</a> · <a href="#/reviewers">editorial board &amp; reviewers</a>.</p></section>

      <section class="section"><h2>Who can publish</h2>
        <p>Only verified researchers: sign in with <strong>ORCID</strong> or an <strong>institutional e-mail</strong>. Before a report goes public, the <strong>group leader confirms</strong> authorship and the right to publish. This keeps a traceable person behind every report and prevents data being released without the group's knowledge. Readers can flag any report.</p></section>

      <section class="section" data-feature="products"><h2>Three products, one principle</h2>
        <p><strong>Research</strong> is this free, public platform. <strong>Data</strong> turns the public record into structured tables and an API for scientific AI, pharma and research tools. <strong>Enterprise</strong> gives R&amp;D organisations a private knowledge base for the failures that must stay confidential. Public reports and their raw data stay open under the licence the authors chose; paid offers are services on top, not paywalls on the science, and nothing moves from a private workspace into the public record unless an author decides so. <a href="#/products">See the products →</a></p></section>

      <section class="section"><h2>Roadmap</h2>
        <ol><li><strong>Now (pilot):</strong> open archive with clearly labelled preprints, registry of plans, wanted board, peer-review workflow; the open data API and bulk downloads; pilot workspaces on request.</li><li><strong>Next:</strong> peer-review pilot with the founding editorial board; DOIs for preprints; API keys and versioned data snapshots; single sign-on and integrations for Enterprise.</li><li><strong>Then:</strong> journal status with archiving and open access.</li><li><strong>Throughout:</strong> structured, machine-readable data so that “what doesn't work” becomes searchable knowledge.</li></ol></section>

      <section class="section band"><div><h2>Get involved</h2><p class="muted" style="margin:0">Research groups, reviewers and partners welcome.</p></div>
        <div class="band-actions"><a class="btn" href="#/pilot">Pilot programme</a><a class="btn secondary" href="#/reviewers">Editorial board</a><a class="btn secondary" href="#/products" data-feature="products">Products</a></div></section>
    </div>`);
  });

  // ---------- author guide ----------
  NR.route(/^#\/authors$/, () => {
    NR.setTitle('Author guide');
    NR.setMain(`<div class="wrap page" style="max-width:820px">
      <h1>Author guide</h1>
      <p class="lead muted" style="font-size:1.15rem">What we publish, what to prepare, and how a report goes from your spreadsheet to a citable page.</p>

      <section class="section"><h2>What we publish</h2>
        <div class="compare"><div class="card"><h3>Yes</h3><ul><li>A complete project or clearly delimited sub-project</li><li>A plausible, motivated hypothesis</li><li>Systematic variation with controls</li><li>Analytical evidence for the outcome</li><li>An honest interpretation and limits</li></ul></div>
          <div class="card"><h3>No</h3><ul><li>A single unexplained failed run</li><li>Set-ups that obviously could not work (e.g. catalyst destroyed at the chosen temperature)</li><li>Confidential or third-party data without permission</li><li>Instructions for harmful substances</li></ul></div></div></section>

      <section class="section"><h2>What to prepare</h2>
        <ol><li>Research question, hypothesis and the reason it was plausible</li><li>An experiment table — one row per experiment (<a href="#" id="tpl">download the CSV template</a>)</li><li>Positive and negative controls</li><li>At least one analytical method supporting the outcome (NMR, LC-MS, HPLC, …)</li><li>Expected vs. observed result, interpretation, limitations</li><li>A link to raw data, if available</li><li>Your <strong>group leader's agreement</strong> to publish</li></ol>
        <p class="muted">Our aim is that the write-up takes you well under a day, and less than an hour when your data are already in a table — we are testing that in the pilot.</p></section>

      <section class="section"><h2>From submission to citation</h2>
        <ol><li><strong>(Optional) Register your plan</strong> before the experiments — <a href="#/registry" data-feature="registry">Registry</a>.</li><li><strong>Submit</strong> the report. Identity: ORCID or institutional e-mail.</li><li><strong>Confirmation:</strong> your group leader receives a link and confirms.</li><li><strong>Published</strong> as a preprint with a stable ID, BibTeX/RIS and structured data.</li><li><strong>(Optional) Request peer review</strong> — editor plus two reviewers.</li></ol></section>

      <section class="section"><h2>FAQ</h2>
        <details class="faq"><summary>Will a preprint here block a later journal submission?</summary><p>Many publishers accept preprints, but policies differ and change. Check the policy of your target journal before you submit. Unreviewed reports here are labelled as preprints.</p></details>
        <details class="faq"><summary>Who owns the data?</summary><p>You and your institution keep ownership. By publishing you grant the open licence you choose (CC BY 4.0 by default). That is why your group leader must agree.</p></details>
        <details class="faq"><summary>Can I publish results from an industry collaboration?</summary><p>Only if the collaboration agreement permits it. If in doubt, ask your technology-transfer office first.</p></details>
        <details class="faq"><summary>What if I find a mistake after publication?</summary><p>(Proposed) Corrections are published as new versions with a visible change note. Withdrawals stay visible with the reason. Full removal only for legal reasons.</p></details>
        <details class="faq"><summary>What does it cost?</summary><p>Nothing during the pilot. The fee model for the journal phase has not been decided.</p></details>
        <details class="faq"><summary>How long does peer review take?</summary><p>To be defined with the founding editorial board. We will publish a target and our actual times.</p></details></section>
    </div>`);
    $('#tpl').onclick = e => { e.preventDefault(); NR.exp.download('open-file-drawer-experiments-template.csv', NR.csv.template(), 'text/csv;charset=utf-8'); };
    NR.applyFeatures();
  });

  // ---------- policies ----------
  NR.route(/^#\/policies$/, () => {
    NR.setTitle('Policies');
    NR.setMain(`<div class="wrap page" style="max-width:820px">
      <h1>Policies</h1>${draftBanner}
      <section class="section" id="editorial"><h2>Editorial policy</h2>
        <p>Scientific decisions are made by editors and reviewers, not by the operators of the platform. Reports are assessed on the soundness of design and the honesty of interpretation — never on whether the result was positive.</p></section>
      <section class="section" id="review"><h2>Peer review</h2>
        <p>An editor checks scope and basic soundness; two independent reviewers assess the report against the published checklist; authors revise; the editor decides. Reviewers and editors declare conflicts of interest. Review reports may be published with the reviewers' consent.</p></section>
      <section class="section" id="data"><h2>Data and licensing</h2>
        <p>Authors choose CC BY 4.0 (default), CC BY-SA 4.0 or CC0 1.0. Raw data should be linked from a repository or attached. Every report can be exported as structured JSON.</p></section>
      <section class="section" id="integrity"><h2>Research integrity</h2>
        <p>Reports must describe what was actually done. Fabricated, manipulated or plagiarised data lead to removal and notification of the institution. Authors are identity-verified; the group leader confirms authorship before publication.</p></section>
      <section class="section" id="safety"><h2>Safety and dual use</h2>
        <p>We do not publish instructions for producing toxic agents, explosives or controlled substances. Reports are screened for this before and after publication; anyone can flag a report.</p></section>
      <section class="section" id="corrections"><h2>Corrections, withdrawals, complaints</h2>
        <p>Corrections are new versions with a change note. Withdrawn reports remain visible with the reason. Complaints go to the editors; flagged reports are reviewed in the staff desk.</p></section>
    </div>`);
  });

  // ---------- legal skeletons ----------
  const legal = (title, inner) => `<div class="wrap page" style="max-width:820px"><h1>${title}</h1>
    <div class="notice pre"><p><strong>Placeholder — to be completed before the site goes public.</strong> This skeleton is not legal advice. Have the final text prepared with legal counsel or your university's start-up service.</p></div>${inner}</div>`;
  NR.route(/^#\/imprint$/, () => {
    NR.setTitle('Imprint');
    NR.setMain(legal('Imprint', `<p>[Name of the operator / legal entity]<br>[Street and number]<br>[Postal code, city, country]</p>
      <p>Represented by: [name]<br>Contact: [e-mail], [phone]</p>
      <p>Register entry (if applicable): [court, number]<br>VAT ID (if applicable): [number]</p>
      <p>Responsible for content: [name, address]</p>`));
  });
  NR.route(/^#\/privacy$/, () => {
    NR.setTitle('Privacy');
    NR.setMain(legal('Privacy policy', `<p>Topics that must be covered once the real backend exists:</p>
      <ul><li>Controller and contact; data protection officer (if required)</li><li>Which personal data are processed: ORCID iD, name, institutional e-mail, authorship data, co-author e-mail addresses (used only for confirmation requests), pilot / reviewer / organisation enquiries</li><li>Purposes and legal bases; retention periods</li><li>Hosting and processors (e.g. database and e-mail providers), transfers outside the EU</li><li>Cookies / local storage; analytics (if any)</li><li>Rights of data subjects and how to exercise them</li></ul>
      <p class="muted">The prototype stores everything only in your browser's local storage and sends nothing anywhere.</p>`));
  });

  // ---------- profiles ----------
  NR.route(/^#\/author\/([^/?]+)$/, async orcid => {
    orcid = decodeURIComponent(orcid);
    const reps = (await DB.reports.list()).filter(r => NR.isPublic(r) && r.authors.some(a => a.orcid === orcid)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const meta = await NR.loadMeta();
    const a = reps.length ? reps[0].authors.find(x => x.orcid === orcid) : null;
    NR.setTitle(a ? a.name : 'Author');
    NR.setMain(`<div class="wrap page"><h1>${esc(a ? a.name : 'Author')}</h1>
      <p class="muted">${a ? esc(a.affiliation) + ' · ' : ''}ORCID <a href="https://orcid.org/${esc(orcid)}" rel="noopener">${esc(orcid)}</a></p>
      <div class="stats" style="max-width:560px"><div class="stat"><b>${reps.length}</b><span>reports</span></div><div class="stat"><b>${reps.reduce((s, r) => s + NR.totalN(r), 0)}</b><span>documented experiments</span></div></div>
      <section class="section"><h2>Reports</h2><div class="rlist">${reps.length ? reps.map(r => NR.reportCard(r, meta)).join('') : '<div class="empty">No public reports.</div>'}</div></section></div>`);
  });
  NR.route(/^#\/institution\/(.+)$/, async name => {
    name = decodeURIComponent(name);
    const reps = (await DB.reports.list()).filter(r => NR.isPublic(r) && r.authors.some(a => a.affiliation === name)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const meta = await NR.loadMeta();
    NR.setTitle(name);
    NR.setMain(`<div class="wrap page"><div class="eyebrow">Institution</div><h1>${esc(name)}</h1>
      <div class="stats" style="max-width:760px"><div class="stat"><b>${reps.length}</b><span>reports</span></div><div class="stat"><b>${reps.reduce((s, r) => s + NR.totalN(r), 0)}</b><span>documented experiments</span></div><div class="stat"><b>${reps.filter(r => r.status === 'peer').length}</b><span>peer reviewed</span></div></div>
      <section class="section"><h2>Reports</h2><div class="rlist">${reps.length ? reps.map(r => NR.reportCard(r, meta)).join('') : '<div class="empty">No public reports.</div>'}</div></section></div>`);
  });
})();
