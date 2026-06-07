import { initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator, setDoc, doc, Timestamp } from 'firebase/firestore'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth'
import seasonData from '../data/season-2026.json'

const app = initializeApp({ projectId: 'demo-f1-tipping' })
const db = getFirestore(app)
const auth = getAuth(app)
connectFirestoreEmulator(db, 'localhost', 8080)
connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })

function ts(iso: string) { return Timestamp.fromDate(new Date(iso)) }

async function seed() {
  console.log('Seeding drivers...')
  for (const driver of seasonData.drivers) {
    await setDoc(doc(db, 'drivers', driver.id), driver)
  }

  console.log('Seeding users...')
  const users = [
    { email: 'spieler1@f1tipping.local', password: 'test1234', displayName: 'Spieler 1' },
    { email: 'spieler2@f1tipping.local', password: 'test1234', displayName: 'Spieler 2' },
  ]
  for (const u of users) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, u.email, u.password)
      await setDoc(doc(db, 'users', cred.user.uid), {
        id: cred.user.uid, email: u.email, displayName: u.displayName,
      })
    } catch { /* already exists */ }
  }

  console.log('Seeding events...')
  // Normal weekend
  await setDoc(doc(db, 'events', 'bahrain_2026'), {
    id: 'bahrain_2026', round: 1, name: 'Bahrain Grand Prix',
    circuit: 'Bahrain International Circuit', country: 'Bahrain',
    isSprintWeekend: false,
    sessions: {
      fp1: { startTime: ts('2026-03-13T11:30:00Z'), endTime: ts('2026-03-13T12:30:00Z'), status: 'official' },
      fp2: { startTime: ts('2026-03-13T15:00:00Z'), endTime: ts('2026-03-13T16:00:00Z'), status: 'official' },
      fp3_or_sprint_q: { startTime: ts('2026-03-14T11:30:00Z'), endTime: ts('2026-03-14T12:30:00Z'), status: 'official' },
      qualifying: { startTime: ts('2026-03-14T15:00:00Z'), endTime: ts('2026-03-14T16:00:00Z'), status: 'official' },
      race: { startTime: ts('2026-03-15T15:00:00Z'), endTime: ts('2026-03-15T17:00:00Z'), status: 'official' },
    },
  })

  // Sprint weekend
  await setDoc(doc(db, 'events', 'china_2026'), {
    id: 'china_2026', round: 2, name: 'Chinese Grand Prix',
    circuit: 'Shanghai International Circuit', country: 'China',
    isSprintWeekend: true,
    sessions: {
      fp1: { startTime: ts('2026-03-20T03:30:00Z'), endTime: ts('2026-03-20T04:30:00Z'), status: 'official' },
      fp3_or_sprint_q: { startTime: ts('2026-03-20T07:30:00Z'), endTime: ts('2026-03-20T08:14:00Z'), status: 'official' },
      sprint_race: { startTime: ts('2026-03-21T04:00:00Z'), endTime: ts('2026-03-21T05:00:00Z'), status: 'official' },
      qualifying: { startTime: ts('2026-03-21T08:00:00Z'), endTime: ts('2026-03-21T09:00:00Z'), status: 'upcoming' },
      race: { startTime: ts('2026-03-22T07:00:00Z'), endTime: ts('2026-03-22T09:00:00Z'), status: 'upcoming' },
    },
  })

  // FP3 result for Bahrain (reference for qualifying tips)
  await setDoc(doc(db, 'session_results', 'bahrain_2026_fp3_or_sprint_q'), {
    id: 'bahrain_2026_fp3_or_sprint_q', eventId: 'bahrain_2026',
    sessionType: 'fp3_or_sprint_q', status: 'official',
    fetchedAt: Timestamp.now(), officialAt: Timestamp.now(),
    results: [
      { position: 1, driverId: 'max_verstappen', driverCode: 'VER', driverName: 'Max Verstappen' },
      { position: 2, driverId: 'lando_norris', driverCode: 'NOR', driverName: 'Lando Norris' },
      { position: 3, driverId: 'charles_leclerc', driverCode: 'LEC', driverName: 'Charles Leclerc' },
      { position: 4, driverId: 'carlos_sainz', driverCode: 'SAI', driverName: 'Carlos Sainz' },
      { position: 5, driverId: 'oscar_piastri', driverCode: 'PIA', driverName: 'Oscar Piastri' },
      { position: 6, driverId: 'george_russell', driverCode: 'RUS', driverName: 'George Russell' },
      { position: 7, driverId: 'lewis_hamilton', driverCode: 'HAM', driverName: 'Lewis Hamilton' },
      { position: 8, driverId: 'fernando_alonso', driverCode: 'ALO', driverName: 'Fernando Alonso' },
      { position: 9, driverId: 'kimi_antonelli', driverCode: 'ANT', driverName: 'Kimi Antonelli' },
      { position: 10, driverId: 'pierre_gasly', driverCode: 'GAS', driverName: 'Pierre Gasly' },
      { position: 11, driverId: 'lance_stroll', driverCode: 'STR', driverName: 'Lance Stroll' },
      { position: 12, driverId: 'yuki_tsunoda', driverCode: 'TSU', driverName: 'Yuki Tsunoda' },
      { position: 13, driverId: 'alex_albon', driverCode: 'ALB', driverName: 'Alex Albon' },
      { position: 14, driverId: 'isack_hadjar', driverCode: 'HAD', driverName: 'Isack Hadjar' },
      { position: 15, driverId: 'jack_doohan', driverCode: 'DOO', driverName: 'Jack Doohan' },
    ],
  })

  // Qualifying result for Bahrain (reference for race tips)
  await setDoc(doc(db, 'session_results', 'bahrain_2026_qualifying'), {
    id: 'bahrain_2026_qualifying', eventId: 'bahrain_2026',
    sessionType: 'qualifying', status: 'official',
    fetchedAt: Timestamp.now(), officialAt: Timestamp.now(),
    results: [
      { position: 1, driverId: 'max_verstappen', driverCode: 'VER', driverName: 'Max Verstappen' },
      { position: 2, driverId: 'charles_leclerc', driverCode: 'LEC', driverName: 'Charles Leclerc' },
      { position: 3, driverId: 'lando_norris', driverCode: 'NOR', driverName: 'Lando Norris' },
      { position: 4, driverId: 'oscar_piastri', driverCode: 'PIA', driverName: 'Oscar Piastri' },
      { position: 5, driverId: 'george_russell', driverCode: 'RUS', driverName: 'George Russell' },
      { position: 6, driverId: 'lewis_hamilton', driverCode: 'HAM', driverName: 'Lewis Hamilton' },
      { position: 7, driverId: 'carlos_sainz', driverCode: 'SAI', driverName: 'Carlos Sainz' },
      { position: 8, driverId: 'fernando_alonso', driverCode: 'ALO', driverName: 'Fernando Alonso' },
      { position: 9, driverId: 'kimi_antonelli', driverCode: 'ANT', driverName: 'Kimi Antonelli' },
      { position: 10, driverId: 'pierre_gasly', driverCode: 'GAS', driverName: 'Pierre Gasly' },
      { position: 11, driverId: 'lance_stroll', driverCode: 'STR', driverName: 'Lance Stroll' },
      { position: 12, driverId: 'yuki_tsunoda', driverCode: 'TSU', driverName: 'Yuki Tsunoda' },
      { position: 13, driverId: 'alex_albon', driverCode: 'ALB', driverName: 'Alex Albon' },
      { position: 14, driverId: 'isack_hadjar', driverCode: 'HAD', driverName: 'Isack Hadjar' },
      { position: 15, driverId: 'jack_doohan', driverCode: 'DOO', driverName: 'Jack Doohan' },
    ],
  })

  console.log('Done! Login: player1@test.com / test1234')
}

seed().catch(console.error).finally(() => process.exit(0))
