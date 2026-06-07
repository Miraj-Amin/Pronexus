/* ============================================================================
   Versions — live, editable variants of a scheme, grouped as a family.
   Replicate a scheme, label it by audience (Investor / Bank / Owner / …) or as
   an adjusted-assumptions sensitivity, switch between siblings, and compare two.
   Exports: VERSION_TYPES, versionTag, typeMeta, CreateVersionModal,
            VersionSwitcher, CompareView, familyOf.
   ========================================================================== */
const vFmt = window.Appraisal;

const VERSION_TYPES = [
  { id: 'Investor', code: 'INVESTOR', cls: 'v-investor' },
  { id: 'Bank / Valuer', code: 'BANK / VALUER', cls: 'v-bank' },
  { id: 'Owner / Seller', code: 'OWNER / SELLER', cls: 'v-owner' },
  { id: 'Adjusted assumptions', code: 'ADJUSTED', cls: 'v-adj' },
  { id: 'Internal / working', code: 'INTERNAL', cls: 'v-internal' },
  { id: 'Custom', code: 'CUSTOM', cls: 'v-custom' }
];
function typeMeta(type) {
  return VERSION_TYPES.filter(t => t.id === type)[0] || { id: type || 'Custom', code: (type || 'VERSION').toUpperCase(), cls: 'v-custom' };
}
function versionTag(p) {
  if (!p || !p.version) return { code: 'BASE', label: 'Base scheme', cls: 'v-base', isBase: true };
  const m = typeMeta(p.version.type);
  return { code: m.code, label: p.version.label || m.id, cls: m.cls, isBase: false };
}
function familyOf(active, projects) {
  const fid = DB.familyId(active);
  const sibs = projects.filter(p => DB.familyId(p) === fid);
  sibs.sort((a, b) => {
    if (a.id === fid) return -1; if (b.id === fid) return 1;
    return ((a.version && a.version.createdAt) || '').localeCompare((b.version && b.version.createdAt) || '');
  });
  return { fid: fid, siblings: sibs };
}

