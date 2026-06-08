/* App shell — Portfolio ↔ Project routing, DB-backed multi-project store,
   New Project modal (clone from locked template), per-project tabs incl. the
   editable Cashflow table. */
const dashFmt = window.Appraisal;
const DB = window.DB;

function FlagBar({ model }) {
  const red = model.flags.filter(f => f.sev === 'red');
  const amber = model.flags.filter(f => f.sev === 'amber');
  return (
    <div className="flagbar">
      <div className="counts">
        <span className={'fcount ' + (red.length ? 'red' : 'ok')}><span className="dot"></span>{red.length} red</span>
        <span className={'fcount ' + (amber.length ? 'amber' : 'ok')}><span className="dot"></span>{amber.length} amber</span>
      </div>
      <div className="flaglist">
        {model.flags.length === 0
          ? <span className="allok">✓ All validation rules pass</span>
          : model.flags.map((f, i) => (
            <span key={i} className={'flagchip ' + f.sev}><span className="tl"></span><b>{f.rule}</b><span className="det">{f.detail}</span></span>
          ))}
      </div>
    </div>
  );
}

function Dashboard({ state, model }) {
  return (
    <div className="main" data-screen-label="Dashboard">
      <div className="sectiontitle"><h2>Headline Metrics</h2><div className="rule"></div></div>
      <KpiRow model={model} />
      <div className="grid" style={{ gridTemplateColumns: '1.55fr 1fr', marginTop: '22px' }}>
        <div className="card">
          <div className="cardhead"><h3>Cashflow &amp; Peak Funding</h3><span className="sub">{model.cashflow.horizon}-month horizon</span></div>
          <div className="cardbody"><CashflowChart model={model} /></div>
        </div>
        <div className="card">
          <div className="cardhead"><h3>Funding Waterfall</h3><span className="sub">reconcile to £0</span></div>
          <div className="cardbody"><Waterfall model={model} /></div>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '16px' }}>
        <div className="card">
          <div className="cardhead"><h3>Cost Breakdown</h3><span className="sub">{dashFmt.money(model.ratios.totalCost)} total</span></div>
          <div className="cardbody"><Breakdown model={model} /></div>
        </div>
        <div className="card">
          <div className="cardhead"><h3>Active Flags</h3><span className="sub">{model.flags.length} open</span></div>
          <div className="cardbody"><FlagPanel flags={model.flags} /></div>
        </div>
      </div>
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="cardhead"><h3>Sensitivity Analysis</h3><span className="sub">sale price × cost</span></div>
        <div className="cardbody"><Sensitivity model={model} /></div>
      </div>
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="cardhead"><h3>Sales Comparables</h3><span className="sub">{state.comparables.length} evidenced</span></div>
        <div className="cardbody"><Comps state={state} /></div>
      </div>
    </div>
  );
}

function NewProjectModal({ onClose, onCreate }) {
  const [name, setName] = React.useState('');
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>New Appraisal</h3>
          <p>Creates a new project entity cloned from the locked master template. Nothing is shared with existing schemes.</p>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Scheme name</label>
            <input autoFocus value={name} placeholder="e.g. Birch Meadow, Redhill"
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onCreate(name.trim()); }} />
          </div>
          <div className="template-pill">
            <div className="ti"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" /><path d="M5 6h6M5 8.5h6M5 11h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg></div>
            <div><div className="tt">Master Template v1</div><div className="ts">14-category cost scaffold · default rate library</div></div>
            <div className="lock"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="2" y="4.5" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1" /><path d="M3.3 4.5V3.4a1.7 1.7 0 013.4 0v1.1" stroke="currentColor" strokeWidth="1" /></svg>locked</div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!name.trim()} style={{ opacity: name.trim() ? 1 : .5 }} onClick={() => name.trim() && onCreate(name.trim())}>Create scheme</button>
        </div>
      </div>
    </div>
  );
}

