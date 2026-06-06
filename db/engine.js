/* ============================================================================
   Development Appraisal Engine
   Pure calculation layer + Walnut Marches seed data.
   Mirrors the North Gate / Walnut Marches workbook. Section order is canonical
   and fixed (see CATEGORIES). Everything recalculates from `state`.
   ========================================================================== */
(function (global) {
  'use strict';

  var SQM_TO_SQFT = 10.7639;

  // Canonical cost taxonomy — order is fixed across input, dashboard, cashflow.
  var CATEGORIES = [
    { id: 1, name: 'Land / Purchase Price' },
    { id: 2, name: 'Acquisition-Related' },
    { id: 3, name: 'Local Authority' },
    { id: 4, name: "Developers' Professional" },
    { id: 5, name: 'Demolition & Utilities' },
    { id: 6, name: 'Net Construction' },
    { id: 7, name: "Contractors' Professional Fees" },
    { id: 8, name: "Developers' Consultants / Warranties" },
    { id: 9, name: 'Development Management' },
    { id: 10, name: 'Contingencies' },
    { id: 11, name: 'Product Spec & Marketing' },
    { id: 12, name: 'Cost of Sales' },
    { id: 13, name: 'After Sales' },
    { id: 14, name: 'Finance' }
  ];

  // ----- Seed: Walnut Marches, East Grinstead -------------------------------
  function seedState() {
    return {
      id: 'walnut-marches',
      meta: { status: 'In Appraisal', createdAt: '2026-05-28', updatedAt: '2026-06-05', fromTemplate: 'master-v1' },
      overrides: { cost: {}, income: {}, equity: {} },
      project: {
        ref: 'WALNUT-2026-001-A7F2',
        name: 'Walnut Marches',
        address: 'Crawley Down Road, Felbridge, East Grinstead, West Sussex RH19 2PS',
        borough: 'Mid Sussex',
        planningRef: 'DM/23/0990',
        clientRef: 'Total Homes',
        mainContact: 'J. Marlowe',
        askingPrice: 3750000,
        offerPrice: 3500000,
        startDate: '2026-01',
        projectLengthMonths: 18,
        constructionPeriodMonths: 15
      },
      assumptions: {
        vat_newbuild: 0, vat_conversion: 0.05, vat_refurb: 0.20,
        gross_area_allowance: 0.25,
        loan_to_gdv: 0.65,
        base_rate: 0.0375, margin: 0.0525,
        equity: 1000000
      },
      // Income side
      phases: [
        { id: 'p1', name: 'Phase 1', units: 29, netAreaSqft: 20451, salePsf: 709.01178, buildRatePsf: 240, salesStart: 18, salesEnd: 18 },
        { id: 'p2', name: 'Phase 2', units: 0, netAreaSqft: 0, salePsf: 0, buildRatePsf: 0, salesStart: 0, salesEnd: 0 },
        { id: 'p3', name: 'Phase 3', units: 0, netAreaSqft: 0, salePsf: 0, buildRatePsf: 0, salesStart: 0, salesEnd: 0 },
        { id: 'p4', name: 'Phase 4', units: 0, netAreaSqft: 0, salePsf: 0, buildRatePsf: 0, salesStart: 0, salesEnd: 0 },
        { id: 'commercial', name: 'Commercial', units: 0, netAreaSqft: 0, salePsf: 0, buildRatePsf: 0, salesStart: 0, salesEnd: 0 },
        { id: 'parking', name: 'Parking', units: 0, netAreaSqft: 0, salePsf: 0, buildRatePsf: 0, salesStart: 0, salesEnd: 0 },
        { id: 'freehold', name: 'Other (Freehold)', units: 0, netAreaSqft: 0, salePsf: 0, buildRatePsf: 0, salesStart: 0, salesEnd: 0 }
      ],
      // Schedule of Units (deliberately the STALE 6-house schedule from the
      // workbook — 6 units / £8.35m vs phase 29 units / £14.5m. Fires flag #5.)
      units: [
        { id: 'u1', phaseId: 'p1', number: '1', type: 'House', beds: 3, ensuites: 2, baths: 1, giaSqm: 160, outside: 'Garden', price: 975000 },
        { id: 'u2', phaseId: 'p1', number: '2', type: 'House', beds: 5, ensuites: 4, baths: 1, giaSqm: 313, outside: 'Garden', price: 1600000 },
        { id: 'u3', phaseId: 'p1', number: '3', type: 'House', beds: 5, ensuites: 4, baths: 1, giaSqm: 313, outside: 'Garden', price: 1600000 },
        { id: 'u4', phaseId: 'p1', number: '4', type: 'House', beds: 5, ensuites: 4, baths: 1, giaSqm: 313, outside: 'Garden', price: 1600000 },
        { id: 'u5', phaseId: 'p1', number: '5', type: 'House', beds: 5, ensuites: 4, baths: 1, giaSqm: 313, outside: 'Garden', price: 1600000 },
        { id: 'u6', phaseId: 'p1', number: '6', type: 'House', beds: 3, ensuites: 2, baths: 1, giaSqm: 160, outside: 'Garden', price: 975000 }
      ],
      // The entire cost stack as rows. basis: fixed | pct_construction | pct_gdv |
      // pct_land | per_unit | computed_interest
      costLines: [
        // 1 — Land
        { id: 'c1a', cat: 1, item: 'Non-Refundable Deposit', basis: 'pct_land', pct: 0, start: 1, end: 1, included: true, info: true },
        { id: 'c1b', cat: 1, item: 'Exchange Deposit', basis: 'pct_land', pct: 0.10, start: 1, end: 1, included: true },
        { id: 'c1c', cat: 1, item: 'Legal Completion', basis: 'pct_land', pct: 0.90, start: 1, end: 1, included: true },
        { id: 'c1d', cat: 1, item: 'Deferred Final Payment', basis: 'fixed', amount: 0, start: 1, end: 1, included: true, info: true },
        // 2 — Acquisition
        { id: 'c2a', cat: 2, item: 'Stamp Duty (SDLT)', basis: 'fixed', amount: 161250, start: 1, end: 1, included: true, sdlt: true },
        { id: 'c2b', cat: 2, item: 'Bank Valuation', basis: 'pct_land', pct: 0.003, start: 1, end: 1, included: true },
        { id: 'c2c', cat: 2, item: 'Dev Solicitors (Purchase)', basis: 'fixed', amount: 15000, start: 1, end: 1, included: true },
        { id: 'c2d', cat: 2, item: 'Introduction Fees + Planning Gain', basis: 'pct_land', pct: 0.02, start: 1, end: 1, included: true },
        // 3 — Local Authority
        { id: 'c3a', cat: 3, item: 'CIL (Borough & Mayoral)', basis: 'fixed', amount: 250000, start: 4, end: 4, included: true },
        { id: 'c3b', cat: 3, item: 'Carbon Offsetting & Monitoring', basis: 'fixed', amount: 0, start: 4, end: 4, included: true, info: true },
        { id: 'c3c', cat: 3, item: 'Section 106 & 278', basis: 'fixed', amount: 75000, start: 4, end: 4, included: true },
        // 4 — Developers' Professional
        { id: 'c4a', cat: 4, item: 'Site Investigation', basis: 'fixed', amount: 12475, start: 4, end: 4, included: true },
        { id: 'c4b', cat: 4, item: 'Party Wall', basis: 'fixed', amount: 7772, start: 4, end: 4, included: true },
        { id: 'c4c', cat: 4, item: 'Rights of Light', basis: 'fixed', amount: 0, start: 6, end: 6, included: true, info: true },
        { id: 'c4d', cat: 4, item: 'SAP Ratings', basis: 'fixed', amount: 3681, start: 6, end: 6, included: true },
        { id: 'c4e', cat: 4, item: 'Building Regs', basis: 'fixed', amount: 9408, start: 6, end: 6, included: true },
        // 5 — Demolition & Utilities
        { id: 'c5a', cat: 5, item: 'Demolition', basis: 'fixed', amount: 47000, start: 1, end: 3, included: true },
        { id: 'c5b', cat: 5, item: 'Services / Utilities', basis: 'fixed', amount: 41312, start: 1, end: 3, included: true },
        { id: 'c5c', cat: 5, item: 'Other', basis: 'fixed', amount: 0, start: 1, end: 3, included: true, info: true },
        // 6 — Net Construction (per phase, rate x gross area)
        { id: 'c6a', cat: 6, item: 'Phase 1 Construction', basis: 'construction', phaseId: 'p1', vatType: 'newbuild', start: 4, end: 18, included: true },
        // 7 — Contractors' Professional Fees (% of construction)
        { id: 'c7a', cat: 7, item: 'Architects', basis: 'pct_construction', pct: 0.03, start: 5, end: 18, included: true },
        { id: 'c7b', cat: 7, item: 'Landscape Architect', basis: 'pct_construction', pct: 0.005, start: 5, end: 18, included: true },
        { id: 'c7c', cat: 7, item: 'Structural Engineers', basis: 'pct_construction', pct: 0.015, start: 5, end: 18, included: true },
        { id: 'c7d', cat: 7, item: 'M&E Engineers', basis: 'pct_construction', pct: 0.015, start: 5, end: 18, included: true },
        { id: 'c7e', cat: 7, item: 'Fire Consultants', basis: 'pct_construction', pct: 0.005, start: 5, end: 18, included: true },
        // 8 — Developers' Consultants / Warranties
        { id: 'c8a', cat: 8, item: 'Developers QS', basis: 'fixed', amount: 31291, start: 5, end: 18, included: true },
        { id: 'c8b', cat: 8, item: 'Building Warranties / NHBC', basis: 'fixed', amount: 37426, start: 5, end: 18, included: true },
        { id: 'c8c', cat: 8, item: 'Dev Solicitors (DMA)', basis: 'fixed', amount: 0, start: 1, end: 1, included: true, info: true },
        { id: 'c8d', cat: 8, item: 'Dev Solicitors (Construction)', basis: 'fixed', amount: 11453, start: 1, end: 1, included: true },
        { id: 'c8e', cat: 8, item: 'CDM Coordinator', basis: 'fixed', amount: 8999, start: 5, end: 18, included: true },
        { id: 'c8f', cat: 8, item: 'Building Regs Fees', basis: 'fixed', amount: 9612, start: 5, end: 5, included: true },
        // 9 — Development Management
        { id: 'c9a', cat: 9, item: 'Development Management Fee', basis: 'pct_construction', pct: 0, start: 5, end: 18, included: true, info: true },
        { id: 'c9b', cat: 9, item: 'SPV Related Costs', basis: 'fixed', amount: 0, start: 18, end: 18, included: true, info: true },
        // 10 — Contingencies
        { id: 'c10a', cat: 10, item: 'Construction & Consultants', basis: 'pct_construction', pct: 0.05, start: 1, end: 18, included: true },
        { id: 'c10b', cat: 10, item: 'Empty-Unit Council Tax', basis: 'fixed', amount: 0, start: 1, end: 18, included: true, info: true },
        { id: 'c10c', cat: 10, item: 'Other / Professional', basis: 'fixed', amount: 0, start: 1, end: 18, included: true, info: true },
        // 11 — Product Spec & Marketing
        { id: 'c11a', cat: 11, item: 'Brochure', basis: 'fixed', amount: 0, start: 13, end: 14, included: true, info: true },
        { id: 'c11b', cat: 11, item: 'Show Flat — Kit Out', basis: 'fixed', amount: 0, start: 13, end: 14, included: true, info: true },
        { id: 'c11c', cat: 11, item: 'Interior Design', basis: 'fixed', amount: 0, start: 11, end: 12, included: true, info: true },
        // 12 — Cost of Sales
        { id: 'c12a', cat: 12, item: 'Agent Fees — Phase 1', basis: 'pct_gdv', pct: 0.01, phaseId: 'p1', start: 18, end: 18, included: true },
        { id: 'c12b', cat: 12, item: 'Dev Solicitor Sale Fees', basis: 'per_unit', rate: 1500, start: 12, end: 18, included: true },
        // 13 — After Sales
        { id: 'c13a', cat: 13, item: 'After-Sales Management / Snagging', basis: 'fixed', amount: 0, start: 18, end: 18, included: true, info: true },
        // 14 — Finance
        { id: 'c14a', cat: 14, item: 'Bank Charges (Entry)', basis: 'pct_loan', pct: 0.01, start: 1, end: 1, included: true },
        { id: 'c14b', cat: 14, item: 'Bank Charges (Exit)', basis: 'pct_loan', pct: 0.01, start: 18, end: 18, included: true },
        { id: 'c14c', cat: 14, item: 'Bank QS', basis: 'fixed', amount: 31291, start: 1, end: 18, included: true },
        { id: 'c14d', cat: 14, item: 'Bank Solicitor (Purchase)', basis: 'fixed', amount: 15000, start: 1, end: 1, included: true },
        { id: 'c14e', cat: 14, item: 'Bank Solicitor (Construction)', basis: 'fixed', amount: 0, start: 1, end: 1, included: true, info: true },
        { id: 'c14f', cat: 14, item: 'Funding Broker Fee', basis: 'pct_loan', pct: 0.01, start: 1, end: 1, included: true },
        { id: 'c14g', cat: 14, item: 'Bank Interest', basis: 'computed_interest', start: 1, end: 18, included: true }
      ],
      comparables: [
        { id: 'cmp1', address: 'The Maltings, Felbridge', salePrice: 1525000, saleDate: '2025-09', areaSqft: 3180, },
        { id: 'cmp2', address: 'Oak Lodge, Crawley Down', salePrice: 985000, saleDate: '2025-11', areaSqft: 1760 },
        { id: 'cmp3', address: 'Birch House, East Grinstead', salePrice: 1640000, saleDate: '2026-01', areaSqft: 3290 },
        { id: 'cmp4', address: 'Marches Cottage, Felbridge', salePrice: 1180000, saleDate: '2025-07', areaSqft: 2240 }
      ]
    };
  }

  // ----- SDLT matrix (build-def §7) -----------------------------------------
  // Non-residential / mixed & bare-land bands used for development purchases.
  function sdlt(consideration, kind) {
    var v = consideration || 0;
    if (kind === 'land') {
      // bare land — flat 5% above nominal nil-rate (matches workbook practice)
      var bands = [[150000, 0], [250000, 0.02], [Infinity, 0.05]];
      return tiered(v, bands);
    }
    // property with planning / second property — tiered higher rates
    var hb = [[250000, 0.03], [925000, 0.08], [1500000, 0.135], [Infinity, 0.15]];
    return tiered(v, hb);
  }
  function tiered(v, bands) {
    var last = 0, tax = 0;
    for (var i = 0; i < bands.length; i++) {
      var cap = bands[i][0], rate = bands[i][1];
      if (v > last) { tax += (Math.min(v, cap) - last) * rate; last = cap; } else break;
    }
    return Math.round(tax);
  }

  function genRef(name) {
    var slug = (name || 'PROJECT').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 12) || 'PROJECT';
    var yr = new Date().getFullYear();
    var rand = Math.random().toString(16).slice(2, 6).toUpperCase();
    return slug + '-' + yr + '-' + rand;
  }
  function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ----- Blank template (locked master cloned on "New Project") --------------
  // Full canonical cost scaffold at £0 / default %s, so a new appraisal starts
  // structured but empty — the user fills amounts in.
  function blankTemplate() {
    var seed = seedState();
    var blank = {
      id: 'master-v1', isTemplate: true, isLocked: true,
      meta: { status: 'Template', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      overrides: { cost: {}, income: {}, equity: {} },
      project: {
        ref: 'TEMPLATE-MASTER-V1', name: 'Blank Master Template', address: '',
        borough: '', planningRef: '', clientRef: '', mainContact: '',
        askingPrice: 0, offerPrice: 0, startDate: '', projectLengthMonths: 18, constructionPeriodMonths: 15
      },
      assumptions: JSON.parse(JSON.stringify(seed.assumptions)),
      phases: seed.phases.map(function (p) { return { id: p.id, name: p.name, units: 0, netAreaSqft: 0, salePsf: 0, buildRatePsf: p.id === 'p1' ? 240 : 0, salesStart: 0, salesEnd: 0 }; }),
      units: [],
      // clone cost-line structure but zero fixed amounts (keep %/basis defaults — the rate-library seed)
      costLines: seed.costLines.map(function (l) {
        var c = JSON.parse(JSON.stringify(l));
        if (c.basis === 'fixed') c.amount = 0;
        if (c.sdlt) { c.basis = 'sdlt'; c.sdltKind = 'land'; delete c.amount; }
        return c;
      }),
      comparables: []
    };
    blank.assumptions.equity = 0;
    return blank;
  }
  blankTemplate.equityNote = true;

  // a fresh project cloned from the locked template
  function newProjectFromTemplate(name) {
    var t = blankTemplate();
    var p = JSON.parse(JSON.stringify(t));
    p.id = uid();
    p.isTemplate = false; p.isLocked = false;
    p.project.name = name || 'Untitled Scheme';
    p.project.ref = genRef(name || 'NEW');
    var today = new Date().toISOString().slice(0, 10);
    p.meta = { status: 'Draft', createdAt: today, updatedAt: today, fromTemplate: 'master-v1' };
    return p;
  }

  // ----- A couple of additional demo projects for the portfolio -------------
  function demoProjects() {
    // Healthy scheme — Cedar Rise (passes most rules)
    var cedar = seedState();
    cedar.id = 'cedar-rise';
    cedar.meta = { status: 'Approved', createdAt: '2026-03-12', updatedAt: '2026-05-30', fromTemplate: 'master-v1' };
    cedar.overrides = { cost: {}, income: {}, equity: {} };
    cedar.project = Object.assign({}, cedar.project, {
      ref: 'CEDAR-2026-014-B2C9', name: 'Cedar Rise', address: 'London Road, Horsham, West Sussex RH12 1AT',
      borough: 'Horsham', planningRef: 'DC/24/0421', clientRef: 'Total Homes', mainContact: 'A. Okafor',
      askingPrice: 2600000, offerPrice: 2450000, projectLengthMonths: 20, constructionPeriodMonths: 14
    });
    cedar.assumptions = Object.assign({}, cedar.assumptions, { equity: 2655000, loan_to_gdv: 0.60 });
    cedar.project.projectLengthMonths = 18;
    cedar.phases = cedar.phases.map(function (p) {
      if (p.id === 'p1') return Object.assign({}, p, { units: 18, netAreaSqft: 16800, salePsf: 735, buildRatePsf: 205, salesStart: 18, salesEnd: 18 });
      return p;
    });
    // reconcile the schedule to phases (18 units to match)
    cedar.units = [];
    for (var i = 1; i <= 18; i++) cedar.units.push({ id: 'cu' + i, phaseId: 'p1', number: String(i), type: 'House', beds: 4, ensuites: 2, baths: 1, giaSqm: 86.7, outside: 'Garden', price: 16800 * 735 / 18 });
    cedar.costLines = cedar.costLines.map(function (l) {
      var c = JSON.parse(JSON.stringify(l));
      if (c.id === 'c1b') c.pct = 0.10; if (c.id === 'c1c') c.pct = 0.90;
      if (c.cat === 6) c.end = 15;
      if (c.end > 15 && c.cat !== 12 && c.cat !== 14) c.end = 15;
      if (c.cat === 12) { c.start = 18; c.end = 18; }
      if (c.id === 'c14b') { c.start = 18; c.end = 18; }
      if (c.sdlt) c.amount = sdlt(2450000, 'land');
      return c;
    });
    cedar.comparables = cedar.comparables.slice(0, 3);

    // Marginal scheme — Quarry Fields (tight, several flags)
    var quarry = seedState();
    quarry.id = 'quarry-fields';
    quarry.meta = { status: 'In Appraisal', createdAt: '2026-04-02', updatedAt: '2026-06-04', fromTemplate: 'master-v1' };
    quarry.overrides = { cost: {}, income: {}, equity: {} };
    quarry.project = Object.assign({}, quarry.project, {
      ref: 'QUARRY-2026-019-D7E1', name: 'Quarry Fields', address: 'Quarry Lane, Redhill, Surrey RH1 6AB',
      borough: 'Reigate & Banstead', planningRef: 'RE/24/0712', clientRef: 'Total Homes', mainContact: 'S. Patel',
      askingPrice: 4200000, offerPrice: 4100000, projectLengthMonths: 16, constructionPeriodMonths: 15
    });
    quarry.assumptions = Object.assign({}, quarry.assumptions, { equity: 2600000, loan_to_gdv: 0.60 });
    quarry.project.projectLengthMonths = 18;
    quarry.phases = quarry.phases.map(function (p) {
      if (p.id === 'p1') return Object.assign({}, p, { units: 22, netAreaSqft: 18200, salePsf: 775, buildRatePsf: 225, salesStart: 18, salesEnd: 18 });
      return p;
    });
    quarry.units = [];
    for (var qi = 1; qi <= 22; qi++) quarry.units.push({ id: 'qu' + qi, phaseId: 'p1', number: String(qi), type: 'Flat', beds: 2, ensuites: 1, baths: 1, giaSqm: 76.9, outside: 'Balcony', price: 18200 * 775 / 22 });
    quarry.costLines = quarry.costLines.map(function (l) {
      var c = JSON.parse(JSON.stringify(l));
      if (c.cat === 6) c.end = 15;
      if (c.end > 15 && c.cat !== 12 && c.cat !== 14) c.end = 15;
      if (c.cat === 12) { c.start = 18; c.end = 18; }
      if (c.id === 'c14b') { c.start = 18; c.end = 18; }
      if (c.sdlt) c.amount = sdlt(4100000, 'land');
      return c;
    });

    return [cedar, quarry];
  }

  // ----- helpers ------------------------------------------------------------
  function sqftFromSqm(sqm) { return sqm * SQM_TO_SQFT; }
  function phaseGdv(p) { return (p.netAreaSqft || 0) * (p.salePsf || 0); }
  function vatRate(a, type) {
    if (type === 'conversion') return a.vat_conversion;
    if (type === 'refurb') return a.vat_refurb;
    return a.vat_newbuild;
  }

  function constructionBase(state) {
    var a = state.assumptions, total = 0;
    state.costLines.forEach(function (l) {
      if (l.cat === 6 && l.included) {
        var p = state.phases.filter(function (x) { return x.id === l.phaseId; })[0];
        if (!p) return;
        var gross = (p.netAreaSqft || 0) * (1 + a.gross_area_allowance);
        total += (p.buildRatePsf || 0) * gross; // net of VAT
      }
    });
    return total;
  }

  function totalGdv(state) {
    return state.phases.reduce(function (s, p) { return s + phaseGdv(p); }, 0);
  }
  function landBase(state) {
    // Land = exchange + legal + non-refundable + deferred (the actual price)
    var total = 0;
    state.costLines.forEach(function (l) {
      if (l.cat === 1 && l.included) total += resolveAmount(l, state, true);
    });
    return total;
  }

  // Resolve a single cost line's £ amount. `landPass` avoids recursion when
  // computing the land base itself.
  function resolveAmount(line, state, landPass) {
    if (!line.included) return 0;
    var a = state.assumptions;
    switch (line.basis) {
      case 'fixed': return line.amount || 0;
      case 'pct_land':
        if (landPass) {
          // land internal: pct of the purchase price (offer price)
          return (line.pct || 0) * (state.project.offerPrice || 0);
        }
        return (line.pct || 0) * (state.project.offerPrice || 0);
      case 'pct_construction': return (line.pct || 0) * constructionBase(state);
      case 'pct_gdv': {
        var p = state.phases.filter(function (x) { return x.id === line.phaseId; })[0];
        return (line.pct || 0) * (p ? phaseGdv(p) : totalGdv(state));
      }
      case 'pct_loan': return (line.pct || 0) * grossLoan(state);
      case 'per_unit': return (line.rate || 0) * totalUnits(state);
      case 'construction': {
        var ph = state.phases.filter(function (x) { return x.id === line.phaseId; })[0];
        if (!ph) return 0;
        var gross = (ph.netAreaSqft || 0) * (1 + a.gross_area_allowance);
        var net = (ph.buildRatePsf || 0) * gross;
        return net * (1 + vatRate(a, line.vatType));
      }
      case 'sdlt': return sdlt(state.project.offerPrice || 0, line.sdltKind || 'land');
      case 'computed_interest': return line._interest || 0;
      default: return 0;
    }
  }

  function totalUnits(state) {
    return state.phases.reduce(function (s, p) { return s + (p.units || 0); }, 0);
  }
  function grossLoan(state) {
    return state.assumptions.loan_to_gdv * totalGdv(state);
  }
  function interestRate(state) {
    return state.assumptions.base_rate + state.assumptions.margin;
  }

  function lineMonths(line) {
    var s = line.start || 0, e = line.end || 0;
    if (!s || !e) return 0;
    return Math.abs(e - s) + 1;
  }

  // even monthly spread of `amount` across [start,end], summed into arr (1-indexed up to horizon)
  function spread(arr, amount, start, end, horizon) {
    if (!amount || !start || !end) return;
    var months = Math.abs(end - start) + 1;
    var per = amount / months;
    for (var m = Math.min(start, end); m <= Math.max(start, end); m++) {
      if (m >= 1 && m <= horizon) arr[m] += per;
    }
  }

  // ----- the monthly cashflow + interest engine -----------------------------
  // Builds a CATEGORY-LEVEL monthly matrix so the cashflow can be shown as an
  // editable table. Manual edits live in state.overrides and replace the
  // spread default for that (category, month) / income[month] / equity[month].
  function ov(state) {
    var o = state.overrides || {};
    return { cost: o.cost || {}, income: o.income || {}, equity: o.equity || {} };
  }
  function hasOv(map, key) { return map && Object.prototype.hasOwnProperty.call(map, key); }

  function computeCashflow(state) {
    var H = state.project.projectLengthMonths || 18;
    var mRate = interestRate(state) / 12;
    var equityTotal = state.assumptions.equity || 0;
    var o = ov(state);
    var m, i;

    // category-level monthly expenditure (everything except computed interest)
    var catMonthly = {}; // catId -> [0..H]
    CATEGORIES.forEach(function (c) { catMonthly[c.id] = []; for (i = 0; i <= H; i++) catMonthly[c.id].push(0); });
    state.costLines.forEach(function (l) {
      if (!l.included || l.basis === 'computed_interest') return;
      var amt = resolveAmount(l, state);
      spread(catMonthly[l.cat], amt, l.start, l.end, H);
    });
    // apply per-category overrides
    CATEGORIES.forEach(function (c) {
      var omap = o.cost[c.id];
      if (!omap) return;
      for (m = 1; m <= H; m++) if (hasOv(omap, m)) catMonthly[c.id][m] = +omap[m] || 0;
    });

    // income (sales) per month, default spread across each phase's sale window
    var inc = []; for (i = 0; i <= H; i++) inc.push(0);
    state.phases.forEach(function (p) {
      var g = phaseGdv(p);
      if (g > 0 && p.salesStart && p.salesEnd) spread(inc, g, p.salesStart, p.salesEnd, H);
    });
    for (m = 1; m <= H; m++) if (hasOv(o.income, m)) inc[m] = +o.income[m] || 0;

    // equity drawn — default fully in month 1
    var eq = []; for (i = 0; i <= H; i++) eq.push(0);
    eq[1] = equityTotal;
    for (m = 1; m <= H; m++) if (hasOv(o.equity, m)) eq[m] = +o.equity[m] || 0;

    // iterate months
    var rows = [];
    var balance = 0, peak = 0, peakMonth = 0, totalInterest = 0, cumInterest = 0;
    var totalExpAll = 0, totalIncAll = 0, totalEqAll = 0;
    for (m = 1; m <= H; m++) {
      var expM = 0; CATEGORIES.forEach(function (c) { expM += catMonthly[c.id][m]; });
      var interest = balance > 0 ? balance * mRate : 0;
      totalInterest += interest; cumInterest += interest;
      var opening = balance;
      balance = balance + interest + expM - inc[m] - eq[m];
      if (balance > peak) { peak = balance; peakMonth = m; }
      totalExpAll += expM; totalIncAll += inc[m]; totalEqAll += eq[m];
      rows.push({
        month: m, opening: opening, expenditure: expM, income: inc[m],
        equityDraw: eq[m], interest: interest, balance: balance, cumInterest: cumInterest
      });
    }

    // category row totals (across all months)
    var catTotals = {};
    CATEGORIES.forEach(function (c) { var t = 0; for (m = 1; m <= H; m++) t += catMonthly[c.id][m]; catTotals[c.id] = t; });

    return {
      rows: rows, peak: peak, peakMonth: peakMonth, totalInterest: totalInterest, horizon: H,
      catMonthly: catMonthly, income: inc, equity: eq, catTotals: catTotals,
      totals: { expenditure: totalExpAll, income: totalIncAll, equity: totalEqAll, interest: totalInterest },
      // which cells are user-overridden (for UI markers)
      overridden: o
    };
  }

  // mutate helpers used by the editable cashflow table
  function setOverride(state, kind, catId, month, value) {
    if (!state.overrides) state.overrides = { cost: {}, income: {}, equity: {} };
    var o = state.overrides;
    if (kind === 'cost') { if (!o.cost[catId]) o.cost[catId] = {}; o.cost[catId][month] = value; }
    else if (kind === 'income') { o.income[month] = value; }
    else if (kind === 'equity') { o.equity[month] = value; }
  }
  function clearOverrides(state) { state.overrides = { cost: {}, income: {}, equity: {} }; }
  function isOverridden(state, kind, catId, month) {
    var o = state.overrides || {};
    if (kind === 'cost') return !!(o.cost && o.cost[catId] && hasOv(o.cost[catId], month));
    if (kind === 'income') return !!(o.income && hasOv(o.income, month));
    if (kind === 'equity') return !!(o.equity && hasOv(o.equity, month));
    return false;
  }

  // ----- main model ---------------------------------------------------------
  function computeModel(state) {
    var gdv = totalGdv(state);
    var cBase = constructionBase(state);
    var land = landBase(state);

    // cashflow first (drives interest, peak)
    var cf = computeCashflow(state);

    // inject interest into the interest line so it appears in totals/breakdowns
    var interestLine = state.costLines.filter(function (l) { return l.basis === 'computed_interest'; })[0];
    if (interestLine) interestLine._interest = cf.totalInterest;

    // per-category totals & resolved lines
    var byCat = {}; CATEGORIES.forEach(function (c) { byCat[c.id] = { id: c.id, name: c.name, total: 0, lines: [] }; });
    var totalCost = 0;
    state.costLines.forEach(function (l) {
      var amt = resolveAmount(l, state);
      var row = {
        id: l.id, cat: l.cat, item: l.item, basis: l.basis, pct: l.pct, rate: l.rate,
        start: l.start, end: l.end, months: lineMonths(l), included: l.included,
        info: !!l.info, sdlt: !!l.sdlt, amount: amt, phaseId: l.phaseId
      };
      byCat[l.cat].lines.push(row);
      if (l.included) { byCat[l.cat].total += amt; totalCost += amt; }
    });

    var financeCost = byCat[14].total;
    var profit = gdv - totalCost;
    var equity = state.assumptions.equity || 0;
    var gLoan = grossLoan(state);

    var ratios = {
      gdv: gdv,
      totalCost: totalCost,
      profit: profit,
      profitPctGdv: gdv ? profit / gdv : 0,
      profitPctCost: totalCost ? profit / totalCost : 0,
      profitExFinance: (totalCost - financeCost) ? (profit + financeCost) / (totalCost - financeCost) : 0,
      roe: equity ? profit / equity : 0,
      peakFunding: cf.peak,
      peakMonth: cf.peakMonth,
      peakLoanToGdv: gdv ? cf.peak / gdv : 0,
      peakLoanToCost: totalCost ? cf.peak / totalCost : 0,
      grossLoan: gLoan,
      equity: equity,
      interest: cf.totalInterest,
      financeCost: financeCost,
      monthlyInterestIfUnsold: cf.peak * (interestRate(state) / 12)
    };

    // funding waterfall (build-def §6 row 3)
    var costOfSales = byCat[12].total;
    var exitFee = (state.costLines.filter(function (l) { return l.id === 'c14b'; })[0]);
    var exitFeeAmt = exitFee ? resolveAmount(exitFee, state) : 0;
    var afterSales = byCat[13].total;
    var balanceToFund = totalCost - cf.peak - costOfSales - exitFeeAmt - afterSales - equity;
    var waterfall = {
      totalCost: totalCost, peakFunding: cf.peak, costOfSales: costOfSales,
      exitFee: exitFeeAmt, afterSales: afterSales, equity: equity, balanceToFund: balanceToFund
    };

    var flags = computeFlags(state, ratios, waterfall);
    var sensitivity = computeSensitivity(state, ratios);

    return {
      gdv: gdv, constructionBase: cBase, land: land, totalCost: totalCost,
      byCat: byCat, categories: CATEGORIES, ratios: ratios, cashflow: cf,
      waterfall: waterfall, flags: flags, sensitivity: sensitivity,
      scheduleTotals: scheduleTotals(state)
    };
  }

  function scheduleTotals(state) {
    var t = { units: 0, sqft: 0, value: 0 };
    state.units.forEach(function (u) {
      t.units += 1; t.sqft += sqftFromSqm(u.giaSqm || 0); t.value += (u.price || 0);
    });
    return t;
  }

  // ----- red-flag rule set (build-def §7) -----------------------------------
  function computeFlags(state, r, w) {
    var flags = [];
    function add(sev, rule, detail) { flags.push({ sev: sev, rule: rule, detail: detail }); }

    // 1 — Profit % GDV
    if (r.profitPctGdv < 0.15) add('red', 'Profit % GDV below 15%', pct(r.profitPctGdv) + ' vs 20% target');
    else if (r.profitPctGdv < 0.20) add('amber', 'Profit % GDV below 20% target', pct(r.profitPctGdv));
    // 2 — Profit excl finance
    if (r.profitExFinance < 0.25) add('red', 'Profit excl. finance below 25%', pct(r.profitExFinance));
    else if (r.profitExFinance < 0.30) add('amber', 'Profit excl. finance below 30% (lender target)', pct(r.profitExFinance));
    // 3 — Peak loan to cost
    if (r.peakLoanToCost > 0.80) add('red', 'Peak Loan to Cost above 80%', pct(r.peakLoanToCost));
    // also peak to GDV soft cap
    if (r.peakLoanToGdv > 0.65) add('amber', 'Peak Loan to GDV above 65%', pct(r.peakLoanToGdv));
    // 4 — balance to fund from sales income ≠ 0 (proportional: workbook breach was 4.12%)
    var balPct = r.totalCost ? Math.abs(w.balanceToFund) / r.totalCost : 0;
    if (balPct > 0.03) add('red', 'Balance to fund from sales income ≠ £0', money(w.balanceToFund) + ' · ' + pct(balPct) + ' of cost');
    else if (balPct > 0.01) add('amber', 'Funding stack reconciles within tolerance', money(w.balanceToFund) + ' · ' + pct(balPct) + ' of cost');
    // 5 — schedule reconciliation
    var sched = scheduleTotals(state);
    var p1 = state.phases.filter(function (x) { return x.id === 'p1'; })[0];
    var phaseUnits = state.phases.reduce(function (s, p) { return s + (p.units || 0); }, 0);
    if (sched.units !== phaseUnits) add('red', 'Schedule of Units ≠ phase unit count', sched.units + ' scheduled vs ' + phaseUnits + ' in phases');
    // value reconciliation
    if (Math.abs(sched.value - totalGdv(state)) > 1000) add('red', 'Schedule value ≠ phase GDV', money(sched.value) + ' vs ' + money(totalGdv(state)));
    // 6 — project length vs construction (no completion buffer)
    var lastConstrEnd = 0;
    state.costLines.forEach(function (l) { if (l.cat === 6 && l.included && l.end > lastConstrEnd) lastConstrEnd = l.end; });
    if (lastConstrEnd >= state.project.projectLengthMonths) add('amber', 'No completion buffer', 'Construction ends month ' + lastConstrEnd + ', project length ' + state.project.projectLengthMonths);
    // 8 — sale months unset
    var liveNoSale = state.phases.some(function (p) { return phaseGdv(p) > 0 && (!p.salesStart || !p.salesEnd); });
    if (liveNoSale) add('amber', 'Sale months unset while income exists', 'Cashflow cannot run for that phase');

    return flags;
  }

  // ----- sensitivity grids (build-def §6 row 5) -----------------------------
  var PSF_STEPS = [-0.35, -0.30, -0.25, -0.20, -0.15, -0.10, -0.075, -0.05, -0.025, 0, 0.025, 0.05, 0.075, 0.10, 0.15, 0.20];
  var COST_STEPS = [-0.10, -0.075, -0.05, -0.025, 0, 0.025, 0.05, 0.075, 0.10, 0.125, 0.15, 0.175, 0.20, 0.25, 0.27];

  function computeSensitivity(state, r) {
    var basePsf = state.phases[0] ? state.phases[0].salePsf : 0;
    var area = state.phases[0] ? state.phases[0].netAreaSqft : 0;
    var baseCost = r.totalCost;
    var equity = r.equity;
    var peakDebt = r.grossLoan; // facility, per workbook C8

    function profitAt(psfStep, costStep) {
      var psf = basePsf * (1 + psfStep);
      return (psf * area) - baseCost * (1 + costStep);
    }
    var profit = [], eq = [], debt = [];
    COST_STEPS.forEach(function (cs) {
      var pr = [], er = [], dr = [];
      PSF_STEPS.forEach(function (ps) {
        var p = profitAt(ps, cs);
        pr.push(p);
        // equity: capped at equity; equity + profit but not above equity
        er.push(Math.min(equity, equity + p));
        // debt: capped at peak debt
        dr.push(Math.min(peakDebt, peakDebt + p));
      });
      profit.push(pr); eq.push(er); debt.push(dr);
    });
    return {
      psfSteps: PSF_STEPS, costSteps: COST_STEPS, basePsf: basePsf,
      profit: profit, equity: eq, debt: debt, equityCap: equity, debtCap: peakDebt
    };
  }

  // ----- formatting ---------------------------------------------------------
  function money(n) {
    if (n === 0) return '—';
    var neg = n < 0; n = Math.round(Math.abs(n));
    var s = '£' + n.toLocaleString('en-GB');
    return neg ? '(' + s + ')' : s;
  }
  function moneyShort(n) {
    var neg = n < 0; var a = Math.abs(n); var s;
    if (a >= 1e6) s = '£' + (a / 1e6).toFixed(2) + 'm';
    else if (a >= 1e3) s = '£' + (a / 1e3).toFixed(0) + 'k';
    else s = '£' + Math.round(a);
    return neg ? '(' + s + ')' : s;
  }
  function pct(n, dp) { return (n * 100).toFixed(dp == null ? 1 : dp) + '%'; }

  // ----- portfolio risk scoring ---------------------------------------------
  // Rolls the flag set + key ratios into a single traffic-light + score for the
  // portfolio dashboard. red flag => High; else amber count / margin drives it.
  function riskScore(model) {
    var f = model.flags;
    var reds = f.filter(function (x) { return x.sev === 'red'; }).length;
    var ambers = f.filter(function (x) { return x.sev === 'amber'; }).length;
    var r = model.ratios;
    var level, sev, score;
    if (reds > 0 || r.profit <= 0) { level = 'High'; sev = 'red'; }
    else if (ambers >= 2 || r.profitPctGdv < 0.18 || r.peakLoanToCost > 0.78) { level = 'Elevated'; sev = 'amber'; }
    else if (ambers === 1) { level = 'Moderate'; sev = 'amber'; }
    else { level = 'Low'; sev = 'ok'; }
    // 0..100 (higher = riskier) for the gauge
    score = Math.min(100, reds * 30 + ambers * 12 + Math.max(0, (0.20 - r.profitPctGdv) * 200) + Math.max(0, (r.peakLoanToCost - 0.70) * 120));
    return { level: level, sev: sev, score: Math.round(score), reds: reds, ambers: ambers };
  }

  global.Appraisal = {
    CATEGORIES: CATEGORIES,
    seedState: seedState,
    blankTemplate: blankTemplate,
    newProjectFromTemplate: newProjectFromTemplate,
    demoProjects: demoProjects,
    sdlt: sdlt,
    riskScore: riskScore,
    setOverride: setOverride,
    clearOverrides: clearOverrides,
    isOverridden: isOverridden,
    computeModel: computeModel,
    phaseGdv: phaseGdv,
    sqftFromSqm: sqftFromSqm,
    totalGdv: totalGdv,
    constructionBase: constructionBase,
    money: money, moneyShort: moneyShort, pct: pct,
    PSF_STEPS: PSF_STEPS, COST_STEPS: COST_STEPS,
    SQM_TO_SQFT: SQM_TO_SQFT
  };
})(typeof window !== 'undefined' ? window : this);
