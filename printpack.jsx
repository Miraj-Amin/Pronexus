/* ============================================================================
   PDF Appraisal Pack — lender-facing, print-optimised A4 document.
   Renders into a body-level portal so print isolation is clean. Reuses the
   live dashboard components (KpiRow / Breakdown / Waterfall / CashflowChart /
   Sensitivity / Comps / FlagPanel) under a light "paper" theme scope, so the
   pack always matches the on-screen model.
   ========================================================================== */
const { money: ppMoney, moneyShort: ppMoneyShort, pct: ppPct } = window.Appraisal;

function PrintPack({ state, model, author, onClose }) {
  const portalEl = React.useMemo(() => { const d = document.createElement('div'); d.className = 'pp-portal'; return d; }, []);
  React.useEffect(() => {
    document.body.appendChild(portalEl);
    document.body.classList.add('pp-open');
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.classList.remove('pp-open'); if (portalEl.parentNode) portalEl.parentNode.removeChild(portalEl); };
  }, [portalEl, onClose]);

  const r = model.ratios;
  const p = state.project;
  const risk = window.Appraisal.riskScore(model);
  const totalUnits = state.phases.reduce((a, x) => a + x.units, 0);
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const red = model.flags.filter(f => f.sev === 'red').length;
  const amber = model.flags.filter(f => f.sev === 'amber').length;

  const profitSev = r.profitPctGdv < 0.15 ? 'red' : (r.profitPctGdv < 0.20 ? 'amber' : 'ok');

  const Foot = ({ n }) => (
    <div className="pp-foot">
      <span>{p.name} · {p.ref}</span>
      <span>Generated {today} · Page {n} of 4</span>
    </div>
  );

  const doc = (
    <div className="pp-overlay">
      <div className="pp-toolbar">
        <div className="pp-tb-l">
          <span className="pp-tb-title">Appraisal Pack</span>
          <span className="pp-tb-sub">{p.name}</span>
        </div>
        <div className="pp-tb-r">
          <button className="pp-btn ghost" onClick={onClose}>Close</button>
          <button className="pp-btn primary" onClick={() => window.print()}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M4 6V2.5h8V6M4 12H3a1 1 0 01-1-1V8a1 1 0 011-1h10a1 1 0 011 1v3a1 1 0 01-1 1h-1M4 10h8v3.5H4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
            Save as PDF
          </button>
        </div>
      </div>

      <div className="printpack">
        {/* ---------------- PAGE 1 · COVER ---------------- */}
        <section className="pp-page pp-cover">
          <div className="pp-cover-top">
            <div className="pp-brand"><span className="pp-mark">N</span><div><div className="pp-bn">NORTH GATE</div><div className="pp-bt">Development Appraisal</div></div></div>
            <div className="pp-doctag">Bank-facing summary</div>
          </div>

          <div className="pp-cover-mid">
            <div className="pp-eyebrow">Residential Development Appraisal</div>
            <h1 className="pp-scheme">{p.name}</h1>
            <div className="pp-addr">{p.address}</div>
            <div className="pp-refs">
              <div><span>Project ref</span><b>{p.ref}</b></div>
              <div><span>Planning ref</span><b>{p.planningRef || '—'}</b></div>
              <div><span>Units</span><b>{totalUnits}</b></div>
              <div><span>Programme</span><b>{p.projectLengthMonths} months</b></div>
            </div>
          </div>

          <div className="pp-verdict">
            <div className="pp-v">
              <div className="pp-v-l">Project Profit</div>
              <div className={'pp-v-v ' + (r.profit > 0 ? 'ok' : 'red')}>{ppMoneyShort(r.profit)}</div>
              <div className="pp-v-s">GDV {ppMoneyShort(r.gdv)} − cost {ppMoneyShort(r.totalCost)}</div>
            </div>
            <div className="pp-v">
              <div className="pp-v-l">Profit on GDV</div>
              <div className={'pp-v-v ' + profitSev}>{ppPct(r.profitPctGdv)}</div>
              <div className="pp-v-s">Target ≥ 20%</div>
            </div>
            <div className="pp-v">
              <div className="pp-v-l">Risk Rating</div>
              <div className={'pp-v-v ' + risk.sev}>{risk.level}</div>
              <div className="pp-v-s">{red} red · {amber} amber flags</div>
            </div>
          </div>

          <div className="pp-cover-foot">
            <div className="pp-prepared">Prepared by <b>{(author || 'unknown').split('@')[0]}</b> · {today}</div>
            <div className="pp-disclaimer">Confidential. Figures are an appraisal model based on current assumptions and evidenced comparables; they are not a formal valuation or an offer of finance.</div>
          </div>
        </section>

        {/* ---------------- PAGE 2 · KEY METRICS + COST BREAKDOWN ---------------- */}
        <section className="pp-page">
          <div className="pp-h"><span className="pp-h-n">01</span><h2>Appraisal Summary</h2><span className="pp-h-rule"></span></div>
          <div className="pp-sub">Headline viability metrics with lender thresholds.</div>
          <window.KpiRow model={model} />

          <div className="pp-block-h">Cost Breakdown <span>{ppMoney(r.totalCost)} total development cost</span></div>
          <window.Breakdown model={model} />
          <Foot n={2} />
        </section>

        {/* ---------------- PAGE 3 · FUNDING + CASHFLOW ---------------- */}
        <section className="pp-page">
          <div className="pp-h"><span className="pp-h-n">02</span><h2>Funding &amp; Cashflow</h2><span className="pp-h-rule"></span></div>
          <div className="pp-sub">Sources &amp; uses reconciliation and the monthly funding profile over the {model.cashflow.horizon}-month programme.</div>

          <div className="pp-block-h">Sources &amp; Uses</div>
          <window.Waterfall model={model} />

          <div className="pp-block-h" style={{ marginTop: '7mm' }}>Cashflow &amp; Peak Funding</div>
          <window.CashflowChart model={model} />
          <Foot n={3} />
        </section>

        {/* ---------------- PAGE 4 · SENSITIVITY + EVIDENCE ---------------- */}
        <section className="pp-page">
          <div className="pp-h"><span className="pp-h-n">03</span><h2>Sensitivity &amp; Evidence</h2><span className="pp-h-rule"></span></div>
          <div className="pp-sub">Profit under sale-price and cost stress, supporting sales comparables, and outstanding validation flags.</div>

          <div className="pp-block-h">Profit Sensitivity</div>
          <window.Sensitivity model={model} />

          <div className="pp-block-h" style={{ marginTop: '6mm' }}>Sales Comparables <span>{state.comparables.length} evidenced</span></div>
          <window.Comps state={state} />

          <div className="pp-block-h" style={{ marginTop: '6mm' }}>Validation Flags <span>{model.flags.length} open</span></div>
          <window.FlagPanel flags={model.flags} />
          <Foot n={4} />
        </section>
      </div>
    </div>
  );

  return ReactDOM.createPortal(doc, portalEl);
}

window.PrintPack = PrintPack;
