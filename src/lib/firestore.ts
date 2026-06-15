import {
  collection, doc, getDocs, getDoc, setDoc,
  query, where, orderBy, Timestamp, onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { F1Event, Driver, SessionResult, Tip, Score, AppUser } from '../types'

// Events
export async function getEvents(): Promise<F1Event[]> {
  const snap = await getDocs(query(collection(db, 'events'), orderBy('round')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as F1Event))
}

export function subscribeToEvents(cb: (events: F1Event[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'events'), orderBy('round')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as F1Event))),
    err => console.error('[Firestore] subscribeToEvents error:', err)
  )
}

// Drivers
export async function getDrivers(year: number): Promise<Driver[]> {
  const snap = await getDocs(query(collection(db, `drivers_${year}`), orderBy('name')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Driver))
}

// Session Results
export function subscribeToSessionResult(
  eventId: string,
  sessionType: string,
  cb: (r: SessionResult | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'session_results', `${eventId}_${sessionType}`), snap =>
    cb(snap.exists() ? (snap.data() as SessionResult) : null)
  )
}

// Tips
export async function saveTip(tip: Omit<Tip, 'lockedAt'>): Promise<void> {
  await setDoc(
    doc(db, 'tips', `${tip.userId}_${tip.eventId}_${tip.sessionType}`),
    { ...tip, updatedAt: Timestamp.now() },
    { merge: true }
  )
}

export function subscribeToEventTips(eventId: string, cb: (tips: Tip[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'tips'), where('eventId', '==', eventId)),
    snap => cb(snap.docs.map(d => d.data() as Tip))
  )
}

// Scores
export async function getScores(eventId: string): Promise<Score[]> {
  const snap = await getDocs(query(collection(db, 'scores'), where('eventId', '==', eventId)))
  return snap.docs.map(d => d.data() as Score)
}

export function subscribeToAllScores(cb: (scores: Score[]) => void): Unsubscribe {
  return onSnapshot(collection(db, 'scores'), snap =>
    cb(snap.docs.map(d => d.data() as Score))
  )
}

// Users
export async function getUsers(): Promise<AppUser[]> {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map(d => d.data() as AppUser)
}

export async function getEventSessionResults(eventId: string): Promise<SessionResult[]> {
  const snap = await getDocs(query(collection(db, 'session_results'), where('eventId', '==', eventId)))
  return snap.docs.map(d => d.data() as SessionResult)
}

export function subscribeToEventScores(eventId: string, cb: (scores: Score[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'scores'), where('eventId', '==', eventId)),
    snap => cb(snap.docs.map(d => d.data() as Score)),
    err => console.error('[Firestore] subscribeToEventScores error:', err)
  )
}

export function subscribeToEventSessionResults(eventId: string, cb: (results: SessionResult[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'session_results'), where('eventId', '==', eventId)),
    snap => cb(snap.docs.map(d => d.data() as SessionResult)),
    err => console.error('[Firestore] subscribeToEventSessionResults error:', err)
  )
}

export async function getSessionResult(
  eventId: string,
  sessionType: string
): Promise<SessionResult | null> {
  const snap = await getDoc(doc(db, 'session_results', `${eventId}_${sessionType}`))
  return snap.exists() ? (snap.data() as SessionResult) : null
}

export async function saveSessionResult(result: SessionResult): Promise<void> {
  await setDoc(doc(db, 'session_results', result.id), result)
}

export async function saveScore(score: Score): Promise<void> {
  await setDoc(doc(db, 'scores', score.id), score)
}

export async function getTipsForSession(
  eventId: string,
  sessionType: string
): Promise<Tip[]> {
  const snap = await getDocs(
    query(
      collection(db, 'tips'),
      where('eventId', '==', eventId),
      where('sessionType', '==', sessionType)
    )
  )
  return snap.docs.map(d => d.data() as Tip)
}
