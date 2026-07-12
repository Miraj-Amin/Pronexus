/* Portfolio screen — project entities with risk traffic-lights, KPIs,
   New Project (from blank template), open / duplicate / delete. */
const pfFmt = window.Appraisal;

function RiskGauge({ risk }) {
  const r = 18, c = 2 * Math.PI * r;
  const dash = c * (risk.score / 100);
  const col = risk.sev === 'red' ? 'var(--red)' : risk.sev === 'amber' ? 'var(--amber)' : 'var(--green-600)';
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="5" />
      <circle cx="24" cy="24" r={r} fill="none" stroke={col} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={dash + ' ' + c} transform="rotate(-90 24 24)" />
      <text x="24" y="27" textAnchor="middle" fontFamily="var(--mono)" fontSize="12" fontWeight="600" fill={col}>{risk.score}</text>
    </svg>
  );
}

function statusColor(status) {
  switch (status) {
    case 'Approved': return { bg: 'var(--ok-bg)', fg: 'var(--ok)' };
    case 'In Appraisal': return { bg: 'rgba(99,102,241,.18)', fg: '#b5acff' };
    case 'Draft': return { bg: 'var(--surface-3)', fg: 'var(--muted)' };
    default: return { bg: 'var(--surface-3)', fg: 'var(--muted)' };
  }
}

