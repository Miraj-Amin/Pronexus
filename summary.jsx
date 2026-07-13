/* Summary screen — a faithful on-screen replica of the workbook's "Summary"
   sheet. Two columns, exactly like the spreadsheet:
     LEFT  — the appraisal summary: site details, headline figures, cost split
             (% of GDV), project metrics, scheme & units by phase, construction
             rates £/sqft, income by phase, cost table (value / % of cost),
             profit summary, funding, and the equity waterfall.
     RIGHT — the full detailed cost build-up: every individual cost line grouped
             by category with sub-totals, mirroring the H/I columns of the sheet.
   All figures come from the same live model/state the rest of the app uses. */
const sumFmt = window.Appraisal;
const sMoney = v => sumFmt.money(v || 0);
const sMoney0 = v => (v ? sumFmt.money(v) : '£0');
const sPct = (v, dp) => sumFmt.pct(v || 0, dp == null ? 1 : dp);

/* ---- small building blocks --------------------------------------------- */
function SBlockTitle({ children }) {
  return <div className="sb-title">{children}</div>;
}

function SKV({ label, value, strong, indent }) {
  return (
    <div className={'sb-kv' + (strong ? ' strong' : '')}>
      <div className="k" style={indent ? { paddingLeft: 12 } : null}>{label}</div>
      <div className="v">{value}</div>
    </div>
  );
}

/* A 3-column value / percentage row (label | amount | %) */
function SRow3({ label, amount, pct, strong, sub }) {
  return (
    <div className={'sb-row3' + (strong ? ' strong' : '') + (sub ? ' sub' : '')}>
      <div className="c1">{label}</div>
      <div className="c2 num">{amount}</div>
      <div className="c3 num">{pct}</div>
    </div>
  );
}

/* ---- LEFT COLUMN blocks -------------------------------------------------- */
function SiteDetailsBlock({ project, netArea, grossArea }) {
  const pr = project || {};
  return (
    <div className="sb">
      <SBlockTitle>Site Details</SBlockTitle>
      <SKV label="Address" value={pr.address || '—'} />
      <SKV label="Borough" value={pr.borough || '—'} />
      <SKV label="Planning Reference" value={pr.planningRef || '—'} />
      <SKV label="Client Reference" value={pr.clientRef || '—'} />
      <SKV label="Main Contact" value={pr.mainContact || '—'} />
      <SKV label="Net Area" value={netArea ? Math.round(netArea).toLocaleString() + ' sq.ft' : '—'} />
      <SKV label="Gross Area" value={grossArea ? Math.round(grossArea).toLocaleString() + ' sq.ft' : '—'} />
    </div>
  );
}

function HeadlineBlock({ model }) {
  const r = model.ratios || {};
  const byCat = model.byCat || {};
  const catTotal = id => (byCat[id] && byCat[id].total) || 0;
  const construction = catTotal(6) + catTotal(7); // construction + contractor fees, as the sheet groups it
  const otherCosts = (r.totalCost || 0) - catTotal(1) - construction;
  return (
    <div className="sb">
      <SBlockTitle>Appraisal Headline</SBlockTitle>
      <SKV label="GDV" value={sMoney(r.gdv)} strong />
      <SKV label="Land Value" value={sMoney(catTotal(1))} />
      <SKV label="Construction" value={sMoney(construction)} />
      <SKV label="Other Costs" value={sMoney(otherCosts)} />
      <SKV label="Total Costs" value={sMoney(r.totalCost)} strong />
      <SKV label="Profit" value={sMoney(r.profit)} strong />
      <SKV label="Equity Required" value={sMoney(r.equity)} />
      <SKV label="Return on Equity (RoE)" value={(r.roe || 0).toFixed(2) + '×'} />
    </div>
  );
}

function CostSplitBlock({ model }) {
  const byCat = model.byCat || {};
  const catTotal = id => (byCat[id] && byCat[id].total) || 0;
  const gdv = (model.ratios && model.ratios.gdv) || 1;
  const land = catTotal(1);
  const construction = catTotal(6) + catTotal(7);
  const finance = catTotal(14);
  const devRelated = [2, 3, 4, 5, 8, 9, 10, 11, 12, 13].reduce((s, id) => s + catTotal(id), 0);
  const profit = (model.ratios && model.ratios.profit) || 0;
  const rows = [
    ['Land price', land],
    ['Construction', construction],
    ['Finance Related Costs', finance],
    ['Development Related Costs', devRelated],
    ['Profit', profit]
  ];
  return (
    <div className="sb">
      <SBlockTitle>Cost Split (% of GDV)</SBlockTitle>
      <div className="sb-row3 head"><div className="c1">Element</div><div className="c2">% of GDV</div><div className="c3">Value</div></div>
      {rows.map(([label, v]) => (
        <SRow3 key={label} label={label} amount={sPct(v / gdv)} pct={sMoney(v)} />
      ))}
      <SRow3 label="GDV" amount="100%" pct={sMoney(gdv)} strong />
    </div>
  );
}

