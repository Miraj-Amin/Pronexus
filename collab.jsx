/* ============================================================================
   Collaboration layer — version history, audit trail, comments.
   Exposes: diffProject(before, after), useAuditCapture(active, author),
            <ReviewDrawer/>, fmtWhen().  All rendered into window.*
   ========================================================================== */

/* ---------- value / label formatting ---------- */
function _pretty(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, function (c) { return c.toUpperCase(); })
    .replace(/\bGdv\b/i, 'GDV').replace(/\bSdlt\b/i, 'SDLT').replace(/\bVat\b/i, 'VAT')
    .replace(/\bPsf\b/i, 'PSF').replace(/\bPct\b/i, '%')
    .replace(/\s+/g, ' ').trim();
}
function _fmtVal(v) {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return v.toLocaleString('en-GB');
    return (Math.round(v * 10000) / 10000).toLocaleString('en-GB', { maximumFractionDigits: 4 });
  }
  return String(v);
}

/* ---------- diff engine ---------- */
function _diffScalars(before, after, label, out) {
  const keys = {};
  Object.keys(before || {}).forEach(k => { keys[k] = 1; });
  Object.keys(after || {}).forEach(k => { keys[k] = 1; });
  Object.keys(keys).forEach(function (k) {
    const a = before ? before[k] : undefined;
    const b = after ? after[k] : undefined;
    if (a && typeof a === 'object') return;
    if (b && typeof b === 'object') return;
    if (a !== b) out.push({ label: label + ' › ' + _pretty(k), old: _fmtVal(a), new: _fmtVal(b) });
  });
}
function _diffCollection(beforeArr, afterArr, nameKey, prefix, out) {
  const bm = {}, am = {};
  (beforeArr || []).forEach(x => { bm[x.id] = x; });
  (afterArr || []).forEach(x => { am[x.id] = x; });
  const ids = {};
  Object.keys(bm).forEach(i => { ids[i] = 1; });
  Object.keys(am).forEach(i => { ids[i] = 1; });
  Object.keys(ids).forEach(function (id) {
    const b = bm[id], a = am[id];
    const name = (a && a[nameKey]) || (b && b[nameKey]) || id;
    const label = prefix + ': ' + name;
    if (b && !a) { out.push({ label: label, old: 'present', new: 'deleted' }); return; }
    if (a && !b) { out.push({ label: label, old: '—', new: 'added' }); return; }
    _diffScalars(b, a, label, out);
  });
}
function diffProject(before, after) {
  const out = [];
  if (!before || !after) return out;
  _diffScalars(before.project, after.project, 'Project', out);
  _diffScalars(before.assumptions, after.assumptions, 'Assumption', out);
  if ((before.meta || {}).status !== (after.meta || {}).status)
    out.push({ label: 'Status', old: _fmtVal((before.meta || {}).status), new: _fmtVal((after.meta || {}).status) });
  _diffCollection(before.costLines, after.costLines, 'item', 'Cost', out);
  _diffCollection(before.phases, after.phases, 'name', 'Phase', out);
  _diffCollection(before.units, after.units, 'number', 'Unit', out);
  _diffCollection(before.comparables, after.comparables, 'address', 'Comp', out);
  return out;
}

