/* ============================================================================
   PHOENIX CRM — client workspace (shell + accounts list)
   A SaaS-style module that lives alongside the appraisal tool and shares its
   Supabase database. Accounts are client/developer companies; "jobs" are the
   appraisal schemes (projects), linked via project.accountId. Rollups count
   base schemes only (versions inherit the link but don't double-count).
   Detail view + tabs live in crm-detail.jsx (window.AccountDetail).
   ========================================================================== */
const crmFmt = window.Appraisal;

/* ---- shared helpers (exported to window for crm-detail.jsx) ---- */
const ACCOUNT_TYPES = ['Developer', 'Housebuilder', 'Investor', 'Landowner', 'Agent', 'Other'];
const ACCOUNT_STATUSES = ['Lead', 'Active', 'Dormant', 'Archived'];
const JOB_STAGES = [
  { key: 'lead', label: 'Lead' },
  { key: 'appraising', label: 'Appraising' },
  { key: 'offer', label: 'Offer' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
  { key: 'onhold', label: 'On Hold' },
];
const ACTIVITY_TYPES = ['Note', 'Call', 'Email', 'Meeting', 'Task'];

function crmInitials(name) {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
const AVA_TINTS = ['#1366d6', '#0f9d58', '#6d5ae0', '#b5730a', '#0e8aa8', '#c2466b', '#3a6ea5', '#4b8b3b'];
function crmAvatarColor(name) {
  let h = 0; const s = name || '';
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVA_TINTS[h % AVA_TINTS.length];
}
// derive a job's pipeline stage (falls back from the legacy appraisal status)
function jobStage(p) {
  if (p.meta && p.meta.stage) return p.meta.stage;
  const st = p.meta && p.meta.status;
  if (st === 'Approved') return 'won';
  if (st === 'In Appraisal') return 'appraising';
  return 'lead';
}
function stageLabel(key) { const s = JOB_STAGES.find(x => x.key === key); return s ? s.label : 'Lead'; }
// base schemes linked to an account (versions excluded so totals don't double-count)
function accountJobs(accountId, projects) {
  return (projects || []).filter(p => p.accountId === accountId && !p.isTemplate && window.DB.familyId(p) === p.id);
}
function accountRollup(accountId, projects) {
  const jobs = accountJobs(accountId, projects);
  let gdv = 0, profit = 0, active = 0;
  jobs.forEach(p => {
    const m = window.Appraisal.computeModel(p);
    gdv += m.ratios.gdv; profit += m.ratios.profit;
    const s = jobStage(p);
    if (s !== 'won' && s !== 'lost') active++;
  });
  return { count: jobs.length, gdv, profit, active, jobs };
}
function crmRelTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function CAvatar({ name, size }) {
  return <div className={'cava' + (size ? ' ' + size : '')} style={{ background: crmAvatarColor(name) }}>{crmInitials(name)}</div>;
}
function StatusPill({ status }) {
  const s = (status || 'Lead').toLowerCase();
  return <span className={'pill ' + s}><span className="pd"></span>{status || 'Lead'}</span>;
}
function StagePill({ stage }) {
  return <span className={'stage ' + stage}>{stageLabel(stage)}</span>;
}

/* ---- New / Edit account modal ---- */
function AccountModal({ initial, onClose, onSave }) {
  const [f, setF] = React.useState(() => Object.assign(
    { name: '', type: 'Developer', status: 'Lead', region: '', owner: '', address: '', notes: '' },
    initial || {}
  ));
  const up = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const editing = !!(initial && initial.id);
  const valid = f.name.trim().length > 0;
  return (
    <div className="cmodal-overlay" onClick={onClose}>
      <div className="cmodal" onClick={e => e.stopPropagation()}>
        <div className="cmodal-h">
          <h3>{editing ? 'Edit account' : 'New client account'}</h3>
          <p>{editing ? 'Update this client’s core details.' : 'Create a client/developer company. You can link appraisal jobs and add contacts after.'}</p>
        </div>
        <div className="cmodal-b">
          <div className="cfield">
            <label>Account name</label>
            <input className="cinput" autoFocus value={f.name} placeholder="e.g. Total Homes"
              onChange={e => up('name', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && valid) onSave(f); }} />
          </div>
          <div className="cfield-row">
            <div className="cfield"><label>Type</label>
              <select className="cselect" value={f.type} onChange={e => up('type', e.target.value)}>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="cfield"><label>Status</label>
              <select className="cselect" value={f.status} onChange={e => up('status', e.target.value)}>
                {ACCOUNT_STATUSES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="cfield-row">
            <div className="cfield"><label>Region</label>
              <input className="cinput" value={f.region} placeholder="e.g. West Sussex" onChange={e => up('region', e.target.value)} /></div>
            <div className="cfield"><label>Owner</label>
              <input className="cinput" value={f.owner} placeholder="Internal lead" onChange={e => up('owner', e.target.value)} /></div>
          </div>
          <div className="cfield"><label>Address</label>
            <input className="cinput" value={f.address} placeholder="Registered / correspondence address" onChange={e => up('address', e.target.value)} /></div>
          <div className="cfield"><label>Notes</label>
            <textarea className="ctextarea" value={f.notes} placeholder="Context, relationship history, anything useful…" onChange={e => up('notes', e.target.value)} /></div>
        </div>
        <div className="cmodal-f">
          <button className="cbtn ghost" onClick={onClose}>Cancel</button>
          <button className="cbtn primary" disabled={!valid} style={{ opacity: valid ? 1 : .5 }} onClick={() => valid && onSave(f)}>{editing ? 'Save changes' : 'Create account'}</button>
        </div>
      </div>
    </div>
  );
}

/* ---- Accounts list (table) ---- */
function AccountsList({ accounts, projects, onOpen, onNew, query, setQuery }) {
  const q = (query || '').trim().toLowerCase();
  const rows = accounts
    .filter(a => !q || (a.name || '').toLowerCase().includes(q) || (a.region || '').toLowerCase().includes(q) || (a.type || '').toLowerCase().includes(q))
    .map(a => ({ a, roll: accountRollup(a.id, projects) }));

  // totals across all accounts (not filtered) for the stat strip
  const totalJobs = accounts.reduce((s, a) => s + accountRollup(a.id, projects).count, 0);
  const totalGdv = accounts.reduce((s, a) => s + accountRollup(a.id, projects).gdv, 0);
  const activeCount = accounts.filter(a => a.status === 'Active').length;

  return (
    <div>
      <div className="crm-stats">
        <div className="cstat"><div className="l">Accounts<span className="di"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 8a3 3 0 100-6 3 3 0 000 6zM2.5 14a5.5 5.5 0 0111 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg></span></div><div className="v">{accounts.length}</div><div className="s">{activeCount} active · {accounts.length - activeCount} other</div></div>
        <div className="cstat"><div className="l">Linked Jobs<span className="di"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="3.5" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M6 3.5V2.5h4v1" stroke="currentColor" strokeWidth="1.4"/></svg></span></div><div className="v">{totalJobs}</div><div className="s">appraisal schemes assigned</div></div>
        <div className="cstat"><div className="l">Total GDV<span className="di"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 13l3.5-4 2.5 2.2L13 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span></div><div className="v">{crmFmt.moneyShort(totalGdv)}</div><div className="s">across all client jobs</div></div>
        <div className="cstat"><div className="l">Leads<span className="di"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2l1.6 3.7 4 .4-3 2.7.9 3.9L8 10.8 4.5 12.7l.9-3.9-3-2.7 4-.4L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg></span></div><div className="v">{accounts.filter(a => a.status === 'Lead').length}</div><div className="s">in early conversation</div></div>
      </div>

      <div className="crm-card">
        <div className="crm-card-h"><span className="t">All accounts <span className="n">{rows.length}</span></span></div>
        {rows.length === 0 ? (
          <div className="crm-empty">
            <div className="ei"><svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></div>
            <div className="et">{q ? 'No matching accounts' : 'No accounts yet'}</div>
            <div className="es">{q ? 'Try a different search term.' : 'Create your first client account to start linking appraisal jobs and tracking the relationship.'}</div>
            {!q ? <button className="cbtn primary" onClick={onNew}>+ New account</button> : null}
          </div>
        ) : (
          <table className="ctable">
            <thead>
              <tr>
                <th>Account</th>
                <th>Status</th>
                <th className="hide-sm">Owner</th>
                <th className="r">Contacts</th>
                <th className="r">Jobs</th>
                <th className="r">GDV</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ a, roll }) => (
                <tr key={a.id} onClick={() => onOpen(a.id)}>
                  <td>
                    <div className="acc-cell">
                      <CAvatar name={a.name} />
                      <div style={{ minWidth: 0 }}>
                        <div className="acc-name">{a.name}</div>
                        <div className="acc-sub">{a.type}{a.region ? ' · ' + a.region : ''}</div>
                      </div>
                    </div>
                  </td>
                  <td><StatusPill status={a.status} /></td>
                  <td className="hide-sm">{a.owner || <span style={{ color: 'var(--c-muted-2)' }}>—</span>}</td>
                  <td className="r num">{(a.contacts || []).length}</td>
                  <td className="r num">{roll.count}{roll.active ? <span style={{ color: 'var(--c-muted)', fontSize: 11 }}> ({roll.active} live)</span> : ''}</td>
                  <td className="r num" style={{ fontWeight: 600, color: 'var(--c-ink)' }}>{roll.count ? crmFmt.moneyShort(roll.gdv) : '—'}</td>
                  <td className="r"><span className="arrow"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ---- CRM shell (sidebar + main) ---- */
function CRMApp({ accounts, projects, session, onBackToPortfolio, onSignOut, onOpenJob, createAccount, saveAccount, deleteAccount, assignJob, setJobStage }) {
  const [activeId, setActiveId] = React.useState(null);
  const [showNew, setShowNew] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [navOpen, setNavOpen] = React.useState(false);

  const active = activeId ? accounts.find(a => a.id === activeId) : null;
  // if the active account was deleted elsewhere, fall back to the list
  React.useEffect(() => { if (activeId && !active) setActiveId(null); }, [activeId, active]);

  const handleCreate = async (fields) => { const a = await createAccount(fields); setShowNew(false); if (a) setActiveId(a.id); };

  const totalJobs = accounts.reduce((s, a) => s + accountJobs(a.id, projects).length, 0);

  return (
    <div className={'crm' + (navOpen ? ' nav-open' : '')}>
      <div className="crm-scrim" onClick={() => setNavOpen(false)}></div>
      <aside className="crm-side">
        <div className="crm-brand">
          <div className="mk">P</div>
          <div className="bn"><b>PHOENIX</b><span>CRM</span></div>
        </div>
        <nav className="crm-nav">
          <div className="navlbl">Workspace</div>
          <button className="on"><span className="ic"><svg width="17" height="17" viewBox="0 0 18 18" fill="none"><path d="M9 9a3.2 3.2 0 100-6.4A3.2 3.2 0 009 9zM3 16a6 6 0 0112 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></span>Clients<span className="cnt">{accounts.length}</span></button>
          <button onClick={onBackToPortfolio}><span className="ic"><svg width="17" height="17" viewBox="0 0 18 18" fill="none"><rect x="2.5" y="2.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.5"/><rect x="10" y="2.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.5"/><rect x="2.5" y="10" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.5"/><rect x="10" y="10" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.5"/></svg></span>Appraisals<span className="cnt">{totalJobs}</span></button>
          <div className="navlbl">Links</div>
          <a href="Phoenix Hub.html"><span className="ic"><svg width="17" height="17" viewBox="0 0 18 18" fill="none"><path d="M7 11l4-4M5.5 9.5L4 11a2.5 2.5 0 003.5 3.5L9 13M12.5 8.5L14 7a2.5 2.5 0 00-3.5-3.5L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></span>Phoenix Hub</a>
        </nav>
        <div className="crm-side-foot">
          <div className="crm-user">
            <div className="ava" style={{ width: 28, height: 28 }}>{crmInitials(session.user.email)}</div>
            <div className="uinfo"><b>{session.user.email.split('@')[0]}</b><span>{session.user.email.split('@')[1]}</span></div>
          </div>
          <button className="crm-signout" onClick={onSignOut}>Sign out</button>
        </div>
      </aside>

      <div className="crm-main">
        <div className="crm-topbar">
          <button className="crm-burger" onClick={() => setNavOpen(o => !o)}><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2.5 4.5h13M2.5 9h13M2.5 13.5h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button>
          {active ? (
            <h1 className="crm-h1">{active.name}<span className="sub">Client account</span></h1>
          ) : (
            <h1 className="crm-h1">Clients<span className="sub">{accounts.length} accounts · {totalJobs} linked jobs</span></h1>
          )}
          <div className="crm-top-r">
            {!active ? (
              <div className="crm-search">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search accounts…" />
              </div>
            ) : null}
            {!active ? <button className="cbtn primary" onClick={() => setShowNew(true)}><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>New account</button> : null}
          </div>
        </div>

        <div className="crm-body">
          {active ? (
            <window.AccountDetail
              account={active} accounts={accounts} projects={projects}
              onBack={() => setActiveId(null)}
              onOpenJob={onOpenJob}
              saveAccount={saveAccount} deleteAccount={async (id) => { await deleteAccount(id); setActiveId(null); }}
              assignJob={assignJob} setJobStage={setJobStage}
              session={session}
            />
          ) : (
            <AccountsList accounts={accounts} projects={projects} onOpen={setActiveId} onNew={() => setShowNew(true)} query={query} setQuery={setQuery} />
          )}
        </div>
      </div>

      {showNew ? <AccountModal onClose={() => setShowNew(false)} onSave={handleCreate} /> : null}
    </div>
  );
}

Object.assign(window, {
  CRMApp, AccountModal, CAvatar, StatusPill, StagePill,
  crmInitials, crmAvatarColor, crmRelTime, jobStage, stageLabel, accountJobs, accountRollup,
  ACCOUNT_TYPES, ACCOUNT_STATUSES, JOB_STAGES, ACTIVITY_TYPES,
});
