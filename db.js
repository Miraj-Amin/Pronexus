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

  global.DB = {
    list: list, get: get, upsert: upsert, create: create, clone: clone,
    remove: remove, seedIfEmpty: seedIfEmpty, getTemplate: getTemplate,
    setActive: setActive, getActive: getActive,
    // versions
    createVersion: createVersion, setVersionMeta: setVersionMeta, familyId: familyId,
    // collaboration
    listSnapshots: listSnapshots, getSnapshot: getSnapshot, saveSnapshot: saveSnapshot, deleteSnapshot: deleteSnapshot,
    logChanges: logChanges, listAudit: listAudit,
    listComments: listComments, openCommentCount: openCommentCount, addComment: addComment,
    setCommentResolved: setCommentResolved, deleteComment: deleteComment
  };
})(typeof window !== 'undefined' ? window : this);
