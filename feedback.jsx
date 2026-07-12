/* Visual feedback / annotation layer — a lightweight "draw a box, leave a
   comment" tool for testers, mounted once at the top of the app so it works
   on every screen (Portfolio, a project's tabs, CRM) without being wired
   into each one individually.

   How it identifies "where": the current screen name comes from the nearest
   [data-screen-label] element already present on most screens (falls back to
   the page title), and a short text snippet is pulled from directly under
   the drawn box so an item reads e.g. "Summary — near 'Stamp Duty'" rather
   than just raw coordinates. Box position is stored as page-absolute
   (scroll-independent) so pins stay put across reloads. */
const fbFmt = window.Appraisal;

function currentScreenLabel() {
  var el = document.querySelector('[data-screen-label]');
  return (el && el.getAttribute('data-screen-label')) || document.title || 'App';
}

// Best-effort short text snippet from directly under a box — helps identify
// what was being pointed at without needing a screenshot.
function sniffContext(box, excludeSelector) {
  var points = [
    [box.x + box.width / 2, box.y + box.height / 2],
    [box.x + 4, box.y + 4],
    [box.x + box.width - 4, box.y + box.height - 4]
  ];
  var seen = {}, parts = [];
  points.forEach(function (pt) {
    var vx = pt[0] - window.scrollX, vy = pt[1] - window.scrollY;
    if (vx < 0 || vy < 0 || vx > window.innerWidth || vy > window.innerHeight) return;
    var stack = document.elementsFromPoint(vx, vy) || [];
    for (var i = 0; i < stack.length; i++) {
      var el = stack[i];
      if (el.closest(excludeSelector)) continue;
      var t = (el.textContent || '').trim().replace(/\s+/g, ' ');
      if (t && t.length <= 60 && !seen[t]) { seen[t] = 1; parts.push(t); }
      break;
    }
  });
  return parts.slice(0, 3).join(' · ');
}

function FeedbackToggleButton({ active, onToggle, openCount, onOpenPanel }) {
  return (
    <div className="fb-toggle-wrap">
      <button className={'fb-toggle' + (active ? ' active' : '')} onClick={onToggle} title={active ? 'Stop annotating (Esc)' : 'Click, then drag a box around anything to leave feedback'}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" strokeDasharray={active ? '2 2' : '0'} />
          <path d="M5 14l2-2.5h2L11 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {active ? 'Drawing…' : 'Feedback'}
      </button>
      <button className="fb-panel-btn" onClick={onOpenPanel} title="Review all feedback">
        {openCount > 0 ? <span className="fb-count">{openCount}</span> : null}
      </button>
    </div>
  );
}

function FeedbackComposer({ box, onSave, onCancel }) {
  const [text, setText] = React.useState('');
  const ref = React.useRef(null);
  React.useEffect(() => { if (ref.current) ref.current.focus(); }, []);
  // clamp popup so it doesn't run off the right/bottom edge of the viewport
  const vx = Math.min(box.x - window.scrollX, window.innerWidth - 290);
  const vy = Math.min(box.y - window.scrollY + box.height + 8, window.innerHeight - 160);
  return (
    <div className="fb-composer" style={{ left: Math.max(8, vx), top: Math.max(8, vy) }} onMouseDown={e => e.stopPropagation()}>
      <textarea ref={ref} value={text} onChange={e => setText(e.target.value)}
        placeholder="What's wrong here, or what should change?"
        onKeyDown={e => { if (e.key === 'Escape') onCancel(); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSave(text); }} />
      <div className="fb-composer-actions">
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn primary" disabled={!text.trim()} onClick={() => onSave(text)}>Save</button>
      </div>
    </div>
  );
}

function FeedbackMarker({ item, scroll, onOpen }) {
  const box = item.box || {};
  const left = (box.x || 0) - scroll.x, top = (box.y || 0) - scroll.y;
  // skip rendering markers scrolled out of view (cheap perf guard, not critical)
  if (top < -200 || top > window.innerHeight + 200) return null;
  return (
    <div className="fb-marker-box" style={{ left: left, top: top, width: box.width || 0, height: box.height || 0 }} onClick={() => onOpen(item)}>
      <span className="fb-marker-dot">{item.id}</span>
    </div>
  );
}

