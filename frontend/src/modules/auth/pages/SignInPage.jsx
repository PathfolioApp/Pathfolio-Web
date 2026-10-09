import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { Footer } from '../../../components/layout/Footer';
import './AuthPages.css';

// Network/CORS failures arrive as browser TypeErrors or raw transport strings;
// they are never actionable for the user, so map them to friendly copy while
// keeping genuine API validation messages untouched.
const friendlyAuthError = err => {
  const raw = String(err?.message || '');
  if (/failed to fetch|networkerror|load failed|origin .* is not allowed|err_name_not_resolved|err_connection/i.test(raw)) {
    return 'Cannot reach PathfolioApp right now. Check your connection and try again in a moment.';
  }
  return raw || 'Sign in failed. Please try again.';
};
export function SignInPage() { const { login } = useAuth(); const navigate = useNavigate(); const [params] = useSearchParams(); const portal = params.get('portal') || 'student'; const portalLabel = portal === 'admin' ? 'Admin portal' : portal === 'recruiter' ? 'Recruiter portal' : 'Student portal'; const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [show, setShow] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
 const submit = async e => { e.preventDefault(); if (!email || !password) return setError('Enter your email and password.'); setBusy(true); setError(''); try { const student = await login(email, password); navigate(student?.isAdmin ? '/admin' : student?.isRecruiter ? '/recruiter' : student?.onboarding?.completed ? '/dashboard' : '/onboarding'); } catch (err) { setError(friendlyAuthError(err)); } finally { setBusy(false); } };
 return <div className="pf-auth-shell"><main className="pf-auth-page"><form className="pf-auth-card" onSubmit={submit}><Link to="/" className="pf-auth-brand">Pathfolio<span>App</span></Link><p className="editorial-eyebrow">{portalLabel}</p><h1>Welcome back.</h1><p>{portal === 'student' ? 'Continue building your journey.' : `Sign in to the ${portalLabel.toLowerCase()}.`}</p>{error && <div className="pf-auth-error" role="alert">{error}</div>}<label>Email<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label><label>Password<div className="pf-auth-password"><input type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /><button type="button" aria-label="Show or hide password" onClick={() => setShow(!show)}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label><Link className="pf-auth-forgot" to="/forgot-password">Forgot password?</Link><button className="pf-auth-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>{portal === 'student' && <p className="pf-auth-foot">New to Pathfolio? <Link to="/onboarding">Begin your journey</Link></p>}</form></main><Footer /></div>; }
