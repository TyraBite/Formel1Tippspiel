import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { AppUser } from '../types'

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const ref = doc(db, 'users', firebaseUser.uid)
        const snap = await getDoc(ref)
        if (snap.exists()) {
          setUser(snap.data() as AppUser)
        } else {
          const appUser: AppUser = {
            id: firebaseUser.uid,
            email: firebaseUser.email!,
            displayName: firebaseUser.displayName ?? firebaseUser.email!.split('@')[0],
          }
          await setDoc(ref, appUser)
          setUser(appUser)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
  }, [])

  return {
    user,
    loading,
    login: (email: string, password: string) => signInWithEmailAndPassword(auth, email, password),
    logout: () => signOut(auth),
  }
}