function ProjectMetricsBlock({ project, netArea, grossArea, totalUnits, avgResiPsf }) {
  return (
    <div className="sb">
      <SBlockTitle>Project Metrics</SBlockTitle>
      <SKV label="Project Duration (Months)" value={String(project.projectLengthMonths || 0)} />
      <SKV label="Construction Period (Months)" value={String(project.constructionPeriodMonths || 0)} />
      <SKV label="Net Area (sq.ft)" value={Math.round(netArea).toLocaleString()} />
      <SKV label="Gross Area (sq.ft)" value={Math.round(grossArea).toLocaleString()} />
      <SKV label="Total Units" value={String(totalUnits)} />
      <SKV label="Average Sales £/sqft (Residential)" value={avgResiPsf ? '£' + Math.round(avgResiPsf) : '—'} />
    </div>
  );
}

function SchemeUnitsBlock({ state }) {
  const phases = state.phases || [];
  const totalUnits = phases.reduce((s, p) => s + (p.units || 0), 0) || 1;
  return (
    <div className="sb">
      <SBlockTitle>Scheme Details</SBlockTitle>
      <div className="sb-row3 head"><div className="c1">Phase</div><div className="c2">No. of units</div><div className="c3">Percentage</div></div>
      {phases.map(p => (
        <SRow3 key={p.id} label={p.name || p.id} amount={String(p.units || 0)} pct={sPct((p.units || 0) / totalUnits)} />
      ))}
      <SRow3 label="TOTAL" amount={String(totalUnits)} pct="100%" strong />
    </div>
  );
}

function ConstructionRatesBlock({ state, model }) {
  /* Rates are cost ÷ GROSS buildable area (net + circulation), matching the
     workbook's basis (275 construction-only / 297 D&B are per gross sqft —
     Input D92 = cost / H78). The old version divided by NET area and applied
     the contractors'-fee uplift to Commercial too, even though those fees are
     charged on the residential build only. */
  const phases = state.phases || [];
  const a = state.assumptions || {};
  const byCat = model.byCat || {};
  const contractorFees = (byCat[7] && byCat[7].total) || 0;
  const isResi = id => ['p1', 'p2', 'p3', 'p4', 'freehold'].indexOf(id) !== -1;
  const grossOf = p => (p.grossAreaSqft && p.grossAreaSqft > 0)
    ? p.grossAreaSqft
    : (p.netAreaSqft || 0) * ((p.phaseType === 'Flat' || p.phaseType === 'Mixed') ? (1 + (a.gross_area_allowance || 0)) : 1);
  const grp = pred => {
    let area = 0, cost = 0;
    phases.forEach(p => {
      if (!pred(p.id) || !(p.buildRatePsf > 0)) return;
      const g = grossOf(p); area += g; cost += (p.buildRatePsf || 0) * g;
    });
    return { area, cost, rate: area ? cost / area : 0 };
  };
  const resi = grp(isResi), comm = grp(id => id === 'commercial'), all = grp(() => true);
  // D&B = construction + contractors' professional fees; the fees apply to the
  // residential build only, so Commercial's D&B rate equals its build rate.
  const rows = [
    ['Residential', resi.rate, resi.area ? (resi.cost + contractorFees) / resi.area : 0],
    ['Commercial', comm.rate, comm.rate],
    ['Total', all.rate, all.area ? (all.cost + contractorFees) / all.area : 0]
  ];
  return (
    <div className="sb">
      <SBlockTitle>Construction Rates (£/sqft, gross area)</SBlockTitle>
      <div className="sb-row3 head"><div className="c1">Element</div><div className="c2">Construction Only</div><div className="c3">Design &amp; Build</div></div>
      {rows.map(([label, rate, db]) => (
        <SRow3 key={label} label={label} amount={rate ? '£' + Math.round(rate) : '—'} pct={db ? '£' + Math.round(db) : '—'} strong={label === 'Total'} />
      ))}
    </div>
  );
}

function IncomeBlock({ state, model }) {
  const phases = state.phases || [];
  const totalGdv = (model.ratios && model.ratios.gdv) || 1;
  return (
    <div className="sb">
      <SBlockTitle>Income</SBlockTitle>
      <div className="sb-row3 head"><div className="c1">Phase</div><div className="c2">Value</div><div className="c3">%</div></div>
      {phases.map(p => (
        <SRow3 key={p.id} label={p.name || p.id} amount={sMoney(sumFmt.phaseGdv(p))} pct={sPct(sumFmt.phaseGdv(p) / totalGdv)} />
      ))}
      <SRow3 label="TOTAL" amount={sMoney(totalGdv)} pct="100%" strong />
    </div>
  );
}

