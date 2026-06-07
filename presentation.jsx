/* ============================================================================
   Audience-tailored PRESENTATION mode.
   The active version's type (Investor / Bank-Valuer / Owner-Seller / Adjusted /
   Internal) selects a profile that re-frames the bank-facing summary: a distinct
   badge + accent, an audience-specific hero-KPI set, and a tailored card layout.
   Reuses the dashboard chart components (CashflowChart, Waterfall, Breakdown,
   Sensitivity, Comps) exported to window.
   ========================================================================== */
const presFmt = window.Appraisal;
const _m = window.Appraisal.money, _ms = window.Appraisal.moneyShort, _pct = window.Appraisal.pct;

/* RAG helpers — mirror the engine's flag thresholds */
function ragGdv(r) { return r.profitPctGdv < 0.15 ? 'red' : r.profitPctGdv < 0.20 ? 'amber' : 'ok'; }
function ragExFin(r) { return r.profitExFinance < 0.25 ? 'red' : r.profitExFinance < 0.30 ? 'amber' : 'ok'; }
function ragPeakCost(r) { return r.peakLoanToCost > 0.80 ? 'red' : r.peakLoanToCost > 0.70 ? 'amber' : 'ok'; }
function ragPeakGdv(r) { return r.peakLoanToGdv > 0.65 ? 'amber' : 'ok'; }

/* area-weighted blend of a per-phase rate (e.g. sale £psf) */
function blendedPsf(state, key) {
  let s = 0, w = 0;
  state.phases.forEach(p => { if (p.netAreaSqft > 0) { s += (p[key] || 0) * p.netAreaSqft; w += p.netAreaSqft; } });
  return w ? s / w : 0;
}

/* "what it works at" — solve the purchase price that yields a target % GDV margin.
   Profit margin is monotonic-decreasing in offer price, so a binary search is safe. */
