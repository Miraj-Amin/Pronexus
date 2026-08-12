/* Phoenix Development Finance — module shell (mounted from app.jsx inside the persistent shell) */
class PhdErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Development Finance module render error:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="phxb-panel" style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: 'var(--red-ink)', marginBottom: 8 }}>
            This screen hit an error and couldn't render.
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', marginBottom: 16, wordBreak: 'break-word' }}>
            {String((this.state.error && this.state.error.message) || this.state.error)}
          </div>
          <button className="phxb-btn primary" onClick={() => { this.setState({ error: null }); this.props.onReset && this.props.onReset(); }}>
            {this.props.resetLabel || 'Reset'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PhoenixDevelopmentApp({ accounts, presetAccount, onConsumePreset, onOpenAccount, initialDealId, onDealOpened }) {
  const [openDealId, setOpenDealId] = React.useState(initialDealId || null);
  const DB = window.PhoenixDevelopmentDB;
  const [roleTick, setRoleTick] = React.useState(0);
  const user = DB.currentUser();

  React.useEffect(() => { if (initialDealId) { setOpenDealId(initialDealId); if (onDealOpened) onDealOpened(); } }, [initialDealId]);

  return (
    <div className="phxb">
      <div className="phxb-topbar">
        <div className="phxb-brand"><div className="mk">DV</div>Development Finance <span style={{ opacity: .5, fontWeight: 400 }}>· Placement Broker, Enquiry to First Drawdown</span></div>
        <div className="phxb-spacer" />
        <select value={user.activeRole} onChange={e => { DB.setActiveRole(e.target.value); setRoleTick(t => t + 1); }}
          style={{ background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: 11, padding: '6px 10px', borderRadius: 5 }}
          title="Acting role — demo role switcher">
          {user.roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {openDealId ? <button className="phxb-btn" onClick={() => setOpenDealId(null)}>Pipeline</button> : null}
      </div>
      <div className="phxb-main">
        <PhdErrorBoundary resetLabel="← Back to pipeline" onReset={() => setOpenDealId(null)}>
          {openDealId
            ? <window.PhdDealWorkspace dealId={openDealId} onBack={() => setOpenDealId(null)} onOpenAccount={onOpenAccount} />
            : <window.PhdDashboard onOpenDeal={setOpenDealId} accounts={accounts} presetAccountId={presetAccount ? presetAccount.accountId : null} onConsumePreset={onConsumePreset} />}
        </PhdErrorBoundary>
      </div>
    </div>
  );
}

window.PhoenixDevelopmentApp = PhoenixDevelopmentApp;
