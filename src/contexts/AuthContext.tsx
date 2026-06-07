import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { AppUser } from '../types'

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<any>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const ref = doc(db, 'users', firebaseUser.uid)
        const snap = await getDoc(ref)
        if (!active) return
        if (snap.exists()) {
          setUser(snap.data() as AppUser)
        } else {
          const appUser: AppUser = {
            id: firebaseUser.uid,
            email: firebaseUser.email!,
            displayName: firebaseUser.displayName ?? firebaseUser.email!.split('@')[0],
          }
          await setDoc(ref, appUser)
          if (!active) return
          setUser(appUser)
        }
      } else {
        if (active) setUser(null)
      }
      if (active) setLoading(false)
    })
    return () => { active = false; unsub() }
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login: (email, password) => signInWithEmailAndPassword(auth, email, password),
      logout: () => signOut(auth),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
