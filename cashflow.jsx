/* Editable monthly cashflow table. Category rows × month columns, each
   category expandable into its individual cost-line rows — matching the
   line-by-line detail of the source spreadsheet's Cashflow sheet.
   Both category totals AND individual line cells are directly editable and
   write to state.overrides (kind 'cost' for a category, kind 'line' for a
   single cost line). If both are set for the same month, the category-level
   edit wins (it's a deliberate "type one number for the whole category"
   action) — editing individual lines is the normal way to amend a figure.
   Interest + balance rows recompute live and stay read-only. */
const cfFmt = window.Appraisal;

function CfCell({ value, overridden, onCommit, readOnly, neg, muted }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  if (readOnly) {
    return <td className={'cfcell ro' + (neg && value < 0 ? ' negv' : '') + (muted ? ' linecell' : '')}>{value ? cfFmt.moneyShort(value) : '–'}</td>;
  }
  if (editing) {
    return (
      <td className={'cfcell editing' + (muted ? ' linecell' : '')}>
        <input autoFocus className="num" value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { onCommit(draft); setEditing(false); }}
          onKeyDown={e => { if (e.key === 'Enter') { onCommit(draft); setEditing(false); } if (e.key === 'Escape') setEditing(false); }} />
      </td>
    );
  }
  return (
    <td className={'cfcell' + (overridden ? ' ov' : '') + (muted ? ' linecell' : '')}
      onClick={() => { setDraft(value ? Math.round(value).toString() : ''); setEditing(true); }}
      title={overridden ? 'Edited — overrides the calculated value' : 'Click to edit'}>
      {value ? cfFmt.moneyShort(value) : <span className="zero">–</span>}
      {overridden ? <span className="ovdot"></span> : null}
    </td>
  );
}

function lineBasisLabel(l) {
  if (l.sdlt) return 'SDLT (tiered)';
  if (l.basis === 'fixed') return 'fixed';
  if (l.basis === 'pct_land') return (l.pct * 100).toFixed(2) + '% land';
  if (l.basis === 'pct_gdv') return (l.pct * 100).toFixed(2) + '% GDV';
  if (l.basis === 'pct_construction') return (l.pct * 100).toFixed(2) + '% constr.';
  if (l.basis === 'pct_loan') return (l.pct * 100).toFixed(2) + '% loan';
  if (l.basis === 'per_unit') return cfFmt.money(l.rate) + '/unit';
  if (l.basis === 'construction') return 'build cost';
  return l.basis;
}

