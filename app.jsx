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
  const [showGenerate, setShowGenerate] = React.useState(false);
  const [showMenu, setShowMenu] = React.useState(false);
  // CRM — client accounts + which top-level view is showing when no project is open
  const [accounts, setAccounts] = React.useState([]);
  const [view, setView] = React.useState(() => {
    try { const u = new URLSearchParams(location.search).get('view'); if (u === 'crm' || u === 'portfolio') return u; } catch (e) {}
    return localStorage.getItem('phx_view') || 'portfolio';
  });
  const email = session.user.email;

  React.useEffect(() => { localStorage.setItem('phx_view', view); }, [view]);

  React.useEffect(() => { localStorage.setItem('appraisal_tab', tab); }, [tab]);
  React.useEffect(() => { DB.setActive(activeId); }, [activeId]);

  const loadProjects = React.useCallback(async () => {
    try {
      setLoadErr('');
      await DB.seedIfEmpty();
      const listed = await DB.list();
      setProjects(listed);
      return listed;
    } catch (e) {
      setLoadErr((e && e.message) ? e.message : String(e));
      setProjects([]);
      return [];
    }
  }, []);
  const loadAccounts = React.useCallback(async () => {
    try {
      await DB.seedAccountsIfEmpty();
      const list = await DB.listAccounts();
      setAccounts(list);
    } catch (e) {
      // accounts table may not exist yet — CRM still renders empty, appraisal unaffected
      console.warn('[Phoenix CRM] account load skipped:', (e && e.message) || e);
      setAccounts([]);
    }
  }, []);
  // boot in order: seed/list projects, then seed accounts (which auto-links jobs
  // by client reference), then re-list projects so the new links are visible.
  React.useEffect(() => { (async () => {
    await loadProjects();
    await loadAccounts();
    await loadProjects();
  })(); }, [loadProjects, loadAccounts]);

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

  // mutate any project by id (used by the CRM to link jobs / set pipeline stage)
  const setProject = React.useCallback((id, updater) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== id) return p;
      const copy = JSON.parse(JSON.stringify(p));
      updater(copy);
      DB.upsert(copy).catch(e => { console.error('Save failed:', e); setLoadErr('Save failed — ' + ((e && e.message) || '')); });
      return copy;
    }));
  }, []);
  const assignJob = React.useCallback((projectId, accountId) => {
    setProject(projectId, p => { p.accountId = accountId || null; });
  }, [setProject]);
  const setJobStage = React.useCallback((projectId, stage) => {
    setProject(projectId, p => { p.meta = p.meta || {}; p.meta.stage = stage; });
  }, [setProject]);

  // ---- CRM account CRUD (optimistic, then persist) ----
  const createAccount = React.useCallback(async (fields) => {
    try { const a = await DB.createAccount(fields); setAccounts(prev => [a, ...prev]); return a; }
    catch (e) { alert('Could not create account: ' + ((e && e.message) || e)); return null; }
  }, []);
  const saveAccount = React.useCallback((account) => {
    setAccounts(prev => {
      const exists = prev.some(a => a.id === account.id);
      return exists ? prev.map(a => a.id === account.id ? account : a) : [account, ...prev];
    });
    DB.upsertAccount(JSON.parse(JSON.stringify(account))).catch(e => { console.error(e); setLoadErr('Account save failed — ' + ((e && e.message) || '')); });
  }, []);
  const deleteAccount = React.useCallback(async (id) => {
    // unassign any linked jobs, then drop the account
    setProjects(prev => prev.map(p => {
      if (p.accountId !== id) return p;
      const copy = JSON.parse(JSON.stringify(p)); copy.accountId = null;
      DB.upsert(copy).catch(() => {});
      return copy;
    }));
    setAccounts(prev => prev.filter(a => a.id !== id));
    try { await DB.removeAccount(id); } catch (e) { alert('Could not delete account: ' + ((e && e.message) || e)); }
  }, []);
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

  // ---- Generate documents from live project data ----
  function exportData(state, mdl) {
    const r = mdl.ratios, bc = mdl.byCat;
    const fmm = n => n ? (n / 1e6).toFixed(3) : '';
    const fmp = n => n ? (n * 100).toFixed(1) : '';
    const totalUnits = state.phases.reduce((s, p) => s + (p.units || 0), 0);
    const netArea = Math.round(state.phases.reduce((s, p) => s + (p.netAreaSqft || 0), 0));
    const cat = id => (bc[id] && bc[id].total) || 0;
    return {
      name: state.project.name || '',
      address: state.project.address || '',
      lpa: state.project.borough || '',
      planningRef: state.project.planningRef || '',
      ref: state.project.clientRef || state.project.ref || '',
      units: String(totalUnits || ''),
      netArea: String(netArea || ''),
      programme: String(state.project.projectLengthMonths || ''),
      offerPrice: String(state.project.offerPrice || ''),
      date: new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      gdv: fmm(r.gdv),
      land: fmm(cat(1)),
      landAcq: fmm(cat(2)),
      localAuth: fmm(cat(3)),
      profFees: fmm(cat(4) + cat(7) + cat(8) + cat(9)),
      demolition: fmm(cat(5)),
      build: fmm(cat(6)),
      contingency: fmm(cat(10)),
      sales: fmm(cat(11) + cat(12) + cat(13)),
      salesMkt: fmm(cat(11) + cat(12) + cat(13)),
      finance: fmm(cat(14)),
      totalCost: fmm(r.totalCost),
      profit: fmm(r.profit),
      profitPctGdv: fmp(r.profitPctGdv),
      profitExFin: fmp(r.profitExFinance),
      peakFunding: fmm(r.peakFunding),
      peakMonth: String(r.peakMonth || ''),
      ltv: fmp(r.peakLoanToGdv),
      ltc: fmp(r.peakLoanToCost),
      // deal memo specific
      landCost: fmm(cat(1)),
      acqCosts: fmm(cat(2)),
      ciilS106: fmm(cat(3)),
    };
  }

  function generateDoc(type) {
    if (!active || !model) return;
    const d = exportData(active, model);
    const docs = {
      pitch:  { key: 'phx_pitch',  url: 'Investor Pitch Deck.html' },
      report: { key: 'phx_report', url: 'Client Report.html' },
      memo:   { key: 'phx_memo',   url: 'Deal Memo.html' },
      update: { key: 'phx_update', url: 'Project Update Deck.html' },
    };
    const doc = docs[type]; if (!doc) return;
    localStorage.setItem(doc.key, JSON.stringify(d));
    window.open(doc.url, '_blank');
    setShowGenerate(false);
  }

  if (projects === null) return <div className="app"><Splash label="Loading schemes…" /></div>;

  // ---- CRM view (no project open) ----
  if (!active && view === 'crm') {
    return (
      <window.CRMApp
        accounts={accounts} projects={projects} session={session}
        onBackToPortfolio={() => setView('portfolio')}
        onSignOut={signOut}
        onOpenJob={(id) => openProject(id)}
        createAccount={createAccount} saveAccount={saveAccount} deleteAccount={deleteAccount}
        assignJob={assignJob} setJobStage={setJobStage}
      />
    );
  }

  // ---- Portfolio view ----
  if (!active) {
    return (
      <div className="app">
        <div className="topbar">
          <div className="brand"><div className="mark">P</div><div className="title">Phoenix <span style={{ opacity: .6, fontWeight: 400 }}>· Appraisal</span></div></div>
          <div className="ref">PORTFOLIO</div>
          <div className="spacer"></div>
          <button onClick={() => setView('crm')} style={{ display:'inline-flex',alignItems:'center',gap:6,border:'1px solid var(--paper-border)',background:'var(--paper)',color:'#46586a',fontFamily:'var(--mono)',fontSize:11,fontWeight:600,letterSpacing:'.4px',textTransform:'uppercase',padding:'6px 12px',borderRadius:5,cursor:'pointer',marginRight:10 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 8a3 3 0 100-6 3 3 0 000 6zM2.5 14a5.5 5.5 0 0111 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            Clients
          </button>
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
        <button className="reviewbtn" onClick={() => setShowMenu(m => !m)} style={{ marginLeft: 10 }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 3.5h12M2 8h12M2 12.5h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          <span className="reviewbtn-lbl">Menu</span>{openComments > 0 ? <span className="reviewbadge">{openComments}</span> : null}
        </button>
      </div>

      {loadErr ? <div className="dberr">⚠ {loadErr}</div> : null}

      {/* Menu backdrop */}
      {showMenu && <div onClick={() => setShowMenu(false)} style={{position:'fixed',inset:0,zIndex:198,background:'rgba(0,0,0,.45)'}} />}

      {/* Slide-out menu */}
      <div style={{position:'fixed',right:0,top:0,bottom:0,width:290,background:'var(--surface)',borderLeft:'1px solid var(--border-strong)',zIndex:199,transform:showMenu?'translateX(0)':'translateX(110%)',transition:'transform .25s ease',display:'flex',flexDirection:'column',boxShadow:'-8px 0 40px rgba(0,0,0,.5)'}}>
        <div style={{padding:'14px 18px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{fontFamily:'var(--mono)',fontWeight:700,letterSpacing:'3px',fontSize:13,color:'var(--ink)'}}>PHOENIX</div>
          <button onClick={() => setShowMenu(false)} style={{width:28,height:28,display:'grid',placeItems:'center',border:'1px solid var(--border)',borderRadius:4,background:'var(--surface-2)',color:'var(--muted)',cursor:'pointer',fontSize:18,lineHeight:1}}>×</button>
        </div>
        <div style={{padding:'14px 18px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
          <div style={{fontFamily:'var(--mono)',fontSize:9,textTransform:'uppercase',letterSpacing:'1.2px',color:'var(--muted)',marginBottom:8}}>Version</div>
          <VersionSwitcher active={active} projects={projects} onSwitch={id=>{openProject(id);setShowMenu(false);}} onCreate={()=>{setShowMenu(false);setShowVersion(true);}} onCompare={()=>{setShowMenu(false);setShowCompare(true);}} />
          <div style={{fontFamily:'var(--mono)',fontSize:9.5,color:'var(--muted)',marginTop:8,wordBreak:'break-all'}}>{active.project.ref}</div>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'4px 0'}}>
          {[['Review','History, comments & activity',()=>{openReview('history');setShowMenu(false);}],['PDF Pack','Lender-facing appraisal report',()=>{setShowPack(true);setShowMenu(false);}]].map(([label,sub,action])=>(
            <button key={label} onClick={action} style={{display:'block',width:'100%',padding:'12px 18px',background:'none',border:'none',borderBottom:'1px solid var(--border)',textAlign:'left',cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'} onMouseLeave={e=>e.currentTarget.style.background='none'}>
              <div style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:'var(--ink)',display:'flex',alignItems:'center',gap:8}}>{label}{label==='Review'&&openComments>0?<span style={{background:'var(--cyan-2)',color:'#04141c',fontFamily:'var(--mono)',fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:3}}>{openComments}</span>:null}</div>
              <div style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--muted)',marginTop:2}}>{sub}</div>
            </button>
          ))}
          <div style={{padding:'10px 18px 6px',fontFamily:'var(--mono)',fontSize:9,textTransform:'uppercase',letterSpacing:'1.2px',color:'var(--cyan)',borderTop:'1px solid var(--border)',marginTop:4}}>Generate from project</div>
          {[['pitch','Investor Pitch Deck','7-slide LP presentation'],['report','Client Report','Printable appraisal report'],['memo','Deal Memo','Decision memorandum'],['update','Project Update Deck','Monthly progress deck']].map(([type,label,sub])=>(
            <button key={type} onClick={()=>generateDoc(type)} style={{display:'block',width:'100%',padding:'10px 18px',background:'none',border:'none',borderBottom:'1px solid var(--border)',textAlign:'left',cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'} onMouseLeave={e=>e.currentTarget.style.background='none'}>
              <div style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:600,color:'var(--ink-2)'}}>↳ {label}</div>
              <div style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--muted)',marginTop:2}}>{sub}</div>
            </button>
          ))}
        </div>
        <div style={{borderTop:'1px solid var(--border)',flexShrink:0}}>
          <a href="Phoenix Hub.html" style={{display:'flex',alignItems:'center',padding:'13px 18px',textDecoration:'none',borderBottom:'1px solid var(--border)'}} onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'} onMouseLeave={e=>e.currentTarget.style.background='none'}>
            <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:'var(--ink)'}}>← Phoenix Hub</span>
          </a>
          <button onClick={signOut} style={{display:'flex',alignItems:'center',gap:10,padding:'13px 18px',background:'none',border:'none',width:'100%',textAlign:'left',cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'} onMouseLeave={e=>e.currentTarget.style.background='none'}>
            <span style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--muted)'}}>Sign out</span>
            <span style={{fontFamily:'var(--mono)',fontSize:9.5,color:'var(--muted)',marginLeft:'auto',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{session.user.email}</span>
          </button>
        </div>
      </div>

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
          ? <div className="main" data-screen-label="Input"><InputScreen state={active} model={model} set={set} accounts={accounts} /></div>
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