function ProjectCard({ proj, onOpen, onClone, onDelete, versions }) {
  // Guard against a corrupt row missing project/phases — one bad entry
  // shouldn't take down the whole portfolio.
  if (!proj || !proj.project) return null;
  const model = React.useMemo(() => window.Appraisal.computeModel(proj), [proj]);
  const risk = window.Appraisal.riskScore(model);
  const r = model.ratios;
  const sc = statusColor(proj.meta && proj.meta.status);
  const units = (proj.phases || []).reduce((a, p) => a + (p.units || 0), 0);
  const vers = versions || [];
  const [open, setOpen] = React.useState(false);
  return (
    <div className={'pcard risk-' + risk.sev} onClick={() => onOpen(proj.id)}>
      <div className="pcard-top">
        <div className="pcard-id">
          <div className="pcard-name">{proj.project.name}</div>
          <div className="pcard-addr">{proj.project.address || 'No address set'}</div>
        </div>
        <RiskGauge risk={risk} />
      </div>
      <div className="pcard-meta">
        <span className="pchip" style={{ background: sc.bg, color: sc.fg }}>{(proj.meta && proj.meta.status) || 'Draft'}</span>
        <span className="pchip ghost num">{units} units</span>
        {vers.length ? <span className="pchip ghost">{vers.length + 1} versions</span> : <span className="pchip ghost mono">{proj.project.ref}</span>}
      </div>
      <div className="pcard-kpis">
        <div className="pk"><div className="pk-l">GDV</div><div className="pk-v">{pfFmt.moneyShort(r.gdv)}</div></div>
        <div className="pk"><div className="pk-l">Profit</div><div className="pk-v" style={{ color: r.profit > 0 ? 'var(--ink)' : 'var(--red)' }}>{pfFmt.moneyShort(r.profit)}</div></div>
        <div className="pk"><div className="pk-l">% GDV</div><div className="pk-v">{pfFmt.pct(r.profitPctGdv, 0)}</div></div>
        <div className="pk"><div className="pk-l">Peak Debt</div><div className="pk-v">{pfFmt.moneyShort(r.peakFunding)}</div></div>
      </div>
      <div className="pcard-foot">
        <div className={'risk-badge ' + risk.sev}>
          <span className="tl"></span>{risk.level} risk
          <span className="rcount">{risk.reds > 0 ? risk.reds + ' red' : ''}{risk.reds > 0 && risk.ambers > 0 ? ' · ' : ''}{risk.ambers > 0 ? risk.ambers + ' amber' : ''}{risk.reds === 0 && risk.ambers === 0 ? 'all clear' : ''}</span>
        </div>
        <div className="pcard-actions">
          <button className="iconbtn" title="Duplicate" onClick={e => { e.stopPropagation(); onClone(proj.id); }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3.5" y="3.5" width="7" height="7" rx="1.3" stroke="currentColor" strokeWidth="1.3" /><path d="M2 8.5V2.5A1 1 0 013 1.5h6" stroke="currentColor" strokeWidth="1.3" /></svg>
          </button>
          <button className="iconbtn danger" title="Delete" onClick={e => { e.stopPropagation(); onDelete(proj.id); }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 3.5h9M5 3.5V2.3A.8.8 0 015.8 1.5h2.4a.8.8 0 01.8.8v1.2M3.5 3.5l.5 8a1 1 0 001 .9h4a1 1 0 001-.9l.5-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>
      {vers.length ? (
        <div className="pcard-vers" onClick={e => e.stopPropagation()}>
          <button className="pcard-vers-h" onClick={() => setOpen(o => !o)}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}><path d="M4.5 3L7.5 6l-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {vers.length} linked version{vers.length > 1 ? 's' : ''}
          </button>
          {open ? (
            <div className="pcard-vers-list">
              {vers.map(v => {
                const t = window.versionTag(v);
                const vm = window.Appraisal.computeModel(v);
                return (
                  <button key={v.id} className="pcard-vrow" onClick={() => onOpen(v.id)}>
                    <span className={'vchip ' + t.cls}>{t.code}</span>
                    <span className="pcard-vrow-lbl">{t.label}</span>
                    <span className="pcard-vrow-m">{pfFmt.moneyShort(vm.ratios.profit)}</span>
                    <span className="pcard-vrow-del" title="Delete version" onClick={e => { e.stopPropagation(); onDelete(v.id); }}>×</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Portfolio({ projects, onOpen, onNew, onImport, onClone, onDelete }) {
  // group versions under their base scheme: a scheme is a "head" when it has no
  // version parent (or points at itself); everything else is a linked version.
  const heads = projects.filter(p => DB.familyId(p) === p.id);
  const versionsOf = (headId) => projects.filter(p => p.id !== headId && DB.familyId(p) === headId);

  // portfolio rollup — heads only, so linked versions don't double-count
  const models = heads.map(p => ({ p, m: window.Appraisal.computeModel(p), risk: null }));
  models.forEach(x => x.risk = window.Appraisal.riskScore(x.m));
  const totalGdv = models.reduce((a, x) => a + x.m.ratios.gdv, 0);
  const totalProfit = models.reduce((a, x) => a + x.m.ratios.profit, 0);
  const totalPeak = models.reduce((a, x) => a + x.m.ratios.peakFunding, 0);
  const counts = { red: 0, amber: 0, ok: 0 };
  models.forEach(x => { counts[x.risk.sev] = (counts[x.risk.sev] || 0) + 1; });

  return (
    <div className="main" data-screen-label="Portfolio">
      <div className="pf-head">
        <div>
          <h1 className="pf-title">Portfolio</h1>
          <div className="pf-sub">{heads.length} schemes · {pfFmt.moneyShort(totalGdv)} GDV under appraisal</div>
        </div>
        <div style={{ display: 'flex', gap: 9 }}>
          <button className="btn ghost lg" onClick={onImport}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 1.5v7.2M4.3 5.9l3.2 3 3.2-3M2.5 11v1.5A1 1 0 003.5 13.5h8a1 1 0 001-1V11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Import from Excel
          </button>
          <button className="btn primary lg" onClick={onNew}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 2.5v10M2.5 7.5h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            New Project
          </button>
        </div>
      </div>

      <div className="pf-rollup">
        <div className="ru"><div className="ru-l">Total GDV</div><div className="ru-v">{pfFmt.moneyShort(totalGdv)}</div></div>
        <div className="ru"><div className="ru-l">Aggregate Profit</div><div className="ru-v">{pfFmt.moneyShort(totalProfit)}</div></div>
        <div className="ru"><div className="ru-l">Peak Capital at Risk</div><div className="ru-v">{pfFmt.moneyShort(totalPeak)}</div></div>
        <div className="ru risk-split">
          <div className="ru-l">Risk Profile</div>
          <div className="risk-bars">
            <span className="rb ok" style={{ flex: counts.ok || 0.0001 }} title={counts.ok + ' low'}></span>
            <span className="rb amber" style={{ flex: counts.amber || 0.0001 }} title={counts.amber + ' elevated'}></span>
            <span className="rb red" style={{ flex: counts.red || 0.0001 }} title={counts.red + ' high'}></span>
          </div>
          <div className="risk-legend">
            <span><i className="d ok"></i>{counts.ok} low</span>
            <span><i className="d amber"></i>{counts.amber} elevated</span>
            <span><i className="d red"></i>{counts.red} high</span>
          </div>
        </div>
      </div>

      <div className="sectiontitle"><h2>Schemes</h2><div className="rule"></div></div>
      <div className="pcard-grid">
        {heads.map(p => <ProjectCard key={p.id} proj={p} versions={versionsOf(p.id)} onOpen={onOpen} onClone={onClone} onDelete={onDelete} />)}
        <div className="pcard newcard" onClick={onNew}>
          <div className="newcard-inner">
            <div className="newcard-plus"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 4v14M4 11h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></div>
            <div className="newcard-t">New Appraisal</div>
            <div className="newcard-s">Start from the locked master template, or <a onClick={e => { e.stopPropagation(); onImport(); }} style={{ color: 'var(--green-500)', cursor: 'pointer' }}>import an Excel workbook</a></div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Portfolio });
/* ---- Import from Excel modal ---- */
function ImportModal({ onClose, onImport }) {
  const [file, setFile] = React.useState(null);
  const [name, setName] = React.useState('');
  const [state, setState] = React.useState('idle'); // idle | parsing | ready | error | saving
  const [preview, setPreview] = React.useState(null);
  const [warnings, setWarnings] = React.useState([]);
  const [err, setErr] = React.useState('');
  const [dragOver, setDragOver] = React.useState(false);
  const fmt = window.Appraisal;

  const parse = async (f, schemeName) => {
    setState('parsing'); setErr('');
    try {
      const result = await window.AppraisalImport.importFromFile(f, schemeName || undefined);
      setPreview(result.project);
      setWarnings(result.warnings || []);
      setName(result.project.project.name);
      setState('ready');
    } catch (e) {
      setErr((e && e.message) || String(e));
      setState('error');
    }
  };

  const pickFile = f => {
    if (!f) return;
    if (!/\.xlsx?$/i.test(f.name)) { setErr('Please choose an .xlsx workbook.'); setState('error'); return; }
    setFile(f);
    parse(f);
  };

  // Compute the preview model defensively — a failure here must NOT throw during
  // render (that would unmount the whole app / white-screen the page). Instead we
  // fall back to no preview and surface the message.
  let model = null;
  let modelErr = '';
  if (preview) {
    try { model = fmt.computeModel(preview); }
    catch (e) { modelErr = (e && e.message) || String(e); model = null; }
  }
  const previewPhases = (preview && Array.isArray(preview.phases)) ? preview.phases : [];
  const previewUnits = previewPhases.reduce((a, x) => a + (x && x.units || 0), 0);
  const previewProject = (preview && preview.project) || {};

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Import from Excel</h3>
          <p>Upload a North Gate–template appraisal workbook (.xlsx). Site details, phases, the unit schedule and the full cost stack are read straight off the Input, Summary &amp; Schedule of Units sheets.</p>
        </div>
        <div className="modal-body">
          {!file ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files && e.dataTransfer.files[0]); }}
              onClick={() => document.getElementById('xlsx-file-input').click()}
              style={{
                border: '1.5px dashed ' + (dragOver ? 'var(--green-500)' : 'var(--border-strong)'),
                borderRadius: 8, padding: '30px 16px', textAlign: 'center', cursor: 'pointer',
                background: dragOver ? 'rgba(45,212,255,.06)' : 'var(--surface-2)'
              }}>
              <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, marginBottom: 4 }}>Drop workbook here, or click to browse</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>.xlsx only</div>
              <input id="xlsx-file-input" type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                onChange={e => pickFile(e.target.files && e.target.files[0])} />
            </div>
          ) : (
            <div>
              <div className="template-pill" style={{ marginBottom: 14 }}>
                <div className="ti"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" /><path d="M6 9l1.3 1.6L9.5 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
                <div style={{ overflow: 'hidden' }}>
                  <div className="tt" style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{file.name}</div>
                  <div className="ts">{(file.size / 1024).toFixed(0)} KB</div>
                </div>
                <button className="btn ghost" style={{ marginLeft: 'auto', padding: '4px 9px' }}
                  onClick={() => { setFile(null); setPreview(null); setState('idle'); setErr(''); }}>Change</button>
              </div>

              {state === 'parsing' ? <div style={{ fontSize: 12, color: 'var(--muted)', padding: '10px 0' }}>Reading workbook…</div> : null}

              {state === 'error' ? (
                <div className="reconcile bad" style={{ marginTop: 0 }}><span>⚠</span> {err}</div>
              ) : null}

              {state === 'ready' && preview ? (
                <div>
                  <div className="field">
                    <label>Scheme name</label>
                    <input autoFocus value={name} onChange={e => setName(e.target.value)} />
                  </div>
                  {model ? (
                    <div className="fieldrow" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      <div><div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>GDV</div><div className="derived">{fmt.money(model.ratios.gdv)}</div></div>
                      <div><div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Units</div><div className="derived">{previewUnits}</div></div>
                      <div><div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Profit</div><div className="derived" style={{ color: model.ratios.profit > 0 ? 'var(--green-700)' : 'var(--red-600, #d33)' }}>{fmt.money(model.ratios.profit)}</div></div>
                    </div>
                  ) : (
                    <div className="reconcile bad" style={{ marginTop: 10 }}><span>⚠</span> Preview figures couldn't be calculated{modelErr ? ' (' + modelErr + ')' : ''}, but you can still import the scheme and review it in the app.</div>
                  )}
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 10 }}>{previewProject.address || 'No address found'}{previewProject.planningRef ? ' · ' + previewProject.planningRef : ''}</div>
                  {model && model.flags && model.flags.length ? (
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>{model.flags.length} validation flag{model.flags.length === 1 ? '' : 's'} will show once imported — same as any other scheme.</div>
                  ) : null}
                  {warnings.length ? (
                    <div className="reconcile bad" style={{ marginTop: 10 }}><span>⚠</span> {warnings.join(' ')}</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={state !== 'ready' || !name.trim() || !preview}
            style={{ opacity: (state === 'ready' && name.trim() && preview) ? 1 : .5 }}
            onClick={() => { if (!preview) return; if (!preview.project) preview.project = {}; preview.project.name = name.trim(); onImport(preview); }}>
            Import scheme
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ImportModal });