function supportableOffer(state, target) {
  const probe = JSON.parse(JSON.stringify(state));
  let lo = 0, hi = Math.max((state.project.offerPrice || 0) * 2, (state.project.askingPrice || 0) * 2, 2000000);
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    probe.project.offerPrice = mid;
    const m = presFmt.computeModel(probe);
    if (m.ratios.profitPctGdv > target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function audienceKey(state) {
  const t = state.version && state.version.type;
  if (t === 'Investor') return 'investor';
  if (t === 'Bank / Valuer') return 'bank';
  if (t === 'Owner / Seller') return 'owner';
  if (t === 'Adjusted assumptions') return 'adjusted';
  if (t === 'Internal / working') return 'internal';
  return 'base';
}

const PRES_META = {
  investor:  { cls: 'v-investor', badge: 'INVESTOR SUMMARY',     blurb: 'Return profile and equity story — prepared for prospective equity partners.' },
  bank:      { cls: 'v-bank',     badge: 'BANK / VALUER SUMMARY', blurb: 'Security, exposure and stress testing — prepared for the funding lender and valuer.' },
  owner:     { cls: 'v-owner',    badge: 'OWNER / SELLER SUMMARY', blurb: 'Offer position evidenced against comparables — prepared for the vendor.' },
  adjusted:  { cls: 'v-adj',      badge: 'ADJUSTED-ASSUMPTIONS SUMMARY', blurb: 'Scenario run on revised assumptions — read alongside the base case.' },
  internal:  { cls: 'v-internal', badge: 'INTERNAL REVIEW',       blurb: 'Full internal review — every headline metric and validation surface.' },
  base:      { cls: '',           badge: 'BANK-FACING SUMMARY',   blurb: '' }
};

/* hero-KPI set per audience */
function heroKpis(key, model, state) {
  const r = model.ratios, p = state.project;
  const units = state.phases.reduce((a, x) => a + x.units, 0);
  if (key === 'investor') return [
    { l: 'GDV', v: _ms(r.gdv), sub: 'Gross development value' },
    { l: 'Project Profit', v: _ms(r.profit), sub: 'GDV − total cost', sev: r.profit > 0 ? 'ok' : 'red' },
    { l: 'Profit % GDV', v: _pct(r.profitPctGdv), sub: 'Margin on value', sev: ragGdv(r), target: '≥20%' },
    { l: 'Profit % Cost', v: _pct(r.profitPctCost), sub: 'Margin on cost' },
    { l: 'Return on Equity', v: r.roe.toFixed(2) + '×', sub: 'Money multiple', sev: 'ok' },
    { l: 'Equity Required', v: _ms(r.equity), sub: 'Day-one commitment' }
  ];
  if (key === 'bank') return [
    { l: 'GDV', v: _ms(r.gdv), sub: 'Gross development value' },
    { l: 'Total Cost', v: _ms(r.totalCost), sub: 'Incl. finance' },
    { l: 'Peak Funding', v: _ms(r.peakFunding), sub: 'Month ' + r.peakMonth + ' max exposure' },
    { l: 'Peak Loan / GDV', v: _pct(r.peakLoanToGdv), sub: 'Security cover', sev: ragPeakGdv(r), target: '≤65%' },
    { l: 'Peak Loan / Cost', v: _pct(r.peakLoanToCost), sub: 'Gearing', sev: ragPeakCost(r), target: '≤80%' },
    { l: 'Profit excl. Finance', v: _pct(r.profitExFinance), sub: 'Lender measure', sev: ragExFin(r), target: '≥30%' }
  ];
  if (key === 'owner') {
    const ask = p.askingPrice || 0, off = p.offerPrice || 0;
    const dl = ask ? (off - ask) / ask : 0;
    return [
      { l: 'Asking Price', v: _ms(ask), sub: 'Agent quoting' },
      { l: 'Our Offer', v: _ms(off), sub: (dl <= 0 ? '' : '+') + (dl * 100).toFixed(1) + '% vs asking' },
      { l: 'Supportable', v: _ms(supportableOffer(state, 0.20)), sub: 'At a viable 20% margin' },
      { l: 'GDV', v: _ms(r.gdv), sub: 'Gross development value' },
      { l: 'Blended Sales', v: '£' + Math.round(blendedPsf(state, 'salePsf')).toLocaleString() + ' psf', sub: 'Across all phases' },
      { l: 'Scheme', v: units + ' units', sub: (p.projectLengthMonths || 0) + '-month programme' }
    ];
  }
  // base / internal / adjusted — full internal headline set
  return [
    { l: 'GDV', v: _ms(r.gdv), sub: 'Gross development value' },
    { l: 'Total Cost', v: _ms(r.totalCost), sub: 'Incl. finance' },
    { l: 'Project Profit', v: _ms(r.profit), sub: 'GDV − total cost', sev: r.profit > 0 ? 'ok' : 'red' },
    { l: 'Profit % GDV', v: _pct(r.profitPctGdv), sub: 'Margin on value', sev: ragGdv(r), target: '≥20%' },
    { l: 'Profit excl. Finance', v: _pct(r.profitExFinance), sub: 'Lender measure', sev: ragExFin(r), target: '≥30%' },
    { l: 'Peak Funding', v: _ms(r.peakFunding), sub: 'Month ' + r.peakMonth + ' exposure' }
  ];
}

function HeroKpis({ items }) {
  return (
    <div className="kpis pres-kpis">
      {items.map((k, i) => (
        <div className={'kpi ' + (k.sev || 'neutral')} key={i}>
          {k.target ? <div className="target">{k.target}</div> : null}
          <div className="klab"><span className="tl"></span>{k.l}</div>
          <div className="kval">{k.v}</div>
          {k.sub ? <div className="ksub">{k.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}

/* ---- Owner/Seller: visual offer position vs asking & supportable ---- */
function PriceStory({ state }) {
  const p = state.project;
  const ask = p.askingPrice || 0, off = p.offerPrice || 0;
  const sup = supportableOffer(state, 0.20);
  const max = Math.max(ask, off, sup, 1);
  const bars = [
    { l: 'Agent asking', v: ask, cls: 'ask' },
    { l: 'Our offer', v: off, cls: 'offer' },
    { l: 'Supportable @ 20% margin', v: sup, cls: 'support' }
  ];
  const headroom = sup - off;
  return (
    <div className="pricestory">
      <div className="ps-bars">
        {bars.map((b, i) => (
          <div className="ps-row" key={i}>
            <div className="ps-lab">{b.l}</div>
            <div className="ps-track"><div className={'ps-fill ' + b.cls} style={{ width: Math.max(2, (b.v / max) * 100) + '%' }}></div></div>
            <div className="ps-val">{_ms(b.v)}</div>
          </div>
        ))}
      </div>
      <div className="ps-note">
        {off <= sup
          ? <span>Our offer sits <b>{_ms(Math.abs(headroom))}</b> below the price the scheme can support at a viable margin — the bid is well evidenced.</span>
          : <span>Our offer is <b>{_ms(Math.abs(headroom))}</b> above the supportable level — the scheme would run below a viable margin at this price.</span>}
      </div>
    </div>
  );
}

/* ---- Owner/Seller: scheme summary (no cost / margin disclosed) ---- */
function SchemeSummary({ state }) {
  const rows = state.phases.filter(ph => ph.units > 0 || ph.netAreaSqft > 0);
  const tot = rows.reduce((a, ph) => ({
    units: a.units + (ph.units || 0),
    area: a.area + (ph.netAreaSqft || 0),
    gdv: a.gdv + (ph.netAreaSqft || 0) * (ph.salePsf || 0)
  }), { units: 0, area: 0, gdv: 0 });
  return (
    <table className="tbl">
      <thead><tr><th>Phase</th><th className="num">Units</th><th className="num">Net area</th><th className="num">£psf</th><th className="num">GDV</th></tr></thead>
      <tbody>
        {rows.map((ph, i) => (
          <tr key={i}>
            <td>{ph.name}</td>
            <td className="num">{ph.units || '—'}</td>
            <td className="num">{(ph.netAreaSqft || 0).toLocaleString()}</td>
            <td className="num">£{Math.round(ph.salePsf || 0).toLocaleString()}</td>
            <td className="num">{_ms((ph.netAreaSqft || 0) * (ph.salePsf || 0))}</td>
          </tr>
        ))}
        <tr className="totalrow">
          <td>Total</td>
          <td className="num">{tot.units}</td>
          <td className="num">{tot.area.toLocaleString()}</td>
          <td className="num">£{Math.round(blendedPsf(state, 'salePsf')).toLocaleString()}</td>
          <td className="num">{_ms(tot.gdv)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function PresCard({ title, sub, children, span }) {
  return (
    <div className="card" style={span ? { marginTop: '16px' } : null}>
      <div className="cardhead"><h3>{title}</h3>{sub ? <span className="sub">{sub}</span> : null}</div>
      <div className="cardbody">{children}</div>
    </div>
  );
}

function PresBody({ key2, state, model }) {
  const Cashflow = window.CashflowChart, Waterfall = window.Waterfall,
    Breakdown = window.Breakdown, Sensitivity = window.Sensitivity, Comps = window.Comps;
  const horizon = model.cashflow.horizon;

  if (key2 === 'owner') {
    return (
      <React.Fragment>
        <PresCard title="Offer Position" sub="asking · offer · supportable">
          <PriceStory state={state} />
        </PresCard>
        <div className="grid" style={{ gridTemplateColumns: '1.1fr 1fr', marginTop: '16px' }}>
          <PresCard title="Scheme Summary" sub={state.phases.reduce((a, x) => a + x.units, 0) + ' units'}>
            <SchemeSummary state={state} />
          </PresCard>
          <PresCard title="Sales Comparables" sub={state.comparables.length + ' evidenced'}>
            <Comps state={state} />
          </PresCard>
        </div>
      </React.Fragment>
    );
  }

  if (key2 === 'bank') {
    return (
      <React.Fragment>
        <div className="grid" style={{ gridTemplateColumns: '1.55fr 1fr' }}>
          <PresCard title="Cashflow &amp; Peak Funding" sub={horizon + '-month horizon · peak marked'}><Cashflow model={model} /></PresCard>
          <PresCard title="Funding Waterfall" sub="reconcile to £0"><Waterfall model={model} /></PresCard>
        </div>
        <PresCard span title="Sensitivity — Lender Stress" sub="debt recoverable across price × cost">
          <Sensitivity model={model} initialTab="debt" />
        </PresCard>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '16px' }}>
          <PresCard title="Cost Breakdown" sub={_ms(model.ratios.totalCost) + ' total'}><Breakdown model={model} /></PresCard>
          <PresCard title="Sales Comparables" sub={state.comparables.length + ' evidenced'}><Comps state={state} /></PresCard>
        </div>
      </React.Fragment>
    );
  }

  if (key2 === 'investor') {
    return (
      <React.Fragment>
        <div className="grid" style={{ gridTemplateColumns: '1.55fr 1fr' }}>
          <PresCard title="Cashflow &amp; Peak Funding" sub={horizon + '-month horizon'}><Cashflow model={model} /></PresCard>
          <PresCard title="Sources &amp; Uses" sub="equity & debt"><Waterfall model={model} /></PresCard>
        </div>
        <PresCard span title="Sensitivity — Profit" sub="upside & downside across price × cost">
          <Sensitivity model={model} initialTab="profit" />
        </PresCard>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '16px' }}>
          <PresCard title="Cost Breakdown" sub={_ms(model.ratios.totalCost) + ' total'}><Breakdown model={model} /></PresCard>
          <PresCard title="Sales Comparables" sub={state.comparables.length + ' evidenced'}><Comps state={state} /></PresCard>
        </div>
      </React.Fragment>
    );
  }

  // base / internal / adjusted — full internal layout
  return (
    <React.Fragment>
      <div className="grid" style={{ gridTemplateColumns: '1.55fr 1fr' }}>
        <PresCard title="Cashflow &amp; Peak Funding" sub={horizon + '-month horizon'}><Cashflow model={model} /></PresCard>
        <PresCard title="Sources &amp; Uses" sub="reconcile to £0"><Waterfall model={model} /></PresCard>
      </div>
      <PresCard span title="Sensitivity Analysis" sub="sale price × cost">
        <Sensitivity model={model} initialTab="profit" />
      </PresCard>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '16px' }}>
        <PresCard title="Cost Breakdown" sub={_ms(model.ratios.totalCost) + ' total'}><Breakdown model={model} /></PresCard>
        <PresCard title="Sales Comparables" sub={state.comparables.length + ' evidenced'}><Comps state={state} /></PresCard>
      </div>
    </React.Fragment>
  );
}

function Presentation({ state, model }) {
  const key = audienceKey(state);
  const meta = PRES_META[key] || PRES_META.base;
  const p = state.project;
  const units = state.phases.reduce((a, x) => a + x.units, 0);
  const kpis = heroKpis(key, model, state);
  const verLabel = state.version && state.version.label;
  return (
    <div className="main" data-screen-label="Presentation">
      <div className={'pres-header ' + meta.cls}>
        <div className="ph-l">
          <div className={'pres-badge ' + meta.cls} style={{ marginBottom: 12 }}>● {meta.badge}</div>
          <h1>{p.name}</h1>
          <div className="addr">{p.address}</div>
          {meta.blurb ? <div className="pres-blurb">{meta.blurb}</div> : null}
        </div>
        <div className="ph-meta">
          <div className="m"><div className="l">{verLabel ? 'Version' : 'Planning Ref'}</div><div className="v">{verLabel || p.planningRef || '—'}</div></div>
          <div className="m"><div className="l">Programme</div><div className="v">{p.projectLengthMonths} mo</div></div>
          <div className="m"><div className="l">Units</div><div className="v">{units}</div></div>
        </div>
      </div>
      <HeroKpis items={kpis} />
      <div style={{ marginTop: '20px' }}>
        <PresBody key2={key} state={state} model={model} />
      </div>
    </div>
  );
}

Object.assign(window, { Presentation });
