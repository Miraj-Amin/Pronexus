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

  const model = preview ? fmt.computeModel(preview) : null;

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

              {state === 'ready' && preview && model ? (
                <div>
                  <div className="field">
                    <label>Scheme name</label>
                    <input autoFocus value={name} onChange={e => setName(e.target.value)} />
                  </div>
                  <div className="fieldrow" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <div><div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>GDV</div><div className="derived">{fmt.money(model.ratios.gdv)}</div></div>
                    <div><div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Units</div><div className="derived">{preview.phases.reduce((a, x) => a + x.units, 0)}</div></div>
                    <div><div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Profit</div><div className="derived" style={{ color: model.ratios.profit > 0 ? 'var(--green-700)' : 'var(--red-600, #d33)' }}>{fmt.money(model.ratios.profit)}</div></div>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 10 }}>{preview.project.address || 'No address found'}{preview.project.planningRef ? ' · ' + preview.project.planningRef : ''}</div>
                  {model.flags.length ? (
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
          <button className="btn primary" disabled={state !== 'ready' || !name.trim()}
            style={{ opacity: (state === 'ready' && name.trim()) ? 1 : .5 }}
            onClick={() => { preview.project.name = name.trim(); onImport(preview); }}>
            Import scheme
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ImportModal });