function Workspace({ session }) {
  const [projects, setProjects] = React.useState(null); // null = still loading
  const [loadErr, setLoadErr] = React.useState('');
  const [activeId, setActiveId] = React.useState(() => DB.getActive());
  const [tab, setTab] = React.useState(() => localStorage.getItem('appraisal_tab') || 'dashboard');
  const [pres, setPres] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  // collaboration: review drawer + live counters
  const [review, setReview] = React.useState({ open: false, tab: 'history' });
  const [openComments, setOpenComments] = React.useState(0);
  const [collabKey, setCollabKey] = React.useState(0);
  const [showPack, setShowPack] = React.useState(false);
  const [showVersion, setShowVersion] = React.useState(false);
  const [showCompare, setShowCompare] = React.useState(false);
  const email = session.user.email;

  React.useEffect(() => { localStorage.setItem('appraisal_tab', tab); }, [tab]);
  React.useEffect(() => { DB.setActive(activeId); }, [activeId]);

  const loadProjects = React.useCallback(async () => {
    try {
      setLoadErr('');
      await DB.seedIfEmpty();
      const listed = await DB.list();
      setProjects(listed);
    } catch (e) {
      setLoadErr((e && e.message) ? e.message : String(e));
      setProjects([]);
    }
  }, []);
  React.useEffect(() => { loadProjects(); }, [loadProjects]);

  const active = (activeId && projects) ? projects.filter(p => p.id === activeId)[0] : null;
  const model = React.useMemo(() => active ? window.Appraisal.computeModel(active) : null, [active]);

  // record who-changed-what (debounced) and bump the activity panel when it logs
  useAuditCapture(active, email, () => setCollabKey(k => k + 1));

  // keep the open-comment badge fresh when switching scheme / after comment actions
  const refreshCommentCount = React.useCallback(() => {
    if (!activeId) { setOpenComments(0); return; }
    DB.openCommentCount(activeId).then(setOpenComments).catch(() => {});
  }, [activeId]);
  React.useEffect(() => { refreshCommentCount(); }, [refreshCommentCount, collabKey]);

  // mutate active project — optimistic local update, then persist to the database
  const set = React.useCallback(updater => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeId) return p;
      const copy = JSON.parse(JSON.stringify(p));
      updater(copy);
      DB.upsert(copy).catch(e => { console.error('Save failed:', e); setLoadErr('Save failed — check your connection. ' + ((e && e.message) || '')); });
      return copy;
    }));
  }, [activeId]);

  const openProject = id => { setActiveId(id); setTab('dashboard'); window.scrollTo(0, 0); };
  const backToPortfolio = () => { setActiveId(null); setPres(false); window.scrollTo(0, 0); };
  const newProject = async name => {
    setBusy(true);
    try { const p = await DB.create(name); setShowNew(false); await loadProjects(); openProject(p.id); setTab('input'); }
    catch (e) { alert('Could not create scheme: ' + ((e && e.message) || e)); }
    finally { setBusy(false); }
  };
  const cloneProject = async id => {
    setBusy(true);
    try { await DB.clone(id); await loadProjects(); }
    catch (e) { alert('Could not duplicate scheme: ' + ((e && e.message) || e)); }
    finally { setBusy(false); }
  };
  const deleteProject = async id => {
    const p = (projects || []).filter(x => x.id === id)[0];
    if (!confirm('Delete "' + (p ? p.project.name : 'this scheme') + '" for the whole team? This cannot be undone.')) return;
    setBusy(true);
    try { await DB.remove(id); if (activeId === id) backToPortfolio(); await loadProjects(); }
    catch (e) { alert('Could not delete scheme: ' + ((e && e.message) || e)); }
    finally { setBusy(false); }
  };
  const signOut = async () => { try { await window.sb.auth.signOut(); } catch (e) {} };

  // create a labelled version (live editable copy, grouped under the family)
  const createVersion = async (opts) => {
    setBusy(true);
    try {
      const v = await DB.createVersion(activeId, opts);
      setShowVersion(false);
      await loadProjects();
      openProject(v.id);
    } catch (e) { alert('Could not create version: ' + ((e && e.message) || e)); }
    finally { setBusy(false); }
  };

  // restore a snapshot's data as the current scheme (optimistic), then log it
  const restoreSnapshot = async (snap) => {
    if (!snap || !snap.data) return;
    const restored = JSON.parse(JSON.stringify(snap.data));
    restored.id = activeId; // never let a restore change identity
    setProjects(prev => prev.map(p => p.id === activeId ? restored : p));
    try {
      await DB.upsert(restored);
      await DB.logChanges(activeId, email, [{ label: 'Restored snapshot', old: '—', new: snap.label || ('#' + snap.id) }]);
      setCollabKey(k => k + 1);
      setReview(r => ({ ...r, open: false }));
    } catch (e) { alert('Restore failed to save: ' + ((e && e.message) || e)); }
  };
  const openReview = (t) => setReview({ open: true, tab: t || 'history' });

  if (projects === null) return <div className="app"><Splash label="Loading schemes…" /></div>;

  // ---- Portfolio view ----
  if (!active) {
    return (
      <div className="app">
        <div className="topbar">
          <div className="brand"><div className="mark">P</div><div className="title">Phoenix <span style={{ opacity: .6, fontWeight: 400 }}>· Appraisal</span></div></div>
          <div className="ref">PORTFOLIO</div>
          <div className="spacer"></div>
          <a href="Phoenix Hub.html" style={{ display:'inline-flex',alignItems:'center',gap:6,border:'1px solid var(--border)',background:'var(--surface-2)',color:'var(--muted)',fontFamily:'var(--mono)',fontSize:11,padding:'5px 11px',borderRadius:3,textDecoration:'none',marginRight:10 }}>← Hub</a>
          <div className="acct">
            <span className="acct-email" title={session.user.email}>{session.user.email}</span>
            <button className="btn ghost acct-out" onClick={signOut}>Sign out</button>
          </div>
        </div>
        {loadErr ? <div className="dberr">⚠ {loadErr}</div> : null}
        <Portfolio projects={projects} onOpen={openProject} onNew={() => setShowNew(true)} onClone={cloneProject} onDelete={deleteProject} />
        {showNew ? <NewProjectModal onClose={() => setShowNew(false)} onCreate={newProject} /> : null}
      </div>
    );
  }

  // ---- Project view ----
  const r = model.ratios;
  const risk = window.Appraisal.riskScore(model);
  return (
    <div className={'app projview' + (pres ? ' presmode' : '')}>
      <div className="topbar">
        <div className="brand">
          <button className="backbtn" onClick={backToPortfolio} title="Back to portfolio">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="mark">P</div>
          <div className="title">{active.project.name}</div>
        </div>
        <VersionSwitcher active={active} projects={projects}
          onSwitch={openProject} onCreate={() => setShowVersion(true)} onCompare={() => setShowCompare(true)} />
        <div className="ref hide-mobile">{active.project.ref}</div>
        {!pres ? (
          <div className="nav">
            <button className={tab === 'input' ? 'active' : ''} onClick={() => setTab('input')}>Input</button>
            <button className={tab === 'cashflow' ? 'active' : ''} onClick={() => setTab('cashflow')}>Cashflow</button>
            <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>Dashboard</button>
          </div>
        ) : <div style={{ width: 8 }}></div>}
        <div className="spacer"></div>
        <div className="priceblock">
          <div className="pb"><div className="lab">Profit</div><div className="val off">{dashFmt.moneyShort(r.profit)}</div></div>
          <div className="pb"><div className="lab">% GDV</div><div className="val">{dashFmt.pct(r.profitPctGdv)}</div></div>
          <div className="pb"><div className="lab">Risk</div><div className={'val risk-' + risk.sev}>{risk.level}</div></div>
        </div>
        <div className={'toggle hide-mobile' + (pres ? ' on' : '')} onClick={() => setPres(p => !p)} style={{ marginLeft: 10 }}><span className="sw"></span>Presentation</div>
        <button className="reviewbtn" onClick={() => openReview('history')} style={{ marginLeft: 10 }} title="Version history, activity & comments">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 4v4l2.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/></svg>
          <span className="reviewbtn-lbl">Review</span>{openComments > 0 ? <span className="reviewbadge">{openComments}</span> : null}
        </button>
        <button className="reviewbtn" onClick={() => setShowPack(true)} style={{ marginLeft: 10 }} title="Generate lender-facing PDF appraisal pack">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M4 1.5h5l3 3V14a.5.5 0 01-.5.5h-7A.5.5 0 014 14V1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M9 1.5v3h3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M6 8.5h4M6 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          <span className="reviewbtn-lbl">PDF Pack</span>
        </button>
        <a href="Phoenix Hub.html" style={{ display:'inline-flex',alignItems:'center',gap:6,border:'1px solid var(--border)',background:'var(--surface-2)',color:'var(--muted)',fontFamily:'var(--mono)',fontSize:11,padding:'5px 11px',borderRadius:3,textDecoration:'none',marginLeft:10 }}>← Hub</a>
        <button className="btn ghost acct-out hide-mobile" onClick={signOut} style={{ marginLeft: 10 }} title={'Signed in as ' + session.user.email}>Sign out</button>
      </div>

      {loadErr ? <div className="dberr">⚠ {loadErr}</div> : null}

      <ReviewDrawer open={review.open} initialTab={review.tab} onClose={() => setReview(r => ({ ...r, open: false }))}
        project={active} author={email} refreshKey={collabKey}
        onRestore={restoreSnapshot} onChanged={refreshCommentCount} />

      {showPack ? <PrintPack state={active} model={model} author={email} onClose={() => setShowPack(false)} /> : null}
      {showVersion ? <CreateVersionModal source={active} author={email} onClose={() => setShowVersion(false)} onCreate={createVersion} /> : null}
      {showCompare ? <CompareView active={active} projects={projects} onClose={() => setShowCompare(false)} onSwitch={openProject} /> : null}

      {!pres ? <FlagBar model={model} /> : null}

      {!pres ? (
        <nav className="mobile-tabs">
          <button className={tab === 'input' ? 'active' : ''} onClick={() => { setTab('input'); window.scrollTo(0, 0); }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M6.5 7.5h7M6.5 10h7M6.5 12.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <span>Input</span>
          </button>
          <button className={tab === 'cashflow' ? 'active' : ''} onClick={() => { setTab('cashflow'); window.scrollTo(0, 0); }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 14l4-4 3 2 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 17h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <span>Cashflow</span>
          </button>
          <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => { setTab('dashboard'); window.scrollTo(0, 0); }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="11" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>
            <span>Dashboard</span>
          </button>
          <button className="mt-more" onClick={() => setPres(p => !p)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3v14M3 7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><rect x="3" y="3" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.5"/></svg>
            <span>Present</span>
          </button>
        </nav>
      ) : null}

      {pres ? <button className="pres-exit-mobile" onClick={() => setPres(false)}>✕ Exit presentation</button> : null}

      {pres
        ? <Presentation state={active} model={model} />
        : tab === 'input'
          ? <div className="main" data-screen-label="Input"><InputScreen state={active} model={model} set={set} /></div>
          : tab === 'cashflow'
            ? <div className="main" data-screen-label="Cashflow"><CashflowTable state={active} model={model} set={set} /></div>
            : <Dashboard state={active} model={model} />}
    </div>
  );
}

function App() {
  const session = useSession();
  if (session === undefined) return <div className="app"><Splash label="Starting up…" /></div>;
  if (!session) return <AuthScreen />;
  return <Workspace session={session} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
