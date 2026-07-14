/* Dashboard components — KPI cards, breakdown, waterfall, cashflow chart,
   sensitivity heatmaps, comps, flag panel. Exports to window. */
const { money, moneyShort, pct } = window.Appraisal;

/* ---------- colour helpers for heatmaps ---------- */
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
/* heatmap cells — vivid tones that read on the dark blueprint panels */

// Three-threshold RAG coloring
function ragColor(v, redThreshold, amberThreshold, greenThreshold) {
  // green >= greenThreshold, amber >= amberThreshold & < greenThreshold, red <= redThreshold
  if (v >= greenThreshold) {
    const r = Math.min(1, (v - greenThreshold) / Math.max(1, greenThreshold || 1));
    return `hsl(162 ${52 + r * 16}% ${78 - r * 30}%)`;
  }
  if (v >= amberThreshold) {
    return `hsl(40 78% 70%)`;
  }
  if (v <= redThreshold) {
    return `hsl(2 64% 68%)`;
  }
  // between red and amber (shouldn't reach here, but fallback to red)
  return `hsl(2 64% 68%)`;
}

function profitColor(v, redThreshold, amberThreshold, greenThreshold) {
  return ragColor(v, redThreshold, amberThreshold, greenThreshold);
}
function equityColor(v, redThreshold, amberThreshold, greenThreshold) {
  return ragColor(v, redThreshold, amberThreshold, greenThreshold);
}
function debtColor(v, redThreshold, amberThreshold, greenThreshold) {
  // For debt, LOWER is better
  // Green: v <= greenThreshold (low debt is good)
  // Red: v >= redThreshold (high debt is bad)
  // Amber: everything in between
  if (v <= greenThreshold) {
    const r = Math.min(1, (greenThreshold - v) / Math.max(1, greenThreshold || 1));
    return `hsl(162 ${52 + r * 16}% ${78 - r * 30}%)`;
  }
  if (v >= redThreshold) {
    return `hsl(2 64% 68%)`;
  }
  // between green and red = amber
  return `hsl(40 78% 70%)`;
}
function textColor() { return 'rgba(7,15,28,.92)'; }

/* ---------- KPI cards ---------- */
function tlClass(sev) { return sev || 'neutral'; }
function KpiCard({ label, value, sub, sev, target }) {
  return (
    <div className={'kpi ' + tlClass(sev)}>
      {target ? <div className="target">{target}</div> : null}
      <div className="klab"><span className="tl"></span>{label}</div>
      <div className="kval">{value}</div>
      {sub ? <div className="ksub">{sub}</div> : null}
    </div>
  );
}

function KpiRow({ model, pres }) {
  const r = model.ratios;
  const sevGdvProfit = r.profitPctGdv < 0.15 ? 'red' : (r.profitPctGdv < 0.20 ? 'amber' : 'ok');
  const sevExFin = r.profitExFinance < 0.25 ? 'red' : (r.profitExFinance < 0.30 ? 'amber' : 'ok');
  const sevPeakCost = r.peakLoanToCost > 0.80 ? 'red' : (r.peakLoanToCost > 0.70 ? 'amber' : 'ok');
  const sevPeakGdv = r.peakLoanToGdv > 0.65 ? 'amber' : 'ok';
  const cards = [
    { label: 'GDV', value: moneyShort(r.gdv), sub: 'Gross development value', sev: 'neutral' },
    { label: 'Total Cost', value: moneyShort(r.totalCost), sub: 'Incl. finance', sev: 'neutral' },
    { label: 'Project Profit', value: moneyShort(r.profit), sub: 'GDV − total cost', sev: r.profit > 0 ? 'ok' : 'red' },
    { label: 'Profit % GDV', value: pct(r.profitPctGdv), sub: 'Margin on value', sev: sevGdvProfit, target: '≥20%' },
    { label: 'Profit % Cost', value: pct(r.profitPctCost), sub: 'Margin on cost', sev: 'neutral' },
    { label: 'Profit excl. Finance', value: pct(r.profitExFinance), sub: 'Lender measure', sev: sevExFin, target: '≥30%' },
    { label: 'Return on Equity', value: r.roe.toFixed(2) + '×', sub: money(r.equity) + ' equity', sev: 'neutral' },
    { label: 'Peak Loan / GDV', value: pct(r.peakLoanToGdv), sub: moneyShort(r.peakFunding) + ' peak', sev: sevPeakGdv, target: '≤65%' },
    { label: 'Peak Loan / Cost', value: pct(r.peakLoanToCost), sub: 'Max exposure', sev: sevPeakCost, target: '≤80%' }
  ];
  const shown = pres ? cards : cards;
  return <div className="kpis">{shown.map((c, i) => <KpiCard key={i} {...c} />)}</div>;
}

