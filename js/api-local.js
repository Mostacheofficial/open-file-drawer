// NR.api for the local demo backend: every write the UI can make, implemented on top of the localStorage collections.
// js/backend-supabase.js provides the same methods (NR.apiRemote) backed by the database functions in supabase/schema.sql,
// where the same rules are enforced on the server. Views only ever call NR.api.*.
(function () {
  'use strict';
  const NR = (window.NR = window.NR || {});
  const Auth = window.NR_AUTH;
  const DB = () => NR.DB;
  const nowIso = () => new Date().toISOString();
  const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
  const me = () => { const u = NR.me(); ok(u, 'Please sign in.'); return u; };
  const staff = () => { const u = me(); ok(NR.isStaff(u), 'Staff only.'); return u; };
  const who = u => ({ name: u.name, orcid: u.orcid || '', method: u.method });

  // Runs when a report becomes public (immediately, or after the last required co-author confirmation).
  async function onPublic(r) {
    if (r.protocolId) await DB().protocols.update(r.protocolId, { status: 'completed', reportId: r.id });
    if (r.wantedId) {
      const w = await DB().wanted.get(r.wantedId);
      if (w && !(w.responses || []).some(x => x.id === r.id)) {
        await DB().wanted.update(w.id, { status: 'answered', responses: [...(w.responses || []), { kind: 'report', id: r.id, by: r.submitter.name, at: nowIso() }] });
      }
    }
  }

  NR.apiLocal = {
    // ----- reports -----
    async submitReport(p) {
      const u = me(), now = nowIso();
      const { confirmers = [], declarations, protocolId, wantedId, ...content } = p;
      const rep = {
        ...content, status: 'preprint', visibility: confirmers.length ? 'pending' : 'public', version: 1, createdAt: now, updatedAt: now,
        submitter: { ...who(u), email: u.email || '' }, protocolId: protocolId || undefined, wantedId: wantedId || undefined,
        nExperiments: (content.series || []).reduce((a, s) => a + (+s.n || 0), 0), doi: null, review: null, flags: [], versionCreatedAt: now, reviewRound: 0, reviewState: null,
        confirmation: confirmers.length ? { requestedAt: now, completedAt: null, required: confirmers.map(c => ({ name: c.name, email: c.email, role: c.role || 'author', token: NR.token(), confirmedAt: null })) } : null
      };
      const saved = await DB().reports.create(rep);
      if (saved.visibility === 'public') await onPublic(saved);
      else if (saved.protocolId) await DB().protocols.update(saved.protocolId, { reportId: saved.id });
      return { id: saved.id, visibility: saved.visibility };
    },
    async getConfirmationContext(id, token) {
      const r = await DB().reports.get(id);
      const e = r && r.confirmation && r.confirmation.required.find(x => x.token === token);
      if (!e) return null;
      return { reportId: r.id, title: r.title, abstract: r.abstract, authors: r.authors.map(a => a.name), nExperiments: NR.totalN(r), license: r.license, submitter: r.submitter.name,
        name: e.name, role: e.role, confirmedAt: e.confirmedAt, declined: !!e.declinedAt, public: r.visibility === 'public' };
    },
    async confirmAuthorship(id, token) {
      const r = await DB().reports.get(id);
      const e = r && r.confirmation && r.confirmation.required.find(x => x.token === token);
      ok(e && !e.confirmedAt, 'This link is invalid or has already been used.');
      const now = nowIso(), required = r.confirmation.required.map(x => (x.token === token ? { ...x, confirmedAt: now } : x)), all = required.every(x => x.confirmedAt);
      const saved = await DB().reports.update(r.id, { confirmation: { ...r.confirmation, required, completedAt: all ? now : null }, visibility: all ? 'public' : 'pending' });
      if (all) await onPublic(saved);
      return { confirmed: true, public: all };
    },
    async declineAuthorship(id, token, reason) {
      const r = await DB().reports.get(id);
      const e = r && r.confirmation && r.confirmation.required.find(x => x.token === token);
      ok(e && !e.confirmedAt, 'This link is invalid or has already been used.');
      ok(String(reason || '').trim().length >= 3, 'Please say what is wrong.');
      await DB().reports.update(r.id, { flags: [...(r.flags || []), { reason: `Declined by ${e.name}: ${reason}`, by: e.name, at: nowIso() }] });
    },
    async addNote(reportId, { type, body, link }) {
      const u = me();
      ok(String(body || '').trim().length >= 20, 'Please describe what you did and saw (at least a sentence or two).');
      await DB().notes.create({ reportId, type, body: body.trim(), link: link || '', by: who(u), createdAt: nowIso() });
    },
    async flagReport(reportId, reason) {
      const u = me(), r = await DB().reports.get(reportId);
      await DB().reports.update(reportId, { flags: [...(r.flags || []), { reason, by: u.name, at: nowIso() }] });
    },
    async requestReview(reportId) { await DB().reports.update(reportId, { reviewRequested: true }); },
    async setReportStatus(reportId, status, note) {
      const u = staff(), patch = { status, reviewRequested: false, review: null };
      if (status === 'peer') patch.review = { editor: u.name, reviewers: 2, decision: 'Accepted', date: nowIso().slice(0, 10), note: note || '' };
      await DB().reports.update(reportId, patch);
    },
    async resolveFlags(reportId) { staff(); await DB().reports.update(reportId, { flags: [] }); },

    // ----- registry -----
    async registerProtocol(p) {
      const u = me(), now = nowIso();
      const plan = { ...p, status: 'registered', createdAt: now, updatedAt: now, ipaAt: null, submitter: { ...who(u), email: u.email || '' }, amendments: [], reportId: null, reviewRequested: false };
      plan.fingerprint = NR.fingerprint(plan);
      const saved = await DB().protocols.create(plan);
      return { id: saved.id };
    },
    async addAmendment(id, text) {
      const p = await DB().protocols.get(id);
      ok(String(text || '').trim().length >= 10, 'Please describe the change.');
      await DB().protocols.update(id, { amendments: [...(p.amendments || []), { at: nowIso(), text: text.trim() }] });
    },
    async requestPlanReview(id) { await DB().protocols.update(id, { reviewRequested: true }); },
    async withdrawProtocol(id) { await DB().protocols.update(id, { status: 'withdrawn' }); },
    async setProtocolStatus(id, status) {
      staff();
      const p = await DB().protocols.get(id);
      await DB().protocols.update(id, { status, reviewRequested: false, ...(status === 'ipa' && !p.ipaAt ? { ipaAt: nowIso() } : {}) });
    },

    // ----- wanted board -----
    async createWanted({ title, details, reactionClass }) {
      const u = me();
      ok(String(title || '').trim().length >= 15, 'Please ask a specific question (at least a short sentence).');
      ok(reactionClass, 'Please choose a reaction class.');
      const w = await DB().wanted.create({ title: title.trim(), details: (details || '').trim(), reactionClass, createdAt: nowIso(), by: { name: u.name, orcid: u.orcid || '', email: u.email || '' }, meToo: [Auth.idOf(u)], responses: [], status: 'open' });
      return w.id;
    },
    async toggleMeToo(id) {
      const key = Auth.idOf(me()), w = await DB().wanted.get(id), has = (w.meToo || []).includes(key);
      const meToo = has ? w.meToo.filter(k => k !== key) : [...(w.meToo || []), key];
      await DB().wanted.update(id, { meToo });
      return { me_too: meToo.length, me_too_by_me: !has };
    },
    async linkWantedResponse(id, kind, refId) {
      const u = me(), w = await DB().wanted.get(id);
      await DB().wanted.update(id, { status: 'answered', responses: [...(w.responses || []), { kind, id: refId, by: u.name, at: nowIso() }] });
    },

    // ----- leads -----
    async submitLead(type, payload) {
      if (payload.website) return { id: 'L-0000' };                       // honeypot
      const { website, consent, ...rest } = payload;
      const lead = await DB().leads.create({ ...rest, type, stage: 'New', createdAt: nowIso(), consent: true, notes: '' });
      return { id: lead.id };
    },
    async updateLead(id, { stage, notes }) {
      staff();
      await DB().leads.update(id, { ...(stage != null ? { stage } : {}), ...(notes != null ? { notes } : {}) });
    },

    async updateProfile() { /* the local demo identity is fixed */ },

    // ----- Enterprise: organisations and confidential workspaces (demo version of the database functions in schema.sql) -----
    // Membership is by verified e-mail address, like on the server: the person signed in with an e-mail code and the address is a member or invited.
    async claimOrgInvites() {
      const u = NR.me(); if (!u || u.method !== 'email' || !u.email) return 0;
      const e = u.email.toLowerCase(); let n = 0;
      for (const o of await DB().orgs.list()) {
        const inv = (o.invites || []).find(i => i.email === e);
        if (!inv || (o.members || []).some(m => m.email === e)) continue;
        await DB().orgs.update(o.id, { members: [...o.members, { email: e, name: u.name, role: inv.role, addedAt: nowIso() }], invites: o.invites.filter(i => i.email !== e) });
        await orgLog(o.id, 'member.join', e, inv.role, u.name); n++;
      }
      return n;
    },
    async staffCreateOrg(name) {
      const u = staff();
      ok(String(name || '').trim().length >= 2 && String(name).length <= 200, 'Please enter the name of the organisation.');
      const o = await DB().orgs.create({ name: name.trim(), createdAt: nowIso(), members: [], invites: [] });
      await orgLog(o.id, 'org.create', o.id, o.name, u.name);
      return o.id;
    },
    async staffAddOrgMember(orgId, email) {
      const u = staff(), o = await orgOf(orgId);
      ok(!o.members.some(m => m.role === 'admin'), 'This organisation already has an administrator. Further members are added by its administrators.');
      ok(String(email || '').trim().toLowerCase() !== String(u.email || '').toLowerCase(), 'Staff cannot add themselves to an organisation.');
      return addMemberImpl(o, email, 'admin', u.name);
    },
    async staffRevokeOrgInvite(orgId, email) {
      const u = staff(), o = await orgOf(orgId);
      ok(!o.members.some(m => m.role === 'admin'), 'This organisation already has an administrator. Invitations are managed by its administrators.');
      await revokeInvite(o, email, u.name);
    },
    async orgAddMember(orgId, email, role = 'member') {
      const u = me(), o = await orgOf(orgId); ok(isAdmin(o, u), 'Only administrators of the organisation can do this.');
      return addMemberImpl(o, email, role, u.name);
    },
    async orgSetMemberRole(orgId, memberId, role) {
      const u = me(), o = await orgOf(orgId); ok(isAdmin(o, u), 'Only administrators of the organisation can do this.');
      ok(['admin', 'member'].includes(role), 'Unknown role.');
      const m = o.members.find(x => x.email === memberId); ok(m, 'Member not found.');
      ok(!(m.role === 'admin' && role === 'member' && o.members.filter(x => x.role === 'admin').length <= 1), 'An organisation needs at least one administrator.');
      await DB().orgs.update(o.id, { members: o.members.map(x => (x.email === memberId ? { ...x, role } : x)) });
      await orgLog(o.id, 'member.role', memberId, role, u.name);
    },
    async orgRemoveMember(orgId, memberId) {
      const u = me(), o = await orgOf(orgId), mine = membership(o, u);
      ok(isAdmin(o, u) || (mine && mine.email === memberId), 'Only administrators of the organisation can remove other members.');
      const m = o.members.find(x => x.email === memberId); ok(m, 'Member not found.');
      ok(!(m.role === 'admin' && o.members.filter(x => x.role === 'admin').length <= 1), 'An organisation needs at least one administrator.');
      await DB().orgs.update(o.id, { members: o.members.filter(x => x.email !== memberId) });
      await orgLog(o.id, 'member.remove', memberId, null, u.name);
    },
    async orgRevokeInvite(orgId, email) {
      const u = me(), o = await orgOf(orgId); ok(isAdmin(o, u), 'Only administrators of the organisation can do this.');
      await revokeInvite(o, email, u.name);
    },
    async orgCreateEntry(orgId, p) {
      const u = me(), o = await orgOf(orgId, 'Not allowed.'), m = membership(o, u);
      ok(m, 'Not allowed.'); ok(String(u.name || '').trim().length >= 2, 'Please add your name to your profile first.');
      const body = entryBody(p), now = nowIso();
      const e = await DB().entries.create({ orgId, authorName: u.name, authorKey: m.email, ...body, archived: false, releasedReportId: null, createdAt: now, updatedAt: now });
      await orgLog(orgId, 'entry.create', e.id, body.title, u.name);
      return e.id;
    },
    async orgUpdateEntry(entryId, p) {
      const { u, o, e } = await entryCtx(entryId); ok(canChange(e, o, u), 'Only the author or an administrator can change this entry.');
      const body = entryBody(p); await DB().entries.update(e.id, body); await orgLog(o.id, 'entry.update', e.id, body.title, u.name);
    },
    async orgSetArchived(entryId, archived) {
      const { u, o, e } = await entryCtx(entryId); ok(canChange(e, o, u), 'Only the author or an administrator can change this entry.');
      await DB().entries.update(e.id, { archived: !!archived }); await orgLog(o.id, archived ? 'entry.archive' : 'entry.restore', e.id, e.title, u.name);
    },
    async orgDeleteEntry(entryId) {
      const { u, o, e } = await entryCtx(entryId); ok(isAdmin(o, u), 'Only administrators of the organisation can delete entries.');
      await DB().entries.remove(e.id); await orgLog(o.id, 'entry.delete', e.id, e.title, u.name);
    },
    async orgMarkReleased(entryId, reportId) {
      const { u, o, e } = await entryCtx(entryId); ok(canChange(e, o, u), 'Only the author or an administrator can do this.');
      const r = await DB().reports.get(reportId); ok(r && NR.isOwner(r, u), 'That report was not submitted by you.');
      await DB().entries.update(e.id, { releasedReportId: reportId }); await orgLog(o.id, 'entry.release', e.id, reportId, u.name);
    },

    // ----- peer review & plan review (demo version of the database functions) -----
    // State lives inside the report / plan: reviewState, reviewRound, reviewProcess { assignments, decisions }.
    async startReview(type, id) {
      staff();
      const s = await subj(type, id);
      ok(type === 'report' ? (NR.isPublic(s) && s.status === 'preprint' && !s.reviewState) : (s.status === 'registered' && !s.reviewState),
        'This cannot enter review now: it must be a public preprint, or a registered plan, that is not already under review.');
      const round = (s.reviewRound || 0) + 1;
      await saveSubj(type, id, { reviewState: 'in_review', reviewRound: round, reviewRequested: false, ...(type === 'report' ? { status: 'review' } : {}) });
      return round;
    },
    async inviteReviewer(type, id, { name, email }) {
      staff();
      const s = await subj(type, id), em = String(email || '').trim().toLowerCase(), proc = processOf(s);
      ok(s.reviewState === 'in_review', 'Start the review first.');
      ok(String(name || '').trim().length >= 2, "Please enter the reviewer's name.");
      ok(/^\S+@\S+\.\S+$/.test(em), 'Please enter a valid e-mail address.');
      ok(!(s.submitter && (s.submitter.email || '').toLowerCase() === em), 'A reviewer cannot be the person who submitted this.');
      const active = proc.assignments.filter(a => a.round === s.reviewRound && !a.cancelledAt);
      ok(!active.some(a => a.email === em), 'This person is already invited in this round.');
      ok(active.length < 6, 'At most 6 reviewers per round.');
      const a = { id: 'A' + NR.token().slice(0, 10), round: s.reviewRound, name: name.trim(), email: em, token: NR.token(), invitedAt: nowIso(), acceptedAt: null, declinedAt: null, declineReason: '', submittedAt: null, cancelledAt: null, review: null };
      await saveSubj(type, id, { reviewProcess: { ...proc, assignments: [...proc.assignments, a] } });
      return a.id;
    },
    async reinviteReviewers(type, id) {
      staff();
      const s = await subj(type, id), proc = processOf(s);
      ok(s.reviewState === 'in_review', 'Start the review first.');
      const seen = new Set(proc.assignments.filter(a => a.round === s.reviewRound && !a.cancelledAt).map(a => a.email)), todo = [];
      proc.assignments.filter(a => a.round < s.reviewRound && !a.cancelledAt && !a.declinedAt).forEach(a => { if (!seen.has(a.email)) { seen.add(a.email); todo.push(a); } });
      for (const a of todo) await NR.apiLocal.inviteReviewer(type, id, { name: a.name, email: a.email });
      return todo.length;
    },
    async cancelAssignment(assignmentId) {
      staff();
      for (const type of ['report', 'protocol']) {
        for (const s of await (type === 'report' ? DB().reports : DB().protocols).list()) {
          const proc = processOf(s), a = proc.assignments.find(x => x.id === assignmentId);
          if (!a) continue;
          ok(!a.submittedAt && !a.cancelledAt, 'Not possible: unknown assignment, or the review was already submitted.');
          return void await saveSubj(type, s.id, { reviewProcess: { ...proc, assignments: proc.assignments.map(x => (x.id === assignmentId ? { ...x, cancelledAt: nowIso() } : x)) } });
        }
      }
      throw new Error('Not possible: unknown assignment, or the review was already submitted.');
    },
    async getReviewOverview(type, id) {
      staff();
      const s = await subj(type, id), proc = processOf(s);
      return { round: s.reviewRound || 0, state: s.reviewState || null, minReviews: NR.cfg.minReviews || 2,
        assignments: proc.assignments.map(a => ({ id: a.id, round: a.round, name: a.name, email: a.email, invitedAt: a.invitedAt, status: assignmentStatus(a, s), declineReason: a.declineReason, review: a.review, token: a.token })),   // token: demo only
        decisions: proc.decisions.map(d => ({ round: d.round, decision: d.decision, letter: d.letter, decidedBy: d.decidedBy, decidedAt: d.decidedAt })) };
    },
    async getReviewProgress(type, id) {
      const u = me(), s = await subj(type, id);
      ok(NR.isStaff(u) || NR.isOwner(s, u), 'Not allowed.');
      const cur = processOf(s).assignments.filter(a => a.round === s.reviewRound && !a.cancelledAt);
      return { round: s.reviewRound || 0, state: s.reviewState || null, invited: cur.length, declined: cur.filter(a => a.declinedAt).length, submitted: cur.filter(a => a.submittedAt).length };
    },
    async getDecisions(type, id) {
      const u = me(), s = await subj(type, id);
      ok(NR.isStaff(u) || NR.isOwner(s, u), 'Not allowed.');
      return processOf(s).decisions.map(d => ({ round: d.round, decision: d.decision, letter: d.letter, decidedBy: d.decidedBy, decidedAt: d.decidedAt, reviews: d.reviews }));
    },
    async decide(type, id, { decision, letter, release }) {
      const u = staff(), s = await subj(type, id), proc = processOf(s);
      ok(['accept', 'revise', 'reject'].includes(decision), 'Unknown decision.');
      ok(String(letter || '').trim().length >= 20, 'Please write a decision letter to the authors (at least a few sentences).');
      ok(!(type === 'protocol' && decision === 'revise'), 'For plans, choose accept or decline. An improved plan is registered anew.');
      ok(s.reviewState === 'in_review', 'There is no review under way.');
      const done = proc.assignments.filter(a => a.round === s.reviewRound && a.submittedAt && !a.cancelledAt), minR = NR.cfg.minReviews || 2;
      ok(done.length >= 1, 'At least one submitted review is needed.');
      ok(decision !== 'accept' || done.length >= minR, `Accepting needs at least ${minR} submitted reviews (there are ${done.length}).`);
      const rel = done.map((a, i) => ({ a, label: a.review.openReview === 'signed' ? a.name : 'Reviewer ' + (i + 1) })).filter(x => !release || release.includes(x.a.id))
        .map(x => ({ label: x.label, ratings: x.a.review.ratings, recommendation: x.a.review.recommendation, comments: x.a.review.commentsAuthors, openReview: x.a.review.openReview || 'none' }));
      const pub = rel.filter(x => x.openReview !== 'none');
      const dec = { id: 'D' + NR.token().slice(0, 8), round: s.reviewRound, decision, letter: letter.trim(), decidedBy: u.name, decidedAt: nowIso(), reviews: rel };
      const patch = { reviewProcess: { ...proc, decisions: [...proc.decisions, dec] } };
      if (type === 'report') {
        if (decision === 'accept') Object.assign(patch, { status: 'peer', reviewState: null, review: { editor: u.name, reviewers: done.length, decision: 'Accepted', date: nowIso().slice(0, 10), note: letter.trim().slice(0, 600), reports: pub, round: s.reviewRound } });
        else if (decision === 'revise') patch.reviewState = 'revision';
        else Object.assign(patch, { status: 'preprint', reviewState: null, review: null });
      } else if (decision === 'accept') Object.assign(patch, { status: 'ipa', ipaAt: s.ipaAt || nowIso(), reviewState: null });
      else patch.reviewState = 'declined';
      await saveSubj(type, id, patch);
    },
    async getReviewContext(token) {
      const f = await findByToken(token);
      if (!f) return null;
      const { type, s, a } = f, st = assignmentStatus(a, s);
      const subject = type === 'report'
        ? { id: s.id, title: s.title, abstract: s.abstract, subfield: s.subfield, version: s.version, nExperiments: NR.totalN(s), authors: s.authors.map(x => x.name) }
        : { id: s.id, title: s.title, abstract: s.question, hypothesis: s.hypothesis, design: s.design, subfield: s.subfield, authors: s.authors.map(x => x.name) };
      return { assignmentId: a.id, subjectType: type, subjectId: s.id, round: a.round, state: st, reviewerName: a.name, subject,
        criteria: NR.REVIEW[type].criteria.map(c => c[0]), recs: NR.REVIEW[type].recs.map(r => r[0]), review: st === 'submitted' ? a.review : null };
    },
    async respondToInvitation(token, accept, reason) {
      const ctx = await NR.apiLocal.getReviewContext(token);
      ok(ctx, 'This link is not valid.'); ok(ctx.state === 'invited', 'This invitation can no longer be answered.');
      await patchAssignment(token, a => ({ ...a, acceptedAt: accept ? nowIso() : null, declinedAt: accept ? null : nowIso(), declineReason: accept ? '' : String(reason || '').slice(0, 1000) }));
    },
    async submitReview(token, r) {
      const ctx = await NR.apiLocal.getReviewContext(token);
      ok(ctx, 'This link is not valid.'); ok(ctx.state === 'accepted', 'A review can only be submitted after accepting the invitation, while the review is open.');
      ok(r.coi === true, 'Please confirm that you have no conflict of interest (or decline the invitation).');
      ok(ctx.criteria.every(k => ['yes', 'partly', 'no'].includes((r.ratings || {})[k])), 'Please rate every criterion.');
      ok(ctx.recs.includes(r.recommendation), 'Please choose a recommendation.');
      ok(['none', 'anonymous', 'signed'].includes(r.openReview || 'none'), 'Unknown open-review choice.');
      ok(String(r.commentsAuthors || '').trim().length >= 20, 'Field "commentsAuthors" is required (at least 20 characters).');
      const review = { ratings: Object.fromEntries(ctx.criteria.map(k => [k, r.ratings[k]])), recommendation: r.recommendation, commentsAuthors: r.commentsAuthors.trim(), commentsEditor: String(r.commentsEditor || '').trim(), openReview: r.openReview || 'none', coi: true };
      await patchAssignment(token, a => ({ ...a, review, submittedAt: nowIso() }));
    },

    // ----- versions (revisions never overwrite history) -----
    async submitRevision(id, p, note) {
      const u = me(), r = await DB().reports.get(id);
      ok(r && NR.isOwner(r, u), 'Not allowed.');
      ok(NR.isPublic(r), 'The report must be public (all confirmations in) before it can be revised.');
      ok(r.status !== 'peer', 'A peer-reviewed report cannot be changed by its authors. Please contact the editors.');
      ok(r.reviewState !== 'in_review', 'The report is under review right now. You can submit a revision when the editor asks for one.');
      ok(String(note || '').trim().length >= 10, 'Please say what changed (at least a short sentence).');
      const { confirmers, declarations, protocolId, wantedId, ...content } = p, now = nowIso(), wasRevision = r.reviewState === 'revision';
      const { versions, ...current } = r;
      const snapshot = JSON.parse(JSON.stringify(current));
      const next = { ...content, version: r.version + 1, versionNote: note.trim(), versionCreatedAt: now, nExperiments: (content.series || []).reduce((a, x) => a + (+x.n || 0), 0),
        versions: [...(versions || []), { version: r.version, createdAt: r.versionCreatedAt || r.createdAt, note: r.versionNote || '', data: snapshot }],
        ...(wasRevision ? { reviewState: 'in_review', reviewRound: (r.reviewRound || 0) + 1 } : {}) };
      await DB().reports.update(id, next);
      return { version: next.version, reviewRestarted: wasRevision };
    },
    async listVersions(id) {
      const r = await DB().reports.get(id);
      return (r.versions || []).map(v => ({ version: v.version, note: v.note, createdAt: v.createdAt })).concat([{ version: r.version, note: r.versionNote || '', createdAt: r.versionCreatedAt || r.createdAt, current: true }]).sort((a, b) => b.version - a.version);
    },
    async getVersion(id, v) {
      const r = await DB().reports.get(id), old = (r.versions || []).find(x => x.version === +v);
      return old ? { ...old.data, version: old.version, versionNote: old.note, versionCreatedAt: old.createdAt } : null;
    }
  };

  // ---- helpers for the Enterprise functions ----
  const mail = u => String((u && u.email) || '').toLowerCase();
  const membership = (o, u) => (u && u.method === 'email' && u.email ? (o.members || []).find(m => m.email === mail(u)) || null : null);
  const isAdmin = (o, u) => { const m = membership(o, u); return !!m && m.role === 'admin'; };
  const canChange = (e, o, u) => { const m = membership(o, u); return !!m && (m.email === e.authorKey || m.role === 'admin'); };
  async function orgOf(id, msg) { const o = await DB().orgs.get(id); ok(o, msg || 'Organisation not found.'); return o; }
  async function entryCtx(entryId) {
    const u = me(), e = await DB().entries.get(entryId); ok(e, 'Entry not found.');
    const o = await orgOf(e.orgId, 'Entry not found.'); ok(membership(o, u), 'Entry not found.');
    return { u, o, e };
  }
  async function orgLog(orgId, action, target, detail, actorName) {
    await DB().audit.create({ orgId, at: nowIso(), actorName: actorName || '', action, target: target || null, detail: String(detail == null ? '' : detail).slice(0, 500) });
  }
  async function addMemberImpl(o, email, role, actorName) {
    const em = String(email || '').trim().toLowerCase();
    ok(/^\S+@\S+\.\S+$/.test(em) && em.length <= 320, 'Please enter a valid e-mail address.'); ok(['admin', 'member'].includes(role), 'Unknown role.');
    ok(o.members.length + (o.invites || []).length < 500, 'Too many members for one organisation.');
    if (o.members.some(m => m.email === em)) return { status: 'member' };
    await DB().orgs.update(o.id, { invites: [...(o.invites || []).filter(i => i.email !== em), { email: em, role, invitedAt: nowIso() }] });   // demo: nobody has an account yet, so every address is an invitation
    await orgLog(o.id, 'member.invite', em, role, actorName);
    return { status: 'invited' };
  }
  async function revokeInvite(o, email, actorName) {
    const em = String(email || '').trim().toLowerCase();
    await DB().orgs.update(o.id, { invites: (o.invites || []).filter(i => i.email !== em) });
    await orgLog(o.id, 'invite.revoke', em, null, actorName);
  }
  // only known fields are kept, the same as private.build_entry on the server
  function entryBody(p) {
    const err = NR.validateEntry(p); ok(!Object.keys(err).length, Object.values(err)[0]);
    const str = k => String(p[k] == null ? '' : p[k]).trim(), num = v => (typeof v === 'number' && Number.isFinite(v) ? v : (v === '' || v == null ? null : (Number.isFinite(+v) ? +v : null)));
    ok((p.experiments || []).length <= 2000 && (p.series || []).length <= 100, 'At most 2,000 experiments and 100 series per entry.');
    return { title: str('title'), project: str('project'), subfield: str('subfield'), reactionClass: str('reactionClass'), goal: str('goal'), approach: str('approach'), outcome: str('outcome'), failureCategory: p.failureCategory,
      learnings: str('learnings'), recommendation: str('recommendation'), metric: str('metric'), threshold: num(p.threshold), tags: (p.tags || []).map(x => String(x).trim()).filter(Boolean), links: (p.links || []).map(x => String(x).trim()).filter(Boolean),
      series: (p.series || []).map(x => ({ label: x.label, n: x.n, catalyst: x.catalyst, solvent: x.solvent, temp: x.temp, time: x.time, best: x.best, outcome: x.outcome, isControl: !!x.isControl })),
      experiments: (p.experiments || []).map(x => ({ id: x.id, series: x.series, catalyst: x.catalyst, solvent: x.solvent, temp: x.temp, time: x.time, result: x.result, control: !!x.control, notes: x.notes })) };
  }

  // ---- helpers for the review functions ----
  async function subj(type, id) {
    const s = await (type === 'report' ? DB().reports : DB().protocols).get(id);
    ok(s, 'Not found.');
    return s;
  }
  const saveSubj = (type, id, patch) => (type === 'report' ? DB().reports : DB().protocols).update(id, patch);
  const processOf = s => s.reviewProcess || { assignments: [], decisions: [] };
  const assignmentStatus = (a, s) => (a.cancelledAt ? 'cancelled' : a.submittedAt ? 'submitted' : a.declinedAt ? 'declined' : (s.reviewState !== 'in_review' || (s.reviewRound || 0) !== a.round) ? 'closed' : a.acceptedAt ? 'accepted' : 'invited');
  async function findByToken(token) {
    for (const type of ['report', 'protocol']) {
      for (const s of await (type === 'report' ? DB().reports : DB().protocols).list()) {
        const a = processOf(s).assignments.find(x => x.token === token);
        if (a) return { type, s, a };
      }
    }
    return null;
  }
  async function patchAssignment(token, fn) {
    const f = await findByToken(token), proc = processOf(f.s);
    await saveSubj(f.type, f.s.id, { reviewProcess: { ...proc, assignments: proc.assignments.map(x => (x.token === token ? fn(x) : x)) } });
  }
})();
