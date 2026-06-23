/* ============================================================================
   PHOENIX CRM — account detail (Overview / Jobs / Contacts / Activity)
   Consumes helpers + callbacks from crm.jsx. Inline edits commit through
   saveAccount() (optimistic in the app shell); job links/stages go through
   assignJob()/setJobStage().
   ========================================================================== */
const cdFmt = window.Appraisal;

/* ---- contact add/edit modal ---- */
function ContactModal({ initial, onClose, onSave }) {
  const [f, setF] = React.useState(() => Object.assign({ name: '', role: '', email: '', phone: '', primary: false }, initial || {}));
  const up = (k, v) => setF(p => ({ ...p, [k]: v }));
  const valid = f.name.trim().length > 0;
  return (
    <div className="cmodal-overlay" onClick={onClose}>
      <div className="cmodal" onClick={e => e.stopPropagation()}>
        <div className="cmodal-h"><h3>{initial && initial.id ? 'Edit contact' : 'Add contact'}</h3><p>A named person at this account.</p></div>
        <div className="cmodal-b">
          <div className="cfield"><label>Full name</label><input className="cinput" autoFocus value={f.name} onChange={e => up('name', e.target.value)} placeholder="e.g. James Marlowe" /></div>
          <div className="cfield"><label>Role / title</label><input className="cinput" value={f.role} onChange={e => up('role', e.target.value)} placeholder="e.g. Development Director" /></div>
          <div className="cfield-row">
            <div className="cfield"><label>Email</label><input className="cinput" value={f.email} onChange={e => up('email', e.target.value)} placeholder="name@company.com" /></div>
            <div className="cfield"><label>Phone</label><input className="cinput" value={f.phone} onChange={e => up('phone', e.target.value)} placeholder="01234 567 890" /></div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--c-ink-2)', cursor: 'pointer', marginTop: 4 }}>
            <input type="checkbox" checked={!!f.primary} onChange={e => up('primary', e.target.checked)} style={{ width: 16, height: 16 }} />
            Primary contact
          </label>
        </div>
        <div className="cmodal-f">
          <button className="cbtn ghost" onClick={onClose}>Cancel</button>
          <button className="cbtn primary" disabled={!valid} style={{ opacity: valid ? 1 : .5 }} onClick={() => valid && onSave(f)}>Save contact</button>
        </div>
      </div>
    </div>
  );
}