function CostsValueBlock({ model }) {
  const cats = model.categories || [];
  const byCat = model.byCat || {};
  const total = (model.ratios && model.ratios.totalCost) || 1;
  // Sheet lists these 14 cost headings with value + % of cost.
  const order = [
    [1, 'LAND VALUE'], [2, 'ACQUISITION RELATED COSTS'], [3, 'LOCAL AUTHORITY COSTS'],
    [4, 'DEVELOPERS PROFESSIONAL COSTS'], [5, 'DEMOLITION & UTILITIES'], [6, 'NET CONSTRUCTION'],
    [7, 'CONTRACTORS PROFESSIONAL FEES'], [8, 'DEVELOPERS CONSULTANTS/WARRANTIES'],
    [9, 'DEVELOPMENT MANAGEMENT COSTS'], [10, 'CONTINGENCIES'], [11, 'PRODUCT SPEC. & MARKETING'],
    [12, 'COST of SALES'], [13, 'AFTER SALES'], [14, 'FINANCE']
  ];
  return (
    <div className="sb">
      <SBlockTitle>Costs</SBlockTitle>
      <div className="sb-row3 head"><div className="c1">Cost</div><div className="c2">Value</div><div className="c3">% of Cost</div></div>
      {order.map(([id, label]) => {
        const v = (byCat[id] && byCat[id].total) || 0;
        return <SRow3 key={id} label={label} amount={sMoney(v)} pct={sPct(v / total)} />;
      })}
      <SRow3 label="TOTAL" amount={sMoney(total)} pct="100%" strong />
    </div>
  );
}

function ProfitSummaryBlock({ state, model }) {
  const r = model.ratios || {};
  const maxLtGdv = (state && state.assumptions && state.assumptions.loan_to_gdv) || 0.65;
  return (
    <div className="sb">
      <SBlockTitle>Profit &amp; Funding</SBlockTitle>
      <SKV label="Project Profit" value={sMoney(r.profit)} strong />
      <SKV label="Profit as % GDV" value={sPct(r.profitPctGdv)} />
      <SKV label="Profit as % Cost" value={sPct(r.profitPctCost)} />
      <SKV label="Profit Excluding Finance" value={sPct(r.profitExFinance)} />
      <div className="sb-divider"></div>
      <SKV label="Equity Retained" value={sMoney(r.equity)} />
      <SKV label="Peak Funding (Senior Debt)" value={sMoney(r.peakFunding)} strong />
      <SKV label="Peak Funding as % GDV" value={sPct(r.peakLoanToGdv)} />
      <SKV label="Max Loan To GDV" value={sPct(maxLtGdv)} />
      <SKV label="Peak Loan To Cost" value={sPct(r.peakLoanToCost)} />
    </div>
  );
}

function EquityWaterfallBlock({ model }) {
  const w = model.waterfall || {};
  const totalCost = w.totalCost || (model.ratios && model.ratios.totalCost) || 1;
  const pctOf = v => sPct((v || 0) / totalCost);
  const bad = Math.abs(w.balanceToFund || 0) > 1000;
  return (
    <div className="sb">
      <SBlockTitle>Equity / Funding Waterfall</SBlockTitle>
      <div className="sb-row3 head"><div className="c1">Element</div><div className="c2">Price</div><div className="c3">% of Cost</div></div>
      <SRow3 label="TOTAL COST" amount={sMoney(totalCost)} pct="100%" strong />
      <SRow3 label="Less Peak Funding" amount={sMoney(w.peakFunding)} pct={pctOf(w.peakFunding)} />
      <SRow3 label="Less Cost of Sales" amount={sMoney(w.costOfSales)} pct={pctOf(w.costOfSales)} />
      <SRow3 label="Less Bank Exit Fee" amount={sMoney(w.exitFee)} pct={pctOf(w.exitFee)} />
      <SRow3 label="Less After Sales" amount={sMoney(w.afterSales)} pct={pctOf(w.afterSales)} />
      <SRow3 label="Equity" amount={sMoney(w.equity)} pct={pctOf(w.equity)} />
      <div className={'sb-row3 strong' + (bad ? ' warn' : ' good')}>
        <div className="c1">Balance from Sales Income</div>
        <div className="c2 num">{sMoney(w.balanceToFund)}</div>
        <div className="c3 num">{pctOf(w.balanceToFund)}</div>
      </div>
    </div>
  );
}