function FeedbackDetailPopover({ item, onClose, onResolve, onDelete }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 380 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Feedback #{item.id}</h3>
          <p>{item.page}{item.context ? ' — near "' + item.context.split(' · ')[0] + '"' : ''}</p>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{item.comment}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, fontFamily: 'var(--mono)' }}>
            {item.author || 'unknown'} · {new Date(item.created_at).toLocaleString()} · {item.status}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={() => onDelete(item)} style={{ color: 'var(--red-ink)' }}>Delete</button>
          <button className="btn primary" onClick={() => onResolve(item)}>{item.status === 'open' ? 'Mark resolved' : 'Reopen'}</button>
        </div>
      </div>
    </div>
  );
}

function FeedbackPanel({ items, onClose, onResolve, onDelete }) {
  const [filter, setFilter] = React.useState('open');
  const shown = items.filter(i => filter === 'all' || i.status === filter);
  const byPage = {};
  shown.forEach(i => { const k = i.page || 'Unknown'; (byPage[k] = byPage[k] || []).push(i); });
  const pages = Object.keys(byPage).sort();

  const copyAll = () => {
    const lines = ['PRONEXUS UI FEEDBACK — ' + new Date().toLocaleDateString(), ''];
    pages.forEach(p => {
      lines.push('## ' + p);
      byPage[p].forEach(i => {
        lines.push('- [' + i.status + '] ' + i.comment.replace(/\n/g, ' '));
        if (i.context) lines.push('    near: ' + i.context);
        lines.push('    (' + (i.author || 'unknown') + ', ' + new Date(i.created_at).toLocaleDateString() + ')');
      });
      lines.push('');
    });
    const text = lines.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
    else { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
    alert('Copied ' + shown.length + ' item' + (shown.length === 1 ? '' : 's') + ' to clipboard — paste into your chat with Claude.');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 640, maxHeight: '82vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Feedback</h3>
          <p>{items.filter(i => i.status === 'open').length} open · {items.length} total across all screens</p>
        </div>
        <div className="modal-body" style={{ overflow: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {['open', 'resolved', 'all'].map(f => (
              <button key={f} className={'btn ghost' + (filter === f ? ' active' : '')} style={filter === f ? { background: 'var(--surface-3)', color: 'var(--ink)' } : null} onClick={() => setFilter(f)}>{f}</button>
            ))}
            <div style={{ marginLeft: 'auto' }}>
              <button className="btn primary" onClick={copyAll} disabled={!shown.length}>Copy all as text</button>
            </div>
          </div>
          {!shown.length ? <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: '20px 0', textAlign: 'center' }}>No {filter === 'all' ? '' : filter} feedback yet.</div> : null}
          {pages.map(p => (
            <div key={p} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'var(--mono)', marginBottom: 6 }}>{p}</div>
              {byPage[p].map(i => (
                <div key={i.id} style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--surface-2)', marginBottom: 6, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.4 }}>{i.comment}</div>
                  {i.context ? <div style={{ fontSize: 10.5, color: 'var(--muted)', fontFamily: 'var(--mono)', marginTop: 3 }}>near: {i.context}</div> : null}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--muted-2)', fontFamily: 'var(--mono)' }}>{i.author || 'unknown'} · {new Date(i.created_at).toLocaleDateString()}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <button className="btn ghost" style={{ padding: '3px 8px', fontSize: 10.5 }} onClick={() => onResolve(i)}>{i.status === 'open' ? 'Resolve' : 'Reopen'}</button>
                      <button className="btn ghost" style={{ padding: '3px 8px', fontSize: 10.5, color: 'var(--red-ink)' }} onClick={() => onDelete(i)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="modal-foot"><button className="btn ghost" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

function FeedbackLayer({ session }) {
  const [active, setActive] = React.useState(false);
  const [drag, setDrag] = React.useState(null); // {x0,y0,x1,y1} in page coords while dragging
  const [pendingBox, setPendingBox] = React.useState(null);
  const [items, setItems] = React.useState([]);
  const [scroll, setScroll] = React.useState({ x: window.scrollX, y: window.scrollY });
  const [showPanel, setShowPanel] = React.useState(false);
  const [openItem, setOpenItem] = React.useState(null);

  const refresh = React.useCallback(() => {
    if (!window.DB || !window.DB.listFeedback) return;
    window.DB.listFeedback().then(setItems).catch(() => {});
  }, []);
  React.useEffect(() => { refresh(); }, [refresh]);

  React.useEffect(() => {
    const onScroll = () => setScroll({ x: window.scrollX, y: window.scrollY });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && active) { setActive(false); setDrag(null); setPendingBox(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  if (!session) return null;
  const author = session.user && session.user.email;

  const onMouseDown = e => {
    if (e.button !== 0) return;
    setDrag({ x0: e.pageX, y0: e.pageY, x1: e.pageX, y1: e.pageY });
  };
  const onMouseMove = e => { if (drag) setDrag(d => ({ ...d, x1: e.pageX, y1: e.pageY })); };
  const onMouseUp = () => {
    if (!drag) return;
    const x = Math.min(drag.x0, drag.x1), y = Math.min(drag.y0, drag.y1);
    let width = Math.abs(drag.x1 - drag.x0), height = Math.abs(drag.y1 - drag.y0);
    if (width < 24 && height < 24) { width = Math.max(width, 60); height = Math.max(height, 30); } // treat a click as a small default box
    setDrag(null);
    setPendingBox({ x, y, width, height });
  };

  const saveComment = text => {
    const box = pendingBox;
    const context = sniffContext(box, '.fb-capture-layer, .fb-composer, .fb-marker-box, .fb-toggle-wrap');
    window.DB.addFeedback({
      page: currentScreenLabel(),
      comment: text.trim(),
      author: author,
      box: box,
      context: context,
      viewport: { w: window.innerWidth, h: window.innerHeight }
    }).then(() => { setPendingBox(null); refresh(); }).catch(e => { alert('Could not save feedback: ' + ((e && e.message) || e)); });
  };

  const resolveItem = item => {
    window.DB.setFeedbackStatus(item.id, item.status === 'open' ? 'resolved' : 'open').then(refresh);
    setOpenItem(null);
  };
  const deleteItem = item => {
    if (!confirm('Delete this feedback item?')) return;
    window.DB.deleteFeedback(item.id).then(refresh);
    setOpenItem(null);
  };

  const pageLabel = currentScreenLabel();
  const visibleMarkers = items.filter(i => i.page === pageLabel);
  const openCount = items.filter(i => i.status === 'open').length;

  const liveBox = drag ? { x: Math.min(drag.x0, drag.x1) - scroll.x, y: Math.min(drag.y0, drag.y1) - scroll.y, width: Math.abs(drag.x1 - drag.x0), height: Math.abs(drag.y1 - drag.y0) } : null;

  return (
    <>
      <FeedbackToggleButton active={active} openCount={openCount} onToggle={() => { setActive(a => !a); setDrag(null); setPendingBox(null); }} onOpenPanel={() => setShowPanel(true)} />

      {visibleMarkers.map(i => <FeedbackMarker key={i.id} item={i} scroll={scroll} onOpen={setOpenItem} />)}

      {active ? (
        <div className="fb-capture-layer" onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
          {liveBox ? <div className="fb-live-box" style={{ left: liveBox.x, top: liveBox.y, width: liveBox.width, height: liveBox.height }} /> : null}
        </div>
      ) : null}

      {pendingBox ? <FeedbackComposer box={pendingBox} onSave={saveComment} onCancel={() => setPendingBox(null)} /> : null}
      {showPanel ? <FeedbackPanel items={items} onClose={() => setShowPanel(false)} onResolve={resolveItem} onDelete={deleteItem} /> : null}
      {openItem ? <FeedbackDetailPopover item={openItem} onClose={() => setOpenItem(null)} onResolve={resolveItem} onDelete={deleteItem} /> : null}
    </>
  );
}

Object.assign(window, { FeedbackLayer });
