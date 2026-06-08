import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import seasonData from '../data/season-2026.json'

// Usage: GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json npm run seed:prod

const app = initializeApp({ credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS!) })
const db = getFirestore(app)

function ts(iso: string) { return Timestamp.fromDate(new Date(iso)) }

async function seed() {
  console.log('Seeding drivers...')
  for (const driver of seasonData.drivers) {
    await db.collection('drivers').doc(driver.id).set(driver)
  }

  console.log('Seeding events...')
  await db.collection('events').doc('bahrain_2026').set({
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

  await db.collection('events').doc('china_2026').set({
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

  console.log('Seeding session results...')
  await db.collection('session_results').doc('bahrain_2026_fp3_or_sprint_q').set({
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

  await db.collection('session_results').doc('bahrain_2026_qualifying').set({
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

  console.log('Done! Production database seeded.')
}

seed().catch(console.error).finally(() => process.exit(0))