/* ---- RIGHT COLUMN: detailed cost build-up ------------------------------- */
function CostBuildupGroup({ title, lines, unit }) {
  const inc = (lines || []).filter(l => l.included !== false);
  const total = inc.reduce((s, l) => s + (l.amount || 0), 0);
  return (
    <div className="sb cbu">
      <div className="sb-row3 head"><div className="c1">{title}</div><div className="c2">{unit || 'Amount'}</div><div className="c3"></div></div>
      {(lines || []).map(l => (
        <div className={'sb-row2' + (l.included === false ? ' excl' : '')} key={l.id}>
          <div className="c1">{l.item}</div>
          <div className="c2 num">{l.amount ? sumFmt.money(l.amount) : '£0'}</div>
        </div>
      ))}
      <div className="sb-row2 subtotal"><div className="c1">SUB TOTAL</div><div className="c2 num">{sumFmt.money(total)}</div></div>
    </div>
  );
}

function CostBuildup({ model }) {
  const byCat = model.byCat || {};
  const g = id => (byCat[id] && byCat[id].lines) || [];
  return (
    <div className="cbu-col">
      <SBlockTitle>Detailed Cost Build-Up</SBlockTitle>
      <CostBuildupGroup title="ACQUISITION RELATED COSTS" lines={g(2)} />
      <CostBuildupGroup title="LOCAL AUTHORITY COSTS" lines={g(3)} />
      <CostBuildupGroup title="DEVELOPERS PROFESSIONAL COSTS" lines={g(4)} />
      <CostBuildupGroup title="DEMOLITION & UTILITIES" lines={g(5)} />
      <CostBuildupGroup title="BUILD ASSUMPTIONS" lines={g(6)} unit="Gross Amount" />
      <CostBuildupGroup title="CONTRACTORS PROFESSIONAL FEES" lines={g(7)} />
      <CostBuildupGroup title="DEVELOPERS CONSULTANTS/WARRANTIES" lines={g(8)} />
      <CostBuildupGroup title="DEVELOPMENT MANAGEMENT COSTS" lines={g(9)} />
      <CostBuildupGroup title="CONTINGENCIES" lines={g(10)} unit="Cost" />
      <CostBuildupGroup title="PRODUCT SPEC. & MARKETING" lines={g(11)} />
      <CostBuildupGroup title="COST of SALES" lines={g(12)} />
      <CostBuildupGroup title="AFTER SALES" lines={g(13)} unit="Cost" />
      <CostBuildupGroup title="FINANCE" lines={g(14)} />
    </div>
  );
}

/* ---- top-level screen --------------------------------------------------- */
function SummaryScreen({ state, model }) {
  if (!state || !model) return null;
  const project = state.project || {};
  const phases = state.phases || [];
  const assumptions = state.assumptions || {};
  const netArea = phases.reduce((s, p) => s + (p.netAreaSqft || 0), 0);
  const grossArea = netArea * (1 + (assumptions.gross_area_allowance || 0));
  const totalUnits = phases.reduce((s, p) => s + (p.units || 0), 0);
  const isResi = id => ['p1', 'p2', 'p3', 'p4', 'freehold'].indexOf(id) !== -1;
  const resiArea = phases.filter(p => isResi(p.id)).reduce((s, p) => s + (p.netAreaSqft || 0), 0);
  const resiGdv = phases.filter(p => isResi(p.id)).reduce((s, p) => s + sumFmt.phaseGdv(p), 0);
  const avgResiPsf = resiArea ? resiGdv / resiArea : 0;

  return (
    <div className="main summary-screen" data-screen-label="Summary">
      <div className="summary-doc-head">
        <h2>Financial Appraisal Summary</h2>
        <div className="sub">{project.name || 'Untitled scheme'}{project.address ? ' · ' + project.address : ''}</div>
      </div>

      <div className="summary-cols">
        {/* LEFT — appraisal summary */}
        <div className="summary-left">
          <SiteDetailsBlock project={project} netArea={netArea} grossArea={grossArea} />
          <HeadlineBlock model={model} />
          <CostSplitBlock model={model} />
          <ProjectMetricsBlock project={project} netArea={netArea} grossArea={grossArea} totalUnits={totalUnits} avgResiPsf={avgResiPsf} />
          <SchemeUnitsBlock state={state} />
          <ConstructionRatesBlock state={state} model={model} />
          <IncomeBlock state={state} model={model} />
          <CostsValueBlock model={model} />
          <ProfitSummaryBlock state={state} model={model} />
          <EquityWaterfallBlock model={model} />
        </div>

        {/* RIGHT — detailed cost build-up */}
        <div className="summary-right">
          <CostBuildup model={model} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SummaryScreen });
