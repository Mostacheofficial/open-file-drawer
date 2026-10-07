// Identity layer — PROTOTYPE SIMULATION.
// The goal in production: a report can only be published by someone whose identity is
// verified via ORCID (OAuth/OIDC) or an academic e-mail address. Here both flows are
// simulated in the browser so the UX can be tested; nothing is actually verified.
(function () {
  'use strict';
  const KEY = 'ofd.session.v1';
  let pending = null; // e-mail flow state

  // ORCID iD checksum (ISO 7064 mod 11-2)
  function orcidChecksum(base15) {
    let total = 0;
    for (const ch of base15) total = (total + Number(ch)) * 2;
    const r = (12 - (total % 11)) % 11;
    return r === 10 ? 'X' : String(r);
  }
  function normalizeOrcid(v) {
    return String(v || '').trim().replace(/^https?:\/\/orcid\.org\//i, '').toUpperCase();
  }
  function isValidOrcid(v) {
    const s = normalizeOrcid(v);
    if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(s)) return false;
    const digits = s.replace(/-/g, '');
    return orcidChecksum(digits.slice(0, 15)) === digits[15];
  }
  function makeOrcid(base15) {
    const d = String(base15).padStart(15, '0');
    const all = d + orcidChecksum(d);
    return all.replace(/(\d{4})(\d{4})(\d{4})(\d{3}[\dX])/, '$1-$2-$3-$4');
  }

  // Heuristic only. Production should use a maintained list of academic domains (or eduGAIN / Shibboleth).
  const ACADEMIC = [
    /\.edu(\.[a-z]{2})?$/, /\.ac\.[a-z]{2}$/, /(^|\.)uni-[a-z-]+\.de$/, /(^|\.)(univ|uni)[a-z-]*\.[a-z.]+$/,
    /\.(mpg|fraunhofer|helmholtz|leibniz)\.de$/, /(^|\.)(ethz|epfl|psi)\.ch$/, /(^|\.)(cnrs|inria)\.fr$/
  ];
  function isAcademicEmail(email) {
    const m = String(email || '').trim().toLowerCase().match(/^[^@\s]+@([^@\s]+\.[^@\s]+)$/);
    return !!m && ACADEMIC.some(re => re.test(m[1]));
  }

  // an address that an organisation has invited to its workspace may sign in although it is not institutional (the server's hook does the same)
  function hasInvite(email) {
    try { const e = String(email || '').trim().toLowerCase(); return (JSON.parse(localStorage.getItem('ofd.orgs.v2')) || []).some(o => (o.invites || []).some(i => i.email === e)); } catch (err) { return false; }
  }

  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} return s; }
  function current() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function signOut() { try { localStorage.removeItem(KEY); } catch (e) {} pending = null; }
  const idOf = s => s && (s.orcid || s.email);

  window.NR_AUTH = {
    current, signOut, isValidOrcid, normalizeOrcid, makeOrcid, isAcademicEmail, hasInvite, idOf,

    signInOrcid({ orcid, name }) {
      return save({ method: 'orcid', orcid: normalizeOrcid(orcid), name: name.trim(), role: 'author', since: new Date().toISOString() });
    },
    startEmail({ email, name }) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      pending = { email: email.trim().toLowerCase(), name: name.trim(), code };
      return code; // in production this is e-mailed, never returned to the page
    },
    confirmEmail(code) {
      if (!pending || String(code).trim() !== pending.code) return null;
      const domain = pending.email.split('@')[1];
      const s = save({ method: 'email', email: pending.email, institution: domain, name: pending.name, role: 'author', since: new Date().toISOString() });
      pending = null;
      return s;
    },
    signInDemoMember() {
      return save({ method: 'email', email: 'member@demo-pharma.invalid', institution: 'demo-pharma.invalid', name: 'Dana Demo', role: 'author', since: new Date().toISOString() });
    },
    signInDemoEditor() {
      return save({ method: 'demo', email: 'editor@demo.invalid', name: 'Demo Editor', role: 'editor', since: new Date().toISOString() });
    }
  };
})();
