/* Summary screen — a read-only, on-screen "appraisal document" that mirrors
   EVERY block of the source spreadsheet's Summary sheet:
     • Site details
     • Headline appraisal (GDV / land / construction / costs / profit / equity / RoE)
     • Cost split as % of GDV
     • Project metrics (durations + net/gross areas)
     • Scheme by phase (units + % + GDV + £psf)
     • Construction rates (£/sqft, construction-only vs design & build)
     • Income by phase (value + % of income)
     • Cost category breakdown (£ + % of cost)
     • Profit summary (profit, % GDV, % cost, excl. finance)
     • Funding position + equity waterfall
   All derived from the same live model/state the rest of the app uses. */
const sumFmt = window.Appraisal;

function SumStat({ label, value, sub }) {
  return (
    <div className="sumstat">
      <div className="l">{label}</div>
      <div className="v">{value}</div>
      {sub ? <div className="s">{sub}</div> : null}
    </div>
  );
}

function SiteDetails({ project, netArea, grossArea }) {
  const rows = [
    ['Address', project.address || '—'],
    ['Borough', project.borough || '—'],
    ['Planning Reference', project.planningRef || '—'],
    ['Client Reference', project.clientRef || '—'],
    ['Main Contact', project.mainContact || '—'],
    ['Net Area', netArea ? Math.round(netArea).toLocaleString() + ' sqft' : '—'],
    ['Gross Area', grossArea ? Math.round(grossArea).toLocaleString() + ' sqft' : '—']
  ];
  return (
    <table className="tbl sitetbl">
      <tbody>
        {rows.map(([l, v]) => <tr key={l}><td className="l">{l}</td><td>{v}</td></tr>)}
      </tbody>
    </table>
  );
}

/* Cost split as % of GDV (Summary rows 22-27) */
function CostSplitGdv({ model }) {
  const byCat = model.byCat || {};
  const catTotal = id => (byCat[id] && byCat[id].total) || 0;
  const gdv = (model.ratios && model.ratios.gdv) || 1;
  const land = catTotal(1);
  const construction = catTotal(6);
  const finance = catTotal(14);
  const devRelated = [2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13].reduce((s, id) => s + catTotal(id), 0);
  const profit = (model.ratios && model.ratios.profit) || 0;
  const rows = [
    ['Land price', land],
    ['Construction', construction],
    ['Finance related costs', finance],
    ['Development related costs', devRelated],
    ['Profit', profit]
  ];
  const max = Math.max.apply(null, rows.map(r => Math.abs(r[1])).concat([1]));
  return (
    <div className="breakdown">
      {rows.map(([label, v], i) => (
        <div className="row" key={label}>
          <div className="lab"><span className="sw" style={{ background: window.CAT_COLORS[i * 2] }}></span>{label}</div>
          <div className="bar"><span style={{ width: (max ? (Math.abs(v) / max * 100) : 0) + '%', background: window.CAT_COLORS[i * 2] }}></span></div>
          <div className="amt">{sumFmt.money(v)}</div>
          <div className="pc">{sumFmt.pct(v / gdv, 1)}</div>
        </div>
      ))}
      <div className="row" style={{ borderTop: '1px solid var(--border-strong)', fontWeight: 600 }}>
        <div className="lab">GDV</div>
        <div className="bar"></div>
        <div className="amt">{sumFmt.money(gdv)}</div>
        <div className="pc">100%</div>
      </div>
    </div>
  );
}

/* Scheme details by phase (Summary rows 34-42) */
function SchemeDetails({ state, model }) {
  const phases = state.phases || [];
  const totalUnits = phases.reduce((s, p) => s + (p.units || 0), 0) || 1;
  const totalGdv = (model.ratios && model.ratios.gdv) || 1;
  return (
    <table className="tbl">
      <thead><tr><th>Phase</th><th className="r">Units</th><th className="r">% of units</th><th className="r">GDV</th><th className="r">% of GDV</th><th className="r">£ / sqft</th></tr></thead>
      <tbody>
        {phases.filter(p => p.units > 0 || sumFmt.phaseGdv(p) > 0).map(p => (
          <tr key={p.id}>
            <td>{p.name || p.id}</td>
            <td className="r num">{p.units || 0}</td>
            <td className="r num">{sumFmt.pct((p.units || 0) / totalUnits, 1)}</td>
            <td className="r num">{sumFmt.money(sumFmt.phaseGdv(p))}</td>
            <td className="r num">{sumFmt.pct(sumFmt.phaseGdv(p) / totalGdv, 1)}</td>
            <td className="r num">{p.salePsf ? '£' + Math.round(p.salePsf) : '—'}</td>
          </tr>
        ))}
        <tr className="totalrow">
          <td>Total</td>
          <td className="r num">{totalUnits}</td>
          <td className="r num">100%</td>
          <td className="r num">{sumFmt.money(totalGdv)}</td>
          <td className="r num">100%</td>
          <td className="r num">—</td>
        </tr>
      </tbody>
    </table>
  );
}

