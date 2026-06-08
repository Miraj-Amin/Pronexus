/* Auth — session hook + login / sign-up screen (shared team workspace).
   Open sign-up, no email confirmation: a new account logs straight in. */

function useSession() {
  // undefined = still checking; null = signed out; object = signed in
  const [session, setSession] = React.useState(undefined);
  React.useEffect(() => {
    let mounted = true;
    if (!window.sb) { setSession(null); return; }
    window.sb.auth.getSession().then(({ data }) => { if (mounted) setSession(data.session || null); });
    const { data: sub } = window.sb.auth.onAuthStateChange((_evt, s) => { if (mounted) setSession(s); });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);
  return session;
}

function Splash({ label }) {
  return (
    <div className="bootsplash">
      <div className="boot-mark">P</div>
      <div className="boot-spin"></div>
      <div className="boot-label">{label || 'Loading…'}</div>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = React.useState('signin');
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [notice, setNotice] = React.useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setNotice('');
    if (!email.trim() || !pw) { setErr('Enter your email and password.'); return; }
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await window.sb.auth.signUp({ email: email.trim(), password: pw });
        if (error) throw error;
        if (!data.session) {
          setNotice('Account created. If email confirmation is on, check your inbox, then sign in.');
          setMode('signin');
        }
        // with confirmation off, a session is returned and onAuthStateChange routes in
      } else {
        const { error } = await window.sb.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) throw error;
      }
    } catch (e2) {
      setErr(e2 && e2.message ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="authwrap">
      <div className="auth-grid"></div>
      <form className="authcard" onSubmit={submit}>
        <span className="cn tl"></span><span className="cn tr"></span><span className="cn bl"></span><span className="cn br"></span>
        <div className="auth-brand">
          <div className="auth-mark">P</div>
          <div>
            <div className="auth-name">PHOENIX</div>
            <div className="auth-tag">Development Appraisal</div>
          </div>
        </div>

        <div className="auth-head">{mode === 'signup' ? 'Create your account' : 'Sign in'}</div>
        <div className="auth-sub">{mode === 'signup' ? 'Join the shared workspace — you\u2019ll see every scheme.' : 'Access the shared appraisal workspace.'}</div>

        <div className="auth-field">
          <label>Email</label>
          <input type="email" autoComplete="email" autoFocus value={email} placeholder="you@company.com" onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="auth-field">
          <label>Password</label>
          <input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={pw} placeholder={mode === 'signup' ? 'Choose a password (min 6 chars)' : 'Your password'} onChange={e => setPw(e.target.value)} />
        </div>

        {err ? <div className="auth-msg err">{err}</div> : null}
        {notice ? <div className="auth-msg ok">{notice}</div> : null}

        <button className="btn primary auth-submit" type="submit" disabled={busy}>
          {busy ? 'Working…' : (mode === 'signup' ? 'Create account & enter' : 'Sign in')}
        </button>

        <div className="auth-switch">
          {mode === 'signup'
            ? <span>Already have an account? <button type="button" onClick={() => { setMode('signin'); setErr(''); setNotice(''); }}>Sign in</button></span>
            : <span>New here? <button type="button" onClick={() => { setMode('signup'); setErr(''); setNotice(''); }}>Create an account</button></span>}
        </div>
      </form>
      <div className="auth-foot">Secured by Supabase · data syncs across everyone on the team</div>
    </div>
  );
}

Object.assign(window, { useSession, AuthScreen, Splash });
