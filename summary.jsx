/* Summary screen — a read-only, on-screen "appraisal document" mirroring the
   Input + Summary sheets of the source spreadsheet: site details, headline
   GDV/cost/profit figures, cost-mix %, scheme breakdown by phase, the full
   cost category table, profitability ratios and the funding waterfall — all
   in one scrollable view rather than split across the Dashboard's charts. */
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

function CostMix({ model }) {
  const gdv = model.ratios.gdv || 1;
  const land = model.byCat[1].total;
  const construction = model.byCat[6].total;
  const finance = model.byCat[14].total;
  const devRelated = [2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13].reduce((s, id) => s + model.byCat[id].total, 0);
  const profit = model.ratios.profit;
  const rows = [
    ['Land price', land],
    ['Construction', construction],
    ['Finance related costs', finance],
    ['Development related costs', devRelated],
    ['Profit', profit]
  ];
  const max = Math.max.apply(null, rows.map(r => Math.abs(r[1])));
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
    </div>
  );
}

function SchemeDetails({ state, model }) {
  const totalUnits = state.phases.reduce((s, p) => s + (p.units || 0), 0) || 1;
  const totalGdv = model.ratios.gdv || 1;
  return (
    <table className="tbl">
      <thead><tr><th>Phase</th><th className="r">Units</th><th className="r">% of units</th><th className="r">GDV</th><th className="r">% of GDV</th><th className="r">£ / sqft</th></tr></thead>
      <tbody>
        {state.phases.filter(p => p.units > 0 || sumFmt.phaseGdv(p) > 0).map(p => (
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
          <td className="r num">{sumFmt.money(model.ratios.gdv)}</td>
          <td className="r num">100%</td>
          <td className="r num">—</td>
        </tr>
      </tbody>
    </table>
  );
}

function ProfitabilityBlock({ model }) {
  const r = model.ratios;
  return (
    <div className="sumgrid">
      <SumStat label="Project Profit" value={sumFmt.money(r.profit)} />
      <SumStat label="Profit as % GDV" value={sumFmt.pct(r.profitPctGdv)} sub="target ≥ 20%" />
      <SumStat label="Profit as % Cost" value={sumFmt.pct(r.profitPctCost)} />
      <SumStat label="Profit excl. Finance" value={sumFmt.pct(r.profitExFinance)} sub="target ≥ 30%" />
      <SumStat label="Equity Retained" value={sumFmt.money(r.equity)} />
      <SumStat label="Return on Equity" value={r.roe.toFixed(2) + '×'} />
      <SumStat label="Peak Funding (Senior Debt)" value={sumFmt.money(r.peakFunding)} sub={'month ' + r.peakMonth} />
      <SumStat label="Max Loan to GDV" value={sumFmt.pct(r.peakLoanToGdv)} sub="cap 65%" />
      <SumStat label="Peak Loan to Cost" value={sumFmt.pct(r.peakLoanToCost)} />
    </div>
  );
}

function SummaryScreen({ state, model }) {
  const netArea = state.phases.reduce((s, p) => s + (p.netAreaSqft || 0), 0);
  const grossArea = netArea * (1 + (state.assumptions.gross_area_allowance || 0));
  const r = model.ratios;
  const otherCosts = r.totalCost - model.byCat[1].total - model.byCat[6].total;

  return (
    <div className="main" data-screen-label="Summary">
      <div className="sectiontitle"><h2>Financial Appraisal Summary</h2><div className="rule"></div></div>

      <div className="grid" style={{ gridTemplateColumns: '0.9fr 1.4fr', alignItems: 'start' }}>
        <div className="card">
          <div className="cardhead"><h3>Site Details</h3><span className="sub">{state.project.name}</span></div>
          <div className="cardbody"><SiteDetails project={state.project} netArea={netArea} grossArea={grossArea} /></div>
        </div>
        <div className="card">
          <div className="cardhead"><h3>Headline Appraisal</h3><span className="sub">{state.project.projectLengthMonths}-month scheme · {state.project.constructionPeriodMonths}-month build</span></div>
          <div className="cardbody">
            <div className="sumgrid">
              <SumStat label="GDV" value={sumFmt.money(r.gdv)} />
              <SumStat label="Land Value" value={sumFmt.money(model.byCat[1].total)} />
              <SumStat label="Construction" value={sumFmt.money(model.byCat[6].total)} />
              <SumStat label="Other Costs" value={sumFmt.money(otherCosts)} />
              <SumStat label="Total Costs" value={sumFmt.money(r.totalCost)} />
              <SumStat label="Profit" value={sumFmt.money(r.profit)} sub={sumFmt.pct(r.profitPctGdv) + ' of GDV'} />
              <SumStat label="Equity Required" value={sumFmt.money(r.equity)} />
              <SumStat label="Return on Equity" value={r.roe.toFixed(2) + '×'} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '16px' }}>
        <div className="card">
          <div className="cardhead"><h3>Cost Mix</h3><span className="sub">% of GDV</span></div>
          <div className="cardbody"><CostMix model={model} /></div>
        </div>
        <div className="card">
          <div className="cardhead"><h3>Scheme &amp; Income by Phase</h3><span className="sub">{state.phases.reduce((s, p) => s + (p.units || 0), 0)} units total</span></div>
          <div className="cardbody"><SchemeDetails state={state} model={model} /></div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <div className="cardhead"><h3>Cost Category Breakdown</h3><span className="sub">{sumFmt.money(r.totalCost)} total cost · % of cost</span></div>
        <div className="cardbody"><Breakdown model={model} /></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', marginTop: '16px' }}>
        <div className="card">
          <div className="cardhead"><h3>Profitability</h3><span className="sub">lender-facing ratios</span></div>
          <div className="cardbody"><ProfitabilityBlock model={model} /></div>
        </div>
        <div className="card">
          <div className="cardhead"><h3>Funding Waterfall</h3><span className="sub">reconcile to £0</span></div>
          <div className="cardbody"><Waterfall model={model} /></div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SummaryScreen });