/* Income by phase (Summary rows 51-59) — value + % of total income */
function IncomeByPhase({ state, model }) {
  const phases = state.phases || [];
  const totalGdv = (model.ratios && model.ratios.gdv) || 1;
  const rows = phases.filter(p => sumFmt.phaseGdv(p) > 0);
  return (
    <table className="tbl">
      <thead><tr><th>Phase</th><th className="r">Income</th><th className="r">% of income</th></tr></thead>
      <tbody>
        {rows.map(p => (
          <tr key={p.id}>
            <td>{p.name || p.id}</td>
            <td className="r num">{sumFmt.money(sumFmt.phaseGdv(p))}</td>
            <td className="r num">{sumFmt.pct(sumFmt.phaseGdv(p) / totalGdv, 1)}</td>
          </tr>
        ))}
        <tr className="totalrow">
          <td>Total</td>
          <td className="r num">{sumFmt.money(model.ratios.gdv || 0)}</td>
          <td className="r num">100%</td>
        </tr>
      </tbody>
    </table>
  );
}

/* Construction rates £/sqft (Summary rows 44-49).
   Construction-only = build cost / net area.
   Design & Build (incl. professional fees) = (net construction + contractors'
   professional fees, cat 7) / net area — matching the workbook's derivation. */
function ConstructionRates({ state, model }) {
  const phases = state.phases || [];
  const byCat = model.byCat || {};
  const constructionTotal = (byCat[6] && byCat[6].total) || 0;
  const contractorFees = (byCat[7] && byCat[7].total) || 0;
  // uplift factor applied on top of construction-only to reach D&B
  const dbFactor = constructionTotal ? (constructionTotal + contractorFees) / constructionTotal : 1;
  const isResi = id => ['p1', 'p2', 'p3', 'p4', 'freehold'].indexOf(id) !== -1;
  const byGroup = (pred) => {
    let area = 0, cost = 0;
    phases.forEach(p => {
      if (!pred(p.id)) return;
      const sqft = p.netAreaSqft || 0;
      area += sqft;
      cost += (p.buildRatePsf || 0) * sqft;
    });
    return { rate: area ? cost / area : 0, area };
  };
  const resi = byGroup(isResi);
  const comm = byGroup(id => id === 'commercial');
  const all = byGroup(() => true);
  const rows = [
    ['Residential', resi.rate, resi.area],
    ['Commercial', comm.rate, comm.area],
    ['Blended total', all.rate, all.area]
  ].filter(r => r[2] > 0 || r[0] === 'Blended total');
  return (
    <table className="tbl">
      <thead><tr><th>Element</th><th className="r">Construction only</th><th className="r">Design &amp; build*</th></tr></thead>
      <tbody>
        {rows.map(([label, rate]) => (
          <tr key={label} className={label === 'Blended total' ? 'totalrow' : ''}>
            <td>{label}</td>
            <td className="r num">{rate ? '£' + Math.round(rate) : '—'}</td>
            <td className="r num">{rate ? '£' + Math.round(rate * dbFactor) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* Profit + returns (Summary rows 79-88) */
function ProfitabilityBlock({ state, model }) {
  const r = model.ratios || {};
  const maxLtGdv = (state && state.assumptions && state.assumptions.loan_to_gdv) || 0.65;
  return (
    <div className="sumgrid">
      <SumStat label="Project Profit" value={sumFmt.money(r.profit || 0)} />
      <SumStat label="Profit as % GDV" value={sumFmt.pct(r.profitPctGdv || 0)} sub="target ≥ 20%" />
      <SumStat label="Profit as % Cost" value={sumFmt.pct(r.profitPctCost || 0)} />
      <SumStat label="Profit excl. Finance" value={sumFmt.pct(r.profitExFinance || 0)} sub="target ≥ 30%" />
      <SumStat label="Equity Retained" value={sumFmt.money(r.equity || 0)} />
      <SumStat label="Return on Equity" value={(r.roe || 0).toFixed(2) + '×'} />
      <SumStat label="Peak Funding (Senior Debt)" value={sumFmt.money(r.peakFunding || 0)} sub={'month ' + (r.peakMonth || 0)} />
      <SumStat label="Peak Funding as % GDV" value={sumFmt.pct(r.peakLoanToGdv || 0)} />
      <SumStat label="Max Loan to GDV" value={sumFmt.pct(maxLtGdv)} sub="facility cap" />
      <SumStat label="Peak Loan to Cost" value={sumFmt.pct(r.peakLoanToCost || 0)} />
    </div>
  );
}

/* Equity waterfall (Summary rows 92-99 / 105-112) */
function EquityWaterfall({ model }) {
  const w = model.waterfall || {};
  const totalCost = w.totalCost || (model.ratios && model.ratios.totalCost) || 1;
  const pctOf = v => sumFmt.pct((v || 0) / totalCost, 1);
  const rows = [
    ['Equity', w.equity, false],
    ['Less: Peak Funding', w.peakFunding, true],
    ['Less: Cost of Sales', w.costOfSales, true],
    ['Less: Bank Exit Fee', w.exitFee, true],
    ['Less: After Sales', w.afterSales, true]
  ];
  const bad = Math.abs(w.balanceToFund || 0) > 1000;
  return (
    <table className="tbl">
      <thead><tr><th>Element</th><th className="r">Value</th><th className="r">% of cost</th></tr></thead>
      <tbody>
        <tr className="totalrow"><td>Total Cost</td><td className="r num">{sumFmt.money(totalCost)}</td><td className="r num">100%</td></tr>
        {rows.map(([label, v]) => (
          <tr key={label}>
            <td>{label}</td>
            <td className="r num">{sumFmt.money(v || 0)}</td>
            <td className="r num">{pctOf(v)}</td>
          </tr>
        ))}
        <tr className="totalrow" style={{ color: bad ? 'var(--red-ink)' : 'var(--green-700)' }}>
          <td>Balance funded from sales income</td>
          <td className="r num">{sumFmt.money(w.balanceToFund || 0)}</td>
          <td className="r num">{pctOf(w.balanceToFund)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function SummaryScreen({ state, model }) {
  if (!state || !model) return null;
  const project = state.project || {};
  const phases = state.phases || [];
  const assumptions = state.assumptions || {};
  const byCat = model.byCat || {};
  const catTotal = id => (byCat[id] && byCat[id].total) || 0;
  const netArea = phases.reduce((s, p) => s + (p.netAreaSqft || 0), 0);
  const grossArea = netArea * (1 + (assumptions.gross_area_allowance || 0));
  const r = model.ratios || {};
  const otherCosts = (r.totalCost || 0) - catTotal(1) - catTotal(6);
  // Average residential sales £/sqft (Summary row 49)
  const resiPhases = phases.filter(p => ['p1', 'p2', 'p3', 'p4', 'freehold'].indexOf(p.id) !== -1);
  const resiArea = resiPhases.reduce((s, p) => s + (p.netAreaSqft || 0), 0);
  const resiGdv = resiPhases.reduce((s, p) => s + sumFmt.phaseGdv(p), 0);
  const avgResiPsf = resiArea ? resiGdv / resiArea : 0;

  return (
    <div className="main" data-screen-label="Summary">
      <div className="sectiontitle"><h2>Financial Appraisal Summary</h2><div className="rule"></div></div>

      <div className="grid" style={{ gridTemplateColumns: '0.9fr 1.4fr', alignItems: 'start' }}>
        <div className="card">
          <div className="cardhead"><h3>Site Details</h3><span className="sub">{project.name || '—'}</span></div>
          <div className="cardbody"><SiteDetails project={project} netArea={netArea} grossArea={grossArea} /></div>
        </div>
        <div className="card">
          <div className="cardhead"><h3>Headline Appraisal</h3><span className="sub">{project.projectLengthMonths || '—'}-month scheme · {project.constructionPeriodMonths || '—'}-month build</span></div>
          <div className="cardbody">
            <div className="sumgrid">
              <SumStat label="GDV" value={sumFmt.money(r.gdv || 0)} />
              <SumStat label="Land Value" value={sumFmt.money(catTotal(1))} />
              <SumStat label="Construction" value={sumFmt.money(catTotal(6))} />
              <SumStat label="Other Costs" value={sumFmt.money(otherCosts)} />
              <SumStat label="Total Costs" value={sumFmt.money(r.totalCost || 0)} />
              <SumStat label="Profit" value={sumFmt.money(r.profit || 0)} sub={sumFmt.pct(r.profitPctGdv || 0) + ' of GDV'} />
              <SumStat label="Equity Required" value={sumFmt.money(r.equity || 0)} />
              <SumStat label="Return on Equity" value={(r.roe || 0).toFixed(2) + '×'} />
            </div>
          </div>
        </div>
      </div>

      {/* Project metrics row (Summary rows 29-32, 49) */}
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="cardhead"><h3>Project Metrics</h3><span className="sub">durations, areas &amp; blended sales rate</span></div>
        <div className="cardbody">
          <div className="sumgrid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
            <SumStat label="Project Duration" value={(project.projectLengthMonths || 0) + ' mo'} />
            <SumStat label="Construction Period" value={(project.constructionPeriodMonths || 0) + ' mo'} />
            <SumStat label="Net Area" value={Math.round(netArea).toLocaleString() + ' ft²'} />
            <SumStat label="Gross Area" value={Math.round(grossArea).toLocaleString() + ' ft²'} />
            <SumStat label="Total Units" value={String(phases.reduce((s, p) => s + (p.units || 0), 0))} />
            <SumStat label="Avg Sales (Resi)" value={avgResiPsf ? '£' + Math.round(avgResiPsf) + '/ft²' : '—'} />
            <SumStat label="Land / GDV" value={sumFmt.pct(r.gdv ? catTotal(1) / r.gdv : 0, 1)} />
            <SumStat label="Build / GDV" value={sumFmt.pct(r.gdv ? catTotal(6) / r.gdv : 0, 1)} />
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '16px', alignItems: 'start' }}>
        <div className="card">
          <div className="cardhead"><h3>Cost Split</h3><span className="sub">% of GDV</span></div>
          <div className="cardbody"><CostSplitGdv model={model} /></div>
        </div>
        <div className="card">
          <div className="cardhead"><h3>Construction Rates</h3><span className="sub">£ / sqft</span></div>
          <div className="cardbody">
            <ConstructionRates state={state} model={model} />
            <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 8, fontFamily: 'var(--mono)' }}>*Design &amp; build spreads contractors' professional fees over net area, per the workbook.</div>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '16px', alignItems: 'start' }}>
        <div className="card">
          <div className="cardhead"><h3>Scheme by Phase</h3><span className="sub">{phases.reduce((s, p) => s + (p.units || 0), 0)} units total</span></div>
          <div className="cardbody"><SchemeDetails state={state} model={model} /></div>
        </div>
        <div className="card">
          <div className="cardhead"><h3>Income by Phase</h3><span className="sub">% of GDV</span></div>
          <div className="cardbody"><IncomeByPhase state={state} model={model} /></div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <div className="cardhead"><h3>Cost Category Breakdown</h3><span className="sub">{sumFmt.money(r.totalCost || 0)} total cost · % of cost</span></div>
        <div className="cardbody"><Breakdown model={model} /></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', marginTop: '16px', alignItems: 'start' }}>
        <div className="card">
          <div className="cardhead"><h3>Profit &amp; Returns</h3><span className="sub">lender-facing ratios</span></div>
          <div className="cardbody"><ProfitabilityBlock state={state} model={model} /></div>
        </div>
        <div className="card">
          <div className="cardhead"><h3>Funding Position</h3><span className="sub">equity waterfall</span></div>
          <div className="cardbody"><EquityWaterfall model={model} /></div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SummaryScreen });