function CashflowTable({ state, model, set }) {
  const cf = model.cashflow;
  const H = cf.horizon;
  const cats = model.categories;
  const months = [];
  for (let m = 1; m <= H; m++) months.push(m);
  const anyOverride =
    Object.keys((state.overrides && state.overrides.cost) || {}).length ||
    Object.keys((state.overrides && state.overrides.line) || {}).length ||
    Object.keys((state.overrides && state.overrides.income) || {}).length ||
    Object.keys((state.overrides && state.overrides.equity) || {}).length;

  const [collapsed, setCollapsed] = React.useState({});
  const [detail, setDetail] = React.useState(true); // show line-item breakdown

  const commit = (kind, catId, m, raw) => {
    const n = parseFloat(String(raw).replace(/[^0-9.\-]/g, ''));
    set(s => { window.Appraisal.setOverride(s, kind, catId, m, isNaN(n) ? 0 : n); });
  };
  const toggleCat = id => setCollapsed(c => ({ ...c, [id]: !c[id] }));
  const allCollapsed = cats.every(c => collapsed[c.id]);

  return (
    <div>
      <div className="cf-toolbar">
        <div className="cf-tb-l">
          <div className="cf-tb-title">Monthly Cashflow</div>
          <div className="cf-tb-sub">{H} months · click any category OR line-item cell to amend it directly. Interest &amp; balance recompute automatically.</div>
        </div>
        <div className="cf-tb-r">
          <div className="cf-legendpill"><span className="ovdot"></span>edited cell</div>
          <button className="btn ghost" onClick={() => setDetail(d => !d)}>{detail ? 'Hide' : 'Show'} line detail</button>
          {detail ? (
            <button className="btn ghost" onClick={() => {
              const next = {}; cats.forEach(c => { next[c.id] = !allCollapsed; }); setCollapsed(next);
            }}>{allCollapsed ? 'Expand all' : 'Collapse all'}</button>
          ) : null}
          <button className="btn" disabled={!anyOverride} style={{ opacity: anyOverride ? 1 : .45 }}
            onClick={() => { if (confirm('Clear all manual cashflow edits and revert to calculated values?')) set(s => window.Appraisal.clearOverrides(s)); }}>
            ↺ Reset edits
          </button>
        </div>
      </div>

      <div className="cf-tablewrap">
        <table className="cftbl">
          <thead>
            <tr>
              <th className="rowhead sticky-l">£ / month</th>
              {months.map(m => <th key={m} className={'mcol' + (m === cf.peakMonth ? ' peak' : '')}>M{m}</th>)}
              <th className="totcol">Total</th>
            </tr>
          </thead>
          <tbody>
            {/* expenditure header */}
            <tr className="grouprow"><td className="rowhead sticky-l" colSpan={H + 2}>Expenditure</td></tr>
            {cats.map(c => {
              const rowTotal = cf.catTotals[c.id];
              const lines = (model.byCat[c.id] ? model.byCat[c.id].lines : []).filter(l => l.basis !== 'computed_interest');
              const isOpen = detail && !collapsed[c.id];
              return (
                <React.Fragment key={c.id}>
                  <tr className="catrow">
                    <td className="rowhead sticky-l">
                      {detail && lines.length ? (
                        <button className="cf-caret" onClick={() => toggleCat(c.id)} title={isOpen ? 'Collapse' : 'Expand'}>{isOpen ? '▾' : '▸'}</button>
                      ) : <span className="cf-caret ph"></span>}
                      <span className="catnum">{c.id}</span>{c.name}
                    </td>
                    {months.map(m => (
                      <CfCell key={m} value={cf.catMonthly[c.id][m]}
                        overridden={window.Appraisal.isOverridden(state, 'cost', c.id, m)}
                        onCommit={raw => commit('cost', c.id, m, raw)} />
                    ))}
                    <td className="totcol num">{cfFmt.moneyShort(rowTotal)}</td>
                  </tr>
                  {isOpen ? lines.map(l => (
                    <tr key={l.id} className={'linerow' + (l.included ? '' : ' excluded')}>
                      <td className="rowhead sticky-l linelabel" title={lineBasisLabel(l)}>
                        <span className="lineitem">{l.item}</span>
                        <span className="linebasis">{lineBasisLabel(l)}{!l.included ? ' · excluded' : ''}</span>
                      </td>
                      {months.map(m => (
                        <CfCell key={m} value={cf.lineMonthly[l.id][m]}
                          overridden={window.Appraisal.isOverridden(state, 'line', l.id, m)}
                          onCommit={raw => commit('line', l.id, m, raw)} muted />
                      ))}
                      <td className="totcol num linetotal">{cfFmt.moneyShort(cf.lineTotals[l.id])}</td>
                    </tr>
                  )) : null}
                </React.Fragment>
              );
            })}
            <tr className="subtotalrow">
              <td className="rowhead sticky-l">Total Expenditure</td>
              {months.map(m => <td key={m} className="num">{cfFmt.moneyShort(cf.rows[m - 1].expenditure)}</td>)}
              <td className="totcol num">{cfFmt.moneyShort(cf.totals.expenditure)}</td>
            </tr>

            {/* interest (computed) */}
            <tr className="catrow computed">
              <td className="rowhead sticky-l"><span className="cf-caret ph"></span><span className="catnum lock">∑</span>Bank Interest <span className="cf-auto">auto</span></td>
              {months.map(m => <CfCell key={m} value={cf.rows[m - 1].interest} readOnly={true} />)}
              <td className="totcol num">{cfFmt.moneyShort(cf.totalInterest)}</td>
            </tr>

            {/* funding header */}
            <tr className="grouprow"><td className="rowhead sticky-l" colSpan={H + 2}>Funding &amp; Income</td></tr>
            <tr className="catrow">
              <td className="rowhead sticky-l"><span className="cf-caret ph"></span><span className="catnum eq">E</span>Equity Drawn</td>
              {months.map(m => (
                <CfCell key={m} value={cf.equity[m]} overridden={window.Appraisal.isOverridden(state, 'equity', null, m)}
                  onCommit={raw => commit('equity', null, m, raw)} />
              ))}
              <td className="totcol num">{cfFmt.moneyShort(cf.totals.equity)}</td>
            </tr>
            <tr className="catrow income">
              <td className="rowhead sticky-l"><span className="cf-caret ph"></span><span className="catnum inc">S</span>Sales Income</td>
              {months.map(m => (
                <CfCell key={m} value={cf.income[m]} overridden={window.Appraisal.isOverridden(state, 'income', null, m)}
                  onCommit={raw => commit('income', null, m, raw)} />
              ))}
              <td className="totcol num">{cfFmt.moneyShort(cf.totals.income)}</td>
            </tr>
            {detail ? state.phases.filter(p => cfFmt.phaseGdv(p) > 0).map(p => {
              const g = cfFmt.phaseGdv(p);
              const arr = []; for (let m = 0; m <= H; m++) arr.push(0);
              if (p.salesStart && p.salesEnd) {
                const lo = Math.min(p.salesStart, p.salesEnd), hi = Math.max(p.salesStart, p.salesEnd);
                const per = g / (hi - lo + 1);
                for (let m = lo; m <= hi; m++) if (m >= 1 && m <= H) arr[m] = per;
              }
              return (
                <tr key={p.id} className="linerow">
                  <td className="rowhead sticky-l linelabel"><span className="lineitem">{p.name || p.id}</span><span className="linebasis">sales income</span></td>
                  {months.map(m => <CfCell key={m} value={arr[m]} readOnly muted />)}
                  <td className="totcol num linetotal">{cfFmt.moneyShort(g)}</td>
                </tr>
              );
            }) : null}

            {/* balance (computed) */}
            <tr className="balancerow">
              <td className="rowhead sticky-l">Cumulative Debt (closing) <span className="cf-auto">auto</span></td>
              {months.map(m => {
                const b = cf.rows[m - 1].balance;
                return <td key={m} className={'num' + (m === cf.peakMonth ? ' peakcell' : '') + (b < 0 ? ' negv' : '')}>{cfFmt.moneyShort(b)}</td>;
              })}
              <td className="totcol num">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="cf-foot">
        <div className="cf-foot-stat"><div className="l">Peak Funding</div><div className="v">{cfFmt.money(cf.peak)}</div><div className="s">month {cf.peakMonth}</div></div>
        <div className="cf-foot-stat"><div className="l">Total Interest</div><div className="v">{cfFmt.money(cf.totalInterest)}</div><div className="s">{cfFmt.pct(model.ratios.financeCost ? cf.totalInterest / model.ratios.totalCost : 0)} of cost</div></div>
        <div className="cf-foot-stat"><div className="l">Total Expenditure</div><div className="v">{cfFmt.money(cf.totals.expenditure)}</div><div className="s">excl. interest</div></div>
        <div className="cf-foot-stat"><div className="l">Total Income</div><div className="v">{cfFmt.money(cf.totals.income)}</div><div className="s">{cfFmt.money(model.ratios.gdv)} GDV</div></div>
        <div className="cf-foot-stat"><div className="l">Closing Position</div><div className="v" style={{ color: cf.rows[H - 1].balance <= 1000 ? 'var(--green-600)' : 'var(--red)' }}>{cfFmt.money(cf.rows[H - 1].balance)}</div><div className="s">end of month {H}</div></div>
      </div>
    </div>
  );
}

Object.assign(window, { CashflowTable });
