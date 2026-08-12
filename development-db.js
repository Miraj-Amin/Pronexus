/* ===========================================================================
   PHOENIX DEVELOPMENT FINANCE — data layer
   Mirrors bridging-db.js's shape (same reasons: localStorage today, 1:1 with
   a future Supabase schema), but with its own store key and its own deal
   shape — this is a separate brokerage line, not a sub-store of Bridging.
   =========================================================================== */
(function (global) {
  const KEY = 'phx_development_store_v1';
  const E = global.PhoenixDevelopment;

  function uid(prefix) { return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  function nowISO() { return new Date().toISOString(); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function emptyStore() {
    return {
      org: { id: 'org_phoenix', name: 'Phoenix London and Regional Limited' },
      currentUser: { id: 'user_demo', name: 'Demo user', roles: ['Deal Lead', 'Development Analyst', 'Financial Analyst', 'Case Manager', 'Admin', 'Principal', 'Viewer'], activeRole: 'Deal Lead' },
      deals: {},
      tasks: {},          // dealId -> [143 task rows]
      gateSignoffs: {},    // dealId -> { GD0: {...} .. GD10: {...} }
      eligibility: {},     // dealId -> { tests, adverse, exceptions, tier, tierJustification, outcome, screenedBy, screenedDate }
      infoPack: {},        // dealId -> { '1': {received,date,source,fileRef,gapNote}, ... }
      cp: {},               // dealId -> [{id,condition,category,owner,dueDate,status,dateSatisfied,evidence,notes}]
      fees: {},              // dealId -> { F1: {amount,invoiced,received,notes}, ... }
      handover: {},            // dealId -> { sections: {'1': {prepared,inPack,coveredInMeeting}}, meetingDate, attendedClient, attendedPhoenix, packIssuedDate, ackReceivedDate }
      appraisalStress: {},       // dealId -> { base:{gdv,constructionCost,contingency,landFeesStatutory,financeCosts}, gdvMinus5:{...}, ... }
      notes: {},                  // dealId -> [{id,ts,author,text}]
      escalations: {},              // dealId -> [{id,trigger,raisedDate,raisedTo,status,resolution,resolutionDate,evidence,owner}]
      audit: {},                     // dealId -> [{id,ts,user,action,before,after,reason}]
      documents: {},                   // dealId -> [{id,folder,docType,fileName,mimeType,size,version,storagePath|dataUrl,url,notes,uploadedBy,createdAt}]
      statusHistory: {},               // dealId -> [{id,ts,fromStatus,toStatus,fromStage,toStage}]
      portalInvites: {},               // dealId -> [{id,email,token,createdAt,acceptedAt}]
      adminParams: null,
      orgAudit: [],
    };
  }

  let store = null;
  // See bridging-db.js's migrateStore for why this exists — backfills any
  // fields added after a store was first created so old localStorage data
  // doesn't leave currentUser.activeRole (or anything else new) undefined.
  function migrateStore(s) {
    const defaults = emptyStore();
    Object.keys(defaults).forEach(k => { if (s[k] === undefined) s[k] = defaults[k]; });
    s.currentUser = Object.assign({}, defaults.currentUser, s.currentUser);
    if (!s.currentUser.activeRole) s.currentUser.activeRole = (s.currentUser.roles && s.currentUser.roles[0]) || 'Deal Lead';
    if (!s.currentUser.roles || !s.currentUser.roles.length) s.currentUser.roles = defaults.currentUser.roles;
    return s;
  }
  function load() {
    if (store) return store;
    try {
      const raw = localStorage.getItem(KEY);
      store = raw ? migrateStore(JSON.parse(raw)) : emptyStore();
    } catch (e) { store = emptyStore(); }
    if (!store.deals || Object.keys(store.deals).length === 0) seed(store);
    return store;
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { console.error('development store save failed', e); } }

  function audit(dealId, action, before, after, reason) {
    if (!store.audit[dealId]) store.audit[dealId] = [];
    store.audit[dealId].unshift({ id: uid('aud'), ts: nowISO(), user: store.currentUser.name, action, before: before === undefined ? null : before, after: after === undefined ? null : after, reason: reason || null });
  }
  function orgAudit(action, before, after) {
    store.orgAudit.unshift({ id: uid('oaud'), ts: nowISO(), user: store.currentUser.name, action, before: before === undefined ? null : before, after: after === undefined ? null : after });
  }
  function recordStatusHistory(dealId, fromStatus, toStatus, fromStage, toStage) {
    if (fromStatus === toStatus && fromStage === toStage) return;
    store.statusHistory[dealId] = store.statusHistory[dealId] || [];
    store.statusHistory[dealId].push({ id: uid('sh'), ts: nowISO(), fromStatus, toStatus, fromStage, toStage });
  }

  function seedTasksFor(dealId) {
    store.tasks[dealId] = E.TASK_TEMPLATE.map(t => ({ ...t, status: 'Not started', targetDate: '', doneDate: '', evidence: '', notes: '' }));
  }
  function seedGatesFor(dealId) {
    store.gateSignoffs[dealId] = {};
    Object.keys(E.GATES).forEach(g => { store.gateSignoffs[dealId][g] = { passed: false }; });
  }
  function seedEligibilityFor(dealId) {
    const tests = {}; E.ELIGIBILITY_TESTS.forEach(t => { tests[t.key] = { verdict: '', note: '' }; });
    const adverse = {}; E.ADVERSE_CATEGORIES.forEach(a => { adverse[a.key] = { found: false, cleared: false, detail: '' }; });
    const exceptions = {}; E.EXCEPTION_TRIGGERS.forEach(x => { exceptions[x.key] = { present: false, dateRaised: '', funderResponse: '', note: '' }; });
    store.eligibility[dealId] = { tests, adverse, exceptions, tier: '', tierJustification: '', outcome: '', screenedBy: '', screenedDate: '' };
  }
  function seedInfoPackFor(dealId) {
    const p = {}; E.INFO_PACK_ITEMS.forEach(i => { p[i.n] = { received: false, date: '', source: '', fileRef: '', gapNote: '' }; });
    store.infoPack[dealId] = p;
  }
  function seedFeesFor(dealId) {
    const f = {}; E.FEE_ROWS.forEach(r => { f[r.ref] = { amount: '', invoiced: false, received: false, notes: '' }; });
    store.fees[dealId] = f;
  }
  function seedHandoverFor(dealId) {
    const sections = {}; E.HANDOVER_SECTIONS.forEach(s => { sections[s.n] = { prepared: false, inPack: false, coveredInMeeting: false, notes: '' }; });
    store.handover[dealId] = { sections, meetingDate: '', attendedClient: '', attendedPhoenix: '', packIssuedDate: '', ackReceivedDate: '' };
  }
  function seedAppraisalStressFor(dealId) {
    const cols = ['base', 'gdvMinus5', 'gdvMinus10', 'costPlus5', 'costPlus10', 'delay3', 'combined'];
    const row = () => { const o = {}; cols.forEach(c => o[c] = ''); return o; };
    store.appraisalStress[dealId] = { gdv: row(), constructionCost: row(), contingency: row(), landFeesStatutory: row(), financeCosts: row() };
  }

  function newDeal(fields) {
    const s = load();
    const id = uid('deal');
    const year = fields.dateReceived ? new Date(fields.dateReceived).getFullYear() : new Date().getFullYear();
    const dealRef = E.nextDealRef(Object.values(s.deals), year);
    const deal = Object.assign({
      id, dealRef,
      dateReceived: todayISO(), source: '', introducer: '', introducerShareApplies: 'No',
      accountId: '', accountName: '',
      dealLead: '', developmentAnalyst: '', financialAnalyst: '', caseManager: '',
      stage: 0, status: 'Enquiry',
      borrowingEntity: '', companyNumber: '', principals: '', guarantors: '',
      siteAddress: '', localAuthority: '', schemeDescription: '', units: '', nsaSqFt: '',
      product: 'Ground-up development', regulatedStatus: 'No — confirmed unregulated',
      planningRef: '', planningGranted: '',
      gdvClient: '', gdvVerified: '', totalCost: '', contingencyPct: '',
      landValue: '', purchasePrice: '', seniorFacility: '', mezzanineFacility: '', clientEquity: '', peakDebt: '',
      termMonths: 18, marginBps: '',
      contractor: '', contractorDD: '', contractValueToTurnover: '',
      structure: 'Senior only', fundersApproached: '', selectedSeniorFunder: '', selectedJuniorFunder: '',
      appetiteTier: '', policyExceptionFlagged: 'No', adverseFlag: 'No',
      commitmentFee: '', commitmentFeePaidDate: '', valuer: '', monitoringSurveyor: '', funderSolicitor: '', borrowerSolicitor: '',
      termsAccepted: '', valuationReceived: '', msReportReceived: '', submittedToFunder: '', decisionReceived: '',
      offerAccepted: '', legalsInstructed: '', targetCompletion: '', actualCompletion: '',
      firstDrawdownDate: '', firstDrawdownAmount: '', handoverMeetingDate: '', acknowledgementReceivedDate: '', fileArchivedDate: '',
      exitRoute: '', exitConfidenceAtUw: '',
      brokerFeeBasis: '', brokerFee: '', feeInvoicedDate: '', feeReceivedDate: '', introducerShare: '',
      outcome: '', gateReachedIfAborted: '', reasonCode: '', notes: '',
      lastGatePassed: '', nextAction: 'Log enquiry and issue deal reference', nextActionOwner: 'Case Manager', nextActionDue: todayISO(),
      createdAt: nowISO(), updatedAt: nowISO(),
    }, fields || {});
    s.deals[id] = deal;
    seedTasksFor(id); seedGatesFor(id); seedEligibilityFor(id); seedInfoPackFor(id); seedFeesFor(id); seedHandoverFor(id); seedAppraisalStressFor(id);
    s.cp[id] = []; s.notes[id] = []; s.escalations[id] = []; s.documents[id] = []; s.portalInvites[id] = [];
    s.statusHistory[id] = [{ id: uid('sh'), ts: nowISO(), fromStatus: null, toStatus: deal.status, fromStage: null, toStage: deal.stage }];
    audit(id, 'Deal created', null, { dealRef: deal.dealRef, source: deal.source });
    persist();
    return deal;
  }

  function updateDeal(id, patch, action) {
    const s = load(); const d = s.deals[id]; if (!d) return null;
    const before = {}; Object.keys(patch).forEach(k => before[k] = d[k]);
    const fromStatus = d.status, fromStage = d.stage;
    Object.assign(d, patch, { updatedAt: nowISO() });
    if (patch.status !== undefined || patch.stage !== undefined) recordStatusHistory(id, fromStatus, d.status, fromStage, d.stage);
    audit(id, action || 'Deal updated', before, patch);
    persist();
    return d;
  }

  function updateTask(dealId, ref, patch) {
    const s = load(); const list = s.tasks[dealId]; if (!list) return null;
    const t = list.find(x => x.ref === ref); if (!t) return null;
    Object.assign(t, patch);
    if (patch.status === 'Complete' && !t.doneDate) t.doneDate = todayISO();
    audit(dealId, 'Task ' + ref + ' -> ' + (patch.status || 'updated'), null, patch);
    persist();
    return t;
  }

  function passGate(dealId, gateKey, info) {
    const s = load();
    s.gateSignoffs[dealId] = s.gateSignoffs[dealId] || {};
    s.gateSignoffs[dealId][gateKey] = Object.assign({ passed: true, date: todayISO() }, info);
    const gateDef = E.GATES[gateKey];
    const nextStage = gateDef.stage + 1;
    const deal = s.deals[dealId];
    if (deal) {
      const fromStage = deal.stage;
      deal.lastGatePassed = gateKey; if (nextStage <= 10) deal.stage = nextStage; deal.updatedAt = nowISO();
      recordStatusHistory(dealId, deal.status, deal.status, fromStage, deal.stage);
    }
    audit(dealId, 'Gate ' + gateKey + ' passed', null, info);
    persist();
    return s.gateSignoffs[dealId][gateKey];
  }

  function waiveTask(dealId, ref, info) {
    const s = load(); const list = s.tasks[dealId]; const t = list && list.find(x => x.ref === ref);
    if (!t) return null;
    t.status = 'Waived'; t.notes = (t.notes ? t.notes + ' | ' : '') + 'Waived: ' + (info.reason || '');
    audit(dealId, 'Task ' + ref + ' waived', null, info);
    persist();
    return t;
  }

  function setEligibility(dealId, patch) {
    const s = load(); s.eligibility[dealId] = Object.assign({}, s.eligibility[dealId], patch);
    audit(dealId, 'Eligibility updated', null, Object.keys(patch));
    persist();
    return s.eligibility[dealId];
  }
  function setInfoPackItem(dealId, n, patch) {
    const s = load(); s.infoPack[dealId] = s.infoPack[dealId] || {};
    s.infoPack[dealId][n] = Object.assign({}, s.infoPack[dealId][n], patch);
    persist();
    return s.infoPack[dealId][n];
  }
  function setFeeItem(dealId, ref, patch) {
    const s = load(); s.fees[dealId] = s.fees[dealId] || {};
    s.fees[dealId][ref] = Object.assign({}, s.fees[dealId][ref], patch);
    persist();
    return s.fees[dealId][ref];
  }
  function setHandoverSection(dealId, n, patch) {
    const s = load(); s.handover[dealId] = s.handover[dealId] || { sections: {} };
    s.handover[dealId].sections[n] = Object.assign({}, s.handover[dealId].sections[n], patch);
    persist();
    return s.handover[dealId].sections[n];
  }
  function setHandoverMeta(dealId, patch) {
    const s = load(); s.handover[dealId] = Object.assign({}, s.handover[dealId], patch);
    audit(dealId, 'Handover updated', null, Object.keys(patch));
    persist();
    return s.handover[dealId];
  }
  function setAppraisalStressCell(dealId, row, col, value) {
    const s = load(); s.appraisalStress[dealId] = s.appraisalStress[dealId] || {};
    s.appraisalStress[dealId][row] = Object.assign({}, s.appraisalStress[dealId][row], { [col]: value });
    persist();
    return s.appraisalStress[dealId][row];
  }

  function addCp(dealId, cp) {
    const s = load(); s.cp[dealId] = s.cp[dealId] || [];
    const row = Object.assign({ id: uid('cp'), status: 'Not started' }, cp);
    s.cp[dealId].push(row);
    audit(dealId, 'CP added: ' + (cp.condition || ''), null, row);
    persist();
    return row;
  }
  function updateCp(dealId, cpId, patch) {
    const s = load(); const list = s.cp[dealId] || [];
    const row = list.find(c => c.id === cpId); if (!row) return null;
    if (patch.status === 'Satisfied' && !patch.evidence && !row.evidence) {
      // business rule: no CP satisfied without evidence — silently block, mirrors the Postgres CHECK constraint
      return row;
    }
    Object.assign(row, patch);
    if (patch.status === 'Satisfied' && !row.dateSatisfied) row.dateSatisfied = todayISO();
    audit(dealId, 'CP updated: ' + row.condition, null, patch);
    persist();
    return row;
  }

  function addNote(dealId, text, author) {
    const s = load(); s.notes[dealId] = s.notes[dealId] || [];
    const row = { id: uid('note'), ts: nowISO(), author: author || s.currentUser.name, text };
    s.notes[dealId].unshift(row);
    persist();
    return row;
  }

  function addEscalation(dealId, row) {
    const s = load(); s.escalations[dealId] = s.escalations[dealId] || [];
    const rec = Object.assign({ id: uid('esc'), raisedDate: todayISO(), status: 'Open' }, row);
    s.escalations[dealId].unshift(rec);
    audit(dealId, 'Escalation raised: ' + rec.trigger, null, rec);
    persist();
    return rec;
  }
  function updateEscalation(dealId, escId, patch) {
    const s = load(); const list = s.escalations[dealId] || [];
    const row = list.find(e => e.id === escId); if (!row) return null;
    Object.assign(row, patch);
    audit(dealId, 'Escalation updated: ' + row.trigger, null, patch);
    persist();
    return row;
  }

  function getEffectiveProductParams() {
    const s = load();
    const override = (s.adminParams && s.adminParams.productParams) || {};
    const merged = {};
    Object.keys(E.DEFAULT_PRODUCT_PARAMS).forEach(k => { merged[k] = Object.assign({}, E.DEFAULT_PRODUCT_PARAMS[k], override[k] || {}); });
    return merged;
  }
  function getEffectiveCoreParams() {
    const s = load();
    const override = (s.adminParams && s.adminParams.coreParams) || {};
    return Object.assign({}, E.DEFAULT_CORE_PARAMS, override);
  }
  function setProductParam(product, field, value) {
    const s = load(); s.adminParams = s.adminParams || { productParams: {}, coreParams: {} };
    s.adminParams.productParams[product] = Object.assign({}, s.adminParams.productParams[product], { [field]: value });
    orgAudit('Funder parameter changed: ' + product + '.' + field, null, value);
    persist();
    return getEffectiveProductParams()[product];
  }
  function setCoreParam(field, value) {
    const s = load(); s.adminParams = s.adminParams || { productParams: {}, coreParams: {} };
    s.adminParams.coreParams[field] = value;
    orgAudit('Core parameter changed: ' + field, null, value);
    persist();
    return getEffectiveCoreParams();
  }
  function resetProductParams() {
    const s = load(); s.adminParams = { productParams: {}, coreParams: {} };
    orgAudit('Admin parameters reset to shipped defaults', null, null);
    persist();
  }

  function nextDocVersion(dealId, folder, docType) {
    const list = (load().documents[dealId] || []).filter(d => d.folder === folder && d.docType === docType);
    return list.length ? Math.max.apply(null, list.map(d => d.version || 1)) + 1 : 1;
  }
  function addDocument(dealId, doc) {
    const s = load(); s.documents[dealId] = s.documents[dealId] || [];
    const version = nextDocVersion(dealId, doc.folder, doc.docType);
    const rec = Object.assign({ id: uid('doc'), version, uploadedBy: s.currentUser.name, createdAt: nowISO() }, doc);
    s.documents[dealId].push(rec);
    audit(dealId, 'Document uploaded: ' + doc.folder + '/' + doc.docType + ' v' + version, null, { fileName: doc.fileName, size: doc.size });
    persist();
    return rec;
  }
  function deleteDocument(dealId, docId) {
    const s = load(); const list = s.documents[dealId] || [];
    const idx = list.findIndex(d => d.id === docId); if (idx === -1) return false;
    const [removed] = list.splice(idx, 1);
    audit(dealId, 'Document deleted: ' + removed.folder + '/' + removed.docType + ' v' + removed.version, removed, null);
    persist();
    return true;
  }

  function setActiveRole(role) { const s = load(); s.currentUser.activeRole = role; persist(); return s.currentUser; }

  /* --------------------------- Client portal invites --------------------------- */
  function inviteClientPortal(dealId, email) {
    const s = load(); s.portalInvites[dealId] = s.portalInvites[dealId] || [];
    const rec = { id: uid('inv'), email, token: uid('tok').replace(/^tok_/, ''), createdAt: nowISO(), acceptedAt: null };
    s.portalInvites[dealId].push(rec);
    audit(dealId, 'Client portal invited: ' + email, null, { token: rec.token });
    orgAudit('Client portal invite issued for deal ' + dealId, null, { email });
    persist();
    return rec;
  }
  function findPortalInviteByToken(token) {
    const s = load();
    for (const dealId of Object.keys(s.portalInvites)) {
      const hit = (s.portalInvites[dealId] || []).find(i => i.token === token);
      if (hit) return { dealId, invite: hit };
    }
    return null;
  }
  function acceptPortalInvite(token) {
    const hit = findPortalInviteByToken(token);
    if (!hit) return null;
    hit.invite.acceptedAt = nowISO();
    persist();
    return hit;
  }

  function seed(s) {
    store = s;
    const d = newDeal({
      dateReceived: '2026-07-20', source: 'Direct — existing client', dealLead: 'Dilip Kesavan',
      developmentAnalyst: 'Hanish', financialAnalyst: 'Romana', caseManager: 'Joy',
      borrowingEntity: 'Northfield Gardens SPV Ltd', companyNumber: '15102284',
      siteAddress: 'Land at Northfield Gardens, Redhill, Surrey', localAuthority: 'Reigate & Banstead', units: 14, nsaSqFt: 11800,
      product: 'Ground-up development', schemeDescription: '14 x 3-4 bed houses, open market sale',
      planningRef: 'RB/2025/1142', planningGranted: '2025-11-04',
      gdvClient: 8200000, gdvVerified: 7950000, totalCost: 6100000, contingencyPct: 0.06,
      landValue: 1450000, purchasePrice: 1450000, seniorFacility: 4300000, mezzanineFacility: 0, clientEquity: 1800000, peakDebt: 4300000,
      termMonths: 18, marginBps: 525,
      contractor: 'Ashfield Construction Ltd', contractorDD: 'Cleared', contractValueToTurnover: '18%',
      structure: 'Senior only', fundersApproached: 'Funder A, Funder D', selectedSeniorFunder: 'Funder D',
      appetiteTier: 'Tier 2 — balanced',
      stage: 6, status: 'Structuring', lastGatePassed: 'GD5',
      termsAccepted: '', exitRoute: 'Open market sale — all units',
      nextAction: 'Complete funder comparison and present recommendation', nextActionOwner: 'Deal Lead', nextActionDue: '2026-08-14',
    });
    (s.tasks[d.id] || []).forEach(t => { if (t.stage < 6) t.status = 'Complete'; });
    ['GD0', 'GD1', 'GD2', 'GD3', 'GD4', 'GD5'].forEach(g => { s.gateSignoffs[d.id][g] = { passed: true, date: '2026-08-05', owner: E.GATES[g].owner, signedBy: 'Dilip Kesavan', evidence: 'Gate sign-off sheet' }; });
    s.eligibility[d.id].tier = 'Tier 2 — balanced';
    s.eligibility[d.id].outcome = 'Proceed to D2';
    persist();

    newDeal({
      dateReceived: '2026-08-08', source: 'Broker introduction', dealLead: 'Dilip Kesavan', developmentAnalyst: 'Hanish', financialAnalyst: 'Romana', caseManager: 'Natasha',
      borrowingEntity: 'Harcourt Mews Developments Ltd', siteAddress: 'Former depot, Harcourt Road, Slough', localAuthority: 'Slough Borough Council',
      units: 6, product: 'Part-complete development', schemeDescription: '6-unit part-complete residential scheme, works stalled at first fix',
      gdvClient: 3100000, totalCost: 2350000, seniorFacility: 1600000,
      termMonths: 14, exitRoute: 'Open market sale — all units',
      stage: 1, status: 'Screening',
      nextAction: 'Complete pre-screen and eligibility tests', nextActionOwner: 'Deal Lead', nextActionDue: '2026-08-14',
    });
  }

  global.PhoenixDevelopmentDB = {
    load, persist,
    newDeal, updateDeal,
    listDeals: () => Object.values(load().deals).sort((a, b) => (b.dateReceived || '').localeCompare(a.dateReceived || '')),
    listDealsForAccount: (accountId) => Object.values(load().deals).filter(d => d.accountId === accountId).sort((a, b) => (b.dateReceived || '').localeCompare(a.dateReceived || '')),
    getDeal: (id) => load().deals[id],
    listTasks: (dealId) => load().tasks[dealId] || [],
    updateTask, passGate, waiveTask,
    getGates: (dealId) => load().gateSignoffs[dealId] || {},
    getEligibility: (dealId) => load().eligibility[dealId],
    setEligibility,
    getInfoPack: (dealId) => load().infoPack[dealId],
    setInfoPackItem,
    getCps: (dealId) => load().cp[dealId] || [],
    addCp, updateCp,
    getFees: (dealId) => load().fees[dealId],
    setFeeItem,
    getHandover: (dealId) => load().handover[dealId],
    setHandoverSection, setHandoverMeta,
    getAppraisalStress: (dealId) => load().appraisalStress[dealId],
    setAppraisalStressCell,
    getNotes: (dealId) => load().notes[dealId] || [],
    addNote,
    getEscalations: (dealId) => load().escalations[dealId] || [],
    addEscalation, updateEscalation,
    getAudit: (dealId) => load().audit[dealId] || [],
    currentUser: () => load().currentUser,
    setActiveRole,
    getEffectiveProductParams, getEffectiveCoreParams, setProductParam, setCoreParam, resetProductParams,
    hasAdminOverrides: () => !!load().adminParams,
    getOrgAudit: () => load().orgAudit || [],
    getDocuments: (dealId) => load().documents[dealId] || [],
    addDocument, deleteDocument, nextDocVersion,
    getStatusHistory: (dealId) => load().statusHistory[dealId] || [],
    getAllStatusHistory: () => load().statusHistory || {},
    getPortalInvites: (dealId) => load().portalInvites[dealId] || [],
    inviteClientPortal, findPortalInviteByToken, acceptPortalInvite,
    resetDemo: () => { localStorage.removeItem(KEY); store = null; load(); },
  };

})(window);
