/* ============================================================================
   Excel Import — reads a North Gate–template appraisal workbook (.xlsx) and
   builds a full project object ready to save via DB.upsert.

   Approach: clone the locked master template (window.Appraisal.newProjectFromTemplate)
   so every cost-line id / basis / category is guaranteed identical to every
   other scheme in the system — then overwrite amounts, %, start/end months,
   phases, units and site details with values read from the Input / Summary /
   Schedule of Units sheets.

   Row lookup is LABEL-ANCHORED, not fixed-address. Different schemes built off
   this template routinely insert or remove rows (e.g. an extra "Commercial"
   construction line), which shifts every row below it — a workbook we tested
   this against (Southville Nine Elms) does exactly that. So instead of trusting
   e.g. "B58", we find the row whose column A reads "CIL (Borough & Mayoral)"
   inside the "LOCAL AUTHORITY COSTS" section and read column B off THAT row.
   Column layout within a section (which field lives in which column) has been
   stable across every workbook we've seen, so only rows are looked up dynamically.
   ========================================================================== */
(function (global) {
  'use strict';

  function cell(ws, addr) {
    var c = ws && ws[addr];
    return c ? c.v : undefined;
  }
  function num(ws, addr, fallback) {
    var v = cell(ws, addr);
    return (typeof v === 'number' && !isNaN(v)) ? v : (fallback == null ? 0 : fallback);
  }
  function numOrNull(ws, addr) {
    var v = cell(ws, addr);
    return (typeof v === 'number' && !isNaN(v)) ? v : null;
  }
  function str(ws, addr, fallback) {
    var v = cell(ws, addr);
    return (v == null || v === '') ? (fallback || '') : String(v).trim();
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function setLine(lines, id, patch) {
    var l = lines.filter(function (x) { return x.id === id; })[0];
    if (!l) return;
    Object.keys(patch).forEach(function (k) {
      if (patch[k] !== undefined && patch[k] !== null) l[k] = patch[k];
    });
  }

  function monthRange(H, s, e) {
    if (s == null || e == null) return { start: s, end: e };
    return { start: clamp(Math.round(s), 1, H || 18), end: clamp(Math.round(e), 1, H || 18) };
  }

  function fmtDate(v) {
    if (v instanceof Date && !isNaN(v)) return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0');
    return null;
  }

  // ----- label-anchored row lookup -------------------------------------------
  function normLabel(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[:.]/g, '').replace(/\s+/g, ' ').trim();
  }
  function maxRow(ws) {
    var ref = ws && ws['!ref'];
    if (!ref) return 400;
    var m = ref.match(/:[A-Z]+(\d+)/);
    return m ? parseInt(m[1], 10) : 400;
  }
  // find the row whose column-A text matches `label` (after normalizing).
  // Two passes: (1) exact match, (2) prefix match — the cell text starts with
  // the label, or the label starts with the cell text. Real workbooks add
  // trailing words to line labels (e.g. 'Section 106 & 278' becomes
  // 'Section 106 & 278 + Planning'); exact-only matching silently dropped those
  // costs. The search window is bounded per section, so prefix matching here
  // won't cross-match unrelated rows.
  function findRow(ws, label, fromRow, toRow) {
    var target = normLabel(label);
    var end = toRow || maxRow(ws);
    var r, v;
    // pass 1 — exact
    for (r = (fromRow || 1); r <= end; r++) {
      v = cell(ws, 'A' + r);
      if (v == null || v === '') continue;
      if (normLabel(v) === target) return r;
    }
    // pass 2 — prefix either direction
    if (target.length >= 4) {
      for (r = (fromRow || 1); r <= end; r++) {
        v = cell(ws, 'A' + r);
        if (v == null || v === '') continue;
        var nv = normLabel(v);
        if (nv.indexOf(target) === 0 || target.indexOf(nv) === 0) return r;
      }
    }
    return null;
  }
  // find an item row within `maxOffset` rows below an anchor (section header),
  // so identical labels reused elsewhere in the sheet (e.g. "Phase 1" appears
  // in 5 different tables) don't get cross-matched.
  function findItemRow(ws, anchorRow, label, maxOffset) {
    if (anchorRow == null) return null;
    return findRow(ws, label, anchorRow + 1, anchorRow + (maxOffset || 20));
  }

  // ----- main parse ------------------------------------------------------------
  function parseWorkbook(wb, schemeName) {
    var warnings = [];
    var inp = wb.Sheets['Input'];
    var sum = wb.Sheets['Summary'];
    var sch = wb.Sheets['Schedule of Units'];
    if (!inp) throw new Error("This workbook has no 'Input' sheet — it doesn't look like a North Gate–template appraisal.");
    if (!sum) warnings.push("No 'Summary' sheet found — site details (address, planning ref, client) were skipped.");
    if (!sch) warnings.push("No 'Schedule of Units' sheet found — unit-by-unit schedule was skipped.");

    var name = schemeName || 'Imported Scheme';
    if (sch) {
      var title = str(sch, 'A1', '');
      if (title) name = schemeName || title.split(',')[0].trim() || title;
    }

    var p = global.Appraisal.newProjectFromTemplate(name);

    // ----- section anchors (row numbers) ---------------------------------------
    var anc = {
      inputs: findRow(inp, 'INPUTS:'),
      income: findRow(inp, 'INCOME:'),
      salesTerm: findRow(inp, 'SALES TERM'),
      purchasePrice: findRow(inp, 'Purchase Price:'),
      acquisition: findRow(inp, 'ACQUISITION RELATED COSTS'),
      localAuthority: findRow(inp, 'LOCAL AUTHORITY COSTS'),
      devProfessional: findRow(inp, 'DEVELOPERS PROFESSIONAL COSTS'),
      demolition: findRow(inp, 'DEMOLITION & UTILITIES'),
      buildAssumptions: findRow(inp, 'BUILD ASSUMPTIONS'),
      contractorsFees: findRow(inp, 'CONTRACTORS PROFESSIONAL FEES'),
      devConsultants: findRow(inp, 'DEVELOPERS CONSULTANTS/WARRANTIES'),
      devManagement: findRow(inp, 'DEVELOPMENT MANAGEMENT COSTS'),
      contingencies: findRow(inp, 'CONTIGENCIES') || findRow(inp, 'CONTINGENCIES'),
      productSpec: findRow(inp, 'PRODUCT SPEC. & MARKETING'),
      costOfSales: findRow(inp, 'COST of SALES'),
      afterSales: findRow(inp, 'AFTER SALES COSTS'),
      finance: findRow(inp, 'FINANCE')
    };
    var missingAnchors = Object.keys(anc).filter(function (k) { return anc[k] == null; });
    if (missingAnchors.length) warnings.push('Some sections had a different heading than expected (' + missingAnchors.join(', ') + ') — those figures were left at template defaults, please check them.');

    // ----- top-of-sheet single values -------------------------------------------
    var H = num(inp, 'C2', 18);
    p.project.projectLengthMonths = H;
    var p1ConstrRow = findItemRow(inp, anc.buildAssumptions, 'Phase 1', 12);
    p.project.constructionPeriodMonths = p1ConstrRow ? num(inp, 'E' + p1ConstrRow, 15) : 15;
    var startDate = fmtDate(cell(inp, 'B8'));
    if (startDate) p.project.startDate = startDate;
    var offerRow = findItemRow(inp, anc.purchasePrice, 'Land/Purchase Price', 8);
    p.project.offerPrice = offerRow ? num(inp, 'B' + offerRow, 0) : 0;
    p.project.askingPrice = p.project.offerPrice;

    if (sum) {
      p.project.address = str(sum, 'C4', p.project.address);
      p.project.borough = str(sum, 'C5', p.project.borough);
      p.project.planningRef = str(sum, 'C6', p.project.planningRef);
      p.project.clientRef = str(sum, 'C7', p.project.clientRef);
      p.project.mainContact = str(sum, 'C8', p.project.mainContact);
    }

    // ----- assumptions -----------------------------------------------------------
    var a = p.assumptions;
    var vatRow = findRow(inp, 'VAT Assumptions');
    if (vatRow) {
      var nb = findItemRow(inp, vatRow, 'New Build', 4), cv = findItemRow(inp, vatRow, 'Conversion', 4), rf = findItemRow(inp, vatRow, 'Refurbishment', 4);
      if (nb) a.vat_newbuild = num(inp, 'B' + nb, a.vat_newbuild);
      if (cv) a.vat_conversion = num(inp, 'B' + cv, a.vat_conversion);
      if (rf) a.vat_refurb = num(inp, 'B' + rf, a.vat_refurb);
    }
    var gaRow = findRow(inp, 'Gross Area Allowance');
    if (gaRow) a.gross_area_allowance = num(inp, 'B' + gaRow, a.gross_area_allowance);
    var baseRateRow = findRow(inp, 'Base rate:');
    if (baseRateRow) a.base_rate = num(inp, 'B' + baseRateRow, a.base_rate);
    var marginRow = findRow(inp, 'Margin interest rate:');
    if (marginRow) a.margin = num(inp, 'B' + marginRow, a.margin);
    var equityRow = findRow(inp, 'Equity Required');
    if (equityRow) a.equity = num(inp, 'B' + equityRow, a.equity);
    var ltgdvRow = findRow(inp, 'Loan to GDV:');
    if (ltgdvRow) a.loan_to_gdv = num(inp, 'B' + ltgdvRow, a.loan_to_gdv);

    // ----- phases (7 canonical rows: p1..p4, commercial, parking, freehold) ------
    var phaseLabels = ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Commercial:', 'Parking:', 'Other (Freehold):'];
    var phaseNameToId = { 'phase 1': 'p1', 'phase 2': 'p2', 'phase 3': 'p3', 'phase 4': 'p4', 'commercial': 'commercial', 'parking': 'parking', 'other (freehold)': 'freehold', 'other': 'freehold' };
    p.phases.forEach(function (ph, i) {
      var label = phaseLabels[i];
      var ur = findItemRow(inp, anc.inputs, label, 10);
      var ir2 = findItemRow(inp, anc.income, label, 10);
      var sr = findItemRow(inp, anc.salesTerm, label, 10);
      if (ur) ph.units = num(inp, 'B' + ur, 0);
      if (ir2) { ph.netAreaSqft = num(inp, 'C' + ir2, 0); ph.salePsf = num(inp, 'D' + ir2, 0); }
      if (sr) { ph.salesStart = numOrNull(inp, 'B' + sr) || 0; ph.salesEnd = numOrNull(inp, 'C' + sr) || 0; }
      if (ph.netAreaSqft > 0 || ph.units > 0) ph.phaseType = ph.phaseType || 'House';
    });

    // ----- units (Schedule of Units) ----------------------------------------------
    if (sch) {
      var units = [];
      var r = 4;
      while (true) {
        var numberVal = cell(sch, 'B' + r);
        if (numberVal == null || numberVal === '') break;
        units.push({
          id: 'u' + r + '_' + Date.now().toString(36),
          phaseId: 'p1',
          number: String(numberVal),
          type: str(sch, 'C' + r, 'House'),
          beds: num(sch, 'D' + r, 0),
          ensuites: num(sch, 'E' + r, 0),
          baths: num(sch, 'F' + r, 0),
          giaSqm: num(sch, 'G' + r, 0),
          outside: str(sch, 'I' + r, ''),
          price: num(sch, 'J' + r, 0)
        });
        r++;
        if (r > 500) break;
      }
      if (units.length) p.units = units;
    }

    // ----- cost stack -------------------------------------------------------------
    var L = p.costLines;
    function line(id, patch, rangeAddrs) {
      if (rangeAddrs) {
        var rg = monthRange(H, numOrNull(inp, rangeAddrs[0]), numOrNull(inp, rangeAddrs[1]));
        patch.start = rg.start; patch.end = rg.end;
      }
      setLine(L, id, patch);
    }
    function itemRow(anchor, label, offset) { return findItemRow(inp, anchor, label, offset || 12); }

    // 1 — Land / Purchase Price
    var r44 = itemRow(anc.purchasePrice, 'Non Refundable Deposit:'), r45 = itemRow(anc.purchasePrice, 'Exchange Deposit:'),
        r46 = itemRow(anc.purchasePrice, 'Legal Completion'), r47 = itemRow(anc.purchasePrice, 'Defered Final Payment:');
    if (r44) line('c1a', { pct: num(inp, 'C' + r44, 0) }, ['D' + r44, 'E' + r44]);
    if (r45) line('c1b', { pct: num(inp, 'C' + r45, 0.10) }, ['D' + r45, 'E' + r45]);
    if (r46) line('c1c', { pct: num(inp, 'C' + r46, 0.90) }, ['D' + r46, 'E' + r46]);
    if (r47) line('c1d', { amount: num(inp, 'B' + r47, 0) }, ['D' + r47, 'E' + r47]);

    // 2 — Acquisition-related. The workbook computes each of these as either
    // `= price × pct` or a hard-typed amount. Match whichever it actually uses:
    // if the amount cell equals pct×price (±£1) treat it as pct (stays reactive
    // if the price changes); otherwise the typed amount is authoritative.
    var offerPriceVal = p.project.offerPrice || 0;
    function amtOrPct(id, row, rangeCols) {
      var amt = num(inp, 'B' + row, 0), pc = num(inp, 'C' + row, 0);
      var patch;
      if (pc > 0 && Math.abs(amt - pc * offerPriceVal) < 1) patch = { pct: pc, basis: 'pct_land' };
      else patch = { amount: amt, basis: 'fixed', pct: 0 };
      line(id, patch, [rangeCols[0] + row, rangeCols[1] + row]);
    }
    // Stamp Duty: the workbook charges a flat % of the purchase price
    // (=B48*C51), NOT tiered SDLT — override the template's tiered basis.
    var r51 = itemRow(anc.acquisition, 'Stamp Duty');
    if (r51) {
      var sdAmt = num(inp, 'B' + r51, 0), sdPct = num(inp, 'C' + r51, 0);
      var sdPatch;
      if (sdPct > 0 && Math.abs(sdAmt - sdPct * offerPriceVal) < 1) sdPatch = { pct: sdPct, basis: 'pct_land' };
      else sdPatch = { amount: sdAmt, basis: 'fixed' };
      sdPatch.sdltKind = null;
      var c2aLine = L.filter(function (l) { return l.id === 'c2a'; })[0];
      if (c2aLine) { c2aLine.sdlt = false; delete c2aLine.sdltKind; }
      line('c2a', sdPatch, ['D' + r51, 'E' + r51]);
    }
    var r52 = itemRow(anc.acquisition, 'Bank Valuation'), r53 = itemRow(anc.acquisition, 'Dev Solicitors Fees (Purchase)'), r54 = itemRow(anc.acquisition, 'Introduction Fees + Planning Gain');
    if (r52) amtOrPct('c2b', r52, ['D', 'E']);
    if (r53) line('c2c', { amount: num(inp, 'B' + r53, 0) }, ['D' + r53, 'E' + r53]);
    if (r54) amtOrPct('c2d', r54, ['D', 'E']);

    // 3 — Local Authority
    var r58 = itemRow(anc.localAuthority, 'CIL (Borough & Mayoral)'), r59 = itemRow(anc.localAuthority, 'Carbon offsetting & monitoring'), r60 = itemRow(anc.localAuthority, 'Section 106 & 278');
    if (r58) line('c3a', { amount: num(inp, 'B' + r58, 0) }, ['C' + r58, 'D' + r58]);
    if (r59) line('c3b', { amount: num(inp, 'B' + r59, 0) }, ['C' + r59, 'D' + r59]);
    if (r60) line('c3c', { amount: num(inp, 'B' + r60, 0) }, ['C' + r60, 'D' + r60]);

    // 4 — Developers' Professional
    var r64 = itemRow(anc.devProfessional, 'Site Investigation'), r65 = itemRow(anc.devProfessional, 'Party Wall'),
        r66 = itemRow(anc.devProfessional, 'Rights of Light consultant, insurance and compensation'),
        r67 = itemRow(anc.devProfessional, 'SAP Ratings'), r68 = itemRow(anc.devProfessional, 'Building Regs');
    if (r64) line('c4a', { amount: num(inp, 'B' + r64, 0) }, ['C' + r64, 'D' + r64]);
    if (r65) line('c4b', { amount: num(inp, 'B' + r65, 0) }, ['C' + r65, 'D' + r65]);
    if (r66) line('c4c', { amount: num(inp, 'B' + r66, 0) }, ['C' + r66, 'D' + r66]);
    if (r67) line('c4d', { amount: num(inp, 'B' + r67, 0) }, ['C' + r67, 'D' + r67]);
    if (r68) line('c4e', { amount: num(inp, 'B' + r68, 0) }, ['C' + r68, 'D' + r68]);

    // 5 — Demolition & Utilities
    var r72 = itemRow(anc.demolition, 'Demolition'), r73 = itemRow(anc.demolition, 'Services'), r74 = itemRow(anc.demolition, 'Other');
    if (r72) line('c5a', { amount: num(inp, 'B' + r72, 0) }, ['D' + r72, 'E' + r72]);
    if (r73) line('c5b', { amount: num(inp, 'B' + r73, 0) }, ['D' + r73, 'E' + r73]);
    if (r74) line('c5c', { amount: num(inp, 'B' + r74, 0) }, ['D' + r74, 'E' + r74]);

    // 6 — Net Construction: walk EVERY row of the Build Assumptions table so any
    // extra per-phase construction line (e.g. a Commercial build cost) is picked
    // up automatically, not just Phase 1.
    var constructionLines = [];
    if (anc.buildAssumptions) {
      for (var br = anc.buildAssumptions + 1; br <= anc.buildAssumptions + 12; br++) {
        var lbl = cell(inp, 'A' + br);
        if (lbl == null || lbl === '') continue;
        var nlbl = normLabel(lbl);
        if (nlbl === 'total') break;
        var pid = phaseNameToId[nlbl];
        if (!pid) continue;
        var rate = num(inp, 'B' + br, 0), start = numOrNull(inp, 'C' + br), end = numOrNull(inp, 'D' + br);
        var grossArea = num(inp, 'H' + br, 0), netAmt = num(inp, 'I' + br, 0);
        if (rate > 0 || netAmt > 0) constructionLines.push({ phaseId: pid, rate: rate, start: start, end: end, grossArea: grossArea, netAmt: netAmt });
      }
    }
    constructionLines.forEach(function (cl) {
      var ph = p.phases.filter(function (x) { return x.id === cl.phaseId; })[0];
      if (ph) {
        ph.buildRatePsf = cl.rate;
        // gross area (net + circulation) from the workbook — the engine multiplies
        // build rate by this to reproduce the sheet's construction cost exactly.
        // If the sheet didn't populate gross, derive it from the net amount / rate.
        if (cl.grossArea > 0) ph.grossAreaSqft = cl.grossArea;
        else if (cl.rate > 0 && cl.netAmt > 0) ph.grossAreaSqft = cl.netAmt / cl.rate;
      }
    });
    var existingC6 = L.filter(function (l) { return l.cat === 6; });
    constructionLines.forEach(function (cl) {
      var rg = monthRange(H, cl.start, cl.end);
      var existing = existingC6.filter(function (l) { return l.phaseId === cl.phaseId; })[0];
      if (existing) {
        existing.start = rg.start; existing.end = rg.end;
      } else {
        // a phase (e.g. Commercial) the blank template didn't already have a construction line for
        L.push({ id: 'c6_' + cl.phaseId, cat: 6, item: cl.phaseId.charAt(0).toUpperCase() + cl.phaseId.slice(1) + ' Construction', basis: 'construction', phaseId: cl.phaseId, vatType: 'newbuild', start: rg.start, end: rg.end, included: true });
      }
    });

    // 7 — Contractors' Professional Fees
    var r106 = itemRow(anc.contractorsFees, 'Architects Building Regulations Stage'), r107 = itemRow(anc.contractorsFees, 'Landscape Architect'),
        r108 = itemRow(anc.contractorsFees, 'Structural Engineers'), r109 = itemRow(anc.contractorsFees, 'M&E Engineers'), r110 = itemRow(anc.contractorsFees, 'Fire Consultants');
    // Workbook formula: =pct × $B$102 where B102 = residential construction only
    // (K84 = SUM(K78:K82), excluding Commercial) — hence baseScope 'resi'.
    if (r106) line('c7a', { pct: num(inp, 'C' + r106, 0.03), baseScope: 'resi' }, ['D' + r106, 'E' + r106]);
    if (r107) line('c7b', { pct: num(inp, 'C' + r107, 0.005), baseScope: 'resi' }, ['D' + r107, 'E' + r107]);
    if (r108) line('c7c', { pct: num(inp, 'C' + r108, 0.015), baseScope: 'resi' }, ['D' + r108, 'E' + r108]);
    if (r109) line('c7d', { pct: num(inp, 'C' + r109, 0.015), baseScope: 'resi' }, ['D' + r109, 'E' + r109]);
    if (r110) line('c7e', { pct: num(inp, 'C' + r110, 0.005), baseScope: 'resi' }, ['D' + r110, 'E' + r110]);

    // 8 — Developers' Consultants / Warranties
    var r114 = itemRow(anc.devConsultants, 'Developers QS'), r115 = itemRow(anc.devConsultants, 'Building Warranties and Insurance'),
        r116 = itemRow(anc.devConsultants, 'Dev Solicitors Fees (DMA)'), r117 = itemRow(anc.devConsultants, 'Dev Solicitors Fees (Construction)'),
        r118 = itemRow(anc.devConsultants, 'Developers CDM Coordinator'), r119 = itemRow(anc.devConsultants, 'Building Regulations Fees');
    if (r114) line('c8a', { amount: num(inp, 'B' + r114, 0) }, ['C' + r114, 'D' + r114]);
    if (r115) line('c8b', { amount: num(inp, 'B' + r115, 0) }, ['C' + r115, 'D' + r115]);
    if (r116) line('c8c', { amount: num(inp, 'B' + r116, 0) }, ['C' + r116, 'D' + r116]);
    if (r117) line('c8d', { amount: num(inp, 'B' + r117, 0) }, ['C' + r117, 'D' + r117]);
    if (r118) line('c8e', { amount: num(inp, 'B' + r118, 0) }, ['C' + r118, 'D' + r118]);
    if (r119) line('c8f', { amount: num(inp, 'B' + r119, 0) }, ['C' + r119, 'D' + r119]);

    // 9 — Development Management
    var r123 = itemRow(anc.devManagement, 'Development Management'), r124 = itemRow(anc.devManagement, 'SPV Related Costs');
    if (r123) {
      // Workbook: C123 = B123(pct) × K84 (residential construction base)
      line('c9a', { pct: num(inp, 'B' + r123, 0), baseScope: 'resi' }, ['D' + r123, 'E' + r123]);
    }
    if (r124) line('c9b', { amount: num(inp, 'B' + r124, 0) }, ['D' + r124, 'E' + r124]);

    // 10 — Contingencies
    var r128 = itemRow(anc.contingencies, 'Private'), r129 = itemRow(anc.contingencies, 'Council Tax'), r130 = itemRow(anc.contingencies, 'Other');
    // Workbook: B128 = F128(pct) × K84 (residential construction base)
    if (r128) line('c10a', { pct: num(inp, 'F' + r128, 0.05), baseScope: 'resi' }, ['C' + r128, 'D' + r128]);
    if (r129) line('c10b', { amount: num(inp, 'B' + r129, 0) }, ['C' + r129, 'D' + r129]);
    if (r130) line('c10c', { amount: num(inp, 'B' + r130, 0) }, ['C' + r130, 'D' + r130]);

    // 11 — Product Spec & Marketing
    var r134 = itemRow(anc.productSpec, 'Brochure & Marketing Materials'), r135 = itemRow(anc.productSpec, 'Show flat - Kit Out'), r136 = itemRow(anc.productSpec, 'Interior design');
    if (r134) line('c11a', { amount: num(inp, 'B' + r134, 0) }, ['D' + r134, 'E' + r134]);
    if (r135) line('c11b', { amount: num(inp, 'B' + r135, 0) }, ['D' + r135, 'E' + r135]);
    if (r136) line('c11c', { amount: num(inp, 'B' + r136, 0) }, ['D' + r136, 'E' + r136]);

    // 12 — Cost of Sales
    var r140 = itemRow(anc.costOfSales, 'Phase 1'), r146 = itemRow(anc.costOfSales, 'Dev solicitiors fees (Sale - private and pkg)');
    if (r140) line('c12a', { pct: num(inp, 'F' + r140, 0.01) }, ['C' + r140, 'D' + r140]);
    if (r146) line('c12b', { rate: num(inp, 'F' + r146, 1500) }, ['C' + r146, 'D' + r146]);

    // 13 — After Sales
    var r153 = itemRow(anc.afterSales, 'After sales management');
    if (r153) line('c13a', { amount: num(inp, 'B' + r153, 0) }, ['C' + r153, 'D' + r153]);

    // 14 — Finance
    var r158 = itemRow(anc.finance, 'Bank Charges (Entry)'), r159 = itemRow(anc.finance, 'Bank Charges (Exit)'), r160 = itemRow(anc.finance, 'Bank QS'),
        r161 = itemRow(anc.finance, 'Bank Solicitor Fees (Purchase)'), r162 = itemRow(anc.finance, 'Bank Solicitor Fees (Construction)'), r165 = itemRow(anc.finance, 'Funding Brokers Fees');
    if (r158) line('c14a', { pct: numOrNull(inp, 'B' + r158) != null ? num(inp, 'B' + r158) : 0.01 }, ['D' + r158, 'E' + r158]);
    if (r159) line('c14b', { pct: numOrNull(inp, 'B' + r159) != null ? num(inp, 'B' + r159) : 0.01 }, ['D' + r159, 'E' + r159]);
    if (r160) line('c14c', { amount: num(inp, 'C' + r160, 0) }, ['D' + r160, 'E' + r160]);
    if (r161) line('c14d', { amount: num(inp, 'C' + r161, 0) }, ['D' + r161, 'E' + r161]);
    if (r162) line('c14e', { amount: num(inp, 'C' + r162, 0) }, ['D' + r162, 'E' + r162]);
    if (r165) line('c14f', { pct: numOrNull(inp, 'B' + r165) != null ? num(inp, 'B' + r165) : 0.01 }, ['D' + r165, 'E' + r165]);

    // ----- authoritative line timings from the Cashflow sheet ------------------
    // The workbook's interest is driven by the Cashflow sheet, whose per-line
    // start/end months (cols E/F) are the source of truth and differ from the
    // Input sheet's columns for several lines (e.g. contingency spreads 1→18,
    // Developers QS 5→19, cost of sales 18→24). Override our lines to match.
    var cfSheet = wb.Sheets['Cashflow'];
    if (cfSheet) {
      var cfTimes = {}; // normLabel -> {s,e}
      for (var cr = 4; cr <= 115; cr++) {
        var clbl = cell(cfSheet, 'A' + cr);
        if (clbl == null || clbl === '') continue;
        var ne = normLabel(clbl);
        if (ne.length < 6) continue; // skip ambiguous short labels like 'Other'
        var cs = cell(cfSheet, 'E' + cr), ce = cell(cfSheet, 'F' + cr);
        var ctot = cell(cfSheet, 'C' + cr);
        if (typeof cs === 'number' && typeof ce === 'number' && cs >= 1 && ce >= cs && !(ne in cfTimes)) {
          cfTimes[ne] = { s: cs, e: ce, total: (typeof ctot === 'number' ? ctot : 0) };
        }
      }
      var cfKeys = Object.keys(cfTimes);
      function cfLookup(label) {
        var t = normLabel(label);
        if (cfTimes[t]) return cfTimes[t];
        if (t.length < 6) return null;
        for (var i = 0; i < cfKeys.length; i++) {
          var k = cfKeys[i];
          if (k.indexOf(t) === 0 || t.indexOf(k) === 0) return cfTimes[k];
        }
        return null;
      }
      // engine line id -> the label it appears under on the Cashflow sheet
      var cfLabelById = {
        c1a: 'Non Refundable Deposit', c1b: 'Exchange Deposit', c1c: 'Legal Completion', c1d: 'Defered Final Payment',
        c2a: 'Stamp Duty', c2b: 'Bank Valuation', c2c: 'Dev Solicitors Fees (Purchase)', c2d: 'Introduction Fees + Planning Gain',
        c3a: 'CIL (Borough & Mayoral)', c3b: 'Carbon offsetting & monitoring', c3c: 'Section 106 & 278',
        c4a: 'Site Investigation', c4b: 'Party Wall', c4c: 'Rights of Light consultant', c4d: 'SAP Ratings', c4e: 'Building Regs',
        c5a: 'Demolition', c5b: 'Services',
        c6a: 'Construction Phase One', c6b: 'Construction Phase Two', c6_commercial: 'Construction Commercial',
        c7a: 'Architects Building Regulations Stage', c7b: 'Landscape Architect', c7c: 'Structural Engineers', c7d: 'M&E Engineers', c7e: 'Fire Consultants',
        c8a: 'Developers QS', c8b: 'Building Warranties and Insurance', c8c: 'Dev Solicitors Fees (DMA)', c8d: 'Dev Solicitors Fees (Construction)', c8e: 'Developers CDM Coordinator', c8f: 'Building Regulations Fees',
        c9a: 'Development Management', c9b: 'SPV Related Costs',
        c10a: 'Construction & Consultants', c10b: 'Council Tax',
        c11a: 'Brochure & Marketing Materials', c11b: 'Show flat - Kit Out', c11c: 'Interior design',
        c12a: 'COST of SALES ALL Blocks A B C', c12b: 'COST of SALESDev solicitiors fees (Sale - private and pkg)',
        c13a: 'After sales management',
        c14a: 'Bank Charges (Entry)', c14b: 'Bank Charges (Exit)', c14c: 'Bank QS', c14d: 'Bank Solicitor Fees (Purchase)', c14e: 'Bank Solicitor Fees (Construction)', c14f: 'Funding Brokers Fees'
      };
      L.forEach(function (l) {
        var lbl = cfLabelById[l.id];
        if (!lbl) return;
        var t = cfLookup(lbl);
        if (!t) return;
        var rg = monthRange(H, t.s, t.e);
        l.start = rg.start; l.end = rg.end;
      });
      // Consistency check: every construction line in the cost totals should be
      // funded through the workbook's cashflow. If one is missing (e.g. a
      // Commercial row inserted on Input but never added to the Cashflow sheet),
      // the workbook's bank interest — and therefore its profit — is overstated.
      L.forEach(function (l) {
        if (l.cat !== 6 || !l.included) return;
        var lbl = cfLabelById[l.id];
        var t2 = lbl ? cfLookup(lbl) : null;
        var ph2 = p.phases.filter(function (x) { return x.id === l.phaseId; })[0];
        var amt2 = ph2 ? Math.round((ph2.buildRatePsf || 0) * (ph2.grossAreaSqft || ph2.netAreaSqft || 0)) : 0;
        var funded = t2 && Math.abs((t2.total || 0) - amt2) < Math.max(1, amt2 * 0.01);
        if (amt2 > 0 && !funded) warnings.push('Workbook inconsistency: the "' + l.item + '" cost (£' + amt2.toLocaleString() + ') is in the workbook\'s cost totals but its Cashflow sheet funds £' + Math.round((t2 && t2.total) || 0).toLocaleString() + ' of it — the workbook\'s bank interest is understated and its profit overstated as a result. This tool funds the full amount, which is why the profit here is slightly lower than the spreadsheet\'s.');
      });
    }

    p.meta = p.meta || {};
    p.meta.importedFrom = 'xlsx';
    p.meta.status = 'Draft';

    return { project: p, warnings: warnings };
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read the file.')); };
      reader.onload = function (e) {
        try {
          var data = new Uint8Array(e.target.result);
          var wb = global.XLSX.read(data, { type: 'array', cellDates: true });
          resolve(wb);
        } catch (err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  async function importFromFile(file, schemeName) {
    if (!global.XLSX) throw new Error('Excel reader failed to load — check your connection and try again.');
    var wb = await readFile(file);
    return parseWorkbook(wb, schemeName);
  }

  global.AppraisalImport = { importFromFile: importFromFile, parseWorkbook: parseWorkbook };
})(typeof window !== 'undefined' ? window : this);
