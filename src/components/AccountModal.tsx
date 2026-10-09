import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth'
import { X, Mail, UserRound } from 'lucide-react'
import { auth } from '../lib/firebase'
import { authError } from '../lib/authErrors'
import { useAccount } from './AccountContext'
import './Account.css'

type Mode = 'login' | 'signup' | 'reset'
export default function AccountModal({ onClose, pending }: { onClose: () => void; pending: boolean }) {
  const { user, refresh } = useAccount()
  const [mode, setMode] = useState<Mode>('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; dialog.current?.showModal(); return () => { previous?.focus() } }, [])
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('')
    try { await action() } catch (cause) { setError(authError(cause)) } finally { setBusy(false) }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (mode === 'signup' && !name.trim()) { setError('Enter your name.'); return }
    void run(async () => {
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email.trim())
        setMessage('If an account uses this email, a password reset link will arrive shortly.')
      } else if (mode === 'signup') {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
        setPassword('')
        await updateProfile(credential.user, { displayName: name.trim() })
        await sendEmailVerification(credential.user)
        setMessage('Check your inbox for a verification link. Your browser data stays here until you choose to import it.')
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password)
        setPassword('')
        setMessage('Logged in. Your account data will load after email verification.')
      }
    })
  }
  return <dialog ref={dialog} className="account-dialog" aria-labelledby="account-title" onCancel={event => { if (busy) event.preventDefault(); else onClose() }} onClick={event => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <div className="account-modal">
      <button className="account-close" aria-label="Close account" disabled={busy} onClick={onClose}><X size={20} /></button>
      <div className="account-mark"><UserRound size={24} /></div>
      <h2 id="account-title">{user ? user.emailVerified ? 'Your profile' : 'Verify your email' : mode === 'signup' ? 'Create your profile' : mode === 'reset' ? 'Reset your password' : 'Welcome back'}</h2>
      <p className="account-description">{user ? user.email : 'Keep your training history with you on every device.'}</p>
      {user ? <div className="account-details">
        <strong>{user.displayName || 'My training'}</strong>
        {!user.emailVerified ? <><p><Mail size={17} /> Open the verification link in your inbox, then check your status below.</p><button className="button button-primary" disabled={busy} onClick={() => void run(async () => { await refresh(); setMessage(auth.currentUser?.emailVerified ? 'Email verified. Your cloud workspace is ready.' : 'Your email is not verified yet. Open the link in your inbox first.') })}>I’ve verified my email</button><button className="button button-outline" disabled={busy} onClick={() => void run(async () => { await sendEmailVerification(user); setMessage('Verification email sent. Check your inbox and spam folder.') })}>Resend verification email</button></> : <p>Your email is verified. Your training is saved to your account when cloud saving succeeds.</p>}
        <button className="button button-outline" disabled={busy} onClick={() => void run(async () => { await sendPasswordResetEmail(auth, user.email!); setMessage('Password reset email sent.') })}>Send password reset email</button>
        <button className="button button-outline" disabled={busy || pending} onClick={() => void run(async () => { await signOut(auth); onClose() })}>Log out</button>
        {pending && <small>Wait for the current save to finish before logging out.</small>}
      </div> : <>
        {mode !== 'reset' && <div className="account-tabs"><button disabled={busy} aria-pressed={mode === 'signup'} onClick={() => { setMode('signup'); setError(''); setMessage('') }}>Create profile</button><button disabled={busy} aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(''); setMessage('') }}>Log in</button></div>}
        <form onSubmit={submit}>
          {mode === 'signup' && <label>Name<input required maxLength={80} value={name} autoComplete="name" onChange={event => setName(event.target.value)} /></label>}
          <label>Email<input type="email" required maxLength={254} value={email} autoComplete="email" onChange={event => setEmail(event.target.value)} /></label>
          {mode !== 'reset' && <label>Password<input type="password" required minLength={mode === 'signup' ? 8 : undefined} value={password} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} onChange={event => setPassword(event.target.value)} />{mode === 'signup' && <small>Use at least 8 characters.</small>}</label>}
          <button className="button button-primary" disabled={busy} type="submit">{busy ? 'Please wait…' : mode === 'signup' ? 'Create profile' : mode === 'reset' ? 'Send reset link' : 'Log in'}</button>
        </form>
        <button className="account-link" disabled={busy} onClick={() => { setMode(mode === 'reset' ? 'login' : 'reset'); setError(''); setMessage(''); setPassword('') }}>{mode === 'reset' ? 'Back to login' : 'Forgot password?'}</button>
      </>}
      {error && <p className="account-error" role="alert">{error}</p>}
      {message && <p className="account-message" role="status">{message}</p>}
    </div>
  </dialog>
}
