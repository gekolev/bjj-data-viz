import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme.css'
import App from './App.tsx'
import { AccountProvider, useAccount } from './components/AccountContext'
import './components/Account.css'
import { initializeAnalytics, setAnalyticsUser } from './lib/firebase'

void initializeAnalytics()

function AccountWorkspace() {
  const { user, loading } = useAccount()
  useEffect(() => setAnalyticsUser(user?.uid ?? null), [user?.uid])
  if (loading) return <div className="account-loading" role="status">Loading workspace…</div>
  return <App key={user?.emailVerified ? user.uid : 'guest'} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountProvider><AccountWorkspace /></AccountProvider>
  </StrictMode>,
)
