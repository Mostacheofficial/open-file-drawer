// Supabase backend (config.js: backend = "supabase").
//   * Authentication: ORCID through a custom OIDC provider ("custom:orcid"), and an e-mail one-time code.
//   * Reads: RLS-protected tables and views, mapped to the objects the views already use.
//   * Writes: only through the database functions in supabase/schema.sql (NR.apiRemote) — where the rules are enforced.
// It replaces window.NR_DB and window.NR_AUTH, so it must load after db.js and before core.js.
(function () {
  'use strict';
  const cfg = window.NR_CONFIG;
  if (cfg.backend !== 'supabase') return;
  const NR = (window.NR = window.NR || {});
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) { console.error('backend "supabase" needs supabaseUrl and supabaseAnonKey in js/config.js — using the local demo instead.'); return; }
  if (!window.supabase || !window.supabase.createClient) { console.error('supabase-js did not load — using the local demo instead.'); return; }

  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    // PKCE puts the ORCID result in ?code=… (not in the #hash), so it does not collide with the hash router
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  NR.sb = sb;
  const fail = e => { if (e) throw new Error(e.message || String(e)); };
  const q = async p => { const { data, error } = await p; fail(error); return data; };
  const rpc = (fn, args) => q(sb.rpc(fn, args));

  // =============== authentication ===============
  let profile = null;
  async function loadProfile() {
    const { data: s } = await sb.auth.getSession();
    const user = s.session && s.session.user;
    if (!user) { profile = null; return null; }
    let row = await q(sb.from('profiles').select('*').eq('id', user.id).maybeSingle());
    if (row && row.method === 'orcid' && !row.orcid) {                 // fill the ORCID iD from the identity record if the signup trigger missed it
      try { await sb.rpc('sync_my_profile'); row = await q(sb.from('profiles').select('*').eq('id', user.id).maybeSingle()); } catch (e) { /* non-fatal */ }
    }
    profile = row ? { id: row.id, name: row.name || '', orcid: row.orcid || '', email: row.email || user.email || '', method: row.method, role: row.role, institution: row.institution || '' } : null;
    return profile;
  }
  window.NR_AUTH = {
    async init() {
      await loadProfile();
      sb.auth.onAuthStateChange(event => {
        // never call supabase from inside this callback directly (can deadlock) — defer
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') setTimeout(async () => { try { await loadProfile(); } catch (e) {} if (NR.renderNav) NR.renderNav(); }, 0);
        if (event === 'SIGNED_OUT') { profile = null; if (NR.renderNav) NR.renderNav(); }
      });
    },
    current: () => profile,
    idOf: u => u && (u.orcid || u.email || u.id),
    refreshProfile: loadProfile,
    async signOut() { await sb.auth.signOut(); profile = null; },
    signInWithOrcid: () => sb.auth.signInWithOAuth({ provider: 'custom:orcid', options: { redirectTo: location.origin + location.pathname } }),
    async startEmail({ email, name }) { fail((await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, data: { name } } })).error); },
    async confirmEmail(email, code) { fail((await sb.auth.verifyOtp({ email, token: code, type: 'email' })).error); await loadProfile(); }
  };

  // =============== reads (mapped to the shapes the views use) ===============
  const REPORT_COLS = 'id,status,visibility,version,submitter_id,protocol_id,wanted_id,review_requested,review_round,review_state,version_created_at,data,created_at,updated_at';
  const toReport = (row, conf) => {
    const d = row.data || {}, done = d.authorshipConfirmation && d.authorshipConfirmation.confirmedBy;
    let confirmation = null;
    if (conf && conf.length) {                                            // the submitter / staff see who still has to confirm (names only)
      const all = conf.every(c => c.confirmed_at);
      confirmation = { requestedAt: conf.map(c => c.requested_at).sort()[0], completedAt: all ? conf.map(c => c.confirmed_at).sort().pop() : null,
        required: conf.map(c => ({ name: c.name, role: c.role, confirmedAt: c.confirmed_at, declined: c.declined })) };
    } else if (done && done.length) {                                     // everyone sees who confirmed a public report
      confirmation = { requestedAt: null, completedAt: done[done.length - 1].at, required: done.map(x => ({ name: x.name, role: x.role, confirmedAt: x.at })) };
    }
    return { ...d, experiments: row.experiments || [], id: row.id, status: row.status, visibility: row.visibility, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at,
      submitterId: row.submitter_id, protocolId: row.protocol_id || undefined, wantedId: row.wanted_id || undefined, reviewRequested: !!row.review_requested,
      reviewRound: row.review_round || 0, reviewState: row.review_state || null, versionCreatedAt: row.version_created_at, confirmation, flags: [] };
  };
  const toProtocol = row => ({ ...row.plan, id: row.id, status: row.status, fingerprint: row.fingerprint, amendments: row.amendments || [], reportId: row.report_id || null,
    reviewRequested: !!row.review_requested, reviewRound: row.review_round || 0, reviewState: row.review_state || null, ipaAt: row.ipa_at || null, createdAt: row.created_at, updatedAt: row.updated_at, submitter: row.submitter, submitterId: row.submitter_id });
  const toNote = row => ({ id: row.id, reportId: row.report_id, type: row.type, body: row.body, link: row.link || '', by: row.by, createdAt: row.created_at });
  const toWanted = row => ({ id: row.id, title: row.title, details: row.details, reactionClass: row.reaction_class, by: { name: row.by_name, orcid: row.by_orcid || '' }, status: row.status, createdAt: row.created_at,
    meToo: [], meTooCount: row.me_too, meTooByMe: !!row.me_too_by_me, mine: !!row.mine, responses: row.responses || [] });
  const toLead = row => ({ ...row.data, id: row.id, type: row.type, stage: row.stage, notes: row.notes || '', createdAt: row.created_at });
  const ENTRY_COLS = 'id,org_id,author_id,author_name,data,archived,released_report_id,created_at,updated_at';
  const toEntry = row => ({ ...row.data, id: row.id, orgId: row.org_id, authorId: row.author_id, authorName: row.author_name, archived: !!row.archived, releasedReportId: row.released_report_id || null,
    experiments: row.experiments || [], createdAt: row.created_at, updatedAt: row.updated_at });
  async function confirmationMap() {
    if (!profile) return {};
    const m = {};
    (await q(sb.from('report_confirmation_status').select('*'))).forEach(r => { (m[r.report_id] = m[r.report_id] || []).push(r); });
    return m;
  }

  window.NR_DB = {
    backendName: 'supabase',
    async init() {},
    async reset() { throw new Error('Reset is only available for the local demo backend.'); },
    reports: {
      async list() { const [rows, conf] = await Promise.all([q(sb.from('reports').select(REPORT_COLS).order('created_at', { ascending: false })), confirmationMap()]); return rows.map(r => toReport(r, conf[r.id])); },
      async get(id) { const [row, conf] = await Promise.all([q(sb.from('reports').select(REPORT_COLS + ',experiments').eq('id', id).maybeSingle()), confirmationMap()]); return row ? toReport(row, conf[id]) : null; }
    },
    protocols: {
      async list() { return (await q(sb.from('protocols').select('*').order('created_at', { ascending: false }))).map(toProtocol); },
      async get(id) { const row = await q(sb.from('protocols').select('*').eq('id', id).maybeSingle()); return row ? toProtocol(row) : null; }
    },
    notes: { async list() { return (await q(sb.from('notes').select('*').order('created_at', { ascending: true }))).map(toNote); } },
    wanted: {
      async list() { return (await q(sb.from('wanted_public').select('*').order('created_at', { ascending: false }))).map(toWanted); },
      async get(id) { const row = await q(sb.from('wanted_public').select('*').eq('id', id).maybeSingle()); return row ? toWanted(row) : null; }
    },
    leads: { async list() { return (await q(sb.from('leads').select('*').order('created_at', { ascending: false }))).map(toLead); } },
    // Enterprise: private workspaces. Everything below is protected by row-level security, so a non-member simply gets no rows.
    orgs: {
      async mine() {
        if (!profile) return [];
        const [mem, orgs] = await Promise.all([q(sb.from('org_members').select('org_id,role').eq('user_id', profile.id)), q(sb.from('organisations').select('id,name'))]);
        return mem.map(m => { const o = orgs.find(x => x.id === m.org_id); return o ? { id: o.id, name: o.name, role: m.role } : null; }).filter(Boolean);
      },
      async overview() {                                                // staff: which organisations exist, and how many members / pending invitations they have
        const [orgs, mem, inv] = await Promise.all([q(sb.from('organisations').select('id,name,created_at').order('created_at', { ascending: false })), q(sb.from('org_members').select('org_id,role')), q(sb.from('org_invites').select('org_id,email'))]);
        return orgs.map(o => ({ id: o.id, name: o.name, createdAt: o.created_at, members: mem.filter(m => m.org_id === o.id).length, admins: mem.filter(m => m.org_id === o.id && m.role === 'admin').length, invites: inv.filter(i => i.org_id === o.id).length }));
      },
      async get(id) { const o = await q(sb.from('organisations').select('id,name,created_at').eq('id', id).maybeSingle()); return o ? { id: o.id, name: o.name, createdAt: o.created_at } : null; },
      async members(orgId) { return (await q(sb.from('org_member_list').select('*').eq('org_id', orgId))).map(r => ({ id: r.user_id, name: r.name, email: r.email || '', role: r.role, addedAt: r.added_at })); },
      async invites(orgId) { return (await q(sb.from('org_invites').select('*').eq('org_id', orgId))).map(r => ({ email: r.email, role: r.role, invitedAt: r.invited_at })); }
    },
    entries: {
      async forOrg(orgId) { return (await q(sb.from('org_entries').select(ENTRY_COLS).eq('org_id', orgId).order('created_at', { ascending: false }))).map(toEntry); },
      async get(id) { const row = await q(sb.from('org_entries').select(ENTRY_COLS + ',experiments').eq('id', id).maybeSingle()); return row ? toEntry(row) : null; }
    },
    audit: { async forOrg(orgId) { return (await q(sb.from('org_audit').select('*').eq('org_id', orgId).order('at', { ascending: false }).limit(500))).map(a => ({ id: a.id, orgId: a.org_id, at: a.at, actorName: a.actor_name, action: a.action, target: a.target, detail: a.detail })); } },
    // Data product: the api_reports / api_experiments views, filtered like PostgREST: filters [[column, 'eq'|'neq'|'lt'|'lte'|'gt'|'gte'|'ilike', value], ...], order [column, 'asc'|'desc']
    dataApi: {
      async query(view, { filters = [], order = null, limit = 50, offset = 0 } = {}) {
        let b = sb.from(view).select('*');
        filters.forEach(([col, op, val]) => { b = b[op](col, op === 'ilike' ? String(val).replace(/\*/g, '%') : val); });
        if (order) b = b.order(order[0], { ascending: order[1] !== 'desc' });
        return q(b.range(offset, offset + limit - 1));
      },
      async count(view) { const { count, error } = await sb.from(view).select('*', { count: 'exact', head: true }); fail(error); return count || 0; }
    },
    flags: {
      async list() {
        return (await q(sb.from('flags').select('*').is('resolved_at', null).order('created_at', { ascending: false })))
          .map(f => ({ id: f.id, reportId: f.report_id, reason: f.reason, by: f.reporter_name || 'anonymous', at: f.created_at }));
      }
    }
  };

  // =============== writes (database functions) ===============
  NR.apiRemote = {
    async init() {
      const rows = await q(sb.from('app_settings').select('*'));
      const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
      if (s.coauthor_confirmation) NR.cfg.coauthorConfirmation = s.coauthor_confirmation;   // the server's setting is the truth
      if (s.min_reviews) NR.cfg.minReviews = +s.min_reviews;
    },
    submitReport: p => rpc('submit_report', { p }),
    getConfirmationContext: (id, token) => rpc('get_confirmation_context', { p_report_id: id, p_token: token }),
    confirmAuthorship: (id, token) => rpc('confirm_authorship', { p_report_id: id, p_token: token }),
    declineAuthorship: (id, token, reason) => rpc('decline_authorship', { p_report_id: id, p_token: token, p_reason: reason }),
    addNote: (reportId, { type, body, link }) => rpc('add_note', { p_report_id: reportId, p_type: type, p_body: body, p_link: link || null }),
    flagReport: (reportId, reason) => rpc('flag_report', { p_report_id: reportId, p_reason: reason }),
    requestReview: reportId => rpc('request_review', { p_report_id: reportId }),
    setReportStatus: (reportId, status, note) => rpc('staff_set_report_status', { p_report_id: reportId, p_status: status, p_note: note || '' }),
    resolveFlags: reportId => rpc('staff_resolve_flags', { p_report_id: reportId }),
    registerProtocol: p => rpc('register_protocol', { p }),
    addAmendment: (id, text) => rpc('add_amendment', { p_protocol_id: id, p_text: text }),
    requestPlanReview: id => rpc('request_plan_review', { p_protocol_id: id }),
    withdrawProtocol: id => rpc('withdraw_protocol', { p_protocol_id: id }),
    setProtocolStatus: (id, status) => rpc('staff_set_protocol_status', { p_protocol_id: id, p_status: status }),
    createWanted: ({ title, details, reactionClass }) => rpc('create_wanted', { p_title: title, p_details: details || '', p_reaction_class: reactionClass }),
    toggleMeToo: id => rpc('toggle_me_too', { p_wanted_id: id }),
    linkWantedResponse: (id, kind, refId) => rpc('link_wanted_response', { p_wanted_id: id, p_kind: kind, p_ref_id: refId }),
    submitLead: (type, payload) => rpc('submit_lead', { p_kind: type, p: payload }),
    updateLead: (id, { stage, notes }) => rpc('staff_update_lead', { p_id: id, p_stage: stage == null ? null : stage, p_notes: notes == null ? null : notes }),
    updateProfile: ({ name, institution }) => rpc('update_my_profile', { p_name: name, p_institution: institution || null }),

    // ----- Enterprise: organisations and confidential workspaces -----
    claimOrgInvites: async () => ((profile && profile.method === 'email') ? rpc('claim_org_invites') : 0),
    staffCreateOrg: name => rpc('staff_create_org', { p_name: name }),
    staffAddOrgMember: (orgId, email) => rpc('staff_add_org_member', { p_org_id: orgId, p_email: email }),
    staffRevokeOrgInvite: (orgId, email) => rpc('staff_revoke_org_invite', { p_org_id: orgId, p_email: email }),
    orgAddMember: (orgId, email, role) => rpc('org_add_member', { p_org_id: orgId, p_email: email, p_role: role || 'member' }),
    orgSetMemberRole: (orgId, memberId, role) => rpc('org_set_member_role', { p_org_id: orgId, p_user_id: memberId, p_role: role }),
    orgRemoveMember: (orgId, memberId) => rpc('org_remove_member', { p_org_id: orgId, p_user_id: memberId }),
    orgRevokeInvite: (orgId, email) => rpc('org_revoke_invite', { p_org_id: orgId, p_email: email }),
    orgCreateEntry: (orgId, p) => rpc('org_create_entry', { p_org_id: orgId, p }),
    orgUpdateEntry: (entryId, p) => rpc('org_update_entry', { p_entry_id: entryId, p }),
    orgSetArchived: (entryId, archived) => rpc('org_set_archived', { p_entry_id: entryId, p_archived: !!archived }),
    orgDeleteEntry: entryId => rpc('org_delete_entry', { p_entry_id: entryId }),
    orgMarkReleased: (entryId, reportId) => rpc('org_mark_released', { p_entry_id: entryId, p_report_id: reportId }),

    // ----- peer review & plan review -----
    startReview: (type, id) => rpc('staff_start_review', { p_subject_type: type, p_subject_id: id }),
    inviteReviewer: (type, id, { name, email }) => rpc('staff_invite_reviewer', { p_subject_type: type, p_subject_id: id, p_name: name, p_email: email }),
    reinviteReviewers: (type, id) => rpc('staff_reinvite_reviewers', { p_subject_type: type, p_subject_id: id }),
    cancelAssignment: assignmentId => rpc('staff_cancel_assignment', { p_assignment_id: assignmentId }),
    getReviewOverview: (type, id) => rpc('staff_review_overview', { p_subject_type: type, p_subject_id: id }),
    getReviewProgress: (type, id) => rpc('get_review_progress', { p_subject_type: type, p_subject_id: id }),
    async getDecisions(type, id) {
      const rows = await q(sb.from('review_decisions').select('*').eq('subject_type', type).eq('subject_id', id).order('decided_at', { ascending: true }));
      return rows.map(d => ({ round: d.round, decision: d.decision, letter: d.letter, decidedBy: d.decided_by_name, decidedAt: d.decided_at, reviews: d.reviews || [] }));
    },
    decide: (type, id, { decision, letter, release }) => rpc('staff_decide', { p_subject_type: type, p_subject_id: id, p_decision: decision, p_letter: letter, p_release: release && release.length ? release : null }),
    getReviewContext: token => rpc('get_review_context', { p_token: token }),
    respondToInvitation: (token, accept, reason) => rpc('respond_to_invitation', { p_token: token, p_accept: accept, p_reason: reason || null }),
    submitReview: (token, review) => rpc('submit_review', { p_token: token, p: review }),

    // ----- versions -----
    submitRevision: (id, p, note) => rpc('submit_revision', { p_report_id: id, p, p_note: note }),
    async listVersions(id) {
      const [cur, old] = await Promise.all([q(sb.from('reports').select('id,version,version_created_at,created_at,data').eq('id', id).maybeSingle()),
        q(sb.from('report_versions').select('version,note,created_at').eq('report_id', id).order('version', { ascending: false }))]);
      return [{ version: cur.version, note: (cur.data && cur.data.versionNote) || '', createdAt: cur.version_created_at || cur.created_at, current: true },
        ...old.map(v => ({ version: v.version, note: v.note || '', createdAt: v.created_at }))];
    },
    async getVersion(id, v) {
      const row = await q(sb.from('report_versions').select('*').eq('report_id', id).eq('version', +v).maybeSingle());
      return row ? { ...row.data, experiments: row.experiments || [], version: row.version, versionNote: row.note || '', versionCreatedAt: row.created_at } : null;
    }
  };
})();
