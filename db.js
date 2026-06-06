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

  global.DB = {
    list: list, get: get, upsert: upsert, create: create, clone: clone,
    remove: remove, seedIfEmpty: seedIfEmpty, getTemplate: getTemplate,
    setActive: setActive, getActive: getActive
  };
})(typeof window !== 'undefined' ? window : this);
