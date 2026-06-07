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
  const model = React.useMemo(() => window.Appraisal.computeModel(proj), [proj]);
  const risk = window.Appraisal.riskScore(model);
  const r = model.ratios;
  const sc = statusColor(proj.meta && proj.meta.status);
  const units = proj.phases.reduce((a, p) => a + p.units, 0);
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

function Portfolio({ projects, onOpen, onNew, onClone, onDelete }) {
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
        <button className="btn primary lg" onClick={onNew}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 2.5v10M2.5 7.5h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          New Project
        </button>
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
            <div className="newcard-s">Start from the locked master template</div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Portfolio });