/* ---------- relative time ---------- */
function fmtWhen(iso) {
  const d = new Date(iso), now = new Date(), s = Math.round((now - d) / 1000);
  if (s < 45) return 'just now';
  if (s < 90) return '1 min ago';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 5400) return '1 hr ago';
  if (s < 86400) return Math.round(s / 3600) + ' hr ago';
  if (s < 172800) return 'yesterday';
  if (s < 604800) return Math.round(s / 86400) + ' days ago';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function initials(email) {
  if (!email) return '?';
  const name = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
  const parts = name.split(' ').filter(Boolean);
  return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

/* ---------- audit capture hook: debounced diff of the live project ---------- */
function useAuditCapture(active, author, onLogged) {
  const baseline = React.useRef(null);
  const activeRef = React.useRef(active);
  const timer = React.useRef(null);
  activeRef.current = active;
  const activeId = active ? active.id : null;

  // reset baseline whenever we switch to a different project
  React.useEffect(() => {
    baseline.current = active ? JSON.parse(JSON.stringify(active)) : null;
  }, [activeId]); // eslint-disable-line

  // on any change to the active object, debounce a diff + log
  React.useEffect(() => {
    if (!active) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const before = baseline.current;
      const now = activeRef.current;
      if (!before || !now || before.id !== now.id) { baseline.current = now ? JSON.parse(JSON.stringify(now)) : null; return; }
      const entries = diffProject(before, now);
      baseline.current = JSON.parse(JSON.stringify(now));
      if (entries.length) {
        try { await DB.logChanges(now.id, author, entries); if (onLogged) onLogged(); } catch (e) { console.error('audit log failed', e); }
      }
    }, 1400);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [active]); // eslint-disable-line
}

/* ============================ Review Drawer ============================ */
function ReviewDrawer({ open, onClose, project, author, initialTab, onRestore, onChanged, refreshKey }) {
  const [tab, setTab] = React.useState(initialTab || 'history');
  React.useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);
  return (
    <React.Fragment>
      <div className={'rev-scrim' + (open ? ' on' : '')} onClick={onClose}></div>
      <aside className={'rev-drawer' + (open ? ' on' : '')} aria-hidden={!open}>
        <div className="rev-head">
          <div className="rev-title">Review<span className="rev-sub">{project ? project.project.name : ''}</span></div>
          <button className="rev-x" onClick={onClose} title="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="rev-tabs">
          <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>History</button>
          <button className={tab === 'activity' ? 'on' : ''} onClick={() => setTab('activity')}>Activity</button>
          <button className={tab === 'comments' ? 'on' : ''} onClick={() => setTab('comments')}>Comments</button>
        </div>
        <div className="rev-body">
          {open && project && tab === 'history' ? <HistoryTab project={project} author={author} onRestore={onRestore} refreshKey={refreshKey} /> : null}
          {open && project && tab === 'activity' ? <CollabActivityTab project={project} refreshKey={refreshKey} /> : null}
          {open && project && tab === 'comments' ? <CommentsTab project={project} author={author} onChanged={onChanged} /> : null}
        </div>
      </aside>
    </React.Fragment>
  );
}

