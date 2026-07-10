/* ============================================================================
   Excel Import — reads a North Gate–template appraisal workbook (.xlsx) and
   builds a full project object ready to save via DB.upsert.

   Approach: clone the locked master template (window.Appraisal.newProjectFromTemplate)
   so every cost-line id / basis / category is guaranteed identical to every
   other scheme in the system — then overwrite amounts, %, start/end months,
   phases, units and site details with values read from fixed cell addresses
   on the Input / Summary / Schedule of Units sheets. This mirrors exactly how
   North Gate Appraisal V2 (and every scheme built from the same template) is
   laid out, so the mapping is precise rather than a fuzzy text-guess.
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

  // Find & set a cost line by id, applying only the fields the caller passes.
  function setLine(lines, id, patch) {
    var l = lines.filter(function (x) { return x.id === id; })[0];
    if (!l) return;
    Object.keys(patch).forEach(function (k) {
      if (patch[k] !== undefined && patch[k] !== null) l[k] = patch[k];
    });
  }

  function monthRange(H, s, e) {
    if (s == null || e == null) return { start: s, end: e };
    var lo = clamp(Math.round(s), 1, H || 18);
    var hi = clamp(Math.round(e), 1, H || 18);
    return { start: lo, end: hi };
  }

  function fmtDate(v) {
    if (v instanceof Date && !isNaN(v)) {
      return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0');
    }
    return null;
  }

  // ----- main parse ----------------------------------------------------------
  function parseWorkbook(wb, schemeName) {
    var warnings = [];
    var inp = wb.Sheets['Input'];
    var sum = wb.Sheets['Summary'];
    var sch = wb.Sheets['Schedule of Units'];
    if (!inp) throw new Error("This workbook has no 'Input' sheet — it doesn't look like a North Gate–template appraisal.");
    if (!sum) warnings.push("No 'Summary' sheet found — site details (address, planning ref, client) were skipped.");
    if (!sch) warnings.push("No 'Schedule of Units' sheet found — unit-by-unit schedule was skipped.");

    var name = schemeName || (sch ? str(sch, 'A1', '') : '') || 'Imported Scheme';
    // Schedule of Units A1 is often "Name, Location" — split on first comma for the scheme name only
    if (sch) {
      var title = str(sch, 'A1', '');
      if (title) name = schemeName || title.split(',')[0].trim() || title;
    }

    var p = global.Appraisal.newProjectFromTemplate(name);
    var H = num(inp, 'C2', 18);
    p.project.projectLengthMonths = H;
    p.project.constructionPeriodMonths = num(inp, 'E78', num(inp, 'C3', 15));
    var startDate = fmtDate(cell(inp, 'B8'));
    if (startDate) p.project.startDate = startDate;
    p.project.offerPrice = num(inp, 'B48', 0);
    p.project.askingPrice = p.project.offerPrice;

    if (sum) {
      p.project.address = str(sum, 'C4', p.project.address);
      p.project.borough = str(sum, 'C5', p.project.borough);
      p.project.planningRef = str(sum, 'C6', p.project.planningRef);
      p.project.clientRef = str(sum, 'C7', p.project.clientRef);
      p.project.mainContact = str(sum, 'C8', p.project.mainContact);
    }

    // ----- assumptions --------------------------------------------------------
    var a = p.assumptions;
    a.vat_newbuild = num(inp, 'B87', a.vat_newbuild);
    a.vat_conversion = num(inp, 'B88', a.vat_conversion);
    a.vat_refurb = num(inp, 'B89', a.vat_refurb);
    a.gross_area_allowance = num(inp, 'B92', a.gross_area_allowance);
    a.base_rate = num(inp, 'B172', a.base_rate);
    a.margin = num(inp, 'B173', a.margin);
    a.equity = num(inp, 'B177', a.equity);
    a.loan_to_gdv = num(inp, 'B186', a.loan_to_gdv);

    // ----- phases (7 canonical rows: p1..p4, commercial, parking, freehold) ---
    var phaseRows = [12, 13, 14, 15, 16, 17, 18];   // units count (Input col B)
    var incomeRows = [23, 24, 25, 26, 27, 28, 29];  // GDV / area / rate
    var salesRows = [33, 34, 35, 36, 37, 38, 39];   // sales start/end
    var buildRows = { p1: 78, p2: 79, p3: 80, p4: 81, freehold: 82 }; // build rate £psf
    p.phases.forEach(function (ph, i) {
      ph.units = num(inp, 'B' + phaseRows[i], 0);
      var areaAddr = 'C' + incomeRows[i], rateAddr = 'D' + incomeRows[i];
      ph.netAreaSqft = num(inp, areaAddr, 0);
      ph.salePsf = num(inp, rateAddr, 0);
      var ss = numOrNull(inp, 'B' + salesRows[i]);
      var se = numOrNull(inp, 'C' + salesRows[i]);
      ph.salesStart = ss || 0;
      ph.salesEnd = se || 0;
      if (buildRows[ph.id]) ph.buildRatePsf = num(inp, 'B' + buildRows[ph.id], ph.buildRatePsf);
      if (ph.netAreaSqft > 0 || ph.units > 0) ph.phaseType = ph.phaseType || 'House';
    });

    // ----- units (Schedule of Units) -------------------------------------------
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
        if (r > 500) break; // safety valve
      }
      if (units.length) p.units = units;
    }

    // ----- cost stack: overwrite the cloned template's lines in place ---------
    var L = p.costLines;
    function line(id, patch, rangeAddrs) {
      if (rangeAddrs) {
        var rg = monthRange(H, numOrNull(inp, rangeAddrs[0]), numOrNull(inp, rangeAddrs[1]));
        patch.start = rg.start; patch.end = rg.end;
      }
      setLine(L, id, patch);
    }

    // 1 — Land / Purchase Price
    line('c1a', { pct: num(inp, 'C44', 0) }, ['D44', 'E44']);
    line('c1b', { pct: num(inp, 'C45', 0.10) }, ['D45', 'E45']);
    line('c1c', { pct: num(inp, 'C46', 0.90) }, ['D46', 'E46']);
    line('c1d', { amount: num(inp, 'B47', 0) }, ['D47', 'E47']);

    // 2 — Acquisition-related  (c2a Stamp Duty stays computed via SDLT engine)
    line('c2b', { pct: num(inp, 'C52', 0.003) }, ['D52', 'E52']);
    line('c2c', { amount: num(inp, 'B53', 0) }, ['D53', 'E53']);
    line('c2d', { pct: num(inp, 'C54', 0.02) }, ['D54', 'E54']);

    // 3 — Local Authority
    line('c3a', { amount: num(inp, 'B58', 0) }, ['C58', 'D58']);
    line('c3b', { amount: num(inp, 'B59', 0) }, ['C59', 'D59']);
    line('c3c', { amount: num(inp, 'B60', 0) }, ['C60', 'D60']);

    // 4 — Developers' Professional
    line('c4a', { amount: num(inp, 'B64', 0) }, ['C64', 'D64']);
    line('c4b', { amount: num(inp, 'B65', 0) }, ['C65', 'D65']);
    line('c4c', { amount: num(inp, 'B66', 0) }, ['C66', 'D66']);
    line('c4d', { amount: num(inp, 'B67', 0) }, ['C67', 'D67']);
    line('c4e', { amount: num(inp, 'B68', 0) }, ['C68', 'D68']);

    // 5 — Demolition & Utilities
    line('c5a', { amount: num(inp, 'B72', 0) }, ['D72', 'E72']);
    line('c5b', { amount: num(inp, 'B73', 0) }, ['D73', 'E73']);
    line('c5c', { amount: num(inp, 'B74', 0) }, ['D74', 'E74']);

    // 6 — Net Construction (phase 1; rate/area come from the phases block above)
    var c6 = monthRange(H, numOrNull(inp, 'C78'), numOrNull(inp, 'D78'));
    setLine(L, 'c6a', { start: c6.start, end: c6.end });

    // 7 — Contractors' Professional Fees
    line('c7a', { pct: num(inp, 'C105', 0.03) }, ['D105', 'E105']);
    line('c7b', { pct: num(inp, 'C106', 0.005) }, ['D106', 'E106']);
    line('c7c', { pct: num(inp, 'C107', 0.015) }, ['D107', 'E107']);
    line('c7d', { pct: num(inp, 'C108', 0.015) }, ['D108', 'E108']);
    line('c7e', { pct: num(inp, 'C109', 0.005) }, ['D109', 'E109']);

    // 8 — Developers' Consultants / Warranties
    line('c8a', { amount: num(inp, 'B113', 0) }, ['C113', 'D113']);
    line('c8b', { amount: num(inp, 'B114', 0) }, ['C114', 'D114']);
    line('c8c', { amount: num(inp, 'B115', 0) }, ['C115', 'D115']);
    line('c8d', { amount: num(inp, 'B116', 0) }, ['C116', 'D116']);
    line('c8e', { amount: num(inp, 'B117', 0) }, ['C117', 'D117']);
    line('c8f', { amount: num(inp, 'B118', 0) }, ['C118', 'D118']);

    // 9 — Development Management
    var constructionBaseVal = global.Appraisal.constructionBase(p);
    var dmTotal = num(inp, 'C122', 0);
    line('c9a', { pct: constructionBaseVal > 0 ? (dmTotal / constructionBaseVal) : 0 }, ['D122', 'E122']);
    line('c9b', { amount: num(inp, 'B123', 0) }, ['D123', 'E123']);

    // 10 — Contingencies
    line('c10a', { pct: num(inp, 'F127', 0.05) }, ['C127', 'D127']);
    line('c10b', { amount: num(inp, 'B128', 0) }, ['C128', 'D128']);
    line('c10c', { amount: num(inp, 'B129', 0) }, ['C129', 'D129']);

    // 11 — Product Spec & Marketing
    line('c11a', { amount: num(inp, 'B133', 0) }, ['D133', 'E133']);
    line('c11b', { amount: num(inp, 'B134', 0) }, ['D134', 'E134']);
    line('c11c', { amount: num(inp, 'B135', 0) }, ['D135', 'E135']);

    // 12 — Cost of Sales
    line('c12a', { pct: num(inp, 'F139', 0.01) }, ['C139', 'D139']);
    line('c12b', { rate: num(inp, 'F145', 1500) }, ['C145', 'D145']);

    // 13 — After Sales
    line('c13a', { amount: num(inp, 'B152', 0) }, ['C152', 'D152']);

    // 14 — Finance
    line('c14a', { pct: numOrNull(inp, 'B157') != null ? num(inp, 'B157') : 0.01 }, ['D157', 'E157']);
    line('c14b', { pct: numOrNull(inp, 'B158') != null ? num(inp, 'B158') : 0.01 }, ['D158', 'E158']);
    line('c14c', { amount: num(inp, 'C159', 0) }, ['D159', 'E159']);
    line('c14d', { amount: num(inp, 'C160', 0) }, ['D160', 'E160']);
    line('c14e', { amount: num(inp, 'C161', 0) }, ['D161', 'E161']);
    line('c14f', { pct: numOrNull(inp, 'B164') != null ? num(inp, 'B164') : 0.01 }, ['D164', 'E164']);

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
