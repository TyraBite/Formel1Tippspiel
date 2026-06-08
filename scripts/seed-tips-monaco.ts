import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)
const app = initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore(app)

// ⚠️ UIDs hier eintragen (Authentication → Users → UID-Spalte)
const USER1_ID = 'OOaxsji4p9WIDyzMezdj3XYIJwU2'
const USER2_ID = 'm8JFV69FrQfifEkauIaBjghRfhe2'

const codeToId: Record<string, string> = {
  VER: 'max_verstappen',
  ANT: 'kimi_antonelli',
  LEC: 'charles_leclerc',
  HAM: 'lewis_hamilton',
  RUS: 'george_russell',
  PIA: 'oscar_piastri',
  HAD: 'isack_hadjar',
  NOR: 'lando_norris',
  GAS: 'pierre_gasly',
  SAI: 'carlos_sainz',
  LAW: 'liam_lawson',
}

function toPredictions(codes: string[]): Record<string, string> {
  return Object.fromEntries(codes.map((code, i) => [String(i + 1), codeToId[code]]))
}

const tips = [
  {
    userId: USER1_ID,
    predictions: toPredictions(['VER', 'ANT', 'LEC', 'HAM', 'RUS', 'PIA', 'HAD', 'NOR', 'GAS', 'SAI']),
  },
  {
    userId: USER2_ID,
    predictions: toPredictions(['ANT', 'VER', 'HAM', 'LEC', 'HAD', 'PIA', 'RUS', 'NOR', 'LAW', 'GAS']),
  },
]

async function seed() {
  for (const tip of tips) {
    const id = `${tip.userId}_monaco_2026_race`
    await db.collection('tips').doc(id).set({
      id,
      userId: tip.userId,
      eventId: 'monaco_2026',
      sessionType: 'race',
      predictions: tip.predictions,
      updatedAt: Timestamp.now(),
      lockedAt: Timestamp.now(),
    })
    console.log(`Tipp gespeichert: ${id}`)
  }
  console.log('Fertig!')
}

seed().catch(console.error).finally(() => process.exit(0))
