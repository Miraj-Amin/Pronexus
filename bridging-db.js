/* ===========================================================================
   PHOENIX BRIDGING — data layer
   localStorage-backed today; the method names and record shapes mirror the
   Supabase schema in db/bridging_schema.sql 1:1, so this file is the only
   thing that needs to change to move onto real Supabase persistence later
   (see PHOENIX_BRIDGING_README.md, "Swapping in Supabase").
   =========================================================================== */
(function (global) {
  const KEY = 'phx_bridging_store_v1';
  const E = global.PhoenixBridging;

  function uid(prefix) { return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  function nowISO() { return new Date().toISOString(); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function emptyStore() {
    return {
      org: { id: 'org_phoenix', name: 'Phoenix London and Regional Limited' },
      currentUser: { id: 'user_demo', name: 'Demo user', roles: E.ROLES.slice(0, -3), activeRole: 'Deal Lead' }, // excludes the three external-party placeholder roles from the demo switcher for now
      deals: {},          // dealId -> deal record
      tasks: {},           // dealId -> [{ref,stage,title,owner,required,status,targetDate,doneDate,evidence,notes,gate}]
      gateSignoffs: {},     // dealId -> { G0: {passed,owner,date,signedBy,evidence,waiver} }
      eligibility: {},      // dealId -> { tests: {key:{verdict,note}}, adverse: {A1:{found,cleared,detail}}, exceptions: {E1:{present,dateRaised,funderResponse,note}}, tier, tierJustification, outcome, screenedBy, screenedDate }
      kyc: {},               // dealId -> { K1: {received,dateReceived,expiry,certified,evidence,notes} }
      cp: {},                 // dealId -> [{id,condition,category,owner,dueDate,status,dateSatisfied,evidence,notes}]
      fees: {},                 // dealId -> { F1: {amount,invoiced,received,notes}, totals: {...} }
      funderApproaches: {},      // dealId -> [{id,funder,contact,dateApproached,response,rate,arrangementFee,exitFee,ltv,term,retentions,defaultPosition,acceptanceFee,legalValuationCosts,totalCost,notes,selected}]
      valuation: {},               // dealId -> {valuer,instructionDate,inspectionDate,reportDue,reportReceived,reportedValue,assumedValue,specialAssumptions,marketingPeriod,qualifications,renegotiation,clientRepresentation}
      notes: {},                     // dealId -> [{id,ts,author,text}]
      escalations: {},                 // dealId -> [{id,trigger,raisedDate,raisedTo,status,resolution,resolutionDate,evidence,owner}]
      audit: {},                        // dealId -> [{id,ts,user,action,before,after,reason}]
      postCompletion: {},                 // dealId -> {redemptionWatchDate,exitStatus,exitConfidence,retentionBalance,lastReview,redemptionDate,dischargeEvidence}
      documents: {},                        // dealId -> [{id,folder,docType,fileName,mimeType,size,version,dataUrl|storagePath,linkedStage,linkedGate,linkedCpId,linkedKycRef,notes,uploadedBy,createdAt}]
      portalInvites: {},                        // dealId -> [{id,email,token,createdAt,acceptedAt}]
      orgAudit: [],                               // org-level events not tied to a single deal (admin param changes, invites...)
      adminParams: null,                            // { productParams: {...override}, coreParams: {...override} } — null until first override saved
      seq: 0,
    };
  }

  let store = null;

  function load() {
    if (store) return store;
    try {
      const raw = localStorage.getItem(KEY);
      store = raw ? JSON.parse(raw) : emptyStore();
    } catch (e) { store = emptyStore(); }
    if (!store.deals || Object.keys(store.deals).length === 0) seed(store);
    return store;
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { console.error('bridging store save failed', e); } }

  function audit(dealId, action, before, after, reason) {
    if (!store.audit[dealId]) store.audit[dealId] = [];
    store.audit[dealId].unshift({
      id: uid('aud'), ts: nowISO(), user: store.currentUser.name, action,
      before: before === undefined ? null : before, after: after === undefined ? null : after,
      reason: reason || null,
    });
  }

  function seedTasksFor(dealId) {
    store.tasks[dealId] = E.TASK_TEMPLATE.map(t => ({
      ...t, status: 'Not started', targetDate: '', doneDate: '', evidence: '', notes: '',
    }));
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
  function seedKycFor(dealId) {
    const k = {}; E.KYC_ITEMS.forEach(i => { k[i.ref] = { received: false, dateReceived: '', expiry: '', certified: false, evidence: '', notes: '' }; });
    store.kyc[dealId] = k;
  }
  function seedFeesFor(dealId) {
    const f = {}; E.FEE_ROWS.forEach(r => { f[r.ref] = { amount: '', invoiced: false, received: false, notes: '' }; });
    store.fees[dealId] = f;
  }
  function orgAudit(action, before, after, reason) {
    store.orgAudit.unshift({ id: uid('oaud'), ts: nowISO(), user: store.currentUser.name, action, before: before === undefined ? null : before, after: after === undefined ? null : after, reason: reason || null });
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
      dealLead: '', analyst: '', caseManager: '',
      stage: 0, status: 'Enquiry',
      borrowingEntity: '', companyNumber: '', principals: '', guarantors: '',
      securityAddress: '', tenure: '', assetType: '', product: 'Unregulated bridging',
      regulatedStatus: 'No — confirmed unregulated',
      securityValue: '', purchasePrice: '', grossFacility: '', day1Advance: '', worksRetentionFacility: '',
      totalProjectCost: '', termMonths: 12, rate: '', arrangementFee: '', exitFee: '',
      exitRoute: '', exitEvidenceHeld: 'No',
      fundersApproached: '', selectedFunder: '', appetiteTier: '', policyExceptionFlagged: 'No', adverseFlag: 'No',
      acceptanceFee: '', acceptanceFeePaidDate: '', valuer: '', monitoringSurveyor: '', funderSolicitor: '', borrowerSolicitor: '',
      termsIssued: '', termsAccepted: '', submittedToFunder: '', creditDecisionReceived: '', offerIssued: '',
      legalsInstructed: '', targetCompletion: '', actualCompletion: '', termEndDate: '', redemptionDate: '',
      termsOfBusinessSigned: 'No', brokerFeeBasis: '', brokerFee: '', feeInvoicedDate: '', feeReceivedDate: '',
      introducerShare: '', outcome: '', reasonCode: '', notes: '',
      lastGatePassed: '', nextAction: 'Log enquiry and issue deal reference', nextActionOwner: 'Case Manager', nextActionDue: todayISO(),
      createdAt: nowISO(), updatedAt: nowISO(),
    }, fields || {});
    s.deals[id] = deal;
    seedTasksFor(id); seedGatesFor(id); seedEligibilityFor(id); seedKycFor(id); seedFeesFor(id);
    s.cp[id] = []; s.funderApproaches[id] = []; s.valuation[id] = {}; s.notes[id] = []; s.escalations[id] = [];
    s.postCompletion[id] = {}; s.documents[id] = []; s.portalInvites[id] = [];
    audit(id, 'Deal created', null, { dealRef: deal.dealRef, source: deal.source });
    persist();
    return deal;
  }

  function updateDeal(id, patch, action) {
    const s = load(); const d = s.deals[id]; if (!d) return null;
    const before = {}; Object.keys(patch).forEach(k => before[k] = d[k]);
    Object.assign(d, patch, { updatedAt: nowISO() });
    audit(id, action || 'Deal updated', before, patch);
    persist();
    return d;
  }

  function updateTask(dealId, ref, patch) {
    const s = load(); const list = s.tasks[dealId]; if (!list) return null;
    const t = list.find(x => x.ref === ref); if (!t) return null;
    const before = { status: t.status, doneDate: t.doneDate };
    Object.assign(t, patch);
    if (patch.status === 'Complete' && !t.doneDate) t.doneDate = todayISO();
    audit(dealId, 'Task ' + ref + ' -> ' + (patch.status || 'updated'), before, patch);
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
      deal.lastGatePassed = gateKey;
      if (nextStage <= 7) deal.stage = nextStage;
      deal.updatedAt = nowISO();
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

  function setKycItem(dealId, ref, patch) {
    const s = load(); s.kyc[dealId] = s.kyc[dealId] || {};
    s.kyc[dealId][ref] = Object.assign({}, s.kyc[dealId][ref], patch);
    persist();
    return s.kyc[dealId][ref];
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
      // business rule: no CP satisfied without evidence
      patch = Object.assign({}, patch, { status: row.status });
    } else {
      Object.assign(row, patch);
      if (patch.status === 'Satisfied' && !row.dateSatisfied) row.dateSatisfied = todayISO();
      audit(dealId, 'CP updated: ' + row.condition, null, patch);
      persist();
    }
    return row;
  }

  function setFeeItem(dealId, ref, patch) {
    const s = load(); s.fees[dealId] = s.fees[dealId] || {};
    s.fees[dealId][ref] = Object.assign({}, s.fees[dealId][ref], patch);
    persist();
    return s.fees[dealId][ref];
  }

  function addFunderApproach(dealId, row) {
    const s = load(); s.funderApproaches[dealId] = s.funderApproaches[dealId] || [];
    const rec = Object.assign({ id: uid('fa'), selected: false }, row);
    s.funderApproaches[dealId].push(rec);
    audit(dealId, 'Funder approached: ' + (row.funder || ''), null, rec);
    persist();
    return rec;
  }
  function updateFunderApproach(dealId, faId, patch) {
    const s = load(); const list = s.funderApproaches[dealId] || [];
    const row = list.find(f => f.id === faId); if (!row) return null;
    Object.assign(row, patch);
    if (patch.selected) list.forEach(f => { if (f.id !== faId) f.selected = false; });
    persist();
    return row;
  }

  function setValuation(dealId, patch) {
    const s = load(); s.valuation[dealId] = Object.assign({}, s.valuation[dealId], patch);
    audit(dealId, 'Valuation updated', null, Object.keys(patch));
    persist();
    return s.valuation[dealId];
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

  function setPostCompletion(dealId, patch) {
    const s = load(); s.postCompletion[dealId] = Object.assign({}, s.postCompletion[dealId], patch);
    persist();
    return s.postCompletion[dealId];
  }

  /* --------------------------- Admin-configurable parameters --------------------------- */
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
  function setProductParam(product, field, value, user) {
    const s = load();
    s.adminParams = s.adminParams || { productParams: {}, coreParams: {} };
    s.adminParams.productParams[product] = Object.assign({}, s.adminParams.productParams[product], { [field]: value });
    orgAudit('Funder parameter changed: ' + product + '.' + field, null, { value, by: user || s.currentUser.name });
    persist();
    return getEffectiveProductParams()[product];
  }
  function setCoreParam(field, value, user) {
    const s = load();
    s.adminParams = s.adminParams || { productParams: {}, coreParams: {} };
    s.adminParams.coreParams[field] = value;
    orgAudit('Core parameter changed: ' + field, null, { value, by: user || s.currentUser.name });
    persist();
    return getEffectiveCoreParams();
  }
  function resetProductParams() {
    const s = load(); s.adminParams = { productParams: {}, coreParams: {} };
    orgAudit('Admin parameters reset to shipped defaults', null, null);
    persist();
  }

  /* --------------------------- Documents (Supabase Storage-shaped) --------------------------- */
  // In production, `storagePath` (Supabase Storage object key) replaces
  // `dataUrl` — see bridging-storage.js for the guarded real-upload path.
  // Everything else about the record (folder, version, links, audit) is
  // identical either way, so swapping storage backends doesn't touch the UI.
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
  function updateDocument(dealId, docId, patch) {
    const s = load(); const list = s.documents[dealId] || [];
    const rec = list.find(d => d.id === docId); if (!rec) return null;
    Object.assign(rec, patch);
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

  /* --------------------------- Roles --------------------------- */
  function setActiveRole(role) {
    const s = load(); s.currentUser.activeRole = role; persist(); return s.currentUser;
  }

  function seed(s) {
    store = s;
    const d = newDeal({
      dateReceived: '2026-08-01', source: 'Broker introduction', introducer: 'A N Other', introducerShareApplies: 'Yes',
      dealLead: 'Dilip Kesavan', analyst: 'Romana', caseManager: 'Joy',
      borrowingEntity: 'Example Holdings Ltd', companyNumber: '14829231', principals: 'J. Smith, R. Jones', guarantors: 'J. Smith',
      securityAddress: '1 Example Road, London SE1', tenure: 'Freehold', assetType: 'Residential', product: 'Light refurbishment',
      securityValue: 1800000, purchasePrice: 1650000, grossFacility: 1200000, day1Advance: 1200000, totalProjectCost: 1450000,
      termMonths: 12, rate: 0.0925, arrangementFee: 0.02, exitFee: 0.01,
      exitRoute: 'Open market sale', exitEvidenceHeld: 'Yes',
      fundersApproached: 'Funder A, Funder B, Funder C', selectedFunder: 'Funder B', appetiteTier: 'Tier 2 — balanced',
      stage: 3, status: 'Packaged / submitted', lastGatePassed: 'G2',
      termsIssued: '2026-07-28', termsAccepted: '2026-07-31', acceptanceFee: 12000, acceptanceFeePaidDate: '2026-07-31',
      submittedToFunder: '2026-08-05',
      termsOfBusinessSigned: 'Yes', brokerFeeBasis: '1.5% of gross facility', brokerFee: 18000,
      nextAction: 'Answer credit query on the works schedule', nextActionOwner: 'Analyst', nextActionDue: '2026-08-13',
    });
    // fast-forward tasks/gates for the demo deal so Stage 0-2 read as complete
    (s.tasks[d.id] || []).forEach(t => { if (t.stage < 3) t.status = 'Complete'; });
    ['G0', 'G1', 'G2'].forEach(g => { s.gateSignoffs[d.id][g] = { passed: true, date: '2026-08-05', owner: E.GATES[g].owner, signedBy: 'Dilip Kesavan', evidence: 'Gate sign-off sheet' }; });
    s.eligibility[d.id].tier = 'Tier 2 — balanced';
    s.eligibility[d.id].outcome = 'Proceed to Stage 2';
    persist();

    // A second, earlier-stage deal so the pipeline isn't a single row
    newDeal({
      dateReceived: '2026-08-10', source: 'Direct — new enquiry', dealLead: 'Dilip Kesavan', analyst: 'Romana', caseManager: 'Hanish',
      borrowingEntity: 'Northside Developments SPV Ltd', securityAddress: '48 Bellingham Rise, Manchester', assetType: 'Residential',
      product: 'Heavy refurbishment', securityValue: 950000, purchasePrice: 890000, grossFacility: 620000, totalProjectCost: 780000,
      termMonths: 15, exitRoute: 'Open market sale', stage: 1, status: 'Screening',
      nextAction: 'Complete eligibility screen and adverse credit check', nextActionOwner: 'Analyst', nextActionDue: '2026-08-13',
    });
  }

  global.PhoenixBridgingDB = {
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
    getKyc: (dealId) => load().kyc[dealId],
    setKycItem,
    getCps: (dealId) => load().cp[dealId] || [],
    addCp, updateCp,
    getFees: (dealId) => load().fees[dealId],
    setFeeItem,
    getFunderApproaches: (dealId) => load().funderApproaches[dealId] || [],
    addFunderApproach, updateFunderApproach,
    getValuation: (dealId) => load().valuation[dealId] || {},
    setValuation,
    getNotes: (dealId) => load().notes[dealId] || [],
    addNote,
    getEscalations: (dealId) => load().escalations[dealId] || [],
    addEscalation, updateEscalation,
    getPostCompletion: (dealId) => load().postCompletion[dealId] || {},
    setPostCompletion,
    getAudit: (dealId) => load().audit[dealId] || [],
    currentUser: () => load().currentUser,
    setActiveRole,
    resetDemo: () => { localStorage.removeItem(KEY); store = null; load(); },

    // admin-configurable funder / core parameters
    getEffectiveProductParams, getEffectiveCoreParams,
    setProductParam, setCoreParam, resetProductParams,
    hasAdminOverrides: () => !!load().adminParams,
    getOrgAudit: () => load().orgAudit || [],

    // documents
    getDocuments: (dealId) => load().documents[dealId] || [],
    addDocument, updateDocument, deleteDocument, nextDocVersion,

    // client portal
    getPortalInvites: (dealId) => load().portalInvites[dealId] || [],
    inviteClientPortal, findPortalInviteByToken, acceptPortalInvite,
  };

})(window);
