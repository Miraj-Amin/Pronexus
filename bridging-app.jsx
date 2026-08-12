/* Phoenix Bridging — module shell (mounted from app.jsx) */
/* Local error boundary — bridging-app.jsx compiles in its own Babel-standalone
   scope, so app.jsx's TabErrorBoundary (a top-level, non-window declaration)
   isn't reachable here. Keeping a scoped copy avoids editing app.jsx further
   and keeps this module's failure blast radius contained to itself. */
class PhxErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Bridging module render error:', error, info); }
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

function PhoenixBridgingApp({ onBackToPortfolio }) {
  const [openDealId, setOpenDealId] = React.useState(null);

  return (
    <div className="phxb">
      <div className="phxb-topbar">
        <div className="phxb-brand"><div className="mk">PB</div>Phoenix Bridging <span style={{ opacity: .5, fontWeight: 400 }}>· Brokerage Deal Management</span></div>
        <div className="phxb-spacer" />
        {openDealId ? <button className="phxb-btn" onClick={() => setOpenDealId(null)}>Pipeline</button> : null}
        <button className="phxb-btn" onClick={onBackToPortfolio}>← Appraisal portfolio</button>
      </div>
      <div className="phxb-main">
        <PhxErrorBoundary resetLabel="← Back to pipeline" onReset={() => setOpenDealId(null)}>
          {openDealId
            ? <window.PhxDealWorkspace dealId={openDealId} onBack={() => setOpenDealId(null)} />
            : <window.PhxDashboard onOpenDeal={setOpenDealId} />}
        </PhxErrorBoundary>
      </div>
    </div>
  );
}

window.PhoenixBridgingApp = PhoenixBridgingApp;
