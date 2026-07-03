import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import seasonData from '../data/season-2026.json'

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)
const app = initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore(app)

function ts(iso: string) { return Timestamp.fromDate(new Date(iso)) }
function add(iso: string, hours: number) {
  return Timestamp.fromDate(new Date(new Date(iso).getTime() + hours * 3600000))
}
function session(start: string, durationH: number, status: 'official' | 'upcoming') {
  return { startTime: ts(start), endTime: add(start, durationH), status }
}

async function seed() {
  console.log('Seeding drivers...')
  for (const driver of seasonData.drivers) {
    await db.collection('drivers_2026').doc(driver.id).set(driver)
  }

  // Remove stale data from cancelled Bahrain GP
  console.log('Removing stale Bahrain data...')
  await db.collection('events').doc('bahrain_2026').delete()
  await db.collection('session_results').doc('bahrain_2026_fp3_or_sprint_q').delete()
  await db.collection('session_results').doc('bahrain_2026_qualifying').delete()

  console.log('Seeding events...')

  // Round 1 — Australian GP (Melbourne, UTC+11) — OFFICIAL
  await db.collection('events').doc('australia_2026').set({
    id: 'australia_2026', round: 1, name: 'Australian Grand Prix',
    circuit: 'Albert Park Circuit', country: 'Australia', isSprintWeekend: false,
    sessions: {
      fp1:              session('2026-03-06T00:30:00Z', 1, 'official'),
      fp2:              session('2026-03-06T04:00:00Z', 1, 'official'),
      fp3_or_sprint_q:  session('2026-03-07T00:30:00Z', 1, 'official'),
      qualifying:       session('2026-03-07T04:00:00Z', 1, 'official'),
      race:             session('2026-03-08T04:00:00Z', 2, 'official'),
    },
  })

  // Round 2 — Chinese GP (Shanghai, UTC+8) — SPRINT — OFFICIAL
  await db.collection('events').doc('china_2026').set({
    id: 'china_2026', round: 2, name: 'Chinese Grand Prix',
    circuit: 'Shanghai International Circuit', country: 'China', isSprintWeekend: true,
    sessions: {
      fp1:              session('2026-03-13T03:30:00Z', 1, 'official'),
      fp3_or_sprint_q:  session('2026-03-13T07:30:00Z', 1, 'official'),
      sprint_race:      session('2026-03-14T03:00:00Z', 1, 'official'),
      qualifying:       session('2026-03-14T07:00:00Z', 1, 'official'),
      race:             session('2026-03-15T07:00:00Z', 2, 'official'),
    },
  })

  // Round 3 — Japanese GP (Suzuka, UTC+9) — OFFICIAL
  await db.collection('events').doc('japan_2026').set({
    id: 'japan_2026', round: 3, name: 'Japanese Grand Prix',
    circuit: 'Suzuka International Racing Course', country: 'Japan', isSprintWeekend: false,
    sessions: {
      fp1:              session('2026-03-27T02:30:00Z', 1, 'official'),
      fp2:              session('2026-03-27T06:00:00Z', 1, 'official'),
      fp3_or_sprint_q:  session('2026-03-28T02:30:00Z', 1, 'official'),
      qualifying:       session('2026-03-28T06:00:00Z', 1, 'official'),
      race:             session('2026-03-29T05:00:00Z', 2, 'official'),
    },
  })

  // Round 4 — Miami GP (UTC-4) — SPRINT — OFFICIAL
  await db.collection('events').doc('miami_2026').set({
    id: 'miami_2026', round: 4, name: 'Miami Grand Prix',
    circuit: 'Miami International Autodrome', country: 'USA', isSprintWeekend: true,
    sessions: {
      fp1:              session('2026-05-01T16:30:00Z', 1, 'official'),
      fp3_or_sprint_q:  session('2026-05-01T20:30:00Z', 1, 'official'),
      sprint_race:      session('2026-05-02T16:00:00Z', 1, 'official'),
      qualifying:       session('2026-05-02T20:00:00Z', 1, 'official'),
      race:             session('2026-05-03T20:00:00Z', 2, 'official'),
    },
  })

  // Round 5 — Canadian GP (Montreal, UTC-4) — SPRINT — OFFICIAL
  await db.collection('events').doc('canada_2026').set({
    id: 'canada_2026', round: 5, name: 'Canadian Grand Prix',
    circuit: 'Circuit Gilles Villeneuve', country: 'Canada', isSprintWeekend: true,
    sessions: {
      fp1:              session('2026-05-22T16:30:00Z', 1, 'official'),
      fp3_or_sprint_q:  session('2026-05-22T20:30:00Z', 1, 'official'),
      sprint_race:      session('2026-05-23T16:00:00Z', 1, 'official'),
      qualifying:       session('2026-05-23T20:00:00Z', 1, 'official'),
      race:             session('2026-05-24T18:00:00Z', 2, 'official'),
    },
  })

  // Round 6 — Monaco GP (UTC+2) — OFFICIAL
  await db.collection('events').doc('monaco_2026').set({
    id: 'monaco_2026', round: 6, name: 'Monaco Grand Prix',
    circuit: 'Circuit de Monaco', country: 'Monaco', isSprintWeekend: false,
    sessions: {
      fp1:              session('2026-06-05T11:30:00Z', 1, 'official'),
      fp2:              session('2026-06-05T15:00:00Z', 1, 'official'),
      fp3_or_sprint_q:  session('2026-06-06T10:30:00Z', 1, 'official'),
      qualifying:       session('2026-06-06T14:00:00Z', 1, 'official'),
      race:             session('2026-06-07T13:00:00Z', 2, 'official'),
    },
  })

  // Round 7 — Spanish GP / Barcelona (UTC+2) — UPCOMING
  await db.collection('events').doc('barcelona_2026').set({
    id: 'barcelona_2026', round: 7, name: 'Spanish Grand Prix',
    circuit: 'Circuit de Barcelona-Catalunya', country: 'Spain', isSprintWeekend: false,
    sessions: {
      fp1:              session('2026-06-12T11:30:00Z', 1, 'upcoming'),
      fp2:              session('2026-06-12T15:00:00Z', 1, 'upcoming'),
      fp3_or_sprint_q:  session('2026-06-13T10:30:00Z', 1, 'upcoming'),
      qualifying:       session('2026-06-13T14:00:00Z', 1, 'upcoming'),
      race:             session('2026-06-14T13:00:00Z', 2, 'upcoming'),
    },
  })

  // Round 8 — Austrian GP (Spielberg, UTC+2)
  await db.collection('events').doc('austria_2026').set({
    id: 'austria_2026', round: 8, name: 'Austrian Grand Prix',
    circuit: 'Red Bull Ring', country: 'Austria', isSprintWeekend: false,
    sessions: {
      fp1:              session('2026-06-26T10:30:00Z', 1, 'upcoming'),
      fp2:              session('2026-06-26T14:00:00Z', 1, 'upcoming'),
      fp3_or_sprint_q:  session('2026-06-27T09:30:00Z', 1, 'upcoming'),
      qualifying:       session('2026-06-27T13:00:00Z', 1, 'upcoming'),
      race:             session('2026-06-28T13:00:00Z', 2, 'upcoming'),
    },
  })

  // Round 9 — British GP (Silverstone, UTC+1) — SPRINT
  await db.collection('events').doc('britain_2026').set({
    id: 'britain_2026', round: 9, name: 'British Grand Prix',
    circuit: 'Silverstone Circuit', country: 'Great Britain', isSprintWeekend: true,
    sessions: {
      fp1:              session('2026-07-03T12:30:00Z', 1, 'upcoming'),
      fp3_or_sprint_q:  session('2026-07-03T15:30:00Z', 1, 'upcoming'),
      sprint_race:      session('2026-07-04T11:00:00Z', 1, 'upcoming'),
      qualifying:       session('2026-07-04T15:00:00Z', 1, 'upcoming'),
      race:             session('2026-07-05T14:00:00Z', 2, 'upcoming'),
    },
  })

  // Round 10 — Belgian GP (Spa, UTC+2)
  await db.collection('events').doc('belgium_2026').set({
    id: 'belgium_2026', round: 10, name: 'Belgian Grand Prix',
    circuit: 'Circuit de Spa-Francorchamps', country: 'Belgium', isSprintWeekend: false,
    sessions: {
      fp1:              session('2026-07-17T11:30:00Z', 1, 'upcoming'),
      fp2:              session('2026-07-17T15:00:00Z', 1, 'upcoming'),
      fp3_or_sprint_q:  session('2026-07-18T10:30:00Z', 1, 'upcoming'),
      qualifying:       session('2026-07-18T14:00:00Z', 1, 'upcoming'),
      race:             session('2026-07-19T13:00:00Z', 2, 'upcoming'),
    },
  })

  // Round 11 — Hungarian GP (Budapest, UTC+2)
  await db.collection('events').doc('hungary_2026').set({
    id: 'hungary_2026', round: 11, name: 'Hungarian Grand Prix',
    circuit: 'Hungaroring', country: 'Hungary', isSprintWeekend: false,
    sessions: {
      fp1:              session('2026-07-24T11:30:00Z', 1, 'upcoming'),
      fp2:              session('2026-07-24T15:00:00Z', 1, 'upcoming'),
      fp3_or_sprint_q:  session('2026-07-25T10:30:00Z', 1, 'upcoming'),
      qualifying:       session('2026-07-25T14:00:00Z', 1, 'upcoming'),
      race:             session('2026-07-26T13:00:00Z', 2, 'upcoming'),
    },
  })

  // Round 12 — Dutch GP (Zandvoort, UTC+2) — SPRINT
  await db.collection('events').doc('netherlands_2026').set({
    id: 'netherlands_2026', round: 12, name: 'Dutch Grand Prix',
    circuit: 'Circuit Zandvoort', country: 'Netherlands', isSprintWeekend: true,
    sessions: {
      fp1:              session('2026-08-21T10:30:00Z', 1, 'upcoming'),
      fp3_or_sprint_q:  session('2026-08-21T14:30:00Z', 1, 'upcoming'),
      sprint_race:      session('2026-08-22T10:00:00Z', 1, 'upcoming'),
      qualifying:       session('2026-08-22T13:00:00Z', 1, 'upcoming'),
      race:             session('2026-08-23T13:00:00Z', 2, 'upcoming'),
    },
  })

  // Round 13 — Italian GP (Monza, UTC+2)
  await db.collection('events').doc('italy_2026').set({
    id: 'italy_2026', round: 13, name: 'Italian Grand Prix',
    circuit: 'Autodromo Nazionale Monza', country: 'Italy', isSprintWeekend: false,
    sessions: {
      fp1:              session('2026-09-04T11:30:00Z', 1, 'upcoming'),
      fp2:              session('2026-09-04T15:00:00Z', 1, 'upcoming'),
      fp3_or_sprint_q:  session('2026-09-05T10:30:00Z', 1, 'upcoming'),
      qualifying:       session('2026-09-05T14:00:00Z', 1, 'upcoming'),
      race:             session('2026-09-06T13:00:00Z', 2, 'upcoming'),
    },
  })

  // Round 14 — Spanish GP Madrid (UTC+2)
  await db.collection('events').doc('madrid_2026').set({
    id: 'madrid_2026', round: 14, name: 'Spanish Grand Prix (Madrid)',
    circuit: 'Circuito del Jarama', country: 'Spain', isSprintWeekend: false,
    sessions: {
      fp1:              session('2026-09-11T11:30:00Z', 1, 'upcoming'),
      fp2:              session('2026-09-11T15:00:00Z', 1, 'upcoming'),
      fp3_or_sprint_q:  session('2026-09-12T10:30:00Z', 1, 'upcoming'),
      qualifying:       session('2026-09-12T14:00:00Z', 1, 'upcoming'),
      race:             session('2026-09-13T13:00:00Z', 2, 'upcoming'),
    },
  })

  // Round 15 — Azerbaijan GP (Baku, UTC+4)
  await db.collection('events').doc('azerbaijan_2026').set({
    id: 'azerbaijan_2026', round: 15, name: 'Azerbaijan Grand Prix',
    circuit: 'Baku City Circuit', country: 'Azerbaijan', isSprintWeekend: false,
    sessions: {
      fp1:              session('2026-09-25T08:30:00Z', 1, 'upcoming'),
      fp2:              session('2026-09-25T12:00:00Z', 1, 'upcoming'),
      fp3_or_sprint_q:  session('2026-09-26T08:00:00Z', 1, 'upcoming'),
      qualifying:       session('2026-09-26T11:00:00Z', 1, 'upcoming'),
      race:             session('2026-09-27T11:00:00Z', 2, 'upcoming'),
    },
  })

  // Round 16 — Singapore GP (UTC+8) — SPRINT — night race
  await db.collection('events').doc('singapore_2026').set({
    id: 'singapore_2026', round: 16, name: 'Singapore Grand Prix',
    circuit: 'Marina Bay Street Circuit', country: 'Singapore', isSprintWeekend: true,
    sessions: {
      fp1:              session('2026-10-09T09:30:00Z', 1, 'upcoming'),
      fp3_or_sprint_q:  session('2026-10-09T13:30:00Z', 1, 'upcoming'),
      sprint_race:      session('2026-10-10T08:00:00Z', 1, 'upcoming'),
      qualifying:       session('2026-10-10T13:00:00Z', 1, 'upcoming'),
      race:             session('2026-10-11T12:00:00Z', 2, 'upcoming'),
    },
  })

  // Round 17 — United States GP (Austin, UTC-5)
  await db.collection('events').doc('usa_2026').set({
    id: 'usa_2026', round: 17, name: 'United States Grand Prix',
    circuit: 'Circuit of the Americas', country: 'USA', isSprintWeekend: false,
    sessions: {
      fp1:              session('2026-10-23T17:30:00Z', 1, 'upcoming'),
      fp2:              session('2026-10-23T21:30:00Z', 1, 'upcoming'),
      fp3_or_sprint_q:  session('2026-10-24T17:30:00Z', 1, 'upcoming'),
      qualifying:       session('2026-10-24T21:00:00Z', 1, 'upcoming'),
      race:             session('2026-10-25T19:00:00Z', 2, 'upcoming'),
    },
  })

  // Round 18 — Mexican GP (Mexico City, UTC-6)
  await db.collection('events').doc('mexico_2026').set({
    id: 'mexico_2026', round: 18, name: 'Mexican Grand Prix',
    circuit: 'Autódromo Hermanos Rodríguez', country: 'Mexico', isSprintWeekend: false,
    sessions: {
      fp1:              session('2026-10-30T18:00:00Z', 1, 'upcoming'),
      fp2:              session('2026-10-30T22:00:00Z', 1, 'upcoming'),
      fp3_or_sprint_q:  session('2026-10-31T17:30:00Z', 1, 'upcoming'),
      qualifying:       session('2026-10-31T21:00:00Z', 1, 'upcoming'),
      race:             session('2026-11-01T20:00:00Z', 2, 'upcoming'),
    },
  })

  // Round 19 — Brazilian GP (São Paulo, UTC-3)
  await db.collection('events').doc('brazil_2026').set({
    id: 'brazil_2026', round: 19, name: 'Brazilian Grand Prix',
    circuit: 'Autódromo José Carlos Pace', country: 'Brazil', isSprintWeekend: false,
    sessions: {
      fp1:              session('2026-11-06T17:30:00Z', 1, 'upcoming'),
      fp2:              session('2026-11-06T21:30:00Z', 1, 'upcoming'),
      fp3_or_sprint_q:  session('2026-11-07T17:30:00Z', 1, 'upcoming'),
      qualifying:       session('2026-11-07T21:00:00Z', 1, 'upcoming'),
      race:             session('2026-11-08T17:00:00Z', 2, 'upcoming'),
    },
  })

  // Round 20 — Las Vegas GP (UTC-8) — night race
  await db.collection('events').doc('lasvegas_2026').set({
    id: 'lasvegas_2026', round: 20, name: 'Las Vegas Grand Prix',
    circuit: 'Las Vegas Strip Circuit', country: 'USA', isSprintWeekend: false,
    sessions: {
      fp1:              session('2026-11-20T04:00:00Z', 1, 'upcoming'),
      fp2:              session('2026-11-20T08:00:00Z', 1, 'upcoming'),
      fp3_or_sprint_q:  session('2026-11-22T02:00:00Z', 1, 'upcoming'),
      qualifying:       session('2026-11-22T06:00:00Z', 1, 'upcoming'),
      race:             session('2026-11-22T06:00:00Z', 2, 'upcoming'),
    },
  })

  // Round 21 — Qatar GP (Lusail, UTC+3)
  await db.collection('events').doc('qatar_2026').set({
    id: 'qatar_2026', round: 21, name: 'Qatar Grand Prix',
    circuit: 'Lusail International Circuit', country: 'Qatar', isSprintWeekend: false,
    sessions: {
      fp1:              session('2026-11-27T14:30:00Z', 1, 'upcoming'),
      fp2:              session('2026-11-27T18:00:00Z', 1, 'upcoming'),
      fp3_or_sprint_q:  session('2026-11-28T14:30:00Z', 1, 'upcoming'),
      qualifying:       session('2026-11-28T18:00:00Z', 1, 'upcoming'),
      race:             session('2026-11-29T16:00:00Z', 2, 'upcoming'),
    },
  })

  // Round 22 — Abu Dhabi GP (Yas Marina, UTC+4)
  await db.collection('events').doc('abudhabi_2026').set({
    id: 'abudhabi_2026', round: 22, name: 'Abu Dhabi Grand Prix',
    circuit: 'Yas Marina Circuit', country: 'UAE', isSprintWeekend: false,
    sessions: {
      fp1:              session('2026-12-04T09:30:00Z', 1, 'upcoming'),
      fp2:              session('2026-12-04T13:00:00Z', 1, 'upcoming'),
      fp3_or_sprint_q:  session('2026-12-05T09:30:00Z', 1, 'upcoming'),
      qualifying:       session('2026-12-05T13:00:00Z', 1, 'upcoming'),
      race:             session('2026-12-06T13:00:00Z', 2, 'upcoming'),
    },
  })

  console.log('Done! Production database seeded with 2026 season data.')
}

seed().catch(console.error).finally(() => process.exit(0))
