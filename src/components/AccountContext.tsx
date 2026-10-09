import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onIdTokenChanged, type User } from 'firebase/auth'
import { auth } from '../lib/firebase'

type Account = { user: User | null; loading: boolean; refresh: () => Promise<void> }
const AccountContext = createContext<Account | null>(null)
export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [, setVersion] = useState(0)
  useEffect(() => onIdTokenChanged(auth, next => { setUser(next); setLoading(false); setVersion(version => version + 1) }), [])
  const refresh = async () => {
    if (!auth.currentUser) return
    await auth.currentUser.reload()
    await auth.currentUser.getIdToken(true)
    // Firebase mutates User in place; force a context update after reload.
    setUser(auth.currentUser)
    setVersion(version => version + 1)
    setLoading(false)
  }
  return <AccountContext.Provider value={{ user, loading, refresh }}>{children}</AccountContext.Provider>
}
export function useAccount() {
  const account = useContext(AccountContext)
  if (!account) throw new Error('AccountProvider is required')
  return account
}