/* ---------- cost breakdown ---------- */
const CAT_COLORS = ['#2dd4ff','#38bdf8','#3b82f6','#6366f1','#818cf8','#a78bfa','#22d3ee','#2dd4bf','#37e0b0','#5eead4','#0ea5e9','#60a5fa','#7c8db5','#9fb4cf'];
function Breakdown({ model }) {
  const cats = model.categories.map(c => ({ ...c, total: model.byCat[c.id].total }));
  const grand = model.ratios.totalCost;
  const max = Math.max.apply(null, cats.map(c => c.total));
  return (
    <div className="breakdown">
      {cats.map((c, i) => (
        <div className="row" key={c.id}>
          <div className="lab"><span className="sw" style={{ background: CAT_COLORS[i] }}></span>{c.name}</div>
          <div className="bar"><span style={{ width: (max ? (c.total / max * 100) : 0) + '%', background: CAT_COLORS[i] }}></span></div>
          <div className="amt">{money(c.total)}</div>
          <div className="pc">{grand ? pct(c.total / grand, 1) : '—'}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- funding waterfall ---------- */
function Waterfall({ model }) {
  const w = model.waterfall;
  const bad = Math.abs(w.balanceToFund) > 1000;
  const Row = ({ cls, sign, l, v }) => (
    <div className={'wf-row ' + cls}>
      <div className="l"><span className="sign">{sign}</span>{l}</div>
      <div className="v num">{money(v)}</div>
    </div>
  );
  return (
    <div className="waterfall">
      <Row cls="total" sign="" l="Total Cost" v={w.totalCost} />
      <Row cls="sub" sign="−" l="Peak Funding (debt facility)" v={w.peakFunding} />
      <Row cls="sub" sign="−" l="Cost of Sales" v={w.costOfSales} />
      <Row cls="sub" sign="−" l="Bank Exit Fee" v={w.exitFee} />
      <Row cls="sub" sign="−" l="After Sales" v={w.afterSales} />
      <Row cls="sub" sign="−" l="Equity" v={w.equity} />
      <div className={'wf-row result ' + (bad ? 'bad' : 'good')}>
        <div className="l"><span className="sign"></span>Balance to fund from sales income</div>
        <div className="v num">{money(w.balanceToFund)}</div>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px', lineHeight: 1.4 }}>
        {bad ? 'Should net to ≈ £0. A non-zero balance means the funding stack does not reconcile to cost — flagged for review.'
             : 'Funding stack reconciles to cost.'}
      </div>
    </div>
  );
}

/* ---------- cashflow chart (SVG) ---------- */
function CashflowChart({ model }) {
  const rows = model.cashflow.rows;
  const peak = model.cashflow.peak;
  const peakMonth = model.cashflow.peakMonth;
  const W = 1000, H = 320, padL = 64, padR = 20, padT = 22, padB = 34;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const months = rows.length;
  const maxV = peak * 1.12;
  const minV = Math.min(0, Math.min.apply(null, rows.map(r => r.balance))) * 1.1;
  const range = maxV - minV || 1;
  const x = m => padL + (innerW * (m - 1) / (months - 1));
  const y = v => padT + innerH * (1 - (v - minV) / range);

  // balance area path
  let line = '', area = '';
  rows.forEach((r, i) => { const px = x(r.month), py = y(r.balance); line += (i ? 'L' : 'M') + px + ',' + py + ' '; });
  area = line + 'L' + x(months) + ',' + y(0) + ' L' + x(1) + ',' + y(0) + ' Z';

  const zeroY = y(0);
  const gridVals = [];
  for (let i = 0; i <= 4; i++) gridVals.push(minV + range * i / 4);

  const incomeMonths = rows.filter(r => r.income > 0);
  const r = model.ratios;

  return (
    <div className="chartwrap">
      <svg viewBox={'0 0 ' + W + ' ' + H} width="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="cfArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2dd4ff" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#2dd4ff" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {gridVals.map((gv, i) => (
          <g key={i}>
            <line x1={padL} y1={y(gv)} x2={W - padR} y2={y(gv)} stroke="#143150" strokeWidth="1" />
            <text x={padL - 8} y={y(gv) + 3} textAnchor="end" fontFamily="var(--mono)" fontSize="10" fill="#7f9fb9">{moneyShort(gv)}</text>
          </g>
        ))}
        {/* zero baseline */}
        <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke="#21466d" strokeWidth="1.2" strokeDasharray="3 3" />
        {/* income markers */}
        {incomeMonths.map((r2, i) => (
          <g key={i}>
            <line x1={x(r2.month)} y1={padT} x2={x(r2.month)} y2={H - padB} stroke="#37e0b0" strokeWidth="1" strokeDasharray="2 3" opacity="0.45" />
            <circle cx={x(r2.month)} cy={y(0)} r="4" fill="#37e0b0" />
          </g>
        ))}
        <path d={area} fill="url(#cfArea)" />
        <path d={line} fill="none" stroke="#2dd4ff" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {/* peak marker */}
        <g>
          <line x1={x(peakMonth)} y1={padT} x2={x(peakMonth)} y2={y(peak)} stroke="#ff5a5a" strokeWidth="1.2" strokeDasharray="3 2" />
          <circle cx={x(peakMonth)} cy={y(peak)} r="5" fill="#ff5a5a" stroke="#0a1626" strokeWidth="1.6" />
          <rect x={clamp(x(peakMonth) - 64, padL, W - padR - 128)} y={y(peak) - 34} width="128" height="26" rx="3" fill="#ff5a5a" />
          <text x={clamp(x(peakMonth) - 64, padL, W - padR - 128) + 64} y={y(peak) - 16} textAnchor="middle" fontFamily="var(--mono)" fontSize="11" fill="#1a0808" fontWeight="600">
            Peak {moneyShort(peak)} · M{peakMonth}
          </text>
        </g>
        {/* x labels */}
        {rows.filter((_, i) => i % 2 === 0).map((r2, i) => (
          <text key={i} x={x(r2.month)} y={H - padB + 18} textAnchor="middle" fontFamily="var(--mono)" fontSize="10" fill="#7f9fb9">M{r2.month}</text>
        ))}
      </svg>
      <div className="cf-legend">
        <div className="li"><span className="k" style={{ background: '#2dd4ff' }}></span>Cumulative bank debt</div>
        <div className="li"><span className="kd" style={{ background: '#ff5a5a' }}></span>Peak exposure (month {peakMonth})</div>
        <div className="li"><span className="kd" style={{ background: '#37e0b0' }}></span>Sales income recognised</div>
      </div>
      <div className="callout">
        <span className="ic">⚠</span>
        <span>Interest if unsold: <b>{money(r.monthlyInterestIfUnsold)}</b> / month at peak — every month of unsold stock costs this whether or not you drop the price.</span>
      </div>
    </div>
  );
}

/* ---------- sensitivity heatmaps ---------- */
function Heatmap({ grid, psfSteps, costSteps, colorFn, baseRow, baseCol, redThreshold, amberThreshold, greenThreshold }) {
  return (
    <div className="heatwrap">
      <table className="heat">
        <thead>
          <tr>
            <th className="corner">£psf △<br />Cost △ ↓</th>
            {psfSteps.map((s, i) => <th className="chx" key={i}>{(s > 0 ? '+' : '') + (s * 100).toFixed(s % 0.05 === 0 ? 0 : 1) + '%'}</th>)}
          </tr>
        </thead>
        <tbody>
          {costSteps.map((cs, ri) => (
            <tr key={ri}>
              <td className="chy">{(cs > 0 ? '+' : '') + (cs * 100).toFixed(cs % 0.05 === 0 ? 0 : 1) + '%'}</td>
              {psfSteps.map((ps, ci) => {
                const v = grid[ri][ci];
                const isBase = ri === baseRow && ci === baseCol;
                return <td key={ci} className={'cell' + (isBase ? ' base' : '')} style={{ background: colorFn(v, redThreshold, amberThreshold, greenThreshold), color: textColor() }} title={money(v)}>{Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'm' : (v / 1e3).toFixed(0) + 'k'}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Sensitivity({ model, initialTab }) {
  const s = model.sensitivity;
  const [tab, setTab] = React.useState(initialTab || 'profit');
  const baseCol = s.psfSteps.indexOf(0);
  const baseRow = s.costSteps.indexOf(0);
  
  // RAG threshold defaults (stored in localStorage)
  const defaultThresholds = {
    profit: { red: 0, amber: 4800000, green: 6000000 },
    equity: { red: 0, amber: 3000000, green: 4500000 },
    debt: { red: 7000000, amber: 6500000, green: 5500000 } // for debt, lower is better (thresholds are inverted)
  };
  const [thresholds, setThresholds] = React.useState(() => {
    try {
      const saved = localStorage.getItem('sensitivity_thresholds');
      return saved ? JSON.parse(saved) : defaultThresholds;
    } catch {
      return defaultThresholds;
    }
  });
  
  const updateThreshold = (tabId, kind, value) => {
    const num = parseFloat(value) || 0;
    const updated = { ...thresholds, [tabId]: { ...thresholds[tabId], [kind]: num } };
    setThresholds(updated);
    localStorage.setItem('sensitivity_thresholds', JSON.stringify(updated));
  };
  
  const tabs = [
    { id: 'profit', label: 'Profit' },
    { id: 'equity', label: 'Equity' },
    { id: 'debt', label: 'Debt' }
  ];
  const colorFn = tab === 'profit' ? profitColor
    : tab === 'equity' ? equityColor
    : debtColor;
  const grid = s[tab];
  const desc = {
    profit: 'Project profit (£). Green ≥ green, amber ≥ amber (< green), red ≤ red.',
    equity: 'Equity remaining. Green ≥ green, amber ≥ amber (< green), red ≤ red.',
    debt: 'Debt recoverable. Green ≤ green (lower is better), amber ≥ amber (< red), red ≥ red.'
  };
  const t = thresholds[tab] || defaultThresholds[tab];
  
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
        <div className="heat-tabs">{tabs.map(tb => <button key={tb.id} className={tab === tb.id ? 'active' : ''} onClick={() => setTab(tb.id)}>{tb.label} sensitivity</button>)}</div>
        <div className="heat-scale"><span>loss</span><span className="grad"></span><span>profit</span></div>
      </div>
      <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: '12px' }}>{desc[tab]}</div>
      
      {/* RAG threshold controls */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,.04)', borderRadius: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>🔴 Red ≤</label>
          <input type="number" value={t.red} onChange={e => updateThreshold(tab, 'red', e.target.value)} 
            style={{ width: '140px', padding: '4px 8px', fontSize: '12px', fontFamily: 'var(--mono)', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '4px', color: '#fff' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>🟡 Amber ≥</label>
          <input type="number" value={t.amber} onChange={e => updateThreshold(tab, 'amber', e.target.value)}
            style={{ width: '140px', padding: '4px 8px', fontSize: '12px', fontFamily: 'var(--mono)', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '4px', color: '#fff' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>🟢 Green ≥</label>
          <input type="number" value={t.green} onChange={e => updateThreshold(tab, 'green', e.target.value)}
            style={{ width: '140px', padding: '4px 8px', fontSize: '12px', fontFamily: 'var(--mono)', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '4px', color: '#fff' }} />
        </div>
      </div>
      
      <Heatmap grid={grid} psfSteps={s.psfSteps} costSteps={s.costSteps} colorFn={colorFn} baseRow={baseRow} baseCol={baseCol} redThreshold={t.red} amberThreshold={t.amber} greenThreshold={t.green} />
      <div style={{ fontSize: '10.5px', color: 'var(--muted-2)', marginTop: '10px', fontFamily: 'var(--mono)' }}>
        Columns: residential £psf change (commercial income held constant) · Rows: total-cost change · Outlined cell = base case ({money(s.basePsf * 0 + model.ratios.profit)})
      </div>
    </div>
  );
}

/* ---------- comparables ---------- */
function Comps({ state }) {
  const rows = state.comparables.map(c => ({ ...c, psf: c.areaSqft ? c.salePrice / c.areaSqft : 0 }));
  const avgPsf = rows.reduce((s, r) => s + r.psf, 0) / (rows.length || 1);
  return (
    <table className="tbl">
      <thead><tr><th>Address</th><th>Date</th><th className="r">Sale Price</th><th className="r">Area (sqft)</th><th className="r">£psf</th></tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id}>
            <td>{r.address}</td><td className="num">{r.saleDate}</td>
            <td className="r num">{money(r.salePrice)}</td>
            <td className="r num">{Math.round(r.areaSqft).toLocaleString()}</td>
            <td className="r num">£{Math.round(r.psf)}</td>
          </tr>
        ))}
        <tr className="totalrow"><td>Average</td><td></td><td className="r num">—</td><td className="r num">—</td><td className="r num">£{Math.round(avgPsf)}</td></tr>
      </tbody>
    </table>
  );
}

/* ---------- flag panel ---------- */
function FlagPanel({ flags }) {
  if (!flags.length) return <div className="flagitem"><span className="tl" style={{ background: 'var(--ok)' }}></span><div><div className="ft">No active breaches</div><div className="fd">All validation rules pass.</div></div></div>;
  return (
    <div className="flagpanel">
      {flags.map((f, i) => (
        <div key={i} className={'flagitem ' + f.sev}>
          <span className="tl"></span>
          <div><div className="ft">{f.rule}</div><div className="fd">{f.detail}</div></div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { KpiRow, Breakdown, Waterfall, CashflowChart, Sensitivity, Comps, FlagPanel, CAT_COLORS });
