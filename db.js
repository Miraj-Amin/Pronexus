/* ============================================================================
   Project database — Supabase-backed (shared team workspace).
   Each project is one row: { id, data (jsonb = whole project object), updated_at }.
   All reads/writes require an authenticated session; RLS lets any signed-in
   team member read & write every scheme. The blank master template is built
   client-side from code (engine.js), so it never needs to live in the DB.
   ========================================================================== */
(function (global) {
  'use strict';
  var A = global.Appraisal;
  var TABLE = 'projects';
  var ACTIVE = 'appraisal_active_v2';

  function sb() {
    if (!global.sb) throw new Error('Database connection not initialised.');
    return global.sb;
  }
  function nowISO() { return new Date().toISOString().slice(0, 10); }
  function stamp() { return new Date().toISOString(); }

  // ---- reads ----------------------------------------------------------------
  async function list() {
    var res = await sb().from(TABLE).select('data,updated_at').order('updated_at', { ascending: false });
    if (res.error) throw res.error;
    return (res.data || []).map(function (r) { return r.data; });
  }

  async function get(id) {
    var res = await sb().from(TABLE).select('data').eq('id', id).maybeSingle();
    if (res.error) throw res.error;
    return res.data ? res.data.data : null;
  }

  // ---- writes ---------------------------------------------------------------
  async function upsert(project) {
    project.meta = project.meta || {};
    project.meta.updatedAt = nowISO();
    var row = { id: project.id, data: project, updated_at: stamp() };
    var res = await sb().from(TABLE).upsert(row, { onConflict: 'id' });
    if (res.error) throw res.error;
    return project;
  }

  async function create(name) {
    var p = A.newProjectFromTemplate(name);
    await upsert(p);
    return p;
  }

  async function clone(id, newName) {
    var src = await get(id);
    if (!src) return null;
    var copy = JSON.parse(JSON.stringify(src));
    copy.id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    copy.isTemplate = false; copy.isLocked = false;
    copy.project.name = newName || (src.project.name + ' (copy)');
    copy.project.ref = (src.project.ref || 'PROJ') + '-COPY';
    copy.meta = { status: 'Draft', createdAt: nowISO(), updatedAt: nowISO(), fromTemplate: src.meta && src.meta.fromTemplate };
    await upsert(copy);
    return copy;
  }

  async function remove(id) {
    var res = await sb().from(TABLE).delete().eq('id', id);
    if (res.error) throw res.error;
  }

  // ---- versions: live, editable variants grouped under a parent scheme -------
  // familyId = the base scheme's id; every version points its version.parentId
  // at the family head so versions-of-versions still group correctly.
  function familyId(p) { return (p && p.version && p.version.parentId) ? p.version.parentId : (p ? p.id : null); }

  function applyAdjustments(p, adj) {
    adj = adj || {};
    if (adj.interestPts) p.assumptions.base_rate = (p.assumptions.base_rate || 0) + Number(adj.interestPts) / 100;
    if (adj.buildPct || adj.salesPct) {
      p.phases = p.phases.map(function (ph) {
        var n = Object.assign({}, ph);
        if (adj.buildPct) n.buildRatePsf = ph.buildRatePsf * (1 + Number(adj.buildPct) / 100);
        if (adj.salesPct) n.salePsf = ph.salePsf * (1 + Number(adj.salesPct) / 100);
        return n;
      });
    }
    if (adj.purchasePct) p.project.offerPrice = Math.round((p.project.offerPrice || 0) * (1 + Number(adj.purchasePct) / 100));
    if (adj.lengthMonths) p.project.projectLengthMonths = Math.max(1, (p.project.projectLengthMonths || 18) + Number(adj.lengthMonths));
  }

  async function createVersion(srcId, opts) {
    opts = opts || {};
    var src = await get(srcId);
    if (!src) return null;
    var copy = JSON.parse(JSON.stringify(src));
    copy.id = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    copy.isTemplate = false; copy.isLocked = false;
    copy.version = {
      type: opts.type || 'Working',
      label: opts.label || (opts.type || 'Working'),
      parentId: familyId(src),
      createdBy: opts.author || null,
      createdAt: nowISO()
    };
    // a full live copy keeps figures + status; only timestamps reset
    copy.meta = Object.assign({}, src.meta || {}, { createdAt: nowISO(), updatedAt: nowISO() });
    applyAdjustments(copy, opts.adjust);
    await upsert(copy);
    return copy;
  }

  // relabel / retype an existing version (or tag the base) — used by the switcher
  async function setVersionMeta(id, patch) {
    var p = await get(id);
    if (!p) return null;
    p.version = Object.assign({}, p.version || {}, patch);
    await upsert(p);
    return p;
  }

  // ---- one-time seed: load demo schemes the first time the table is empty ----
  // Idempotent: seed ids are stable and we ignore duplicates, so two people
  // hitting an empty DB at once can't create doubles.
  async function seedIfEmpty() {
    var head = await sb().from(TABLE).select('id', { count: 'exact', head: true });
    if (head.error) throw head.error;
    if ((head.count || 0) > 0) return false;
    var seeds = [A.seedState()].concat(A.demoProjects());
    var rows = seeds.map(function (p) {
      p.meta = p.meta || {};
      return { id: p.id, data: p, updated_at: stamp() };
    });
    var ins = await sb().from(TABLE).upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (ins.error) throw ins.error;
    return true;
  }

  // ---- local UI state (fine to stay per-browser) ----------------------------
  function setActive(id) { try { localStorage.setItem(ACTIVE, id || ''); } catch (e) {} }
  function getActive() { try { return localStorage.getItem(ACTIVE) || null; } catch (e) { return null; } }
  function getTemplate() { return A.blankTemplate(); }

  // ===========================================================================
  //  CRM — client/developer accounts, contacts, activity; jobs link to accounts
  //  One row per account; the whole account object lives in `data` (jsonb),
  //  mirroring the projects table. Contacts + activity are embedded arrays.
  //  A "job" is an appraisal scheme (projects row); it links to an account via
  //  project.accountId. The job's CRM pipeline stage lives at project.meta.stage.
  // ===========================================================================
  var ACCT_TABLE = 'accounts';

  function uid(prefix) { return (prefix || 'id') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // account factory — a fresh, fully-shaped client record
  function newAccount(fields) {
    fields = fields || {};
    var t = stamp();
    return {
      id: fields.id || uid('acc'),
      name: fields.name || 'New account',
      type: fields.type || 'Developer',         // category
      status: fields.status || 'Lead',          // Lead / Active / Dormant / Archived
      region: fields.region || '',
      address: fields.address || '',
      owner: fields.owner || '',                 // internal team member responsible
      notes: fields.notes || '',
      tags: fields.tags || [],
      contacts: fields.contacts || [],           // [{id,name,role,email,phone,primary}]
      activity: fields.activity || [],           // [{id,type,note,author,at}]
      createdAt: fields.createdAt || t,
      updatedAt: t
    };
  }

  async function listAccounts() {
    var res = await sb().from(ACCT_TABLE).select('data,updated_at').order('updated_at', { ascending: false });
    if (res.error) throw res.error;
    return (res.data || []).map(function (r) { return r.data; });
  }
  async function getAccount(id) {
    var res = await sb().from(ACCT_TABLE).select('data').eq('id', id).maybeSingle();
    if (res.error) throw res.error;
    return res.data ? res.data.data : null;
  }
  async function upsertAccount(a) {
    a.updatedAt = stamp();
    var row = { id: a.id, data: a, updated_at: a.updatedAt };
    var res = await sb().from(ACCT_TABLE).upsert(row, { onConflict: 'id' });
    if (res.error) throw res.error;
    return a;
  }
  async function createAccount(fields) {
    var a = newAccount(fields);
    await upsertAccount(a);
    return a;
  }
  async function removeAccount(id) {
    var res = await sb().from(ACCT_TABLE).delete().eq('id', id);
    if (res.error) throw res.error;
  }

  // link / unlink a job (project) to an account — direct fetch + persist so the
  // CRM can operate on any scheme, not just the one open in the appraisal view.
  async function setProjectAccount(projectId, accountId) {
    var p = await get(projectId);
    if (!p) return null;
    p.accountId = accountId || null;
    await upsert(p);
    return p;
  }
  async function setProjectStage(projectId, stage) {
    var p = await get(projectId);
    if (!p) return null;
    p.meta = p.meta || {};
    p.meta.stage = stage;
    await upsert(p);
    return p;
  }

  // one-time seed: demo client accounts + auto-link existing schemes by client
  // reference. Idempotent — stable ids + ignoreDuplicates, and only links jobs
  // that don't already point at an account.
  async function seedAccountsIfEmpty() {
    var head = await sb().from(ACCT_TABLE).select('id', { count: 'exact', head: true });
    if (head.error) throw head.error;
    var fresh = (head.count || 0) === 0;
    if (fresh) {
      var seeds = [
        newAccount({
          id: 'acc-total-homes', name: 'Total Homes', type: 'Developer', status: 'Active',
          region: 'West Sussex & Surrey', address: 'Pavilion House, Brighton Road, Crawley RH10 6AS',
          owner: 'M. Amin', tags: ['Repeat client', 'Priority'],
          notes: 'Core developer client — multiple live schemes across the South East. Quarterly portfolio review with J. Marlowe.',
          contacts: [
            { id: uid('ct'), name: 'James Marlowe', role: 'Development Director', email: 'j.marlowe@totalhomes.co.uk', phone: '01293 555 0142', primary: true },
            { id: uid('ct'), name: 'Amara Okafor', role: 'Land & Acquisitions', email: 'a.okafor@totalhomes.co.uk', phone: '01293 555 0188', primary: false }
          ],
          activity: [
            { id: uid('ac'), type: 'Meeting', note: 'Portfolio review — agreed to progress Cedar Rise to offer and re-appraise Quarry Fields at revised build costs.', author: 'M. Amin', at: '2026-06-04T10:00:00Z' },
            { id: uid('ac'), type: 'Email', note: 'Sent updated Walnut Marches appraisal pack for funder circulation.', author: 'M. Amin', at: '2026-05-29T14:20:00Z' }
          ]
        }),
        newAccount({
          id: 'acc-meridian', name: 'Meridian Land', type: 'Landowner', status: 'Lead',
          region: 'Kent', owner: 'M. Amin', tags: ['Inbound'],
          notes: 'Introduced via agent — holds a consented site near Maidstone. Awaiting title pack before we appraise.',
          contacts: [{ id: uid('ct'), name: 'Priya Shah', role: 'Principal', email: 'priya@meridianland.com', phone: '01622 555 0110', primary: true }],
          activity: [{ id: uid('ac'), type: 'Call', note: 'Intro call — outline of the Maidstone opportunity, ~40 units consented.', author: 'M. Amin', at: '2026-06-10T09:30:00Z' }]
        }),
        newAccount({
          id: 'acc-kestrel', name: 'Kestrel Capital', type: 'Investor', status: 'Dormant',
          region: 'London', owner: 'M. Amin', tags: ['Equity partner'],
          notes: 'Equity partner on past schemes. No live mandate — revisit for senior/mezz on the next qualifying deal.',
          contacts: [{ id: uid('ct'), name: 'Daniel Reeves', role: 'Investment Manager', email: 'd.reeves@kestrelcap.com', phone: '020 7555 0173', primary: true }],
          activity: []
        })
      ];
      var rows = seeds.map(function (a) { return { id: a.id, data: a, updated_at: stamp() }; });
      var ins = await sb().from(ACCT_TABLE).upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
      if (ins.error) throw ins.error;
    }

    // auto-link: any scheme with a matching clientRef and no account yet
    try {
      var accts = await listAccounts();
      var projs = await list();
      var byName = {};
      accts.forEach(function (a) { byName[(a.name || '').trim().toLowerCase()] = a.id; });
      var toLink = projs.filter(function (p) {
        if (p.isTemplate) return false;
        if (p.accountId) return false;
        var ref = (p.project && p.project.clientRef || '').trim().toLowerCase();
        return ref && byName[ref];
      });
      for (var i = 0; i < toLink.length; i++) {
        var p = toLink[i];
        p.accountId = byName[(p.project.clientRef || '').trim().toLowerCase()];
        await upsert(p);
      }
    } catch (e) { /* linking is best-effort; accounts still seed */ }

    return fresh;
  }

  // ===========================================================================
  //  COLLABORATION — snapshots / audit log / comments
  // ===========================================================================

  // ---- snapshots ----
  async function listSnapshots(projectId) {
    var res = await sb().from('snapshots').select('id,label,author,created_at').eq('project_id', projectId).order('created_at', { ascending: false });
    if (res.error) throw res.error;
    return res.data || [];
  }
  async function getSnapshot(id) {
    var res = await sb().from('snapshots').select('*').eq('id', id).maybeSingle();
    if (res.error) throw res.error;
    return res.data || null;
  }
  async function saveSnapshot(projectId, label, data, author) {
    var row = { project_id: projectId, label: label || null, data: data, author: author || null };
    var res = await sb().from('snapshots').insert(row).select('id,label,author,created_at').maybeSingle();
    if (res.error) throw res.error;
    return res.data;
  }
  async function deleteSnapshot(id) {
    var res = await sb().from('snapshots').delete().eq('id', id);
    if (res.error) throw res.error;
  }

  // ---- audit log ----
  async function logChanges(projectId, author, entries) {
    if (!entries || !entries.length) return;
    var rows = entries.map(function (e) {
      return { project_id: projectId, author: author || null, label: e.label, old_value: e.old, new_value: e.new };
    });
    var res = await sb().from('audit_log').insert(rows);
    if (res.error) throw res.error;
  }
  async function listAudit(projectId, limit) {
    var q = sb().from('audit_log').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
    if (limit) q = q.limit(limit);
    var res = await q;
    if (res.error) throw res.error;
    return res.data || [];
  }

  // ---- comments ----
  async function listComments(projectId) {
    var res = await sb().from('comments').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
    if (res.error) throw res.error;
    return res.data || [];
  }
  async function openCommentCount(projectId) {
    var res = await sb().from('comments').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('resolved', false);
    if (res.error) throw res.error;
    return res.count || 0;
  }
  async function addComment(projectId, anchor, anchorLabel, body, author) {
    var row = { project_id: projectId, anchor: anchor || 'scheme', anchor_label: anchorLabel || null, body: body, author: author || null };
    var res = await sb().from('comments').insert(row).select('*').maybeSingle();
    if (res.error) throw res.error;
    return res.data;
  }
  async function setCommentResolved(id, resolved) {
    var res = await sb().from('comments').update({ resolved: !!resolved }).eq('id', id);
    if (res.error) throw res.error;
  }
  async function deleteComment(id) {
    var res = await sb().from('comments').delete().eq('id', id);
    if (res.error) throw res.error;
  }

  // ---- ui feedback (visual "draw a box + comment" annotations from testers) ----
  async function listFeedback() {
    var res = await sb().from('ui_feedback').select('*').order('created_at', { ascending: false });
    if (res.error) throw res.error;
    return res.data || [];
  }
  async function addFeedback(entry) {
    var row = {
      page: entry.page || null,
      context: entry.context || null,
      comment: entry.comment,
      author: entry.author || null,
      box: entry.box || null,
      viewport: entry.viewport || null,
      status: 'open'
    };
    var res = await sb().from('ui_feedback').insert(row).select('*').maybeSingle();
    if (res.error) throw res.error;
    return res.data;
  }
  async function setFeedbackStatus(id, status) {
    var res = await sb().from('ui_feedback').update({ status: status }).eq('id', id);
    if (res.error) throw res.error;
  }
  async function deleteFeedback(id) {
    var res = await sb().from('ui_feedback').delete().eq('id', id);
    if (res.error) throw res.error;
  }

  global.DB = {
    list: list, get: get, upsert: upsert, create: create, clone: clone,
    remove: remove, seedIfEmpty: seedIfEmpty, getTemplate: getTemplate,
    setActive: setActive, getActive: getActive,
    // versions
    createVersion: createVersion, setVersionMeta: setVersionMeta, familyId: familyId,
    // CRM — accounts + job linking
    listAccounts: listAccounts, getAccount: getAccount, upsertAccount: upsertAccount,
    createAccount: createAccount, removeAccount: removeAccount, newAccount: newAccount,
    seedAccountsIfEmpty: seedAccountsIfEmpty,
    setProjectAccount: setProjectAccount, setProjectStage: setProjectStage, uid: uid,
    // collaboration
    listSnapshots: listSnapshots, getSnapshot: getSnapshot, saveSnapshot: saveSnapshot, deleteSnapshot: deleteSnapshot,
    logChanges: logChanges, listAudit: listAudit,
    listComments: listComments, openCommentCount: openCommentCount, addComment: addComment,
    setCommentResolved: setCommentResolved, deleteComment: deleteComment,
    // visual feedback / annotations
    listFeedback: listFeedback, addFeedback: addFeedback, setFeedbackStatus: setFeedbackStatus, deleteFeedback: deleteFeedback
  };
})(typeof window !== 'undefined' ? window : this);
