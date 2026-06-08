import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { appendFileSync } from 'fs'

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

async function check() {
  const now = new Date()
  const windowStart = new Date(now.getTime() - 2 * 3_600_000)
  const windowEnd = new Date(now.getTime() + 48 * 3_600_000)

  const snap = await db.collection('events').get()
  let isRaceWeekend = false

  outer: for (const docSnap of snap.docs) {
    const sessions = docSnap.data().sessions ?? {}
    for (const sessionInfo of Object.values(sessions)) {
      const endTime: Date | undefined = (sessionInfo as any)?.endTime?.toDate?.()
      if (!endTime) continue
      if (endTime >= windowStart && endTime <= windowEnd) {
        isRaceWeekend = true
        break outer
      }
    }
  }

  const output = `is_race_weekend=${isRaceWeekend}`
  console.log(output)

  const githubOutput = process.env.GITHUB_OUTPUT
  if (githubOutput) appendFileSync(githubOutput, `${output}\n`)
}

check().catch(e => { console.error(e); process.exit(1) }).finally(() => process.exit(0))
