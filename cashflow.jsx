/* Editable monthly cashflow table. Category rows × month columns.
   Editing a cell writes an override (state.overrides) that replaces the spread
   default; interest + balance rows recompute live and are read-only. */
const cfFmt = window.Appraisal;

function CfCell({ value, overridden, onCommit, readOnly, neg }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  if (readOnly) {
    return <td className={'cfcell ro' + (neg && value < 0 ? ' negv' : '')}>{value ? cfFmt.moneyShort(value) : '–'}</td>;
  }
  if (editing) {
    return (
      <td className="cfcell editing">
        <input autoFocus className="num" value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { onCommit(draft); setEditing(false); }}
          onKeyDown={e => { if (e.key === 'Enter') { onCommit(draft); setEditing(false); } if (e.key === 'Escape') setEditing(false); }} />
      </td>
    );
  }
  return (
    <td className={'cfcell' + (overridden ? ' ov' : '')}
      onClick={() => { setDraft(value ? Math.round(value).toString() : ''); setEditing(true); }}
      title={overridden ? 'Edited — overrides the calculated value' : 'Click to edit'}>
      {value ? cfFmt.moneyShort(value) : <span className="zero">–</span>}
      {overridden ? <span className="ovdot"></span> : null}
    </td>
  );
}

function CashflowTable({ state, model, set }) {
  const cf = model.cashflow;
  const H = cf.horizon;
  const cats = model.categories;
  const months = [];
  for (let m = 1; m <= H; m++) months.push(m);
  const anyOverride =
    Object.keys((state.overrides && state.overrides.cost) || {}).length ||
    Object.keys((state.overrides && state.overrides.income) || {}).length ||
    Object.keys((state.overrides && state.overrides.equity) || {}).length;

  const commit = (kind, catId, m, raw) => {
    const n = parseFloat(String(raw).replace(/[^0-9.\-]/g, ''));
    set(s => { window.Appraisal.setOverride(s, kind, catId, m, isNaN(n) ? 0 : n); });
  };
  const interestLineId = state.costLines.filter(l => l.basis === 'computed_interest')[0];

  return (
    <div>
      <div className="cf-toolbar">
        <div className="cf-tb-l">
          <div className="cf-tb-title">Monthly Cashflow</div>
          <div className="cf-tb-sub">{H} months · click any cost / income / equity cell to override. Interest &amp; balance recompute automatically.</div>
        </div>
        <div className="cf-tb-r">
          <div className="cf-legendpill"><span className="ovdot"></span>edited cell</div>
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
              if (c.id === 14) {
                // finance row — interest is computed; show read-only
                return (
                  <tr key={c.id} className="catrow">
                    <td className="rowhead sticky-l"><span className="catnum">{c.id}</span>{c.name}</td>
                    {months.map(m => {
                      const interest = cf.rows[m - 1] ? cf.rows[m - 1].interest : 0;
                      const nonInterest = cf.catMonthly[c.id][m];
                      const val = nonInterest; // overridable finance fees
                      return <CfCell key={m} value={val} overridden={window.Appraisal.isOverridden(state, 'cost', c.id, m)} onCommit={raw => commit('cost', c.id, m, raw)} />;
                    })}
                    <td className="totcol num">{cfFmt.moneyShort(rowTotal)}</td>
                  </tr>
                );
              }
              return (
                <tr key={c.id} className="catrow">
                  <td className="rowhead sticky-l"><span className="catnum">{c.id}</span>{c.name}</td>
                  {months.map(m => (
                    <CfCell key={m} value={cf.catMonthly[c.id][m]}
                      overridden={window.Appraisal.isOverridden(state, 'cost', c.id, m)}
                      onCommit={raw => commit('cost', c.id, m, raw)} />
                  ))}
                  <td className="totcol num">{cfFmt.moneyShort(rowTotal)}</td>
                </tr>
              );
            })}
            <tr className="subtotalrow">
              <td className="rowhead sticky-l">Total Expenditure</td>
              {months.map(m => <td key={m} className="num">{cfFmt.moneyShort(cf.rows[m - 1].expenditure)}</td>)}
              <td className="totcol num">{cfFmt.moneyShort(cf.totals.expenditure)}</td>
            </tr>

            {/* interest (computed) */}
            <tr className="catrow computed">
              <td className="rowhead sticky-l"><span className="catnum lock">∑</span>Bank Interest <span className="cf-auto">auto</span></td>
              {months.map(m => <CfCell key={m} value={cf.rows[m - 1].interest} readOnly={true} />)}
              <td className="totcol num">{cfFmt.moneyShort(cf.totalInterest)}</td>
            </tr>

            {/* funding header */}
            <tr className="grouprow"><td className="rowhead sticky-l" colSpan={H + 2}>Funding &amp; Income</td></tr>
            <tr className="catrow">
              <td className="rowhead sticky-l"><span className="catnum eq">E</span>Equity Drawn</td>
              {months.map(m => (
                <CfCell key={m} value={cf.equity[m]} overridden={window.Appraisal.isOverridden(state, 'equity', null, m)}
                  onCommit={raw => commit('equity', null, m, raw)} />
              ))}
              <td className="totcol num">{cfFmt.moneyShort(cf.totals.equity)}</td>
            </tr>
            <tr className="catrow income">
              <td className="rowhead sticky-l"><span className="catnum inc">S</span>Sales Income</td>
              {months.map(m => (
                <CfCell key={m} value={cf.income[m]} overridden={window.Appraisal.isOverridden(state, 'income', null, m)}
                  onCommit={raw => commit('income', null, m, raw)} />
              ))}
              <td className="totcol num">{cfFmt.moneyShort(cf.totals.income)}</td>
            </tr>

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