/* ---------- History (snapshots) ---------- */
function HistoryTab({ project, author, onRestore, refreshKey }) {
  const [snaps, setSnaps] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [compare, setCompare] = React.useState(null); // {label, entries}
  const load = React.useCallback(async () => {
    try { setSnaps(await DB.listSnapshots(project.id)); } catch (e) { setSnaps([]); }
  }, [project.id]);
  React.useEffect(() => { load(); }, [load, refreshKey]);

  const save = async () => {
    const label = prompt('Name this snapshot', 'Scenario ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
    if (label === null) return;
    setBusy(true);
    try { await DB.saveSnapshot(project.id, label.trim() || 'Untitled', JSON.parse(JSON.stringify(project)), author); await load(); }
    catch (e) { alert('Could not save snapshot: ' + (e.message || e)); }
    finally { setBusy(false); }
  };
  const doCompare = async (snap) => {
    try {
      const full = await DB.getSnapshot(snap.id);
      if (!full) return;
      const entries = diffProject(full.data, project);
      setCompare({ label: snap.label, when: snap.created_at, entries });
    } catch (e) { alert('Compare failed: ' + (e.message || e)); }
  };
  const restore = async (snap) => {
    if (!confirm('Restore "' + (snap.label || 'snapshot') + '"? Current figures will be replaced (this is itself logged, and you can snapshot first).')) return;
    setBusy(true);
    try { const full = await DB.getSnapshot(snap.id); await onRestore(full); }
    catch (e) { alert('Restore failed: ' + (e.message || e)); }
    finally { setBusy(false); }
  };
  const del = async (snap) => {
    if (!confirm('Delete snapshot "' + (snap.label || '') + '"?')) return;
    try { await DB.deleteSnapshot(snap.id); await load(); } catch (e) { alert(e.message || e); }
  };

  if (compare) {
    return (
      <div className="rev-pane">
        <button className="rev-back" onClick={() => setCompare(null)}>← Back to history</button>
        <div className="rev-compare-h">Changes since<br /><b>{compare.label}</b> <span className="muted">· {fmtWhen(compare.when)}</span></div>
        {compare.entries.length === 0
          ? <div className="rev-empty">Nothing has changed since this snapshot.</div>
          : <DiffList entries={compare.entries} />}
      </div>
    );
  }
  return (
    <div className="rev-pane">
      <button className="rev-cta" onClick={save} disabled={busy}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 3h7l3 3v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" /><path d="M5 3v3h5" stroke="currentColor" strokeWidth="1.3" /></svg>
        Save snapshot of current figures
      </button>
      {snaps === null ? <div className="rev-empty">Loading…</div>
        : snaps.length === 0 ? <div className="rev-empty">No snapshots yet. Save one to capture this scenario — you can compare or roll back to it later.</div>
          : <div className="snap-list">
            {snaps.map(s => (
              <div className="snap" key={s.id}>
                <div className="snap-top">
                  <div className="snap-label">{s.label || 'Untitled'}</div>
                  <button className="snap-del" title="Delete" onClick={() => del(s)}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 5h10M6.5 5V3.5h3V5M5 5l.5 8h5L11 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                  </button>
                </div>
                <div className="snap-meta"><span className="ava">{initials(s.author)}</span>{s.author || 'unknown'} · {fmtWhen(s.created_at)}</div>
                <div className="snap-actions">
                  <button onClick={() => doCompare(s)}>Compare to now</button>
                  <button onClick={() => restore(s)}>Restore</button>
                </div>
              </div>
            ))}
          </div>}
    </div>
  );
}

function DiffList({ entries }) {
  return (
    <div className="diff-list">
      {entries.map((e, i) => (
        <div className="diff-row" key={i}>
          <div className="diff-label">{e.label}</div>
          <div className="diff-vals">
            <span className="dv old">{e.old}</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="dv-arrow"><path d="M3 8h9M9 5l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="dv new">{e.new}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Activity (audit log) ---------- */
function CollabActivityTab({ project, refreshKey }) {
  const [rows, setRows] = React.useState(null);
  React.useEffect(() => {
    let on = true;
    DB.listAudit(project.id, 300).then(r => { if (on) setRows(r); }).catch(() => { if (on) setRows([]); });
    return () => { on = false; };
  }, [project.id, refreshKey]);

  if (rows === null) return <div className="rev-pane"><div className="rev-empty">Loading…</div></div>;
  if (!rows.length) return <div className="rev-pane"><div className="rev-empty">No changes recorded yet. Edits to any figure are logged here automatically — who changed what, and when.</div></div>;
  return (
    <div className="rev-pane">
      <div className="audit-list">
        {rows.map(r => (
          <div className="audit-row" key={r.id}>
            <span className="ava" title={r.author || ''}>{initials(r.author)}</span>
            <div className="audit-main">
              <div className="audit-label">{r.label}</div>
              <div className="diff-vals">
                <span className="dv old">{r.old_value}</span>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="dv-arrow"><path d="M3 8h9M9 5l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span className="dv new">{r.new_value}</span>
              </div>
              <div className="audit-meta">{(r.author || 'unknown').split('@')[0]} · {fmtWhen(r.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Comments ---------- */
function CommentsTab({ project, author, onChanged }) {
  const [rows, setRows] = React.useState(null);
  const [body, setBody] = React.useState('');
  const [anchor, setAnchor] = React.useState('scheme');
  const [busy, setBusy] = React.useState(false);
  const [showResolved, setShowResolved] = React.useState(false);

  const costLines = (project.costLines || []).filter(l => l.included !== false);
  const anchorLabel = (a) => a === 'scheme' ? 'Whole scheme' : (() => { const l = (project.costLines || []).find(x => x.id === a); return l ? l.item : a; })();

  const load = React.useCallback(async () => {
    try { setRows(await DB.listComments(project.id)); } catch (e) { setRows([]); }
  }, [project.id]);
  React.useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await DB.addComment(project.id, anchor, anchorLabel(anchor), body.trim(), author);
      setBody(''); await load(); if (onChanged) onChanged();
    } catch (e) { alert('Could not post comment: ' + (e.message || e)); }
    finally { setBusy(false); }
  };
  const toggle = async (c) => { try { await DB.setCommentResolved(c.id, !c.resolved); await load(); if (onChanged) onChanged(); } catch (e) { alert(e.message || e); } };
  const del = async (c) => { if (!confirm('Delete this comment?')) return; try { await DB.deleteComment(c.id); await load(); if (onChanged) onChanged(); } catch (e) { alert(e.message || e); } };

  const visible = (rows || []).filter(c => showResolved || !c.resolved);
  const openCount = (rows || []).filter(c => !c.resolved).length;

  return (
    <div className="rev-pane">
      <div className="cmt-composer">
        <select value={anchor} onChange={e => setAnchor(e.target.value)} className="cmt-anchor">
          <option value="scheme">💬 Whole scheme</option>
          <optgroup label="Pin to a cost line">
            {costLines.map(l => <option key={l.id} value={l.id}>{l.item}</option>)}
          </optgroup>
        </select>
        <textarea value={body} placeholder="Add a comment or question…" rows={3}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(); }} />
        <div className="cmt-composer-foot">
          <span className="cmt-hint">⌘↵ to post</span>
          <button className="rev-cta sm" onClick={submit} disabled={busy || !body.trim()}>Post comment</button>
        </div>
      </div>

      <div className="cmt-filter">
        <span>{openCount} open{(rows || []).length - openCount > 0 ? ' · ' + ((rows || []).length - openCount) + ' resolved' : ''}</span>
        {(rows || []).length - openCount > 0
          ? <button onClick={() => setShowResolved(s => !s)}>{showResolved ? 'Hide resolved' : 'Show resolved'}</button>
          : null}
      </div>

      {rows === null ? <div className="rev-empty">Loading…</div>
        : visible.length === 0 ? <div className="rev-empty">No comments yet. Start a discussion on the whole scheme or pin a note to a specific cost line.</div>
          : <div className="cmt-list">
            {visible.map(c => (
              <div className={'cmt' + (c.resolved ? ' resolved' : '')} key={c.id}>
                <div className="cmt-head">
                  <span className="ava">{initials(c.author)}</span>
                  <div className="cmt-who"><b>{(c.author || 'unknown').split('@')[0]}</b><span>{fmtWhen(c.created_at)}</span></div>
                  <div className="cmt-actions">
                    <button onClick={() => toggle(c)} title={c.resolved ? 'Reopen' : 'Resolve'}>
                      {c.resolved
                        ? <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8a5 5 0 105-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M5 3L3 5 1 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        : <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </button>
                    <button onClick={() => del(c)} title="Delete">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 5h10M6.5 5V3.5h3V5M5 5l.5 8h5L11 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                    </button>
                  </div>
                </div>
                <div className="cmt-anchor-tag">{c.anchor === 'scheme' ? 'Whole scheme' : ('Cost line · ' + (c.anchor_label || c.anchor))}</div>
                <div className="cmt-body">{c.body}</div>
              </div>
            ))}
          </div>}
    </div>
  );
}

Object.assign(window, { diffProject, useAuditCapture, ReviewDrawer, fmtWhen });
