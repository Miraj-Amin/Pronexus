/* Input screen — canonical-order sections with live recalc + Sales Programme */
const inpFmt = window.Appraisal;

function MoneyInput({ value, onChange, cls }) {
  return <input className={'num ' + (cls || '')} value={value == null ? '' : value}
    onChange={e => { const n = parseFloat(e.target.value.replace(/[^0-9.\-]/g, '')); onChange(isNaN(n) ? 0 : n); }} />;
}

/* PctInput — buffers local string so decimal point isn't swallowed mid-type */
function PctInput({ value, onChange, style }) {
  const [local, setLocal] = React.useState(null);
  const display = local !== null ? local : String(parseFloat((value * 100).toPrecision(8)));
  return <input
    className="num mwidth"
    value={display}
    style={style || { width: 56 }}
    onChange={e => {
      setLocal(e.target.value);
      const n = parseFloat(e.target.value);
      if (!isNaN(n)) onChange(n / 100);
    }}
    onBlur={() => {
      const n = parseFloat(display);
      onChange(isNaN(n) ? 0 : n / 100);
      setLocal(null);
    }}
  />;
}
function Check({ on, onClick }) {
  return <div className={'chk' + (on ? ' on' : '')} onClick={onClick}>
    {on ? <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
  </div>;
}

function LockGlyph({ open }) {
  return open
    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M8 11V7a4 4 0 0 1 7.4-2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
    : <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function Section({ idx, title, total, children, defaultOpen }) {
  const [open, setOpen] = React.useState(defaultOpen !== false);
  const lockKey = 'seclock:' + title;
  const [locked, setLocked] = React.useState(() => {
    try { const v = localStorage.getItem(lockKey); return v === null ? true : v === '1'; } catch (e) { return true; }
  });
  const toggleLock = (e) => {
    e.stopPropagation();
    setLocked(l => {
      const nv = !l;
      try { localStorage.setItem(lockKey, nv ? '1' : '0'); } catch (e2) {}
      if (nv && document.activeElement && document.activeElement.blur) document.activeElement.blur();
      return nv;
    });
  };
  return (
    <div className={'insection' + (open ? '' : ' collapsed') + (locked ? ' locked' : ' unlocked')}>
      <div className="insechead" onClick={() => setOpen(o => !o)}>
        <span className="ix">{idx}</span>
        <h3>{title}</h3>
        {total != null ? <span className="tot">{inpFmt.money(total)}</span> : null}
        <button className="lockbtn" title={locked ? 'Locked — click to unlock for editing' : 'Editing — click to lock'} onClick={toggleLock}>
          <LockGlyph open={!locked} />
          <span className="lbl">{locked ? 'Locked' : 'Editing'}</span>
        </button>
        <span className="chev"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 4.5L6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
      </div>
      <div className="insecbody">
        <fieldset className="lockwrap" disabled={locked}>{children}</fieldset>
      </div>
    </div>
  );
}

/* ---- Section A: Site Details ---- */
function SiteDetails({ state, model, set }) {
  const p = state.project;
  const f = (label, key, mono) => (
    <div className="field"><label>{label}</label>
      <input className={mono ? 'num' : ''} value={p[key] == null ? '' : p[key]} onChange={e => set(s => { s.project[key] = mono ? (parseFloat(e.target.value.replace(/[^0-9.\-]/g, '')) || 0) : e.target.value; })} /></div>
  );
  return (
    <Section idx="A" title="Site Details" defaultOpen={true}>
      <div className="field"><label>Address</label>
        <input value={p.address} onChange={e => set(s => { s.project.address = e.target.value; })} /></div>
      <div className="fieldrow" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        {f('Borough', 'borough')}{f('Planning Reference', 'planningRef')}{f('Client Reference', 'clientRef')}
      </div>
      <div className="fieldrow" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        {f('Main Contact', 'mainContact')}
        {f('Asking Price', 'askingPrice', true)}
        {f('Offer Price', 'offerPrice', true)}
      </div>
      <div className="fieldrow" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginTop: '4px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
        <div><label style={{ fontSize: '11px', color: 'var(--muted)' }}>Net Area</label><div className="derived">{Math.round(inpFmt.totalGdv ? state.phases.reduce((a, x) => a + x.netAreaSqft, 0) : 0).toLocaleString()} sqft</div></div>
        <div><label style={{ fontSize: '11px', color: 'var(--muted)' }}>Gross Area</label><div className="derived">{Math.round(state.phases.reduce((a, x) => a + x.netAreaSqft * (x.phaseType === 'Flat' || x.phaseType === 'Mixed' ? 1 + state.assumptions.gross_area_allowance : 1.0), 0)).toLocaleString()} sqft</div></div>
        <div><label style={{ fontSize: '11px', color: 'var(--muted)' }}>Blended £psf</label><div className="derived">£{Math.round(model.ratios.gdv / (state.phases.reduce((a, x) => a + x.netAreaSqft, 0) || 1))}</div></div>
        <div><label style={{ fontSize: '11px', color: 'var(--muted)' }}>GDV</label><div className="derived" style={{ color: 'var(--green-700)', fontWeight: 600 }}>{inpFmt.money(model.ratios.gdv)}</div></div>
      </div>
    </Section>
  );
}

/* ---- Section B: Timings ---- */
function Timings({ state, set }) {
  const p = state.project;
  const lastConstr = 18;
  const noBuffer = p.constructionPeriodMonths + 3 >= p.projectLengthMonths;
  return (
    <Section idx="B" title="Timings" defaultOpen={true}>
      <div className="fieldrow" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="field"><label>Project Start</label><input value={p.startDate} onChange={e => set(s => { s.project.startDate = e.target.value; })} /></div>
        <div className="field"><label>Project Length (months)</label><input className="num" value={p.projectLengthMonths} onChange={e => set(s => { s.project.projectLengthMonths = parseInt(e.target.value) || 0; })} /></div>
        <div className="field"><label>Construction Period (months)</label><input className="num" value={p.constructionPeriodMonths} onChange={e => set(s => { s.project.constructionPeriodMonths = parseInt(e.target.value) || 0; })} /></div>
      </div>
      {noBuffer ? <div className="reconcile bad" style={{ marginTop: 0 }}><span>⚠</span> Project length leaves little / no completion &amp; snag buffer beyond construction. Aim for ≥1–2 months tail.</div> : null}
    </Section>
  );
}

/* ---- Section C: Schedule of Units ---- */
function ScheduleOfUnits({ state, model, set }) {
  const t = model.scheduleTotals;
  const phaseUnits = state.phases.reduce((a, p) => a + p.units, 0);
  const phaseGdvTotal = model.ratios.gdv;
  const recOk = t.units === phaseUnits && Math.abs(t.value - phaseGdvTotal) < 1000;
  const cell = (u, key, mono) => <input className={mono ? 'num' : ''} value={u[key]} onChange={e => set(s => { const uu = s.units.find(x => x.id === u.id); uu[key] = mono ? (parseFloat(e.target.value.replace(/[^0-9.\-]/g, '')) || 0) : e.target.value; })} />;
  return (
    <Section idx="C" title="Schedule of Units" total={t.value}>
      <div style={{ overflowX: 'auto' }}>
        <table className="unittbl">
          <thead><tr><th>#</th><th>Type</th><th className="r">Beds</th><th className="r">En-S</th><th className="r">Bath</th><th className="r">GIA m²</th><th className="r">GIA ft²</th><th>Outside</th><th className="r">Price</th><th className="r">£psf</th><th></th></tr></thead>
          <tbody>
            {state.units.map(u => {
              const sqft = inpFmt.sqftFromSqm(u.giaSqm || 0);
              return (
                <tr key={u.id}>
                  <td style={{ width: 34 }}>{cell(u, 'number')}</td>
                  <td style={{ minWidth: 70 }}>{cell(u, 'type')}</td>
                  <td className="r" style={{ width: 46 }}>{cell(u, 'beds', true)}</td>
                  <td className="r" style={{ width: 46 }}>{cell(u, 'ensuites', true)}</td>
                  <td className="r" style={{ width: 46 }}>{cell(u, 'baths', true)}</td>
                  <td className="r" style={{ width: 60 }}>{cell(u, 'giaSqm', true)}</td>
                  <td className="r num" style={{ color: 'var(--muted)' }}>{Math.round(sqft).toLocaleString()}</td>
                  <td style={{ minWidth: 64 }}>{cell(u, 'outside')}</td>
                  <td className="r" style={{ width: 90 }}>{cell(u, 'price', true)}</td>
                  <td className="r num" style={{ color: 'var(--muted)' }}>£{Math.round(sqft ? u.price / sqft : 0)}</td>
                  <td><button className="btn ghost" style={{ padding: '3px 7px', color: 'var(--muted-2)' }} onClick={() => set(s => { s.units = s.units.filter(x => x.id !== u.id); })}>✕</button></td>
                </tr>
              );
            })}
            <tr className="totalrow">
              <td colSpan="5">Total · {t.units} units</td>
              <td className="r">{Math.round(state.units.reduce((a, u) => a + u.giaSqm, 0))}</td>
              <td className="r">{Math.round(t.sqft).toLocaleString()}</td>
              <td></td>
              <td className="r">{inpFmt.money(t.value)}</td>
              <td className="r">£{Math.round(t.sqft ? t.value / t.sqft : 0)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', gap: 12 }}>
        <button className="btn" onClick={() => set(s => { s.units.push({ id: 'u' + Date.now(), phaseId: 'p1', number: String(s.units.length + 1), type: 'House', beds: 0, ensuites: 0, baths: 0, giaSqm: 0, outside: '', price: 0 }); })}>+ Add unit</button>
        <div className={'reconcile ' + (recOk ? 'ok' : 'bad')} style={{ marginTop: 0 }}>
          {recOk ? <span>✓ Schedule reconciles to phases</span> : <span>⚠ {t.units} units / {inpFmt.money(t.value)} ≠ {phaseUnits} units / {inpFmt.money(phaseGdvTotal)} in phases</span>}
        </div>
      </div>
    </Section>
  );
}

/* ---- Section D: Income by phase ---- */
function IncomeByPhase({ state, model, set }) {
  const cell = (p, key, mono) => <input className={mono ? 'num' : ''} value={p[key]} onChange={e => set(s => { const pp = s.phases.find(x => x.id === p.id); pp[key] = mono ? (parseFloat(e.target.value.replace(/[^0-9.\-]/g, '')) || 0) : e.target.value; })} />;
  return (
    <Section idx="D" title="Income by Phase" total={model.ratios.gdv}>
      <div style={{ overflowX: 'auto' }}>
        <table className="unittbl">
          <thead><tr><th>Phase</th><th className="r">Type</th><th className="r">Units</th><th className="r">Net Area ft²</th><th className="r">Build £psf</th><th className="r">Sale £psf</th><th className="r">GDV</th></tr></thead>
          <tbody>
            {state.phases.map(p => (
              <tr key={p.id} style={{ opacity: inpFmt.phaseGdv(p) > 0 ? 1 : 0.55 }}>
                <td style={{ minWidth: 110 }}>{p.name}</td>
                <td className="r" style={{ width: 80 }}>
                  <select className="num" value={p.phaseType || 'House'} onChange={e => set(s => { s.phases.find(x => x.id === p.id).phaseType = e.target.value; })} style={{ fontSize: 12, padding: '2px 4px', background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--border)' }}>
                    <option value="House">House</option>
                    <option value="Flat">Flat</option>
                    <option value="Mixed">Mixed</option>
                  </select>
                </td>
                <td className="r" style={{ width: 70 }}>{cell(p, 'units', true)}</td>
                <td className="r" style={{ width: 100 }}>{cell(p, 'netAreaSqft', true)}</td>
                <td className="r" style={{ width: 80 }}>{cell(p, 'buildRatePsf', true)}</td>
                <td className="r" style={{ width: 90 }}>{cell(p, 'salePsf', true)}</td>
                <td className="r num" style={{ fontWeight: 600 }}>{inpFmt.money(inpFmt.phaseGdv(p))}</td>
              </tr>
            ))}
            <tr className="totalrow"><td>Total</td><td></td><td className="r">{state.phases.reduce((a, p) => a + p.units, 0)}</td><td className="r">{Math.round(state.phases.reduce((a, p) => a + p.netAreaSqft, 0)).toLocaleString()}</td><td></td><td></td><td className="r">{inpFmt.money(model.ratios.gdv)}</td></tr>
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ---- Section E: Sales Programme ---- */
function SalesProgramme({ state, model, set }) {
  const H = state.project.projectLengthMonths || 18;
  const active = state.phases.filter(p => inpFmt.phaseGdv(p) > 0);
  return (
    <Section idx="E" title="Sales Programme  ★" defaultOpen={true}>
      <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>
        The missing link. Set when each phase sells — the value flows into the cashflow for those months, recalculating peak funding &amp; interest. Spread completions to cut interest.
      </div>
      {active.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 12 }}>No phases with GDV yet.</div> : active.map(p => {
        const sold = p.salesStart > 0 && p.salesEnd > 0;
        const left = sold ? ((Math.min(p.salesStart, p.salesEnd) - 1) / H * 100) : 0;
        const width = sold ? ((Math.abs(p.salesEnd - p.salesStart) + 1) / H * 100) : 0;
        return (
          <div className="salesrow" key={p.id}>
            <div className="pname">{p.name}<div className="meta">{inpFmt.money(inpFmt.phaseGdv(p))} · {p.units} units</div></div>
            <div><label style={{ fontSize: 9.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Start M</label>
              <input className="miniinput" value={p.salesStart || ''} onChange={e => set(s => { s.phases.find(x => x.id === p.id).salesStart = parseInt(e.target.value) || 0; })} /></div>
            <div><label style={{ fontSize: 9.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>End M</label>
              <input className="miniinput" value={p.salesEnd || ''} onChange={e => set(s => { s.phases.find(x => x.id === p.id).salesEnd = parseInt(e.target.value) || 0; })} /></div>
            <div className="num" style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>{sold ? (Math.abs(p.salesEnd - p.salesStart) + 1) + ' mo' : '—'}</div>
            <div className="timeline"><div className="ticks">{Array.from({ length: H }).map((_, i) => <i key={i}></i>)}</div>{sold ? <div className="span" style={{ left: left + '%', width: width + '%' }}></div> : null}</div>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 24, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ minWidth: 110 }}><div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>Peak funding</div><div className="num" style={{ fontSize: 16, color: 'var(--ink)' }}>{inpFmt.money(model.ratios.peakFunding)}</div></div>
        <div style={{ minWidth: 110 }}><div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>Total interest</div><div className="num" style={{ fontSize: 16, color: 'var(--ink)' }}>{inpFmt.money(model.ratios.interest)}</div></div>
        <div style={{ minWidth: 70 }}><div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>Peak month</div><div className="num" style={{ fontSize: 16, color: 'var(--ink)' }}>M{model.ratios.peakMonth}</div></div>
      </div>
    </Section>
  );
}

/* ---- Cost stack sections (cats 1–14) ---- */
function basisBadge(line) {
  if (line.sdlt) return <span className="badge sdlt">SDLT</span>;
  if (line.basis === 'pct_construction') return <span className="badge pct">{(line.pct * 100).toFixed(2).replace(/\.?0+$/, '')}% constr</span>;
  if (line.basis === 'pct_land') return <span className="badge pct">{(line.pct * 100).toFixed(2).replace(/\.?0+$/, '')}% land</span>;
  if (line.basis === 'pct_gdv') return <span className="badge pct">{(line.pct * 100).toFixed(2).replace(/\.?0+$/, '')}% GDV</span>;
  if (line.basis === 'pct_loan') return <span className="badge pct">{(line.pct * 100).toFixed(2).replace(/\.?0+$/, '')}% loan</span>;
  if (line.basis === 'per_unit') return <span className="badge">£{line.rate}/unit</span>;
  if (line.basis === 'construction') return <span className="badge pct">rate × gross</span>;
  if (line.basis === 'computed_interest') return <span className="badge">monthly</span>;
  return null;
}

function CostSection({ idx, cat, model, state, set }) {
  const c = model.byCat[cat.id];
  const editable = ['fixed'];
  const editPct = ['pct_construction', 'pct_land', 'pct_gdv', 'pct_loan'];
  return (
    <Section idx={idx} title={cat.id + '. ' + cat.name} total={c.total} defaultOpen={cat.id <= 1}>
      <table className="linetbl">
        <thead><tr><th className="toggle-cell"></th><th>Line item</th><th className="r">Amount / Rate</th><th className="r">Start</th><th className="r">End</th><th className="r">Mo.</th><th className="r">£ Resolved</th></tr></thead>
        <tbody>
          {c.lines.map(line => {
            const src = state.costLines.find(l => l.id === line.id);
            return (
              <tr key={line.id} className={(line.included ? '' : 'off ') + (line.info && line.amount === 0 ? 'info' : '')}>
                <td className="toggle-cell"><Check on={line.included} onClick={() => set(s => { const l = s.costLines.find(x => x.id === line.id); l.included = !l.included; })} /></td>
                <td><span className="iteminput">{line.item}</span>{basisBadge(src)}</td>
                <td className="r">
                  {editable.indexOf(line.basis) >= 0
                    ? <MoneyInput value={src.amount || 0} cls="mwidth" onChange={v => set(s => { s.costLines.find(x => x.id === line.id).amount = v; })} />
                    : editPct.indexOf(line.basis) >= 0
                      ? <PctInput value={src.pct} onChange={v => set(s => { s.costLines.find(x => x.id === line.id).pct = v; })} />
                      : line.basis === 'per_unit'
                        ? <input className="num mwidth" value={src.rate} onChange={e => set(s => { s.costLines.find(x => x.id === line.id).rate = parseFloat(e.target.value) || 0; })} style={{ width: 80 }} />
                        : <span style={{ color: 'var(--muted-2)', fontSize: 11 }}>auto</span>}
                </td>
                <td className="r"><input className="num" value={src.start} onChange={e => set(s => { s.costLines.find(x => x.id === line.id).start = parseInt(e.target.value) || 0; })} style={{ width: 40 }} /></td>
                <td className="r"><input className="num" value={src.end} onChange={e => set(s => { s.costLines.find(x => x.id === line.id).end = parseInt(e.target.value) || 0; })} style={{ width: 40 }} /></td>
                <td className="r num" style={{ color: 'var(--muted)' }}>{line.months}</td>
                <td className="amt">{inpFmt.money(line.amount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

/* ---- Live summary rail ---- */
function SummaryRail({ model }) {
  const r = model.ratios;
  const sev = (v, amber, red, inv) => {
    if (inv) return v > red ? 'red' : (v > amber ? 'amber' : 'ok');
    return v < red ? 'red' : (v < amber ? 'amber' : 'ok');
  };
  return (
    <div className="rail">
      <div className="railcard">
        <div className="rh">Live Appraisal</div>
        <div className="railstat big"><div className="l">GDV</div><div className="v">{inpFmt.money(r.gdv)}</div></div>
        <div className="railstat big"><div className="l">Total Cost</div><div className="v">{inpFmt.money(r.totalCost)}</div></div>
        <div className="railstat big"><div className="l">Profit</div><div className={'v ' + (r.profit > 0 ? 'ok' : 'red')}>{inpFmt.money(r.profit)}</div></div>
      </div>
      <div className="railcard">
        <div className="rh">Key Ratios</div>
        <div className="railstat"><div className="l">Profit % GDV</div><div className={'v ' + sev(r.profitPctGdv, 0.20, 0.15)}>{inpFmt.pct(r.profitPctGdv)}</div></div>
        <div className="railstat"><div className="l">Profit excl. finance</div><div className={'v ' + sev(r.profitExFinance, 0.30, 0.25)}>{inpFmt.pct(r.profitExFinance)}</div></div>
        <div className="railstat"><div className="l">Return on equity</div><div className="v">{r.roe.toFixed(2)}×</div></div>
        <div className="railstat"><div className="l">Peak funding</div><div className="v">{inpFmt.money(r.peakFunding)}</div></div>
        <div className="railstat"><div className="l">Peak loan / cost</div><div className={'v ' + sev(r.peakLoanToCost, 0.70, 0.80, true)}>{inpFmt.pct(r.peakLoanToCost)}</div></div>
      </div>
      <div className="railcard">
        <div className="rh">Flags</div>
        <div className="railstat"><div className="l">Red</div><div className="v red">{model.flags.filter(f => f.sev === 'red').length}</div></div>
        <div className="railstat"><div className="l">Amber</div><div className="v amber">{model.flags.filter(f => f.sev === 'amber').length}</div></div>
      </div>
    </div>
  );
}

function InputScreen({ state, model, set }) {
  const cats = window.Appraisal.CATEGORIES;
  const costLetters = ['F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S'];
  return (
    <div className="inputlayout">
      <div>
        <SiteDetails state={state} model={model} set={set} />
        <Timings state={state} set={set} />
        <ScheduleOfUnits state={state} model={model} set={set} />
        <IncomeByPhase state={state} model={model} set={set} />
        <SalesProgramme state={state} model={model} set={set} />
        <div className="sectiontitle" style={{ margin: '22px 0 13px' }}><h2>Cost Stack</h2><div className="rule"></div></div>
        {cats.map((cat, i) => <CostSection key={cat.id} idx={costLetters[i]} cat={cat} model={model} state={state} set={set} />)}
      </div>
      <SummaryRail model={model} />
    </div>
  );
}

Object.assign(window, { InputScreen });