/* ---- link-job picker ---- */
function LinkJobModal({ account, accounts, projects, onClose, onLink }) {
  // head schemes not already linked to THIS account
  const heads = (projects || []).filter(p => !p.isTemplate && window.DB.familyId(p) === p.id && p.accountId !== account.id);
  const nameOf = id => { const a = (accounts || []).find(x => x.id === id); return a ? a.name : 'another client'; };
  return (
    <div className="cmodal-overlay" onClick={onClose}>
      <div className="cmodal" onClick={e => e.stopPropagation()}>
        <div className="cmodal-h"><h3>Link a job</h3><p>Assign an appraisal scheme to <b>{account.name}</b>. Schemes already linked elsewhere will be reassigned.</p></div>
        <div className="cmodal-b">
          {heads.length === 0 ? (
            <div className="crm-empty" style={{ padding: '30px 10px' }}><div className="et">No schemes available</div><div className="es">Every scheme is already linked to this account, or none exist yet.</div></div>
          ) : heads.map(p => {
            const m = cdFmt.computeModel(p);
            return (
              <div key={p.id} className="pick-job" onClick={() => onLink(p.id)}>
                <div className="pj-i">
                  <div className="pj-n">{p.project.name}</div>
                  <div className="pj-a">{p.project.address || p.project.ref}{p.accountId ? ' · linked to ' + nameOf(p.accountId) : ''}</div>
                </div>
                <div className="pj-m">{cdFmt.moneyShort(m.ratios.gdv)}</div>
              </div>
            );
          })}
        </div>
        <div className="cmodal-f"><button className="cbtn ghost" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}

/* ---- tabs ---- */
function OverviewTab({ draft, setField, commit, rollup }) {
  const [tagInput, setTagInput] = React.useState('');
  const addTag = () => {
    const t = tagInput.trim(); if (!t) return;
    const tags = (draft.tags || []).slice();
    if (!tags.includes(t)) { tags.push(t); setField('tags', tags, true); }
    setTagInput('');
  };
  const rmTag = (t) => setField('tags', (draft.tags || []).filter(x => x !== t), true);

  return (
    <div className="det-grid">
      <div>
        <div className="info-card">
          <div className="ic-h">Details</div>
          <div className="info-row"><div className="k">Type</div><div className="v">
            <select className="cselect" value={draft.type} onChange={e => setField('type', e.target.value, true)}>
              {window.ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select></div></div>
          <div className="info-row"><div className="k">Status</div><div className="v">
            <select className="cselect" value={draft.status} onChange={e => setField('status', e.target.value, true)}>
              {window.ACCOUNT_STATUSES.map(t => <option key={t} value={t}>{t}</option>)}
            </select></div></div>
          <div className="info-row"><div className="k">Region</div><div className="v">
            <input className="cinput" value={draft.region || ''} placeholder="—" onChange={e => setField('region', e.target.value)} onBlur={commit} /></div></div>
          <div className="info-row"><div className="k">Owner</div><div className="v">
            <input className="cinput" value={draft.owner || ''} placeholder="Internal lead" onChange={e => setField('owner', e.target.value)} onBlur={commit} /></div></div>
          <div className="info-row"><div className="k">Address</div><div className="v">
            <input className="cinput" value={draft.address || ''} placeholder="—" onChange={e => setField('address', e.target.value)} onBlur={commit} /></div></div>
        </div>

        <div className="info-card">
          <div className="ic-h">Notes</div>
          <textarea className="ctextarea" value={draft.notes || ''} placeholder="Relationship context, history, next steps…"
            onChange={e => setField('notes', e.target.value)} onBlur={commit} style={{ minHeight: 120 }} />
        </div>

        <div className="info-card">
          <div className="ic-h">Tags</div>
          <div className="tagrow" style={{ marginBottom: 12 }}>
            {(draft.tags || []).length ? (draft.tags || []).map(t => (
              <span key={t} className="tag">{t}<span className="x" onClick={() => rmTag(t)}>×</span></span>
            )) : <span style={{ fontSize: 12, color: 'var(--c-muted-2)' }}>No tags yet.</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="cinput" value={tagInput} placeholder="Add a tag…" onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTag(); }} />
            <button className="cbtn" onClick={addTag}>Add</button>
          </div>
        </div>
      </div>

      <div>
        <div className="info-card">
          <div className="ic-h">Portfolio with this client</div>
          <div className="info-row"><div className="k">Linked jobs</div><div className="v num" style={{ fontWeight: 600 }}>{rollup.count}</div></div>
          <div className="info-row"><div className="k">Live jobs</div><div className="v num" style={{ fontWeight: 600 }}>{rollup.active}</div></div>
          <div className="info-row"><div className="k">Total GDV</div><div className="v num" style={{ fontWeight: 600 }}>{rollup.count ? cdFmt.moneyShort(rollup.gdv) : '—'}</div></div>
          <div className="info-row"><div className="k">Total profit</div><div className="v num" style={{ fontWeight: 600, color: rollup.profit >= 0 ? 'var(--c-ok)' : 'var(--c-red)' }}>{rollup.count ? cdFmt.moneyShort(rollup.profit) : '—'}</div></div>
        </div>
        <div className="info-card">
          <div className="ic-h">Primary contact</div>
          {(() => {
            const pc = (draft.contacts || []).find(c => c.primary) || (draft.contacts || [])[0];
            if (!pc) return <div style={{ fontSize: 12.5, color: 'var(--c-muted)' }}>No contacts yet — add one in the Contacts tab.</div>;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <window.CAvatar name={pc.name} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--c-ink)' }}>{pc.name}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--c-muted)', marginTop: 2 }}>{pc.role || 'Contact'}</div>
                  {pc.email ? <a href={'mailto:' + pc.email} style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--c-accent)', textDecoration: 'none', display: 'block', marginTop: 4 }}>{pc.email}</a> : null}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function JobsTab({ account, projects, onOpenJob, assignJob, setJobStage, onLink }) {
  const roll = window.accountRollup(account.id, projects);
  return (
    <div className="crm-card">
      <div className="crm-card-h">
        <span className="t">Linked jobs <span className="n">{roll.count}</span></span>
        <button className="cbtn sm primary" style={{ marginLeft: 'auto' }} onClick={onLink}>+ Link job</button>
      </div>
      {roll.jobs.length === 0 ? (
        <div className="crm-empty"><div className="ei"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M9 5.5V4h6v1.5" stroke="currentColor" strokeWidth="1.6"/></svg></div><div className="et">No jobs linked</div><div className="es">Link an appraisal scheme to track its GDV, profit and pipeline stage against this client.</div><button className="cbtn primary" onClick={onLink}>+ Link a job</button></div>
      ) : roll.jobs.map(p => {
        const m = cdFmt.computeModel(p);
        const risk = cdFmt.riskScore(m);
        const stage = window.jobStage(p);
        return (
          <div key={p.id} className="jobrow" onClick={() => onOpenJob(p.id)}>
            <div style={{ minWidth: 0 }}>
              <div className="jn">{p.project.name}</div>
              <div className="ja">{p.project.address || p.project.ref}</div>
            </div>
            <div onClick={e => e.stopPropagation()}>
              <select className="stage-select" value={stage} onChange={e => setJobStage(p.id, e.target.value)}>
                {window.JOB_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div className="jm hide-sm"><div className="ml">GDV</div><div className="mv">{cdFmt.moneyShort(m.ratios.gdv)}</div></div>
            <div className="jm hide-sm"><div className="ml">Profit</div><div className="mv" style={{ color: m.ratios.profit >= 0 ? 'var(--c-ink)' : 'var(--c-red)' }}>{cdFmt.moneyShort(m.ratios.profit)}</div></div>
            <div className="jm" style={{ display: 'flex', alignItems: 'center', gap: 14 }} onClick={e => e.stopPropagation()}>
              <span className={'jrisk ' + risk.sev}><span className="pd"></span>{risk.level}</span>
              <button className="iconmini danger" title="Unlink job" onClick={() => assignJob(p.id, null)}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6.5 9.5l3-3M5 7L3.5 8.5a2.5 2.5 0 003.5 3.5L8.5 10.5M11 9l1.5-1.5a2.5 2.5 0 00-3.5-3.5L7.5 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ContactsTab({ draft, setField }) {
  const [modal, setModal] = React.useState(null); // {contact} or {} for new
  const contacts = draft.contacts || [];

  const save = (data) => {
    let list = contacts.slice();
    if (data.primary) list = list.map(c => ({ ...c, primary: false }));
    if (data.id) {
      list = list.map(c => c.id === data.id ? { ...c, ...data } : c);
    } else {
      list.push({ ...data, id: window.DB.uid('ct') });
    }
    setField('contacts', list, true);
    setModal(null);
  };
  const del = (id) => setField('contacts', contacts.filter(c => c.id !== id), true);
  const makePrimary = (id) => setField('contacts', contacts.map(c => ({ ...c, primary: c.id === id })), true);

  return (
    <div className="crm-card">
      <div className="crm-card-h"><span className="t">Contacts <span className="n">{contacts.length}</span></span>
        <button className="cbtn sm primary" style={{ marginLeft: 'auto' }} onClick={() => setModal({})}>+ Add contact</button></div>
      {contacts.length === 0 ? (
        <div className="crm-empty"><div className="ei"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></div><div className="et">No contacts</div><div className="es">Add the people you deal with at this account — names, roles and how to reach them.</div><button className="cbtn primary" onClick={() => setModal({})}>+ Add contact</button></div>
      ) : (
        <div style={{ padding: '4px 18px' }}>
          {contacts.map(c => (
            <div key={c.id} className="contact">
              <window.CAvatar name={c.name} />
              <div className="ci">
                <div className="cn">{c.name}{c.primary ? <span className="primary-tag">Primary</span> : null}</div>
                <div className="cr">{c.role || 'Contact'}</div>
              </div>
              <div className="cc">
                {c.email ? <a href={'mailto:' + c.email}>{c.email}</a> : null}
                {c.phone ? <a href={'tel:' + c.phone}>{c.phone}</a> : null}
              </div>
              <div className="cact">
                {!c.primary ? <button className="iconmini" title="Make primary" onClick={() => makePrimary(c.id)}><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2l1.6 3.7 4 .4-3 2.7.9 3.9L8 10.8 4.5 12.7l.9-3.9-3-2.7 4-.4L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg></button> : null}
                <button className="iconmini" title="Edit" onClick={() => setModal(c)}><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M11 2.5l2.5 2.5L6 12.5l-3 .5.5-3L11 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg></button>
                <button className="iconmini danger" title="Delete" onClick={() => del(c.id)}><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.5 9h6l.5-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {modal ? <ContactModal initial={modal.id ? modal : null} onClose={() => setModal(null)} onSave={save} /> : null}
    </div>
  );
}

function ActivityTab({ draft, setField, session }) {
  const [type, setType] = React.useState('Note');
  const [note, setNote] = React.useState('');
  const acts = (draft.activity || []).slice().sort((a, b) => new Date(b.at) - new Date(a.at));

  const add = () => {
    const t = note.trim(); if (!t) return;
    const entry = { id: window.DB.uid('ac'), type, note: t, author: session.user.email, at: new Date().toISOString() };
    setField('activity', [entry].concat(draft.activity || []), true);
    setNote('');
  };
  const del = (id) => setField('activity', (draft.activity || []).filter(a => a.id !== id), true);

  return (
    <div>
      <div className="act-composer">
        <div className="typerow">
          {window.ACTIVITY_TYPES.map(t => <button key={t} className={'act-type' + (type === t ? ' on' : '')} onClick={() => setType(t)}>{t}</button>)}
        </div>
        <textarea className="ctextarea" value={note} placeholder={'Log a ' + type.toLowerCase() + '…'} onChange={e => setNote(e.target.value)} style={{ minHeight: 70 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="cbtn primary" disabled={!note.trim()} style={{ opacity: note.trim() ? 1 : .5 }} onClick={add}>Log {type.toLowerCase()}</button>
        </div>
      </div>

      <div className="crm-card" style={{ padding: '18px 20px' }}>
        {acts.length === 0 ? (
          <div className="crm-empty" style={{ padding: '40px 10px' }}><div className="et">No activity yet</div><div className="es">Log calls, meetings and emails to keep a timeline of the relationship.</div></div>
        ) : (
          <div className="timeline2">
            {acts.map(a => (
              <div key={a.id} className="tl-item">
                <span className={'tl-dot ' + (a.type || 'note').toLowerCase()}></span>
                <div className="tl-top">
                  <span className="tl-type">{a.type}</span>
                  <span className="tl-when">{window.crmRelTime(a.at)}</span>
                  <button className="iconmini danger tl-del" title="Delete" onClick={() => del(a.id)}><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.5 9h6l.5-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg></button>
                </div>
                <div className="tl-note">{a.note}</div>
                {a.author ? <div className="tl-who">{a.author}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- detail shell ---- */
function AccountDetail({ account, accounts, projects, onBack, onOpenJob, saveAccount, deleteAccount, assignJob, setJobStage, session }) {
  const [tab, setTab] = React.useState('overview');
  const [editing, setEditing] = React.useState(false);
  const [showLink, setShowLink] = React.useState(false);
  const [draft, setDraft] = React.useState(account);
  const lastId = React.useRef(account.id);

  // resync the draft only when switching to a different account
  React.useEffect(() => {
    if (lastId.current !== account.id) { setDraft(account); lastId.current = account.id; }
  }, [account]);

  // setField: update local draft; if `commitNow`, persist immediately (selects, tags, contacts, activity)
  const setField = (k, v, commitNow) => {
    setDraft(prev => {
      const next = { ...prev, [k]: v };
      if (commitNow) saveAccount(next);
      return next;
    });
  };
  const commit = () => { saveAccount(draft); };

  const rollup = window.accountRollup(account.id, projects);
  const contacts = draft.contacts || [];

  return (
    <div>
      <button className="crm-back" onClick={() => { commit(); onBack(); }}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        All accounts
      </button>

      <div className="det-head">
        <window.CAvatar name={account.name} size="lg" />
        <div className="det-id">
          <div className="det-name">{account.name} <window.StatusPill status={draft.status} /></div>
          <div className="det-meta">
            <span>{draft.type}</span>
            {draft.region ? <><span className="dot"></span><span>{draft.region}</span></> : null}
            <span className="dot"></span><span>{rollup.count} job{rollup.count === 1 ? '' : 's'}</span>
            <span className="dot"></span><span>{rollup.count ? cdFmt.moneyShort(rollup.gdv) + ' GDV' : 'no jobs linked'}</span>
            {draft.owner ? <><span className="dot"></span><span>Owner: {draft.owner}</span></> : null}
          </div>
        </div>
        <div className="det-actions">
          <button className="cbtn sm" onClick={() => setEditing(true)}><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 2.5l2.5 2.5L6 12.5l-3 .5.5-3L11 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>Edit</button>
          <button className="cbtn sm danger" onClick={() => { if (confirm('Delete "' + account.name + '"? Linked jobs are kept but unassigned. This cannot be undone.')) deleteAccount(account.id); }}>Delete</button>
        </div>
      </div>

      <div className="det-tabs">
        <button className={tab === 'overview' ? 'on' : ''} onClick={() => setTab('overview')}>Overview</button>
        <button className={tab === 'jobs' ? 'on' : ''} onClick={() => setTab('jobs')}>Jobs <span className="tc">{rollup.count}</span></button>
        <button className={tab === 'contacts' ? 'on' : ''} onClick={() => setTab('contacts')}>Contacts <span className="tc">{contacts.length}</span></button>
        <button className={tab === 'activity' ? 'on' : ''} onClick={() => setTab('activity')}>Activity <span className="tc">{(draft.activity || []).length}</span></button>
      </div>

      {tab === 'overview' ? <OverviewTab draft={draft} setField={setField} commit={commit} rollup={rollup} /> : null}
      {tab === 'jobs' ? <JobsTab account={account} projects={projects} onOpenJob={onOpenJob} assignJob={assignJob} setJobStage={setJobStage} onLink={() => setShowLink(true)} /> : null}
      {tab === 'contacts' ? <ContactsTab draft={draft} setField={setField} /> : null}
      {tab === 'activity' ? <ActivityTab draft={draft} setField={setField} session={session} /> : null}

      {editing ? <window.AccountModal initial={draft} onClose={() => setEditing(false)} onSave={(f) => { const next = { ...draft, ...f }; setDraft(next); saveAccount(next); setEditing(false); }} /> : null}
      {showLink ? <LinkJobModal account={account} accounts={accounts} projects={projects} onClose={() => setShowLink(false)} onLink={(pid) => { assignJob(pid, account.id); setShowLink(false); }} /> : null}
    </div>
  );
}

Object.assign(window, { AccountDetail });