/* ---------- Create version modal ---------- */
function CreateVersionModal({ source, author, onClose, onCreate }) {
  const [type, setType] = React.useState('Investor');
  const [label, setLabel] = React.useState('Investor version');
  const [adj, setAdj] = React.useState({ interestPts: '', buildPct: '', salesPct: '', purchasePct: '', lengthMonths: '' });
  const isAdj = type === 'Adjusted assumptions';

  const pickType = (t) => {
    setType(t);
    const defaults = { 'Investor': 'Investor version', 'Bank / Valuer': 'Bank / valuer version', 'Owner / Seller': 'Owner / seller version', 'Adjusted assumptions': 'Adjusted — ', 'Internal / working': 'Internal working', 'Custom': '' };
    setLabel(defaults[t] !== undefined ? defaults[t] : '');
  };
  const setA = (k, v) => setAdj(a => Object.assign({}, a, { [k]: v }));

  // live preview of the resulting interest rate
  const baseRate = (source.assumptions.base_rate + source.assumptions.margin) * 100;
  const newRate = baseRate + (parseFloat(adj.interestPts) || 0);

  const num = (v) => v === '' ? 0 : parseFloat(v) || 0;
  const submit = () => {
    const cleanAdj = isAdj ? {
      interestPts: num(adj.interestPts), buildPct: num(adj.buildPct), salesPct: num(adj.salesPct),
      purchasePct: num(adj.purchasePct), lengthMonths: num(adj.lengthMonths)
    } : null;
    onCreate({ type: type, label: (label.trim() || typeMeta(type).id), author: author, adjust: cleanAdj });
  };

  const Lever = ({ k, label, unit, hint }) => (
    <div className="vl">
      <div className="vl-l">{label}<span>{hint}</span></div>
      <div className="vl-in">
        <button onClick={() => setA(k, String((num(adj[k]) - (k === 'lengthMonths' ? 1 : 1)).toFixed(k === 'lengthMonths' ? 0 : 1)))}>−</button>
        <input type="number" value={adj[k]} placeholder="0" onChange={e => setA(k, e.target.value)} />
        <span className="vl-u">{unit}</span>
        <button onClick={() => setA(k, String((num(adj[k]) + 1).toFixed(k === 'lengthMonths' ? 0 : 1)))}>+</button>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal vmodal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Create a version</h3>
          <p>Replicates <b>{source.project.name}</b> as a full, live, editable copy — grouped under the same scheme so you can recall it.</p>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Version is for…</label>
            <div className="vtype-grid">
              {VERSION_TYPES.map(t => (
                <button key={t.id} className={'vtype ' + t.cls + (type === t.id ? ' on' : '')} onClick={() => pickType(t.id)}>
                  <span className="vtype-dot"></span>{t.id}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Label (how it shows in the switcher)</label>
            <input autoFocus value={label} placeholder="e.g. Bank version — stressed" onChange={e => setLabel(e.target.value)} />
          </div>

          {isAdj ? (
            <div className="vlevers">
              <div className="vlevers-h">Adjust the levers <span>applied to the copy on creation — leave 0 to keep as-is</span></div>
              <Lever k="interestPts" label="Interest rate" unit="pts" hint="+/− points" />
              <Lever k="buildPct" label="Construction price" unit="%" hint="build £psf" />
              <Lever k="salesPct" label="Sales values" unit="%" hint="sale £psf" />
              <Lever k="purchasePct" label="Purchase price" unit="%" hint="offer" />
              <Lever k="lengthMonths" label="Project length" unit="mo" hint="+/− months" />
              <div className="vl-preview">
                Interest rate {baseRate.toFixed(2)}% → <b>{newRate.toFixed(2)}%</b>
                {num(adj.buildPct) ? ' · build ' + (num(adj.buildPct) > 0 ? '+' : '') + num(adj.buildPct) + '%' : ''}
                {num(adj.salesPct) ? ' · sales ' + (num(adj.salesPct) > 0 ? '+' : '') + num(adj.salesPct) + '%' : ''}
                {num(adj.purchasePct) ? ' · purchase ' + (num(adj.purchasePct) > 0 ? '+' : '') + num(adj.purchasePct) + '%' : ''}
                {num(adj.lengthMonths) ? ' · length ' + (num(adj.lengthMonths) > 0 ? '+' : '') + num(adj.lengthMonths) + 'mo' : ''}
              </div>
            </div>
          ) : null}
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit}>Create version</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Version switcher (project header) ---------- */
function VersionSwitcher({ active, projects, onSwitch, onCreate, onCompare }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const { siblings } = familyOf(active, projects);
  const tag = versionTag(active);
  const count = siblings.length;

  return (
    <div className="vswitch" ref={ref}>
      <button className={'vswitch-btn ' + tag.cls} onClick={() => setOpen(o => !o)} title="Switch / create versions">
        <span className="vswitch-dot"></span>
        <span className="vswitch-lbl">{tag.label}</span>
        {count > 1 ? <span className="vswitch-count">{count}</span> : null}
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5l3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open ? (
        <div className="vswitch-menu">
          <div className="vswitch-menu-h">Versions of this scheme</div>
          {siblings.map(s => {
            const st = versionTag(s);
            return (
              <button key={s.id} className={'vswitch-item' + (s.id === active.id ? ' on' : '')} onClick={() => { setOpen(false); if (s.id !== active.id) onSwitch(s.id); }}>
                <span className={'vchip ' + st.cls}>{st.code}</span>
                <span className="vswitch-item-lbl">{st.label}</span>
                {s.id === active.id ? <span className="vswitch-here">current</span> : null}
              </button>
            );
          })}
          <div className="vswitch-menu-actions">
            <button onClick={() => { setOpen(false); onCreate(); }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              Create version
            </button>
            {count > 1 ? (
              <button onClick={() => { setOpen(false); onCompare(); }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="2" y="2.5" width="4" height="9" rx="1" stroke="currentColor" strokeWidth="1.3" /><rect x="8" y="2.5" width="4" height="9" rx="1" stroke="currentColor" strokeWidth="1.3" /></svg>
                Compare
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Compare two versions ---------- */
function metricsOf(p) {
  const m = vFmt.computeModel(p);
  const r = m.ratios;
  const risk = vFmt.riskScore(m);
  const avg = (arr, key, wkey) => { let s = 0, w = 0; arr.forEach(x => { if (x[wkey] > 0) { s += x[key] * x[wkey]; w += x[wkey]; } }); return w ? s / w : 0; };
  return {
    rows: [
      { l: 'GDV', v: vFmt.moneyShort(r.gdv), raw: r.gdv, money: true },
      { l: 'Total cost', v: vFmt.moneyShort(r.totalCost), raw: r.totalCost, money: true },
      { l: 'Project profit', v: vFmt.moneyShort(r.profit), raw: r.profit, money: true },
      { l: 'Profit % GDV', v: vFmt.pct(r.profitPctGdv), raw: r.profitPctGdv, pct: true },
      { l: 'Profit excl. finance', v: vFmt.pct(r.profitExFinance), raw: r.profitExFinance, pct: true },
      { l: 'Peak funding', v: vFmt.moneyShort(r.peakFunding), raw: r.peakFunding, money: true },
      { l: 'Interest rate', v: vFmt.pct(p.assumptions.base_rate + p.assumptions.margin), raw: p.assumptions.base_rate + p.assumptions.margin, pct: true },
      { l: 'Offer price', v: vFmt.moneyShort(p.project.offerPrice || 0), raw: p.project.offerPrice || 0, money: true },
      { l: 'Programme', v: (p.project.projectLengthMonths || 0) + ' mo', raw: p.project.projectLengthMonths || 0 },
      { l: 'Avg build £psf', v: '£' + Math.round(avg(p.phases, 'buildRatePsf', 'netAreaSqft')), raw: avg(p.phases, 'buildRatePsf', 'netAreaSqft') },
      { l: 'Avg sale £psf', v: '£' + Math.round(avg(p.phases, 'salePsf', 'netAreaSqft')), raw: avg(p.phases, 'salePsf', 'netAreaSqft') },
      { l: 'Risk', v: risk.level, raw: risk.score, risk: risk.sev }
    ]
  };
}
function CompareView({ active, projects, onClose, onSwitch }) {
  const { siblings } = familyOf(active, projects);
  const [leftId, setLeftId] = React.useState(active.id);
  const [rightId, setRightId] = React.useState((siblings.filter(s => s.id !== active.id)[0] || active).id);
  const left = siblings.filter(s => s.id === leftId)[0] || active;
  const right = siblings.filter(s => s.id === rightId)[0] || active;
  const ml = metricsOf(left), mr = metricsOf(right);
  const lt = versionTag(left), rt = versionTag(right);

  const Picker = ({ value, onChange, exclude }) => (
    <select value={value} onChange={e => onChange(e.target.value)}>
      {siblings.map(s => { const t = versionTag(s); return <option key={s.id} value={s.id}>{t.label}</option>; })}
    </select>
  );

  const delta = (a, b, row) => {
    if (a === b) return null;
    const up = b > a;
    let txt;
    if (row.money) txt = (up ? '+' : '−') + vFmt.moneyShort(Math.abs(b - a)).replace('£', '£');
    else if (row.pct) txt = (up ? '+' : '−') + (Math.abs(b - a) * 100).toFixed(1) + 'pp';
    else txt = (up ? '+' : '−') + Math.round(Math.abs(b - a)).toLocaleString();
    return <span className={'cmp-d ' + (up ? 'up' : 'dn')}>{txt}</span>;
  };

  return (
    <div className="cmp-overlay" onClick={onClose}>
      <div className="cmp-panel" onClick={e => e.stopPropagation()}>
        <div className="cmp-head">
          <div className="cmp-title">Compare versions<span>{active.project.name}</span></div>
          <button className="rev-x" onClick={onClose}><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg></button>
        </div>
        <div className="cmp-cols">
          <div className={'cmp-col-h ' + lt.cls}><span className="vchip">{lt.code}</span><Picker value={leftId} onChange={setLeftId} /></div>
          <div className="cmp-col-mid"></div>
          <div className={'cmp-col-h ' + rt.cls}><span className="vchip">{rt.code}</span><Picker value={rightId} onChange={setRightId} /></div>
        </div>
        <div className="cmp-rows">
          {ml.rows.map((row, i) => {
            const rr = mr.rows[i];
            return (
              <div className="cmp-row" key={i}>
                <div className={'cmp-v left' + (row.risk ? ' risk-' + row.risk : '')}>{row.v}</div>
                <div className="cmp-l">{row.l}{delta(row.raw, rr.raw, row)}</div>
                <div className={'cmp-v right' + (rr.risk ? ' risk-' + rr.risk : '')}>{rr.v}</div>
              </div>
            );
          })}
        </div>
        <div className="cmp-foot">
          <button className="btn ghost" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={() => { onSwitch(rightId); onClose(); }}>Open {rt.label}</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { VERSION_TYPES, versionTag, typeMeta, familyOf, CreateVersionModal, VersionSwitcher, CompareView });
